const SETTINGS_KEY = 'dse_toolkit_app_settings_v1';

const DEFAULT_SETTINGS = Object.freeze({
  serverUrl: '',
  authToken: null,
  user: null,
  importDecisions: {
    stocks: null,
    funds: null
  },
  pendingSync: {
    stocks: false,
    funds: false
  }
});

const clone = (value) => JSON.parse(JSON.stringify(value));

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
  funds: Boolean(pendingSync?.funds)
});

export const normalizeAppSettings = (value) => {
  const settings = value && typeof value === 'object' ? value : {};

  return {
    serverUrl: normalizeServerUrl(settings.serverUrl),
    authToken: settings.authToken ? String(settings.authToken) : null,
    user: normalizeUser(settings.user),
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

  return updateAppSettings((current) => {
    if (current.serverUrl === normalizedUrl) {
      return current;
    }

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
        funds: false
      }
    };
  });
};

export const clearServerUrl = () =>
  updateAppSettings((current) => ({
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
      funds: false
    }
  }));

export const setAuthSession = (token, user) =>
  updateAppSettings((current) => ({
    ...current,
    authToken: token ? String(token) : null,
    user: normalizeUser(user)
  }));

export const clearAuthSession = () =>
  updateAppSettings((current) => ({
    ...current,
    authToken: null,
    user: null
  }));

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
  return ps.stocks || ps.funds;
};

export const setPendingSync = (type, value) =>
  updateAppSettings((current) => ({
    ...current,
    pendingSync: {
      ...current.pendingSync,
      [type]: Boolean(value)
    }
  }));
