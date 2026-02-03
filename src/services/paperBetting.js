const { getDb } = require('./database');
const predictionEngine = require('../models/predictionEngine');

class PaperBetting {
  constructor() {
    this.state = {
      bankroll: 1000,
      totalBets: 0,
      wins: 0,
      losses: 0,
      totalStaked: 0,
      totalProfit: 0
    };
  }

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
      totalStaked: this.state.totalStaked,
      totalProfit: this.state.totalProfit
    }));
  }

  async placeBets(minConfidence = 0.55) {
    this.loadState();
    
    const predictions = await predictionEngine.generatePredictionsForToday();
    const db = getDb();
    const betStmt = db.prepare(`
      INSERT INTO paper_bets 
      (prediction_id, stake, odds, selection, result)
      VALUES (?, ?, ?, ?, 'pending')
    `);

    const stakePct = 0.05; // 5% of bankroll per bet
    let betsPlaced = 0;

    for (const { game, prediction } of predictions) {
      if (prediction.confidence < minConfidence) continue;
      
      // Skip if game already has a bet
      const existing = db.prepare(`
        SELECT id FROM paper_bets 
        WHERE selection = ? AND result = 'pending'
      `).get(prediction.predicted_winner);
      
      if (existing) continue;

      const stake = this.state.bankroll * stakePct;
      const odds = 1.90; // Placeholder odds
      
      // Get prediction ID
      const predId = db.prepare(`
        SELECT id FROM predictions 
        WHERE game_id = ? ORDER BY id DESC LIMIT 1
      `).get(game.id);

      if (predId) {
        betStmt.run(predId.id, stake, odds, prediction.predicted_winner);
        this.state.bankroll -= stake;
        this.state.totalBets++;
        this.state.totalStaked += stake;
        betsPlaced++;
      }
    }

    this.saveState();
    
    console.log(`🎯 Placed ${betsPlaced} bets | Bankroll: $${this.state.bankroll.toFixed(2)}`);
    return { betsPlaced, bankroll: this.state.bankroll };
  }

  getStats() {
    this.loadState();
    const roi = this.state.totalStaked > 0 
      ? (this.state.totalProfit / this.state.totalStaked) * 100 
      : 0;
    
    return {
      bankroll: this.state.bankroll,
      totalBets: this.state.totalBets,
      wins: this.state.wins,
      losses: this.state.losses,
      winRate: this.state.totalBets > 0 
        ? (this.state.wins / this.state.totalBets * 100).toFixed(1) 
        : 0,
      totalStaked: this.state.totalStaked,
      totalProfit: this.state.totalProfit,
      roi: roi.toFixed(2)
    };
  }
}

module.exports = new PaperBetting();
