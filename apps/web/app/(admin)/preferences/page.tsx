import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { updatePreferences } from "./actions";
import { revokeToken } from "@/app/(app)/settings/mcp/actions";
import { TokenGenerator } from "@/app/(app)/settings/mcp/TokenGenerator";
import { LLMSection } from "./LLMSection";
import { ThemeToggle } from "@/components/ThemeToggle";

const inputClass =
  "rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";

function masked(key: string | null | undefined): string | null {
  if (!key || key.length < 8) return null;
  return key.slice(0, 10) + "••••••••••••••••";
}

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) redirect("/login");

  const service = createServiceClient();

  const [{ data: prefs }, { data: units }, { data: tokens }, { data: profile }] = await Promise.all([
    service.from("preferences").select("*").eq("id", 1).single(),
    supabase.from("units").select("code, display_name, measure_type").eq("is_active", true).order("display_name"),
    supabase.from("mcp_tokens").select("id, name, token_prefix, is_revoked, last_used_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("theme").eq("id", user.id).single(),
  ]);

  const massUnits = (units ?? []).filter((u) => u.measure_type === "mass");
  const volumeUnits = (units ?? []).filter((u) => u.measure_type === "volume");
  const countUnits = (units ?? []).filter((u) => u.measure_type === "count");

  const currentProvider = prefs?.default_llm_provider ?? "openai";
  const mcpUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"}/api/mcp`;

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Preferences</h1>

      <form action={updatePreferences} className="space-y-6">

        {/* Default display units */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Default display units</h2>
          <div className="space-y-3">
            {[
              { label: "Mass", name: "default_unit_mass", units: massUnits, def: prefs?.default_unit_mass ?? "g" },
              { label: "Volume", name: "default_unit_volume", units: volumeUnits, def: prefs?.default_unit_volume ?? "ml" },
              { label: "Count", name: "default_unit_count", units: countUnits, def: prefs?.default_unit_count ?? "ea" },
            ].map(({ label, name, units: opts, def }) => (
              <div key={name} className="flex items-center gap-3">
                <label className="text-sm text-gray-500 dark:text-gray-400 w-16 shrink-0">{label}</label>
                <select name={name} defaultValue={def} className={inputClass}>
                  {opts.map((u) => (
                    <option key={u.code} value={u.code}>{u.display_name} ({u.code})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* Inventory */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Inventory</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="require_lot_per_movement" value="true"
                defaultChecked={prefs?.require_lot_per_movement ?? false}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm text-gray-700 dark:text-gray-200">Require lot on every movement</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="low_stock_check_enabled" value="true"
                defaultChecked={prefs?.low_stock_check_enabled ?? true}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm text-gray-700 dark:text-gray-200">Low-stock alerts enabled</span>
            </label>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 dark:text-gray-400 w-36 shrink-0">Audit retention (days)</label>
              <input type="number" name="audit_retention_days"
                defaultValue={prefs?.audit_retention_days ?? 365} min="30" max="3650" className={inputClass} />
            </div>
          </div>
        </section>

        {/* AI / Chat */}
        <LLMSection
          currentProvider={currentProvider}
          maskedOpenai={masked(prefs?.openai_api_key)}
          maskedAnthropic={masked(prefs?.anthropic_api_key)}
          maskedCustomKey={masked(prefs?.custom_llm_api_key)}
          customUrl={prefs?.custom_llm_url ?? ""}
          defaultModel={prefs?.default_llm_model ?? ""}
          dailyLimit={prefs?.chat_daily_message_limit ?? 50}
        />

        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
        >
          Save preferences
        </button>
      </form>

      {/* Appearance */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Appearance</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-200">Dark mode</span>
            <ThemeToggle current={(profile?.theme as "light" | "dark" | "system") ?? "system"} />
          </div>
        </div>
      </section>

      {/* MCP / API Tokens */}
      <section>
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">MCP access tokens</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tokens let external MCP clients (Claude Code, Claude Desktop) query your inventory read-only.
            Each token is shown <span className="font-medium">once</span>.
          </p>

          {/* Newly generated token */}
          {sp.token && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
              <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-2">Copy now — won&apos;t be shown again.</p>
              <code className="block text-xs font-mono bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded px-3 py-2 text-gray-900 dark:text-gray-50 break-all">
                {sp.token}
              </code>
              <div className="mt-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Add to Claude Code:</p>
                <code className="text-xs text-gray-700 dark:text-gray-200 break-all">
                  {`claude mcp add --transport http inventory ${mcpUrl} --header "Authorization: Bearer ${sp.token}"`}
                </code>
              </div>
            </div>
          )}

          <TokenGenerator />

          {/* Token list */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {tokens?.map((t) => (
              <div key={t.id} className="py-2 flex items-center gap-3">
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
                    <button type="submit"
                      className="text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      Revoke
                    </button>
                  </form>
                )}
              </div>
            ))}
            {!tokens?.length && (
              <p className="py-4 text-sm text-gray-400 dark:text-gray-500">No tokens yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
