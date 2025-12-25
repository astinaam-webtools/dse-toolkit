# Mutual Funds Manager - Technical Specification

## 1. Overview
The "Mutual Funds Manager" is a dedicated feature within the DSE Toolkit designed to help investors track their mutual fund investments. Unlike the stock market portfolio which relies on automated market data, this feature focuses on user-driven data entry for Net Asset Value (NAV) and transaction history, catering to the specific needs of mutual fund investors (SIPs, periodic NAV updates, long-term holding).

## 2. User Stories & Core Features

### 2.1 Portfolio Management
- **Multiple Portfolios**: Users can create distinct portfolios (e.g., "Retirement", "Kids' Education", "High Risk").
- **CRUD Operations**: Create, Rename, and Delete portfolios.
- **Summary View**: See total investment, current value, and overall return for each portfolio at a glance.

### 2.2 Fund Management
- **Add Fund**: Users can add a fund by name and fund manager/AMC (Asset Management Company).
- **NAV Tracking**:
    - Users manually update the current NAV.
    - System maintains a history of NAV updates with dates.
    - Visual indicator of the last update date (e.g., "NAV updated 2 days ago").
- **Transaction Management**:
    - **Buy/SIP**: Record purchase of units (Date, NAV/Price, Units, Total Cost).
    - **Sell/Redeem**: Record redemption of units.
    - **Dividend**: Record dividends (Cash or Reinvestment units).

### 2.3 Analytics & Visualization
- **Performance Graphs**:
    - **NAV History Chart**: Line chart showing the fund's price trend over time based on user inputs.
    - **Growth Chart**: Comparison of "Total Invested" vs "Current Value" over time.
- **Key Metrics**:
    - Total Units Held.
    - Weighted Average Cost (WAC).
    - Total Investment Cost.
    - Current Market Value.
    - Unrealized Gain/Loss (Absolute & Percentage).
    - Annualized Return (CAGR) - *Advanced feature*.

### 2.4 Data Management
- **Local Storage**: All data persists in the browser's `localStorage`.
- **Import/Export**:
    - Export all mutual fund data to a JSON file for backup.
    - Import JSON file to restore data or sync between devices.

## 3. Data Schema

The data will be stored under the key `dse-mutual-funds`.

```json
{
  "version": 1,
  "activePortfolioId": "uuid-1",
  "portfolios": [
    {
      "id": "uuid-1",
      "name": "My SIP Portfolio",
      "created_at": "2025-12-25T10:00:00Z",
      "funds": [
        {
          "id": "fund-uuid-1",
          "name": "EBL First Mutual Fund",
          "amc": "EBL", // Asset Management Company
          "current_nav": 12.50,
          "last_updated": "2025-12-24T10:00:00Z",
          "transactions": [
            {
              "id": "tx-1",
              "date": "2025-01-01",
              "type": "BUY", // BUY, SELL, DIVIDEND_REINVEST
              "units": 500,
              "price_per_unit": 10.00,
              "total_cost": 5000,
              "notes": "Initial investment"
            },
            {
              "id": "tx-2",
              "date": "2025-02-01",
              "type": "BUY",
              "units": 100,
              "price_per_unit": 10.20,
              "total_cost": 1020,
              "notes": "SIP"
            }
          ],
          "nav_history": [
            { "date": "2025-01-01", "nav": 10.00 },
            { "date": "2025-02-01", "nav": 10.20 },
            { "date": "2025-12-24", "nav": 12.50 }
          ]
        }
      ]
    }
  ]
}
```

## 4. UI/UX Design

### 4.1 Entry Point
- A new navigation item "Mutual Funds" in the main menu/drawer.
- File: `funds.html`.

### 4.2 Dashboard (Portfolio List)
- **Header**: "Mutual Funds Manager" with Import/Export buttons.
- **Portfolio Cards**:
    - Title (Portfolio Name).
    - Summary Stats: Total Invested, Current Value, Total Gain/Loss (+%).
    - "Manage" button to enter the portfolio.
- **Floating Action Button (FAB)**: "Create New Portfolio".

### 4.3 Portfolio Detail View
- **Header**: Portfolio Name (editable) + Delete button.
- **Fund List**:
    - List of funds in this portfolio.
    - Each row/card shows:
        - Fund Name.
        - Units Held.
        - Avg Cost vs Current NAV.
        - Gain/Loss status (Green/Red).
        - **Quick Action**: "Update NAV" button (inline input).
- **Add Fund Button**: Opens modal to enter Fund Name and AMC.

### 4.4 Fund Detail View
- **Header**: Fund Name & AMC.
- **Overview Cards**:
    - Current NAV (Large, editable).
    - My Position: Units, Avg Cost, Invested Amount, Current Value.
    - Performance: Absolute Return, CAGR (approx).
- **Charts Section**:
    - NAV History (Line chart).
- **Transaction History**:
    - Table/List of all Buy/Sell/Dividend records.
    - "Add Transaction" button (opens modal for Date, Type, Units, Price).

## 5. Technical Implementation

### 5.1 File Structure
- `funds.html`: Main entry point.
- `src/fundsApp.js`: Main logic controller.
- `src/lib/fundsLogic.js`: Pure functions for calculations (WAC, Gain/Loss) and data transformations.
- `src/lib/storage.js`: (Refactor) Shared storage utility if possible, or specific handling in `fundsLogic.js`.

### 5.2 Key Logic
- **Weighted Average Cost (WAC)**:
  $$ WAC = \frac{\sum (Units_{buy} \times Price_{buy})}{\sum Units_{buy}} $$
  *(Adjust for sells using FIFO or Average Cost basis - MVP will use Average Cost)*.
- **Current Value**:
  $$ Value = Total Units \times Current NAV $$
- **NAV History**:
  - When user updates "Current NAV", push `{ date: Today, nav: Value }` to `nav_history` if the last entry is not from today.

### 5.3 Dependencies
- **Chart.js** (or similar lightweight library) for rendering graphs. *Note: Project currently uses vanilla JS. We can use a simple SVG generator or a lightweight canvas drawer to avoid heavy deps, or stick to the project's "no bundler" philosophy.*
- **Export/Import**: Standard `Blob` creation for JSON download and `FileReader` for upload.

## 6. Future Enhancements
- **SIP Planner**: Calculator to estimate future wealth based on monthly contribution and expected return.
- **Goal Mapping**: Link portfolios to specific financial goals (e.g., "Target: 10 Lakh by 2030").
- **Auto-fetch NAV**: (Long term) Scrape or fetch NAV from AMC websites if APIs become available.
