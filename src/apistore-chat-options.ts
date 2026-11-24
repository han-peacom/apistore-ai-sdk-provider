// Chat model ids from the public API Store catalog
// (https://apistore.cloud/api/public/models, kind "chat").
// Any other model id the API accepts can be passed as a string.
export type ApiStoreChatModelId =
  // Anthropic Claude
  | 'claude-fable-5'
  | 'claude-fable-5-1'
  | 'claude-fable-5-2'
  | 'claude-haiku-4-5'
  | 'claude-haiku-5-5'
  | 'claude-opus-4-5'
  | 'claude-opus-4-6'
  | 'claude-opus-4-7'
  | 'claude-opus-4-8'
  | 'claude-opus-5'
  | 'claude-opus-5-5'
  | 'claude-sonnet-4-6'
  | 'claude-sonnet-5'
  | 'claude-sonnet-5-5'
  // DeepSeek
  | 'deepseek-v4-1-flash'
  | 'deepseek-v4-1-flash-economy'
  // Google Gemini
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.8-flash'
  | 'gemini-4-argon'
  | 'gemini-4-carbon'
  | 'gemini-4-hydrogen'
  // OpenAI GPT
  | 'gpt-5.5'
  | 'gpt-5.6-luna'
  | 'gpt-5.6-sol'
  | 'gpt-5.6-terra'
  | 'gpt-6-astra'
  | 'gpt-6-luna'
  | 'gpt-6-sol'
  | 'gpt-6.1-sol'
  | 'gpt-6.1-terra'
  | 'gpt-6.2-astra'
  | 'gpt-6.2-sol'
  | (string & {});
