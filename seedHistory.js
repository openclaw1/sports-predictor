#!/usr/bin/env node

/**
 * Seed historical data for testing
 * Creates fake historical games for model training
 */

const { initDatabase, getDb } = require('./src/services/database');
const fs = require('fs');
const path = require('path');

// Initialize
initDatabase();
const db = getDb();

const teams = {
  basketball_nba: [
    'Lakers', 'Warriors', 'Celtics', 'Heat', 'Bucks', 'Suns',
    'Nets', 'Clippers', 'Bulls', 'Knicks', '76ers', 'Raptors',
    'Cavaliers', 'Pacers', 'Hornets', 'Hawks', 'Magic', 'Wizards'
  ],
  soccer_epl: [
    'Arsenal', 'Liverpool', 'Man City', 'Man United', 'Chelsea',
    'Tottenham', 'Newcastle', 'Villa', 'Brighton', 'West Ham',
    'Crystal Palace', 'Fulham', 'Wolves', 'Everton', ' Brentford'
  ],
  soccer_esp_la_liga: [
    'Real Madrid', 'Barcelona', 'Atlético Madrid', 'Sevilla',
    'Betis', 'Valencia', 'Villarreal', 'Real Sociedad', 'Athletic', 'Osasuna',
    'Celta Vigo', 'Almería', 'Girona', 'Las Palmas', 'Mallorca'
  ]
};

function seedHistoricalData(sport, numGames = 200) {
  const sportTeams = teams[sport];
  const games = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  console.log(`\n📊 Seeding ${numGames} historical games for ${sport}...`);

  for (let i = 0; i < numGames; i++) {
    // Random teams
    const homeIdx = Math.floor(Math.random() * sportTeams.length);
    let awayIdx;
    do { awayIdx = Math.floor(Math.random() * sportTeams.length); } while (awayIdx === homeIdx);

    const homeTeam = sportTeams[homeIdx];
    const awayTeam = sportTeams[awayIdx];

    // Game time: up to 120 days ago
    const gameTime = new Date(now - (i * dayMs / 2) - Math.random() * dayMs);

    // Simulate scores with slight home advantage
    const homeBase = sport.includes('nba') ? 105 : 1.5;
    const awayBase = sport.includes('nba') ? 102 : 1.2;

    const homeScore = Math.round(homeBase + (Math.random() - 0.5) * 20);
    const awayScore = Math.round(awayBase + (Math.random() - 0.5) * 15);

    // Simulate odds (home slightly favored)
    const homeOdds = 1.70 + Math.random() * 0.4;
    const awayOdds = 1.70 + Math.random() * 0.4;

    const gameId = `${sport}_hist_${Date.now()}_${i}`;

    try {
      db.prepare(`
        INSERT OR IGNORE INTO historical_games
        (id, sport, home_team, away_team, start_time, home_score, away_score, home_odds, away_odds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(gameId, sport, homeTeam, awayTeam, gameTime.toISOString(), homeScore, awayScore, homeOdds, awayOdds);

      if (i % 50 === 0) {
        console.log(`  Progress: ${i}/${numGames}`);
      }
    } catch (e) {
      // Ignore duplicates
    }
  }

  console.log(`✅ Seeded ${numGames} games for ${sport}`);
}

// Seed all sports
console.log('\n🌱 Seeding historical data for backtesting...\n');

for (const sport of Object.keys(teams)) {
  seedHistoricalData(sport, 200);
}

console.log('\n✅ Historical data seeding complete!');
console.log('\nRun: node cli.js backtest basketball_nba');
