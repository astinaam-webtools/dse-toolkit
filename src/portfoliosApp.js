/**
 * Unified Portfolios page controller (Task 5+).
 * DOM ids referenced by this page — keep in sync with portfolio.html.
 */
export const PF_DOM = {
  app: 'pf-app',
  seg: { all: 'pf-seg-all', stocks: 'pf-seg-stocks', funds: 'pf-seg-funds' },
  overview: 'pf-overview',
  holdingsCount: 'pf-holdings-count',
  holdingsList: 'pf-holdings-list',
  empty: 'pf-empty',
  manageBtn: 'pf-manage-btn',
  fab: 'pf-fab',
  exportImport: {
    exportStocks: 'pf-export-stocks',
    importStocks: 'pf-import-stocks',
    exportFunds: 'pf-export-funds',
    importFunds: 'pf-import-funds',
    importStocksFile: 'import-file',
    importFundsFile: 'file-import',
  },
  holdingSheet: {
    root: 'pf-holding-sheet',
    body: 'pf-holding-sheet-body',
    close: 'pf-holding-sheet-close',
    viewStock: 'pf-holding-view-stock',
    edit: 'pf-holding-edit',
    delete: 'pf-holding-delete',
  },
  typeSheet: {
    root: 'pf-type-sheet',
    close: 'pf-type-sheet-close',
    pickStock: 'pf-type-pick-stock',
    pickFund: 'pf-type-pick-fund',
  },
  manageSheet: {
    root: 'pf-manage-sheet',
    close: 'pf-manage-sheet-close',
    stocksSection: 'pf-manage-stocks-section',
    stocksList: 'pf-manage-stocks-list',
    createStock: 'pf-create-stock-portfolio',
    fundsSection: 'pf-manage-funds-section',
    fundsList: 'pf-manage-funds-list',
    createFund: 'pf-create-fund-portfolio',
  },
  stockModal: {
    root: 'stock-modal',
    title: 'modal-title',
    form: 'stock-form',
    close: 'close-modal',
    portfolioSelector: 'portfolio-selector',
  },
  fund: {
    modal: 'modal-fund',
    txModal: 'modal-tx',
    renameModal: 'modal-rename',
    portfolioModal: 'modal-portfolio',
    detailSheet: 'pf-fund-detail-sheet',
    addTx: 'pf-add-tx-btn',
  },
};
