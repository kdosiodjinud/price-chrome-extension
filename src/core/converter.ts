import { getMassUnit } from '@/core/registry/mass-units';
import type {
  Commodity,
  ConversionResult,
  CurrencyCode,
  MassUnit,
  MassUnitId,
  RateSnapshot,
} from '@/core/types';

/**
 * Turning a price into a weight of metal.
 *
 * Every conversion pivots through USD: the price is valued in USD, the metal
 * is quoted in USD per troy ounce, and grams are the internal base unit. That
 * keeps the number of rates we have to fetch linear in the number of
 * currencies rather than quadratic.
 */

/** Unit selection: a concrete unit, or let the commodity's ladder decide. */
export type UnitPreference = MassUnitId | 'auto';

export const AUTO_UNIT: UnitPreference = 'auto';

function isUsable(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Value of one unit of `currency` in USD. */
function currencyToUsdRate(currency: CurrencyCode, rates: RateSnapshot): number | null {
  if (currency === 'USD') return 1;
  const rate = rates.currencyToUsd[currency];
  return isUsable(rate) ? rate : null;
}

/**
 * Chooses the unit to display in.
 *
 * `auto` walks the commodity's ladder from the largest unit down and takes the
 * first one the amount fills at least once, so a car price reads in kilograms
 * and a coffee in grams. The smallest rung is the fallback.
 */
function chooseUnit(
  grams: number,
  commodity: Commodity,
  preference: UnitPreference,
): MassUnit | null {
  if (preference !== 'auto') {
    if (!commodity.supportedUnits.includes(preference)) return null;
    return getMassUnit(preference) ?? null;
  }

  let smallest: MassUnit | null = null;
  for (const unitId of commodity.autoUnitLadder) {
    const unit = getMassUnit(unitId);
    if (unit === undefined) continue;
    smallest = unit;
    if (grams >= unit.gramsPerUnit) return unit;
  }
  return smallest;
}

/**
 * Converts a price into a weight of the given commodity.
 *
 * @returns the weight, or null when a required rate is missing or the inputs
 *   do not produce a sane number. Callers leave the price untouched on null.
 */
export function convertPrice(
  amount: number,
  currency: CurrencyCode,
  commodity: Commodity,
  rates: RateSnapshot,
  preference: UnitPreference,
): ConversionResult | null {
  if (!isUsable(amount)) return null;

  const fxRate = currencyToUsdRate(currency, rates);
  if (fxRate === null) return null;

  const usdPerQuoteUnit = rates.commodityUsdPerQuoteUnit[commodity.id];
  if (!isUsable(usdPerQuoteUnit)) return null;

  const quoteUnit = getMassUnit(commodity.quoteUnit);
  if (quoteUnit === undefined || !isUsable(quoteUnit.gramsPerUnit)) return null;

  // The registry currently quotes every commodity in USD. Guard anyway so a
  // future non-USD quote fails closed instead of silently mispricing.
  if (commodity.quoteCurrency !== 'USD') return null;

  const usdValue = amount * fxRate;
  const usdPerGram = usdPerQuoteUnit / quoteUnit.gramsPerUnit;
  if (!isUsable(usdPerGram)) return null;

  const grams = usdValue / usdPerGram;
  if (!isUsable(grams)) return null;

  const unit = chooseUnit(grams, commodity, preference);
  if (unit === null) return null;

  const converted = grams / unit.gramsPerUnit;
  if (!isUsable(converted)) return null;

  return { amount: converted, unit, commodity };
}
