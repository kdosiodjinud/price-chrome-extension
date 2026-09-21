import { describe, expect, it } from 'vitest';
import {
  DECIMALS,
  DEFAULT_SETTINGS,
  LABEL_STYLES,
  LANGUAGES,
  isHostBlocked,
  normalizeHost,
  sanitizeSettings,
} from '@/shared/settings';
import { ALL_COMMODITY_IDS, getCommodity } from '@/core/registry/commodities';
import { ALL_CURRENCY_CODES } from '@/core/registry/currencies';

/**
 * Settings come back from storage as untrusted data: they survive downgrades,
 * hand edits and corruption, so every field has to survive nonsense.
 */
describe('sanitizeSettings', () => {
  it('returns the defaults for anything unusable', () => {
    for (const input of [undefined, null, 42, 'settings', []]) {
      expect(sanitizeSettings(input)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('keeps valid values', () => {
    const settings = sanitizeSettings({
      enabled: false,
      language: 'cs',
      commodity: 'gold',
      unit: 'troy_ounce',
      decimals: 2,
      labelStyle: 'name',
      enabledCurrencies: ['CZK'],
      blockedHosts: ['example.com'],
      showOriginalInTooltip: false,
      highlightConverted: false,
    });

    expect(settings).toMatchObject({
      enabled: false,
      language: 'cs',
      commodity: 'gold',
      unit: 'troy_ounce',
      decimals: 2,
      labelStyle: 'name',
      enabledCurrencies: ['CZK'],
      blockedHosts: ['example.com'],
    });
  });

  it('replaces individual bad fields without discarding the good ones', () => {
    const settings = sanitizeSettings({
      enabled: 'yes',
      language: 'de',
      commodity: 'unobtainium',
      decimals: 9,
      enabledCurrencies: [],
    });

    expect(settings.enabled).toBe(DEFAULT_SETTINGS.enabled);
    expect(settings.language).toBe(DEFAULT_SETTINGS.language);
    expect(settings.commodity).toBe(DEFAULT_SETTINGS.commodity);
    expect(settings.decimals).toBe(DEFAULT_SETTINGS.decimals);
    // An empty currency list would silently disable detection.
    expect(settings.enabledCurrencies).toEqual(DEFAULT_SETTINGS.enabledCurrencies);
  });

  it('drops a unit the chosen commodity does not support', () => {
    expect(sanitizeSettings({ commodity: 'gold', unit: 'stone' }).unit).toBe('auto');
  });

  it('discards unknown currencies and de-duplicates the rest', () => {
    expect(sanitizeSettings({ enabledCurrencies: ['CZK', 'CZK', 'XYZ'] }).enabledCurrencies).toEqual(
      ['CZK'],
    );
  });

  it('caps the blocklist', () => {
    const many = Array.from({ length: 600 }, (_, i) => `host${i}.example.com`);
    expect(sanitizeSettings({ blockedHosts: many }).blockedHosts).toHaveLength(500);
  });
});

/**
 * The options screen builds its controls from these lists. If validation
 * rejected any value the UI can offer, the setting would appear to save and
 * then silently revert — so every offered value must survive a round trip.
 */
describe('every offerable value is accepted', () => {
  it.each(LABEL_STYLES)('keeps label style %s', (labelStyle) => {
    expect(sanitizeSettings({ labelStyle }).labelStyle).toBe(labelStyle);
  });

  it.each(DECIMALS)('keeps decimals %p', (decimals) => {
    expect(sanitizeSettings({ decimals }).decimals).toBe(decimals);
  });

  it.each(LANGUAGES)('keeps language %s', (language) => {
    expect(sanitizeSettings({ language }).language).toBe(language);
  });

  it.each(ALL_COMMODITY_IDS)('keeps commodity %s', (commodity) => {
    expect(sanitizeSettings({ commodity }).commodity).toBe(commodity);
  });

  it.each(ALL_CURRENCY_CODES)('keeps currency %s', (code) => {
    expect(sanitizeSettings({ enabledCurrencies: [code] }).enabledCurrencies).toEqual([code]);
  });

  it.each(ALL_COMMODITY_IDS)('keeps every unit offered for %s', (commodity) => {
    for (const unit of getCommodity(commodity)?.supportedUnits ?? []) {
      expect(sanitizeSettings({ commodity, unit }).unit).toBe(unit);
    }
    expect(sanitizeSettings({ commodity, unit: 'auto' }).unit).toBe('auto');
  });
});

describe('normalizeHost', () => {
  it.each([
    ['Example.COM', 'example.com'],
    ['  example.com  ', 'example.com'],
    ['example.com.', 'example.com'],
    ['https://example.com/path?q=1', 'example.com'],
    ['example.com:8080', 'example.com'],
    ['*.example.com', '*.example.com'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });

  it.each(['', '   ', 'not a host', 'exa mple.com', '-example.com', `${'a'.repeat(300)}.com`])(
    'rejects %j',
    (input) => {
      expect(normalizeHost(input)).toBeNull();
    },
  );
});

describe('isHostBlocked', () => {
  const blocklist = ['example.com', '*.shop.example.org'];

  it.each([
    ['example.com', true],
    ['EXAMPLE.com', true],
    ['shop.example.org', true],
    ['eu.shop.example.org', true],
    ['other.com', false],
    ['notexample.com', false],
    ['example.com.evil.test', false],
  ])('%j -> %p', (host, expected) => {
    expect(isHostBlocked(host, blocklist)).toBe(expected);
  });
});
