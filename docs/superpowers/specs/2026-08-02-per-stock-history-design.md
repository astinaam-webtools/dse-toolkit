# Per-Stock History + Chart Range Filter — Design Spec

**Date:** 2026-08-02  
**Status:** Implemented on `feat/per-stock-history`  
**Scope:** Keep short baked sparklines in `dse-market.json`; emit per-stock OHLC history JSON; lazy-load on stock detail when the user picks a non-Default range (presets + custom).

---

## 1. Problem

`dse-market.json` embeds only the last ~30 session closes as `sparkline`. Raw CSVs in `data/dse/` span ~7–9 months, but the detail chart cannot show that window. Expanding sparklines in the market JSON would bloat every page load.

## 2. Goals

- Keep `dse-market.json` sparkline cap at **30** sessions for list + default detail chart.
- Emit **one history file per symbol** with full available OHLC-ish sessions.
- Stock detail: range chips + custom from→to; fetch history **only** after leaving Default.
- Chart remains a **close line** in v1; OHLC stored for later candles.
- Stay within existing tokens/components (`styles.css`, chips, fields).

## 3. Non-goals

- Candlestick UI in this pass.
- Changing market list sparklines.
- Embedding full history into `dse-market.json`.
- True exchange OHLC until the scraper provides Open/High/Low columns.

## 4. Decisions (approved)

| Decision | Choice |
|----------|--------|
| First paint | **A** — baked sparkline only; no history fetch |
| History payload | Best-effort OHLC + volume (synthesis from Close/LTP/Volume) |
| Range UI | Presets + custom from→to |
| File layout | `src/data/history/{SYMBOL}.json` |

## 5. Data schema

Path: `src/data/history/{SYMBOL}.json` (symbol uppercased; DSE symbols are alphanumeric).

```json
{
  "symbol": "GP",
  "from": "2025-10-19",
  "to": "2026-07-26",
  "sessions": [
    ["2025-10-19", 242.5, 243.1, 241.0, 242.9, 120000]
  ]
}
```

Tuple: `[date, open, high, low, close, volume]`.

### Synthesis (CSV lacks true O/H/L)

- `close` = `Close` (fallback `LTP`)
- `open` = previous session’s `close` (first session: same as close)
- `high` = `max(LTP, Close)` when both present, else close
- `low` = `min(LTP, Close)` when both present, else close
- `volume` = `Volume(Qty)` or `0`

## 6. Pipeline

`npm run build:data` (`scripts/build-market-data.mjs`):

1. Unchanged: sparkline from last 30 usable CSVs → `dse-market.json`.
2. Walk all usable dated CSVs; accumulate per-symbol sessions with synthesis.
3. Wipe + rewrite `src/data/history/*.json` each build.
4. Log file count and total size.

## 7. UI / runtime

On `stock.html` under the chart:

- Chips: `Default`, `1M`, `3M`, `6M`, `YTD`, `All`, `Custom`
- Custom panel: visible From/To date labels + Apply (≥44×44 touch)

Behavior:

- **Default:** current sparkline + metadata `sparklineFrom`/`sparklineTo`.
- **Other presets / Custom:** fetch `./src/data/history/{symbol}.json` once (cache in memory); filter; render closes; update range bar from filtered window.
- Fetch failure: muted message; keep last good chart.
- Return to Default: baked sparkline again.

Pure helpers in `src/lib/stockHistory.js`: `resolvePresetRange`, `filterSessions`, `closesFromSessions`, plus shared `synthesizeBar` for the build.

## 8. Service worker

Network-first + runtime cache for `/src/data/history/*.json` (same pattern as `dse-market.json`). Do not precache the history directory.

## 9. Size expectations

~3–4 MB for ~638 files today; ~+30 KB per new trading day across the folder. Individual fetches stay ~5–6 KB.
