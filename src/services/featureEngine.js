/**
 * Sports Predictor - Enhanced Feature Engine v2
 * Better error handling and edge case coverage
 */

const { getDb } = require('./database');

class FeatureEngine {
  constructor() {
    // Weight configurations for prediction model
    this.weights = {
      homeAdvantage: 0.03,
      recencyWeight: 0.4,
      h2hWeight: 0.15,
      restDays: 0.05,
      streakBonus: 0.03
    };
    
    // Cache for performance
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Get cached data or fetch fresh
  async getCached(key, fetchFn, ttlMs = this.cacheTimeout) {
    const now = Date.now();
    const cached = this.cache.get(key);
    
    if (cached && (now - cached.timestamp) < ttlMs) {
      return cached.data;
    }
    
    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: now });
    return data;
  }

  // Extract all features for a game
  async extractFeatures(game, sport) {
    const cacheKey = `features:${sport}:${game.home_team}:${game.away_team}`;
    
    return this.getCached(cacheKey, async () => {
      return this._extractFeaturesUnsafe(game, sport);
    });
  }

  // Actual feature extraction (no caching)
  async _extractFeaturesUnsafe(game, sport) {
    try {
      const db = getDb();
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;

      // Get team statistics
      const [homeStats, awayStats] = await Promise.all([
        this.getTeamStats(homeTeam, sport, db),
        this.getTeamStats(awayTeam, sport, db)
      ]);

      // Get recent form (last 10 games)
      const [homeForm, awayForm] = await Promise.all([
        this.getRecentForm(homeTeam, sport, 10, db),
        this.getRecentForm(awayTeam, sport, 10, db)
      ]);

      // Get head-to-head
      const h2h = await this.getHeadToHead(homeTeam, awayTeam, sport, db);

      // Get rest days
      const [homeRest, awayRest] = await Promise.all([
        this.getDaysSinceLastGame(homeTeam, sport, db),
        this.getDaysSinceLastGame(awayTeam, sport, db)
      ]);

      return {
        homeWinPct: homeStats.winPct,
        awayWinPct: awayStats.winPct,
        homeAvgScore: homeStats.avgScore,
        awayAvgScore: awayStats.avgScore,
        homeAvgConceded: homeStats.avgConceded,
        awayAvgConceded: awayStats.avgConceded,
        homeWinPctHome: homeStats.homeWinPct,
        awayWinPctAway: awayStats.awayWinPct,
        homeRecentWinPct: homeForm.winPct,
        awayRecentWinPct: awayForm.winPct,
        h2hHomeWins: h2h.homeWins,
        h2hAwayWins: h2h.awayWins,
        h2hTotal: h2h.total,
        homeRestDays: homeRest,
        awayRestDays: awayRest,
        homeRestAdvantage: Math.min(homeRest - awayRest, 2) / 4,
        homeStreak: homeForm.streak,
        awayStreak: awayForm.streak,
        sport: sport,
        valid: true
      };
    } catch (error) {
      console.error('Feature extraction error:', error.message);
      return this.getDefaultFeatures(game, sport);
    }
  }

  // Get team statistics
  async getTeamStats(teamName, sport, db) {
    try {
      const homeGames = db.prepare(`
        SELECT COUNT(*) as cnt FROM historical_games
        WHERE home_team = ? AND sport = ? AND home_score IS NOT NULL
      `).get(teamName, sport);

      const homeWins = db.prepare(`
        SELECT COUNT(*) as cnt FROM historical_games
        WHERE home_team = ? AND sport = ? AND home_score > away_score
      `).get(teamName, sport);

      const awayGames = db.prepare(`
        SELECT COUNT(*) as cnt FROM historical_games
        WHERE away_team = ? AND sport = ? AND home_score IS NOT NULL
      `).get(teamName, sport);

      const awayWins = db.prepare(`
        SELECT COUNT(*) as cnt FROM historical_games
        WHERE away_team = ? AND sport = ? AND away_score > home_score
      `).get(teamName, sport);

      const totalGames = (homeGames?.cnt || 0) + (awayGames?.cnt || 0);
      const totalWins = (homeWins?.cnt || 0) + (awayWins?.cnt || 0);
      const homeWinPct = homeGames?.cnt > 0 ? homeWins.cnt / homeGames.cnt : 0.5;
      const awayWinPct = awayGames?.cnt > 0 ? awayWins.cnt / awayGames.cnt : 0.5;

      if (totalGames === 0) {
        return this.getDefaultTeamStats(sport);
      }

      return {
        games: totalGames,
        wins: totalWins,
        winPct: totalWins / totalGames,
        avgScore: sport.includes('nba') ? 110 : 1.5,
        avgConceded: sport.includes('nba') ? 108 : 1.3,
        homeWinPct,
        awayWinPct
      };
    } catch (error) {
      return this.getDefaultTeamStats(sport);
    }
  }

  // Get recent form
  async getRecentForm(teamName, sport, gamesCount, db) {
    try {
      const recent = db.prepare(`
        SELECT * FROM historical_games
        WHERE (home_team = ? OR away_team = ?)
          AND sport = ?
          AND home_score IS NOT NULL
        ORDER BY start_time DESC
        LIMIT ?
      `).all(teamName, teamName, sport, gamesCount);

      if (recent.length === 0) {
        return { winPct: 0.5, streak: 0, games: [] };
      }

      let wins = 0;
      let streak = 0;
      let currentStreakType = null;

      for (const game of recent) {
        const won = (game.home_team === teamName && game.home_score > game.away_score) ||
                    (game.away_team === teamName && game.away_score > game.home_score);

        if (won) {
          wins++;
          if (currentStreakType === 'win') streak++;
          else { currentStreakType = 'win'; streak = 1; }
        } else {
          if (currentStreakType === 'loss') streak--;
          else { currentStreakType = 'loss'; streak = -1; }
        }
      }

      return {
        winPct: wins / recent.length,
        streak: streak,
        games: recent
      };
    } catch (error) {
      return { winPct: 0.5, streak: 0, games: [] };
    }
  }

  // Get head-to-head record
  async getHeadToHead(team1, team2, sport, db) {
    try {
      const h2h = db.prepare(`
        SELECT 
          SUM(CASE WHEN home_team = ? AND home_score > away_score THEN 1
                  WHEN away_team = ? AND away_score > home_score THEN 1 ELSE 0 END) as team1_wins,
          SUM(CASE WHEN home_team = ? AND home_score < away_score THEN 1
                  WHEN away_team = ? AND away_score > home_score THEN 1 ELSE 0 END) as team2_wins,
          COUNT(*) as total
        FROM historical_games
        WHERE ((home_team = ? AND away_team = ?) OR (home_team = ? AND away_team = ?))
          AND sport = ?
          AND home_score IS NOT NULL
      `).get(team1, team1, team1, team1, team1, team2, team2, team1, sport);

      return {
        homeWins: h2h?.team1_wins || 0,
        awayWins: h2h?.team2_wins || 0,
        total: h2h?.total || 0
      };
    } catch (error) {
      return { homeWins: 0, awayWins: 0, total: 0 };
    }
  }

  // Get days since last game
  async getDaysSinceLastGame(teamName, sport, db) {
    try {
      const lastGame = db.prepare(`
        SELECT start_time FROM historical_games
        WHERE (home_team = ? OR away_team = ?)
          AND sport = ?
          AND home_score IS NOT NULL
        ORDER BY start_time DESC
        LIMIT 1
      `).get(teamName, teamName, sport);

      if (!lastGame) return 2;

      const lastTime = new Date(lastGame.start_time).getTime();
      const now = Date.now();
      return Math.max(0, (now - lastTime) / (1000 * 60 * 60 * 24));
    } catch (error) {
      return 2;
    }
  }

  // Default features when no data available
  getDefaultFeatures(game, sport) {
    return {
      homeWinPct: 0.5,
      awayWinPct: 0.5,
      homeAvgScore: sport.includes('nba') ? 110 : 1.5,
      awayAvgScore: sport.includes('nba') ? 108 : 1.3,
      homeAvgConceded: sport.includes('nba') ? 108 : 1.3,
      awayAvgConceded: sport.includes('nba') ? 110 : 1.5,
      homeWinPctHome: 0.5,
      awayWinPctAway: 0.5,
      homeRecentWinPct: 0.5,
      awayRecentWinPct: 0.5,
      h2hHomeWins: 0,
      h2hAwayWins: 0,
      h2hTotal: 1,
      homeRestDays: 2,
      awayRestDays: 2,
      homeRestAdvantage: 0,
      homeStreak: 0,
      awayStreak: 0,
      sport: sport,
      valid: false
    };
  }

  getDefaultTeamStats(sport) {
    return {
      games: 0,
      wins: 0,
      winPct: 0.5,
      avgScore: sport.includes('nba') ? 110 : 1.5,
      avgConceded: sport.includes('nba') ? 108 : 1.3,
      homeWinPct: 0.5,
      awayWinPct: 0.5
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new FeatureEngine();
