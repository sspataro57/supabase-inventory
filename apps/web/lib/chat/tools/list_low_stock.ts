import type { ToolDef } from "@/lib/llm/provider";

export const listLowStockTool: ToolDef = {
  name: "list_low_stock",
  description: "List all products currently below their reorder points.",
  parameters: {
    type: "object",
    properties: {},
  },
  async handler(_input, { supabase }) {
    const { data, error } = await supabase
      .from("product_stock")
      .select("product_id, sku, name, base_on_hand, reorder_point")
      .eq("is_low_stock", true)
      .order("name");

    if (error) return { error: error.message };
    return { low_stock: data ?? [], count: data?.length ?? 0 };
  },
};
