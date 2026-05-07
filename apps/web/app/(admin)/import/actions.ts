"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";

type RowResult = { row: number; sku: string; status: "ok" | "error"; error: string };

export async function uploadImport(formData: FormData) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");

  const file = formData.get("file") as File | null;
  if (!file || !file.name.endsWith(".csv")) throw new Error("Please select a CSV file.");

  const text = await file.text();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV is empty or has no data rows.");

  const headers = parseCSVLine(lines[0]);
  const results: RowResult[] = [];

  const service = createServiceClient();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = values[idx]?.trim() ?? ""; });

    const sku = row["sku"];
    const name = row["name"];
    const measure_type = row["measure_type"] as "mass" | "volume" | "count";

    if (!sku || !name || !["mass", "volume", "count"].includes(measure_type)) {
      results.push({ row: i, sku: sku ?? "", status: "error", error: "Missing required fields: sku, name, measure_type" });
      continue;
    }

    const productData: Record<string, unknown> = { sku, name, measure_type };
    if (row["display_unit"]) productData.display_unit = row["display_unit"];
    if (row["description"]) productData.description = row["description"];
    if (row["pack_size"]) productData.pack_size = parseInt(row["pack_size"], 10);
    if (row["reorder_point"]) productData.reorder_point = parseFloat(row["reorder_point"]);
    if (row["user_can_check_in"]) productData.user_can_check_in = row["user_can_check_in"] === "true";
    if (row["user_can_check_out"]) productData.user_can_check_out = row["user_can_check_out"] === "true";
    if (row["is_archived"]) productData.is_archived = row["is_archived"] === "true";

    const { data: upserted, error: upsertErr } = await service
      .from("products")
      .upsert(productData, { onConflict: "sku" })
      .select("id")
      .single();

    if (upsertErr || !upserted) {
      results.push({ row: i, sku, status: "error", error: upsertErr?.message ?? "Unknown error" });
      continue;
    }

    // Barcodes: "type:code;type:code"
    if (row["barcodes"]) {
      for (const b of row["barcodes"].split(";").map(s => s.trim()).filter(Boolean)) {
        const colonIdx = b.indexOf(":");
        if (colonIdx < 1) continue;
        await service.from("product_codes").upsert(
          { product_id: upserted.id, code_type: b.slice(0, colonIdx), code: b.slice(colonIdx + 1) },
          { onConflict: "code" }
        );
      }
    }

    await service.from("audit_log").insert({
      actor_id: user.id,
      action: "product.import",
      entity_type: "product",
      entity_id: upserted.id,
      diff: { after: productData },
    });

    results.push({ row: i, sku, status: "ok", error: "" });
  }

  const okCount = results.filter(r => r.status === "ok").length;
  const errCount = results.filter(r => r.status === "error").length;

  // Store result CSV in session via search params summary; full details via storage if needed
  const resultParam = encodeURIComponent(JSON.stringify(results.filter(r => r.status === "error").slice(0, 20)));

  redirect(`/import?ok=${okCount}&errors=${errCount}&details=${resultParam}`);
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
