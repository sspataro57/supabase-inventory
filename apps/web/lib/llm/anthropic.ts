import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "./provider";

const DEFAULT_MODEL = "claude-sonnet-4-5";

export function createAnthropicProvider(apiKey: string, baseURL?: string): LLMProvider {
  const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });

  return {
    async *stream(messages, tools, systemPrompt, opts = {}) {
      const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool["input_schema"],
      }));

      const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "user" as const,
            content: [{ type: "tool_result" as const, tool_use_id: m.tool_call_id, content: m.content }],
          };
        }
        if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
          return {
            role: "assistant" as const,
            content: [
              ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
              ...m.tool_calls.map((tc) => ({
                type: "tool_use" as const,
                id: tc.id,
                name: tc.name,
                input: tc.input as Record<string, unknown>,
              })),
            ],
          };
        }
        return { role: m.role as "user" | "assistant", content: m.content };
      });

      const apiStream = client.messages.stream({
        model: opts.model ?? DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: anthropicTools,
      });

      for await (const event of apiStream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", delta: event.delta.text };
        }
      }

      const finalMsg = await apiStream.finalMessage();
      for (const block of finalMsg.content) {
        if (block.type === "tool_use") {
          yield { type: "tool_call", id: block.id, name: block.name, input: block.input };
        }
      }

      yield { type: "done" };
    },
  };
}
