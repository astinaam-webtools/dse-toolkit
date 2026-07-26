import {
  parseCategoryParam,
  buildStockHoldings,
  buildFundHoldings,
  filterHoldings,
  buildOverview,
  withWeights
} from '../src/lib/portfoliosOverview.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const marketData = {
  stocks: [{ symbol: 'GP', metrics: { ltp: 300 } }]
};

const stockState = {
  activePortfolioId: 's1',
  portfolios: [{
    id: 's1',
    name: 'Main Portfolio',
    items: [{
      symbol: 'GP',
      quantity: 100,
      average_cost: 250,
      commission_rate: 0,
      commission_included: true
    }, {
      symbol: 'GP',
      quantity: 50,
      average_cost: 280,
      commission_rate: 0,
      commission_included: true
    }]
  }]
};

const fundsData = {
  portfolios: [{
    id: 'f1',
    name: 'Retirement SIP — Haji Family Trust',
    funds: [{
      id: 'fund1',
      name: 'LR Global',
      symbol: 'LRGLOBMF1',
      amc: 'LR',
      current_nav: 20.4,
      transactions: [
        { id: 't1', type: 'BUY', units: 2400, nav: 19, total_cost: 45600, date: '2026-01-01' }
      ]
    }]
  }]
};

assert(parseCategoryParam(null) === 'all', 'default all');
assert(parseCategoryParam('FUNDS') === 'funds', 'normalize funds');
assert(parseCategoryParam('nope') === 'all', 'invalid → all');

const stockRows = buildStockHoldings(stockState, marketData);
assert(stockRows.length === 2, 'two stock rows (duplicate symbols)');
assert(stockRows[0].category === 'stock', 'stock category');
assert(stockRows[0].currentValue === 30000, '100 * 300');
assert(stockRows[0].portfolioName === 'Main Portfolio', 'portfolio name');
assert(stockRows[0].id === 'stock:s1:0', 'first duplicate id uses index 0');
assert(stockRows[1].id === 'stock:s1:1', 'second duplicate id uses index 1');
assert(stockRows[0].id !== stockRows[1].id, 'same-symbol rows keep distinct ids');
assert(stockRows[0]._stockIndex === 0 && stockRows[1]._stockIndex === 1, 'stock indexes preserved');
assert(stockRows[1].currentValue === 15000, '50 * 300');

const fundRows = buildFundHoldings(fundsData);
assert(fundRows.length === 1, 'one fund row');
assert(fundRows[0].category === 'fund', 'fund category');
assert(Math.round(fundRows[0].currentValue) === 48960, '2400 * 20.4');

const all = [...stockRows, ...fundRows];
assert(filterHoldings(all, 'stocks').every((r) => r.category === 'stock'), 'stocks filter');
assert(filterHoldings(all, 'funds').every((r) => r.category === 'fund'), 'funds filter');
assert(filterHoldings(all, 'all').length === 3, 'all filter');

const overviewAll = buildOverview({ stockState, fundsData, marketData, category: 'all' });
assert(overviewAll.showSplit === true, 'split on all');
assert(overviewAll.holdingCount === 3, 'count 3');
assert(
  overviewAll.totalValue ===
    stockRows[0].currentValue + stockRows[1].currentValue + fundRows[0].currentValue,
  'sum values'
);
assert(overviewAll.stocks.sharePct + overviewAll.funds.sharePct === 100 || overviewAll.totalValue === 0, 'shares sum 100');

const overviewStocks = buildOverview({ stockState, fundsData, marketData, category: 'stocks' });
assert(overviewStocks.showSplit === false, 'no split on stocks');
assert(overviewStocks.holdingCount === 2, 'stocks count');

const weighted = withWeights(all, overviewAll.totalValue);
assert(Math.abs(weighted.reduce((s, r) => s + r.weightPct, 0) - 100) < 0.2, 'weights ~100');

const emptyOverview = buildOverview({
  stockState: { activePortfolioId: null, portfolios: [] },
  fundsData: { portfolios: [] },
  marketData: { stocks: [] },
  category: 'all'
});
assert(emptyOverview.totalValue === 0 && emptyOverview.holdingCount === 0, 'empty ok');
assert(emptyOverview.stocks.sharePct === 0 && emptyOverview.funds.sharePct === 0, 'empty shares 0');

console.log('portfolios-overview-test: ok');
