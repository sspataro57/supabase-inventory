import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayUnit, formatStock } from "@/lib/stock";

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

  const [{ data: stock }, { data: prefs }, { data: units }] = await Promise.all([
    supabase
      .from("product_stock")
      .select("product_id, sku, name, measure_type, display_unit, base_on_hand, reorder_point, is_low_stock")
      .order("sku"),
    supabase.from("preferences").select("default_unit_mass, default_unit_volume, default_unit_count").eq("id", 1).single(),
    supabase.from("units").select("code, to_base_factor, measure_type").eq("is_active", true),
  ]);

  const headers = ["sku", "name", "measure_type", "on_hand_display", "on_hand_base", "display_unit", "reorder_point_base", "is_low_stock"];

  const rows = (stock ?? []).map((p) => {
    const displayUnit = resolveDisplayUnit(p.measure_type, p.display_unit, prefs);
    const unitRow = (units ?? []).find((u) => u.code === displayUnit);
    const onHandDisplay = unitRow
      ? formatStock(Number(p.base_on_hand), Number(unitRow.to_base_factor), displayUnit)
      : String(p.base_on_hand);

    return [
      csv(p.sku), csv(p.name), csv(p.measure_type), csv(onHandDisplay),
      csv(p.base_on_hand), csv(displayUnit), csv(p.reorder_point ?? ""), csv(p.is_low_stock),
    ].join(",");
  });

  const body = [headers.join(","), ...rows].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="stock-${datestamp()}.csv"`,
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
