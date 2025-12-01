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

const analyzeStock = async (stock) => {
  const apiKey = localStorage.getItem('openrouter_key');
  const preferredModel = localStorage.getItem('openrouter_model') || "openai/gpt-oss-20b:free";
  
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
  
  // Build comprehensive data for AI
  const m = stock.metrics;
  const d = stock.deltas || {};
  
  const prompt = `
You are an expert financial analyst specializing in the Dhaka Stock Exchange (DSE), the main stock exchange of Bangladesh. 

## Context about DSE
- DSE is one of two stock exchanges in Bangladesh (the other being CSE - Chittagong Stock Exchange)
- Currency: Bangladeshi Taka (BDT/৳)
- Trading hours: Sunday to Thursday, 10:00 AM to 2:30 PM (Bangladesh Standard Time, UTC+6)
- Bangladesh is an emerging market economy with key sectors including: Textiles/RMG, Pharmaceuticals, Banking, Telecommunications, Cement, and Ceramics
- The market has circuit breaker limits and trading halts
- Key indices: DSEX (broad market), DS30 (blue chips), DSES (Shariah-compliant)
- Retail investor dominated market with high volatility
- Consider Bangladesh-specific factors: political stability, remittance flows, export earnings, foreign exchange reserves

Analyze ${stock.name} (${stock.symbol}).

## Basic Info
- Sector: ${stock.sector}
- Category: ${stock.category || 'N/A'}

## Price Data
- Last Traded Price (LTP): ${m.ltp}
- Close: ${m.close}
- Market Cap: ${m.mktCap} Mn

## Historical Price Performance
${d.price_1d != null ? '- 1-Day Change: ' + d.price_1d.toFixed(2) + '%' : ''}
${d.price_1w != null ? '- 1-Week Change: ' + d.price_1w.toFixed(2) + '%' : ''}
${d.price_1m != null ? '- 1-Month Change: ' + d.price_1m.toFixed(2) + '%' : ''}
${d.price_6m != null ? '- 6-Month Change: ' + d.price_6m.toFixed(2) + '%' : ''}
${d.price_1y != null ? '- 1-Year Change: ' + d.price_1y.toFixed(2) + '%' : ''}
${d.price_2y != null ? '- 2-Year Change: ' + d.price_2y.toFixed(2) + '%' : ''}
${d.price_3y != null ? '- 3-Year Change: ' + d.price_3y.toFixed(2) + '%' : ''}
${d.price_4y != null ? '- 4-Year Change: ' + d.price_4y.toFixed(2) + '%' : ''}
${d.price_5y != null ? '- 5-Year Change: ' + d.price_5y.toFixed(2) + '%' : ''}
${d.price_6y != null ? '- 6-Year Change: ' + d.price_6y.toFixed(2) + '%' : ''}
${d.price_7y != null ? '- 7-Year Change: ' + d.price_7y.toFixed(2) + '%' : ''}
${d.price_8y != null ? '- 8-Year Change: ' + d.price_8y.toFixed(2) + '%' : ''}
${d.price_9y != null ? '- 9-Year Change: ' + d.price_9y.toFixed(2) + '%' : ''}
${d.price_10y != null ? '- 10-Year Change: ' + d.price_10y.toFixed(2) + '%' : ''}
${d.price_11y != null ? '- 11-Year Change: ' + d.price_11y.toFixed(2) + '%' : ''}
${d.price_12y != null ? '- 12-Year Change: ' + d.price_12y.toFixed(2) + '%' : ''}
${d.price_13y != null ? '- 13-Year Change: ' + d.price_13y.toFixed(2) + '%' : ''}
${d.price_14y != null ? '- 14-Year Change: ' + d.price_14y.toFixed(2) + '%' : ''}
${d.price_15y != null ? '- 15-Year Change: ' + d.price_15y.toFixed(2) + '%' : ''}

## Technical Indicators
- RSI (14): ${m.rsi != null ? m.rsi.toFixed(2) : 'N/A'}
- MACD: ${m.macd != null ? m.macd.toFixed(4) : 'N/A'}
- MACD Signal: ${m.macdSignal != null ? m.macdSignal.toFixed(4) : 'N/A'}
- Williams %R: ${m.williamsR != null ? m.williamsR.toFixed(2) : 'N/A'}
- Beta: ${m.beta != null ? m.beta.toFixed(4) : 'N/A'}

## Moving Averages
- SMA 20: ${m.sma20 != null ? m.sma20.toFixed(2) : 'N/A'}
- SMA 50: ${m.sma50 != null ? m.sma50.toFixed(2) : 'N/A'}
- SMA 200: ${m.sma200 != null ? m.sma200.toFixed(2) : 'N/A'}
- EMA 9: ${m.ema9 != null ? m.ema9.toFixed(4) : 'N/A'}
- EMA 12: ${m.ema12 != null ? m.ema12.toFixed(4) : 'N/A'}
- EMA 26: ${m.ema26 != null ? m.ema26.toFixed(4) : 'N/A'}
- WMA 9: ${m.wma9 != null ? m.wma9.toFixed(4) : 'N/A'}
- WMA 12: ${m.wma12 != null ? m.wma12.toFixed(4) : 'N/A'}
- WMA 20: ${m.wma20 != null ? m.wma20.toFixed(4) : 'N/A'}

## Bollinger Bands
- Upper: ${m.bbUpper != null ? m.bbUpper.toFixed(4) : 'N/A'}
- Lower: ${m.bbLower != null ? m.bbLower.toFixed(4) : 'N/A'}

## Valuation Metrics
- P/E Ratio: ${m.pe != null ? m.pe.toFixed(2) : 'N/A'}
- P/B Ratio: ${m.pb != null ? m.pb.toFixed(2) : 'N/A'}
- NAV: ${m.nav != null ? m.nav.toFixed(2) : 'N/A'}
- EPS: ${m.eps != null ? m.eps.toFixed(2) : 'N/A'}
- Audited P/E: ${m.auditedPe != null ? m.auditedPe.toFixed(2) : 'N/A'}
- Forward P/E: ${m.forwardPe != null ? m.forwardPe.toFixed(2) : 'N/A'}
- Dividend Yield: ${m.dividendYield != null ? m.dividendYield.toFixed(2) + '%' : 'N/A'}

## Volume & Liquidity
- Volume: ${m.volume != null ? m.volume.toLocaleString() : 'N/A'}
- Value (Cr): ${m.value != null ? m.value.toFixed(3) : 'N/A'}
${d.vol_1d != null ? '- 1-Day Volume Change: ' + d.vol_1d.toFixed(2) + '%' : ''}
${d.vol_1w != null ? '- 1-Week Volume Change: ' + d.vol_1w.toFixed(2) + '%' : ''}
${d.vol_1m != null ? '- 1-Month Volume Change: ' + d.vol_1m.toFixed(2) + '%' : ''}
${d.vol_6m != null ? '- 6-Month Volume Change: ' + d.vol_6m.toFixed(2) + '%' : ''}
${d.vol_1y != null ? '- 1-Year Volume Change: ' + d.vol_1y.toFixed(2) + '%' : ''}
${d.vol_2y != null ? '- 2-Year Volume Change: ' + d.vol_2y.toFixed(2) + '%' : ''}
${d.vol_3y != null ? '- 3-Year Volume Change: ' + d.vol_3y.toFixed(2) + '%' : ''}
${d.vol_4y != null ? '- 4-Year Volume Change: ' + d.vol_4y.toFixed(2) + '%' : ''}
${d.vol_5y != null ? '- 5-Year Volume Change: ' + d.vol_5y.toFixed(2) + '%' : ''}
- Trade Value (TV): ${m.tv != null ? m.tv.toFixed(2) : 'N/A'}
- Chaikin Oscillator (CO): ${m.co != null ? m.co.toFixed(4) : 'N/A'}

## Financial Health (if available)
- Current Ratio: ${m.currentRatio != null ? m.currentRatio.toFixed(2) : 'N/A'}
- Quick Ratio: ${m.quickRatio != null ? m.quickRatio.toFixed(2) : 'N/A'}
- Debt to Equity: ${m.debtToEquity != null ? m.debtToEquity.toFixed(2) : 'N/A'}

## Profitability Margins (if available)
- Gross Margin: ${m.grossMargin != null ? (m.grossMargin * 100).toFixed(2) + '%' : 'N/A'}
- Operating Margin: ${m.operatingMargin != null ? (m.operatingMargin * 100).toFixed(2) + '%' : 'N/A'}
- Net Margin: ${m.netMargin != null ? (m.netMargin * 100).toFixed(2) + '%' : 'N/A'}
- EBITDA Margin: ${m.ebitdaMargin != null ? (m.ebitdaMargin * 100).toFixed(2) + '%' : 'N/A'}

## Returns (if available)
- ROA: ${m.roa != null ? (m.roa * 100).toFixed(2) + '%' : 'N/A'}
- ROE: ${m.roe != null ? (m.roe * 100).toFixed(2) + '%' : 'N/A'}
- ROI: ${m.roi != null ? (m.roi * 100).toFixed(2) + '%' : 'N/A'}

## Share Info
- Paid Up Capital: ${m.paidUpCapital != null ? m.paidUpCapital.toLocaleString() : 'N/A'}
- Total Shares: ${m.totalShares != null ? m.totalShares.toLocaleString() : 'N/A'}

Provide a concise analysis in Markdown format:
1. **Bull Case**: Why buy?
2. **Bear Case**: Why sell/avoid?
3. **Technical Outlook**: Based on RSI, MACD, moving averages
4. **Verdict**: Buy / Hold / Sell (Short term vs Long term)
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
    
    // Show thinking indicator
    const thinkingId = addChatMessage('thinking', 'AI is thinking...');
    
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
      
      // Remove thinking indicator
      removeChatMessage(thinkingId);
      
      const data = await response.json();
      addChatMessage('ai', data.choices[0].message.content);

    } catch (err) {
      removeChatMessage(thinkingId);
      addChatMessage('error', 'Error: ' + err.message);
    }
  };

  sendBtn.onclick = handleSend;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') handleSend();
  };
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
