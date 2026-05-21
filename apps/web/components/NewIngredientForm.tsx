"use client";

import { useState } from "react";

const INVENTORY_TYPES = ["Raw Material", "Packaging", "Finished Good"];
const ALLERGENS = [
  "None",
  "Wheat",
  "Egg",
  "Milk",
  "Soy",
  "Tree Nuts",
  "Peanuts",
  "Fish",
  "Shellfish",
  "Sesame",
];
const CATEGORIES = ["Flour", "Sugar", "Oil", "Dairy", "Spice", "Liquid", "Other"];

export type RoomOption = { id: string; code: string; name: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  rooms: RoomOption[];
};

const pad2 = (n: string) => (n.length === 1 ? `0${n}` : n);

export function NewIngredientForm({ action, rooms }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [roomId, setRoomId] = useState<string>("");
  const [shelf, setShelf] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [spot, setSpot] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const codePreview =
    selectedRoom && shelf && level && spot
      ? `${selectedRoom.code}-${shelf.toUpperCase()}-${pad2(level)}-${pad2(spot)}`
      : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await action(new FormData(e.currentTarget));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <Section title="Ingredient">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Inventory type">
            <Select name="inventory_type" options={INVENTORY_TYPES} placeholder="— select —" />
          </Field>
          <Field label="RM#" required>
            <input name="sku" required className={input} placeholder="RM-001" />
          </Field>
          <Field label="Name" required>
            <input name="name" required className={input} placeholder="All-Purpose Flour" />
          </Field>
          <Field label="Category">
            <Select name="category" options={CATEGORIES} placeholder="— select —" />
          </Field>
          <Field label="Allergen">
            <Select name="allergen" options={ALLERGENS} placeholder="— select —" />
          </Field>
          <Field label="Manufacturer">
            <input name="manufacturer" className={input} />
          </Field>
          <Field label="Manufacturer item #">
            <input name="manufacturer_item_no" className={input} />
          </Field>
          <Field label="Broker">
            <input name="broker" className={input} />
          </Field>
          <Field label="Broker item #">
            <input name="broker_item_no" className={input} />
          </Field>
        </div>
      </Section>

      <Section title="Location">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Field label="Room" required>
            <select
              name="room_id"
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={input}
            >
              <option value="">— select —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shelf" required>
            <input
              name="shelf"
              required
              maxLength={1}
              pattern="[A-Za-z]"
              value={shelf}
              onChange={(e) => setShelf(e.target.value.toUpperCase())}
              className={input}
              placeholder="A"
            />
          </Field>
          <Field label="Level" required>
            <input
              name="level"
              type="number"
              min={1}
              max={99}
              required
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={input}
              placeholder="4"
            />
          </Field>
          <Field label="Spot" required>
            <input
              name="spot"
              type="number"
              min={1}
              max={99}
              required
              value={spot}
              onChange={(e) => setSpot(e.target.value)}
              className={input}
              placeholder="2"
            />
          </Field>
        </div>
        {codePreview && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Sub-location code: <span className="font-mono">{codePreview}</span>
          </p>
        )}
      </Section>

      <Section title="Received lot">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Lot Code" required>
            <input name="lot_code" required className={input} />
          </Field>
          <Field label="Date received" required>
            <input name="date_received" type="date" required defaultValue={today} className={input} />
          </Field>
          <Field label="Manufacture date">
            <input name="manufacture_date" type="date" className={input} />
          </Field>
          <Field label="Expiration date">
            <input name="expiration_date" type="date" className={input} />
          </Field>
          <Field label="Amount received (oz)" required>
            <input
              name="amount_received_oz"
              type="number"
              min="0"
              step="any"
              required
              className={input}
              placeholder="e.g. 32"
            />
          </Field>
        </div>
      </Section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving…" : "Create ingredient"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</legend>
      {children}
    </fieldset>
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

function Select({
  name,
  options,
  placeholder,
}: {
  name: string;
  options: string[];
  placeholder: string;
}) {
  return (
    <select name={name} className={input} defaultValue="">
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

const input =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
