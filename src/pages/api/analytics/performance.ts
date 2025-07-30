// =============================================================================
// ENHANCED PERFORMANCE ANALYTICS API - Plan 7 Implementation
// Main endpoint for processing enhanced performance data from PerformanceTracker
// =============================================================================

import type { APIRoute } from 'astro';
import type {
  PerformanceData,
  PerformanceAlert,
  EnhancedVitalsData,
  ResourceMetric,
  MemoryMetric,
  UserInteractionMetric
} from '../../../lib/performance/vitals';

//performance data storage (in production, use database)
const sessionMetrics = new Map<string, PerformanceData[]>();
const performanceBaselines = new Map<string, number>();
const alertHistory = new Map<string, PerformanceAlert[]>();

//rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 200; // requests per minute for enhanced endpoint
const RATE_WINDOW = 60000; // 1 minute

//performance budgets for automated alerts
const PERFORMANCE_BUDGETS = {
  LCP: 2500,
  FID: 100,
  CLS: 0.1,
  TTFB: 800,
  FCP: 1800,
  INP: 200,
  MEMORY_USAGE: 80,
  RESOURCE_SIZE: 2048 * 1024, // 2MB
  SLOW_INTERACTION: 100
};

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
    
    const performanceData = await request.json() as PerformanceData;
    
    //validate required fields
    if (!performanceData.sessionId || !performanceData.vitals || !Array.isArray(performanceData.vitals)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid performance data structure'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    //process the enhanced performance data
    await processEnhancedPerformanceData(performanceData);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Enhanced performance data processed',
      processed: {
        vitals: performanceData.vitals.length,
        resources: performanceData.resources.length,
        memory: performanceData.memory.length,
        interactions: performanceData.userInteractions.length,
        alerts: performanceData.regressions.length
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Error processing enhanced performance data:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process performance data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function processEnhancedPerformanceData(data: PerformanceData): Promise<void> {
  try {
    //store session data
    if (!sessionMetrics.has(data.sessionId)) {
      sessionMetrics.set(data.sessionId, []);
    }
    sessionMetrics.get(data.sessionId)!.push(data);
    
    //process core web vitals
    for (const vital of data.vitals) {
      await processVital(vital, data.sessionId, data.userId);
    }
    
    //process resource metrics
    if (data.resources.length > 0) {
      await processResourceMetrics(data.resources, data.sessionId);
    }
    
    //process memory metrics
    if (data.memory.length > 0) {
      await processMemoryMetrics(data.memory, data.sessionId);
    }
    
    //process user interactions
    if (data.userInteractions.length > 0) {
      await processUserInteractions(data.userInteractions, data.sessionId);
    }
    
    //handle alerts
    if (data.regressions.length > 0) {
      await processAlerts(data.regressions, data.sessionId);
    }
    
    //update performance baselines
    await updateBaselines(data);
    
    //check for new regressions
    await checkForRegressions(data);
    
    //log comprehensive summary
    logPerformanceSummary(data);
    
    //cleanup old data (keep last 10000 data points per session)
    cleanupOldData();
    
  } catch (error) {
    console.error('Error in processEnhancedPerformanceData:', error);
    throw error;
  }
}

async function processVital(vital: EnhancedVitalsData, sessionId: string, userId?: string): Promise<void> {
  console.log(`Core Web Vital: ${vital.name}`, {
    value: vital.value,
    rating: vital.rating,
    url: vital.url,
    sessionId,
    userId,
    deviceInfo: {
      connectionType: vital.connectionType,
      deviceMemory: vital.deviceMemory,
      hardwareConcurrency: vital.hardwareConcurrency
    }
  });
  
  //send to external analytics
  await sendToAnalytics('enhanced-vital', {
    metric: vital.name,
    value: vital.value,
    rating: vital.rating,
    url: vital.url,
    sessionId,
    userId,
    timestamp: vital.timestamp,
    deviceInfo: {
      connectionType: vital.connectionType,
      deviceMemory: vital.deviceMemory,
      hardwareConcurrency: vital.hardwareConcurrency
    }
  });
}

async function processResourceMetrics(resources: ResourceMetric[], sessionId: string): Promise<void> {
  const criticalResources = resources.filter(r => r.isCritical);
  const slowResources = resources.filter(r => r.duration > 3000);
  const largeResources = resources.filter(r => r.size > PERFORMANCE_BUDGETS.RESOURCE_SIZE);
  
  console.log('Resource Analysis:', {
    total: resources.length,
    critical: criticalResources.length,
    slow: slowResources.length,
    large: largeResources.length,
    sessionId
  });
  
  //alert on problematic resources
  for (const resource of [...slowResources, ...largeResources]) {
    await sendToAnalytics('resource-alert', {
      name: resource.name,
      type: resource.type,
      duration: resource.duration,
      size: resource.size,
      isCritical: resource.isCritical,
      sessionId,
      timestamp: resource.timestamp
    });
  }
}

async function processMemoryMetrics(memory: MemoryMetric[], sessionId: string): Promise<void> {
  const latestMemory = memory[memory.length - 1];
  const highUsageEvents = memory.filter(m => m.usagePercentage > PERFORMANCE_BUDGETS.MEMORY_USAGE);
  
  console.log('Memory Analysis:', {
    currentUsage: `${latestMemory.usagePercentage.toFixed(1)}%`,
    highUsageEvents: highUsageEvents.length,
    totalSamples: memory.length,
    sessionId
  });
  
  if (highUsageEvents.length > 0) {
    await sendToAnalytics('memory-alert', {
      events: highUsageEvents,
      sessionId,
      timestamp: Date.now()
    });
  }
}

async function processUserInteractions(interactions: UserInteractionMetric[], sessionId: string): Promise<void> {
  const slowInteractions = interactions.filter(i => i.duration > PERFORMANCE_BUDGETS.SLOW_INTERACTION);
  
  const interactionStats = interactions.reduce((acc, interaction) => {
    if (!acc[interaction.interactionType]) {
      acc[interaction.interactionType] = { count: 0, totalDuration: 0 };
    }
    acc[interaction.interactionType].count++;
    acc[interaction.interactionType].totalDuration += interaction.duration;
    return acc;
  }, {} as Record<string, { count: number; totalDuration: number }>);
  
  console.log('Interaction Analysis:', {
    total: interactions.length,
    slow: slowInteractions.length,
    byType: Object.entries(interactionStats).map(([type, stats]) => ({
      type,
      count: stats.count,
      avgDuration: Math.round(stats.totalDuration / stats.count)
    })),
    sessionId
  });
  
  if (slowInteractions.length > 0) {
    await sendToAnalytics('interaction-alert', {
      slowInteractions,
      sessionId,
      timestamp: Date.now()
    });
  }
}

async function processAlerts(alerts: PerformanceAlert[], sessionId: string): Promise<void> {
  //store alerts in history
  if (!alertHistory.has(sessionId)) {
    alertHistory.set(sessionId, []);
  }
  alertHistory.get(sessionId)!.push(...alerts);
  
  //send critical alerts immediately
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  for (const alert of criticalAlerts) {
    await sendCriticalAlert(alert);
  }
  
  console.log('Alert Processing:', {
    total: alerts.length,
    critical: criticalAlerts.length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    sessionId
  });
}

async function updateBaselines(data: PerformanceData): Promise<void> {
  //update baselines using exponential moving average
  data.vitals.forEach(vital => {
    const key = vital.name;
    const current = performanceBaselines.get(key) || vital.value;
    const alpha = 0.1; // smoothing factor
    const newBaseline = alpha * vital.value + (1 - alpha) * current;
    performanceBaselines.set(key, newBaseline);
  });
}

async function checkForRegressions(data: PerformanceData): Promise<void> {
  const regressions: PerformanceAlert[] = [];
  
  data.vitals.forEach(vital => {
    const baseline = performanceBaselines.get(vital.name);
    if (baseline && vital.value > baseline * 1.2) { // 20% regression threshold
      regressions.push({
        metric: vital.name,
        value: vital.value,
        threshold: baseline,
        severity: vital.value > baseline * 1.5 ? 'critical' : 'warning',
        url: vital.url,
        timestamp: vital.timestamp,
        sessionId: data.sessionId,
        userId: data.userId
      });
    }
  });
  
  if (regressions.length > 0) {
    await processAlerts(regressions, data.sessionId);
  }
}

async function sendCriticalAlert(alert: PerformanceAlert): Promise<void> {
  try {
    //send to alerts endpoint
    await fetch('/api/analytics/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert })
    });
  } catch (error) {
    console.warn('Failed to send critical alert:', error);
  }
}

async function sendToAnalytics(type: string, data: any): Promise<void> {
  try {
    //send to external analytics services
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
          timestamp: Date.now()
        })
      });
    }
  } catch (error) {
    //fail silently to not impact user experience
    console.warn('Failed to send analytics data:', error);
  }
}

function logPerformanceSummary(data: PerformanceData): void {
  console.log('Enhanced Performance Summary:', {
    sessionId: data.sessionId,
    userId: data.userId,
    performanceScore: data.performanceScore,
    vitalsCount: data.vitals.length,
    resourcesCount: data.resources.length,
    memoryCount: data.memory.length,
    interactionsCount: data.userInteractions.length,
    alertsCount: data.regressions.length,
    deviceInfo: data.deviceInfo,
    timestamp: new Date(data.timestamp).toISOString()
  });
}

function cleanupOldData(): void {
  //limit each session to 100 data points to prevent memory bloat
  for (const [sessionId, data] of sessionMetrics.entries()) {
    if (data.length > 100) {
      sessionMetrics.set(sessionId, data.slice(-100));
    }
  }
  
  //limit alert history to 1000 alerts per session
  for (const [sessionId, alerts] of alertHistory.entries()) {
    if (alerts.length > 1000) {
      alertHistory.set(sessionId, alerts.slice(-1000));
    }
  }
  
  //cleanup request counts older than 1 hour
  const oneHourAgo = Date.now() - 3600000;
  for (const [key, record] of requestCounts.entries()) {
    if (record.resetTime < oneHourAgo) {
      requestCounts.delete(key);
    }
  }
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const sessionId = searchParams.get('sessionId');
    const timeRange = searchParams.get('range') || '24h';
    
    if (sessionId) {
      //return specific session data
      const data = sessionMetrics.get(sessionId);
      
      if (!data) {
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
          dataPoints: data.length,
          performanceData: data
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
    
    //return aggregated data
    const sessions = Array.from(sessionMetrics.entries());
    const now = Date.now();
    const timeRangeMs = parseTimeRange(timeRange);
    const cutoff = now - timeRangeMs;
    
    const recentSessions = sessions.map(([id, data]) => [
      id,
      data.filter(d => d.timestamp >= cutoff)
    ]).filter(([, data]) => (data as PerformanceData[]).length > 0);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        timeRange,
        sessionCount: recentSessions.length,
        totalDataPoints: recentSessions.reduce((sum, [, data]) => sum + (data as PerformanceData[]).length, 0)
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
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