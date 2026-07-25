import Fastify from 'fastify';
import cors from '@fastify/cors';
import crypto from 'node:crypto';
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
  getUserAiSettingsRow,
  pickRandomModel,
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
import { fetchOpenRouterModels } from './openrouterModels.js';
import {
  checkSandboxReady,
  disposeAllUserCursorSessions,
  disposeCursorSession,
  getCursorModels,
  runCursorChat
} from './cursorSdkService.js';

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

// GitHub OAuth routes for Copilot
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

// Portfolio documents routes
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

// AI Settings & Models routes
app.get('/api/ai/settings', { preHandler: [app.authenticate] }, async (request) => {
  const row = await getUserAiSettingsRow(request.user.id);
  return sanitizeAiSettings(row);
});

app.put('/api/ai/settings', { preHandler: [app.authenticate] }, async (request, reply) => {
  const provider = String(request.body?.provider || 'openrouter').trim().toLowerCase();
  const apiKey = String(request.body?.apiKey || '').trim();
  const model = String(request.body?.model || '').trim();
  const modelParams = Array.isArray(request.body?.modelParams) ? request.body.modelParams : [];

  try {
    const sanitized = await saveUserAiSettings({
      userId: request.user.id,
      provider,
      apiKey,
      model,
      modelParams
    });
    return sanitized;
  } catch (error) {
    return reply.status(error.statusCode || 400).send({ error: error.message });
  }
});

app.get('/api/ai/models', { preHandler: [app.authenticate] }, async (request, reply) => {
  const provider = String(request.query?.provider || 'openrouter').trim().toLowerCase();
  const resolved = await resolveConfiguredServerApiKey(request.user.id);

  if (provider === 'cursor-sdk') {
    const modelsData = await getCursorModels({ apiKey: resolved.apiKey });
    return modelsData;
  }

  const modelsData = await fetchOpenRouterModels({ apiKey: resolved.apiKey });
  return modelsData;
});

// Production Cursor Session Reset
app.post('/api/ai/cursor-sdk/session/reset', { preHandler: [app.authenticate] }, async (request, reply) => {
  const sessionId = String(request.body?.sessionId || '').trim();
  const all = Boolean(request.body?.all);

  if (all) {
    disposeAllUserCursorSessions(request.user.id);
    return { ok: true, reset: 'all' };
  }

  if (!sessionId) {
    return reply.status(400).send({ error: 'sessionId or all: true is required.' });
  }

  disposeCursorSession(request.user.id, sessionId);
  return { ok: true, sessionId };
});

// Diagnostic & Test routes for Cursor SDK
app.get('/api/ai/cursor-sdk/test/health', { preHandler: [app.authenticate] }, async (request) => {
  const { sandboxReady, cursorDisabledReason } = checkSandboxReady();
  const resolved = await resolveConfiguredServerApiKey(request.user.id);
  const configured = Boolean(resolved.apiKey || config.cursorApiKey);

  return {
    status: 'ok',
    provider: 'cursor-sdk',
    nodeVersion: process.version,
    sandboxReady,
    cursorDisabledReason,
    configured
  };
});

app.get('/api/ai/cursor-sdk/test/models', { preHandler: [app.authenticate] }, async (request) => {
  const resolved = await resolveConfiguredServerApiKey(request.user.id);
  return getCursorModels({ apiKey: resolved.apiKey });
});

app.post('/api/ai/cursor-sdk/test/prompt', { preHandler: [app.authenticate] }, async (request, reply) => {
  const model = String(request.body?.model || config.cursorDefaultModel).trim();
  const modelParams = Array.isArray(request.body?.modelParams) ? request.body.modelParams : [];
  const prompt = String(request.body?.prompt || '').trim();

  if (!prompt) {
    return reply.status(400).send({ error: 'prompt is required.' });
  }

  const tempSessionId = `ephemeral-test-${crypto.randomUUID()}`;
  try {
    const resolved = await resolveConfiguredServerApiKey(request.user.id);
    const result = await runCursorChat({
      userId: request.user.id,
      sessionId: tempSessionId,
      model,
      modelParams,
      messages: [{ role: 'user', content: prompt }],
      apiKey: resolved.apiKey
    });
    return result;
  } catch (error) {
    return reply.status(error.statusCode || 500).send({
      error: error.message || 'Test prompt execution failed.',
      retryable: error.isRetryable ?? false,
      agentId: error.agentId || null,
      runId: error.runId || null
    });
  } finally {
    disposeCursorSession(request.user.id, tempSessionId);
  }
});

app.post('/api/ai/cursor-sdk/test/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
  const model = String(request.body?.model || config.cursorDefaultModel).trim();
  const modelParams = Array.isArray(request.body?.modelParams) ? request.body.modelParams : [];
  const sessionId = String(request.body?.sessionId || `test-session-${crypto.randomUUID()}`).trim();
  const messages = request.body?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.status(400).send({ error: 'messages[] is required.' });
  }

  try {
    const resolved = await resolveConfiguredServerApiKey(request.user.id);
    const result = await runCursorChat({
      userId: request.user.id,
      sessionId,
      model,
      modelParams,
      messages,
      apiKey: resolved.apiKey,
      clientAgentId: request.body?.agentId || null
    });
    return result;
  } catch (error) {
    return reply.status(error.statusCode || 500).send({
      error: error.message || 'Test chat execution failed.',
      retryable: error.isRetryable ?? false,
      agentId: error.agentId || null,
      runId: error.runId || null
    });
  }
});

app.post('/api/ai/cursor-sdk/test/session/reset', { preHandler: [app.authenticate] }, async (request, reply) => {
  const sessionId = String(request.body?.sessionId || '').trim();
  const all = Boolean(request.body?.all);
  if (all) {
    disposeAllUserCursorSessions(request.user.id);
    return { ok: true, reset: 'all' };
  }
  disposeCursorSession(request.user.id, sessionId);
  return { ok: true, sessionId };
});

// Copilot SDK test routes (retained as required by §1 & §2)
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
    return { provider: 'copilot-sdk', ...payload };
  } catch (error) {
    return reply.status(400).send({ error: error.message || 'Copilot SDK user status failed.' });
  }
});

app.get('/api/ai/copilot-sdk/test/models', { preHandler: [app.authenticate] }, async (request, reply) => {
  try {
    await getCopilotSdkHealth(request.user.id);
    const models = await listCopilotSdkModels(request.user.id);
    return { provider: 'copilot-sdk', count: Array.isArray(models) ? models.length : 0, models };
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
      meta: { latencyMs: completion.latencyMs, respondedAt: new Date().toISOString() },
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
    return { provider: 'copilot-sdk', ...result };
  } catch (error) {
    return reply.status(500).send({ error: error.message || 'Failed to reset Copilot SDK session.' });
  }
});

app.delete('/api/ai/copilot-sdk/oauth', { preHandler: [app.authenticate] }, async (request, reply) => {
  try {
    await deleteUserGitHubOAuth(request.user.id);
    await disconnectCopilotSdkUser(request.user.id);
    return { ok: true, message: 'GitHub OAuth token removed for this user.' };
  } catch (error) {
    return reply.status(500).send({ error: error.message || 'Failed to remove GitHub OAuth token.' });
  }
});

// Unified POST /api/ai/chat handler supporting OpenRouter and Cursor SDK with optional SSE streaming
app.post('/api/ai/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
  const provider = String(request.body?.provider || 'openrouter').trim().toLowerCase();
  const messages = request.body?.messages;
  let requestedModel = String(request.body?.model || '').trim();
  const modelParams = Array.isArray(request.body?.modelParams) ? request.body.modelParams : [];
  const mode = String(request.body?.mode || 'manual').trim().toLowerCase();
  const isSse = Boolean(
    request.body?.stream === true ||
    (request.headers.accept && request.headers.accept.includes('text/event-stream'))
  );

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.status(400).send({ error: 'messages[] is required.' });
  }

  const resolved = await resolveConfiguredServerApiKey(request.user.id);

  if (provider === 'cursor-sdk') {
    const sessionId = String(request.body?.cursor?.sessionId || request.body?.sessionId || '').trim();
    if (!sessionId) {
      return reply.status(400).send({ error: 'cursor.sessionId is required for provider cursor-sdk.' });
    }

    let finalModel = requestedModel;
    let finalParams = modelParams;

    if (mode === 'auto' || !finalModel) {
      const liveModelsData = await getCursorModels({ apiKey: resolved.apiKey });
      const liveList = liveModelsData?.models || [];
      const defaultMatch = liveList.find((m) => m.model_id === config.cursorDefaultModel) || liveList[0];
      finalModel = defaultMatch ? defaultMatch.model_id : config.cursorDefaultModel;

      if (defaultMatch?.variants && defaultMatch.variants.length > 0 && finalParams.length === 0) {
        const defaultVar = defaultMatch.variants.find((v) => v.isDefault) || defaultMatch.variants[0];
        if (defaultVar?.parameters) {
          finalParams = defaultVar.parameters;
        }
      }
    }

    if (isSse) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      const sendEvent = (event, data) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent('meta', {
        provider: 'cursor-sdk',
        model: finalModel,
        modelParams: finalParams,
        sessionId
      });

      try {
        const result = await runCursorChat({
          userId: request.user.id,
          sessionId,
          model: finalModel,
          modelParams: finalParams,
          messages,
          apiKey: resolved.apiKey,
          clientAgentId: request.body?.cursor?.agentId || null,
          onDelta: (text) => {
            sendEvent('delta', { text });
          }
        });

        sendEvent('done', result);
      } catch (err) {
        sendEvent('error', {
          error: err.message || 'Cursor agent execution failed',
          retryable: err.isRetryable ?? false,
          agentId: err.agentId || null,
          runId: err.runId || null
        });
      } finally {
        reply.raw.end();
      }
      return;
    }

    // Non-SSE path
    try {
      const result = await runCursorChat({
        userId: request.user.id,
        sessionId,
        model: finalModel,
        modelParams: finalParams,
        messages,
        apiKey: resolved.apiKey,
        clientAgentId: request.body?.cursor?.agentId || null
      });
      return result;
    } catch (err) {
      return reply.status(err.statusCode || 500).send({
        error: err.message || 'Cursor agent execution failed',
        retryable: err.isRetryable ?? false,
        agentId: err.agentId || null,
        runId: err.runId || null
      });
    }
  }

  // OpenRouter provider branch
  if (provider === 'openrouter') {
    const effectiveApiKey = String(config.openRouterApiKey || '').trim() || resolved.apiKey;
    if (!effectiveApiKey) {
      return reply.status(400).send({ error: 'Server AI is not configured. Set OPENROUTER_API_KEY on the backend or in Settings.' });
    }

    const liveModelsData = await fetchOpenRouterModels({ apiKey: effectiveApiKey });
    const modelsList = liveModelsData?.models || [];
    const selectedModel =
      mode === 'auto'
        ? pickRandomModel(modelsList)
        : (requestedModel || resolved.model || DEFAULT_AI_MODEL);

    if (isSse) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      const sendEvent = (event, data) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent('meta', {
        provider: 'openrouter',
        model: selectedModel,
        modelParams
      });

      try {
        const completion = await requestOpenRouterCompletion({
          apiKey: effectiveApiKey,
          model: selectedModel,
          messages,
          stream: true,
          onDelta: (text) => {
            sendEvent('delta', { text });
          }
        });

        const successBody = {
          provider: 'openrouter',
          model: completion.model || selectedModel,
          modelParams,
          message: completion.message,
          meta: {
            mode: mode === 'auto' ? 'auto' : 'manual',
            latencyMs: completion.latencyMs,
            respondedAt: new Date().toISOString(),
            source: String(config.openRouterApiKey || '').trim() ? 'server-env' : 'user-settings'
          }
        };

        sendEvent('done', successBody);
      } catch (err) {
        sendEvent('error', {
          error: err.message || 'OpenRouter request failed.',
          retryable: true
        });
      } finally {
        reply.raw.end();
      }
      return;
    }

    // Non-SSE OpenRouter path
    try {
      const completion = await requestOpenRouterCompletion({
        apiKey: effectiveApiKey,
        model: selectedModel,
        messages
      });

      return {
        provider: 'openrouter',
        model: completion.model || selectedModel,
        modelParams,
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
  }

  return reply.status(400).send({ error: `Unsupported provider '${provider}'.` });
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
