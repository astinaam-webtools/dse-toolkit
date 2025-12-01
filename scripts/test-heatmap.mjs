/**
 * Quick test for sector heatmap aggregation logic
 */

import { getSectorHeatmap } from '../src/lib/marketLogic.js';

// Sample test data
const sampleStocks = [
  {
    symbol: 'GP',
    name: 'Grameenphone',
    sector: 'Telecommunication',
    metrics: { mktCap: 50000, volume: 100000 },
    deltas: { price_1d: 2.5 }
  },
  {
    symbol: 'ROBI',
    name: 'Robi',
    sector: 'Telecommunication',
    metrics: { mktCap: 30000, volume: 80000 },
    deltas: { price_1d: -1.2 }
  },
  {
    symbol: 'SQURPHARMA',
    name: 'Square Pharma',
    sector: 'Pharmaceuticals',
    metrics: { mktCap: 45000, volume: 120000 },
    deltas: { price_1d: 1.8 }
  },
  {
    symbol: 'BEACONPHAR',
    name: 'Beacon Pharma',
    sector: 'Pharmaceuticals',
    metrics: { mktCap: 8000, volume: 50000 },
    deltas: { price_1d: 3.5 }
  },
  {
    symbol: 'BRAC',
    name: 'BRAC Bank',
    sector: 'Bank',
    metrics: { mktCap: 35000, volume: 90000 },
    deltas: { price_1d: -0.5 }
  }
];

console.log('Testing getSectorHeatmap...\n');

const sectors = getSectorHeatmap(sampleStocks);

console.log('Result:');
console.log(JSON.stringify(sectors, null, 2));

console.log('\n✅ Test completed!');

// Verify structure
sectors.forEach(sector => {
  console.log(`\nSector: ${sector.name}`);
  console.log(`  Stocks: ${sector.stockCount}`);
  console.log(`  Avg Change: ${sector.avgChange.toFixed(2)}%`);
  console.log(`  Total Mkt Cap: ${sector.totalMktCap.toFixed(0)}M`);
  console.log(`  Positive/Negative: ${sector.positiveCount}/${sector.negativeCount}`);
});
