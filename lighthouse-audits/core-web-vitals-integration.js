//custom lighthouse audit for Core Web Vitals integration
const Audit = require('lighthouse').Audit;

class CoreWebVitalsIntegrationAudit extends Audit {
  static get meta() {
    return {
      id: 'core-web-vitals-integration',
      title: 'Core Web Vitals Integration',
      failureTitle: 'Core Web Vitals integration issues detected',
      description: 'Validates integration with existing Core Web Vitals monitoring system and checks for proper metric collection.',
      supportedModes: ['navigation'],
      requiredArtifacts: ['traces', 'devtoolsLogs']
    };
  }

  static audit(artifacts, context) {
    const trace = artifacts.traces[Audit.DEFAULT_PASS];
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
    
    //analyze trace for Core Web Vitals markers
    const traceEvents = trace.traceEvents;
    const vitalsEvents = traceEvents.filter(event => 
      event.name && (
        event.name.includes('largest-contentful-paint') ||
        event.name.includes('first-contentful-paint') ||
        event.name.includes('layout-shift') ||
        event.name.includes('first-input')
      )
    );

    //check for web-vitals library usage
    const scriptUrls = devtoolsLog
      .filter(entry => entry.method === 'Network.responseReceived')
      .map(entry => entry.params.response.url)
      .filter(url => url.includes('web-vitals') || url.includes('vitals'));

    //check for custom performance monitoring
    const performanceMarks = traceEvents.filter(event => 
      event.name === 'navigationStart' || 
      event.name.includes('performance.mark') ||
      (event.args && event.args.data && event.args.data.navigationId)
    );

    const issues = [];
    let score = 100;

    //validate Core Web Vitals collection
    if (vitalsEvents.length === 0) {
      issues.push('No Core Web Vitals events detected in trace');
      score -= 30;
    }

    //validate web-vitals library
    if (scriptUrls.length === 0) {
      issues.push('web-vitals library not detected - ensure proper integration');
      score -= 25;
    }

    //validate custom performance monitoring
    if (performanceMarks.length < 3) {
      issues.push('Limited performance monitoring markers detected');
      score -= 20;
    }

    //check for vitals-monitor integration
    const vitalsMonitorEvents = traceEvents.filter(event => 
      event.args && event.args.data && 
      (event.args.data.toString().includes('vitalsMonitor') ||
       event.args.data.toString().includes('performanceTracker'))
    );

    if (vitalsMonitorEvents.length === 0) {
      issues.push('Custom vitals monitoring integration not detected');
      score -= 25;
    }

    const passed = score >= 80;
    
    return {
      score: Math.max(0, score) / 100,
      numericValue: issues.length,
      numericUnit: 'count',
      displayValue: passed ? 
        'Core Web Vitals integration is properly configured' :
        `${issues.length} integration issues detected`,
      details: {
        type: 'table',
        headings: [
          {key: 'issue', itemType: 'text', text: 'Integration Issue'},
          {key: 'severity', itemType: 'text', text: 'Severity'}
        ],
        items: issues.map(issue => ({
          issue,
          severity: issue.includes('not detected') ? 'High' : 'Medium'
        }))
      }
    };
  }
}

module.exports = CoreWebVitalsIntegrationAudit;