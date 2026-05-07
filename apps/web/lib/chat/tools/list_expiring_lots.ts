import type { ToolDef } from "@/lib/llm/provider";

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

    const { data, error } = await supabase
      .from("lot_stock")
      .select("lot_id, lot_code, product_id, expires_on, base_on_hand")
      .not("expires_on", "is", null)
      .gt("base_on_hand", 0)
      .lte("expires_on", cutoff)
      .order("expires_on", { ascending: true });

    if (error) return { error: error.message };
    return { lots: data ?? [], count: data?.length ?? 0, days_ahead: days };
  },
};
