import { getDb } from './db.js';

const DOCUMENT_TYPES = new Set(['stocks', 'funds']);

function generatePortfolioId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isSupportedDocumentType(type) {
  return DOCUMENT_TYPES.has(type);
}

export function getDefaultDocument(type) {
  if (type === 'stocks') {
    const id = generatePortfolioId();
    return {
      activePortfolioId: id,
      portfolios: [{ id, name: 'Main Portfolio', items: [] }]
    };
  }

  return {
    version: 1,
    activePortfolioId: null,
    portfolios: []
  };
}

export function validateDocumentShape(type, document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return 'Document must be an object.';
  }

  if (!Array.isArray(document.portfolios)) {
    return 'Document must include a portfolios array.';
  }

  if (type === 'stocks') {
    if (typeof document.activePortfolioId !== 'string' || document.activePortfolioId.trim() === '') {
      return 'Stocks document must include a non-empty activePortfolioId.';
    }
    return null;
  }

  if (typeof document.version !== 'number') {
    return 'Funds document must include a numeric version.';
  }

  if (
    document.activePortfolioId !== null &&
    (typeof document.activePortfolioId !== 'string' || document.activePortfolioId.trim() === '')
  ) {
    return 'Funds document activePortfolioId must be null or a non-empty string.';
  }

  return null;
}

export async function getPortfolioDocument(userId, type) {
  const db = await getDb();
  const row = await db.get(
    `
      SELECT document_json, updated_at
      FROM portfolio_documents
      WHERE user_id = ? AND document_type = ?
    `,
    userId,
    type
  );

  if (!row) {
    return {
      document: getDefaultDocument(type),
      updatedAt: null
    };
  }

  return {
    document: JSON.parse(row.document_json),
    updatedAt: row.updated_at
  };
}

export async function savePortfolioDocument(userId, type, document) {
  const db = await getDb();
  const now = new Date().toISOString();
  const payload = JSON.stringify(document);

  await db.run(
    `
      INSERT INTO portfolio_documents (user_id, document_type, document_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, document_type)
      DO UPDATE SET
        document_json = excluded.document_json,
        updated_at = excluded.updated_at
    `,
    userId,
    type,
    payload,
    now,
    now
  );

  return {
    document,
    updatedAt: now
  };
}
