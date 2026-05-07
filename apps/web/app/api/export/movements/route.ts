import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();

  if (profile?.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: movements } = await supabase
    .from("movements")
    .select("id, products(sku, name), movement_type, input_quantity, input_unit, base_quantity, reason, occurred_at, performed_by")
    .order("occurred_at", { ascending: false });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name");

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? p.email]));

  const headers = ["id", "sku", "product_name", "movement_type", "input_quantity", "input_unit", "base_quantity", "reason", "performed_by", "occurred_at"];

  const rows = (movements ?? []).map((m) => {
    const product = (Array.isArray(m.products) ? m.products[0] : m.products) as { sku: string; name: string } | null;
    const actor = profileMap.get(m.performed_by ?? "") ?? m.performed_by ?? "";
    return [
      csv(m.id), csv(product?.sku ?? ""), csv(product?.name ?? ""),
      csv(m.movement_type), csv(m.input_quantity), csv(m.input_unit),
      csv(m.base_quantity), csv(m.reason ?? ""), csv(actor), csv(m.occurred_at),
    ].join(",");
  });

  const body = [headers.join(","), ...rows].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="movements-${datestamp()}.csv"`,
    },
  });
}

function csv(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function datestamp() {
  return new Date().toISOString().slice(0, 10);
}
