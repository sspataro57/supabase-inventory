"use client";

import { useState } from "react";
import { LotPicker } from "./LotPicker";

type UnitOption = { code: string; display_name: string };

type LotOption = {
  id: string;
  lot_code: string;
  expires_on: string | null;
  received_on: string;
  base_on_hand: number;
  on_hand_display: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  measure_type: string;
  user_can_check_in: boolean;
  user_can_check_out: boolean;
};

type Props = {
  product: Product;
  units: UnitOption[];
  defaultUnit: string;
  defaultType?: "check_in" | "check_out";
  isAdmin: boolean;
  onHand: string;
  lots: LotOption[];
  requireLot: boolean;
  defaultLotId?: string;
  action: (formData: FormData) => Promise<void>;
};

export function MovementForm({
  product,
  units,
  defaultUnit,
  defaultType,
  isAdmin,
  onHand,
  lots,
  requireLot,
  defaultLotId,
  action,
}: Props) {
  const [movementType, setMovementType] = useState<"check_in" | "check_out">(
    defaultType ?? "check_in"
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCheckIn = isAdmin || product.user_can_check_in;
  const canCheckOut = isAdmin || product.user_can_check_out;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("movement_type", movementType);
    try {
      await action(fd);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-sm">
      <input type="hidden" name="product_id" value={product.id} />

      {/* Product info */}
      <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-3">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{product.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {product.sku} · on hand: <span className="font-medium text-gray-700 dark:text-gray-200">{onHand}</span>
        </p>
      </div>

      {/* Movement type toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Type</label>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {canCheckIn && (
            <TypeButton
              active={movementType === "check_in"}
              onClick={() => setMovementType("check_in")}
            >
              Check in
            </TypeButton>
          )}
          {canCheckOut && (
            <TypeButton
              active={movementType === "check_out"}
              onClick={() => setMovementType("check_out")}
            >
              Check out
            </TypeButton>
          )}
        </div>
      </div>

      {/* Quantity + unit */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Quantity</label>
        <div className="flex gap-2">
          <input
            name="quantity"
            type="number"
            min="0.0001"
            step="any"
            required
            placeholder="0"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            name="unit"
            defaultValue={defaultUnit}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {u.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lot picker */}
      {(lots.length > 0 || requireLot) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Lot
            {requireLot && <span className="text-red-500 ml-1">*</span>}
            {!requireLot && <span className="text-gray-400 dark:text-gray-500 font-normal"> (optional)</span>}
          </label>
          <LotPicker lots={lots} defaultLotId={defaultLotId} required={requireLot} />
        </div>
      )}

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Reason <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
        </label>
        <input
          name="reason"
          type="text"
          placeholder="e.g. weekly stock count"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {pending
          ? "Saving…"
          : movementType === "check_in"
          ? "Record check-in"
          : "Record check-out"}
      </button>
    </form>
  );
}

function TypeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}
