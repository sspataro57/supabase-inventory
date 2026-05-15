"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { submitMovement } from "@/app/(app)/movements/actions";
import { BarcodeCameraScanner } from "@/components/BarcodeCameraScanner";

type ScanResult = {
  product: {
    id: string;
    name: string;
    sku: string;
    measure_type: string;
    is_archived: boolean;
    can_check_in: boolean;
    can_check_out: boolean;
  };
  stock: { on_hand: string; is_low_stock: boolean };
  units: { code: string; display_name: string }[];
  default_unit: string;
};

type MovementType = "check_in" | "check_out";

export function ScanView() {
  const router = useRouter();
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [movementType, setMovementType] = useState<MovementType>("check_in");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const resolve = useCallback(async (code: string) => {
    setError(null);
    setResult(null);
    setDone(false);
    try {
      const res = await fetch("/api/scan/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const { error: e } = await res.json();
        setError(e ?? "Barcode not found");
        return;
      }
      const data: ScanResult = await res.json();
      setResult(data);
      setUnit(data.default_unit);
      setMovementType(data.product.can_check_in ? "check_in" : "check_out");
    } catch {
      setError("Network error — please try again.");
    }
  }, []);

  async function triggerScan() {
    setError(null);
    // On Capacitor native, window.Capacitor is injected by the runtime
    const isNative =
      typeof window !== "undefined" &&
      !!(window as unknown as Record<string, unknown>).Capacitor;
    if (isNative) {
      setScanning(true);
      try {
        const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
        const { barcodes } = await BarcodeScanner.scan();
        if (barcodes.length > 0) await resolve(barcodes[0].rawValue);
      } catch (e) {
        setError("Scanner unavailable: " + String(e));
      } finally {
        setScanning(false);
      }
      return;
    }
    setCameraOpen(true);
  }

  async function handleCameraScan(code: string) {
    setCameraOpen(false);
    await resolve(code);
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) await resolve(manualCode.trim());
  }

  async function handleMovementSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("product_id", result.product.id);
    fd.set("movement_type", movementType);
    fd.set("quantity", qty);
    fd.set("unit", unit);
    fd.set("reason", reason);
    try {
      await submitMovement(fd);
      setDone(true);
      setResult(null);
      setManualCode("");
      setQty("");
      setReason("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-sm space-y-4">
      {cameraOpen ? (
        <BarcodeCameraScanner
          onScan={handleCameraScan}
          onClose={() => setCameraOpen(false)}
        />
      ) : (
        <button
          onClick={triggerScan}
          disabled={scanning}
          className="w-full rounded-xl bg-indigo-600 px-4 py-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {scanning ? "Scanning…" : "Scan barcode / QR code"}
        </button>
      )}

      <div className="relative flex items-center">
        <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        <span className="mx-3 text-xs text-gray-400 dark:text-gray-500">or enter manually</span>
        <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
      </div>

      {/* Manual entry */}
      <form onSubmit={handleManual} className="flex gap-2">
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Barcode / QR code"
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Look up
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {done && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          Movement recorded successfully.
        </div>
      )}

      {/* Product + movement form */}
      {result && (
        <div className="space-y-4">
          {/* Product card */}
          <div
            className={`rounded-xl border px-4 py-3 ${
              result.stock.is_low_stock ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            }`}
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{result.product.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{result.product.sku}</p>
            <p className={`text-sm font-medium mt-1 ${result.stock.is_low_stock ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-200"}`}>
              On hand: {result.stock.on_hand}
            </p>
          </div>

          {result.product.is_archived && (
            <div className="rounded-lg bg-amber-50 dark:bg-yellow-900/20 border border-amber-200 px-3 py-2 text-xs text-amber-700 dark:text-yellow-300">
              This ingredient is archived — movements may still be recorded.
            </div>
          )}

          <form onSubmit={handleMovementSubmit} className="space-y-3">
            {/* Type toggle */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {result.product.can_check_in && (
                <button
                  type="button"
                  onClick={() => setMovementType("check_in")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    movementType === "check_in" ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  Check in
                </button>
              )}
              {result.product.can_check_out && (
                <button
                  type="button"
                  onClick={() => setMovementType("check_out")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    movementType === "check_out" ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  Check out
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                min="0.0001"
                step="any"
                required
                placeholder="Quantity"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {result.units.map((u) => (
                  <option key={u.code} value={u.code}>{u.code}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {pending ? "Saving…" : movementType === "check_in" ? "Record check-in" : "Record check-out"}
            </button>

            <button
              type="button"
              onClick={() => { setResult(null); setManualCode(""); }}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </form>

          <button
            onClick={() => router.push(`/catalog/${result.product.id}`)}
            className="w-full text-xs text-indigo-600 hover:underline text-center"
          >
            View product details →
          </button>
        </div>
      )}
    </div>
  );
}
