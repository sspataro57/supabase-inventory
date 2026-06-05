"use client";

import { useState } from "react";

const INVENTORY_TYPES = ["RM Commercial", "RM Non-Commercial", "Finished Good", "Packaging"];
const ALLERGENS = [
  "Crustacean Shellfish",
  "Eggs",
  "Fish",
  "Milk",
  "None",
  "Peanuts",
  "Sesame",
  "Soy",
  "Tree Nuts",
  "Wheat",
];
const CATEGORIES = [
  "Antifoam",
  "Color",
  "Culture",
  "Dairy",
  "Emulsifier",
  "Enzyme",
  "Fat/Oil/Shortening",
  "Flavor",
  "Nutrient",
  "pH Control Agent",
  "Preservative",
  "Protein",
  "Stabilizer/Thickener",
  "Sweetener",
];

export type RoomOption = { id: string; code: string; name: string };

export type IngredientSuggestions = {
  name: string[];
  manufacturer: string[];
  manufacturer_item_no: string[];
  broker: string[];
  broker_item_no: string[];
  lot_code: string[];
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  rooms: RoomOption[];
  suggestions?: IngredientSuggestions;
};

const pad2 = (n: string) => (n.length === 1 ? `0${n}` : n);

// #142: accept Excel-style short dates (1/7/26, 1-7-2026) and normalize to the
// ISO YYYY-MM-DD the form/schema expects. Returns "" if it can't be parsed, so
// the caller can leave the raw text for the user to correct.
export function normalizeDate(raw: string): string {
  const v = raw.trim();
  if (v === "") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // already ISO
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return "";
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${pad2(String(month))}-${pad2(String(day))}`;
}

const EMPTY_SUGGESTIONS: IngredientSuggestions = {
  name: [],
  manufacturer: [],
  manufacturer_item_no: [],
  broker: [],
  broker_item_no: [],
  lot_code: [],
};

export function NewIngredientForm({ action, rooms, suggestions = EMPTY_SUGGESTIONS }: Props) {
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

      {/* #141: autocomplete suggestions from previously entered values */}
      <SuggestionList id="dl-name" options={suggestions.name} />
      <SuggestionList id="dl-manufacturer" options={suggestions.manufacturer} />
      <SuggestionList id="dl-manufacturer_item_no" options={suggestions.manufacturer_item_no} />
      <SuggestionList id="dl-broker" options={suggestions.broker} />
      <SuggestionList id="dl-broker_item_no" options={suggestions.broker_item_no} />
      <SuggestionList id="dl-lot_code" options={suggestions.lot_code} />

      <Section title="Ingredient">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Inventory type">
            <Select name="inventory_type" options={INVENTORY_TYPES} placeholder="— select —" />
          </Field>
          <Field label="RM#" required>
            <input name="sku" required className={input} placeholder="RM-001" />
          </Field>
          <Field label="Name" required>
            <input name="name" required list="dl-name" autoComplete="off" className={input} placeholder="All-Purpose Flour" />
          </Field>
          <Field label="Manufacturer">
            <input name="manufacturer" list="dl-manufacturer" autoComplete="off" className={input} />
          </Field>
          <Field label="Manufacturer item #">
            <input name="manufacturer_item_no" list="dl-manufacturer_item_no" autoComplete="off" className={input} />
          </Field>
          <Field label="Broker">
            <input name="broker" list="dl-broker" autoComplete="off" className={input} />
          </Field>
          <Field label="Broker item #">
            <input name="broker_item_no" list="dl-broker_item_no" autoComplete="off" className={input} />
          </Field>
          <Field label="Allergen">
            <Select name="allergen" options={ALLERGENS} placeholder="— select —" />
          </Field>
          <Field label="Category">
            <Select name="category" options={CATEGORIES} placeholder="— select —" />
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
              <option value="__OTHER__">Other…</option>
            </select>
          </Field>
          {roomId !== "__OTHER__" && (
            <>
              <Field label="Shelf">
                <input
                  name="shelf"
                  maxLength={1}
                  pattern="[A-Za-z]"
                  value={shelf}
                  onChange={(e) => setShelf(e.target.value.toUpperCase())}
                  className={input}
                  placeholder="A"
                />
              </Field>
              <Field label="Level">
                <input
                  name="level"
                  type="number"
                  min={1}
                  max={99}
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className={input}
                  placeholder="4"
                />
              </Field>
              <Field label="Spot">
                <input
                  name="spot"
                  type="number"
                  min={1}
                  max={99}
                  value={spot}
                  onChange={(e) => setSpot(e.target.value)}
                  className={input}
                  placeholder="2"
                />
              </Field>
            </>
          )}
        </div>
        {roomId === "__OTHER__" && (
          <div className="mt-3">
            <Field label="Describe location" required>
              <input
                name="custom_location_text"
                required
                className={input}
                placeholder="developer desk, R&D Kitchen, laboratory…"
                maxLength={120}
              />
            </Field>
          </div>
        )}
        {codePreview && roomId !== "__OTHER__" && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Sub-location code: <span className="font-mono">{codePreview}</span>
          </p>
        )}
      </Section>

      <Section title="Received lot">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Lot Code">
            <input name="lot_code" list="dl-lot_code" autoComplete="off" className={input} />
          </Field>
          <Field label="Date received" required>
            <SmartDateField name="date_received" required defaultValue={today} />
          </Field>
          <Field label="Manufacture date">
            <SmartDateField name="manufacture_date" />
          </Field>
          <Field label="Expiration date">
            <SmartDateField name="expiration_date" />
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

function SuggestionList({ id, options }: { id: string; options: string[] }) {
  if (options.length === 0) return null;
  return (
    <datalist id={id}>
      {options.map((opt) => (
        <option key={opt} value={opt} />
      ))}
    </datalist>
  );
}

/**
 * #142: a date field that accepts Excel-style short dates. The user can type
 * "1/7/26" (or 1-7-2026, or a full YYYY-MM-DD); on blur it normalizes to ISO
 * (2026-01-07). The posted value is whatever the input holds after the blur
 * normalization, and the Zod schema validates YYYY-MM-DD server-side.
 */
function SmartDateField({
  name,
  required,
  defaultValue = "",
}: {
  name: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input
        name={name}
        required={required}
        value={value}
        inputMode="numeric"
        placeholder="MM/DD/YY or YYYY-MM-DD"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const norm = normalizeDate(value);
          if (norm) setValue(norm);
        }}
        className={input}
      />
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">e.g. 1/7/26 → 2026-01-07</p>
    </>
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
