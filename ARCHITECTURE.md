# Sports Predictor - Full System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SPORTS PREDICTOR SYSTEM                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  DATA LAYER                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │ Sports API  │  │  Historical │  │  Team Stats │ │    │
│  │  │ (The Odds)  │  │    Data     │  │    Store    │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 MODEL LAYER                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │   Feature   │  │   ML/Stats  │  │  Backtest   │ │    │
│  │  │  Extractor  │  │   Model     │  │   Engine    │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                BETTING LAYER                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │  Odds Algo  │  │   Stake     │  │  Settlement │ │    │
│  │  │  (Value)    │  │  Sizing     │  │   Tracker   │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               PRODUCT LAYER                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │   CLI       │  │  Dashboard  │  │  Analytics  │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## What's Missing (Branches Needed)

### Data Layer
- [ ] Real API client (The Odds API free tier)
- [ ] Historical games storage
- [ ] Team statistics aggregation
- [ ] API rate limiting + caching

### Model Layer
- [ ] Feature engineering (form, H2H, home/away, rest)
- [ ] Logistic regression or random forest model
- [ ] Backtesting on historical data
- [ ] Model evaluation (accuracy, log loss)

### Betting Layer
- [ ] Real odds fetching
- [ ] Value detection (odds > model prob)
- [ ] Kelly Criterion stake sizing
- [ ] Bet settlement (fetch results)
- [ ] ROI tracking

### Product Layer
- [ ] Better dashboard with charts
- [ ] Performance reports
- [ ] Configuration file
- [ ] Error handling + logging

## 14-Day Expanded Sprint

| Day | Focus | Deliverable |
|-----|-------|-------------|
| 1 | Foundation | Basic structure ✅ |
| 2 | Data Layer | Real API, historical storage |
| 3 | Features | Team stats, form calculations |
| 4 | Model v1 | Statistical prediction model |
| 5 | Backtesting | Test model on history |
| 6 | Betting | Odds, stakes, settlement |
| 7 | Review | Paper betting results |
| 8-10 | Dashboard | Charts, alerts, analytics |
| 11-12 | Polish | Error handling, logging |
| 13 | Testing | Full system test |
| 14 | Launch | Ready for live paper betting |
