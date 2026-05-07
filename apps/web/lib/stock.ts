import { fromBase } from "./units/convert";

const BASE_UNIT: Record<string, string> = { mass: "g", volume: "ml", count: "ea" };

type Prefs = {
  default_unit_mass: string;
  default_unit_volume: string;
  default_unit_count: string;
};

/** Resolves which unit to display stock in for a given product. */
export function resolveDisplayUnit(
  measureType: string,
  productDisplayUnit: string | null | undefined,
  prefs: Prefs | null | undefined
): string {
  if (productDisplayUnit) return productDisplayUnit;
  if (prefs) {
    if (measureType === "mass") return prefs.default_unit_mass;
    if (measureType === "volume") return prefs.default_unit_volume;
    if (measureType === "count") return prefs.default_unit_count;
  }
  return BASE_UNIT[measureType] ?? "ea";
}

/** Formats a base quantity for display. */
export function formatStock(baseOnHand: number, toBaseFactor: number, unitCode: string): string {
  const displayValue = fromBase(baseOnHand, { code: unitCode, to_base_factor: toBaseFactor });
  const formatted =
    displayValue % 1 === 0
      ? displayValue.toFixed(0)
      : parseFloat(displayValue.toFixed(4)).toString();
  return `${formatted} ${unitCode}`;
}
