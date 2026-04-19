
// State
let marketData = null;

// DOM Elements
const els = {
  loading: document.getElementById('loading'),
  content: document.getElementById('content'),
  symbol: document.getElementById('stock-symbol'),
  name: document.getElementById('stock-name'),
  sector: document.getElementById('stock-sector'),
  price: document.getElementById('stock-price'),
  change: document.getElementById('stock-change'),
  grid: document.getElementById('metrics-grid'),
  btnAnalyze: document.getElementById('btn-analyze-page'),
  aiOutput: document.getElementById('ai-output-page')
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

    // Fetch Data (Network-first)
    let res;
    try {
      res = await fetch('https://astinaam-webtools.github.io/dse-toolkit/src/data/dse-market.json');
      if (!res.ok) throw new Error('Network fetch failed');
    } catch (e) {
      console.warn('Fetching live data failed, falling back to local:', e);
      res = await fetch('./src/data/dse-market.json');
    }

    if (!res.ok) throw new Error('Failed to load data');
    marketData = await res.json();
    
    const stock = marketData.stocks.find(s => s.symbol === symbol);
    
    if (!stock) {
      els.loading.textContent = `Stock symbol "${symbol}" not found.`;
      return;
    }

    renderStock(stock);
    
    // Setup AI Button
    els.btnAnalyze.onclick = () => analyzeStock(stock);

  } catch (err) {
    console.error(err);
    els.loading.textContent = 'Error loading market data.';
  }
};

const renderStock = (stock) => {
  els.loading.style.display = 'none';
  els.content.style.display = 'block';
  
  // Header
  els.symbol.textContent = stock.symbol;
  els.name.textContent = stock.name;
  els.sector.textContent = stock.sector;
  els.price.textContent = stock.metrics.ltp;
  
  const change = stock.deltas.price_1d;
  els.change.textContent = change ? (change > 0 ? '+' : '') + change.toFixed(2) + '%' : '-';
  els.change.style.color = change >= 0 ? '#10b981' : '#ef4444';
  
  // Render Chart after layout is fully calculated
  // Use double requestAnimationFrame to ensure layout is complete
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderChart(stock.sparkline, change >= 0);
    });
  });

  // Metrics Grid
  // We'll iterate over all metrics and display them
  // We can format keys to be more readable
  
  const formatKey = (key) => {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const metricsHtml = Object.entries(stock.metrics).map(([key, value]) => {
    if (value === null || value === undefined) return '';
    
    let displayValue = value;
    if (typeof value === 'number') {
      displayValue = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    
    const termQuery = keyToTerm[key] || formatKey(key);
    // Manually construct query to ensure %20 encoding for spaces (cleaner URL)
    const link = `index.html?q=${encodeURIComponent(termQuery)}&ref=stock&symbol=${stock.symbol}`;

    return `
      <div class="metric-card">
        <div class="metric-label">
          <a href="${link}" style="text-decoration: none; color: inherit; border-bottom: 1px dotted #999;">
            ${formatKey(key)}
          </a>
        </div>
        <div class="metric-value">${displayValue}</div>
      </div>
    `;
  }).join('');
  
  els.grid.innerHTML = metricsHtml;
};

const renderChart = (data, isUp) => {
  const container = document.getElementById('chart-container');
  if (!data || data.length < 2) {
    container.innerHTML = '<p style="color: var(--muted);">No chart data available</p>';
    return;
  }

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

const requestAiCompletion = async ({ aiSettings, messages }) => {
  if (aiSettings.mode === 'server') {
    const response = await requestServerAiChat({
      messages,
      model: aiSettings.localOpenRouterModel
    });
    return response?.message || '';
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
    autostart: '1',
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
