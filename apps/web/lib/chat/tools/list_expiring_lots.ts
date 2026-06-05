import type { ToolDef } from "@/lib/llm/provider";
import { makeStockFormatter } from "@/lib/chat/format-units";

export const listExpiringLotsTool: ToolDef = {
  name: "list_expiring_lots",
  description: "List lots that are expiring within a given number of days.",
  parameters: {
    type: "object",
    properties: {
      days: { type: "number", description: "Number of days to look ahead (default: 30)" },
    },
  },
  async handler(input, { supabase }) {
    const { days = 30 } = input as { days?: number };
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [{ data, error }, formatter] = await Promise.all([
      supabase
        .from("lot_stock")
        .select("lot_id, lot_code, product_id, expires_on, base_on_hand")
        .not("expires_on", "is", null)
        .gt("base_on_hand", 0)
        .lte("expires_on", cutoff)
        .order("expires_on", { ascending: true }),
      makeStockFormatter(supabase),
    ]);

    if (error) return { error: error.message };

    // lot_stock has no measure_type/unit, so resolve the products to format each
    // lot's on_hand in the display unit and label it with name + RM# (#154).
    const productIds = [...new Set((data ?? []).map((l) => l.product_id))];
    const { data: products } = productIds.length
      ? await supabase
          .from("products")
          .select("id, name, sku, measure_type, display_unit")
          .in("id", productIds)
      : { data: [] };
    const pmap = new Map((products ?? []).map((p) => [p.id, p]));

    const lots = (data ?? []).map((l) => {
      const p = pmap.get(l.product_id);
      const { on_hand, display_unit } = formatter.format(
        Number(l.base_on_hand),
        p?.measure_type ?? "mass",
        p?.display_unit ?? null,
      );
      return {
        lot_id: l.lot_id,
        lot_code: l.lot_code,
        product_id: l.product_id,
        product_name: p?.name ?? null,
        sku: p?.sku ?? null,
        expires_on: l.expires_on,
        on_hand,
        display_unit,
      };
    });

    return { lots, count: lots.length, days_ahead: days };
  },
};
