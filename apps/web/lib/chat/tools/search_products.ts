import type { ToolDef } from "@/lib/llm/provider";

// Simple LRU for query embedding cache (per-process, 5 min TTL)
const embeddingCache = new Map<string, { vec: number[]; expiresAt: number }>();

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const cached = embeddingCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.vec;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: query }),
    });
    if (!res.ok) return null;
    const { data } = await res.json() as { data: { embedding: number[] }[] };
    const vec = data[0]?.embedding ?? null;
    if (vec) {
      embeddingCache.set(query, { vec, expiresAt: Date.now() + 5 * 60 * 1000 });
      // Evict old entries
      if (embeddingCache.size > 100) {
        const first = embeddingCache.keys().next().value!;
        embeddingCache.delete(first);
      }
    }
    return vec;
  } catch {
    return null;
  }
}

export const searchProductsTool: ToolDef = {
  name: "search_products",
  description: "Search for products by name, SKU, or description. Uses semantic + text search.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for" },
      include_archived: { type: "boolean", description: "Include archived products (default: false)" },
    },
    required: ["query"],
  },
  async handler(input, { supabase }) {
    const { query, include_archived = false } = input as { query: string; include_archived?: boolean };

    // Try hybrid search first
    const queryVec = await getQueryEmbedding(query);
    if (queryVec) {
      const { data, error } = await supabase.rpc("search_products_hybrid", {
        query_text: query,
        query_vec: JSON.stringify(queryVec),
        result_limit: 10,
      });
      if (!error && data?.length > 0) {
        const results = include_archived ? data : data.filter((p: { is_archived: boolean }) => !p.is_archived);
        return { products: results, search_type: "hybrid" };
      }
    }

    // Fallback: simple ilike
    let q = supabase
      .from("products")
      .select("id, sku, name, measure_type, display_unit, is_archived")
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .order("name")
      .limit(10);

    if (!include_archived) q = q.eq("is_archived", false);

    const { data, error } = await q;
    if (error) return { error: error.message };
    return { products: data ?? [], search_type: "text" };
  },
};
