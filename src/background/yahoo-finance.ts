import type { Quote } from '@/core/types';
import type { RateProvider } from './rate-provider';

/**
 * Yahoo Finance rate provider.
 *
 * Uses the chart endpoint, which serves a small JSON document per symbol and
 * needs no key or session. Yahoo rate-limits bursts, so symbols are requested
 * one at a time with a short gap and a backoff on 429 — with a six-hour cache
 * in front of this, that costs nothing in practice.
 */

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';

/** Human-facing page credited in the options screen. */
const ATTRIBUTION_URL = 'https://finance.yahoo.com/commodities/';

/** Symbols come from our own registry; this is belt and braces against a
 *  malformed entry turning into a crafted request path. */
const SYMBOL_RE = /^[A-Za-z0-9^=.\-]{1,20}$/;

const REQUEST_TIMEOUT_MS = 10_000;
const GAP_BETWEEN_REQUESTS_MS = 150;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 3_000];

/** Anything outside this range is a bad quote, not a cheap or dear market. */
const MIN_PRICE = 1e-9;
const MAX_PRICE = 1e9;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * Pulls the quote out of a chart response.
 *
 * The payload is third-party data, so nothing is assumed about its shape and
 * anything unexpected is discarded rather than coerced.
 */
function readQuote(payload: unknown, symbol: string): Quote | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const chart = (payload as { chart?: unknown }).chart;
  if (typeof chart !== 'object' || chart === null) return null;

  if ((chart as { error?: unknown }).error != null) return null;

  const result = (chart as { result?: unknown }).result;
  if (!Array.isArray(result) || result.length === 0) return null;

  const meta = (result[0] as { meta?: unknown })?.meta;
  if (typeof meta !== 'object' || meta === null) return null;

  const price = (meta as { regularMarketPrice?: unknown }).regularMarketPrice;
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  if (price < MIN_PRICE || price > MAX_PRICE) return null;

  const marketTime = (meta as { regularMarketTime?: unknown }).regularMarketTime;
  const quotedAt =
    typeof marketTime === 'number' && Number.isFinite(marketTime)
      ? marketTime * 1000
      : Date.now();

  return { symbol, price, quotedAt };
}

async function fetchOne(symbol: string, signal: AbortSignal): Promise<Quote | null> {
  const url = `${BASE_URL}${symbol}?interval=1d&range=1d`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const combined = AbortSignal.any([signal, timeout]);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        // Never attach the user's Yahoo cookies: the extension has no business
        // making identifiable requests on their behalf.
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        headers: { Accept: 'application/json' },
        signal: combined,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      // Network error or timeout: retry if we have attempts left.
      const backoff = BACKOFF_MS[attempt];
      if (backoff === undefined) return null;
      await delay(backoff, signal);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      const backoff = BACKOFF_MS[attempt];
      if (backoff === undefined) return null;
      await delay(backoff, signal);
      continue;
    }
    if (!response.ok) return null;

    try {
      return readQuote(await response.json(), symbol);
    } catch {
      return null;
    }
  }
  return null;
}

export const yahooFinanceProvider: RateProvider = {
  id: 'yahoo-finance',
  attributionUrl: ATTRIBUTION_URL,

  async fetchQuotes(symbols, signal) {
    const quotes = new Map<string, Quote>();
    const wanted = [...new Set(symbols)].filter((symbol) => SYMBOL_RE.test(symbol));

    for (let i = 0; i < wanted.length; i += 1) {
      const symbol = wanted[i];
      if (symbol === undefined) continue;
      if (i > 0) await delay(GAP_BETWEEN_REQUESTS_MS, signal);

      const quote = await fetchOne(symbol, signal);
      if (quote !== null) quotes.set(symbol, quote);
    }

    return quotes;
  },
};
