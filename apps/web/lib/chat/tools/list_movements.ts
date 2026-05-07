import type { ToolDef } from "@/lib/llm/provider";

export const listMovementsTool: ToolDef = {
  name: "list_movements",
  description: "List recent stock movements, optionally filtered by product.",
  parameters: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "Filter to a specific product UUID (optional)" },
      limit: { type: "number", description: "Max results (default: 20, max: 50)" },
    },
  },
  async handler(input, { supabase }) {
    const { product_id, limit = 20 } = input as { product_id?: string; limit?: number };
    const safeLimit = Math.min(limit, 50);

    let q = supabase
      .from("movements")
      .select("id, product_id, movement_type, input_quantity, input_unit, base_quantity, reason, occurred_at, products(name, sku)")
      .neq("movement_type", "void")
      .order("occurred_at", { ascending: false })
      .limit(safeLimit);

    if (product_id) q = q.eq("product_id", product_id);

    const { data, error } = await q;
    if (error) return { error: error.message };
    return { movements: data ?? [] };
  },
};
