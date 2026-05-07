"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductFormValues } from "@inventory/shared/schemas/products";

type UnitOption = { code: string; display_name: string; measure_type: string };

type Props = {
  units: UnitOption[];
  defaultValues?: Partial<ProductFormValues> & { id?: string };
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  /** On edit, measure_type is locked to this value */
  lockedMeasureType?: string;
};

export function ProductForm({ units, defaultValues, action, submitLabel, lockedMeasureType }: Props) {
  const [measureType, setMeasureType] = useState<string>(
    lockedMeasureType ?? defaultValues?.measure_type ?? "mass"
  );
  const [barcodes, setBarcodes] = useState<{ code: string; code_type: string }[]>(
    defaultValues?.barcodes ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const filteredUnits = units.filter((u) => u.measure_type === measureType);

  function addBarcode() {
    setBarcodes((b) => [...b, { code: "", code_type: "barcode" }]);
  }
  function removeBarcode(i: number) {
    setBarcodes((b) => b.filter((_, idx) => idx !== i));
  }
  function updateBarcode(i: number, field: "code" | "code_type", value: string) {
    setBarcodes((b) => b.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("barcodes", JSON.stringify(barcodes));
    fd.set("user_can_check_in", fd.get("user_can_check_in") ? "true" : "false");
    fd.set("user_can_check_out", fd.get("user_can_check_out") ? "true" : "false");
    try {
      await action(fd);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* SKU + Name */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU" required>
          <input
            name="sku"
            required
            defaultValue={defaultValues?.sku}
            className={input}
            placeholder="FLOUR-001"
          />
        </Field>
        <Field label="Name" required>
          <input
            name="name"
            required
            defaultValue={defaultValues?.name}
            className={input}
            placeholder="All-Purpose Flour"
          />
        </Field>
      </div>

      {/* Description */}
      <Field label="Description">
        <textarea
          name="description"
          defaultValue={defaultValues?.description}
          rows={2}
          className={input}
        />
      </Field>

      {/* Measure type */}
      <Field label="Measure type" required>
        {lockedMeasureType ? (
          <>
            <input type="hidden" name="measure_type" value={lockedMeasureType} />
            <span className="text-sm text-gray-700 dark:text-gray-200 capitalize">{lockedMeasureType}</span>
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(cannot change after creation)</span>
          </>
        ) : (
          <select
            name="measure_type"
            value={measureType}
            onChange={(e) => setMeasureType(e.target.value)}
            className={input}
          >
            <option value="mass">Mass</option>
            <option value="volume">Volume</option>
            <option value="count">Count</option>
          </select>
        )}
      </Field>

      {/* Display unit */}
      <Field label="Display unit">
        <select
          name="display_unit"
          defaultValue={defaultValues?.display_unit ?? ""}
          className={input}
        >
          <option value="">— inherit from preferences —</option>
          {filteredUnits.map((u) => (
            <option key={u.code} value={u.code}>
              {u.display_name} ({u.code})
            </option>
          ))}
        </select>
      </Field>

      {/* Pack size (count only) */}
      {measureType === "count" && (
        <Field label="Pack size (units per case)">
          <input
            name="pack_size"
            type="number"
            min="1"
            step="1"
            defaultValue={defaultValues?.pack_size ?? ""}
            className={input}
            placeholder="e.g. 24"
          />
        </Field>
      )}

      {/* Reorder point / quantity */}
      <div className="grid grid-cols-3 gap-4">
        <Field label="Reorder point">
          <input
            name="reorder_point"
            type="number"
            min="0"
            step="any"
            defaultValue={defaultValues?.reorder_point ?? ""}
            className={input}
          />
        </Field>
        <Field label="Reorder quantity">
          <input
            name="reorder_quantity"
            type="number"
            min="0"
            step="any"
            defaultValue={defaultValues?.reorder_quantity ?? ""}
            className={input}
          />
        </Field>
        <Field label="In unit">
          <select name="reorder_unit" className={input} defaultValue={defaultValues?.display_unit ?? ""}>
            <option value="">— base —</option>
            {filteredUnits.map((u) => (
              <option key={u.code} value={u.code}>
                {u.code}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Transaction permissions */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-200">Users can transact</legend>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            name="user_can_check_in"
            defaultChecked={defaultValues?.user_can_check_in}
            className="rounded"
          />
          Check in (receive)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            name="user_can_check_out"
            defaultChecked={defaultValues?.user_can_check_out}
            className="rounded"
          />
          Check out (consume)
        </label>
      </fieldset>

      {/* Barcodes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Barcodes / codes</span>
          <button
            type="button"
            onClick={addBarcode}
            className="text-sm text-indigo-600 hover:underline"
          >
            + Add
          </button>
        </div>
        {barcodes.map((b, i) => (
          <div key={i} className="flex gap-2">
            <select
              value={b.code_type}
              onChange={(e) => updateBarcode(i, "code_type", e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 w-28"
            >
              <option value="barcode">Barcode</option>
              <option value="qr">QR</option>
              <option value="sku">SKU</option>
            </select>
            <input
              value={b.code}
              onChange={(e) => updateBarcode(i, "code", e.target.value)}
              placeholder="Code value"
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700"
            />
            <button
              type="button"
              onClick={() => removeBarcode(i)}
              className="text-gray-400 dark:text-gray-500 hover:text-red-500 px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const input =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
