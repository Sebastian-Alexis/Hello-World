#!/usr/bin/env node

//final validation runner for Plan 7
//orchestrates all validation scripts and generates comprehensive summary
//provides final go/no-go decision for production deployment

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

//validation script mappings
const VALIDATION_SCRIPTS = [
  {
    name: 'Core Web Vitals',
    script: 'validate-core-web-vitals.cjs',
    command: 'npm run validate:cwv',
    critical: true,
    description: 'Validates LCP, FID, CLS and other Core Web Vitals against Plan 7 thresholds'
  },
  {
    name: 'Service Worker & Caching',
    script: 'validate-caching.cjs', 
    command: 'npm run validate:caching',
    critical: true,
    description: 'Tests offline functionality, cache strategies, and cache effectiveness'
  },
  {
    name: 'Database Performance',
    script: 'validate-database.cjs',
    command: 'npm run validate:database', 
    critical: true,
    description: 'Validates query performance, optimization, and database reliability'
  },
  {
    name: 'Test Coverage & Quality',
    script: 'validate-tests.cjs',
    command: 'npm run validate:tests',
    critical: true,
    description: 'Ensures comprehensive test coverage and quality metrics'
  }
];

//Plan 7 success criteria
const SUCCESS_CRITERIA = {
  criticalValidations: 4, //all critical validations must pass
  overallScore: 95,       //minimum 95% overall score
  noBlockingIssues: true, //no critical or high severity issues
  deploymentReady: true   //all systems ready for production
};

class FinalValidator {
  constructor() {
    this.results = [];
    this.overallResults = {
      passed: false,
      score: 0,
      criticalPassed: 0,
      totalCritical: VALIDATION_SCRIPTS.filter(s => s.critical).length,
      blockingIssues: 0,
      recommendations: []
    };
    this.startTime = Date.now();
  }

  //main validation execution
  async run() {
    try {
      console.log('\n🚀 Plan 7 Final Validation Suite');
      console.log('═'.repeat(60));
      console.log('Running comprehensive validation of all systems against Plan 7 requirements');
      console.log('This validation determines production deployment readiness\n');

      //run all validation scripts
      await this.runAllValidations();

      //analyze overall results
      await this.analyzeResults();

      //generate final report
      await this.generateFinalReport();

      //determine deployment decision
      return this.makeDeploymentDecision();

    } catch (error) {
      console.error('❌ Final validation failed:', error.message);
      return false;
    }
  }

  //run all validation scripts
  async runAllValidations() {
    console.log('📊 Running Individual Validation Scripts...\n');

    for (const validation of VALIDATION_SCRIPTS) {
      console.log(`🔍 Running ${validation.name} validation...`);
      console.log(`   ${validation.description}`);
      
      const result = await this.runValidation(validation);
      this.results.push(result);
      
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      const duration = result.duration ? ` (${Math.round(result.duration / 1000)}s)` : '';
      console.log(`   ${status}${duration}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      console.log('');
    }
  }

  //run individual validation script
  async runValidation(validation) {
    const startTime = Date.now();
    
    try {
      //run the validation command
      const output = execSync(validation.command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      //determine if validation passed based on exit code
      const passed = true; //if we get here, command succeeded
      
      return {
        name: validation.name,
        script: validation.script,
        critical: validation.critical,
        passed,
        duration,
        output: this.sanitizeOutput(output)
      };
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      //command failed - validation did not pass
      return {
        name: validation.name,
        script: validation.script,
        critical: validation.critical,
        passed: false,
        duration,
        error: error.message,
        output: this.sanitizeOutput(error.stdout || error.stderr || '')
      };
    }
  }

  //sanitize output for report
  sanitizeOutput(output) {
    if (!output) return '';
    
    //keep only summary information, remove verbose logs
    const lines = output.split('\n');
    const importantLines = lines.filter(line => 
      line.includes('✅') || 
      line.includes('❌') || 
      line.includes('PASSED') || 
      line.includes('FAILED') ||
      line.includes('Score:') ||
      line.includes('violations') ||
      line.includes('recommendations') ||
      line.includes('═') ||
      line.includes('📊') ||
      line.includes('🎉') ||
      line.includes('🚫')
    );
    
    return importantLines.slice(0, 20).join('\n'); //limit to 20 most important lines
  }

  //analyze overall validation results
  async analyzeResults() {
    console.log('📈 Analyzing Overall Results...\n');

    //count critical validations that passed
    const criticalResults = this.results.filter(r => r.critical);
    const criticalPassed = criticalResults.filter(r => r.passed).length;
    
    //calculate overall score
    const totalPassed = this.results.filter(r => r.passed).length;
    const totalValidations = this.results.length;
    const overallScore = (totalPassed / totalValidations) * 100;
    
    //count blocking issues (failed critical validations)
    const blockingIssues = criticalResults.filter(r => !r.passed).length;
    
    //generate recommendations based on failures
    const recommendations = this.generateRecommendations();
    
    this.overallResults = {
      passed: criticalPassed === this.overallResults.totalCritical && overallScore >= SUCCESS_CRITERIA.overallScore,
      score: overallScore,
      criticalPassed,
      totalCritical: this.overallResults.totalCritical,
      blockingIssues,
      recommendations,
      totalValidations,
      passedValidations: totalPassed
    };

    console.log(`📊 Overall Score: ${overallScore.toFixed(1)}%`);
    console.log(`🎯 Critical Validations: ${criticalPassed}/${this.overallResults.totalCritical} passed`);
    console.log(`⚠️  Blocking Issues: ${blockingIssues}`);
    console.log(`📋 Total Validations: ${totalPassed}/${totalValidations} passed\n`);
  }

  //generate recommendations based on failures
  generateRecommendations() {
    const recommendations = [];
    
    for (const result of this.results) {
      if (!result.passed) {
        switch (result.name) {
          case 'Core Web Vitals':
            recommendations.push('Optimize Core Web Vitals by improving loading performance and reducing layout shifts');
            recommendations.push('Consider implementing advanced caching strategies and image optimization');
            break;
            
          case 'Service Worker & Caching':
            recommendations.push('Implement comprehensive service worker with offline functionality');
            recommendations.push('Configure proper cache headers and strategies for different resource types');
            break;
            
          case 'Database Performance':
            recommendations.push('Optimize database queries and implement proper indexing strategies');
            recommendations.push('Configure connection pooling and query optimization for better performance');
            break;
            
          case 'Test Coverage & Quality':
            recommendations.push('Increase test coverage to meet minimum 90% threshold');
            recommendations.push('Add comprehensive end-to-end tests for critical user journeys');
            break;
        }
      }
    }
    
    //remove duplicates
    return [...new Set(recommendations)];
  }

  //generate final comprehensive report
  async generateFinalReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    console.log('📋 Plan 7 Final Validation Report');
    console.log('═'.repeat(60));
    console.log(`Validation Suite completed in ${Math.round(totalDuration / 1000)}s`);
    console.log(`Validation Date: ${new Date().toISOString()}`);
    console.log('');

    //validation summary
    console.log('📊 Validation Summary:');
    console.log('─'.repeat(30));
    
    for (const result of this.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const critical = result.critical ? ' (CRITICAL)' : '';
      const duration = result.duration ? ` - ${Math.round(result.duration / 1000)}s` : '';
      
      console.log(`${status} ${result.name}${critical}${duration}`);
    }
    
    console.log('');

    //overall assessment
    console.log('🎯 Overall Assessment:');
    console.log('─'.repeat(30));
    console.log(`Overall Score: ${this.overallResults.score.toFixed(1)}% (Target: ≥${SUCCESS_CRITERIA.overallScore}%)`);
    console.log(`Critical Systems: ${this.overallResults.criticalPassed}/${this.overallResults.totalCritical} passing`);
    console.log(`Blocking Issues: ${this.overallResults.blockingIssues}`);
    console.log('');

    //Plan 7 success criteria check
    console.log('📋 Plan 7 Success Criteria:');
    console.log('─'.repeat(30));
    
    const criteriaChecks = [
      {
        name: 'Core Web Vitals meet "Good" thresholds',
        passed: this.results.find(r => r.name === 'Core Web Vitals')?.passed || false
      },
      {
        name: 'Service worker caches resources correctly',
        passed: this.results.find(r => r.name === 'Service Worker & Caching')?.passed || false
      },
      {
        name: 'Database queries execute within performance budgets',
        passed: this.results.find(r => r.name === 'Database Performance')?.passed || false
      },
      {
        name: 'Unit tests achieve >90% code coverage',
        passed: this.results.find(r => r.name === 'Test Coverage & Quality')?.passed || false
      },
      {
        name: 'All critical systems operational',
        passed: this.overallResults.blockingIssues === 0
      },
      {
        name: 'Overall system score ≥95%',
        passed: this.overallResults.score >= SUCCESS_CRITERIA.overallScore
      }
    ];

    criteriaChecks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      console.log(`${status} ${check.name}`);
    });

    console.log('');

    //recommendations
    if (this.overallResults.recommendations.length > 0) {
      console.log('💡 Recommendations for Production Readiness:');
      console.log('─'.repeat(45));
      
      this.overallResults.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      
      console.log('');
    }

    //save detailed report
    await this.saveDetailedReport();
  }

  //save detailed validation report
  async saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      plan: 'Plan 7 Final Validation',
      duration: Date.now() - this.startTime,
      overallResults: this.overallResults,
      validationResults: this.results,
      successCriteria: SUCCESS_CRITERIA,
      deploymentRecommendation: this.overallResults.passed ? 'APPROVED' : 'BLOCKED',
      summary: {
        totalValidations: this.results.length,
        passedValidations: this.results.filter(r => r.passed).length,
        criticalValidations: this.overallResults.totalCritical,
        criticalPassed: this.overallResults.criticalPassed,
        overallScore: this.overallResults.score,
        blockingIssues: this.overallResults.blockingIssues,
        recommendationsCount: this.overallResults.recommendations.length
      }
    };

    const reportPath = `plan7-final-validation-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`💾 Detailed validation report saved to: ${reportPath}`);
  }

  //make final deployment decision
  makeDeploymentDecision() {
    const decision = this.overallResults.passed;
    
    console.log('═'.repeat(60));
    
    if (decision) {
      console.log('🎉 PLAN 7 VALIDATION: DEPLOYMENT APPROVED');
      console.log('');
      console.log('✅ All critical systems meet performance budgets and quality gates');
      console.log('✅ Core Web Vitals achieve "Good" thresholds');
      console.log('✅ Service worker provides excellent offline experience');
      console.log('✅ Database optimization ensures fast query performance');
      console.log('✅ Testing framework provides high confidence in code quality');
      console.log('✅ System monitoring enables proactive issue resolution');
      console.log('');
      console.log('🚀 System is ready for production deployment!');
    } else {
      console.log('🚫 PLAN 7 VALIDATION: DEPLOYMENT BLOCKED');
      console.log('');
      console.log('❌ Critical systems do not meet required thresholds');
      console.log(`❌ ${this.overallResults.blockingIssues} blocking issues must be resolved`);
      console.log(`❌ Overall score: ${this.overallResults.score.toFixed(1)}% (required: ≥${SUCCESS_CRITERIA.overallScore}%)`);
      console.log('');
      console.log('⚠️  Address all violations before attempting production deployment');
      
      if (this.overallResults.recommendations.length > 0) {
        console.log('\n🔧 Priority Actions Required:');
        this.overallResults.recommendations.slice(0, 5).forEach((rec, index) => {
          console.log(`${index + 1}. ${rec}`);
        });
      }
    }
    
    console.log('═'.repeat(60));
    
    return decision;
  }
}

//main execution
async function main() {
  const validator = new FinalValidator();
  
  try {
    const approved = await validator.run();
    
    //exit with appropriate code for CI/CD
    process.exit(approved ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Final validation suite failed:', error.message);
    process.exit(1);
  }
}

//run if called directly
if (require.main === module) {
  main();
}

module.exports = { FinalValidator, SUCCESS_CRITERIA };