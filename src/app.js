import { terms } from './data/terms.js';
import { filterTerms, highlightText, tokenize } from './lib/filterTerms.js';

const termContainer = document.getElementById('terms');
const searchInput = document.getElementById('search');
const stats = document.getElementById('stats');

const renderCards = (dataset, tokens = []) => {
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

// initial render
renderCards(terms, []);

// debounce input for better UX on mobile
searchInput.addEventListener('input', debounce(handleInput, 180));

// keyboard: Esc clears the search
searchInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    searchInput.value = '';
    renderCards(terms, []);
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((error) => console.error('Service worker registration failed', error));
  });
}
