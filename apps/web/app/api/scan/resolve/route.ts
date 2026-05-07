import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayUnit, formatStock } from "@/lib/stock";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  // Lookup barcode
  const { data: productCode } = await supabase
    .from("product_codes")
    .select("product_id")
    .eq("code", code)
    .eq("is_active", true)
    .single();

  if (!productCode) {
    return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
  }

  const [{ data: product }, { data: stock }, { data: prefs }, { data: units }, { data: profile }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", productCode.product_id).single(),
      supabase.from("product_stock").select("base_on_hand, is_low_stock").eq("product_id", productCode.product_id).single(),
      supabase.from("preferences").select("default_unit_mass, default_unit_volume, default_unit_count").eq("id", 1).single(),
      supabase.from("units").select("code, to_base_factor, measure_type, display_name").eq("is_active", true),
      supabase.from("profiles").select("role").eq("id", user.id).single(),
    ]);

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const isAdmin = profile?.role === "admin";
  const displayUnit = resolveDisplayUnit(product.measure_type, product.display_unit, prefs);
  const unitRow = (units ?? []).find((u) => u.code === displayUnit);
  const onHand = unitRow
    ? formatStock(Number(stock?.base_on_hand ?? 0), Number(unitRow.to_base_factor), displayUnit)
    : `${stock?.base_on_hand ?? 0}`;

  return NextResponse.json({
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      measure_type: product.measure_type,
      is_archived: product.is_archived,
      can_check_in: isAdmin || product.user_can_check_in,
      can_check_out: isAdmin || product.user_can_check_out,
    },
    stock: {
      on_hand: onHand,
      is_low_stock: stock?.is_low_stock ?? false,
    },
    units: (units ?? [])
      .filter((u) => u.measure_type === product.measure_type)
      .map((u) => ({ code: u.code, display_name: u.display_name })),
    default_unit: displayUnit,
  });
}
