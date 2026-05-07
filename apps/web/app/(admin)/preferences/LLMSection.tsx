"use client";

import { useState } from "react";

const inputClass =
  "rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-50 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";

type Props = {
  currentProvider: string;
  maskedOpenai: string | null;
  maskedAnthropic: string | null;
  maskedCustomKey: string | null;
  customUrl: string;
  defaultModel: string;
  dailyLimit: number;
};

export function LLMSection({
  currentProvider,
  maskedOpenai,
  maskedAnthropic,
  maskedCustomKey,
  customUrl,
  defaultModel,
  dailyLimit,
}: Props) {
  const [provider, setProvider] = useState(currentProvider);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">AI / Chat</h2>
      <div className="space-y-4">

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500 dark:text-gray-400 w-28 shrink-0">Provider</label>
          <select
            name="default_llm_provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={inputClass}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="other">Other (OpenAI-compatible)</option>
          </select>
        </div>

        {provider !== "anthropic" && provider !== "other" && (
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">OpenAI API key</label>
            <input
              type="password"
              name="openai_api_key"
              autoComplete="off"
              placeholder={maskedOpenai ?? "Paste key to set…"}
              className={`${inputClass} w-full font-mono`}
            />
            {maskedOpenai && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Currently set: {maskedOpenai}</p>
            )}
          </div>
        )}

        {provider === "anthropic" && (
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Anthropic API key</label>
            <input
              type="password"
              name="anthropic_api_key"
              autoComplete="off"
              placeholder={maskedAnthropic ?? "Paste key to set…"}
              className={`${inputClass} w-full font-mono`}
            />
            {maskedAnthropic && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Currently set: {maskedAnthropic}</p>
            )}
          </div>
        )}

        {provider === "other" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 dark:text-gray-400 w-28 shrink-0">Base URL</label>
              <input
                type="url"
                name="custom_llm_url"
                defaultValue={customUrl}
                placeholder="https://api.example.com/v1"
                className={`${inputClass} flex-1`}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">API key</label>
              <input
                type="password"
                name="custom_llm_api_key"
                autoComplete="off"
                placeholder={maskedCustomKey ?? "Paste key to set…"}
                className={`${inputClass} w-full font-mono`}
              />
              {maskedCustomKey && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Currently set: {maskedCustomKey}</p>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500 dark:text-gray-400 w-28 shrink-0">Model override</label>
            <input
              type="text"
              name="default_llm_model"
              defaultValue={defaultModel}
              placeholder="Leave blank for default"
              className={`${inputClass} flex-1`}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500 dark:text-gray-400 w-28 shrink-0">Daily msg limit</label>
            <input
              type="number"
              name="chat_daily_message_limit"
              defaultValue={dailyLimit}
              min="1"
              max="1000"
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
