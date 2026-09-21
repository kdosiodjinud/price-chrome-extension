import type { Currency, CurrencyCode } from '@/core/types';

/**
 * Currencies the extension can detect.
 *
 * `usdQuoteSymbol` is the Yahoo Finance symbol giving the value of one unit of
 * the currency in USD; USD is the pivot every conversion goes through, so it
 * has none. Adding a currency is a single record here plus, if you want it on
 * by default, an entry in DEFAULT_ENABLED_CURRENCIES.
 */
export const CURRENCIES: Readonly<Record<CurrencyCode, Currency>> = Object.freeze({
  CZK: {
    code: 'CZK',
    usdQuoteSymbol: 'CZKUSD=X',
    affixes: [
      { text: 'Kč', position: 'suffix', spacing: 'optional' },
      { text: 'CZK', position: 'suffix', spacing: 'optional' },
      { text: 'CZK', position: 'prefix', spacing: 'optional' },
      // Czech shorthand for a whole-crown price, written tight against the
      // amount: "1 500,-". A space before it would be a different thing.
      // Typographic dashes are common once a CMS has run the text through a
      // smart-punctuation filter, and the decimal comma is sometimes a point.
      { text: ',-', position: 'suffix', spacing: 'forbidden' },
      { text: ',\u2010', position: 'suffix', spacing: 'forbidden' },
      { text: ',\u2011', position: 'suffix', spacing: 'forbidden' },
      { text: ',\u2012', position: 'suffix', spacing: 'forbidden' },
      { text: ',\u2013', position: 'suffix', spacing: 'forbidden' },
      { text: ',\u2014', position: 'suffix', spacing: 'forbidden' },
      { text: '.-', position: 'suffix', spacing: 'forbidden' },
      { text: '.\u2013', position: 'suffix', spacing: 'forbidden' },
    ],
  },
  EUR: {
    code: 'EUR',
    usdQuoteSymbol: 'EURUSD=X',
    affixes: [
      { text: '€', position: 'suffix', spacing: 'optional' },
      { text: '€', position: 'prefix', spacing: 'optional' },
      { text: 'EUR', position: 'suffix', spacing: 'optional' },
      { text: 'EUR', position: 'prefix', spacing: 'optional' },
    ],
  },
  USD: {
    code: 'USD',
    usdQuoteSymbol: null,
    affixes: [
      { text: 'US$', position: 'prefix', spacing: 'optional' },
      { text: '$', position: 'prefix', spacing: 'optional' },
      // Trailing dollar sign, as written in Canada and much of Europe.
      { text: '$', position: 'suffix', spacing: 'optional' },
      { text: 'USD', position: 'suffix', spacing: 'optional' },
      { text: 'USD', position: 'prefix', spacing: 'optional' },
    ],
  },
  GBP: {
    code: 'GBP',
    usdQuoteSymbol: 'GBPUSD=X',
    affixes: [
      { text: '£', position: 'prefix', spacing: 'optional' },
      { text: '£', position: 'suffix', spacing: 'optional' },
      { text: 'GBP', position: 'suffix', spacing: 'optional' },
      { text: 'GBP', position: 'prefix', spacing: 'optional' },
    ],
  },
  PLN: {
    code: 'PLN',
    usdQuoteSymbol: 'PLNUSD=X',
    affixes: [
      { text: 'zł', position: 'suffix', spacing: 'optional' },
      { text: 'PLN', position: 'suffix', spacing: 'optional' },
      { text: 'PLN', position: 'prefix', spacing: 'optional' },
    ],
  },
});

/** Currencies detected out of the box. Users can narrow this in the options. */
export const DEFAULT_ENABLED_CURRENCIES: readonly CurrencyCode[] = Object.freeze([
  'CZK',
  'EUR',
  'USD',
  'GBP',
  'PLN',
]);

export const ALL_CURRENCY_CODES: readonly CurrencyCode[] = Object.freeze(Object.keys(CURRENCIES));

export function getCurrency(code: CurrencyCode): Currency | undefined {
  return CURRENCIES[code];
}
