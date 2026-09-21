/**
 * Parsing of human-written amounts.
 *
 * Pages mix locales freely: "1 500,50", "1,500.50", "1.500" and "1500" can all
 * appear on the same site. The detector's regex is deliberately permissive and
 * hands every candidate here; this module is the single place that decides
 * whether a candidate really is a number, and which separator is the decimal
 * one. Rejecting is always safe — the price is simply left alone.
 */

/**
 * Space characters used as digit-group separators in the wild.
 *
 * HTML is full of non-breaking spaces — `&nbsp;` (U+00A0) is how most CMSs
 * and e-shops keep "1 000 Kč" from wrapping — and the narrow no-break space
 * (U+202F) is what proper Czech typography uses. Treating only U+0020 as a
 * separator would miss the majority of real prices.
 */
export const GROUP_SPACES = '\\u0020\\u00A0\\u202F\\u2009\\u2007\\u2008\\u205F\\u3000';

/** Apostrophe grouping, as used in Switzerland: 1'234.50 */
const GROUP_APOSTROPHES = "'\\u2019";

const SEPARATOR_CLASS = `[.,${GROUP_SPACES}${GROUP_APOSTROPHES}]`;

/**
 * Regex source matching a candidate amount.
 *
 * Grouping is enforced here rather than left entirely to the parser. Inline
 * text runs unrelated numbers together — "…ETA Fenité 3348 90000 &nbsp;699,-"
 * is one run on a real shop page — and a pattern that swallowed every digit
 * and separator in sight would match the lot, fail to parse and lose the
 * price. Requiring groups of three lets the regex engine backtrack to the
 * digits that actually form an amount.
 *
 * Two shapes are allowed: grouped (`1 234 567`, `1.234`) and a plain run of
 * digits (`1500`, `12345`), each with an optional one- or two-digit fraction.
 * Repetition is bounded so pathological input cannot cost unbounded work.
 */
const GROUP_SEPARATOR = `[.,${GROUP_SPACES}${GROUP_APOSTROPHES}]`;

export const AMOUNT_PATTERN_SOURCE =
  `(?:\\d{1,3}(?:${GROUP_SEPARATOR}\\d{3}){1,6}|\\d{1,15})(?:[.,]\\d{1,2})?`;

const SEPARATOR_RE = new RegExp(`^${SEPARATOR_CLASS}$`, 'u');
const SPACE_OR_APOSTROPHE_RE = new RegExp(`^[${GROUP_SPACES}${GROUP_APOSTROPHES}]$`, 'u');

/** Largest amount we are willing to treat as a price. */
const MAX_AMOUNT = 1e15;

interface Tokenized {
  readonly groups: string[];
  readonly separators: string[];
}

/**
 * Splits a candidate into runs of digits and the single-character separators
 * between them. Returns null if the candidate is not shaped like a number.
 */
function tokenize(raw: string): Tokenized | null {
  const groups: string[] = [];
  const separators: string[] = [];
  let current = '';

  for (const char of raw) {
    if (char >= '0' && char <= '9') {
      current += char;
      continue;
    }
    if (!SEPARATOR_RE.test(char)) return null;
    // A separator with no digits before it, or two separators in a row.
    if (current === '') return null;
    groups.push(current);
    current = '';
    separators.push(char);
  }

  // Must end with a digit.
  if (current === '') return null;
  groups.push(current);

  return { groups, separators };
}

/** True when the character always groups digits and can never be a decimal mark. */
function isGroupingOnly(separator: string): boolean {
  return SPACE_OR_APOSTROPHE_RE.test(separator);
}

/**
 * Decides whether the last separator is a decimal mark.
 *
 * Three digits after a separator means grouping ("1,500" is fifteen hundred,
 * not one and a half) — except when the integer part is a bare zero, where
 * "0,500" can only be a fraction. One or two digits means a decimal mark.
 * Anything else is not a price.
 */
function lastSeparatorIsDecimal(tokens: Tokenized): boolean | null {
  const { groups, separators } = tokens;
  const lastSeparator = separators[separators.length - 1];
  const lastGroup = groups[groups.length - 1];
  if (lastSeparator === undefined || lastGroup === undefined) return null;

  if (isGroupingOnly(lastSeparator)) return false;

  switch (lastGroup.length) {
    case 1:
    case 2:
      return true;
    case 3:
      return groups.length === 2 && groups[0] === '0';
    default:
      return null;
  }
}

/**
 * Verifies that the grouping separators are used consistently: one and the
 * same separator throughout, groups of exactly three digits, and at most three
 * digits before the first one. This is what rejects IP addresses, dates and
 * version numbers that the candidate regex happily matches.
 */
function groupingIsValid(groups: string[], separators: string[]): boolean {
  if (separators.length === 0) return true;

  const first = separators[0];
  if (first === undefined) return false;
  const spaceLike = isGroupingOnly(first);

  for (const separator of separators) {
    // Mixing "1.234 567" is not a grouping anyone writes on purpose.
    if (isGroupingOnly(separator) !== spaceLike) return false;
    if (!spaceLike && separator !== first) return false;
  }

  const head = groups[0];
  if (head === undefined || head.length < 1 || head.length > 3) return false;

  for (let i = 1; i < groups.length; i += 1) {
    if (groups[i]?.length !== 3) return false;
  }
  return true;
}

/**
 * Parses a human-written amount into a number.
 *
 * @returns the value, or null when the input is not an unambiguous amount.
 */
export function parseLocalizedNumber(raw: string): number | null {
  const tokens = tokenize(raw);
  if (tokens === null) return null;

  const { groups, separators } = tokens;

  if (separators.length === 0) {
    const whole = groups[0];
    if (whole === undefined) return null;
    const value = Number(whole);
    return Number.isFinite(value) && value < MAX_AMOUNT ? value : null;
  }

  const hasDecimal = lastSeparatorIsDecimal(tokens);
  if (hasDecimal === null) return null;

  const integerGroups = hasDecimal ? groups.slice(0, -1) : groups;
  const groupSeparators = hasDecimal ? separators.slice(0, -1) : separators;
  const fraction = hasDecimal ? groups[groups.length - 1] : '';
  if (fraction === undefined) return null;

  // With only a decimal mark there are no grouping separators left and the
  // integer part is one unbroken run of digits, so the check passes trivially.
  if (!groupingIsValid(integerGroups, groupSeparators)) return null;

  const integer = integerGroups.join('');
  if (integer === '') return null;

  const value = Number(fraction === '' ? integer : `${integer}.${fraction}`);
  return Number.isFinite(value) && value < MAX_AMOUNT ? value : null;
}
