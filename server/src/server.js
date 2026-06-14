import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  createToken,
  findUserByEmail,
  findUserById,
  hashPassword,
  normalizeEmail,
  sanitizeUser,
  verifyPassword,
  verifyToken
} from './auth.js';
import { assertConfig, config } from './config.js';
import {
  buildGitHubOAuthAuthorizeUrl,
  exchangeGitHubOAuthCodeForToken,
  fetchGitHubUserProfile,
  verifyGitHubOrgMembership,
  verifySignedOAuthState
} from './githubOAuth.js';
import { deleteUserGitHubOAuth, getUserGitHubOAuth, saveUserGitHubOAuth } from './githubOAuthStore.js';
import { getDb } from './db.js';
import {
  getPortfolioDocument,
  isSupportedDocumentType,
  savePortfolioDocument,
  validateDocumentShape
} from './documents.js';
import {
  DEFAULT_AI_MODEL,
  getOpenRouterModels,
  pickRandomModel,
  getUserAiSettingsRow,
  requestGitHubCopilotCompletion,
  requestGitHubCopilotModels,
  requestOpenRouterCompletion,
  resolveConfiguredServerApiKey,
  sanitizeAiSettings,
  saveUserAiSettings
} from './ai.js';
import {
  disconnectCopilotSdkUser,
  getCopilotSdkAuthStatus,
  getCopilotSdkHealth,
  listCopilotSdkModels,
  resetCopilotSdkSession,
  sendCopilotSdkChat
} from './copilotSdkService.js';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: config.corsOrigin === '*' ? true : config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.validation) {
    return reply.status(400).send({ error: 'Invalid request payload.' });
  }

  if (reply.sent) {
    return;
  }

  reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal server error.'
  });
});

app.decorateRequest('user', null);

app.decorate('authenticate', async function authenticate(request, reply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing bearer token.' });
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = verifyToken(token);
    const user = await findUserById(Number.parseInt(payload.sub, 10));
    if (!user) {
      return reply.status(401).send({ error: 'Invalid session.' });
    }
    request.user = sanitizeUser(user);
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token.' });
  }
});

app.get('/api/health', async () => ({ ok: true }));

app.post('/api/auth/signup', async (request, reply) => {
  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password || '');

  if (!email || !email.includes('@')) {
    return reply.status(400).send({ error: 'A valid email is required.' });
  }

  if (password.length < 8) {
    return reply.status(400).send({ error: 'Password must be at least 8 characters.' });
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return reply.status(409).send({ error: 'Email is already registered.' });
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const result = await db.run(
    'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
    email,
    passwordHash,
    now
  );

  const user = {
    id: result.lastID,
    email
  };

  return reply.status(201).send({
    token: createToken(user),
    user: sanitizeUser(user)
  });
});

app.post('/api/auth/login', async (request, reply) => {
  const email = normalizeEmail(request.body?.email);
  const password = String(request.body?.password || '');

  if (!email || !password) {
    return reply.status(400).send({ error: 'Email and password are required.' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return reply.status(401).send({ error: 'Invalid credentials.' });
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    return reply.status(401).send({ error: 'Invalid credentials.' });
  }

  return {
    token: createToken(user),
    user: sanitizeUser(user)
  };
});

app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (request) => {
  return {
    user: request.user
  };
});

app.get('/api/ai/copilot-sdk/oauth/start', { preHandler: [app.authenticate] }, async (request, reply) => {
  if (!config.githubOauthClientId || !config.githubOauthClientSecret || !config.githubOauthRedirectUri) {
    return reply.status(400).send({
      error: 'GitHub OAuth is not configured. Set GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, and GITHUB_OAUTH_REDIRECT_URI.'
    });
  }

  const oauth = buildGitHubOAuthAuthorizeUrl({ userId: request.user.id });
  return {
    authorizeUrl: oauth.authorizeUrl,
    state: oauth.state
  };
});

app.get('/api/ai/copilot-sdk/oauth/callback', async (request, reply) => {
  const code = String(request.query?.code || '').trim();
  const state = String(request.query?.state || '').trim();

  if (!code || !state) {
    return reply.status(400).send({ error: 'OAuth callback requires code and state.' });
  }

  try {
    const verified = verifySignedOAuthState(state);
    const token = await exchangeGitHubOAuthCodeForToken({ code });

    if (!token.accessToken) {
      return reply.status(400).send({ error: 'GitHub OAuth token exchange returned an empty access token.' });
    }

    const profile = await fetchGitHubUserProfile({ token: token.accessToken });
    const orgAllowed = await verifyGitHubOrgMembership({
      token: token.accessToken,
      requiredOrg: config.githubOauthRequiredOrg
    });

    if (!orgAllowed) {
      return reply.status(403).send({
        error: `User is not a member of required organization ${config.githubOauthRequiredOrg}.`
      });
    }

    await saveUserGitHubOAuth({
      userId: verified.userId,
      accessToken: token.accessToken,
      tokenType: token.tokenType,
      scope: token.scope,
      refreshToken: token.refreshToken,
      expiresIn: token.expiresIn,
      refreshTokenExpiresIn: token.refreshTokenExpiresIn,
      githubLogin: profile.login,
      githubId: profile.id
    });

    await disconnectCopilotSdkUser(verified.userId);

    return {
      ok: true,
      userId: verified.userId,
      githubLogin: profile.login,
      scope: token.scope || null
    };
  } catch (error) {
    return reply.status(400).send({ error: error.message || 'GitHub OAuth callback failed.' });
  }
});

app.get('/api/portfolio/:type', { preHandler: [app.authenticate] }, async (request, reply) => {
  const type = request.params.type;

  if (!isSupportedDocumentType(type)) {
    return reply.status(404).send({ error: 'Unknown document type.' });
  }

  return getPortfolioDocument(request.user.id, type);
});

app.put('/api/portfolio/:type', { preHandler: [app.authenticate] }, async (request, reply) => {
  const type = request.params.type;

  if (!isSupportedDocumentType(type)) {
    return reply.status(404).send({ error: 'Unknown document type.' });
  }

  const document = request.body?.document;
  const validationError = validateDocumentShape(type, document);
  if (validationError) {
    return reply.status(400).send({ error: validationError });
  }

  return savePortfolioDocument(request.user.id, type, document);
});

app.get('/api/ai/settings', { preHandler: [app.authenticate] }, async (request) => {
  const row = await getUserAiSettingsRow(request.user.id);
  const payload = sanitizeAiSettings(row);
  const envConfigured = Boolean(String(config.openRouterApiKey || '').trim());
  return {
    ...payload,
    configured: envConfigured || payload.configured
  };
});

app.get('/api/ai/models', { preHandler: [app.authenticate] }, async () => {
  return {
    provider: 'openrouter',
    defaultModel: DEFAULT_AI_MODEL,
    models: getOpenRouterModels()
  };
});

app.get('/api/ai/copilot-sdk/test/health', { preHandler: [app.authenticate] }, async (request) => {
  const oauthRecord = await getUserGitHubOAuth(request.user.id);
  const configured = Boolean(String(oauthRecord?.access_token || '').trim());

  return {
    provider: 'copilot-sdk',
    configured,
    oauthConfigured: Boolean(config.githubOauthClientId && config.githubOauthClientSecret && config.githubOauthRedirectUri),
    requiredOrg: config.githubOauthRequiredOrg || null,
    githubLogin: oauthRecord?.github_login || null,
    tokenScope: oauthRecord?.scope || null
  };
});

app.get('/api/ai/copilot-sdk/test/user', { preHandler: [app.authenticate] }, async (request, reply) => {
  try {
    const payload = await getCopilotSdkAuthStatus(request.user.id);
    return {
      provider: 'copilot-sdk',
      ...payload
    };
  } catch (error) {
    return reply.status(400).send({ error: error.message || 'Copilot SDK user status failed.' });
  }
});

app.get('/api/ai/copilot-sdk/test/models', { preHandler: [app.authenticate] }, async (request, reply) => {
  try {
    await getCopilotSdkHealth(request.user.id);
    const models = await listCopilotSdkModels(request.user.id);

    return {
      provider: 'copilot-sdk',
      count: Array.isArray(models) ? models.length : 0,
      models
    };
  } catch (error) {
    return reply.status(502).send({ error: error.message || 'Copilot SDK models request failed.' });
  }
});

app.post('/api/ai/copilot-sdk/test/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
  const model = String(request.body?.model || '').trim();
  const sessionId = String(request.body?.sessionId || '').trim();
  const prompt = String(request.body?.prompt || '').trim();
  const messages = request.body?.messages;

  if (!prompt && !Array.isArray(messages)) {
    return reply.status(400).send({ error: 'prompt or messages[] is required.' });
  }

  try {
    const completion = await sendCopilotSdkChat({
      userId: request.user.id,
      model,
      sessionId,
      prompt,
      messages
    });

    return {
      provider: 'copilot-sdk',
      model: completion.model,
      sessionId: completion.sessionId,
      message: completion.message,
      meta: {
        latencyMs: completion.latencyMs,
        respondedAt: new Date().toISOString()
      },
      raw: completion.rawEvent
    };
  } catch (error) {
    return reply.status(502).send({ error: error.message || 'Copilot SDK chat request failed.' });
  }
});

app.post('/api/ai/copilot-sdk/test/session/reset', { preHandler: [app.authenticate] }, async (request, reply) => {
  try {
    const sessionId = String(request.body?.sessionId || '').trim();
    const result = await resetCopilotSdkSession({ userId: request.user.id, sessionId });
    return {
      provider: 'copilot-sdk',
      ...result
    };
  } catch (error) {
    return reply.status(500).send({ error: error.message || 'Failed to reset Copilot SDK session.' });
  }
});

app.delete('/api/ai/copilot-sdk/oauth', { preHandler: [app.authenticate] }, async (request, reply) => {
  try {
    await deleteUserGitHubOAuth(request.user.id);
    await disconnectCopilotSdkUser(request.user.id);

    return {
      ok: true,
      message: 'GitHub OAuth token removed for this user.'
    };
  } catch (error) {
    return reply.status(500).send({ error: error.message || 'Failed to remove GitHub OAuth token.' });
  }
});

app.get('/api/ai/copilot/test/health', { preHandler: [app.authenticate] }, async () => {
  const configured = Boolean(String(config.githubCopilotApiKey || '').trim());

  return {
    provider: 'github-copilot-models',
    configured,
    baseUrl: config.githubCopilotBaseUrl,
    apiVersion: config.githubCopilotApiVersion,
    defaultModel: config.githubCopilotModel,
    org: config.githubCopilotOrg || null,
    message: configured
      ? 'GitHub Copilot credentials are configured on the server.'
      : 'Set GITHUB_COPILOT_API_KEY in server/.env to enable Copilot test APIs.'
  };
});

app.get('/api/ai/copilot/test/models', { preHandler: [app.authenticate] }, async (request, reply) => {
  const apiKey = String(config.githubCopilotApiKey || '').trim();
  if (!apiKey) {
    return reply.status(400).send({ error: 'GITHUB_COPILOT_API_KEY is not configured on the backend.' });
  }

  try {
    const models = await requestGitHubCopilotModels({
      apiKey,
      baseUrl: config.githubCopilotBaseUrl,
      apiVersion: config.githubCopilotApiVersion,
      org: config.githubCopilotOrg
    });

    return {
      provider: 'github-copilot-models',
      count: models.length,
      models
    };
  } catch (error) {
    return reply.status(502).send({ error: error.message || 'GitHub Copilot models request failed.' });
  }
});

app.post('/api/ai/copilot/test/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
  const messages = request.body?.messages;
  const requestedModel = String(request.body?.model || '').trim();

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.status(400).send({ error: 'messages[] is required.' });
  }

  const apiKey = String(config.githubCopilotApiKey || '').trim();
  if (!apiKey) {
    return reply.status(400).send({ error: 'GITHUB_COPILOT_API_KEY is not configured on the backend.' });
  }

  try {
    const completion = await requestGitHubCopilotCompletion({
      apiKey,
      baseUrl: config.githubCopilotBaseUrl,
      apiVersion: config.githubCopilotApiVersion,
      org: config.githubCopilotOrg,
      model: requestedModel || config.githubCopilotModel,
      messages
    });

    return {
      provider: 'github-copilot-models',
      model: completion.model,
      message: completion.message,
      meta: {
        latencyMs: completion.latencyMs,
        respondedAt: new Date().toISOString(),
        org: config.githubCopilotOrg || null,
        apiVersion: config.githubCopilotApiVersion
      },
      raw: completion.raw
    };
  } catch (error) {
    return reply.status(502).send({ error: error.message || 'GitHub Copilot chat request failed.' });
  }
});

app.put('/api/ai/settings', { preHandler: [app.authenticate] }, async (request, reply) => {
  const provider = String(request.body?.provider || 'openrouter').trim().toLowerCase();
  const apiKey = String(request.body?.apiKey || '').trim();
  const model = String(request.body?.model || DEFAULT_AI_MODEL).trim();

  if (provider !== 'openrouter') {
    return reply.status(400).send({ error: 'Only OpenRouter provider is currently supported.' });
  }

  if (!apiKey || !apiKey.startsWith('sk-or-')) {
    return reply.status(400).send({ error: 'A valid OpenRouter API key is required.' });
  }

  const row = await saveUserAiSettings({
    userId: request.user.id,
    provider,
    apiKey,
    model
  });

  return sanitizeAiSettings(row);
});

app.post('/api/ai/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
  const provider = String(request.body?.provider || 'openrouter').trim().toLowerCase();
  const messages = request.body?.messages;
  const requestedModel = String(request.body?.model || '').trim();
  const mode = String(request.body?.mode || 'manual').trim().toLowerCase();

  if (provider !== 'openrouter') {
    return reply.status(400).send({ error: 'Only OpenRouter provider is currently supported.' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.status(400).send({ error: 'messages[] is required.' });
  }

  const resolved = await resolveConfiguredServerApiKey(request.user.id);
  const effectiveApiKey = String(config.openRouterApiKey || '').trim() || resolved.apiKey;
  if (!effectiveApiKey) {
    return reply.status(400).send({ error: 'Server AI is not configured. Set OPENROUTER_API_KEY on the backend.' });
  }

  const models = getOpenRouterModels();
  const selectedModel =
    mode === 'auto'
      ? pickRandomModel(models)
      : requestedModel || resolved.model || DEFAULT_AI_MODEL;

  try {
    const completion = await requestOpenRouterCompletion({
      apiKey: effectiveApiKey,
      model: selectedModel,
      messages
    });

    return {
      provider: 'openrouter',
      model: completion.model || selectedModel,
      message: completion.message,
      meta: {
        mode: mode === 'auto' ? 'auto' : 'manual',
        latencyMs: completion.latencyMs,
        respondedAt: new Date().toISOString(),
        source: String(config.openRouterApiKey || '').trim() ? 'server-env' : 'user-settings'
      }
    };
  } catch (error) {
    return reply.status(502).send({ error: error.message || 'OpenRouter request failed.' });
  }
});

async function start() {
  assertConfig();
  await getDb();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server listening on port ${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
