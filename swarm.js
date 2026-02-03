#!/usr/bin/env node

/**
 * Agent Swarm Controller
 * Manages all autonomous agents
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, 'agents');
const LOGS_DIR = path.join(__dirname, 'logs');

const AGENTS = [
  {
    name: 'builder',
    file: 'builder-agent.js',
    schedule: '0 */6 * * *', // Every 6 hours
    description: 'Feature development & code improvements'
  },
  {
    name: 'test',
    file: 'test-agent.js',
    schedule: '0 */4 * * *', // Every 4 hours
    description: 'Testing & quality assurance'
  },
  {
    name: 'research',
    file: 'research-agent.js',
    schedule: '0 */12 * * *', // Every 12 hours
    description: 'Moltbook monitoring & trends'
  },
  {
    name: 'deploy',
    file: 'deploy-agent.js',
    schedule: '0 2 * * *', // 2 AM daily
    description: 'Deployment & health monitoring'
  }
];

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function runAgent(agentName) {
  const agent = AGENTS.find(a => a.name === agentName);
  if (!agent) {
    log(`Unknown agent: ${agentName}`);
    return;
  }
  
  const agentPath = path.join(AGENTS_DIR, agent.file);
  
  if (!fs.existsSync(agentPath)) {
    log(`Agent file not found: ${agentPath}`);
    return;
  }
  
  log(`🚀 Starting ${agent.name} agent...`);
  
  const child = spawn('node', [agentPath], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  child.on('close', (code) => {
    log(`✅ ${agent.name} agent finished with code ${code}`);
  });
  
  child.on('error', (error) => {
    log(`❌ ${agent.name} agent error: ${error.message}`);
  });
}

function runAllAgents() {
  log('🎯 RUNNING ALL AGENTS');
  log('═══════════════════════════════════════');
  
  for (const agent of AGENTS) {
    runAgent(agent.name);
  }
}

function showStatus() {
  console.log('\n🎯 AGENT SWARM STATUS');
  console.log('═══════════════════════════════════════');
  
  for (const agent of AGENTS) {
    const logFile = path.join(LOGS_DIR, `${agent.name}-agent.log`);
    let lastRun = 'Never';
    
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      lastRun = stats.mtime.toLocaleString();
    }
    
    console.log(`\n🤖 ${agent.name.toUpperCase()} AGENT`);
    console.log(`   Schedule: ${agent.schedule}`);
    console.log(`   Description: ${agent.description}`);
    console.log(`   Last run: ${lastRun}`);
    console.log(`   Command: node agents/${agent.file}`);
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('To run an agent: node swarm.js run <agent-name>');
  console.log('To run all: node swarm.js run all');
  console.log('To view status: node swarm.js status');
}

function generateCronEntries() {
  console.log('\n📅 CRON ENTRIES (add to crontab)');
  console.log('═══════════════════════════════════════');
  
  for (const agent of AGENTS) {
    console.log(`${agent.schedule} cd ${__dirname} && node agents/${agent.file} >> logs/${agent.name}-agent.log 2>&1`);
  }
  
  console.log('\nAdd with: crontab -e');
}

function main() {
  const command = process.argv[2];
  const agentName = process.argv[3];
  
  // Ensure logs directory exists
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  switch (command) {
    case 'run':
      if (agentName === 'all') {
        runAllAgents();
      } else if (agentName) {
        runAgent(agentName);
      } else {
        console.log('Usage: node swarm.js run <agent-name>|all');
      }
      break;
      
    case 'status':
      showStatus();
      break;
      
    case 'cron':
      generateCronEntries();
      break;
      
    case 'help':
    default:
      console.log(`
🎯 AGENT SWARM CONTROLLER

Commands:
  node swarm.js run <agent>   Run a specific agent
  node swarm.js run all       Run all agents
  node swarm.js status        Show swarm status
  node swarm.js cron          Generate cron entries
  node swarm.js help          Show this help

Agents:
  builder   - Feature development (every 6 hours)
  test      - Testing & QA (every 4 hours)
  research  - Monitoring & trends (every 12 hours)
  deploy    - Deployment & health (daily at 2 AM)
      `);
  }
}

main();
