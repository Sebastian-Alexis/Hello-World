// =============================================================================
// PERFORMANCE VITALS API - Endpoint for collecting Core Web Vitals and performance data
// Processes and stores performance metrics for monitoring and optimization
// =============================================================================

import type { APIRoute } from 'astro';

interface VitalsData {
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

interface PerformancePayload {
  vital?: VitalsData;
  vitals?: VitalsData[];
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
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json() as PerformancePayload | CustomMetric;
    
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
    if ('vital' in payload || 'vitals' in payload) {
      await processVitalsData(payload as PerformancePayload);
    } else if ('name' in payload && 'value' in payload) {
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
      message: 'Performance data recorded'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
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

async function processVitalsData(payload: PerformancePayload): Promise<void> {
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

async function recordVital(vital: VitalsData, sessionId: string): Promise<void> {
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

async function alertOnPoorPerformance(vital: VitalsData, sessionId: string): Promise<void> {
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

function logPerformanceSummary(payload: PerformancePayload): void {
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

//GET endpoint for health check
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    success: true,
    service: 'Performance Vitals API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
};