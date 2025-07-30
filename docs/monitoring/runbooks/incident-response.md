# Incident Response Runbook

This runbook provides step-by-step procedures for responding to and managing incidents in the monitoring system.

## Incident Classification

### Severity Levels

#### P0 - Critical (Complete Service Outage)
- **Definition**: Complete service unavailability affecting all users
- **Response Time**: Immediate (< 15 minutes)
- **Examples**:
  - Website completely down
  - Database unavailable
  - Security breach
  - Data corruption

#### P1 - High (Major Service Degradation)
- **Definition**: Significant service degradation affecting most users
- **Response Time**: 1 hour
- **Examples**:
  - Slow response times (>5s)
  - Authentication failures
  - Payment processing issues
  - High error rates (>10%)

#### P2 - Medium (Minor Service Issues)
- **Definition**: Service issues affecting some users or features
- **Response Time**: 4 hours during business hours
- **Examples**:
  - Non-critical feature failures
  - Performance degradation
  - Third-party service issues
  - Monitoring alerts

#### P3 - Low (Informational)
- **Definition**: Issues that don't immediately affect users
- **Response Time**: Next business day
- **Examples**:
  - Capacity warnings
  - Maintenance notifications
  - Documentation updates
  - Minor configuration changes

## Incident Response Process

### Phase 1: Detection & Assessment (0-15 minutes)

#### 1.1 Incident Detection
**Automated Detection:**
- Monitoring alerts (APM, uptime, health checks)
- Error rate thresholds exceeded
- Performance degradation alerts
- Security event notifications

**Manual Detection:**
- User reports
- Customer support tickets
- Team member observations
- External monitoring services

#### 1.2 Initial Assessment
```bash
# Quick system health check
curl http://localhost:4321/api/health

# Check monitoring dashboard
open http://localhost:4321/admin/monitoring

# Review recent logs
tail -f ./logs/application.log | grep ERROR

# Check system resources
top
df -h
```

#### 1.3 Incident Declaration
**Decision Criteria:**
- Service unavailability > 5 minutes
- Error rate > 5% for > 2 minutes
- Response time > 5 seconds for > 5 minutes
- Security alert triggered
- Customer complaints increasing

**Actions:**
1. Create incident in monitoring system
2. Set appropriate severity level
3. Assign incident commander
4. Start incident timeline

```typescript
// Create incident via API
await fetch('/api/monitoring/incidents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Database Connection Failures',
    description: 'Multiple database connection timeouts detected',
    severity: 'high',
    affectedServices: ['database', 'api'],
    createdBy: 'on-call-engineer'
  })
});
```

### Phase 2: Response & Mitigation (15 minutes - 4 hours)

#### 2.1 Team Mobilization
**P0/P1 Incidents:**
- Notify incident commander
- Page on-call engineer
- Alert development team lead
- Notify customer support

**Communication Channels:**
- Slack: #incidents
- Email: incidents@company.com
- Phone: Emergency contact list

#### 2.2 Investigation & Diagnosis

**System Health Check:**
```bash
# Check all health endpoints
curl http://localhost:4321/api/health
curl http://localhost:4321/api/health/database

# Review monitoring metrics
curl http://localhost:4321/api/analytics/dashboard

# Check recent deployments
git log --oneline -10

# Review system logs
grep -A 5 -B 5 "ERROR\|FATAL" ./logs/application.log
```

**Performance Analysis:**
```bash
# Check memory usage
free -h
cat /proc/meminfo

# Check disk usage
df -h
du -sh ./logs/*

# Check network connectivity
ping google.com
netstat -tuln
```

**Database Health:**
```sql
-- Check database connectivity
SELECT 1;

-- Check for locks
SELECT * FROM sqlite_master LIMIT 1;

-- Verify recent data
SELECT COUNT(*) FROM portfolio_projects;
SELECT COUNT(*) FROM blog_posts;
```

#### 2.3 Immediate Mitigation

**Common Mitigation Steps:**

1. **Service Restart:**
```bash
# Restart application
pm2 restart portfolio-app

# Check service status
pm2 status
```

2. **Database Issues:**
```bash
# Check database file
ls -la local.db
sqlite3 local.db ".schema"

# Restore from backup if needed
cp ./backups/database/latest.db ./local.db
```

3. **Resource Issues:**
```bash
# Clear logs if disk full
truncate -s 0 ./logs/application.log

# Clear temporary files
rm -rf ./tmp/*
rm -rf ./cache/*
```

4. **Configuration Issues:**
```bash
# Revert to last known good config
git checkout HEAD~1 astro.config.mjs

# Restart with safe defaults
NODE_ENV=production npm start
```

### Phase 3: Resolution & Recovery (Ongoing)

#### 3.1 Root Cause Analysis

**Data Collection:**
```bash
# Export system metrics
curl http://localhost:4321/api/monitoring/metrics > incident-metrics.json

# Export relevant logs
grep -C 10 "$(date -d '1 hour ago' +%Y-%m-%d\ %H)" ./logs/application.log > incident-logs.txt

# Export database state
sqlite3 local.db ".dump" > database-state.sql
```

**Timeline Construction:**
1. When did the issue start?
2. What changed recently?
3. What were the triggering conditions?
4. How did the system respond?
5. What mitigation steps were taken?

#### 3.2 Permanent Fix Implementation

**Code Changes:**
```bash
# Create fix branch
git checkout -b fix/incident-YYYY-MM-DD

# Implement fix
# ... make necessary changes ...

# Test fix
npm test
npm run e2e

# Deploy fix
git push origin fix/incident-YYYY-MM-DD
# ... follow deployment process ...
```

**Configuration Updates:**
```bash
# Update monitoring thresholds
vim monitoring.config.json

# Update alert rules
# ... modify alert rules ...

# Restart monitoring
pm2 restart monitoring-service
```

#### 3.3 Verification

**System Verification:**
```bash
# Verify fix is working
curl http://localhost:4321/api/health
curl http://localhost:4321/api/health/database

# Check error rates
curl http://localhost:4321/api/analytics/dashboard

# Monitor for 30 minutes
watch -n 30 'curl -s http://localhost:4321/api/health | jq .status'
```

### Phase 4: Communication & Documentation

#### 4.1 Status Updates

**During Incident:**
- Update every 30 minutes for P0
- Update every hour for P1
- Update every 4 hours for P2

**Communication Template:**
```
INCIDENT UPDATE - [TIMESTAMP]
Incident: [TITLE]
Status: [Investigating/Identified/Monitoring/Resolved]
Impact: [Description of user impact]
Actions: [What we're doing to fix it]
ETA: [Expected resolution time]
Next Update: [When we'll provide next update]
```

**Channels:**
- Status page updates
- Slack notifications
- Email to stakeholders
- Customer support updates

#### 4.2 Post-Incident Activities

**Incident Closure:**
```typescript
// Update incident status
await fetch(`/api/monitoring/incidents/${incidentId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'resolved',
    resolution: 'Database connection pool increased',
    resolvedBy: 'incident-commander',
    resolvedAt: Date.now()
  })
});
```

**Documentation:**
1. Update incident timeline
2. Document root cause
3. Record lessons learned
4. Update runbooks if needed

### Phase 5: Post-Mortem Process

#### 5.1 Post-Mortem Meeting

**Attendees:**
- Incident commander
- Engineering team
- Product owner
- Customer support

**Agenda:**
1. Incident timeline review
2. Root cause analysis
3. Response effectiveness
4. Improvement opportunities
5. Action items assignment

#### 5.2 Post-Mortem Document

**Template:**
```markdown
# Post-Mortem: [Incident Title]

## Summary
- **Date**: [Date]
- **Duration**: [Total duration]
- **Impact**: [User impact description]
- **Root Cause**: [Primary cause]

## Timeline
- [Time]: [Event description]
- ...

## Root Cause Analysis
### What Happened
[Detailed description]

### Why It Happened
[Contributing factors]

### How We Detected It
[Detection method and timeline]

## Response Analysis
### What Went Well
- [Positive aspects]

### What Could Be Improved
- [Areas for improvement]

## Action Items
- [ ] [Action item 1] - [Owner] - [Due date]
- [ ] [Action item 2] - [Owner] - [Due date]

## Lessons Learned
[Key takeaways]
```

## Specific Incident Types

### Database Connection Issues

**Symptoms:**
- High database connection errors
- Slow query response times
- Connection timeouts

**Investigation:**
```bash
# Check database connectivity
sqlite3 local.db "SELECT 1;"

# Check for locks
lsof local.db

# Review connection patterns
grep "database" ./logs/application.log | tail -50
```

**Common Fixes:**
1. Increase connection pool size
2. Restart database connections
3. Clear connection locks
4. Restore from backup

### High Memory Usage

**Symptoms:**
- Memory usage alerts
- Slow response times
- Out of memory errors

**Investigation:**
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -10

# Check for memory leaks
# Review heap dumps if available
```

**Common Fixes:**
1. Restart application
2. Increase memory limits
3. Clear caches
4. Deploy memory leak fix

### Security Incidents

**Symptoms:**
- Security alerts triggered
- Unusual access patterns
- Suspicious user activity

**Investigation:**
```bash
# Check security logs
grep "SECURITY" ./logs/application.log

# Review recent access logs
grep "LOGIN" ./logs/application.log | tail -100

# Check for suspicious patterns
grep "FAILED_LOGIN" ./logs/application.log | cut -d' ' -f4 | sort | uniq -c | sort -nr
```

**Common Actions:**
1. Block suspicious IPs
2. Force password resets
3. Enable additional security measures
4. Contact security team

## Tools & Resources

### Monitoring Tools
- **Dashboard**: http://localhost:4321/admin/monitoring
- **Health Checks**: http://localhost:4321/api/health
- **Logs**: ./logs/application.log
- **Metrics**: http://localhost:4321/api/analytics/dashboard

### Communication Tools
- **Slack**: #incidents channel
- **Email**: incidents@company.com
- **Status Page**: status.company.com

### Reference Links
- [System Architecture](../architecture.md)
- [Deployment Guide](../deployment.md)
- [Monitoring Documentation](../README.md)
- [Security Procedures](./security.md)

## Contact Information

### On-Call Rotation
- **Primary**: [Phone/Email]
- **Secondary**: [Phone/Email]
- **Escalation**: [Manager Phone/Email]

### Key Personnel
- **Incident Commander**: [Contact]
- **Technical Lead**: [Contact]
- **Product Owner**: [Contact]
- **Customer Support**: [Contact]

## Appendices

### A. Common Commands
```bash
# System health check
curl http://localhost:4321/api/health

# View recent logs
tail -f ./logs/application.log

# Check system resources
top
df -h
free -h

# Restart services
pm2 restart all

# Check database
sqlite3 local.db "SELECT 1;"
```

### B. Alert Thresholds
- **Response Time**: > 2 seconds
- **Error Rate**: > 5%
- **Memory Usage**: > 80%
- **Disk Usage**: > 85%
- **Database Connections**: > 90% of pool

### C. Emergency Contacts
```
Primary On-Call: +1-XXX-XXX-XXXX
Secondary On-Call: +1-XXX-XXX-XXXX
Manager: +1-XXX-XXX-XXXX
Security Team: security@company.com
```