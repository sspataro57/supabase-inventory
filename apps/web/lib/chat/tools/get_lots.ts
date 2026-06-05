import type { ToolDef } from "@/lib/llm/provider";
import { makeStockFormatter } from "@/lib/chat/format-units";

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

    const [{ data, error }, { data: product }, formatter] = await Promise.all([
      supabase
        .from("lot_stock")
        .select("lot_id, lot_code, expires_on, received_on, base_on_hand")
        .eq("product_id", product_id)
        .order("expires_on", { ascending: true, nullsFirst: false }),
      supabase.from("products").select("measure_type, display_unit").eq("id", product_id).single(),
      makeStockFormatter(supabase),
    ]);

    if (error) return { error: error.message };

    // #154: attach a formatted display-unit on_hand to each lot so the model
    // quotes the right number instead of the raw base (grams/ml) value.
    const lots = (data ?? []).map((l) => {
      const { on_hand, display_unit } = formatter.format(
        Number(l.base_on_hand),
        product?.measure_type ?? "mass",
        product?.display_unit ?? null,
      );
      return { ...l, on_hand, display_unit };
    });

    return { lots };
  },
};
