# Bangladesh Stock Glossary

A mobile-first glossary built for long-term value investors focused on the Dhaka Stock Exchange (DSE). It explains common terms and short forms (P/E, EPS, ROE, NAV, etc.) and makes them searchable.

## Features

- Mobile-first responsive UI
- Instant search with token matching
- Highlight matched words in results
- Installable PWA with offline cache (manifest + service worker)
- Dedicated chart-reading playbook (`guides.html`) with anchor links from every relevant term
- Dedicated behaviour analyzer page (`analyzer.html`) that classifies a stock as value/growth/income/defensive/cyclical based on your inputs
- Small, dependency-free static site — ideal for GitHub Pages

## Local development

Serve the project locally and open http://localhost:8000

```bash
# from repo root
python3 -m http.server 8000
# or (if you prefer node)
# npx http-server -p 8000
```

While the server is running, open Chrome DevTools → Application → Service Workers to confirm the worker (`sw.js`) registers correctly. Toggle “Offline” to simulate no connectivity; the glossary should still load thanks to the precache.

### Chart guide & analyzer

- Visit `/guides.html` to read how to pull metrics such as VWAP, RSI, YCP, reserves, loans, etc. directly from StockNow/TradingView charts. Each glossary card links to its anchor.
- Open `/analyzer.html`, enter the metrics you copied, and review the suggested investing buckets plus “when to invest” tips. Adjust the heuristics by tweaking `src/lib/behaviorProfiler.js` if your strategy differs.

### Analysis templates (CSV & JSON)

**CSV snapshot**

- Use `data/analysis-template.csv` when you want to capture headline metrics for multiple companies quickly. The header already includes valuation (P/E, Forward P/E, P/B, EV/EBITDA), profitability (5Y revenue/EPS CAGR, ROE, ROA, margins, free-cash-flow), capital structure (debt-to-equity, net-debt/EBITDA, interest coverage, loan growth), liquidity (current/quick), technicals (price vs. 52w high, VWAP premium, RSI, MA50 vs MA200, EMA20 trend), ownership, and qualitative note columns (governance, risks, price action, guide anchors).
- Tie each numeric field back to the chart playbook: e.g., `PE`, `PB`, `DividendYieldPct` map to the P/E and dividend cards; `DebtToEquity` and loan growth columns map to the leverage cards; `BetaVsDSEX`, `RSI14`, and moving-average signals map to their respective technical guides.
- Add one row per company. Keep the `ChartGuideAnchors` column for quick links like `#pe,#de,#beta` so you can jump into `guides.html` while reviewing.

**JSON deep dive**

- Use `data/analysis-template.json` when you need a richer research notebook that stores multi-year figures alongside the exact filing/source. The template starts with an empty company object containing:
	- `filings` and `sources` lists so you can paste report URLs, periods, and notes.
	- A structured `history` section for five-year series (revenue, EPS, dividends, FCF, ROE/ROA, margins, leverage, loan balances, beta) with `{ year, value, source }` entries.
	- Buckets for `valuation`, `profitability`, `incomeDistributions`, `cashFlow`, `leverage`, `liquidity`, and `priceSnapshot` so derived ratios live next to the raw data you used.
	- `ownership`, `governance`, `watchForRisks`, and `chartGuideAnchors` arrays for qualitative insights and quick jumps into `guides.html` (e.g., `[#pe, #de, #beta]`).
- Duplicate the sample object for each company, keep nulls until you have the numbers, and update `source` fields with references like "FY2024 annual report pg. 34".

## Deploy to GitHub Pages

If you already created a GitHub repository for this project, follow this checklist to publish it on GitHub Pages:

1. **Commit & push the site**
	```bash
	git add .
	git commit -m "Deploy glossary to GitHub Pages"
	git push origin main   # replace with your default branch name
	```
2. **Enable Pages**
	- Navigate to your repository on github.com.
	- Open **Settings → Pages** (or **Settings → Code & Automation → Pages**).
	- Under *Build and deployment*, set **Source** to `Deploy from a branch`.
	- Pick the branch you pushed (usually `main`) and select the **`/ (root)`** folder since `index.html` lives at the repo root.
	- Click **Save**. GitHub will kick off a deployment workflow automatically.
3. **Wait for the green check**
	- A Pages status badge appears near the top of the Pages settings page. Wait until it says *Your site is live* (typically under a minute).
4. **Visit your site**
	- The live URL is `https://<your-username>.github.io/<repository-name>/`.
	- Because all assets are referenced with relative paths (e.g., `./src/app.js`), the site loads correctly even from a subdirectory.
5. **(Optional) Add a custom domain**
	- Still under Pages settings, add your domain in the *Custom domain* box and follow GitHub’s DNS instructions.

No build step or CI workflow is needed—the site is a static bundle, so GitHub Pages serves it as-is.

## Install as a PWA

1. Visit the GitHub Pages URL on Chrome (desktop or Android).
2. Open the browser menu and choose **Install app** / **Add to Home screen**.
3. On mobile, launch it from your home screen for a standalone experience.
4. When you make code changes, bump the `CACHE_NAME` in `sw.js` to ensure users receive the latest assets.

## Next steps (ideas)

- Add categories/tags filters and sorting
- Add examples & company-specific notes for popular blue-chip names
- Add a small admin UI to suggest new terms or edits
- Add unit tests for search logic (Jest) and automated accessibility checks

If you want, I can implement any of the next steps above — tell me which one to pick first.
