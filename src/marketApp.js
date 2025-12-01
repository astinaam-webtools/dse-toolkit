import { getStockBuckets, filterStocks } from './lib/marketLogic.js';

// State
let marketData = null;
let currentView = 'buckets';

// DOM Elements
const els = {
  date: document.getElementById('market-date'),
  statusDot: document.getElementById('market-status-dot'),
  search: document.getElementById('stock-search'),
  buckets: document.getElementById('bucket-container'),
  screenerBody: document.getElementById('screener-body'),
  modal: document.getElementById('stock-modal'),
  modalBody: document.getElementById('modal-body'),
  tabs: document.querySelectorAll('.tab-btn'),
  views: document.querySelectorAll('.view-section')
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
    
    // Event Listeners
    els.search.addEventListener('input', (e) => {
      renderView(e.target.value);
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
  
  const stocks = filterStocks(marketData.stocks, query);

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
          <span class="info-icon" onclick="alert('${b.description}\\n\\nCriteria: ${b.criteria}\\nFormula: ${b.formula}')" title="Criteria">ⓘ</span>
        </div>
        <span class="bucket-count">${b.matches.length}</span>
      </div>
      <p style="font-size:0.85rem; color:#666; margin-bottom:1rem;">${b.description}</p>
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
  // Switch to screener tab
  const screenerTab = document.querySelector('.tab-btn[data-view="screener"]');
  if (screenerTab) screenerTab.click();
  
  // We need to filter the screener view. 
  // Since the current architecture filters by search query, we might need a way to filter by bucket ID.
  // For now, let's just alert as a placeholder or implement a simple filter override.
  // Ideally, we update the state to filter by bucket.
  
  // Hacky way: Set search input to a special prefix or handle state better.
  // Better way: Add a filter state.
  
  // Let's just filter by the bucket logic directly and render.
  const bucket = getStockBuckets(marketData.stocks).find(b => b.id === bucketId);
  if (bucket) {
    renderScreener(bucket.matches);
    // Update search box to show what's happening
    els.search.value = `Bucket: ${bucket.title}`;
  }
};

const renderScreener = (stocks) => {
  // Limit to 50 for performance if no search
  const displayStocks = stocks.slice(0, 100); 
  
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

  // Group by sector
  const sectors = {};
  stocks.forEach(s => {
    if (!sectors[s.sector]) sectors[s.sector] = [];
    sectors[s.sector].push(s);
  });

  // Sort sectors by number of stocks (desc)
  const sortedSectors = Object.entries(sectors).sort((a, b) => b[1].length - a[1].length);

  container.innerHTML = sortedSectors.map(([sectorName, sectorStocks]) => `
    <div class="heatmap-sector">
      <h3 style="grid-column: 1/-1; margin: 1rem 0 0.5rem; font-size: 0.9rem; color: #666;">${sectorName}</h3>
      ${sectorStocks.map(s => {
        const change = s.deltas.price_1d || 0;
        let color = '#eee';
        if (change > 0) {
          // Green scale
          const intensity = Math.min(change / 5, 1); // Cap at 5%
          color = `rgba(34, 197, 94, ${0.2 + intensity * 0.8})`;
        } else if (change < 0) {
          // Red scale
          const intensity = Math.min(Math.abs(change) / 5, 1);
          color = `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`;
        }
        
        return `
          <div class="heatmap-tile" 
               style="background-color: ${color}; padding: 0.5rem; border-radius: 4px; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 60px;"
               onclick="window.openStock('${s.symbol}')"
               title="${s.name} (${change.toFixed(2)}%)">
            <div style="font-weight: 600; font-size: 0.8rem;">${s.symbol}</div>
            <div style="font-size: 0.7rem;">${change > 0 ? '+' : ''}${change.toFixed(1)}%</div>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
  
  // Update grid style dynamically if needed, but CSS grid auto-fill handles it well.
  // We might want to ensure the container has the right grid style.
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(80px, 1fr))';
  container.style.gap = '0.5rem';
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

// Save settings on Enter
document.getElementById('api-key-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    window.saveSettings();
  }
});

window.openStock = (symbol) => {
  const stock = marketData.stocks.find(s => s.symbol === symbol);
  if (!stock) return;

  const m = stock.metrics;
  
  els.modalBody.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem;">
      <div>
        <h2 style="margin:0;">${stock.symbol}</h2>
        <p style="margin:0; color:#666; font-size:0.9rem;">${stock.name}</p>
        <span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${stock.sector}</span>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.5rem; font-weight:700;">${m.ltp}</div>
        <div style="color:${stock.deltas.price_1d >= 0 ? 'var(--color-up)' : 'var(--color-down)'}">
          ${stock.deltas.price_1d ? stock.deltas.price_1d.toFixed(2) + '%' : ''}
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
      <div style="background:#f9fafb; padding:10px; border-radius:8px;">
        <div style="font-size:0.75rem; color:#666;">PE Ratio</div>
        <div style="font-weight:600;">${m.pe || '-'}</div>
      </div>
      <div style="background:#f9fafb; padding:10px; border-radius:8px;">
        <div style="font-size:0.75rem; color:#666;">RSI (14)</div>
        <div style="font-weight:600;">${m.rsi ? m.rsi.toFixed(1) : '-'}</div>
      </div>
      <div style="background:#f9fafb; padding:10px; border-radius:8px;">
        <div style="font-size:0.75rem; color:#666;">NAV</div>
        <div style="font-weight:600;">${m.nav || '-'}</div>
      </div>
      <div style="background:#f9fafb; padding:10px; border-radius:8px;">
        <div style="font-size:0.75rem; color:#666;">Dividend Yield</div>
        <div style="font-weight:600;">${m.dividendYield ? m.dividendYield + '%' : '-'}</div>
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

window.analyzeStock = async (symbol) => {
  const apiKey = localStorage.getItem('openrouter_key');
  const preferredModel = localStorage.getItem('openrouter_model') || "meta-llama/llama-3-8b-instruct:free";
  
  if (!apiKey) {
    alert('Please set your OpenRouter API Key in Settings first.');
    return;
  }

  const stock = marketData.stocks.find(s => s.symbol === symbol);
  
  // Open AI Modal
  const modal = document.getElementById('ai-modal');
  const chatContainer = document.getElementById('ai-chat-container');
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send-btn');
  
  modal.classList.add('open');
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
