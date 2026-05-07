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
    const onHand = unitRow
      ? formatStock(Number(stock.base_on_hand), Number(unitRow.to_base_factor), displayUnit)
      : `${stock.base_on_hand} (base)`;

    return {
      product: { name: product.name, sku: product.sku },
      on_hand: onHand,
      on_hand_base: stock.base_on_hand,
      display_unit: displayUnit,
      is_low_stock: stock.is_low_stock,
      reorder_point: stock.reorder_point,
    };
  },
};
