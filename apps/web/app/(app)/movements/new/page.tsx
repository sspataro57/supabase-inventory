import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MovementForm } from "@/components/MovementForm";
import { submitMovement } from "../actions";
import { resolveDisplayUnit, formatStock } from "@/lib/stock";

export default async function NewMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; type?: string; lot?: string }>;
}) {
  const { product: productId, type, lot: defaultLotId } = await searchParams;
  const supabase = await createClient();

  // If no product selected, show a product picker
  if (!productId) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, sku, measure_type")
      .eq("is_archived", false)
      .order("name");

    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">Record movement</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select an ingredient to continue.</p>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 max-w-sm overflow-hidden">
          {products?.map((p) => (
            <Link
              key={p.id}
              href={`/movements/new?product=${p.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{p.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{p.sku}</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600">›</span>
            </Link>
          ))}
          {!products?.length && (
            <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No ingredients found.</p>
          )}
        </div>
      </div>
    );
  }

  const userId = (await supabase.auth.getUser()).data.user!.id;

  const [
    { data: product },
    { data: stock },
    { data: units },
    { data: prefs },
    { data: profile },
    { data: lotStock },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).eq("is_archived", false).single(),
    supabase.from("product_stock").select("base_on_hand").eq("product_id", productId).single(),
    supabase.from("units").select("code, display_name, measure_type, to_base_factor").eq("is_active", true).order("display_name"),
    supabase.from("preferences").select("default_unit_mass, default_unit_volume, default_unit_count, require_lot_per_movement").eq("id", 1).single(),
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase.from("lot_stock").select("lot_id, lot_code, expires_on, received_on, base_on_hand").eq("product_id", productId).order("expires_on", { ascending: true, nullsFirst: false }),
  ]);

  if (!product) notFound();

  const isAdmin = profile?.role === "admin";
  const productUnits = (units ?? []).filter((u) => u.measure_type === product.measure_type);
  const displayUnit = resolveDisplayUnit(product.measure_type, product.display_unit, prefs);
  const unitRow = (units ?? []).find((u) => u.code === displayUnit);
  const onHandStr = unitRow
    ? formatStock(Number(stock?.base_on_hand ?? 0), Number(unitRow.to_base_factor), displayUnit)
    : `${stock?.base_on_hand ?? 0} (base)`;

  const defaultType = type === "check_out" ? "check_out" : "check_in";

  const lots = (lotStock ?? []).map((l) => ({
    id: l.lot_id,
    lot_code: l.lot_code,
    expires_on: l.expires_on,
    received_on: l.received_on,
    base_on_hand: Number(l.base_on_hand),
    on_hand_display: unitRow
      ? formatStock(Number(l.base_on_hand), Number(unitRow.to_base_factor), displayUnit)
      : `${l.base_on_hand}`,
  }));

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/catalog" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">Catalog</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <Link href={`/catalog/${product.id}`} className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">{product.name}</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-sm text-gray-600 dark:text-gray-300">Movement</span>
      </div>

      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">Record movement</h1>

      <MovementForm
        product={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          measure_type: product.measure_type,
          user_can_check_in: product.user_can_check_in,
          user_can_check_out: product.user_can_check_out,
        }}
        units={productUnits}
        defaultUnit={displayUnit}
        defaultType={defaultType}
        isAdmin={isAdmin}
        onHand={onHandStr}
        lots={lots}
        requireLot={prefs?.require_lot_per_movement ?? false}
        defaultLotId={defaultLotId}
        action={submitMovement}
      />
    </div>
  );
}
