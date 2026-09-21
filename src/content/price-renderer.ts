import type { DetectedPrice } from '@/core/types';
import { REPLACEMENT_ATTRIBUTE, unsafeJoins, type TextSegment } from './dom-scanner';

/**
 * Rewriting prices in the DOM.
 *
 * A price often spans several text nodes — `<span>1 000</span><span>Kč</span>`
 * — so replacement works on a whole segment and uses a Range to cover however
 * many nodes the match touches. Matches are applied back to front, because
 * each edit invalidates the offsets after it.
 *
 * Replacements are built exclusively from text nodes and `textContent`, never
 * from markup strings, so nothing on the page can turn a rewritten price into
 * an injection vector. The original text is kept on the element, which makes
 * the change both explainable to the user and fully reversible.
 */

export const REPLACEMENT_CLASS = 'pcx-price';
export const HIGHLIGHT_CLASS = 'pcx-price--highlight';

export interface RenderOptions {
  /** Expose the original price as a tooltip on the replacement. */
  readonly showTooltip: boolean;
  /** Give replacements a dotted underline so they are recognisable. */
  readonly highlight: boolean;
}

/** Produces the replacement text, or null to leave this price alone. */
export type RenderPrice = (price: DetectedPrice) => string | null;

function buildReplacement(
  price: DetectedPrice,
  rendered: string,
  options: RenderOptions,
): HTMLElement {
  const element = document.createElement('span');
  element.className = options.highlight
    ? `${REPLACEMENT_CLASS} ${HIGHLIGHT_CLASS}`
    : REPLACEMENT_CLASS;
  element.setAttribute(REPLACEMENT_ATTRIBUTE, price.text);
  if (options.showTooltip) element.title = price.text;
  element.textContent = rendered;
  return element;
}

interface Position {
  readonly node: Text;
  readonly offset: number;
}

function nodeLength(node: Text): number {
  return (node.nodeValue ?? '').length;
}

/** Maps a segment offset to the node that contains the character at it. */
function locateStart(segment: TextSegment, offset: number): Position | null {
  for (let i = 0; i < segment.nodes.length; i += 1) {
    const node = segment.nodes[i];
    const start = segment.offsets[i];
    if (node === undefined || start === undefined) continue;
    // Clamp: an offset can land on an inserted separator, which is part of
    // the segment text but belongs to no node.
    if (offset < start + nodeLength(node)) {
      return { node, offset: Math.min(Math.max(offset - start, 0), nodeLength(node)) };
    }
  }
  return null;
}

/** Maps a segment offset to the node that contains the character before it. */
function locateEnd(segment: TextSegment, offset: number): Position | null {
  for (let i = segment.nodes.length - 1; i >= 0; i -= 1) {
    const node = segment.nodes[i];
    const start = segment.offsets[i];
    if (node === undefined || start === undefined) continue;
    if (offset > start) return { node, offset: Math.min(offset - start, nodeLength(node)) };
  }
  return null;
}

/**
 * Replaces every convertible price in one segment of inline text.
 *
 * Expects `prices` in document order and non-overlapping, which is what
 * `detectPrices` returns.
 *
 * @returns true when anything was rewritten.
 */
export function replacePricesInSegment(
  segment: TextSegment,
  prices: readonly DetectedPrice[],
  render: RenderPrice,
  options: RenderOptions,
): boolean {
  if (prices.length === 0) return false;

  const joins = unsafeJoins(segment);
  let replaced = false;

  // Back to front: an edit shifts every offset after it.
  for (let i = prices.length - 1; i >= 0; i -= 1) {
    const price = prices[i];
    if (price === undefined) continue;

    // A match reading across a digit-to-digit element boundary is an artefact
    // of joining the runs, not something written on the page.
    if (joins.some((at) => at > price.start && at < price.end)) continue;

    const rendered = render(price);
    if (rendered === null) continue;

    const start = locateStart(segment, price.start);
    const end = locateEnd(segment, price.end);
    if (start === null || end === null) continue;
    if (!start.node.isConnected || !end.node.isConnected) continue;

    const range = document.createRange();
    try {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      range.deleteContents();
      range.insertNode(buildReplacement(price, rendered, options));
    } catch {
      // The page can move nodes out from under us between collection and now.
      continue;
    } finally {
      range.detach();
    }
    replaced = true;
  }

  return replaced;
}

/**
 * Puts every replaced price under `root` back the way it was, and merges the
 * surrounding text nodes so the DOM ends up as it started.
 *
 * A price that spanned several elements is restored as plain text in the
 * first of them; the text reads identically, but the original inline split is
 * not recreated.
 */
export function revertReplacements(root: ParentNode): void {
  const replacements = root.querySelectorAll(`[${REPLACEMENT_ATTRIBUTE}]`);

  for (const element of replacements) {
    const original = element.getAttribute(REPLACEMENT_ATTRIBUTE);
    const parent = element.parentNode;
    if (original === null || parent === null) continue;
    parent.replaceChild(document.createTextNode(original), element);
    parent.normalize();
  }
}
