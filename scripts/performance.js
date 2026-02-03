#!/usr/bin/env node

/**
 * Performance monitoring script
 * Tracks system health and prediction accuracy over time
 */

const { getDb, initDatabase } = require('./src/services/database');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/performance.jsonl');

initDatabase();
const db = getDb();

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function logPerformance() {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_bets,
      SUM(CASE WHEN result = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN result = 'pending' THEN 0
               WHEN profit > 0 THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'pending' THEN 0
               WHEN profit < 0 THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result = 'pending' THEN 0
               WHEN profit = 0 THEN 1 ELSE 0 END) as pushes,
      SUM(CASE WHEN result = 'pending' THEN 0
               ELSE ABS(profit) END) as total_staked,
      SUM(CASE WHEN result = 'pending' THEN 0
               ELSE profit END) as total_profit
    FROM paper_bets
  `).get();

  const roi = stats.total_staked > 0 
    ? (stats.total_profit / stats.total_staked * 100) 
    : 0;

  const winRate = (stats.total_bets - stats.pending) > 0
    ? (stats.wins / (stats.total_bets - stats.pending) * 100)
    : 0;

  const record = {
    timestamp: new Date().toISOString(),
    total_bets: stats.total_bets,
    pending: stats.pending,
    wins: stats.wins,
    losses: stats.losses,
    pushes: stats.pushes,
    win_rate: winRate.toFixed(2),
    total_staked: stats.total_staked,
    total_profit: stats.total_profit,
    roi: roi.toFixed(2)
  };

  // Log to file
  fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');

  // Print to console
  console.log('\n📊 PERFORMANCE REPORT');
  console.log('═══════════════════════════════════════');
  console.log(`   Total Bets: ${stats.total_bets}`);
  console.log(`   Pending: ${stats.pending}`);
  console.log(`   Wins: ${stats.wins} | Losses: ${stats.losses} | Pushes: ${stats.pushes}`);
  console.log(`   Win Rate: ${winRate.toFixed(1)}%`);
  console.log(`   Total Staked: $${stats.total_staked.toFixed(2)}`);
  console.log(`   Total Profit: $${stats.total_profit.toFixed(2)}`);
  console.log(`   ROI: ${roi.toFixed(2)}%`);
  console.log('═══════════════════════════════════════');

  return record;
}

// Run if called directly
if (require.main === module) {
  logPerformance();
}

module.exports = { logPerformance };
