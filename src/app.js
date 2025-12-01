import { terms } from './data/terms.js';
import { filterTerms, highlightText, tokenize } from './lib/filterTerms.js';
import { analyzeStock } from './lib/behaviorProfiler.js';

const termContainer = document.getElementById('terms');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');
const analyzerForm = document.getElementById('behavior-form');
const analysisOutput = document.getElementById('analysis-output');

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

const debounce = (fn, wait = 200) => {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

const handleInput = (event) => {
  const query = event.target.value;
  const tokens = tokenize(query);
  const filtered = filterTerms(terms, query);
  renderCards(filtered, tokens);
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
      backBtn.className = 'btn btn--solid';
      backBtn.href = `stock.html?symbol=${symbolParam}`;
      backBtn.textContent = `← Back to ${symbolParam}`;
      backBtn.style.backgroundColor = '#333'; // Distinct color
      backBtn.style.borderColor = '#333';
      
      // Insert as first child
      heroActions.insertBefore(backBtn, heroActions.firstChild);
    }
  }

  if (queryParam) {
    // Set the search input value to the query parameter
    searchInput.value = queryParam;
    // Trigger the search
    const tokens = tokenize(queryParam);
    const filtered = filterTerms(terms, queryParam);
    renderCards(filtered, tokens);
  } else {
    // Normal initialization
    renderCards(terms, []);
  }

  // debounce input for better UX on mobile
  searchInput.addEventListener('input', debounce(handleInput, 180));

  // keyboard: Esc clears the search
  searchInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      searchInput.value = '';
      renderCards(terms, []);
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((error) => console.error('Service worker registration failed', error));
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
