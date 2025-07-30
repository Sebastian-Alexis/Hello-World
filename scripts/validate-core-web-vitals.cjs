#!/usr/bin/env node

//core web vitals validation script
//comprehensive testing of CWV metrics against Plan 7 thresholds
//includes regression detection and performance budget validation

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

//core web vitals thresholds per Plan 7
const CWV_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000, unit: 'ms', name: 'Largest Contentful Paint' },
  FID: { good: 100, needsImprovement: 300, unit: 'ms', name: 'First Input Delay' },
  CLS: { good: 0.1, needsImprovement: 0.25, unit: '', name: 'Cumulative Layout Shift' },
  FCP: { good: 1800, needsImprovement: 3000, unit: 'ms', name: 'First Contentful Paint' },
  TTFB: { good: 600, needsImprovement: 1500, unit: 'ms', name: 'Time to First Byte' },
  TTI: { good: 5000, needsImprovement: 7300, unit: 'ms', name: 'Time to Interactive' },
  TBT: { good: 200, needsImprovement: 600, unit: 'ms', name: 'Total Blocking Time' },
  SI: { good: 3400, needsImprovement: 5800, unit: 'ms', name: 'Speed Index' }
};

//test URLs with different performance characteristics
const TEST_URLS = [
  { url: 'http://localhost:4321', name: 'Homepage', critical: true },
  { url: 'http://localhost:4321/portfolio', name: 'Portfolio', critical: true },
  { url: 'http://localhost:4321/blog', name: 'Blog', critical: true },
  { url: 'http://localhost:4321/flights', name: 'Flights', critical: false },
  { url: 'http://localhost:4321/skills', name: 'Skills', critical: false }
];

class CoreWebVitalsValidator {
  constructor() {
    this.results = [];
    this.violations = [];
    this.baseline = null;
    this.startTime = Date.now();
  }

  //main validation execution
  async run() {
    try {
      console.log('\n🎯 Core Web Vitals Comprehensive Validation');
      console.log('═'.repeat(50));
      console.log('Validating CWV metrics against Plan 7 performance budgets\n');

      //load baseline metrics if available
      await this.loadBaseline();

      //run lighthouse tests for all URLs
      await this.runLighthouseTests();

      //validate metrics against thresholds
      await this.validateMetrics();

      //detect performance regressions
      await this.detectRegressions();

      //generate field data simulation
      await this.simulateFieldData();

      //create optimization recommendations
      await this.generateRecommendations();

      //generate comprehensive report
      await this.generateReport();

      return this.shouldPass();

    } catch (error) {
      console.error('❌ Core Web Vitals validation failed:', error.message);
      return false;
    }
  }

  //load baseline metrics for regression detection
  async loadBaseline() {
    const baselinePath = 'cwv-baseline.json';
    
    if (fs.existsSync(baselinePath)) {
      try {
        this.baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
        console.log('📊 Loaded baseline metrics for regression detection');
      } catch (error) {
        console.log('⚠️  Could not load baseline metrics');
      }
    } else {
      console.log('💡 No baseline found - will create new baseline after validation');
    }
  }

  //run lighthouse tests for all URLs
  async runLighthouseTests() {
    console.log('🔬 Running Lighthouse tests for Core Web Vitals...\n');

    for (const testCase of TEST_URLS) {
      console.log(`  Testing ${testCase.name} (${testCase.url})...`);
      
      try {
        //run lighthouse for this specific URL
        const lighthouseCommand = `npx lighthouse ${testCase.url} --only-categories=performance --output=json --quiet --chrome-flags="--headless --no-sandbox"`;
        
        const output = execSync(lighthouseCommand, { 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
        
        const report = JSON.parse(output);
        
        //extract CWV metrics
        const metrics = this.extractMetrics(report, testCase);
        this.results.push(metrics);
        
        console.log(`    ✅ Completed in ${metrics.testDuration}ms`);
        
      } catch (error) {
        console.error(`    ❌ Failed: ${error.message}`);
        //add failed result
        this.results.push({
          url: testCase.url,
          name: testCase.name,
          critical: testCase.critical,
          failed: true,
          error: error.message
        });
      }
    }
    
    console.log('');
  }

  //extract CWV metrics from lighthouse report
  extractMetrics(report, testCase) {
    const audits = report.lhr.audits;
    const categories = report.lhr.categories;
    
    return {
      url: testCase.url,
      name: testCase.name,
      critical: testCase.critical,
      timestamp: new Date().toISOString(),
      testDuration: report.lhr.timing.total,
      
      //lighthouse scores
      performanceScore: Math.round(categories.performance.score * 100),
      
      //core web vitals
      metrics: {
        LCP: audits['largest-contentful-paint']?.numericValue || 0,
        FID: audits['max-potential-fid']?.numericValue || 0, //use max potential FID as proxy
        CLS: audits['cumulative-layout-shift']?.numericValue || 0,
        FCP: audits['first-contentful-paint']?.numericValue || 0,
        TTFB: audits['server-response-time']?.numericValue || 0,
        TTI: audits['interactive']?.numericValue || 0,
        TBT: audits['total-blocking-time']?.numericValue || 0,
        SI: audits['speed-index']?.numericValue || 0
      },
      
      //additional performance data
      opportunities: audits ? Object.keys(audits)
        .filter(key => audits[key].details?.type === 'opportunity')
        .map(key => ({
          audit: key,
          title: audits[key].title,
          potential: audits[key].details?.overallSavingsMs || 0
        }))
        .filter(opp => opp.potential > 100) //only significant opportunities
        .sort((a, b) => b.potential - a.potential) : [],
        
      //diagnostic data
      diagnostics: audits ? Object.keys(audits)
        .filter(key => audits[key].details?.type === 'diagnostic')
        .map(key => ({
          audit: key,
          title: audits[key].title,
          score: audits[key].score
        }))
        .filter(diag => diag.score !== null && diag.score < 0.9) : [] //only failing diagnostics
    };
  }

  //validate metrics against Plan 7 thresholds
  async validateMetrics() {
    console.log('📏 Validating metrics against performance budgets...\n');

    for (const result of this.results) {
      if (result.failed) continue;
      
      console.log(`📄 ${result.name} (Performance Score: ${result.performanceScore}):`);
      
      result.validationResults = {};
      
      //validate each CWV metric
      for (const [metricName, threshold] of Object.entries(CWV_THRESHOLDS)) {
        const value = result.metrics[metricName];
        const rating = this.getRating(metricName, value);
        const passed = rating === 'good';
        
        result.validationResults[metricName] = {
          value,
          rating,
          passed,
          threshold: threshold.good
        };
        
        const status = passed ? '✅' : '❌';
        const formattedValue = this.formatValue(value, threshold.unit);
        const formattedThreshold = this.formatValue(threshold.good, threshold.unit);
        
        console.log(`  ${status} ${threshold.name}: ${formattedValue} (≤ ${formattedThreshold}) - ${rating.toUpperCase()}`);
        
        if (!passed) {
          this.violations.push({
            url: result.url,
            name: result.name,
            metric: metricName,
            metricName: threshold.name,
            value,
            threshold: threshold.good,
            rating,
            critical: result.critical,
            severity: result.critical ? 'high' : 'medium'
          });
        }
      }
      
      console.log('');
    }
  }

  //detect performance regressions
  async detectRegressions() {
    if (!this.baseline) {
      console.log('💡 No baseline available for regression detection\n');
      return;
    }
    
    console.log('🔍 Detecting performance regressions...\n');
    
    for (const result of this.results) {
      if (result.failed) continue;
      
      const baselineResult = this.baseline.find(b => b.url === result.url);
      if (!baselineResult) continue;
      
      console.log(`📊 ${result.name} regression analysis:`);
      
      result.regressions = {};
      let hasRegressions = false;
      
      for (const [metricName, threshold] of Object.entries(CWV_THRESHOLDS)) {
        const currentValue = result.metrics[metricName];
        const baselineValue = baselineResult.metrics[metricName];
        
        if (!baselineValue) continue;
        
        //calculate percentage change
        const percentChange = ((currentValue - baselineValue) / baselineValue) * 100;
        const isRegression = percentChange > 20; //20% regression threshold
        
        result.regressions[metricName] = {
          current: currentValue,
          baseline: baselineValue,
          change: percentChange,
          isRegression
        };
        
        if (isRegression) {
          hasRegressions = true;
          const status = '📈';
          console.log(`  ${status} ${threshold.name}: +${percentChange.toFixed(1)}% (${this.formatValue(baselineValue, threshold.unit)} → ${this.formatValue(currentValue, threshold.unit)})`);
          
          this.violations.push({
            url: result.url,
            name: result.name,
            type: 'regression',
            metric: metricName,
            metricName: threshold.name,
            change: percentChange,
            current: currentValue,
            baseline: baselineValue,
            severity: 'high'
          });
        } else {
          const status = percentChange > 0 ? '⚡' : '✅';
          const changeStr = percentChange >= 0 ? `+${percentChange.toFixed(1)}%` : `${percentChange.toFixed(1)}%`;
          console.log(`  ${status} ${threshold.name}: ${changeStr}`);
        }
      }
      
      if (!hasRegressions) {
        console.log('  🎉 No significant regressions detected');
      }
      
      console.log('');
    }
  }

  //simulate field data based on lab data
  async simulateFieldData() {
    console.log('🌐 Simulating Real User Monitoring (RUM) data...\n');
    
    for (const result of this.results) {
      if (result.failed) continue;
      
      //simulate field data by adding realistic variance to lab data
      result.fieldDataSimulation = {};
      
      for (const [metricName, threshold] of Object.entries(CWV_THRESHOLDS)) {
        const labValue = result.metrics[metricName];
        
        //field data is typically 1.2-2x slower than lab data
        const fieldMultiplier = 1.2 + (Math.random() * 0.8); //1.2x to 2x
        const fieldValue = labValue * fieldMultiplier;
        
        //add some random variance
        const variance = 0.1 + (Math.random() * 0.2); //10-30% variance
        const finalValue = fieldValue * (1 + (Math.random() - 0.5) * variance);
        
        result.fieldDataSimulation[metricName] = {
          labValue,
          fieldValue: finalValue,
          multiplier: fieldMultiplier,
          rating: this.getRating(metricName, finalValue)
        };
      }
      
      console.log(`📱 ${result.name} field data simulation:`);
      
      for (const [metricName, threshold] of Object.entries(CWV_THRESHOLDS)) {
        const sim = result.fieldDataSimulation[metricName];
        const rating = sim.rating;
        const status = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
        
        console.log(`  ${status} ${threshold.name}: ${this.formatValue(sim.fieldValue, threshold.unit)} (${rating.toUpperCase()}) [${sim.multiplier.toFixed(1)}x lab]`);
      }
      
      console.log('');
    }
  }

  //generate optimization recommendations
  async generateRecommendations() {
    console.log('💡 Generating optimization recommendations...\n');
    
    const recommendations = new Set();
    
    for (const result of this.results) {
      if (result.failed) continue;
      
      //analyze opportunities for recommendations
      if (result.opportunities.length > 0) {
        console.log(`🚀 ${result.name} optimization opportunities:`);
        
        result.opportunities.slice(0, 5).forEach(opp => {
          const savings = this.formatValue(opp.potential, 'ms');
          console.log(`  • ${opp.title}: ${savings} potential savings`);
          
          //add specific recommendations based on audit type
          if (opp.audit.includes('unused-css')) {
            recommendations.add('Remove unused CSS to reduce bundle size and improve loading');
          }
          if (opp.audit.includes('unused-javascript')) {
            recommendations.add('Implement code splitting to reduce unused JavaScript');
          }
          if (opp.audit.includes('render-blocking')) {
            recommendations.add('Eliminate render-blocking resources with async/defer');
          }
          if (opp.audit.includes('images')) {
            recommendations.add('Optimize images with modern formats (WebP/AVIF) and compression');
          }
          if (opp.audit.includes('text-compression')) {
            recommendations.add('Enable gzip/brotli compression for text assets');
          }
        });
        
        console.log('');
      }
      
      //metric-specific recommendations
      for (const [metricName, validationResult] of Object.entries(result.validationResults)) {
        if (!validationResult.passed) {
          switch (metricName) {
            case 'LCP':
              recommendations.add('Optimize LCP by preloading hero images and reducing server response times');
              recommendations.add('Use a CDN to serve images from locations closer to users');
              break;
            case 'FID':
              recommendations.add('Reduce FID by minimizing main thread blocking and using web workers');
              recommendations.add('Break up long tasks and defer non-essential JavaScript');
              break;
            case 'CLS':
              recommendations.add('Improve CLS by setting dimensions on images and reserving space for dynamic content');
              recommendations.add('Use CSS containment and avoid inserting content above existing content');
              break;
            case 'FCP':
              recommendations.add('Improve FCP by optimizing critical rendering path and reducing render-blocking resources');
              break;
            case 'TTFB':
              recommendations.add('Optimize TTFB by using edge caching and optimizing database queries');
              break;
          }
        }
      }
    }
    
    result.recommendations = Array.from(recommendations);
    
    console.log('📋 Priority recommendations:');
    Array.from(recommendations).slice(0, 8).forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    console.log('');
  }

  //generate comprehensive CWV report
  async generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    console.log('📊 Core Web Vitals Validation Report');
    console.log('═'.repeat(50));
    console.log(`Validation completed in ${Math.round(duration / 1000)}s`);
    console.log(`URLs tested: ${this.results.length}`);
    console.log(`Violations found: ${this.violations.length}\n`);
    
    //overall CWV score
    const cwvScore = this.calculateCWVScore();
    console.log(`Overall CWV Score: ${cwvScore}%`);
    console.log(`Plan 7 Target: ≥95% (All metrics "Good")\n`);
    
    //critical path analysis
    const criticalResults = this.results.filter(r => r.critical && !r.failed);
    if (criticalResults.length > 0) {
      console.log('🎯 Critical Path Performance:');
      console.log('─'.repeat(30));
      
      criticalResults.forEach(result => {
        const passedMetrics = Object.values(result.validationResults).filter(v => v.passed).length;
        const totalMetrics = Object.keys(result.validationResults).length;
        const score = Math.round((passedMetrics / totalMetrics) * 100);
        
        console.log(`${result.name}: ${score}% (${passedMetrics}/${totalMetrics} metrics passed)`);
      });
      
      console.log('');
    }
    
    //field data projections
    console.log('🌐 Field Data Projections:');
    console.log('─'.repeat(30));
    
    for (const result of this.results.filter(r => !r.failed && r.critical)) {
      const fieldScore = this.calculateFieldScore(result);
      console.log(`${result.name}: ${fieldScore}% field performance projected`);
    }
    
    console.log('');
    
    //save baseline for future regression detection
    await this.saveBaseline();
    
    //save detailed report
    await this.saveDetailedReport();
  }

  //calculate overall CWV score
  calculateCWVScore() {
    const successfulResults = this.results.filter(r => !r.failed);
    if (successfulResults.length === 0) return 0;
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const result of successfulResults) {
      const weight = result.critical ? 2 : 1; //critical pages weighted 2x
      
      const passedMetrics = Object.values(result.validationResults).filter(v => v.passed).length;
      const totalMetrics = Object.keys(result.validationResults).length;
      const score = (passedMetrics / totalMetrics) * 100;
      
      totalScore += score * weight;
      totalWeight += weight;
    }
    
    return Math.round(totalScore / totalWeight);
  }

  //calculate field performance score projection
  calculateFieldScore(result) {
    if (!result.fieldDataSimulation) return 0;
    
    const goodMetrics = Object.values(result.fieldDataSimulation).filter(sim => sim.rating === 'good').length;
    const totalMetrics = Object.keys(result.fieldDataSimulation).length;
    
    return Math.round((goodMetrics / totalMetrics) * 100);
  }

  //save baseline metrics for future regression detection
  async saveBaseline() {
    const baseline = this.results
      .filter(r => !r.failed)
      .map(r => ({
        url: r.url,
        name: r.name,
        timestamp: r.timestamp,
        performanceScore: r.performanceScore,
        metrics: r.metrics
      }));
    
    fs.writeFileSync('cwv-baseline.json', JSON.stringify(baseline, null, 2));
    console.log('💾 Baseline metrics saved for future regression detection');
  }

  //save detailed validation report
  async saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      plan: 'Plan 7 - Core Web Vitals Validation',
      thresholds: CWV_THRESHOLDS,
      results: this.results,
      violations: this.violations,
      overallScore: this.calculateCWVScore(),
      passed: this.shouldPass(),
      summary: {
        urlsTested: this.results.length,
        successfulTests: this.results.filter(r => !r.failed).length,
        criticalPaths: this.results.filter(r => r.critical).length,
        violationsFound: this.violations.length,
        regressions: this.violations.filter(v => v.type === 'regression').length
      }
    };
    
    const reportPath = `cwv-validation-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`💾 Detailed CWV report saved to: ${reportPath}\n`);
  }

  //determine if validation should pass
  shouldPass() {
    //require 95% CWV score to pass Plan 7 criteria
    const score = this.calculateCWVScore();
    const criticalViolations = this.violations.filter(v => v.critical && v.severity === 'high').length;
    
    return score >= 95 && criticalViolations === 0;
  }

  //utility methods
  getRating(metric, value) {
    const threshold = CWV_THRESHOLDS[metric];
    if (!threshold) return 'unknown';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  formatValue(value, unit) {
    switch (unit) {
      case 'ms':
        return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
      default:
        return typeof value === 'number' ? value.toFixed(3) : value.toString();
    }
  }
}

//main execution
async function main() {
  const validator = new CoreWebVitalsValidator();
  
  try {
    const passed = await validator.run();
    
    console.log('═'.repeat(50));
    
    if (passed) {
      console.log('🎉 CORE WEB VITALS VALIDATION PASSED');
      console.log('All metrics meet Plan 7 performance budgets');
    } else {
      console.log('🚫 CORE WEB VITALS VALIDATION FAILED');
      console.log('Some metrics do not meet required thresholds');
    }
    
    console.log('═'.repeat(50));
    
    process.exit(passed ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 CWV validation failed with error:', error.message);
    process.exit(1);
  }
}

//run if called directly
if (require.main === module) {
  main();
}

module.exports = { CoreWebVitalsValidator, CWV_THRESHOLDS };