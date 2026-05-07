import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_TOOLS } from "@/lib/chat/tools";
import type { ToolContext } from "@/lib/llm/provider";

// MCP JSON-RPC types
type MCPRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

type MCPResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

function ok(id: string | number, result: unknown): MCPResponse {
  return { jsonrpc: "2.0", id, result };
}

function err(id: string | number | null, code: number, message: string): MCPResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function handleMCPRequest(
  body: MCPRequest,
  supabase: SupabaseClient,
  actorId: string,
  convId: string | null
): Promise<MCPResponse> {
  const { method, params, id } = body;

  if (method === "initialize" || method === "ping") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "inventory-mcp", version: "1.0.0" },
      capabilities: { tools: {} },
    });
  }

  if (method === "tools/list") {
    return ok(id, {
      tools: ALL_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.parameters,
      })),
    });
  }

  if (method === "tools/call") {
    const toolName = params?.name as string;
    const toolInput = params?.arguments ?? {};

    const tool = ALL_TOOLS.find((t) => t.name === toolName);
    if (!tool) return err(id, -32601, `Tool not found: ${toolName}`);

    const ctx: ToolContext = { supabase };
    let result: unknown;
    try {
      result = await tool.handler(toolInput, ctx);
    } catch (e) {
      return err(id, -32000, String(e));
    }

    // Log tool call
    await supabase.from("chat_tool_calls").insert({
      conversation_id: convId,
      source: "mcp",
      tool_name: toolName,
      tool_input: toolInput as Record<string, unknown>,
      tool_result: result as Record<string, unknown>,
      actor_id: actorId,
    });

    return ok(id, {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    });
  }

  return err(id, -32601, `Method not found: ${method}`);
}
