# Landing Page Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize `index.html` landing page into a high-impact, data-dense investor workbench with streamlined hero CTAs, live market status, 4 feature cards, and search shortcuts.

**Architecture:** Vanilla HTML/CSS/JS with OKLCH tokens, modular shell integration, 44px touch targets, mobile-first layouts, and zero bundler requirements.

**Tech Stack:** Vanilla JS (ES modules), Vanilla CSS (`styles.css`), HTML5.

## Global Constraints

- Mobile-first layout (360px base) adapting up to desktop (≥1024px).
- One stylesheet: `styles.css`. No inline `style="..."`.
- All touch targets ≥ 44×44px.
- Respect `prefers-reduced-motion`.
- `npm test` must remain green.

---

### Task 1: CSS Component Additions in `styles.css`

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: OKLCH design tokens (`--surface`, `--surface-2`, `--border`, `--text`, `--accent`, `--r-md`, `--shadow-1`, `--fs-sm`, `--fs-lg`)
- Produces: CSS classes `.hero__actions`, `.feature-showcase`, `.feature-grid`, `.feature-card`, `.search-hint`

- [ ] **Step 1: Add CSS rules for hero actions, feature grid, and feature cards in `styles.css`**

Add the following CSS to `styles.css`:

```css
/* Hero CTA streamlining */
.hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3);
  margin-top: var(--s-5);
}

/* Feature Showcase section on landing page */
.feature-showcase {
  margin-top: var(--s-8);
  margin-bottom: var(--s-8);
}

.feature-showcase__header {
  margin-bottom: var(--s-4);
}

.feature-showcase__header h2 {
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  color: var(--text);
  margin-top: var(--s-1);
}

.feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--s-4);
}

@media (min-width: 600px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .feature-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.feature-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--s-4);
  text-decoration: none;
  color: var(--text);
  box-shadow: var(--shadow-1);
  transition: transform var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out);
}

.feature-card:focus-visible {
  outline: 3px solid var(--accent-soft);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .feature-card:hover {
    transform: translateY(-2px);
    border-color: var(--border-strong);
    box-shadow: var(--shadow-2);
  }
}

.feature-card__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--s-3);
}

.feature-card__icon svg {
  width: 22px;
  height: 22px;
}

.feature-card__title {
  font-family: var(--font-display);
  font-size: var(--fs-base);
  font-weight: 700;
  margin: 0 0 var(--s-1) 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feature-card__arrow {
  color: var(--text-faint);
  transition: color var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
}

.feature-card:hover .feature-card__arrow {
  color: var(--accent);
  transform: translateX(2px);
}

.feature-card__desc {
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin: 0;
  line-height: var(--lh-snug);
}

/* Search input shortcut hint */
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input-wrapper input {
  width: 100%;
}

.search-shortcut-hint {
  position: absolute;
  right: 12px;
  font-size: var(--fs-xs);
  font-family: var(--font-mono);
  color: var(--text-faint);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 2px 6px;
  pointer-events: none;
}
```

- [ ] **Step 2: Commit CSS additions**

```bash
git add styles.css
git commit -m "feat: add feature grid and search hint styles to styles.css"
```

---

### Task 2: Landing Page HTML Restructuring in `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: CSS classes `.hero__actions`, `.feature-showcase`, `.feature-grid`, `.feature-card`, `.search-input-wrapper`, `.search-shortcut-hint`

- [ ] **Step 1: Update `index.html` hero CTAs and add `.feature-showcase` grid section**

In `index.html`:
Replace hero actions with 2 primary CTAs (`Explore Market Lens →` and `Try AI Analyst ✨`).
Insert the `.feature-showcase` section immediately after `<header class="hero">` and before `<main class="app">`.
Wrap the search input in `.search-input-wrapper` with `<kbd class="search-shortcut-hint">/</kbd>`.

Target HTML structure for hero actions:
```html
      <div class="hero__actions">
        <a class="btn btn--primary" href="./market.html">Explore Market Lens →</a>
        <a class="btn" href="./chat.html">Try AI Analyst ✨</a>
      </div>
```

Target Feature Showcase section:
```html
    <section class="feature-showcase" aria-label="Core toolkit features">
      <div class="feature-showcase__header">
        <p class="eyebrow">Everything you need</p>
        <h2>Investor Workbench Tools</h2>
      </div>
      <div class="feature-grid">
        <a class="feature-card" href="./market.html">
          <div class="feature-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></svg>
          </div>
          <h3 class="feature-card__title">Market Lens <span class="feature-card__arrow">→</span></h3>
          <p class="feature-card__desc">Real-time market overview, stock screener, and sector heatmaps.</p>
        </a>

        <a class="feature-card" href="./chat.html">
          <div class="feature-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/></svg>
          </div>
          <h3 class="feature-card__title">AI Analyst <span class="feature-card__arrow">→</span></h3>
          <p class="feature-card__desc">Instant AI-powered answers and financial analysis for DSE stocks.</p>
        </a>

        <a class="feature-card" href="./portfolio.html">
          <div class="feature-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <h3 class="feature-card__title">Portfolio & Funds <span class="feature-card__arrow">→</span></h3>
          <p class="feature-card__desc">Track your DSE stock holdings and mutual fund NAV performance.</p>
        </a>

        <a class="feature-card" href="./guides.html">
          <div class="feature-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
          </div>
          <h3 class="feature-card__title">Chart Playbook <span class="feature-card__arrow">→</span></h3>
          <p class="feature-card__desc">Learn key technical indicators and classify stock behavior patterns.</p>
        </a>
      </div>
    </section>
```

- [ ] **Step 2: Commit HTML updates**

```bash
git add index.html
git commit -m "feat: restructure index.html hero CTAs and add feature showcase grid"
```

---

### Task 3: Interactive Search Shortcut & Verification

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: Add `/` keydown shortcut to focus search input in `src/app.js`**

Add the following event listener in `src/app.js`:

```javascript
// Focus search input on pressing '/' when not inside another input
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    const searchInput = document.getElementById('search');
    if (searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  }
});
```

- [ ] **Step 2: Run `npm test` to verify no regressions**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit JS additions**

```bash
git add src/app.js
git commit -m "feat: add search input keyboard shortcut in src/app.js"
```
