import type { DecimalPreference, LabelStyle } from '@/core/formatter';
import type { UnitPreference } from '@/core/converter';
import { ALL_COMMODITY_IDS, getCommodity } from '@/core/registry/commodities';
import { ALL_CURRENCY_CODES, DEFAULT_ENABLED_CURRENCIES } from '@/core/registry/currencies';
import type { CommodityId, CurrencyCode } from '@/core/types';

/**
 * User settings: their shape, their defaults, and — most importantly — the
 * one function that turns whatever is actually in storage into a valid
 * Settings object. Stored data is untrusted input: it survives downgrades,
 * hand edits and corruption, so every field is validated on the way in and
 * falls back to its default rather than propagating a bad value.
 */

export type LanguagePreference = 'auto' | 'cs' | 'en';

export interface Settings {
  /** Master switch. When false the content script converts nothing. */
  readonly enabled: boolean;
  readonly language: LanguagePreference;
  readonly commodity: CommodityId;
  readonly unit: UnitPreference;
  readonly decimals: DecimalPreference;
  readonly labelStyle: LabelStyle;
  readonly enabledCurrencies: readonly CurrencyCode[];
  /** Hostnames where the extension stays inactive. */
  readonly blockedHosts: readonly string[];
  /** Keep the original price reachable as a tooltip on the replacement. */
  readonly showOriginalInTooltip: boolean;
  /** Mark replaced prices with a dotted underline. */
  readonly highlightConverted: boolean;
}

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  enabled: true,
  language: 'auto',
  commodity: 'silver',
  unit: 'auto',
  decimals: 'auto',
  labelStyle: 'ticker',
  enabledCurrencies: DEFAULT_ENABLED_CURRENCIES,
  blockedHosts: Object.freeze([]) as readonly string[],
  showOriginalInTooltip: true,
  highlightConverted: true,
});

export const SETTINGS_STORAGE_KEY = 'settings';

/** Keeps a hand-edited or hostile blocklist from growing without bound. */
const MAX_BLOCKED_HOSTS = 500;
const MAX_HOSTNAME_LENGTH = 253;

/** Letters, digits, dots and hyphens; optionally a leading "*." wildcard. */
const HOSTNAME_RE = /^(?:\*\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;

/**
 * The allowed values for each choice, exported so the options screen builds
 * its controls from the very list that validation accepts. Keeping two lists
 * in step by hand is how a setting ends up offerable but unsavable.
 */
export const LANGUAGES: readonly LanguagePreference[] = ['auto', 'cs', 'en'];
export const LABEL_STYLES: readonly LabelStyle[] = ['ticker', 'name', 'none'];
export const DECIMALS: readonly DecimalPreference[] = ['auto', 0, 1, 2, 3];

function pickFrom<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Normalises one blocklist entry.
 *
 * Accepts a bare hostname or anything URL-like and reduces it to a hostname,
 * so pasting a full address from the address bar does the expected thing.
 */
export function normalizeHost(input: string): string | null {
  let candidate = input.trim().toLowerCase();
  if (candidate === '') return null;

  if (candidate.includes('/') || candidate.includes(':')) {
    try {
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(candidate)
        ? candidate
        : `https://${candidate}`;
      candidate = new URL(withScheme).hostname;
    } catch {
      return null;
    }
  }

  candidate = candidate.replace(/\.$/, '');
  if (candidate.length === 0 || candidate.length > MAX_HOSTNAME_LENGTH) return null;
  if (!HOSTNAME_RE.test(candidate)) return null;
  return candidate;
}

function sanitizeBlockedHosts(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.blockedHosts;

  const hosts: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const host = normalizeHost(entry);
    if (host !== null && !hosts.includes(host)) hosts.push(host);
    if (hosts.length >= MAX_BLOCKED_HOSTS) break;
  }
  return Object.freeze(hosts);
}

function sanitizeCurrencies(value: unknown): readonly CurrencyCode[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.enabledCurrencies;

  const codes = value.filter(
    (entry): entry is CurrencyCode => typeof entry === 'string' && ALL_CURRENCY_CODES.includes(entry),
  );
  const unique = [...new Set(codes)];
  // An empty selection would silently disable the extension; treat it as
  // "not configured" and fall back to the defaults.
  return unique.length > 0 ? Object.freeze(unique) : DEFAULT_SETTINGS.enabledCurrencies;
}

function sanitizeUnit(value: unknown, commodityId: CommodityId): UnitPreference {
  if (value === 'auto') return 'auto';
  const commodity = getCommodity(commodityId);
  if (commodity === undefined || typeof value !== 'string') return DEFAULT_SETTINGS.unit;
  return commodity.supportedUnits.includes(value) ? value : DEFAULT_SETTINGS.unit;
}

/** Turns untrusted stored data into settings that the rest of the code can rely on. */
export function sanitizeSettings(raw: unknown): Settings {
  const input: Record<string, unknown> =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  const commodity = pickFrom(ALL_COMMODITY_IDS, input['commodity'], DEFAULT_SETTINGS.commodity);

  return Object.freeze({
    enabled: pickBoolean(input['enabled'], DEFAULT_SETTINGS.enabled),
    language: pickFrom(LANGUAGES, input['language'], DEFAULT_SETTINGS.language),
    commodity,
    unit: sanitizeUnit(input['unit'], commodity),
    decimals: pickFrom(DECIMALS, input['decimals'], DEFAULT_SETTINGS.decimals),
    labelStyle: pickFrom(LABEL_STYLES, input['labelStyle'], DEFAULT_SETTINGS.labelStyle),
    enabledCurrencies: sanitizeCurrencies(input['enabledCurrencies']),
    blockedHosts: sanitizeBlockedHosts(input['blockedHosts']),
    showOriginalInTooltip: pickBoolean(
      input['showOriginalInTooltip'],
      DEFAULT_SETTINGS.showOriginalInTooltip,
    ),
    highlightConverted: pickBoolean(
      input['highlightConverted'],
      DEFAULT_SETTINGS.highlightConverted,
    ),
  });
}

/** True when `host` is covered by the blocklist, including "*.example.com". */
export function isHostBlocked(host: string, blockedHosts: readonly string[]): boolean {
  const normalized = normalizeHost(host);
  if (normalized === null) return false;

  return blockedHosts.some((entry) => {
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(2);
      return normalized === suffix || normalized.endsWith(`.${suffix}`);
    }
    return normalized === entry;
  });
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
  return sanitizeSettings(stored[SETTINGS_STORAGE_KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: sanitizeSettings(settings) });
}
