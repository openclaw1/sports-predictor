const featureEngine = require('../services/featureEngine');
const sportsApi = require('../services/sportsApi');

class PredictionModel {
  constructor() {
    // Model version for tracking
    this.version = '1.0.0';
    this.isTrained = false;
  }

  // Train model on historical data (simple logistic regression)
  async train(sportKey) {
    console.log(`📊 Training model for ${sportKey}...`);

    const historicalData = await sportsApi.getHistoricalData(sportKey, 500);

    if (historicalData.length < 50) {
      console.log(`⚠️  Not enough data for ${sportKey}, using baseline model`);
      return false;
    }

    // Calculate feature weights from historical data
    // This is a simplified approach - in production use proper ML
    let homeWins = 0;
    let homeAdvantage = 0;

    for (const game of historicalData) {
      if (game.home_score > game.away_score) {
        homeWins++;
      }
    }

    homeAdvantage = homeWins / historicalData.length;

    this.weights = {
      homeAdvantage: homeAdvantage - 0.5, // Deviation from 50%
      baseHomeWinRate: homeAdvantage
    };

    this.isTrained = true;
    console.log(`✅ Model trained: home advantage = ${(homeAdvantage * 100).toFixed(1)}%`);
    return true;
  }

  // Make prediction for a single game
  async predict(game, sport) {
    // Extract features
    const features = await featureEngine.extractFeatures(game, sport);

    // Calculate win probability for home team
    const homeWinProb = this.calculateHomeWinProbability(features);

    // Calculate win probability for away team
    const awayWinProb = 1 - homeWinProb;

    // Determine predicted winner and confidence
    let predictedWinner, confidence;

    if (homeWinProb > awayWinProb) {
      predictedWinner = game.home_team;
      confidence = homeWinProb;
    } else {
      predictedWinner = game.away_team;
      confidence = awayWinProb;
    }

    // Calculate expected value (if we have odds)
    const bestOdds = this.getBestOdds(game);
    const ev = this.calculateExpectedValue(homeWinProb, awayWinProb, bestOdds);

    return {
      homeWinProb: homeWinProb.toFixed(3),
      awayWinProb: awayWinProb.toFixed(3),
      predictedWinner,
      confidence: confidence.toFixed(3),
      expectedValue: ev.toFixed(3),
      features: this.summarizeFeatures(features),
      modelVersion: this.version,
      isTrained: this.isTrained
    };
  }

  // Calculate home win probability using features
  calculateHomeWinProbability(features) {
    let probability = 0.5; // Base probability

    // Home advantage (typically 3-5%)
    probability += this.weights?.homeAdvantage || 0.03;

    // Recent form (last 10 games)
    const formDiff = (features.homeRecentWinPct - features.awayRecentWinPct) * 0.15;
    probability += formDiff;

    // Overall win percentage
    const overallDiff = (features.homeWinPct - features.awayWinPct) * 0.10;
    probability += overallDiff;

    // Home/away splits
    const homeAdvantage = (features.homeWinPctHome - features.awayWinPctAway) * 0.10;
    probability += homeAdvantage;

    // Head-to-head
    const h2hAdvantage = (features.h2hHomeWins - features.h2hAwayWins) / Math.max(features.h2hTotal, 1) * 0.05;
    probability += h2hAdvantage;

    // Rest days advantage
    probability += features.homeRestAdvantage * 0.03;

    // Streak bonus
    probability += Math.min(features.homeStreak, 3) * 0.01;
    probability += Math.max(features.awayStreak, -3) * -0.01;

    // Clamp to reasonable bounds
    return Math.max(0.25, Math.min(0.85, probability));
  }

  // Get best available odds from game object
  getBestOdds(game) {
    if (!game.bookmakers || game.bookmakers.length === 0) {
      return { home: 1.90, away: 1.90 };
    }

    let bestHome = 0;
    let bestAway = 0;

    for (const bookmaker of game.bookmakers) {
      for (const market of bookmaker.markets || []) {
        if (market.key === 'h2h') {
          for (const outcome of market.outcomes || []) {
            if (outcome.name === game.home_team && outcome.price > bestHome) {
              bestHome = outcome.price;
            }
            if (outcome.name === game.away_team && outcome.price > bestAway) {
              bestAway = outcome.price;
            }
          }
        }
      }
    }

    return {
      home: bestHome || 1.90,
      away: bestAway || 1.90
    };
  }

  // Calculate expected value
  calculateExpectedValue(homeProb, awayProb, odds) {
    // EV = (winProb * odds) - (lossProb * 1)
    // Using home team as example
    const homeEV = (homeProb * odds.home) - ((1 - homeProb) * 1);
    const awayEV = (awayProb * odds.away) - ((1 - awayProb) * 1);

    return Math.max(homeEV, awayEV);
  }

  // Summarize features for logging
  summarizeFeatures(features) {
    return {
      homeRecentForm: (features.homeRecentWinPct * 100).toFixed(1) + '%',
      awayRecentForm: (features.awayRecentWinPct * 100).toFixed(1) + '%',
      h2h: `${features.h2hHomeWins}-${features.h2hAwayWins}`,
      restAdvantage: features.homeRestDays.toFixed(1) + ' vs ' + features.awayRestDays.toFixed(1) + ' days'
    };
  }

  // Batch predict for multiple games
  async predictAll(games, sport) {
    const predictions = [];

    for (const game of games) {
      const prediction = await this.predict(game, sport);
      predictions.push({
        game,
        prediction
      });
    }

    return predictions;
  }
}

module.exports = new PredictionModel();
