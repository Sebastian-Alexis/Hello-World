#!/usr/bin/env node

/**
 * Quick Blog Testing Script
 * Run blog tests quickly without the full suite
 */

import { execSync } from 'child_process';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function runCommand(command, description) {
  log(`\n🔍 ${description}...`, 'cyan');
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} passed!`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} failed!`, 'red');
    return false;
  }
}

async function main() {
  log('\n🧪 Quick Blog Test Runner', 'magenta');
  log('='.repeat(50), 'bright');
  
  const startTime = Date.now();
  let allPassed = true;

  // Run unit tests
  if (!runCommand('npx vitest run tests/unit/blog-posts.test.ts', 'Unit Tests')) {
    allPassed = false;
  }

  // Run integration tests
  if (!runCommand('npx vitest run tests/integration/blog-routes.test.ts', 'Integration Tests')) {
    allPassed = false;
  }

  // Summary
  const duration = Math.round((Date.now() - startTime) / 1000);
  log('\n' + '='.repeat(50), 'bright');
  
  if (allPassed) {
    log(`✅ All blog tests passed in ${duration}s!`, 'green');
    process.exit(0);
  } else {
    log(`❌ Some tests failed. Duration: ${duration}s`, 'red');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n❌ Script error: ${error.message}`, 'red');
  process.exit(1);
});