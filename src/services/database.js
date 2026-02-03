const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'predictions.db');

let db;

function initDatabase() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  db = new Database(DB_PATH);
  
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  
  // Create tables
  db.exec(`
    -- Games data
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      sport TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      start_time TEXT NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      status TEXT DEFAULT 'scheduled',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Predictions
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      predicted_winner TEXT NOT NULL,
      confidence REAL NOT NULL,
      model_version TEXT DEFAULT '1.0',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    -- Paper bets
    CREATE TABLE IF NOT EXISTS paper_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prediction_id INTEGER NOT NULL,
      stake REAL NOT NULL,
      odds REAL NOT NULL,
      selection TEXT NOT NULL,
      result TEXT,
      profit REAL DEFAULT 0,
      placed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      settled_at TEXT,
      FOREIGN KEY (prediction_id) REFERENCES predictions(id)
    );

    -- Team stats (computed features)
    CREATE TABLE IF NOT EXISTS team_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT NOT NULL,
      sport TEXT NOT NULL,
      season TEXT NOT NULL,
      games_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      points_scored_avg REAL DEFAULT 0,
      points_conceded_avg REAL DEFAULT 0,
      home_wins INTEGER DEFAULT 0,
      away_wins INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_name, sport, season)
    );

    -- Betting history for analytics
    CREATE TABLE IF NOT EXISTS betting_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      bets_placed INTEGER DEFAULT 0,
      bets_won INTEGER DEFAULT 0,
      total_staked REAL DEFAULT 0,
      total_profit REAL DEFAULT 0,
      roi REAL DEFAULT 0
    );

    -- Settings/State
    CREATE TABLE IF NOT EXISTS state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('✅ Database initialized:', DB_PATH);
  return db;
}

function getDb() {
  if (!db) initDatabase();
  return db;
}

module.exports = { initDatabase, getDb, DB_PATH };
