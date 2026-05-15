import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getReport, REPORTS } from "@/lib/reports/registry";
import { ReportTable } from "./ReportTable";
import { ExportButtons } from "./ExportButtons";
import Link from "next/link";

export async function generateStaticParams() {
  return REPORTS.map((r) => ({ slug: r.slug }));
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const report = getReport(slug);
  if (!report) notFound();

  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  if (report.isAdminOnly && !isAdmin) redirect("/reports");

  // Build RPC params from searchParams (defaults applied for missing ones)
  const rpcParams: Record<string, unknown> = {};
  let missingRequired = false;
  for (const p of report.params) {
    const val = sp[p.name] ?? p.default;
    if (val === null || val === "") {
      if (p.type === "uuid") { missingRequired = true; }
    } else {
      rpcParams[p.name] = val;
    }
  }

  let rows: Record<string, unknown>[] = [];
  let error: { message: string } | null = null;
  if (!missingRequired) {
    const result = await supabase.rpc(report.rpcName as never, rpcParams as never);
    rows = (result.data ?? []) as Record<string, unknown>[];
    error = result.error;
  }

  return (
    <div className="space-y-6 report-content">
      <div className="flex items-center gap-3">
        <Link href="/reports" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          ← Reports
        </Link>
        <span className="text-gray-200 dark:text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{report.name}</h1>
        {report.isAdminOnly && (
          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded px-1.5 py-0.5">
            admin
          </span>
        )}
      </div>

      {/* Param form */}
      {report.params.length > 0 && (
        <form method="GET" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4">
          <div className="flex flex-wrap gap-4 items-end">
            {report.params.map((p) => (
              <div key={p.name}>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{p.label}</label>
                {p.type === "date" && (
                  <input
                    type="date"
                    name={p.name}
                    defaultValue={(sp[p.name] ?? p.default) as string}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
                {p.type === "number" && (
                  <input
                    type="number"
                    name={p.name}
                    defaultValue={Number(sp[p.name] ?? p.default)}
                    min={p.min}
                    max={p.max}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28"
                  />
                )}
                {p.type === "text" && (
                  <input
                    type="text"
                    name={p.name}
                    defaultValue={(sp[p.name] ?? p.default) as string}
                    placeholder="Optional filter…"
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
                {p.type === "uuid" && (
                  <ProductPicker name={p.name} defaultValue={(sp[p.name] ?? "") as string} />
                )}
              </div>
            ))}
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Run
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error.message}
        </div>
      )}

      {missingRequired ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
          Select an ingredient above and click Run.
        </div>
      ) : (
        <>
          {/* Export + print actions */}
          <ExportButtons slug={slug} params={rpcParams as Record<string, string | number | null>} />

          {/* Table */}
          <ReportTable report={report} rows={rows} />
        </>
      )}
    </div>
  );
}

// Inline client component for product UUID picker (used only for movements-per-product)
import { ProductPickerClient } from "./ProductPickerClient";

function ProductPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  return <ProductPickerClient name={name} defaultValue={defaultValue} />;
}
