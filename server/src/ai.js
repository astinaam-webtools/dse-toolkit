import { config } from './config.js';
import { getDb } from './db.js';

const DEFAULT_MODEL = 'openai/gpt-oss-20b:free';

export const sanitizeAiSettings = (row) => {
  if (!row) {
    return {
      configured: false,
      provider: 'openrouter',
      model: DEFAULT_MODEL
    };
  }

  return {
    configured: Boolean(row.api_key),
    provider: row.provider || 'openrouter',
    model: row.model || DEFAULT_MODEL
  };
};

export const getUserAiSettingsRow = async (userId) => {
  const db = await getDb();
  return db.get(
    `SELECT provider, api_key, model, created_at, updated_at
     FROM user_ai_settings
     WHERE user_id = ?`,
    userId
  );
};

export const saveUserAiSettings = async ({ userId, provider, apiKey, model }) => {
  if (provider !== 'openrouter') {
    throw new Error('Only OpenRouter provider is currently supported.');
  }

  if (!apiKey || !apiKey.startsWith('sk-or-')) {
    throw new Error('A valid OpenRouter API key is required (starts with sk-or-).');
  }

  const now = new Date().toISOString();
  const db = await getDb();

  await db.run(
    `INSERT INTO user_ai_settings (user_id, provider, api_key, model, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id)
     DO UPDATE SET provider = excluded.provider,
                   api_key = excluded.api_key,
                   model = excluded.model,
                   updated_at = excluded.updated_at`,
    userId,
    provider,
    apiKey,
    model || DEFAULT_MODEL,
    now,
    now
  );

  return getUserAiSettingsRow(userId);
};

export const requestOpenRouterCompletion = async ({ apiKey, model, messages }) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('At least one chat message is required.');
  }

  const response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || data?.error || 'OpenRouter request failed.';
    throw new Error(message);
  }

  return {
    message: data?.choices?.[0]?.message?.content || '',
    raw: data
  };
};

export const DEFAULT_AI_MODEL = DEFAULT_MODEL;
