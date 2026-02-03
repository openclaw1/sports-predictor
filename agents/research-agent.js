#!/usr/bin/env node

/**
 * Research Agent - Monitors Moltbook & Industry Trends
 * Runs every 12 hours
 * Finds improvements and opportunities
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const LOG_FILE = path.join(__dirname, '../logs/research-agent.log');
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
  console.log(message);
}

async function runResearchAgent() {
  const startTime = Date.now();
  log('🔍 RESEARCH AGENT STARTED');
  
  const findings = {
    improvements: [],
    trends: [],
    mentions: []
  };
  
  try {
    // 1. Check Moltbook feed (if API key available)
    log('📱 Checking Moltbook...');
    try {
      const feedRes = await axios.get(`${MOLTBOOK_API}/feed?sort=hot&limit=10`, {
        timeout: 10000
      });
      
      if (feedRes.data.posts) {
        for (const post of feedRes.data.posts.slice(0, 5)) {
          const title = post.title || '';
          
          // Look for relevant keywords
          if (/prediction|betting|ml|ai|model/i.test(title)) {
            findings.mentions.push({
              title: title.substring(0, 80),
              upvotes: post.upvotes,
              author: post.author?.name
            });
            log(`   Found: ${title.substring(0, 50)}...`);
          }
        }
      }
    } catch (e) {
      log('   Moltbook unavailable (expected without API key)');
    }
    
    // 2. Check local system for improvements
    log('🔧 Checking system improvements...');
    
    // Check for outdated dependencies
    try {
      const outdated = execSync('npm outdated --json 2>/dev/null || echo "{}"', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8'
      });
      const deps = JSON.parse(outdated);
      const outdatedCount = Object.keys(deps).length;
      
      if (outdatedCount > 0) {
        findings.improvements.push({
          type: 'dependencies',
          message: `${outdatedCount} outdated packages`,
          priority: 'medium'
        });
        log(`   ${outdatedCount} outdated packages`);
      }
    } catch (e) {}
    
    // 3. Check test coverage trend
    log('📈 Checking coverage...');
    const coverageFile = path.join(__dirname, '../coverage/lcov.info');
    if (fs.existsSync(coverageFile)) {
      const content = fs.readFileSync(coverageFile, 'utf8');
      const lines = content.split('\n').filter(l => l.includes('LF:')).length;
      const hit = content.split('\n').filter(l => l.includes('LH:')).length;
      
      if (lines > 0) {
        const coverage = (hit / lines * 100).toFixed(1);
        log(`   Current coverage: ${coverage}%`);
        
        if (parseFloat(coverage) < 50) {
          findings.improvements.push({
            type: 'coverage',
            message: `Coverage at ${coverage}%, target 50%+`,
            priority: 'high'
          });
        }
      }
    }
    
    // 4. Generate research report
    log('📊 Generating research report...');
    const report = {
      timestamp: new Date().toISOString(),
      duration: (Date.now() - startTime) / 1000,
      findings: {
        improvements: findings.improvements,
        trends: findings.trends,
        mentions: findings.mentions.slice(0, 5)
      },
      recommendations: []
    };
    
    // Add recommendations
    if (findings.improvements.length > 0) {
      report.recommendations.push('Review improvements list and prioritize fixes');
    }
    if (findings.mentions.length === 0) {
      report.recommendations.push('Consider posting on Moltbook to increase visibility');
    }
    
    const reportFile = path.join(__dirname, '../logs/research-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✅ RESEARCH AGENT COMPLETE (${duration}s)`);
    log(`   Findings: ${findings.improvements.length} improvements, ${findings.mentions.length} mentions`);
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
  }
}

// Helper for execSync
function execSync(cmd, options) {
  const { exec } = require('child_process');
  return require('child_process').execSync(cmd, options);
}

// Run if called directly
if (require.main === module) {
  runResearchAgent();
}

module.exports = { runResearchAgent };
