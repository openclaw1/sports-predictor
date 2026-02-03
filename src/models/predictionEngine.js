const { getDb } = require('../services/database');
const sportsApi = require('../services/sportsApi');

class PredictionEngine {
  constructor() {
    this.sports = {
      nba: 'basketball_nba',
      soccer_epl: 'soccer_epl',
      soccer_la_liga: 'soccer_esp_la_liga'
    };
  }

  async fetchAndStoreGames() {
    const db = getDb();
    const results = {};

    for (const [name, key] of Object.entries(this.sports)) {
      const games = await sportsApi.getUpcomingGames(key);
      results[name] = games.length;
      
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO games 
        (id, sport, home_team, away_team, start_time, status)
        VALUES (?, ?, ?, ?, ?, 'scheduled')
      `);

      for (const game of games) {
        insertStmt.run(
          game.id,
          name,
          game.home_team,
          game.away_team,
          game.commence_time
        );
      }
    }

    return results;
  }

  generatePrediction(game) {
    // Simple baseline model - will be enhanced
    const homeAdvantage = 0.03; // ~3% home advantage baseline
    
    // Random noise for now - this will be replaced with real model
    const baseConfidence = 0.50 + (Math.random() * 0.20);
    const confidence = Math.min(0.85, Math.max(0.50, baseConfidence + homeAdvantage));
    
    // Simple prediction: slightly favor home team
    const predictedWinner = Math.random() > 0.45 ? game.home_team : game.away_team;
    
    return {
      predicted_winner: predictedWinner,
      confidence: confidence
    };
  }

  async generatePredictionsForToday() {
    const db = getDb();
    
    // Get today's games
    const games = db.prepare(`
      SELECT * FROM games 
      WHERE status = 'scheduled'
      AND date(start_time) >= date('now')
    `).all();

    const predictions = [];
    const insertStmt = db.prepare(`
      INSERT INTO predictions (game_id, predicted_winner, confidence)
      VALUES (?, ?, ?)
    `);

    for (const game of games) {
      const prediction = this.generatePrediction(game);
      insertStmt.run(game.id, prediction.predicted_winner, prediction.confidence);
      predictions.push({
        game,
        prediction
      });
    }

    return predictions;
  }

  async updateGameResults() {
    const db = getDb();
    
    // Get completed games from our stored data
    // In production, we'd query the API for results
    const completedGames = db.prepare(`
      SELECT * FROM games 
      WHERE status = 'scheduled'
      AND start_time < datetime('now')
    `).all();

    // Mark as completed (results would come from API in production)
    for (const game of completedGames) {
      db.prepare(`
        UPDATE games SET status = 'completed' WHERE id = ?
      `).run(game.id);
    }

    return completedGames.length;
  }
}

module.exports = new PredictionEngine();
