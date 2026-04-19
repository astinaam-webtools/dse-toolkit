import { config } from './config.js';

const DEFAULT_MODEL = 'openai/gpt-oss-20b:free';

export const createOpenRouterClient = ({ apiKey } = {}) => {
  const resolvedApiKey = String(apiKey || config.openRouterApiKey || '').trim();

  if (!resolvedApiKey) {
    throw new Error('OpenRouter API key is not configured on the server.');
  }

  const completeChat = async ({ model, messages }) => {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('At least one chat message is required.');
    }

    const selectedModel = String(model || DEFAULT_MODEL).trim();
    const startedAt = Date.now();

    const response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolvedApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || data?.error || 'OpenRouter request failed.';
      throw new Error(message);
    }

    return {
      model: data?.model || selectedModel,
      message: data?.choices?.[0]?.message?.content || '',
      raw: data,
      latencyMs: Date.now() - startedAt
    };
  };

  return {
    completeChat
  };
};

export const DEFAULT_OPENROUTER_MODEL = DEFAULT_MODEL;
