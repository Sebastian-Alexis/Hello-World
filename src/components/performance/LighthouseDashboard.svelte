<script lang="ts">
  import { onMount } from 'svelte';
  import type { LighthouseResult, PerformanceRegression, PerformanceTrend } from '../../lib/db/types';
  import { LighthouseCIUtils } from '../../lib/performance/lighthouse-integration';

  //component props
  export let url: string = '';
  export let config: 'desktop' | 'mobile' = 'desktop';
  export let timeRange: string = '30d';

  //component state
  let loading = true;
  let error: string | null = null;
  let results: LighthouseResult[] = [];
  let trends: PerformanceTrend[] = [];
  let regressions: PerformanceRegression[] = [];
  let summary: any = {};
  let insights: string[] = [];

  //performance thresholds for visual indicators
  const THRESHOLDS = {
    performance: { excellent: 95, good: 80 },
    lcp: { good: 2500, needsImprovement: 4000 },
    fcp: { good: 1800, needsImprovement: 3000 },
    cls: { good: 0.1, needsImprovement: 0.25 },
    tbt: { good: 200, needsImprovement: 600 }
  };

  //load performance data
  async function loadPerformanceData() {
    try {
      loading = true;
      error = null;

      const params = new URLSearchParams({
        config,
        range: timeRange
      });

      if (url) {
        params.append('url', url);
      }

      const response = await fetch(`/api/analytics/lighthouse?${params}`);
      const data = await response.json();

      if (data.success) {
        results = data.data.results || [];
        trends = data.data.trends || [];
        regressions = data.data.regressions || [];
        summary = data.data.summary || {};
        insights = data.data.insights || [];
      } else {
        error = data.error || 'Failed to load performance data';
      }
    } catch (err) {
      error = 'Network error loading performance data';
      console.error('Error loading performance data:', err);
    } finally {
      loading = false;
    }
  }

  //get status color based on performance score
  function getScoreColor(score: number, type: 'performance' | 'vitals' = 'performance'): string {
    return 'text-black bg-white border border-black';
  }

  //get Core Web Vitals status
  function getVitalsStatus(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = THRESHOLDS[metric as keyof typeof THRESHOLDS];
    if (!thresholds || typeof thresholds !== 'object' || !('good' in thresholds)) return 'good';
    
    if (value <= thresholds.good) return 'good';
    if ('needsImprovement' in thresholds && value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  //get vitals color based on status
  function getVitalsColor(status: 'good' | 'needs-improvement' | 'poor'): string {
    return 'text-black bg-white border border-black';
  }

  //format metric value for display
  function formatMetricValue(metric: string, value: number): string {
    switch (metric) {
      case 'lcp':
      case 'fcp':
      case 'tbt':
      case 'si':
      case 'tti':
      case 'ttfb':
        return LighthouseCIUtils.formatTiming(value);
      case 'cls':
        return LighthouseCIUtils.formatCLS(value).replace(/🟢|🟡|🔴/, '').trim();
      case 'performance_score':
      case 'accessibility_score':
      case 'best_practices_score':
      case 'seo_score':
        return `${Math.round(value * 100)}`;
      default:
        return value.toString();
    }
  }

  //format trend direction for display
  function formatTrendDirection(direction: 'improving' | 'stable' | 'degrading'): string {
    switch (direction) {
      case 'improving': return '📈 Improving';
      case 'degrading': return '📉 Degrading';
      case 'stable': return '➡️ Stable';
      default: return direction;
    }
  }

  //get regression severity color
  function getRegressionSeverityColor(severity: string): string {
    return 'text-black bg-white border border-black';
  }

  //acknowledge regression
  async function acknowledgeRegression(regressionId: number) {
    try {
      const response = await fetch(`/api/analytics/lighthouse/regressions/${regressionId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acknowledged_by: 'user', //would be actual user in real implementation
          notes: 'Acknowledged from dashboard'
        })
      });

      if (response.ok) {
        //reload data to reflect changes
        await loadPerformanceData();
      }
    } catch (err) {
      console.error('Error acknowledging regression:', err);
    }
  }

  //lifecycle
  onMount(() => {
    loadPerformanceData();
  });

  //reactive statements
  $: if (url || config || timeRange) {
    loadPerformanceData();
  }

  $: latestResult = results.length > 0 ? results[0] : null;
  $: averagePerformance = results.length > 0 ? 
    results.reduce((sum, r) => sum + r.performance_score, 0) / results.length * 100 : 0;
</script>

<div class="lighthouse-dashboard space-y-6">
  <!-- Dashboard Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-light text-black font-mono">Lighthouse CI Performance Dashboard</h2>
      <p class="text-black mt-1 font-mono font-light">
        Continuous performance monitoring and regression detection
      </p>
    </div>
    
    <!-- Controls -->
    <div class="flex items-center space-x-4">
      <select 
        bind:value={config}
        class="px-3 py-2 border border-black bg-white text-black font-mono font-light focus:bg-black focus:text-white"
      >
        <option value="desktop">Desktop</option>
        <option value="mobile">Mobile</option>
      </select>
      
      <select 
        bind:value={timeRange}
        class="px-3 py-2 border border-black bg-white text-black font-mono font-light focus:bg-black focus:text-white"
      >
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
      </select>
      
      <button 
        on:click={loadPerformanceData}
        class="px-4 py-2 bg-white text-black border border-black font-mono font-light hover:bg-black hover:text-white"
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      <span class="ml-3 text-black font-mono font-light">Loading performance data...</span>
    </div>
  {:else if error}
    <div class="bg-white border border-black p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-black" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-light text-black font-mono">Error Loading Data</h3>
          <div class="mt-2 text-sm text-black font-mono font-light">{error}</div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Performance Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Total Tests -->
      <div class="bg-white border border-black p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-white border border-black flex items-center justify-center">
              <svg class="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-light text-black font-mono truncate">Total Tests</dt>
              <dd class="text-lg font-light text-black font-mono">{summary.totalTests || 0}</dd>
            </dl>
          </div>
        </div>
      </div>

      <!-- Average Performance -->
      <div class="bg-white border border-black p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-white border border-black flex items-center justify-center">
              <svg class="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-light text-black font-mono truncate">Avg Performance</dt>
              <dd class="text-lg font-light text-black font-mono">
                <span class={getScoreColor(averagePerformance, 'performance')}>
                  {Math.round(averagePerformance)}
                </span>
              </dd>
            </dl>
          </div>
        </div>
      </div>

      <!-- Recent Regressions -->
      <div class="bg-white border border-black p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-white border border-black flex items-center justify-center">
              <svg class="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-light text-black font-mono truncate">Regressions</dt>
              <dd class="text-lg font-light text-black font-mono">{summary.recentRegressions || 0}</dd>
            </dl>
          </div>
        </div>
      </div>

      <!-- Last Test -->
      <div class="bg-white border border-black p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-white border border-black flex items-center justify-center">
              <svg class="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-light text-black font-mono truncate">Last Test</dt>
              <dd class="text-sm font-light text-black font-mono">
                {summary.lastTestDate ? 
                  new Date(summary.lastTestDate).toLocaleDateString() : 
                  'No tests'
                }
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <!-- Latest Test Results -->
    {#if latestResult}
      <div class="bg-white border border-black">
        <div class="px-6 py-4 border-b border-black">
          <h3 class="text-lg font-light text-black font-mono">Latest Test Results</h3>
          <p class="text-sm text-black font-mono font-light mt-1">
            {latestResult.url} • {new Date(latestResult.timestamp).toLocaleString()}
          </p>
        </div>
        
        <div class="p-6">
          <!-- Lighthouse Scores -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="text-center">
              <div class="text-2xl font-light font-mono {getScoreColor(latestResult.performance_score * 100, 'performance')} px-3 py-2">
                {Math.round(latestResult.performance_score * 100)}
              </div>
              <div class="text-sm text-black font-mono font-light mt-1">Performance</div>
            </div>
            
            <div class="text-center">
              <div class="text-2xl font-light font-mono {getScoreColor(latestResult.accessibility_score * 100, 'performance')} px-3 py-2">
                {Math.round(latestResult.accessibility_score * 100)}
              </div>
              <div class="text-sm text-black font-mono font-light mt-1">Accessibility</div>
            </div>
            
            <div class="text-center">
              <div class="text-2xl font-light font-mono {getScoreColor(latestResult.best_practices_score * 100, 'performance')} px-3 py-2">
                {Math.round(latestResult.best_practices_score * 100)}
              </div>
              <div class="text-sm text-black font-mono font-light mt-1">Best Practices</div>
            </div>
            
            <div class="text-center">
              <div class="text-2xl font-light font-mono {getScoreColor(latestResult.seo_score * 100, 'performance')} px-3 py-2">
                {Math.round(latestResult.seo_score * 100)}
              </div>
              <div class="text-sm text-black font-mono font-light mt-1">SEO</div>
            </div>
          </div>

          <!-- Core Web Vitals -->
          <div class="border-t border-black pt-6">
            <h4 class="text-lg font-light text-black font-mono mb-4">Core Web Vitals</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center">
                <div class="text-lg font-light font-mono {getVitalsColor(getVitalsStatus('lcp', latestResult.lcp))} px-3 py-2">
                  {formatMetricValue('lcp', latestResult.lcp)}
                </div>
                <div class="text-sm text-black font-mono font-light mt-1">LCP</div>
              </div>
              
              <div class="text-center">
                <div class="text-lg font-light font-mono {getVitalsColor(getVitalsStatus('fcp', latestResult.fcp))} px-3 py-2">
                  {formatMetricValue('fcp', latestResult.fcp)}
                </div>
                <div class="text-sm text-black font-mono font-light mt-1">FCP</div>
              </div>
              
              <div class="text-center">
                <div class="text-lg font-light font-mono {getVitalsColor(getVitalsStatus('cls', latestResult.cls))} px-3 py-2">
                  {formatMetricValue('cls', latestResult.cls)}
                </div>
                <div class="text-sm text-black font-mono font-light mt-1">CLS</div>
              </div>
              
              <div class="text-center">
                <div class="text-lg font-light font-mono {getVitalsColor(getVitalsStatus('tbt', latestResult.tbt))} px-3 py-2">
                  {formatMetricValue('tbt', latestResult.tbt)}
                </div>
                <div class="text-sm text-black font-mono font-light mt-1">TBT</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Performance Regressions -->
    {#if regressions.length > 0}
      <div class="bg-white border border-black">
        <div class="px-6 py-4 border-b border-black">
          <h3 class="text-lg font-light text-black font-mono">Performance Regressions</h3>
          <p class="text-sm text-black font-mono font-light mt-1">
            Recent performance regressions detected in your application
          </p>
        </div>
        
        <div class="divide-y divide-black">
          {#each regressions as regression}
            <div class="px-6 py-4">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="flex items-center space-x-3">
                    <span class="px-2 py-1 text-xs font-light font-mono {getRegressionSeverityColor(regression.severity)}">
                      {regression.severity.toUpperCase()}
                    </span>
                    <h4 class="text-sm font-light font-mono text-black">
                      {regression.metric_name} Regression
                    </h4>
                  </div>
                  
                  <p class="text-sm text-black font-mono font-light mt-1">
                    {regression.baseline_value} → {regression.current_value} 
                    ({regression.regression_percentage > 0 ? '+' : ''}{regression.regression_percentage.toFixed(1)}%)
                  </p>
                  
                  <p class="text-xs text-black font-mono font-light mt-1">
                    Detected {new Date(regression.detected_at).toLocaleString()}
                  </p>
                </div>
                
                {#if !regression.acknowledged}
                  <button
                    on:click={() => acknowledgeRegression(regression.id)}
                    class="px-3 py-1 text-xs font-light font-mono text-black bg-white border border-black hover:bg-black hover:text-white"
                  >
                    Acknowledge
                  </button>
                {:else}
                  <span class="text-xs text-black font-mono font-light">Acknowledged</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Performance Trends -->
    {#if trends.length > 0}
      <div class="bg-white border border-black">
        <div class="px-6 py-4 border-b border-black">
          <h3 class="text-lg font-light text-black font-mono">Performance Trends</h3>
          <p class="text-sm text-black font-mono font-light mt-1">
            Long-term performance trends for key metrics
          </p>
        </div>
        
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each trends as trend}
              <div class="border border-black p-4">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-light font-mono text-black">
                    {trend.metric_name.replace('_', ' ').toUpperCase()}
                  </h4>
                  <span class="text-xs text-black font-mono font-light">
                    {formatTrendDirection(trend.trend_direction)}
                  </span>
                </div>
                
                <div class="text-2xl font-light font-mono text-black mb-1">
                  {formatMetricValue(trend.metric_name, trend.avg_value)}
                </div>
                
                <div class="text-xs text-black font-mono font-light">
                  Avg over {trend.sample_count} samples
                </div>
                
                <div class="mt-2 text-xs text-black font-mono font-light">
                  Range: {formatMetricValue(trend.metric_name, trend.min_value)} - {formatMetricValue(trend.metric_name, trend.max_value)}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Performance Insights -->
    {#if insights.length > 0}
      <div class="bg-white border border-black">
        <div class="px-6 py-4 border-b border-black">
          <h3 class="text-lg font-light text-black font-mono">Performance Insights</h3>
          <p class="text-sm text-black font-mono font-light mt-1">
            AI-powered insights and recommendations
          </p>
        </div>
        
        <div class="p-6">
          <ul class="space-y-3">
            {#each insights as insight}
              <li class="flex items-start">
                <div class="flex-shrink-0 mt-0.5">
                  <svg class="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
                <p class="ml-3 text-sm text-black font-mono font-light">{insight}</p>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}

    <!-- Empty State -->
    {#if results.length === 0}
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 class="mt-2 text-sm font-light font-mono text-black">No performance data</h3>
        <p class="mt-1 text-sm text-black font-mono font-light">
          Run Lighthouse CI tests to see performance metrics and trends.
        </p>
        <div class="mt-6">
          <button
            on:click={loadPerformanceData}
            class="inline-flex items-center px-4 py-2 border border-black text-sm font-light font-mono text-black bg-white hover:bg-black hover:text-white"
          >
            Check for Data
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .lighthouse-dashboard {
    max-width: 1200px;
    margin: 0 auto;
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>