import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { REPORTS } from "@/lib/reports/registry";
import Link from "next/link";

export default async function ReportsPage() {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";

  const visible = REPORTS.filter((r) => !r.isAdminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Reports</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => (
          <Link
            key={r.slug}
            href={`/reports/${r.slug}`}
            className="group block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {r.name}
              </p>
              {r.isAdminOnly && (
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded px-1.5 py-0.5 shrink-0">
                  admin
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
