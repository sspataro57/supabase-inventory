import { NewIngredientForm } from "@/components/NewIngredientForm";
import { createIngredient } from "../actions";

export default function NewIngredientPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">New Ingredient</h1>
      <NewIngredientForm action={createIngredient} />
    </div>
  );
}
