import type { Commodity, CommodityId } from '@/core/types';

/**
 * Commodities a price can be expressed in.
 *
 * Every quote is a Yahoo Finance front-month futures contract priced in USD
 * per troy ounce. Adding a commodity is a single record here.
 */
export const COMMODITIES: Readonly<Record<CommodityId, Commodity>> = Object.freeze({
  gold: {
    id: 'gold',
    quoteSymbol: 'GC=F',
    quoteCurrency: 'USD',
    quoteUnit: 'troy_ounce',
    tickerSymbol: 'Au',
    sourceUrl: 'https://finance.yahoo.com/quote/GC%3DF/',
    supportedUnits: ['gram', 'kilogram', 'troy_ounce', 'ounce'],
    autoUnitLadder: ['kilogram', 'gram'],
  },
  silver: {
    id: 'silver',
    quoteSymbol: 'SI=F',
    quoteCurrency: 'USD',
    quoteUnit: 'troy_ounce',
    tickerSymbol: 'Ag',
    sourceUrl: 'https://finance.yahoo.com/quote/SI%3DF/',
    supportedUnits: ['gram', 'kilogram', 'troy_ounce', 'ounce'],
    autoUnitLadder: ['kilogram', 'gram'],
  },
  platinum: {
    id: 'platinum',
    quoteSymbol: 'PL=F',
    quoteCurrency: 'USD',
    quoteUnit: 'troy_ounce',
    tickerSymbol: 'Pt',
    sourceUrl: 'https://finance.yahoo.com/quote/PL%3DF/',
    supportedUnits: ['gram', 'kilogram', 'troy_ounce', 'ounce'],
    autoUnitLadder: ['kilogram', 'gram'],
  },
  palladium: {
    id: 'palladium',
    quoteSymbol: 'PA=F',
    quoteCurrency: 'USD',
    quoteUnit: 'troy_ounce',
    tickerSymbol: 'Pd',
    sourceUrl: 'https://finance.yahoo.com/quote/PA%3DF/',
    supportedUnits: ['gram', 'kilogram', 'troy_ounce', 'ounce'],
    autoUnitLadder: ['kilogram', 'gram'],
  },
});

export const ALL_COMMODITY_IDS: readonly CommodityId[] = Object.freeze(Object.keys(COMMODITIES));

export function getCommodity(id: CommodityId): Commodity | undefined {
  return COMMODITIES[id];
}
