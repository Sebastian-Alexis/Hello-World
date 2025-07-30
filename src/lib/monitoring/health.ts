//comprehensive health check system with dependency monitoring
//provides service health status, dependency checks, and system diagnostics

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

interface HealthCheck {
  name: string;
  description: string;
  check: () => Promise<HealthCheckResult>;
  timeout: number;
  critical: boolean;
  interval?: number;
  tags: string[];
}

interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  details?: Record<string, any>;
  duration: number;
  timestamp: number;
}

interface SystemHealth {
  status: HealthStatus;
  timestamp: number;
  duration: number;
  checks: Record<string, HealthCheckResult>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_failures: number;
  };
  metadata: {
    version: string;
    environment: string;
    uptime: number;
    hostname?: string;
  };
}

interface HealthConfig {
  enabled: boolean;
  timeout: number;
  interval: number;
  endpoint: string;
  retries: number;
  criticalOnly: boolean;
}

class HealthMonitor {
  private checks = new Map<string, HealthCheck>();
  private results = new Map<string, HealthCheckResult>();
  private config: HealthConfig;
  private intervalTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<HealthConfig> = {}) {
    this.config = {
      enabled: true,
      timeout: 5000,
      interval: 30000, // 30 seconds
      endpoint: '/api/monitoring/health',
      retries: 3,
      criticalOnly: false,
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) return;

    //register default health checks
    this.registerDefaultChecks();

    //start periodic health checks
    if (this.config.interval > 0) {
      this.intervalTimer = setInterval(() => {
        this.runAllChecks().catch(console.error);
      }, this.config.interval);
    }

    this.isInitialized = true;
    console.log('Health Monitor initialized');
  }

  private registerDefaultChecks(): void {
    //memory health check
    this.registerCheck({
      name: 'memory',
      description: 'JavaScript heap memory usage',
      timeout: 1000,
      critical: true,
      tags: ['system', 'memory'],
      check: async () => {
        const startTime = performance.now();
        
        if (typeof performance === 'undefined' || !(performance as any).memory) {
          return {
            status: HealthStatus.UNKNOWN,
            message: 'Memory information not available',
            duration: performance.now() - startTime,
            timestamp: Date.now(),
          };
        }

        const memory = (performance as any).memory;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        let status = HealthStatus.HEALTHY;
        let message = `Memory usage: ${usagePercent.toFixed(1)}%`;

        if (usagePercent > 90) {
          status = HealthStatus.UNHEALTHY;
          message += ' - Critical memory usage';
        } else if (usagePercent > 75) {
          status = HealthStatus.DEGRADED;
          message += ' - High memory usage';
        }

        return {
          status,
          message,
          details: {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            usagePercent,
          },
          duration: performance.now() - startTime,
          timestamp: Date.now(),
        };
      },
    });

    //database connectivity check
    this.registerCheck({
      name: 'database',
      description: 'Database connectivity and responsiveness',
      timeout: 5000,
      critical: true,
      tags: ['database', 'connectivity'],
      check: async () => {
        const startTime = performance.now();
        
        try {
          //simple database ping
          const response = await fetch('/api/health/database', {
            method: 'GET',
            signal: AbortSignal.timeout(this.config.timeout),
          });

          const responseTime = performance.now() - startTime;
          const data = await response.json();

          let status = HealthStatus.HEALTHY;
          let message = `Database responsive (${responseTime.toFixed(0)}ms)`;

          if (responseTime > 2000) {
            status = HealthStatus.DEGRADED;
            message = `Database slow response (${responseTime.toFixed(0)}ms)`;
          }

          if (!response.ok) {
            status = HealthStatus.UNHEALTHY;
            message = `Database error: ${data.error || 'Unknown error'}`;
          }

          return {
            status,
            message,
            details: {
              responseTime,
              connected: response.ok,
              ...data,
            },
            duration: responseTime,
            timestamp: Date.now(),
          };
        } catch (error) {
          return {
            status: HealthStatus.UNHEALTHY,
            message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { error: error instanceof Error ? error.message : error },
            duration: performance.now() - startTime,
            timestamp: Date.now(),
          };
        }
      },
    });

    //api endpoints health check
    this.registerCheck({
      name: 'api_endpoints',
      description: 'Critical API endpoints availability',
      timeout: 5000,
      critical: false,
      tags: ['api', 'endpoints'],
      check: async () => {
        const startTime = performance.now();
        const endpoints = [
          '/api/portfolio',
          '/api/blog',
          '/api/analytics/track',
        ];

        const results = await Promise.allSettled(
          endpoints.map(async (endpoint) => {
            const response = await fetch(endpoint, {
              method: 'HEAD',
              signal: AbortSignal.timeout(2000),
            });
            return { endpoint, ok: response.ok, status: response.status };
          })
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
        const failed = results.length - successful;

        let status = HealthStatus.HEALTHY;
        let message = `${successful}/${results.length} endpoints healthy`;

        if (failed > 0) {
          status = failed === results.length ? HealthStatus.UNHEALTHY : HealthStatus.DEGRADED;
          message = `${failed}/${results.length} endpoints failing`;
        }

        return {
          status,
          message,
          details: {
            endpoints: results.map(r => ({
              endpoint: r.status === 'fulfilled' ? r.value.endpoint : 'unknown',
              status: r.status === 'fulfilled' ? r.value.status : 0,
              ok: r.status === 'fulfilled' ? r.value.ok : false,
              error: r.status === 'rejected' ? r.reason.message : null,
            })),
            successful,
            failed,
            total: results.length,
          },
          duration: performance.now() - startTime,
          timestamp: Date.now(),
        };
      },
    });

    //external services check
    this.registerCheck({
      name: 'external_services',
      description: 'External service dependencies',
      timeout: 10000,
      critical: false,
      tags: ['external', 'dependencies'],
      check: async () => {
        const startTime = performance.now();
        const services = [
          { name: 'CDN', url: 'https://cdnjs.cloudflare.com', timeout: 3000 },
        ];

        const results = await Promise.allSettled(
          services.map(async (service) => {
            try {
              const response = await fetch(service.url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(service.timeout),
              });
              return { ...service, ok: response.ok, status: response.status };
            } catch (error) {
              return { ...service, ok: false, status: 0, error: error instanceof Error ? error.message : 'Unknown' };
            }
          })
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
        const failed = results.length - successful;

        let status = HealthStatus.HEALTHY;
        let message = `${successful}/${results.length} external services available`;

        if (failed > 0) {
          status = failed === results.length ? HealthStatus.UNHEALTHY : HealthStatus.DEGRADED;
          message = `${failed}/${results.length} external services unavailable`;
        }

        return {
          status,
          message,
          details: {
            services: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason }),
            successful,
            failed,
            total: results.length,
          },
          duration: performance.now() - startTime,
          timestamp: Date.now(),
        };
      },
    });

    //performance health check
    this.registerCheck({
      name: 'performance',
      description: 'Application performance metrics',
      timeout: 2000,
      critical: false,
      tags: ['performance', 'metrics'],
      check: async () => {
        const startTime = performance.now();
        
        //measure a simple operation
        const testStart = performance.now();
        const testArray = Array.from({ length: 10000 }, (_, i) => i);
        const sorted = testArray.sort((a, b) => b - a);
        const operationTime = performance.now() - testStart;

        //get navigation timing if available
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const loadTime = navigation ? navigation.loadEventEnd - navigation.fetchStart : 0;

        let status = HealthStatus.HEALTHY;
        let message = `Performance normal (operation: ${operationTime.toFixed(2)}ms)`;

        if (operationTime > 100) {
          status = HealthStatus.DEGRADED;
          message = `Performance degraded (operation: ${operationTime.toFixed(2)}ms)`;
        }

        if (operationTime > 500) {
          status = HealthStatus.UNHEALTHY;
          message = `Performance critical (operation: ${operationTime.toFixed(2)}ms)`;
        }

        return {
          status,
          message,
          details: {
            operationTime,
            loadTime,
            elementsProcessed: sorted.length,
          },
          duration: performance.now() - startTime,
          timestamp: Date.now(),
        };
      },
    });

    //local storage health check
    this.registerCheck({
      name: 'local_storage',
      description: 'Local storage availability and functionality',
      timeout: 1000,
      critical: false,
      tags: ['storage', 'browser'],
      check: async () => {
        const startTime = performance.now();
        
        if (typeof localStorage === 'undefined') {
          return {
            status: HealthStatus.UNKNOWN,
            message: 'Local storage not available',
            duration: performance.now() - startTime,
            timestamp: Date.now(),
          };
        }

        try {
          const testKey = '_health_check_test';
          const testValue = Date.now().toString();
          
          localStorage.setItem(testKey, testValue);
          const retrieved = localStorage.getItem(testKey);
          localStorage.removeItem(testKey);

          const status = retrieved === testValue ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
          const message = status === HealthStatus.HEALTHY ? 
            'Local storage functional' : 
            'Local storage read/write failed';

          return {
            status,
            message,
            details: {
              available: true,
              writable: true,
              readable: retrieved === testValue,
            },
            duration: performance.now() - startTime,
            timestamp: Date.now(),
          };
        } catch (error) {
          return {
            status: HealthStatus.UNHEALTHY,
            message: `Local storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: {
              available: true,
              error: error instanceof Error ? error.message : error,
            },
            duration: performance.now() - startTime,
            timestamp: Date.now(),
          };
        }
      },
    });
  }

  //register custom health check
  public registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    console.log(`Health check registered: ${check.name}`);
  }

  //unregister health check
  public unregisterCheck(name: string): boolean {
    const removed = this.checks.delete(name);
    if (removed) {
      this.results.delete(name);
      console.log(`Health check unregistered: ${name}`);
    }
    return removed;
  }

  //run single health check
  public async runCheck(name: string): Promise<HealthCheckResult | null> {
    const check = this.checks.get(name);
    if (!check) return null;

    try {
      const result = await Promise.race([
        check.check(),
        new Promise<HealthCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
        ),
      ]);

      this.results.set(name, result);
      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        status: HealthStatus.UNHEALTHY,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : error },
        duration: check.timeout,
        timestamp: Date.now(),
      };

      this.results.set(name, errorResult);
      return errorResult;
    }
  }

  //run all health checks
  public async runAllChecks(): Promise<Record<string, HealthCheckResult>> {
    const checkNames = Array.from(this.checks.keys());
    const results = await Promise.allSettled(
      checkNames.map(name => this.runCheck(name))
    );

    const allResults: Record<string, HealthCheckResult> = {};
    checkNames.forEach((name, index) => {
      const result = results[index];
      if (result.status === 'fulfilled' && result.value) {
        allResults[name] = result.value;
      }
    });

    return allResults;
  }

  //get overall system health
  public async getSystemHealth(): Promise<SystemHealth> {
    const startTime = performance.now();
    const checks = await this.runAllChecks();

    const summary = {
      total: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      critical_failures: 0,
    };

    let overallStatus = HealthStatus.HEALTHY;

    Object.entries(checks).forEach(([name, result]) => {
      summary.total++;

      switch (result.status) {
        case HealthStatus.HEALTHY:
          summary.healthy++;
          break;
        case HealthStatus.DEGRADED:
          summary.degraded++;
          if (overallStatus === HealthStatus.HEALTHY) {
            overallStatus = HealthStatus.DEGRADED;
          }
          break;
        case HealthStatus.UNHEALTHY:
          summary.unhealthy++;
          overallStatus = HealthStatus.UNHEALTHY;
          
          const check = this.checks.get(name);
          if (check?.critical) {
            summary.critical_failures++;
          }
          break;
      }
    });

    //if any critical check fails, system is unhealthy
    if (summary.critical_failures > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      duration: performance.now() - startTime,
      checks,
      summary,
      metadata: {
        version: import.meta.env.APP_VERSION || '1.0.0',
        environment: import.meta.env.MODE,
        uptime: typeof performance !== 'undefined' ? performance.now() : 0,
        hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
      },
    };
  }

  //get specific check result
  public getCheckResult(name: string): HealthCheckResult | null {
    return this.results.get(name) || null;
  }

  //get all check results
  public getAllResults(): Record<string, HealthCheckResult> {
    return Object.fromEntries(this.results);
  }

  //health check summary
  public getHealthSummary(): {
    status: HealthStatus;
    message: string;
    criticalIssues: string[];
    warnings: string[];
    lastChecked: number;
  } {
    const results = this.getAllResults();
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    let overallStatus = HealthStatus.HEALTHY;
    let lastChecked = 0;

    Object.entries(results).forEach(([name, result]) => {
      if (result.timestamp > lastChecked) {
        lastChecked = result.timestamp;
      }

      const check = this.checks.get(name);
      
      if (result.status === HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.UNHEALTHY;
        const message = `${name}: ${result.message}`;
        
        if (check?.critical) {
          criticalIssues.push(message);
        } else {
          warnings.push(message);
        }
      } else if (result.status === HealthStatus.DEGRADED && overallStatus === HealthStatus.HEALTHY) {
        overallStatus = HealthStatus.DEGRADED;
        warnings.push(`${name}: ${result.message}`);
      }
    });

    let message = 'All systems operational';
    if (criticalIssues.length > 0) {
      message = `${criticalIssues.length} critical issue(s) detected`;
    } else if (warnings.length > 0) {
      message = `${warnings.length} warning(s) detected`;
    }

    return {
      status: overallStatus,
      message,
      criticalIssues,
      warnings,
      lastChecked,
    };
  }

  //configuration
  public setConfig(config: Partial<HealthConfig>): void {
    this.config = { ...this.config, ...config };
    
    //restart interval if changed
    if (config.interval !== undefined) {
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
      }
      
      if (this.config.interval > 0) {
        this.intervalTimer = setInterval(() => {
          this.runAllChecks().catch(console.error);
        }, this.config.interval);
      }
    }
  }

  //cleanup
  public shutdown(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
    
    this.checks.clear();
    this.results.clear();
    this.isInitialized = false;
    console.log('Health Monitor shutdown');
  }
}

//global health monitor instance
export const healthMonitor = new HealthMonitor({
  enabled: true,
  interval: 30000, // 30 seconds
  timeout: 5000,
});

//convenience functions
export const runHealthCheck = (name: string) => healthMonitor.runCheck(name);
export const runAllHealthChecks = () => healthMonitor.runAllChecks();
export const getSystemHealth = () => healthMonitor.getSystemHealth();
export const getHealthSummary = () => healthMonitor.getHealthSummary();

//register custom health check
export const registerHealthCheck = (check: HealthCheck) => healthMonitor.registerCheck(check);

export { HealthMonitor };
export type { HealthCheck, HealthCheckResult, SystemHealth, HealthConfig };