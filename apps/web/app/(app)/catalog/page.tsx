import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { resolveDisplayUnit, formatStock } from "@/lib/stock";

const MEASURE_BADGE: Record<string, string> = {
  mass: "bg-amber-100 text-amber-700",
  volume: "bg-blue-100 text-blue-700",
  count: "bg-green-100 text-green-700",
};

type SearchParams = {
  q?: string;
  low_stock?: string;
  archived?: string;
  room?: string;
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const showLowStock = sp.low_stock === "1";
  const showArchived = sp.archived === "1";
  const roomCode = sp.room ?? "";

  const supabase = await createClient();

  const userId = (await supabase.auth.getUser()).data.user!.id;

  const [{ data: profile }, { data: prefs }, { data: units }, { data: rooms }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase.from("preferences").select("default_unit_mass, default_unit_volume, default_unit_count").eq("id", 1).single(),
    supabase.from("units").select("code, to_base_factor, measure_type").eq("is_active", true),
    supabase.from("locations").select("id, code, name").eq("is_active", true).order("sort_order"),
  ]);

  const isAdmin = profile?.role === "admin";

  // If a room filter is active, resolve it to a set of product_ids.
  let roomFilteredProductIds: string[] | null = null;
  if (roomCode) {
    const room = (rooms ?? []).find((r) => r.code === roomCode);
    if (!room) {
      roomFilteredProductIds = [];
    } else {
      const { data: subs } = await supabase
        .from("sub_locations")
        .select("id")
        .eq("location_id", room.id);
      const subIds = (subs ?? []).map((s) => s.id);
      if (subIds.length === 0) {
        roomFilteredProductIds = [];
      } else {
        const { data: prods } = await supabase
          .from("products")
          .select("id")
          .in("sub_location_id", subIds);
        roomFilteredProductIds = (prods ?? []).map((p) => p.id);
      }
    }
  }

  // Empty-room short-circuit: when a room filter is active and there are no
  // matching products, skip the queries entirely (a `.in(col, [])` request can
  // error or behave inconsistently in PostgREST).
  const emptyRoom = roomFilteredProductIds !== null && roomFilteredProductIds.length === 0;

  // Load stock for the products we'll show (via product_stock view)
  let stockItems:
    | { product_id: string; sku: string; name: string; measure_type: string; display_unit: string | null; base_on_hand: number; reorder_point: number | null; is_low_stock: boolean }[]
    | null = null;
  let hasError = false;
  if (!emptyRoom) {
    let stockQuery = supabase
      .from("product_stock")
      .select("product_id, sku, name, measure_type, display_unit, base_on_hand, reorder_point, is_low_stock")
      .order("name");

    if (showLowStock) stockQuery = stockQuery.eq("is_low_stock", true);
    if (q) stockQuery = stockQuery.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    if (roomFilteredProductIds !== null) stockQuery = stockQuery.in("product_id", roomFilteredProductIds);

    const res = await stockQuery;
    stockItems = res.data;
    hasError = res.error != null;
  } else {
    stockItems = [];
  }

  // If showArchived, we need to query products table directly as well
  let archivedItems: { id: string; sku: string; name: string; measure_type: string; display_unit: string | null }[] = [];
  if (showArchived && !emptyRoom) {
    let archivedQ = supabase
      .from("products")
      .select("id, sku, name, measure_type, display_unit")
      .eq("is_archived", true)
      .order("name");
    if (q) archivedQ = archivedQ.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    if (roomFilteredProductIds !== null) archivedQ = archivedQ.in("id", roomFilteredProductIds);
    const { data } = await archivedQ;
    archivedItems = data ?? [];
  }

  const hasFilters = q || showLowStock || showArchived || roomCode;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Catalog</h1>
        {isAdmin && (
          <Link
            href="/products/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            + New Ingredient
          </Link>
        )}
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or RM#…"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          name="room"
          defaultValue={roomCode}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All rooms</option>
          {(rooms ?? []).map((r) => (
            <option key={r.id} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 cursor-pointer">
          <input type="checkbox" name="low_stock" value="1" defaultChecked={showLowStock} className="rounded" />
          Low stock only
        </label>
        {isAdmin && (
          <label
            title="Also show ingredients that have been archived (hidden from the normal catalog). Open one to unarchive it."
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 cursor-pointer"
          >
            <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} className="rounded" />
            Include archived
          </label>
        )}
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Filter
        </button>
        {hasFilters && (
          <Link
            href="/catalog"
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {hasError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">
          Failed to load ingredients.
        </div>
      )}

      {/* Active products */}
      {(!stockItems || stockItems.length === 0) && archivedItems.length === 0 && !hasError && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
          {q ? `No ingredients matching "${q}".` : "No ingredients yet."}
          {isAdmin && !q && (
            <p className="mt-2">
              <Link href="/products/new" className="text-indigo-600 hover:underline">
                Create the first ingredient
              </Link>
            </p>
          )}
        </div>
      )}

      {stockItems && stockItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden mb-4">
          {stockItems.map((p) => {
            const displayUnit = resolveDisplayUnit(p.measure_type, p.display_unit, prefs);
            const unitRow = (units ?? []).find((u) => u.code === displayUnit);
            const onHand = unitRow
              ? formatStock(Number(p.base_on_hand), Number(unitRow.to_base_factor), displayUnit)
              : `${p.base_on_hand}`;

            return (
              <Link
                key={p.product_id}
                href={`/catalog/${p.product_id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{p.sku}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${p.is_low_stock ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-200"}`}>
                  {onHand}
                </span>
                <span
                  className={`text-xs font-medium rounded px-1.5 py-0.5 capitalize shrink-0 ${
                    MEASURE_BADGE[p.measure_type] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {p.measure_type}
                </span>
                {p.is_low_stock && (
                  <span className="text-xs bg-red-100 text-red-600 rounded px-1.5 py-0.5 shrink-0">low</span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Archived products */}
      {archivedItems.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Archived</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden opacity-60">
            {archivedItems.map((p) => (
              <Link
                key={p.id}
                href={`/catalog/${p.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{p.sku}</p>
                </div>
                <span
                  className={`text-xs font-medium rounded px-1.5 py-0.5 capitalize shrink-0 ${
                    MEASURE_BADGE[p.measure_type] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {p.measure_type}
                </span>
                <span className="text-xs bg-amber-100 text-amber-600 rounded px-1.5 py-0.5 shrink-0">archived</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
