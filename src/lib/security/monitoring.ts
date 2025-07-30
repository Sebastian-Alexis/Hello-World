//comprehensive security monitoring and alerting system
import type { APIContext } from 'astro';

//security event types and severity levels
export enum SecurityEventType {
  //authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGIN_BRUTE_FORCE = 'login_brute_force',
  ACCOUNT_LOCKOUT = 'account_lockout',
  PASSWORD_CHANGE = 'password_change',
  SESSION_HIJACK = 'session_hijack',
  
  //authorization events
  ACCESS_DENIED = 'access_denied',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  
  //input validation events
  XSS_ATTEMPT = 'xss_attempt',
  SQL_INJECTION = 'sql_injection',
  CSRF_VIOLATION = 'csrf_violation',
  MALICIOUS_INPUT = 'malicious_input',
  
  //rate limiting events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  DDOS_ATTACK = 'ddos_attack',
  API_ABUSE = 'api_abuse',
  
  //system events
  CONFIGURATION_CHANGE = 'config_change',
  DATABASE_ERROR = 'database_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  
  //data protection events
  DATA_BREACH = 'data_breach',
  UNAUTHORIZED_DATA_ACCESS = 'unauthorized_data_access',
  GDPR_VIOLATION = 'gdpr_violation',
  
  //general security events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  SECURITY_SCAN = 'security_scan',
  VULNERABILITY_EXPLOIT = 'vulnerability_exploit',
}

export enum Severity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

//security event interface
export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: Severity;
  message: string;
  source: string;
  context: {
    ip?: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
    path?: string;
    method?: string;
    payload?: any;
    error?: string;
    metadata?: Record<string, any>;
  };
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
}

//alert configuration
interface AlertRule {
  id: string;
  name: string;
  eventTypes: SecurityEventType[];
  severity: Severity[];
  conditions?: {
    timeWindow?: number; //ms
    threshold?: number; //event count
    pattern?: RegExp;
  };
  channels: AlertChannel[];
  enabled: boolean;
  suppressDuration?: number; //ms to suppress duplicate alerts
}

interface AlertChannel {
  type: 'email' | 'webhook' | 'console' | 'database';
  config: {
    url?: string;
    recipients?: string[];
    template?: string;
  };
}

//in-memory event store (use database in production)
const eventStore = new Map<string, SecurityEvent>();
const alertRules = new Map<string, AlertRule>();
const suppressedAlerts = new Map<string, number>(); //key -> timestamp

//alert rule definitions
const DEFAULT_ALERT_RULES: AlertRule[] = [
  //critical security events
  {
    id: 'critical-security-events',
    name: 'Critical Security Events',
    eventTypes: [
      SecurityEventType.DATA_BREACH,
      SecurityEventType.PRIVILEGE_ESCALATION,
      SecurityEventType.VULNERABILITY_EXPLOIT,
    ],
    severity: [Severity.CRITICAL, Severity.HIGH],
    channels: [
      { type: 'email', config: { recipients: ['security@company.com'] } },
      { type: 'webhook', config: { url: process.env.SLACK_SECURITY_WEBHOOK } },
    ],
    enabled: true,
  },
  
  //brute force detection
  {
    id: 'brute-force-detection',
    name: 'Brute Force Attack Detection',
    eventTypes: [SecurityEventType.LOGIN_FAILURE],
    severity: [Severity.MEDIUM, Severity.HIGH],
    conditions: {
      timeWindow: 5 * 60 * 1000, //5 minutes
      threshold: 5, //5 failed attempts
    },
    channels: [
      { type: 'email', config: { recipients: ['admin@company.com'] } },
    ],
    enabled: true,
    suppressDuration: 15 * 60 * 1000, //15 minutes
  },
  
  //injection attacks
  {
    id: 'injection-attempts',
    name: 'Injection Attack Attempts',
    eventTypes: [
      SecurityEventType.XSS_ATTEMPT,
      SecurityEventType.SQL_INJECTION,
    ],
    severity: [Severity.HIGH, Severity.CRITICAL],
    channels: [
      { type: 'webhook', config: { url: process.env.SECURITY_WEBHOOK } },
      { type: 'database', config: {} },
    ],
    enabled: true,
  },
  
  //ddos protection
  {
    id: 'ddos-detection',
    name: 'DDoS Attack Detection',
    eventTypes: [SecurityEventType.DDOS_ATTACK],
    severity: [Severity.HIGH, Severity.CRITICAL],
    conditions: {
      timeWindow: 1 * 60 * 1000, //1 minute
      threshold: 100, //100 requests
    },
    channels: [
      { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK } },
    ],
    enabled: true,
    suppressDuration: 5 * 60 * 1000, //5 minutes
  },
];

//initialize alert rules
function initializeAlertRules(): void {
  DEFAULT_ALERT_RULES.forEach(rule => {
    alertRules.set(rule.id, rule);
  });
}

//generate unique event id
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

//log security event
export function logSecurityEvent(
  type: SecurityEventType,
  message: string,
  severity: Severity = Severity.MEDIUM,
  context: SecurityEvent['context'] = {},
  source: string = 'application'
): string {
  const event: SecurityEvent = {
    id: generateEventId(),
    timestamp: new Date(),
    type,
    severity,
    message,
    source,
    context,
    resolved: false,
  };
  
  //store event
  eventStore.set(event.id, event);
  
  //trigger alerts
  checkAlertRules(event);
  
  //log to console in development
  if (import.meta.env.DEV) {
    const severityName = Severity[severity];
    console.log(`[SECURITY-${severityName}] ${type}: ${message}`, context);
  }
  
  return event.id;
}

//check alert rules and trigger alerts
function checkAlertRules(event: SecurityEvent): void {
  for (const rule of alertRules.values()) {
    if (!rule.enabled) continue;
    
    //check if event matches rule
    if (!rule.eventTypes.includes(event.type)) continue;
    if (!rule.severity.includes(event.severity)) continue;
    
    //check conditions
    if (rule.conditions) {
      if (!evaluateConditions(rule, event)) continue;
    }
    
    //check suppression
    const suppressKey = `${rule.id}_${event.context.ip || 'unknown'}`;
    const suppressedUntil = suppressedAlerts.get(suppressKey);
    if (suppressedUntil && Date.now() < suppressedUntil) {
      continue; //still suppressed
    }
    
    //trigger alert
    triggerAlert(rule, event);
    
    //set suppression if configured
    if (rule.suppressDuration) {
      suppressedAlerts.set(suppressKey, Date.now() + rule.suppressDuration);
    }
  }
}

//evaluate alert rule conditions
function evaluateConditions(rule: AlertRule, event: SecurityEvent): boolean {
  const conditions = rule.conditions!;
  
  //time window and threshold check
  if (conditions.timeWindow && conditions.threshold) {
    const windowStart = Date.now() - conditions.timeWindow;
    const recentEvents = Array.from(eventStore.values()).filter(e => 
      e.timestamp.getTime() > windowStart &&
      e.type === event.type &&
      e.context.ip === event.context.ip
    );
    
    if (recentEvents.length < conditions.threshold) {
      return false;
    }
  }
  
  //pattern matching
  if (conditions.pattern) {
    const searchText = `${event.message} ${JSON.stringify(event.context)}`;
    if (!conditions.pattern.test(searchText)) {
      return false;
    }
  }
  
  return true;
}

//trigger alert through configured channels
async function triggerAlert(rule: AlertRule, event: SecurityEvent): Promise<void> {
  const alertData = {
    rule: rule.name,
    event: {
      type: event.type,
      severity: Severity[event.severity],
      message: event.message,
      timestamp: event.timestamp.toISOString(),
      context: event.context,
    },
  };
  
  for (const channel of rule.channels) {
    try {
      await sendAlert(channel, alertData);
    } catch (error) {
      console.error(`Failed to send alert via ${channel.type}:`, error);
    }
  }
}

//send alert through specific channel
async function sendAlert(channel: AlertChannel, data: any): Promise<void> {
  switch (channel.type) {
    case 'console':
      console.error('SECURITY ALERT:', data);
      break;
      
    case 'webhook':
      if (channel.config.url) {
        await fetch(channel.config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Security Alert: ${data.event.type}`,
            attachments: [{
              color: 'danger',
              title: data.rule,
              text: data.event.message,
              fields: [
                { title: 'Severity', value: data.event.severity, short: true },
                { title: 'Time', value: data.event.timestamp, short: true },
                { title: 'IP', value: data.event.context.ip || 'unknown', short: true },
                { title: 'User', value: data.event.context.userId || 'anonymous', short: true },
              ],
            }],
          }),
        });
      }
      break;
      
    case 'email':
      //integrate with your email service
      console.log('Email alert would be sent to:', channel.config.recipients);
      break;
      
    case 'database':
      //store alert in database for review
      console.log('Alert stored in database:', data);
      break;
  }
}

//security metrics and statistics
export function getSecurityMetrics(timeWindow: number = 24 * 60 * 60 * 1000): {
  totalEvents: number;
  eventsBySeverity: Record<string, number>;
  eventsByType: Record<string, number>;
  topAttackers: Array<{ ip: string; events: number }>;
  unresolvedEvents: number;
  alertsTriggered: number;
} {
  const windowStart = Date.now() - timeWindow;
  const recentEvents = Array.from(eventStore.values()).filter(e => 
    e.timestamp.getTime() > windowStart
  );
  
  const eventsBySeverity: Record<string, number> = {};
  const eventsByType: Record<string, number> = {};
  const ipCounts: Record<string, number> = {};
  
  recentEvents.forEach(event => {
    //severity counts
    const severityName = Severity[event.severity];
    eventsBySeverity[severityName] = (eventsBySeverity[severityName] || 0) + 1;
    
    //type counts
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    
    //ip counts
    const ip = event.context.ip || 'unknown';
    ipCounts[ip] = (ipCounts[ip] || 0) + 1;
  });
  
  const topAttackers = Object.entries(ipCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([ip, events]) => ({ ip, events }));
  
  const unresolvedEvents = recentEvents.filter(e => !e.resolved).length;
  
  return {
    totalEvents: recentEvents.length,
    eventsBySeverity,
    eventsByType,
    topAttackers,
    unresolvedEvents,
    alertsTriggered: suppressedAlerts.size, //approximate
  };
}

//resolve security event
export function resolveSecurityEvent(
  eventId: string, 
  resolvedBy: string, 
  notes?: string
): boolean {
  const event = eventStore.get(eventId);
  if (!event) return false;
  
  event.resolved = true;
  event.resolvedAt = new Date();
  event.resolvedBy = resolvedBy;
  event.notes = notes;
  
  return true;
}

//get security events with filtering
export function getSecurityEvents(filters: {
  type?: SecurityEventType;
  severity?: Severity;
  resolved?: boolean;
  since?: Date;
  limit?: number;
}): SecurityEvent[] {
  let events = Array.from(eventStore.values());
  
  if (filters.type) {
    events = events.filter(e => e.type === filters.type);
  }
  
  if (filters.severity) {
    events = events.filter(e => e.severity === filters.severity);
  }
  
  if (filters.resolved !== undefined) {
    events = events.filter(e => e.resolved === filters.resolved);
  }
  
  if (filters.since) {
    events = events.filter(e => e.timestamp >= filters.since!);
  }
  
  //sort by timestamp (newest first)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  if (filters.limit) {
    events = events.slice(0, filters.limit);
  }
  
  return events;
}

//automated threat detection
export function detectThreats(): {
  suspiciousIPs: string[];
  anomalousPatterns: string[];
  recommendations: string[];
} {
  const recentEvents = getSecurityEvents({
    since: new Date(Date.now() - 60 * 60 * 1000), //last hour
  });
  
  const suspiciousIPs: string[] = [];
  const anomalousPatterns: string[] = [];
  const recommendations: string[] = [];
  
  //detect suspicious ips
  const ipEventCounts: Record<string, number> = {};
  recentEvents.forEach(event => {
    const ip = event.context.ip;
    if (ip) {
      ipEventCounts[ip] = (ipEventCounts[ip] || 0) + 1;
    }
  });
  
  Object.entries(ipEventCounts).forEach(([ip, count]) => {
    if (count > 50) { //threshold for suspicious activity
      suspiciousIPs.push(ip);
    }
  });
  
  //detect anomalous patterns
  const failureRates = calculateFailureRates(recentEvents);
  if (failureRates.login > 0.8) {
    anomalousPatterns.push('High login failure rate detected');
  }
  
  //generate recommendations
  if (suspiciousIPs.length > 0) {
    recommendations.push(`Consider blocking ${suspiciousIPs.length} suspicious IP(s)`);
  }
  
  if (anomalousPatterns.length > 0) {
    recommendations.push('Review recent security events for potential attacks');
  }
  
  return {
    suspiciousIPs,
    anomalousPatterns,
    recommendations,
  };
}

//calculate failure rates for different types of events
function calculateFailureRates(events: SecurityEvent[]): Record<string, number> {
  const loginAttempts = events.filter(e => 
    e.type === SecurityEventType.LOGIN_SUCCESS || 
    e.type === SecurityEventType.LOGIN_FAILURE
  );
  
  const loginFailures = events.filter(e => 
    e.type === SecurityEventType.LOGIN_FAILURE
  );
  
  return {
    login: loginAttempts.length > 0 ? loginFailures.length / loginAttempts.length : 0,
  };
}

//cleanup old events and suppressed alerts
export function cleanupSecurityData(): void {
  const maxAge = 30 * 24 * 60 * 60 * 1000; //30 days
  const cutoff = Date.now() - maxAge;
  
  //cleanup old events
  for (const [id, event] of eventStore.entries()) {
    if (event.timestamp.getTime() < cutoff) {
      eventStore.delete(id);
    }
  }
  
  //cleanup expired suppressions
  for (const [key, expiry] of suppressedAlerts.entries()) {
    if (Date.now() > expiry) {
      suppressedAlerts.delete(key);
    }
  }
}

//initialize monitoring system
export function initializeSecurityMonitoring(): void {
  initializeAlertRules();
  
  //setup periodic cleanup
  setInterval(cleanupSecurityData, 60 * 60 * 1000); //hourly
  
  console.log('Security monitoring system initialized');
}

//helper to create security context from API request
export function createSecurityContext(context: APIContext): SecurityEvent['context'] {
  return {
    ip: context.clientAddress,
    userAgent: context.request.headers.get('user-agent') || undefined,
    userId: context.locals.user?.userId?.toString(),
    sessionId: context.locals.session?.id,
    path: context.url.pathname,
    method: context.request.method,
  };
}