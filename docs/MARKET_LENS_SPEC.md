# DSE Market Lens - Technical Specification

## 1. Overview
"Market Lens" is a mobile-first, static-site dashboard for the Dhaka Stock Exchange (DSE). It transforms raw daily CSV snapshots into an interactive analytical tool. It runs entirely in the browser (client-side) but relies on a build-time data processing step to aggregate historical trends and calculate deltas.

## 2. Architecture

### 2.1 Data Flow
1.  **Ingestion**: Daily CSV snapshots are committed to `data/dse/YYYY-MM-DD.csv`.
2.  **Build Process**: A Node.js script (`scripts/build-market-data.mjs`) runs (via GitHub Actions or manually).
    *   Reads all CSVs in `data/dse/`.
    *   Parses the latest file as the "Current State".
    *   Compares with previous files (T-1, T-7, T-30, T-90, T-180, T-365) to calculate Deltas.
    *   Extracts closing prices for the last 30 files to generate Sparklines.
3.  **Output**: Generates `src/data/dse-market.json`.
4.  **Frontend**: `market.html` fetches this JSON and renders the UI.

### 2.2 Folder Structure
```
data/
  dse/
    2025-11-29.csv
    2025-11-30.csv  <-- Newest
src/
  data/
    dse-market.json <-- Generated artifact
  lib/
    marketLogic.js  <-- Filtering & Bucket logic
    aiAnalyst.js    <-- OpenRouter integration
market.html         <-- New entry point
```

## 3. Data Schema (`dse-market.json`)

The generated JSON will be an array of objects, optimized for size.

```json
{
  "metadata": {
    "generatedAt": "2025-11-30T14:00:00Z",
    "marketDate": "2025-11-30",
    "totalStocks": 390
  },
  "stocks": [
    {
      "symbol": "GP",
      "name": "Grameenphone Ltd.",
      "sector": "Telecommunication",
      "category": "A",
      "metrics": {
        "ltp": 280.5,
        "pe": 12.5,
        "rsi": 45,
        "macd": "Bullish",
        "volume": 500000,
        "mktCap": 380000
      },
      "deltas": {
        "price_1d": 1.2,   // % change
        "price_1w": -0.5,
        "vol_1d": 15.0     // % volume change
      },
      "sparkline": [270, 272, 275, 271, 280] // Last 30 closing prices
    }
  ]
}
```

## 4. Features & UI Modules

### 4.1 Dashboard (Mobile First)
*   **Header**: Market Status (Open/Closed), Total Volume, Index Change.
*   **Smart Search & Compare**:
    *   Search by Symbol or Company.
    *   **"Quick Compare"**: Pin two stocks to compare their metrics side-by-side (e.g., GP vs ROBI).
*   **Tabs**:
    1.  **Lens (Buckets)**: Pre-defined segments.
    2.  **Screener (List)**: Sortable table with sparklines.
    3.  **Heatmap**: Sector visualization.
        *   **Color**: Green to Red based on average % change.
        *   **Size**: Based on total Market Cap or Volume.
        *   **Interaction**: Tapping a sector drills down to stocks in that sector.

### 4.2 Opportunity Buckets (Decision Matrix)
Logic defined in `src/lib/marketLogic.js`.
*   **Value Picks**: Low PE (< 15), Low PB (< 1.5), High Yield (> 4%).
*   **Momentum Plays**: High RSI (60-80), Price > SMA20, MACD Bullish.
*   **Safe Havens**: Low Beta (< 0.8), Large Cap, Positive Reserves.
*   **Reversal Watch**: RSI < 30 (Oversold), Price near Lower Bollinger Band.
*   **The "Trap" Zone: High PE, Negative EPS, High Debt.
*   **Volume Shockers**: Volume > 2x 20-day Avg.

### 4.3 AI Investment Memo (OpenRouter)
*   **Trigger**: "Generate Report" button on Stock Detail Modal.
*   **Configuration**: Settings modal to input/save API Key (stored in `localStorage`).
*   **Privacy**: API Key is stored locally and never sent to the server.
*   **Prompt Strategy**:
    *   System: "You are an expert financial analyst for the Dhaka Stock Exchange."
    *   User: "Analyze [Symbol] ([Sector]). Price: [LTP], PE: [PE], RSI: [RSI]... Provide Bull Case, Bear Case, and Verdict."

### 4.4 Stock Detail View
*   **Header**: Symbol, Name, Sector badge.
*   **Chart**: Simple SVG Sparkline (expanded).
*   **Grid**: Key metrics (PE, EPS, NAV, Dividend).
*   **AI Insight**: Markdown rendered response from OpenRouter.

### 4.5 UI Layout Concept (Mobile)
```text
+-----------------------------------+
|  [=] DSE Lens           [Settings]|
+-----------------------------------+
|  SEARCH (Symbol, Sector...)       |
+-----------------------------------+
|  [ Heatmap ] [ Buckets ] [ List ] |  <-- Tabs
+-----------------------------------+
|                                   |
|  (Bucket View Selected)           |
|                                   |
|  🚀 Momentum (5 stocks)           |
|  +-----------------------------+  |
|  | BEACONPHAR | +2.3% | RSI 65 |  |
|  +-----------------------------+  |
|                                   |
|  💎 Undervalued (12 stocks)       |
|  +-----------------------------+  |
|  | SQURPHARMA | -0.1% | PE 11  |  |
|  +-----------------------------+  |
|                                   |
+-----------------------------------+
```

## 5. Implementation Roadmap

### Phase 1: Foundation
1.  [x] Create `data/dse` structure.
2.  [ ] Create `scripts/build-market-data.mjs` (The Processor).
3.  [ ] Define `package.json` script: `npm run build:data`.

### Phase 2: Frontend Core
1.  [ ] Create `market.html` layout.
2.  [ ] Implement `src/lib/marketLogic.js` (Bucket definitions).
3.  [ ] Build the "Screener" view with Sparklines.

### Phase 3: Advanced Features
1.  [ ] Implement Sector Heatmap.
2.  [ ] Build `src/lib/aiAnalyst.js` and Settings UI.
3.  [ ] Add PWA caching for the new JSON file.

## 6. Future Multi-Market Support
*   The build script will accept a `--market` flag (e.g., `npm run build:data -- --market=cse`).
*   Frontend will accept a query param `?market=cse` to load `cse-market.json`.
