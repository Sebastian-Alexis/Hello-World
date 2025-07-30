//lighthouse CI integration with existing performance monitoring system
import { vitalsMonitor, type VitalsMetric, type PerformanceSnapshot } from './vitals-monitor.js';

//lighthouse CI integration types
export interface LighthouseResult {
  url: string;
  timestamp: number;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  audits: {
    lcp: number;
    fcp: number;
    cls: number;
    tbt: number;
    si: number;
    tti: number;
    ttfb: number;
  };
  environment: {
    networkUserAgent: string;
    hostUserAgent: string;
    benchmarkIndex: number;
  };
  config: 'desktop' | 'mobile';
}

export interface PerformanceRegression {
  metric: string;
  current: number;
  baseline: number;
  regression: number; //percentage change
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  timestamp: number;
}

export interface PerformanceTrend {
  metric: string;
  url: string;
  dataPoints: Array<{
    timestamp: number;
    value: number;
    source: 'lighthouse' | 'rum' | 'synthetic';
  }>;
  trend: 'improving' | 'stable' | 'degrading';
  trendStrength: number; //0-1 scale
}

//lighthouse CI integration class
export class LighthouseCIIntegration {
  private baselineStorage = new Map<string, LighthouseResult>();
  private regressionThresholds = {
    performance: { medium: 5, high: 10, critical: 20 }, //percentage drops
    lcp: { medium: 10, high: 20, critical: 50 }, //percentage increases
    fcp: { medium: 10, high: 20, critical: 50 },
    cls: { medium: 25, high: 50, critical: 100 },
    tbt: { medium: 15, high: 30, critical: 75 },
    ttfb: { medium: 20, high: 40, critical: 100 }
  };

  constructor(private alertingEndpoint?: string) {
    //initialize baseline data from storage
    this.loadBaselines();
  }

  //process lighthouse CI results
  async processLighthouseResults(results: LighthouseResult[]): Promise<void> {
    for (const result of results) {
      //store result for trend analysis
      await this.storeResult(result);
      
      //check for regressions
      const regressions = await this.detectRegressions(result);
      
      //send alerts if regressions found
      if (regressions.length > 0) {
        await this.sendRegressionAlerts(regressions);
      }
      
      //integrate with existing vitals monitoring
      await this.integrateWithVitalsMonitor(result);
      
      //update baseline if performance improved
      await this.updateBaseline(result);
    }
  }

  //detect performance regressions
  async detectRegressions(current: LighthouseResult): Promise<PerformanceRegression[]> {
    const baseline = this.baselineStorage.get(current.url);
    if (!baseline) {
      //no baseline exists, store current as baseline
      this.baselineStorage.set(current.url, current);
      return [];
    }

    const regressions: PerformanceRegression[] = [];

    //check performance score regression
    const perfRegression = this.calculateRegression(
      current.scores.performance * 100,
      baseline.scores.performance * 100
    );
    
    if (perfRegression < -this.regressionThresholds.performance.medium) {
      regressions.push({
        metric: 'Performance Score',
        current: current.scores.performance * 100,
        baseline: baseline.scores.performance * 100,
        regression: perfRegression,
        severity: this.getSeverity('performance', Math.abs(perfRegression)),
        url: current.url,
        timestamp: current.timestamp
      });
    }

    //check Core Web Vitals regressions
    const vitalsChecks = [
      { key: 'lcp', name: 'Largest Contentful Paint' },
      { key: 'fcp', name: 'First Contentful Paint' },
      { key: 'cls', name: 'Cumulative Layout Shift' },
      { key: 'tbt', name: 'Total Blocking Time' },
      { key: 'ttfb', name: 'Time to First Byte' }
    ];

    for (const check of vitalsChecks) {
      const currentValue = current.audits[check.key as keyof typeof current.audits];
      const baselineValue = baseline.audits[check.key as keyof typeof baseline.audits];
      
      if (currentValue && baselineValue) {
        const regression = this.calculateRegression(currentValue, baselineValue);
        const threshold = this.regressionThresholds[check.key as keyof typeof this.regressionThresholds];
        
        if (regression > threshold.medium) {
          regressions.push({
            metric: check.name,
            current: currentValue,
            baseline: baselineValue,
            regression: regression,
            severity: this.getSeverity(check.key, regression),
            url: current.url,
            timestamp: current.timestamp
          });
        }
      }
    }

    return regressions;
  }

  //calculate performance regression percentage
  private calculateRegression(current: number, baseline: number): number {
    if (baseline === 0) return 0;
    return ((current - baseline) / baseline) * 100;
  }

  //determine regression severity
  private getSeverity(metric: string, regressionPercent: number): PerformanceRegression['severity'] {
    const thresholds = this.regressionThresholds[metric as keyof typeof this.regressionThresholds];
    if (!thresholds) return 'low';
    
    if (regressionPercent >= thresholds.critical) return 'critical';
    if (regressionPercent >= thresholds.high) return 'high';
    if (regressionPercent >= thresholds.medium) return 'medium';
    return 'low';
  }

  //integrate lighthouse results with existing vitals monitoring
  private async integrateWithVitalsMonitor(result: LighthouseResult): Promise<void> {
    //create vitals metrics from lighthouse data
    const lighthouseMetrics: VitalsMetric[] = [
      {
        name: 'LCP',
        value: result.audits.lcp,
        rating: result.audits.lcp <= 2500 ? 'good' : result.audits.lcp <= 4000 ? 'needs-improvement' : 'poor',
        delta: result.audits.lcp,
        entries: [],
        id: `lighthouse-${Date.now()}-lcp`,
        navigationType: 'lighthouse-ci',
        timestamp: result.timestamp
      },
      {
        name: 'FCP',
        value: result.audits.fcp,
        rating: result.audits.fcp <= 1800 ? 'good' : result.audits.fcp <= 3000 ? 'needs-improvement' : 'poor',
        delta: result.audits.fcp,
        entries: [],
        id: `lighthouse-${Date.now()}-fcp`,
        navigationType: 'lighthouse-ci',
        timestamp: result.timestamp
      },
      {
        name: 'CLS',
        value: result.audits.cls,
        rating: result.audits.cls <= 0.1 ? 'good' : result.audits.cls <= 0.25 ? 'needs-improvement' : 'poor',
        delta: result.audits.cls,
        entries: [],
        id: `lighthouse-${Date.now()}-cls`,
        navigationType: 'lighthouse-ci',
        timestamp: result.timestamp
      }
    ];

    //send metrics to existing monitoring system
    for (const metric of lighthouseMetrics) {
      vitalsMonitor.recordCustomMetric(`lighthouse-${metric.name.toLowerCase()}`, metric.value, {
        source: 'lighthouse-ci',
        url: result.url,
        config: result.config,
        rating: metric.rating,
        benchmarkIndex: result.environment.benchmarkIndex
      });
    }
  }

  //send regression alerts
  private async sendRegressionAlerts(regressions: PerformanceRegression[]): Promise<void> {
    if (!this.alertingEndpoint) return;

    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    const highRegressions = regressions.filter(r => r.severity === 'high');

    if (criticalRegressions.length > 0 || highRegressions.length > 0) {
      const alertPayload = {
        type: 'performance-regression',
        severity: criticalRegressions.length > 0 ? 'critical' : 'high',
        timestamp: Date.now(),
        regressions: regressions,
        summary: {
          totalRegressions: regressions.length,
          criticalCount: criticalRegressions.length,
          highCount: highRegressions.length,
          affectedUrls: [...new Set(regressions.map(r => r.url))]
        }
      };

      try {
        await fetch(this.alertingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(alertPayload)
        });
      } catch (error) {
        console.error('Failed to send regression alert:', error);
      }
    }
  }

  //store lighthouse result for trend analysis
  private async storeResult(result: LighthouseResult): Promise<void> {
    //store in database via API
    try {
      await fetch('/api/analytics/lighthouse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(result)
      });
    } catch (error) {
      console.error('Failed to store lighthouse result:', error);
    }
  }

  //update baseline if current result is better
  private async updateBaseline(current: LighthouseResult): Promise<void> {
    const baseline = this.baselineStorage.get(current.url);
    
    if (!baseline || this.shouldUpdateBaseline(current, baseline)) {
      this.baselineStorage.set(current.url, current);
      await this.saveBaselines();
    }
  }

  //determine if baseline should be updated
  private shouldUpdateBaseline(current: LighthouseResult, baseline: LighthouseResult): boolean {
    //update if overall performance is significantly better
    const performanceImprovement = current.scores.performance - baseline.scores.performance;
    
    //or if Core Web Vitals are all better
    const lcpImprovement = baseline.audits.lcp - current.audits.lcp;
    const fcpImprovement = baseline.audits.fcp - current.audits.fcp;
    const clsImprovement = baseline.audits.cls - current.audits.cls;
    
    return performanceImprovement > 0.05 || // 5% performance improvement
           (lcpImprovement > 100 && fcpImprovement > 100 && clsImprovement > 0.02); // All core vitals improved
  }

  //analyze performance trends
  async analyzePerformanceTrends(url: string, days: number = 30): Promise<PerformanceTrend[]> {
    try {
      const response = await fetch(`/api/analytics/trends?url=${encodeURIComponent(url)}&days=${days}`);
      const data = await response.json();
      
      return data.trends || [];
    } catch (error) {
      console.error('Failed to analyze performance trends:', error);
      return [];
    }
  }

  //generate performance insights
  generatePerformanceInsights(trends: PerformanceTrend[]): string[] {
    const insights: string[] = [];
    
    trends.forEach(trend => {
      if (trend.trend === 'degrading' && trend.trendStrength > 0.7) {
        insights.push(`${trend.metric} is consistently degrading on ${trend.url}`);
      } else if (trend.trend === 'improving' && trend.trendStrength > 0.7) {
        insights.push(`${trend.metric} shows consistent improvement on ${trend.url}`);
      }
    });
    
    return insights;
  }

  //load baselines from storage
  private loadBaselines(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('lighthouse-baselines');
        if (stored) {
          const baselines = JSON.parse(stored);
          Object.entries(baselines).forEach(([url, result]) => {
            this.baselineStorage.set(url, result as LighthouseResult);
          });
        }
      } catch (error) {
        console.error('Failed to load baselines:', error);
      }
    }
  }

  //save baselines to storage
  private async saveBaselines(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      try {
        const baselines = Object.fromEntries(this.baselineStorage);
        localStorage.setItem('lighthouse-baselines', JSON.stringify(baselines));
      } catch (error) {
        console.error('Failed to save baselines:', error);
      }
    }
  }

  //public API methods
  public async getPerformanceReport(url: string): Promise<any> {
    const trends = await this.analyzePerformanceTrends(url);
    const insights = this.generatePerformanceInsights(trends);
    const baseline = this.baselineStorage.get(url);
    
    return {
      url,
      baseline,
      trends,
      insights,
      timestamp: Date.now()
    };
  }

  public getBaseline(url: string): LighthouseResult | undefined {
    return this.baselineStorage.get(url);
  }

  public clearBaselines(): void {
    this.baselineStorage.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('lighthouse-baselines');
    }
  }
}

//singleton instance
export const lighthouseCIIntegration = new LighthouseCIIntegration(
  process.env.NODE_ENV === 'production' ? '/api/analytics/alerts' : undefined
);

//utility functions for Lighthouse CI integration
export const LighthouseCIUtils = {
  //format lighthouse score for display
  formatScore: (score: number): string => {
    const percentage = Math.round(score * 100);
    const emoji = percentage >= 95 ? '🟢' : percentage >= 80 ? '🟡' : '🔴';
    return `${emoji} ${percentage}`;
  },

  //format timing metrics
  formatTiming: (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  },

  //format CLS score
  formatCLS: (cls: number): string => {
    const emoji = cls <= 0.1 ? '🟢' : cls <= 0.25 ? '🟡' : '🔴';
    return `${emoji} ${cls.toFixed(3)}`;
  },

  //determine if metrics meet thresholds
  meetsThresholds: (result: LighthouseResult): boolean => {
    return (
      result.scores.performance >= 0.95 &&
      result.audits.lcp <= 2500 &&
      result.audits.fcp <= 1800 &&
      result.audits.cls <= 0.1 &&
      result.audits.tbt <= 200
    );
  },

  //calculate performance grade
  getPerformanceGrade: (result: LighthouseResult): 'A' | 'B' | 'C' | 'D' | 'F' => {
    const score = result.scores.performance * 100;
    if (score >= 95) return 'A';
    if (score >= 85) return 'B';
    if (score >= 75) return 'C';
    if (score >= 65) return 'D';
    return 'F';
  }
};