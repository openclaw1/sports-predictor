#!/usr/bin/env node

/**
 * ML Model Training Script
 * Trains the prediction model on historical data
 */

const { initDatabase, getDb } = require('./src/services/database');
const MLModel = require('./src/models/mlModel');
const path = require('path');

const MODEL_PATH = './data/model.json';

async function trainModel(sport = null) {
  console.log('\n🧠 ML Model Trainer');
  console.log('═══════════════════════════════════════\n');

  // Initialize database
  initDatabase();
  const db = getDb();

  // Get historical data
  const sports = sport 
    ? [sport] 
    : ['basketball_nba', 'soccer_epl', 'soccer_esp_la_liga'];

  let allData = [];

  for (const sportKey of sports) {
    const data = db.prepare(`
      SELECT * FROM historical_games
      WHERE sport = ? AND home_score IS NOT NULL
      ORDER BY start_time DESC
      LIMIT 500
    `).all(sportKey);
    
    console.log(`   ${sportKey}: ${data.length} samples`);
    allData = allData.concat(data);
  }

  if (allData.length < 50) {
    console.log('\n⚠️  Not enough historical data. Run "node seedHistory.js" first.');
    console.log('   Sample required: 50+ games\n');
    return;
  }

  console.log(`\n📊 Total training samples: ${allData.length}`);
  console.log(`   Training model...\n`);

  // Train model
  const result = await MLModel.train(allData, {
    learningRate: 0.1,
    epochs: 500,
    earlyStop: 30
  });

  if (result) {
    console.log(`\n✅ Training complete!`);
    console.log(`   Accuracy: ${(result.accuracy * 100).toFixed(1)}%`);
    console.log(`   Samples used: ${result.samples}`);

    // Show feature importance
    console.log(`\n📈 Feature Importance:`);
    const importance = MLModel.getFeatureImportance();
    for (const { name, importance: imp } of importance) {
      const bar = '█'.repeat(Math.floor(imp * 50));
      console.log(`   ${name.padEnd(20)} ${bar} ${imp.toFixed(3)}`);
    }

    // Save model
    MLModel.save(MODEL_PATH);

    console.log(`\n🎯 Model ready for predictions!`);
    console.log(`   Run: node cli.js predict\n`);
  }
}

// Run training
const sportArg = process.argv[2];
trainModel(sportArg === 'all' ? null : sportArg).catch(console.error);
