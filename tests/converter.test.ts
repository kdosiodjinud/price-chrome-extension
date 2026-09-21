import { describe, expect, it } from 'vitest';
import { convertPrice } from '@/core/converter';
import { formatConversion } from '@/core/formatter';
import { getCommodity } from '@/core/registry/commodities';
import type { Commodity, RateSnapshot } from '@/core/types';

const silver = getCommodity('silver') as Commodity;
const gold = getCommodity('gold') as Commodity;

/** Round numbers so the expected values stay readable. */
const rates: RateSnapshot = {
  // USD per troy ounce (31.1034768 g).
  commodityUsdPerQuoteUnit: { silver: 31.1034768, gold: 3110.34768 },
  currencyToUsd: { USD: 1, CZK: 0.05, EUR: 1.1 },
  fetchedAt: Date.now(),
};

describe('convertPrice', () => {
  it('converts a USD price into grams', () => {
    // 1 USD/g of silver, so $10 is 10 g.
    const result = convertPrice(10, 'USD', silver, rates, 'gram');
    expect(result?.amount).toBeCloseTo(10, 9);
    expect(result?.unit.symbol).toBe('g');
  });

  it('pivots a non-USD price through USD', () => {
    // 1000 CZK is $50, so 50 g of silver.
    expect(convertPrice(1000, 'CZK', silver, rates, 'gram')?.amount).toBeCloseTo(50, 9);
  });

  it('scales with the metal price', () => {
    // Gold is 100x silver here, so the same money buys a hundredth.
    expect(convertPrice(1000, 'CZK', gold, rates, 'gram')?.amount).toBeCloseTo(0.5, 9);
  });

  it.each([
    ['gram', 50],
    ['kilogram', 0.05],
    ['troy_ounce', 50 / 31.1034768],
    ['ounce', 50 / 28.349523125],
  ])('expresses the same value in %s', (unit, expected) => {
    expect(convertPrice(1000, 'CZK', silver, rates, unit)?.amount).toBeCloseTo(expected, 9);
  });

  describe('automatic unit selection', () => {
    it('uses grams below a kilogram', () => {
      expect(convertPrice(1000, 'CZK', silver, rates, 'auto')?.unit.id).toBe('gram');
    });

    it('switches to kilograms once the amount fills one', () => {
      expect(convertPrice(100_000, 'CZK', silver, rates, 'auto')?.unit.id).toBe('kilogram');
    });
  });

  describe('fails closed', () => {
    it('returns null for a currency with no rate', () => {
      expect(convertPrice(100, 'GBP', silver, rates, 'gram')).toBeNull();
    });

    it('returns null for a commodity with no quote', () => {
      const empty: RateSnapshot = { ...rates, commodityUsdPerQuoteUnit: {} };
      expect(convertPrice(100, 'CZK', silver, empty, 'gram')).toBeNull();
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects the amount %p', (amount) => {
      expect(convertPrice(amount, 'CZK', silver, rates, 'gram')).toBeNull();
    });

    it('rejects a unit the commodity does not support', () => {
      expect(convertPrice(100, 'CZK', silver, rates, 'furlong')).toBeNull();
    });
  });
});

describe('formatConversion', () => {
  const result = convertPrice(1000, 'CZK', silver, rates, 'gram');

  it('renders a ticker in Czech', () => {
    expect(
      formatConversion(result!, {
        locale: 'cs-CZ',
        decimals: 1,
        labelStyle: 'ticker',
        commodityName: 'stříbra',
      }),
    ).toBe('50,0 g Ag');
  });

  it('renders a name in English', () => {
    expect(
      formatConversion(result!, {
        locale: 'en-US',
        decimals: 0,
        labelStyle: 'name',
        commodityName: 'of silver',
      }),
    ).toBe('50 g of silver');
  });

  it('renders the weight alone when labelling is off', () => {
    expect(
      formatConversion(result!, {
        locale: 'cs-CZ',
        decimals: 1,
        labelStyle: 'none',
        commodityName: 'stříbra',
      }),
    ).toBe('50,0 g');
  });

  it.each([
    [0.5123, '0.512'],
    [5.123, '5.12'],
    [51.23, '51.2'],
    [512.3, '512'],
  ])('scales automatic precision for %p', (grams, expected) => {
    const scaled = convertPrice(grams * 20, 'CZK', silver, rates, 'gram');
    expect(
      formatConversion(scaled!, {
        locale: 'en-US',
        decimals: 'auto',
        labelStyle: 'ticker',
        commodityName: 'silver',
      }),
    ).toBe(`${expected} g Ag`);
  });
});
