/**
 * Shared domain types.
 *
 * Everything the extension knows about money, metals and weights is described
 * by these types and filled in by the registries in `src/core/registry`.
 * Adding a currency, a commodity or a mass unit means adding one record there
 * and nothing else.
 */

/** ISO 4217 code, e.g. `CZK`. Used as the currency's identity everywhere. */
export type CurrencyCode = string;

/** Stable identifier of a commodity, e.g. `gold`. Persisted in settings. */
export type CommodityId = string;

/** Stable identifier of a mass unit, e.g. `gram`. Persisted in settings. */
export type MassUnitId = string;

/** Where a currency marker sits relative to the amount. */
export type AffixPosition = 'prefix' | 'suffix';

/** Whether whitespace may sit between the amount and its currency marker. */
export type AffixSpacing = 'optional' | 'forbidden';

/**
 * One way of writing a currency in running text.
 *
 * A currency usually has several: `Kč`, `CZK` and the Czech `,-` shorthand all
 * denote the same currency but sit in different places and space differently.
 */
export interface CurrencyAffix {
  /** Literal text as it appears on the page. Escaped before use in a regex. */
  readonly text: string;
  readonly position: AffixPosition;
  readonly spacing: AffixSpacing;
  /**
   * When false (the default), the affix matches case-insensitively. Set true
   * for markers where case carries meaning and a loose match would be wrong.
   */
  readonly caseSensitive?: boolean;
}

export interface Currency {
  readonly code: CurrencyCode;
  /** Every spelling of this currency that should be detected. */
  readonly affixes: readonly CurrencyAffix[];
  /**
   * Yahoo Finance symbol quoting one unit of this currency in USD.
   * `null` for USD itself, which is the pivot and needs no conversion.
   */
  readonly usdQuoteSymbol: string | null;
}

/** Physical quantity a commodity is quoted in. Currently always mass. */
export interface MassUnit {
  readonly id: MassUnitId;
  /** How many grams one unit holds. The gram is the internal base unit. */
  readonly gramsPerUnit: number;
  /** Symbol shown to the user, e.g. `g`, `oz t`. */
  readonly symbol: string;
}

export interface Commodity {
  readonly id: CommodityId;
  /** Yahoo Finance symbol for the spot/front-month contract. */
  readonly quoteSymbol: string;
  /** Currency the Yahoo quote is denominated in. */
  readonly quoteCurrency: CurrencyCode;
  /** Mass unit the Yahoo quote is denominated in. */
  readonly quoteUnit: MassUnitId;
  /** Chemical/market symbol shown next to the amount, e.g. `Ag`. */
  readonly tickerSymbol: string;
  /** Human-facing page documenting the quote, shown in the options screen. */
  readonly sourceUrl: string;
  /** Mass units offered for this commodity, in display order. */
  readonly supportedUnits: readonly MassUnitId[];
  /**
   * Unit picked by the `auto` setting when the converted amount is at least
   * one whole unit of it. Ordered from largest to smallest.
   */
  readonly autoUnitLadder: readonly MassUnitId[];
}

/** A price found in page text, before conversion. */
export interface DetectedPrice {
  /** Index of the first character of the match within the scanned text. */
  readonly start: number;
  /** Index one past the last character of the match. */
  readonly end: number;
  /** The matched substring, exactly as it appears in the text. */
  readonly text: string;
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/** A single quote as returned by a rate provider. */
export interface Quote {
  readonly symbol: string;
  readonly price: number;
  /** Provider timestamp in milliseconds since epoch. */
  readonly quotedAt: number;
}

/** Everything the content script needs to convert prices, in one payload. */
export interface RateSnapshot {
  /** USD price of one `quoteUnit` of each commodity, keyed by commodity id. */
  readonly commodityUsdPerQuoteUnit: Readonly<Record<CommodityId, number>>;
  /** Value of one unit of each currency in USD, keyed by currency code. */
  readonly currencyToUsd: Readonly<Record<CurrencyCode, number>>;
  /** When this snapshot was fetched, in milliseconds since epoch. */
  readonly fetchedAt: number;
}

/** Result of converting one detected price into a weight of metal. */
export interface ConversionResult {
  readonly amount: number;
  readonly unit: MassUnit;
  readonly commodity: Commodity;
}
