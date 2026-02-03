#!/usr/bin/env node

/**
 * Deploy Agent - Deployment & Health Monitoring
 * Runs every 24 hours
 * Manages deployment and system health
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/deploy-agent.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
  console.log(message);
}

function runDeployAgent() {
  const startTime = Date.now();
  log('🚀 DEPLOY AGENT STARTED');
  
  const status = {
    github: 'unknown',
    processes: 'unknown',
    memory: 'unknown',
    disk: 'unknown',
    uptime: 'unknown'
  };
  
  try {
    // 1. GitHub sync
    log('🔗 Syncing with GitHub...');
    try {
      execSync('git fetch origin', { cwd: __dirname, stdio: 'pipe' });
      const remote = execSync('git rev-parse HEAD', { 
        cwd: __dirname, 
        encoding: 'utf8' 
      }).trim();
      const local = execSync('git rev-parse HEAD', { 
        cwd: __dirname, 
        encoding: 'utf8' 
      }).trim();
      
      status.github = remote === local ? 'synced' : 'behind';
      log(`   GitHub: ${status.github}`);
    } catch (e) {
      status.github = 'error';
      log('   GitHub sync failed');
    }
    
    // 2. Process check
    log('⚙️  Checking processes...');
    try {
      const processes = execSync('ps aux | grep "node.*cli.js" | grep -v grep | wc -l', {
        encoding: 'utf8'
      }).trim();
      status.processes = processes > 0 ? 'running' : 'stopped';
      log(`   Processes: ${processes} running`);
    } catch (e) {
      status.processes = 'unknown';
    }
    
    // 3. Memory usage
    log('💾 Checking memory...');
    try {
      const mem = execSync('free -m | grep Mem | awk "{print $3/$2 * 100}"', {
        encoding: 'utf8'
      }).trim();
      status.memory = `${parseFloat(mem).toFixed(1)}% used`;
      log(`   Memory: ${status.memory}`);
    } catch (e) {
      status.memory = 'unknown';
    }
    
    // 4. Disk usage
    log('💿 Checking disk...');
    try {
      const disk = execSync('df -h . | tail -1 | awk "{print $5}"', {
        encoding: 'utf8'
      }).trim();
      status.disk = disk;
      log(`   Disk: ${disk} used`);
    } catch (e) {
      status.disk = 'unknown';
    }
    
    // 5. Uptime
    log('⏱️  Checking uptime...');
    try {
      const uptime = execSync('uptime -p 2>/dev/null || uptime', {
        encoding: 'utf8'
      }).trim();
      status.uptime = uptime;
      log(`   Uptime: ${uptime}`);
    } catch (e) {
      status.uptime = 'unknown';
    }
    
    // 6. Generate deployment report
    log('📊 Generating deployment report...');
    const report = {
      timestamp: new Date().toISOString(),
      duration: (Date.now() - startTime) / 1000,
      status,
      health: status.processes === 'running' ? 'healthy' : 'warning'
    };
    
    const reportFile = path.join(__dirname, '../logs/deploy-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✅ DEPLOY AGENT COMPLETE (${duration}s) - ${report.health}`);
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  runDeployAgent();
}

module.exports = { runDeployAgent };
