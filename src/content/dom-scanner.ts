/**
 * Walking the page without getting in its way.
 *
 * Text is collected in *segments* rather than individual nodes. A segment is
 * one uninterrupted run of inline text, however many elements it is spread
 * across, because pages routinely split a single price into several of them:
 *
 *     <span>1 000</span><span>Kč</span>
 *     1 000<sup>,-</sup>
 *
 * Scanning node by node would miss every one of those. Segments are broken at
 * block-level boundaries and at <br>, so text that is visually on separate
 * lines is never joined up.
 *
 * The scanner never does more than a few milliseconds of work at a time:
 * segments are processed in slices handed out by requestIdleCallback, so a
 * long page is converted progressively and scrolling stays smooth.
 */

/** Marks our own replacement elements so they are never rescanned. */
export const REPLACEMENT_ATTRIBUTE = 'data-pcx-original';

/** Opt-out hook a site (or the user, via devtools) can set on a subtree. */
export const SKIP_ATTRIBUTE = 'data-pcx-skip';

/**
 * Elements whose text is not prose: editing surfaces where a rewrite would
 * corrupt user input, and technical content where a number that looks like a
 * price is not one.
 */
const SKIP_TAGS: ReadonlySet<string> = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'OPTGROUP',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
  'VAR',
  'SVG',
  'MATH',
  'CANVAS',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'AUDIO',
  'VIDEO',
  'HEAD',
  'TITLE',
  'META',
  'LINK',
]);

/**
 * Elements that end a run of inline text.
 *
 * This is a tag list rather than a computed-style check on purpose: reading
 * `display` forces layout, and doing that per element on every page would
 * cost far more than the occasional imperfect boundary. A styled-inline block
 * that slips through can only cause two runs to be joined, and the digit
 * guard below keeps that from inventing a price.
 */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BODY',
  'CAPTION',
  'DD',
  'DETAILS',
  'DIALOG',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HGROUP',
  'HR',
  'LEGEND',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'SECTION',
  'SUMMARY',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);

/** Segments with no digit cannot hold a price; the cheapest possible filter. */
const DIGIT_RE = /\d/;

/** Skip absurdly long runs rather than spend the whole budget on one blob. */
const MAX_SEGMENT_LENGTH = 5_000;

/** Work slice: stop once the frame is this close to running out of time. */
const MIN_REMAINING_MS = 3;

/** Hard cap per slice, for browsers that report a generous idle budget. */
const MAX_SEGMENTS_PER_SLICE = 60;

/**
 * One uninterrupted run of inline text, and the nodes it is made of.
 *
 * `text` is the concatenation of every node's value, and `offsets[i]` is where
 * node `i` starts within it, so a match found in `text` can be mapped back to
 * the nodes it covers.
 */
export interface TextSegment {
  readonly nodes: readonly Text[];
  readonly text: string;
  readonly offsets: readonly number[];
}

function shouldSkipElement(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName.toUpperCase())) return true;
  if (element.hasAttribute(SKIP_ATTRIBUTE)) return true;
  // Our own output, and anything the user can type into.
  if (element.hasAttribute(REPLACEMENT_ATTRIBUTE)) return true;
  // Check the attribute as well as the live property: the attribute is the
  // declarative truth and does not depend on the element being laid out,
  // while the property also catches editability inherited from an ancestor.
  const editable = element.getAttribute('contenteditable');
  if (editable !== null && editable.toLowerCase() !== 'false') return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return false;
}

/** True when the node sits inside a subtree the scanner must leave alone. */
export function isInSkippedSubtree(node: Node): boolean {
  let current: Node | null = node.parentNode;
  while (current !== null) {
    if (current.nodeType === Node.ELEMENT_NODE && shouldSkipElement(current as Element)) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

/**
 * Nearest block-level ancestor, which identifies the run of inline text a node
 * belongs to. Two consecutive text nodes with different block ancestors are in
 * different runs, and so are never joined.
 */
function blockContext(node: Node, root: Node): Node {
  let current: Node | null = node.parentNode;
  while (current !== null && current !== root) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((current as Element).tagName.toUpperCase())
    ) {
      return current;
    }
    current = current.parentNode;
  }
  return root;
}

/**
 * Nearest block-level element at or above `node`, falling back to the body.
 *
 * Rescanning after a DOM change has to start from here rather than from the
 * changed node itself: a page that inserts `<span>999</span><span>Kč</span>`
 * hands us two nodes that each hold only half a price, and scanning them
 * separately would never see the whole thing.
 */
export function closestBlockElement(node: Node): Element | null {
  let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;

  while (current !== null) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((current as Element).tagName.toUpperCase())
    ) {
      return current as Element;
    }
    current = current.parentNode;
  }
  return document.body;
}

/**
 * Placed between two nodes whose text would otherwise be glued together into
 * something the page never showed. It is a control character, so it is
 * neither a letter, a digit, nor any separator the amount pattern accepts,
 * and no match can ever span it.
 */
const JOIN_SEPARATOR = '\u0001';

const LETTER_RE = /\p{L}/u;

/** Both helpers take a single character. */
function isLetter(character: string): boolean {
  return LETTER_RE.test(character);
}

function isDigit(character: string): boolean {
  const code = character.codePointAt(0);
  return code !== undefined && code >= 0x30 && code <= 0x39;
}

/**
 * True when joining two nodes would glue together text the page showed apart.
 *
 * Neighbouring elements have no whitespace between them, so concatenating
 * their text invents adjacencies. Two of those break detection:
 *
 *   `<span>Novinka</span><span>13&nbsp;990,-</span>` → "Novinka13 990,-"
 *       the word boundary before the amount fails, so only "990,-" matches
 *       and a stray "13 " is left on the page.
 *   `<span>195,-</span><span>Bez členství…</span>` → "195,-Bez členství…"
 *       the boundary after the marker fails, so nothing matches at all.
 *
 * A digit running into a word is the one case that must stay glued: that is
 * `1 000` followed by `Kč`, which has to read as one price. Everything else
 * meeting a word, and every word meeting a digit, gets separated.
 */
function needsSeparator(before: string, after: string): boolean {
  const beforeIsDigit = isDigit(before);
  if (isLetter(before) && isDigit(after)) return true;
  if (!beforeIsDigit && isLetter(after)) return true;
  return false;
}

/** Concatenates node values, separating the joins that must not read as one. */
function joinNodes(nodes: readonly Text[]): { text: string; offsets: number[] } {
  const offsets: number[] = [];
  let text = '';

  for (const node of nodes) {
    const value = node.nodeValue ?? '';
    const previous = text.at(-1);
    const first = value[0];
    if (previous !== undefined && first !== undefined && needsSeparator(previous, first)) {
      text += JOIN_SEPARATOR;
    }
    offsets.push(text.length);
    text += value;
  }

  return { text, offsets };
}

/** Assembles a segment from the nodes gathered so far, or null if unusable. */
function buildSegment(nodes: Text[]): TextSegment | null {
  if (nodes.length === 0) return null;

  const { text, offsets } = joinNodes(nodes);
  if (text.length > MAX_SEGMENT_LENGTH || !DIGIT_RE.test(text)) return null;
  return { nodes: [...nodes], text, offsets };
}

/**
 * True when a segment still describes the nodes it was built from.
 *
 * Segments are collected up front and then processed over many idle slices, so
 * by the time one is acted on its nodes may have moved on — the page rewrote
 * them, or an earlier segment in the same pass already replaced a price they
 * share. Offsets taken from stale text land on characters that are no longer
 * there, which deletes the wrong ones and inserts a replacement next to the
 * one already standing: the price ends up rendered twice.
 *
 * Checking that the nodes are still attached is not enough. `deleteContents()`
 * leaves the text node in place and merely shortens it, so a node that has
 * already had its price taken out still passes `isConnected`.
 */
export function isSegmentCurrent(segment: TextSegment): boolean {
  for (const node of segment.nodes) {
    if (!node.isConnected) return false;
  }
  return joinNodes(segment.nodes).text === segment.text;
}

/**
 * Drops every root that sits inside another root of the same batch.
 *
 * A framework that appends a container and then fills it produces separate
 * mutation records, so the pending set routinely holds a block and a block
 * nested in it. Walking both puts the same text node into two segments, and
 * scanning the inner one again is wasted work on text the outer walk already
 * covered.
 */
export function outermostRoots(roots: readonly Node[]): Node[] {
  return roots.filter((root) => !roots.some((other) => other !== root && other.contains(root)));
}

/**
 * Collects the runs of inline text under `root`, and any open shadow roots
 * found along the way so their contents get scanned too.
 */
export function collectSegments(root: Node, shadowRoots: Node[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let pending: Text[] = [];
  let context: Node | null = null;

  const flush = (): void => {
    const segment = buildSegment(pending);
    if (segment !== null) segments.push(segment);
    pending = [];
    context = null;
  };

  // A rejected element is never handed back by the walker, so the fact that
  // it interrupted the run has to be recorded here, as the filter sees it.
  // The filter runs in document order, so the flag is always set before the
  // text node that follows the interruption is returned.
  let breakPending = false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        // Rejecting an element prunes its whole subtree in one step. Text on
        // either side of it is not a continuous run.
        if (shouldSkipElement(element)) {
          breakPending = true;
          return NodeFilter.FILTER_REJECT;
        }
        if (element.shadowRoot !== null) shadowRoots.push(element.shadowRoot);
        // A line break puts the text on separate lines, so it ends the run.
        if (element.tagName.toUpperCase() === 'BR') {
          breakPending = true;
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode() !== null) {
    const current = walker.currentNode;
    if (current.nodeType !== Node.TEXT_NODE) continue;

    if (breakPending) {
      flush();
      breakPending = false;
    }

    const nodeContext = blockContext(current, root);
    if (context !== null && nodeContext !== context) flush();
    context = nodeContext;
    pending.push(current as Text);
  }
  flush();

  // A root that is itself a text node is not returned by the walker.
  if (root.nodeType === Node.TEXT_NODE) {
    const segment = buildSegment([root as Text]);
    if (segment !== null) segments.push(segment);
  }

  return segments;
}

/**
 * Offsets inside a segment where one text node ends and the next begins and
 * digits meet across the join.
 *
 * Joining `<span>100</span><span>200 Kč</span>` would read as 100200 Kč, which
 * is not a price anybody wrote. A match spanning such a point is discarded —
 * the cost is one missed conversion where an element boundary falls inside a
 * number, which is far cheaper than inventing an amount.
 */
export function unsafeJoins(segment: TextSegment): number[] {
  const joins: number[] = [];

  for (let i = 1; i < segment.offsets.length; i += 1) {
    const at = segment.offsets[i];
    if (at === undefined || at === 0 || at >= segment.text.length) continue;

    const before = segment.text[at - 1];
    const after = segment.text[at];
    if (before === undefined || after === undefined) continue;
    if (before >= '0' && before <= '9' && after >= '0' && after <= '9') joins.push(at);
  }

  return joins;
}

type IdleHandle = number;

const requestIdle: (callback: (deadline: IdleDeadline) => void) => IdleHandle =
  typeof requestIdleCallback === 'function'
    ? (callback) => requestIdleCallback(callback, { timeout: 1_000 })
    : (callback) =>
        setTimeout(
          () => callback({ didTimeout: true, timeRemaining: () => 0 } as IdleDeadline),
          16,
        ) as unknown as IdleHandle;

const cancelIdle: (handle: IdleHandle) => void =
  typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout;

/**
 * Processes a queue of segments across idle slices.
 *
 * @returns a function that abandons any remaining work, used when the user
 *   turns the extension off mid-scan or the page navigates away.
 */
export function processInSlices(
  segments: readonly TextSegment[],
  visit: (segment: TextSegment) => void,
): () => void {
  let index = 0;
  let handle: IdleHandle | null = null;
  let cancelled = false;

  const step = (deadline: IdleDeadline): void => {
    handle = null;
    if (cancelled) return;

    let processed = 0;
    while (index < segments.length) {
      if (processed >= MAX_SEGMENTS_PER_SLICE) break;
      if (!deadline.didTimeout && deadline.timeRemaining() < MIN_REMAINING_MS) break;

      const segment = segments[index];
      index += 1;
      processed += 1;
      // The page, or an earlier segment sharing these nodes, can have moved on
      // since this one was collected.
      if (segment !== undefined && isSegmentCurrent(segment)) {
        visit(segment);
      }
    }

    if (index < segments.length) handle = requestIdle(step);
  };

  handle = requestIdle(step);

  return () => {
    cancelled = true;
    if (handle !== null) cancelIdle(handle);
  };
}
