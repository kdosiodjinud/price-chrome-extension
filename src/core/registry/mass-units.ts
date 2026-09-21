import type { MassUnit, MassUnitId } from '@/core/types';

/**
 * Mass units, all expressed against the gram as the internal base unit.
 * Adding a unit is a single record here.
 */
export const MASS_UNITS: Readonly<Record<MassUnitId, MassUnit>> = Object.freeze({
  gram: { id: 'gram', gramsPerUnit: 1, symbol: 'g' },
  kilogram: { id: 'kilogram', gramsPerUnit: 1000, symbol: 'kg' },
  // The troy ounce is the standard unit for precious metals.
  troy_ounce: { id: 'troy_ounce', gramsPerUnit: 31.1034768, symbol: 'oz t' },
  // The avoirdupois ounce, offered because it is what most people mean by "ounce".
  ounce: { id: 'ounce', gramsPerUnit: 28.349523125, symbol: 'oz' },
});

export function getMassUnit(id: MassUnitId): MassUnit | undefined {
  return MASS_UNITS[id];
}
