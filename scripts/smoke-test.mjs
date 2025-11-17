import { filterTerms, tokenize, highlightText } from '../src/lib/filterTerms.js';
import { terms } from '../src/data/terms.js';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = () => {
  const sampleQuery = 'P/E valuation';
  const filtered = filterTerms(terms, sampleQuery);
  assert(filtered.length >= 1, 'Expected at least one P/E term');

  const tokens = tokenize('dividend yield');
  const dy = terms.find((term) => term.shortForm === 'DY');
  assert(dy, 'Dividend Yield term missing');
  const highlighted = highlightText(dy.description, tokens);
  assert(highlighted.includes('<mark'), 'Highlight should wrap matching text');

  const multiToken = filterTerms(terms, 'beta risk');
  assert(multiToken.some((t) => t.shortForm === 'β'), 'Multi-token search should find Beta');

  console.log('Smoke tests passed:', {
    filtered: filtered.length,
    betaMatches: multiToken.length,
  });
};

try {
  run();
} catch (error) {
  console.error('Smoke test failed:', error.message);
  process.exit(1);
}
