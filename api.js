#!/usr/bin/env node

/**
 * Sports Predictor - REST API Server
 * Professional API for external integrations
 */

const express = require('express');
const { initDatabase } = require('./src/services/database');
const sportsApi = require('./src/services/sportsApi');
const predictionModel = require('./src/models/predictionModel');
const bettingService = require('./src/services/bettingService');
const backtestService = require('./src/services/backtestService');
const { logPerformance } = require('./scripts/performance');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API version
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Sports Predictor API',
    version: '1.0.0',
    endpoints: '/api/v1/predictions, /api/v1/bets, /api/v1/stats, /api/v1/backtest'
  });
});

// Get predictions for a sport
app.get('/api/v1/predictions/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const games = await sportsApi.getGamesWithOdds(sport);
    const predictions = [];

    for (const game of games.slice(0, 10)) {
      const pred = await predictionModel.predict(game, sport);
      predictions.push({
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        start_time: game.commence_time,
        prediction: pred.predictedWinner,
        confidence: pred.confidence,
        home_probability: pred.homeWinProb,
        away_probability: pred.awayWinProb,
        expected_value: pred.expectedValue,
        model_version: pred.modelVersion
      });
    }

    res.json({
      success: true,
      sport,
      count: predictions.length,
      predictions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all predictions
app.get('/api/v1/predictions', async (req, res) => {
  try {
    const sports = ['basketball_nba', 'soccer_epl', 'soccer_esp_la_liga'];
    const allPredictions = {};

    for (const sport of sports) {
      const games = await sportsApi.getGamesWithOdds(sport);
      const predictions = [];

      for (const game of games.slice(0, 5)) {
        const pred = await predictionModel.predict(game, sport);
        predictions.push({
          game_id: game.id,
          home_team: game.home_team,
          away_team: game.away_team,
          start_time: game.commence_time,
          prediction: pred.predictedWinner,
          confidence: pred.confidence,
          expected_value: pred.expectedValue
        });
      }

      allPredictions[sport] = predictions;
    }

    res.json({ success: true, predictions: allPredictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place a bet
app.post('/api/v1/bets', async (req, res) => {
  try {
    const result = await bettingService.placeBets();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get betting statistics
app.get('/api/v1/stats', (req, res) => {
  try {
    const stats = bettingService.getStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run backtest
app.get('/api/v1/backtest/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const results = await backtestService.runBacktest(sport, {
      sampleSize: 500,
      minConfidence: 0.55,
      minExpectedValue: 0.02
    });

    if (!results) {
      return res.status(400).json({ 
        success: false, 
        error: 'Not enough historical data for backtest' 
      });
    }

    res.json({ success: true, ...results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Performance report
app.get('/api/v1/performance', (req, res) => {
  try {
    const stats = bettingService.getStats();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Available sports
app.get('/api/v1/sports', (req, res) => {
  res.json({
    success: true,
    sports: [
      { key: 'basketball_nba', name: 'NBA' },
      { key: 'soccer_epl', name: 'English Premier League' },
      { key: 'soccer_esp_la_liga', name: 'Spanish La Liga' }
    ]
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// Start server
function startServer() {
  initDatabase();
  app.listen(PORT, () => {
    console.log(`🌐 API Server running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1`);
  });
}

// Run
startServer();
