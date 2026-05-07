"use client";

import { useOptimistic, useTransition } from "react";
import { setTheme } from "@/app/(admin)/preferences/theme-action";

type Theme = "light" | "dark" | "system";

export function ThemeToggle({ current }: { current: Theme }) {
  const [optimistic, setOptimistic] = useOptimistic(current);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = optimistic === "dark" ? "light" : "dark";
    startTransition(async () => {
      setOptimistic(next);
      // Flip class immediately for instant feedback
      document.documentElement.classList.toggle("dark", next === "dark");
      await setTheme(next);
    });
  }

  const isDark = optimistic === "dark";

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 dark:text-gray-400">Light</span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${isDark ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-600"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isDark ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
      <span className="text-sm text-gray-500 dark:text-gray-400">Dark</span>
    </div>
  );
}
