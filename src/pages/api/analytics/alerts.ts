// =============================================================================
// PERFORMANCE ALERTS API - Plan 7 Implementation  
// Dedicated endpoint for handling performance alerts and notifications
// =============================================================================

import type { APIRoute } from 'astro';
import type { PerformanceAlert } from '../../../lib/performance/vitals';

//alert storage (in production, use database)
const criticalAlerts = new Map<string, PerformanceAlert>();
const alertSubscriptions = new Map<string, { webhook?: string; email?: string; slack?: string }>();

export const POST: APIRoute = async ({ request }) => {
  try {
    const { alert } = await request.json();
    
    if (!alert || !alert.metric || !alert.value || !alert.threshold) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid alert data'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    //store alert
    const alertId = `${alert.sessionId}-${alert.metric}-${Date.now()}`;
    criticalAlerts.set(alertId, { ...alert, id: alertId });

    //send notifications
    await sendAlertNotifications(alert);

    //cleanup old alerts (keep last 1000)
    if (criticalAlerts.size > 1000) {
      const oldestAlerts = Array.from(criticalAlerts.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)
        .slice(0, criticalAlerts.size - 1000);
      
      oldestAlerts.forEach(([id]) => criticalAlerts.delete(id));
    }

    return new Response(JSON.stringify({
      success: true,
      alertId,
      message: 'Alert processed and notifications sent'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing alert:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process alert'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const severity = searchParams.get('severity') as 'critical' | 'warning' | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let alerts = Array.from(criticalAlerts.values());

    //filter by severity
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    //sort by timestamp (most recent first)
    alerts.sort((a, b) => b.timestamp - a.timestamp);

    //paginate
    const paginatedAlerts = alerts.slice(offset, offset + limit);

    return new Response(JSON.stringify({
      success: true,
      data: paginatedAlerts,
      pagination: {
        total: alerts.length,
        limit,
        offset,
        hasMore: offset + limit < alerts.length
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30'
      }
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch alerts'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function sendAlertNotifications(alert: PerformanceAlert): Promise<void> {
  const notifications = [];

  //send to configured webhooks
  if (process.env.PERFORMANCE_WEBHOOK_URL) {
    notifications.push(sendWebhookNotification(alert));
  }

  //send to Slack if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    notifications.push(sendSlackNotification(alert));
  }

  //send email notifications if configured
  if (process.env.EMAIL_ALERT_ENDPOINT) {
    notifications.push(sendEmailNotification(alert));
  }

  //wait for all notifications to complete
  await Promise.allSettled(notifications);
}

async function sendWebhookNotification(alert: PerformanceAlert): Promise<void> {
  try {
    await fetch(process.env.PERFORMANCE_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'performance_alert',
        severity: alert.severity,
        data: alert,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.warn('Failed to send webhook notification:', error);
  }
}

async function sendSlackNotification(alert: PerformanceAlert): Promise<void> {
  try {
    const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    
    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${icon} Performance Alert: ${alert.metric}`,
        attachments: [{
          color,
          fields: [
            { title: 'Metric', value: alert.metric, short: true },
            { title: 'Value', value: alert.value.toString(), short: true },
            { title: 'Threshold', value: alert.threshold.toString(), short: true },
            { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
            { title: 'URL', value: alert.url, short: false },
            { title: 'Session', value: alert.sessionId, short: true },
            { title: 'User', value: alert.userId || 'Anonymous', short: true }
          ],
          footer: 'Performance Monitoring',
          ts: Math.floor(alert.timestamp / 1000)
        }]
      })
    });
  } catch (error) {
    console.warn('Failed to send Slack notification:', error);
  }
}

async function sendEmailNotification(alert: PerformanceAlert): Promise<void> {
  try {
    await fetch(process.env.EMAIL_ALERT_ENDPOINT!, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`
      },
      body: JSON.stringify({
        to: process.env.ALERT_EMAIL_ADDRESS,
        subject: `${alert.severity === 'critical' ? '[CRITICAL]' : '[WARNING]'} Performance Alert: ${alert.metric}`,
        html: `
          <h2>Performance Alert</h2>
          <p><strong>Metric:</strong> ${alert.metric}</p>
          <p><strong>Value:</strong> ${alert.value}</p>
          <p><strong>Threshold:</strong> ${alert.threshold}</p>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          <p><strong>URL:</strong> <a href="${alert.url}">${alert.url}</a></p>
          <p><strong>Session ID:</strong> ${alert.sessionId}</p>
          <p><strong>User:</strong> ${alert.userId || 'Anonymous'}</p>
          <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
        `
      })
    });
  } catch (error) {
    console.warn('Failed to send email notification:', error);
  }
}