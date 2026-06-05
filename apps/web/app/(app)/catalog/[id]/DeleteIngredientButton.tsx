"use client";

/**
 * #148: Delete an ingredient, with a confirmation safeguard.
 *
 * A hard DELETE is not possible — lots.product_id and movements.product_id
 * reference products ON DELETE RESTRICT, and every ingredient has at least the
 * initial lot + check-in movement. So "delete" is a soft delete (archive): it
 * hides the ingredient from the catalog and can be restored via "Include
 * archived". The confirm dialog prevents accidental deletion.
 */
export function DeleteIngredientButton({
  action,
  name,
}: {
  action: (formData: FormData) => Promise<void>;
  name: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${name}"?\n\nThe ingredient will be archived and hidden from the catalog. ` +
              `You can restore it later with the "Include archived" filter.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        Delete
      </button>
    </form>
  );
}
