import Link from "next/link";
import { uploadImport } from "./actions";

type SearchParams = {
  ok?: string;
  errors?: string;
  details?: string;
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const okCount = sp.ok !== undefined ? parseInt(sp.ok, 10) : null;
  const errCount = sp.errors !== undefined ? parseInt(sp.errors, 10) : null;

  let errorRows: { row: number; sku: string; error: string }[] = [];
  if (sp.details) {
    try { errorRows = JSON.parse(decodeURIComponent(sp.details)); } catch { /* ignore */ }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">Import / Export</h1>

      {/* Export links */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Export</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {[
            { href: "/api/export/products", label: "Products catalog", desc: "All products + barcodes" },
            { href: "/api/export/stock", label: "Current stock", desc: "On-hand quantities in display units" },
            { href: "/api/export/movements", label: "Movement history", desc: "All check-ins and check-outs" },
          ].map(({ href, label, desc }) => (
            <a
              key={href}
              href={href}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
              </div>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Download CSV</span>
            </a>
          ))}
        </div>
      </section>

      {/* Import result */}
      {okCount !== null && (
        <div className={`mb-6 rounded-lg border px-4 py-4 text-sm ${
          errCount === 0
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          <p className="font-medium mb-1">
            {errCount === 0 ? "Import complete" : "Import finished with errors"}
          </p>
          <p>
            {okCount} {okCount === 1 ? "row" : "rows"} imported
            {errCount! > 0 && ` · ${errCount} failed`}
          </p>

          {errorRows.length > 0 && (
            <div className="mt-3 space-y-1">
              {errorRows.map((r) => (
                <p key={r.row} className="text-xs font-mono">
                  Row {r.row} ({r.sku || "no SKU"}): {r.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import form */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Import ingredients</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-6 py-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Required columns:{" "}
              <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">sku, name, measure_type</code>.
              {" "}Optional: <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">display_unit, description, pack_size, reorder_point, user_can_check_in, user_can_check_out, is_archived, barcodes</code>.
              {" "}Barcodes format: <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">type:code;type:code</code>.
              Existing SKUs are upserted.
            </p>
            <a
              href="/products-template.csv"
              download
              className="shrink-0 text-xs font-medium text-indigo-600 hover:underline whitespace-nowrap"
            >
              Download template
            </a>
          </div>
          <form action={uploadImport} className="space-y-4">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="block w-full text-sm text-gray-900 dark:text-gray-50 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            >
              Upload &amp; Import
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
