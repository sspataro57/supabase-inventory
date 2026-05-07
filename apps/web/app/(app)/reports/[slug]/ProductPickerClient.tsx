"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Product = { id: string; name: string; sku: string };

export function ProductPickerClient({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase
      .from("products")
      .select("id, name, sku")
      .eq("is_archived", false)
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  return (
    <select
      name={name}
      defaultValue={defaultValue}
      required
      className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <option value="">Select product…</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.sku})
        </option>
      ))}
    </select>
  );
}
