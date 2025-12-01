## Project Snapshot (Dec 2025)

- **Purpose**: DSE Toolkit — mobile-first Dhaka Stock Exchange toolkit combining a glossary, market dashboard, and analyzer; hosted statically (GitHub Pages) with an Android wrapper via Capacitor.
- **Tech stack**: Vanilla HTML/CSS/JS, ES modules (package `type: module`). No bundler.
- **Key files**:
	- `index.html`: entry point. Loads `./src/app.js` and contains hero + search controls.
	- `analyzer.html`: dedicated behaviour analyzer page that reuses the shared script.
	- `market.html`: market dashboard landing (DSE Market view).
	- `stock.html`: single-stock detail view.
	- `styles.css`: Inter font, responsive cards, sticky search bar, `.hl` highlight class.
	- `src/app.js`: Renders cards (when present), runs debounced search, handles analyzer form, registers service worker.
	- `src/marketApp.js`: Bootstraps market dashboard UI.
	- `src/stockDetailApp.js`: Bootstraps stock details view UI.
	- `src/lib/behaviorProfiler.js`: Pure logic that maps input metrics to behaviour buckets.
	- `src/data/terms.js`: Array of term objects (title, shortForm, category, description, whyItMatters, watchFor, tags).
	- `src/lib/filterTerms.js`: `filterTerms`, `tokenize`, `highlightText`, helper utilities (`escapeRegExp`, `escapeHtml`). Category included in search haystack.
	- `guides.html`: Advanced chart reading playbook with anchors for each metric and screenshot placeholders.
	- `manifest.webmanifest`: PWA metadata (name, theme color, icons, start URL).
	- `sw.js`: Service worker that precaches the shell + runtime cache for additional assets.
	- `icons/`: PNG icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) referenced by the manifest and Apple touch icon link.
	- `assets/`: Source images (`icon.png`, `splash.png`, generated assets) and `finalized/` outputs used by Capacitor and the web.
	- `scripts/smoke-test.mjs`: Node smoke tests for search/filter/highlight.
	- `scripts/process_assets.py`: Python image pipeline (uses Pillow + rembg) to produce transparent web icons and Android/Play Store-ready icons and splash.
	- `scripts/sync-android.mjs`: Sync helper to copy web assets into the Android project.
	- `scripts/build-market-data.mjs`: Builds aggregated market JSON from CSV snapshots.

## Current Behavior

- Search input filters as user types (debounced 180 ms) and highlights matched tokens with `<mark class="hl">`.
- Empty search renders full dataset; no frameworks, so keep DOM operations simple.
- Terms already cover valuation, profitability, governance, DSE-specific rules. Preserve schema when adding entries.
- Terms can optionally include `chartGuideId` to surface “How to read this on charts” links into `guides.html` anchors.
- Service worker precaches `index.html`, `guides.html`, styles, JS modules, manifest, favicon, and icons so the glossary loads offline; bump `CACHE_NAME` when changing cached assets.
- Analyzer form (now on `analyzer.html`) collects key metrics and calls `analyzeStock` to output behaviour buckets with timing guidance.

- Market pages (`market.html`, `stock.html`) render using `marketApp.js`/`stockDetailApp.js` and data from `src/data/dse-market.json`.
- PWA icons now use transparent backgrounds; Android icons use solid `#0f172a` background (adaptive icon foreground is generated via Capacitor).

## Branding

- App name: "DSE Toolkit" (updated across Android `strings.xml`, `capacitor.config.json`, PWA `manifest.webmanifest`, and HTML titles).
- Theme colors: `theme_color` `#0f9d58` (emerald), background `#0f172a` (dark slate).
- Icons: Option 1 selected from AI-generated set; processed to remove background for web and filled for Android/Play Store.

## Engineering Conventions

- Use ES modules everywhere; no CommonJS imports.
- Keep assets referenced via **relative paths** (`./src/...`) so Pages works from any subpath.
- Prefer semantic HTML, accessible labels (`aria-live`, `sr-only`).
- Style additions should remain mobile-first (grid auto-fit, clamp fonts, sticky controls).
- Avoid adding heavy dependencies; if absolutely needed, justify and document in README and package.json.
- Maintain manifest & icon consistency when branding or theme colors change.
- Register/update service worker logic cautiously; remember to `self.skipWaiting()`/`clients.claim()` patterns already applied.
- Keep analyzer logic pure and parameterized in `src/lib/behaviorProfiler.js` so tests or future data inputs can reuse it.

- For images, prefer using `scripts/process_assets.py` rather than manual edits. Web icons must be transparent; Android icons are filled.
- When changing cached assets, update `CACHE_NAME` in `sw.js` and verify offline behavior.

## Testing & Validation

- Run `npm test` to execute `scripts/smoke-test.mjs` after changing search or analyzer logic.
- For manual QA, serve with `python3 -m http.server 8000` and verify search/highlighting on real devices.
- Validate PWA behavior with Chrome DevTools → Application tab (manifest + service worker) and toggle offline mode.

- Market data QA: run `npm run build:data` after updating CSVs under `data/dse/` and inspect `src/data/dse-market.json`.
- Android asset QA: run `npx capacitor-assets generate --android` after updating `assets/icon.png` and `assets/splash.png`.

## Deployment Notes

- GitHub Pages deployment: push to repo ➜ Settings → Pages ➜ Source "Deploy from a branch" ➜ Branch `main`, folder `/ (root)`.
- Live URL format: `https://<user>.github.io/<repo>/`.
- Ensure new assets remain inside repo root or reference them relatively; Pages has no build step.

- Android: `npx cap sync android` after asset or name changes, then open Android Studio via `npx cap open android`.
- Feature graphic for Play Store is generated at `assets/finalized/Common/feature_graphic.png`.

## Roadmap Hints

- Possible near-term tasks: tag filters, fuzzy search, more Bangladeshi-specific guidance, contributions form, accessibility audit.
- Document any new data schema fields in `README.md` + this file.

- Add quick filters for categories/tags on `market.html`.
- Expand analyzer with more behavior buckets and chart hints.
- Add unit tests for `marketLogic.js`.

## Asset Workflow

- Source images go in `assets/` (`Generated_icon_1.png`, etc.).
- Run Python pipeline:
	- `source .venv/bin/activate && python3 scripts/process_assets.py`
	- Outputs to `assets/finalized/Option1` and `Option2`, plus `Common` for splash/feature graphic.
- Apply Option 1 selections:
	- Copy web icons: `pwa_icon_192.png` → `icons/icon-192.png`, `pwa_icon_512.png` → `icons/icon-512.png`, `apple-touch-icon.png` → `icons/apple-touch-icon.png`, `favicon.png` → `favicon.png`.
	- Copy Capacitor sources: `capacitor_icon.png` → `assets/icon.png`, `capacitor_splash.png` → `assets/splash.png`.
	- Generate Android resources: `npm i -D @capacitor/assets && npx capacitor-assets generate --android`.

