import {
  AMOUNT_PATTERN_SOURCE,
  GROUP_SPACES,
  parseLocalizedNumber,
} from '@/core/number-format';
import { getCurrency } from '@/core/registry/currencies';
import type { CurrencyAffix, CurrencyCode, DetectedPrice } from '@/core/types';

/**
 * Detection of prices in running text.
 *
 * The pattern is compiled from the currency registry, so a new currency is
 * picked up automatically. Matching is deliberately generous; every candidate
 * amount still has to survive `parseLocalizedNumber`, which is where ambiguous
 * input is thrown away.
 */

/**
 * The separator the DOM scanner puts between runs that the page showed apart.
 * It is neither a letter nor a digit, so it satisfies the word boundaries
 * below — which is the point: "195,-" sitting next to "Bez členství" in the
 * next element must still match, even though concatenation glued them
 * together.
 */
const SEGMENT_SEPARATOR = '\\u0001';

/**
 * Characters allowed between an amount and its currency marker: the same set
 * the parser groups digits with, so `1 000&nbsp;Kč` reads like `1 000 Kč`,
 * plus the scanner's separator — an amount and its currency in adjacent
 * elements are still one price.
 */
const GAP = `[${GROUP_SPACES}${SEGMENT_SEPARATOR}]{0,3}`;

/**
 * A currency marker must not be glued to a letter or digit, otherwise "USDT"
 * reads as USD and "A$5" as a US dollar amount.
 */
const LEFT_BOUNDARY = '(?<![\\p{L}\\p{N}])';
const RIGHT_BOUNDARY = '(?![\\p{L}\\p{N}])';

interface AffixEntry {
  readonly code: CurrencyCode;
  readonly affix: CurrencyAffix;
}

export interface CompiledPattern {
  readonly regex: RegExp;
  /** Lower-cased affix text to the currencies that spell themselves that way. */
  readonly affixIndex: ReadonlyMap<string, readonly AffixEntry[]>;
  readonly currencies: readonly CurrencyCode[];
}

function escapeRegex(literal: string): string {
  // In a `u`-flagged regex, escaping a character that needs no escape (such
  // as `-` outside a character class) is a syntax error, so escape only these.
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds an alternation, longest literal first so that "US$" wins over "$"
 * and ",- Kč" over ",-".
 */
function alternation(entries: readonly AffixEntry[]): string | null {
  if (entries.length === 0) return null;
  const literals = [...new Set(entries.map((entry) => entry.affix.text))].sort(
    (a, b) => b.length - a.length,
  );
  return literals.map(escapeRegex).join('|');
}

function collect(
  entries: readonly AffixEntry[],
  position: CurrencyAffix['position'],
  spacing: CurrencyAffix['spacing'],
): AffixEntry[] {
  return entries.filter(
    (entry) => entry.affix.position === position && entry.affix.spacing === spacing,
  );
}

/**
 * Compiles a detection pattern for the given currencies.
 *
 * Callers should compile once and reuse; building the regex is not free and
 * the result is immutable apart from `lastIndex`, which `matchAll` resets.
 */
export function compilePattern(currencyCodes: readonly CurrencyCode[]): CompiledPattern | null {
  const entries: AffixEntry[] = [];
  const active: CurrencyCode[] = [];

  for (const code of currencyCodes) {
    const currency = getCurrency(code);
    if (currency === undefined) continue;
    active.push(code);
    for (const affix of currency.affixes) {
      entries.push({ code, affix });
    }
  }
  if (entries.length === 0) return null;

  const affixIndex = new Map<string, AffixEntry[]>();
  for (const entry of entries) {
    const key = entry.affix.text.toLowerCase();
    const bucket = affixIndex.get(key);
    if (bucket === undefined) affixIndex.set(key, [entry]);
    else bucket.push(entry);
  }

  const prefixSpaced = alternation(collect(entries, 'prefix', 'optional'));
  const prefixTight = alternation(collect(entries, 'prefix', 'forbidden'));
  const suffixSpaced = alternation(collect(entries, 'suffix', 'optional'));
  // Tight suffixes are markers written against the digits, such as the Czech
  // ",-". They may also be followed by a spelled-out currency: "1 500,- Kč".
  const suffixTight = alternation(collect(entries, 'suffix', 'forbidden'));

  const amount = `(?:${AMOUNT_PATTERN_SOURCE})`;
  const branches: string[] = [];

  if (prefixSpaced !== null) {
    branches.push(`${LEFT_BOUNDARY}(?<pfxA>${prefixSpaced})${GAP}?(?<amtA>${amount})(?!\\d)`);
  }
  if (prefixTight !== null) {
    branches.push(`${LEFT_BOUNDARY}(?<pfxB>${prefixTight})(?<amtB>${amount})(?!\\d)`);
  }
  if (suffixTight !== null && suffixSpaced !== null) {
    branches.push(
      `${LEFT_BOUNDARY}(?<amtC>${amount})(?<tailC>${suffixTight})${GAP}?` +
        `(?<sfxC>${suffixSpaced})${RIGHT_BOUNDARY}`,
    );
  }
  if (suffixTight !== null) {
    branches.push(`${LEFT_BOUNDARY}(?<amtD>${amount})(?<tailD>${suffixTight})${RIGHT_BOUNDARY}`);
  }
  if (suffixSpaced !== null) {
    branches.push(
      `${LEFT_BOUNDARY}(?<amtE>${amount})${GAP}?(?<sfxE>${suffixSpaced})${RIGHT_BOUNDARY}`,
    );
  }
  if (branches.length === 0) return null;

  return {
    regex: new RegExp(branches.join('|'), 'giu'),
    affixIndex,
    currencies: active,
  };
}

/**
 * Resolves the currency a matched marker belongs to, honouring affixes that
 * asked to be matched case-sensitively.
 */
function resolveCurrency(pattern: CompiledPattern, marker: string): CurrencyCode | null {
  const candidates = pattern.affixIndex.get(marker.toLowerCase());
  if (candidates === undefined) return null;

  for (const candidate of candidates) {
    if (candidate.affix.caseSensitive === true && candidate.affix.text !== marker) continue;
    return candidate.code;
  }
  return null;
}

/** Picks the first defined value; the regex branches are mutually exclusive. */
function firstDefined(groups: Record<string, string | undefined>, keys: string[]): string | null {
  for (const key of keys) {
    const value = groups[key];
    if (value !== undefined) return value;
  }
  return null;
}

/**
 * Finds every price in a piece of text.
 *
 * Matches never overlap and are returned in document order, which is what the
 * DOM rewriter relies on when it splits a text node.
 */
export function detectPrices(text: string, pattern: CompiledPattern): DetectedPrice[] {
  const found: DetectedPrice[] = [];

  for (const match of text.matchAll(pattern.regex)) {
    const groups = match.groups;
    const start = match.index;
    if (groups === undefined || start === undefined) continue;

    const rawAmount = firstDefined(groups, ['amtA', 'amtB', 'amtC', 'amtD', 'amtE']);
    // A spelled-out currency outranks a tight marker: in "100,- EUR" the EUR
    // decides, not the Czech ",-".
    const marker = firstDefined(groups, ['pfxA', 'pfxB', 'sfxC', 'sfxE', 'tailC', 'tailD']);
    if (rawAmount === null || marker === null) continue;

    const amount = parseLocalizedNumber(rawAmount);
    if (amount === null || amount <= 0) continue;

    const currency = resolveCurrency(pattern, marker);
    if (currency === null) continue;

    found.push({
      start,
      end: start + match[0].length,
      // Strip the scanner's internal separator; this text is shown to the user
      // and written back on revert.
      text: match[0].replaceAll('\u0001', ''),
      amount,
      currency,
    });
  }

  return found;
}
