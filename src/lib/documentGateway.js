import { getAppSettings } from './appSettings.js';
import {
  apiRequest,
  AuthRequiredError,
  getConnectionState as getServerConnectionState,
  getStoredConnectionState as getStoredServerConnectionState,
  login as loginWithServer,
  logout as logoutFromServer,
  signup as signupWithServer
} from './serverClient.js';

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

export const loadDocument = async (type, { readLocal, createDefault }) => {
  if (!isServerModeEnabled()) {
    return readLocal();
  }

  const settings = getAppSettings();
  if (!settings.authToken) {
    throw new AuthRequiredError();
  }

  const data = await apiRequest(`/api/portfolio/${type}`);
  return data?.document || createDefault();
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

  const data = await apiRequest(`/api/portfolio/${type}`, {
    method: 'PUT',
    body: { document }
  });

  return data?.document || document;
};

export const uploadDocument = async (type, document) => {
  const settings = getAppSettings();
  if (!settings.serverUrl || !settings.authToken) {
    throw new AuthRequiredError();
  }

  const data = await apiRequest(`/api/portfolio/${type}`, {
    method: 'PUT',
    body: { document }
  });

  return data?.document || document;
};
