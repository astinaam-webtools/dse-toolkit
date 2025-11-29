export const terms = [
  {
    title: 'Price-to-Earnings Ratio',
    shortForm: 'P/E',
    category: 'Valuation',
    description: 'Compares a share price to the earnings per share generated over the last 12 months.',
    whyItMatters: 'Shows how many Bangladeshi taka investors are willing to pay for 1 taka of earnings. Helps compare whether the stock is priced above or below the market average.',
    watchFor: 'For blue-chip DSE names, a trailing P/E below ~15 often signals value if earnings quality is stable. A P/E above ~25 needs strong growth visibility or it can mean the stock is overheated.',
    chartGuideId: 'pe',
    tags: ['valuation', 'earnings', 'blue-chip']
  },
  {
    title: 'Earnings Per Share',
    shortForm: 'EPS',
    category: 'Profitability',
    description: 'Net profit attributable to each ordinary share after tax and preference dividends.',
    whyItMatters: 'Rising EPS is the fuel for dividend growth and capital gains. It signals that a company can reinvest and distribute cash.',
    watchFor: 'Look for a positive multi-year EPS trend and limited volatility. Single-quarter spikes without operational reasons often reverse.',
    chartGuideId: 'eps',
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
    chartGuideId: 'dividend-yield',
    tags: ['income', 'cash-flow']
  },
  {
    title: 'Debt-to-Equity Ratio',
    shortForm: 'D/E',
    category: 'Leverage',
    description: 'Total interest-bearing debt divided by shareholder equity.',
    whyItMatters: 'Measures balance-sheet risk and sensitivity to interest rate hikes.',
    watchFor: 'Manufacturers with D/E below 0.8 are generally safer. Above 1.5 can stress cash flows when Bangladesh Bank tightens policy.',
    chartGuideId: 'de',
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
    chartGuideId: 'beta',
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
    chartGuideId: 'market-depth',
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
  },
  {
    title: 'Volume Weighted Average Price',
    shortForm: 'VWAP',
    category: 'Trading',
    description: 'Intraday average price weighted by traded volume. Shows where the majority of shares exchanged hands.',
    whyItMatters: 'Institutions benchmark their fills against VWAP. Staying above VWAP confirms demand; dipping below hints at supply pressure.',
    watchFor: 'For accumulation, wait for price reclaiming VWAP with volume spike; for trimming speculative names, note repeated failures above VWAP.',
    chartGuideId: 'vwap',
    tags: ['intraday', 'momentum']
  },
  {
    title: 'Yesterday’s Closing Price',
    shortForm: 'YCP',
    category: 'Basics',
    description: 'Official close from the previous trading day used as the reference for today’s percentage change.',
    whyItMatters: 'Helps gauge current session strength versus prior day and is used in DSE circuit calculations.',
    watchFor: 'A series of opens above YCP with higher lows suggests accumulation; drifting below YCP after gap-ups signals weak conviction.',
    chartGuideId: 'ycp',
    tags: ['price-action', 'sentiment']
  },
  {
    title: 'Face Value',
    shortForm: 'FV',
    category: 'Corporate Basics',
    description: 'Par value assigned to each share (usually Tk 10) used for dividend, rights, and bonus calculations.',
    whyItMatters: 'Determines how cash/stock dividends are quoted and affects EPS comparability between Tk 10 and Tk 100 face value stocks.',
    watchFor: 'If EPS looks tiny, check whether the face value is Tk 100; convert before comparing peers.',
    chartGuideId: 'face-value',
    tags: ['par-value', 'dividends']
  },
  {
    title: 'Relative Strength Index',
    shortForm: 'RSI',
    category: 'Momentum',
    description: 'Oscillator that measures the speed of price changes on a 0–100 scale.',
    whyItMatters: 'Highlights overbought/oversold zones to improve entries and exits, especially for growth or defensive trims.',
    watchFor: 'RSI below 30 with improving fundamentals can mark long-term accumulation zones; above 70 warns to wait for pullbacks.',
    chartGuideId: 'rsi',
    tags: ['technical', 'timing']
  },
  {
    title: 'Simple Moving Average',
    shortForm: 'MA',
    category: 'Trend',
    description: 'Average closing price over a fixed window (e.g., 50 or 200 days).',
    whyItMatters: 'Shows the prevailing trend and dynamic support/resistance widely watched by institutions.',
    watchFor: 'Price holding above MA(200) with MA(50) sloping up confirms long-term trend; slices below both signal caution.',
    chartGuideId: 'ma',
    tags: ['trend', 'technical']
  },
  {
    title: 'Exponential Moving Average',
    shortForm: 'EMA',
    category: 'Trend',
    description: 'Moving average that weights recent prices more heavily than older ones.',
    whyItMatters: 'React faster to price changes—useful for spotting rotations earlier than the SMA.',
    watchFor: 'EMA(20) reclaim on rising volume often precedes breakouts; losing EMA(50) suggests momentum fading.',
    chartGuideId: 'ema',
    tags: ['trend', 'momentum']
  },
  {
    title: 'Reserves & Surplus',
    shortForm: 'Reserves',
    category: 'Balance Sheet',
    description: 'Accumulated profits retained in the business (including statutory reserves).',
    whyItMatters: 'Large reserves provide a cushion for dividends, bonus shares, and crisis absorption.',
    watchFor: 'Growing reserves alongside low payout ratio signals capacity for both growth and income strategies.',
    chartGuideId: 'reserves',
    tags: ['buffer', 'dividend-power']
  },
  {
    title: 'Short-term Loan',
    shortForm: 'ST Loan',
    category: 'Leverage',
    description: 'Working-capital borrowing due within 12 months (bank overdrafts, trust receipts).',
    whyItMatters: 'Excessive ST loans can choke cash flow and force dilutive rights issues.',
    watchFor: 'Compare ST loans to inventory/receivables; if they balloon without revenue growth, liquidity risk rises.',
    chartGuideId: 'short-term-loan',
    tags: ['liquidity', 'risk']
  },
  {
    title: 'Long-term Loan',
    shortForm: 'LT Loan',
    category: 'Leverage',
    description: 'Debt maturing beyond one year (project finance, term loans).',
    whyItMatters: 'Supports expansion but adds interest burden that can cap dividends.',
    watchFor: 'Match LT loans with asset growth; if ROE falls below interest cost, reassess.',
    chartGuideId: 'long-term-loan',
    tags: ['capital-structure', 'expansion']
  },
  {
    title: 'Block Trade',
    shortForm: 'Block',
    category: 'Trading',
    description: 'Large negotiated transaction executed outside the regular order book.',
    whyItMatters: 'Reveals institutional intent—buy blocks can signal smart money accumulation, sell blocks may precede supply.',
    watchFor: 'Block price premium to market indicates demand; big discount warns of upcoming pressure.',
    chartGuideId: 'block-trade',
    tags: ['institutional', 'flow']
  },
  {
    title: 'Symbol',
    shortForm: 'Symbol',
    category: 'Basics',
    description: 'The unique ticker code assigned to each listed company on the stock exchange.',
    whyItMatters: 'Identifies the company for trading and portfolio tracking. Essential for placing orders and researching stocks.',
    watchFor: 'Some companies may have similar-sounding symbols. Always verify the full company name before trading.',
    tags: ['basics', 'trading']
  },
  {
    title: 'Company',
    shortForm: 'Company',
    category: 'Basics',
    description: 'The full registered name of the listed entity.',
    whyItMatters: 'Helps distinguish between companies with similar business models or names, especially when reviewing fundamentals.',
    watchFor: 'Check for subsidiary relationships or group structures that may affect consolidated results.',
    tags: ['basics', 'corporate']
  },
  {
    title: 'Sector',
    shortForm: 'Sector',
    category: 'Basics',
    description: 'The broad industry category (e.g., Banking, Pharma, Textiles) that a company operates in.',
    whyItMatters: 'Sector trends drive stock performance. Understanding sector exposure helps with diversification and cyclical analysis.',
    watchFor: 'Defensive sectors (pharma, utilities) hold better in downturns; cyclical sectors (textiles, cement) amplify economic swings.',
    tags: ['classification', 'diversification']
  },
  {
    title: 'Category',
    shortForm: 'Category',
    category: 'Basics',
    description: 'Sub-classification within the exchange listing structure (e.g., A, B, G, N, Z categories on DSE).',
    whyItMatters: 'Category affects trading rules, margin requirements, and investor eligibility on DSE.',
    watchFor: 'Z-category stocks face restrictions and higher risk. A and B categories generally offer better liquidity.',
    tags: ['classification', 'regulation']
  },
  {
    title: 'Last Traded Price',
    shortForm: 'LTP',
    category: 'Trading',
    description: 'The most recent price at which a stock was bought or sold during the trading session.',
    whyItMatters: 'Represents the current market value and is used to calculate unrealized gains/losses in your portfolio.',
    watchFor: 'LTP on low volume can be deceptive. Always check volume and spread to confirm genuine price discovery.',
    tags: ['price', 'real-time']
  },
  {
    title: 'Percentage Change',
    shortForm: '%',
    category: 'Trading',
    description: 'The percentage change between the current LTP and yesterday\'s closing price.',
    whyItMatters: 'Quick snapshot of daily performance. Helps identify momentum, sector rotation, or news impact.',
    watchFor: 'Extreme single-day moves (>±5%) without news often reverse. Look for volume confirmation on breakouts.',
    tags: ['performance', 'momentum']
  },
  {
    title: 'Close',
    shortForm: 'Close',
    category: 'Trading',
    description: 'The official closing price at the end of the trading session.',
    whyItMatters: 'Used for chart plotting, portfolio valuation, and calculating daily returns. Critical for technical analysis.',
    watchFor: 'Closing price formation matters—strong close near session high signals buying pressure; weak close hints distribution.',
    tags: ['price', 'technical']
  },
  {
    title: 'Value (Turnover)',
    shortForm: 'Value',
    category: 'Trading',
    description: 'Total monetary value of shares traded during the session (price × volume).',
    whyItMatters: 'High turnover indicates institutional interest and liquidity. Low turnover makes entry/exit difficult.',
    watchFor: 'For blue chips, daily turnover >Tk 50 mn ensures decent liquidity. Sudden spikes may signal informed buying or selling.',
    tags: ['liquidity', 'volume']
  },
  {
    title: 'Volume (Quantity)',
    shortForm: 'Volume',
    category: 'Trading',
    description: 'Total number of shares exchanged hands during the trading session.',
    whyItMatters: 'Confirms price moves. Rising price on rising volume is bullish; rising price on falling volume warns of exhaustion.',
    watchFor: 'Compare today\'s volume to 20-day average.Volume spikes with breakouts or breakdowns validate the move.',
    tags: ['volume', 'confirmation']
  },
  {
    title: 'Relative Strength Index (14-period)',
    shortForm: 'RSI [14]',
    category: 'Momentum',
    description: 'Momentum oscillator measuring speed of price changes over 14 periods (typically days).',
    whyItMatters: 'Identifies overbought (>70) and oversold (<30) conditions to time entries and exits.',
    watchFor: 'RSI divergence from price (lower highs in RSI, higher highs in price) often precedes reversals.',
    chartGuideId: 'rsi',
    tags: ['technical', 'oscillator', 'timing']
  },
  {
    title: 'Williams Percent Range (14-period)',
    shortForm: 'Williams %R [14]',
    category: 'Momentum',
    description: 'Oscillator measuring where the current price sits relative to the 14-day high-low range.',
    whyItMatters: 'Ranges from -100 (oversold) to 0 (overbought). Complements RSI for momentum confirmation.',
    watchFor: 'Readings below -80 with improving fundamentals suggest accumulation zones; above -20 warns of short-term froth.',
    tags: ['technical', 'oscillator', 'momentum']
  },
  {
    title: 'Simple Moving Average (20-day)',
    shortForm: 'SMA [20]',
    category: 'Trend',
    description: 'Average closing price over the last 20 trading days.',
    whyItMatters: 'Acts as short-term trend gauge and dynamic support/resistance. Widely used for swing trading.',
    watchFor: 'Price holding above SMA(20) with slope up confirms near-term strength; breakdown suggests short-term weakness.',
    chartGuideId: 'ma',
    tags: ['trend', 'technical', 'support']
  },
  {
    title: 'Simple Moving Average (50-day)',
    shortForm: 'SMA [50]',
    category: 'Trend',
    description: 'Average closing price over the last 50 trading days.',
    whyItMatters: 'Intermediate trend indicator. Crossing above/below SMA(200) (golden/death cross) signals major trend changes.',
    watchFor: 'SMA(50) crossing above SMA(200) with volume often marks start of sustained uptrends.',
    chartGuideId: 'ma',
    tags: ['trend', 'technical', 'golden-cross']
  },
  {
    title: 'Simple Moving Average (200-day)',
    shortForm: 'SMA [200]',
    category: 'Trend',
    description: 'Average closing price over the last 200 trading days.',
    whyItMatters: 'Long-term trend barometer. Price above SMA(200) indicates bull market; below signals bear territory.',
    watchFor: 'Investors often add positions when quality stocks dip to SMA(200) support with positive fundamentals.',
    chartGuideId: 'ma',
    tags: ['trend', 'technical', 'long-term']
  },
  {
    title: 'Exponential Moving Average (9-day)',
    shortForm: 'EMA [9]',
    category: 'Trend',
    description: 'Exponentially weighted average over 9 periods, giving more weight to recent prices.',
    whyItMatters: 'Highly responsive to recent price action. Used in MACD calculation and short-term trading.',
    watchFor: 'EMA(9) crossing above EMA(26) can signal early momentum shift before slower indicators react.',
    chartGuideId: 'ema',
    tags: ['trend', 'momentum', 'technical']
  },
  {
    title: 'Exponential Moving Average (12-day)',
    shortForm: 'EMA [12]',
    category: 'Trend',
    description: 'Exponentially weighted average over 12 periods. Key component of MACD indicator.',
    whyItMatters: 'Faster than SMA, captures trend shifts earlier. Part of the MACD calculation.',
    watchFor: 'Used in conjunction with EMA(26) to generate MACD line signals.',
    chartGuideId: 'ema',
    tags: ['trend', 'MACD', 'technical']
  },
  {
    title: 'Exponential Moving Average (26-day)',
    shortForm: 'EMA [26]',
    category: 'Trend',
    description: 'Exponentially weighted average over 26 periods. Slower EMA component in MACD calculation.',
    whyItMatters: 'Provides context for intermediate trend. Paired with EMA(12) to create MACD line.',
    watchFor: 'Price holding above EMA(26) with rising slope confirms bullish intermediate trend.',
    chartGuideId: 'ema',
    tags: ['trend', 'MACD', 'technical']
  },
  {
    title: 'Moving Average Convergence Divergence',
    shortForm: 'MACD [12,26]',
    category: 'Momentum',
    description: 'Difference between EMA(12) and EMA(26). Measures momentum and trend strength.',
    whyItMatters: 'MACD crossovers signal potential trend changes. Bullish when MACD crosses above signal line.',
    watchFor: 'MACD histogram expansion shows strong momentum; compression warns of slowdown. Watch for divergences.',
    tags: ['momentum', 'technical', 'trend']
  },
  {
    title: 'MACD Signal Line (9-period)',
    shortForm: 'MACD Signal [9]',
    category: 'Momentum',
    description: '9-period EMA of the MACD line. Used as trigger for buy/sell signals.',
    whyItMatters: 'MACD crossing above signal line is bullish; crossing below is bearish. Core trend-following signal.',
    watchFor: 'Confirm MACD crossovers with volume and price action to avoid false signals in choppy markets.',
    tags: ['momentum', 'signal', 'technical']
  },
  {
    title: 'Bollinger Band Upper',
    shortForm: 'BB Upper [20,2]',
    category: 'Volatility',
    description: 'Upper band set at 2 standard deviations above the 20-day SMA.',
    whyItMatters: 'Represents overbought extreme. Price touching upper band with low volume can signal exhaustion.',
    watchFor: 'Sustained trading above upper band with volume shows strong momentum; brief touches often reverse.',
    tags: ['volatility', 'technical', 'bands']
  },
  {
    title: 'Bollinger Band Lower',
    shortForm: 'BB Lower [20,2]',
    category: 'Volatility',
    description: 'Lower band set at 2 standard deviations below the 20-day SMA.',
    whyItMatters: 'Represents oversold extreme. Can identify value entry points when fundamentals are intact.',
    watchFor: 'Touches to lower band on quality stocks with good fundamentals can offer accumulation opportunities.',
    tags: ['volatility', 'technical', 'bands']
  },
  {
    title: 'Trade Volume Index',
    shortForm: 'TV [22]',
    category: 'Volume',
    description: 'Volume-weighted indicator over 22 periods showing accumulation or distribution patterns.',
    whyItMatters: 'Rising TV suggests accumulation (smart money buying); falling TV indicates distribution (selling pressure).',
    watchFor: 'TV trending up while price consolidates often precedes breakouts.',
    tags: ['volume', 'accumulation', 'technical']
  },
  {
    title: 'Chaikin Oscillator',
    shortForm: 'CO [3,10]',
    category: 'Volume',
    description: 'Difference between 3-day and 10-day EMAs of the Accumulation/Distribution line.',
    whyItMatters: 'Measures momentum of accumulation/distribution. Positive values suggest buying pressure.',
    watchFor: 'CO crossing above zero confirms accumulation; below zero warns of distribution. Look for divergences with price.',
    tags: ['volume', 'momentum', 'technical']
  },
  {
    title: 'Weighted Moving Average (9-day)',
    shortForm: 'WMA [9]',
    category: 'Trend',
    description: 'Weighted moving average over 9 periods, with linear weighting favoring recent prices.',
    whyItMatters: 'More responsive than SMA, less smooth than EMA. Used for short-term trend identification.',
    watchFor: 'Price crossing above WMA(9) with volume can signal short-term momentum shift.',
    tags: ['trend', 'technical', 'short-term']
  },
  {
    title: 'Weighted Moving Average (12-day)',
    shortForm: 'WMA [12]',
    category: 'Trend',
    description: 'Weighted moving average over 12 periods with linear recent price weighting.',
    whyItMatters: 'Balances responsiveness and smoothness for intermediate-term trend tracking.',
    watchFor: 'WMA crossovers with price can confirm trend changes when combined with volume.',
    tags: ['trend', 'technical', 'intermediate']
  },
  {
    title: 'Weighted Moving Average (20-day)',
    shortForm: 'WMA [20]',
    category: 'Trend',
    description: 'Weighted moving average over 20 periods, providing dynamic support/resistance.',
    whyItMatters: 'Popular for swing trading. Reacts faster than SMA(20) to price changes.',
    watchFor: 'Price bouncing off WMA(20) multiple times establishes it as strong support/resistance.',
    tags: ['trend', 'technical', 'swing-trading']
  },
  {
    title: 'Beta (5-year)',
    shortForm: 'Beta [5]',
    category: 'Risk',
    description: 'Statistical measure of stock volatility versus DSEX over 5 years.',
    whyItMatters: 'Longer timeframe beta provides more stable risk assessment for portfolio construction.',
    watchFor: 'Beta < 0.8 suits conservative portfolios; > 1.2 indicates aggressive, cyclical exposure.',
    chartGuideId: 'beta',
    tags: ['risk', 'volatility', 'long-term']
  },
  {
    title: 'Current Ratio',
    shortForm: 'Current Ratio',
    category: 'Liquidity',
    description: 'Current assets divided by current liabilities. Measures short-term financial health.',
    whyItMatters: 'Ratio > 1.5 shows the company can cover near-term obligations without stress.',
    watchFor: 'Below 1.0 signals liquidity concerns. Above 3.0 may mean inefficient capital deployment.',
    tags: ['liquidity', 'balance-sheet', 'safety']
  },
  {
    title: 'Quick Ratio',
    shortForm: 'Quick Ratio',
    category: 'Liquidity',
    description: '(Current Assets - Inventory) / Current Liabilities. Stricter liquidity test.',
    whyItMatters: 'Excludes inventory to show ability to meet obligations with liquid assets only.',
    watchFor: 'Quick ratio > 1.0 is healthy for most sectors. Below 0.5 raises red flags on cash management.',
    tags: ['liquidity', 'balance-sheet', 'conservative']
  },
  {
    title: 'EBITDA Margin',
    shortForm: 'EBITDA Margin',
    category: 'Profitability',
    description: 'EBITDA as a percentage of revenue. Shows operational efficiency before financing and taxes.',
    whyItMatters: 'Higher margins indicate pricing power and operational leverage. Useful for cross-sector comparisons.',
    watchFor: 'Margins > 20% are strong for most sectors. Falling margins despite revenue growth signal cost pressure.',
    tags: ['profitability', 'efficiency', 'margins']
  },
  {
    title: 'Operating Profit Margin',
    shortForm: 'Operating Profit Margin',
    category: 'Profitability',
    description: 'Operating profit divided by revenue. Measures core business profitability.',
    whyItMatters: 'Excludes one-time items and financial engineering, showing true operational performance.',
    watchFor: 'Consistent or expanding operating margins over 3-5 years signal competitive advantage.',
    tags: ['profitability', 'core-business', 'quality']
  },
  {
    title: 'Net Profit Margin',
    shortForm: 'Net Profit Margin',
    category: 'Profitability',
    description: 'Net profit after all expenses, taxes, and interest as percentage of revenue.',
    whyItMatters: 'Bottom-line measure of overall profitability and cost management.',
    watchFor: 'For DSE blue chips, 10-15% net margin is solid. Below 5% limits dividend capacity.',
    tags: ['profitability', 'bottom-line', 'earnings']
  },
  {
    title: 'Gross Profit Margin',
    shortForm: 'Gross Profit Margin',
    category: 'Profitability',
    description: 'Gross profit (revenue minus cost of goods sold) as percentage of revenue.',
    whyItMatters: 'Reflects pricing power and production efficiency before operating expenses.',
    watchFor: 'Stable or rising gross margin shows pricing power. Compression warns of competitive or input cost pressure.',
    tags: ['profitability', 'pricing-power', 'efficiency']
  },
  {
    title: 'Return on Assets',
    shortForm: 'ROA',
    category: 'Profitability',
    description: 'Net income divided by total assets. Shows how efficiently a company uses assets to generate profit.',
    whyItMatters: 'High ROA indicates capital-light, efficient businesses. Particularly important for asset-heavy sectors.',
    watchFor: 'For banks, ROA > 1% is healthy. For manufacturers, > 5% shows good asset utilization.',
    tags: ['efficiency', 'asset-utilization', 'quality']
  },
  {
    title: 'Return on Earnings Assets',
    shortForm: 'ROEA',
    category: 'Profitability',
    description: 'Net income divided by earning assets (common in banking to measure productive asset efficiency).',
    whyItMatters: 'For banks and financial institutions, shows how well loans and investments generate returns.',
    watchFor: 'Compare ROEA across banks. Higher ROEA with lower NPL indicates superior credit quality.',
    tags: ['banking', 'efficiency', 'returns']
  },
  {
    title: 'Return on Investment',
    shortForm: 'ROI',
    category: 'Profitability',
    description: 'Gain from investment relative to cost. Can apply to projects, capex, or overall capital.',
    whyItMatters: 'Measures capital allocation effectiveness. High ROI projects compound shareholder value faster.',
    watchFor: 'Consistent ROI > cost of capital signals management discipline and competitive moat.',
    tags: ['returns', 'capital-allocation', 'efficiency']
  },
  {
    title: 'NAV at Year End',
    shortForm: 'NAV(Year End)',
    category: 'Balance Sheet',
    description: 'Net Asset Value per share calculated at the fiscal year end based on audited financials.',
    whyItMatters: 'Provides a stable, audited baseline for valuation. Less volatile than quarterly NAV.',
    watchFor: 'Year-end NAV growth rate indicates capital compounding ability. Use for annual P/B comparisons.',
    tags: ['valuation', 'balance-sheet', 'annual']
  },
  {
    title: 'Audited Price-to-Earnings',
    shortForm: 'Audited PE',
    category: 'Valuation',
    description: 'P/E ratio calculated using full-year audited earnings rather than trailing estimates.',
    whyItMatters: 'More reliable than quarterly or estimated P/E. Removes accounting noise and one-off items.',
    watchFor: 'Compare audited PE across years to identify genuine valuation trends vs temporary distortions.',
    tags: ['valuation', 'reliability', 'earnings']
  },
  {
    title: 'Forward Price-to-Earnings',
    shortForm: 'Forward PE',
    category: 'Valuation',
    description: 'Current price divided by projected earnings for the next 12 months.',
    whyItMatters: 'Incorporates growth expectations. Lower forward PE than trailing PE suggests expected earnings growth.',
    watchFor: 'Forward PE relies on estimates—verify management guidance and analyst track record before trusting.',
    tags: ['valuation', 'forecast', 'growth']
  },
  {
    title: 'Paid-Up Capital',
    shortForm: 'PaidUp Capital',
    category: 'Corporate Basics',
    description: 'Total par value of issued and fully paid shares. Represents capital actually received from shareholders.',
    whyItMatters: 'Base for calculating many ratios. Changes with bonus issues, splits, or capital calls.',
    watchFor: 'Frequent paid-up capital increases via rights (not bonus) may signal capital inefficiency or high capital needs.',
    tags: ['capital-structure', 'equity', 'basics']
  },
  {
    title: 'Total Shares Outstanding',
    shortForm: 'Total Shares',
    category: 'Corporate Basics',
    description: 'Total number of shares issued and held by all shareholders (sponsors, institutions, public).',
    whyItMatters: 'Used to calculate market cap, EPS, and per-share metrics. Dilution increases this number.',
    watchFor: 'Track changes over time. Bonus shares increase count without dilution; rights issues dilute existing holders who don\'t participate.',
    tags: ['equity', 'dilution', 'basics']
  }
];
