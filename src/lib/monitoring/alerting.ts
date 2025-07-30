//comprehensive multi-channel alerting system
//supports email, webhook, sms, and database notifications for critical issues

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

export enum ChannelType {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  DATABASE = 'database',
  CONSOLE = 'console',
  SLACK = 'slack',
  DISCORD = 'discord',
  TEAMS = 'teams',
}

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolvedBy?: string;
  resolvedAt?: number;
  suppressed: boolean;
  suppressedUntil?: number;
  escalationLevel: number;
  retryCount: number;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  channels: ChannelConfig[];
  enabled: boolean;
  tags: string[];
  suppressDuration: number; // minutes
  escalationRules: EscalationRule[];
  metadata: Record<string, any>;
}

interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne' | 'contains' | 'regex';
  threshold: number | string;
  timeWindow: number; // minutes
  evaluationInterval: number; // minutes
  consecutiveFailures: number;
}

interface EscalationRule {
  level: number;
  delay: number; // minutes
  channels: ChannelConfig[];
  condition?: 'unacknowledged' | 'unresolved';
}

interface ChannelConfig {
  type: ChannelType;
  enabled: boolean;
  config: Record<string, any>;
  priority: number;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number; // minutes
    backoffMultiplier: number;
  };
}

interface NotificationPayload {
  alert: Alert;
  rule?: AlertRule;
  isEscalation?: boolean;
  escalationLevel?: number;
  context?: Record<string, any>;
}

interface AlertingConfig {
  enabled: boolean;
  evaluationInterval: number;
  maxActiveAlerts: number;
  defaultSuppressionDuration: number;
  enableEscalation: boolean;
  enableDeduplication: boolean;
  endpoints: {
    alerts: string;
    webhook: string;
  };
}

class AlertingSystem {
  private alerts = new Map<string, Alert>();
  private rules = new Map<string, AlertRule>();
  private channels = new Map<string, ChannelHandler>();
  private config: AlertingConfig;
  private evaluationTimer?: NodeJS.Timeout;
  private escalationTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<AlertingConfig> = {}) {
    this.config = {
      enabled: true,
      evaluationInterval: 60000, // 1 minute
      maxActiveAlerts: 1000,
      defaultSuppressionDuration: 60, // 60 minutes
      enableEscalation: true,
      enableDeduplication: true,
      endpoints: {
        alerts: '/api/monitoring/alerts',
        webhook: '/api/monitoring/webhook',
      },
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) return;

    //register default channels
    this.registerDefaultChannels();

    //register default rules
    this.registerDefaultRules();

    //start evaluation loop
    this.evaluationTimer = setInterval(() => {
      this.evaluateRules().catch(console.error);
    }, this.config.evaluationInterval);

    //start escalation loop
    if (this.config.enableEscalation) {
      this.escalationTimer = setInterval(() => {
        this.processEscalations().catch(console.error);
      }, 60000); // check every minute
    }

    this.isInitialized = true;
    console.log('Alerting System initialized');
  }

  private registerDefaultChannels(): void {
    //console channel
    this.registerChannel('console', new ConsoleChannelHandler());
    
    //webhook channel
    this.registerChannel('webhook', new WebhookChannelHandler());
    
    //email channel
    this.registerChannel('email', new EmailChannelHandler());
    
    //slack channel
    this.registerChannel('slack', new SlackChannelHandler());

    //database channel
    this.registerChannel('database', new DatabaseChannelHandler());
  }

  private registerDefaultRules(): void {
    //critical system errors
    this.addRule({
      id: 'critical-errors',
      name: 'Critical System Errors',
      description: 'Alert on critical system errors and failures',
      condition: {
        metric: 'error.count',
        operator: 'gte',
        threshold: 5,
        timeWindow: 5,
        evaluationInterval: 1,
        consecutiveFailures: 1,
      },
      severity: AlertSeverity.CRITICAL,
      channels: [
        {
          type: ChannelType.EMAIL,
          enabled: true,
          config: { recipients: ['admin@company.com'] },
          priority: 1,
          retryPolicy: { maxRetries: 3, retryDelay: 5, backoffMultiplier: 2 },
        },
        {
          type: ChannelType.SLACK,
          enabled: true,
          config: { channel: '#alerts', webhook: process.env.SLACK_WEBHOOK_URL },
          priority: 1,
          retryPolicy: { maxRetries: 3, retryDelay: 2, backoffMultiplier: 1.5 },
        },
      ],
      enabled: true,
      tags: ['critical', 'errors'],
      suppressDuration: 30,
      escalationRules: [
        {
          level: 1,
          delay: 15, // escalate after 15 minutes if unacknowledged
          channels: [
            {
              type: ChannelType.SMS,
              enabled: true,
              config: { numbers: ['+1234567890'] },
              priority: 1,
              retryPolicy: { maxRetries: 2, retryDelay: 3, backoffMultiplier: 2 },
            },
          ],
          condition: 'unacknowledged',
        },
      ],
      metadata: {},
    });

    //high memory usage
    this.addRule({
      id: 'high-memory-usage',
      name: 'High Memory Usage',
      description: 'Alert when memory usage exceeds threshold',
      condition: {
        metric: 'memory.usage',
        operator: 'gt',
        threshold: 85,
        timeWindow: 10,
        evaluationInterval: 5,
        consecutiveFailures: 2,
      },
      severity: AlertSeverity.WARNING,
      channels: [
        {
          type: ChannelType.WEBHOOK,
          enabled: true,
          config: { url: process.env.MONITORING_WEBHOOK_URL },
          priority: 1,
          retryPolicy: { maxRetries: 2, retryDelay: 5, backoffMultiplier: 1.5 },
        },
      ],
      enabled: true,
      tags: ['performance', 'memory'],
      suppressDuration: 60,
      escalationRules: [],
      metadata: {},
    });

    //api endpoint failures
    this.addRule({
      id: 'api-failures',
      name: 'API Endpoint Failures',
      description: 'Alert on API endpoint failures and high error rates',
      condition: {
        metric: 'api.error_rate',
        operator: 'gt',
        threshold: 0.1, // 10% error rate
        timeWindow: 5,
        evaluationInterval: 2,
        consecutiveFailures: 1,
      },
      severity: AlertSeverity.ERROR,
      channels: [
        {
          type: ChannelType.SLACK,
          enabled: true,
          config: { channel: '#api-alerts' },
          priority: 1,
          retryPolicy: { maxRetries: 3, retryDelay: 3, backoffMultiplier: 2 },
        },
      ],
      enabled: true,
      tags: ['api', 'errors'],
      suppressDuration: 30,
      escalationRules: [],
      metadata: {},
    });
  }

  //alert management
  public createAlert(
    title: string,
    message: string,
    severity: AlertSeverity,
    source: string,
    tags: string[] = [],
    metadata: Record<string, any> = {}
  ): string {
    const alertId = this.generateId();
    
    //check for deduplication
    if (this.config.enableDeduplication) {
      const existing = this.findSimilarAlert(title, source, severity);
      if (existing) {
        //update existing alert instead of creating new one
        existing.updatedAt = Date.now();
        existing.retryCount++;
        return existing.id;
      }
    }

    const alert: Alert = {
      id: alertId,
      title,
      message,
      severity,
      status: AlertStatus.ACTIVE,
      source,
      tags,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      suppressed: false,
      escalationLevel: 0,
      retryCount: 0,
    };

    this.alerts.set(alertId, alert);

    //send notifications
    this.sendNotifications(alert).catch(console.error);

    //limit active alerts
    if (this.alerts.size > this.config.maxActiveAlerts) {
      this.cleanupOldAlerts();
    }

    return alertId;
  }

  private findSimilarAlert(title: string, source: string, severity: AlertSeverity): Alert | null {
    for (const alert of this.alerts.values()) {
      if (
        alert.title === title &&
        alert.source === source &&
        alert.severity === severity &&
        alert.status === AlertStatus.ACTIVE &&
        !alert.suppressed
      ) {
        return alert;
      }
    }
    return null;
  }

  private async sendNotifications(alert: Alert, isEscalation = false): Promise<void> {
    //find matching rules
    const matchingRules = Array.from(this.rules.values()).filter(rule => 
      rule.enabled && this.alertMatchesRule(alert, rule)
    );

    for (const rule of matchingRules) {
      const channels = isEscalation ? 
        rule.escalationRules[alert.escalationLevel]?.channels || [] :
        rule.channels;

      for (const channelConfig of channels) {
        if (!channelConfig.enabled) continue;

        const handler = this.channels.get(channelConfig.type);
        if (!handler) continue;

        try {
          await handler.send({
            alert,
            rule,
            isEscalation,
            escalationLevel: alert.escalationLevel,
          }, channelConfig.config);
        } catch (error) {
          console.error(`Failed to send alert via ${channelConfig.type}:`, error);
          
          //retry logic
          if (alert.retryCount < channelConfig.retryPolicy.maxRetries) {
            setTimeout(() => {
              alert.retryCount++;
              this.sendNotifications(alert, isEscalation).catch(console.error);
            }, channelConfig.retryPolicy.retryDelay * 60000 * 
               Math.pow(channelConfig.retryPolicy.backoffMultiplier, alert.retryCount));
          }
        }
      }
    }
  }

  private alertMatchesRule(alert: Alert, rule: AlertRule): boolean {
    //check severity
    const severityLevels = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.WARNING]: 1,
      [AlertSeverity.ERROR]: 2,
      [AlertSeverity.CRITICAL]: 3,
    };

    if (severityLevels[alert.severity] < severityLevels[rule.severity]) {
      return false;
    }

    //check tags
    if (rule.tags.length > 0) {
      const hasMatchingTag = rule.tags.some(tag => alert.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    return true;
  }

  //rule management
  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`Alert rule added: ${rule.name}`);
  }

  public removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      console.log(`Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  public updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    console.log(`Alert rule updated: ${rule.name}`);
    return true;
  }

  //channel management
  public registerChannel(type: string, handler: ChannelHandler): void {
    this.channels.set(type, handler);
    console.log(`Alert channel registered: ${type}`);
  }

  //alert operations
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== AlertStatus.ACTIVE) return false;

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = Date.now();
    alert.updatedAt = Date.now();

    return true;
  }

  public resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = Date.now();
    alert.updatedAt = Date.now();

    return true;
  }

  public suppressAlert(alertId: string, duration: number): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.suppressed = true;
    alert.suppressedUntil = Date.now() + (duration * 60000);
    alert.updatedAt = Date.now();

    return true;
  }

  //escalation handling
  private async processEscalations(): Promise<void> {
    const now = Date.now();

    for (const alert of this.alerts.values()) {
      if (alert.status !== AlertStatus.ACTIVE || alert.suppressed) continue;

      const matchingRules = Array.from(this.rules.values()).filter(rule => 
        rule.enabled && this.alertMatchesRule(alert, rule)
      );

      for (const rule of matchingRules) {
        if (rule.escalationRules.length === 0) continue;

        const nextEscalation = rule.escalationRules[alert.escalationLevel];
        if (!nextEscalation) continue;

        const escalationTime = alert.createdAt + (nextEscalation.delay * 60000);
        
        if (now >= escalationTime) {
          //check escalation condition
          let shouldEscalate = true;
          
          if (nextEscalation.condition === 'unacknowledged' && alert.status === AlertStatus.ACKNOWLEDGED) {
            shouldEscalate = false;
          }
          
          if (nextEscalation.condition === 'unresolved' && alert.status === AlertStatus.RESOLVED) {
            shouldEscalate = false;
          }

          if (shouldEscalate) {
            alert.escalationLevel++;
            alert.updatedAt = now;
            
            await this.sendNotifications(alert, true);
            
            console.log(`Alert escalated to level ${alert.escalationLevel}: ${alert.title}`);
          }
        }
      }
    }
  }

  //rule evaluation
  private async evaluateRules(): Promise<void> {
    //this would typically fetch metrics from your monitoring system
    //for now, we'll create a placeholder implementation
    
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = await this.evaluateRule(rule);
        
        if (shouldAlert) {
          this.createAlert(
            `Rule triggered: ${rule.name}`,
            rule.description,
            rule.severity,
            'rule-engine',
            rule.tags,
            { ruleId: rule.id, ...rule.metadata }
          );
        }
      } catch (error) {
        console.error(`Failed to evaluate rule ${rule.name}:`, error);
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<boolean> {
    //placeholder implementation
    //in a real system, this would fetch metrics and evaluate conditions
    return false;
  }

  //utility methods
  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.status === AlertStatus.RESOLVED && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
      }
    }
  }

  //public api
  public getAlert(alertId: string): Alert | null {
    return this.alerts.get(alertId) || null;
  }

  public getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => 
      alert.status === AlertStatus.ACTIVE && !alert.suppressed
    );
  }

  public getAlertsByStatus(status: AlertStatus): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.status === status);
  }

  public getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.severity === severity);
  }

  public getAlertStatistics(): {
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    suppressed: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    const stats = {
      total: alerts.length,
      active: 0,
      acknowledged: 0,
      resolved: 0,
      suppressed: 0,
      bySeverity: {
        [AlertSeverity.INFO]: 0,
        [AlertSeverity.WARNING]: 0,
        [AlertSeverity.ERROR]: 0,
        [AlertSeverity.CRITICAL]: 0,
      },
    };

    alerts.forEach(alert => {
      switch (alert.status) {
        case AlertStatus.ACTIVE:
          stats.active++;
          break;
        case AlertStatus.ACKNOWLEDGED:
          stats.acknowledged++;
          break;
        case AlertStatus.RESOLVED:
          stats.resolved++;
          break;
      }

      if (alert.suppressed) {
        stats.suppressed++;
      }

      stats.bySeverity[alert.severity]++;
    });

    return stats;
  }

  public shutdown(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }

    if (this.escalationTimer) {
      clearInterval(this.escalationTimer);
    }

    this.isInitialized = false;
    console.log('Alerting System shutdown');
  }
}

//channel handlers
interface ChannelHandler {
  send(payload: NotificationPayload, config: Record<string, any>): Promise<void>;
}

class ConsoleChannelHandler implements ChannelHandler {
  async send(payload: NotificationPayload): Promise<void> {
    const { alert } = payload;
    const prefix = payload.isEscalation ? `[ESCALATION L${payload.escalationLevel}]` : '[ALERT]';
    
    console.log(`${prefix} [${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);
  }
}

class WebhookChannelHandler implements ChannelHandler {
  async send(payload: NotificationPayload, config: Record<string, any>): Promise<void> {
    const { url, headers = {}, template } = config;
    if (!url) throw new Error('Webhook URL not configured');

    const webhookPayload = template ? 
      this.applyTemplate(template, payload) : 
      this.createDefaultPayload(payload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  private applyTemplate(template: string, payload: NotificationPayload): any {
    //simple template replacement
    return JSON.parse(template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return JSON.stringify(payload.alert[key as keyof Alert] || '');
    }));
  }

  private createDefaultPayload(payload: NotificationPayload): any {
    const { alert, isEscalation, escalationLevel } = payload;
    
    return {
      alert: {
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        status: alert.status,
        source: alert.source,
        tags: alert.tags,
        createdAt: new Date(alert.createdAt).toISOString(),
      },
      isEscalation,
      escalationLevel,
      timestamp: new Date().toISOString(),
    };
  }
}

class EmailChannelHandler implements ChannelHandler {
  async send(payload: NotificationPayload, config: Record<string, any>): Promise<void> {
    const { recipients, subject, template } = config;
    if (!recipients || recipients.length === 0) {
      throw new Error('Email recipients not configured');
    }

    //placeholder - integrate with your email service
    console.log(`Email would be sent to: ${recipients.join(', ')}`);
    console.log(`Subject: ${subject || payload.alert.title}`);
    console.log(`Message: ${payload.alert.message}`);
  }
}

class SlackChannelHandler implements ChannelHandler {
  async send(payload: NotificationPayload, config: Record<string, any>): Promise<void> {
    const { webhook, channel } = config;
    if (!webhook) throw new Error('Slack webhook not configured');

    const { alert, isEscalation, escalationLevel } = payload;
    const color = this.getSeverityColor(alert.severity);
    const prefix = isEscalation ? `🔥 ESCALATION L${escalationLevel}` : '🚨 ALERT';

    const slackPayload = {
      channel,
      text: `${prefix}: ${alert.title}`,
      attachments: [{
        color,
        title: alert.title,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Source', value: alert.source, short: true },
          { title: 'Status', value: alert.status, short: true },
          { title: 'Created', value: new Date(alert.createdAt).toLocaleString(), short: true },
        ],
        footer: 'Monitoring System',
        ts: Math.floor(alert.createdAt / 1000),
      }],
    };

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 'danger';
      case AlertSeverity.ERROR: return 'warning';
      case AlertSeverity.WARNING: return 'warning';
      case AlertSeverity.INFO: return 'good';
      default: return '#cccccc';
    }
  }
}

class DatabaseChannelHandler implements ChannelHandler {
  async send(payload: NotificationPayload): Promise<void> {
    //placeholder - store alert in database
    console.log('Alert would be stored in database:', payload.alert.id);
  }
}

//global alerting system
export const alerting = new AlertingSystem({
  enabled: true,
  evaluationInterval: 60000,
  enableEscalation: true,
  enableDeduplication: true,
});

//convenience functions
export const createAlert = (
  title: string,
  message: string,
  severity: AlertSeverity,
  source: string,
  tags?: string[],
  metadata?: Record<string, any>
) => alerting.createAlert(title, message, severity, source, tags, metadata);

export const acknowledgeAlert = (alertId: string, user: string) => 
  alerting.acknowledgeAlert(alertId, user);

export const resolveAlert = (alertId: string, user: string) => 
  alerting.resolveAlert(alertId, user);

export { AlertingSystem };
export type { Alert, AlertRule, ChannelConfig, NotificationPayload };