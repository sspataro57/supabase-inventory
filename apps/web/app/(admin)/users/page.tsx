import { createClient } from "@/lib/supabase/server";
import { setUserRole, setUserActive } from "./actions";

export default async function UsersPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, is_active, created_at")
    .order("email");

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-6">Users</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
        {users?.map((u) => (
          <div key={u.id} className="px-4 py-3 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                {u.display_name ?? u.email}
              </p>
              {u.display_name && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.email}</p>
              )}
            </div>

            <span
              className={`text-xs font-medium rounded px-2 py-0.5 ${
                u.role === "admin"
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              {u.role}
            </span>

            {!u.is_active && (
              <span className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded px-2 py-0.5">
                inactive
              </span>
            )}

            {/* Role toggle */}
            <form action={setUserRole} className="shrink-0">
              <input type="hidden" name="user_id" value={u.id} />
              <input
                type="hidden"
                name="role"
                value={u.role === "admin" ? "user" : "admin"}
              />
              <button
                type="submit"
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-50 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Make {u.role === "admin" ? "user" : "admin"}
              </button>
            </form>

            {/* Active toggle */}
            <form action={setUserActive} className="shrink-0">
              <input type="hidden" name="user_id" value={u.id} />
              <input
                type="hidden"
                name="is_active"
                value={u.is_active ? "false" : "true"}
              />
              <button
                type="submit"
                className={`text-xs border rounded px-2 py-1 transition-colors ${
                  u.is_active
                    ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                    : "text-green-600 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                }`}
              >
                {u.is_active ? "Deactivate" : "Activate"}
              </button>
            </form>
          </div>
        ))}

        {!users?.length && (
          <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
            No users found.
          </div>
        )}
      </div>
    </div>
  );
}
