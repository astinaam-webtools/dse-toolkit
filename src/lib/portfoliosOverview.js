import { calculateItemMetrics, listPortfolios as listStockPortfolios } from './portfolioLogic.js';
import { calculateFundStats, calculateAggregateStats } from './fundsLogic.js';

export function parseCategoryParam(value) {
  const v = String(value || 'all').toLowerCase();
  if (v === 'stocks' || v === 'stock') return 'stocks';
  if (v === 'funds' || v === 'fund') return 'funds';
  return 'all';
}

export function buildStockHoldings(stockState, marketData) {
  const stocks = marketData?.stocks || [];
  const rows = [];
  for (const portfolio of listStockPortfolios(stockState)) {
    const items = portfolio.items || [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const quote = stocks.find((s) => s.symbol === item.symbol);
      const ltp = (quote?.metrics?.ltp ?? Number(item.average_cost)) || 0;
      const metrics = calculateItemMetrics(item, ltp);
      rows.push({
        id: `stock:${portfolio.id}:${index}`,
        category: 'stock',
        symbol: item.symbol,
        label: item.symbol,
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        quantity: Number(item.quantity) || 0,
        quantityLabel: `${Number(item.quantity) || 0} sh`,
        currentValue: metrics.currentValue,
        totalCost: metrics.totalCost,
        pl: metrics.profitLoss,
        plPct: metrics.profitLossPercentage,
        weightPct: 0,
        _stockIndex: index
      });
    }
  }
  return rows;
}

export function buildFundHoldings(fundsData) {
  const rows = [];
  for (const portfolio of fundsData?.portfolios || []) {
    for (const fund of portfolio.funds || []) {
      const stats = calculateFundStats(fund);
      rows.push({
        id: `fund:${portfolio.id}:${fund.id}`,
        category: 'fund',
        symbol: fund.symbol || fund.name,
        label: fund.name || fund.symbol,
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        quantity: stats.totalUnits,
        quantityLabel: `${stats.totalUnits} u`,
        currentValue: stats.currentValue,
        totalCost: stats.totalCost,
        pl: stats.gainLoss,
        plPct: stats.gainLossPercent,
        weightPct: 0,
        fundId: fund.id
      });
    }
  }
  return rows;
}

export function filterHoldings(rows, category) {
  if (category === 'stocks') return rows.filter((r) => r.category === 'stock');
  if (category === 'funds') return rows.filter((r) => r.category === 'fund');
  return rows.slice();
}

function categoryBlock({ value, invested, pl, plPct, sharePct, dividendReinvest = 0 }) {
  return { value, invested, pl, plPct, sharePct, dividendReinvest };
}

export function buildOverview({ stockState, fundsData, marketData, category }) {
  const stockRows = buildStockHoldings(stockState, marketData);
  const fundRows = buildFundHoldings(fundsData);
  const stocksValue = stockRows.reduce((s, r) => s + r.currentValue, 0);
  const stocksInvested = stockRows.reduce((s, r) => s + r.totalCost, 0);
  const stocksPl = stocksValue - stocksInvested;
  const stocksPlPct = stocksInvested > 0 ? (stocksPl / stocksInvested) * 100 : 0;

  const fundAgg = calculateAggregateStats(fundsData?.portfolios || []);
  const fundsValue = fundAgg.currentValue;
  const fundsInvested = fundAgg.totalInvested;
  const fundsPl = fundAgg.gainLoss;
  const fundsPlPct = fundAgg.gainLossPercent;

  const combinedValue = stocksValue + fundsValue;
  const stockShare = combinedValue > 0 ? (stocksValue / combinedValue) * 100 : 0;
  const fundShare = combinedValue > 0 ? (fundsValue / combinedValue) * 100 : 0;

  const stocks = categoryBlock({
    value: stocksValue,
    invested: stocksInvested,
    pl: stocksPl,
    plPct: stocksPlPct,
    sharePct: stockShare
  });
  const funds = categoryBlock({
    value: fundsValue,
    invested: fundsInvested,
    pl: fundsPl,
    plPct: fundsPlPct,
    sharePct: fundShare,
    dividendReinvest: fundAgg.totalDividendReinvest
  });

  const visible = filterHoldings([...stockRows, ...fundRows], category);
  const totalValue = visible.reduce((s, r) => s + r.currentValue, 0);
  const totalInvested = visible.reduce((s, r) => s + r.totalCost, 0);
  const totalPl = totalValue - totalInvested;
  const totalPlPct = totalInvested > 0 ? (totalPl / totalInvested) * 100 : 0;

  return {
    category,
    totalValue,
    totalInvested,
    totalPl,
    totalPlPct,
    holdingCount: visible.length,
    stocks,
    funds,
    showSplit: category === 'all'
  };
}

export function withWeights(rows, totalValue) {
  if (!totalValue || totalValue <= 0) {
    return rows.map((r) => ({ ...r, weightPct: 0 }));
  }
  return rows.map((r) => ({
    ...r,
    weightPct: (r.currentValue / totalValue) * 100
  }));
}
