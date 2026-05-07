export type UnitRow = { code: string; to_base_factor: number };

export function toBase(value: number, unit: UnitRow): number {
  return value * unit.to_base_factor;
}

export function fromBase(baseValue: number, unit: UnitRow): number {
  return baseValue / unit.to_base_factor;
}

/** Synthetic "case" unit built from a product's pack_size. */
export function caseUnit(packSize: number): UnitRow {
  return { code: "case", to_base_factor: packSize };
}
