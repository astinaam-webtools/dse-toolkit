import { config } from './config.js';
import { logOpenRouterEvent, maskApiKey } from './openrouterLogger.js';

const DEFAULT_MODEL = 'openai/gpt-oss-20b:free';

const toSingleLineText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const resolveOpenRouterErrorMessage = ({ data, responseText, status }) => {
  const candidates = [
    data?.error?.metadata?.raw,
    data?.error?.raw,
    data?.error?.message,
    data?.message,
    responseText
  ];

  const message = candidates
    .map((item) => (typeof item === 'string' ? toSingleLineText(item) : ''))
    .find(Boolean);

  if (message) {
    return message;
  }

  return `OpenRouter request failed (HTTP ${status}).`;
};

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
    const requestPayload = {
      model: selectedModel,
      messages
    };

    await logOpenRouterEvent('request', {
      url: `${config.openRouterBaseUrl}/chat/completions`,
      method: 'POST',
      provider: 'openrouter',
      model: selectedModel,
      messageCount: messages.length,
      authKeyPreview: maskApiKey(resolvedApiKey),
      requestPayload
    });

    let response;
    try {
      response = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });
    } catch (error) {
      await logOpenRouterEvent('network_error', {
        provider: 'openrouter',
        model: selectedModel,
        messageCount: messages.length,
        latencyMs: Date.now() - startedAt,
        error
      });
      throw error;
    }

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

    await logOpenRouterEvent(response.ok ? 'response' : 'api_error', {
      provider: 'openrouter',
      model: selectedModel,
      messageCount: messages.length,
      latencyMs: Date.now() - startedAt,
      status: response.status,
      statusText: response.statusText,
      responseBody: data || responseText
    });

    if (!response.ok) {
      const message = resolveOpenRouterErrorMessage({
        data,
        responseText,
        status: response.status
      });
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
