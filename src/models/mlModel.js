/**
 * Sports Predictor - ML Model Trainer
 * Uses simple logistic regression for sports prediction
 */

const fs = require('fs');
const path = require('path');

class MLModel {
  constructor() {
    this.version = '2.0.0';
    this.isTrained = false;
    this.weights = {};
    this.bias = 0;
    
    // Feature names for debugging
    this.featureNames = [
      'home_win_pct',
      'away_win_pct',
      'home_recent_form',
      'away_recent_form',
      'home_advantage',
      'h2h_advantage',
      'rest_advantage',
      'streak_advantage'
    ];
  }

  /**
   * Sigmoid activation function
   */
  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Normalize features to [0, 1] range
   */
  normalizeFeatures(features) {
    const normalized = {};
    
    // Win percentages (already 0-1)
    normalized.homeWinPct = features.homeWinPct || 0.5;
    normalized.awayWinPct = features.awayWinPct || 0.5;
    
    // Recent form (already 0-1)
    normalized.homeRecentForm = features.homeRecentWinPct || 0.5;
    normalized.awayRecentForm = features.awayRecentWinPct || 0.5;
    
    // Home advantage (deviation from 0.5)
    normalized.homeAdvantage = (features.homeWinPctHome - 0.5) * 2; // -1 to 1
    normalized.awayAdvantage = (features.awayWinPctAway - 0.5) * 2;
    
    // H2H advantage (ratio)
    const h2hTotal = features.h2hTotal || 1;
    normalized.h2hAdvantage = (features.h2hHomeWins - features.h2hAwayWins) / h2hTotal;
    
    // Rest advantage (bounded -1 to 1)
    normalized.restAdvantage = Math.max(-1, Math.min(1, features.homeRestAdvantage));
    
    // Streak (bounded -3 to 3, normalized)
    normalized.streakAdvantage = Math.max(-1, Math.min(1, (features.homeStreak - features.awayStreak) / 3));
    
    return normalized;
  }

  /**
   * Train model on historical data
   */
  async train(historicalData, options = {}) {
    const {
      learningRate = 0.01,
      epochs = 1000,
      earlyStop = 50
    } = options;

    console.log(`🧠 Training ML Model v${this.version}...`);
    console.log(`   Training on ${historicalData.length} samples`);
    console.log(`   Learning rate: ${learningRate}, Epochs: ${epochs}`);

    // Prepare training data
    const X = [];
    const y = [];

    for (const game of historicalData) {
      if (!game.home_score || !game.away_score) continue;
      
      const features = this.normalizeFeatures(game);
      const homeWin = game.home_score > game.away_score ? 1 : 0;
      
      X.push([
        features.homeWinPct,
        features.awayWinPct,
        features.homeRecentForm,
        features.awayRecentForm,
        features.homeAdvantage,
        features.h2hAdvantage,
        features.restAdvantage,
        features.streakAdvantage
      ]);
      
      y.push(homeWin);
    }

    if (X.length < 10) {
      console.log('⚠️  Not enough data for training');
      return false;
    }

    // Initialize weights
    this.weights = {
      homeWinPct: Math.random() * 0.1,
      awayWinPct: Math.random() * 0.1,
      homeRecentForm: Math.random() * 0.1,
      awayRecentForm: Math.random() * 0.1,
      homeAdvantage: Math.random() * 0.1,
      h2hAdvantage: Math.random() * 0.1,
      restAdvantage: Math.random() * 0.1,
      streakAdvantage: Math.random() * 0.1
    };
    this.bias = Math.random() * 0.1;

    // Training loop
    let bestAccuracy = 0;
    let noImprovement = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;

      for (let i = 0; i < X.length; i++) {
        // Forward pass
        let prediction = this.bias;
        for (let j = 0; j < this.featureNames.length; j++) {
          prediction += X[i][j] * this.weights[this.featureNames[j]];
        }
        
        const output = this.sigmoid(prediction);
        const error = y[i] - output;
        totalError += Math.abs(error);

        // Backward pass (gradient descent)
        this.bias += learningRate * error;
        for (let j = 0; j < this.featureNames.length; j++) {
          this.weights[this.featureNames[j]] += learningRate * error * X[i][j];
        }
      }

      // Calculate accuracy
      let correct = 0;
      for (let i = 0; i < X.length; i++) {
        let prediction = this.bias;
        for (let j = 0; j < this.featureNames.length; j++) {
          prediction += X[i][j] * this.weights[this.featureNames[j]];
        }
        const output = this.sigmoid(prediction) > 0.5 ? 1 : 0;
        if (output === y[i]) correct++;
      }

      const accuracy = correct / X.length;

      if (epoch % 100 === 0) {
        console.log(`   Epoch ${epoch}: Accuracy ${(accuracy * 100).toFixed(1)}%, Error ${totalError.toFixed(4)}`);
      }

      // Early stopping
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        noImprovement = 0;
      } else {
        noImprovement++;
        if (noImprovement >= earlyStop) {
          console.log(`   Early stopping at epoch ${epoch}`);
          break;
        }
      }
    }

    this.isTrained = true;
    console.log(`✅ Model trained! Final accuracy: ${(bestAccuracy * 100).toFixed(1)}%`);
    
    return {
      accuracy: bestAccuracy,
      samples: X.length,
      epochs: epochs
    };
  }

  /**
   * Make prediction using trained model
   */
  predict(features) {
    if (!this.isTrained) {
      console.warn('Model not trained, using fallback');
      return { homeWinProb: 0.5, confidence: 0.5 };
    }

    const normalized = this.normalizeFeatures(features);

    // Calculate home win probability
    let score = this.bias;
    score += normalized.homeWinPct * this.weights.homeWinPct;
    score += normalized.awayWinPct * this.weights.awayWinPct;
    score += normalized.homeRecentForm * this.weights.homeRecentForm;
    score += normalized.awayRecentForm * this.weights.awayRecentForm;
    score += normalized.homeAdvantage * this.weights.homeAdvantage;
    score += normalized.h2hAdvantage * this.weights.h2hAdvantage;
    score += normalized.restAdvantage * this.weights.restAdvantage;
    score += normalized.streakAdvantage * this.weights.streakAdvantage;

    const homeWinProb = this.sigmoid(score);
    const awayWinProb = 1 - homeWinProb;

    return {
      homeWinProb: homeWinProb.toFixed(3),
      awayWinProb: awayWinProb.toFixed(3),
      confidence: Math.max(homeWinProb, awayWinProb).toFixed(3),
      modelVersion: this.version,
      isTrained: true
    };
  }

  /**
   * Get feature importance
   */
  getFeatureImportance() {
    const importance = {};
    for (const name of this.featureNames) {
      importance[name] = Math.abs(this.weights[name] || 0);
    }
    
    // Sort by importance
    return Object.entries(importance)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, importance: value }));
  }

  /**
   * Save model to file
   */
  save(filepath) {
    const modelData = {
      version: this.version,
      isTrained: this.isTrained,
      weights: this.weights,
      bias: this.bias,
      featureNames: this.featureNames,
      savedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(filepath, JSON.stringify(modelData, null, 2));
    console.log(`💾 Model saved to ${filepath}`);
  }

  /**
   * Load model from file
   */
  load(filepath) {
    if (!fs.existsSync(filepath)) {
      console.log(`⚠️  Model file not found: ${filepath}`);
      return false;
    }
    
    const modelData = JSON.parse(fs.readFileSync(filepath));
    this.version = modelData.version;
    this.isTrained = modelData.isTrained;
    this.weights = modelData.weights;
    this.bias = modelData.bias;
    
    console.log(`📦 Model loaded from ${filepath} (v${this.version})`);
    return true;
  }
}

module.exports = new MLModel();
