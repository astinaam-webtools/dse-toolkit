export const terms = [
  {
    title: 'Price-to-Earnings Ratio',
    shortForm: 'P/E',
    category: 'Valuation',
    description: 'Compares a share price to the earnings per share generated over the last 12 months.',
    whyItMatters: 'Shows how many Bangladeshi taka investors are willing to pay for 1 taka of earnings. Helps compare whether the stock is priced above or below the market average.',
    watchFor: 'For blue-chip DSE names, a trailing P/E below ~15 often signals value if earnings quality is stable. A P/E above ~25 needs strong growth visibility or it can mean the stock is overheated.',
    tags: ['valuation', 'earnings', 'blue-chip']
  },
  {
    title: 'Earnings Per Share',
    shortForm: 'EPS',
    category: 'Profitability',
    description: 'Net profit attributable to each ordinary share after tax and preference dividends.',
    whyItMatters: 'Rising EPS is the fuel for dividend growth and capital gains. It signals that a company can reinvest and distribute cash.',
    watchFor: 'Look for a positive multi-year EPS trend and limited volatility. Single-quarter spikes without operational reasons often reverse.',
    tags: ['profitability', 'trend']
  },
  {
    title: 'Net Asset Value Per Share',
    shortForm: 'NAV',
    category: 'Balance Sheet',
    description: 'Book value of equity divided by outstanding shares.',
    whyItMatters: 'Acts as a floor for asset-heavy firms (banks, insurers, textiles). Long-term investors like buying below intrinsic asset value.',
    watchFor: 'A price greater than 1.5× NAV needs superior ROE to justify. A price below NAV could be attractive if assets are not impaired.',
    tags: ['assets', 'valuation']
  },
  {
    title: 'Price-to-Book Ratio',
    shortForm: 'P/B',
    category: 'Valuation',
    description: 'Share price divided by NAV per share.',
    whyItMatters: 'Helps compare banks or financials where earnings can swing but book value stays steadier.',
    watchFor: 'For mature banks in Bangladesh, a P/B between 0.8–1.5 is typical. Below 0.8 can mean deep value or governance issues.',
    tags: ['banks', 'valuation']
  },
  {
    title: 'Return on Equity',
    shortForm: 'ROE',
    category: 'Profitability',
    description: 'Percentage of profit generated for every taka of shareholder equity.',
    whyItMatters: 'Sustained double-digit ROE compounds capital quickly without new money.',
    watchFor: 'Aim for 12–18% ROE with low leverage. ROE above 20% may be unsustainable if debt-fueled.',
    tags: ['efficiency', 'quality']
  },
  {
    title: 'Dividend Yield',
    shortForm: 'DY',
    category: 'Income',
    description: 'Cash dividend per share divided by current price.',
    whyItMatters: 'Value investors in Bangladesh often target reliable cash flows to hedge inflation.',
    watchFor: 'A 3–6% yield that is covered by earnings and cash flow is healthier than a 10%+ yield funded by reserves.',
    tags: ['income', 'cash-flow']
  },
  {
    title: 'Debt-to-Equity Ratio',
    shortForm: 'D/E',
    category: 'Leverage',
    description: 'Total interest-bearing debt divided by shareholder equity.',
    whyItMatters: 'Measures balance-sheet risk and sensitivity to interest rate hikes.',
    watchFor: 'Manufacturers with D/E below 0.8 are generally safer. Above 1.5 can stress cash flows when Bangladesh Bank tightens policy.',
    tags: ['risk', 'balance-sheet']
  },
  {
    title: 'Free Cash Flow',
    shortForm: 'FCF',
    category: 'Cash Flow',
    description: 'Operating cash flow minus capital expenditure.',
    whyItMatters: 'Shows the cash available for dividends, debt repayment, or reinvestment.',
    watchFor: 'Positive FCF in at least 3 of the last 5 years supports dividend sustainability even during slowdowns.',
    tags: ['cash-flow', 'quality']
  },
  {
    title: 'Compound Annual Growth Rate',
    shortForm: 'CAGR',
    category: 'Growth',
    description: 'Average yearly growth rate of a metric such as revenue, EPS, or dividends over a multi-year period.',
    whyItMatters: 'Smooths out volatility and shows whether a company is truly compounding.',
    watchFor: 'For defensive blue chips, 8–12% revenue CAGR is healthy. Extremely high CAGR (>20%) rarely persists without reinvestment needs.',
    tags: ['trend', 'valuation']
  },
  {
    title: 'Beta',
    shortForm: 'β',
    category: 'Risk',
    description: 'Statistical measure of a stock’s volatility versus the overall market (DSEX).',
    whyItMatters: 'Helps set expectations about price swings and portfolio diversification.',
    watchFor: 'Value investors often prefer beta below 1 to reduce drawdowns. Beta above 1.2 indicates more speculation.',
    tags: ['volatility', 'portfolio']
  },
  {
    title: 'Market Capitalization',
    shortForm: 'Mkt Cap',
    category: 'Basics',
    description: 'Total market value of a company’s outstanding shares.',
    whyItMatters: 'Classifies companies into large-cap blue chips, mid-caps, or small caps, which come with different risk levels.',
    watchFor: 'Large caps (>Tk 5,000 crore) usually have more analyst coverage and liquidity, making them suitable for beginners.',
    tags: ['size', 'liquidity']
  },
  {
    title: 'Free Float',
    shortForm: 'Float',
    category: 'Ownership',
    description: 'Percentage of shares available for public trading (excluding sponsors and locked-in holdings).',
    whyItMatters: 'Higher float generally means better liquidity and less manipulation risk.',
    watchFor: 'Aim for float above 25%. Very low float (<10%) can lead to sharp price swings with little news.',
    tags: ['liquidity', 'governance']
  },
  {
    title: 'Market Depth',
    shortForm: 'Depth',
    category: 'Trading',
    description: 'Snapshot of buy and sell orders at different price levels.',
    whyItMatters: 'Shows supply-demand balance and helps plan entries without moving the price too much.',
    watchFor: 'Thin depth with a wide spread suggests waiting for volume confirmation before investing larger sums.',
    tags: ['liquidity', 'execution']
  },
  {
    title: 'Circuit Breaker Limit',
    shortForm: 'Circuit',
    category: 'Rules',
    description: 'Maximum daily price movement allowed by DSE to control volatility.',
    whyItMatters: 'Prevents panic selling or euphoric spikes, affecting how quickly a stock can rerate.',
    watchFor: 'Know the current circuit band (e.g., ±10%). Stocks stuck at lower circuits for days indicate strong selling pressure.',
    tags: ['regulation', 'volatility']
  },
  {
    title: 'Floor Price',
    shortForm: 'Floor',
    category: 'Rules',
    description: 'Regulator-imposed minimum price below which a stock cannot trade temporarily.',
    whyItMatters: 'Introduced during market stress; impacts price discovery and liquidity.',
    watchFor: 'If a stock trades at floor for weeks, it signals weak buyers. Wait for floor removal plus improving fundamentals.',
    tags: ['regulation', 'liquidity']
  },
  {
    title: 'Record Date',
    shortForm: 'RD',
    category: 'Corporate Action',
    description: 'Cut-off date to identify shareholders eligible for dividends, rights, or bonus shares.',
    whyItMatters: 'You must own the stock before the record date to receive the benefit.',
    watchFor: 'Share prices often adjust downward on the ex-dividend date; avoid chasing just for a one-off payout.',
    tags: ['dividends', 'timeline']
  },
  {
    title: 'Book Closure',
    shortForm: 'BC',
    category: 'Corporate Action',
    description: 'Period when a company’s share register is closed to update entitlements.',
    whyItMatters: 'Defines the window during which you cannot transfer shares to claim the announced benefit.',
    watchFor: 'Trade settlements must finish before book closure. Keep an eye on CDBL settlement times.',
    tags: ['dividends', 'settlement']
  },
  {
    title: 'Initial Public Offering',
    shortForm: 'IPO',
    category: 'Capital Raising',
    description: 'First sale of shares by a private company to the public on DSE.',
    whyItMatters: 'Offers access to growth companies early, but valuations can be optimistic.',
    watchFor: 'Study the prospectus. Favor IPOs with strong governance, post-IPO free float >25%, and realistic use of proceeds.',
    tags: ['listing', 'growth']
  },
  {
    title: 'Rights Issue',
    shortForm: 'Rights',
    category: 'Capital Raising',
    description: 'Offer to existing shareholders to buy additional shares, usually at a discount, to raise capital.',
    whyItMatters: 'Protects you from dilution if you participate.',
    watchFor: 'Assess why funds are needed. Rights used to plug operating losses are red flags; funding expansion can be positive.',
    tags: ['dilution', 'capital']
  },
  {
    title: 'Placement Shares',
    shortForm: 'Placement',
    category: 'Ownership',
    description: 'Shares privately placed with institutions or sponsors before listing.',
    whyItMatters: 'Large placements can create supply overhang once lock-in expires.',
    watchFor: 'Check lock-in expiry dates; sudden selling pressure often coincides with these releases.',
    tags: ['supply', 'lock-in']
  },
  {
    title: 'Lock-in Period',
    shortForm: 'Lock-in',
    category: 'Ownership',
    description: 'Time span when certain shareholders (sponsors, placement holders) cannot sell their shares.',
    whyItMatters: 'Ensures commitment from key holders and prevents immediate dumping after listing.',
    watchFor: 'Price may face resistance near lock-in expiry. Monitor sponsor intentions and disclosures.',
    tags: ['governance', 'supply']
  }
];
