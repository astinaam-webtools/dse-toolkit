# DSE Toolkit Autopilot Upgrade Plan (2026-04-19)

## Objective
Ship a cohesive product and design upgrade pass that improves discovery, speed-to-insight, and usability on both the glossary homepage and market dashboard without introducing heavy dependencies.

## Strategy
1. Prioritize features that shorten user path from landing to action.
2. Improve visual quality with reusable styles, less inline styling, and more consistent UI patterns.
3. Preserve current architecture (vanilla HTML/CSS/JS + ES modules), avoid breaking existing navigation and offline behavior.

## Planned Work

### Phase 1: Homepage UX and Discovery
- [x] Add quick-search chips for common investor terms.
- [x] Add recent searches (persisted in localStorage) with one-tap replay.
- [x] Add category chips generated from glossary data to encourage exploration.
- [x] Add keyboard shortcut `/` to focus search input quickly.
- [x] Refactor featured term and market glance rendering to remove inline styles.

### Phase 2: Market Dashboard Workflow Upgrades
- [x] Add quick market filters (Top Gainers, Top Losers, High Volume, Value Picks, Clear).
- [x] Add screener sort control (change, volume, PE, symbol).
- [x] Add a dynamic result summary line so users know active filters/search state.
- [x] Improve bucket card readability by showing criteria/formula inline instead of alert popups.

### Phase 3: Visual + Accessibility Polish
- [x] Add cohesive styles for new chips/toolbars/results blocks and responsive behavior.
- [x] Ensure controls are keyboard-friendly and focus-visible.
- [x] Keep mobile ergonomics strong for sticky controls and tap targets.

### Phase 4: Validation
- [x] Run smoke tests.
- [x] Run project tests.
- [x] Review git diff for coherence and finalize summary.

## Execution Notes
- Work is being implemented on branch: `feat/autopilot-product-design-upgrades`.
- This document will be updated with completed checkboxes as implementation progresses.
