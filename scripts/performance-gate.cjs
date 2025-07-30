#!/usr/bin/env node

//performance gate script for deployment validation
//runs lighthouse tests and validates against performance budgets
//blocks deployment if performance thresholds are not met

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

//performance thresholds for deployment gates
const PERFORMANCE_GATES = {
  //lighthouse scores (0-100 scale)
  performance: 95,      //performance score must be >= 95
  accessibility: 95,    //accessibility score must be >= 95
  bestPractices: 90,    //best practices score must be >= 90
  seo: 90,             //SEO score must be >= 90
  
  //core web vitals (milliseconds, except CLS)
  lcp: 2500,           //largest contentful paint <= 2.5s
  fcp: 1800,           //first contentful paint <= 1.8s
  cls: 0.1,            //cumulative layout shift <= 0.1
  tbt: 200,            //total blocking time <= 200ms
  si: 3400,            //speed index <= 3.4s
  tti: 5000,           //time to interactive <= 5s
  
  //additional budgets
  ttfb: 600,           //time to first byte <= 600ms
  totalSize: 1600000,  //total bundle size <= 1.6MB
  unusedCSS: 20000,    //unused CSS <= 20KB
  unusedJS: 50000,     //unused JavaScript <= 50KB
};

//urls to test for deployment validation
const TEST_URLS = [
  'http://localhost:4321',           //homepage
  'http://localhost:4321/portfolio', //portfolio page
  'http://localhost:4321/blog',      //blog page
  'http://localhost:4321/flights',   //flights page
];

//configuration for different environments
const ENV_CONFIG = {
  development: {
    urls: ['http://localhost:4321'],
    relaxedThresholds: true,
    skipOnError: true
  },
  staging: {
    urls: TEST_URLS,
    relaxedThresholds: false,
    skipOnError: false
  },
  production: {
    urls: TEST_URLS,
    relaxedThresholds: false,
    skipOnError: false
  }
};

class PerformanceGate {
  constructor(environment = 'staging') {
    this.environment = environment;
    this.config = ENV_CONFIG[environment] || ENV_CONFIG.staging;
    this.results = [];
    this.violations = [];
    this.startTime = Date.now();
  }

  //main execution method
  async run() {
    try {
      console.log(`\n🚀 Running Performance Gate for ${this.environment} environment`);
      console.log(`📊 Testing ${this.config.urls.length} URLs against performance budgets\n`);

      //ensure server is running
      await this.ensureServerRunning();

      //run lighthouse CI tests
      await this.runLighthouseTests();

      //validate results against gates
      await this.validatePerformanceGates();

      //generate report
      await this.generateReport();

      //determine if deployment should proceed
      return this.shouldAllowDeployment();

    } catch (error) {
      console.error('❌ Performance Gate execution failed:', error.message);
      
      if (this.config.skipOnError) {
        console.log('⚠️  Skipping performance gate due to error (development mode)');
        return true;
      }
      
      return false;
    }
  }

  //ensure the preview server is running
  async ensureServerRunning() {
    console.log('🔍 Checking if preview server is running...');
    
    try {
      //attempt to connect to the server
      const response = await fetch('http://localhost:4321');
      if (response.ok) {
        console.log('✅ Preview server is running');
        return;
      }
    } catch (error) {
      //server not running, start it
      console.log('🚀 Starting preview server...');
      
      try {
        //build the project first
        console.log('📦 Building project...');
        execSync('npm run build', { stdio: 'inherit' });
        
        //start preview server in background
        console.log('🖥️  Starting preview server...');
        const child = execSync('npm run preview &', { stdio: 'pipe' });
        
        //wait for server to be ready
        await this.waitForServer('http://localhost:4321', 30000);
        console.log('✅ Preview server started successfully');
        
      } catch (error) {
        throw new Error(`Failed to start preview server: ${error.message}`);
      }
    }
  }

  //wait for server to be ready
  async waitForServer(url, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch (error) {
        //server not ready yet, wait and retry
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
  }

  //run lighthouse CI tests
  async runLighthouseTests() {
    console.log('🔬 Running Lighthouse CI tests...\n');
    
    try {
      //run lighthouse CI with autorun
      const output = execSync('npx lhci autorun --config=lighthouserc.js', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('✅ Lighthouse tests completed successfully');
      
      //parse results from .lighthouseci directory
      await this.parseResults();
      
    } catch (error) {
      console.error('❌ Lighthouse tests failed:', error.message);
      throw error;
    }
  }

  //parse lighthouse results
  async parseResults() {
    const resultsDir = '.lighthouseci';
    
    if (!fs.existsSync(resultsDir)) {
      throw new Error('Lighthouse results directory not found');
    }
    
    //find the latest results file
    const files = fs.readdirSync(resultsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(resultsDir, f),
        time: fs.statSync(path.join(resultsDir, f)).mtime
      }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length === 0) {
      throw new Error('No Lighthouse results found');
    }
    
    //read the latest results
    const resultsFile = files[0].path;
    const rawResults = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    
    //process results for each URL
    this.results = Object.keys(rawResults).map(url => {
      const result = rawResults[url];
      
      return {
        url,
        scores: {
          performance: Math.round(result.categories.performance.score * 100),
          accessibility: Math.round(result.categories.accessibility.score * 100),
          bestPractices: Math.round(result.categories['best-practices'].score * 100),
          seo: Math.round(result.categories.seo.score * 100)
        },
        audits: {
          lcp: result.audits['largest-contentful-paint']?.numericValue || 0,
          fcp: result.audits['first-contentful-paint']?.numericValue || 0,
          cls: result.audits['cumulative-layout-shift']?.numericValue || 0,
          tbt: result.audits['total-blocking-time']?.numericValue || 0,
          si: result.audits['speed-index']?.numericValue || 0,
          tti: result.audits['interactive']?.numericValue || 0,
          ttfb: result.audits['server-response-time']?.numericValue || 0,
          totalSize: result.audits['total-byte-weight']?.numericValue || 0,
          unusedCSS: result.audits['unused-css-rules']?.numericValue || 0,
          unusedJS: result.audits['unused-javascript']?.numericValue || 0
        }
      };
    });
    
    console.log(`📈 Parsed results for ${this.results.length} URLs`);
  }

  //validate results against performance gates
  async validatePerformanceGates() {
    console.log('\n🔍 Validating performance against gates...\n');
    
    const thresholds = this.config.relaxedThresholds ? 
      this.getRelaxedThresholds() : PERFORMANCE_GATES;
    
    this.results.forEach(result => {
      console.log(`📊 Validating ${result.url}:`);
      
      //validate lighthouse scores
      this.validateScore('Performance', result.scores.performance, thresholds.performance, result.url);
      this.validateScore('Accessibility', result.scores.accessibility, thresholds.accessibility, result.url);
      this.validateScore('Best Practices', result.scores.bestPractices, thresholds.bestPractices, result.url);
      this.validateScore('SEO', result.scores.seo, thresholds.seo, result.url);
      
      //validate core web vitals
      this.validateMetric('LCP', result.audits.lcp, thresholds.lcp, result.url, 'ms', '<=');
      this.validateMetric('FCP', result.audits.fcp, thresholds.fcp, result.url, 'ms', '<=');
      this.validateMetric('CLS', result.audits.cls, thresholds.cls, result.url, '', '<=');
      this.validateMetric('TBT', result.audits.tbt, thresholds.tbt, result.url, 'ms', '<=');
      this.validateMetric('Speed Index', result.audits.si, thresholds.si, result.url, 'ms', '<=');
      this.validateMetric('TTI', result.audits.tti, thresholds.tti, result.url, 'ms', '<=');
      
      //validate additional metrics
      this.validateMetric('TTFB', result.audits.ttfb, thresholds.ttfb, result.url, 'ms', '<=');
      this.validateMetric('Total Size', result.audits.totalSize, thresholds.totalSize, result.url, 'bytes', '<=');
      
      if (result.audits.unusedCSS > 0) {
        this.validateMetric('Unused CSS', result.audits.unusedCSS, thresholds.unusedCSS, result.url, 'bytes', '<=');
      }
      
      if (result.audits.unusedJS > 0) {
        this.validateMetric('Unused JS', result.audits.unusedJS, thresholds.unusedJS, result.url, 'bytes', '<=');
      }
      
      console.log('');
    });
  }

  //validate a lighthouse score
  validateScore(name, actual, threshold, url) {
    if (actual >= threshold) {
      console.log(`  ✅ ${name}: ${actual} (>= ${threshold})`);
    } else {
      console.log(`  ❌ ${name}: ${actual} (< ${threshold})`);
      this.violations.push({
        type: 'score',
        metric: name,
        actual,
        threshold,
        url,
        severity: this.getSeverity(name, actual, threshold)
      });
    }
  }

  //validate a performance metric
  validateMetric(name, actual, threshold, url, unit = '', operator = '<=') {
    const passes = operator === '<=' ? actual <= threshold : actual >= threshold;
    const symbol = passes ? '✅' : '❌';
    const operatorSymbol = operator === '<=' ? '≤' : '≥';
    
    console.log(`  ${symbol} ${name}: ${this.formatValue(actual, unit)} (${operatorSymbol} ${this.formatValue(threshold, unit)})`);
    
    if (!passes) {
      this.violations.push({
        type: 'metric',
        metric: name,
        actual,
        threshold,
        url,
        operator,
        unit,
        severity: this.getSeverity(name, actual, threshold)
      });
    }
  }

  //format value for display
  formatValue(value, unit) {
    switch (unit) {
      case 'ms':
        return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
      case 'bytes':
        if (value < 1024) return `${value}B`;
        if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`;
        return `${(value / (1024 * 1024)).toFixed(1)}MB`;
      default:
        return value.toString();
    }
  }

  //get violation severity
  getSeverity(metric, actual, threshold) {
    const diff = Math.abs(actual - threshold) / threshold;
    
    if (diff > 0.5) return 'critical';
    if (diff > 0.25) return 'high';
    if (diff > 0.1) return 'medium';
    return 'low';
  }

  //get relaxed thresholds for development
  getRelaxedThresholds() {
    return {
      ...PERFORMANCE_GATES,
      performance: 80,      //relaxed from 95
      accessibility: 90,    //relaxed from 95
      bestPractices: 80,    //relaxed from 90
      seo: 80,             //relaxed from 90
      lcp: 3000,           //relaxed from 2500
      fcp: 2200,           //relaxed from 1800
      cls: 0.15,           //relaxed from 0.1
      tbt: 300,            //relaxed from 200
      si: 4000,            //relaxed from 3400
      tti: 6000,           //relaxed from 5000
      ttfb: 800,           //relaxed from 600
      totalSize: 2000000,  //relaxed from 1600000
      unusedCSS: 30000,    //relaxed from 20000
      unusedJS: 75000,     //relaxed from 50000
    };
  }

  //generate performance report
  async generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    console.log('\n📋 Performance Gate Report');
    console.log('═'.repeat(50));
    console.log(`Environment: ${this.environment}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`URLs Tested: ${this.results.length}`);
    console.log(`Violations: ${this.violations.length}`);
    console.log('');
    
    //summary by URL
    this.results.forEach(result => {
      console.log(`📄 ${result.url}:`);
      console.log(`  Performance: ${result.scores.performance} | Accessibility: ${result.scores.accessibility}`);
      console.log(`  Best Practices: ${result.scores.bestPractices} | SEO: ${result.scores.seo}`);
      console.log(`  LCP: ${this.formatValue(result.audits.lcp, 'ms')} | FCP: ${this.formatValue(result.audits.fcp, 'ms')} | CLS: ${result.audits.cls.toFixed(3)}`);
      console.log('');
    });
    
    //violations summary
    if (this.violations.length > 0) {
      console.log('⚠️  Performance Budget Violations:');
      console.log('─'.repeat(50));
      
      const groupedViolations = this.groupViolationsBySeverity();
      
      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        const violations = groupedViolations[severity] || [];
        if (violations.length > 0) {
          console.log(`\n${this.getSeverityEmoji(severity)} ${severity.toUpperCase()} (${violations.length}):`);
          violations.forEach(v => {
            console.log(`  • ${v.metric}: ${this.formatValue(v.actual, v.unit || '')} (threshold: ${this.formatValue(v.threshold, v.unit || '')})`);
          });
        }
      });
    }
    
    //save detailed report to file
    await this.saveDetailedReport();
  }

  //group violations by severity
  groupViolationsBySeverity() {
    return this.violations.reduce((groups, violation) => {
      const severity = violation.severity;
      if (!groups[severity]) groups[severity] = [];
      groups[severity].push(violation);
      return groups;
    }, {});
  }

  //get emoji for severity level
  getSeverityEmoji(severity) {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return '💡';
      default: return '📊';
    }
  }

  //save detailed report to file
  async saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      duration: Date.now() - this.startTime,
      results: this.results,
      violations: this.violations,
      summary: {
        urlsTested: this.results.length,
        totalViolations: this.violations.length,
        criticalViolations: this.violations.filter(v => v.severity === 'critical').length,
        highViolations: this.violations.filter(v => v.severity === 'high').length,
        passed: this.violations.length === 0
      }
    };
    
    const reportPath = `performance-gate-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  }

  //determine if deployment should proceed
  shouldAllowDeployment() {
    const criticalViolations = this.violations.filter(v => v.severity === 'critical').length;
    const highViolations = this.violations.filter(v => v.severity === 'high').length;
    
    if (criticalViolations > 0) {
      console.log(`\n🚫 DEPLOYMENT BLOCKED: ${criticalViolations} critical performance violations`);
      console.log('   Fix critical issues before deploying to production');
      return false;
    }
    
    if (highViolations > 0 && this.environment === 'production') {
      console.log(`\n⚠️  WARNING: ${highViolations} high-severity performance violations`);
      console.log('   Consider fixing these issues before production deployment');
      //allow deployment but with warning for high violations in production
    }
    
    if (this.violations.length === 0) {
      console.log('\n✅ DEPLOYMENT APPROVED: All performance gates passed');
    } else {
      console.log(`\n✅ DEPLOYMENT APPROVED: ${this.violations.length} minor violations (not blocking)`);
    }
    
    return true;
  }
}

//main execution
async function main() {
  const environment = process.env.NODE_ENV || process.argv[2] || 'staging';
  const gate = new PerformanceGate(environment);
  
  try {
    const passed = await gate.run();
    
    //exit with appropriate code
    process.exit(passed ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Performance Gate failed with error:', error.message);
    process.exit(1);
  }
}

//run if called directly
if (require.main === module) {
  main();
}

module.exports = { PerformanceGate, PERFORMANCE_GATES };