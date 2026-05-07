import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import crypto from "crypto";

const BATCH_SIZE = 100;

export async function GET(req: NextRequest) {
  // Vercel cron sends this header; for manual runs skip the check
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const rebuildAll = req.nextUrl.searchParams.get("rebuild") === "1";

  let productIds: string[];

  if (rebuildAll) {
    const { data } = await supabase.from("products").select("id");
    productIds = (data ?? []).map((p) => p.id);
    // Enqueue all
    if (productIds.length > 0) {
      await supabase.from("embedding_queue").upsert(
        productIds.map((id) => ({ product_id: id })),
        { onConflict: "product_id" }
      );
    }
  }

  // Pull queued items
  const { data: queued } = await supabase
    .from("embedding_queue")
    .select("product_id")
    .order("queued_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (!queued?.length) {
    return NextResponse.json({ processed: 0, message: "Queue empty" });
  }

  const ids = queued.map((q) => q.product_id);
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, description")
    .in("id", ids);

  if (!products?.length) {
    return NextResponse.json({ processed: 0 });
  }

  // Compute source hashes to avoid redundant API calls
  const texts = products.map((p) =>
    `${p.name} ${p.sku} ${p.description ?? ""}`.trim()
  );

  const hashes = texts.map((t) => crypto.createHash("sha256").update(t).digest("hex"));

  // Check which need updating
  const { data: existing } = await supabase
    .from("products")
    .select("id, embedding_source_hash")
    .in("id", products.map((p) => p.id));

  const existingHashMap = new Map((existing ?? []).map((e) => [e.id, e.embedding_source_hash]));
  const toEmbed = products.filter((p, i) => existingHashMap.get(p.id) !== hashes[i]);

  let processed = 0;

  if (toEmbed.length > 0 && process.env.OPENAI_API_KEY) {
    const textsToEmbed = toEmbed.map((p) =>
      `${p.name} ${p.sku} ${p.description ?? ""}`.trim()
    );

    // Batch embed
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: textsToEmbed,
      }),
    });

    if (res.ok) {
      const { data: embeddings } = await res.json() as { data: { embedding: number[] }[] };

      for (let i = 0; i < toEmbed.length; i++) {
        const product = toEmbed[i];
        const embedding = embeddings[i]?.embedding;
        if (!embedding) continue;

        await supabase.from("products").update({
          embedding: JSON.stringify(embedding),
          embedding_source_hash: hashes[products.indexOf(product)],
          embedding_updated_at: new Date().toISOString(),
        }).eq("id", product.id);

        processed++;
      }
    }
  }

  // Clear processed items from queue
  await supabase.from("embedding_queue").delete().in("product_id", ids);

  return NextResponse.json({ processed, queued: queued.length });
}
