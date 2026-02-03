#!/usr/bin/env node

/**
 * Test Agent - Autonomous Testing
 * Runs every 4 hours
 * Validates system health and code quality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../logs/test-agent.log');

function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
  console.log(message);
}

function runTestAgent() {
  const startTime = Date.now();
  log('🧪 TEST AGENT STARTED');
  
  const results = {
    tests: { passed: 0, failed: 0, total: 0 },
    coverage: 0,
    health: 'unknown',
    errors: []
  };
  
  try {
    // 1. Run test suite
    log('📋 Running test suite...');
    const testOutput = execSync('npm test -- --json 2>&1', { 
      cwd: path.join(__dirname, '..'), 
      encoding: 'utf8',
      timeout: 60000
    });
    
    // Parse test results
    if (testOutput.includes('Tests:')) {
      const passMatch = testOutput.match(/Tests:\s+(\d+)\s+passed/);
      const failMatch = testOutput.match(/(\d+)\s+failed/);
      const totalMatch = testOutput.match(/Tests:\s+(\d+)/);
      
      results.tests.passed = passMatch ? parseInt(passMatch[1]) : 0;
      results.tests.failed = failMatch ? parseInt(failMatch[1]) : 0;
      results.tests.total = totalMatch ? parseInt(totalMatch[1]) : 0;
    }
    
    // 2. Check coverage
    if (testOutput.includes('All files')) {
      const covMatch = testOutput.match(/All files\s+\|\s+[\d.]+\s+\|\s+[\d.]+\s+\|\s+[\d.]+\s+\|\s+([\d.]+)/);
      results.coverage = covMatch ? parseFloat(covMatch[1]) : 0;
    }
    
    log(`   Tests: ${results.tests.passed}/${results.tests.total} passed`);
    log(`   Coverage: ${results.coverage}%`);
    
    // 3. Database health check
    log('💾 Checking database...');
    try {
      const dbCheck = execSync('node -e "const db = require(\\\"./src/services/database\\\").getDb(); console.log(db.prepare(\\\"SELECT COUNT(*) as cnt FROM games\\\").get().cnt);"', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8'
      });
      results.health = 'healthy';
      log(`   Database OK: ${dbCheck.trim()} games stored`);
    } catch (e) {
      results.health = 'error';
      results.errors.push('Database check failed: ' + e.message);
      log('   ❌ Database error');
    }
    
    // 4. API health check
    log('🌐 Checking API...');
    try {
      // Check if api.js syntax is valid
      execSync('node --check api.js', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      log('   API server OK (syntax check)');
    } catch (e) {
      results.errors.push('API syntax error: ' + e.message);
      log('   ❌ API error');
    }
    
    // 5. Generate report
    log('📊 Generating report...');
    const report = {
      timestamp: new Date().toISOString(),
      duration: (Date.now() - startTime) / 1000,
      ...results,
      status: results.tests.failed === 0 && results.health === 'healthy' ? 'PASS' : 'FAIL'
    };
    
    const reportFile = path.join(__dirname, '../logs/test-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✅ TEST AGENT COMPLETE (${duration}s) - ${report.status}`);
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    results.errors.push(error.message);
    
    // Still write report on error
    const report = {
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      error: error.message
    };
    fs.writeFileSync(
      path.join(__dirname, '../logs/test-report.json'),
      JSON.stringify(report, null, 2)
    );
  }
}

// Run if called directly
if (require.main === module) {
  runTestAgent();
}

module.exports = { runTestAgent };
