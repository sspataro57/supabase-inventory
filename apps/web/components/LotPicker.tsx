"use client";

import { useState } from "react";

type LotOption = {
  id: string;
  lot_code: string;
  expires_on: string | null;
  received_on: string;
  base_on_hand: number;
  on_hand_display: string;
};

type Props = {
  lots: LotOption[];
  defaultLotId?: string;
  required?: boolean;
};

export function LotPicker({ lots, defaultLotId, required }: Props) {
  const [selected, setSelected] = useState(defaultLotId ?? "");
  const [showNew, setShowNew] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <select
          name="lot_id"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setShowNew(false);
          }}
          required={required && !showNew}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">— Select lot —</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.lot_code}
              {l.expires_on ? ` · exp ${l.expires_on}` : ""}
              {` · ${l.on_hand_display} on hand`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setShowNew(true);
            setSelected("");
          }}
          className="text-sm text-indigo-600 hover:underline shrink-0"
        >
          + New lot
        </button>
      </div>

      {showNew && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 space-y-2">
          <input type="hidden" name="lot_id" value="" />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Lot code</label>
              <input
                name="new_lot_code"
                type="text"
                required={showNew}
                placeholder="e.g. LOT-2026-001"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Expires on</label>
              <input
                name="new_lot_expires"
                type="date"
                min={today}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(false)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Cancel new lot
          </button>
        </div>
      )}
    </div>
  );
}
