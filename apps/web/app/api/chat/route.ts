import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { selectProvider } from "@/lib/llm/select";
import { ALL_TOOLS } from "@/lib/chat/tools";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import type { ChatMessage } from "@/lib/llm/provider";

const MAX_ITERATIONS = 6;
const MAX_TOOL_CALLS_PER_TURN = 8;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { conversation_id, message } = await req.json();
  if (!message?.trim()) return new Response("Missing message", { status: 400 });

  // Read prefs including API keys via service client (keys never leave the server)
  const service = createServiceClient();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    service.from("preferences")
      .select("default_unit_mass, default_unit_volume, default_unit_count, chat_daily_message_limit, default_llm_provider, default_llm_model, openai_api_key, anthropic_api_key, custom_llm_url, custom_llm_api_key")
      .eq("id", 1)
      .single(),
  ]);

  // Daily message limit check
  const today = new Date().toISOString().slice(0, 10);
  const { data: userConvs } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", user.id);
  const userConvIds = (userConvs ?? []).map((c) => c.id);

  const { count: todayCount } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", today + "T00:00:00Z")
    .in("conversation_id", userConvIds.length > 0 ? userConvIds : ["00000000-0000-0000-0000-000000000000"]);

  const limit = prefs?.chat_daily_message_limit ?? 50;
  if ((todayCount ?? 0) >= limit && profile?.role !== "admin") {
    return new Response("Daily message limit reached", { status: 429 });
  }

  // Ensure conversation exists
  let convId = conversation_id;
  if (!convId) {
    const { data: conv } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, title: message.slice(0, 60) })
      .select("id")
      .single();
    convId = conv?.id;
  }

  // Load conversation history
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(40);

  // Save user message
  await supabase.from("chat_messages").insert({
    conversation_id: convId,
    role: "user",
    content: message,
  });

  const systemPrompt = buildSystemPrompt({
    date: new Date().toISOString().slice(0, 10),
    defaultUnitMass: prefs?.default_unit_mass ?? "g",
    defaultUnitVolume: prefs?.default_unit_volume ?? "ml",
    defaultUnitCount: prefs?.default_unit_count ?? "ea",
  });

  const messages: ChatMessage[] = [
    ...((history ?? []) as ChatMessage[]),
    { role: "user", content: message },
  ];

  const llmProvider = prefs?.default_llm_provider ?? "openai";
  const apiKey = llmProvider === "anthropic"
    ? (prefs?.anthropic_api_key ?? null)
    : llmProvider === "other"
    ? (prefs?.custom_llm_api_key ?? null)
    : (prefs?.openai_api_key ?? null);

  const provider = await selectProvider({
    provider: llmProvider === "other" ? "openai" : llmProvider,
    apiKey,
    baseURL: llmProvider === "other" ? (prefs?.custom_llm_url ?? null) : null,
  });
  const toolCtx = { supabase };

  const encoder = new TextEncoder();
  let toolCallCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        let iteration = 0;
        let fullText = "";
        let pendingToolCalls: { id: string; name: string; input: unknown }[] = [];

        while (iteration < MAX_ITERATIONS) {
          iteration++;
          fullText = "";
          pendingToolCalls = [];

          const events = provider.stream(messages, ALL_TOOLS, systemPrompt, {
            model: prefs?.default_llm_model || undefined,
          });


          for await (const event of events) {
            if (event.type === "text") {
              fullText += event.delta;
              send({ type: "text", delta: event.delta });
            } else if (event.type === "tool_call") {
              if (toolCallCount >= MAX_TOOL_CALLS_PER_TURN) {
                send({ type: "error", message: "Tool call limit reached" });
                break;
              }
              toolCallCount++;
              pendingToolCalls.push({ id: event.id, name: event.name, input: event.input });
              send({ type: "tool_call", id: event.id, name: event.name });
            } else if (event.type === "done") {
              break;
            }
          }

          if (pendingToolCalls.length === 0) {
            // No tool calls — save assistant message and finish
            if (fullText) {
              await supabase.from("chat_messages").insert({
                conversation_id: convId,
                role: "assistant",
                content: fullText,
              });
            }
            break;
          }

          // Add assistant turn including tool_calls so providers can reconstruct multi-turn correctly
          messages.push({
            role: "assistant",
            content: fullText || "",
            tool_calls: pendingToolCalls.map((tc) => ({ id: tc.id, name: tc.name, input: tc.input })),
          });

          for (const tc of pendingToolCalls) {
            const tool = ALL_TOOLS.find((t) => t.name === tc.name);
            let result: unknown = { error: "Unknown tool" };
            if (tool) {
              try {
                result = await tool.handler(tc.input, toolCtx);
              } catch (e) {
                result = { error: String(e) };
              }
            }

            const resultStr = JSON.stringify(result);
            send({ type: "tool_result", id: tc.id, name: tc.name, result });

            // Save tool call
            await supabase.from("chat_tool_calls").insert({
              conversation_id: convId,
              source: "chat",
              tool_name: tc.name,
              tool_input: tc.input as Record<string, unknown>,
              tool_result: result as Record<string, unknown>,
              actor_id: user.id,
            });

            messages.push({ role: "tool", tool_call_id: tc.id, content: resultStr });
          }
        }

        send({ type: "done", conversation_id: convId });
      } catch (e) {
        send({ type: "error", message: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
