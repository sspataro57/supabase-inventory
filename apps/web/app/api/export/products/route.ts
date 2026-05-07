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

  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, measure_type, display_unit, description, pack_size, reorder_point, user_can_check_in, user_can_check_out, is_archived, created_at")
    .order("sku");

  const { data: codes } = await supabase
    .from("product_codes")
    .select("product_id, code, code_type");

  const codesByProduct = new Map<string, string[]>();
  for (const c of codes ?? []) {
    const arr = codesByProduct.get(c.product_id) ?? [];
    arr.push(`${c.code_type}:${c.code}`);
    codesByProduct.set(c.product_id, arr);
  }

  const headers = [
    "sku", "name", "measure_type", "display_unit", "description",
    "pack_size", "reorder_point", "user_can_check_in", "user_can_check_out",
    "is_archived", "barcodes", "created_at",
  ];

  const rows = (products ?? []).map((p) => {
    const barcodes = (codesByProduct.get(p.id) ?? []).join(";");
    return [
      csv(p.sku), csv(p.name), csv(p.measure_type), csv(p.display_unit ?? ""),
      csv(p.description ?? ""), csv(p.pack_size ?? ""), csv(p.reorder_point ?? ""),
      csv(p.user_can_check_in), csv(p.user_can_check_out), csv(p.is_archived),
      csv(barcodes), csv(p.created_at),
    ].join(",");
  });

  const body = [headers.join(","), ...rows].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="products-${datestamp()}.csv"`,
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
