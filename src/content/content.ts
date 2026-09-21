import { convertPrice } from '@/core/converter';
import { formatConversion } from '@/core/formatter';
import { compilePattern, detectPrices } from '@/core/price-detector';
import { getCommodity } from '@/core/registry/commodities';
import type { DetectedPrice, RateSnapshot } from '@/core/types';
import { commodityAmountLabel, translatorFor } from '@/shared/i18n';
import { MessageType, sendMessage } from '@/shared/messages';
import { isHostBlocked, loadSettings, SETTINGS_STORAGE_KEY, type Settings } from '@/shared/settings';
import {
  closestBlockElement,
  collectSegments,
  isInSkippedSubtree,
  outermostRoots,
  processInSlices,
  REPLACEMENT_ATTRIBUTE,
  type TextSegment,
} from './dom-scanner';
import { replacePricesInSegment, revertReplacements, type RenderOptions } from './price-renderer';

/**
 * The content script.
 *
 * It runs at document_idle and does all of its work in idle slices, so it
 * never competes with the page for the main thread during load. It makes no
 * network requests of its own — rates come from the service worker's cache.
 */

/** Wait this long after a burst of DOM changes before rescanning. */
const MUTATION_DEBOUNCE_MS = 300;

/** Past this many pending roots, rescanning the body is cheaper than tracking them. */
const MAX_PENDING_ROOTS = 50;

interface Session {
  stop(): void;
}

function startSession(settings: Settings, snapshot: RateSnapshot): Session | null {
  const pattern = compilePattern(settings.enabledCurrencies);
  const commodity = getCommodity(settings.commodity);
  if (pattern === null || commodity === undefined) return null;

  const translate = translatorFor(settings.language);
  const renderOptions: RenderOptions = {
    showTooltip: settings.showOriginalInTooltip,
    highlight: settings.highlightConverted,
  };

  const formatOptions = {
    locale: translate.locale,
    decimals: settings.decimals,
    labelStyle: settings.labelStyle,
    commodityName: commodityAmountLabel(translate, commodity.id),
  };

  const render = (price: DetectedPrice): string | null => {
    const converted = convertPrice(
      price.amount,
      price.currency,
      commodity,
      snapshot,
      settings.unit,
    );
    return converted === null ? null : formatConversion(converted, formatOptions);
  };

  const visit = (segment: TextSegment): void => {
    const prices = detectPrices(segment.text, pattern);
    if (prices.length === 0) return;
    replacePricesInSegment(segment, prices, render, renderOptions);
  };

  let cancelCurrentScan: (() => void) | null = null;
  let stopped = false;

  const scan = (roots: readonly Node[]): void => {
    if (stopped) return;

    const segments: TextSegment[] = [];
    const shadowRoots: Node[] = [];
    // Nested roots would walk the same text twice, and the second segment
    // would still carry the text the first one has already replaced.
    for (const root of outermostRoots(roots)) {
      if (root.isConnected) segments.push(...collectSegments(root, shadowRoots));
    }
    // Open shadow roots are walked in the same pass; nested ones are picked up
    // by the walk of their host root.
    for (const shadowRoot of shadowRoots) {
      segments.push(...collectSegments(shadowRoot, shadowRoots));
    }

    if (segments.length === 0) return;
    cancelCurrentScan?.();
    cancelCurrentScan = processInSlices(segments, visit);
  };

  scan([document.body]);

  // --- React to page changes -------------------------------------------------

  const pending = new Set<Node>();
  let debounceTimer: number | null = null;

  const flush = (): void => {
    debounceTimer = null;
    if (stopped || pending.size === 0) return;

    const roots = pending.size > MAX_PENDING_ROOTS ? [document.body] : [...pending];
    pending.clear();
    scan(roots);
  };

  /** Ignores the mutations we cause ourselves when replacing a price. */
  const isOurOwn = (node: Node): boolean => {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).hasAttribute(REPLACEMENT_ATTRIBUTE)) {
      return true;
    }
    return isInSkippedSubtree(node);
  };

  /**
   * Queues the run of inline text a change belongs to, not the changed node.
   * A price inserted as several elements is only whole when seen from the
   * block that contains them.
   */
  const queue = (node: Node): void => {
    if (isOurOwn(node)) return;
    const block = closestBlockElement(node);
    if (block !== null) pending.add(block);
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        queue(mutation.target);
        continue;
      }
      for (const added of mutation.addedNodes) queue(added);
    }

    if (pending.size === 0 || debounceTimer !== null) return;
    debounceTimer = setTimeout(flush, MUTATION_DEBOUNCE_MS) as unknown as number;
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  return {
    stop(): void {
      stopped = true;
      observer.disconnect();
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      cancelCurrentScan?.();
      revertReplacements(document);
    },
  };
}

// --- Lifecycle ---------------------------------------------------------------

let session: Session | null = null;
let starting = false;

async function applySettings(): Promise<void> {
  // Guard against overlapping restarts from rapid settings changes.
  if (starting) return;
  starting = true;

  try {
    session?.stop();
    session = null;

    // The script runs in every frame, and plenty of them (tracking pixels,
    // spacers, frames still being written) have nothing to work on.
    if (document.body === null) return;

    const settings = await loadSettings();
    if (!settings.enabled) return;
    if (isHostBlocked(location.hostname, settings.blockedHosts)) return;

    const response = await sendMessage(MessageType.GetRates);
    const snapshot = response?.snapshot ?? null;
    if (snapshot === null) return;

    session = startSession(settings, snapshot);
  } finally {
    starting = false;
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !(SETTINGS_STORAGE_KEY in changes)) return;
  void applySettings();
});

void applySettings();
