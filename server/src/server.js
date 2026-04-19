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
  requestOpenRouterCompletion,
  sanitizeAiSettings,
  saveUserAiSettings
} from './ai.js';

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
  return sanitizeAiSettings(row);
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

  if (provider !== 'openrouter') {
    return reply.status(400).send({ error: 'Only OpenRouter provider is currently supported.' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply.status(400).send({ error: 'messages[] is required.' });
  }

  const row = await getUserAiSettingsRow(request.user.id);
  if (!row?.api_key) {
    return reply.status(400).send({ error: 'Server AI is not configured. Save an OpenRouter API key in Settings first.' });
  }

  try {
    const completion = await requestOpenRouterCompletion({
      apiKey: row.api_key,
      model: requestedModel || row.model || DEFAULT_AI_MODEL,
      messages
    });

    return {
      provider: 'openrouter',
      model: requestedModel || row.model || DEFAULT_AI_MODEL,
      message: completion.message
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
