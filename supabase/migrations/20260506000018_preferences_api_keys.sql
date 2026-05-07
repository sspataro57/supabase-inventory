alter table preferences
  add column if not exists openai_api_key    text,
  add column if not exists anthropic_api_key text,
  add column if not exists custom_llm_url    text,
  add column if not exists custom_llm_api_key text;
