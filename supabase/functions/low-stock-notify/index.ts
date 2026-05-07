import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL") ?? "admin@example.com";

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  // Low-stock products not notified today
  const { data: lowStockItems } = await supabase
    .from("product_stock")
    .select("product_id, sku, name, base_on_hand, reorder_point")
    .eq("is_low_stock", true);

  const { data: alreadySentLow } = await supabase
    .from("notification_log")
    .select("entity_id")
    .eq("kind", "low_stock")
    .gte("sent_at", today + "T00:00:00Z");

  const sentLowSet = new Set((alreadySentLow ?? []).map((r) => r.entity_id));
  const newLow = (lowStockItems ?? []).filter((p) => !sentLowSet.has(p.product_id));

  // Expiring lots (within 30 days) not notified today
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: expiringLots } = await supabase
    .from("lot_stock")
    .select("lot_id, lot_code, product_id, expires_on, base_on_hand")
    .not("expires_on", "is", null)
    .gt("base_on_hand", 0)
    .lte("expires_on", in30)
    .order("expires_on");

  const { data: alreadySentLots } = await supabase
    .from("notification_log")
    .select("entity_id")
    .eq("kind", "expiring_lot")
    .gte("sent_at", today + "T00:00:00Z");

  const sentLotsSet = new Set((alreadySentLots ?? []).map((r) => r.entity_id));
  const newExpiring = (expiringLots ?? []).filter((l) => !sentLotsSet.has(l.lot_id));

  if (newLow.length === 0 && newExpiring.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: "nothing new to notify" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build email body
  let body = `Daily inventory digest — ${today}\n\n`;

  if (newLow.length > 0) {
    body += `LOW STOCK (${newLow.length} products)\n`;
    body += "─".repeat(40) + "\n";
    for (const p of newLow) {
      body += `• ${p.name} (${p.sku}) — ${p.base_on_hand} base units (reorder at ${p.reorder_point})\n`;
    }
    body += "\n";
  }

  if (newExpiring.length > 0) {
    body += `EXPIRING WITHIN 30 DAYS (${newExpiring.length} lots)\n`;
    body += "─".repeat(40) + "\n";
    for (const l of newExpiring) {
      body += `• Lot ${l.lot_code} — expires ${l.expires_on} — ${l.base_on_hand} base units on hand\n`;
    }
    body += "\n";
  }

  // Send via Resend
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Inventory <noreply@yourdomain.com>",
      to: [NOTIFY_EMAIL],
      subject: `[Inventory] ${newLow.length} low-stock · ${newExpiring.length} expiring`,
      text: body,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    return new Response(`Email send failed: ${errText}`, { status: 500 });
  }

  // Log sent notifications
  const logRows = [
    ...newLow.map((p) => ({ kind: "low_stock", entity_id: p.product_id, sent_date: today })),
    ...newExpiring.map((l) => ({ kind: "expiring_lot", entity_id: l.lot_id, sent_date: today })),
  ];
  await supabase.from("notification_log").upsert(logRows, { onConflict: "kind,entity_id,sent_date" });

  return new Response(
    JSON.stringify({ sent: true, low_stock: newLow.length, expiring: newExpiring.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
