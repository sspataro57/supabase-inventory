import { createClient } from "@/lib/supabase/server";
import { NewIngredientForm } from "@/components/NewIngredientForm";
import { createIngredient } from "../actions";

// #141: distinct existing values feed the New Ingredient autocomplete datalists.
function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ""))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export default async function NewIngredientPage() {
  const supabase = await createClient();
  const [{ data: rooms }, { data: products }, { data: lots }] = await Promise.all([
    supabase.from("locations").select("id, code, name").eq("is_active", true).order("sort_order"),
    supabase
      .from("products")
      .select("name, manufacturer, manufacturer_item_no, broker, broker_item_no")
      .eq("is_archived", false),
    supabase.from("lots").select("lot_code").not("lot_code", "is", null),
  ]);

  const suggestions = {
    name: distinct((products ?? []).map((p) => p.name)),
    manufacturer: distinct((products ?? []).map((p) => p.manufacturer)),
    manufacturer_item_no: distinct((products ?? []).map((p) => p.manufacturer_item_no)),
    broker: distinct((products ?? []).map((p) => p.broker)),
    broker_item_no: distinct((products ?? []).map((p) => p.broker_item_no)),
    lot_code: distinct((lots ?? []).map((l) => l.lot_code)),
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">New Ingredient</h1>
      <NewIngredientForm action={createIngredient} rooms={rooms ?? []} suggestions={suggestions} />
    </div>
  );
}
