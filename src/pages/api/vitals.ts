// =============================================================================
// ENHANCED PERFORMANCE API - Plan 7 Implementation
// Advanced endpoint for collecting Core Web Vitals, real user metrics,
// performance regression detection, and comprehensive analytics
// =============================================================================

import type { APIRoute } from 'astro';
import type {
  EnhancedVitalsData,
  ResourceMetric,
  MemoryMetric,
  UserInteractionMetric,
  PerformanceAlert,
  PerformanceData
} from '../../lib/performance/vitals';

//performance baseline storage (in production, use database)
const performanceBaselines = new Map<string, number>();
const alertHistory = new Map<string, PerformanceAlert[]>();
const sessionMetrics = new Map<string, PerformanceData[]>();

//rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

interface LegacyVitalsData {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType: string;
  timestamp: number;
  url: string;
  userAgent: string;
}

interface LegacyPerformancePayload {
  vital?: LegacyVitalsData;
  vitals?: LegacyVitalsData[];
  resources?: PerformanceResourceTiming[];
  navigation?: PerformanceNavigationTiming;
  memory?: any;
  connection?: any;
  sessionId: string;
  timestamp: number;
}

interface CustomMetric {
  name: string;
  value: number;
  metadata?: any;
  timestamp: number;
  url: string;
  sessionId: string;
  userId?: string;
}

type PayloadType = PerformanceData | LegacyPerformancePayload | CustomMetric;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    //rate limiting
    const clientId = clientAddress || 'unknown';
    if (!checkRateLimit(clientId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded'
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const payload = await request.json() as PayloadType;
    
    //validate payload
    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid payload'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    //determine payload type and process accordingly
    if ('performanceScore' in payload && 'regressions' in payload) {
      //enhanced performance data
      await processEnhancedPerformanceData(payload as PerformanceData);
    } else if ('vital' in payload || 'vitals' in payload) {
      //legacy vitals data
      await processLegacyVitalsData(payload as LegacyPerformancePayload);
    } else if ('name' in payload && 'value' in payload) {
      //custom metric
      await processCustomMetric(payload as CustomMetric);
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unknown payload type'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Performance data recorded',
      timestamp: Date.now()
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to process vitals data:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function processEnhancedPerformanceData(payload: PerformanceData): Promise<void> {
  try {
    //store session data for analysis
    if (!sessionMetrics.has(payload.sessionId)) {
      sessionMetrics.set(payload.sessionId, []);
    }
    sessionMetrics.get(payload.sessionId)!.push(payload);
    
    //process core web vitals
    for (const vital of payload.vitals) {
      await recordEnhancedVital(vital, payload.sessionId, payload.userId);
    }
    
    //process resource metrics
    if (payload.resources.length > 0) {
      await processEnhancedResourceMetrics(payload.resources, payload.sessionId);
    }
    
    //process memory metrics
    if (payload.memory.length > 0) {
      await processMemoryMetrics(payload.memory, payload.sessionId);
    }
    
    //process user interactions
    if (payload.userInteractions.length > 0) {
      await processUserInteractions(payload.userInteractions, payload.sessionId);
    }
    
    //process navigation timing
    if (payload.navigation) {
      await processNavigationTiming(payload.navigation, payload.sessionId);
    }
    
    //handle performance regressions and alerts
    if (payload.regressions.length > 0) {
      await processPerformanceAlerts(payload.regressions);
    }
    
    //update baselines for regression detection
    await updatePerformanceBaselines(payload);
    
    //log comprehensive performance summary
    logEnhancedPerformanceSummary(payload);
    
  } catch (error) {
    console.error('Error processing enhanced performance data:', error);
    throw error;
  }
}

async function processLegacyVitalsData(payload: LegacyPerformancePayload): Promise<void> {
  const vitals = payload.vitals || (payload.vital ? [payload.vital] : []);
  
  //process each vital
  for (const vital of vitals) {
    await recordVital(vital, payload.sessionId);
  }

  //process resource timing data
  if (payload.resources && payload.resources.length > 0) {
    await processResourceTiming(payload.resources, payload.sessionId);
  }

  //process navigation timing
  if (payload.navigation) {
    await processNavigationTiming(payload.navigation, payload.sessionId);
  }

  //log performance summary
  logPerformanceSummary(payload);
}

async function recordEnhancedVital(vital: EnhancedVitalsData, sessionId: string, userId?: string): Promise<void> {
  //in a real application, you would store this in a database
  console.log(`Enhanced Core Web Vital: ${vital.name}`, {
    value: vital.value,
    rating: vital.rating,
    url: vital.url,
    sessionId,
    userId,
    timestamp: new Date(vital.timestamp).toISOString(),
    deviceInfo: {
      connectionType: vital.connectionType,
      deviceMemory: vital.deviceMemory,
      hardwareConcurrency: vital.hardwareConcurrency
    }
  });

  //send to external analytics service
  await sendToAnalytics('enhanced-vital', {
    metric: vital.name,
    value: vital.value,
    rating: vital.rating,
    url: vital.url,
    userAgent: vital.userAgent,
    sessionId,
    userId,
    timestamp: vital.timestamp,
    deviceInfo: {
      connectionType: vital.connectionType,
      deviceMemory: vital.deviceMemory,
      hardwareConcurrency: vital.hardwareConcurrency
    },
    pageLoadTime: vital.pageLoadTime,
    domContentLoadedTime: vital.domContentLoadedTime
  });

  //alert on poor performance
  if (vital.rating === 'poor') {
    await alertOnPoorPerformance({
      name: vital.name,
      value: vital.value,
      rating: vital.rating,
      navigationType: vital.navigationType,
      timestamp: vital.timestamp,
      url: vital.url,
      userAgent: vital.userAgent
    }, sessionId);
  }
}

async function recordVital(vital: LegacyVitalsData, sessionId: string): Promise<void> {
  //in a real application, you would store this in a database
  //for now, we'll log and potentially send to an analytics service
  
  console.log(`Core Web Vital: ${vital.name}`, {
    value: vital.value,
    rating: vital.rating,
    url: vital.url,
    sessionId,
    timestamp: new Date(vital.timestamp).toISOString(),
  });

  //send to external analytics service (example)
  await sendToAnalytics('vital', {
    metric: vital.name,
    value: vital.value,
    rating: vital.rating,
    url: vital.url,
    userAgent: vital.userAgent,
    sessionId,
    timestamp: vital.timestamp,
  });

  //alert on poor performance
  if (vital.rating === 'poor') {
    await alertOnPoorPerformance(vital, sessionId);
  }
}

async function processEnhancedResourceMetrics(resources: ResourceMetric[], sessionId: string): Promise<void> {
  //analyze resource loading performance with enhanced metrics
  const criticalResources = resources.filter(r => r.isCritical);
  const slowResources = resources.filter(r => r.duration > 3000);
  const largeResources = resources.filter(r => r.size > 2048 * 1024); // > 2MB
  
  if (criticalResources.length > 0) {
    console.log(`Found ${criticalResources.length} critical resources:`, 
      criticalResources.map(r => ({
        name: r.name,
        type: r.type,
        duration: Math.round(r.duration),
        size: Math.round(r.size / 1024) + 'KB'
      }))
    );
  }
  
  if (slowResources.length > 0) {
    console.warn(`Found ${slowResources.length} slow loading resources:`, 
      slowResources.map(r => ({
        name: r.name,
        type: r.type,
        duration: Math.round(r.duration),
        size: Math.round(r.size / 1024) + 'KB'
      }))
    );
    
    //send slow resource alerts
    for (const resource of slowResources) {
      await sendToAnalytics('slow-resource', {
        url: resource.name,
        type: resource.type,
        duration: resource.duration,
        size: resource.size,
        transferSize: resource.transferSize,
        encodedBodySize: resource.encodedBodySize,
        decodedBodySize: resource.decodedBodySize,
        initiatorType: resource.initiatorType,
        isCritical: resource.isCritical,
        sessionId,
        timestamp: resource.timestamp
      });
    }
  }
  
  if (largeResources.length > 0) {
    console.warn(`Found ${largeResources.length} large resources:`, 
      largeResources.map(r => ({
        name: r.name,
        type: r.type,
        sizeMB: (r.size / (1024 * 1024)).toFixed(2)
      }))
    );
  }
  
  //analyze resource types and sizes
  const resourcesByType = resources.reduce((acc, resource) => {
    if (!acc[resource.type]) acc[resource.type] = [];
    acc[resource.type].push(resource);
    return acc;
  }, {} as Record<string, ResourceMetric[]>);
  
  //log resource summary by type
  Object.entries(resourcesByType).forEach(([type, typeResources]) => {
    const totalSize = typeResources.reduce((sum, r) => sum + r.size, 0);
    const avgDuration = typeResources.reduce((sum, r) => sum + r.duration, 0) / typeResources.length;
    
    if (totalSize > 5 * 1024 * 1024) { // More than 5MB
      console.warn(`Large resource payload for ${type}:`, {
        count: typeResources.length,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        avgDurationMs: Math.round(avgDuration)
      });
    }
  });
}

async function processMemoryMetrics(memory: MemoryMetric[], sessionId: string): Promise<void> {
  const latestMemory = memory[memory.length - 1];
  const highMemoryUsage = memory.filter(m => m.usagePercentage > 80);
  
  console.log('Memory Usage Summary:', {
    current: {
      usedMB: (latestMemory.usedJSHeapSize / (1024 * 1024)).toFixed(2),
      totalMB: (latestMemory.totalJSHeapSize / (1024 * 1024)).toFixed(2),
      limitMB: (latestMemory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2),
      usagePercentage: latestMemory.usagePercentage.toFixed(1)
    },
    highUsageEvents: highMemoryUsage.length,
    sessionId
  });
  
  if (highMemoryUsage.length > 0) {
    await sendToAnalytics('high-memory-usage', {
      events: highMemoryUsage,
      sessionId,
      timestamp: Date.now()
    });
  }
}

async function processUserInteractions(interactions: UserInteractionMetric[], sessionId: string): Promise<void> {
  const slowInteractions = interactions.filter(i => i.duration > 100);
  const interactionsByType = interactions.reduce((acc, interaction) => {
    if (!acc[interaction.interactionType]) acc[interaction.interactionType] = [];
    acc[interaction.interactionType].push(interaction);
    return acc;
  }, {} as Record<string, UserInteractionMetric[]>);
  
  console.log('User Interaction Summary:', {
    totalInteractions: interactions.length,
    slowInteractions: slowInteractions.length,
    byType: Object.entries(interactionsByType).map(([type, typeInteractions]) => ({
      type,
      count: typeInteractions.length,
      avgDuration: Math.round(typeInteractions.reduce((sum, i) => sum + i.duration, 0) / typeInteractions.length)
    })),
    sessionId
  });
  
  if (slowInteractions.length > 0) {
    await sendToAnalytics('slow-interactions', {
      interactions: slowInteractions,
      sessionId,
      timestamp: Date.now()
    });
  }
}

async function processPerformanceAlerts(alerts: PerformanceAlert[]): Promise<void> {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  
  console.log('Performance Alerts:', {
    critical: criticalAlerts.length,
    warning: warningAlerts.length,
    total: alerts.length
  });
  
  //store alerts for trending analysis
  for (const alert of alerts) {
    if (!alertHistory.has(alert.sessionId)) {
      alertHistory.set(alert.sessionId, []);
    }
    alertHistory.get(alert.sessionId)!.push(alert);
  }
  
  //send critical alerts immediately
  for (const alert of criticalAlerts) {
    await sendCriticalAlert(alert);
  }
}

async function updatePerformanceBaselines(payload: PerformanceData): Promise<void> {
  //update baseline metrics for regression detection
  payload.vitals.forEach(vital => {
    const key = `${vital.name}_baseline`;
    const current = performanceBaselines.get(key) || vital.value;
    
    //use exponential moving average
    const alpha = 0.1; // smoothing factor
    const newBaseline = alpha * vital.value + (1 - alpha) * current;
    performanceBaselines.set(key, newBaseline);
  });
}

async function processResourceTiming(resources: PerformanceResourceTiming[], sessionId: string): Promise<void> {
  //analyze resource loading performance
  const slowResources = resources.filter(resource => {
    const loadTime = resource.responseEnd - resource.startTime;
    return loadTime > 2000; // Resources taking more than 2 seconds
  });

  if (slowResources.length > 0) {
    console.warn(`Found ${slowResources.length} slow loading resources:`, 
      slowResources.map(r => ({
        name: r.name,
        loadTime: Math.round(r.responseEnd - r.startTime),
        size: r.transferSize,
        type: r.initiatorType,
      }))
    );

    //send slow resource data to analytics
    for (const resource of slowResources) {
      await sendToAnalytics('slow-resource', {
        url: resource.name,
        loadTime: resource.responseEnd - resource.startTime,
        transferSize: resource.transferSize,
        initiatorType: resource.initiatorType,
        sessionId,
        timestamp: Date.now(),
      });
    }
  }

  //analyze resource types
  const resourcesByType = resources.reduce((acc, resource) => {
    const type = resource.initiatorType || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(resource);
    return acc;
  }, {} as Record<string, PerformanceResourceTiming[]>);

  //log resource summary
  Object.entries(resourcesByType).forEach(([type, resources]) => {
    const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const avgLoadTime = resources.reduce((sum, r) => sum + (r.responseEnd - r.startTime), 0) / resources.length;
    
    if (totalSize > 1024 * 1024) { // More than 1MB
      console.warn(`Large resource payload for ${type}:`, {
        count: resources.length,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        avgLoadTimeMs: Math.round(avgLoadTime),
      });
    }
  });
}

async function processNavigationTiming(navigation: PerformanceNavigationTiming, sessionId: string): Promise<void> {
  const metrics = {
    ttfb: navigation.responseStart - navigation.fetchStart,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
    loadComplete: navigation.loadEventEnd - navigation.fetchStart,
    domInteractive: navigation.domInteractive - navigation.fetchStart,
  };

  console.log('Navigation Timing:', metrics);

  //send navigation metrics to analytics
  await sendToAnalytics('navigation', {
    ...metrics,
    navigationType: navigation.type,
    sessionId,
    timestamp: Date.now(),
  });
}

async function processCustomMetric(metric: CustomMetric): Promise<void> {
  console.log(`Custom Metric: ${metric.name}`, {
    value: metric.value,
    metadata: metric.metadata,
    url: metric.url,
    sessionId: metric.sessionId,
    timestamp: new Date(metric.timestamp).toISOString(),
  });

  //send to analytics
  await sendToAnalytics('custom-metric', metric);
}

async function sendToAnalytics(type: string, data: any): Promise<void> {
  //in a real application, you would send this to your analytics service
  //examples: Google Analytics 4, Mixpanel, Amplitude, etc.
  
  try {
    //example: send to Google Analytics 4
    if (process.env.GA_MEASUREMENT_ID) {
      await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: data.sessionId,
          events: [{
            name: 'performance_metric',
            parameters: {
              metric_type: type,
              ...data,
            }
          }]
        })
      });
    }

    //example: send to custom analytics endpoint
    if (process.env.ANALYTICS_ENDPOINT) {
      await fetch(process.env.ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ANALYTICS_API_KEY}`
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: Date.now(),
        }),
      });
    }
  } catch (error) {
    //fail silently to not impact user experience
    console.warn('Failed to send analytics data:', error.message);
  }
}

async function sendCriticalAlert(alert: PerformanceAlert): Promise<void> {
  console.error('CRITICAL PERFORMANCE ALERT:', alert);
  
  //send to external monitoring services
  await sendToAnalytics('critical-alert', alert);
  
  //example: send to Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 CRITICAL Performance Alert: ${alert.metric} = ${alert.value} > ${alert.threshold} (threshold)`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Metric', value: alert.metric, short: true },
              { title: 'Value', value: alert.value.toString(), short: true },
              { title: 'Threshold', value: alert.threshold.toString(), short: true },
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'URL', value: alert.url, short: false },
              { title: 'Session', value: alert.sessionId, short: true },
              { title: 'User', value: alert.userId || 'Anonymous', short: true }
            ]
          }]
        })
      });
    } catch (error) {
      console.warn('Failed to send Slack alert:', error);
    }
  }
}

async function alertOnPoorPerformance(vital: LegacyVitalsData, sessionId: string): Promise<void> {
  //in production, you might want to:
  // 1. Send alerts to monitoring service (e.g., Sentry, DataDog)
  // 2. Notify development team via Slack/email
  // 3. Log to structured logging system
  
  const alertData = {
    severity: 'warning',
    message: `Poor ${vital.name} performance detected`,
    metric: vital.name,
    value: vital.value,
    rating: vital.rating,
    url: vital.url,
    sessionId,
    timestamp: vital.timestamp,
    userAgent: vital.userAgent,
  };

  console.warn('PERFORMANCE ALERT:', alertData);

  //example: send to Sentry
  if (process.env.SENTRY_DSN) {
    try {
      //would use Sentry SDK in real implementation
      console.log('Would send to Sentry:', alertData);
    } catch (error) {
      console.warn('Failed to send Sentry alert:', error);
    }
  }

  //example: send to Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Poor performance detected: ${vital.name} = ${vital.value}ms (${vital.rating}) on ${vital.url}`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Metric', value: vital.name, short: true },
              { title: 'Value', value: `${vital.value}ms`, short: true },
              { title: 'Rating', value: vital.rating, short: true },
              { title: 'URL', value: vital.url, short: false },
              { title: 'Session', value: sessionId, short: true },
            ]
          }]
        }),
      });
    } catch (error) {
      console.warn('Failed to send Slack alert:', error);
    }
  }
}

function logEnhancedPerformanceSummary(payload: PerformanceData): void {
  console.log('Enhanced Performance Summary:', {
    sessionId: payload.sessionId,
    userId: payload.userId,
    performanceScore: payload.performanceScore,
    vitals: payload.vitals.reduce((acc, vital) => {
      acc[vital.name] = { 
        value: vital.value, 
        rating: vital.rating,
        timestamp: vital.timestamp
      };
      return acc;
    }, {} as Record<string, any>),
    resources: {
      total: payload.resources.length,
      critical: payload.resources.filter(r => r.isCritical).length,
      slow: payload.resources.filter(r => r.duration > 3000).length,
      large: payload.resources.filter(r => r.size > 2048 * 1024).length
    },
    memory: {
      samples: payload.memory.length,
      currentUsage: payload.memory[payload.memory.length - 1]?.usagePercentage || 0,
      highUsageEvents: payload.memory.filter(m => m.usagePercentage > 80).length
    },
    interactions: {
      total: payload.userInteractions.length,
      slow: payload.userInteractions.filter(i => i.duration > 100).length
    },
    alerts: {
      total: payload.regressions.length,
      critical: payload.regressions.filter(a => a.severity === 'critical').length,
      warning: payload.regressions.filter(a => a.severity === 'warning').length
    },
    deviceInfo: payload.deviceInfo,
    timestamp: new Date(payload.timestamp).toISOString()
  });
}

function logPerformanceSummary(payload: LegacyPerformancePayload): void {
  const vitals = payload.vitals || (payload.vital ? [payload.vital] : []);
  
  if (vitals.length === 0) return;

  const summary = vitals.reduce((acc, vital) => {
    acc[vital.name] = { value: vital.value, rating: vital.rating };
    return acc;
  }, {} as Record<string, { value: number; rating: string }>);

  const overallScore = vitals.reduce((score, vital) => {
    const points = vital.rating === 'good' ? 100 : 
                  vital.rating === 'needs-improvement' ? 50 : 0;
    return score + points;
  }, 0) / vitals.length;

  console.log('Performance Summary:', {
    sessionId: payload.sessionId,
    overallScore: Math.round(overallScore),
    vitals: summary,
    resourceCount: payload.resources?.length || 0,
    timestamp: new Date(payload.timestamp).toISOString(),
  });
}

//GET endpoint for performance data retrieval and health check
export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const endpoint = searchParams.get('endpoint');
    
    switch (endpoint) {
      case 'baseline':
        return getPerformanceBaselines();
      case 'dashboard':
        return getPerformanceDashboard(searchParams);
      case 'alerts':
        return getPerformanceAlerts(searchParams);
      case 'sessions':
        return getSessionData(searchParams);
      default:
        return getHealthCheck();
    }
  } catch (error) {
    console.error('Error in GET endpoint:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function getHealthCheck() {
  return new Response(JSON.stringify({
    success: true,
    service: 'Enhanced Performance API',
    version: '2.0.0',
    features: [
      'Core Web Vitals tracking',
      'Real User Metrics (RUM)',
      'Performance regression detection',
      'Memory usage monitoring',
      'User interaction tracking',
      'Resource timing analysis',
      'Performance alerts',
      'Dashboard integration'
    ],
    timestamp: new Date().toISOString(),
    stats: {
      baselines: performanceBaselines.size,
      alertHistory: alertHistory.size,
      sessionMetrics: sessionMetrics.size
    }
  }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}

function getPerformanceBaselines() {
  const baselines = Object.fromEntries(performanceBaselines.entries());
  
  return new Response(JSON.stringify({
    success: true,
    data: baselines,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5 minutes
    }
  });
}

function getPerformanceDashboard(searchParams: URLSearchParams) {
  const timeRange = searchParams.get('range') || '24h';
  const sessionId = searchParams.get('sessionId');
  
  let sessions = Array.from(sessionMetrics.entries());
  
  //filter by session if specified
  if (sessionId) {
    sessions = sessions.filter(([id]) => id === sessionId);
  }
  
  //filter by time range
  const now = Date.now();
  const timeRangeMs = parseTimeRange(timeRange);
  const cutoff = now - timeRangeMs;
  
  const filteredData = sessions.map(([id, data]) => {
    const recentData = data.filter(d => d.timestamp >= cutoff);
    return [id, recentData];
  }).filter(([, data]) => (data as PerformanceData[]).length > 0);
  
  //aggregate metrics
  const aggregated = aggregatePerformanceData(filteredData as [string, PerformanceData[]][]);
  
  return new Response(JSON.stringify({
    success: true,
    data: {
      timeRange,
      sessionCount: filteredData.length,
      ...aggregated
    },
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60' // 1 minute
    }
  });
}

function getPerformanceAlerts(searchParams: URLSearchParams) {
  const severity = searchParams.get('severity') as 'critical' | 'warning' | null;
  const sessionId = searchParams.get('sessionId');
  
  let alerts: PerformanceAlert[] = [];
  
  if (sessionId && alertHistory.has(sessionId)) {
    alerts = alertHistory.get(sessionId)!;
  } else {
    //collect all alerts
    for (const sessionAlerts of alertHistory.values()) {
      alerts.push(...sessionAlerts);
    }
  }
  
  //filter by severity
  if (severity) {
    alerts = alerts.filter(a => a.severity === severity);
  }
  
  //sort by timestamp (most recent first)
  alerts.sort((a, b) => b.timestamp - a.timestamp);
  
  return new Response(JSON.stringify({
    success: true,
    data: alerts.slice(0, 100), // limit to 100 most recent
    total: alerts.length,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30' // 30 seconds
    }
  });
}

function getSessionData(searchParams: URLSearchParams) {
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'sessionId parameter required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const sessionData = sessionMetrics.get(sessionId);
  
  if (!sessionData) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Session not found'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: true,
    data: {
      sessionId,
      dataPoints: sessionData.length,
      firstSeen: new Date(Math.min(...sessionData.map(d => d.timestamp))).toISOString(),
      lastSeen: new Date(Math.max(...sessionData.map(d => d.timestamp))).toISOString(),
      performanceData: sessionData
    },
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5 minutes
    }
  });
}

function parseTimeRange(range: string): number {
  const timeRanges: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  return timeRanges[range] || timeRanges['24h'];
}

function aggregatePerformanceData(sessions: [string, PerformanceData[]][]): any {
  const allData = sessions.flatMap(([, data]) => data);
  
  if (allData.length === 0) {
    return {
      vitals: {},
      performanceScore: { avg: 0, min: 0, max: 0 },
      alertCounts: { critical: 0, warning: 0, total: 0 }
    };
  }
  
  //aggregate vitals
  const vitalMetrics: Record<string, number[]> = {};
  allData.forEach(data => {
    data.vitals.forEach(vital => {
      if (!vitalMetrics[vital.name]) vitalMetrics[vital.name] = [];
      vitalMetrics[vital.name].push(vital.value);
    });
  });
  
  const aggregatedVitals = Object.entries(vitalMetrics).reduce((acc, [name, values]) => {
    acc[name] = {
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      p75: percentile(values, 0.75),
      p90: percentile(values, 0.90),
      count: values.length
    };
    return acc;
  }, {} as Record<string, any>);
  
  //aggregate performance scores
  const scores = allData.map(d => d.performanceScore);
  const performanceScore = {
    avg: scores.reduce((sum, s) => sum + s, 0) / scores.length,
    min: Math.min(...scores),
    max: Math.max(...scores)
  };
  
  //aggregate alerts
  const allAlerts = allData.flatMap(d => d.regressions);
  const alertCounts = {
    critical: allAlerts.filter(a => a.severity === 'critical').length,
    warning: allAlerts.filter(a => a.severity === 'warning').length,
    total: allAlerts.length
  };
  
  return {
    vitals: aggregatedVitals,
    performanceScore,
    alertCounts,
    totalSessions: sessions.length,
    totalDataPoints: allData.length
  };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}