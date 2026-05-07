"use server";

import { createClient } from "@/lib/supabase/server";
import { getReport } from "@/lib/reports/registry";
import { PDF_COLUMNS } from "@/lib/reports/pdf/columns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require("@react-pdf/renderer") as { renderToBuffer: (el: unknown) => Promise<Buffer> };
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import Papa from "papaparse";
import type { ReportParams } from "@/lib/reports/registry";
import React from "react";

async function fetchRows(slug: string, params: ReportParams) {
  const report = getReport(slug);
  if (!report) throw new Error("Unknown report");

  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  if (report.isAdminOnly) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") throw new Error("Forbidden");
  }

  const rpcParams: Record<string, unknown> = {};
  for (const p of report.params) {
    const val = params[p.name];
    if (val !== null && val !== undefined && val !== "") {
      rpcParams[p.name] = val;
    }
  }

  const { data, error } = await supabase.rpc(report.rpcName as never, rpcParams as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

export async function exportCsv(slug: string, params: ReportParams): Promise<Response> {
  const report = getReport(slug);
  if (!report) throw new Error("Unknown report");

  const rows = await fetchRows(slug, params);
  const columns = report.columns.filter((c) => !c.key.startsWith("_"));
  const fields = columns.map((c) => c.key);
  const headers: Record<string, string> = {};
  for (const c of columns) headers[c.key] = c.label;

  const csv = Papa.unparse({
    fields,
    data: rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const f of fields) out[f] = row[f] ?? "";
      return out;
    }),
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${slug}-${date}.csv"`,
    },
  });
}

export async function exportPdf(slug: string, params: ReportParams): Promise<Response> {
  const report = getReport(slug);
  if (!report) throw new Error("Unknown report");

  const rows = await fetchRows(slug, params);
  const columns = PDF_COLUMNS[slug] ?? [];
  const generatedAt = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const element = React.createElement(ReportDocument, {
    report,
    rows,
    params: params as Record<string, unknown>,
    generatedAt,
    columns,
    isCountSheet: slug === "physical-count-sheet",
  });

  const buffer = await renderToBuffer(element);
  const uint8 = new Uint8Array(buffer);

  const date = new Date().toISOString().slice(0, 10);
  return new Response(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}-${date}.pdf"`,
    },
  });
}
