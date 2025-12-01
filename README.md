# DSE Toolkit & Glossary

A comprehensive, mobile-first toolkit for Dhaka Stock Exchange (DSE) investors. It combines an educational glossary with a powerful market dashboard ("Market Lens") and AI-powered stock analysis.

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

### 🛠 Technicals
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
│   ├── data/
│   │   ├── terms.js      # Glossary definitions
│   │   └── dse-market.json # Processed market data
│   └── lib/              # Shared utilities (profiler, filters)
├── index.html            # Glossary Entry Point
├── market.html           # Market Lens Dashboard
├── stock.html            # Stock Details Page
└── sw.js                 # Service Worker
```

## Data Pipeline

The project uses a static data generation approach:

1.  **Raw Data**: Daily market data is dropped into `data/dse/` as CSV files (e.g., `2025-12-01.csv`).
2.  **Processing**: Run `npm run build:data` to process these CSVs.
    -   Parses the latest CSV.
    -   Calculates price/volume deltas (1-day, 1-week).
    -   Generates sparkline history from the last 30 files.
    -   Outputs `src/data/dse-market.json`.
3.  **Frontend**: The app fetches this JSON file to render the dashboard and stock pages.

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
