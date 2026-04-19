import { terms } from './data/terms.js';
import { filterTerms, highlightText, tokenize } from './lib/filterTerms.js';
import { analyzeStock } from './lib/behaviorProfiler.js';

const termContainer = document.getElementById('terms');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const analyzerForm = document.getElementById('behavior-form');
const analysisOutput = document.getElementById('analysis-output');
const marketGlance = document.getElementById('market-glance');
const quickTermChips = document.getElementById('quick-term-chips');
const recentSearchesEl = document.getElementById('recent-searches');
const categoryChipsEl = document.getElementById('category-chips');
const surpriseTermBtn = document.getElementById('surprise-term');

const RECENT_SEARCHES_KEY = 'dse_toolkit_recent_searches_v1';
const MAX_RECENT_SEARCHES = 6;

const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderCards = (dataset, tokens = []) => {
  if (!termContainer || !stats) return;

  if (!dataset.length) {
    termContainer.innerHTML = '<p class="empty">No terms match your search yet.</p>';
    stats.textContent = '0 terms displayed';
    return;
  }

  termContainer.innerHTML = dataset
    .map((term) => `
      <article class="term-card">
        <div class="meta">
          <span class="short">${highlightText(term.shortForm, tokens)}</span>
          <span>·</span>
          <span class="category">${highlightText(term.category || 'General', tokens)}</span>
        </div>
        <h2>${highlightText(term.title, tokens)}</h2>
        <p class="description">${highlightText(term.description, tokens)}</p>
        <div>
          <p class="label">Why it matters</p>
          <p class="description">${highlightText(term.whyItMatters, tokens)}</p>
        </div>
        <div>
          <p class="label">Reading the value</p>
          <p class="description">${highlightText(term.watchFor, tokens)}</p>
        </div>
        <div class="badges">
          ${(term.tags || [])
        .map((tag) => `<span class="badge">${tag}</span>`)
        .join('')}
        </div>
        ${term.chartGuideId ? `<a class="chart-link" href="./guides.html#${term.chartGuideId}" target="_blank" rel="noopener">How to locate & read this on charts →</a>` : ''}
      </article>
    `)
    .join('');

  stats.textContent = `${dataset.length} ${dataset.length === 1 ? 'term' : 'terms'} displayed`;
};

const renderFeaturedTerm = () => {
  if (!termContainer || !terms.length) return;
  const randomTerm = terms[Math.floor(Math.random() * terms.length)];

  termContainer.innerHTML = `
    <div class="featured-header">
      <span class="featured-header__icon" aria-hidden="true">💡</span>
      <h3 class="featured-header__title">Term of the Day</h3>
    </div>
    <article class="term-card featured">
      <div class="meta">
        <span class="short">${randomTerm.shortForm}</span>
        <span>·</span>
        <span class="category">${randomTerm.category || 'General'}</span>
      </div>
      <h2>${randomTerm.title}</h2>
      <p class="description">${randomTerm.description}</p>
      <div>
        <p class="label">Why it matters</p>
        <p class="description">${randomTerm.whyItMatters}</p>
      </div>
      <div class="badges">
        ${(randomTerm.tags || [])
          .map((tag) => `<span class="badge">${tag}</span>`)
          .join('')}
      </div>
      <div class="featured-cta">
        <button class="btn" id="show-all-terms">Browse all ${terms.length} terms</button>
      </div>
    </article>
  `;

  document.getElementById('show-all-terms')?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
    }
    renderCards(terms, []);
  });

  stats.textContent = 'Featured term';
};

const initMarketGlance = async () => {
  if (!marketGlance) return;
  
  try {
    const res = await fetch('./src/data/dse-market.json');
    if (!res.ok) throw new Error('Failed to load market data');
    const data = await res.json();
    
    const stocks = data.stocks || [];
    const up = stocks.filter(s => s.deltas && s.deltas.price_1d > 0).length;
    const down = stocks.filter(s => s.deltas && s.deltas.price_1d < 0).length;
    const totalValue = stocks.reduce((acc, s) => acc + (s.metrics.value || 0), 0);
    
    // Determine status
    let status = 'Neutral';
    let statusClass = 'neutral';
    if (up > down * 1.1) { status = 'Bullish'; statusClass = 'up'; }
    else if (down > up * 1.1) { status = 'Bearish'; statusClass = 'down'; }
    
    marketGlance.innerHTML = `
      <div class="market-glance__item">
        <span class="label">Market Status</span>
        <span class="value ${statusClass}">${status}</span>
      </div>
      <div class="market-glance__item">
        <span class="label">Trade Value</span>
        <span class="value">${totalValue.toFixed(1)}mn</span>
      </div>
      <div class="market-glance__item">
        <span class="label">Up / Down</span>
        <span class="value">
          <span class="market-glance__number up">${up}</span> /
          <span class="market-glance__number down">${down}</span>
        </span>
      </div>
    `;
    marketGlance.classList.remove('hidden');
    
  } catch (e) {
    console.error(e);
    marketGlance.innerHTML = '<p class="muted market-glance__fallback">Market data unavailable</p>';
    marketGlance.classList.remove('hidden');
  }
};

const getRecentSearches = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const saveRecentSearches = (items) => {
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES)));
};

const addRecentSearch = (query) => {
  const normalized = String(query || '').trim();
  if (!normalized || normalized.length < 2) {
    return;
  }

  const existing = getRecentSearches().filter((item) => item.toLowerCase() !== normalized.toLowerCase());
  saveRecentSearches([normalized, ...existing]);
};

const renderRecentSearches = () => {
  if (!recentSearchesEl) {
    return;
  }

  const recent = getRecentSearches();
  if (!recent.length) {
    recentSearchesEl.innerHTML = '<span class="chip chip--placeholder">No recent searches yet</span>';
    return;
  }

  recentSearchesEl.innerHTML = recent
    .map(
      (query) =>
        `<button class="chip" type="button" data-recent-query="${escapeHtml(query)}">${escapeHtml(query)}</button>`
    )
    .join('');
};

const renderCategoryChips = () => {
  if (!categoryChipsEl) {
    return;
  }

  const categoryCounts = terms.reduce((acc, term) => {
    const category = term.category || 'General';
    acc.set(category, (acc.get(category) || 0) + 1);
    return acc;
  }, new Map());

  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 8);

  categoryChipsEl.innerHTML = topCategories
    .map(
      ([name, count]) =>
        `<button class="chip chip--soft" type="button" data-category-query="${escapeHtml(name)}">${escapeHtml(name)} (${count})</button>`
    )
    .join('');
};

const debounce = (fn, wait = 200) => {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

const runSearch = (query) => {
  const cleaned = String(query || '').trim();

  if (!cleaned) {
    renderFeaturedTerm();
    return;
  }

  const tokens = tokenize(cleaned);
  const filtered = filterTerms(terms, cleaned);
  renderCards(filtered, tokens);
};

const handleInput = (event) => {
  const query = event.target.value;

  if (!query.trim()) {
    renderFeaturedTerm();
    return;
  }

  runSearch(query);
};


if (termContainer && searchInput) {
  // Check for query parameter on page load
  const urlParams = new URLSearchParams(window.location.search);
  const queryParam = urlParams.get('q');
  const refParam = urlParams.get('ref');
  const symbolParam = urlParams.get('symbol');

  if (refParam === 'stock' && symbolParam) {
    const heroActions = document.querySelector('.hero__actions');
    if (heroActions) {
      const backBtn = document.createElement('a');
      backBtn.className = 'btn btn--dark';
      backBtn.href = `stock.html?symbol=${encodeURIComponent(symbolParam)}`;
      backBtn.textContent = `← Back to ${symbolParam}`;

      // Insert as first child
      heroActions.insertBefore(backBtn, heroActions.firstChild);
    }
  }

  renderCategoryChips();
  renderRecentSearches();

  quickTermChips?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-query]');
    if (!chip || !searchInput) {
      return;
    }

    const query = chip.getAttribute('data-query') || '';
    searchInput.value = query;
    runSearch(query);
    addRecentSearch(query);
    renderRecentSearches();
    termContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  surpriseTermBtn?.addEventListener('click', () => {
    if (!searchInput || !terms.length) {
      return;
    }

    const randomTerm = terms[Math.floor(Math.random() * terms.length)];
    const query = randomTerm.shortForm || randomTerm.title;
    searchInput.value = query;
    runSearch(query);
    addRecentSearch(query);
    renderRecentSearches();
    termContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  recentSearchesEl?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-recent-query]');
    const query = chip?.getAttribute('data-recent-query');
    if (!query || !searchInput) {
      return;
    }

    searchInput.value = query;
    runSearch(query);
    termContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  categoryChipsEl?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-category-query]');
    const query = chip?.getAttribute('data-category-query');
    if (!query || !searchInput) {
      return;
    }

    searchInput.value = query;
    runSearch(query);
    addRecentSearch(query);
    renderRecentSearches();
    termContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  if (queryParam) {
    // Set the search input value to the query parameter
    searchInput.value = queryParam;
    searchInput.setAttribute('value', queryParam); // Ensure attribute is set for some browsers

    // Trigger the search
    runSearch(queryParam);
    addRecentSearch(queryParam);
    renderRecentSearches();

    // Scroll to results for better visibility
    setTimeout(() => {
      termContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } else {
    // Normal initialization
    renderFeaturedTerm();
  }
  
  // Always show market glance
  initMarketGlance();

  // debounce input for better UX on mobile
  searchInput.addEventListener('input', debounce(handleInput, 180));

  // keyboard: Esc clears the search
  searchInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      searchInput.value = '';
      renderFeaturedTerm();
      return;
    }

    if (ev.key === 'Enter') {
      addRecentSearch(searchInput.value);
      renderRecentSearches();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== '/') {
      return;
    }

    const target = ev.target;
    const isEditable =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable;

    if (isEditable) {
      return;
    }

    ev.preventDefault();
    searchInput.focus();
    searchInput.select();
  });
}


const renderAnalysis = (result) => {
  if (!analysisOutput) return;
  if (!result.matches.length) {
    analysisOutput.innerHTML = '<p class="muted">Enter realistic values above to see behaviour insights.</p>';
    return;
  }

  analysisOutput.innerHTML = `
    <div class="analysis-summary">
      <p class="muted">Suggested investing lens:</p>
      <h3>${result.primary.title}</h3>
      <p>${result.primary.summary}</p>
    </div>
    <div class="analysis-grid">
      ${result.matches
      .map(
        (bucket) => `
          <article class="analysis-card">
            <h4>${bucket.title}</h4>
            <p>${bucket.summary}</p>
            <ul>
              ${bucket.triggers.map((tip) => `<li>${tip}</li>`).join('')}
            </ul>
            <p class="label">When to invest</p>
            <p>${bucket.timing}</p>
          </article>
        `
      )
      .join('')}
    </div>
  `;
};

if (analyzerForm) {
  analyzerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(analyzerForm);
    const inputs = {
      sector: formData.get('sector') || 'other',
      marketCap: Number(formData.get('marketCap')) || 0,
      revenueCagr: Number(formData.get('revenueCagr')) || 0,
      epsCagr: Number(formData.get('epsCagr')) || 0,
      dividendYield: Number(formData.get('dividendYield')) || 0,
      payoutRatio: Number(formData.get('payoutRatio')) || 0,
      fcfYears: Number(formData.get('fcfYears')) || 0,
      pe: Number(formData.get('pe')) || 0,
      pb: Number(formData.get('pb')) || 0,
      debtToEquity: Number(formData.get('debtToEquity')) || 0,
      beta: Number(formData.get('beta')) || 0,
      priceVsHigh: Number(formData.get('priceVsHigh')) || 0
    };

    const result = analyzeStock(inputs);
    renderAnalysis(result);
  });
}
