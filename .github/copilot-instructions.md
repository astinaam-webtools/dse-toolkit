## Project snapshot (Nov 2025)

- **Purpose**: Mobile-first Dhaka Stock Exchange glossary for long-term value investors; hosted statically (GitHub Pages).
- **Tech stack**: Vanilla HTML/CSS/JS, ES modules (package `type: module`). No bundler.
- **Key files**:
	- `index.html`: entry point. Loads `./src/app.js` and contains hero + search controls.
	- `styles.css`: Inter font, responsive cards, sticky search bar, `.hl` highlight class.
	- `src/app.js`: Renders cards, runs debounced search, uses highlight + Escape-to-clear.
	- `src/data/terms.js`: Array of term objects (title, shortForm, category, description, whyItMatters, watchFor, tags).
	- `src/lib/filterTerms.js`: `filterTerms`, `tokenize`, `highlightText`, helper utilities (`escapeRegExp`, `escapeHtml`). Category included in search haystack.
	- `manifest.webmanifest`: PWA metadata (name, theme color, icons, start URL).
	- `sw.js`: Service worker that precaches the shell + runtime cache for additional assets.
	- `icons/`: PNG icons (192 & 512) referenced by the manifest and Apple touch icon link.
	- `scripts/smoke-test.mjs`: Node smoke tests for search/filter/highlight.

## Current behavior

- Search input filters as user types (debounced 180 ms) and highlights matched tokens with `<mark class="hl">`.
- Empty search renders full dataset; no frameworks, so keep DOM operations simple.
- Terms already cover valuation, profitability, governance, DSE-specific rules. Preserve schema when adding entries.
- Service worker precaches `index.html`, styles, JS modules, manifest, and icons so the glossary loads offline; bump `CACHE_NAME` when changing cached assets.

## Engineering conventions

- Use ES modules everywhere; no CommonJS imports.
- Keep assets referenced via **relative paths** (`./src/...`) so Pages works from any subpath.
- Prefer semantic HTML, accessible labels (`aria-live`, `sr-only`).
- Style additions should remain mobile-first (grid auto-fit, clamp fonts, sticky controls).
- Avoid adding heavy dependencies; if absolutely needed, justify and document in README and package.json.
- Maintain manifest & icon consistency when branding or theme colors change.
- Register/update service worker logic cautiously; remember to `self.skipWaiting()`/`clients.claim()` patterns already applied.

## Testing & validation

- Run `npm test` to execute `scripts/smoke-test.mjs` after changing search logic.
- For manual QA, serve with `python3 -m http.server 8000` and verify search/highlighting on real devices.
- Validate PWA behavior with Chrome DevTools → Application tab (manifest + service worker) and toggle offline mode.

## Deployment notes

- GitHub Pages deployment: push to repo ➜ Settings → Pages ➜ Source "Deploy from a branch" ➜ Branch `main`, folder `/ (root)`.
- Live URL format: `https://<user>.github.io/<repo>/`.
- Ensure new assets remain inside repo root or reference them relatively; Pages has no build step.

## Roadmap hints

- Possible near-term tasks: tag filters, fuzzy search, more Bangladeshi-specific guidance, contributions form, accessibility audit.
- Document any new data schema fields in `README.md` + this file.

