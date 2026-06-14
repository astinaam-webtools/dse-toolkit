import { config } from './config.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

const normalizeMessageText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const toBaseUrl = (value) => String(value || '').replace(/\/+$/, '');

const resolveChatUrl = ({ baseUrl, org }) => {
  const normalizedBase = toBaseUrl(baseUrl);
  if (!org) {
    return `${normalizedBase}/inference/chat/completions`;
  }
  return `${normalizedBase}/orgs/${encodeURIComponent(org)}/inference/chat/completions`;
};

const resolveCopilotErrorMessage = ({ data, responseText, status }) => {
  const candidates = [
    data?.error?.message,
    data?.message,
    typeof data?.error === 'string' ? data.error : '',
    responseText
  ];

  const message = candidates
    .map((item) => (typeof item === 'string' ? normalizeMessageText(item) : ''))
    .find(Boolean);

  if (message) {
    return message;
  }

  return `GitHub Copilot request failed (HTTP ${status}).`;
};

export const createGitHubCopilotClient = ({ apiKey, baseUrl, apiVersion, org } = {}) => {
  const resolvedApiKey = String(apiKey || config.githubCopilotApiKey || '').trim();
  const resolvedBaseUrl = String(baseUrl || config.githubCopilotBaseUrl || '').trim();
  const resolvedApiVersion = String(apiVersion || config.githubCopilotApiVersion || '').trim();
  const resolvedOrg = String(org || config.githubCopilotOrg || '').trim();

  if (!resolvedApiKey) {
    throw new Error('GitHub Copilot API key is not configured on the server.');
  }

  if (!resolvedBaseUrl) {
    throw new Error('GitHub Copilot base URL is not configured on the server.');
  }

  if (!resolvedApiVersion) {
    throw new Error('GitHub Copilot API version is not configured on the server.');
  }

  const commonHeaders = {
    Authorization: `Bearer ${resolvedApiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': resolvedApiVersion
  };

  const listModels = async () => {
    const response = await fetch(`${toBaseUrl(resolvedBaseUrl)}/catalog/models`, {
      method: 'GET',
      headers: {
        Accept: commonHeaders.Accept,
        Authorization: commonHeaders.Authorization,
        'X-GitHub-Api-Version': commonHeaders['X-GitHub-Api-Version']
      }
    });

    const responseText = await response.text();
    const data = (() => {
      if (!responseText) {
        return null;
      }

      try {
        return JSON.parse(responseText);
      } catch {
        return null;
      }
    })();

    if (!response.ok) {
      const message = resolveCopilotErrorMessage({
        data,
        responseText,
        status: response.status
      });
      throw new Error(message);
    }

    return Array.isArray(data) ? data : [];
  };

  const completeChat = async ({ model, messages }) => {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('At least one chat message is required.');
    }

    const selectedModel = String(model || config.githubCopilotModel || DEFAULT_MODEL).trim();
    const startedAt = Date.now();
    const response = await fetch(resolveChatUrl({ baseUrl: resolvedBaseUrl, org: resolvedOrg }), {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({
        model: selectedModel,
        stream: false,
        messages
      })
    });

    const responseText = await response.text();
    const data = (() => {
      if (!responseText) {
        return null;
      }

      try {
        return JSON.parse(responseText);
      } catch {
        return null;
      }
    })();

    if (!response.ok) {
      const message = resolveCopilotErrorMessage({
        data,
        responseText,
        status: response.status
      });
      throw new Error(message);
    }

    return {
      model: data?.model || selectedModel,
      message: data?.choices?.[0]?.message?.content || data?.message || '',
      raw: data,
      latencyMs: Date.now() - startedAt
    };
  };

  return {
    completeChat,
    listModels
  };
};

export const DEFAULT_GITHUB_COPILOT_MODEL = DEFAULT_MODEL;
