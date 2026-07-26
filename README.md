# DSE Toolkit & Glossary

A comprehensive, mobile-first toolkit for Dhaka Stock Exchange (DSE) investors. It combines an educational glossary with a powerful market dashboard ("Market Lens") and AI-powered stock analysis.

## Links

- **GitHub Pages (Web App)**: `https://astinaam-webtools.github.io/dse-toolkit/`
- **Android App (Local Build)**: Generated via Capacitor; open with `npx cap open android`.
- **Play Store**: Coming soon — placeholder link: `https://play.google.com/store/apps/details?id=com.astinaamwebtools.dsetoolkit`
- **QR Code**: Placeholder — will point to the Play Store page once published.


## Features

### 📚 Investor Glossary
- **Mobile-first UI**: Responsive design for on-the-go learning.
- **Instant Search**: Token-based search for terms like P/E, EPS, ROE, NAV.
- **Contextual Learning**: "Why it matters" and "What to watch for" sections for every term.
- **Chart Playbook**: Dedicated guide (`guides.html`) on how to read technical indicators on charts.

### 🔍 Market Lens Dashboard (`market.html`)
- **Smart Buckets**: Automatically categorizes stocks into "Value", "Momentum", "Safe Havens", and more.
- **Screener**: Sortable table with sparklines showing price trends.
- **Sector Heatmap**: Interactive visualization showing sector performance with color-coded tiles (green = gains, red = losses). Click any sector to drill down into individual stocks.
- **Market Status**: Real-time market data snapshot with date indicator.

### 📈 Stock Details & AI Analyst (`stock.html`)
- **Deep Dive**: Detailed view of individual stocks with sparkline charts and key metrics.
- **AI Analysis**: Integrated AI chat (via OpenRouter) to generate Bull/Bear cases and investment verdicts.
- **Smart Linking**: Click on any metric (e.g., "P/E Ratio") to instantly jump to its definition in the glossary.

### � Portfolio Tracker (`portfolio.html`)
- **Multi-Portfolio Support**: Create and manage multiple portfolios (e.g., "Long Term", "Trading").
- **Real-time Valuation**: Automatically calculates current value and P/L based on the latest market data.
- **Import/Export**: Backup your data or migrate between devices using CSV or JSON files.
- **Privacy First**: All data is stored locally in your browser's `localStorage`. No data ever leaves your device.

### �🛠 Technicals
- **PWA Ready**: Installable with offline cache (manifest + service worker).
- **Zero Dependencies**: Built with Vanilla JS and CSS variables. No heavy frameworks.
- **Static Hosting**: Deploys easily to GitHub Pages.

## Project Structure

```
├── data/
│   └── dse/              # Raw CSV market data files
├── scripts/
│   └── build-market-data.mjs # Node script to process CSVs into JSON
├── src/
│   ├── app.js            # Glossary logic
│   ├── marketApp.js      # Market Lens dashboard logic
│   ├── stockDetailApp.js # Stock details & AI logic
│   ├── portfoliosApp.js  # Unified Portfolios (stocks + funds)
│   ├── data/
│   │   ├── terms.js      # Glossary definitions
│   │   └── dse-market.json # Processed market data
│   └── lib/              # Shared utilities (profiler, filters, portfolio)
├── index.html            # Glossary Entry Point
├── market.html           # Market Lens Dashboard
├── stock.html            # Stock Details Page
├── portfolio.html        # Portfolio Tracker
└── sw.js                 # Service Worker
```

## Data Pipeline

The project uses a static data generation approach:

1.  **Raw Data**: Daily market data is dropped into `data/dse/` as CSV files (e.g., `2025-12-01.csv`).
2.  **Processing**: Run `npm run build:data` to process these CSVs.
    -   Parses the latest CSV.
    -   Calculates price/volume deltas for available history windows (1d…15y); omits nulls.
    -   Generates sparkline history from the last 30 files.
    -   Outputs compact `src/data/dse-market.json` (minified, rounded numbers, no null keys).
3.  **Frontend**: The app fetches this JSON file to render the dashboard and stock pages. Missing metric/delta keys mean the value was unavailable.

## Local Development

1.  **Install Dependencies** (for scripts):
    ```bash
    npm install
    ```

2.  **Build Data**:
    ```bash
    npm run build:data
    ```

3.  **Serve Locally**:
    ```bash
    # Python
    python3 -m http.server 3030
    # Or Node
    # npx http-server -p 3030
    ```

4.  **Visit**:
    -   Glossary: `http://localhost:3030/`
    -   Market Lens: `http://localhost:3030/market.html`

## AI Configuration

To use the AI Analyst feature:
1.  Go to **Market Lens** (`market.html`).
2.  Click the **Settings (⚙️)** icon.
3.  Enter your **OpenRouter API Key**.
4.  (Optional) Specify a preferred model (default: `meta-llama/llama-3-8b-instruct:free`).
5.  Keys are stored locally in your browser (`localStorage`).

## Deployment

1.  **Build Data**: Ensure `src/data/dse-market.json` is up to date.
2.  **Push to GitHub**:
    ```bash
    git add .
    git commit -m "Update market data"
    git push origin main
    ```
3.  **GitHub Pages**: Configure Pages to serve from the `/ (root)` directory.

## License

ISC
