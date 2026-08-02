import { getAiSettings } from './lib/appSettings.js';
import { requestServerAiChat, resetCursorSession } from './lib/serverClient.js';
import { analyzeStock as profileStock, dseSectorMap } from './lib/behaviorProfiler.js';
import {
  sparklineRange,
  formatSparklinePeriod,
  formatSparklinePeriodDetail,
  buildTradingStrip,
  buildMetricGroups
} from './lib/stockMetricsLayout.js';
import {
  filterSessions,
  closesFromSessions,
  sessionDate
} from './lib/stockHistory.js';

// State
let marketData = null;
let currentStock = null;
let chartIsUp = true;
let activeRange = 'default';
let historyCache = null; // loaded history JSON for currentStock
let historyLoadPromise = null;
let rangeRequestId = 0;

const HISTORY_REMOTE_BASE =
  'https://astinaam-webtools.github.io/dse-toolkit/src/data/history';

// DOM Elements
const els = {
  loading: document.getElementById('loading'),
  content: document.getElementById('content'),
  symbol: document.getElementById('stock-symbol'),
  name: document.getElementById('stock-name'),
  sector: document.getElementById('stock-sector'),
  price: document.getElementById('stock-price'),
  change: document.getElementById('stock-change'),
  chartContainer: document.getElementById('chart-container'),
  chartRange: document.getElementById('chart-range'),
  chartLow: document.getElementById('chart-low'),
  chartHigh: document.getElementById('chart-high'),
  chartSessions: document.getElementById('chart-sessions'),
  chartSpan: document.getElementById('chart-span'),
  chartPresets: document.getElementById('chart-presets'),
  chartCustom: document.getElementById('chart-custom'),
  chartFrom: document.getElementById('chart-from'),
  chartTo: document.getElementById('chart-to'),
  chartCustomApply: document.getElementById('chart-custom-apply'),
  chartRangeStatus: document.getElementById('chart-range-status'),
  strip: document.getElementById('trading-strip'),
  groups: document.getElementById('metrics-groups'),
  btnAnalyze: document.getElementById('btn-analyze-page'),
  aiOutput: document.getElementById('ai-output-page'),
  behaviorProfile: document.getElementById('behavior-profile'),
  behaviorOutput: document.getElementById('behavior-output')
};

const keyToTerm = {
  pe: 'Price-to-Earnings Ratio',
  eps: 'Earnings Per Share',
  nav: 'Net Asset Value Per Share',
  pb: 'Price-to-Book Ratio',
  roe: 'Return on Equity',
  dividendYield: 'Dividend Yield',
  debtToEquity: 'Debt-to-Equity Ratio',
  beta: 'Beta',
  rsi: 'Relative Strength Index',
  macd: 'Moving Average Convergence Divergence',
  macdSignal: 'MACD Signal Line',
  volume: 'Volume',
  value: 'Value',
  mktCap: 'Market Capitalization',
  paidUpCapital: 'Paid-Up Capital',
  totalShares: 'Total Shares Outstanding',
  currentRatio: 'Current Ratio',
  quickRatio: 'Quick Ratio',
  ebitdaMargin: 'EBITDA Margin',
  operatingMargin: 'Operating Profit Margin',
  netMargin: 'Net Profit Margin',
  grossMargin: 'Gross Profit Margin',
  roa: 'Return on Assets',
  roea: 'Return on Earnings Assets',
  roi: 'Return on Investment',
  auditedPe: 'Audited Price-to-Earnings',
  forwardPe: 'Forward Price-to-Earnings',
  ltp: 'Last Traded Price',
  close: 'Close',
  sma20: 'Simple Moving Average',
  sma50: 'Simple Moving Average',
  sma200: 'Simple Moving Average',
  ema9: 'Exponential Moving Average',
  ema12: 'Exponential Moving Average',
  ema26: 'Exponential Moving Average',
  wma9: 'Weighted Moving Average',
  wma12: 'Weighted Moving Average',
  wma20: 'Weighted Moving Average',
  bbUpper: 'Bollinger Band Upper',
  bbLower: 'Bollinger Band Lower',
  tv: 'Trade Volume Index',
  co: 'Chaikin Oscillator',
  williamsR: 'Williams Percent Range'
};

const init = async () => {
  try {
    // Get symbol from URL
    const params = new URLSearchParams(window.location.search);
    const symbol = params.get('symbol');
    
    if (!symbol) {
      els.loading.textContent = 'No stock symbol provided.';
      return;
    }

    // Network-first stocks; merge local sparkline period metadata when remote lacks it
    const remoteUrl = 'https://astinaam-webtools.github.io/dse-toolkit/src/data/dse-market.json';
    const localUrl = './src/data/dse-market.json';
    const [remoteResult, localResult] = await Promise.allSettled([
      fetch(remoteUrl).then((r) => {
        if (!r.ok) throw new Error('Network fetch failed');
        return r.json();
      }),
      fetch(localUrl).then((r) => {
        if (!r.ok) throw new Error('Local fetch failed');
        return r.json();
      })
    ]);

    if (remoteResult.status === 'fulfilled') {
      marketData = remoteResult.value;
    } else if (localResult.status === 'fulfilled') {
      console.warn('Fetching live data failed, falling back to local:', remoteResult.reason);
      marketData = localResult.value;
    } else {
      throw new Error('Failed to load data');
    }

    const localMeta = localResult.status === 'fulfilled' ? localResult.value?.metadata : null;
    if (
      localMeta?.sparklineFrom &&
      localMeta?.sparklineTo &&
      (!marketData.metadata?.sparklineFrom || !marketData.metadata?.sparklineTo)
    ) {
      marketData.metadata = {
        ...(marketData.metadata || {}),
        sparklineFrom: localMeta.sparklineFrom,
        sparklineTo: localMeta.sparklineTo
      };
    }
    
    const stock = marketData.stocks.find(s => s.symbol === symbol);
    
    if (!stock) {
      els.loading.textContent = `Stock symbol "${symbol}" not found.`;
      return;
    }

    currentStock = stock;
    historyCache = null;
    historyLoadPromise = null;
    activeRange = 'default';
    renderStock(stock);
    renderBehaviorProfile(stock);
    setupChartRangeControls();
    
    // Setup AI Button
    els.btnAnalyze.onclick = () => analyzeStock(stock);

  } catch (err) {
    console.error(err);
    els.loading.hidden = false;
    els.content.hidden = true;
    els.loading.textContent = 'Error loading market data.';
  }
};

const setRangeStatus = (message, isError = false) => {
  if (!els.chartRangeStatus) return;
  if (!message) {
    els.chartRangeStatus.hidden = true;
    els.chartRangeStatus.textContent = '';
    els.chartRangeStatus.classList.remove('is-error');
    return;
  }
  els.chartRangeStatus.hidden = false;
  els.chartRangeStatus.textContent = message;
  els.chartRangeStatus.classList.toggle('is-error', isError);
};

const syncPresetButtons = () => {
  if (!els.chartPresets) return;
  els.chartPresets.querySelectorAll('[data-range]').forEach((btn) => {
    const selected = btn.dataset.range === activeRange;
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    btn.classList.toggle('chip--accent', selected);
  });
  if (els.chartCustom) {
    els.chartCustom.hidden = activeRange !== 'custom';
  }
};

const updateRangeBar = (closes, from, to) => {
  const range = sparklineRange(closes);
  if (!range) {
    els.chartRange.hidden = true;
    els.chartContainer.classList.add('is-empty');
    return;
  }
  els.chartRange.hidden = false;
  els.chartContainer.classList.remove('is-empty');
  els.chartLow.textContent = range.low.toLocaleString(undefined, { maximumFractionDigits: 2 });
  els.chartHigh.textContent = range.high.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const period = formatSparklinePeriod(from, to);
  const detail = formatSparklinePeriodDetail(from, to);
  els.chartSessions.textContent = period || `${range.sessions} sessions`;
  els.chartSpan.textContent = `Δ ${range.span.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  els.chartRange.title = detail
    ? `${detail} · ${range.sessions} sessions`
    : `${range.sessions} sessions`;
};

const paintDefaultChart = () => {
  if (!currentStock) return;
  const meta = marketData?.metadata || {};
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderChart(currentStock.sparkline, chartIsUp);
    });
  });
  updateRangeBar(currentStock.sparkline, meta.sparklineFrom, meta.sparklineTo);
};

const loadStockHistory = async (symbol) => {
  if (historyCache?.symbol === symbol) return historyCache;
  if (historyLoadPromise) return historyLoadPromise;

  const encoded = encodeURIComponent(symbol);
  const remoteUrl = `${HISTORY_REMOTE_BASE}/${encoded}.json`;
  const localUrl = `./src/data/history/${encoded}.json`;

  historyLoadPromise = (async () => {
    const fetchJson = async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`History fetch failed: ${url}`);
      return response.json();
    };

    // Local-first so a slow/hanging remote cannot block
    let data = null;
    try {
      data = await fetchJson(localUrl);
    } catch {
      data = await fetchJson(remoteUrl);
    }

    if (!data?.sessions || !Array.isArray(data.sessions)) {
      throw new Error('Invalid history payload');
    }
    if (data.symbol && data.symbol !== symbol) {
      throw new Error('History symbol mismatch');
    }

    historyCache = data;
    return data;
  })();

  try {
    return await historyLoadPromise;
  } finally {
    historyLoadPromise = null;
  }
};

const applyHistoryRange = async ({ preset, from, to } = {}) => {
  if (!currentStock) return;
  const requestId = ++rangeRequestId;
  setRangeStatus('Loading history…');
  try {
    const history = await loadStockHistory(currentStock.symbol);
    if (requestId !== rangeRequestId) return;

    const filtered = filterSessions(history.sessions, {
      preset: preset && preset !== 'custom' ? preset : undefined,
      from,
      to,
      endDate: history.to,
      historyFrom: history.from
    });
    const closes = closesFromSessions(filtered);
    if (requestId !== rangeRequestId) return;

    if (closes.length < 2) {
      setRangeStatus('No sessions in that range.', true);
      return;
    }
    const rangeFrom = sessionDate(filtered[0]) || from || history.from;
    const rangeTo = sessionDate(filtered[filtered.length - 1]) || to || history.to;
    renderChart(closes, chartIsUp);
    updateRangeBar(closes, rangeFrom, rangeTo);
    setRangeStatus('');
  } catch (err) {
    if (requestId !== rangeRequestId) return;
    console.warn(err);
    setRangeStatus('Could not load history for this range.', true);
  }
};

const setupChartRangeControls = () => {
  if (!els.chartPresets) return;
  syncPresetButtons();

  els.chartPresets.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-range]');
    if (!btn || !els.chartPresets.contains(btn)) return;
    const next = btn.dataset.range;
    activeRange = next;
    syncPresetButtons();

    if (next === 'default') {
      rangeRequestId += 1;
      setRangeStatus('');
      paintDefaultChart();
      return;
    }

    if (next === 'custom') {
      const requestId = ++rangeRequestId;
      if (historyCache) {
        if (els.chartFrom && !els.chartFrom.value) els.chartFrom.value = historyCache.from;
        if (els.chartTo && !els.chartTo.value) els.chartTo.value = historyCache.to;
        if (els.chartFrom) {
          els.chartFrom.min = historyCache.from;
          els.chartFrom.max = historyCache.to;
        }
        if (els.chartTo) {
          els.chartTo.min = historyCache.from;
          els.chartTo.max = historyCache.to;
        }
      } else {
        try {
          const history = await loadStockHistory(currentStock.symbol);
          if (requestId !== rangeRequestId) return;
          if (els.chartFrom) {
            els.chartFrom.value = history.from;
            els.chartFrom.min = history.from;
            els.chartFrom.max = history.to;
          }
          if (els.chartTo) {
            els.chartTo.value = history.to;
            els.chartTo.min = history.from;
            els.chartTo.max = history.to;
          }
          setRangeStatus('');
        } catch (err) {
          if (requestId !== rangeRequestId) return;
          console.warn(err);
          setRangeStatus('Could not load history for custom range.', true);
        }
      }
      return;
    }

    await applyHistoryRange({ preset: next });
  });

  els.chartCustomApply?.addEventListener('click', async () => {
    const from = els.chartFrom?.value;
    const to = els.chartTo?.value;
    if (!from || !to) {
      setRangeStatus('Pick both From and To dates.', true);
      return;
    }
    if (from > to) {
      setRangeStatus('From must be on or before To.', true);
      return;
    }
    activeRange = 'custom';
    syncPresetButtons();
    await applyHistoryRange({ from, to });
  });
};

const renderStock = (stock) => {
  els.loading.hidden = true;
  els.content.hidden = false;
  
  // Header
  els.symbol.textContent = stock.symbol;
  els.name.textContent = stock.name;
  els.sector.textContent = stock.sector;
  els.price.textContent = stock.metrics?.ltp ?? '—';
  
  const change = stock.deltas?.price_1d;
  const hasChange = Number.isFinite(change);
  els.change.textContent = hasChange
    ? `${change > 0 ? '+' : ''}${change.toFixed(2)}%`
    : '—';
  els.change.style.color = !hasChange ? '' : change >= 0 ? 'var(--up)' : 'var(--down)';

  chartIsUp = !hasChange || change >= 0;
  paintDefaultChart();

  const strip = buildTradingStrip(stock.metrics);
  if (strip.length) {
    els.strip.hidden = false;
    els.strip.style.gridTemplateColumns = `repeat(${strip.length}, minmax(0, 1fr))`;
    els.strip.innerHTML = strip.map((cell) => `
    <div class="stock-strip__item">
      <span class="stock-strip__label">${cell.label}</span>
      <span class="stock-strip__value">${cell.display}</span>
    </div>
  `).join('');
  } else {
    els.strip.hidden = true;
    els.strip.innerHTML = '';
    els.strip.style.gridTemplateColumns = '';
  }

  const formatKeyFallback = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

  els.groups.innerHTML = buildMetricGroups(stock.metrics).map((group) => `
  <section class="stock-group" aria-labelledby="stock-group-${group.id}">
    <div class="stock-group__head" id="stock-group-${group.id}">
      <span>${group.title}</span>
      <span class="stock-group__count">${group.rows.length}</span>
    </div>
    ${group.rows.map((row) => {
      const termQuery = keyToTerm[row.key] || formatKeyFallback(row.key);
      const link = `index.html?q=${encodeURIComponent(termQuery)}&ref=stock&symbol=${encodeURIComponent(stock.symbol)}`;
      const elevated = row.elevated ? ' stock-group__row--elevated' : '';
      return `
        <div class="stock-group__row${elevated}">
          <span class="stock-group__key">
            <a href="${link}">${row.label}</a>
          </span>
          <span class="stock-group__val">${row.display}</span>
        </div>
      `;
    }).join('')}
  </section>
`).join('');
};

const renderChart = (data, isUp) => {
  const container = els.chartContainer;
  if (!data || data.length < 2) {
    container.classList.add('is-empty');
    container.innerHTML = '<p style="color: var(--muted);">No chart data available</p>';
    return;
  }

  container.classList.remove('is-empty');

  // Use clientWidth with fallback, accounting for padding
  const containerWidth = container.clientWidth || container.offsetWidth || 300;
  const width = Math.max(containerWidth - 40, 100);
  const height = 160;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  // Hardcoded colors for SVG (CSS vars don't always work in inline SVG)
  const strokeColor = isUp ? '#10b981' : '#ef4444';
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  container.innerHTML = `
    <svg width="${width}" height="${height}" style="overflow: visible;">
      <polyline points="${points}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
};

const renderBehaviorProfile = (stock) => {
  if (!els.behaviorProfile || !els.behaviorOutput) return;

  const m = stock.metrics || {};
  const inputs = {
    sector: dseSectorMap[stock.sector] || 'others',
    marketCap: m.mktCap || 0,
    pe: m.pe || 0,
    pb: m.pb || 0,
    dividendYield: m.dividendYield || 0,
    debtToEquity: m.debtToEquity || 0,
    revenueCagr: 0,
    epsCagr: 0,
    payoutRatio: 0,
    fcfYears: 0,
    beta: 0,
    priceVsHigh: 0
  };

  const result = profileStock(inputs);
  if (!result.matches.length) return;

  els.behaviorProfile.hidden = false;

  const renderCard = (bucket) => `
    <article class="analysis-card">
      <h4>${bucket.title}</h4>
      <p>${bucket.summary}</p>
      ${bucket.triggers.length ? `
        <ul>${bucket.triggers.map(t => `<li>${t}</li>`).join('')}</ul>
      ` : ''}
      <p class="label">When to invest</p>
      <p>${bucket.timing}</p>
    </article>
  `;

  if (result.matches.length === 1) {
    els.behaviorOutput.innerHTML = `
      <div class="analysis-grid">${renderCard(result.primary)}</div>
    `;
  } else {
    els.behaviorOutput.innerHTML = `
      <div class="analysis-summary">
        <p class="muted">Primary investing lens</p>
        <h4>${result.primary.title}</h4>
        <p>${result.primary.summary}</p>
      </div>
      <div class="analysis-grid">
        ${result.matches.slice(1).map(renderCard).join('')}
      </div>
    `;
  }
};

const requestAiCompletion = async ({ aiSettings, messages, onDelta = null }) => {
  if (aiSettings.mode === 'server') {
    const provider = aiSettings.serverAiProvider || 'openrouter';
    const ephemeralId = `ephemeral-${crypto.randomUUID()}`;
    try {
      const response = await requestServerAiChat({
        provider,
        messages,
        model: aiSettings.serverPreferredModel,
        modelParams: aiSettings.serverModelParams,
        mode: aiSettings.serverModelMode,
        cursor: provider === 'cursor-sdk' ? { sessionId: ephemeralId } : null,
        stream: true,
        onDelta
      });
      return response?.message || '';
    } finally {
      if (provider === 'cursor-sdk') {
        resetCursorSession(ephemeralId);
      }
    }
  }

  const apiKey = aiSettings.localOpenRouterApiKey;
  const model = String(aiSettings.localOpenRouterModel || '').trim();
  if (!apiKey || !model) {
    throw new Error('Client-only AI requires both OpenRouter API key and model name in Settings.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages
    })
  });

  if (!response.ok) {
    throw new Error('AI request failed. Check your Settings and try again.');
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
};

const analyzeStock = async (stock) => {
  const params = new URLSearchParams({
    source: 'stock',
    symbol: stock.symbol,
    newThread: '1',
    returnTo: window.location.pathname + window.location.search
  });

  window.location.href = `./chat.html?${params.toString()}`;
};

let messageIdCounter = 0;

const parseMarkdown = (text) => {
  // Simple markdown parser
  return text
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold and Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gim, '<hr>')
    // Unordered lists
    .replace(/^\s*[-*+] (.*$)/gim, '<li>$1</li>')
    // Ordered lists
    .replace(/^\s*\d+\. (.*$)/gim, '<li>$1</li>')
    // Line breaks (but not inside code blocks)
    .replace(/\n/g, '<br>')
    // Clean up multiple <br> tags
    .replace(/(<br>){3,}/g, '<br><br>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*?<\/li>)(?=<br><li>|<li>)/g, '$1')
    .replace(/(<li>.*?<\/li>(<br>)?)+/g, '<ul>$&</ul>')
    .replace(/<ul><br>/g, '<ul>')
    .replace(/<br><\/ul>/g, '</ul>');
};

const addChatMessage = (role, text) => {
  const container = document.getElementById('ai-chat-container');
  const div = document.createElement('div');
  const msgId = `chat-msg-${++messageIdCounter}`;
  div.id = msgId;
  
  if (role === 'user') {
    div.className = 'chat-msg chat-msg--user';
    div.textContent = text;
  } else if (role === 'ai') {
    div.className = 'chat-msg chat-msg--ai';
    div.innerHTML = parseMarkdown(text);
  } else if (role === 'system') {
    div.className = 'chat-msg chat-msg--system';
    div.textContent = text;
  } else if (role === 'thinking') {
    div.className = 'chat-msg chat-msg--thinking';
    div.textContent = text;
  } else if (role === 'error') {
    div.className = 'chat-msg chat-msg--error';
    div.textContent = text;
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return msgId;
};

const removeChatMessage = (msgId) => {
  const msg = document.getElementById(msgId);
  if (msg) msg.remove();
};

// Start
init();
