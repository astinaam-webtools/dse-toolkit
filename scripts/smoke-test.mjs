import { filterTerms, tokenize, highlightText } from '../src/lib/filterTerms.js';
import { analyzeStock } from '../src/lib/behaviorProfiler.js';
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

  const growthAnalysis = analyzeStock({
    sector: 'technology',
    marketCap: 6000,
    revenueCagr: 18,
    epsCagr: 20,
    dividendYield: 1,
    payoutRatio: 20,
    fcfYears: 4,
    pe: 25,
    pb: 3,
    debtToEquity: 0.4,
    beta: 1.1,
    priceVsHigh: 12
  });
  assert(growthAnalysis.matches.some((bucket) => bucket.id === 'growth'), 'Growth bucket expected');

  const incomeAnalysis = analyzeStock({
    sector: 'utilities',
    marketCap: 8000,
    revenueCagr: 6,
    epsCagr: 7,
    dividendYield: 5,
    payoutRatio: 60,
    fcfYears: 4,
    pe: 10,
    pb: 1.2,
    debtToEquity: 0.6,
    beta: 0.75,
    priceVsHigh: 8
  });
  assert(incomeAnalysis.matches.some((bucket) => bucket.id === 'income'), 'Income bucket expected');

  console.log('Smoke tests passed:', {
    filtered: filtered.length,
    betaMatches: multiToken.length,
    analyzerBuckets: growthAnalysis.matches.length + incomeAnalysis.matches.length
  });
};

try {
  run();
} catch (error) {
  console.error('Smoke test failed:', error.message);
  process.exit(1);
}
