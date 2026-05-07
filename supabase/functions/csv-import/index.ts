import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { storage_path, actor_id } = await req.json();
  if (!storage_path || !actor_id) {
    return new Response("Missing storage_path or actor_id", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Download the uploaded CSV
  const { data: fileData, error: downloadErr } = await supabase.storage
    .from("imports")
    .download(storage_path);

  if (downloadErr || !fileData) {
    return new Response(`Failed to download file: ${downloadErr?.message}`, { status: 500 });
  }

  const text = await fileData.text();
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) {
    return new Response("Empty CSV", { status: 400 });
  }

  const headers = parseCSVLine(lines[0]);
  const results: { row: number; sku: string; status: string; error: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

    const sku = row["sku"]?.trim();
    const name = row["name"]?.trim();
    const measure_type = row["measure_type"]?.trim() as "mass" | "volume" | "count";

    if (!sku || !name || !["mass", "volume", "count"].includes(measure_type)) {
      results.push({ row: i, sku: sku ?? "", status: "error", error: "Missing required fields: sku, name, measure_type" });
      continue;
    }

    const productData: Record<string, unknown> = {
      sku,
      name,
      measure_type,
      display_unit: row["display_unit"] || null,
      description: row["description"] || null,
      pack_size: row["pack_size"] ? parseInt(row["pack_size"], 10) : null,
      reorder_point: row["reorder_point"] ? parseFloat(row["reorder_point"]) : null,
      user_can_check_in: row["user_can_check_in"] === "true",
      user_can_check_out: row["user_can_check_out"] === "true",
      is_archived: row["is_archived"] === "true",
    };

    // Remove nulls for cleaner upsert
    Object.keys(productData).forEach((k) => {
      if (productData[k] === null || productData[k] === undefined) delete productData[k];
    });

    const { data: upserted, error: upsertErr } = await supabase
      .from("products")
      .upsert(productData, { onConflict: "sku" })
      .select("id")
      .single();

    if (upsertErr || !upserted) {
      results.push({ row: i, sku, status: "error", error: upsertErr?.message ?? "Unknown error" });
      continue;
    }

    // Handle barcodes (format: "type:code;type:code")
    if (row["barcodes"]) {
      const barcodesRaw = row["barcodes"].split(";").map((b) => b.trim()).filter(Boolean);
      for (const b of barcodesRaw) {
        const colonIdx = b.indexOf(":");
        if (colonIdx < 1) continue;
        const code_type = b.slice(0, colonIdx);
        const code = b.slice(colonIdx + 1);
        await supabase
          .from("product_codes")
          .upsert({ product_id: upserted.id, code, code_type }, { onConflict: "code" });
      }
    }

    // Write audit log
    await supabase.from("audit_log").insert({
      actor_id,
      action: "product.import",
      entity_type: "product",
      entity_id: upserted.id,
      diff: { after: productData },
    });

    results.push({ row: i, sku, status: "ok", error: "" });
  }

  // Save result CSV to storage
  const resultCsv = [
    "row,sku,status,error",
    ...results.map((r) => `${r.row},${csvEsc(r.sku)},${r.status},${csvEsc(r.error)}`),
  ].join("\r\n");

  const resultPath = storage_path.replace("uploads/", "results/") + ".result.csv";
  await supabase.storage.from("imports").upload(resultPath, new Blob([resultCsv], { type: "text/csv" }), { upsert: true });

  const ok = results.filter((r) => r.status === "ok").length;
  const err = results.filter((r) => r.status === "error").length;

  return new Response(JSON.stringify({ ok, error: err, result_path: resultPath }), {
    headers: { "Content-Type": "application/json" },
  });
});

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

function csvEsc(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
