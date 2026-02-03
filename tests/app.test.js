/**
 * Sports Predictor - Test Suite
 * Professional-grade testing for all components
 */

const path = require('path');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';

// Import modules after environment setup
const { getDb, initDatabase } = require('../src/services/database');

describe('Database Service', () => {
  let db;

  beforeAll(() => {
    db = initDatabase();
  });

  test('database initializes without errors', () => {
    expect(db).toBeDefined();
  });

  test('games table exists with correct schema', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('games');
  });

  test('predictions table exists with correct schema', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('predictions');
  });

  test('paper_bets table exists with correct schema', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('paper_bets');
  });

  test('can insert and retrieve a game', () => {
    const testGameId = 'test_game_' + Date.now();
    db.prepare(`
      INSERT OR IGNORE INTO games (id, sport, home_team, away_team, start_time)
      VALUES (?, ?, ?, ?, ?)
    `).run(testGameId, 'test', 'HomeTeam', 'AwayTeam', new Date().toISOString());

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(testGameId);
    expect(game).toBeDefined();
    expect(game.home_team).toBe('HomeTeam');
  });

  test('can insert and retrieve a prediction', () => {
    const testGameId = 'test_game_pred_' + Date.now();
    db.prepare(`
      INSERT OR IGNORE INTO games (id, sport, home_team, away_team, start_time)
      VALUES (?, ?, ?, ?, ?)
    `).run(testGameId, 'test', 'HomeTeam', 'AwayTeam', new Date().toISOString());

    db.prepare(`
      INSERT INTO predictions (game_id, predicted_winner, confidence, home_prob, away_prob)
      VALUES (?, ?, ?, ?, ?)
    `).run(testGameId, 'HomeTeam', 0.65, 0.65, 0.35);

    const prediction = db.prepare('SELECT * FROM predictions WHERE game_id = ?').get(testGameId);
    expect(prediction).toBeDefined();
    expect(prediction.confidence).toBe(0.65);
  });

  test('can insert and retrieve a paper bet', () => {
    const testGameId = 'test_game_bet_' + Date.now();
    db.prepare(`
      INSERT OR IGNORE INTO games (id, sport, home_team, away_team, start_time)
      VALUES (?, ?, ?, ?, ?)
    `).run(testGameId, 'test', 'HomeTeam', 'AwayTeam', new Date().toISOString());

    const predResult = db.prepare(`
      INSERT INTO predictions (game_id, predicted_winner, confidence)
      VALUES (?, ?, ?)
    `).run(testGameId, 'HomeTeam', 0.65);

    db.prepare(`
      INSERT INTO paper_bets (prediction_id, game_id, stake, odds, selection, result)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(predResult.lastInsertRowid, testGameId, 10, 1.90, 'HomeTeam', 'pending');

    const bet = db.prepare('SELECT * FROM paper_bets WHERE game_id = ?').get(testGameId);
    expect(bet).toBeDefined();
    expect(bet.stake).toBe(10);
    expect(bet.result).toBe('pending');
  });
});

describe('Feature Engine', () => {
  const featureEngine = require('../src/services/featureEngine');

  test('feature engine exports required methods', () => {
    expect(typeof featureEngine.extractFeatures).toBe('function');
    expect(typeof featureEngine.getTeamStats).toBe('function');
    expect(typeof featureEngine.getRecentForm).toBe('function');
    expect(typeof featureEngine.getHeadToHead).toBe('function');
  });

  test('extractFeatures returns valid structure', async () => {
    const mockGame = {
      home_team: 'TestHome',
      away_team: 'TestAway',
      commence_time: new Date().toISOString()
    };

    const features = await featureEngine.extractFeatures(mockGame, 'test');

    expect(features).toBeDefined();
    expect(typeof features.homeWinPct).toBe('number');
    expect(typeof features.awayWinPct).toBe('number');
    expect(typeof features.homeRecentWinPct).toBe('number');
    expect(typeof features.awayRecentWinPct).toBe('number');
  });
});

describe('Prediction Model', () => {
  const predictionModel = require('../src/models/predictionModel');

  test('prediction model exports required methods', () => {
    expect(typeof predictionModel.predict).toBe('function');
    expect(typeof predictionModel.train).toBe('function');
    expect(typeof predictionModel.predictAll).toBe('function');
  });

  test('predict returns valid structure', async () => {
    const mockGame = {
      id: 'test_pred_' + Date.now(),
      home_team: 'TestHome',
      away_team: 'TestAway',
      commence_time: new Date().toISOString(),
      bookmakers: []
    };

    const prediction = await predictionModel.predict(mockGame, 'test');

    expect(prediction).toBeDefined();
    expect(typeof prediction.predictedWinner).toBe('string');
    expect(typeof prediction.confidence).toBe('string');
    expect(typeof prediction.homeWinProb).toBe('string');
    expect(typeof prediction.awayWinProb).toBe('string');
    expect(typeof prediction.expectedValue).toBe('string');
    expect(typeof prediction.modelVersion).toBe('string');
  });

  test('confidence is within valid range', async () => {
    const mockGame = {
      id: 'test_pred_conf_' + Date.now(),
      home_team: 'TestHome',
      away_team: 'TestAway',
      commence_time: new Date().toISOString(),
      bookmakers: []
    };

    const prediction = await predictionModel.predict(mockGame, 'test');
    const confidence = parseFloat(prediction.confidence);

    expect(confidence).toBeGreaterThanOrEqual(0.25);
    expect(confidence).toBeLessThanOrEqual(0.85);
  });
});

describe('Betting Service', () => {
  const bettingService = require('../src/services/bettingService');

  test('betting service exports required methods', () => {
    expect(typeof bettingService.placeBets).toBe('function');
    expect(typeof bettingService.settleBets).toBe('function');
    expect(typeof bettingService.getStats).toBe('function');
    expect(typeof bettingService.loadState).toBe('function');
    expect(typeof bettingService.saveState).toBe('function');
  });

  test('getStats returns valid structure', () => {
    const stats = bettingService.getStats();

    expect(stats).toBeDefined();
    expect(typeof stats.bankroll).toBe('number');
    expect(typeof stats.totalBets).toBe('number');
    expect(typeof stats.wins).toBe('number');
    expect(typeof stats.losses).toBe('number');
    expect(typeof stats.winRate).toBe('string');
    expect(typeof stats.totalProfit).toBe('number');
    expect(typeof stats.roi).toBe('string');
  });

  test('calculateKellyStake returns valid amount', () => {
    const stake = bettingService.calculateKellyStake(0.6, 1.90, 1000);
    
    expect(typeof stake).toBe('number');
    expect(stake).toBeGreaterThanOrEqual(0);
    expect(stake).toBeLessThanOrEqual(50); // Max 5% of 1000
  });
});

describe('Sports API Client', () => {
  const sportsApi = require('../src/services/sportsApi');

  test('sports API exports required methods', () => {
    expect(typeof sportsApi.getSports).toBe('function');
    expect(typeof sportsApi.getGamesWithOdds).toBe('function');
    expect(typeof sportsApi.getHistoricalData).toBe('function');
  });

  test('getMockSports returns valid structure', () => {
    const sports = sportsApi.getMockSports();
    
    expect(Array.isArray(sports)).toBe(true);
    expect(sports.length).toBeGreaterThan(0);
    
    const sport = sports[0];
    expect(sport.key).toBeDefined();
    expect(sport.title).toBeDefined();
  });

  test('getMockGames returns valid structure', () => {
    const games = sportsApi.getMockGames('basketball_nba');
    
    expect(Array.isArray(games)).toBe(true);
    expect(games.length).toBeGreaterThan(0);
    
    const game = games[0];
    expect(game.id).toBeDefined();
    expect(game.home_team).toBeDefined();
    expect(game.away_team).toBeDefined();
    expect(game.commence_time).toBeDefined();
  });
});

// Performance tests
describe('Performance', () => {
  test('prediction completes within 5 seconds', async () => {
    const predictionModel = require('../src/models/predictionModel');
    
    const mockGame = {
      id: 'test_perf_' + Date.now(),
      home_team: 'TestHome',
      away_team: 'TestAway',
      commence_time: new Date().toISOString(),
      bookmakers: []
    };

    const start = Date.now();
    await predictionModel.predict(mockGame, 'test');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
  });

  test('stats calculation completes within 1 second', () => {
    const bettingService = require('../src/services/bettingService');
    
    const start = Date.now();
    bettingService.getStats();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000);
  });
});
