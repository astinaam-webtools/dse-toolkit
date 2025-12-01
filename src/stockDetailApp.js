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

    // Fetch Data
    const res = await fetch('./src/data/dse-market.json');
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
  els.change.style.color = change >= 0 ? 'var(--color-up)' : 'var(--color-down)';
  
  // Render Chart
  renderChart(stock.sparkline, change >= 0);

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
    container.innerHTML = '<p style="color:#666">No chart data available</p>';
    return;
  }

  const width = container.clientWidth - 40;
  const height = 160;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  container.innerHTML = `
    <svg width="${width}" height="${height}" style="overflow: visible;">
      <polyline points="${points}" fill="none" stroke="${isUp ? 'var(--color-up)' : 'var(--color-down)'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
};

const analyzeStock = async (stock) => {
  const apiKey = localStorage.getItem('openrouter_key');
  const preferredModel = localStorage.getItem('openrouter_model') || "meta-llama/llama-3-8b-instruct:free";
  
  if (!apiKey) {
    alert('Please set your OpenRouter API Key in the main Settings first.');
    return;
  }

  // Open AI Modal
  const modal = document.getElementById('ai-modal');
  const chatContainer = document.getElementById('ai-chat-container');
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send-btn');
  
  modal.style.display = 'flex';
  chatContainer.innerHTML = ''; // Clear previous chat
  
  // Initial Prompt
  const prompt = `
    Act as a financial analyst for the Dhaka Stock Exchange.
    Analyze ${stock.name} (${stock.symbol}).
    Sector: ${stock.sector}
    Price: ${stock.metrics.ltp}
    PE: ${stock.metrics.pe}
    RSI: ${stock.metrics.rsi}
    NAV: ${stock.metrics.nav}
    Dividend Yield: ${stock.metrics.dividendYield}%
    
    Provide a concise analysis in Markdown:
    1. **Bull Case**: Why buy?
    2. **Bear Case**: Why sell/avoid?
    3. **Verdict**: Buy / Hold / Sell (Short term vs Long term)
  `;

  // Add user message (hidden or shown as system init)
  addChatMessage('system', `Analyzing ${stock.symbol}...`);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": preferredModel,
        "messages": [
          {"role": "user", "content": prompt}
        ]
      })
    });

    if (!response.ok) throw new Error('AI Request failed');
    
    const data = await response.json();
    const markdown = data.choices[0].message.content;
    
    addChatMessage('ai', markdown);

  } catch (err) {
    addChatMessage('error', 'Error: ' + err.message);
  }
  
  // Handle Follow-up
  const handleSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    
    addChatMessage('user', text);
    input.value = '';
    
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": preferredModel,
          "messages": [
            {"role": "system", "content": `Context: Analyzing ${stock.symbol}. Previous analysis provided.`},
            {"role": "user", "content": text}
          ]
        })
      });

      if (!response.ok) throw new Error('AI Request failed');
      
      const data = await response.json();
      addChatMessage('ai', data.choices[0].message.content);

    } catch (err) {
      addChatMessage('error', 'Error: ' + err.message);
    }
  };

  sendBtn.onclick = handleSend;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') handleSend();
  };
};

const addChatMessage = (role, text) => {
  const container = document.getElementById('ai-chat-container');
  const div = document.createElement('div');
  
  div.style.padding = '1rem';
  div.style.borderRadius = '8px';
  div.style.maxWidth = '90%';
  div.style.lineHeight = '1.5';
  div.style.fontSize = '0.9rem';
  
  if (role === 'user') {
    div.style.background = '#e0f2fe';
    div.style.alignSelf = 'flex-end';
    div.style.color = '#0c4a6e';
    div.textContent = text;
  } else if (role === 'ai') {
    div.style.background = 'white';
    div.style.alignSelf = 'flex-start';
    div.style.border = '1px solid #e5e7eb';
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  } else if (role === 'system') {
    div.style.background = 'transparent';
    div.style.color = '#666';
    div.style.textAlign = 'center';
    div.style.alignSelf = 'center';
    div.style.fontStyle = 'italic';
    div.textContent = text;
  } else if (role === 'error') {
    div.style.background = '#fee2e2';
    div.style.color = '#991b1b';
    div.textContent = text;
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};

// Start
init();
