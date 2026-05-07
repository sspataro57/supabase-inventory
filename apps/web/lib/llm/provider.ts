import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: { id: string; name: string; input: unknown }[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
  handler: (input: unknown, ctx: ToolContext) => Promise<unknown>;
};

export type ToolContext = {
  supabase: SupabaseClient;
};

export type LLMStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; result: unknown }
  | { type: "done" };

export interface LLMProvider {
  stream(
    messages: ChatMessage[],
    tools: ToolDef[],
    systemPrompt: string,
    opts?: { model?: string; maxTokens?: number }
  ): AsyncGenerator<LLMStreamEvent>;
}
