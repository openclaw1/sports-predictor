const axios = require('axios');

// The Odds API - Free tier (https://the-odds-api.com)
// No key required for basic endpoints, but rate limited
const BASE_URL = 'https://api.the-odds-api.com/v4';

class SportsDataService {
  constructor(apiKey = process.env.SPORTS_API_KEY) {
    this.apiKey = apiKey || '';
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000
    });
  }

  async getSports() {
    try {
      const response = await this.client.get('/sports', {
        params: { apiKey: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching sports:', error.message);
      return [];
    }
  }

  async getUpcomingGames(sportKey, daysAhead = 1) {
    try {
      const response = await this.client.get(`/sports/${sportKey}/odds`, {
        params: {
          apiKey: this.apiKey,
          regions: 'us,uk',
          oddsFormat: 'decimal',
          dateFormat: 'iso'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${sportKey} odds:`, error.message);
      return [];
    }
  }

  async getGameOdds(sportKey, gameId) {
    try {
      const games = await this.getUpcomingGames(sportKey);
      return games.find(g => g.id === gameId);
    } catch (error) {
      console.error('Error fetching game odds:', error.message);
      return null;
    }
  }

  // Get historical data for model training
  async getHistoricalGames(sportKey, daysBack = 30) {
    // The Odds API doesn't store history, we need to track and store ourselves
    // This is a placeholder for when we build up our own database
    return [];
  }
}

module.exports = new SportsDataService();
