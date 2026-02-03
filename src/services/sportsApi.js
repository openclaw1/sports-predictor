const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.the-odds-api.com/v4';
const CACHE_DIR = path.join(__dirname, '../../data/cache');
const API_KEY = process.env.SPORTS_API_KEY;
const USE_REAL_API = !!API_KEY && API_KEY !== 'your_api_key_here';

class SportsApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 15000,
      headers: API_KEY ? {} : {}
    });

    // Rate limiting: max 5 requests per 5 seconds for free tier
    this.requestCount = 0;
    this.lastRequestTime = Date.now();

    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  // Rate limiter
  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (this.requestCount >= 5 && elapsed < 5000) {
      const wait = 5000 - elapsed;
      console.log(`⏳ Rate limiting: waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  // Cache wrapper
  async getWithCache(key, fetchFn, ttlSeconds = 3600) {
    const cacheFile = path.join(CACHE_DIR, `${key}.json`);

    // Check cache
    if (fs.existsSync(cacheFile)) {
      const data = JSON.parse(fs.readFileSync(cacheFile));
      // Check if it's array format (old cache) or object format
      if (Array.isArray(data)) {
        console.log(`📦 Cache hit: ${key}`);
        return data;
      }
      const age = (Date.now() - data._cached) / 1000;
      if (age < ttlSeconds) {
        console.log(`📦 Cache hit: ${key}`);
        return data.data; // Return just the data array
      }
    }

    // Fetch fresh if no cache or expired
    console.log(`🌐 Fetching: ${key}`);
    const result = await fetchFn();

    // Save cache
    fs.writeFileSync(cacheFile, JSON.stringify({ data: result, _cached: Date.now() }));
    return result;
  }

  // Get available sports
  async getSports() {
    return this.getWithCache('sports', async () => {
      if (!USE_REAL_API) return this.getMockSports();

      await this.rateLimit();
      const response = await this.client.get('/sports', {
        params: { apiKey: API_KEY }
      });
      return response.data;
    });
  }

  // Get upcoming games with odds
  async getGamesWithOdds(sportKey, daysAhead = 2) {
    return this.getWithCache(`games_${sportKey}`, async () => {
      if (!USE_REAL_API) return this.getMockGames(sportKey);

      await this.rateLimit();
      const response = await this.client.get(`/sports/${sportKey}/odds`, {
        params: {
          apiKey: API_KEY,
          regions: 'us,uk,eu',
          oddsFormat: 'decimal',
          dateFormat: 'iso',
          dateFilter: 'next_' + daysAhead + 'days'
        }
      });
      return response.data;
    }, 300); // 5 min cache
  }

  // Get game results (for completed games)
  async getResults(sportKey, daysBack = 1) {
    return this.getWithCache(`results_${sportKey}`, async () => {
      if (!USE_REAL_API) return this.getMockResults(sportKey);

      await this.rateLimit();
      const response = await this.client.get(`/sports/${sportKey}/results`, {
        params: {
          apiKey: API_KEY,
          dateFormat: 'iso',
          dateFilter: 'last_' + daysBack + 'days'
        }
      });
      return response.data;
    }, 3600); // 1 hour cache
  }

  // Store historical data for training
  async storeHistoricalGames(games, sportKey) {
    const { getDb } = require('./database');
    const db = getDb();

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO historical_games
      (id, sport, home_team, away_team, start_time, home_score, away_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const game of games) {
      stmt.run(
        game.id,
        sportKey,
        game.home_team,
        game.away_team,
        game.commence_time || game.start_time,
        game.home_score || null,
        game.away_score || null
      );
    }

    return games.length;
  }

  // Get historical data for model training
  async getHistoricalData(sportKey, limit = 1000) {
    const { getDb } = require('./database');
    const db = getDb();

    return db.prepare(`
      SELECT * FROM historical_games
      WHERE sport = ? AND home_score IS NOT NULL
      ORDER BY start_time DESC
      LIMIT ?
    `).all(sportKey, limit);
  }

  // Mock data generators
  getMockSports() {
    return [
      { key: 'basketball_nba', title: 'NBA', active: true },
      { key: 'soccer_epl', title: 'English Premier League', active: true },
      { key: 'soccer_esp_la_liga', title: 'Spanish La Liga', active: true }
    ];
  }

  getMockGames(sportKey) {
    const teams = {
      basketball_nba: [
        'Lakers', 'Warriors', 'Celtics', 'Heat', 'Bucks', 'Suns',
        'Nets', 'Clippers', 'Bulls', 'Knicks'
      ],
      soccer_epl: [
        'Arsenal', 'Liverpool', 'Man City', 'Man United', 'Chelsea',
        'Tottenham', 'Newcastle', 'Villa', 'Brighton', 'West Ham'
      ],
      soccer_esp_la_liga: [
        'Real Madrid', 'Barcelona', 'Atlético Madrid', 'Sevilla',
        'Betis', 'Valencia', 'Villarreal', 'Real Sociedad', 'Athletic', 'Osasuna'
      ]
    };

    const sportTeams = teams[sportKey] || teams.basketball_nba;
    const games = [];
    const now = Date.now();

    for (let i = 0; i < 4; i++) {
      const homeIdx = Math.floor(Math.random() * sportTeams.length);
      let awayIdx;
      do { awayIdx = Math.floor(Math.random() * sportTeams.length); } while (awayIdx === homeIdx);

      const gameTime = new Date(now + (Math.random() * 48 * 60 * 60 * 1000));
      const homePrice = 1.80 + Math.random() * 0.4;
      const awayPrice = 1.80 + Math.random() * 0.4;

      games.push({
        id: `${sportKey}_${Date.now()}_${i}`,
        sport_key: sportKey,
        home_team: sportTeams[homeIdx],
        away_team: sportTeams[awayIdx],
        commence_time: gameTime.toISOString(),
        bookmakers: [{
          key: 'draftkings',
          title: 'DraftKings',
          markets: [{
            key: 'h2h',
            outcomes: [
              { name: sportTeams[homeIdx], price: Math.round(homePrice * 100) / 100 },
              { name: sportTeams[awayIdx], price: Math.round(awayPrice * 100) / 100 }
            ]
          }]
        }]
      });
    }

    return games;
  }

  getMockResults(sportKey) {
    // Return some "completed" games with scores
    return [];
  }
}

module.exports = new SportsApiClient();
