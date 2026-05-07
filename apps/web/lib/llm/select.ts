import type { LLMProvider } from "./provider";

type ProviderConfig = {
  provider?: string | null;
  apiKey?: string | null;
  baseURL?: string | null;
};

export async function selectProvider(config: ProviderConfig = {}): Promise<LLMProvider> {
  const provider = config.provider ?? process.env.LLM_PROVIDER ?? "openai";

  if (provider === "anthropic") {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Anthropic API key is not configured. Set it in Preferences.");
    const { createAnthropicProvider } = await import("./anthropic");
    return createAnthropicProvider(apiKey, config.baseURL ?? undefined);
  }

  // "openai" or "other" — both use the OpenAI-compatible client
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is not configured. Set it in Preferences.");
  const { createOpenAIProvider } = await import("./openai");
  return createOpenAIProvider(apiKey, config.baseURL ?? undefined);
}
