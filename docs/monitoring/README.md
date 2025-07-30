# Comprehensive Monitoring & Observability System

This documentation covers the complete monitoring and observability infrastructure implemented according to Plan 7's requirements. The system provides comprehensive application performance monitoring, structured logging, health checking, alerting, uptime monitoring, distributed tracing, operational dashboards, and automated backup/recovery procedures.

## System Overview

The monitoring system consists of several integrated components:

- **APM (Application Performance Monitoring)** - Real-time metrics collection and performance tracking
- **Structured Logging** - Centralized logging with search and filtering capabilities
- **Health Monitoring** - Service health checks and dependency monitoring
- **Alerting System** - Multi-channel notifications for critical issues
- **Uptime Monitoring** - Service availability tracking and incident management
- **Distributed Tracing** - Request flow analysis across operations
- **Operational Dashboards** - Real-time metrics visualization
- **Backup & Recovery** - Automated data protection and disaster recovery

## Quick Start

### Prerequisites

- Node.js 18+ 
- SQLite database
- Network connectivity for external monitoring (optional)

### Basic Setup

1. **Initialize the monitoring system:**
```typescript
import { apm } from './src/lib/monitoring/apm';
import { logger } from './src/lib/monitoring/logging';
import { healthMonitor } from './src/lib/monitoring/health';
import { alerting } from './src/lib/monitoring/alerting';
import { uptimeMonitor } from './src/lib/monitoring/uptime';
import { tracing } from './src/lib/monitoring/tracing';
import { backupSystem } from './src/lib/monitoring/backup';
```

2. **Add the monitoring dashboard to your app:**
```astro
---
// In your admin layout or monitoring page
import MonitoringDashboard from '../components/monitoring/MonitoringDashboard.svelte';
---

<MonitoringDashboard client:load />
```

3. **Configure environment variables:**
```bash
# .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
MONITORING_WEBHOOK_URL=https://your-monitoring-service.com/webhook
SECURITY_WEBHOOK_URL=https://your-security-service.com/webhook
```

## Components Documentation

### [Application Performance Monitoring (APM)](./apm.md)
- Real-time metrics collection
- Transaction tracking
- Performance alerting
- Memory monitoring
- Resource tracking

### [Structured Logging](./logging.md)
- Centralized log collection
- Log levels and filtering
- Search capabilities
- Error tracking
- Analytics and insights

### [Health Monitoring](./health.md)
- Service health checks
- Dependency monitoring
- Status reporting
- Health dashboards
- Automated recovery

### [Alerting System](./alerting.md)
- Multi-channel notifications
- Alert rules and thresholds
- Escalation procedures
- Alert suppression
- Incident management

### [Uptime Monitoring](./uptime.md)
- Service availability tracking
- Incident lifecycle management
- Status page generation
- SLA monitoring
- Maintenance windows

### [Distributed Tracing](./tracing.md)
- Request flow tracking
- Performance analysis
- Service dependencies
- Error correlation
- Trace visualization

### [Operational Dashboards](./dashboards.md)
- Real-time metrics
- Custom visualizations
- KPI tracking
- Performance trends
- System overview

### [Backup & Recovery](./backup.md)
- Automated backups
- Recovery procedures
- Data validation
- Disaster recovery
- Compliance reporting

## API Endpoints

### Health Checks
- `GET /api/health` - Overall system health
- `GET /api/health/database` - Database connectivity
- `GET /api/health?summary=true` - Health summary

### Monitoring Data
- `POST /api/monitoring/metrics` - Submit metrics
- `POST /api/monitoring/logs` - Submit logs
- `POST /api/monitoring/traces` - Submit traces
- `POST /api/monitoring/alerts` - Alert notifications

### Analytics
- `POST /api/analytics/track` - Track events
- `GET /api/analytics/dashboard` - Dashboard data
- `POST /api/analytics/performance` - Performance metrics

## Configuration

### Environment Variables

```bash
# Monitoring Configuration
MONITORING_ENABLED=true
APM_SAMPLE_RATE=0.1
LOG_LEVEL=info
BACKUP_ENABLED=true

# Alert Channels
SLACK_WEBHOOK_URL=your_slack_webhook
EMAIL_SERVICE_API_KEY=your_email_key
SMS_SERVICE_API_KEY=your_sms_key

# External Services
EXTERNAL_MONITORING_URL=optional_external_service
```

### Configuration Files

Create `monitoring.config.json`:
```json
{
  "apm": {
    "enabled": true,
    "sampleRate": 0.1,
    "maxTransactionDuration": 30000
  },
  "logging": {
    "level": "info",
    "maxEntries": 10000,
    "persistLocal": true
  },
  "health": {
    "interval": 30000,
    "timeout": 5000,
    "retries": 3
  },
  "alerting": {
    "evaluationInterval": 60000,
    "enableEscalation": true
  },
  "uptime": {
    "defaultInterval": 60000,
    "incidentThreshold": 3
  },
  "backup": {
    "defaultRetention": 30,
    "maxConcurrentJobs": 2
  }
}
```

## Operational Runbooks

### [Incident Response](./runbooks/incident-response.md)
- Incident classification
- Response procedures
- Communication templates
- Post-incident review

### [Performance Issues](./runbooks/performance.md)
- Performance troubleshooting
- Memory leak detection
- Database optimization
- CDN issues

### [Backup & Recovery](./runbooks/backup-recovery.md)
- Backup procedures
- Recovery testing
- Disaster scenarios
- Data validation

### [Security Incidents](./runbooks/security.md)
- Security event response
- Breach procedures
- Forensics collection
- Communication protocols

## Best Practices

### Monitoring

1. **Set appropriate thresholds**
   - Start with loose thresholds and tighten over time
   - Consider seasonal patterns and growth trends
   - Use percentiles rather than averages for latency

2. **Implement gradual alerting**
   - Use warning alerts before critical alerts
   - Implement alert suppression to avoid noise
   - Set up escalation chains for critical issues

3. **Monitor business metrics**
   - Track user engagement metrics
   - Monitor conversion rates
   - Include custom business KPIs

### Logging

1. **Use structured logging**
   ```typescript
   logger.info('User registration completed', 'auth', {
     userId: user.id,
     email: user.email,
     source: 'web',
     duration: registrationTime
   }, ['user', 'registration']);
   ```

2. **Include context**
   - Add request IDs to all logs
   - Include user context when available
   - Log business events with relevant metadata

3. **Set appropriate log levels**
   - ERROR: System errors requiring immediate attention
   - WARN: Potential issues that should be investigated
   - INFO: Important business events
   - DEBUG: Detailed diagnostic information

### Performance

1. **Set performance budgets**
   ```typescript
   const budgets = {
     LCP: 2500,  // ms
     FID: 100,   // ms
     CLS: 0.1    // unitless
   };
   ```

2. **Monitor Core Web Vitals**
   - Track real user metrics (RUM)
   - Set up synthetic monitoring
   - Monitor performance across different devices

3. **Use distributed tracing**
   - Trace critical user journeys
   - Monitor service dependencies
   - Identify performance bottlenecks

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check for memory leaks in JavaScript
   - Monitor garbage collection patterns
   - Review large object allocations

2. **Slow Database Queries**
   - Analyze query execution plans
   - Check index usage
   - Monitor connection pool health

3. **Failed Health Checks**
   - Verify service dependencies
   - Check network connectivity
   - Review resource availability

4. **Alert Fatigue**
   - Review alert thresholds
   - Implement alert suppression
   - Group related alerts

### Debug Commands

```bash
# View current system health
curl http://localhost:4321/api/health

# Check specific health components
curl http://localhost:4321/api/health/database

# View monitoring dashboard
open http://localhost:4321/admin/monitoring

# Check logs
grep ERROR ./logs/application.log

# Test backup system
npm run backup:test
```

## Maintenance

### Daily Tasks
- [ ] Review monitoring dashboard
- [ ] Check for critical alerts
- [ ] Verify backup completion
- [ ] Review error rates

### Weekly Tasks
- [ ] Performance trend analysis
- [ ] Alert threshold review
- [ ] Log retention cleanup
- [ ] Backup verification

### Monthly Tasks
- [ ] Monitoring system health check
- [ ] Alert rule optimization
- [ ] Performance budget review
- [ ] Disaster recovery testing

## Integration Examples

### Custom Metrics
```typescript
import { recordMetric } from './src/lib/monitoring/apm';

// Record business metrics
recordMetric('user.registration', 1, 'counter', { source: 'web' });
recordMetric('order.value', orderAmount, 'gauge', { currency: 'USD' });
```

### Custom Alerts
```typescript
import { createAlert } from './src/lib/monitoring/alerting';

// Create custom alert
createAlert(
  'High Order Volume',
  'Order volume exceeded threshold',
  AlertSeverity.WARNING,
  'business-metrics',
  ['orders', 'volume'],
  { currentVolume: orderCount, threshold: 1000 }
);
```

### Custom Health Check
```typescript
import { registerHealthCheck } from './src/lib/monitoring/health';

registerHealthCheck({
  name: 'payment-service',
  description: 'Payment service connectivity',
  timeout: 5000,
  critical: true,
  tags: ['payment', 'external'],
  check: async () => {
    const response = await fetch('https://payment-api.com/health');
    return {
      status: response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      message: `Payment service ${response.ok ? 'available' : 'unavailable'}`,
      duration: response.headers.get('response-time') || 0,
      timestamp: Date.now(),
    };
  }
});
```

## Support

For questions or issues:

1. Check the [FAQ](./faq.md)
2. Review the [troubleshooting guide](./troubleshooting.md)
3. Check system logs and monitoring dashboard
4. Create an issue in the project repository

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:
- Adding new monitoring features
- Extending alerting rules
- Creating custom dashboards
- Improving documentation