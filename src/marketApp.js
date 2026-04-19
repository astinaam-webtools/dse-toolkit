import { getStockBuckets, filterStocks, getSectorHeatmap } from './lib/marketLogic.js';

// State
let marketData = null;
let currentView = 'buckets';
let activeSectorFilter = null; // Track active sector filter
let activeBucketFilter = null; // Track active bucket filter
let activeQuickFilter = null;
let screenerSort = 'change-desc';

// DOM Elements
const els = {
  date: document.getElementById('market-date'),
  statusDot: document.getElementById('market-status-dot'),
  search: document.getElementById('stock-search'),
  quickFilters: document.getElementById('quick-filters'),
  resultLine: document.getElementById('market-result-line'),
  screenerSort: document.getElementById('screener-sort'),
  buckets: document.getElementById('bucket-container'),
  screenerBody: document.getElementById('screener-body'),
  modal: document.getElementById('stock-modal'),
  modalBody: document.getElementById('modal-body'),
  tabs: document.querySelectorAll('.tab-btn'),
  views: document.querySelectorAll('.view-section')
};

const getChangeValue = (stock) => Number(stock?.deltas?.price_1d || 0);
const getVolumeValue = (stock) => Number(stock?.metrics?.volume || 0);
const getPeValue = (stock) => Number(stock?.metrics?.pe || 0);

const applyQuickFilter = (stocks) => {
  if (!activeQuickFilter || activeQuickFilter === 'clear') {
    return stocks;
  }

  if (activeQuickFilter === 'gainers') {
    return stocks
      .filter((stock) => getChangeValue(stock) > 0)
      .sort((a, b) => getChangeValue(b) - getChangeValue(a))
      .slice(0, 30);
  }

  if (activeQuickFilter === 'losers') {
    return stocks
      .filter((stock) => getChangeValue(stock) < 0)
      .sort((a, b) => getChangeValue(a) - getChangeValue(b))
      .slice(0, 30);
  }

  if (activeQuickFilter === 'volume') {
    return stocks.sort((a, b) => getVolumeValue(b) - getVolumeValue(a)).slice(0, 30);
  }

  if (activeQuickFilter === 'value') {
    return stocks
      .filter((stock) => {
        const pe = getPeValue(stock);
        const dividend = Number(stock?.metrics?.dividendYield || 0);
        return pe > 0 && pe <= 15 && dividend >= 3;
      })
      .sort((a, b) => getPeValue(a) - getPeValue(b))
      .slice(0, 40);
  }

  return stocks;
};

const sortScreenerStocks = (stocks) => {
  const list = [...stocks];

  if (screenerSort === 'change-asc') {
    return list.sort((a, b) => getChangeValue(a) - getChangeValue(b));
  }

  if (screenerSort === 'volume-desc') {
    return list.sort((a, b) => getVolumeValue(b) - getVolumeValue(a));
  }

  if (screenerSort === 'pe-asc') {
    return list.sort((a, b) => {
      const aPe = getPeValue(a);
      const bPe = getPeValue(b);
      if (!aPe && !bPe) return 0;
      if (!aPe) return 1;
      if (!bPe) return -1;
      return aPe - bPe;
    });
  }

  if (screenerSort === 'symbol-asc') {
    return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  return list.sort((a, b) => getChangeValue(b) - getChangeValue(a));
};

const setQuickFilterUI = () => {
  if (!els.quickFilters) {
    return;
  }

  els.quickFilters.querySelectorAll('[data-quick-filter]').forEach((btn) => {
    const filter = btn.dataset.quickFilter;
    btn.classList.toggle('active', filter === activeQuickFilter && filter !== 'clear');
  });
};

const getQuickFilterLabel = () => {
  const labels = {
    gainers: 'Top Gainers',
    losers: 'Top Losers',
    volume: 'High Volume',
    value: 'Value Picks'
  };
  return labels[activeQuickFilter] || '';
};

const updateResultLine = (stockCount, query = '') => {
  if (!els.resultLine) {
    return;
  }

  const parts = [`${stockCount} stocks`];
  if (activeBucketFilter) {
    parts.push('bucket filtered');
  }
  if (activeSectorFilter) {
    parts.push(`sector: ${activeSectorFilter}`);
  }
  if (activeQuickFilter) {
    parts.push(`quick filter: ${getQuickFilterLabel()}`);
  }
  if (query && !query.startsWith('Bucket:') && !query.startsWith('Sector:')) {
    parts.push(`search: "${query}"`);
  }

  els.resultLine.textContent = `Showing ${parts.join(' | ')}`;
};

// --- Initialization ---

const init = async () => {
  try {
    // Network-first strategy: Try live data, fallback to local
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
    
    renderHeader();
    renderView();
    setQuickFilterUI();
    
    // Event Listeners
    els.search.addEventListener('input', (e) => {
      // Clear filters if user types (and removes the prefix)
      if (activeSectorFilter && !e.target.value.startsWith('Sector:')) {
        activeSectorFilter = null;
      }
      if (activeBucketFilter && !e.target.value.startsWith('Bucket:')) {
        activeBucketFilter = null;
      }
      renderView(e.target.value);
    });

    els.quickFilters?.addEventListener('click', (event) => {
      const target = event.target.closest('[data-quick-filter]');
      if (!target) {
        return;
      }

      const filter = target.dataset.quickFilter;
      if (filter === 'clear') {
        activeQuickFilter = null;
      } else {
        activeQuickFilter = activeQuickFilter === filter ? null : filter;
      }

      setQuickFilterUI();
      renderView(els.search.value);
    });

    els.screenerSort?.addEventListener('change', (event) => {
      screenerSort = event.target.value || 'change-desc';
      if (currentView === 'screener') {
        renderView(els.search.value);
      }
    });

    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        // Switch Tab UI
        els.tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Switch View
        currentView = btn.dataset.view;
        els.views.forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${currentView}`).classList.add('active');
        
        // Clear filters when switching away from screener
        if (currentView !== 'screener' && (activeSectorFilter || activeBucketFilter)) {
          activeSectorFilter = null;
          activeBucketFilter = null;
          els.search.value = '';
        }
        
        renderView(els.search.value);
      });
    });

  } catch (err) {
    console.error(err);
    els.buckets.innerHTML = `<p class="error">Error loading market data. Please try again later.</p>`;
  }
};

// --- Rendering ---

const renderHeader = () => {
  const date = new Date(marketData.metadata.marketDate);
  els.date.textContent = date.toLocaleDateString('en-GB', { 
    day: 'numeric', month: 'short', year: 'numeric' 
  });
  
  // Simple logic: if data is from today (and it's weekday 10am-2:30pm), it's open. 
  // For static site, we usually just show the date of the snapshot.
  els.statusDot.classList.remove('closed');
  els.statusDot.classList.add('open'); // Assuming latest data implies "active" context
};

const renderView = (query = '') => {
  if (!marketData) return;
  
  // Determine which stocks to display based on active filters
  let stocks;
  
  if (currentView === 'screener') {
    // Priority: bucket filter > sector filter > search query
    if (activeBucketFilter) {
      const bucket = getStockBuckets(marketData.stocks).find(b => b.id === activeBucketFilter);
      stocks = bucket ? bucket.matches : [];
      // Also apply search query if present and not the filter label
      if (query && !query.startsWith('Bucket:') && !query.startsWith('Sector:')) {
        stocks = filterStocks(stocks, query);
      }
    } else if (activeSectorFilter) {
      stocks = marketData.stocks.filter(s => s.sector === activeSectorFilter);
      // Also apply search query if present and not the filter label
      if (query && !query.startsWith('Bucket:') && !query.startsWith('Sector:')) {
        stocks = filterStocks(stocks, query);
      }
    } else {
      stocks = filterStocks(marketData.stocks, query);
    }

    stocks = applyQuickFilter(stocks);
  } else {
    stocks = filterStocks(marketData.stocks, query);
  }

  updateResultLine(stocks.length, query);

  if (currentView === 'buckets') {
    renderBuckets(stocks);
  } else if (currentView === 'screener') {
    renderScreener(stocks);
  } else if (currentView === 'heatmap') {
    renderHeatmap(stocks);
  }
};

const renderBuckets = (stocks) => {
  const buckets = getStockBuckets(stocks);
  
  if (buckets.length === 0) {
    els.buckets.innerHTML = `<p class="muted">No stocks match the criteria.</p>`;
    return;
  }

  els.buckets.innerHTML = buckets.map(b => `
    <article class="bucket-card">
      <div class="bucket-header">
        <div class="bucket-title-group">
          <span class="bucket-title">${b.title}</span>
        </div>
        <span class="bucket-count">${b.matches.length}</span>
      </div>
      <p class="bucket-description">${b.description}</p>
      <p class="bucket-meta"><strong>Criteria:</strong> ${b.criteria}</p>
      <p class="bucket-meta"><strong>Formula:</strong> ${b.formula}</p>
      <div class="stock-list">
        ${b.matches.slice(0, 5).map(stock => renderStockRow(stock)).join('')}
      </div>
      ${b.matches.length > 5 ? `<button class="btn-more" onclick="window.filterScreenerByBucket('${b.id}')">See all ${b.matches.length}</button>` : ''}
    </article>
  `).join('');
  
  // Re-attach click handlers for rows (since innerHTML kills them)
  // Using delegation on container instead
};

window.filterScreenerByBucket = (bucketId) => {
  // Set the active bucket filter
  activeBucketFilter = bucketId;
  activeSectorFilter = null; // Clear sector filter
  activeQuickFilter = null;
  setQuickFilterUI();
  
  // Switch to screener tab
  const screenerTab = document.querySelector('.tab-btn[data-view="screener"]');
  if (screenerTab) screenerTab.click();
  
  // Update search box to show what's happening (cosmetic)
  const bucket = getStockBuckets(marketData.stocks).find(b => b.id === bucketId);
  if (bucket) {
    els.search.value = `Bucket: ${bucket.title}`;
  }
  
  // Render will use the activeBucketFilter state
  renderView();
};

const renderScreener = (stocks) => {
  const sortedStocks = sortScreenerStocks(stocks);
  const displayStocks = sortedStocks.slice(0, 100);
  
  els.screenerBody.innerHTML = displayStocks.map(stock => `
    <tr onclick="window.openStock('${stock.symbol}')">
      <td>
        <div style="font-weight:600">${stock.symbol}</div>
        <div style="font-size:0.75rem; color:#888">${stock.sector}</div>
      </td>
      <td style="text-align:right">
        <span class="price">${stock.metrics.ltp}</span>
      </td>
      <td style="text-align:right">
        <span class="change ${stock.deltas.price_1d >= 0 ? 'up' : 'down'}">
          ${stock.deltas.price_1d ? (stock.deltas.price_1d > 0 ? '+' : '') + stock.deltas.price_1d.toFixed(2) + '%' : '-'}
        </span>
      </td>
      <td style="text-align:center">
        ${renderSparkline(stock.sparkline, stock.deltas.price_1d >= 0)}
      </td>
    </tr>
  `).join('');
};

const renderHeatmap = (stocks) => {
  const container = document.getElementById('heatmap-container');
  if (!container) return;

  // Use the new aggregation function
  const sectors = getSectorHeatmap(stocks);
  
  if (sectors.length === 0) {
    container.innerHTML = `<p class="muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No sectors to display.</p>`;
    return;
  }

  container.innerHTML = sectors.map(sector => {
    const changeClass = sector.avgChange > 0 ? 'positive' : sector.avgChange < 0 ? 'negative' : 'neutral';
    const changeArrow = sector.avgChange > 0 ? '↑' : sector.avgChange < 0 ? '↓' : '→';
    const changeStyle = sector.avgChange > 0 ? 'up' : sector.avgChange < 0 ? 'down' : 'neutral';
    
    // Calculate size based on market cap (larger tiles for bigger sectors)
    // We'll use grid-column-end to make bigger sectors span more columns
    const sizeClass = sector.totalMktCap > 50000 ? 'large' : sector.totalMktCap > 10000 ? 'medium' : 'small';
    
    return `
      <div class="sector-tile ${changeClass}" 
           data-sector="${sector.name}"
           onclick="window.filterBySector('${sector.name}')">
        <div class="sector-name">${sector.name}</div>
        <div class="sector-change ${changeStyle}">
          ${changeArrow} ${sector.avgChange > 0 ? '+' : ''}${sector.avgChange.toFixed(2)}%
        </div>
        <div class="sector-stats">
          <div class="sector-stat">
            <span>Stocks</span>
            <strong>${sector.stockCount}</strong>
          </div>
          <div class="sector-stat">
            <span>Mkt Cap</span>
            <strong>${formatMarketCap(sector.totalMktCap)}</strong>
          </div>
          <div class="sector-stat">
            <span style="color: var(--color-up)">↑${sector.positiveCount}</span>
            <span style="color: var(--color-down)">↓${sector.negativeCount}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

// Helper function to format market cap
const formatMarketCap = (cap) => {
  if (cap >= 1000) return `${(cap / 1000).toFixed(1)}B`;
  return `${cap.toFixed(0)}M`;
};

// Global function to filter screener by sector
window.filterBySector = (sectorName) => {
  // Set the active sector filter
  activeSectorFilter = sectorName;
  activeBucketFilter = null; // Clear bucket filter
  activeQuickFilter = null;
  setQuickFilterUI();
  
  // Switch to screener tab
  const screenerTab = document.querySelector('.tab-btn[data-view="screener"]');
  if (screenerTab) screenerTab.click();
  
  // Update search box to show what's happening (cosmetic)
  els.search.value = `Sector: ${sectorName}`;
  
  // Render will use the activeSectorFilter state
  renderView();
};

const renderStockRow = (stock) => `
  <div class="stock-row" onclick="window.openStock('${stock.symbol}')">
    <div class="stock-info">
      <h4>${stock.symbol}</h4>
      <p>${stock.metrics.pe ? 'PE ' + stock.metrics.pe : 'N/A'}</p>
    </div>
    <div class="stock-metrics">
      <span class="price">${stock.metrics.ltp}</span>
      <span class="change ${stock.deltas.price_1d >= 0 ? 'up' : 'down'}">
        ${stock.deltas.price_1d ? stock.deltas.price_1d.toFixed(1) + '%' : ''}
      </span>
    </div>
  </div>
`;

const renderSparkline = (data, isUp) => {
  if (!data || data.length < 2) return '';
  
  const width = 60;
  const height = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return `
    <svg width="${width}" height="${height}" class="sparkline ${isUp ? 'up' : 'down'}">
      <polyline points="${points}" />
    </svg>
  `;
};

// --- Modal Logic ---

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
  }
});

window.openStock = (symbol) => {
  const stock = marketData.stocks.find(s => s.symbol === symbol);
  if (!stock) return;

  const m = stock.metrics;
  
  els.modalBody.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem;">
      <div>
        <h2 style="margin:0; color:var(--text);">${stock.symbol}</h2>
        <p style="margin:0; color:var(--muted); font-size:0.9rem;">${stock.name}</p>
        <span style="background:rgba(148,163,184,0.2); padding:2px 6px; border-radius:4px; font-size:0.75rem; color:var(--text);">${stock.sector}</span>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.5rem; font-weight:700; color:var(--text);">${m.ltp}</div>
        <div style="color:${stock.deltas.price_1d >= 0 ? '#10b981' : '#ef4444'}">
          ${stock.deltas.price_1d ? stock.deltas.price_1d.toFixed(2) + '%' : ''}
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
      <div class="modal-metric-card">
        <div style="font-size:0.75rem; color:var(--muted);">PE Ratio</div>
        <div style="font-weight:600; color:var(--text);">${m.pe || '-'}</div>
      </div>
      <div class="modal-metric-card">
        <div style="font-size:0.75rem; color:var(--muted);">RSI (14)</div>
        <div style="font-weight:600; color:var(--text);">${m.rsi ? m.rsi.toFixed(1) : '-'}</div>
      </div>
      <div class="modal-metric-card">
        <div style="font-size:0.75rem; color:var(--muted);">NAV</div>
        <div style="font-weight:600; color:var(--text);">${m.nav || '-'}</div>
      </div>
      <div class="modal-metric-card">
        <div style="font-size:0.75rem; color:var(--muted);">Dividend Yield</div>
        <div style="font-weight:600; color:var(--text);">${m.dividendYield ? m.dividendYield + '%' : '-'}</div>
      </div>
    </div>
    
    <a href="./stock.html?symbol=${stock.symbol}" class="btn-more" style="display:block; text-align:center; text-decoration:none; margin-bottom:1rem;">
      View Full Details →
    </a>

    <button class="btn-ai" id="btn-analyze" onclick="window.analyzeStock('${stock.symbol}')">
      ✨ Analyze with AI
    </button>
    <div id="ai-output" class="ai-result" style="display:none;"></div>
  `;
  
  els.modal.classList.add('open');
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

window.analyzeStock = async (symbol) => {
  const params = new URLSearchParams({
    source: 'market',
    symbol,
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
