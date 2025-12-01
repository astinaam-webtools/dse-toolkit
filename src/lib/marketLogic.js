/**
 * Market Logic Library
 * Defines the "Buckets" and filtering logic for the DSE Market Lens.
 */

export const BUCKET_DEFINITIONS = [
  {
    id: 'value',
    title: '💎 Value Picks',
    description: 'Undervalued stocks with solid fundamentals.',
    criteria: 'PE < 15, PB < 1.5, Dividend Yield > 3%',
    formula: 'PE = Price / EPS; PB = Price / NAV',
    filter: (s) => {
      const { pe, pb, dividendYield } = s.metrics;
      // PE < 15 (and positive), PB < 1.5, Yield > 3%
      return pe > 0 && pe < 15 && pb < 1.5 && dividendYield > 3;
    }
  },
  {
    id: 'momentum',
    title: '🚀 Momentum Plays',
    description: 'Stocks showing strong upward price action.',
    criteria: 'RSI (14) between 60-80, Weekly Price Change > 2%',
    formula: 'RSI = 100 - (100 / (1 + RS))',
    filter: (s) => {
      const { rsi, ltp, macd } = s.metrics;
      // RSI between 60-80 (strong but not extreme), MACD Bullish (simplified check if string)
      // Note: In real data, MACD might be a number. Adjusting for string "Bullish" or positive number.
      return rsi >= 60 && rsi <= 80 && s.deltas.price_1w > 2; 
    }
  },
  {
    id: 'safe',
    title: '🛡️ Safe Havens',
    description: 'Low volatility, large cap stocks.',
    criteria: 'Beta < 0.9, Market Cap > 5000mn',
    formula: 'Beta = Covariance(Stock, Market) / Variance(Market)',
    filter: (s) => {
      const { beta, mktCap } = s.metrics;
      // Beta < 0.9, Market Cap > 5000mn (Large Cap definition varies)
      return beta > 0 && beta < 0.9 && mktCap > 5000;
    }
  },
  {
    id: 'reversal',
    title: '🔄 Reversal Watch',
    description: 'Oversold stocks that might bounce.',
    criteria: 'RSI (14) < 30',
    formula: 'RSI < 30 indicates oversold conditions',
    filter: (s) => {
      const { rsi } = s.metrics;
      // RSI < 30 is classic oversold
      return rsi > 0 && rsi < 30;
    }
  },
  {
    id: 'volume',
    title: '📢 Volume Shockers',
    description: 'Unusual volume activity.',
    criteria: 'Daily Volume > 50% increase vs Yesterday',
    formula: '(Vol_Today - Vol_Yesterday) / Vol_Yesterday > 0.5',
    filter: (s) => {
      // Volume today > 50% higher than yesterday (simple proxy for shock)
      return s.deltas.vol_1d > 50;
    }
  }
];

export const filterStocks = (stocks, query) => {
  if (!query) return stocks;
  const q = query.toLowerCase();
  return stocks.filter(s => 
    s.symbol.toLowerCase().includes(q) || 
    (s.name && s.name.toLowerCase().includes(q)) ||
    (s.sector && s.sector.toLowerCase().includes(q))
  );
};

export const getStockBuckets = (stocks) => {
  return BUCKET_DEFINITIONS.map(bucket => ({
    ...bucket,
    matches: stocks.filter(bucket.filter)
  })).filter(b => b.matches.length > 0); // Only return buckets with matches
};

/**
 * Aggregate stocks by sector for heatmap visualization
 * @param {Array} stocks - Array of stock objects
 * @returns {Array} Array of sector objects with aggregated metrics
 */
export const getSectorHeatmap = (stocks) => {
  const sectors = {};
  
  // Group stocks by sector
  stocks.forEach(stock => {
    const sectorName = stock.sector || 'Other';
    
    if (!sectors[sectorName]) {
      sectors[sectorName] = {
        name: sectorName,
        stocks: [],
        totalMktCap: 0,
        totalVolume: 0,
        avgChange: 0,
        positiveCount: 0,
        negativeCount: 0
      };
    }
    
    sectors[sectorName].stocks.push(stock);
    sectors[sectorName].totalMktCap += stock.metrics.mktCap || 0;
    sectors[sectorName].totalVolume += stock.metrics.volume || 0;
    
    const change = stock.deltas.price_1d || 0;
    if (change > 0) sectors[sectorName].positiveCount++;
    if (change < 0) sectors[sectorName].negativeCount++;
  });
  
  // Calculate average change for each sector
  Object.values(sectors).forEach(sector => {
    const changes = sector.stocks.map(s => s.deltas.price_1d || 0);
    sector.avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    sector.stockCount = sector.stocks.length;
  });
  
  // Convert to array and sort by market cap (descending)
  return Object.values(sectors).sort((a, b) => b.totalMktCap - a.totalMktCap);
};
