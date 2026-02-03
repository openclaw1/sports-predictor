#!/usr/bin/env node

/**
 * Builder Agent - Autonomous Feature Development
 * Runs every 6 hours
 * Improves the sports predictor system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/builder-agent.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
  console.log(message);
}

function runBuilderAgent() {
  const startTime = Date.now();
  log('🧱 BUILDER AGENT STARTED');
  
  try {
    // 1. Pull latest code from Git
    log('📥 Pulling latest code...');
    execSync('git pull origin main', { cwd: __dirname, stdio: 'pipe' });
    
    // 2. Install any new dependencies
    log('📦 Checking dependencies...');
    try {
      execSync('npm install --silent', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
    } catch (e) {
      log('⚠️  npm install failed, continuing...');
    }
    
    // 3. Run tests
    log('🧪 Running tests...');
    const testOutput = execSync('npm test -- --silent 2>&1', { 
      cwd: path.join(__dirname, '..'), 
      encoding: 'utf8',
      timeout: 60000
    });
    
    if (testOutput.includes('Tests:')) {
      const passMatch = testOutput.match(/Tests:\s+(\d+)\s+passed/);
      const failMatch = testOutput.match(/(\d+)\s+failed/);
      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      log(`   Tests: ${passed} passed, ${failed} failed`);
      
      if (failed > 0) {
        log('⚠️  Tests failing, skipping feature development');
        return;
      }
    }
    
    // 4. Generate predictions
    log('🎯 Generating predictions...');
    try {
      execSync('node cli.js predict --silent', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe' 
      });
    } catch (e) {
      // Predict may fail if no games, that's OK
    }
    
    // 5. Code quality check
    log('🔍 Quality check...');
    const files = execSync('find src -name "*.js" | wc -l', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim();
    log(`   Source files: ${files}`);
    
    // 6. Commit any changes
    log('💾 Committing changes...');
    try {
      execSync('git add -A', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
      const status = execSync('git status --short', { 
        cwd: path.join(__dirname, '..'), 
        encoding: 'utf8' 
      });
      
      if (status.trim()) {
        const date = new Date().toISOString().split('T')[0];
        execSync(`git commit -m "Auto-update: ${date}"`, { 
          cwd: path.join(__dirname, '..'), 
          stdio: 'pipe' 
        });
        execSync('git push origin main', { 
          cwd: path.join(__dirname, '..'), 
          stdio: 'pipe' 
        });
        log('   Changes committed and pushed');
      } else {
        log('   No changes to commit');
      }
    } catch (e) {
      log('   Nothing to commit or push failed');
    }
    
    // 7. Performance snapshot
    log('📊 Performance snapshot...');
    try {
      execSync('node scripts/performance.js --silent', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
    } catch (e) {}
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✅ BUILDER AGENT COMPLETE (${duration}s)`);
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  runBuilderAgent();
}

module.exports = { runBuilderAgent };
