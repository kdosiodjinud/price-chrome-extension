import { COMMODITIES } from '@/core/registry/commodities';
import { CURRENCIES } from '@/core/registry/currencies';
import type { CommodityId, CurrencyCode, RateSnapshot } from '@/core/types';
import { RATE_TTL_MS } from '@/shared/constants';
import type { RateStatus } from '@/shared/messages';
import type { RateProvider } from './rate-provider';

/**
 * The rate cache.
 *
 * Browsing must not generate network traffic, so a snapshot is fetched at most
 * once every six hours and reused by every tab in between. The snapshot is
 * persisted because the MV3 service worker is torn down whenever it goes idle
 * and would otherwise refetch on every wake-up.
 *
 * Failures never clear a usable snapshot: a stale rate is far better for the
 * user than prices that suddenly stop converting.
 */

/** Beyond this age a snapshot is too old to show, even as a fallback. */
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const CACHE_KEY = 'rateCache';
const ERROR_KEY = 'lastRateError';

/** Bumped when the cached shape changes so old entries are discarded. */
const CACHE_VERSION = 1;

interface CacheEntry {
  readonly version: number;
  readonly providerId: string;
  readonly snapshot: RateSnapshot;
}

/** Deduplicates concurrent requests within one service worker lifetime. */
let inFlight: Promise<RateSnapshot | null> | null = null;

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Stored data is untrusted; rebuild the snapshot field by field. */
function readCacheEntry(raw: unknown, providerId: string): RateSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Partial<CacheEntry>;
  if (entry.version !== CACHE_VERSION || entry.providerId !== providerId) return null;

  const snapshot = entry.snapshot;
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  if (!isPositiveNumber(snapshot.fetchedAt)) return null;

  const commodityUsdPerQuoteUnit: Record<CommodityId, number> = {};
  const rawCommodities = snapshot.commodityUsdPerQuoteUnit;
  if (typeof rawCommodities === 'object' && rawCommodities !== null) {
    for (const [id, price] of Object.entries(rawCommodities)) {
      if (id in COMMODITIES && isPositiveNumber(price)) commodityUsdPerQuoteUnit[id] = price;
    }
  }

  const currencyToUsd: Record<CurrencyCode, number> = {};
  const rawCurrencies = snapshot.currencyToUsd;
  if (typeof rawCurrencies === 'object' && rawCurrencies !== null) {
    for (const [code, rate] of Object.entries(rawCurrencies)) {
      if (code in CURRENCIES && isPositiveNumber(rate)) currencyToUsd[code] = rate;
    }
  }

  if (Object.keys(commodityUsdPerQuoteUnit).length === 0) return null;

  return { commodityUsdPerQuoteUnit, currencyToUsd, fetchedAt: snapshot.fetchedAt };
}

async function readCache(providerId: string): Promise<RateSnapshot | null> {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  return readCacheEntry(stored[CACHE_KEY], providerId);
}

async function writeCache(snapshot: RateSnapshot, providerId: string): Promise<void> {
  const entry: CacheEntry = { version: CACHE_VERSION, providerId, snapshot };
  await chrome.storage.local.set({ [CACHE_KEY]: entry });
}

async function recordError(message: string | null): Promise<void> {
  if (message === null) await chrome.storage.local.remove(ERROR_KEY);
  else await chrome.storage.local.set({ [ERROR_KEY]: message.slice(0, 300) });
}

async function readError(): Promise<string | null> {
  const stored = await chrome.storage.local.get(ERROR_KEY);
  const value = stored[ERROR_KEY];
  return typeof value === 'string' ? value : null;
}

export function isFresh(snapshot: RateSnapshot, now = Date.now()): boolean {
  return now - snapshot.fetchedAt < RATE_TTL_MS;
}

function isUsable(snapshot: RateSnapshot, now = Date.now()): boolean {
  return now - snapshot.fetchedAt < MAX_STALE_MS;
}

/** Every symbol the extension may need, so one fetch covers any settings. */
function requiredSymbols(): string[] {
  const symbols = Object.values(COMMODITIES).map((commodity) => commodity.quoteSymbol);
  for (const currency of Object.values(CURRENCIES)) {
    if (currency.usdQuoteSymbol !== null) symbols.push(currency.usdQuoteSymbol);
  }
  return symbols;
}

async function fetchSnapshot(provider: RateProvider): Promise<RateSnapshot> {
  const controller = new AbortController();
  const quotes = await provider.fetchQuotes(requiredSymbols(), controller.signal);

  const commodityUsdPerQuoteUnit: Record<CommodityId, number> = {};
  for (const commodity of Object.values(COMMODITIES)) {
    const quote = quotes.get(commodity.quoteSymbol);
    if (quote !== undefined) commodityUsdPerQuoteUnit[commodity.id] = quote.price;
  }

  const currencyToUsd: Record<CurrencyCode, number> = { USD: 1 };
  for (const currency of Object.values(CURRENCIES)) {
    if (currency.usdQuoteSymbol === null) continue;
    const quote = quotes.get(currency.usdQuoteSymbol);
    if (quote !== undefined) currencyToUsd[currency.code] = quote.price;
  }

  if (Object.keys(commodityUsdPerQuoteUnit).length === 0) {
    throw new Error('No commodity quotes were returned');
  }

  return { commodityUsdPerQuoteUnit, currencyToUsd, fetchedAt: Date.now() };
}

/**
 * Returns rates, fetching only when the cache is missing or stale.
 *
 * @param force skip the freshness check and refetch, as the options screen's
 *   "Refresh now" does. A stale cached snapshot is still returned if the
 *   refetch fails.
 */
export async function getRates(
  provider: RateProvider,
  force = false,
): Promise<{ snapshot: RateSnapshot | null; error: string | null }> {
  const cached = await readCache(provider.id);

  if (!force && cached !== null && isFresh(cached)) {
    return { snapshot: cached, error: null };
  }

  if (inFlight === null) {
    inFlight = fetchSnapshot(provider)
      .then(async (snapshot) => {
        await writeCache(snapshot, provider.id);
        await recordError(null);
        return snapshot;
      })
      .catch(async (error: unknown) => {
        await recordError(error instanceof Error ? error.message : 'Unknown error');
        return null;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  const fetched = await inFlight;
  if (fetched !== null) return { snapshot: fetched, error: null };

  const error = await readError();
  // Fall back to a stale snapshot rather than leaving the page unconverted.
  if (cached !== null && isUsable(cached)) return { snapshot: cached, error };
  return { snapshot: null, error: error ?? 'Rates unavailable' };
}

export async function clearRateCache(): Promise<void> {
  await chrome.storage.local.remove([CACHE_KEY, ERROR_KEY]);
}

export async function getRateStatus(provider: RateProvider): Promise<RateStatus> {
  const cached = await readCache(provider.id);
  const error = await readError();

  if (cached === null) {
    return {
      fetchedAt: null,
      expiresAt: null,
      lastError: error,
      commodityCount: 0,
      currencyCount: 0,
    };
  }

  return {
    fetchedAt: cached.fetchedAt,
    expiresAt: cached.fetchedAt + RATE_TTL_MS,
    lastError: error,
    commodityCount: Object.keys(cached.commodityUsdPerQuoteUnit).length,
    currencyCount: Object.keys(cached.currencyToUsd).length,
  };
}
