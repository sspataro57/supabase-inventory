"use client";

import { useState } from "react";
import type { ReportParams } from "@/lib/reports/registry";

export function ExportButtons({ slug, params }: { slug: string; params: ReportParams }) {
  const [loading, setLoading] = useState<"csv" | "pdf" | null>(null);

  async function download(type: "csv" | "pdf") {
    setLoading(type);
    try {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== "") qs.set(key, String(value));
      }
      qs.set("format", type);

      const res = await fetch(`/api/reports/${slug}/export?${qs.toString()}`);
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${slug}-${date}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2 print:hidden">
      <button
        onClick={() => window.print()}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        Print
      </button>
      <button
        onClick={() => download("csv")}
        disabled={loading !== null}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {loading === "csv" ? "Generating…" : "⬇ Download CSV"}
      </button>
      <button
        onClick={() => download("pdf")}
        disabled={loading !== null}
        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {loading === "pdf" ? "Generating…" : "⬇ Download PDF"}
      </button>
    </div>
  );
}
