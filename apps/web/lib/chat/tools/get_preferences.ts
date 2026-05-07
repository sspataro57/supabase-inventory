import type { ToolDef } from "@/lib/llm/provider";

export const getPreferencesTool: ToolDef = {
  name: "get_preferences",
  description: "Get the current system preferences including default units and settings.",
  parameters: {
    type: "object",
    properties: {},
  },
  async handler(_input, { supabase }) {
    const { data, error } = await supabase
      .from("preferences")
      .select("default_unit_mass, default_unit_volume, default_unit_count, require_lot_per_movement, low_stock_check_enabled")
      .eq("id", 1)
      .single();

    if (error) return { error: error.message };
    return { preferences: data };
  },
};
