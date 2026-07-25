import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeOpenRouterModel,
  normalizeOpenRouterModels,
  normalizeCursorModel,
  normalizeCursorModels,
  formatPricingDisplay
} from '../src/lib/modelNormalize.js';
import {
  ensureSession,
  resetSession,
  resetAllSessions
} from '../server/src/cursorWorkspace.js';
import {
  checkSandboxReady,
  getCursorModels,
  runCursorChat,
  disposeCursorSession
} from '../server/src/cursorSdkService.js';
import { fetchOpenRouterModels } from '../server/src/openrouterModels.js';

async function testModelNormalize() {
  console.log('Testing modelNormalize.js...');

  assert.equal(formatPricingDisplay(0, 0), 'Free');
  assert.equal(formatPricingDisplay(0.1, 0.4), '$0.10 / $0.40');

  const rawOpenRouter = {
    id: 'google/gemma-3-27b-it:free',
    name: 'Google: Gemma 3 27B (free)',
    description: 'A great open model',
    context_length: 131072,
    pricing: {
      prompt: '0.000000',
      completion: '0.000000'
    }
  };

  const normOR = normalizeOpenRouterModel(rawOpenRouter);
  assert.equal(normOR.model_id, 'google/gemma-3-27b-it:free');
  assert.equal(normOR.model_name, 'Google: Gemma 3 27B (free)');
  assert.equal(normOR.context_length, 131072);
  assert.equal(normOR.pricing.display, 'Free');
  assert.equal(normOR.capabilities.reasoning, false);

  const normReasoning = normalizeOpenRouterModel({
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1',
    description: 'Reasoning model'
  });
  assert.equal(normReasoning.capabilities.reasoning, true);

  const rawCursor = {
    id: 'composer-2.5',
    displayName: 'Composer 2.5',
    description: 'Cursor flagship model',
    parameters: [{ id: 'fast', name: 'Fast Mode', type: 'boolean', default: 'true' }]
  };

  const normCursor = normalizeCursorModel(rawCursor);
  assert.equal(normCursor.model_id, 'composer-2.5');
  assert.equal(normCursor.model_name, 'Composer 2.5');
  assert.equal(normCursor.context_length, null);
  assert.equal(normCursor.pricing, null);
  assert.equal(normCursor.capabilities.reasoning, true);
  assert.equal(normCursor.parameters.length, 1);

  console.log('✓ modelNormalize tests passed');
}

async function testWorkspaceLifecycle() {
  console.log('Testing cursorWorkspace.js...');

  const userId = 9999;
  const sessionId = 'test-session-123';

  const ws = ensureSession(userId, sessionId);
  assert.ok(fs.existsSync(ws.cwd), 'cwd directory should be created');
  assert.ok(fs.existsSync(ws.storePath), 'store directory should be created');
  assert.ok(fs.existsSync(path.join(ws.cwd, 'CONTEXT.md')), 'CONTEXT.md should be written');

  const contextContent = fs.readFileSync(path.join(ws.cwd, 'CONTEXT.md'), 'utf8');
  assert.ok(contextContent.includes('DSE Stock Market Analyst Assistant'));

  // Test reset session
  resetSession(userId, sessionId);
  assert.equal(fs.existsSync(ws.sessionRoot), false, 'Session directory should be deleted after resetSession');

  // Test security & argument validation
  assert.throws(
    () => ensureSession(null, 'session-1'),
    /userId and sessionId are required/,
    'Missing userId should throw error'
  );

  console.log('✓ cursorWorkspace tests passed');
}

async function testCursorSdkService() {
  console.log('Testing cursorSdkService.js...');

  const sandboxInfo = checkSandboxReady();
  assert.ok('sandboxReady' in sandboxInfo);

  const modelsResult = await getCursorModels();
  assert.equal(modelsResult.provider, 'cursor-sdk');
  assert.ok(Array.isArray(modelsResult.models));
  assert.ok(modelsResult.models.length > 0);

  // Smoke test prompt execution in mock/fallback or SDK runner
  const chatResult = await runCursorChat({
    userId: 8888,
    sessionId: 'smoke-thread-test',
    model: 'composer-2.5',
    messages: [{ role: 'user', content: 'What is PE ratio?' }],
    apiKey: 'cursor_test_key_12345678'
  });

  assert.equal(chatResult.provider, 'cursor-sdk');
  assert.equal(chatResult.model, 'composer-2.5');
  assert.ok(typeof chatResult.message === 'string');
  assert.ok(chatResult.meta.sessionId === 'smoke-thread-test');

  // Reset test session
  disposeCursorSession(8888, 'smoke-thread-test');

  console.log('✓ cursorSdkService tests passed');
}

async function testOpenRouterModels() {
  console.log('Testing openrouterModels.js...');

  const result = await fetchOpenRouterModels();
  assert.equal(result.provider, 'openrouter');
  assert.ok(Array.isArray(result.models));
  assert.ok(result.models.length > 0);

  console.log('✓ openrouterModels tests passed');
}

async function runAll() {
  try {
    await testModelNormalize();
    await testWorkspaceLifecycle();
    await testCursorSdkService();
    await testOpenRouterModels();
    console.log('\nAll Cursor SDK backend tests passed successfully! ✓');
  } catch (err) {
    console.error('\nCursor SDK backend test failed:', err);
    process.exit(1);
  }
}

runAll();
