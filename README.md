# Sports Predictor - Quick Start

## Setup

### 1. Get Free API Key (Optional - Mock Mode Works Without It)

1. Go to https://the-odds-api.com/
2. Sign up for free account
3. Copy your API key
4. Set it in environment or config.yaml:
   ```bash
   export SPORTS_API_KEY=your_key_here
   ```

**Without API key:** System runs in mock mode (fake data for testing)

### 2. First Run

```bash
cd /home/h8/.openclaw/sports-predictor

# Run full daily cycle (fetch + predict + bet)
node cli.js run

# View stats
node cli.js stats

# Start dashboard
node cli.js dashboard
```

### 3. Dashboard

Open http://localhost:3000 to see:
- Bankroll
- Win rate
- ROI
- Today's predictions

### 4. Automated Runs

Add to crontab for daily execution:
```bash
crontab -e
# Add line:
0 9 * * * cd /home/h8/.openclaw/sports-predictor && node cli.js run >> /var/log/sports-predictor.log 2>&1
```

## Commands

| Command | Description |
|---------|-------------|
| `node cli.js fetch` | Fetch today's games |
| `node cli.js predict` | Generate predictions |
| `node cli.js bet` | Place paper bets |
| `node cli.js stats` | Show betting stats |
| `node cli.js run` | Full cycle (fetch + predict + bet) |
| `node cli.js dashboard` | Start web dashboard |

## Files

```
sports-predictor/
├── data/              # SQLite database
├── public/            # Dashboard files
├── src/
│   ├── models/        # Prediction engine
│   └── services/      # Database, API, betting
├── cli.js            # Main entry point
└── config.yaml       # Configuration
```

## Paper Betting

- Starts with $1000 bankroll
- 5% stake per bet
- Minimum 55% confidence threshold
- Tracks: win rate, ROI, profit/loss
