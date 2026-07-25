# DSE Toolkit — Design Review & Proposed Direction

> A comprehensive, mobile-first design audit of the current site and a proposed
> cohesive design system to take it from "collection of pages" to "one product".
>
> Scope: all 10 pages (`index`, `market`, `portfolio`, `funds`, `chat`, `guides`,
> `analyzer`, `stock`, `settings`, `privacy`), the shared `styles.css`, and the
> per-page `<style>` blocks.
>
> Register: **Product** (app UI, dashboards, tools) with light **Brand** moments
> on the glossary/guide heroes.

---

## 1. Executive summary

DSE Toolkit is a vanilla-JS PWA for Dhaka Stock Exchange investors: a glossary,
a market dashboard, stock + mutual-fund portfolio trackers, an AI analyst chat,
a chart playbook, and a behaviour analyzer. The feature set is strong and the
mobile-first intent is genuine.

The design problem is **not any single page** — it is **coherence**. The site is
ten pages that each ship their own `<style>` block redefining the same primitives
(buttons, cards, modals, form fields, summary cards, up/down colors) in
incompatible ways. The result:

- **Three different font stacks** load across pages (Manrope+Sora, Inter, system).
- **Two different greens** act as the accent (`#0f9d58` vs `#10b981`).
- **Four different modal systems** (`.modal-overlay.open`, `.modal.active`,
  `.settings-modal-overlay.open`, fullscreen `#ai-modal`).
- **Buttons render differently per page** (pill `999px` on the glossary,
  `10px` rectangles on funds).
- **Border-radius ranges from 4px to 999px** with no scale.
- **A blue-violet AI gradient** (`#6366f1→#8b5cf6`) — the generic tech hue —
  clashes with a green brand.
- **No `prefers-reduced-motion`** anywhere, despite several looping animations.
- **No bottom tab bar** for a 5-section mobile app; navigation is a wrapping
  top bar that is itself duplicated and inconsistent across pages.

**The proposed direction:** consolidate every page behind one token-driven design
system, introduce a mobile-first **bottom tab bar** (the Thumb Zone), separate
the **brand accent** from **semantic up/down data colors**, replace the
blue-violet AI gradient with an on-brand treatment, and unify modals, buttons,
cards, and form fields into shared components. Everything below is concrete and
implementable in the existing vanilla-CSS stack — no framework required.

---

## 2. Current-state review by discipline

Severity key: 🔴 blocker · 🟠 high · 🟡 medium · 🔵 polish

### 2.1 Color — 🟠 high

| Issue | Detail |
|---|---|
| Two accent greens | `--accent: #0f9d58` (brand) vs `--color-up: #10b981` (data). Close but not equal, so the brand and "price up" blur together. When green means *both* "primary action" and "gain", neither reads cleanly. |
| Off-brand AI gradient | `market.html` `.btn-ai` uses `linear-gradient(135deg, #6366f1, #8b5cf6)` — indigo→violet. This is the textbook generic-tech CTA and it fights the green identity. |
| Disconnected hero | The glossary hero uses a **blue** radial gradient (`#e0f2fe → #eff6ff`). Blue has no role in this brand; it reads like a leftover from a template. |
| Inconsistent chat bubbles | `styles.css` colors user bubbles light blue (`#e0f2fe` / `#0c4a6e`); `chat.html` colors them brand green. Two truths for the same component. |
| Hex, not OKLCH | All colors are hex/sRGB. Equal lightness steps do not look equal; dark-mode neutrals go muddy. |
| Untinted neutrals | Grays are pure slate (`#0f172a`, `#475569`). A trace of green chroma would make surfaces feel authored. |
| Re-declared tokens | `--color-up/down/neutral` are redefined inside a `<style>` block on `market`, `portfolio`, and `funds` instead of once in `:root`. |

### 2.2 Typography — 🟠 high

| Issue | Detail |
|---|---|
| Three font loads | `styles.css` imports **Manrope + Sora**; `index`, `guides`, `stock` load **Inter**. A user moving glossary → market sees the typeface change. |
| No type scale | Sizes are ad hoc (`0.7rem`, `0.72rem`, `0.75rem`, `0.78rem`, `0.8rem`, `0.875rem`, `0.9rem`, `0.95rem`, `1rem`, `1.1rem`, `1.25rem`, `1.5rem`, `1.75rem`, `2rem`, `clamp(2rem,4vw,3rem)`). No ratio, no rhythm. |
| No measure control | Long-form prose in `guides.html` has no `max-width` / measure; paragraphs run edge-to-edge on desktop. |
| Flat hierarchy | Card titles (`1.1rem`) sit too close to body (`0.95rem`); the 1.3× minimum step is not enforced. |
| Dark-mode compensation missing | Light-on-dark text uses the same weights/line-heights as light mode; it reads thinner and tighter than intended. |

### 2.3 Layout & composition — 🟠 high

| Issue | Detail |
|---|---|
| No shared shell | `index.html` has **no nav bar** (it uses hero action buttons instead); every other page has a top `.nav-bar`; `stock.html` has only a `back-nav`. Three different navigation models. |
| Footer duplicated 6× | The entire footer (SVGs, links, badges) is copy-pasted verbatim across pages. A change means six edits. |
| Nav links inconsistent | `market/portfolio/funds/settings` show a **Settings** link; `guides/analyzer/stock/chat` omit it. |
| Inline styles everywhere | `market`, `portfolio`, `funds`, `stock` are littered with `style="..."` (e.g. `style="text-align:right"` on every `<th>`). Hard to maintain, impossible to theme. |
| Cards as default | Most pages reach for cards by reflex. The glossary term grid and market buckets are genuinely card-shaped (fine), but stacked summary cards inside cards and full-width "section" cards suggest an unchosen layout. |
| Dead space | `market.html` sets `padding-bottom: 80px` "for bottom nav if we add one" — there is no bottom nav, so it's just dead margin. |

### 2.4 Responsive & mobile — 🟠 high (this is the core ask)

| Issue | Detail |
|---|---|
| No bottom tab bar | A 5-section mobile app (Market / Stocks / Funds / AI / Settings) navigates via a **wrapping top bar**. On phones the links wrap to a second row and shrink to `0.8rem`. This ignores the Thumb Zone — primary destinations should live in the bottom 25%. |
| Touch targets too small | Chips are `0.3rem 0.72rem` (~26px tall), nav links are text-only. Below the 44×44px minimum. |
| `viewport-fit=cover` only on `chat` | Safe-area insets are only respected on one page. Notch devices get content under the status bar elsewhere. |
| Inconsistent safe-area handling | `.safe-top-spacer` exists but is applied inconsistently; bottom insets are ignored except in `chat.html`'s composer. |
| No `pointer: coarse` / `hover: hover` gating | Hover lifts (`translateY(-1px)`) fire on touch devices where there is no hover, causing sticky states. |
| Tables on mobile | The screener table relies on `overflow-x: auto` — acceptable, but no progressive disclosure (it just scrolls). |
| Breakpoints scattered | Each page invents its own (`600px`, `640px`, `720px`, `820px`, `960px`, `1024px`, `1200px`). No shared scale. |

### 2.5 Motion — 🟡 medium

| Issue | Detail |
|---|---|
| No `prefers-reduced-motion` | The footer heart **beats forever** (`heartbeat 1.5s infinite`), thinking dots pulse, views fade. None respect the OS reduced-motion setting. The skill is explicit: this is not optional. |
| Flat opacity transitions | View changes use plain `opacity`/`translateY` fades — no overshoot, no stagger. Reads as mechanical. |
| Permanent heartbeat | The "❤️" in the footer animates on every page, on every load. Distracting and slightly desperate. |
| No motion vocabulary | Durations and easings are ad hoc (`0.14s`, `0.15s`, `0.2s`, `0.22s`, `0.3s`). No shared curve set. |

### 2.6 Interaction & states — 🟡 medium

| Issue | Detail |
|---|---|
| Four modal systems | `market` (`.modal-overlay.open`, bottom-sheet→centered), `portfolio` (`.modal.active` + an inline `.editor-panel`), `funds` (`.modal-overlay.open` with scale), `settings` (`.settings-modal-overlay.open`). Different markup, different animations, different close behavior. |
| Inconsistent focus | Search and chips have good `:focus-visible` rings; many buttons/links rely on browser defaults or nothing. |
| Loading states vary | "Loading..." text, skeleton chips on the glossary, spinner dots on chat — no shared loading language. |
| Empty states partial | `portfolio` has a real empty state ("Tap the + button…"); `market` shows "Loading market data..." indefinitely on failure; `funds` lists are blank. |
| Undo vs confirm | Deletes use confirm dialogs (fine for financial data), but there's no undo for non-destructive edits. |

### 2.7 Voice & copy — 🔵 polish

- Mostly solid: sentence case, one-verb buttons, helpful hints in the analyzer.
- Emoji-as-icon is inconsistent: footer/nav links use 📖📊💼📈🛡️ while other
  links use inline SVG. Pick one icon vocabulary.
- "Made with ❤️ in Bangladesh" + heartbeat is a generic reflex; the
  educational-only disclaimer beneath it is the more valuable line.
- A few "→" arrows on buttons are nice and directional; keep that consistent.

### 2.8 Consistency & system — 🔴 blocker

This is the root cause behind most issues above.

- **No component layer.** `.btn`, `.card`, `.modal`, `.form-field`, `.summary-card`
  are redefined per page with different radius/padding/shadow. The same class
  name means different things on different pages.
- **No token layer.** Spacing, radius, shadow, and (effectively) color are
  hardcoded per use site. A redesign today means hundreds of edits.
- **Radius chaos:** 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 999px.
- **Shadow chaos:** at least 5 distinct shadow definitions.
- **Duplication:** footer ×6, nav ×9, up/down tokens ×4, modal CSS ×4.

### 2.9 AI-tell sniff test — 🟡 medium

A two-second glance would not scream "AI" — the green identity and real domain
content (DSE terms, Bangla-taka formatting) save it. But three tells leak:
the **blue-violet AI gradient**, the **blue hero gradient** on an otherwise
green product, and the **centered eyebrow→h1→lead→button-pile hero** that is
the default reflex. None are fatal; all are worth replacing with deliberate
choices.

---

## 3. Proposed design direction

### 3.1 The scene sentence

> A calm, data-dense investing workbench for the Bangladeshi investor — green
> and grounded, readable in sunlight, operable with one thumb, trustworthy
> enough to track real money.

That sentence drives every decision below. The product is an **instrument**
(register: Product), so it earns trust through **consistency and speed**, not
through decoration. Operators open it daily; they should move without thinking.

### 3.2 Commitment level: Whisper

Product UI default. Near-neutral surfaces, **one** role color (brand green)
doing the work, kept rare enough to mean something. The accent appears only on
primary actions, active states, and links — never as background wash across the
page. Reserved **Statement** moments: the glossary hero and the AI analyst
surface may carry a touch more brand presence.

### 3.3 The brand-vs-data color decision

Today, green is both the brand accent and the "price up" color, so they cancel
each other's meaning. **Recommendation:**

- **Brand accent (green)** → UI only: primary buttons, active tab, links, focus.
- **Semantic data colors** → values only: price up/down, P/L, heatmap tiles.
- Make the two greens **visibly distinct**: brand = a deeper, slightly teal
  green; "up" = a brighter emerald. A button is never mistaken for a gain.
- Keep **red** for "down" (DSE convention: green up / red down).
- Provide a **red-up / green-down toggle** in Settings for users who want the
  East-Asian convention — cheap to add, genuinely useful.

---

## 4. Design tokens

All colors in **OKLCH** (calibrated to human vision; equal lightness steps look
equal). Replace the hex `:root` in `styles.css` with this single source of truth
and **delete** every per-page redeclaration of `--color-up/down/neutral`.

### 4.1 Color

```css
:root {
  color-scheme: light dark;

  /* Surfaces — neutrals tinted ~0.01 chroma toward brand hue 155 */
  --bg:           oklch(98.4% 0.008 155);
  --surface:      oklch(100% 0 0);
  --surface-2:    oklch(96.5% 0.010 155);   /* subtle raised */
  --surface-sunk: oklch(94.5% 0.012 155);   /* inputs, wells */

  /* Text */
  --text:         oklch(24% 0.025 160);
  --text-muted:   oklch(50% 0.020 160);
  --text-faint:   oklch(62% 0.015 160);

  /* Lines */
  --border:       oklch(24% 0.020 160 / 0.10);
  --border-strong:oklch(24% 0.020 160 / 0.18);

  /* Brand accent — deeper, slightly teal green (UI only) */
  --accent:       oklch(55% 0.118 158);
  --accent-hover: oklch(50% 0.120 158);
  --accent-press: oklch(46% 0.118 158);
  --accent-soft:  oklch(55% 0.118 158 / 0.12); /* tint backgrounds */
  --accent-contrast: oklch(99% 0.005 155);

  /* Semantic data colors (values only) */
  --up:           oklch(62% 0.165 150);      /* emerald — brighter than brand */
  --up-soft:      oklch(62% 0.165 150 / 0.12);
  --down:         oklch(58% 0.205 27);       /* red */
  --down-soft:    oklch(58% 0.205 27 / 0.12);
  --neutral:      oklch(60% 0.010 160);

  /* Status */
  --warning:      oklch(72% 0.150 75);
  --warning-soft: oklch(72% 0.150 75 / 0.14);

  /* Effects */
  --shadow-1: 0 1px 2px oklch(24% 0.02 160 / 0.06);
  --shadow-2: 0 4px 12px oklch(24% 0.02 160 / 0.08);
  --shadow-3: 0 12px 32px oklch(24% 0.02 160 / 0.12);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg:           oklch(20% 0.012 160);
    --surface:      oklch(25% 0.014 160);
    --surface-2:    oklch(28% 0.015 160);
    --surface-sunk: oklch(22% 0.013 160);
    --text:         oklch(94% 0.008 155);
    --text-muted:   oklch(72% 0.012 160);
    --text-faint:   oklch(60% 0.010 160);
    --border:       oklch(100% 0 0 / 0.10);
    --border-strong:oklch(100% 0 0 / 0.18);
    --accent:       oklch(68% 0.130 155);
    --accent-hover: oklch(72% 0.132 155);
    --accent-soft:  oklch(68% 0.130 155 / 0.18);
    --shadow-1: 0 1px 2px oklch(0% 0 0 / 0.4);
    --shadow-2: 0 4px 14px oklch(0% 0 0 / 0.5);
    --shadow-3: 0 16px 40px oklch(0% 0 0 / 0.6);
  }
}
```

**Contrast notes:** `--text` on `--bg` clears WCAG AA at all sizes; `--text-muted`
on `--surface` passes AA for ≥14px. `--accent` on white passes AA for ≥18px bold
and large UI — use `--accent-contrast` text on `--accent` fills. Run the
deuteranopia/protanopia simulation on `--up`/`--down`: they differ in lightness
(62% vs 58%) as well as hue, so they remain distinguishable for red-green
colorblind users. Keep that lightness gap.

### 4.2 Typography

**One family pair, loaded once.** Keep **Manrope** (UI/body) + **Sora**
(display/headings) — they already live in `styles.css`. **Remove the Inter
`<link>` from `index`, `guides`, and `stock`.** System-ui remains the
legitimate fallback.

```css
:root {
  --font-body:    'Manrope', system-ui, -apple-system, sans-serif;
  --font-display: 'Sora', 'Manrope', system-ui, sans-serif;
  --font-mono:    ui-monospace, 'SF Mono', Menlo, monospace;

  /* 1.25 ratio scale, rooted at 16px */
  --fs-xs:   0.75rem;   /* 12 — labels, meta */
  --fs-sm:   0.875rem;  /* 14 — secondary text */
  --fs-base: 1rem;      /* 16 — body */
  --fs-md:   1.125rem;  /* 18 — lead */
  --fs-lg:   1.5rem;    /* 24 — card titles */
  --fs-xl:   2rem;      /* 32 — page titles */
  --fs-2xl:  clamp(2rem, 4.5vw, 3rem); /* hero */

  --lh-tight: 1.2;
  --lh-snug:  1.35;
  --lh-base:  1.6;
  --lh-loose: 1.7;       /* dark mode body gets +0.1 */

  --measure: 68ch;       /* prose max-width */
}
```

Rules:
- Headings use `--font-display`; everything else `--font-body`.
- Numeric data (prices, P/L, NAV) gets `font-variant-numeric: tabular-nums` so
  columns align. Already partially used — make it universal on `.value`,
  `.price`, `.metric-value`, `.summary-value`.
- Dark mode: bump body `line-height` by 0.1 and add `letter-spacing: 0.01em` to
  compensate for light-on-dark optical thinning.
- Long-form (`guides.html`): wrap prose in `.prose { max-width: var(--measure); }`.

### 4.3 Spacing — the 1-4-9 rhythm

Every gap, padding, and margin is a multiple of 4px. No in-betweens.

```css
:root {
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 20px;
  --s-6: 24px;
  --s-8: 32px;
  --s-9: 36px;
  --s-12: 48px;
  --s-16: 64px;
}
```

### 4.4 Radius — a 4-step scale

```css
:root {
  --r-sm: 8px;    /* inputs, chips, small badges */
  --r-md: 12px;   /* cards, list items */
  --r-lg: 16px;   /* panels, summary cards */
  --r-xl: 24px;   /* modals, bottom sheets */
  --r-pill: 999px;
}
```

Replace every ad-hoc radius with one of these. Buttons become `--r-sm` (not
pills, not 10px) for a consistent, calmer product feel — pills stay available
for chips and the FAB only.

### 4.5 Motion

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);   /* expo out — UI */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* subtle overshoot */
  --dur-1: 120ms;  /* hover, press */
  --dur-2: 200ms;  /* standard */
  --dur-3: 320ms;  /* entrance, sheet */
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- **Kill the permanent footer heartbeat.** It animates on every page load forever.
- Entrance: optional 3-beat (scale 0.96→1.02→1, opacity 0→0.8→1 over 250ms) for
  cards/lists, gated behind reduced-motion.
- Exits run at ~70% of entrance.
- Animate `transform` and `opacity` only.

---

## 5. Layout & navigation (mobile-first)

### 5.1 The bottom tab bar — the single biggest win

A 5-section app belongs on a **bottom tab bar**, not a wrapping top bar. This is
the Thumb Zone: the bottom 25% of the screen is reachable with one hand.

```
┌─────────────────────────────────────┐
│  [top bar: page title · status]     │   ← slim, contextual
│                                     │
│         page content                │
│                                     │
├─────────────────────────────────────┤
│  Market  Stocks  Funds  AI  More    │   ← bottom tab bar, 5 slots
└─────────────────────────────────────┘
```

Spec:
- Fixed to bottom, `padding-bottom: env(safe-area-inset-bottom)`.
- Each tab ≥ 48×48px hit area, 24px icon + 10px label.
- Active tab: `--accent` icon/label + a 3px top accent bar (not a pill fill —
  keeps the accent rare).
- "More" opens a sheet with Settings, Guides, Analyzer, Privacy, GitHub.
- Hidden on `≥960px` desktop, replaced by a left rail or top nav (see 5.4).
- The glossary (`index.html`) is the **home** tab; it currently has no nav at
  all — give it the bar so every page shares one shell.

This replaces the duplicated `.nav-bar` on every page and the dead
`padding-bottom: 80px` on `market.html` (which already reserved space for it).

### 5.2 Shared page shell

One structure for every page, so the footer/nav are defined **once** (inject via
a tiny `src/shell.js` or a build-time include — the project already has a
`scripts/build.mjs`):

```
<body>
  <header class="topbar"> … </header>      <!-- page title + contextual actions -->
  <main class="page"> … </main>            <!-- max-width container -->
  <nav class="tabbar"> … </nav>            <!-- bottom tabs (mobile) -->
  <footer class="site-footer"> … </footer> <!-- defined once -->
</body>
```

- `.page` container: `max-width: 720px` for reading surfaces (glossary, guides,
  analyzer, settings), `max-width: 1100px` for data surfaces (market, portfolio,
  funds). Centered with `padding: var(--s-4)`.
- `viewport-fit=cover` on **every** page (today only `chat` has it).
- `.safe-top-spacer` applied uniformly via the shell.

### 5.3 Responsive breakpoints (shared scale)

```css
/* mobile-first: base styles target 360px */
@media (min-width: 480px)  { /* large phone / small tablet portrait */ }
@media (min-width: 768px)  { /* tablet */ }
@media (min-width: 1024px) { /* laptop — tab bar → side rail */ }
@media (min-width: 1440px) { /* desktop */ }
```

Test gauntlet (non-negotiable): **320, 360, 375, 390, 768, 1024, 1440, 2560**.

### 5.4 Desktop adaptation

At `≥1024px`, the bottom tab bar becomes a **left sidebar rail** (icon + label,
vertical). Data surfaces (market screener, portfolio) expand to multi-column;
reading surfaces stay measure-constrained. The chat page already does a nice
drawer→sidebar swap at 960px — generalize that pattern.

### 5.5 Input-mode detection

```css
@media (hover: none) and (pointer: coarse) {
  /* disable hover lifts; enlarge touch targets to 48px */
  .btn:hover { transform: none; }
}
```

Stops the sticky hover-lift on touch devices.

---

## 6. Component system (define once, use everywhere)

Move all of these into `styles.css` and **delete** the per-page redefinitions.
Every component below replaces 2–4 incompatible versions that exist today.

### 6.1 Button

One `.btn` with modifiers — not five different radii.

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--s-2);
  min-height: 44px; padding: 0 var(--s-4);
  border: 1px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface); color: var(--text);
  font: 600 var(--fs-sm)/1 var(--font-body);
  transition: transform var(--dur-1) var(--ease-out), background var(--dur-1);
}
.btn--primary { background: var(--accent); color: var(--accent-contrast); border-color: transparent; }
.btn--primary:hover { background: var(--accent-hover); }
.btn--ghost   { background: transparent; }
.btn--danger  { background: var(--down); color: #fff; border-color: transparent; }
.btn:active   { transform: scale(0.98); }
.btn:focus-visible { outline: 3px solid var(--accent-soft); outline-offset: 2px; }
```

### 6.2 Card / panel

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--s-4);
  box-shadow: var(--shadow-1);
}
```

No shadow on every card by default — `--shadow-1` is barely-there. Reserve
`--shadow-2/3` for elevated surfaces (modals, FAB, sticky headers).

### 6.3 Modal — one system, bottom-sheet on mobile

Replace all four modal systems with one. Mobile = bottom sheet (thumb-reachable,
animates up from the edge closest to the trigger); desktop = centered dialog.

```css
.sheet-overlay { position: fixed; inset: 0; background: oklch(0% 0 0 / 0.5);
  display: grid; place-items: end center; z-index: 1000; opacity: 0;
  transition: opacity var(--dur-2); }
.sheet-overlay[open] { opacity: 1; }
.sheet { width: 100%; max-width: 520px; background: var(--surface);
  border-radius: var(--r-xl) var(--r-xl) 0 0; padding: var(--s-6);
  padding-bottom: calc(var(--s-6) + env(safe-area-inset-bottom));
  transform: translateY(100%); transition: transform var(--dur-3) var(--ease-out); }
.sheet-overlay[open] .sheet { transform: translateY(0); }
@media (min-width: 768px) {
  .sheet-overlay { place-items: center; }
  .sheet { border-radius: var(--r-xl); transform: scale(0.96); }
  .sheet-overlay[open] .sheet { transform: scale(1); }
}
```

### 6.4 Form field

One `.field` with visible label (never placeholder-as-label), 44px input height,
consistent focus ring (`0 0 0 3px var(--accent-soft)`).

### 6.5 Data primitives

- `.metric` — label over tabular-num value, used by market/portfolio/funds.
- `.delta.up` / `.delta.down` — semantic color **only** on values, never on UI.
- `.skeleton` — shared shimmer (replace the per-page "Loading..." text).
- `.chip` — 44px-tall, `--r-pill`, used for filters and quick terms.

### 6.6 Status pill

Unify the nav-server-pill, settings-badge, and market-status-dot into one
`.status-pill` with `is-connected / is-warning / is-down / is-neutral` states.

---

## 7. Page-by-page recommendations

| Page | Priority changes |
|---|---|
| **index (glossary)** | Add the shared shell + bottom tab bar. Replace the blue hero gradient with a green-tinted neutral or a quiet brand statement. Drop the Inter font link. Make chips 44px. The "Surprise Me" chip is great — keep it. |
| **market** | Tabs (Lens/Screener/Heatmap) move into the topbar or a segmented control; bottom tab bar handles section nav. Replace the blue-violet AI button with `--primary`. Remove the dead `padding-bottom:80px`. Unify the stock-detail bottom sheet with the shared `.sheet`. |
| **portfolio** | The inline `.editor-panel` (dark gradient card on a light page) is jarring — restyle to the shared `.sheet`/`.card`. FAB stays (good). Summary card → shared `.metric` grid. |
| **funds** | Redefine `.btn`/`.modal`/`.field` to the shared set (currently overrides radius to 10px). The Chart.js CDN load is fine. Executive summary → `.metric` grid. |
| **chat** | Already the most polished page. Align user-bubble color to brand (resolve the styles.css blue vs chat.html green conflict). Keep the drawer→sidebar swap. Add reduced-motion to thinking dots. |
| **guides** | Wrap prose in `.prose` (measure). Drop Inter. Add the shell. The card grid is appropriate here (genuinely card-shaped entries). |
| **analyzer** | Good form structure; adopt shared `.field`. The `form-hint` links to guides are excellent — keep. |
| **stock** | Add the shell (currently only a back-nav). Replace inline `style="..."` on the header grid with classes. |
| **settings** | Already clean. Fold the bespoke `.settings-modal` into the shared `.sheet`. |
| **privacy** | Wrap in `.prose`; add shell. |

---

## 8. Accessibility checklist (to enforce)

- [ ] Every interactive element ≥ 44×44px hit area (expand with `::before` if needed).
- [ ] Visible `:focus-visible` ring on everything (3px, 3:1 contrast).
- [ ] `prefers-reduced-motion` respected site-wide.
- [ ] `prefers-color-scheme: dark` tokens verified for AA contrast.
- [ ] Colorblind-safe: `--up`/`--down` differ in lightness, not just hue.
- [ ] `viewport-fit=cover` + `env(safe-area-inset-*)` on every page.
- [ ] Labels visible on all form fields (no placeholder-only labels).
- [ ] `aria-live` on dynamic regions (search results, chat feed, market status) — partially done, make consistent.

---

## 9. Implementation roadmap

The project is vanilla JS with a `scripts/build.mjs` — no migration needed, just
discipline. Sequence the work so each phase ships independently.

**Phase 1 — Foundation (unblocks everything)**
1. Replace `:root` color tokens with the OKLCH set; delete per-page
   `--color-up/down/neutral` redeclarations.
2. Unify typography to Manrope+Sora; remove Inter links from 3 pages.
3. Add the spacing/radius/motion token scales.
4. Add the global `prefers-reduced-motion` block; kill the footer heartbeat.

**Phase 2 — Shell & navigation**
5. Build the shared page shell + bottom tab bar (mobile) / side rail (desktop).
6. De-duplicate the footer and nav into one include (build step or `shell.js`).
7. Apply `viewport-fit=cover` + safe-area spacers everywhere.

**Phase 3 — Component unification**
8. Migrate `.btn`, `.card`, `.field`, `.metric`, `.chip`, `.status-pill` to the
   shared definitions; remove per-page overrides.
9. Collapse the four modal systems into one `.sheet`.

**Phase 4 — Surface polish**
10. Page-by-page pass (table in §7): hero gradient, AI button color, prose
    measure, inline-style cleanup.
11. Add shared `.skeleton` loading + consistent empty states.
12. Add the red-up/green-down toggle in Settings.

**Phase 5 — Verification**
13. Run the viewport gauntlet (320→2560).
14. Run colorblind + dark-mode + reduced-motion audits.
15. Squint test + 5-minute use test on each surface.

---

## 10. TL;DR

The features are right; the **system is missing**. Ten pages each reinvent
buttons, cards, modals, colors, and fonts, so the product feels like ten small
apps instead of one. Fix the foundation first — **one OKLCH token set, one type
pair, one spacing/radius/motion scale, one shell with a bottom tab bar, one
component library** — and the rest is straightforward surface work. The highest-
leverage single change is the **mobile bottom tab bar**: it turns a wrapping,
duplicated top nav into a thumb-reachable constant across every page, and it
matches the mobile-first promise the product already makes.
