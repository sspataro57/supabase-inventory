import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/ProductForm";
import { updateProduct } from "../../actions";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: units }, { data: barcodes }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase
      .from("units")
      .select("code, display_name, measure_type")
      .eq("is_active", true)
      .order("measure_type")
      .order("display_name"),
    supabase.from("product_codes").select("code, code_type").eq("product_id", id),
  ]);

  if (!product) notFound();

  const action = updateProduct.bind(null, id);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">
        Edit — {product.name}
      </h1>
      <ProductForm
        units={units ?? []}
        defaultValues={{
          sku: product.sku,
          name: product.name,
          description: product.description ?? undefined,
          measure_type: product.measure_type,
          display_unit: product.display_unit ?? undefined,
          pack_size: product.pack_size,
          reorder_point: product.reorder_point,
          reorder_quantity: product.reorder_quantity,
          user_can_check_in: product.user_can_check_in,
          user_can_check_out: product.user_can_check_out,
          barcodes: barcodes ?? [],
        }}
        lockedMeasureType={product.measure_type}
        action={action}
        submitLabel="Save changes"
      />
    </div>
  );
}
