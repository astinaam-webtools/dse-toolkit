# DSE Portfolio - Technical Specification

## 1. Overview
The "Portfolio" feature allows users to track their stock holdings in the Dhaka Stock Exchange (DSE). It provides a way to monitor investment performance, calculate profit/loss, and manage multiple stock positions. Like the rest of the DSE Toolkit, this feature is entirely client-side, ensuring user privacy by storing all data locally.

## 2. Data Schema

### 2.1 Portfolio Structure
The app supports multiple portfolios. The data is stored as an object containing an array of portfolios and the ID of the currently active one.

```json
{
  "activePortfolioId": "1734512345678",
  "portfolios": [
    {
      "id": "1734512345678",
      "name": "Main Portfolio",
      "items": [
        {
          "symbol": "GP",
          "quantity": 100,
          "average_cost": 250.50,
          "commission_rate": 0.004,
          "commission_included": false,
          "added_at": "2025-12-18T10:00:00Z"
        }
      ]
    }
  ]
}
```

### 2.2 Portfolio Item
Each entry in a portfolio represents a stock position.

```json
{
  "symbol": "GP",
  "quantity": 100,
  "average_cost": 250.50,
  "commission_rate": 0.004, // 0.4%
  "commission_included": false, // If true, average_cost already includes commission
  "added_at": "2025-12-18T10:00:00Z"
}
```

### 2.3 Required Fields (Item)
| Field | Type | Description |
| :--- | :--- | :--- |
| `symbol` | String | The stock ticker symbol (e.g., "GP", "ROBI"). |
| `quantity` | Number | Total number of shares held. |
| `average_cost` | Number | The average price paid per share. |
| `commission_rate` | Number | The brokerage commission rate (e.g., 0.004 for 0.4%). |
| `commission_included` | Boolean | Whether the `average_cost` already accounts for the commission. |

### 2.4 Calculated Fields (UI Only)
These fields are derived from the portfolio data and the latest market prices.
*   **Total Cost**: `quantity * average_cost` (plus commission if `commission_included` is false).
*   **Current Value**: `quantity * latest_price`.
*   **Profit/Loss (P/L)**: `Current Value - Total Cost`.
*   **P/L %**: `(P/L / Total Cost) * 100`.

## 3. Storage & Persistence
*   **Mechanism**: `localStorage`.
*   **Key**: `dse_toolkit_portfolios` (Updated from `dse_toolkit_portfolio`).
*   **Format**: A JSON stringified object containing `activePortfolioId` and `portfolios` array.
*   **Privacy**: Data never leaves the user's device.

## 4. Features

### 4.1 Multi-Portfolio Management
*   **Create Portfolio**: Add a new named portfolio.
*   **Switch Portfolio**: Toggle between different portfolios.
*   **Rename/Delete Portfolio**: Manage the portfolio list.
*   **Aggregate View**: (Optional) A "Total" view that sums all portfolios.

### 4.2 Stock Management (within active portfolio)
*   **Add Stock**: A form to input symbol, quantity, cost, and commission.
*   **Edit Stock**: Update existing positions.
*   **Delete Stock**: Remove a position from the portfolio.
*   **Real-time Valuation**: Automatically calculate the current value of the portfolio using the latest data from `dse-market.json`.

### 4.3 Import/Export
To ensure data portability and backup, users can import and export their portfolios.

*   **Export**:
    *   **JSON**: Download the entire `localStorage` object (all portfolios) as a `.json` file.
    *   **CSV**: Export the *active* portfolio as a `.csv` file.
*   **Import**:
    *   **JSON Upload**: Replace all portfolios with the uploaded data.
    *   **CSV Upload**: Append items from the CSV to the *active* portfolio.
    *   **Validation**: Ensure symbols exist in the DSE market data and numeric fields are valid.

### 4.4 Portfolio Summary Dashboard
*   **Total Portfolio Value**: Sum of all current values in the active portfolio.
*   **Total Investment**: Sum of all total costs in the active portfolio.
*   **Overall P/L**: Total Value - Total Investment.
*   **Daily Change**: (Optional) Change in value based on the last 1-day price delta.

## 5. UI Layout Concept (Mobile)

```text
+-----------------------------------+
|  [=] Portfolios         [Manage]  |
+-----------------------------------+
|  SELECT: [ Main Portfolio v ]     | <-- Dropdown or Switcher
+-----------------------------------+
|  SUMMARY (Active)                 |
|  Value: 1,25,000 | P/L: +5,200    |
+-----------------------------------+
|  HOLDINGS                         |
|                                   |
|  GP (100)                         |
|  Cost: 250.5 | LTP: 280.5         |
|  P/L: +3,000 (+12%)               |
|  +-----------------------------+  |
|                                   |
|  ROBI (500)                       |
|  Cost: 30.0 | LTP: 28.5           |
|  P/L: -750 (-5%)                  |
+-----------------------------------+
|  [+] Add New Position             |
+-----------------------------------+
```

## 6. Implementation Roadmap

### Phase 1: Core Logic Update
1.  Update `src/lib/portfolioLogic.js` to handle the new multi-portfolio structure.
2.  Implement migration logic to move data from the old single-portfolio key if it exists.
3.  Add functions for `createPortfolio`, `deletePortfolio`, `switchPortfolio`.

### Phase 2: UI Integration
1.  Update `portfolio.html` to include a portfolio selector.
2.  Add a "Manage Portfolios" modal for creating/renaming/deleting portfolios.
3.  Update the summary and holdings list to react to portfolio switching.

### Phase 3: Data Portability
1.  Update JSON export to include all portfolios.
2.  Update CSV export/import to work with the active portfolio.

