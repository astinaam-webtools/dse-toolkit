import {
  clearAuthSession,
  getAppSettings,
  normalizeServerUrl,
  setAuthSession
} from './appSettings.js';

export class ApiError extends Error {
  constructor(message, status = 500, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export class AuthRequiredError extends Error {
  constructor(message = 'Login required to use the configured server.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class ConnectionUnavailableError extends Error {
  constructor(message = 'Unable to reach the configured server.') {
    super(message);
    this.name = 'ConnectionUnavailableError';
  }
}

const STATUS_CONFIG = {
  'client-only': {
    label: 'Client only',
    title: 'No server configured. Portfolio data stays in this browser.'
  },
  connected: {
    label: 'Server connected',
    title: 'Server mode is enabled and your account is connected.'
  },
  'pending-sync': {
    label: 'Syncing...',
    title: 'Changes saved locally. Uploading to server...'
  },
  'login-required': {
    label: 'Server set, login required',
    title: 'A server is configured, but you need to log in before portfolios can load.'
  },
  unavailable: {
    label: 'Server unavailable',
    title: 'The configured server could not be reached or returned an error.'
  },
  checking: {
    label: 'Checking server...',
    title: 'Checking the configured server.'
  }
};

const REQUEST_TIMEOUT_MS = 8000;
const AI_CHAT_TIMEOUT_MS = 120000;

const parseJsonResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

const buildApiUrl = (path, serverUrl = getAppSettings().serverUrl) => {
  const baseUrl = normalizeServerUrl(serverUrl);
  if (!baseUrl) {
    throw new ConnectionUnavailableError('No server URL is configured.');
  }

  return new URL(path, `${baseUrl}/`).toString();
};

const performRequest = async (path, { method = 'GET', body, serverUrl, token, timeoutMs = REQUEST_TIMEOUT_MS } = {}) => {
  const headers = {
    Accept: 'application/json'
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(buildApiUrl(path, serverUrl), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ConnectionUnavailableError('Server request timed out.');
    }
    throw new ConnectionUnavailableError();
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}.`;

    if (response.status === 401) {
      clearAuthSession();
      throw new AuthRequiredError(message);
    }

    throw new ApiError(message, response.status, data);
  }

  return data;
};

export const getStoredConnectionState = () => {
  const settings = getAppSettings();
  if (!settings.serverUrl) {
    return { code: 'client-only', ...STATUS_CONFIG['client-only'] };
  }

  if (!settings.authToken) {
    return { code: 'login-required', ...STATUS_CONFIG['login-required'] };
  }

  return {
    code: 'checking',
    ...STATUS_CONFIG.checking,
    user: settings.user
  };
};

export const probeServer = async (serverUrl = getAppSettings().serverUrl) => {
  const data = await performRequest('/api/health', {
    serverUrl
  });

  return Boolean(data?.ok);
};

export const signup = async ({ email, password }) => {
  const data = await performRequest('/api/auth/signup', {
    method: 'POST',
    body: { email, password }
  });

  setAuthSession(data.token, data.user);
  return data.user;
};

export const login = async ({ email, password }) => {
  const data = await performRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });

  setAuthSession(data.token, data.user);
  return data.user;
};

export const logout = () => {
  clearAuthSession();
};

export const fetchCurrentUser = async () => {
  const settings = getAppSettings();
  if (!settings.serverUrl) {
    return null;
  }

  if (!settings.authToken) {
    throw new AuthRequiredError();
  }

  const data = await performRequest('/api/auth/me', {
    token: settings.authToken
  });

  setAuthSession(settings.authToken, data.user);
  return data.user;
};

export const apiRequest = async (path, options = {}) => {
  const settings = getAppSettings();
  if (!settings.serverUrl) {
    throw new ConnectionUnavailableError('No server URL is configured.');
  }

  if (!settings.authToken) {
    throw new AuthRequiredError();
  }

  return performRequest(path, {
    ...options,
    token: settings.authToken
  });
};

export const getServerAiSettings = async () => apiRequest('/api/ai/settings');

export const getServerAiModels = async () => apiRequest('/api/ai/models');

export const saveServerAiSettings = async ({ apiKey, model }) =>
  apiRequest('/api/ai/settings', {
    method: 'PUT',
    body: {
      provider: 'openrouter',
      apiKey,
      model
    }
  });

export const requestServerAiChat = async ({ messages, model, mode }) =>
  apiRequest('/api/ai/chat', {
    method: 'POST',
    timeoutMs: AI_CHAT_TIMEOUT_MS,
    body: {
      provider: 'openrouter',
      messages,
      model,
      mode
    }
  });

export const getConnectionState = async () => {
  const settings = getAppSettings();
  if (!settings.serverUrl) {
    return { code: 'client-only', ...STATUS_CONFIG['client-only'] };
  }

  try {
    await probeServer(settings.serverUrl);
  } catch (error) {
    return {
      code: 'unavailable',
      ...STATUS_CONFIG.unavailable,
      detail: error.message
    };
  }

  if (!settings.authToken) {
    return { code: 'login-required', ...STATUS_CONFIG['login-required'] };
  }

  try {
    const user = await fetchCurrentUser();
    return {
      code: 'connected',
      ...STATUS_CONFIG.connected,
      detail: user.email,
      user
    };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return {
        code: 'login-required',
        ...STATUS_CONFIG['login-required']
      };
    }

    return {
      code: 'unavailable',
      ...STATUS_CONFIG.unavailable,
      detail: error.message
    };
  }
};

export const applyConnectionState = (element, state) => {
  if (!element) {
    return;
  }

  const code = state?.code || 'client-only';
  const config = STATUS_CONFIG[code] || STATUS_CONFIG['client-only'];
  const label = state?.label || config.label;
  const richLabel = element.querySelector('[data-server-status-label]');
  if (richLabel) {
    richLabel.textContent = label;
  } else {
    element.textContent = label;
  }
  element.title = state?.detail || state?.title || config.title;
  element.setAttribute('aria-label', label);
  element.dataset.state = code;

  Object.keys(STATUS_CONFIG).forEach((key) => {
    element.classList.remove(`is-${key}`);
  });
  element.classList.add(`is-${code}`);
};
