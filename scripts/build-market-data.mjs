import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/dse');
const OUTPUT_FILE = path.join(__dirname, '../src/data/dse-market.json');

const DATE_FILE_RE = /^\d{4}-\d{2}-\d{2}\.csv$/;
const REQUIRED_HEADERS = ['Symbol'];

// Helper to parse CSV line respecting quotes
const parseCSVLine = (line) => {
  if (typeof line !== 'string') return [];

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

const cleanHeader = (header) =>
  String(header ?? '')
    .replace(/^"|"$/g, '')
    .trim();

const csvCache = new Map();

/**
 * Parse a market CSV. Returns [] for empty/invalid files instead of throwing,
 * so a bad n8n scrape day cannot abort the whole build.
 */
const parseCSV = async (filePath) => {
  if (csvCache.has(filePath)) return csvCache.get(filePath);

  const label = path.basename(filePath);
  const store = (rows) => {
    csvCache.set(filePath, rows);
    return rows;
  };

  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    console.warn(`  Skipping ${label}: cannot read (${err.code || err.message})`);
    return store([]);
  }

  if (!content || !content.trim()) {
    console.warn(`  Skipping ${label}: empty file`);
    return store([]);
  }

  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    console.warn(`  Skipping ${label}: no non-empty lines`);
    return store([]);
  }

  const headers = parseCSVLine(lines[0]).map(cleanHeader);
  if (headers.length === 0 || !headers.some(Boolean)) {
    console.warn(`  Skipping ${label}: missing header row`);
    return store([]);
  }

  const missingRequired = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingRequired.length > 0) {
    console.warn(
      `  Skipping ${label}: missing required column(s): ${missingRequired.join(', ')}`
    );
    return store([]);
  }

  if (lines.length < 2) {
    console.warn(`  Skipping ${label}: header only, no data rows`);
    return store([]);
  }

  const rows = [];
  let skippedRows = 0;

  for (const line of lines.slice(1)) {
    const values = parseCSVLine(line);
    if (!values.some((v) => v !== '')) {
      skippedRows += 1;
      continue;
    }

    const obj = {};
    headers.forEach((key, i) => {
      if (!key) return;

      let value = values[i];

      // Try to convert to number if possible, but keep as string if it fails or is empty
      if (value && !isNaN(Number(value)) && value !== '-') {
        value = Number(value);
      } else if (value === '-') {
        value = null;
      }

      obj[key] = value;
    });

    if (!obj.Symbol) {
      skippedRows += 1;
      continue;
    }

    rows.push(obj);
  }

  if (rows.length === 0) {
    console.warn(`  Skipping ${label}: no valid stock rows`);
    return store([]);
  }

  if (skippedRows > 0) {
    console.warn(`  ${label}: skipped ${skippedRows} invalid/blank row(s)`);
  }

  return store(rows);
};

/** Format a Date as YYYY-MM-DD using local calendar parts (not UTC). */
const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Closest usable file on/before target; skips files that parse empty. */
const loadClosestHistorical = async (files, latestDate, daysAgo) => {
  const targetDate = new Date(latestDate);
  if (Number.isNaN(targetDate.getTime())) return { file: null, rows: [] };
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const targetKey = toDateKey(targetDate);

  const eligible = files
    .filter((f) => f.replace('.csv', '') <= targetKey)
    .sort()
    .reverse();

  for (const file of eligible) {
    const rows = await parseCSV(path.join(DATA_DIR, file));
    if (rows.length > 0) return { file, rows };
  }

  return { file: null, rows: [] };
};

/**
 * List YYYY-MM-DD.csv files that are non-empty on disk.
 * Empty stubs from failed scrapes are excluded before date selection.
 */
const listValidCsvFiles = async () => {
  let entries;
  try {
    entries = await fs.readdir(DATA_DIR);
  } catch (err) {
    console.error(`Cannot read data directory ${DATA_DIR}:`, err.message);
    process.exit(1);
  }

  const candidates = entries.filter((f) => DATE_FILE_RE.test(f)).sort();
  const valid = [];
  const skipped = [];

  for (const file of candidates) {
    const fullPath = path.join(DATA_DIR, file);
    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile() || stat.size === 0) {
        skipped.push(`${file} (empty)`);
        continue;
      }
      valid.push(file);
    } catch (err) {
      skipped.push(`${file} (${err.code || err.message})`);
    }
  }

  if (skipped.length > 0) {
    console.warn(`Excluded ${skipped.length} unusable CSV file(s):`);
    for (const item of skipped) {
      console.warn(`  - ${item}`);
    }
  }

  return valid;
};

const calculateDelta = (current, previous) => {
  if (current == null || previous == null) return null;
  if (current === 0 && previous === 0) return 0;
  if (previous === 0) return null; // Avoid division by zero
  return ((current - previous) / previous) * 100;
};

const buildMarketData = async () => {
  try {
    // 1. Get usable CSV files (skip empty / unreadable stubs from n8n)
    const files = await listValidCsvFiles();

    if (files.length === 0) {
      console.error('No usable CSV files found in', DATA_DIR);
      process.exit(1);
    }

    // Walk newest → oldest until we find a file with real rows
    let latestFile = null;
    let currentData = [];

    for (let i = files.length - 1; i >= 0; i--) {
      const candidate = files[i];
      console.log(`Trying latest data: ${candidate}`);
      const rows = await parseCSV(path.join(DATA_DIR, candidate));
      if (rows.length > 0) {
        latestFile = candidate;
        currentData = rows;
        break;
      }
    }

    if (!latestFile || currentData.length === 0) {
      console.error('No CSV with valid stock rows found in', DATA_DIR);
      process.exit(1);
    }

    const latestDate = latestFile.replace('.csv', '');
    console.log(`Processing latest data: ${latestFile} (${currentData.length} stocks)`);

    // Files on or before the chosen market date (avoids future stubs if any)
    const usableFiles = files.filter((f) => f.replace('.csv', '') <= latestDate);

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
    const historicalMaps = {};

    console.log('Loading historical data for delta calculations...');

    for (const [period, days] of Object.entries(timePeriods)) {
      const { file: histFile, rows } = await loadClosestHistorical(
        usableFiles,
        latestDate,
        days
      );

      if (histFile && rows.length > 0) {
        console.log(`  ${period}: Using ${histFile} (${rows.length} stocks)`);
        historicalMaps[period] = new Map(rows.map((d) => [d.Symbol, d]));
      } else {
        console.log(`  ${period}: No data available`);
        historicalMaps[period] = new Map();
      }
    }

    // 3. Build Sparklines (Last 30 usable files on/before market date)
    const sparklineFiles = usableFiles.slice(Math.max(0, usableFiles.length - 30));
    const sparklineHistory = {}; // Symbol -> [price, price, ...]
    let sparklineUsed = 0;

    console.log(`Building sparklines from up to ${sparklineFiles.length} files...`);

    for (const file of sparklineFiles) {
      const data = await parseCSV(path.join(DATA_DIR, file));
      if (data.length === 0) continue;

      sparklineUsed += 1;
      data.forEach((row) => {
        if (!row.Symbol) return;
        if (!sparklineHistory[row.Symbol]) {
          sparklineHistory[row.Symbol] = [];
        }
        // Use 'Close' or 'LTP'
        sparklineHistory[row.Symbol].push(row.Close || row.LTP || 0);
      });
    }

    console.log(`  Sparkline days used: ${sparklineUsed}/${sparklineFiles.length}`);

    // 4. Transform to final JSON schema
    const stocks = currentData
      .filter((row) => row && row.Symbol)
      .map((row) => {
        const symbol = row.Symbol;

        // Helper to safely get number or null
        const getNum = (val) =>
          val !== null && val !== undefined && val !== '' && val !== '-'
            ? Number(val)
            : null;

        // Build deltas for all time periods
        const deltas = {};

        // Add price and volume deltas for all time periods
        for (const period of Object.keys(timePeriods)) {
          const histStock = historicalMaps[period].get(symbol);
          deltas[`price_${period}`] = calculateDelta(row.Close, histStock?.Close);
          deltas[`vol_${period}`] = calculateDelta(
            row['Volume(Qty)'],
            histStock?.['Volume(Qty)']
          );
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
            pb:
              row.LTP && row['NAV(Year End)']
                ? parseFloat((row.LTP / row['NAV(Year End)']).toFixed(2))
                : null,

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

    if (stocks.length === 0) {
      console.error('Build produced zero stocks after validation');
      process.exit(1);
    }

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
