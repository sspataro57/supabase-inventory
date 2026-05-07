"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeCameraScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (stopped) return;
        if (result) {
          stopped = true;
          controlsRef.current?.stop();
          onScan(result.getText());
        } else if (err && !(err instanceof NotFoundException)) {
          setError(String(err));
        }
      })
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch((err) => {
        setError(
          err?.name === "NotAllowedError"
            ? "Camera access denied. Allow camera permission and try again."
            : "Camera unavailable: " + String(err)
        );
      });

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, [onScan]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" />
        {/* Aiming overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-32 border-2 border-white/70 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 rounded-full bg-black/50 text-white w-7 h-7 flex items-center justify-center text-sm hover:bg-black/70 transition-colors"
        >
          ✕
        </button>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500">
          Point at any barcode or QR code
        </p>
      )}
    </div>
  );
}
