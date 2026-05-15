import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayUnit, formatStock } from "@/lib/stock";
import { MovementsChart } from "./MovementsChart";
import { TopMoversChart } from "./TopMoversChart";

const today = () => new Date().toISOString().slice(0, 10);
const nDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: lowStock },
    { data: recentMovements },
    { data: prefs },
    { data: units },
    { data: expiringSoon },
    { count: totalSkus },
    { count: lowStockCount },
    { count: expiringMonthCount },
    { data: movementsDailyRaw },
  ] = await Promise.all([
    supabase
      .from("product_stock")
      .select("product_id, sku, name, measure_type, display_unit, base_on_hand, reorder_point")
      .eq("is_low_stock", true)
      .order("name"),
    supabase
      .from("movements")
      .select("id, product_id, movement_type, base_quantity, input_quantity, input_unit, reason, occurred_at, products(name, sku)")
      .neq("movement_type", "void")
      .order("occurred_at", { ascending: false })
      .limit(15),
    supabase
      .from("preferences")
      .select("default_unit_mass, default_unit_volume, default_unit_count")
      .eq("id", 1)
      .single(),
    supabase.from("units").select("code, to_base_factor, measure_type").eq("is_active", true),
    supabase
      .from("lot_stock")
      .select("lot_id, lot_code, expires_on, product_id, base_on_hand")
      .not("expires_on", "is", null)
      .gt("base_on_hand", 0)
      .lte("expires_on", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("expires_on", { ascending: true })
      .limit(10),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false),
    supabase
      .from("product_stock")
      .select("product_id", { count: "exact", head: true })
      .eq("is_low_stock", true),
    supabase
      .from("lot_stock")
      .select("lot_id", { count: "exact", head: true })
      .not("expires_on", "is", null)
      .gt("base_on_hand", 0)
      .lte("expires_on", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    // 30-day movement summary from the report function
    supabase.rpc("report_movements_summary" as never, {
      p_from: nDaysAgo(30),
      p_to: today(),
    } as never),
  ]);

  // Movements today count
  type SummaryRow = { day: string; n_check_ins: number; n_check_outs: number; product_name: string };
  const summaryRows = (movementsDailyRaw as SummaryRow[] | null) ?? [];

  const todayStr = today();
  const movementsToday = summaryRows
    .filter((r) => r.day === todayStr)
    .reduce((acc, r) => acc + (r.n_check_ins ?? 0) + (r.n_check_outs ?? 0), 0);

  // Build chart data: group by day, sum across products
  const dayMap = new Map<string, { check_ins: number; check_outs: number }>();
  for (const row of summaryRows) {
    const existing = dayMap.get(row.day) ?? { check_ins: 0, check_outs: 0 };
    dayMap.set(row.day, {
      check_ins: existing.check_ins + (row.n_check_ins ?? 0),
      check_outs: existing.check_outs + (row.n_check_outs ?? 0),
    });
  }
  // Fill missing days
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const day = nDaysAgo(29 - i);
    const d = dayMap.get(day) ?? { check_ins: 0, check_outs: 0 };
    return { day, ...d };
  });

  // Top movers: top 10 products by total movements in 30 days
  const productMovements = new Map<string, { name: string; movements: number }>();
  for (const row of summaryRows) {
    const existing = productMovements.get(row.product_name) ?? { name: row.product_name, movements: 0 };
    productMovements.set(row.product_name, {
      name: row.product_name,
      movements: existing.movements + (row.n_check_ins ?? 0) + (row.n_check_outs ?? 0),
    });
  }
  const topMovers = [...productMovements.values()]
    .sort((a, b) => b.movements - a.movements)
    .slice(0, 10)
    .reverse(); // BarChart horizontal — ascending for readability

  const kpis = [
    { label: "Active SKUs", value: totalSkus ?? 0 },
    { label: "Low Stock", value: lowStockCount ?? 0, alert: (lowStockCount ?? 0) > 0 },
    { label: "Expiring (30d)", value: expiringMonthCount ?? 0, alert: (expiringMonthCount ?? 0) > 0 },
    { label: "Movements Today", value: movementsToday },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Dashboard</h1>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${k.alert ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-50"}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">Movements — last 30 days</h2>
          <MovementsChart data={chartData} />
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">Top movers — last 30 days</h2>
          {topMovers.length > 0
            ? <TopMoversChart data={topMovers} />
            : <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No movements yet.</p>
          }
        </section>
      </div>

      {/* Low stock */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
          Low stock
          {lowStock && lowStock.length > 0 && (
            <span className="ml-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium px-2 py-0.5">
              {lowStock.length}
            </span>
          )}
        </h2>

        {!lowStock?.length ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            All ingredients are above their reorder points.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
            {lowStock.map((p) => {
              const displayUnit = resolveDisplayUnit(p.measure_type, p.display_unit, prefs);
              const unitRow = (units ?? []).find((u) => u.code === displayUnit);
              const onHand = unitRow
                ? formatStock(Number(p.base_on_hand), Number(unitRow.to_base_factor), displayUnit)
                : `${p.base_on_hand}`;
              const reorder = unitRow && p.reorder_point != null
                ? formatStock(Number(p.reorder_point), Number(unitRow.to_base_factor), displayUnit)
                : null;

              return (
                <Link
                  key={p.product_id}
                  href={`/catalog/${p.product_id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{p.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">{onHand}</p>
                    {reorder && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">reorder at {reorder}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Expiring soon */}
      {expiringSoon && expiringSoon.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
            Expiring within 30 days
            <span className="ml-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5">
              {expiringSoon.length}
            </span>
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
            {expiringSoon.map((l) => {
              const daysLeft = Math.ceil(
                (new Date(l.expires_on!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              return (
                <Link
                  key={l.lot_id}
                  href={`/catalog/${l.product_id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{l.lot_code}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">expires {l.expires_on}</p>
                  </div>
                  <span
                    className={`text-xs font-medium rounded px-2 py-0.5 shrink-0 ${
                      daysLeft <= 7
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {daysLeft}d
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent movements */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Recent movements</h2>

        {!recentMovements?.length ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            No movements recorded yet.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
            {recentMovements.map((m) => {
              const inputUnitRow = (units ?? []).find((u) => u.code === m.input_unit);
              const sign = m.base_quantity > 0 ? "+" : "−";
              const color = m.base_quantity > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
              const qty = inputUnitRow
                ? formatStock(Math.abs(m.base_quantity), Number(inputUnitRow.to_base_factor), m.input_unit)
                : `${Math.abs(m.input_quantity)} ${m.input_unit}`;
              const product = (Array.isArray(m.products) ? m.products[0] : m.products) as { name: string; sku: string } | null;

              return (
                <Link
                  key={m.id}
                  href={`/catalog/${m.product_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className={`text-sm font-semibold w-5 shrink-0 ${color}`}>{sign}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-50 truncate">
                      {qty} · <span className="text-gray-500 dark:text-gray-400">{product?.name ?? "—"}</span>
                    </p>
                    {m.reason && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{m.reason}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                      {m.movement_type.replace("_", " ")}
                    </p>
                    <p className="text-xs text-gray-300 dark:text-gray-600">
                      {new Date(m.occurred_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
