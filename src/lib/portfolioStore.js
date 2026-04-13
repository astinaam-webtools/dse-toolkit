import {
  createDefaultPortfolioState,
  hasMeaningfulLocalPortfolioData,
  readLocalPortfolioState,
  writeLocalPortfolioState
} from './portfolioLogic.js';
import { loadDocument, saveDocument, uploadDocument } from './documentGateway.js';

export const loadPortfolioState = () =>
  loadDocument('stocks', {
    readLocal: readLocalPortfolioState,
    createDefault: createDefaultPortfolioState
  });

export const savePortfolioStateDocument = (state) =>
  saveDocument('stocks', state, {
    writeLocal: writeLocalPortfolioState
  });

export const uploadPortfolioStateDocument = (state) => uploadDocument('stocks', state);

export const getLocalPortfolioState = () => readLocalPortfolioState();

export const hasLocalPortfolioState = () => hasMeaningfulLocalPortfolioData();
