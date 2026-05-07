import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/ProductForm";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: units } = await supabase
    .from("units")
    .select("code, display_name, measure_type")
    .eq("is_active", true)
    .order("measure_type")
    .order("display_name");

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">New product</h1>
      <ProductForm
        units={units ?? []}
        action={createProduct}
        submitLabel="Create product"
      />
    </div>
  );
}
