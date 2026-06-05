import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveDisplayUnit, formatStock } from "@/lib/stock";

/**
 * #154: Chat tools used to hand the model raw base-unit numbers (grams/ml) with
 * no label, so it reported e.g. grams as if they were oz. This builds a
 * formatter (loading preferences + unit factors once) that turns a base
 * quantity into a display string like "12.5 oz", so tools can return a
 * ready-to-quote value instead of an ambiguous raw number.
 */
export async function makeStockFormatter(supabase: SupabaseClient) {
  const [{ data: prefs }, { data: units }] = await Promise.all([
    supabase
      .from("preferences")
      .select("default_unit_mass, default_unit_volume, default_unit_count")
      .eq("id", 1)
      .single(),
    supabase.from("units").select("code, to_base_factor").eq("is_active", true),
  ]);
  const unitMap = new Map((units ?? []).map((u) => [u.code, Number(u.to_base_factor)]));

  return {
    /** Returns { on_hand: "12.5 oz", display_unit: "oz" } for a base quantity. */
    format(baseQty: number | null | undefined, measureType: string, displayUnit: string | null) {
      const unit = resolveDisplayUnit(measureType, displayUnit, prefs);
      const factor = unitMap.get(unit);
      if (baseQty == null || factor == null) {
        return { on_hand: null as string | null, display_unit: unit };
      }
      return { on_hand: formatStock(Number(baseQty), factor, unit), display_unit: unit };
    },
  };
}
