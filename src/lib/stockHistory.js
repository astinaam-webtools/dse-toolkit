/**
 * Per-stock history helpers: OHLC synthesis + range filtering.
 * Session tuple: [date, open, high, low, close, volume]
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Coerce CSV-ish values; strips thousands commas; treats blank/- as null. */
export const toFinite = (value) => {
  if (value == null || value === '' || value === '-') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).trim().replace(/,/g, '');
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Positive price only — zero/negative treated as missing placeholders. */
const toPositivePrice = (value) => {
  const n = toFinite(value);
  return n != null && n > 0 ? n : null;
};

/** YYYY-MM-DD from a session tuple. */
export const sessionDate = (session) =>
  Array.isArray(session) && typeof session[0] === 'string' ? session[0] : null;

/**
 * Best-effort OHLC bar from CSV fields (no true O/H/L in source).
 * Returns null when no usable close/ltp price exists.
 * @param {number|null} prevClose
 * @param {unknown} ltp
 * @param {unknown} close
 * @param {unknown} volume
 */
export const synthesizeBar = (prevClose, ltp, close, volume) => {
  const closeNum = toPositivePrice(close);
  const ltpNum = toPositivePrice(ltp);
  const c = closeNum ?? ltpNum;
  if (c == null) return null;

  const open = prevClose != null && prevClose > 0 ? prevClose : c;
  const high = ltpNum != null ? Math.max(ltpNum, c) : c;
  const low = ltpNum != null ? Math.min(ltpNum, c) : c;
  const vol = toFinite(volume);
  return { open, high, low, close: c, volume: vol != null && vol >= 0 ? vol : 0 };
};

const parseIsoDate = (value) => {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateKey = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addUtcMonths = (date, months) => {
  const out = new Date(date.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const maxDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, maxDay));
  return out;
};

/**
 * Resolve inclusive from/to for a named preset.
 * @param {'1m'|'3m'|'6m'|'ytd'|'all'} preset
 * @param {string} endDate YYYY-MM-DD
 * @param {string} historyFrom YYYY-MM-DD
 */
export const resolvePresetRange = (preset, endDate, historyFrom) => {
  const end = parseIsoDate(endDate);
  const histFrom = parseIsoDate(historyFrom);
  if (!end) return { from: historyFrom || endDate, to: endDate };

  let fromDate;
  switch (preset) {
    case '1m':
      fromDate = addUtcMonths(end, -1);
      break;
    case '3m':
      fromDate = addUtcMonths(end, -3);
      break;
    case '6m':
      fromDate = addUtcMonths(end, -6);
      break;
    case 'ytd':
      fromDate = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
      break;
    case 'all':
    default:
      fromDate = histFrom || end;
      break;
  }

  let fromKey = toDateKey(fromDate);
  if (histFrom && fromKey < historyFrom) fromKey = historyFrom;
  return { from: fromKey, to: endDate };
};

/**
 * Filter sessions by preset or explicit from/to (inclusive).
 * @param {unknown[]} sessions
 * @param {{ preset?: string, from?: string, to?: string, endDate?: string, historyFrom?: string }} opts
 */
export const filterSessions = (sessions, opts = {}) => {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  let from = opts.from;
  let to = opts.to;

  if (opts.preset && opts.preset !== 'custom') {
    const endDate =
      opts.endDate ||
      sessionDate(sessions[sessions.length - 1]) ||
      '';
    const historyFrom = opts.historyFrom || sessionDate(sessions[0]) || endDate;
    const range = resolvePresetRange(opts.preset, endDate, historyFrom);
    from = range.from;
    to = range.to;
  }

  if (!from && !to) return sessions.slice();

  return sessions.filter((session) => {
    const d = sessionDate(session);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
};

/** Extract close prices from session tuples. */
export const closesFromSessions = (sessions) => {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((s) => {
    const close = Array.isArray(s) ? s[4] : null;
    return Number.isFinite(close) ? close : 0;
  });
};

/** Safe history filename stem: letters, digits, . _ - ( ) only. */
export const safeHistorySymbol = (symbol) => {
  if (typeof symbol !== 'string') return null;
  const trimmed = symbol.trim();
  if (!trimmed || trimmed.includes('..') || /[\\/]/.test(trimmed)) return null;
  if (!/^[A-Za-z0-9._()+\-&]+$/.test(trimmed)) return null;
  return trimmed;
};
