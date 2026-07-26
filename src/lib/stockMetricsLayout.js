const STRIP_KEYS = ['value', 'mktCap', 'close', 'volume'];

const GROUPS = [
  { id: 'trading', title: 'Trading', keys: ['ltp', 'close', 'value', 'volume', 'mktCap'] },
  { id: 'valuation', title: 'Valuation', keys: ['pe', 'auditedPe', 'forwardPe', 'pb', 'nav', 'eps', 'dividendYield'] },
  { id: 'profitability', title: 'Profitability', keys: ['ebitdaMargin', 'operatingMargin', 'netMargin', 'grossMargin', 'roa', 'roe', 'roea', 'roi'] },
  { id: 'balance', title: 'Balance sheet', keys: ['currentRatio', 'quickRatio', 'debtToEquity'] },
  { id: 'capital', title: 'Capital', keys: ['paidUpCapital', 'totalShares'] }
];

const LABELS = {
  ltp: 'LTP',
  close: 'Close',
  value: 'Value',
  volume: 'Volume',
  mktCap: 'Mkt Cap',
  pe: 'PE',
  auditedPe: 'Audited PE',
  forwardPe: 'Forward PE',
  pb: 'PB',
  nav: 'NAV',
  eps: 'EPS',
  dividendYield: 'Div Yield',
  ebitdaMargin: 'EBITDA Margin',
  operatingMargin: 'Operating Margin',
  netMargin: 'Net Margin',
  grossMargin: 'Gross Margin',
  roa: 'ROA',
  roe: 'ROE',
  roea: 'ROEA',
  roi: 'ROI',
  currentRatio: 'Current Ratio',
  quickRatio: 'Quick Ratio',
  debtToEquity: 'Debt / Equity',
  paidUpCapital: 'Paid-up Capital',
  totalShares: 'Total Shares'
};

const KNOWN = new Set(GROUPS.flatMap((g) => g.keys));

export const isPresentMetric = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number' && !Number.isFinite(value)) return false;
  return true;
};

export const sparklineRange = (sparkline) => {
  if (!Array.isArray(sparkline) || sparkline.length < 2) return null;
  const nums = sparkline.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (nums.length < 2) return null;
  const low = Math.min(...nums);
  const high = Math.max(...nums);
  return {
    low,
    high,
    sessions: sparkline.length,
    span: high - low
  };
};

/** Parse YYYY-MM-DD as UTC midnight. */
const parseIsoDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Floored whole calendar months between two UTC dates (0 if under one month). */
const flooredMonthsBetween = (start, end) => {
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
};

const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * Relative chart window label.
 * - &lt; 1 month → days
 * - &lt; 1 year → floored months +
 * - ≥ 1 year → floored years + months +
 */
export const formatSparklinePeriod = (from, to) => {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end || end < start) return null;

  const months = flooredMonthsBetween(start, end);

  if (months < 1) {
    const days = Math.max(1, Math.round((end - start) / 86400000));
    return plural(days, 'day');
  }

  if (months < 12) {
    return `${plural(months, 'month')}+`;
  }

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (remMonths === 0) return `${plural(years, 'year')}+`;
  return `${plural(years, 'year')} ${plural(remMonths, 'month')}+`;
};

/** Absolute range with year for tooltips, e.g. "4 May 2026 – 26 Jul 2026". */
export const formatSparklinePeriodDetail = (from, to) => {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return null;

  const fmt = (date) =>
    date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });

  return `${fmt(start)} – ${fmt(end)}`;
};

export const metricLabel = (key) => {
  if (LABELS[key]) return LABELS[key];
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
};

export const formatMetricValue = (key, value) => {
  if (!isPresentMetric(value)) return null;
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
};

export const buildTradingStrip = (metrics) => {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  return STRIP_KEYS
    .map((key) => {
      const display = formatMetricValue(key, m[key]);
      if (display == null) return null;
      return { key, label: metricLabel(key), display };
    })
    .filter(Boolean);
};

export const buildMetricGroups = (metrics) => {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const groups = [];

  for (const g of GROUPS) {
    const rows = [];
    for (const key of g.keys) {
      const display = formatMetricValue(key, m[key]);
      if (display == null) continue;
      rows.push({
        key,
        label: metricLabel(key),
        display,
        elevated: STRIP_KEYS.includes(key)
      });
    }
    if (rows.length) groups.push({ id: g.id, title: g.title, rows });
  }

  const unknownKeys = Object.keys(m)
    .filter((key) => !KNOWN.has(key) && isPresentMetric(m[key]))
    .sort((a, b) => a.localeCompare(b));

  if (unknownKeys.length) {
    groups.push({
      id: 'other',
      title: 'Other',
      rows: unknownKeys.map((key) => ({
        key,
        label: metricLabel(key),
        display: formatMetricValue(key, m[key]),
        elevated: STRIP_KEYS.includes(key)
      }))
    });
  }

  return groups;
};
