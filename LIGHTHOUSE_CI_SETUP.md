# Lighthouse CI Setup & Configuration

This document provides comprehensive setup and usage instructions for the Lighthouse CI performance testing system integrated into your Astro-based personal website.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install --save-dev @lhci/cli @lhci/utils lighthouse
```

### 2. Setup Database Schema
```bash
npm run db:migrate:lighthouse
```

### 3. Run Your First Performance Test
```bash
npm run perf:lighthouse
```

### 4. Check Performance Gates
```bash
npm run perf:gate:staging
```

## 📋 Table of Contents

- [Overview](#overview)
- [Configuration Files](#configuration-files)
- [Performance Budgets](#performance-budgets)
- [GitHub Actions Integration](#github-actions-integration)
- [Performance Gates](#performance-gates)
- [Monitoring & Alerts](#monitoring--alerts)
- [Dashboard Usage](#dashboard-usage)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## 🎯 Overview

The Lighthouse CI system provides:

- **Automated Performance Testing**: Continuous monitoring of Core Web Vitals and Lighthouse scores
- **Performance Budgets**: Configurable thresholds that prevent performance regressions
- **Regression Detection**: Automatic detection and alerting for performance degradations
- **GitHub Integration**: PR comments with performance insights and CI/CD pipeline integration
- **Performance Gates**: Deployment blocking for critical performance violations
- **Comprehensive Dashboard**: Visual monitoring and trend analysis
- **Real-time Monitoring**: Integration with existing performance monitoring infrastructure

## ⚙️ Configuration Files

### `lighthouserc.js` - Main Configuration

```javascript
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:4321',
        'http://localhost:4321/portfolio',
        'http://localhost:4321/blog',
        'http://localhost:4321/flights',
        'http://localhost:4321/skills',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        // ... additional settings
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', {minScore: 0.95}],
        'audits:largest-contentful-paint': ['error', {maxNumericValue: 2500}],
        // ... other assertions
      }
    }
  }
};
```

### `lighthouse.config.js` - Advanced Configuration

Extended configuration with custom audits and performance threshold alignment.

## 📊 Performance Budgets

### Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **FCP** (First Contentful Paint) | ≤ 1.8s | ≤ 3.0s | > 3.0s |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| **TBT** (Total Blocking Time) | ≤ 200ms | ≤ 600ms | > 600ms |

### Lighthouse Score Targets

| Category | Target | Minimum |
|----------|--------|---------|
| **Performance** | 95+ | 90+ |
| **Accessibility** | 95+ | 90+ |
| **Best Practices** | 90+ | 85+ |
| **SEO** | 90+ | 85+ |

### Resource Budget Limits

| Resource Type | Budget Limit |
|---------------|--------------|
| **Total Bundle Size** | 1.6MB |
| **JavaScript Bundle** | 512KB |
| **CSS Bundle** | 100KB |
| **Image Assets** | 1MB |
| **Font Assets** | 200KB |
| **Total Requests** | 50 requests |

## 🔄 GitHub Actions Integration

### Workflow: `.github/workflows/lighthouse-ci.yml`

The GitHub Actions workflow automatically:

1. **Triggers on**:
   - Pull requests to `main` or `develop`
   - Pushes to `main` branch
   - Manual workflow dispatch

2. **Runs tests for**:
   - Desktop configuration (1350×940)
   - Mobile configuration (375×667)

3. **Provides**:
   - PR comments with performance results
   - Artifact storage for detailed reports
   - Performance threshold validation
   - Deployment blocking on critical failures

### PR Comment Example

```markdown
## 🔍 Lighthouse CI Performance Report

**Commit:** a1b2c3d4
**Branch:** feature/performance-optimization
**Timestamp:** 2024-01-15T10:30:00Z

### 📊 http://localhost:4321

| Metric | Score | Status |
|--------|-------|--------|
| Performance | 96 | ✅ |
| Accessibility | 98 | ✅ |
| Best Practices | 92 | ✅ |
| SEO | 95 | ✅ |

**Core Web Vitals:**
- LCP: 2.1s ✅
- FCP: 1.6s ✅
- CLS: 0.08 ✅
- TBT: 180ms ✅
```

## 🚪 Performance Gates

### Gate Configuration

Performance gates prevent deployments when critical thresholds are violated:

```javascript
const PERFORMANCE_GATES = {
  // Lighthouse scores (0-100 scale)
  performance: 95,      // Performance score >= 95
  accessibility: 95,    // Accessibility score >= 95
  bestPractices: 90,    // Best practices score >= 90
  seo: 90,             // SEO score >= 90
  
  // Core Web Vitals
  lcp: 2500,           // LCP <= 2.5s
  fcp: 1800,           // FCP <= 1.8s
  cls: 0.1,            // CLS <= 0.1
  tbt: 200,            // TBT <= 200ms
  
  // Additional budgets
  ttfb: 600,           // TTFB <= 600ms
  totalSize: 1600000,  // Bundle <= 1.6MB
};
```

### Usage

```bash
# Development (relaxed thresholds)
npm run perf:gate:dev

# Staging (full thresholds)
npm run perf:gate:staging

# Production (strict thresholds)
npm run perf:gate:prod

# Combined deployment check
npm run deploy:check
```

### Gate Behavior

- **Critical Violations**: Block deployment immediately
- **High Violations**: Allow deployment with warnings
- **Medium/Low Violations**: Allow deployment, log for monitoring

## 🔔 Monitoring & Alerts

### Regression Detection

The system automatically detects performance regressions by:

1. **Baseline Comparison**: Comparing current results against established baselines
2. **Threshold Analysis**: Flagging metrics that exceed acceptable variance
3. **Trend Analysis**: Identifying consistent degradation patterns
4. **Severity Classification**: Categorizing regressions by impact level

### Alert Integration

Configure webhooks for real-time notifications:

```bash
# Environment variables
PERFORMANCE_ALERT_WEBHOOK=https://hooks.slack.com/services/your-webhook
# or
PERFORMANCE_ALERT_WEBHOOK=https://discord.com/api/webhooks/your-webhook
```

### Alert Types

- **Regression Alerts**: Performance metrics degraded significantly
- **Budget Violations**: Resource budgets exceeded
- **Threshold Violations**: Core Web Vitals in "Poor" range
- **Trend Alerts**: Consistent performance degradation over time

## 📈 Dashboard Usage

### Accessing the Dashboard

The Lighthouse Dashboard component provides visual performance monitoring:

```svelte
<script>
  import LighthouseDashboard from '$lib/components/performance/LighthouseDashboard.svelte';
</script>

<LighthouseDashboard 
  url="https://your-site.com" 
  config="desktop" 
  timeRange="30d" 
/>
```

### Dashboard Features

- **Performance Summary Cards**: Key metrics at a glance
- **Latest Test Results**: Most recent Lighthouse scores and Core Web Vitals
- **Performance Regressions**: List of detected regressions with acknowledgment
- **Performance Trends**: Long-term trend analysis with direction indicators
- **Performance Insights**: AI-powered recommendations and observations

### Interpreting Results

- **🟢 Green**: Meets or exceeds performance targets
- **🟡 Yellow**: Acceptable but has room for improvement
- **🔴 Red**: Below acceptable thresholds, needs attention

## 🔗 API Endpoints

### Lighthouse Results API

```typescript
// Store lighthouse result
POST /api/analytics/lighthouse
{
  "url": "https://example.com",
  "config": "desktop",
  "scores": { "performance": 0.96, ... },
  "audits": { "lcp": 2100, "fcp": 1600, ... }
}

// Get lighthouse results
GET /api/analytics/lighthouse?url=https://example.com&config=desktop&range=30d
```

### Performance Trends API

```typescript
// Get performance trends
GET /api/analytics/trends?url=https://example.com&days=30
{
  "trends": [
    {
      "metric_name": "lcp",
      "trend_direction": "improving",
      "trend_strength": 0.8,
      "dataPoints": [...]
    }
  ]
}
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Lighthouse CI Fails to Start

**Problem**: `lhci autorun` fails with server connection errors

**Solution**:
```bash
# Ensure preview server is running
npm run build
npm run preview &

# Wait for server to be ready
sleep 5

# Run lighthouse CI
npm run lhci:autorun
```

#### 2. Performance Gate Blocking Deployments

**Problem**: Critical performance violations prevent deployment

**Solution**:
1. Review specific violations in the gate report
2. Address critical issues (typically LCP, CLS, or performance score)
3. Re-run performance tests
4. Consider using relaxed thresholds for development

#### 3. Database Schema Issues

**Problem**: Lighthouse CI tables don't exist

**Solution**:
```bash
# Run lighthouse schema migration
npm run db:migrate:lighthouse

# Verify tables exist
sqlite3 local.db ".tables"
```

#### 4. GitHub Actions Failing

**Problem**: CI workflow fails during lighthouse tests

**Common Causes & Solutions**:

- **Server not starting**: Increase wait time in workflow
- **Memory issues**: Reduce numberOfRuns in lighthouserc.js
- **Timeout errors**: Increase timeout values in configuration

### Debug Mode

Enable verbose logging:

```bash
# Debug lighthouse CI
DEBUG=lhci* npm run lhci:autorun

# Debug performance gate
NODE_ENV=development npm run perf:gate:dev
```

### Log Files

Performance reports are saved to:
- `performance-gate-report-[timestamp].json`
- `.lighthouseci/` directory
- GitHub Actions artifacts

## 📋 Best Practices

### 1. Performance Budget Management

- **Set Realistic Budgets**: Base budgets on baseline measurements
- **Regular Review**: Update budgets as performance improves
- **Environment-Specific**: Use different budgets for dev/staging/prod
- **Gradual Tightening**: Progressively improve thresholds over time

### 2. CI/CD Integration

- **Non-Blocking for Development**: Use relaxed thresholds in dev branches
- **Staging Gates**: Enforce full budgets before production
- **Fast Feedback**: Optimize CI workflow for quick results
- **Parallel Testing**: Run desktop and mobile tests concurrently

### 3. Monitoring Strategy

- **Establish Baselines**: Create reliable baseline measurements
- **Trend Analysis**: Monitor long-term trends, not just point-in-time results
- **Alert Tuning**: Adjust alert sensitivity to reduce noise
- **Regular Reviews**: Schedule weekly/monthly performance reviews

### 4. Performance Optimization

- **Fix Critical Issues First**: Address performance score and LCP issues
- **Bundle Optimization**: Regularly audit and optimize bundle sizes
- **Image Optimization**: Ensure all images use modern formats and lazy loading
- **CSS/JS Efficiency**: Remove unused code and optimize delivery

### 5. Team Collaboration

- **Shared Responsibility**: Make performance everyone's responsibility
- **Documentation**: Keep performance guides up to date
- **Training**: Ensure team understands Core Web Vitals
- **Regular Communication**: Share performance insights in team meetings

## 🔮 Advanced Features

### Custom Lighthouse Audits

The system includes custom audits for:

- **Core Web Vitals Integration**: Validates integration with existing monitoring
- **Advanced Image Optimization**: Checks for modern formats, lazy loading, responsive images
- **Performance Budget Validation**: Validates against custom resource budgets

### Performance Regression Analysis

Advanced regression detection using:

- **Statistical Analysis**: Linear regression for trend detection
- **Baseline Management**: Automatic baseline updates for improved performance
- **Multi-metric Correlation**: Analysis of related performance metrics
- **Historical Context**: Long-term performance trend consideration

### Integration with Existing Monitoring

Seamless integration with:

- **Real User Monitoring (RUM)**: Combines synthetic and real user data
- **APM Systems**: Integrates with application performance monitoring
- **Analytics Platforms**: Exports data to analytics systems
- **Alerting Systems**: Integrates with existing notification channels

## 📚 Additional Resources

- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Core Web Vitals Guide](https://web.dev/vitals/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Performance Budgets Guide](https://web.dev/performance-budgets-101/)

## 🤝 Contributing

When contributing to the performance monitoring system:

1. **Test Changes**: Run full performance test suite
2. **Update Documentation**: Keep this guide current
3. **Performance Impact**: Consider the performance impact of changes
4. **Budget Updates**: Update budgets if baseline performance changes

## 📄 License

This Lighthouse CI configuration is part of the personal website project and follows the same license terms.