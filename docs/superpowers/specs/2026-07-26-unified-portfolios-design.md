# Unified Portfolios Page — Design Spec

**Date:** 2026-07-26  
**Status:** Approved — implementation plan at `docs/superpowers/plans/2026-07-26-unified-portfolios.md`  
**Scope:** Collapse `portfolio.html` (stocks) and `funds.html` (mutual funds) into one Portfolios experience; redesign UI to match the site design system.

---

## 1. Problem

Stocks and mutual funds are separate pages with divergent layouts, duplicated summary/header patterns, and two tab-bar slots. Users want one place to see total wealth, filter by category, and manage holdings without losing existing data or fund-specific workflows.

## 2. Goals

- One **Portfolios** page with category filter: All / Stocks / Funds.
- Combined overview on All; scoped overview on Stocks or Funds.
- Unified holdings feed (mixed when All), with category badges and portfolio attribution.
- Match DSE Toolkit tokens/components (Whisper, Manrope + Sora, green accent).
- Free a tab slot for **Chart Playbook**; keep existing localStorage schemas intact.

## 3. Non-goals

- Merging stock and fund data into a single localStorage schema.
- Mixing stocks and funds inside one named portfolio entity.
- Redesigning Market, Chat, Glossary, or Settings in this work.
- Building a new fund “market detail” page.

## 4. Information architecture

### 4.1 Navigation

Bottom tab bar (mobile) / side rail (desktop ≥1024px):

| Slot | Label | Target |
|------|--------|--------|
| 1 | Glossary | `index.html` |
| 2 | Market | `market.html` |
| 3 | **Portfolios** | `portfolio.html` |
| 4 | **Playbook** | `guides.html` |
| 5 | AI | `chat.html` |

- Canonical URL: **`portfolio.html`** (avoid rename churn).
- `funds.html` redirects to `portfolio.html?category=funds`.
- Deep links: `?category=all|stocks|funds` (default `all`).
- Old “Stocks” / “Funds” primary tabs removed; Playbook promoted from More into the primary bar.

### 4.2 Category model

- **One page, two categories** (not one mixed portfolio type).
- Named portfolios remain **per category** (today’s model): stock portfolios vs fund portfolios.
- Filter does not create a third data type; it scopes reads/writes and UI.

## 5. Visual design (approved hybrid)

**Base:** Dual Pulse overview (option C)  
**Additions:** Holding weight bars (from B); holding count on the holdings section header (not on the filter segments).

### 5.1 Page chrome

1. Title: **Portfolios**
2. Header actions: Export / Import (and/or overflow menu) — scoped by active filter (All = both category backups).
3. Segmented control: **All | Stocks | Funds** — labels only, no counts.
4. Overview card (see §5.2).
5. Holdings section header: **Holdings** + count badge (e.g. `12`) + **Manage ▾**.
6. Holdings list (cards with weight bars).
7. FAB `+` for add (see §6).

Use shared tokens from `styles.css` only. Prefer shared `.card`, `.sheet`, `.btn`, `.metric` patterns. Page-specific CSS limited to layout composition for this page — no redefinition of core component tokens.

### 5.2 Overview card

**All:**

- Label: Combined value
- Primary value + P/L (৳ and %)
- Allocation bar: stocks share vs funds share (distinct hues: brand-teal for stocks, cooler secondary for funds — both must differ in lightness for accessibility)
- Split: Stocks value/%/P/L | Funds value/%/P/L

**Stocks or Funds:**

- Same card scoped to that category
- Hide allocation split (or show single-category metrics only)
- Include category-relevant extras where they already exist (e.g. fund CIP / dividend reinvest when on Funds)

### 5.3 Holding row

- Primary: symbol / fund code + category badge (Stock | Fund)
- Secondary meta (one line, ellipsis): portfolio name · quantity units
- Right: current value + P/L %
- Weight bar: share of **currently displayed** total value (All = combined; filter = category total)
- Long portfolio names: truncate on the row; full name in the detail sheet

### 5.4 Motion & a11y

- Filter changes: short opacity/transform transitions; exits ~70% of entrance duration.
- Honor `prefers-reduced-motion` (no motion).
- Visible `:focus-visible` on segments, rows, FAB, sheet actions.
- Touch targets ≥44×44px; rows are full-width hit areas.
- Status colors differ in lightness, not only hue.

## 6. Interactions

| Action | Behavior |
|--------|----------|
| Tap holding row | Bottom **sheet**: full portfolio name, metrics, Edit / Delete; stocks also get **View stock** → `stock.html` (or existing stock detail route with symbol). Funds: no market stock page — stay in-sheet (edit / transactions as today). |
| FAB `+` | Active filter Stocks or Funds → add form for that type. Filter All → choose Stock or Fund, then form sheet. |
| Manage ▾ | Manage named portfolios for the relevant category (All: both groups listed). Create / rename / delete. |
| Export / Import | Preserve existing per-category file formats. On All: header offers both “Export/Import stocks” and “Export/Import funds” (no new combined file format). On a single-category filter: only that category’s import/export. |
| Segment change | Updates overview, holdings list, count, and URL `?category=`. |

## 7. Empty & partial states

| State | UI |
|-------|-----|
| No holdings in either category | Overview at zero; empty holdings copy + CTA; FAB available. |
| All filter, only one category has data | Split still shows both columns; empty side ৳0 / 0%; bar 100% filled side; list shows only existing holdings. |
| Stocks/Funds filter empty | Scoped overview empty; category-specific empty CTA. |
| Portfolios exist, no holdings | Empty holdings; Manage still lists portfolio names. |

## 8. Data & storage

Keep **two stores**; unify UI only.

| Category | Storage key | Modules |
|----------|-------------|---------|
| Stocks | `dse_toolkit_portfolios` | `portfolioStore` / `portfolioLogic` (existing) |
| Funds | `dse-mutual-funds` | `fundsStore` / `fundsLogic` (existing) |

- New page controller (e.g. extend `portfolioApp.js` or add a thin `portfoliosApp.js`) reads both, merges for overview + feed, writes through the existing category APIs.
- **No schema migration.** Existing backups and device data keep working.
- Prices: stocks continue from market data; funds continue user-entered NAV / transactions.

## 9. Implementation boundaries

**In scope**

- Redesign `portfolio.html` as unified Portfolios UI.
- Wire funds views/actions into the same page via existing funds modules.
- `funds.html` → redirect with `category=funds`.
- Update `src/shell.js` PRIMARY_TABS (Portfolios + Playbook).
- Update any deep links / copy that say “Stocks” or “Funds” as separate primary destinations.
- Shared sheet/modal patterns; remove page-local button/card forks where practical.
- Tests covering merge overview math, filter, redirects; `npm test` green.

**Out of scope / defer**

- Unified localStorage schema.
- Cross-category named portfolios.
- Redesign of stock detail page itself (only link into it).

## 10. Success criteria

- User can see combined wealth and filter by category on one page.
- Holding count appears on the holdings header and updates with the filter.
- Weight bars and Dual Pulse overview match the approved hybrid.
- Stock row sheet includes View stock; fund sheet does not pretend to have a market page.
- Tab bar shows Portfolios + Playbook; old dual Stocks/Funds tabs gone.
- Existing stock and fund local data loads without migration.
- Mobile-first layout works at 320–390px without horizontal scroll; desktop uses existing shell.
- Design tokens/components from `styles.css`; no new font families.

## 11. Open points resolved in brainstorm

| Topic | Decision |
|-------|----------|
| Layout | C Dual Pulse + B weight bars |
| Counts | On holdings header, not segment tabs |
| Row tap | Bottom sheet (+ View stock for stocks) |
| Storage | Keep separate keys |
| Tab bar | One Portfolios tab; promote Chart Playbook |

---

## 12. Next step

After user review of this file: invoke **writing-plans** to produce an implementation plan under `docs/superpowers/plans/`.
