#!/bin/bash
# Sports Predictor - Daily Runner
# Add to cron: 0 9 * * * /home/h8/.openclaw/sports-predictor/run.sh

cd /home/h8/.openclaw/sports-predictor

echo "🚀 $(date) - Running daily cycle"
node cli.js run

echo "✅ Complete"
