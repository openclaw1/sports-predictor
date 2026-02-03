#!/usr/bin/env node

/**
 * Sports Predictor - Main Entry Point
 * 
 * Usage:
 *   node cli.js fetch        - Fetch today's games
 *   node cli.js predict      - Generate predictions
 *   node cli.js bet          - Place paper bets
 *   node cli.js stats        - Show betting stats
 *   node cli.js run          - Run full daily cycle
 *   node cli.js dashboard    - Start web dashboard
 */

const { initDatabase } = require('./services/database');
const predictionEngine = require('./models/predictionEngine');
const paperBetting = require('./services/paperBetting');
const cron = require('node-cron');

// Initialize
initDatabase();

const command = process.argv[2] || 'help';

async function runCommand() {
  switch (command) {
    case 'fetch':
      console.log('📊 Fetching today\'s games...');
      const results = await predictionEngine.fetchAndStoreGames();
      console.log('Results:', results);
      break;

    case 'predict':
      console.log('🎯 Generating predictions...');
      const predictions = await predictionEngine.generatePredictionsForToday();
      console.log(`Generated ${predictions.length} predictions`);
      predictions.forEach(({ game, prediction }) => {
        console.log(`  ${game.home_team} vs ${game.away_team}`);
        console.log(`    → Winner: ${prediction.predicted_winner} (${(prediction.confidence * 100).toFixed(1)}%)`);
      });
      break;

    case 'bet':
      console.log('💰 Placing paper bets...');
      const betResult = await paperBetting.placeBets();
      console.log(betResult);
      break;

    case 'stats':
      console.log('📈 Betting Statistics:');
      const stats = paperBetting.getStats();
      Object.entries(stats).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      break;

    case 'run':
      console.log('🚀 Running full daily cycle...');
      await predictionEngine.fetchAndStoreGames();
      await predictionEngine.generatePredictionsForToday();
      const result = await paperBetting.placeBets();
      console.log('✅ Cycle complete:', result);
      break;

    case 'dashboard':
      console.log('🌐 Starting dashboard...');
      startDashboard();
      break;

    case 'cron':
      // Scheduled job - runs prediction + betting cycle
      console.log('⏰ Scheduled job running...');
      await predictionEngine.fetchAndStoreGames();
      await predictionEngine.generatePredictionsForToday();
      await paperBetting.placeBets();
      console.log('✅ Scheduled job complete');
      break;

    case 'help':
    default:
      console.log(`
Sports Predictor CLI

Commands:
  fetch      - Fetch today's games from API
  predict    - Generate predictions for upcoming games
  bet        - Place paper bets based on predictions
  stats      - Show betting statistics
  run        - Run full daily cycle (fetch + predict + bet)
  dashboard  - Start web dashboard
  cron       - Run scheduled job (for cron integration)

Examples:
  node cli.js run          # Full daily cycle
  node cli.js stats        # View performance
      `);
  }
}

function startDashboard() {
  const express = require('express');
  const app = express();
  const port = 3000;

  app.use(express.static('public'));

  app.get('/api/stats', (req, res) => {
    res.json(paperBetting.getStats());
  });

  app.get('/api/predictions', (req, res) => {
    const db = require('./services/database').getDb();
    const predictions = db.prepare(`
      SELECT p.*, g.home_team, g.away_team, g.start_time, g.status
      FROM predictions p
      JOIN games g ON p.game_id = g.id
      ORDER BY g.start_time DESC
      LIMIT 20
    `).all();
    res.json(predictions);
  });

  app.listen(port, () => {
    console.log(`🌐 Dashboard: http://localhost:${port}`);
  });
}

// Run command
runCommand().catch(console.error);

// Schedule daily job at 9 AM
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Daily prediction job triggered');
  predictionEngine.fetchAndStoreGames().then(() => {
    predictionEngine.generatePredictionsForToday();
    paperBetting.placeBets();
  });
}, {
  scheduled: true,
  timezone: 'Europe/Warsaw'
});

console.log('📅 Daily cron scheduled for 9:00 AM (Warsaw time)');
