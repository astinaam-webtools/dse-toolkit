const DSE_CONTEXT = [
  'You are an expert financial analyst specializing in the Dhaka Stock Exchange (DSE), Bangladesh.',
  'Use practical language for retail investors and include risk-aware guidance.',
  'Mention both bull and bear cases with Bangladesh market context where relevant.',
  'Do not provide guaranteed return claims.'
].join(' ');

const toFixedOrNA = (value, digits = 2) =>
  value == null || Number.isNaN(Number(value)) ? 'N/A' : Number(value).toFixed(digits);

const pctOrNA = (value, digits = 2) =>
  value == null || Number.isNaN(Number(value)) ? 'N/A' : `${Number(value).toFixed(digits)}%`;

const withLabel = (label, value) => `- ${label}: ${value}`;

export const loadMarketDataset = async () => {
  const urls = [
    'https://astinaam-webtools.github.io/dse-toolkit/src/data/dse-market.json',
    './src/data/dse-market.json'
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // Try next source.
    }
  }

  throw new Error('Unable to load market dataset.');
};

export const getStockBySymbol = (dataset, symbol) => {
  const key = String(symbol || '').trim().toUpperCase();
  if (!key) {
    return null;
  }
  return (dataset?.stocks || []).find((item) => item?.symbol === key) || null;
};

export const buildStockAnalysisPrompt = (stock) => {
  if (!stock) {
    return '';
  }

  const m = stock.metrics || {};
  const d = stock.deltas || {};

  const lines = [
    DSE_CONTEXT,
    '',
    `Analyze ${stock.name} (${stock.symbol}).`,
    '',
    '## Basic Info',
    withLabel('Sector', stock.sector || 'N/A'),
    withLabel('Category', stock.category || 'N/A'),
    '',
    '## Price & Value',
    withLabel('Last Traded Price', toFixedOrNA(m.ltp)),
    withLabel('Close', toFixedOrNA(m.close)),
    withLabel('Market Cap (Mn)', toFixedOrNA(m.mktCap)),
    withLabel('1-Day Change', pctOrNA(d.price_1d)),
    withLabel('1-Week Change', pctOrNA(d.price_1w)),
    withLabel('1-Month Change', pctOrNA(d.price_1m)),
    '',
    '## Technical Snapshot',
    withLabel('RSI (14)', toFixedOrNA(m.rsi)),
    withLabel('MACD', toFixedOrNA(m.macd, 4)),
    withLabel('MACD Signal', toFixedOrNA(m.macdSignal, 4)),
    withLabel('SMA 20', toFixedOrNA(m.sma20)),
    withLabel('SMA 50', toFixedOrNA(m.sma50)),
    withLabel('SMA 200', toFixedOrNA(m.sma200)),
    '',
    '## Valuation',
    withLabel('P/E', toFixedOrNA(m.pe)),
    withLabel('P/B', toFixedOrNA(m.pb)),
    withLabel('EPS', toFixedOrNA(m.eps)),
    withLabel('NAV', toFixedOrNA(m.nav)),
    withLabel('Dividend Yield', pctOrNA(m.dividendYield)),
    '',
    '## Liquidity',
    withLabel('Volume', m.volume == null ? 'N/A' : Number(m.volume).toLocaleString()),
    withLabel('Value (Cr)', toFixedOrNA(m.value, 3)),
    withLabel('1-Day Volume Change', pctOrNA(d.vol_1d)),
    '',
    'Respond in Markdown with these sections:',
    '1. Bull Case',
    '2. Bear Case',
    '3. Technical Outlook',
    '4. Verdict (Short term, Long term)',
    '5. Key Risks to Monitor'
  ];

  return lines.join('\n');
};

const PROMPT_KEY_PREFIX = 'dse_prompt_';

export const storePrefilledPrompt = (promptText, termName = '') => {
  if (!promptText) return null;
  const key = `${PROMPT_KEY_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = {
    prompt: promptText,
    term: termName,
    createdAt: Date.now()
  };

  try {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PROMPT_KEY_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(k));
          if (item?.createdAt && now - item.createdAt > 3600000) {
            localStorage.removeItem(k);
          }
        } catch {
          localStorage.removeItem(k);
        }
      }
    }

    localStorage.setItem(key, JSON.stringify(payload));
    return key;
  } catch (err) {
    console.error('Failed to store prefilled prompt in localStorage:', err);
    return null;
  }
};

export const retrievePrefilledPrompt = (key) => {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    localStorage.removeItem(key);
    return data;
  } catch {
    return null;
  }
};

export const buildTermAnalysisPrompt = (term) => {
  if (!term) {
    return '';
  }
  const shortStr = term.shortForm ? ` (${term.shortForm})` : '';
  return `Explain "${term.title}"${shortStr} with real-world examples from the Dhaka Stock Exchange (DSE) market. How can DSE investors use this to evaluate stocks?`;
};

export const buildGuideAnalysisPrompt = (title, tag, bodyText) => {
  if (!title) return '';
  const tagCtx = tag ? ` (Category: ${tag})` : '';
  return [
    DSE_CONTEXT,
    '',
    `I'm studying "${title}"${tagCtx} from a chart-reading playbook. Here is what I already know:`,
    '',
    bodyText || '',
    '',
    'Please help me understand this better in the context of the Dhaka Stock Exchange (DSE). Cover:',
    '1. **Beginner Explanation** — What this metric/indicator really means in simple terms.',
    '2. **DSE-Specific Usage** — How to read and interpret this on DSE platforms (StockNow, DSE website, broker terminals).',
    '3. **Practical Example** — Walk through a realistic scenario using a DSE-listed stock.',
    '4. **Common Mistakes** — What beginners get wrong when reading this.',
    '5. **Combining with Other Metrics** — Which other indicators pair well with this for better decisions.',
    '',
    'Use practical language for retail investors in Bangladesh. Format the response in Markdown.'
  ].join('\n');
};

export const buildBootstrapSystemPrompt = (stock) => {
  if (!stock) {
    return 'You are a DSE-focused market assistant. Help the user with concise, evidence-based analysis.';
  }

  return [
    'You are continuing an analysis thread for this stock:',
    `${stock.name} (${stock.symbol}) in sector ${stock.sector || 'N/A'}.`,
    'Keep answers concise, practical, and tied to the provided stock context.'
  ].join(' ');
};

