"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * #158: Delete a single chat conversation. chat_messages and chat_tool_calls
 * reference chat_conversations ON DELETE CASCADE, so removing the conversation
 * removes its messages too. RLS ("users can manage own conversations", FOR ALL
 * USING user_id = auth.uid()) already scopes deletes to the owner; the explicit
 * user_id filter is defense-in-depth.
 */
export async function deleteConversation(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}
