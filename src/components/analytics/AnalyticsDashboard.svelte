<script lang="ts">
  import { onMount } from 'svelte';
  
  // Props
  export let timeframe: '7d' | '30d' | '90d' | '1y' = '30d';
  export let autoRefresh = false;
  export let refreshInterval = 300000; // 5 minutes

  // State
  let loading = false;
  let error = '';
  let analytics = null;
  let refreshTimer: NodeJS.Timeout | null = null;

  // Timeframe options
  const timeframeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' }
  ];

  onMount(() => {
    loadAnalytics();
    
    if (autoRefresh) {
      startAutoRefresh();
    }

    // Cleanup on component destroy
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  });

  async function loadAnalytics() {
    loading = true;
    error = '';

    try {
      const response = await fetch(`/api/analytics/dashboard?timeframe=${timeframe}&detailed=true`);
      const data = await response.json();
      
      if (data.success) {
        analytics = data.data;
      } else {
        error = data.error || 'Failed to load analytics';
      }
    } catch (err) {
      error = 'Network error loading analytics';
      console.error('Analytics error:', err);
    } finally {
      loading = false;
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    
    refreshTimer = setInterval(() => {
      loadAnalytics();
    }, refreshInterval);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // Handle timeframe change
  $: if (timeframe) {
    loadAnalytics();
  }

  // Toggle auto-refresh
  $: if (autoRefresh) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }

  // Format numbers for display
  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Format percentage
  function formatPercentage(value: number, total: number): string {
    if (total === 0) return '0%';
    return ((value / total) * 100).toFixed(1) + '%';
  }

  // Get trend indicator
  function getTrendColor(current: number, previous: number): string {
    if (current > previous) return 'text-green-600 dark:text-green-400';
    if (current < previous) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  }
</script>

<div class="analytics-dashboard">
  <!-- Dashboard Header -->
  <div class="dashboard-header">
    <div class="header-content">
      <h2 class="dashboard-title">Portfolio Analytics</h2>
      <p class="dashboard-subtitle">
        Insights into portfolio performance and visitor engagement
      </p>
    </div>

    <div class="dashboard-controls">
      <!-- Timeframe Selector -->
      <div class="control-group">
        <label for="timeframe-select" class="control-label">Timeframe:</label>
        <select id="timeframe-select" bind:value={timeframe} class="timeframe-select">
          {#each timeframeOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Auto-refresh Toggle -->
      <div class="control-group">
        <label class="auto-refresh-toggle">
          <input type="checkbox" bind:checked={autoRefresh} />
          <span class="toggle-label">Auto-refresh</span>
        </label>
      </div>

      <!-- Manual Refresh -->
      <button 
        on:click={loadAnalytics} 
        disabled={loading}
        class="refresh-btn"
        title="Refresh data"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23,4 23,10 17,10"/>
          <polyline points="1,20 1,14 7,14"/>
          <path d="m3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  </div>

  <!-- Loading State -->
  {#if loading && !analytics}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading analytics data...</p>
    </div>
  {/if}

  <!-- Error State -->
  {#if error}
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h3>Error Loading Analytics</h3>
        <p>{error}</p>
        <button on:click={loadAnalytics} class="retry-btn">
          Try Again
        </button>
      </div>
    </div>
  {/if}

  <!-- Analytics Content -->
  {#if analytics && !error}
    <!-- Overview Stats -->
    <div class="overview-stats">
      <div class="stat-card">
        <div class="stat-icon">👀</div>
        <div class="stat-content">
          <div class="stat-value">{formatNumber(analytics.overview.totalProjectViews)}</div>
          <div class="stat-label">Project Views</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-content">
          <div class="stat-value">{analytics.overview.uniqueProjectsViewed}</div>
          <div class="stat-label">Projects Viewed</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📄</div>
        <div class="stat-content">
          <div class="stat-value">{formatNumber(analytics.overview.totalPageViews)}</div>
          <div class="stat-label">Page Views</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-content">
          <div class="stat-value">{formatNumber(analytics.overview.totalSkillInteractions)}</div>
          <div class="stat-label">Skill Interactions</div>
        </div>
      </div>
    </div>

    <!-- Charts and Details -->
    <div class="analytics-grid">
      <!-- Top Projects -->
      <div class="analytics-card">
        <div class="card-header">
          <h3 class="card-title">Top Projects</h3>
          <p class="card-subtitle">Most viewed projects in selected timeframe</p>
        </div>
        
        <div class="card-content">
          {#if analytics.topProjects && analytics.topProjects.length > 0}
            <div class="projects-list">
              {#each analytics.topProjects as project, index}
                <div class="project-item">
                  <div class="project-rank">#{index + 1}</div>
                  <div class="project-info">
                    <div class="project-title">{project.title}</div>
                    <div class="project-stats">
                      <span class="stat">
                        {project.period_views} views this period
                      </span>
                      <span class="stat total">
                        {formatNumber(project.total_views)} total
                      </span>
                    </div>
                  </div>
                  <div class="project-actions">
                    <a href={`/portfolio/${project.slug}`} class="view-project">
                      View
                    </a>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <p>No project data available for this timeframe</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Daily Views Chart -->
      <div class="analytics-card">
        <div class="card-header">
          <h3 class="card-title">Daily Activity</h3>
          <p class="card-subtitle">Views and interactions over time</p>
        </div>
        
        <div class="card-content">
          {#if analytics.dailyViews && Object.keys(analytics.dailyViews).length > 0}
            <div class="daily-chart">
              {#each Object.entries(analytics.dailyViews).slice(0, 14) as [date, data]}
                <div class="day-bar">
                  <div class="bar-container">
                    <div 
                      class="bar project-views" 
                      style="height: {Math.max(4, (data.project_views / Math.max(...Object.values(analytics.dailyViews).map(d => d.total))) * 100)}px"
                      title="Project views: {data.project_views}"
                    ></div>
                    <div 
                      class="bar page-views" 
                      style="height: {Math.max(4, (data.page_views / Math.max(...Object.values(analytics.dailyViews).map(d => d.total))) * 100)}px"
                      title="Page views: {data.page_views}"
                    ></div>
                  </div>
                  <div class="day-label">
                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              {/each}
            </div>
            
            <div class="chart-legend">
              <div class="legend-item">
                <div class="legend-color project-views"></div>
                <span>Project Views</span>
              </div>
              <div class="legend-item">
                <div class="legend-color page-views"></div>
                <span>Page Views</span>
              </div>
            </div>
          {:else}
            <div class="empty-state">
              <p>No daily activity data available</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Traffic Sources -->
      {#if analytics.trafficSources}
        <div class="analytics-card">
          <div class="card-header">
            <h3 class="card-title">Traffic Sources</h3>
            <p class="card-subtitle">Where visitors are coming from</p>
          </div>
          
          <div class="card-content">
            <div class="traffic-sources">
              <div class="source-item">
                <div class="source-info">
                  <span class="source-label">Direct</span>
                  <span class="source-count">{analytics.trafficSources.direct}</span>
                </div>
                <div class="source-bar">
                  <div class="bar-fill direct" style="width: {formatPercentage(analytics.trafficSources.direct, analytics.trafficSources.direct + analytics.trafficSources.search + analytics.trafficSources.social + analytics.trafficSources.referral)}"></div>
                </div>
              </div>
              
              <div class="source-item">
                <div class="source-info">
                  <span class="source-label">Search</span>
                  <span class="source-count">{analytics.trafficSources.search}</span>
                </div>
                <div class="source-bar">
                  <div class="bar-fill search" style="width: {formatPercentage(analytics.trafficSources.search, analytics.trafficSources.direct + analytics.trafficSources.search + analytics.trafficSources.social + analytics.trafficSources.referral)}"></div>
                </div>
              </div>
              
              <div class="source-item">
                <div class="source-info">
                  <span class="source-label">Social</span>
                  <span class="source-count">{analytics.trafficSources.social}</span>
                </div>
                <div class="source-bar">
                  <div class="bar-fill social" style="width: {formatPercentage(analytics.trafficSources.social, analytics.trafficSources.direct + analytics.trafficSources.search + analytics.trafficSources.social + analytics.trafficSources.referral)}"></div>
                </div>
              </div>
              
              <div class="source-item">
                <div class="source-info">
                  <span class="source-label">Referral</span>
                  <span class="source-count">{analytics.trafficSources.referral}</span>
                </div>
                <div class="source-bar">
                  <div class="bar-fill referral" style="width: {formatPercentage(analytics.trafficSources.referral, analytics.trafficSources.direct + analytics.trafficSources.search + analytics.trafficSources.social + analytics.trafficSources.referral)}"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Popular Pages -->
      {#if analytics.pageViews && Object.keys(analytics.pageViews).length > 0}
        <div class="analytics-card">
          <div class="card-header">
            <h3 class="card-title">Popular Pages</h3>
            <p class="card-subtitle">Most visited pages</p>
          </div>
          
          <div class="card-content">
            <div class="pages-list">
              {#each Object.entries(analytics.pageViews).slice(0, 10) as [path, views]}
                <div class="page-item">
                  <div class="page-path">{path}</div>
                  <div class="page-views">{views} views</div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Data Updated Timestamp -->
    <div class="data-timestamp">
      <p class="timestamp-text">
        Data updated: {new Date().toLocaleString()}
        {#if autoRefresh}
          • Auto-refreshing every {Math.floor(refreshInterval / 1000 / 60)} minutes
        {/if}
      </p>
    </div>
  {/if}
</div>

<style>
  .analytics-dashboard {
    @apply space-y-8;
  }

  .dashboard-header {
    @apply flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6;
  }

  .header-content {
    @apply flex-1;
  }

  .dashboard-title {
    @apply text-3xl font-bold text-gray-900 dark:text-white mb-2;
  }

  .dashboard-subtitle {
    @apply text-gray-600 dark:text-gray-400 text-lg;
  }

  .dashboard-controls {
    @apply flex flex-wrap items-center gap-4;
  }

  .control-group {
    @apply flex items-center space-x-2;
  }

  .control-label {
    @apply text-sm font-medium text-gray-700 dark:text-gray-300;
  }

  .timeframe-select {
    @apply px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm;
  }

  .auto-refresh-toggle {
    @apply flex items-center space-x-2 cursor-pointer;
  }

  .toggle-label {
    @apply text-sm text-gray-700 dark:text-gray-300 select-none;
  }

  .refresh-btn {
    @apply inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .loading-container {
    @apply flex flex-col items-center justify-center py-16 text-center;
  }

  .loading-spinner {
    @apply w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4;
  }

  .error-container {
    @apply flex items-center justify-center py-16;
  }

  .error-icon {
    @apply text-6xl mr-6;
  }

  .error-content h3 {
    @apply text-xl font-semibold text-gray-900 dark:text-white mb-2;
  }

  .error-content p {
    @apply text-gray-600 dark:text-gray-400 mb-4;
  }

  .retry-btn {
    @apply bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors;
  }

  .overview-stats {
    @apply grid grid-cols-2 lg:grid-cols-4 gap-6;
  }

  .stat-card {
    @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex items-center space-x-4;
  }

  .stat-icon {
    @apply text-3xl flex-shrink-0;
  }

  .stat-content {
    @apply flex-1 min-w-0;
  }

  .stat-value {
    @apply text-2xl font-bold text-gray-900 dark:text-white;
  }

  .stat-label {
    @apply text-sm text-gray-600 dark:text-gray-400;
  }

  .analytics-grid {
    @apply grid grid-cols-1 lg:grid-cols-2 gap-6;
  }

  .analytics-card {
    @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden;
  }

  .card-header {
    @apply p-6 border-b border-gray-200 dark:border-gray-700;
  }

  .card-title {
    @apply text-lg font-semibold text-gray-900 dark:text-white mb-1;
  }

  .card-subtitle {
    @apply text-sm text-gray-600 dark:text-gray-400;
  }

  .card-content {
    @apply p-6;
  }

  .empty-state {
    @apply text-center py-8;
  }

  .empty-state p {
    @apply text-gray-500 dark:text-gray-400;
  }

  .projects-list {
    @apply space-y-4;
  }

  .project-item {
    @apply flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg;
  }

  .project-rank {
    @apply w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0;
  }

  .project-info {
    @apply flex-1 min-w-0;
  }

  .project-title {
    @apply font-medium text-gray-900 dark:text-white truncate;
  }

  .project-stats {
    @apply flex items-center space-x-3 text-xs text-gray-600 dark:text-gray-400;
  }

  .stat.total {
    @apply text-gray-500 dark:text-gray-500;
  }

  .view-project {
    @apply text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium;
  }

  .daily-chart {
    @apply flex items-end justify-center space-x-2 h-32 mb-4;
  }

  .day-bar {
    @apply flex flex-col items-center;
  }

  .bar-container {
    @apply flex items-end space-x-1 h-24 mb-2;
  }

  .bar {
    @apply w-3 rounded-t;
    min-height: 4px;
  }

  .bar.project-views {
    @apply bg-blue-500;
  }

  .bar.page-views {
    @apply bg-green-500;
  }

  .day-label {
    @apply text-xs text-gray-600 dark:text-gray-400 text-center;
  }

  .chart-legend {
    @apply flex justify-center space-x-6;
  }

  .legend-item {
    @apply flex items-center space-x-2;
  }

  .legend-color {
    @apply w-3 h-3 rounded-full;
  }

  .legend-color.project-views {
    @apply bg-blue-500;
  }

  .legend-color.page-views {
    @apply bg-green-500;
  }

  .traffic-sources {
    @apply space-y-4;
  }

  .source-item {
    @apply space-y-2;
  }

  .source-info {
    @apply flex justify-between items-center;
  }

  .source-label {
    @apply text-sm font-medium text-gray-700 dark:text-gray-300;
  }

  .source-count {
    @apply text-sm text-gray-600 dark:text-gray-400;
  }

  .source-bar {
    @apply bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden;
  }

  .bar-fill {
    @apply h-full transition-all duration-300;
  }

  .bar-fill.direct {
    @apply bg-gray-600;
  }

  .bar-fill.search {
    @apply bg-blue-500;
  }

  .bar-fill.social {
    @apply bg-purple-500;
  }

  .bar-fill.referral {
    @apply bg-green-500;
  }

  .pages-list {
    @apply space-y-3;
  }

  .page-item {
    @apply flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0;
  }

  .page-path {
    @apply text-sm font-mono text-gray-700 dark:text-gray-300 truncate flex-1 mr-4;
  }

  .page-views {
    @apply text-sm text-gray-600 dark:text-gray-400 flex-shrink-0;
  }

  .data-timestamp {
    @apply text-center pt-6 border-t border-gray-200 dark:border-gray-700;
  }

  .timestamp-text {
    @apply text-sm text-gray-500 dark:text-gray-500;
  }
</style>