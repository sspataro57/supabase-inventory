import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatThread } from "@/components/ChatThread";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) redirect("/login");

  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select("id, title, user_id")
      .eq("id", id)
      .single(),
    supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!conversation || conversation.user_id !== user.id) notFound();

  return (
    <ChatThread
      conversationId={conversation.id}
      initialMessages={(messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content ?? "",
      }))}
    />
  );
}
