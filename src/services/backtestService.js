const { getDb } = require('./database');
const predictionModel = require('../models/predictionModel');
const featureEngine = require('./featureEngine');

class BacktestService {
  constructor() {
    this.results = {
      totalBets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      totalStaked: 0,
      totalProfit: 0,
      roi: 0,
      winRate: 0,
      avgOdds: 0
    };
  }

  // Run backtest on historical data
  async runBacktest(sportKey, options = {}) {
    const {
      minConfidence = 0.55,
      minExpectedValue = 0.02,
      kellyFraction = 0.25,
      startDate = null,
      endDate = null,
      sampleSize = 500
    } = options;

    console.log(`\n🔄 Starting backtest for ${sportKey}`);
    console.log(`   Params: minConf=${minConfidence}, minEV=${minExpectedValue}, kelly=${kellyFraction}`);

    const db = getDb();

    // Get historical games
    let query = `
      SELECT * FROM historical_games
      WHERE sport = ? AND home_score IS NOT NULL
    `;
    const params = [sportKey];

    if (startDate) {
      query += ' AND start_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND start_time <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY start_time DESC LIMIT ?';
    params.push(sampleSize);

    const games = db.prepare(query).all(...params);

    console.log(`   Loaded ${games.length} historical games`);

    if (games.length < 50) {
      console.log('⚠️  Not enough games for meaningful backtest');
      return null;
    }

    // Reset results
    this.results = {
      totalBets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      totalStaked: 0,
      totalProfit: 0,
      roi: 0,
      winRate: 0,
      avgOdds: 1.90,
      byConfidence: {},
      bySport: sportKey,
      sampleSize: games.length,
      dateRange: {
        earliest: games[games.length - 1]?.start_time,
        latest: games[0]?.start_time
      }
    };

    // Simulate bets
    let bankroll = 1000;
    const bets = [];

    for (const game of games) {
      // Get features for this game
      const features = await featureEngine.extractFeatures(game, sportKey);

      // Calculate home win probability
      const homeProb = predictionModel.calculateHomeWinProbability(features);
      const awayProb = 1 - homeProb;

      // Determine predicted winner
      const predictedWinner = homeProb > awayProb ? game.home_team : game.away_team;
      const confidence = homeProb > awayProb ? homeProb : awayProb;

      // Skip if below thresholds
      if (confidence < minConfidence) continue;

      // Simulate odds (use actual if available, else estimate)
      const odds = this.estimateOdds(homeProb, awayProb, game.home_odds, game.away_odds);
      const ev = this.calculateEV(homeProb, awayProb, odds);

      if (ev < minExpectedValue) continue;

      // Simulate bet
      const stake = bankroll * 0.02 * kellyFraction; // 2% base stake, Kelly fraction
      const selection = predictedWinner;
      const selectionOdds = selection === game.home_team ? odds.home : odds.away;

      // Determine actual outcome
      let result;
      if (game.home_score > game.away_score) result = game.home_team;
      else if (game.away_score > game.home_score) result = game.away_team;
      else result = 'push';

      // Calculate profit
      let profit = 0;
      if (result === 'push') {
        profit = 0;
        this.results.pushes++;
      } else if (result === selection) {
        profit = stake * (selectionOdds - 1);
        this.results.wins++;
      } else {
        profit = -stake;
        this.results.losses++;
      }

      // Update bankroll
      bankroll += profit;

      // Record bet
      bets.push({
        game: `${game.home_team} vs ${game.away_team}`,
        prediction: predictedWinner,
        result: result,
        confidence: confidence,
        odds: selectionOdds,
        stake: stake,
        profit: profit,
        bankroll: bankroll
      });

      this.results.totalBets++;
      this.results.totalStaked += stake;
      this.results.totalProfit += profit;
      this.results.avgOdds = (this.results.avgOdds * (this.results.totalBets - 1) + selectionOdds) / this.results.totalBets;

      // Track by confidence band
      const confBand = Math.floor(confidence * 10) / 10;
      if (!this.results.byConfidence[confBand]) {
        this.results.byConfidence[confBand] = { bets: 0, wins: 0, profit: 0 };
      }
      this.results.byConfidence[confBand].bets++;
      this.results.byConfidence[confBand].profit += profit;
      if (result === selection) {
        this.results.byConfidence[confBand].wins++;
      }
    }

    // Calculate final metrics
    const total = this.results.wins + this.results.losses + this.results.pushes;
    this.results.winRate = total > 0 ? (this.results.wins / total * 100) : 0;
    this.results.roi = this.results.totalStaked > 0
      ? (this.results.totalProfit / this.results.totalStaked * 100)
      : 0;

    // Print results
    console.log(`\n📊 Backtest Results for ${sportKey}`);
    console.log(`═══════════════════════════════════════════`);
    console.log(`   Period: ${new Date(this.results.dateRange.earliest).toLocaleDateString()} - ${new Date(this.results.dateRange.latest).toLocaleDateString()}`);
    console.log(`   Sample Size: ${this.results.sampleSize} games`);
    console.log(`   Bets Placed: ${this.results.totalBets}`);
    console.log(`   Wins: ${this.results.wins} | Losses: ${this.results.losses} | Pushes: ${this.results.pushes}`);
    console.log(`   Win Rate: ${this.results.winRate.toFixed(1)}%`);
    console.log(`   Avg Odds: ${this.results.avgOdds.toFixed(2)}`);
    console.log(`   Total Staked: $${this.results.totalStaked.toFixed(2)}`);
    console.log(`   Total Profit: $${this.results.totalProfit.toFixed(2)}`);
    console.log(`   ROI: ${this.results.roi.toFixed(2)}%`);
    console.log(`   Final Bankroll: $${bankroll.toFixed(2)}`);

    // Breakdown by confidence
    console.log(`\n📈 Performance by Confidence:`);
    for (const [conf, data] of Object.entries(this.results.byConfidence)) {
      const wr = data.bets > 0 ? (data.wins / data.bets * 100).toFixed(1) : 'N/A';
      console.log(`   ${(conf * 100).toFixed(0)}-${(parseFloat(conf) + 0.1) * 100}%: ${data.bets} bets, ${wr}% WR, $${data.profit.toFixed(2)}`);
    }

    this.results.bets = bets.slice(-20); // Last 20 bets for review
    return this.results;
  }

  // Estimate odds from probability
  estimateOdds(homeProb, awayProb, actualHomeOdds, actualAwayOdds) {
    if (actualHomeOdds && actualAwayOdds) {
      return { home: actualHomeOdds, away: actualAwayOdds };
    }

    // Fair odds from probability (no vig)
    const fairHome = 1 / homeProb;
    const fairAway = 1 / awayProb;

    // Add typical vig (5%)
    return {
      home: fairHome * 0.95,
      away: fairAway * 0.95
    };
  }

  // Calculate expected value
  calculateEV(homeProb, awayProb, odds) {
    const homeEV = homeProb * odds.home - (1 - homeProb);
    const awayEV = awayProb * odds.away - (1 - awayProb);
    return Math.max(homeEV, awayEV);
  }
}

module.exports = new BacktestService();
