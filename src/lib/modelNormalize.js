/**
 * Pure normalization helpers for OpenRouter and Cursor SDK models.
 * Used by server services and client model picker.
 */

export function formatPricingDisplay(promptPerM, completionPerM) {
  if (promptPerM === 0 && completionPerM === 0) {
    return 'Free';
  }
  const formatRate = (rate) => {
    if (rate === 0) return '0';
    if (rate < 0.01) return rate.toFixed(4);
    if (rate < 1) return rate.toFixed(2);
    return rate.toFixed(2);
  };
  return `$${formatRate(promptPerM)} / $${formatRate(completionPerM)}`;
}

export function normalizeOpenRouterModel(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id || raw.model_id || '';
  if (!id) return null;

  const name = raw.name || raw.model_name || id;
  const description = raw.description || '';
  const contextLength = typeof raw.context_length === 'number' ? raw.context_length : null;

  let pricing = null;
  if (raw.pricing && typeof raw.pricing === 'object') {
    const promptRaw = parseFloat(raw.pricing.prompt ?? raw.pricing.prompt_per_million);
    const compRaw = parseFloat(raw.pricing.completion ?? raw.pricing.completion_per_million);

    if (!isNaN(promptRaw) && !isNaN(compRaw)) {
      // OpenRouter API returns per-token prices as strings e.g. "0.000001"
      // If values are small (< 0.01), multiply by 1e6 to get per-million tokens
      const promptPerM = (raw.pricing.prompt !== undefined && promptRaw < 0.01)
        ? promptRaw * 1_000_000
        : (isNaN(promptRaw) ? 0 : promptRaw);
      const compPerM = (raw.pricing.completion !== undefined && compRaw < 0.01)
        ? compRaw * 1_000_000
        : (isNaN(compRaw) ? 0 : compRaw);

      pricing = {
        prompt_per_million: promptPerM,
        completion_per_million: compPerM,
        currency: 'USD',
        display: raw.pricing.display || formatPricingDisplay(promptPerM, compPerM)
      };
    }
  }

  const textToScan = `${id} ${name} ${description}`.toLowerCase();
  const isReasoning = /reason|r1|o1|o3|think|thought|reflection|qwq/i.test(textToScan);

  let modalities = ['text'];
  if (raw.architecture && Array.isArray(raw.architecture.modality)) {
    modalities = raw.architecture.modality;
  } else if (Array.isArray(raw.modalities)) {
    modalities = raw.modalities;
  }

  const hasTools = Boolean(
    raw.supported_parameters?.includes?.('tools') ||
    raw.description?.toLowerCase().includes('tool') ||
    raw.description?.toLowerCase().includes('function call')
  );

  return {
    model_id: id,
    model_name: name,
    description: description,
    context_length: contextLength,
    pricing: pricing,
    capabilities: {
      reasoning: isReasoning,
      tools: hasTools,
      modalities: Array.isArray(modalities) && modalities.length > 0 ? modalities : ['text']
    },
    parameters: Array.isArray(raw.parameters) ? raw.parameters : [],
    variants: Array.isArray(raw.variants) ? raw.variants : []
  };
}

export function normalizeOpenRouterModels(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map(normalizeOpenRouterModel)
    .filter((m) => m !== null);
}

export function normalizeCursorModel(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id || raw.model_id || '';
  if (!id) return null;

  const name = raw.displayName || raw.name || raw.model_name || id;
  const description = raw.description || '';
  const parameters = Array.isArray(raw.parameters) ? raw.parameters : [];
  const variants = Array.isArray(raw.variants) ? raw.variants : [];

  const paramScan = parameters.some((p) => /reason|effort|think/i.test(p.id || ''));
  const textScan = /reason|effort|think|r1|o1|o3|composer/i.test(`${id} ${name} ${description}`);
  const isReasoning = paramScan || textScan;

  return {
    model_id: id,
    model_name: name,
    description: description,
    context_length: null,
    pricing: null,
    capabilities: {
      reasoning: isReasoning,
      tools: true,
      modalities: ['text']
    },
    parameters: parameters,
    variants: variants
  };
}

export function normalizeCursorModels(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map(normalizeCursorModel)
    .filter((m) => m !== null);
}
