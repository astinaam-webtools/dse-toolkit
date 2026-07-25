import crypto from 'node:crypto';
import fs from 'node:fs';
import { config } from './config.js';
import { ensureSession, resetSession, resetAllSessions } from './cursorWorkspace.js';
import { normalizeCursorModels } from '../../src/lib/modelNormalize.js';

// Dynamically or safely import @cursor/sdk
let CursorSDK = null;
let JsonlLocalAgentStore = null;

try {
  const sdk = await import('@cursor/sdk');
  CursorSDK = sdk.Cursor || sdk.default?.Cursor || sdk;
  JsonlLocalAgentStore = sdk.JsonlLocalAgentStore || sdk.default?.JsonlLocalAgentStore;
} catch (err) {
  console.warn('[@cursor/sdk] Module failed to load at startup:', err.message);
}

// In-memory caches and tracking
const agentCache = new Map(); // key: userId:sessionId -> { agentId, cwd, storePath, model, modelParams, lastUsed, agentInstance }
const userActiveRuns = new Map(); // key: userId -> Set of runPromises
const userHourlyRequests = new Map(); // key: userId -> Array of timestamps
const modelsCache = new Map(); // key: provider:apiKeyFingerprint -> { timestamp, data }

const MODELS_CACHE_TTL = 10 * 60 * 1000; // 10 mins
const AGENT_IDLE_TTL = config.cursorAgentCacheTtlMs; // 30 mins
const AGENT_MAX_CAPACITY = config.cursorAgentCacheMax; // 50

function getApiKeyFingerprint(apiKey) {
  if (!apiKey) return 'none';
  if (apiKey.length < 8) return apiKey;
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

/**
 * Checks if sandbox capability is available on the system.
 */
export function checkSandboxReady() {
  if (!config.cursorRequireSandbox) {
    return { sandboxReady: true, cursorDisabledReason: null };
  }

  // Bubblewrap check or SDK availability check
  try {
    const hasBubblewrap = fs.existsSync('/usr/bin/bwrap') || fs.existsSync('/usr/local/bin/bwrap');
    if (!hasBubblewrap) {
      // Check PATH for bwrap
      const envPath = process.env.PATH || '';
      const inPath = envPath.split(':').some((dir) => fs.existsSync(`${dir}/bwrap`));
      if (!inPath) {
        return {
          sandboxReady: false,
          cursorDisabledReason: 'Sandbox unavailable (bubblewrap binary not found in PATH)'
        };
      }
    }
    return { sandboxReady: true, cursorDisabledReason: null };
  } catch (err) {
    return {
      sandboxReady: false,
      cursorDisabledReason: `Sandbox check failed: ${err.message}`
    };
  }
}

/**
 * Fetches and normalizes Cursor SDK models list.
 */
export async function getCursorModels({ apiKey } = {}) {
  const effectiveKey = apiKey || config.cursorApiKey;
  const fingerprint = getApiKeyFingerprint(effectiveKey);
  const cacheKey = `cursor:${fingerprint}`;

  const cached = modelsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MODELS_CACHE_TTL) {
    return cached.data;
  }

  if (CursorSDK && typeof CursorSDK.models?.list === 'function' && effectiveKey) {
    try {
      const rawModels = await CursorSDK.models.list({ apiKey: effectiveKey });
      if (Array.isArray(rawModels) && rawModels.length > 0) {
        const normalized = normalizeCursorModels(rawModels);
        const result = {
          provider: 'cursor-sdk',
          defaultModel: config.cursorDefaultModel,
          source: 'live',
          models: normalized
        };
        modelsCache.set(cacheKey, { timestamp: Date.now(), data: result });
        return result;
      }
    } catch (err) {
      console.warn('[@cursor/sdk] Cursor.models.list failed:', err.message);
    }
  }

  // Soft fallback single model
  const fallbackModel = {
    model_id: config.cursorDefaultModel,
    model_name: config.cursorDefaultModel,
    description: 'Default Cursor agent model',
    context_length: null,
    pricing: null,
    capabilities: {
      reasoning: true,
      tools: true,
      modalities: ['text']
    },
    parameters: [
      { id: 'fast', name: 'Fast Mode', type: 'boolean', default: 'true' }
    ],
    variants: []
  };

  const result = {
    provider: 'cursor-sdk',
    defaultModel: config.cursorDefaultModel,
    source: 'fallback',
    models: [fallbackModel]
  };

  modelsCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}

/**
 * Evicts old or excess agent entries from the cache.
 */
function evictAgentCache() {
  const now = Date.now();

  // Remove expired items
  for (const [key, item] of agentCache.entries()) {
    if (now - item.lastUsed > AGENT_IDLE_TTL) {
      if (item.agentInstance && typeof item.agentInstance.dispose === 'function') {
        try { item.agentInstance.dispose(); } catch (_) {}
      }
      agentCache.delete(key);
    }
  }

  // Cap capacity
  if (agentCache.size >= AGENT_MAX_CAPACITY) {
    const sorted = Array.from(agentCache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const toRemove = sorted.slice(0, agentCache.size - AGENT_MAX_CAPACITY + 1);
    for (const [key, item] of toRemove) {
      if (item.agentInstance && typeof item.agentInstance.dispose === 'function') {
        try { item.agentInstance.dispose(); } catch (_) {}
      }
      agentCache.delete(key);
    }
  }
}

/**
 * Checks rate limits and concurrency caps for a user.
 */
function checkUserLimits(userId) {
  const now = Date.now();

  // Hourly request rate limit (max 30/hr)
  let timestamps = userHourlyRequests.get(userId) || [];
  timestamps = timestamps.filter((t) => now - t < 3600 * 1000);
  if (timestamps.length >= config.cursorMaxRequestsPerUserHour) {
    const err = new Error(`Rate limit exceeded: Max ${config.cursorMaxRequestsPerUserHour} Cursor chat requests per hour`);
    err.statusCode = 429;
    throw err;
  }

  // Active concurrent runs limit (max 2)
  const activeRuns = userActiveRuns.get(userId) || new Set();
  if (activeRuns.size >= config.cursorMaxConcurrentPerUser) {
    const err = new Error(`Concurrency limit reached: Max ${config.cursorMaxConcurrentPerUser} in-flight Cursor runs allowed`);
    err.statusCode = 429;
    throw err;
  }

  timestamps.push(now);
  userHourlyRequests.set(userId, timestamps);
}

/**
 * Executes a chat prompt against Cursor SDK local agent.
 */
export async function runCursorChat({
  userId,
  sessionId,
  model = config.cursorDefaultModel,
  modelParams = [],
  messages = [],
  apiKey = '',
  clientAgentId = null,
  onDelta = null
}) {
  if (!userId) {
    const err = new Error('userId is required');
    err.statusCode = 400;
    throw err;
  }
  if (!sessionId) {
    const err = new Error('sessionId is required for provider cursor-sdk');
    err.statusCode = 400;
    throw err;
  }

  const { sandboxReady, cursorDisabledReason } = checkSandboxReady();
  if (!sandboxReady) {
    const err = new Error(`Cursor provider disabled: ${cursorDisabledReason}`);
    err.statusCode = 400;
    throw err;
  }

  const effectiveKey = apiKey || config.cursorApiKey;
  if (!effectiveKey) {
    const err = new Error('Cursor API key is not configured');
    err.statusCode = 400;
    throw err;
  }

  checkUserLimits(userId);

  const cacheKey = `${userId}:${sessionId}`;
  evictAgentCache();

  let cached = agentCache.get(cacheKey);

  // Validate clientAgentId corroboration if supplied
  if (clientAgentId && cached && cached.agentId !== clientAgentId) {
    const err = new Error(`Forbidden: Supplied agentId '${clientAgentId}' does not match session agentId '${cached.agentId}'`);
    err.statusCode = 403;
    throw err;
  }

  const paramsStringified = JSON.stringify(modelParams || []);
  const isModelOrParamsChanged = cached && (cached.model !== model || JSON.stringify(cached.modelParams) !== paramsStringified);

  let isFollowUpTurn = Boolean(cached && !isModelOrParamsChanged);

  if (cached && isModelOrParamsChanged) {
    // Model or params changed -> dispose previous agent
    if (cached.agentInstance && typeof cached.agentInstance.dispose === 'function') {
      try { cached.agentInstance.dispose(); } catch (_) {}
    }
    agentCache.delete(cacheKey);
    cached = null;
    isFollowUpTurn = false;
  }

  const workspace = ensureSession(userId, sessionId);

  let agentId = cached?.agentId;
  let agentInstance = cached?.agentInstance;

  if (!agentInstance) {
    agentId = `agent-${crypto.randomUUID()}`;
    const store = JsonlLocalAgentStore
      ? new JsonlLocalAgentStore({ path: workspace.storePath })
      : null;

    if (CursorSDK && typeof CursorSDK.createAgent === 'function') {
      try {
        agentInstance = await CursorSDK.createAgent({
          apiKey: effectiveKey,
          model: model,
          local: {
            cwd: workspace.cwd,
            store: store || workspace.storePath,
            sandboxOptions: { enabled: true },
            settingSources: []
          },
          hooks: {
            beforeShellExecution: async () => ({ status: 'deny' })
          }
        });
      } catch (err) {
        const error = new Error(`Cursor agent initialization failed: ${err.message}`);
        error.isRetryable = true;
        error.agentId = agentId;
        throw error;
      }
    } else {
      // Fallback mock runner if CursorSDK.createAgent is unavailable in current env
      agentInstance = {
        prompt: async (userPrompt, opts = {}) => {
          let text = `[Cursor SDK Mock Analyst - ${model}]\n\nAnalysis for request:\n${userPrompt.slice(0, 300)}...`;
          if (typeof onDelta === 'function') {
            onDelta(text);
          }
          return {
            status: 'completed',
            text,
            usage: { inputTokens: 120, outputTokens: 45, reasoningTokens: 0 }
          };
        },
        dispose: () => {}
      };
    }

    agentCache.set(cacheKey, {
      agentId,
      cwd: workspace.cwd,
      storePath: workspace.storePath,
      model,
      modelParams,
      lastUsed: Date.now(),
      agentInstance
    });
  } else {
    cached.lastUsed = Date.now();
  }

  // Construct prompt string
  let promptText = '';
  if (isFollowUpTurn) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    promptText = lastUserMsg ? lastUserMsg.content : (messages[messages.length - 1]?.content || '');
  } else {
    promptText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
  }

  const runId = `run-${crypto.randomUUID()}`;
  const startTime = Date.now();

  const userRuns = userActiveRuns.get(userId) || new Set();
  const runPromise = (async () => {
    try {
      let finalMessage = '';
      let usage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };

      if (agentInstance && typeof agentInstance.prompt === 'function') {
        const result = await Promise.race([
          agentInstance.prompt(promptText, {
            model: modelParams.length > 0 ? { id: model, params: modelParams } : model,
            onDelta: (chunk) => {
              const deltaText = typeof chunk === 'string' ? chunk : (chunk?.text || '');
              if (deltaText && typeof onDelta === 'function') {
                onDelta(deltaText);
              }
            }
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Cursor chat timed out after ${config.cursorChatTimeoutMs}ms`)), config.cursorChatTimeoutMs)
          )
        ]);

        if (result.status === 'error') {
          const err = new Error(result.error || 'Cursor agent returned an error status');
          err.isRetryable = result.isRetryable ?? true;
          err.agentId = agentId;
          err.runId = runId;
          throw err;
        }

        finalMessage = result.text || result.message || '';
        if (result.usage) {
          usage = {
            inputTokens: result.usage.inputTokens || result.usage.promptTokens || 0,
            outputTokens: result.usage.outputTokens || result.usage.completionTokens || 0,
            reasoningTokens: result.usage.reasoningTokens || 0
          };
        }
      }

      const latencyMs = Date.now() - startTime;
      return {
        provider: 'cursor-sdk',
        model,
        modelParams,
        message: finalMessage,
        meta: {
          mode: 'manual',
          agentId,
          runId,
          sessionId,
          latencyMs,
          respondedAt: new Date().toISOString(),
          usage
        }
      };
    } finally {
      const currentRuns = userActiveRuns.get(userId);
      if (currentRuns) {
        currentRuns.delete(runPromise);
        if (currentRuns.size === 0) userActiveRuns.delete(userId);
      }
    }
  })();

  userRuns.add(runPromise);
  userActiveRuns.set(userId, userRuns);

  return runPromise;
}

/**
 * Disposes a specific session agent and cleans up workspace.
 */
export function disposeCursorSession(userId, sessionId) {
  const cacheKey = `${userId}:${sessionId}`;
  const item = agentCache.get(cacheKey);
  if (item) {
    if (item.agentInstance && typeof item.agentInstance.dispose === 'function') {
      try { item.agentInstance.dispose(); } catch (_) {}
    }
    agentCache.delete(cacheKey);
  }
  resetSession(userId, sessionId);
}

/**
 * Disposes all session agents for a user and cleans up workspaces.
 */
export function disposeAllUserCursorSessions(userId) {
  for (const [key, item] of agentCache.entries()) {
    if (key.startsWith(`${userId}:`)) {
      if (item.agentInstance && typeof item.agentInstance.dispose === 'function') {
        try { item.agentInstance.dispose(); } catch (_) {}
      }
      agentCache.delete(key);
    }
  }
  resetAllSessions(userId);
}

// Cleanup on process termination
process.on('SIGINT', () => {
  for (const item of agentCache.values()) {
    if (item.agentInstance && typeof item.agentInstance.dispose === 'function') {
      try { item.agentInstance.dispose(); } catch (_) {}
    }
  }
  agentCache.clear();
});
process.on('SIGTERM', () => {
  for (const item of agentCache.values()) {
    if (item.agentInstance && typeof item.agentInstance.dispose === 'function') {
      try { item.agentInstance.dispose(); } catch (_) {}
    }
  }
  agentCache.clear();
});
