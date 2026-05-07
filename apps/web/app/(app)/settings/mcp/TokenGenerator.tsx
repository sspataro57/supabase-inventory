"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateToken } from "./actions";

export function TokenGenerator() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const result = await generateToken(fd);
      // Show the token in the URL (safe — it's a PAT, and we redirect to HTTPS in prod)
      router.push(`/preferences?token=${encodeURIComponent(result.rawToken)}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        name="name"
        type="text"
        required
        placeholder="Token name (e.g. Claude Desktop)"
        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
      >
        {pending ? "Generating…" : "Generate"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </form>
  );
}
