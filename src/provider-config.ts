import type { Model } from '@earendil-works/pi-ai';

export function providerConfig(env: Record<string, string | undefined>) {
  const openrouter = !env.MODEL_API_KEY && !!env.OPENROUTER_API_KEY;
  const apiKey = openrouter ? env.OPENROUTER_API_KEY! : env.MODEL_API_KEY;
  const baseUrl = openrouter ? 'https://openrouter.ai/api/v1' : env.MODEL_BASE_URL;
  const id = openrouter ? (env.OPENROUTER_MODEL ?? 'openrouter/free') : env.MODEL_ID;
  if (!apiKey || !baseUrl || !id) throw new Error('Set OPENROUTER_API_KEY, or MODEL_API_KEY, MODEL_BASE_URL and MODEL_ID');
  if (openrouter && id !== 'openrouter/free' && !id.endsWith(':free')) throw new Error('Only free OpenRouter models are enabled');
  const model: Model<'openai-completions'> = { id, name: id, api: 'openai-completions', provider: openrouter ? 'openrouter' : 'openai', baseUrl, reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32000, maxTokens: 2048 };
  return { model, apiKey, origin: 'http://127.0.0.1:4170' };
}
