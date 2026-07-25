const SETTINGS_KEY = 'dse_toolkit_app_settings_v1';
const CONNECTION_STATE_EVENT = 'dse:connection-state-changed';

const DEFAULT_SETTINGS = Object.freeze({
  serverUrl: '',
  authToken: null,
  user: null,
  ai: {
    mode: 'client',
    localOpenRouterApiKey: '',
    localOpenRouterModel: '',
    serverPreferredModel: 'auto',
    serverModelMode: 'auto'
  },
  importDecisions: {
    stocks: null,
    funds: null
  },
  pendingSync: {
    stocks: false,
    funds: false,
    chat_threads: false
  }
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const emitConnectionStateChanged = (reason) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CONNECTION_STATE_EVENT, {
      detail: { reason }
    })
  );
};

const isSameUser = (a, b) => {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.id === b.id && a.email === b.email;
};

const normalizeUser = (user) => {
  if (!user || typeof user !== 'object') {
    return null;
  }

  if (!user.id || !user.email) {
    return null;
  }

  return {
    id: String(user.id),
    email: String(user.email)
  };
};

export const normalizeServerUrl = (input) => {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('/')) {
    return new URL(trimmed, window.location.origin).toString().replace(/\/+$/, '');
  }

  let candidate = trimmed;
  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate);

  if (!hasProtocol) {
    const isLocalLike =
      candidate.startsWith('localhost') ||
      candidate.startsWith('127.0.0.1') ||
      candidate.startsWith('0.0.0.0') ||
      /^\d+\.\d+\.\d+\.\d+/.test(candidate);

    candidate = `${isLocalLike ? 'http' : 'https'}://${candidate}`;
  }

  try {
    return new URL(candidate).toString().replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
};

const normalizeImportDecisions = (importDecisions) => ({
  stocks: importDecisions?.stocks || null,
  funds: importDecisions?.funds || null
});

const normalizePendingSync = (pendingSync) => ({
  stocks: Boolean(pendingSync?.stocks),
  funds: Boolean(pendingSync?.funds),
  chat_threads: Boolean(pendingSync?.chat_threads)
});

const normalizeAiSettings = (ai) => {
  const mode = ai?.mode === 'server' ? 'server' : 'client';
  const serverModelMode = ai?.serverModelMode === 'manual' ? 'manual' : 'auto';
  const serverPreferredModel = ai?.serverPreferredModel ? String(ai.serverPreferredModel) : 'auto';
  const serverAiProvider = ai?.serverAiProvider === 'cursor-sdk' ? 'cursor-sdk' : 'openrouter';
  const serverModelParams = Array.isArray(ai?.serverModelParams) ? ai.serverModelParams : [];

  return {
    mode,
    localOpenRouterApiKey: ai?.localOpenRouterApiKey ? String(ai.localOpenRouterApiKey) : '',
    localOpenRouterModel: ai?.localOpenRouterModel ? String(ai.localOpenRouterModel) : '',
    serverAiProvider,
    serverPreferredModel,
    serverModelMode,
    serverModelParams
  };
};

export const normalizeAppSettings = (value) => {
  const settings = value && typeof value === 'object' ? value : {};

  return {
    serverUrl: normalizeServerUrl(settings.serverUrl),
    authToken: settings.authToken ? String(settings.authToken) : null,
    user: normalizeUser(settings.user),
    ai: normalizeAiSettings(settings.ai),
    importDecisions: normalizeImportDecisions(settings.importDecisions),
    pendingSync: normalizePendingSync(settings.pendingSync)
  };
};

export const getAppSettings = () => {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return clone(DEFAULT_SETTINGS);
  }

  try {
    return normalizeAppSettings(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to parse app settings', error);
    return clone(DEFAULT_SETTINGS);
  }
};

export const saveAppSettings = (settings) => {
  const normalized = normalizeAppSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
};

export const updateAppSettings = (updater) => {
  const current = getAppSettings();
  const next =
    typeof updater === 'function'
      ? updater(clone(current))
      : { ...current, ...(updater || {}) };

  return saveAppSettings(next);
};

export const setServerUrl = (serverUrl) => {
  const normalizedUrl = normalizeServerUrl(serverUrl);
  let changed = false;

  const next = updateAppSettings((current) => {
    if (current.serverUrl === normalizedUrl) {
      return current;
    }

    changed = true;

    return {
      ...current,
      serverUrl: normalizedUrl,
      authToken: null,
      user: null,
      importDecisions: {
        stocks: null,
        funds: null
      },
      pendingSync: {
        stocks: false,
        funds: false,
        chat_threads: false
      }
    };
  });

  if (changed) {
    emitConnectionStateChanged('server-url-updated');
  }

  return next;
};

export const clearServerUrl = () => {
  let changed = false;

  const next = updateAppSettings((current) => {
    if (!current.serverUrl && !current.authToken && !current.user) {
      return current;
    }

    changed = true;

    return {
      ...current,
      serverUrl: '',
      authToken: null,
      user: null,
      importDecisions: {
        stocks: null,
        funds: null
      },
      pendingSync: {
        stocks: false,
        funds: false,
        chat_threads: false
      }
    };
  });

  if (changed) {
    emitConnectionStateChanged('server-url-cleared');
  }

  return next;
};

export const setAuthSession = (token, user) => {
  const nextToken = token ? String(token) : null;
  const nextUser = normalizeUser(user);
  let changed = false;

  const next = updateAppSettings((current) => {
    if (current.authToken === nextToken && isSameUser(current.user, nextUser)) {
      return current;
    }

    changed = true;

    return {
      ...current,
      authToken: nextToken,
      user: nextUser
    };
  });

  if (changed) {
    emitConnectionStateChanged(nextToken ? 'auth-session-set' : 'auth-session-cleared');
  }

  return next;
};

export const clearAuthSession = () => {
  let changed = false;

  const next = updateAppSettings((current) => {
    if (!current.authToken && !current.user) {
      return current;
    }

    changed = true;

    return {
      ...current,
      authToken: null,
      user: null
    };
  });

  if (changed) {
    emitConnectionStateChanged('auth-session-cleared');
  }

  return next;
};

export const getImportDecision = (type) => getAppSettings().importDecisions[type] || null;

export const setImportDecision = (type, decision) =>
  updateAppSettings((current) => ({
    ...current,
    importDecisions: {
      ...current.importDecisions,
      [type]: decision || null
    }
  }));

export const getPendingSync = () => getAppSettings().pendingSync;

export const hasPendingSync = () => {
  const ps = getPendingSync();
  return Object.values(ps || {}).some(Boolean);
};

export const setPendingSync = (type, value) =>
  updateAppSettings((current) => ({
    ...current,
    pendingSync: {
      ...current.pendingSync,
      [type]: Boolean(value)
    }
  }));

export const getAiSettings = () => getAppSettings().ai;

export const updateAiSettings = (updater) =>
  updateAppSettings((current) => {
    const nextAi =
      typeof updater === 'function'
        ? updater({ ...current.ai })
        : { ...current.ai, ...(updater || {}) };

    return {
      ...current,
      ai: normalizeAiSettings(nextAi)
    };
  });
