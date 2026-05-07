"use client";

import { useState } from "react";
import type { ReportDef } from "@/lib/reports/registry";

const PAGE_SIZE = 100;

type Props = {
  report: ReportDef;
  rows: Record<string, unknown>[];
};

function formatCell(value: unknown, col: { key: string; numeric?: boolean; date?: boolean }): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "—";
  if (col.date && typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-US");
  }
  return String(value);
}

export function ReportTable({ report, rows }: Props) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const columns = report.columns;

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
        No results.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 dark:text-gray-500">{rows.length} rows</p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => !col.key.startsWith("_") && toggleSort(col.key)}
                  className={`px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-gray-200 dark:border-gray-700 ${!col.key.startsWith("_") ? "cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 select-none" : ""} ${col.numeric ? "text-right" : ""}`}
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {pageRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap ${col.numeric ? "text-right font-mono text-xs" : ""}`}
                  >
                    {col.key.startsWith("_") ? "" : formatCell(row[col.key], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
