#!/usr/bin/env node

//comprehensive test coverage validation script
//validates unit tests, e2e tests, coverage metrics, and Plan 7 testing requirements
//ensures high confidence in code quality through comprehensive testing

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

//testing criteria from Plan 7
const TESTING_CRITERIA = {
  coverage: {
    lines: 90,          //90% line coverage minimum
    branches: 85,       //85% branch coverage minimum  
    functions: 90,      //90% function coverage minimum
    statements: 90      //90% statement coverage minimum
  },
  testTypes: {
    unit: { required: true, minTests: 50 },
    integration: { required: true, minTests: 20 },
    e2e: { required: true, minTests: 10 }
  },
  performance: {
    unitTestTime: 10000,    //10s max for unit tests
    integrationTestTime: 30000, //30s max for integration tests
    e2eTestTime: 120000,    //2 minutes max for e2e tests
    parallelExecution: true
  },
  quality: {
    testReliability: 95,    //95% test pass rate
    flakiness: 2,          //max 2% flaky tests
    maintainability: 80,    //80% maintainable test score
    coverage: 90           //90% overall coverage
  }
};

//critical test scenarios that must be covered
const CRITICAL_SCENARIOS = [
  {
    category: 'Core Functionality',
    scenarios: [
      'Blog post retrieval and display',
      'Portfolio project filtering',
      'Search functionality',
      'Navigation and routing',
      'Database operations'
    ]
  },
  {
    category: 'Performance Features',
    scenarios: [
      'Core Web Vitals tracking',
      'Service worker caching',
      'Image optimization',
      'Bundle loading',
      'API response times'
    ]
  },
  {
    category: 'Security',
    scenarios: [
      'Input sanitization',
      'Authentication flows',
      'Authorization checks',
      'XSS prevention',
      'CSRF protection'
    ]
  },
  {
    category: 'User Experience',
    scenarios: [
      'Responsive design',
      'Accessibility features',
      'Error handling',
      'Loading states',
      'Offline functionality'
    ]
  }
];

class TestValidator {
  constructor() {
    this.results = {
      coverage: { passed: false, details: {} },
      unitTests: { passed: false, details: {} },
      integrationTests: { passed: false, details: {} },
      e2eTests: { passed: false, details: {} },
      performance: { passed: false, details: {} },
      quality: { passed: false, details: {} }
    };
    this.violations = [];
    this.testMetrics = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: {},
      executionTimes: {}
    };
    this.recommendations = [];
    this.startTime = Date.now();
  }

  //main validation execution
  async run() {
    try {
      console.log('\n🧪 Comprehensive Test Coverage Validation');
      console.log('═'.repeat(50));
      console.log('Validating test coverage and quality against Plan 7 requirements\n');

      //validate test coverage metrics
      await this.validateCoverage();

      //validate unit tests
      await this.validateUnitTests();

      //validate integration tests
      await this.validateIntegrationTests();

      //validate end-to-end tests
      await this.validateE2ETests();

      //validate test performance
      await this.validateTestPerformance();

      //validate test quality metrics
      await this.validateTestQuality();

      //analyze critical scenario coverage
      await this.analyzeCriticalScenarios();

      //generate recommendations
      await this.generateRecommendations();

      //create comprehensive report
      await this.generateReport();

      return this.shouldPass();

    } catch (error) {
      console.error('❌ Test validation failed:', error.message);
      return false;
    }
  }

  //validate test coverage metrics
  async validateCoverage() {
    console.log('📊 Validating Test Coverage...\n');

    try {
      //run coverage tests
      console.log('  🔍 Running coverage analysis...');
      
      const coverageOutput = execSync('npm run test:coverage', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      //parse coverage results
      const coverage = this.parseCoverageResults(coverageOutput);
      
      //validate coverage thresholds
      const coverageTests = [
        { name: 'Line Coverage', actual: coverage.lines, threshold: TESTING_CRITERIA.coverage.lines },
        { name: 'Branch Coverage', actual: coverage.branches, threshold: TESTING_CRITERIA.coverage.branches },
        { name: 'Function Coverage', actual: coverage.functions, threshold: TESTING_CRITERIA.coverage.functions },
        { name: 'Statement Coverage', actual: coverage.statements, threshold: TESTING_CRITERIA.coverage.statements }
      ];

      let passedCoverageTests = 0;

      coverageTests.forEach(test => {
        const passed = test.actual >= test.threshold;
        if (passed) passedCoverageTests++;
        
        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}: ${test.actual.toFixed(1)}% (≥ ${test.threshold}%)`);
        
        if (!passed) {
          this.violations.push({
            category: 'Test Coverage',
            metric: test.name,
            actual: test.actual,
            threshold: test.threshold,
            severity: 'high'
          });
        }
      });

      const allCoveragePassed = passedCoverageTests === coverageTests.length;

      //check coverage trends and file-specific coverage
      const fileCoverage = await this.analyzeFileCoverage();

      this.results.coverage = {
        passed: allCoveragePassed,
        details: {
          overall: coverage,
          tests: coverageTests,
          files: fileCoverage,
          passedTests: passedCoverageTests,
          totalTests: coverageTests.length
        }
      };

      this.testMetrics.coverage = coverage;

      if (!allCoveragePassed) {
        this.violations.push({
          category: 'Test Coverage',
          issue: 'Code coverage below required thresholds',
          severity: 'high'
        });
      }

    } catch (error) {
      console.error('  ❌ Coverage validation failed:', error.message);
      this.results.coverage = { passed: false, error: error.message };
    }

    console.log('');
  }

  //parse coverage results from test output
  parseCoverageResults(output) {
    const coverage = {
      lines: 0,
      branches: 0,
      functions: 0,
      statements: 0
    };

    //parse coverage from vitest output
    const lines = output.split('\n');
    
    for (const line of lines) {
      //look for coverage summary line
      if (line.includes('All files')) {
        const parts = line.split('|').map(part => part.trim());
        if (parts.length >= 5) {
          //typical format: All files | 85.5 | 80.2 | 90.1 | 87.3
          coverage.statements = parseFloat(parts[1]) || 0;
          coverage.branches = parseFloat(parts[2]) || 0;
          coverage.functions = parseFloat(parts[3]) || 0;
          coverage.lines = parseFloat(parts[4]) || coverage.statements;
        }
        break;
      }
    }

    //fallback: try to extract from percentage patterns
    if (coverage.lines === 0) {
      const percentageMatches = output.match(/(\d+\.?\d*)%/g);
      if (percentageMatches && percentageMatches.length >= 4) {
        coverage.statements = parseFloat(percentageMatches[0]) || 0;
        coverage.branches = parseFloat(percentageMatches[1]) || 0;
        coverage.functions = parseFloat(percentageMatches[2]) || 0;
        coverage.lines = parseFloat(percentageMatches[3]) || coverage.statements;
      }
    }

    return coverage;
  }

  //analyze file-specific coverage
  async analyzeFileCoverage() {
    try {
      //check if coverage report file exists
      const coverageReportPath = 'coverage/coverage-summary.json';
      
      if (fs.existsSync(coverageReportPath)) {
        const coverageData = JSON.parse(fs.readFileSync(coverageReportPath, 'utf8'));
        
        const lowCoverageFiles = [];
        const totalFiles = Object.keys(coverageData).length;
        
        for (const [file, fileCoverage] of Object.entries(coverageData)) {
          if (file !== 'total') {
            const linesCoverage = fileCoverage.lines?.pct || 0;
            if (linesCoverage < 80) { //files with less than 80% coverage
              lowCoverageFiles.push({
                file: file.replace(process.cwd(), ''),
                coverage: linesCoverage
              });
            }
          }
        }

        return {
          totalFiles,
          lowCoverageFiles: lowCoverageFiles.slice(0, 10), //show worst 10
          averageCoverage: coverageData.total?.lines?.pct || 0
        };
      }

      return { totalFiles: 0, lowCoverageFiles: [], averageCoverage: 0 };
    } catch (error) {
      return { error: error.message };
    }
  }

  //validate unit tests
  async validateUnitTests() {
    console.log('🔧 Validating Unit Tests...\n');

    try {
      //run unit tests
      console.log('  🧪 Running unit tests...');
      
      const startTime = Date.now();
      const unitTestOutput = execSync('npm run test:unit', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      const unitResults = this.parseTestResults(unitTestOutput, 'unit');

      //validate unit test criteria
      const unitTests = [
        { name: 'Test Count', actual: unitResults.total, threshold: TESTING_CRITERIA.testTypes.unit.minTests, operator: '>=' },
        { name: 'Pass Rate', actual: unitResults.passRate, threshold: TESTING_CRITERIA.quality.testReliability, operator: '>=' },
        { name: 'Execution Time', actual: executionTime, threshold: TESTING_CRITERIA.performance.unitTestTime, operator: '<=' }
      ];

      let passedUnitTests = 0;

      unitTests.forEach(test => {
        const passed = test.operator === '>=' ? test.actual >= test.threshold : test.actual <= test.threshold;
        if (passed) passedUnitTests++;
        
        const status = passed ? '✅' : '❌';
        const unit = test.name === 'Execution Time' ? 'ms' : (test.name === 'Pass Rate' ? '%' : '');
        console.log(`  ${status} ${test.name}: ${test.actual}${unit} (${test.operator} ${test.threshold}${unit})`);
        
        if (!passed) {
          this.violations.push({
            category: 'Unit Tests',
            metric: test.name,
            actual: test.actual,
            threshold: test.threshold,
            severity: test.name === 'Pass Rate' ? 'high' : 'medium'
          });
        }
      });

      const allUnitPassed = passedUnitTests === unitTests.length;

      this.results.unitTests = {
        passed: allUnitPassed,
        details: {
          results: unitResults,
          executionTime,
          tests: unitTests,
          passedTests: passedUnitTests
        }
      };

      this.testMetrics.totalTests += unitResults.total;
      this.testMetrics.passedTests += unitResults.passed;
      this.testMetrics.failedTests += unitResults.failed;
      this.testMetrics.executionTimes.unit = executionTime;

      if (!allUnitPassed) {
        this.violations.push({
          category: 'Unit Tests',
          issue: 'Unit test quality or performance issues',
          severity: 'high'
        });
      }

    } catch (error) {
      console.error('  ❌ Unit test validation failed:', error.message);
      this.results.unitTests = { passed: false, error: error.message };
    }

    console.log('');
  }

  //validate integration tests  
  async validateIntegrationTests() {
    console.log('🔗 Validating Integration Tests...\n');

    try {
      //run integration tests
      console.log('  🧪 Running integration tests...');
      
      const startTime = Date.now();
      const integrationTestOutput = execSync('npm run test:integration', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      const integrationResults = this.parseTestResults(integrationTestOutput, 'integration');

      //validate integration test criteria
      const integrationTests = [
        { name: 'Test Count', actual: integrationResults.total, threshold: TESTING_CRITERIA.testTypes.integration.minTests, operator: '>=' },
        { name: 'Pass Rate', actual: integrationResults.passRate, threshold: TESTING_CRITERIA.quality.testReliability, operator: '>=' },
        { name: 'Execution Time', actual: executionTime, threshold: TESTING_CRITERIA.performance.integrationTestTime, operator: '<=' }
      ];

      let passedIntegrationTests = 0;

      integrationTests.forEach(test => {
        const passed = test.operator === '>=' ? test.actual >= test.threshold : test.actual <= test.threshold;
        if (passed) passedIntegrationTests++;
        
        const status = passed ? '✅' : '❌';
        const unit = test.name === 'Execution Time' ? 'ms' : (test.name === 'Pass Rate' ? '%' : '');
        console.log(`  ${status} ${test.name}: ${test.actual}${unit} (${test.operator} ${test.threshold}${unit})`);
        
        if (!passed) {
          this.violations.push({
            category: 'Integration Tests',
            metric: test.name,
            actual: test.actual,
            threshold: test.threshold,
            severity: test.name === 'Pass Rate' ? 'high' : 'medium'
          });
        }
      });

      const allIntegrationPassed = passedIntegrationTests === integrationTests.length;

      this.results.integrationTests = {
        passed: allIntegrationPassed,
        details: {
          results: integrationResults,
          executionTime,
          tests: integrationTests,
          passedTests: passedIntegrationTests
        }
      };

      this.testMetrics.totalTests += integrationResults.total;
      this.testMetrics.passedTests += integrationResults.passed;
      this.testMetrics.failedTests += integrationResults.failed;
      this.testMetrics.executionTimes.integration = executionTime;

      if (!allIntegrationPassed) {
        this.violations.push({
          category: 'Integration Tests',
          issue: 'Integration test quality or performance issues',
          severity: 'high'
        });
      }

    } catch (error) {
      console.error('  ❌ Integration test validation failed:', error.message);
      this.results.integrationTests = { passed: false, error: error.message };
    }

    console.log('');
  }

  //validate end-to-end tests
  async validateE2ETests() {
    console.log('🎭 Validating End-to-End Tests...\n');

    try {
      //run e2e tests
      console.log('  🧪 Running E2E tests...');
      
      const startTime = Date.now();
      const e2eTestOutput = execSync('npm run test:e2e', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      const e2eResults = this.parsePlaywrightResults(e2eTestOutput);

      //validate e2e test criteria
      const e2eTests = [
        { name: 'Test Count', actual: e2eResults.total, threshold: TESTING_CRITERIA.testTypes.e2e.minTests, operator: '>=' },
        { name: 'Pass Rate', actual: e2eResults.passRate, threshold: TESTING_CRITERIA.quality.testReliability, operator: '>=' },
        { name: 'Execution Time', actual: executionTime, threshold: TESTING_CRITERIA.performance.e2eTestTime, operator: '<=' }
      ];

      let passedE2ETests = 0;

      e2eTests.forEach(test => {
        const passed = test.operator === '>=' ? test.actual >= test.threshold : test.actual <= test.threshold;
        if (passed) passedE2ETests++;
        
        const status = passed ? '✅' : '❌';
        const unit = test.name === 'Execution Time' ? 'ms' : (test.name === 'Pass Rate' ? '%' : '');
        console.log(`  ${status} ${test.name}: ${test.actual}${unit} (${test.operator} ${test.threshold}${unit})`);
        
        if (!passed) {
          this.violations.push({
            category: 'E2E Tests',
            metric: test.name,
            actual: test.actual,
            threshold: test.threshold,
            severity: test.name === 'Pass Rate' ? 'critical' : 'medium'
          });
        }
      });

      const allE2EPassed = passedE2ETests === e2eTests.length;

      this.results.e2eTests = {
        passed: allE2EPassed,
        details: {
          results: e2eResults,
          executionTime,
          tests: e2eTests,
          passedTests: passedE2ETests,
          browsers: e2eResults.browsers || []
        }
      };

      this.testMetrics.totalTests += e2eResults.total;
      this.testMetrics.passedTests += e2eResults.passed;
      this.testMetrics.failedTests += e2eResults.failed;
      this.testMetrics.executionTimes.e2e = executionTime;

      if (!allE2EPassed) {
        this.violations.push({
          category: 'E2E Tests',
          issue: 'End-to-end test quality or performance issues',
          severity: 'critical'
        });
      }

    } catch (error) {
      console.error('  ❌ E2E test validation failed:', error.message);
      this.results.e2eTests = { passed: false, error: error.message };
    }

    console.log('');
  }

  //parse test results from output
  parseTestResults(output, testType) {
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 0
    };

    //parse vitest output
    const lines = output.split('\n');
    
    for (const line of lines) {
      //look for test summary
      if (line.includes('Test Files') || line.includes('Tests')) {
        const numbers = line.match(/(\d+)/g);
        if (numbers && numbers.length >= 2) {
          results.passed = parseInt(numbers[0]) || 0;
          results.total = parseInt(numbers[1]) || results.passed;
          results.failed = results.total - results.passed;
        }
      }
      
      //look for specific counts
      if (line.includes('passed') && line.includes('failed')) {
        const passedMatch = line.match(/(\d+)\s+passed/);
        const failedMatch = line.match(/(\d+)\s+failed/);
        
        if (passedMatch) results.passed = parseInt(passedMatch[1]);
        if (failedMatch) results.failed = parseInt(failedMatch[1]);
        
        results.total = results.passed + results.failed;
      }
    }

    results.passRate = results.total > 0 ? (results.passed / results.total) * 100 : 0;

    return results;
  }

  //parse playwright test results
  parsePlaywrightResults(output) {
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 0,
      browsers: []
    };

    const lines = output.split('\n');
    
    for (const line of lines) {
      //look for final summary
      if (line.includes('passed') || line.includes('failed')) {
        const passedMatch = line.match(/(\d+)\s+passed/);
        const failedMatch = line.match(/(\d+)\s+failed/);
        const skippedMatch = line.match(/(\d+)\s+skipped/);
        
        if (passedMatch) results.passed = Math.max(results.passed, parseInt(passedMatch[1]));
        if (failedMatch) results.failed = Math.max(results.failed, parseInt(failedMatch[1]));
        if (skippedMatch) results.skipped = Math.max(results.skipped, parseInt(skippedMatch[1]));
      }
      
      //detect browsers
      if (line.includes('chromium') || line.includes('firefox') || line.includes('webkit')) {
        const browserMatch = line.match(/(chromium|firefox|webkit)/i);
        if (browserMatch && !results.browsers.includes(browserMatch[1])) {
          results.browsers.push(browserMatch[1]);
        }
      }
    }

    results.total = results.passed + results.failed + results.skipped;
    results.passRate = results.total > 0 ? (results.passed / results.total) * 100 : 0;

    return results;
  }

  //validate test performance metrics
  async validateTestPerformance() {
    console.log('⚡ Validating Test Performance...\n');

    try {
      const performanceTests = [
        await this.validateTestSpeed(),
        await this.validateParallelExecution(),
        await this.validateTestStability(),
        await this.validateResourceUsage()
      ];

      const allPassed = performanceTests.every(test => test.passed);

      this.results.performance = {
        passed: allPassed,
        details: {
          speed: performanceTests[0],
          parallel: performanceTests[1],
          stability: performanceTests[2],
          resources: performanceTests[3]
        }
      };

      performanceTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}: ${test.summary}`);
      });

      if (!allPassed) {
        this.violations.push({
          category: 'Test Performance',
          issue: 'Test performance does not meet requirements',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Test performance validation failed:', error.message);
      this.results.performance = { passed: false, error: error.message };
    }

    console.log('');
  }

  //validate test execution speed
  async validateTestSpeed() {
    const totalExecutionTime = Object.values(this.testMetrics.executionTimes).reduce((sum, time) => sum + time, 0);
    const averageTestTime = this.testMetrics.totalTests > 0 ? totalExecutionTime / this.testMetrics.totalTests : 0;
    
    const passed = averageTestTime <= 1000; //average test should run in under 1 second

    return {
      name: 'Test Speed',
      passed,
      totalTime: totalExecutionTime,
      averageTime: averageTestTime,
      summary: `Average: ${averageTestTime.toFixed(0)}ms per test`
    };
  }

  //validate parallel execution capability
  async validateParallelExecution() {
    try {
      //check if tests can run in parallel by looking at config
      const vitestConfig = fs.existsSync('vitest.config.ts');
      const playwrightConfig = fs.existsSync('playwright.config.ts');
      
      let parallelSupport = false;
      
      if (vitestConfig) {
        const config = fs.readFileSync('vitest.config.ts', 'utf8');
        parallelSupport = !config.includes('pool: false') && !config.includes('threads: false');
      }
      
      if (playwrightConfig) {
        const config = fs.readFileSync('playwright.config.ts', 'utf8');
        parallelSupport = parallelSupport || config.includes('fullyParallel: true');
      }

      return {
        name: 'Parallel Execution',
        passed: parallelSupport,
        vitestConfig,
        playwrightConfig,
        summary: parallelSupport ? 'Parallel execution enabled' : 'Sequential execution only'
      };
    } catch (error) {
      return {
        name: 'Parallel Execution',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate test stability and reliability
  async validateTestStability() {
    const overallPassRate = this.testMetrics.totalTests > 0 ? 
      (this.testMetrics.passedTests / this.testMetrics.totalTests) * 100 : 0;
    
    const passed = overallPassRate >= TESTING_CRITERIA.quality.testReliability;

    return {
      name: 'Test Stability',
      passed,
      passRate: overallPassRate,
      totalTests: this.testMetrics.totalTests,
      passedTests: this.testMetrics.passedTests,
      summary: `${overallPassRate.toFixed(1)}% overall pass rate`
    };
  }

  //validate test resource usage
  async validateResourceUsage() {
    try {
      //estimate resource usage based on execution times and test counts
      const totalTime = Object.values(this.testMetrics.executionTimes).reduce((sum, time) => sum + time, 0);
      const efficient = totalTime <= 180000; //all tests should complete in under 3 minutes

      return {
        name: 'Resource Usage',
        passed: efficient,
        totalTime,
        summary: `Total execution: ${Math.round(totalTime / 1000)}s`
      };
    } catch (error) {
      return {
        name: 'Resource Usage',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate overall test quality
  async validateTestQuality() {
    console.log('📊 Validating Test Quality...\n');

    try {
      const qualityTests = [
        await this.validateTestMaintainability(),
        await this.validateTestDocumentation(),
        await this.validateTestOrganization(),
        await this.validateTestReliability()
      ];

      const allPassed = qualityTests.every(test => test.passed);

      this.results.quality = {
        passed: allPassed,
        details: {
          maintainability: qualityTests[0],
          documentation: qualityTests[1],
          organization: qualityTests[2],
          reliability: qualityTests[3]
        }
      };

      qualityTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}: ${test.summary}`);
      });

      if (!allPassed) {
        this.violations.push({
          category: 'Test Quality',
          issue: 'Test quality metrics need improvement',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Test quality validation failed:', error.message);
      this.results.quality = { passed: false, error: error.message };
    }

    console.log('');
  }

  //validate test maintainability
  async validateTestMaintainability() {
    try {
      //analyze test file structure and organization
      const testDirs = ['tests/unit', 'tests/integration', 'tests/e2e'];
      let testFiles = 0;
      let wellStructured = 0;

      for (const dir of testDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir, { recursive: true })
            .filter(file => file.toString().match(/\.(test|spec)\.(ts|js)$/));
          
          testFiles += files.length;
          
          //check if files follow naming conventions
          const properlyNamed = files.filter(file => 
            file.toString().includes('.test.') || file.toString().includes('.spec.')
          ).length;
          
          wellStructured += properlyNamed;
        }
      }

      const maintainabilityScore = testFiles > 0 ? (wellStructured / testFiles) * 100 : 0;
      const passed = maintainabilityScore >= TESTING_CRITERIA.quality.maintainability;

      return {
        name: 'Test Maintainability',
        passed,
        score: maintainabilityScore,
        testFiles,
        wellStructured,
        summary: `${maintainabilityScore.toFixed(0)}% maintainable structure`
      };
    } catch (error) {
      return {
        name: 'Test Maintainability',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate test documentation
  async validateTestDocumentation() {
    try {
      //check for test documentation and setup files
      const docFiles = [
        'tests/README.md',
        'tests/setup.ts',
        'vitest.config.ts',
        'playwright.config.ts'
      ];

      let existingDocs = 0;
      
      for (const file of docFiles) {
        if (fs.existsSync(file)) existingDocs++;
      }

      const documentationScore = (existingDocs / docFiles.length) * 100;
      const passed = documentationScore >= 75; //75% of documentation should exist

      return {
        name: 'Test Documentation',
        passed,
        score: documentationScore,
        existingDocs,
        totalDocs: docFiles.length,
        summary: `${documentationScore.toFixed(0)}% documentation present`
      };
    } catch (error) {
      return {
        name: 'Test Documentation',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate test organization
  async validateTestOrganization() {
    try {
      //check test directory structure
      const expectedDirs = ['tests/unit', 'tests/integration', 'tests/e2e'];
      let existingDirs = 0;

      for (const dir of expectedDirs) {
        if (fs.existsSync(dir)) existingDirs++;
      }

      const organizationScore = (existingDirs / expectedDirs.length) * 100;
      const passed = organizationScore >= 100; //all test types should be organized

      return {
        name: 'Test Organization',
        passed,
        score: organizationScore,
        existingDirs,
        totalDirs: expectedDirs.length,
        summary: `${organizationScore.toFixed(0)}% test types organized`
      };
    } catch (error) {
      return {
        name: 'Test Organization',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate test reliability
  async validateTestReliability() {
    const overallPassRate = this.testMetrics.totalTests > 0 ? 
      (this.testMetrics.passedTests / this.testMetrics.totalTests) * 100 : 0;
    
    const flakiness = this.testMetrics.totalTests > 0 ? 
      (this.testMetrics.failedTests / this.testMetrics.totalTests) * 100 : 0;
    
    const passed = overallPassRate >= TESTING_CRITERIA.quality.testReliability && 
                   flakiness <= TESTING_CRITERIA.quality.flakiness;

    return {
      name: 'Test Reliability',
      passed,
      passRate: overallPassRate,
      flakiness,
      summary: `${overallPassRate.toFixed(1)}% pass rate, ${flakiness.toFixed(1)}% flaky`
    };
  }

  //analyze critical scenario coverage
  async analyzeCriticalScenarios() {
    console.log('🎯 Analyzing Critical Scenario Coverage...\n');

    const scenarioCoverage = [];

    for (const category of CRITICAL_SCENARIOS) {
      console.log(`  📋 ${category.category}:`);
      
      const categoryResults = {
        category: category.category,
        scenarios: [],
        coveredCount: 0,
        totalCount: category.scenarios.length
      };

      for (const scenario of category.scenarios) {
        const covered = await this.checkScenarioCoverage(scenario);
        categoryResults.scenarios.push({ scenario, covered });
        
        if (covered) {
          categoryResults.coveredCount++;
        }

        const status = covered ? '✅' : '❌';
        console.log(`    ${status} ${scenario}`);
      }

      const coveragePercent = (categoryResults.coveredCount / categoryResults.totalCount) * 100;
      console.log(`    📊 Coverage: ${coveragePercent.toFixed(0)}% (${categoryResults.coveredCount}/${categoryResults.totalCount})\n`);

      scenarioCoverage.push(categoryResults);
    }

    this.scenarioCoverage = scenarioCoverage;
  }

  //check if a specific scenario is covered by tests
  async checkScenarioCoverage(scenario) {
    try {
      //simple heuristic: check if test files contain keywords related to the scenario
      const keywords = scenario.toLowerCase().split(' ');
      const testDirs = ['tests/unit', 'tests/integration', 'tests/e2e'];
      
      for (const dir of testDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir, { recursive: true })
            .filter(file => file.toString().match(/\.(test|spec)\.(ts|js)$/));
          
          for (const file of files) {
            try {
              const content = fs.readFileSync(path.join(dir, file.toString()), 'utf8').toLowerCase();
              
              //check if file contains scenario keywords
              const keywordMatches = keywords.filter(keyword => content.includes(keyword)).length;
              
              if (keywordMatches >= Math.ceil(keywords.length / 2)) {
                return true; //at least half the keywords match
              }
            } catch (error) {
              //skip files that can't be read
            }
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  //generate test improvement recommendations
  async generateRecommendations() {
    this.recommendations = [];

    //coverage recommendations
    if (!this.results.coverage.passed) {
      if (this.testMetrics.coverage.lines < TESTING_CRITERIA.coverage.lines) {
        this.recommendations.push('Increase line coverage by adding tests for uncovered code paths');
      }
      
      if (this.testMetrics.coverage.branches < TESTING_CRITERIA.coverage.branches) {
        this.recommendations.push('Improve branch coverage by testing all conditional logic paths');
      }
      
      if (this.testMetrics.coverage.functions < TESTING_CRITERIA.coverage.functions) {
        this.recommendations.push('Add tests for uncovered functions and methods');
      }
    }

    //unit test recommendations
    if (!this.results.unitTests.passed) {
      const unitDetails = this.results.unitTests.details;
      
      if (unitDetails?.results?.total < TESTING_CRITERIA.testTypes.unit.minTests) {
        this.recommendations.push('Increase number of unit tests to meet minimum requirements');
      }
      
      if (unitDetails?.executionTime > TESTING_CRITERIA.performance.unitTestTime) {
        this.recommendations.push('Optimize unit test performance by reducing setup time and complexity');
      }
    }

    //integration test recommendations
    if (!this.results.integrationTests.passed) {
      this.recommendations.push('Improve integration test coverage for API endpoints and database operations');
      this.recommendations.push('Add integration tests for complex workflows and data processing');
    }

    //e2e test recommendations
    if (!this.results.e2eTests.passed) {
      this.recommendations.push('Add end-to-end tests for critical user journeys');
      this.recommendations.push('Test cross-browser compatibility with E2E tests');
      this.recommendations.push('Optimize E2E test performance to reduce execution time');
    }

    //performance recommendations
    if (!this.results.performance.passed) {
      this.recommendations.push('Enable parallel test execution to improve performance');
      this.recommendations.push('Optimize test setup and teardown to reduce resource usage');
    }

    //quality recommendations
    if (!this.results.quality.passed) {
      this.recommendations.push('Improve test maintainability with better organization and naming');
      this.recommendations.push('Add comprehensive test documentation and setup guides');
      this.recommendations.push('Implement flaky test detection and stabilization');
    }

    //scenario-specific recommendations
    if (this.scenarioCoverage) {
      for (const category of this.scenarioCoverage) {
        const coveragePercent = (category.coveredCount / category.totalCount) * 100;
        
        if (coveragePercent < 80) {
          this.recommendations.push(`Improve test coverage for ${category.category} scenarios (${coveragePercent.toFixed(0)}% covered)`);
        }
      }
    }
  }

  //generate comprehensive test report
  async generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    console.log('📊 Comprehensive Test Validation Report');
    console.log('═'.repeat(50));
    console.log(`Validation completed in ${Math.round(duration / 1000)}s`);
    console.log(`Overall Status: ${this.shouldPass() ? 'PASSED' : 'FAILED'}\n`);

    //test summary
    console.log('📋 Test Summary:');
    console.log('─'.repeat(25));
    console.log(`Total Tests: ${this.testMetrics.totalTests}`);
    console.log(`Passed Tests: ${this.testMetrics.passedTests}`);
    console.log(`Failed Tests: ${this.testMetrics.failedTests}`);
    console.log(`Overall Pass Rate: ${this.testMetrics.totalTests > 0 ? ((this.testMetrics.passedTests / this.testMetrics.totalTests) * 100).toFixed(1) : 0}%`);

    //coverage summary
    if (this.testMetrics.coverage.lines) {
      console.log('\n📊 Coverage Summary:');
      console.log('─'.repeat(25));
      console.log(`Line Coverage: ${this.testMetrics.coverage.lines.toFixed(1)}%`);
      console.log(`Branch Coverage: ${this.testMetrics.coverage.branches.toFixed(1)}%`);
      console.log(`Function Coverage: ${this.testMetrics.coverage.functions.toFixed(1)}%`);
      console.log(`Statement Coverage: ${this.testMetrics.coverage.statements.toFixed(1)}%`);
    }

    //category results
    console.log('\n📋 Category Results:');
    console.log('─'.repeat(25));

    const categories = [
      { key: 'coverage', name: 'Test Coverage' },
      { key: 'unitTests', name: 'Unit Tests' },
      { key: 'integrationTests', name: 'Integration Tests' },
      { key: 'e2eTests', name: 'End-to-End Tests' },
      { key: 'performance', name: 'Test Performance' },
      { key: 'quality', name: 'Test Quality' }
    ];

    categories.forEach(category => {
      const result = this.results[category.key];
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status.padEnd(8)} ${category.name}`);
    });

    //critical scenario coverage
    if (this.scenarioCoverage) {
      console.log('\n🎯 Critical Scenario Coverage:');
      console.log('─'.repeat(30));
      
      for (const category of this.scenarioCoverage) {
        const coveragePercent = (category.coveredCount / category.totalCount) * 100;
        console.log(`${category.category}: ${coveragePercent.toFixed(0)}% (${category.coveredCount}/${category.totalCount})`);
      }
    }

    //violations
    if (this.violations.length > 0) {
      console.log('\n⚠️  Test Violations:');
      console.log('─'.repeat(25));
      this.violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.category}: ${violation.issue || violation.metric} (${violation.severity})`);
      });
    }

    //recommendations
    if (this.recommendations.length > 0) {
      console.log('\n💡 Test Improvement Recommendations:');
      console.log('─'.repeat(35));
      this.recommendations.slice(0, 10).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    //save detailed report
    await this.saveDetailedReport();
  }

  //save detailed test validation report
  async saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      plan: 'Plan 7 - Test Coverage Validation',
      criteria: TESTING_CRITERIA,
      results: this.results,
      violations: this.violations,
      recommendations: this.recommendations,
      testMetrics: this.testMetrics,
      scenarioCoverage: this.scenarioCoverage,
      passed: this.shouldPass(),
      summary: {
        categoriesPassed: Object.values(this.results).filter(r => r.passed).length,
        totalCategories: Object.keys(this.results).length,
        overallCoverage: this.testMetrics.coverage.lines || 0,
        overallPassRate: this.testMetrics.totalTests > 0 ? 
          (this.testMetrics.passedTests / this.testMetrics.totalTests) * 100 : 0,
        violationsFound: this.violations.length,
        criticalViolations: this.violations.filter(v => v.severity === 'critical').length
      }
    };

    const reportPath = `test-validation-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed test report saved to: ${reportPath}`);
  }

  //determine if validation should pass
  shouldPass() {
    const passedCategories = Object.values(this.results).filter(r => r.passed).length;
    const totalCategories = Object.keys(this.results).length;
    const passRate = (passedCategories / totalCategories) * 100;

    //require 85% of categories to pass and no critical violations
    const criticalViolations = this.violations.filter(v => v.severity === 'critical').length;
    
    return passRate >= 85 && criticalViolations === 0;
  }
}

//main execution
async function main() {
  const validator = new TestValidator();

  try {
    const passed = await validator.run();

    console.log('═'.repeat(50));

    if (passed) {
      console.log('🎉 TEST VALIDATION PASSED');
      console.log('Test coverage and quality meet Plan 7 requirements');
    } else {
      console.log('🚫 TEST VALIDATION FAILED');
      console.log('Test coverage or quality needs improvement');
    }

    console.log('═'.repeat(50));

    process.exit(passed ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Test validation failed with error:', error.message);
    process.exit(1);
  }
}

//run if called directly
if (require.main === module) {
  main();
}

module.exports = { TestValidator, TESTING_CRITERIA };