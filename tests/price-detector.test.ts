import { describe, expect, it } from 'vitest';
import { compilePattern, detectPrices } from '@/core/price-detector';
import type { CompiledPattern } from '@/core/price-detector';

const pattern = compilePattern(['CZK', 'EUR', 'USD', 'GBP', 'PLN']) as CompiledPattern;

function detect(text: string) {
  return detectPrices(text, pattern).map((price) => ({
    text: price.text,
    amount: price.amount,
    currency: price.currency,
  }));
}

describe('detectPrices', () => {
  it('compiles a pattern from the registry', () => {
    expect(pattern).not.toBeNull();
    expect(pattern.currencies).toContain('CZK');
  });

  describe('suffix currencies', () => {
    it.each([
      ['Cena 1 500 Kč', 1500, 'CZK'],
      ['Cena 1.500 Kč', 1500, 'CZK'],
      ['1 499,90 Kč', 1499.9, 'CZK'],
      ['1500Kč', 1500, 'CZK'],
      ['1 500 CZK', 1500, 'CZK'],
      ['49,99 €', 49.99, 'EUR'],
      ['120 zł', 120, 'PLN'],
      ['99 USD', 99, 'USD'],
    ])('reads %j', (text, amount, currency) => {
      expect(detect(text)).toEqual([expect.objectContaining({ amount, currency })]);
    });
  });

  describe('prefix currencies', () => {
    it.each([
      ['$1,299.00', 1299, 'USD'],
      ['US$1,299', 1299, 'USD'],
      ['£85.50', 85.5, 'GBP'],
      ['€49', 49, 'EUR'],
      ['USD 20', 20, 'USD'],
    ])('reads %j', (text, amount, currency) => {
      expect(detect(text)).toEqual([expect.objectContaining({ amount, currency })]);
    });
  });

  describe('the Czech ",-" shorthand', () => {
    it('reads it on its own', () => {
      expect(detect('Akce 1 500,- dnes')).toEqual([
        expect.objectContaining({ text: '1 500,-', amount: 1500, currency: 'CZK' }),
      ]);
    });

    it('swallows a following currency rather than leaving it stranded', () => {
      expect(detect('1 500,- Kč')).toEqual([
        expect.objectContaining({ text: '1 500,- Kč', amount: 1500, currency: 'CZK' }),
      ]);
    });

    it('lets a spelled-out currency win over the shorthand', () => {
      expect(detect('100,- EUR')).toEqual([
        expect.objectContaining({ amount: 100, currency: 'EUR' }),
      ]);
    });
  });

  describe('typographic and regional spellings', () => {
    it.each([
      ['1 000,\u2013', 1000, 'CZK'],
      ['1 000,\u2014', 1000, 'CZK'],
      ['1 000,\u2010', 1000, 'CZK'],
      ['1 000.-', 1000, 'CZK'],
      ['10 $', 10, 'USD'],
      ['10$', 10, 'USD'],
      ['85 £', 85, 'GBP'],
    ])('reads %j', (text, amount, currency) => {
      expect(detect(text)).toEqual([expect.objectContaining({ amount, currency })]);
    });
  });

  describe('non-breaking spaces, as HTML actually writes them', () => {
    it.each([
      ['1\u00A0000 Kč', 1000],
      ['1\u00A0000\u00A0Kč', 1000],
      ['1\u202F000\u202FKč', 1000],
      ['1\u2009000\u2009Kč', 1000],
      ['1\u00A0499,90\u00A0Kč', 1499.9],
      ['1\u00A0000,-', 1000],
    ])('reads %j as %d', (text, amount) => {
      expect(detect(text)).toEqual([expect.objectContaining({ amount, currency: 'CZK' })]);
    });
  });

  /**
   * Inline text runs together whatever the markup separated, so a price is
   * regularly preceded by unrelated digits — a product code, a model number,
   * a rating. The amount must shrink back to the digits that belong to the
   * currency instead of swallowing the lot and being thrown away.
   */
  describe('digits that belong to something else', () => {
    it.each([
      // The real Alza markup: product name ends in numbers, then &nbsp;, then price.
      ['Elektrický pilník ETA Fenité 3348 90000 \u00A0699,-', 699, '699,-'],
      ['ETA Fenité 3348 90000 699 Kč', 699, '699 Kč'],
      ['Model 3348 1 234 Kč', 1234, '1 234 Kč'],
      ['Kód 12345 90000 1 499,90 Kč', 1499.9, '1 499,90 Kč'],
    ])('reads %j as %d', (text, amount, matched) => {
      expect(detect(text)).toEqual([
        expect.objectContaining({ amount, currency: 'CZK', text: matched }),
      ]);
    });

    it('shrinks away from a leading marker too', () => {
      expect(detect('$12345 678')).toEqual([
        expect.objectContaining({ amount: 12345, currency: 'USD', text: '$12345' }),
      ]);
    });

    it('still reads a properly grouped amount whole', () => {
      expect(detect('1 234 567 Kč')).toEqual([
        expect.objectContaining({ amount: 1234567, text: '1 234 567 Kč' }),
      ]);
    });

    /**
     * Known limitation, recorded rather than worked around: when the digits
     * in front of a price happen to group validly with it, there is nothing
     * in the text to say which reading was meant. "iPhone 15" next to
     * "999 Kč" is indistinguishable from "iPhone" at "15 999 Kč", so the
     * longer reading wins, the same as for any other grouped amount.
     */
    it('takes the longer reading when a model number groups with the price', () => {
      expect(detect('iPhone 15 999 Kč')).toEqual([
        expect.objectContaining({ amount: 15999, text: '15 999 Kč' }),
      ]);
    });
  });

  it('finds several prices in one string, in document order', () => {
    expect(detect('Bylo 2 000 Kč, teď 1 499 Kč')).toEqual([
      expect.objectContaining({ amount: 2000 }),
      expect.objectContaining({ amount: 1499 }),
    ]);
  });

  describe('leaves non-prices alone', () => {
    it.each([
      ['100 USDT', 'a ticker that merely starts with a currency code'],
      ['A$50', 'a different dollar'],
      ['Verze 1.2.3', 'a version number'],
      ['IP 192.168.1.1', 'an IP address'],
      ['sleva 20 %', 'a percentage'],
      ['1000', 'a bare number with no currency'],
      ['Kč', 'a currency with no amount'],
      ['EURO 2024', 'a word that contains a currency code'],
    ])('ignores %j (%s)', (text) => {
      expect(detect(text)).toEqual([]);
    });
  });

  it('honours the currency selection', () => {
    const czkOnly = compilePattern(['CZK']) as CompiledPattern;
    expect(detectPrices('1 500 Kč and $20', czkOnly)).toHaveLength(1);
  });

  it('returns null for an empty or unknown selection', () => {
    expect(compilePattern([])).toBeNull();
    expect(compilePattern(['XYZ'])).toBeNull();
  });
});
