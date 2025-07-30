import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';
import type { LighthouseResult } from '../../../lib/performance/lighthouse-integration';

export const POST: APIRoute = async ({ request }) => {
  try {
    const db = new DatabaseQueries();
    const lighthouseResult: LighthouseResult = await request.json();

    //validate lighthouse result structure
    if (!lighthouseResult.url || !lighthouseResult.scores || !lighthouseResult.audits) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid lighthouse result structure'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    //store lighthouse result in database
    const storedResult = await db.createLighthouseResult({
      url: lighthouseResult.url,
      timestamp: lighthouseResult.timestamp || Date.now(),
      config: lighthouseResult.config || 'desktop',
      performance_score: lighthouseResult.scores.performance,
      accessibility_score: lighthouseResult.scores.accessibility,
      best_practices_score: lighthouseResult.scores.bestPractices,
      seo_score: lighthouseResult.scores.seo,
      lcp: lighthouseResult.audits.lcp,
      fcp: lighthouseResult.audits.fcp,
      cls: lighthouseResult.audits.cls,
      tbt: lighthouseResult.audits.tbt,
      si: lighthouseResult.audits.si,
      tti: lighthouseResult.audits.tti,
      ttfb: lighthouseResult.audits.ttfb,
      environment_data: JSON.stringify(lighthouseResult.environment)
    });

    //check for performance regressions
    const baseline = await db.getLighthouseBaseline(lighthouseResult.url, lighthouseResult.config);
    let regressionDetected = false;

    if (baseline) {
      //compare with baseline and detect regressions
      const performanceRegression = ((baseline.performance_score - lighthouseResult.scores.performance) / baseline.performance_score) * 100;
      const lcpRegression = ((lighthouseResult.audits.lcp - baseline.lcp) / baseline.lcp) * 100;
      
      if (performanceRegression > 5 || lcpRegression > 10) {
        regressionDetected = true;
        
        //store regression record
        await db.createPerformanceRegression({
          lighthouse_result_id: storedResult.id,
          baseline_result_id: baseline.id,
          metric_name: performanceRegression > 5 ? 'performance_score' : 'lcp',
          current_value: performanceRegression > 5 ? lighthouseResult.scores.performance : lighthouseResult.audits.lcp,
          baseline_value: performanceRegression > 5 ? baseline.performance_score : baseline.lcp,
          regression_percentage: performanceRegression > 5 ? performanceRegression : lcpRegression,
          severity: performanceRegression > 20 || lcpRegression > 50 ? 'critical' : 
                   performanceRegression > 10 || lcpRegression > 25 ? 'high' : 'medium',
          detected_at: Date.now()
        });

        //trigger alert webhook if configured
        if (process.env.PERFORMANCE_ALERT_WEBHOOK) {
          await triggerPerformanceAlert({
            type: 'regression-detected',
            url: lighthouseResult.url,
            regression: performanceRegression > 5 ? {
              metric: 'Performance Score',
              current: lighthouseResult.scores.performance,
              baseline: baseline.performance_score,
              regression: performanceRegression
            } : {
              metric: 'Largest Contentful Paint',
              current: lighthouseResult.audits.lcp,
              baseline: baseline.lcp,
              regression: lcpRegression
            }
          });
        }
      }
    }

    //update baseline if current result is better
    if (!baseline || lighthouseResult.scores.performance > baseline.performance_score) {
      await db.updateLighthouseBaseline({
        url: lighthouseResult.url,
        config: lighthouseResult.config,
        result_id: storedResult.id
      });
    }

    return new Response(JSON.stringify({
      success: true,
      result_id: storedResult.id,
      regression_detected: regressionDetected,
      baseline_updated: !baseline || lighthouseResult.scores.performance > baseline.performance_score
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing lighthouse result:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process lighthouse result'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const db = new DatabaseQueries();
    const searchParams = new URL(url).searchParams;
    
    const targetUrl = searchParams.get('url');
    const config = searchParams.get('config') || 'desktop';
    const timeRange = searchParams.get('range') || '30d';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!targetUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: 'URL parameter is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    //get lighthouse results for the URL
    const results = await db.getLighthouseResults({
      url: targetUrl,
      config: config as 'desktop' | 'mobile',
      timeRange,
      limit
    });

    //get performance trends
    const trends = await db.getLighthousePerformanceTrends({
      url: targetUrl,
      config: config as 'desktop' | 'mobile',
      timeRange
    });

    //get recent regressions
    const regressions = await db.getLighthouseRegressions({
      url: targetUrl,
      timeRange: '7d' //last 7 days
    });

    //calculate performance insights
    const insights = generatePerformanceInsights(results, trends);

    return new Response(JSON.stringify({
      success: true,
      data: {
        url: targetUrl,
        config,
        results,
        trends,
        regressions,
        insights,
        summary: {
          totalTests: results.length,
          averagePerformance: results.length > 0 ? 
            results.reduce((sum, r) => sum + r.performance_score, 0) / results.length : 0,
          recentRegressions: regressions.length,
          lastTestDate: results.length > 0 ? results[0].timestamp : null
        }
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' //5 minutes cache
      }
    });

  } catch (error) {
    console.error('Error fetching lighthouse data:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch lighthouse data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

//helper function to trigger performance alerts
async function triggerPerformanceAlert(alertData: any): Promise<void> {
  const webhook = process.env.PERFORMANCE_ALERT_WEBHOOK;
  if (!webhook) return;

  try {
    //format alert message
    const message = formatAlertMessage(alertData);
    
    //determine webhook type and format payload accordingly
    let payload;
    if (webhook.includes('slack.com')) {
      payload = {
        text: `🚨 Performance Regression Detected`,
        attachments: [{
          color: 'danger',
          fields: [
            { title: 'URL', value: alertData.url, short: true },
            { title: 'Metric', value: alertData.regression.metric, short: true },
            { title: 'Current Value', value: alertData.regression.current.toString(), short: true },
            { title: 'Baseline Value', value: alertData.regression.baseline.toString(), short: true },
            { title: 'Regression', value: `${alertData.regression.regression.toFixed(1)}%`, short: true }
          ],
          timestamp: Math.floor(Date.now() / 1000)
        }]
      };
    } else if (webhook.includes('discord.com')) {
      payload = {
        embeds: [{
          title: '🚨 Performance Regression Detected',
          color: 0xff0000,
          fields: [
            { name: 'URL', value: alertData.url, inline: true },
            { name: 'Metric', value: alertData.regression.metric, inline: true },
            { name: 'Regression', value: `${alertData.regression.regression.toFixed(1)}%`, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      };
    } else {
      //generic webhook format
      payload = {
        alert_type: 'performance_regression',
        message,
        data: alertData,
        timestamp: Date.now()
      };
    }

    await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

  } catch (error) {
    console.error('Failed to send performance alert:', error);
  }
}

//helper function to format alert messages
function formatAlertMessage(alertData: any): string {
  const { url, regression } = alertData;
  return `Performance regression detected on ${url}: ${regression.metric} increased by ${regression.regression.toFixed(1)}% (${regression.baseline} → ${regression.current})`;
}

//helper function to generate performance insights
function generatePerformanceInsights(results: any[], trends: any[]): string[] {
  const insights: string[] = [];

  if (results.length === 0) {
    return ['No lighthouse results available for analysis'];
  }

  //analyze recent performance trends
  const recentResults = results.slice(0, 10);
  const avgPerformance = recentResults.reduce((sum, r) => sum + r.performance_score, 0) / recentResults.length;

  if (avgPerformance >= 0.95) {
    insights.push('Excellent performance scores maintained consistently');
  } else if (avgPerformance >= 0.85) {
    insights.push('Good performance scores with room for optimization');
  } else {
    insights.push('Performance scores below target - immediate attention needed');
  }

  //analyze Core Web Vitals trends
  const avgLCP = recentResults.reduce((sum, r) => sum + r.lcp, 0) / recentResults.length;
  const avgCLS = recentResults.reduce((sum, r) => sum + r.cls, 0) / recentResults.length;

  if (avgLCP <= 2500 && avgCLS <= 0.1) {
    insights.push('Core Web Vitals meet Google recommendations');
  } else {
    const issues = [];
    if (avgLCP > 2500) issues.push('LCP');
    if (avgCLS > 0.1) issues.push('CLS');
    insights.push(`Core Web Vitals need improvement: ${issues.join(', ')}`);
  }

  //analyze trends over time
  trends.forEach(trend => {
    if (trend.trend === 'degrading' && trend.strength > 0.7) {
      insights.push(`${trend.metric} shows consistent degradation - investigate recent changes`);
    } else if (trend.trend === 'improving' && trend.strength > 0.7) {
      insights.push(`${trend.metric} shows consistent improvement - optimizations working well`);
    }
  });

  //performance budget analysis
  const avgTotalSize = recentResults.reduce((sum, r) => sum + (r.total_byte_weight || 0), 0) / recentResults.length;
  if (avgTotalSize > 1600000) { //1.6MB
    insights.push('Bundle size exceeds performance budget - consider code splitting');
  }

  return insights;
}