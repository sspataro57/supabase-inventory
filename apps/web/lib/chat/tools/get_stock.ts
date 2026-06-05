import type { ToolDef } from "@/lib/llm/provider";
import { resolveDisplayUnit, formatStock } from "@/lib/stock";

export const getStockTool: ToolDef = {
  name: "get_stock",
  description: "Get the current stock level for a product.",
  parameters: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product UUID" },
    },
    required: ["product_id"],
  },
  async handler(input, { supabase }) {
    const { product_id } = input as { product_id: string };

    const [{ data: stock }, { data: product }, { data: prefs }, { data: units }] = await Promise.all([
      supabase.from("product_stock").select("*").eq("product_id", product_id).single(),
      supabase.from("products").select("measure_type, display_unit, name, sku").eq("id", product_id).single(),
      supabase.from("preferences").select("default_unit_mass, default_unit_volume, default_unit_count").eq("id", 1).single(),
      supabase.from("units").select("code, to_base_factor, measure_type").eq("is_active", true),
    ]);

    if (!stock || !product) return { error: "Product or stock not found" };

    const displayUnit = resolveDisplayUnit(product.measure_type, product.display_unit, prefs);
    const unitRow = (units ?? []).find((u) => u.code === displayUnit);
    const factor = unitRow ? Number(unitRow.to_base_factor) : null;
    const onHand = factor
      ? formatStock(Number(stock.base_on_hand), factor, displayUnit)
      : `${stock.base_on_hand} (base)`;
    // reorder_point is stored in base units; present it in the display unit too.
    const reorderPoint =
      stock.reorder_point != null && factor
        ? formatStock(Number(stock.reorder_point), factor, displayUnit)
        : null;

    // NOTE: intentionally NOT returning the raw base quantity — the model used
    // to quote it (grams) as if it were the display unit (#154).
    return {
      product: { name: product.name, sku: product.sku },
      on_hand: onHand,
      display_unit: displayUnit,
      is_low_stock: stock.is_low_stock,
      reorder_point: reorderPoint,
    };
  },
};
