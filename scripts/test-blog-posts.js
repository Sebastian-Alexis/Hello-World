#!/usr/bin/env node

/**
 * Blog Post Testing Script
 * Comprehensive testing suite for blog post functionality
 * Supports various testing modes and environments
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

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

const log = {
  info: (msg) => console.log(`${COLORS.blue}ℹ${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}✅${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}❌${COLORS.reset} ${msg}`),
  warning: (msg) => console.log(`${COLORS.yellow}⚠️${COLORS.reset} ${msg}`),
  step: (msg) => console.log(`${COLORS.cyan}🔍${COLORS.reset} ${msg}`),
  title: (msg) => console.log(`${COLORS.bright}${COLORS.magenta}${msg}${COLORS.reset}`)
};

class BlogPostTester {
  constructor() {
    this.testResults = {
      unit: null,
      integration: null,
      e2e: null,
      performance: null,
      security: null
    };
    this.startTime = Date.now();
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async run(options = {}) {
    try {
      log.title('🧪 Blog Post Testing Suite');
      log.info('Testing blog post functionality comprehensively...\n');

      await this.validateEnvironment();
      
      if (options.unit !== false) {
        await this.runUnitTests();
      }
      
      if (options.integration !== false) {
        await this.runIntegrationTests();
      }
      
      if (options.e2e !== false) {
        await this.runE2ETests(options.browser);
      }
      
      if (options.performance) {
        await this.runPerformanceTests();
      }
      
      if (options.security) {
        await this.runSecurityTests();
      }

      this.printSummary();
      
      return this.allTestsPassed();
    } catch (error) {
      log.error(`Testing failed: ${error.message}`);
      process.exit(1);
    }
  }

  async validateEnvironment() {
    log.step('Validating test environment...');
    
    //check required files exist
    const requiredFiles = [
      'vitest.config.ts',
      'playwright.config.ts',
      'tests/unit/blog-posts.test.ts',
      'tests/integration/blog-routes.test.ts',
      'tests/e2e/blog-posts.spec.ts',
      'tests/utils/blog-test-helpers.ts'
    ];

    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        throw new Error(`Required test file not found: ${file}`);
      }
    }

    //check dependencies
    try {
      execSync('npm list vitest @playwright/test', { stdio: 'ignore' });
    } catch (error) {
      throw new Error('Required testing dependencies not installed. Run: npm install');
    }

    log.success('Test environment validated');
  }

  async runUnitTests() {
    log.step('Running unit tests...');
    
    try {
      const result = execSync('npm run test:unit', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.testResults.unit = 'passed';
      this.passedTests++;
      log.success('Unit tests passed');
      
      //extract test count from output
      const testCount = this.extractTestCount(result);
      this.totalTests += testCount;
      
    } catch (error) {
      this.testResults.unit = 'failed';
      log.error('Unit tests failed');
      log.error(error.stdout);
    }
  }

  async runIntegrationTests() {
    log.step('Running integration tests...');
    
    try {
      const result = execSync('npm run test:integration', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.testResults.integration = 'passed';
      this.passedTests++;
      log.success('Integration tests passed');
      
      const testCount = this.extractTestCount(result);
      this.totalTests += testCount;
      
    } catch (error) {
      this.testResults.integration = 'failed';
      log.error('Integration tests failed');
      log.error(error.stdout);
    }
  }

  async runE2ETests(browser = 'chromium') {
    log.step(`Running E2E tests on ${browser}...`);
    
    try {
      //ensure Playwright browsers are installed
      execSync(`npx playwright install ${browser} --with-deps`, { 
        stdio: 'ignore' 
      });
      
      const result = execSync(`npx playwright test --browser=${browser} tests/e2e/blog-posts.spec.ts`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.testResults.e2e = 'passed';
      this.passedTests++;
      log.success(`E2E tests passed on ${browser}`);
      
      const testCount = this.extractPlaywrightTestCount(result);
      this.totalTests += testCount;
      
    } catch (error) {
      this.testResults.e2e = 'failed';
      log.error(`E2E tests failed on ${browser}`);
      log.error(error.stdout);
    }
  }

  async runPerformanceTests() {
    log.step('Running performance tests...');
    
    try {
      //build the project first
      execSync('npm run build', { stdio: 'ignore' });
      
      //run lighthouse CI
      execSync('npm run lhci:collect', { stdio: 'ignore' });
      execSync('npm run lhci:assert', { stdio: 'ignore' });
      
      this.testResults.performance = 'passed';
      this.passedTests++;
      log.success('Performance tests passed');
      
    } catch (error) {
      this.testResults.performance = 'failed';
      log.error('Performance tests failed');
      log.warning('Check Lighthouse reports for details');
    }
  }

  async runSecurityTests() {
    log.step('Running security tests...');
    
    try {
      //run npm audit
      execSync('npm audit --audit-level=moderate', { stdio: 'ignore' });
      
      this.testResults.security = 'passed';
      this.passedTests++;
      log.success('Security tests passed');
      
    } catch (error) {
      this.testResults.security = 'failed';
      log.error('Security tests failed');
      log.warning('Check npm audit output for vulnerabilities');
    }
  }

  extractTestCount(output) {
    const match = output.match(/(\d+) passed/);
    return match ? parseInt(match[1], 10) : 0;
  }

  extractPlaywrightTestCount(output) {
    const match = output.match(/(\d+) passed/);
    return match ? parseInt(match[1], 10) : 0;
  }

  allTestsPassed() {
    return Object.values(this.testResults).every(result => 
      result === 'passed' || result === null
    );
  }

  printSummary() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    
    log.title('\n📊 Test Summary');
    console.log('─'.repeat(50));
    
    Object.entries(this.testResults).forEach(([testType, result]) => {
      if (result !== null) {
        const icon = result === 'passed' ? '✅' : '❌';
        const status = result === 'passed' ? 'PASSED' : 'FAILED';
        console.log(`${icon} ${testType.toUpperCase().padEnd(12)} ${status}`);
      }
    });
    
    console.log('─'.repeat(50));
    
    const passedCount = Object.values(this.testResults).filter(r => r === 'passed').length;
    const totalCount = Object.values(this.testResults).filter(r => r !== null).length;
    
    if (this.allTestsPassed()) {
      log.success(`All tests passed! (${passedCount}/${totalCount})`);
      log.success(`Total test cases: ${this.totalTests}`);
      log.success(`Duration: ${duration}s`);
    } else {
      log.error(`Some tests failed (${passedCount}/${totalCount})`);
      log.info(`Duration: ${duration}s`);
    }
    
    log.info('\n🔍 Blog Post Testing Coverage:');
    console.log('  • Database operations (getBlogPostBySlug)');
    console.log('  • Published post access');
    console.log('  • Unpublished post redirects');
    console.log('  • Non-existent post handling');
    console.log('  • Content rendering and processing');
    console.log('  • SEO and meta data generation');
    console.log('  • Navigation and related posts');
    console.log('  • Performance and accessibility');
    console.log('  • Security and error handling');
  }
}

//CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    unit: !args.includes('--no-unit'),
    integration: !args.includes('--no-integration'),
    e2e: !args.includes('--no-e2e'),
    performance: args.includes('--performance'),
    security: args.includes('--security'),
    browser: args.find(arg => arg.startsWith('--browser='))?.split('=')[1] || 'chromium'
  };

  if (args.includes('--help')) {
    console.log(`
${COLORS.bright}Blog Post Testing Script${COLORS.reset}

Usage: node scripts/test-blog-posts.js [options]

Options:
  --no-unit         Skip unit tests
  --no-integration  Skip integration tests  
  --no-e2e          Skip end-to-end tests
  --performance     Run performance tests
  --security        Run security tests
  --browser=name    Browser for E2E tests (chromium, firefox, webkit)
  --help            Show this help message

Examples:
  node scripts/test-blog-posts.js                    # Run core tests
  node scripts/test-blog-posts.js --performance      # Include performance tests
  node scripts/test-blog-posts.js --browser=firefox  # Use Firefox for E2E
  node scripts/test-blog-posts.js --no-e2e          # Skip E2E tests
    `);
    return;
  }

  const tester = new BlogPostTester();
  const success = await tester.run(options);
  
  process.exit(success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log.error(`Script failed: ${error.message}`);
    process.exit(1);
  });
}

export { BlogPostTester };