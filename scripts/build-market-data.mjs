import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/dse');
const OUTPUT_FILE = path.join(__dirname, '../src/data/dse-market.json');

// Helper to parse CSV line respecting quotes
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseCSV = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((header, i) => {
      // Clean header name (remove quotes, extra spaces)
      const key = header.replace(/^"|"$/g, '').trim();
      let value = values[i];
      
      // Try to convert to number if possible, but keep as string if it fails or is empty
      if (value && !isNaN(Number(value)) && value !== '-') {
        value = Number(value);
      } else if (value === '-') {
        value = null;
      }
      
      obj[key] = value;
    });
    return obj;
  });
};

const getFileByOffset = (files, currentIndex, offsetDays) => {
  // This is a simplified logic. In a real scenario, we'd parse dates from filenames
  // and find the closest match. For now, assuming daily files, we just use index.
  // If files are missing, this might be inaccurate, but sufficient for MVP.
  const targetIndex = currentIndex - offsetDays;
  return targetIndex >= 0 ? files[targetIndex] : null;
};

// Find file closest to target date based on actual date parsing
const getFileByDate = (files, latestDate, daysAgo) => {
  const targetDate = new Date(latestDate);
  targetDate.setDate(targetDate.getDate() - daysAgo);
  
  // Find the closest file to the target date (on or before)
  let closestFile = null;
  let closestDiff = Infinity;
  
  for (const file of files) {
    const fileDate = new Date(file.replace('.csv', ''));
    const diff = targetDate - fileDate;
    
    // Only consider files on or before target date
    if (diff >= 0 && diff < closestDiff) {
      closestDiff = diff;
      closestFile = file;
    }
  }
  
  return closestFile;
};

const calculateDelta = (current, previous) => {
  if (!current || !previous) return null;
  if (current === 0 && previous === 0) return 0;
  if (previous === 0) return null; // Avoid division by zero
  return ((current - previous) / previous) * 100;
};

const buildMarketData = async () => {
  try {
    // 1. Get all CSV files
    const files = (await fs.readdir(DATA_DIR))
      .filter(f => f.endsWith('.csv'))
      .sort(); // YYYY-MM-DD sorts alphabetically correctly

    if (files.length === 0) {
      console.error('No CSV files found in', DATA_DIR);
      process.exit(1);
    }

    const latestFile = files[files.length - 1];
    const latestDate = latestFile.replace('.csv', '');
    
    console.log(`Processing latest data: ${latestFile}`);
    
    // 2. Parse files
    const currentData = await parseCSV(path.join(DATA_DIR, latestFile));
    
    // Define time periods for delta calculations
    // Days approximation: 1d=1, 1w=7, 1m=30, 6m=180, 1y=365, etc.
    const timePeriods = {
      '1d': 1,
      '1w': 7,
      '1m': 30,
      '6m': 180,
      '1y': 365,
      '2y': 730,
      '3y': 1095,
      '4y': 1460,
      '5y': 1825,
      '6y': 2190,
      '7y': 2555,
      '8y': 2920,
      '9y': 3285,
      '10y': 3650,
      '11y': 4015,
      '12y': 4380,
      '13y': 4745,
      '14y': 5110,
      '15y': 5475
    };
    
    // Load historical data for each time period
    const historicalData = {};
    const historicalMaps = {};
    
    console.log('Loading historical data for delta calculations...');
    
    for (const [period, days] of Object.entries(timePeriods)) {
      const histFile = getFileByDate(files, latestDate, days);
      if (histFile) {
        console.log(`  ${period}: Using ${histFile}`);
        historicalData[period] = await parseCSV(path.join(DATA_DIR, histFile));
        historicalMaps[period] = new Map(historicalData[period].map(d => [d.Symbol, d]));
      } else {
        console.log(`  ${period}: No data available`);
        historicalMaps[period] = new Map();
      }
    }

    // 3. Build Sparklines (Last 30 files)
    // We need to read the last 30 files to get the closing price history
    const sparklineFiles = files.slice(Math.max(0, files.length - 30));
    const sparklineHistory = {}; // Symbol -> [price, price, ...]
    
    console.log(`Building sparklines from ${sparklineFiles.length} files...`);
    
    for (const file of sparklineFiles) {
      const data = await parseCSV(path.join(DATA_DIR, file));
      data.forEach(row => {
        if (!sparklineHistory[row.Symbol]) {
          sparklineHistory[row.Symbol] = [];
        }
        // Use 'Close' or 'LTP'
        sparklineHistory[row.Symbol].push(row.Close || row.LTP || 0);
      });
    }

    // 4. Transform to final JSON schema
    const stocks = currentData.map(row => {
      const symbol = row.Symbol;
      
      // Helper to safely get number or null
      const getNum = (val) => (val !== null && val !== undefined && val !== '' && val !== '-') ? Number(val) : null;

      // Build deltas for all time periods
      const deltas = {};
      
      // Add price and volume deltas for all time periods
      for (const period of Object.keys(timePeriods)) {
        const histStock = historicalMaps[period].get(symbol);
        deltas[`price_${period}`] = calculateDelta(row.Close, histStock?.Close);
        deltas[`vol_${period}`] = calculateDelta(row['Volume(Qty)'], histStock?.['Volume(Qty)']);
      }

      return {
        symbol: row.Symbol,
        name: row.Company,
        sector: row.Sector,
        category: row.Category,
        metrics: {
          ltp: getNum(row.LTP),
          close: getNum(row.Close),
          pe: getNum(row.PE),
          rsi: getNum(row['RSI [14]']),
          macd: getNum(row['MACD [12,26]']),
          macdSignal: getNum(row['MACD Signal [9]']),
          volume: getNum(row['Volume(Qty)']),
          value: getNum(row['Value(Turnover) (mn)']),
          mktCap: getNum(row['Market Cap (mn)']),
          nav: getNum(row['NAV(Year End)']),
          eps: getNum(row.EPS),
          dividendYield: getNum(row['Dividend Yield']),
          beta: getNum(row['Beta [5]']),
          pb: (row.LTP && row['NAV(Year End)']) ? parseFloat((row.LTP / row['NAV(Year End)']).toFixed(2)) : null,
          
          // Additional fields requested
          williamsR: getNum(row['Willams %R [14]']),
          sma20: getNum(row['SMA [20]']),
          sma50: getNum(row['SMA [50]']),
          sma200: getNum(row['SMA [200]']),
          ema9: getNum(row['EMA [9]']),
          ema12: getNum(row['EMA [12]']),
          ema26: getNum(row['EMA [26]']),
          bbUpper: getNum(row['BB Upper [20,2]']),
          bbLower: getNum(row['BB Lower [20,2]']),
          tv: getNum(row['TV [22]']),
          co: getNum(row['CO [3,10]']),
          wma9: getNum(row['WMA [9]']),
          wma12: getNum(row['WMA [12]']),
          wma20: getNum(row['WMA [20]']),
          currentRatio: getNum(row['Current Ratio']),
          quickRatio: getNum(row['Quick Ratio']),
          debtToEquity: getNum(row['Debt To Equity']),
          ebitdaMargin: getNum(row['EBITDA Margin']),
          operatingMargin: getNum(row['Operating Profit Margin']),
          netMargin: getNum(row['Net Profit Margin']),
          grossMargin: getNum(row['Gross Profit Margin']),
          roa: getNum(row['Return on Assets (ROA)']),
          roe: getNum(row['Return on Equity (ROE)']),
          roea: getNum(row['Return on Earnings Assets (ROEA)']),
          roi: getNum(row['Return on Investment (ROI)']),
          auditedPe: getNum(row['Audited PE']),
          forwardPe: getNum(row['Forward PE']),
          paidUpCapital: getNum(row['PaidUp Capital']),
          totalShares: getNum(row['Total Shares'])
        },
        deltas,
        sparkline: sparklineHistory[symbol] || []
      };
    });

    const output = {
      metadata: {
        generatedAt: new Date().toISOString(),
        marketDate: latestDate,
        totalStocks: stocks.length
      },
      stocks
    };

    // 5. Write output
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
    
    console.log(`Successfully generated ${OUTPUT_FILE}`);
    console.log(`Total stocks: ${stocks.length}`);

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
};

buildMarketData();
