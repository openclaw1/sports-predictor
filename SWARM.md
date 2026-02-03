# Sports Predictor Pro - Agent Swarm Setup

## 🎯 Your Autonomous Development Team

```
┌─────────────────────────────────────────────────────────────┐
│                  AGENT SWARM v2.0                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   BUILDER   │  │    TEST     │  │  RESEARCH   │          │
│  │   AGENT     │  │   AGENT     │  │   AGENT     │          │
│  │             │  │             │  │             │          │
│  │ Every 6h    │  │ Every 4h    │  │ Every 12h   │          │
│  │ Features    │  │ Tests       │  │ Monitoring  │          │
│  │ Updates     │  │ QA          │  │ Trends      │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│         │               │               │                   │
│         └───────────────┴───────────────┘                   │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │   DEPLOY    │                         │
│                    │   AGENT     │                         │
│                    │             │                         │
│                    │  Daily 2AM  │                         │
│                    │  Deployment │                         │
│                    └─────────────┘                         │
│                           │                                 │
│                           ▼                                 │
│                    ┌─────────────┐                         │
│                    │   CRON      │                         │
│                    │   (You)     │                         │
│                    └─────────────┘                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Run the Swarm Manually

```bash
cd /home/h8/.openclaw/sports-predictor

# View swarm status
node swarm.js status

# Run all agents
node swarm.js run all

# Run specific agent
node swarm.js run builder
node swarm.js run test
node swarm.js run research
node swarm.js run deploy
```

### 2. Check Cron Jobs

Cron is already set up:
```bash
crontab -l | grep sports-predictor
```

Output:
```
0 */6 * * *  → Builder (every 6 hours)
0 */4 * * *  → Test (every 4 hours)
0 */12 * * * → Research (every 12 hours)
0 2 * * *    → Deploy (2 AM daily)
0 9 * * *    → Predictions (9 AM daily)
```

### 3. View Logs

```bash
# All logs
ls -la logs/

# Builder agent log
tail -f logs/builder-agent.log

# Test results
cat logs/test-report.json

# Performance
cat logs/performance.jsonl
```

---

## 🤖 Agent Details

### Builder Agent
- **Schedule**: Every 6 hours
- **Role**: Feature development, updates, predictions
- **Log**: `logs/builder-agent.log`

### Test Agent
- **Schedule**: Every 4 hours
- **Role**: Run tests, check coverage, database health
- **Log**: `logs/test-agent.log`
- **Report**: `logs/test-report.json`

### Research Agent
- **Schedule**: Every 12 hours
- **Role**: Monitor Moltbook, check trends, find improvements
- **Log**: `logs/research-agent.log`
- **Report**: `logs/research-report.json`

### Deploy Agent
- **Schedule**: Daily at 2 AM
- **Role**: GitHub sync, process check, memory/disk monitoring
- **Log**: `logs/deploy-agent.log`
- **Report**: `logs/deploy-report.json`

---

## 🔒 Security Features

Your system is protected with:

| Feature | Protection |
|---------|------------|
| API Key Auth | Prevents unauthorized access |
| Rate Limiting | 100 req/15min (general), 10/hr (betting) |
| CORS | Controlled cross-origin access |
| Helmet | Secure HTTP headers |
| Input Validation | Prevents injection attacks |

**IMPORTANT**: Change the default API key!

```bash
export API_KEY=your-secure-random-key
```

Or edit `.env.example` and rename to `.env`.

---

## 📦 GitHub Integration

Repository: https://github.com/openclaw1/sports-predictor

Agents auto-commit and push changes:
1. Pull latest code
2. Run tests
3. Make improvements
4. Commit changes
5. Push to GitHub

---

## 🎛️ Swarm Controller Commands

```bash
# Show all agents and their status
node swarm.js status

# Generate cron entries
node swarm.js cron

# Run specific agent
node swarm.js run <name>

# Run all agents
node swarm.js run all

# Help
node swarm.js help
```

---

## 📊 Performance Tracking

The swarm tracks:
- Test pass/fail rates
- Code coverage trends
- API response times
- System resource usage
- Prediction accuracy

View reports in `/logs/`:
- `test-report.json`
- `research-report.json`
- `deploy-report.json`
- `performance.jsonl`

---

## 🛠️ Maintenance

### Check System Health
```bash
node agents/deploy-agent.js
```

### Run Tests
```bash
npm test
```

### Check Dependencies
```bash
npm outdated
```

### View API Docs
```bash
node api.js
# Open http://localhost:3001/api/v1
```

---

## ⚠️ Important Notes

1. **API Key**: Change `API_KEY` in `.env` before production
2. **Logs**: Review logs regularly for issues
3. **GitHub Token**: Store securely, never commit
4. **Cron**: Runs automatically - no action needed
5. **Backups**: Consider setting up automated backups

---

**Status**: ✅ Swarm deployed and running
**Repo**: https://github.com/openclaw1/sports-predictor
**Docs**: See SECURITY.md for security guidelines
