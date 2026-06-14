import { CopilotClient, approveAll } from '@github/copilot-sdk';
import { config } from './config.js';
import { getUserGitHubOAuth } from './githubOAuthStore.js';

const userClients = new Map();
const userSessions = new Map();

const getClientCacheKey = (userId) => String(userId);
const getSessionCacheKey = (userId, sessionId) => `${userId}:${sessionId}`;

const toPromptFromMessages = (messages = []) =>
  messages
    .map((message) => {
      const role = String(message?.role || 'user').toUpperCase();
      const content = String(message?.content || '').trim();
      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join('\n\n');

const ensureUserOAuthToken = async (userId) => {
  const row = await getUserGitHubOAuth(userId);
  const token = String(row?.access_token || '').trim();

  if (!token) {
    throw new Error('GitHub OAuth token is not configured for this user. Complete OAuth first.');
  }

  return {
    token,
    login: String(row?.github_login || ''),
    scope: String(row?.scope || ''),
    provider: String(row?.provider || 'github-oauth')
  };
};

const getOrCreateClient = async (userId) => {
  const key = getClientCacheKey(userId);
  if (userClients.has(key)) {
    return userClients.get(key);
  }

  const oauth = await ensureUserOAuthToken(userId);
  const client = new CopilotClient({
    githubToken: oauth.token,
    useLoggedInUser: false,
    autoStart: true,
    logLevel: config.copilotSdkLogLevel
  });

  userClients.set(key, client);
  return client;
};

const getOrCreateSession = async ({ userId, sessionId, model }) => {
  const resolvedSessionId = String(sessionId || `user-${userId}-default`).trim();
  const sessionKey = getSessionCacheKey(userId, resolvedSessionId);

  if (userSessions.has(sessionKey)) {
    return userSessions.get(sessionKey);
  }

  const client = await getOrCreateClient(userId);
  const session = await client.createSession({
    sessionId: resolvedSessionId,
    model: String(model || config.githubCopilotModel || '').trim() || undefined,
    onPermissionRequest: approveAll
  });

  userSessions.set(sessionKey, session);
  return session;
};

export const getCopilotSdkHealth = async (userId) => {
  const oauth = await ensureUserOAuthToken(userId);

  return {
    configured: true,
    provider: oauth.provider,
    githubLogin: oauth.login || null,
    scope: oauth.scope || null
  };
};

export const getCopilotSdkAuthStatus = async (userId) => {
  const client = await getOrCreateClient(userId);
  const status = await client.getAuthStatus();
  const oauth = await ensureUserOAuthToken(userId);

  return {
    sdkAuth: status,
    tokenScope: oauth.scope || null,
    githubLogin: oauth.login || null
  };
};

export const listCopilotSdkModels = async (userId) => {
  const client = await getOrCreateClient(userId);
  return client.listModels();
};

export const sendCopilotSdkChat = async ({ userId, model, sessionId, prompt, messages }) => {
  const resolvedPrompt = String(prompt || '').trim() || toPromptFromMessages(messages);
  if (!resolvedPrompt) {
    throw new Error('prompt or messages[] is required.');
  }

  const session = await getOrCreateSession({ userId, sessionId, model });
  const startedAt = Date.now();
  const event = await session.sendAndWait({ prompt: resolvedPrompt });

  return {
    model: String(model || config.githubCopilotModel || '').trim() || null,
    message: event?.data?.content || '',
    latencyMs: Date.now() - startedAt,
    sessionId: session.sessionId,
    rawEvent: event || null
  };
};

export const resetCopilotSdkSession = async ({ userId, sessionId }) => {
  const resolvedSessionId = String(sessionId || `user-${userId}-default`).trim();
  const sessionKey = getSessionCacheKey(userId, resolvedSessionId);
  const session = userSessions.get(sessionKey);

  if (session) {
    await session.disconnect().catch(() => undefined);
    userSessions.delete(sessionKey);
  }

  return {
    sessionId: resolvedSessionId,
    reset: true
  };
};

export const disconnectCopilotSdkUser = async (userId) => {
  const id = String(userId);

  const sessionEntries = [...userSessions.entries()].filter(([key]) => key.startsWith(`${id}:`));
  for (const [key, session] of sessionEntries) {
    await session.disconnect().catch(() => undefined);
    userSessions.delete(key);
  }

  const client = userClients.get(id);
  if (client) {
    await client.stop().catch(() => undefined);
    userClients.delete(id);
  }
};
