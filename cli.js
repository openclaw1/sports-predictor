const { getDb, initDatabase } = require('./src/services/database');
const sportsApi = require('./src/services/sportsApi');
const predictionModel = require('./src/models/predictionModel');
const featureEngine = require('./src/services/featureEngine');
const bettingService = require('./src/services/bettingService');
const backtestService = require('./src/services/backtestService');

// Initialize
initDatabase();

const command = process.argv[2] || 'help';

async function runCommand() {
  console.log(`\n🎯 Sports Predictor v1.0\n`);

  switch (command) {
    case 'fetch':
      console.log('📊 Fetching games from API...');
      const results = {};
      for (const sport of ['basketball_nba', 'soccer_epl', 'soccer_esp_la_liga']) {
        const games = await sportsApi.getGamesWithOdds(sport);
        results[sport] = games.length;
        console.log(`   ${sport}: ${games.length} games`);
      }
      console.log('\n✅ Fetch complete');
      break;

    case 'predict':
      console.log('🎯 Generating predictions...');
      const predictions = [];
      for (const sport of ['basketball_nba', 'soccer_epl', 'soccer_esp_la_liga']) {
        const games = await sportsApi.getGamesWithOdds(sport);
        for (const game of games.slice(0, 3)) { // Limit to 3 per sport
          const pred = await predictionModel.predict(game, sport);
          predictions.push({ sport, game, pred });
        }
      }

      console.log('\n📋 Predictions:');
      for (const { sport, game, pred } of predictions) {
        console.log(`\n   ${game.home_team} vs ${game.away_team} (${sport})`);
        console.log(`   → ${pred.predictedWinner} (${(pred.confidence * 100).toFixed(1)}% confidence)`);
        console.log(`   EV: ${(pred.expectedValue * 100).toFixed(1)}% | Model v${pred.modelVersion}`);
      }
      break;

    case 'bet':
      console.log('💰 Placing bets...');
      await bettingService.placeBets();
      break;

    case 'settle':
      console.log('🏁 Settling completed bets...');
      const settled = await bettingService.settleBets();
      console.log(`   Settled ${settled} bets`);
      break;

    case 'stats':
      console.log('📈 Betting Statistics:');
      const stats = bettingService.getStats();
      console.log(`   Bankroll: $${stats.bankroll.toFixed(2)}`);
      console.log(`   Total Bets: ${stats.totalBets}`);
      console.log(`   Wins: ${stats.wins} | Losses: ${stats.losses} | Pushes: ${stats.pushes}`);
      console.log(`   Win Rate: ${stats.winRate}%`);
      console.log(`   ROI: ${stats.roi}%`);
      console.log(`   Total Profit: $${stats.totalProfit.toFixed(2)}`);
      break;

    case 'backtest':
      const sport = process.argv[3] || 'basketball_nba';
      console.log(`🔄 Running backtest for ${sport}...`);
      await backtestService.runBacktest(sport, {
        sampleSize: 500,
        minConfidence: 0.55,
        minExpectedValue: 0.02
      });
      break;

    case 'run':
      console.log('🚀 Running full daily cycle...');
      await sportsApi.getGamesWithOdds('basketball_nba');
      await sportsApi.getGamesWithOdds('soccer_epl');
      await sportsApi.getGamesWithOdds('soccer_esp_la_liga');
      await bettingService.placeBets();
      await bettingService.settleBets();
      console.log('\n✅ Daily cycle complete');
      break;

    case 'dashboard':
      console.log('🌐 Starting dashboard...');
      startDashboard();
      break;

    case 'help':
    default:
      console.log(`
Sports Predictor CLI v1.0

Commands:
  fetch      - Fetch latest games from API
  predict    - Generate predictions for upcoming games
  bet        - Place paper bets based on predictions
  settle     - Settle completed bets
  stats      - Show betting statistics
  backtest   - Run backtest on historical data
  run        - Full daily cycle (fetch + bet + settle)
  dashboard  - Start web dashboard
  help       - Show this help

Examples:
  node cli.js predict       # See upcoming predictions
  node cli.js bet           # Place paper bets
  node cli.js stats         # View performance
  node cli.js backtest basketball_nba  # Test model on history
      `);
  }
}

function startDashboard() {
  const express = require('express');
  const app = express();
  const port = 3000;

  app.use(express.static('public'));

  app.get('/api/stats', (req, res) => {
    res.json(bettingService.getStats());
  });

  app.get('/api/predictions', async (req, res) => {
    const predictions = [];
    for (const sport of ['basketball_nba', 'soccer_epl', 'soccer_esp_la_liga']) {
      const games = await sportsApi.getGamesWithOdds(sport);
      for (const game of games.slice(0, 2)) {
        const pred = await predictionModel.predict(game, sport);
        predictions.push({
          sport,
          home: game.home_team,
          away: game.away_team,
          time: game.commence_time,
          prediction: pred.predictedWinner,
          confidence: pred.confidence,
          ev: pred.expectedValue
        });
      }
    }
    res.json(predictions);
  });

  app.listen(port, () => {
    console.log(`🌐 Dashboard: http://localhost:${port}`);
  });
}

// Run
runCommand().catch(console.error);
