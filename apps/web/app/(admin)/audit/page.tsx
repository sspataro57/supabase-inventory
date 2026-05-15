import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

const ENTITY_LINK: Record<string, (id: string) => string> = {
  product: (id) => `/catalog/${id}`,
};

const ACTION_COLOR: Record<string, string> = {
  "product.create": "text-green-700 bg-green-50",
  "product.update": "text-blue-700 bg-blue-50",
  "product.archive": "text-amber-700 bg-amber-50",
  "user.role_change": "text-purple-700 bg-purple-50",
};

type SearchParams = {
  page?: string;
  entity_type?: string;
  actor?: string;
  from?: string;
  to?: string;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const entityType = sp.entity_type ?? "";
  const actorFilter = sp.actor ?? "";
  const fromDate = sp.from ?? "";
  const toDate = sp.to ?? "";

  const supabase = await createClient();

  // Build query
  let query = supabase
    .from("audit_log")
    .select("id, actor_id, action, entity_type, entity_id, diff, occurred_at, profiles!actor_id(email, display_name)", {
      count: "exact",
    })
    .order("occurred_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (entityType) query = query.eq("entity_type", entityType);
  if (fromDate) query = query.gte("occurred_at", fromDate);
  if (toDate) query = query.lte("occurred_at", toDate + "T23:59:59Z");
  if (actorFilter) query = query.eq("actor_id", actorFilter);

  const { data: entries, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Actor list for filter dropdown (admin only — RLS already guards this)
  const { data: actors } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .eq("is_active", true)
    .order("email");

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (entityType) params.set("entity_type", entityType);
    if (actorFilter) params.set("actor", actorFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    params.set("page", String(p));
    return `/audit?${params.toString()}`;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">Audit log</h1>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <select
          name="entity_type"
          defaultValue={entityType}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All types</option>
          <option value="product">Ingredient</option>
          <option value="lot">Lot</option>
          <option value="preferences">Preferences</option>
          <option value="profile">Profile</option>
        </select>

        <select
          name="actor"
          defaultValue={actorFilter}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All users</option>
          {actors?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name ?? a.email}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="from"
          defaultValue={fromDate}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="date"
          name="to"
          defaultValue={toDate}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Filter
        </button>
        {(entityType || actorFilter || fromDate || toDate) && (
          <Link
            href="/audit"
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Count */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        {count ?? 0} {(count ?? 0) === 1 ? "entry" : "entries"}
        {page > 1 && ` — page ${page} of ${totalPages}`}
      </p>

      {/* Table */}
      {!entries?.length ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
          No audit entries match the current filters.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {entries.map((entry) => {
            const rawActor = entry.profiles as { email: string; display_name: string | null } | { email: string; display_name: string | null }[] | null;
            const actor = Array.isArray(rawActor) ? rawActor[0] ?? null : rawActor;
            const entityLink = ENTITY_LINK[entry.entity_type]?.(entry.entity_id ?? "");
            const actionStyle = ACTION_COLOR[entry.action] ?? "text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700";
            const diff = entry.diff as { before: unknown; after: unknown } | null;

            return (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Action badge */}
                  <span
                    className={`text-xs font-medium rounded px-2 py-0.5 shrink-0 ${actionStyle}`}
                  >
                    {entry.action}
                  </span>

                  {/* Entity */}
                  <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
                    {entry.entity_type}
                    {entry.entity_id && (
                      <>
                        {" "}
                        {entityLink ? (
                          <Link
                            href={entityLink}
                            className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {entry.entity_id.slice(0, 8)}…
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                            {entry.entity_id.slice(0, 8)}…
                          </span>
                        )}
                      </>
                    )}
                  </span>

                  <div className="flex-1" />

                  {/* Actor */}
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {actor?.display_name ?? actor?.email ?? "system"}
                  </span>

                  {/* Time */}
                  <time
                    dateTime={entry.occurred_at}
                    className="text-xs text-gray-300 dark:text-gray-600 shrink-0"
                    title={new Date(entry.occurred_at).toISOString()}
                  >
                    {new Date(entry.occurred_at).toLocaleString()}
                  </time>
                </div>

                {/* Diff — collapsible, no JS needed */}
                {diff && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
                      Show diff
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {diff.before !== null && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Before</p>
                          <pre className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-x-auto text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                            {JSON.stringify(diff.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {diff.after !== null && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">After</p>
                          <pre className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-x-auto text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                            {JSON.stringify(diff.after, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          {page > 1 ? (
            <Link
              href={pageUrl(page - 1)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ← Previous
            </Link>
          ) : (
            <div />
          )}
          <span className="text-sm text-gray-400 dark:text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageUrl(page + 1)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Next →
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  );
}
