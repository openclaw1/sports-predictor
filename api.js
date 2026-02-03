/**
 * Sports Predictor - Secure API Server
 * Implements security best practices
 */

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { initDatabase } = require('./src/services/database');
const sportsApi = require('./src/services/sportsApi');
const predictionModel = require('./src/models/predictionModel');
const bettingService = require('./src/services/bettingService');
const backtestService = require('./src/services/backtestService');
const { logPerformance } = require('./scripts/performance');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'default-change-me';

// ============ SECURITY MIDDLEWARE ============

// Helmet - Secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS - Controlled access
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    // Only allow specific origins in production
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting - Prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: 15
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Stricter rate limit for betting endpoints
const bettingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 bets per hour
  message: {
    success: false,
    error: 'Betting rate limit exceeded.',
    retryAfter: 60
  }
});
app.use('/api/v1/bets', bettingLimiter);

// ============ BODY PARSING ============
app.use(express.json({ limit: '10kb' })); // Limit body size

// ============ API KEY AUTHENTICATION ============
function requireAuth(req, res, next) {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      hint: 'Add Authorization: Bearer YOUR_API_KEY header'
    });
  }
  
  if (apiKey !== API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  next();
}

// ============ REQUEST LOGGING (Sanitized) ============
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Log without sensitive data
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  
  next();
});

// ============ HEALTH CHECK (No Auth) ============
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============ API ENDPOINTS ============

// API Info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Sports Predictor API',
    version: '1.0.0',
    security: {
      auth: 'API key required',
      rateLimit: '100 req/15min',
      cors: 'configured'
    },
    endpoints: '/api/v1/predictions, /api/v1/bets, /api/v1/stats, /api/v1/backtest'
  });
});

// Protected endpoints
app.get('/api/v1/predictions/:sport', requireAuth, async (req, res) => {
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
        prediction: pred.predictedWinner,
        confidence: pred.confidence
      });
    }

    res.json({ success: true, sport, count: predictions.length, predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/predictions', requireAuth, async (req, res) => {
  try {
    const sports = ['basketball_nba', 'soccer_epl', 'soccer_esp_la_liga'];
    const allPredictions = {};

    for (const sport of sports) {
      const games = await sportsApi.getGamesWithOdds(sport);
      const predictions = games.slice(0, 5).map(game => ({
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        start_time: game.commence_time,
        prediction: game.home_team // Simplified
      }));
      allPredictions[sport] = predictions;
    }

    res.json({ success: true, predictions: allPredictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/v1/bets', requireAuth, async (req, res) => {
  try {
    const result = await bettingService.placeBets();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/stats', requireAuth, (req, res) => {
  try {
    const stats = bettingService.getStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/backtest/:sport', requireAuth, async (req, res) => {
  try {
    const { sport } = req.params;
    const results = await backtestService.runBacktest(sport);
    if (!results) {
      return res.status(400).json({ success: false, error: 'Not enough data' });
    }
    res.json({ success: true, ...results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/performance', requireAuth, (req, res) => {
  try {
    const stats = bettingService.getStats();
    res.json({ success: true, timestamp: new Date().toISOString(), ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(500).json({ 
    success: false, 
    error: message 
  });
});

// ============ START SERVER ============
function startServer() {
  initDatabase();
  
  app.listen(PORT, () => {
    console.log(`🔒 Secure API Server running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1`);
    console.log(`🔑 Default API Key: ${API_KEY}`);
    console.log(`⚠️  Change API_KEY environment variable in production!`);
  });
}

startServer();
