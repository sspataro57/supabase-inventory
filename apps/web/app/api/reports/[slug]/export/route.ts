import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReport, type ReportParams } from "@/lib/reports/registry";
import { PDF_COLUMNS } from "@/lib/reports/pdf/columns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require("@react-pdf/renderer") as { renderToBuffer: (el: unknown) => Promise<Buffer> };
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import Papa from "papaparse";
import React from "react";

async function fetchRows(slug: string, params: ReportParams) {
  const report = getReport(slug);
  if (!report) return { error: new NextResponse("Unknown report", { status: 404 }) };

  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return { error: new NextResponse("Not authenticated", { status: 401 }) };

  if (report.isAdminOnly) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return { error: new NextResponse("Forbidden", { status: 403 }) };
  }

  const rpcParams: Record<string, unknown> = {};
  for (const p of report.params) {
    const val = params[p.name];
    if (val !== null && val !== undefined && val !== "") {
      rpcParams[p.name] = val;
    }
  }

  const { data, error } = await supabase.rpc(report.rpcName as never, rpcParams as never);
  if (error) return { error: new NextResponse(error.message, { status: 400 }) };
  return { report, rows: (data ?? []) as Record<string, unknown>[] };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";

  const reportParams: ReportParams = {};
  for (const [key, value] of url.searchParams) {
    if (key !== "format") reportParams[key] = value;
  }

  const result = await fetchRows(slug, reportParams);
  if (result.error) return result.error;
  const { report, rows } = result;

  const date = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const element = React.createElement(ReportDocument, {
      report,
      rows,
      params: reportParams as Record<string, unknown>,
      generatedAt: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
      columns: PDF_COLUMNS[slug] ?? [],
      isCountSheet: slug === "physical-count-sheet",
    });
    const buffer = await renderToBuffer(element);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-${date}.pdf"`,
      },
    });
  }

  const columns = report.columns.filter((c) => !c.key.startsWith("_"));
  const fields = columns.map((c) => c.key);
  const csv = Papa.unparse({
    fields,
    data: rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const f of fields) out[f] = row[f] ?? "";
      return out;
    }),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${slug}-${date}.csv"`,
    },
  });
}
