import { getDb } from './db.js';
import { models } from './models.js';
import { createGitHubCopilotClient } from './copilotClient.js';
import { createOpenRouterClient, DEFAULT_OPENROUTER_MODEL } from './openrouterClient.js';

const DEFAULT_MODEL = DEFAULT_OPENROUTER_MODEL;

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
  const client = createOpenRouterClient({ apiKey });
  return client.completeChat({ model, messages });
};

export const requestGitHubCopilotCompletion = async ({ apiKey, model, messages, baseUrl, apiVersion, org }) => {
  const client = createGitHubCopilotClient({ apiKey, baseUrl, apiVersion, org });
  return client.completeChat({ model, messages });
};

export const requestGitHubCopilotModels = async ({ apiKey, baseUrl, apiVersion, org }) => {
  const client = createGitHubCopilotClient({ apiKey, baseUrl, apiVersion, org });
  return client.listModels();
};

export const getOpenRouterModels = () =>
  [...models]
    .filter((item) => item && item.model_id)
    .sort((a, b) => String(a.model_name || '').localeCompare(String(b.model_name || '')));

export const pickRandomModel = (list = getOpenRouterModels()) => {
  if (!Array.isArray(list) || list.length === 0) {
    return DEFAULT_MODEL;
  }
  const index = Math.floor(Math.random() * list.length);
  return list[index]?.model_id || DEFAULT_MODEL;
};

export const resolveConfiguredServerApiKey = async (userId) => {
  const dbRow = userId ? await getUserAiSettingsRow(userId) : null;
  return {
    apiKey: dbRow?.api_key || '',
    model: dbRow?.model || DEFAULT_MODEL,
    provider: dbRow?.provider || 'openrouter',
    configured: Boolean(dbRow?.api_key)
  };
};

export const DEFAULT_AI_MODEL = DEFAULT_MODEL;
