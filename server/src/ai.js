import { getDb } from './db.js';
import { config } from './config.js';
import { createGitHubCopilotClient } from './copilotClient.js';
import { createOpenRouterClient, DEFAULT_OPENROUTER_MODEL } from './openrouterClient.js';
import { checkSandboxReady } from './cursorSdkService.js';

const DEFAULT_MODEL = DEFAULT_OPENROUTER_MODEL;

export const sanitizeAiSettings = (row) => {
  const provider = row?.provider || 'openrouter';
  const model = row?.model || (provider === 'cursor-sdk' ? config.cursorDefaultModel : DEFAULT_MODEL);
  let modelParams = [];
  if (row?.model_params) {
    try { modelParams = JSON.parse(row.model_params); } catch (_) {}
  }

  const { sandboxReady, cursorDisabledReason } = checkSandboxReady();

  let configured = false;
  if (provider === 'cursor-sdk') {
    const hasKey = Boolean(row?.cursor_api_key || row?.api_key || config.cursorApiKey);
    configured = hasKey && sandboxReady;
  } else {
    configured = Boolean(row?.api_key || config.openRouterApiKey);
  }

  return {
    provider,
    model,
    modelParams,
    configured,
    sandboxReady,
    cursorDisabledReason: provider === 'cursor-sdk' ? cursorDisabledReason : null
  };
};

export const getUserAiSettingsRow = async (userId) => {
  const db = await getDb();
  return db.get(
    `SELECT provider, api_key, cursor_api_key, model, model_params, created_at, updated_at
     FROM user_ai_settings
     WHERE user_id = ?`,
    userId
  );
};

export const saveUserAiSettings = async ({ userId, provider = 'openrouter', apiKey, model, modelParams = [] }) => {
  if (provider !== 'openrouter' && provider !== 'cursor-sdk') {
    const err = new Error('Provider must be openrouter or cursor-sdk.');
    err.statusCode = 400;
    throw err;
  }

  const existingRow = await getUserAiSettingsRow(userId);
  const now = new Date().toISOString();
  const db = await getDb();

  let newOpenRouterKey = existingRow?.api_key || '';
  let newCursorKey = existingRow?.cursor_api_key || '';

  if (provider === 'openrouter') {
    if (apiKey && apiKey.trim()) {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey.startsWith('sk-or-')) {
        const err = new Error('A valid OpenRouter API key is required (starts with sk-or-).');
        err.statusCode = 400;
        throw err;
      }
      newOpenRouterKey = trimmedKey;
    }
  } else if (provider === 'cursor-sdk') {
    if (apiKey && apiKey.trim()) {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey.startsWith('cursor_')) {
        const err = new Error('A valid Cursor API key is required (starts with cursor_).');
        err.statusCode = 400;
        throw err;
      }
      newCursorKey = trimmedKey;
    }
  }

  const finalModel = model || (provider === 'cursor-sdk' ? config.cursorDefaultModel : DEFAULT_MODEL);
  const finalModelParamsJson = JSON.stringify(Array.isArray(modelParams) ? modelParams : []);

  await db.run(
    `INSERT INTO user_ai_settings (user_id, provider, api_key, cursor_api_key, model, model_params, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id)
     DO UPDATE SET provider = excluded.provider,
                   api_key = excluded.api_key,
                   cursor_api_key = excluded.cursor_api_key,
                   model = excluded.model,
                   model_params = excluded.model_params,
                   updated_at = excluded.updated_at`,
    userId,
    provider,
    newOpenRouterKey,
    newCursorKey,
    finalModel,
    finalModelParamsJson,
    now,
    now
  );

  const updatedRow = await getUserAiSettingsRow(userId);
  return sanitizeAiSettings(updatedRow);
};

export const requestOpenRouterCompletion = async ({ apiKey, model, messages, stream = false, onDelta = null }) => {
  const client = createOpenRouterClient({ apiKey });
  return client.completeChat({ model, messages, stream, onDelta });
};

export const requestGitHubCopilotCompletion = async ({ apiKey, model, messages, baseUrl, apiVersion, org }) => {
  const client = createGitHubCopilotClient({ apiKey, baseUrl, apiVersion, org });
  return client.completeChat({ model, messages });
};

export const requestGitHubCopilotModels = async ({ apiKey, baseUrl, apiVersion, org }) => {
  const client = createGitHubCopilotClient({ apiKey, baseUrl, apiVersion, org });
  return client.listModels();
};

export const pickRandomModel = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) {
    return DEFAULT_MODEL;
  }
  const index = Math.floor(Math.random() * list.length);
  const item = list[index];
  if (typeof item === 'string') return item;
  return item?.model_id || item?.id || DEFAULT_MODEL;
};

export const resolveConfiguredServerApiKey = async (userId) => {
  const dbRow = userId ? await getUserAiSettingsRow(userId) : null;
  const provider = dbRow?.provider || 'openrouter';
  let apiKey = '';
  if (provider === 'cursor-sdk') {
    apiKey = dbRow?.cursor_api_key || dbRow?.api_key || config.cursorApiKey || '';
  } else {
    apiKey = dbRow?.api_key || config.openRouterApiKey || '';
  }

  let modelParams = [];
  if (dbRow?.model_params) {
    try { modelParams = JSON.parse(dbRow.model_params); } catch (_) {}
  }

  return {
    apiKey,
    model: dbRow?.model || (provider === 'cursor-sdk' ? config.cursorDefaultModel : DEFAULT_MODEL),
    modelParams,
    provider,
    configured: Boolean(apiKey)
  };
};

export const DEFAULT_AI_MODEL = DEFAULT_MODEL;
