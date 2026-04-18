import {
  apiRequest,
  AuthRequiredError,
  getConnectionState as getServerConnectionState,
  getStoredConnectionState as getStoredServerConnectionState,
  login as loginWithServer,
  logout as logoutFromServer,
  signup as signupWithServer
} from './serverClient.js';
import { getAppSettings, hasPendingSync, setPendingSync } from './appSettings.js';

export { hasPendingSync } from './appSettings.js';

export const isServerModeEnabled = () => Boolean(getAppSettings().serverUrl);

export const getSession = () => {
  const settings = getAppSettings();
  return {
    serverUrl: settings.serverUrl,
    authToken: settings.authToken,
    user: settings.user,
    isAuthenticated: Boolean(settings.serverUrl && settings.authToken && settings.user)
  };
};

export const getConnectionState = () => getServerConnectionState();
export const getStoredConnectionState = () => getStoredServerConnectionState();


export const signup = (credentials) => signupWithServer(credentials);

export const login = (credentials) => loginWithServer(credentials);

export const logout = () => logoutFromServer();

// Registry so flushPendingSync can read local data without circular deps.
// Stores call registerLocalReader() when they are first imported.
const localReaders = {};
export const registerLocalReader = (type, fn) => {
  localReaders[type] = fn;
};

export const loadDocument = async (type, { readLocal, createDefault }) => {
  if (!isServerModeEnabled()) {
    return readLocal();
  }

  const settings = getAppSettings();
  if (!settings.authToken) {
    throw new AuthRequiredError();
  }

  try {
    const data = await apiRequest(`/api/portfolio/${type}`);
    return data?.document || createDefault();
  } catch (error) {
    // Auth errors must propagate — do not silently fall back on 401/403
    if (error instanceof AuthRequiredError) {
      throw error;
    }
    // Server unreachable: use locally cached data so the app still works offline
    console.warn(`[offline-first] Server load failed for "${type}", falling back to local cache:`, error.message);
    return readLocal();
  }
};

export const saveDocument = async (type, document, { writeLocal }) => {
  if (!isServerModeEnabled()) {
    writeLocal(document);
    return document;
  }

  const settings = getAppSettings();
  if (!settings.authToken) {
    throw new AuthRequiredError();
  }

  // Always persist locally first so the data is never lost
  writeLocal(document);

  try {
    const data = await apiRequest(`/api/portfolio/${type}`, {
      method: 'PUT',
      body: { document }
    });
    setPendingSync(type, false);
    return data?.document || document;
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw error;
    }
    // Server unavailable: queue for background sync and return local copy
    console.warn(`[offline-first] Server save failed for "${type}", queued for sync:`, error.message);
    setPendingSync(type, true);
    return document;
  }
};

export const uploadDocument = async (type, document) => {
  const settings = getAppSettings();
  if (!settings.serverUrl || !settings.authToken) {
    throw new AuthRequiredError();
  }

  try {
    const data = await apiRequest(`/api/portfolio/${type}`, {
      method: 'PUT',
      body: { document }
    });

    setPendingSync(type, false);
    return data?.document || document;
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      throw error;
    }

    // Keep import/export flows non-blocking when server is temporarily unavailable.
    setPendingSync(type, true);
    console.warn(`[offline-first] Upload failed for "${type}", queued for sync:`, error.message);
    return document;
  }
};

/**
 * Uploads any locally-queued changes to the server.
 * Safe to call whenever the server becomes reachable again (login, nav poll).
 * Returns { flushed: string[], errors: Array<{type, error}> }.
 */
export const flushPendingSync = async () => {
  const settings = getAppSettings();
  if (!settings.serverUrl || !settings.authToken) {
    return { flushed: [], errors: [] };
  }

  const ps = settings.pendingSync || {};
  const types = Object.keys(ps).filter((type) => ps[type] && localReaders[type]);
  const flushed = [];
  const errors = [];

  for (const type of types) {
    try {
      const doc = localReaders[type]();
      await apiRequest(`/api/portfolio/${type}`, {
        method: 'PUT',
        body: { document: doc }
      });
      setPendingSync(type, false);
      flushed.push(type);
    } catch (error) {
      errors.push({ type, error });
    }
  }

  return { flushed, errors };
};
