import { config } from './config.js';
import { models as fallbackModels } from './models.js';
import { normalizeOpenRouterModels } from '../../src/lib/modelNormalize.js';

const modelsCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getApiKeyFingerprint(apiKey) {
  if (!apiKey) return 'none';
  if (apiKey.length < 8) return apiKey;
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export async function fetchOpenRouterModels({ apiKey } = {}) {
  const effectiveKey = apiKey || config.openRouterApiKey;
  const fingerprint = getApiKeyFingerprint(effectiveKey);
  const cacheKey = `openrouter:${fingerprint}`;

  const cached = modelsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${config.openRouterBaseUrl.replace(/\/$/, '')}/models`;
  const headers = { 'User-Agent': 'DSE-Toolkit/1.0' };
  if (effectiveKey) {
    headers['Authorization'] = `Bearer ${effectiveKey}`;
  }

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      throw new Error(`OpenRouter models API returned HTTP ${res.status}`);
    }
    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) {
      const normalized = normalizeOpenRouterModels(json.data);
      const result = {
        provider: 'openrouter',
        defaultModel: 'openrouter/free',
        source: 'live',
        models: normalized
      };
      modelsCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    }
  } catch (err) {
    console.warn('Live OpenRouter models fetch failed, using fallback list:', err.message);
  }

  // Fallback normalization
  const normalizedFallback = fallbackModels.map((m) => ({
    model_id: m.model_id,
    model_name: m.model_name,
    description: '',
    context_length: m.context || null,
    pricing: {
      prompt_per_million: m.input_cost_per_m || 0,
      completion_per_million: m.output_cost_per_m || 0,
      currency: 'USD',
      display: (m.input_cost_per_m === 0 && m.output_cost_per_m === 0) ? 'Free' : `$${m.input_cost_per_m} / $${m.output_cost_per_m}`
    },
    capabilities: {
      reasoning: /reason|r1|o1|o3|think|thought|reflection/i.test(`${m.model_id} ${m.model_name}`),
      tools: false,
      modalities: ['text']
    },
    parameters: [],
    variants: []
  }));

  const result = {
    provider: 'openrouter',
    defaultModel: 'openrouter/free',
    source: 'fallback',
    models: normalizedFallback
  };

  modelsCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}
