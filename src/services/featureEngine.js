const { getDb } = require('./database');

class FeatureEngine {
  constructor() {
    // Weight configurations for prediction model
    this.weights = {
      homeAdvantage: 0.03,      // 3% home advantage
      recencyWeight: 0.4,       // 40% weight on last 10 games
      h2hWeight: 0.15,          // 15% weight on head-to-head
      restDays: 0.05,           // 5% for rest advantage
      streakBonus: 0.03         // 3% for winning/losing streaks
    };
  }

  // Extract all features for a game
  async extractFeatures(game, sport) {
    const db = getDb();

    const homeTeam = game.home_team;
    const awayTeam = game.away_team;

    // Get team statistics
    const homeStats = await this.getTeamStats(homeTeam, sport);
    const awayStats = await this.getTeamStats(awayTeam, sport);

    // Get recent form (last 10 games)
    const homeForm = await this.getRecentForm(homeTeam, sport, 10);
    const awayForm = await this.getRecentForm(awayTeam, sport, 10);

    // Get head-to-head
    const h2h = await this.getHeadToHead(homeTeam, awayTeam, sport);

    // Get rest days
    const homeRest = await this.getDaysSinceLastGame(homeTeam, sport);
    const awayRest = await this.getDaysSinceLastGame(awayTeam, sport);

    // Calculate features
    const features = {
      // Basic stats
      homeWinPct: homeStats?.winPct || 0.5,
      awayWinPct: awayStats?.winPct || 0.5,
      homeAvgScore: homeStats?.avgScore || 100,
      awayAvgScore: awayStats?.avgScore || 100,
      homeAvgConceded: homeStats?.avgConceded || 100,
      awayAvgConceded: awayStats?.avgConceded || 100,

      // Home/away specific
      homeWinPctHome: homeStats?.homeWinPct || 0.5,
      awayWinPctAway: awayStats?.awayWinPct || 0.5,

      // Recency (last 10 games)
      homeRecentWinPct: homeForm?.winPct || 0.5,
      awayRecentWinPct: awayForm?.winPct || 0.5,

      // Head-to-head
      h2hHomeWins: h2h?.homeWins || 0,
      h2hAwayWins: h2h?.awayWins || 0,
      h2hTotal: h2h?.total || 1,

      // Rest days (more rest = better, up to 4 days max)
      homeRestAdvantage: Math.min(homeRest - awayRest, 2) / 4,
      homeRestDays: homeRest,
      awayRestDays: awayRest,

      // Streaks
      homeStreak: homeForm?.streak || 0,
      awayStreak: awayForm?.streak || 0,

      // Sport-specific adjustments
      sport: sport
    };

    return features;
  }

  // Get team statistics from historical data
  async getTeamStats(teamName, sport, season = 'current') {
    const { getDb } = require('./database');
    const db = getDb();

    // Simplified query with correct parameter count
    const stats = db.prepare(`
      SELECT
        COUNT(*) as games,
        SUM(CASE WHEN home_team = ? AND home_score > away_score THEN 1
                WHEN away_team = ? AND away_score > home_score THEN 1 ELSE 0 END) as wins,
        AVG(CASE WHEN home_team = ? THEN home_score ELSE away_score END) as avg_score,
        AVG(CASE WHEN home_team = ? THEN away_score ELSE home_score END) as avg_conceded
      FROM historical_games
      WHERE (home_team = ? OR away_team = ?)
        AND sport = ?
        AND home_score IS NOT NULL
    `).get(teamName, teamName, teamName, teamName, teamName, teamName, sport);

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
      return {
        winPct: 0.5,
        homeWinPct: 0.5,
        awayWinPct: 0.5,
        avgScore: sport.includes('nba') ? 110 : 1.5,
        avgConceded: sport.includes('nba') ? 108 : 1.3
      };
    }

    return {
      games: totalGames,
      wins: totalWins,
      winPct: totalWins / totalGames,
      avgScore: stats?.avg_score || (sport.includes('nba') ? 110 : 1.5),
      avgConceded: stats?.avg_conceded || (sport.includes('nba') ? 108 : 1.3),
      homeWinPct: homeWinPct,
      awayWinPct: awayWinPct
    };
  }

  // Get recent form (last N games)
  async getRecentForm(teamName, sport, gamesCount = 10) {
    const { getDb } = require('./database');
    const db = getDb();

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

    // Calculate wins and streak
    for (const game of recent) {
      const won = (game.home_team === teamName && game.home_score > game.away_score) ||
                  (game.away_team === teamName && game.away_score > game.home_score);

      if (won) {
        wins++;
        if (currentStreakType === 'win') {
          streak++;
        } else {
          currentStreakType = 'win';
          streak = 1;
        }
      } else {
        if (currentStreakType === 'loss') {
          streak--;
        } else {
          currentStreakType = 'loss';
          streak = -1;
        }
      }
    }

    return {
      winPct: wins / recent.length,
      streak: streak,
      games: recent
    };
  }

  // Get head-to-head record
  async getHeadToHead(team1, team2, sport) {
    const { getDb } = require('./database');
    const db = getDb();

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
      team1Wins: h2h?.team1_wins || 0,
      team2Wins: h2h?.team2_wins || 0,
      total: h2h?.total || 0
    };
  }

  // Get days since last game (rest days)
  async getDaysSinceLastGame(teamName, sport) {
    const { getDb } = require('./database');
    const db = getDb();

    const lastGame = db.prepare(`
      SELECT start_time FROM historical_games
      WHERE (home_team = ? OR away_team = ?)
        AND sport = ?
        AND home_score IS NOT NULL
      ORDER BY start_time DESC
      LIMIT 1
    `).get(teamName, teamName, sport);

    if (!lastGame) return 2; // Default 2 days rest

    const lastTime = new Date(lastGame.start_time).getTime();
    const now = Date.now();
    return Math.max(0, (now - lastTime) / (1000 * 60 * 60 * 24));
  }
}

module.exports = new FeatureEngine();
