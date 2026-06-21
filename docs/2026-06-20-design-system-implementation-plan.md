# 2026-06-20 — Design System Implementation Plan

> Handoff-ready execution plan for the DSE Toolkit design overhaul.
> Source of design rationale: [`DESIGN_REVIEW_AND_DIRECTION.md`](./DESIGN_REVIEW_AND_DIRECTION.md)
> (read it first — this plan tells you *what to change and in what order*; that
> doc tells you *why*).
>
> Stack context: vanilla JS ES modules, no bundler, static PWA, existing
> `scripts/build.mjs`. No framework migration. Every change below is plain
> HTML/CSS/JS.

---

## How to use this plan

- Work **phase by phase, task by task**. Phases are ordered by dependency:
  Phase 1 unblocks 2 and 3; do not start 3 before 1.
- Each task lists **Files**, **Steps**, and **Acceptance criteria**. A task is
  "done" when every acceptance bullet is true and `npm test` still passes.
- After each phase, run the **Phase gate** checklist before moving on.
- Commit per task (or per task group). Suggested commit prefix: `design(phaseN): …`.
- Do not refactor unrelated code mid-task. Stay in scope.

### Global conventions

- Colors go in **OKLCH**. No new hex colors.
- Spacing is a multiple of 4px (`--s-*` scale). No magic numbers.
- Radius uses `--r-*`. No ad-hoc `border-radius`.
- Every new interactive element gets a visible `:focus-visible` ring and ≥44px
  hit area.
- Every new/changed animation must be covered by the global
  `prefers-reduced-motion` block.
- Delete code you replace. No commented-out leftovers, no `_unused` shims.

---

## File inventory (what this plan touches)

| File | Phases | Why |
|---|---|---|
| `styles.css` | 1, 3 | Token source of truth; shared components |
| `index.html` | 1, 2, 4 | Drop Inter; add shell; hero gradient |
| `guides.html` | 1, 2, 4 | Drop Inter; add shell; prose measure |
| `stock.html` | 1, 2, 4 | Drop Inter; add shell; inline-style cleanup |
| `market.html` | 1, 2, 3, 4 | Token redecls; shell; AI button; sheet; dead padding |
| `portfolio.html` | 1, 2, 3, 4 | Token redecls; shell; editor-panel→sheet; metrics |
| `funds.html` | 1, 2, 3, 4 | Token redecls; shell; btn/modal/field overrides; metrics |
| `chat.html` | 2, 3, 4 | Shell; bubble color unify; reduced-motion |
| `analyzer.html` | 2, 4 | Shell; shared `.field` |
| `settings.html` | 2, 3, 4 | Shell; settings-modal→sheet; red/green toggle |
| `privacy.html` | 2, 4 | Shell; prose measure |
| `src/shell.js` (new) | 2 | Injects tabbar + footer (single source of truth) |
| `src/settingsApp.js` | 4 | Red/green toggle wiring |
| `src/lib/*.js` | 4 | If a shared `prefers-up-down` helper is needed |

Pages that currently have **no** shared nav: `index.html` (uses hero buttons),
`stock.html` (only a back-nav). Both get the shell in Phase 2.

Pages that currently have the **duplicated footer**: `index`, `market`,
`guides`, `analyzer`, `stock` (and `privacy`). All replaced by `shell.js`.

Pages that **redeclare** `--color-up/down/neutral` in a `<style>` block:
`market`, `portfolio`, `funds`. All deleted in Phase 1.

Pages loading **Inter** via `<link>`: `index`, `guides`, `stock`. All removed in
Phase 1 (Manrope+Sora already load via `styles.css` `@import`).

Only `chat.html` currently sets `viewport-fit=cover`. Phase 2 applies it
everywhere.

---

## Phase 1 — Foundation (tokens, type, motion)

**Goal:** establish the single source of truth for color, type, spacing, radius,
and motion. Unblocks all later phases.

### Task 1.1 — Replace color tokens with the OKLCH set

**Files:** `styles.css`, `market.html`, `portfolio.html`, `funds.html`

**Steps:**
1. In `styles.css`, replace the `:root` color block (the hex `--bg`, `--card`,
   `--text`, `--muted`, `--border`, `--accent`, `--danger`, `--shadow`,
   `--controls-bg-end`, `--color-up/down/neutral`) with the OKLCH token set from
   §4.1 of the design doc. Keep the token **names** that already exist where
   possible to minimize breakage, but introduce the new names alongside:
   - Map old → new: `--card`→`--surface`, `--danger`→`--down`,
     `--color-up`→`--up`, `--color-down`→`--down`, `--color-neutral`→`--neutral`.
   - Add: `--surface-2`, `--surface-sunk`, `--text-faint`, `--border-strong`,
     `--accent-hover`, `--accent-press`, `--accent-soft`, `--accent-contrast`,
     `--up-soft`, `--down-soft`, `--warning`, `--warning-soft`,
     `--shadow-1/2/3`.
   - Keep `--controls-bg-end` (used by sticky controls) but redefine it in
     OKLCH as a translucent surface.
2. Update the `@media (prefers-color-scheme: dark)` block to the dark OKLCH set
   from §4.1.
3. Do a find-replace pass across `styles.css` for the renamed tokens
   (`var(--card)`→`var(--surface)`, `var(--danger)`→`var(--down)`, etc.).
4. **Delete** the `:root { --color-up/down/neutral … }` redeclarations inside
   the `<style>` blocks of `market.html`, `portfolio.html`, `funds.html`. These
   now inherit from `styles.css`.
5. Leave per-page component CSS referencing `var(--up)/var(--down)` — do not
   hardcode hex.

**Acceptance:**
- [x] No hex color literals remain in `styles.css` `:root` or dark block.
- [x] `market.html`, `portfolio.html`, `funds.html` no longer redefine
      `--color-up`, `--color-down`, or `--color-neutral`.
- [x] Light mode visually unchanged in intent (green accent, red down) but
      neutrals are faintly green-tinted.
- [x] Dark mode surfaces are not muddy (verify on `market` and `portfolio`).

### Task 1.2 — Unify typography to Manrope + Sora

**Files:** `index.html`, `guides.html`, `stock.html`, `styles.css`

**Steps:**
1. Remove the Google Fonts `<link>` for Inter from `index.html`, `guides.html`,
   and `stock.html` `<head>`. (Manrope+Sora already load via the `@import` at
   the top of `styles.css`.)
2. In `styles.css` `:root`, add the type tokens from §4.2:
   `--font-body`, `--font-display`, `--font-mono`, the `--fs-*` scale,
   `--lh-*`, `--measure`.
3. Set `body { font-family: var(--font-body); }` and `h1,h2,h3 { font-family:
   var(--font-display); }` (replace the ad-hoc `font-family` on `h1`).
4. Replace hardcoded `font-size` values in `styles.css` with the nearest
   `--fs-*` token where it's a clean match (eyebrow→`--fs-xs`, lead→`--fs-md`,
   card titles→`--fs-lg`, page h1→`--fs-xl`, hero→`--fs-2xl`). Don't force-fit
   every value; prioritize headings, body, lead, labels.
5. Add `font-variant-numeric: tabular-nums` to `.metric-value`, `.summary-value`,
   `.price`, `.value`, `.market-glance__number` (some already have it — make
   universal).
6. Dark mode: in the dark `@media` block, add `body { line-height: var(--lh-loose);
   letter-spacing: 0.01em; }` to compensate light-on-dark thinning.

**Acceptance:**
- [x] No `Inter` `<link>` remains in any HTML.
- [x] Moving glossary → market no longer changes the typeface.
- [x] Numeric columns align (tabular-nums) on `market` screener and
      `portfolio` summary.

### Task 1.3 — Add spacing, radius, and motion token scales

**Files:** `styles.css`

**Steps:**
1. Add to `:root` the spacing scale (`--s-1`…`--s-16`), radius scale
   (`--r-sm/md/lg/xl/pill`), and motion tokens (`--ease-out`, `--ease-spring`,
   `--dur-1/2/3`) from §4.3–4.5 of the design doc.
2. Do **not** yet rewrite every padding/radius to use tokens (that's Phase 3).
   Just establish the tokens so Phase 3 can reference them.

**Acceptance:**
- [x] Tokens exist and are referenced by at least the new component CSS in
      Phase 3.
- [x] No visual change yet (additive only).

### Task 1.4 — Add reduced-motion support; kill the heartbeat

**Files:** `styles.css`

**Steps:**
1. Add the global `@media (prefers-reduced-motion: reduce)` block from §4.5
   (zeros out animation/transition durations, sets `scroll-behavior: auto`).
2. **Remove** the `@keyframes heartbeat` rule and the `animation` on
   `.footer__heart`. Replace the animated `❤️` span with a static one (or drop
   the emoji per the voice notes — but static is the minimum).
3. Audit other infinite animations: `.chat-msg--thinking::before` pulse
   (`styles.css`), `thinking-pulse` (`chat.html`), `pulse` keyframe. Confirm
   they are all neutralized by the global reduced-motion block (they will be,
   via the blanket rule). No per-animation edits needed.

**Acceptance:**
- [x] With OS "reduce motion" on, no animation plays anywhere on the site.
- [x] The footer heart no longer animates on any page, motion setting or not.
- [x] Thinking dots still show (static) when reduced motion is on.

### Phase 1 gate

- [x] `npm test` passes.
- [x] Site loads in light + dark; no unstyled flashes from missing tokens.
- [x] No console errors about missing fonts.
- [x] `grep -rn "Inter:" styles.css index.html guides.html stock.html` returns
      nothing (the `@import` for Manrope/Sora stays).

---

## Phase 2 — Shell & navigation

**Goal:** one page shell, one bottom tab bar (mobile) / side rail (desktop), one
footer, safe-area handling everywhere.

### Task 2.1 — Create the shared shell injector

**Files:** `src/shell.js` (new), `styles.css`

**Decision:** inject the tabbar and footer at runtime via `src/shell.js`, into
placeholder elements on each page. Rationale: matches the existing module-script
pattern (every page already loads `navStatus.js`, `swRegister.js`,
`mobile-nav.js`); gives a single source of truth without a build-pipeline
change; works offline (JS is already required for every page).

**Steps:**
1. Create `src/shell.js` exporting/running an `initShell()` that:
   - Renders a bottom `.tabbar` into `<div id="tabbar-mount"></div>` (placed
     before `</body>` on each page).
   - Renders the shared `.site-footer` into `<div id="footer-mount"></div>`.
   - Marks the active tab based on `location.pathname`.
   - The tabbar has 5 tabs: **Glossary** (`index.html`), **Market**
     (`market.html`), **Stocks** (`portfolio.html`), **Funds** (`funds.html`),
     **AI** (`chat.html`). Plus a **More** tab opening a sheet with Settings,
     Guides, Analyzer, Privacy, GitHub.
2. Add `.tabbar`, `.tabbar__tab`, `.tabbar__tab.is-active`, and the desktop
   `.siderail` styles to `styles.css` per §5.1–5.4:
   - Mobile (`<1024px`): fixed bottom bar, `padding-bottom:
     env(safe-area-inset-bottom)`, each tab ≥48×48px, 24px icon + label, active
     tab gets a 3px top accent bar (not a fill).
   - `≥1024px`: tabbar hidden; render a left `.siderail` instead (icon+label
     vertical). The same `shell.js` can render both and toggle via CSS, or
     render siderail into `#siderail-mount`.
3. Footer markup moves into `shell.js` (the verbatim footer currently duplicated
   across 5 pages). Use the existing footer structure but swap emoji nav links
   to inline SVG icons for consistency (pick one icon vocabulary).

**Acceptance:**
- [x] `shell.js` loads on every page (add `<script type="module"
      src="./src/shell.js"></script>` in Phase 2.3).
- [x] Tabbar shows on mobile; siderail on `≥1024px`.
- [x] Active tab reflects the current page.
- [x] "More" sheet opens and links work.

### Task 2.2 — Define the shared page shell layout

**Files:** `styles.css`

**Steps:**
1. Add `.page` container: `max-width: 720px` for reading surfaces, `1100px` for
   data surfaces — use a modifier: `.page--reading` and `.page--data`. Centered,
   `padding: var(--s-4)`.
2. Add `.topbar` (slim sticky header: page title + contextual actions). Replaces
   the per-page `.lens-header` / `.portfolio-header` / `.settings-hero` chrome
   where appropriate (full migration in Phase 4; here just define the class).
3. Add `.safe-top-spacer` rule (already exists) and ensure it's applied via the
   shell, not hand-placed.

**Acceptance:**
- [x] `.page`, `.page--reading`, `.page--data`, `.topbar` exist and are used by
      at least one page after Phase 4.

### Task 2.3 — Apply the shell to every page

**Files:** all 10 HTML pages

**Steps:**
1. On every page, add to `<head>`: `<meta name="viewport"
   content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`
   (replace existing viewport meta; only `chat.html` has `viewport-fit=cover`
   today).
2. Add `<div id="tabbar-mount"></div>` and `<div id="footer-mount"></div>` before
   `</body>` on every page.
3. Add `<script type="module" src="./src/shell.js"></script>` to every page.
4. **Delete** the duplicated static `<footer class="footer">…</footer>` block
   from `index`, `market`, `guides`, `analyzer`, `stock`, `privacy`.
5. **Delete** the per-page `<nav class="nav-bar">…</nav>` from `market`,
   `portfolio`, `funds`, `chat`, `settings`, `guides`, `analyzer` (the tabbar
   replaces it). Keep page-specific contextual headers (e.g. `market`'s
   home-link / market-status row) but restyle them as `.topbar` content in
   Phase 4.
6. Add `<div class="safe-top-spacer"></div>` right after the tabbar/topbar on
   pages that sit close to the status bar (uniform via shell if possible).
7. `index.html`: it currently has no nav — it now gets the tabbar like everyone
   else. `stock.html`: replace the lone `.back-nav` with the shell + a contextual
   back action in its `.topbar`.

**Acceptance:**
- [x] Every page has `viewport-fit=cover`.
- [x] Every page shows the same tabbar + footer (no duplicated markup).
- [x] No page renders two nav bars.
- [x] `grep -rn 'class="footer"' *.html` returns nothing (footer is injected).

### Task 2.4 — Input-mode detection

**Files:** `styles.css`

**Steps:**
1. Add `@media (hover: none) and (pointer: coarse) { … }` that disables
   `transform` hover lifts (`.btn:hover`, `.chip:hover`, `.fund-card:hover`,
   `.sector-tile:hover`) and ensures touch targets are ≥48px.

**Acceptance:**
- [x] On a touch device, no element stays "lifted" after a tap.
- [x] Hover lifts still work on desktop with a mouse.

### Phase 2 gate

- [x] `npm test` passes.
- [x] Navigation is identical across all 10 pages.
- [x] Bottom tab bar is thumb-reachable; active state is clear.
- [ ] Notch devices show no content under the status bar (test 390px + notch) — manual test needed.
- [x] Desktop shows the side rail, not the bottom bar.

---

## Phase 3 — Component unification

**Goal:** one definition each for button, card, field, metric, chip, status-pill,
and modal. Delete all per-page overrides.

### Task 3.1 — Unify buttons

**Files:** `styles.css`, `market.html`, `portfolio.html`, `funds.html`,
`stock.html`

**Steps:**
1. In `styles.css`, replace the `.btn` block with the shared definition from
   §6.1 (44px min-height, `--r-sm`, modifiers `--primary/--ghost/--danger`).
   Keep `--solid` as an alias for `--primary` during migration if it reduces
   churn, then remove.
2. `funds.html` redefines `.btn` (10px radius, no min-height) in its `<style>`
   — delete that block; use the shared `.btn` + `.btn--primary/--secondary`.
3. `market.html` `.btn-ai` (blue-violet gradient) — replace with `.btn
   .btn--primary` (or a dedicated `.btn--ai` that uses `--accent`, no gradient).
4. `stock.html` `.btn-ai` (solid accent in `styles.css`) — align to the same
   `.btn--ai` treatment.
5. Remove inline `style="…"` button overrides (e.g. `market.html` header
   `btn-secondary` inline styles).

**Acceptance:**
- [ ] All buttons share one radius, one height, one focus ring.
- [ ] No blue-violet gradient remains anywhere.
- [ ] `grep -rn "6366f1\|8b5cf6" .` returns nothing.

### Task 3.2 — Unify cards and panels

**Files:** `styles.css`, all pages with cards

**Steps:**
1. Define `.card` per §6.2 in `styles.css` (`--surface`, `--border`,
   `--r-md`, `--shadow-1`, `padding: var(--s-4)`).
2. Map existing card classes to share the base: `.term-card`, `.guide-card`,
   `.bucket-card`, `.fund-card`, `.analysis-card`, `.metric-card`,
   `.summary-card`, `.settings-card` → each becomes `.card` + a specific
   modifier only where needed. Don't flatten genuinely different components;
   just make them share surface/border/radius/shadow tokens.
3. Remove per-page `box-shadow` literals; use `--shadow-1/2/3`.

**Acceptance:**
- [ ] Every card uses `var(--r-md)` and a `--shadow-*` token.
- [ ] No hardcoded `box-shadow` literals in page `<style>` blocks.

### Task 3.3 — Unify form fields

**Files:** `styles.css`, `analyzer.html`, `portfolio.html`, `funds.html`,
`settings.html`

**Steps:**
1. Define `.field` (label + input, 44px input height, `--r-sm`, focus ring
   `0 0 0 3px var(--accent-soft)`) and `.input`/`.select` in `styles.css`.
2. `analyzer.html` `.form-field` → `.field`. `portfolio.html` `.form-group` →
   `.field`. `funds.html` `.form-group` → `.field`. `settings.html`
   `.settings-form` inputs → `.input`.
3. Ensure every input has a **visible label** (not placeholder-only). The
   analyzer already does; verify portfolio/funds/settings.

**Acceptance:**
- [ ] One input style across all forms.
- [ ] All inputs ≥44px tall with a consistent focus ring.
- [ ] No placeholder-as-only-label.

### Task 3.4 — Unify data primitives (metric, delta, chip, status-pill)

**Files:** `styles.css`, `market.html`, `portfolio.html`, `funds.html`

**Steps:**
1. Define `.metric` (label over tabular value), `.delta.up/.down` (semantic
   color on values only), `.chip` (44px, `--r-pill`), `.status-pill`
   (`is-connected/is-warning/is-down/is-neutral`) in `styles.css` per §6.5–6.6.
2. Map: `.summary-item`/`.summary-value` → `.metric`; `.change.up/.down`,
   `.holding-pl`, `.gain-loss`, `.sector-change` → `.delta`; `.quick-filter-btn`
   → `.chip`; `.nav-server-pill` + `.settings-badge` + `.market-status` →
   `.status-pill`.
3. **Critical rule:** semantic `--up/--down` colors apply **only** to data
   values, never to buttons or UI chrome. Audit and fix any button using
   `--up/--down`.

**Acceptance:**
- [ ] `.metric`, `.delta`, `.chip`, `.status-pill` each have one definition.
- [ ] No UI button is colored with `--up` or `--down`.
- [ ] Status pills across market/portfolio/settings look identical.

### Task 3.5 — Collapse four modal systems into one `.sheet`

**Files:** `styles.css`, `market.html`, `portfolio.html`, `funds.html`,
`settings.html`

**Steps:**
1. Define `.sheet-overlay` + `.sheet` per §6.3 in `styles.css`: mobile =
   bottom sheet (slides up), desktop = centered dialog (scale). `[open]`
   attribute toggles state.
2. Migrate:
   - `market.html` `.modal-overlay.open` + `.modal-content` → `.sheet`.
   - `portfolio.html` `.modal.active` + the inline `.editor-panel` → `.sheet`.
     The editor-panel's dark gradient card on a light page is jarring; the
     sheet uses `--surface`.
   - `funds.html` `.modal-overlay.open` + `.modal` → `.sheet`.
   - `settings.html` `.settings-modal-overlay.open` + `.settings-modal` →
     `.sheet`.
   - `styles.css` fullscreen `#ai-modal` → `.sheet` variant (`.sheet--full`)
     if fullscreen is still needed.
3. Update the JS in each page's app file to toggle the `[open]` attribute
   instead of `.open`/`.active` classes. Keep behavior identical.
4. Close on overlay click + Esc + close button. Animate `transform`/`opacity`
   only.

**Acceptance:**
- [ ] One modal system site-wide.
- [ ] Mobile: modals slide up from the bottom (thumb zone).
- [ ] Desktop: modals center and scale in.
- [ ] Esc + overlay-click close everywhere.
- [ ] Reduced motion: instant open/close.

### Phase 3 gate

- [ ] `npm test` passes.
- [ ] `grep -rn "\.modal-overlay\|\.modal-content\|\.settings-modal\|\.editor-panel" *.html` returns nothing (or only intentional remnants).
- [ ] No per-page `.btn`, `.card`, `.field`, `.modal` redefinition remains.
- [ ] Buttons, cards, fields, modals look consistent across all pages.

---

## Phase 4 — Surface polish (page-by-page)

**Goal:** apply the system to each page's specific surfaces; fix the remaining
smells.

Run these in any order, but do all of them.

### Task 4.1 — `index.html` (glossary)
- Replace the blue hero gradient (`.hero` `radial-gradient(#e0f2fe…)`) with a
  green-tinted neutral or a quiet brand statement (e.g.
  `radial-gradient(at top, var(--accent-soft), var(--bg) 60%)`).
- Chips → 44px tall (Task 3.4).
- Keep "Surprise Me" chip (good).
- Confirm shell + tabbar from Phase 2.

### Task 4.2 — `market.html`
- Tabs (Lens/Screener/Heatmap) → segmented control in `.topbar` or below it.
- Remove `body { padding-bottom: 80px; }` (dead space; tabbar handles it now).
- AI button → `.btn--ai` (accent, no gradient) (Task 3.1).
- Stock-detail modal → `.sheet` (Task 3.5).
- Screener table: keep `overflow-x: auto`; consider sticky first column on
  desktop.

### Task 4.3 — `portfolio.html`
- Inline `.editor-panel` → `.sheet` (Task 3.5).
- Summary card → `.metric` grid (Task 3.4).
- FAB stays (good); ensure it clears the tabbar (z-index + bottom offset
  accounting for `safe-area-inset-bottom`).

### Task 4.4 — `funds.html`
- Redefine `.btn`/`.modal`/`.field` to shared (Tasks 3.1, 3.3, 3.5).
- Executive summary → `.metric` grid.
- Chart.js CDN load stays.

### Task 4.5 — `chat.html`
- Resolve the user-bubble color conflict: `styles.css` `.chat-msg--user` is blue
  (`#e0f2fe`/`#0c4a6e`); `chat.html` `.bubble-user` is accent green. Pick
  **accent green** (brand) for user bubbles; delete the blue `.chat-msg--user`
  rule (it's the older component; `chat.html` uses `.bubble-*`).
- Thinking dots: confirm reduced-motion neutralizes (Task 1.4).
- Keep the drawer→sidebar swap at 960px (good pattern).

### Task 4.6 — `guides.html`
- Wrap article prose in `.prose { max-width: var(--measure); }`.
- Card grid stays (genuinely card-shaped).
- Confirm Inter removed (Task 1.2).

### Task 4.7 — `analyzer.html`
- `.form-field` → `.field` (Task 3.3).
- Keep the `form-hint` links to guides (excellent).
- Hero → shared treatment.

### Task 4.8 — `stock.html`
- Add shell + tabbar (Phase 2).
- Replace inline `style="…"` on the header grid with classes.
- `.btn-ai` → shared (Task 3.1).

### Task 4.9 — `settings.html`
- `.settings-modal` → `.sheet` (Task 3.5).
- Add the **red-up / green-down toggle** (Task 4.11).

### Task 4.10 — `privacy.html`
- Wrap in `.prose`; add shell.

### Task 4.11 — Red-up / green-down toggle
**Files:** `settings.html`, `src/settingsApp.js`, `src/lib/` (new helper),
`styles.css`

**Steps:**
1. Add a Settings control: "Price colors" → Green-up/Red-down (default) |
   Red-up/Green-down.
2. Store preference in `localStorage`.
3. On load, set a `data-color-mode="east-asian"` attribute on `<html>` when the
   East-Asian convention is chosen.
4. In `styles.css`, add:
   ```css
   [data-color-mode="east-asian"] {
     --up: oklch(58% 0.205 27);   /* red */
     --down: oklch(62% 0.165 150); /* green */
   }
   ```
   (swap the semantic values; UI accent green is untouched because it's a
   separate token.)
5. Apply the attribute as early as possible (inline script in `<head>` reading
   localStorage) to avoid a flash.

**Acceptance:**
- [ ] Toggling flips all `.delta` colors site-wide.
- [ ] Brand accent green is unaffected.
- [ ] No flash of the wrong color on load.

### Task 4.12 — Shared loading + empty states
**Files:** `styles.css`, page app files

**Steps:**
1. Define `.skeleton` shimmer in `styles.css` (replace per-page "Loading..."
   text and the glossary's skeleton chips with one component).
2. Define `.empty-state` (icon + heading + action) in `styles.css`.
3. `market.html`: replace indefinite "Loading market data..." with `.skeleton`
   + a real empty/error state.
4. `funds.html`: add empty states to blank lists.
5. `portfolio.html`: already has a good empty state — align it to `.empty-state`.

**Acceptance:**
- [ ] One `.skeleton` and one `.empty-state` component.
- [ ] No bare "Loading..." text remains.

### Phase 4 gate

- [ ] `npm test` passes.
- [ ] No blue hero gradient; no blue-violet AI gradient.
- [ ] Every page uses the shared shell, components, and tokens.
- [ ] Red/green toggle works and persists.

---

## Phase 5 — Verification

**Goal:** prove the system works across the required matrix. No new features.

### Task 5.1 — Viewport gauntlet
Test every page at: **320, 360, 375, 390, 768, 1024, 1440, 2560**.
- No horizontal scroll at any width.
- Tabbar on mobile; siderail on desktop.
- Tables degrade gracefully (scroll or reflow).
- No content under notches/safe areas.

### Task 5.2 — Color, dark-mode, and motion audits
- Run each page through deuteranopia, protanopia, tritanopia simulation.
  `--up`/`--down` must remain distinguishable (they differ in lightness).
- Verify every text/background pair meets WCAG AA in light **and** dark.
- Toggle OS "reduce motion" — confirm zero animation site-wide.
- Toggle the red/green setting — confirm it applies everywhere.

### Task 5.3 — Interaction audit
- Keyboard-tab through every page: focus ring visible on every control.
- Every interactive element ≥44×48px hit area.
- Modals: open/close via keyboard, Esc, overlay click.
- Forms: submit, error, disabled states all styled.

### Task 5.4 — Squint + 5-minute tests
- **Squint test** per page: can you identify the 3 most important things?
- **5-minute use test**: perform the core job on each surface (search a term,
  open a stock, add a portfolio position, add a fund transaction, send a chat
  message, run the analyzer). Every friction point is a bug.

### Task 5.5 — Cleanup sweep
- `grep -rn "style=" *.html` — eliminate remaining inline styles where a class
  exists.
- `grep -rn "#[0-9a-fA-F]\{6\}" styles.css *.html` — no stray hex colors outside
  intentional exceptions.
- Remove dead CSS (classes no longer referenced).
- Confirm `npm test` + a fresh `npm run build` succeed.

### Phase 5 gate (final)

- [ ] All viewport, color, motion, interaction checks pass.
- [ ] `npm test` green.
- [ ] `npm run build` green.
- [ ] No inline styles except genuine one-offs.
- [ ] No hex colors outside documented exceptions.
- [ ] Squint + 5-minute tests reveal no blockers.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Renaming tokens (`--card`→`--surface`) breaks per-page CSS that still references old names. | Keep old names as aliases in `:root` during Phase 1, remove aliases only after Phase 3 grep confirms zero references. |
| Runtime `shell.js` injection causes a flash of un-nav'd content. | Keep a minimal static topbar in HTML; inject only tabbar/footer. Add `<div id="tabbar-mount">` with reserved height to avoid layout shift. |
| Modal migration changes JS toggle API (`class`→`[open]`). | Do one page at a time; test each page's open/close/submit before moving on. |
| OKLCH unsupported in very old browsers. | Target is modern mobile + Chromium-backed Capacitor webview; OKLCH is supported. Add `@supports` fallback to hex only if analytics show need. |
| Bottom tabbar overlaps FABs (portfolio, funds). | Offset FABs above the tabbar: `bottom: calc(var(--s-8) + env(safe-area-inset-bottom))`. |
| East-asian color toggle flashes wrong color on load. | Inline `<head>` script reads localStorage and sets `data-color-mode` before paint. |

---

## Out of scope (explicitly)

- No new features beyond the red/green toggle.
- No framework introduction (React/Vue/Tailwind). Stay vanilla.
- No backend/API changes.
- No data-pipeline changes.
- No content rewrites (copy edits are limited to the footer-heart voice note).
- No new pages.

---

## Definition of done (whole plan)

1. All five phase gates pass.
2. `npm test` and `npm run build` are green.
3. One token set, one type pair, one component library, one shell — verified by
   grep (no per-page redefinitions of tokens or core components).
4. The site passes the viewport gauntlet (320→2560), colorblind + dark +
   reduced-motion audits, and the squint/5-minute tests.
5. The design review doc's §2 findings are each resolved or explicitly
   deferred with a reason.
