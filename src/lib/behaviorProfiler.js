const defensiveSectors = new Set(['consumer-staples', 'healthcare', 'utilities', 'telecom']);
const cyclicalSectors = new Set(['industrials', 'materials', 'consumer-discretionary', 'energy']);

const fmtPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const bucketLibrary = {
  growth: {
    id: 'growth',
    title: 'Growth tilt',
    summary: 'High revenue/EPS momentum justifies paying up when execution stays consistent.',
    triggers: (inputs) => [
      `Revenue CAGR ${fmtPercent(inputs.revenueCagr)} and EPS CAGR ${fmtPercent(inputs.epsCagr)} beat the 12% long-term bar.`,
      inputs.pe ? `P/E ${inputs.pe.toFixed(1)} implies the market already prices in expansion.` : 'Monitor valuation versus peers.'
    ],
    timing: 'Add on pullbacks toward 50-day moving average or when price is ≤15% below 52-week high if execution looks intact.'
  },
  value: {
    id: 'value',
    title: 'Value / re-rating setup',
    summary: 'Discounted multiples signal mispricing if cash flows stay healthy.',
    triggers: (inputs) => [
      inputs.pe ? `P/E at ${inputs.pe.toFixed(1)} sits below the common 12× value screen.` : 'Check the latest P/E versus sector median.',
      inputs.pb ? `P/B ${inputs.pb.toFixed(2)} suggests assets are priced conservatively.` : 'Review price-to-book vs. peers.'
    ],
    timing: 'Stage buys when price is still below intrinsic estimates and FCF remains positive in ≥3 of past 5 years.'
  },
  income: {
    id: 'income',
    title: 'Income / dividend comfort',
    summary: 'Cash distribution potential is supported by yield, payout ratio, and free cash flow streak.',
    triggers: (inputs) => [
      `Dividend yield at ${fmtPercent(inputs.dividendYield)} provides inflation protection.`,
      `Payout ratio ${fmtPercent(inputs.payoutRatio)} keeps room for reinvestment.`,
      `Free cash flow positive in ${inputs.fcfYears}/5 years.`
    ],
    timing: 'Prefer entries near VWAP when yield stays within the sustainable 3–6% band and dividend dates approach.'
  },
  defensive: {
    id: 'defensive',
    title: 'Defensive / stability bias',
    summary: 'Low beta sectors with manageable leverage cushion downturns.',
    triggers: (inputs) => [
      inputs.beta ? `Beta at ${inputs.beta.toFixed(2)} indicates milder swings than DSEX.` : 'Check beta on the chart stats panel.',
      inputs.debtToEquity ? `Debt-to-equity ${inputs.debtToEquity.toFixed(2)} keeps financing risk contained.` : 'Watch leverage trends in the balance sheet.'
    ],
    timing: 'Layer in during macro stress when staples/healthcare names hold their 200-day moving average.'
  },
  cyclical: {
    id: 'cyclical',
    title: 'Cyclical / beta-sensitive',
    summary: 'Earnings and price action swing harder with GDP, so timing matters.',
    triggers: (inputs) => [
      inputs.beta ? `Beta ${inputs.beta.toFixed(2)} exceeds 1.15, amplifying cycles.` : 'Gauge volatility relative to DSEX.',
      `Sector ${inputs.sectorLabel || 'N/A'} typically tracks the economic cycle.`
    ],
    timing: 'Accumulate near troughs when RSI < 40 and macro data hints at a rebound; trim when price stretches far above VWAP.'
  },
  bluechip: {
    id: 'bluechip',
    title: 'Blue-chip core',
    summary: 'Large-cap names with consistent cash flows suit long-term compounding.',
    triggers: (inputs) => [
      `Market cap ≈ Tk ${inputs.marketCap?.toLocaleString('en-US')} crore places it in the upper tier.`,
      `${inputs.fcfYears}/5 positive FCF years and beta ${inputs.beta?.toFixed(2) || '—'} keep drawdowns steady.`
    ],
    timing: 'Average in monthly or via SIP-style buying regardless of noise, especially after 5–10% dips below 52-week highs.'
  }
};

const sectorLabels = {
  'consumer-staples': 'Consumer Staples',
  healthcare: 'Healthcare',
  utilities: 'Utilities',
  telecom: 'Telecom',
  financials: 'Financials',
  industrials: 'Industrials',
  materials: 'Materials',
  'consumer-discretionary': 'Consumer Discretionary',
  energy: 'Energy',
  technology: 'Technology',
  others: 'Others'
};

export const analyzeStock = (inputs = {}) => {
  const data = {
    ...inputs,
    sector: inputs.sector || 'others',
    sectorLabel: sectorLabels[inputs.sector] || 'Others'
  };
  const hasBeta = data.beta > 0;
  const hasDebt = data.debtToEquity > 0;
  const hasPe = data.pe > 0;
  const hasPb = data.pb > 0;

  const evaluations = [
    { id: 'growth', active: data.revenueCagr >= 12 || data.epsCagr >= 15, score: data.revenueCagr + data.epsCagr },
    { id: 'value', active: (hasPe && data.pe <= 12) || (hasPb && data.pb <= 1.1), score: 40 - (data.pe || 0) - (data.pb || 0) * 10 },
    {
      id: 'income',
      active: data.dividendYield >= 4 && data.payoutRatio >= 30 && data.payoutRatio <= 80 && data.fcfYears >= 3,
      score: data.dividendYield + data.fcfYears * 2
    },
    {
      id: 'defensive',
      active: defensiveSectors.has(data.sector) || (hasBeta && data.beta <= 0.9) || (hasDebt && data.debtToEquity <= 0.8),
      score: 20 - (data.beta || 1)
    },
    {
      id: 'cyclical',
      active: cyclicalSectors.has(data.sector) || (hasBeta && data.beta >= 1.15),
      score: (data.beta || 1) * 10
    },
    {
      id: 'bluechip',
      active: data.marketCap >= 5000 && data.fcfYears >= 3 && (!hasBeta || data.beta <= 1.1),
      score: data.marketCap / 1000 + data.fcfYears
    }
  ];

  const matches = evaluations
    .filter((item) => item.active)
    .sort((a, b) => b.score - a.score)
    .map((item) => {
      const base = bucketLibrary[item.id];
      return {
        id: base.id,
        title: base.title,
        summary: base.summary,
        triggers: base.triggers(data),
        timing: base.timing
      };
    });

  const primary = matches[0] || {
    title: 'Need more data',
    summary: 'Provide revenue/EPS growth, dividend yield, beta, and valuation multiples to calculate behaviour buckets.',
    triggers: [],
    timing: ''
  };

  return { matches, primary };
};

export default analyzeStock;
