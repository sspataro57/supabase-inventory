import { createClient } from "@/lib/supabase/server";
import { NewIngredientForm } from "@/components/NewIngredientForm";
import { createIngredient } from "../actions";

export default async function NewIngredientPage() {
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("locations")
    .select("id, code, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">New Ingredient</h1>
      <NewIngredientForm action={createIngredient} rooms={rooms ?? []} />
    </div>
  );
}
