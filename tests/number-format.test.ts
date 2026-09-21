import { describe, expect, it } from 'vitest';
import { parseLocalizedNumber } from '@/core/number-format';

/**
 * The parser is the gate that keeps non-prices off the page, so it is tested
 * from both sides: what it must read correctly, and what it must refuse.
 */
describe('parseLocalizedNumber', () => {
  describe('plain integers', () => {
    it.each([
      ['1500', 1500],
      ['0', 0],
      ['007', 7],
      ['1000000', 1_000_000],
    ])('reads %s as %d', (input, expected) => {
      expect(parseLocalizedNumber(input)).toBe(expected);
    });
  });

  describe('space-grouped amounts', () => {
    it.each([
      ['1 500', 1500],
      ['1 500', 1500],
      ['1 500', 1500],
      ['1 234 567', 1_234_567],
      ["1'234", 1234],
    ])('reads %j as %d', (input, expected) => {
      expect(parseLocalizedNumber(input)).toBe(expected);
    });
  });

  describe('decimal marks', () => {
    it.each([
      ['1,5', 1.5],
      ['1.5', 1.5],
      ['1499,90', 1499.9],
      ['1499.90', 1499.9],
      ['12345,67', 12345.67],
      ['0,500', 0.5],
    ])('reads %s as %d', (input, expected) => {
      expect(parseLocalizedNumber(input)).toBe(expected);
    });
  });

  describe('three digits after a separator mean grouping, not a fraction', () => {
    it.each([
      ['1,500', 1500],
      ['1.500', 1500],
      ['1.234.567', 1_234_567],
      ['1,234,567', 1_234_567],
    ])('reads %s as %d', (input, expected) => {
      expect(parseLocalizedNumber(input)).toBe(expected);
    });
  });

  describe('both separators present: the last one is the decimal mark', () => {
    it.each([
      ['1.234,56', 1234.56],
      ['1,234.56', 1234.56],
      ['1 234,56', 1234.56],
      ['1 234.56', 1234.56],
      ['1.234.567,89', 1_234_567.89],
      ["1'234.56", 1234.56],
    ])('reads %s as %d', (input, expected) => {
      expect(parseLocalizedNumber(input)).toBe(expected);
    });
  });

  describe('rejects things that merely look numeric', () => {
    it.each([
      ['192.168.1.1', 'an IP address'],
      ['2024.01.15', 'a date'],
      ['10.00.00', 'a timestamp'],
      ['1.2.3', 'a version number'],
      ['1,2345', 'four digits after a decimal mark'],
      ['12345.678', 'an oversized leading group'],
      ['1..5', 'a doubled separator'],
      ['.5', 'a leading separator'],
      ['5.', 'a trailing separator'],
      ['1 23', 'a two-digit group'],
      ['1.234 567', 'mixed grouping characters'],
      ['1-500', 'a non-separator character'],
      ['', 'an empty string'],
      ['abc', 'letters'],
    ])('rejects %j (%s)', (input) => {
      expect(parseLocalizedNumber(input)).toBeNull();
    });
  });
});
