import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { archiveProduct } from "@/app/(admin)/products/actions";
import { resolveDisplayUnit, formatStock } from "@/lib/stock";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const userId = (await supabase.auth.getUser()).data.user!.id;

  const [
    { data: product },
    { data: barcodes },
    { data: profile },
    { data: stock },
    { data: prefs },
    { data: recentMovements },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("product_codes").select("code, code_type").eq("product_id", id),
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase.from("product_stock").select("base_on_hand, is_low_stock, reorder_point").eq("product_id", id).single(),
    supabase.from("preferences").select("default_unit_mass, default_unit_volume, default_unit_count").eq("id", 1).single(),
    supabase
      .from("movements")
      .select("id, movement_type, base_quantity, input_quantity, input_unit, reason, occurred_at, performed_by")
      .eq("product_id", id)
      .neq("movement_type", "void")
      .order("occurred_at", { ascending: false })
      .limit(10),
  ]);

  if (!product) notFound();

  const { data: subLocation } = product.sub_location_id
    ? await supabase
        .from("sub_locations")
        .select("code, locations(name)")
        .eq("id", product.sub_location_id)
        .maybeSingle()
    : { data: null };

  const isAdmin = profile?.role === "admin";
  const archiveAction = archiveProduct.bind(null, id);

  // Stock display
  const { data: units } = await supabase
    .from("units")
    .select("code, to_base_factor, measure_type")
    .eq("is_active", true);

  const displayUnit = resolveDisplayUnit(product.measure_type, product.display_unit, prefs);
  const unitRow = (units ?? []).find((u) => u.code === displayUnit);
  const baseOnHand = Number(stock?.base_on_hand ?? 0);
  const onHandStr = unitRow
    ? formatStock(baseOnHand, Number(unitRow.to_base_factor), displayUnit)
    : `${baseOnHand}`;

  const canCheckIn = isAdmin || product.user_can_check_in;
  const canCheckOut = isAdmin || product.user_can_check_out;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/catalog" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">Catalog</Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm text-gray-600 dark:text-gray-300">{product.name}</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{product.name}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{product.sku}</p>
          {subLocation && (() => {
            const rel = subLocation.locations as { name: string } | { name: string }[] | null;
            const roomName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
            return (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span className="font-mono">{subLocation.code}</span>
                {roomName && <> · {roomName}</>}
              </p>
            );
          })()}
        </div>

        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <Link
              href={`/products/${id}/edit`}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Edit
            </Link>
            {!product.is_archived && (
              <form action={archiveAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Archive
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {product.is_archived && (
        <div className="mb-4 rounded-lg bg-amber-50 dark:bg-yellow-900/20 border border-amber-200 px-4 py-2 text-sm text-amber-700 dark:text-yellow-300">
          This product is archived and hidden from the catalog.
        </div>
      )}

      {/* Stock card */}
      <div className={`rounded-xl border px-5 py-4 mb-6 flex items-center justify-between ${
        stock?.is_low_stock ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      }`}>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">On hand</p>
          <p className={`text-2xl font-semibold mt-0.5 ${stock?.is_low_stock ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-50"}`}>
            {onHandStr}
          </p>
          {stock?.is_low_stock && (
            <p className="text-xs text-red-500 mt-0.5">Below reorder point</p>
          )}
        </div>

        <div className="flex gap-2">
          {canCheckIn && (
            <Link
              href={`/movements/new?product=${id}&type=check_in`}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Check in
            </Link>
          )}
          {canCheckOut && (
            <Link
              href={`/movements/new?product=${id}&type=check_out`}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Check out
            </Link>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 mb-6">
        <Row label="Measure type"><span className="capitalize">{product.measure_type}</span></Row>
        {product.display_unit && <Row label="Display unit">{product.display_unit}</Row>}
        {product.description && <Row label="Description">{product.description}</Row>}
        {product.pack_size && <Row label="Pack size">{product.pack_size} units/case</Row>}
        {stock?.reorder_point != null && (
          <Row label="Reorder point">
            {unitRow ? formatStock(Number(stock.reorder_point), Number(unitRow.to_base_factor), displayUnit) : String(stock.reorder_point)}
          </Row>
        )}
        <Row label="Users can check in">{product.user_can_check_in ? "Yes" : "No"}</Row>
        <Row label="Users can check out">{product.user_can_check_out ? "Yes" : "No"}</Row>
      </div>

      {/* Barcodes */}
      {barcodes && barcodes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Codes</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {barcodes.map((b, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 capitalize w-16 shrink-0">{b.code_type}</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-50">{b.code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movement history */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Recent movements</h2>
        {recentMovements && recentMovements.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {recentMovements.map((m) => {
              const inputUnitRow = (units ?? []).find((u) => u.code === m.input_unit);
              const sign = m.base_quantity > 0 ? "+" : "−";
              const color = m.base_quantity > 0 ? "text-green-600" : "text-red-600 dark:text-red-400";
              const displayQty = inputUnitRow
                ? formatStock(Math.abs(m.base_quantity), Number(inputUnitRow.to_base_factor), m.input_unit)
                : `${Math.abs(m.input_quantity)} ${m.input_unit}`;

              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-sm font-medium w-6 shrink-0 ${color}`}>{sign}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-50">{displayQty}</p>
                    {m.reason && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{m.reason}</p>}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 capitalize">
                    {m.movement_type.replace("_", " ")}
                  </span>
                  <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0">
                    {new Date(m.occurred_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No movements recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="text-sm text-gray-500 dark:text-gray-400 w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-50">{children}</span>
    </div>
  );
}
