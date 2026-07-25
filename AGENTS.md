# AGENTS.md

Rules for agents working on this site. Read all. Follow all.

## Read first

- `.commandcode/taste/taste.md` — learned preferences. Always.
- `docs/DESIGN_REVIEW_AND_DIRECTION.md` — design rationale. Read before design work.

## Stack

- Vanilla JS. ES modules. No bundler. No framework. Do not add one.
- Static PWA. Capacitor wraps for Android.
- One stylesheet: `styles.css`. Per-page `<style>` only for page-specific layout. Never redefine tokens or core components there.

## Design rules

- Use the tokens and components already in `styles.css`. Do not invent per-page forks of `.btn`, `.card`, `.field`, `.modal`, etc. Extend with a modifier if needed.
- One source of truth for colors, spacing, radius, motion. If you need a value, add a token — do not hardcode.
- One font pair: Manrope (body) + Sora (display). Do not load other fonts.
- Match the existing visual language. Do not introduce clashing colors or gradients.

## Mobile-first rules

- Design for 360px first. Then adapt up. Not the reverse.
- Bottom tab bar is primary nav on mobile. Side rail on desktop (≥1024px).
- Touch targets ≥44×44px. Always. Expand with `::before` if the visual is smaller.
- `viewport-fit=cover` on every page. Respect `env(safe-area-inset-*)`.
- `@media (hover: none) and (pointer: coarse)` — disable hover lifts on touch.
- Test widths: 320, 360, 375, 390, 768, 1024, 1440, 2560. All must work. No horizontal scroll.

## Motion rules

- `prefers-reduced-motion` is global and non-negotiable. Every animation must stop when the OS asks.
- No infinite loops on page load. No heartbeat. No permanent pulse.
- Animate `transform` and `opacity` only. Never animate `width`/`height`/`top`.
- Exits run at 70% of entrance duration.

## Accessibility rules

- Visible `:focus-visible` ring on every interactive element. Never `outline: none` without replacement.
- Labels are visible. Placeholders are not labels.
- Status colors must differ in lightness, not just hue. Colorblind users must tell them apart.
- Dark mode is not an afterthought. Verify AA contrast in both schemes.

## Code rules

- No inline `style="..."` when a class exists. Add a class instead.
- No commented-out code. No `_unused` shims. Delete what you replace.
- No new dependencies unless a task explicitly calls for it.
- Follow existing patterns. Match the code style around you.
- Run `npm test` before declaring done. Fix failures. Do not leave broken code.

## Shell and duplication

- Footer and tabbar come from `src/shell.js`. Do not paste a `<footer>` into a page. Do not paste a `<nav class="nav-bar">`.
- If you add a page, it gets: `viewport-fit=cover`, `#tabbar-mount`, `#footer-mount`, `src/shell.js`, the shared `<head>` links. No exceptions.

## Before you ship

- [ ] Read the docs in `docs/`.
- [ ] Used existing tokens and components, not literals or forks.
- [ ] Mobile-first. Tested narrow widths.
- [ ] Reduced-motion respected.
- [ ] Focus rings visible.
- [ ] No duplicated footer/nav.
- [ ] `npm test` green.

If unsure, re-read the design review. It has the reasoning.
