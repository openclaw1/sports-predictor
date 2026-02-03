const { getDb } = require('./database');
const predictionModel = require('../models/predictionModel');
const sportsApi = require('./sportsApi');

class BettingService {
  constructor() {
    // Configuration
    this.config = {
      minConfidence: 0.55,      // Minimum confidence to bet
      minExpectedValue: 0.02,   // Minimum positive EV
      maxStakePct: 0.05,        // Max 5% of bankroll per bet
      kellyFraction: 0.25,      // Kelly fraction (25% = fractional Kelly)
      sportFilter: ['basketball_nba', 'soccer_epl', 'soccer_esp_la_liga']
    };

    this.state = {
      bankroll: 1000,
      totalBets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      totalStaked: 0,
      totalProfit: 0
    };
  }

  // Load state from database
  loadState() {
    const db = getDb();

    const bankroll = db.prepare('SELECT value FROM state WHERE key = ?').get('bankroll');
    const stats = db.prepare('SELECT value FROM state WHERE key = ?').get('betting_stats');

    if (bankroll) this.state.bankroll = parseFloat(bankroll.value);
    if (stats) {
      const parsed = JSON.parse(stats.value);
      this.state = { ...this.state, ...parsed };
    }
  }

  // Save state to database
  saveState() {
    const db = getDb();

    db.prepare(`
      INSERT OR REPLACE INTO state (key, value, updated_at)
      VALUES ('bankroll', ?, CURRENT_TIMESTAMP)
    `).run(this.state.bankroll.toString());

    db.prepare(`
      INSERT OR REPLACE INTO state (key, value, updated_at)
      VALUES ('betting_stats', ?, CURRENT_TIMESTAMP)
    `).run(JSON.stringify({
      totalBets: this.state.totalBets,
      wins: this.state.wins,
      losses: this.state.losses,
      pushes: this.state.pushes,
      totalStaked: this.state.totalStaked,
      totalProfit: this.state.totalProfit
    }));
  }

  // Get best odds from game
  getBestOdds(game) {
    if (!game.bookmakers || game.bookmakers.length === 0) {
      return { home: 1.90, away: 1.90, draw: 3.00 };
    }

    let bestHome = 0, bestAway = 0, bestDraw = 0;

    for (const bookmaker of game.bookmakers) {
      for (const market of bookmaker.markets || []) {
        if (market.key === 'h2h') {
          for (const outcome of market.outcomes || []) {
            if (outcome.name === game.home_team && outcome.price > bestHome) {
              bestHome = outcome.price;
            }
            if (outcome.name === game.away_team && outcome.price > bestAway) {
              bestAway = outcome.price;
            }
            if (outcome.name === 'Draw' && outcome.price > bestDraw) {
              bestDraw = outcome.price;
            }
          }
        }
      }
    }

    return {
      home: bestHome || 1.90,
      away: bestAway || 1.90,
      draw: bestDraw || 3.00
    };
  }

  // Calculate Kelly stake
  calculateKellyStake(probability, odds, bankroll) {
    // Kelly formula: f* = (bp - q) / b
    // where b = odds - 1, p = probability, q = 1 - p
    const b = odds - 1;
    const p = probability;
    const q = 1 - p;

    if (b <= 0) return 0;

    const kelly = (b * p - q) / b;
    const fractionalKelly = kelly * this.config.kellyFraction;

    // Cap at max stake percentage
    const maxStake = bankroll * this.config.maxStakePct;
    const stake = bankroll * Math.max(0, fractionalKelly);

    return Math.min(stake, maxStake);
  }

  // Generate and place bets
  async placeBets() {
    this.loadState();
    const db = getDb();
    const results = { placed: 0, skipped: 0, totalOdds: [] };

    console.log(`💰 Starting betting cycle | Bankroll: $${this.state.bankroll.toFixed(2)}`);

    // Fetch games for all sports
    for (const sportKey of this.config.sportFilter) {
      const games = await sportsApi.getGamesWithOdds(sportKey);

      for (const game of games) {
        // Skip if game already has a pending bet
        const existingBet = db.prepare(`
          SELECT id FROM paper_bets
          WHERE game_id = ? AND result IS NULL
        `).get(game.id);

        if (existingBet) {
          results.skipped++;
          continue;
        }

        // Get prediction
        const prediction = await predictionModel.predict(game, sportKey);
        const confidence = parseFloat(prediction.confidence);
        const ev = parseFloat(prediction.expectedValue);

        // Get best odds
        const odds = this.getBestOdds(game);
        const homeProb = parseFloat(prediction.homeWinProb);
        const awayProb = parseFloat(prediction.awayWinProb);

        // Decide which team to bet on
        let selection, selectionOdds, selectionProb;

        if (prediction.predictedWinner === game.home_team) {
          selection = game.home_team;
          selectionOdds = odds.home;
          selectionProb = homeProb;
        } else {
          selection = game.away_team;
          selectionOdds = odds.away;
          selectionProb = awayProb;
        }

        // Check if bet meets criteria
        if (confidence < this.config.minConfidence) {
          results.skipped++;
          continue;
        }

        if (ev < this.config.minExpectedValue) {
          results.skipped++;
          continue;
        }

        // Calculate stake using Kelly
        const stake = this.calculateKellyStake(selectionProb, selectionOdds, this.state.bankroll);

        if (stake < 1) { // Minimum $1 bet
          results.skipped++;
          continue;
        }

        // Store prediction
        const predResult = db.prepare(`
          INSERT INTO predictions (game_id, predicted_winner, confidence, home_prob, away_prob, expected_value)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(game.id, prediction.predictedWinner, confidence, homeProb, awayProb, ev);

        // Place bet
        db.prepare(`
          INSERT INTO paper_bets (prediction_id, game_id, stake, odds, selection, result)
          VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(predResult.lastInsertRowid, game.id, stake, selectionOdds, selection);

        // Update state
        this.state.bankroll -= stake;
        this.state.totalBets++;
        this.state.totalStaked += stake;
        results.placed++;
        results.totalOdds.push(selectionOdds);

        console.log(`  🎯 ${game.home_team} vs ${game.away_team}`);
        console.log(`     → ${selection} @ ${selectionOdds} | ${(confidence * 100).toFixed(1)}% | EV: ${(ev * 100).toFixed(1)}%`);
        console.log(`     Stake: $${stake.toFixed(2)} | New bankroll: $${this.state.bankroll.toFixed(2)}`);
      }
    }

    this.saveState();

    // Summary
    const avgOdds = results.totalOdds.length > 0
      ? (results.totalOdds.reduce((a, b) => a + b, 0) / results.totalOdds.length).toFixed(2)
      : 'N/A';

    console.log(`\n✅ Betting complete: ${results.placed} placed, ${results.skipped} skipped`);
    console.log(`   Avg odds: ${avgOdds} | Bankroll: $${this.state.bankroll.toFixed(2)}`);

    return results;
  }

  // Settle completed bets
  async settleBets() {
    const db = getDb();
    this.loadState();

    // Get pending bets with their games
    const pendingBets = db.prepare(`
      SELECT pb.*, p.predicted_winner, g.home_team, g.away_team, g.home_score, g.away_score
      FROM paper_bets pb
      JOIN predictions p ON pb.prediction_id = p.id
      JOIN games g ON pb.game_id = g.id
      WHERE pb.result = 'pending' AND g.status = 'completed'
    `).all();

    let settled = 0;

    for (const bet of pendingBets) {
      // Determine result
      let result;
      if (bet.home_score > bet.away_score) {
        result = bet.home_team;
      } else if (bet.away_score > bet.home_score) {
        result = bet.away_team;
      } else {
        result = 'push';
      }

      // Calculate profit
      let profit = 0;
      if (result === 'push') {
        profit = 0;
        this.state.pushes++;
      } else if (result === bet.selection) {
        profit = bet.stake * (bet.odds - 1);
        this.state.wins++;
      } else {
        profit = -bet.stake;
        this.state.losses++;
      }

      // Update bet
      db.prepare(`
        UPDATE paper_bets
        SET result = ?, profit = ?, settled_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(result, profit, bet.id);

      // Update bankroll
      this.state.bankroll += bet.stake + profit;
      this.state.totalProfit += profit;
      settled++;
    }

    this.saveState();

    if (settled > 0) {
      console.log(`\n🏁 Settled ${settled} bets`);
      console.log(`   Wins: ${this.state.wins} | Losses: ${this.state.losses} | Pushes: ${this.state.pushes}`);
      console.log(`   Bankroll: $${this.state.bankroll.toFixed(2)} | Total profit: $${this.state.totalProfit.toFixed(2)}`);
    }

    return settled;
  }

  // Get statistics
  getStats() {
    this.loadState();

    const total = this.state.wins + this.state.losses + this.state.pushes;
    const winRate = total > 0 ? (this.state.wins / total * 100) : 0;
    const roi = this.state.totalStaked > 0
      ? (this.state.totalProfit / this.state.totalStaked * 100)
      : 0;

    return {
      bankroll: this.state.bankroll,
      totalBets: total,
      wins: this.state.wins,
      losses: this.state.losses,
      pushes: this.state.pushes,
      winRate: winRate.toFixed(1),
      totalStaked: this.state.totalStaked,
      totalProfit: this.state.totalProfit,
      roi: roi.toFixed(2),
      avgStake: total > 0 ? (this.state.totalStaked / total) : 0
    };
  }
}

module.exports = new BettingService();
