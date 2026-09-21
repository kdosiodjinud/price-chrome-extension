import type { Quote } from '@/core/types';

/**
 * The seam between the extension and whoever supplies market data.
 *
 * Everything above this interface works in terms of symbols and quotes, so
 * swapping or adding a provider does not reach into conversion or display.
 */
export interface RateProvider {
  /** Stable identifier, stored alongside cached data. */
  readonly id: string;
  /** Page a user can open to see where the numbers come from. */
  readonly attributionUrl: string;
  /**
   * Fetches quotes for the given symbols.
   *
   * Implementations resolve with whatever they managed to retrieve rather than
   * rejecting on a partial failure: a missing commodity should not cost the
   * user the currencies that did arrive.
   */
  fetchQuotes(symbols: readonly string[], signal: AbortSignal): Promise<Map<string, Quote>>;
}
