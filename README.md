# Sports Predictor - Professional Sports Prediction System

A production-grade sports prediction application using statistical modeling and machine learning to generate predictions for NBA, English Premier League, and Spanish La Liga.

## 🎯 Features

- **Real-time Predictions**: Generate predictions for upcoming games across multiple sports
- **Statistical Modeling**: Feature-based prediction engine with team statistics, form analysis, and head-to-head data
- **Paper Betting**: Test strategies without risking real money
- **Backtesting**: Validate models against historical data
- **Performance Tracking**: Monitor win rates, ROI, and accuracy over time
- **Web Dashboard**: Beautiful real-time dashboard for monitoring predictions and results
- **Automated Scheduling**: Cron-based daily updates

## 🏗️ Architecture

```
Sports Predictor/
├── src/
│   ├── services/
│   │   ├── database.js       # SQLite database with full schema
│   │   ├── sportsApi.js      # API client with caching & rate limiting
│   │   ├── featureEngine.js  # Feature extraction & engineering
│   │   ├── bettingService.js # Kelly Criterion staking & settlement
│   │   └── backtestService.js # Historical backtesting engine
│   └── models/
│       └── predictionModel.js # Core prediction logic
├── tests/
│   └── app.test.js          # Comprehensive test suite
├── cli.js                    # Main entry point
├── package.json             # Dependencies & scripts
└── README.md               # This file
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run predictions
npm run predict

# Place paper bets
npm run bet

# Run backtest
npm run backtest basketball_nba

# Start dashboard
npm run dashboard

# Run tests
npm test
```

## 📊 Usage

### Generate Predictions
```bash
node cli.js predict
```

### Place Paper Bets
```bash
node cli.js bet
```

### View Statistics
```bash
node cli.js stats
```

### Run Backtest
```bash
node cli.js backtest basketball_nba
```

### Full Daily Cycle
```bash
node cli.js run
```

### Start Dashboard
```bash
node cli.js dashboard
# Open http://localhost:3000
```

## 🎛️ Configuration

Create a `config.yaml` file for custom settings:

```yaml
sports_api_key: your_api_key_here
database_path: ./data/predictions.db
min_confidence: 0.55
kelly_fraction: 0.25
```

## 📈 Performance Metrics

| Metric | Description |
|--------|-------------|
| Win Rate | Percentage of winning bets |
| ROI | Return on Investment (%) |
| Expected Value | Average value per bet |
| Confidence | Model certainty level |

## 🔧 API Integration

Supports integration with:
- **The Odds API** - Real-time odds and game data
- **Custom Scrapers** - Extensible for additional data sources

## 🧪 Testing

Run the full test suite:
```bash
npm test
```

Tests cover:
- Database operations
- Feature extraction
- Prediction generation
- Betting logic
- API client
- Performance benchmarks

## 📝 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

---

**Built with ❤️ by ThothAI**
