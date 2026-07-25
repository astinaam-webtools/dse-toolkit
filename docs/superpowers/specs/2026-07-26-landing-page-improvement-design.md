# Landing Page Improvement Design — DSE Toolkit

> Date: 2026-07-26  
> Status: Approved  
> Target File: `index.html`, `styles.css`, `src/app.js`

---

## 1. Goal & Context

DSE Toolkit's landing page (`index.html`) serves as the entry point for Bangladeshi value investors on Dhaka Stock Exchange. 
Currently, the hero section contains a pile of 6 navigation buttons, jumping directly into the glossary search without introducing the platform's broader tools (Market Lens, AI Analyst, Portfolio Tracker, Mutual Funds, Chart Playbook, Behavior Analyzer).

This design transforms `index.html` into a high-impact, data-dense **Investor Workbench Landing Page** that cleanly showcases all core tools while preserving the fast, mobile-first glossary experience.

---

## 2. Structural & Layout Design

### 2.1 Hero Section Redesign
- **Typography Hierarchy**:
  - `eyebrow`: `DSE investor toolkit` (small caps / accent tint).
  - `h1`: `Stock market terms & tools made simple` using `--font-display` (Sora).
  - `lead`: `A mobile-first workbench for Dhaka Stock Exchange value investors. Analyze market trends, talk to AI, track portfolios, and learn key ratios.`
- **Live Market Glance Widget**:
  - Glassmorphic card styling with live status indicator (Open / Closed / Loading).
  - Metrics for Market Status, Trade Value, and Up/Down count.
- **Streamlined CTAs (2 Primary Actions)**:
  - Primary button (`btn--primary`): `Explore Market Lens →` (`./market.html`)
  - Secondary button (`btn` with accent icon): `Try AI Analyst ✨` (`./chat.html`)
  - Removes the 6-button stack from the hero; all other pages remain accessible via the mobile bottom tab bar / desktop siderail and feature grid.

### 2.2 Core Tools Feature Grid (`.feature-showcase`)
A 4-card interactive grid placed immediately below the hero section:
1. **Market Lens** (`./market.html`): Real-time index trends, stock screener, and sector heatmaps.
2. **AI Analyst** (`./chat.html`): Instant AI answers on DSE stocks and financial statements.
3. **Portfolio & Funds** (`./portfolio.html` & `./funds.html`): Track stock holdings, mutual fund NAVs, and SIP returns.
4. **Playbook & Analyzer** (`./guides.html` & `./analyzer.html`): Learn chart patterns and classify stock behavior.

- **Responsive Behavior**:
  - Mobile (360px–480px): Single column stacked cards.
  - Tablet (768px): 2×2 grid.
  - Desktop (≥1024px): 4-column row layout.

### 2.3 Interactive Search & Glossary Area
- **Search Bar Enhancements**:
  - Keyboard shortcut hint (`/` key to focus search).
  - Quick term chips (`P/E`, `EPS`, `ROE`, `Debt/Equity`, `Dividend Yield`, `Surprise Me`).
  - Category filter pills dynamically loaded from glossary data.
  - Recent search query chips stored in `localStorage`.
- **Glossary Card Grid**:
  - Uses existing OKLCH tokens (`--surface`, `--border`, `--text`, `--accent-soft`).
  - Clear typography contrast and 44px touch targets for term links.

---

## 3. CSS Component Additions in `styles.css`

- `.hero__actions`: Clean flex layout, gap `--s-3`, max 2 CTAs on landing hero.
- `.feature-showcase`: Section container with header (`eyebrow` + `h2`).
- `.feature-grid`: Grid container with `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`, gap `--s-4`.
- `.feature-card`: Surface card with subtle border hover lift (`transform: translateY(-2px)`), icon badge, title, description, and directional link indicator (`→`).
- Respects `@media (hover: none) and (pointer: coarse)` (no hover lifts on touch devices).
- Respects `prefers-reduced-motion` (instant transitions when enabled).

---

## 4. Accessibility & Quality Gauntlet

- **Touch Targets**: All interactive elements, buttons, and chips are ≥ 44×44px.
- **Color Contrast**: All text clears WCAG AA contrast ratio in both Light and Dark themes using OKLCH tokens.
- **Keyboard Navigation**: Search input responds to `/` shortcut; clear `:focus-visible` rings on feature cards and chips.
- **Mobile First**: Tested layout across 320, 360, 375, 390, 768, 1024, 1440, and 2560px screen widths without horizontal scroll.
