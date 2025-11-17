export const normalize = (text = '') => text.toLowerCase().trim();

const escapeRegExp = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeHtml = (unsafe = '') =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const filterTerms = (dataset, query) => {
  if (!query) return dataset;
  const tokens = normalize(query)
    .split(/\s+/)
    .filter(Boolean);

  return dataset.filter((term) => {
    const haystack = normalize([
      term.title,
      term.shortForm,
      term.category,
      term.description,
      term.whyItMatters,
      term.watchFor,
      ...(term.tags || [])
    ].join(' '));

    return tokens.every((token) => haystack.includes(token));
  });
};

/**
 * Highlight matched tokens inside a text string and return HTML-safe string
 * with <mark class="hl">...</mark> around matches.
 * @param {string} text
 * @param {string[]} tokens
 * @returns {string}
 */
export const highlightText = (text = '', tokens = []) => {
  if (!tokens || !tokens.length) return escapeHtml(text);

  const pattern = tokens.map((t) => escapeRegExp(t)).join('|');
  try {
    const re = new RegExp(pattern, 'gi');
    // escape the original text first, then run replace on the escaped version
    const escaped = escapeHtml(text);
    return escaped.replace(re, (m) => `<mark class="hl">${m}</mark>`);
  } catch (err) {
    // fallback: return escaped text on error
    return escapeHtml(text);
  }
};

/**
 * Tokenize a query string to be reused by caller.
 */
export const tokenize = (query = '') =>
  normalize(query)
    .split(/\s+/)
    .filter(Boolean);

