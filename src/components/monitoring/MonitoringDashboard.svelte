<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { apm } from '../../lib/monitoring/apm';
  import { logger } from '../../lib/monitoring/logging';
  import { healthMonitor } from '../../lib/monitoring/health';
  import { alerting } from '../../lib/monitoring/alerting';
  import { uptimeMonitor } from '../../lib/monitoring/uptime';
  import { tracing } from '../../lib/monitoring/tracing';

  //dashboard state
  let isLoading = true;
  let error: string | null = null;
  let lastUpdated = Date.now();
  
  //metrics data
  let apmData: any = {};
  let logData: any = {};
  let healthData: any = {};
  let alertData: any = {};
  let uptimeData: any = {};
  let tracingData: any = {};
  
  //refresh settings
  let refreshInterval = 30000; // 30 seconds
  let autoRefresh = true;
  let refreshTimer: NodeJS.Timeout;

  //active filters
  let timeRange = '1h';
  let selectedServices: string[] = [];
  let severityFilter = 'all';

  //dashboard layout
  let viewMode = 'overview'; // 'overview', 'performance', 'errors', 'uptime', 'traces'

  onMount(() => {
    loadDashboardData();
    
    if (autoRefresh) {
      startAutoRefresh();
    }

    //listen for real-time events
    window.addEventListener('apm-alert', handleAPMAlert);
    window.addEventListener('incident-created', handleIncidentCreated);
    window.addEventListener('performance-update', handlePerformanceUpdate);
  });

  onDestroy(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    window.removeEventListener('apm-alert', handleAPMAlert);
    window.removeEventListener('incident-created', handleIncidentCreated);
    window.removeEventListener('performance-update', handlePerformanceUpdate);
  });

  function startAutoRefresh() {
    refreshTimer = setInterval(() => {
      if (autoRefresh) {
        loadDashboardData();
      }
    }, refreshInterval);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  }

  async function loadDashboardData() {
    try {
      isLoading = true;
      error = null;

      //load data from all monitoring systems
      const [apm, logs, health, alerts, uptime, traces] = await Promise.all([
        loadAPMData(),
        loadLogData(),
        loadHealthData(),
        loadAlertData(),
        loadUptimeData(),
        loadTracingData(),
      ]);

      apmData = apm;
      logData = logs;
      healthData = health;
      alertData = alerts;
      uptimeData = uptime;
      tracingData = traces;

      lastUpdated = Date.now();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load monitoring data';
      console.error('Dashboard error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function loadAPMData() {
    const dashboardData = apm.getDashboardData();
    const alerts = apm.getAlerts();
    
    return {
      metrics: dashboardData.metrics,
      transactions: dashboardData.transactions,
      performance: dashboardData.performance,
      errors: dashboardData.errors,
      alerts: alerts.filter(a => !a.resolved),
      summary: {
        responseTime: dashboardData.performance.pageLoadTime,
        errorRate: dashboardData.performance.errorRate,
        memoryUsage: dashboardData.performance.memoryUsage,
        activeTransactions: dashboardData.performance.activeTransactions,
      },
    };
  }

  async function loadLogData() {
    const analytics = logger.getAnalytics(getTimeRangeMs());
    const recentErrors = logger.search({
      levelRange: [4, 5], // ERROR and FATAL
      timeRange: [Date.now() - getTimeRangeMs(), Date.now()],
      limit: 10,
    });

    return {
      analytics,
      recentErrors,
      errorRate: analytics.errorRate,
      totalLogs: analytics.totalLogs,
      logsByLevel: analytics.logsByLevel,
      topSources: analytics.topSources,
    };
  }

  async function loadHealthData() {
    const systemHealth = await healthMonitor.getSystemHealth();
    const summary = healthMonitor.getHealthSummary();
    
    return {
      status: systemHealth.status,
      checks: systemHealth.checks,
      summary: systemHealth.summary,
      criticalIssues: summary.criticalIssues,
      warnings: summary.warnings,
      lastChecked: summary.lastChecked,
    };
  }

  async function loadAlertData() {
    const statistics = alerting.getAlertStatistics();
    const activeAlerts = alerting.getActiveAlerts();
    const criticalAlerts = alerting.getAlertsBySeverity('critical');
    
    return {
      statistics,
      activeAlerts,
      criticalAlerts,
      total: statistics.total,
      active: statistics.active,
      critical: criticalAlerts.length,
    };
  }

  async function loadUptimeData() {
    const statusPage = uptimeMonitor.getStatusPageData();
    const metrics = uptimeMonitor.getAllMetrics();
    
    return {
      overallStatus: statusPage.overallStatus,
      services: statusPage.services,
      incidents: statusPage.incidents.slice(0, 5), // last 5 incidents
      uptime: calculateOverallUptime(metrics),
      avgResponseTime: calculateAvgResponseTime(metrics),
    };
  }

  async function loadTracingData() {
    const analytics = tracing.getTraceAnalytics();
    const recentTraces = tracing.getAllTraces().slice(-10);
    
    return {
      analytics,
      recentTraces,
      totalTraces: analytics.totalTraces,
      avgDuration: analytics.avgDuration,
      errorRate: analytics.errorRate,
      topOperations: analytics.topOperations.slice(0, 5),
    };
  }

  function calculateOverallUptime(metrics: Record<string, any>): number {
    const values = Object.values(metrics);
    if (values.length === 0) return 100;
    
    return values.reduce((sum: number, metric: any) => sum + (metric.uptime || 100), 0) / values.length;
  }

  function calculateAvgResponseTime(metrics: Record<string, any>): number {
    const values = Object.values(metrics);
    if (values.length === 0) return 0;
    
    return values.reduce((sum: number, metric: any) => sum + (metric.avgResponseTime || 0), 0) / values.length;
  }

  function getTimeRangeMs(): number {
    switch (timeRange) {
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  }

  function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${Math.round(bytes * 100) / 100}${units[i]}`;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'healthy':
      case 'operational': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'unhealthy':
      case 'major_outage': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'error': return 'text-red-500 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'info': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  }

  //event handlers
  function handleAPMAlert(event: CustomEvent) {
    const alert = event.detail;
    console.log('APM Alert:', alert);
    
    //refresh dashboard data
    loadDashboardData();
  }

  function handleIncidentCreated(event: CustomEvent) {
    const incident = event.detail;
    console.log('Incident Created:', incident);
    
    //refresh dashboard data
    loadDashboardData();
  }

  function handlePerformanceUpdate(event: CustomEvent) {
    const update = event.detail;
    console.log('Performance Update:', update);
    
    //could update specific metrics without full refresh
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }

  function refreshNow() {
    loadDashboardData();
  }
</script>

<div class="monitoring-dashboard">
  <header class="dashboard-header">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Monitoring Dashboard</h1>
      
      <div class="flex items-center space-x-4">
        <select bind:value={timeRange} on:change={loadDashboardData} class="dashboard-select">
          <option value="5m">Last 5 minutes</option>
          <option value="15m">Last 15 minutes</option>
          <option value="1h">Last hour</option>
          <option value="6h">Last 6 hours</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>

        <button
          on:click={toggleAutoRefresh}
          class="dashboard-button {autoRefresh ? 'active' : ''}"
        >
          Auto Refresh
        </button>

        <button on:click={refreshNow} class="dashboard-button" disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>

        <span class="text-sm text-gray-500">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </span>
      </div>
    </div>

    <nav class="dashboard-nav">
      <button
        class="nav-button {viewMode === 'overview' ? 'active' : ''}"
        on:click={() => viewMode = 'overview'}
      >
        Overview
      </button>
      <button
        class="nav-button {viewMode === 'performance' ? 'active' : ''}"
        on:click={() => viewMode = 'performance'}
      >
        Performance
      </button>
      <button
        class="nav-button {viewMode === 'errors' ? 'active' : ''}"
        on:click={() => viewMode = 'errors'}
      >
        Errors & Logs
      </button>
      <button
        class="nav-button {viewMode === 'uptime' ? 'active' : ''}"
        on:click={() => viewMode = 'uptime'}
      >
        Uptime
      </button>
      <button
        class="nav-button {viewMode === 'traces' ? 'active' : ''}"
        on:click={() => viewMode = 'traces'}
      >
        Traces
      </button>
    </nav>
  </header>

  {#if error}
    <div class="error-banner">
      <p>Error loading dashboard data: {error}</p>
      <button on:click={loadDashboardData} class="retry-button">Retry</button>
    </div>
  {/if}

  <main class="dashboard-content">
    {#if viewMode === 'overview'}
      <div class="metrics-grid">
        <!-- System Health -->
        <div class="metric-card">
          <h3>System Health</h3>
          <div class="metric-value {getStatusColor(healthData.status)}">
            {healthData.status || 'Unknown'}
          </div>
          <div class="metric-details">
            <p>{healthData.summary?.healthy || 0} / {healthData.summary?.total || 0} checks passing</p>
            {#if healthData.criticalIssues?.length > 0}
              <p class="text-red-600">{healthData.criticalIssues.length} critical issues</p>
            {/if}
          </div>
        </div>

        <!-- Response Time -->
        <div class="metric-card">
          <h3>Avg Response Time</h3>
          <div class="metric-value">
            {formatDuration(apmData.summary?.responseTime || 0)}
          </div>
          <div class="metric-details">
            <p>Last {timeRange}</p>
          </div>
        </div>

        <!-- Error Rate -->
        <div class="metric-card">
          <h3>Error Rate</h3>
          <div class="metric-value {(apmData.summary?.errorRate || 0) > 0.05 ? 'text-red-600' : 'text-green-600'}">
            {((apmData.summary?.errorRate || 0) * 100).toFixed(2)}%
          </div>
          <div class="metric-details">
            <p>{logData.analytics?.totalLogs || 0} total logs</p>
          </div>
        </div>

        <!-- Uptime -->
        <div class="metric-card">
          <h3>Overall Uptime</h3>
          <div class="metric-value {uptimeData.uptime >= 99 ? 'text-green-600' : 'text-yellow-600'}">
            {uptimeData.uptime?.toFixed(2) || 100}%
          </div>
          <div class="metric-details">
            <p>Avg response: {formatDuration(uptimeData.avgResponseTime || 0)}</p>
          </div>
        </div>

        <!-- Active Alerts -->
        <div class="metric-card">
          <h3>Active Alerts</h3>
          <div class="metric-value {alertData.active > 0 ? 'text-red-600' : 'text-green-600'}">
            {alertData.active || 0}
          </div>
          <div class="metric-details">
            <p>{alertData.critical || 0} critical</p>
          </div>
        </div>

        <!-- Memory Usage -->
        <div class="metric-card">
          <h3>Memory Usage</h3>
          <div class="metric-value {(apmData.summary?.memoryUsage || 0) > 80 ? 'text-red-600' : 'text-green-600'}">
            {(apmData.summary?.memoryUsage || 0).toFixed(1)}%
          </div>
          <div class="metric-details">
            <p>JavaScript heap</p>
          </div>
        </div>
      </div>

      <!-- Recent Incidents -->
      {#if uptimeData.incidents?.length > 0}
        <div class="incidents-section">
          <h3>Recent Incidents</h3>
          <div class="incidents-list">
            {#each uptimeData.incidents.slice(0, 3) as incident}
              <div class="incident-item {getSeverityColor(incident.severity)}">
                <div class="incident-header">
                  <span class="incident-title">{incident.title}</span>
                  <span class="incident-status">{incident.status}</span>
                  <span class="incident-time">
                    {new Date(incident.startTime).toLocaleString()}
                  </span>
                </div>
                <p class="incident-description">{incident.description}</p>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Top Errors -->
      {#if logData.recentErrors?.length > 0}
        <div class="errors-section">
          <h3>Recent Errors</h3>
          <div class="errors-list">
            {#each logData.recentErrors.slice(0, 5) as error}
              <div class="error-item">
                <div class="error-header">
                  <span class="error-level {getSeverityColor(error.level)}">{error.level}</span>
                  <span class="error-source">{error.source}</span>
                  <span class="error-time">
                    {new Date(error.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p class="error-message">{error.message}</p>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}

    {#if viewMode === 'performance'}
      <div class="performance-section">
        <h3>Performance Metrics</h3>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <h4>Transaction Volume</h4>
            <div class="metric-value">{apmData.transactions?.total || 0}</div>
            <div class="metric-details">
              <p>Success: {apmData.transactions?.success || 0}</p>
              <p>Errors: {apmData.transactions?.error || 0}</p>
            </div>
          </div>

          <div class="metric-card">
            <h4>Avg Duration</h4>
            <div class="metric-value">
              {formatDuration(apmData.transactions?.avgDuration || 0)}
            </div>
          </div>

          <div class="metric-card">
            <h4>Active Transactions</h4>
            <div class="metric-value">{apmData.summary?.activeTransactions || 0}</div>
          </div>
        </div>

        {#if tracingData.topOperations?.length > 0}
          <div class="operations-section">
            <h4>Top Operations</h4>
            <div class="operations-list">
              {#each tracingData.topOperations as operation}
                <div class="operation-item">
                  <span class="operation-name">{operation.name}</span>
                  <span class="operation-count">{operation.count} calls</span>
                  <span class="operation-duration">
                    {formatDuration(operation.avgDuration)}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if viewMode === 'errors'}
      <div class="errors-section">
        <h3>Error Analysis</h3>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <h4>Error Rate</h4>
            <div class="metric-value">{(logData.errorRate * 100).toFixed(2)}%</div>
          </div>

          <div class="metric-card">
            <h4>Total Logs</h4>
            <div class="metric-value">{logData.totalLogs}</div>
          </div>
        </div>

        <div class="logs-by-level">
          <h4>Logs by Level</h4>
          <div class="level-bars">
            {#each Object.entries(logData.logsByLevel || {}) as [level, count]}
              <div class="level-bar">
                <span class="level-name {getSeverityColor(level.toLowerCase())}">{level}</span>
                <div class="level-count">{count}</div>
              </div>
            {/each}
          </div>
        </div>

        {#if logData.topSources?.length > 0}
          <div class="sources-section">
            <h4>Top Log Sources</h4>
            <div class="sources-list">
              {#each logData.topSources as source}
                <div class="source-item">
                  <span class="source-name">{source.source}</span>
                  <span class="source-count">{source.count}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if viewMode === 'uptime'}
      <div class="uptime-section">
        <h3>Service Status</h3>
        
        <div class="services-grid">
          {#each uptimeData.services || [] as service}
            <div class="service-card">
              <div class="service-header">
                <h4>{service.name}</h4>
                <span class="service-status {getStatusColor(service.status)}">
                  {service.status}
                </span>
              </div>
              <div class="service-metrics">
                <div class="service-metric">
                  <span class="metric-label">Uptime</span>
                  <span class="metric-value">{service.uptime.toFixed(2)}%</span>
                </div>
                <div class="service-metric">
                  <span class="metric-label">Response Time</span>
                  <span class="metric-value">{formatDuration(service.responseTime)}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if viewMode === 'traces'}
      <div class="traces-section">
        <h3>Distributed Tracing</h3>
        
        <div class="metrics-grid">
          <div class="metric-card">
            <h4>Total Traces</h4>
            <div class="metric-value">{tracingData.totalTraces || 0}</div>
          </div>

          <div class="metric-card">
            <h4>Avg Duration</h4>
            <div class="metric-value">
              {formatDuration(tracingData.avgDuration || 0)}
            </div>
          </div>

          <div class="metric-card">
            <h4>Error Rate</h4>
            <div class="metric-value">
              {((tracingData.errorRate || 0) * 100).toFixed(2)}%
            </div>
          </div>
        </div>

        {#if tracingData.recentTraces?.length > 0}
          <div class="traces-list-section">
            <h4>Recent Traces</h4>
            <div class="traces-list">
              {#each tracingData.recentTraces.slice(0, 10) as trace}
                <div class="trace-item">
                  <div class="trace-header">
                    <span class="trace-id">{trace.traceId.substring(0, 8)}...</span>
                    <span class="trace-duration">{formatDuration(trace.duration)}</span>
                    <span class="trace-operations">{trace.operationCount} ops</span>
                    {#if trace.errorCount > 0}
                      <span class="trace-errors text-red-600">{trace.errorCount} errors</span>
                    {/if}
                  </div>
                  <div class="trace-services">
                    {#each trace.services as service}
                      <span class="service-tag">{service}</span>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  .monitoring-dashboard {
    min-height: 100vh;
    background: #f8fafc;
  }

  .dashboard-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 1rem 2rem;
  }

  .dashboard-nav {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  .nav-button {
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    background: white;
    color: #64748b;
    font-weight: 500;
    transition: all 0.2s;
  }

  .nav-button:hover {
    background: #f1f5f9;
  }

  .nav-button.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .dashboard-select,
  .dashboard-button {
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background: white;
    font-size: 0.875rem;
  }

  .dashboard-button.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
    padding: 1rem;
    margin: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .retry-button {
    padding: 0.5rem 1rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .dashboard-content {
    padding: 2rem;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .metric-card {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .metric-card h3,
  .metric-card h4 {
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
    margin: 0 0 0.5rem 0;
  }

  .metric-value {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .metric-details {
    font-size: 0.875rem;
    color: #64748b;
  }

  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .service-card {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
  }

  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .service-header h4 {
    margin: 0;
    font-weight: 600;
  }

  .service-status {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .service-metrics {
    display: flex;
    justify-content: space-between;
  }

  .service-metric {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric-label {
    font-size: 0.75rem;
    color: #64748b;
  }

  .incidents-section,
  .errors-section,
  .operations-section,
  .sources-section,
  .traces-list-section {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
    margin-bottom: 2rem;
  }

  .incidents-section h3,
  .errors-section h3,
  .operations-section h4,
  .sources-section h4,
  .traces-list-section h4 {
    margin: 0 0 1rem 0;
    font-weight: 600;
  }

  .incident-item,
  .error-item,
  .trace-item {
    padding: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .incident-header,
  .error-header,
  .trace-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .incident-title,
  .error-message {
    font-weight: 500;
  }

  .incident-status,
  .error-level {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .incident-time,
  .error-time {
    font-size: 0.75rem;
    color: #64748b;
  }

  .operations-list,
  .sources-list,
  .traces-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .operation-item,
  .source-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 0.375rem;
  }

  .operation-name,
  .source-name {
    font-weight: 500;
  }

  .operation-count,
  .operation-duration,
  .source-count {
    font-size: 0.875rem;
    color: #64748b;
  }

  .level-bars {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .level-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-radius: 0.375rem;
  }

  .level-name {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .trace-services {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .service-tag {
    padding: 0.125rem 0.5rem;
    background: #e2e8f0;
    color: #475569;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }

  .trace-errors {
    font-weight: 600;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .dashboard-header {
      padding: 1rem;
    }

    .dashboard-content {
      padding: 1rem;
    }

    .metrics-grid {
      grid-template-columns: 1fr;
    }

    .service-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .incident-header,
    .error-header,
    .trace-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .operation-item,
    .source-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>