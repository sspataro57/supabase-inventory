"use client";

import Link from "next/link";
import { deleteConversation } from "./actions";

/**
 * #158: one chat list row — a link to the conversation plus a delete button
 * with a confirmation safeguard. The delete <form> is a sibling of the <Link>
 * (not nested) so clicking delete never triggers navigation.
 */
export function ConversationRow({
  id,
  title,
  updatedAt,
}: {
  id: string;
  title: string | null;
  updatedAt: string;
}) {
  return (
    <div className="flex items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <Link href={`/chat/${id}`} className="flex items-center justify-between px-4 py-3 flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-gray-50 truncate flex-1">
          {title ?? "Untitled conversation"}
        </p>
        <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0 ml-3">
          {new Date(updatedAt).toLocaleDateString()}
        </span>
      </Link>
      <form
        action={deleteConversation.bind(null, id)}
        onSubmit={(e) => {
          if (!window.confirm("Delete this chat? This cannot be undone.")) {
            e.preventDefault();
          }
        }}
        className="pr-3 pl-1 shrink-0"
      >
        <button
          type="submit"
          aria-label="Delete chat"
          title="Delete chat"
          className="rounded-lg px-2 py-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          🗑
        </button>
      </form>
    </div>
  );
}
