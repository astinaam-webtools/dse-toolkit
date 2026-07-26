# Stock Detail Page Redesign — Design Spec

**Date:** 2026-07-26  
**Status:** Draft — awaiting user review of this written spec  
**Scope:** Redesign `stock.html` / `src/stockDetailApp.js` layout for hierarchy, chart context, and null-safe field display.  
**Mockups:** `.superpowers/brainstorm/407837-1785074067/content/stock-layouts.html`, `stock-layout-a-v2.html`

---

## 1. Problem

The stock detail page renders every present metric as equal-weight cards in a flat grid. That:

- Hides price/trend hierarchy (LTP and chart compete with obscure ratios).
- Gives no chart scale (sparkline has no low/high context).
- Leaves awkward empty space when many metrics are omitted (nulls already dropped at build time).
- Treats primary trading stats the same as deep fundamental ratios.

## 2. Goals

- **Price pulse first:** symbol, LTP, change, and chart own the first viewport.
- **Readonly chart range:** show Low, High, session count, and span for the sparkline period.
- **Show every present metric:** no curated whitelist that drops fields from `stock.metrics`.
- **Omit null/empty:** missing keys stay hidden; empty groups are not rendered.
- Stay within DSE Toolkit tokens/components (Manrope + Sora, `styles.css`).

## 3. Non-goals

- Changing the market data build pipeline or JSON schema.
- Adding new fundamental fields beyond what `dse-market.json` already provides.
- Interactive chart zoom/pan or multi-timeframe switching (range is derived from existing sparkline only).
- Redesigning Market, Portfolios, Chat, or Settings in this work.
- Showing placeholder dashes for absent metrics.

## 4. Decisions (approved)

| Decision | Choice |
|----------|--------|
| First-viewport priority | **A — Price pulse** (chart + LTP/change first) |
| Null / missing metrics | **Hide completely** (current build omit behavior) |
| Layout direction | **Hero chart + trading strip + grouped fundamentals** |
| Field completeness | **Every non-null metric appears** in its group; strip elevates trading keys only |
| Chart range | **Readonly bar** under chart: Low · sessions + span · High |

## 5. Information architecture

### 5.1 Page structure (top → bottom)

1. Topbar back link → Market Lens (`market.html`)
2. Header: symbol (display), name, sector pill | LTP + change %
3. Chart (sparkline) + **range bar**
4. Trading strip (present keys only from strip priority list)
5. Fundamental groups (only groups with ≥1 present field)
6. AI analysis CTA (existing chat handoff)

Shell mounts (tabbar, siderail, footer) unchanged.

### 5.2 Chart range bar (readonly)

Derived from `stock.sparkline` when length ≥ 2:

| Label | Value |
|-------|--------|
| Low | `min(sparkline)` |
| High | `max(sparkline)` |
| Sessions | `sparkline.length` |
| Span | `High − Low` (non-negative magnitude; Low/High already convey direction of the band) |

If sparkline is missing or too short: hide the chart area’s polyline as today (“No chart data”), and **omit the range bar** (no fake zeros).

Visual placement: attached under the chart (shared border radius — chart top, bar bottom) so scale reads as part of the chart unit.

### 5.3 Metric grouping

All known keys from market data map to exactly one group. Rendering iterates group order; within a group, keep a stable key order. Only emit a row when `value != null` and not `''` (and skip non-finite numbers).

| Group | Keys |
|-------|------|
| Trading | `ltp`, `close`, `value`, `volume`, `mktCap` |
| Valuation | `pe`, `auditedPe`, `forwardPe`, `pb`, `nav`, `eps`, `dividendYield` |
| Profitability | `ebitdaMargin`, `operatingMargin`, `netMargin`, `grossMargin`, `roa`, `roe`, `roea`, `roi` |
| Balance sheet | `currentRatio`, `quickRatio`, `debtToEquity` |
| Capital | `paidUpCapital`, `totalShares` |

**Forward compatibility:** any unknown key present in `stock.metrics` goes into a final **Other** group (alphabetical), so new build fields never silently disappear.

### 5.4 Trading strip

Priority elevation only (not a filter):

- Candidate keys in order: `value`, `mktCap`, `close`, `volume`
- Render a strip cell only when that key is present
- Grid columns = number of present strip keys (1–4)
- Those keys **also** appear in the Trading group (elevated row styling optional) so the strip never “owns” a field exclusively

LTP remains prominent in the header; it still appears in the Trading group when present.

### 5.5 Change %

Continue using `stock.deltas.price_1d` when finite. If absent, show `—` and neutral color (existing behavior). Do not invent a % from sparkline alone in this redesign.

## 6. Visual design

- Mobile-first (360px), then widen; no horizontal scroll.
- Use existing tokens: `--bg`, `--surface`, `--accent`, `--up` / `--down`, radius/spacing from `styles.css`.
- Prefer shared patterns (`.detail-header`, `.btn`, group containers as modifiers — not a new card system).
- Glossary deep-links on metric labels retained (`keyToTerm` / format fallback).
- Chart stroke color follows up/down from 1d change when available (existing).
- `prefers-reduced-motion` respected; no looping pulses.
- Touch targets ≥44×44px for group headers if they become toggles; v1 groups can be **always expanded** (simpler). Collapsible groups are optional polish, not required for MVP.

## 7. Data flow

```
URL ?symbol=GP
  → fetch dse-market.json (network-first, local fallback)
  → find stock by symbol
  → render header / chart+range / strip / groups / AI CTA
```

No schema change. `compactStock` already omits null metrics at build time; the UI treats absent keys as missing.

## 8. Empty & error states

| State | Behavior |
|-------|----------|
| No `symbol` query | Keep existing loading/error message |
| Symbol not found | Keep existing not-found message |
| No sparkline | Message in chart area; no range bar |
| No metrics object / all empty | Header + chart (if any) + AI CTA; no strip; no groups |
| Sparse ticker (few keys) | Strip shortens; only non-empty groups render |

## 9. Files to touch

- `stock.html` — structure hooks for range bar, strip, groups (semantic containers)
- `src/stockDetailApp.js` — grouping, range derivation, render logic
- `styles.css` — tokens/components for strip, range bar, metric groups (shared, not one-off hex)
- Tests covering group membership, null omission, range math, and “unknown key → Other”

## 10. Testing

- Unit: given metrics fixtures (rich GP-like, sparse bond-like, empty), assert rendered group/row sets
- Unit: sparkline `[237.7, …, 258.2]` → low/high/span/sessions
- Unit: unknown metric key appears under Other
- Manual: mobile widths 360 / 390; dark + light; reduced motion
- `npm test` green before done

## 11. Out of scope follow-ups (explicitly deferred)

- Multi-range chart selector (1D / 1M / 6M) using deltas beyond sparkline
- Collapsible group persistence
- Desktop two-column chart | fundamentals layout (may follow if needed after MVP)
