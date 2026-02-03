const axios = require('axios');

const BASE_URL = 'https://api.the-odds-api.com/v4';

class SportsDataService {
  constructor(apiKey = process.env.SPORTS_API_KEY) {
    this.apiKey = apiKey || '';
    this.useMock = !apiKey;
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000
    });
  }

  async getSports() {
    if (this.useMock) return this.getMockSports();
    try {
      const response = await this.client.get('/sports', {
        params: { apiKey: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data');
      return this.getMockSports();
    }
  }

  async getUpcomingGames(sportKey) {
    if (this.useMock) return this.getMockGames(sportKey);
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
      console.warn(`API error for ${sportKey}, using mock data`);
      return this.getMockGames(sportKey);
    }
  }

  getMockSports() {
    return [
      { key: 'basketball_nba', title: 'NBA' },
      { key: 'soccer_epl', title: 'English Premier League' },
      { key: 'soccer_esp_la_liga', title: 'Spanish La Liga' }
    ];
  }

  getMockGames(sportKey) {
    const now = new Date();
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
    
    // Generate 3-5 mock games
    const numGames = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numGames; i++) {
      const homeIdx = Math.floor(Math.random() * sportTeams.length);
      let awayIdx;
      do {
        awayIdx = Math.floor(Math.random() * sportTeams.length);
      } while (awayIdx === homeIdx);

      const homeTeam = sportTeams[homeIdx];
      const awayTeam = sportTeams[awayIdx];
      
      // Game time: between 1 hour and 3 days from now
      const gameTime = new Date(now.getTime() + (Math.random() * 48 * 60 * 60 * 1000));

      games.push({
        id: `${sportKey}_${Date.now()}_${i}`,
        sport_key: sportKey,
        home_team: homeTeam,
        away_team: awayTeam,
        commence_time: gameTime.toISOString(),
        bookmakers: [{
          key: 'mock',
          title: 'Mock Book',
          markets: [{
            key: 'h2h',
            outcomes: [
              { name: homeTeam, price: 1.90 + Math.random() * 0.2 },
              { name: awayTeam, price: 1.90 + Math.random() * 0.2 }
            ]
          }]
        }]
      });
    }

    return games;
  }
}

module.exports = new SportsDataService();
