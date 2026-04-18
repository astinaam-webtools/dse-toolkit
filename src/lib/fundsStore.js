import {
  createEmptyFundsData,
  hasMeaningfulLocalFundsData,
  readLocalFundsData,
  writeLocalFundsData
} from './fundsLogic.js';
import { loadDocument, saveDocument, uploadDocument, registerLocalReader } from './documentGateway.js';

registerLocalReader('funds', readLocalFundsData);

export const loadFundsDataDocument = () =>
  loadDocument('funds', {
    readLocal: readLocalFundsData,
    createDefault: createEmptyFundsData
  });

export const saveFundsDataDocument = (data) =>
  saveDocument('funds', data, {
    writeLocal: writeLocalFundsData
  });

export const uploadFundsDataDocument = (data) => uploadDocument('funds', data);

export const getLocalFundsData = () => readLocalFundsData();

export const hasLocalFundsState = () => hasMeaningfulLocalFundsData();
