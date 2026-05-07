import type { ToolDef } from "@/lib/llm/provider";

export const getLotsTool: ToolDef = {
  name: "get_lots",
  description: "Get all lots for a product with their expiration dates and on-hand quantities.",
  parameters: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Product UUID" },
    },
    required: ["product_id"],
  },
  async handler(input, { supabase }) {
    const { product_id } = input as { product_id: string };

    const { data, error } = await supabase
      .from("lot_stock")
      .select("lot_id, lot_code, expires_on, received_on, base_on_hand")
      .eq("product_id", product_id)
      .order("expires_on", { ascending: true, nullsFirst: false });

    if (error) return { error: error.message };
    return { lots: data ?? [] };
  },
};
