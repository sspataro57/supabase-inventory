import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revokeToken } from "./actions";
import { TokenGenerator } from "./TokenGenerator";

export default async function McpTokensPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) redirect("/login");

  const { data: tokens } = await supabase
    .from("mcp_tokens")
    .select("id, name, token_prefix, is_revoked, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const mcpUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/mcp`;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">MCP access tokens</h1>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Tokens let external MCP clients (Claude Code, Claude Desktop) query your inventory in read-only mode.
        Each token is shown <span className="font-medium">once</span> — store it securely.
      </p>

      {/* Newly generated token */}
      {sp.token && (
        <div className="mb-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Token generated — copy it now, it won&apos;t be shown again.</p>
          <code className="block text-xs font-mono bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded px-3 py-2 text-gray-900 dark:text-gray-50 break-all">
            {sp.token}
          </code>
          <div className="mt-3 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Add to Claude Code:</p>
            <code className="text-xs text-gray-700 dark:text-gray-200 break-all">
              {`claude mcp add --transport http inventory ${mcpUrl} --header "Authorization: Bearer ${sp.token}"`}
            </code>
          </div>
        </div>
      )}

      {/* Generate new token */}
      <div className="mb-6">
        <TokenGenerator />
      </div>

      {/* Token list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {tokens?.map((t) => (
          <div key={t.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{t.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{t.token_prefix}…</p>
              <p className="text-xs text-gray-300 dark:text-gray-600">
                {t.last_used_at
                  ? `Last used ${new Date(t.last_used_at).toLocaleDateString()}`
                  : "Never used"}
              </p>
            </div>
            {t.is_revoked ? (
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded px-2 py-0.5">revoked</span>
            ) : (
              <form action={revokeToken}>
                <input type="hidden" name="token_id" value={t.id} />
                <button
                  type="submit"
                  className="text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Revoke
                </button>
              </form>
            )}
          </div>
        ))}
        {!tokens?.length && (
          <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No tokens yet.</div>
        )}
      </div>
    </div>
  );
}
