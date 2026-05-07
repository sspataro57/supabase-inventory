import OpenAI from "openai";
import type { LLMProvider, ToolDef } from "./provider";

const DEFAULT_MODEL = "gpt-4.1-mini";

export function createOpenAIProvider(apiKey: string, baseURL?: string): LLMProvider {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  return {
    async *stream(messages, tools, systemPrompt, opts = {}) {
      const openAIMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages.map((m): OpenAI.ChatCompletionMessageParam => {
          if (m.role === "tool") {
            return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
          }
          if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
            return {
              role: "assistant",
              content: m.content || null,
              tool_calls: m.tool_calls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: JSON.stringify(tc.input) },
              })),
            };
          }
          return { role: m.role, content: m.content };
        }),
      ];

      const openAITools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));

      const stream = client.beta.chat.completions.stream({
        model: opts.model ?? DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 4096,
        messages: openAIMessages,
        tools: openAITools.length > 0 ? openAITools : undefined,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) yield { type: "text", delta: delta.content };
      }

      const finalCompletion = await stream.finalChatCompletion();
      const choice = finalCompletion.choices[0];

      if (choice?.message?.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          let input: unknown = {};
          try { input = JSON.parse(tc.function.arguments); } catch { /* empty */ }
          yield { type: "tool_call", id: tc.id, name: tc.function.name, input };
        }
      }

      yield { type: "done" };
    },
  };
}
