# Sports Predictor API

Professional REST API for the Sports Predictor system.

## Base URL

```
http://localhost:3001/api/v1
```

## Endpoints

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-03T00:00:00.000Z"
}
```

### API Info

```http
GET /api/v1
```

### Predictions

#### Get All Predictions

```http
GET /api/v1/predictions
```

Response:
```json
{
  "success": true,
  "predictions": {
    "basketball_nba": [...],
    "soccer_epl": [...],
    "soccer_esp_la_liga": [...]
  }
}
```

#### Get Predictions by Sport

```http
GET /api/v1/predictions/:sport
```

Example: `GET /api/v1/predictions/basketball_nba`

Response:
```json
{
  "success": true,
  "sport": "basketball_nba",
  "count": 10,
  "predictions": [
    {
      "game_id": "abc123",
      "home_team": "Lakers",
      "away_team": "Warriors",
      "start_time": "2026-02-04T03:00:00.000Z",
      "prediction": "Lakers",
      "confidence": "0.62",
      "home_probability": "0.62",
      "away_probability": "0.38",
      "expected_value": "0.15",
      "model_version": "1.0.0"
    }
  ]
}
```

### Betting

#### Place Bets

```http
POST /api/v1/bets
```

Response:
```json
{
  "success": true,
  "placed": 4,
  "skipped": 8
}
```

#### Get Statistics

```http
GET /api/v1/stats
```

Response:
```json
{
  "success": true,
  "bankroll": 859.19,
  "totalBets": 4,
  "wins": 0,
  "losses": 0,
  "winRate": "0.0",
  "roi": "0.00",
  "totalProfit": 0
}
```

### Analysis

#### Run Backtest

```http
GET /api/v1/backtest/:sport
```

Example: `GET /api/v1/backtest/basketball_nba`

Response:
```json
{
  "success": true,
  "totalBets": 136,
  "wins": 93,
  "losses": 37,
  "winRate": 68.4,
  "roi": 35.13,
  "sampleSize": 200
}
```

#### Performance Report

```http
GET /api/v1/performance
```

Response:
```json
{
  "success": true,
  "timestamp": "2026-02-03T00:00:00.000Z",
  "bankroll": 859.19,
  "totalBets": 4,
  "winRate": "0.0",
  "roi": "0.00"
}
```

### Sports

#### List Available Sports

```http
GET /api/v1/sports
```

Response:
```json
{
  "success": true,
  "sports": [
    { "key": "basketball_nba", "name": "NBA" },
    { "key": "soccer_epl", "name": "English Premier League" },
    { "key": "soccer_esp_la_liga", "name": "Spanish La Liga" }
  ]
}
```

## Error Responses

```json
{
  "success": false,
  "error": "Error description",
  "hint": "How to fix (optional)"
}
```

## Rate Limits

- 100 requests/minute
- 1 post per 30 minutes (for betting)
- 50 comments per day

## Running the API

```bash
node api.js
```

Default port: 3001

Environment variables:
- `PORT` - Custom port number
