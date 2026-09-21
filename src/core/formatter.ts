import type { ConversionResult } from '@/core/types';

/**
 * Rendering a converted weight as the short piece of text that replaces the
 * price on the page. It has to stay compact: it is dropped into layouts that
 * were sized for the original price.
 */

/** How many decimals to show, or `auto` to scale with the magnitude. */
export type DecimalPreference = 'auto' | 0 | 1 | 2 | 3;

/**
 * How to label the metal: with its ticker (`Ag`), with its name, or not at
 * all — once the metal is chosen in the settings, some people want to read
 * only the weight.
 */
export type LabelStyle = 'ticker' | 'name' | 'none';

/**
 * Keeps small amounts informative without making large ones noisy: 0.512 g,
 * 5.12 g, 51.2 g, 512 g.
 */
function autoDecimals(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude >= 100) return 0;
  if (magnitude >= 10) return 1;
  if (magnitude >= 1) return 2;
  return 3;
}

export interface FormatOptions {
  /** BCP 47 tag driving digit grouping and the decimal mark. */
  readonly locale: string;
  readonly decimals: DecimalPreference;
  readonly labelStyle: LabelStyle;
  /** Name of the metal in the display language, already in the right case. */
  readonly commodityName: string;
}

export function formatConversion(result: ConversionResult, options: FormatOptions): string {
  const decimals = options.decimals === 'auto' ? autoDecimals(result.amount) : options.decimals;

  const number = new Intl.NumberFormat(options.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(result.amount);

  // A narrow no-break space keeps the parts on one line.
  const weight = `${number} ${result.unit.symbol}`;
  if (options.labelStyle === 'none') return weight;

  const label =
    options.labelStyle === 'name' ? options.commodityName : result.commodity.tickerSymbol;
  return `${weight} ${label}`;
}
