"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

type ToolCallChip = {
  id: string;
  name: string;
  result?: unknown;
};

const SUGGESTED_PROMPTS = [
  "What products are low on stock?",
  "What lots are expiring this month?",
  "How much flour do we have?",
  "Show me the 10 most recent movements",
  "What are the current default units?",
];

export function ChatThread({
  conversationId,
  initialMessages,
}: {
  conversationId: string | null;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [toolCalls, setToolCalls] = useState<ToolCallChip[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls]);

  async function handleSubmit(e: React.FormEvent | null, overrideMessage?: string) {
    e?.preventDefault();
    const msg = overrideMessage ?? input;
    if (!msg.trim() || pending) return;

    setInput("");
    setError(null);
    setPending(true);
    setToolCalls([]);

    const userMessage: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMessage]);

    let assistantContent = "";
    const assistantIdx = messages.length + 1;

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, message: msg }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          let event: Record<string, unknown>;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "text") {
            assistantContent += event.delta as string;
            setMessages((prev) => {
              const next = [...prev];
              next[assistantIdx] = { role: "assistant", content: assistantContent };
              return next;
            });
          } else if (event.type === "tool_call") {
            setToolCalls((prev) => [
              ...prev,
              { id: event.id as string, name: event.name as string },
            ]);
          } else if (event.type === "tool_result") {
            setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === (event.id as string) ? { ...tc, result: event.result } : tc
              )
            );
          } else if (event.type === "done") {
            const newConvId = event.conversation_id as string;
            if (!convId && newConvId) {
              setConvId(newConvId);
              router.replace(`/chat/${newConvId}`);
            }
          } else if (event.type === "error") {
            setError(event.message as string);
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.filter((_, i) => i !== assistantIdx));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)] max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Chat</h1>
        <a href="/chat" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          All conversations
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="pt-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Ask anything about your inventory.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSubmit(null, p)}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`rounded-xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-50"
              }`}
            >
              {m.content || (pending && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}

        {/* Tool call chips */}
        {toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-1">
            {toolCalls.map((tc) => (
              <span
                key={tc.id}
                title={tc.result ? JSON.stringify(tc.result, null, 2) : "Running…"}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium cursor-help ${
                  tc.result !== undefined
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                <span>{tc.result !== undefined ? "✓" : "⟳"}</span>
                {tc.name.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about inventory…"
          disabled={pending}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
