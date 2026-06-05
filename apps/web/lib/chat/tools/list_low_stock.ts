import type { ToolDef } from "@/lib/llm/provider";
import { makeStockFormatter } from "@/lib/chat/format-units";

export const listLowStockTool: ToolDef = {
  name: "list_low_stock",
  description: "List all products currently below their reorder points.",
  parameters: {
    type: "object",
    properties: {},
  },
  async handler(_input, { supabase }) {
    const [{ data, error }, formatter] = await Promise.all([
      supabase
        .from("product_stock")
        .select("product_id, sku, name, measure_type, display_unit, base_on_hand, reorder_point")
        .eq("is_low_stock", true)
        .order("name"),
      makeStockFormatter(supabase),
    ]);

    if (error) return { error: error.message };

    // #154: format on_hand / reorder_point into the display unit per product.
    const low_stock = (data ?? []).map((p) => ({
      product_id: p.product_id,
      sku: p.sku,
      name: p.name,
      on_hand: formatter.format(Number(p.base_on_hand), p.measure_type, p.display_unit).on_hand,
      reorder_point:
        p.reorder_point != null
          ? formatter.format(Number(p.reorder_point), p.measure_type, p.display_unit).on_hand
          : null,
      display_unit: formatter.format(0, p.measure_type, p.display_unit).display_unit,
    }));

    return { low_stock, count: low_stock.length };
  },
};
