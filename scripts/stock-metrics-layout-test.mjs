import {
  isPresentMetric,
  sparklineRange,
  formatMetricValue,
  buildTradingStrip,
  buildMetricGroups
} from '../src/lib/stockMetricsLayout.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const rich = {
  ltp: 258.2,
  close: 258.2,
  pe: 11.83,
  value: 26.13,
  mktCap: 348647.47,
  nav: 41.51,
  eps: 10.52,
  dividendYield: 4.07,
  pb: 6.22,
  currentRatio: 0.16,
  quickRatio: 0.13,
  debtToEquity: 0.16,
  ebitdaMargin: 0.31,
  operatingMargin: 0.36,
  netMargin: 0.19,
  grossMargin: 1,
  roa: 0.16,
  roe: 0.53,
  auditedPe: 11.83,
  forwardPe: 12.31,
  paidUpCapital: 13503000220,
  totalShares: 1350300022
};

const sparse = {
  ltp: 950,
  close: 950,
  volume: 1200,
  value: 1.14,
  mktCap: 950,
  nav: 0,
  eps: 0,
  dividendYield: 8.5,
  paidUpCapital: 100000000,
  totalShares: 100000
};

const run = () => {
  assert(isPresentMetric(0) === true, '0 is present');
  assert(isPresentMetric(null) === false, 'null absent');
  assert(isPresentMetric(undefined) === false, 'undefined absent');
  assert(isPresentMetric('') === false, 'empty string absent');
  assert(isPresentMetric(Number.NaN) === false, 'NaN absent');

  assert(sparklineRange(null) === null, 'null sparkline');
  assert(sparklineRange([1]) === null, 'single point');
  const range = sparklineRange([237.7, 240, 258.2]);
  assert(range && range.low === 237.7, 'low');
  assert(range.high === 258.2, 'high');
  assert(range.sessions === 3, 'sessions');
  assert(range.span === 20.5, 'span');

  assert(formatMetricValue('pe', null) === null, 'format null');
  assert(typeof formatMetricValue('mktCap', 348647.47) === 'string', 'format mktCap');

  const strip = buildTradingStrip(rich);
  assert(strip.map((c) => c.key).join(',') === 'value,mktCap,close', 'rich strip order, no volume');
  const stripSparse = buildTradingStrip(sparse);
  assert(stripSparse.map((c) => c.key).join(',') === 'value,mktCap,close,volume', 'sparse strip includes volume');
  assert(buildTradingStrip({}).length === 0, 'empty strip');
  assert(buildTradingStrip(null).length === 0, 'null metrics strip');

  const groups = buildMetricGroups(rich);
  assert(groups.every((g) => g.rows.length > 0), 'no empty groups');
  const ids = groups.map((g) => g.id);
  assert(ids.includes('trading') && ids.includes('valuation') && ids.includes('profitability'), 'core groups');
  assert(ids.includes('balance') && ids.includes('capital'), 'balance+capital');
  assert(!ids.includes('other'), 'no other for known keys');

  const trading = groups.find((g) => g.id === 'trading');
  assert(trading.rows.some((r) => r.key === 'ltp'), 'ltp in trading');
  assert(trading.rows.filter((r) => r.key === 'value')[0].elevated === true, 'value elevated');

  const allKeys = groups.flatMap((g) => g.rows.map((r) => r.key)).sort();
  assert(allKeys.join(',') === Object.keys(rich).sort().join(','), 'all rich keys present exactly once');

  const sparseGroups = buildMetricGroups(sparse);
  assert(!sparseGroups.some((g) => g.id === 'profitability'), 'no empty profitability');
  assert(!sparseGroups.some((g) => g.id === 'balance'), 'no empty balance');

  const withUnknown = buildMetricGroups({ ltp: 1, weirdBeta: 0.9 });
  const other = withUnknown.find((g) => g.id === 'other');
  assert(other && other.rows[0].key === 'weirdBeta', 'unknown → Other');

  const multiUnknown = buildMetricGroups({ ltp: 1, zeta: 1, alpha: 2 });
  const otherKeys = multiUnknown.find((g) => g.id === 'other').rows.map((r) => r.key);
  assert(otherKeys.join(',') === 'alpha,zeta', 'other alphabetical');

  console.log('stock-metrics-layout-test: ok');
};

run();
