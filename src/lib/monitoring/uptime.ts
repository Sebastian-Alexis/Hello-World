//comprehensive uptime monitoring with incident response workflows
//monitors service availability, tracks downtime, and manages incident lifecycle

export enum ServiceStatus {
  OPERATIONAL = 'operational',
  DEGRADED = 'degraded',
  PARTIAL_OUTAGE = 'partial_outage',
  MAJOR_OUTAGE = 'major_outage',
  MAINTENANCE = 'maintenance',
}

export enum IncidentStatus {
  INVESTIGATING = 'investigating',
  IDENTIFIED = 'identified',
  MONITORING = 'monitoring',
  RESOLVED = 'resolved',
}

export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

interface UptimeCheck {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  expectedStatus: number[];
  expectedContent?: string;
  timeout: number;
  interval: number; // milliseconds
  retries: number;
  enabled: boolean;
  tags: string[];
  locations: string[]; // monitoring locations
  metadata: Record<string, any>;
}

interface UptimeResult {
  checkId: string;
  timestamp: number;
  success: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  location: string;
  details: Record<string, any>;
}

interface ServiceMetrics {
  uptime: number; // percentage
  availability: number; // percentage
  avgResponseTime: number;
  responseTimeP95: number;
  responseTimeP99: number;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  lastCheck: number;
  lastSuccess: number;
  lastFailure: number;
  mttr: number; // mean time to recovery
  mtbf: number; // mean time between failures
}

interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affectedServices: string[];
  startTime: number;
  endTime?: number;
  duration?: number;
  createdBy: string;
  assignedTo?: string;
  timeline: IncidentUpdate[];
  metadata: Record<string, any>;
  tags: string[];
  autoCreated: boolean;
  rootCause?: string;
  resolution?: string;
}

interface IncidentUpdate {
  id: string;
  timestamp: number;
  status: IncidentStatus;
  message: string;
  author: string;
  type: 'status_change' | 'update' | 'resolution' | 'postmortem';
}

interface UptimeConfig {
  enabled: boolean;
  defaultInterval: number;
  defaultTimeout: number;
  maxRetries: number;
  locations: string[];
  incidentThreshold: number; // consecutive failures to create incident
  recoveryThreshold: number; // consecutive successes to resolve incident
  endpoints: {
    status: string;
    incidents: string;
    metrics: string;
  };
}

interface MaintenanceWindow {
  id: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  affectedServices: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: string;
  notifications: boolean;
}

class UptimeMonitor {
  private checks = new Map<string, UptimeCheck>();
  private results = new Map<string, UptimeResult[]>(); // checkId -> results
  private metrics = new Map<string, ServiceMetrics>();
  private incidents = new Map<string, Incident>();
  private maintenanceWindows = new Map<string, MaintenanceWindow>();
  private config: UptimeConfig;
  private checkTimers = new Map<string, NodeJS.Timeout>();
  private consecutiveFailures = new Map<string, number>();
  private isInitialized = false;

  constructor(config: Partial<UptimeConfig> = {}) {
    this.config = {
      enabled: true,
      defaultInterval: 60000, // 1 minute
      defaultTimeout: 30000, // 30 seconds
      maxRetries: 3,
      locations: ['local'], // in production, use multiple geographic locations
      incidentThreshold: 3, // 3 consecutive failures
      recoveryThreshold: 2, // 2 consecutive successes
      endpoints: {
        status: '/api/monitoring/status',
        incidents: '/api/monitoring/incidents',
        metrics: '/api/monitoring/uptime',
      },
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) return;

    //register default checks
    this.registerDefaultChecks();

    //start periodic cleanup
    setInterval(() => {
      this.cleanupOldResults();
    }, 600000); // every 10 minutes

    this.isInitialized = true;
    console.log('Uptime Monitor initialized');
  }

  private registerDefaultChecks(): void {
    //main site check
    this.addCheck({
      id: 'main-site',
      name: 'Main Website',
      url: '/',
      method: 'GET',
      expectedStatus: [200],
      timeout: 10000,
      interval: 60000, // 1 minute
      retries: 2,
      enabled: true,
      tags: ['website', 'critical'],
      locations: this.config.locations,
      metadata: { critical: true },
    });

    //api health check
    this.addCheck({
      id: 'api-health',
      name: 'API Health Endpoint',
      url: '/api/health',
      method: 'GET',
      expectedStatus: [200],
      timeout: 5000,
      interval: 30000, // 30 seconds
      retries: 1,
      enabled: true,
      tags: ['api', 'health'],
      locations: this.config.locations,
      metadata: { critical: true },
    });

    //database connectivity
    this.addCheck({
      id: 'database-health',
      name: 'Database Health',
      url: '/api/health/database',
      method: 'GET',
      expectedStatus: [200],
      timeout: 5000,
      interval: 60000, // 1 minute
      retries: 2,
      enabled: true,
      tags: ['database', 'infrastructure'],
      locations: this.config.locations,
      metadata: { critical: true },
    });

    //portfolio api
    this.addCheck({
      id: 'portfolio-api',
      name: 'Portfolio API',
      url: '/api/portfolio',
      method: 'GET',
      expectedStatus: [200],
      timeout: 10000,
      interval: 300000, // 5 minutes
      retries: 1,
      enabled: true,
      tags: ['api', 'portfolio'],
      locations: this.config.locations,
      metadata: { critical: false },
    });

    //blog api
    this.addCheck({
      id: 'blog-api',
      name: 'Blog API',
      url: '/api/blog',
      method: 'GET',
      expectedStatus: [200],
      timeout: 10000,
      interval: 300000, // 5 minutes
      retries: 1,
      enabled: true,
      tags: ['api', 'blog'],
      locations: this.config.locations,
      metadata: { critical: false },
    });
  }

  //check management
  public addCheck(check: UptimeCheck): void {
    this.checks.set(check.id, check);
    this.consecutiveFailures.set(check.id, 0);
    
    if (check.enabled) {
      this.startMonitoring(check.id);
    }

    console.log(`Uptime check added: ${check.name}`);
  }

  public removeCheck(checkId: string): boolean {
    const check = this.checks.get(checkId);
    if (!check) return false;

    this.stopMonitoring(checkId);
    this.checks.delete(checkId);
    this.results.delete(checkId);
    this.metrics.delete(checkId);
    this.consecutiveFailures.delete(checkId);

    console.log(`Uptime check removed: ${checkId}`);
    return true;
  }

  public updateCheck(checkId: string, updates: Partial<UptimeCheck>): boolean {
    const check = this.checks.get(checkId);
    if (!check) return false;

    const wasEnabled = check.enabled;
    Object.assign(check, updates);

    //restart monitoring if interval or enabled status changed
    if (updates.interval !== undefined || updates.enabled !== undefined) {
      if (wasEnabled) this.stopMonitoring(checkId);
      if (check.enabled) this.startMonitoring(checkId);
    }

    console.log(`Uptime check updated: ${check.name}`);
    return true;
  }

  //monitoring control
  private startMonitoring(checkId: string): void {
    const check = this.checks.get(checkId);
    if (!check || !check.enabled) return;

    //immediate check
    this.performCheck(checkId).catch(console.error);

    //schedule recurring checks
    const timer = setInterval(() => {
      this.performCheck(checkId).catch(console.error);
    }, check.interval);

    this.checkTimers.set(checkId, timer);
    console.log(`Started monitoring: ${check.name} (${check.interval}ms interval)`);
  }

  private stopMonitoring(checkId: string): void {
    const timer = this.checkTimers.get(checkId);
    if (timer) {
      clearInterval(timer);
      this.checkTimers.delete(checkId);
      
      const check = this.checks.get(checkId);
      console.log(`Stopped monitoring: ${check?.name || checkId}`);
    }
  }

  //check execution
  private async performCheck(checkId: string): Promise<void> {
    const check = this.checks.get(checkId);
    if (!check) return;

    //skip if in maintenance window
    if (this.isInMaintenanceWindow(checkId)) {
      return;
    }

    for (const location of check.locations) {
      const result = await this.executeCheck(check, location);
      this.recordResult(checkId, result);
      this.updateMetrics(checkId);
      
      //handle incidents
      this.handleIncidents(checkId, result);
    }
  }

  private async executeCheck(check: UptimeCheck, location: string): Promise<UptimeResult> {
    const startTime = performance.now();
    const result: UptimeResult = {
      checkId: check.id,
      timestamp: Date.now(),
      success: false,
      responseTime: 0,
      location,
      details: {},
    };

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= check.retries) {
      try {
        const url = check.url.startsWith('http') ? check.url : 
                   `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4321'}${check.url}`;

        const response = await fetch(url, {
          method: check.method,
          headers: check.headers,
          body: check.body,
          signal: AbortSignal.timeout(check.timeout),
        });

        result.statusCode = response.status;
        result.responseTime = performance.now() - startTime;

        //check status code
        if (check.expectedStatus.includes(response.status)) {
          //check content if specified
          if (check.expectedContent) {
            const content = await response.text();
            if (content.includes(check.expectedContent)) {
              result.success = true;
            } else {
              result.details.contentMismatch = true;
              result.details.expectedContent = check.expectedContent;
              result.details.actualContent = content.substring(0, 200);
            }
          } else {
            result.success = true;
          }
        } else {
          result.details.unexpectedStatus = true;
          result.details.expectedStatus = check.expectedStatus;
          result.details.actualStatus = response.status;
        }

        break; // successful request, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;
        
        if (attempt <= check.retries) {
          //wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    if (!result.success && lastError) {
      result.error = lastError.message;
      result.responseTime = performance.now() - startTime;
      result.details.attempts = attempt;
    }

    return result;
  }

  private recordResult(checkId: string, result: UptimeResult): void {
    const results = this.results.get(checkId) || [];
    results.push(result);

    //keep only last 1000 results per check
    if (results.length > 1000) {
      results.shift();
    }

    this.results.set(checkId, results);
  }

  private updateMetrics(checkId: string): void {
    const results = this.results.get(checkId) || [];
    if (results.length === 0) return;

    const now = Date.now();
    const last24h = results.filter(r => now - r.timestamp < 86400000); // 24 hours
    const last7d = results.filter(r => now - r.timestamp < 604800000); // 7 days

    const successfulChecks = last24h.filter(r => r.success).length;
    const failedChecks = last24h.length - successfulChecks;
    const uptime = last24h.length > 0 ? (successfulChecks / last24h.length) * 100 : 100;

    //calculate response time percentiles
    const responseTimes = last24h.filter(r => r.success).map(r => r.responseTime).sort((a, b) => a - b);
    const avgResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length : 0;
    
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const responseTimeP95 = responseTimes[p95Index] || 0;
    const responseTimeP99 = responseTimes[p99Index] || 0;

    //calculate MTTR and MTBF
    const incidents = this.getIncidentsForCheck(checkId);
    const resolvedIncidents = incidents.filter(i => i.status === IncidentStatus.RESOLVED && i.duration);
    const mttr = resolvedIncidents.length > 0 ? 
      resolvedIncidents.reduce((sum, i) => sum + (i.duration || 0), 0) / resolvedIncidents.length : 0;

    //MTBF calculation (simplified)
    const mtbf = incidents.length > 1 ? 
      (now - incidents[0].startTime) / (incidents.length - 1) : 0;

    const metrics: ServiceMetrics = {
      uptime,
      availability: uptime, // same as uptime for simplicity
      avgResponseTime,
      responseTimeP95,
      responseTimeP99,
      totalChecks: last24h.length,
      successfulChecks,
      failedChecks,
      lastCheck: results[results.length - 1]?.timestamp || 0,
      lastSuccess: results.filter(r => r.success).pop()?.timestamp || 0,
      lastFailure: results.filter(r => !r.success).pop()?.timestamp || 0,
      mttr,
      mtbf,
    };

    this.metrics.set(checkId, metrics);
  }

  //incident management
  private handleIncidents(checkId: string, result: UptimeResult): void {
    const check = this.checks.get(checkId);
    if (!check) return;

    const currentFailures = this.consecutiveFailures.get(checkId) || 0;

    if (result.success) {
      //check for recovery
      if (currentFailures >= this.config.incidentThreshold) {
        //we had an incident, check if we should resolve it
        const activeIncident = this.getActiveIncidentForCheck(checkId);
        if (activeIncident && currentFailures < this.config.recoveryThreshold) {
          this.resolveIncident(activeIncident.id, 'auto-recovery', 'Service has recovered');
        }
      }
      this.consecutiveFailures.set(checkId, 0);
    } else {
      //increment failures
      const newFailures = currentFailures + 1;
      this.consecutiveFailures.set(checkId, newFailures);

      //create incident if threshold reached
      if (newFailures >= this.config.incidentThreshold) {
        const existingIncident = this.getActiveIncidentForCheck(checkId);
        if (!existingIncident) {
          this.createIncident({
            title: `${check.name} is down`,
            description: `Service ${check.name} has failed ${newFailures} consecutive health checks. Last error: ${result.error || 'Unknown error'}`,
            severity: check.metadata.critical ? IncidentSeverity.CRITICAL : IncidentSeverity.HIGH,
            affectedServices: [checkId],
            createdBy: 'uptime-monitor',
            autoCreated: true,
            tags: check.tags,
            metadata: {
              checkId,
              consecutiveFailures: newFailures,
              lastError: result.error,
              lastResponseTime: result.responseTime,
            },
          });
        }
      }
    }
  }

  private createIncident(incidentData: Partial<Incident>): string {
    const incidentId = this.generateId('incident');
    const now = Date.now();

    const incident: Incident = {
      id: incidentId,
      title: incidentData.title || 'Service Incident',
      description: incidentData.description || '',
      status: IncidentStatus.INVESTIGATING,
      severity: incidentData.severity || IncidentSeverity.MEDIUM,
      affectedServices: incidentData.affectedServices || [],
      startTime: now,
      createdBy: incidentData.createdBy || 'system',
      timeline: [{
        id: this.generateId('update'),
        timestamp: now,
        status: IncidentStatus.INVESTIGATING,
        message: 'Incident created automatically by uptime monitor',
        author: 'uptime-monitor',
        type: 'status_change',
      }],
      metadata: incidentData.metadata || {},
      tags: incidentData.tags || [],
      autoCreated: incidentData.autoCreated || false,
    };

    this.incidents.set(incidentId, incident);

    //trigger alert
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('incident-created', { detail: incident }));
    }

    console.log(`Incident created: ${incident.title} (${incidentId})`);
    return incidentId;
  }

  private resolveIncident(incidentId: string, resolvedBy: string, resolution: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident || incident.status === IncidentStatus.RESOLVED) return false;

    const now = Date.now();
    incident.status = IncidentStatus.RESOLVED;
    incident.endTime = now;
    incident.duration = now - incident.startTime;
    incident.resolution = resolution;

    incident.timeline.push({
      id: this.generateId('update'),
      timestamp: now,
      status: IncidentStatus.RESOLVED,
      message: resolution,
      author: resolvedBy,
      type: 'resolution',
    });

    //trigger alert
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('incident-resolved', { detail: incident }));
    }

    console.log(`Incident resolved: ${incident.title} (${incidentId})`);
    return true;
  }

  private getActiveIncidentForCheck(checkId: string): Incident | null {
    for (const incident of this.incidents.values()) {
      if (
        incident.affectedServices.includes(checkId) &&
        incident.status !== IncidentStatus.RESOLVED
      ) {
        return incident;
      }
    }
    return null;
  }

  private getIncidentsForCheck(checkId: string): Incident[] {
    return Array.from(this.incidents.values()).filter(incident =>
      incident.affectedServices.includes(checkId)
    );
  }

  //maintenance windows
  public createMaintenanceWindow(maintenance: Omit<MaintenanceWindow, 'id' | 'status'>): string {
    const id = this.generateId('maintenance');
    const window: MaintenanceWindow = {
      ...maintenance,
      id,
      status: 'scheduled',
    };

    this.maintenanceWindows.set(id, window);
    console.log(`Maintenance window created: ${window.name} (${id})`);
    return id;
  }

  private isInMaintenanceWindow(checkId: string): boolean {
    const now = Date.now();
    
    for (const window of this.maintenanceWindows.values()) {
      if (
        window.status === 'in_progress' &&
        window.affectedServices.includes(checkId) &&
        window.startTime <= now &&
        window.endTime >= now
      ) {
        return true;
      }
    }
    
    return false;
  }

  //status page data
  public getStatusPageData(): {
    overallStatus: ServiceStatus;
    services: Array<{
      id: string;
      name: string;
      status: ServiceStatus;
      uptime: number;
      responseTime: number;
      lastIncident?: number;
    }>;
    incidents: Incident[];
    maintenance: MaintenanceWindow[];
    lastUpdated: number;
  } {
    const services = Array.from(this.checks.values()).map(check => {
      const metrics = this.metrics.get(check.id);
      const activeIncident = this.getActiveIncidentForCheck(check.id);
      
      let status = ServiceStatus.OPERATIONAL;
      if (activeIncident) {
        switch (activeIncident.severity) {
          case IncidentSeverity.CRITICAL:
            status = ServiceStatus.MAJOR_OUTAGE;
            break;
          case IncidentSeverity.HIGH:
            status = ServiceStatus.PARTIAL_OUTAGE;
            break;
          case IncidentSeverity.MEDIUM:
            status = ServiceStatus.DEGRADED;
            break;
        }
      } else if (metrics && metrics.uptime < 99) {
        status = ServiceStatus.DEGRADED;
      }

      //check for maintenance
      if (this.isInMaintenanceWindow(check.id)) {
        status = ServiceStatus.MAINTENANCE;
      }

      const lastIncident = this.getIncidentsForCheck(check.id)
        .filter(i => i.status === IncidentStatus.RESOLVED)
        .sort((a, b) => b.startTime - a.startTime)[0];

      return {
        id: check.id,
        name: check.name,
        status,
        uptime: metrics?.uptime || 100,
        responseTime: metrics?.avgResponseTime || 0,
        lastIncident: lastIncident?.startTime,
      };
    });

    //determine overall status
    let overallStatus = ServiceStatus.OPERATIONAL;
    const criticalServices = services.filter(s => 
      this.checks.get(s.id)?.metadata.critical === true
    );

    if (criticalServices.some(s => s.status === ServiceStatus.MAJOR_OUTAGE)) {
      overallStatus = ServiceStatus.MAJOR_OUTAGE;
    } else if (criticalServices.some(s => s.status === ServiceStatus.PARTIAL_OUTAGE)) {
      overallStatus = ServiceStatus.PARTIAL_OUTAGE;
    } else if (services.some(s => s.status === ServiceStatus.DEGRADED)) {
      overallStatus = ServiceStatus.DEGRADED;
    } else if (services.some(s => s.status === ServiceStatus.MAINTENANCE)) {
      overallStatus = ServiceStatus.MAINTENANCE;
    }

    //get recent incidents
    const recentIncidents = Array.from(this.incidents.values())
      .filter(i => Date.now() - i.startTime < 7 * 24 * 60 * 60 * 1000) // last 7 days
      .sort((a, b) => b.startTime - a.startTime);

    //get active maintenance windows
    const activeMaintenance = Array.from(this.maintenanceWindows.values())
      .filter(m => m.status === 'scheduled' || m.status === 'in_progress')
      .sort((a, b) => a.startTime - b.startTime);

    return {
      overallStatus,
      services,
      incidents: recentIncidents,
      maintenance: activeMaintenance,
      lastUpdated: Date.now(),
    };
  }

  //utility methods
  private generateId(prefix: string = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupOldResults(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days

    for (const [checkId, results] of this.results.entries()) {
      const filtered = results.filter(r => r.timestamp > cutoff);
      this.results.set(checkId, filtered);
    }

    //cleanup old incidents (keep for 30 days)
    const incidentCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    for (const [id, incident] of this.incidents.entries()) {
      if (incident.status === IncidentStatus.RESOLVED && incident.endTime && incident.endTime < incidentCutoff) {
        this.incidents.delete(id);
      }
    }
  }

  //public api
  public getCheck(checkId: string): UptimeCheck | null {
    return this.checks.get(checkId) || null;
  }

  public getAllChecks(): UptimeCheck[] {
    return Array.from(this.checks.values());
  }

  public getMetrics(checkId: string): ServiceMetrics | null {
    return this.metrics.get(checkId) || null;
  }

  public getAllMetrics(): Record<string, ServiceMetrics> {
    return Object.fromEntries(this.metrics);
  }

  public getIncident(incidentId: string): Incident | null {
    return this.incidents.get(incidentId) || null;
  }

  public getAllIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  public getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values()).filter(i => i.status !== IncidentStatus.RESOLVED);
  }

  public updateIncident(incidentId: string, update: IncidentUpdate): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    incident.timeline.push(update);
    incident.status = update.status;
    
    if (update.status === IncidentStatus.RESOLVED) {
      incident.endTime = update.timestamp;
      incident.duration = update.timestamp - incident.startTime;
    }

    return true;
  }

  public shutdown(): void {
    //stop all monitoring
    for (const checkId of this.checks.keys()) {
      this.stopMonitoring(checkId);
    }

    this.isInitialized = false;
    console.log('Uptime Monitor shutdown');
  }
}

//global uptime monitor
export const uptimeMonitor = new UptimeMonitor({
  enabled: true,
  defaultInterval: 60000,
  incidentThreshold: 3,
  recoveryThreshold: 2,
});

//convenience functions
export const addUptimeCheck = (check: UptimeCheck) => uptimeMonitor.addCheck(check);
export const getStatusPage = () => uptimeMonitor.getStatusPageData();
export const createIncident = (data: Partial<Incident>) => uptimeMonitor.createIncident(data);

export { UptimeMonitor };
export type { UptimeCheck, UptimeResult, ServiceMetrics, Incident, MaintenanceWindow };