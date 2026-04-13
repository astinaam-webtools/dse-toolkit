import { getAppSettings } from './appSettings.js';
import { apiRequest, AuthRequiredError } from './serverClient.js';

export const isServerModeEnabled = () => Boolean(getAppSettings().serverUrl);

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
