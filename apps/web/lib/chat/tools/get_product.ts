import type { ToolDef } from "@/lib/llm/provider";

export const getProductTool: ToolDef = {
  name: "get_product",
  description: "Get detailed information about a specific product by its ID or SKU.",
  parameters: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product UUID" },
      sku: { type: "string", description: "Product SKU (alternative to product_id)" },
    },
  },
  async handler(input, { supabase }) {
    const { product_id, sku } = input as { product_id?: string; sku?: string };

    if (!product_id && !sku) return { error: "Provide either product_id or sku" };

    let q = supabase.from("products").select("*, product_codes(code, code_type)");
    if (product_id) q = q.eq("id", product_id);
    else q = q.eq("sku", sku!);

    const { data, error } = await q.single();
    if (error) return { error: error.message };
    return { product: data };
  },
};
