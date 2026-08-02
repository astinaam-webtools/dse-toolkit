import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  synthesizeBar,
  resolvePresetRange,
  filterSessions,
  closesFromSessions,
  sessionDate,
  toFinite,
  safeHistorySymbol
} from '../src/lib/stockHistory.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const root = path.dirname(fileURLToPath(import.meta.url));
const marketPath = path.join(root, '../src/data/dse-market.json');
const histPath = path.join(root, '../src/data/history/GP.json');

const sessions = [
  ['2025-11-01', 10, 11, 9, 10.5, 100],
  ['2025-12-15', 10.5, 12, 10, 11, 200],
  ['2026-01-10', 11, 12, 10.5, 11.5, 150],
  ['2026-05-01', 11.5, 13, 11, 12, 180],
  ['2026-06-28', 12, 13, 11.5, 12.5, 220],
  ['2026-07-26', 12.5, 14, 12, 13, 300]
];

const run = () => {
  const first = synthesizeBar(null, 101, 100, 50);
  assert(first.open === 100, 'first open equals close');
  assert(first.high === 101, 'high is max(ltp, close)');
  assert(first.low === 100, 'low is min(ltp, close)');
  assert(first.close === 100, 'close prefers Close');
  assert(first.volume === 50, 'volume');

  const next = synthesizeBar(100, 98, 99, 10);
  assert(next.open === 100, 'open is prior close');
  assert(next.high === 99, 'high when ltp < close');
  assert(next.low === 98, 'low when ltp < close');

  const ltpOnly = synthesizeBar(50, 55, null, null);
  assert(ltpOnly.close === 55, 'close falls back to LTP');
  assert(ltpOnly.volume === 0, 'missing volume → 0');

  const ignoreZeroLtp = synthesizeBar(100, 0, 105, 12);
  assert(ignoreZeroLtp.low === 105 && ignoreZeroLtp.high === 105, 'LTP 0 ignored for high/low');
  assert(synthesizeBar(null, 0, 0, 1) === null, 'no usable price → null');
  assert(synthesizeBar(10, 11, 12, '101,277').volume === 101277, 'comma volume');
  assert(toFinite('101,277') === 101277, 'toFinite strips commas');
  assert(safeHistorySymbol('GP') === 'GP', 'safe symbol');
  assert(safeHistorySymbol('../etc') === null, 'reject traversal');
  assert(safeHistorySymbol('AMCL(PRAN)') === 'AMCL(PRAN)', 'parens ok');
  assert(safeHistorySymbol('KAY&QUE') === 'KAY&QUE', 'ampersand ok');

  assert(resolvePresetRange('all', '2026-07-26', '2025-11-01').from === '2025-11-01', 'all from history start');
  assert(resolvePresetRange('all', '2026-07-26', '2025-11-01').to === '2026-07-26', 'all to end');

  const m1 = resolvePresetRange('1m', '2026-07-26', '2025-11-01');
  assert(m1.from === '2026-06-26', `1m from got ${m1.from}`);
  assert(m1.to === '2026-07-26', '1m to');

  const m3 = resolvePresetRange('3m', '2026-07-26', '2025-11-01');
  assert(m3.from === '2026-04-26', `3m from got ${m3.from}`);

  const m6 = resolvePresetRange('6m', '2026-07-26', '2025-11-01');
  assert(m6.from === '2026-01-26', `6m from got ${m6.from}`);

  const ytd = resolvePresetRange('ytd', '2026-07-26', '2025-11-01');
  assert(ytd.from === '2026-01-01', 'ytd from Jan 1');
  assert(ytd.to === '2026-07-26', 'ytd to');

  assert(resolvePresetRange('1m', '2026-07-26', '2026-07-01').from === '2026-07-01', 'clamp from to historyFrom');

  const all = filterSessions(sessions, { preset: 'all' });
  assert(all.length === 6, 'all sessions');

  const custom = filterSessions(sessions, { from: '2026-01-01', to: '2026-06-30' });
  assert(custom.length === 3, `custom window got ${custom.length}`);
  assert(sessionDate(custom[0]) === '2026-01-10', 'custom first');
  assert(sessionDate(custom.at(-1)) === '2026-06-28', 'custom last');

  const oneM = filterSessions(sessions, { preset: '1m', endDate: '2026-07-26', historyFrom: '2025-11-01' });
  assert(oneM.length === 2, `1m sessions got ${oneM.length}`);
  assert(sessionDate(oneM[0]) === '2026-06-28', '1m first');

  assert(filterSessions([], { preset: 'all' }).length === 0, 'empty');
  assert(filterSessions(sessions, { from: '2027-01-01', to: '2027-02-01' }).length === 0, 'empty window');

  const closes = closesFromSessions(sessions);
  assert(closes.length === 6, 'closes length');
  assert(closes[0] === 10.5 && closes.at(-1) === 13, 'closes values');
  assert(closesFromSessions(null).length === 0, 'null sessions');

  if (existsSync(marketPath) && existsSync(histPath)) {
    const market = JSON.parse(readFileSync(marketPath, 'utf8'));
    const gp = market.stocks.find((s) => s.symbol === 'GP');
    assert(gp && Array.isArray(gp.sparkline) && gp.sparkline.length <= 30, 'sparkline capped at 30');
    const history = JSON.parse(readFileSync(histPath, 'utf8'));
    assert(history.sessions?.[0]?.length === 6, 'history tuple length');
    const opensOk = history.sessions.slice(1).every((s, i) => s[1] === history.sessions[i][4]);
    assert(opensOk, 'open equals prior close');
    assert(history.sessions.length > 30, 'full history longer than sparkline window');
    assert(history.sessions.at(-1)[5] > 0, 'GP latest volume parsed');
  }

  console.log('stock-history-test: ok');
};

run();
