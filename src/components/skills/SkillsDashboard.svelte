<script lang="ts">
  import { onMount } from 'svelte';
  import type { Skill } from '../../lib/db/types';
  import SkillCategory from './SkillCategory.svelte';
  import SkillChart from './SkillChart.svelte';
  
  // Props
  export let initialSkills: Skill[] = [];
  export let showChart = true;
  export let showCategories = true;
  export let expandedCategories: string[] = [];

  // State
  let skills = initialSkills;
  let loading = false;
  let error = '';
  let viewMode: 'categories' | 'chart' | 'both' = 'both';

  // Load skills data if not provided
  onMount(async () => {
    if (skills.length === 0) {
      await loadSkills();
    }
  });

  async function loadSkills() {
    if (loading) return;
    
    loading = true;
    error = '';

    try {
      const response = await fetch('/api/portfolio/skills');
      const data = await response.json();
      
      if (data.success) {
        skills = data.data.skills || [];
      } else {
        error = data.error || 'Failed to load skills';
      }
    } catch (err) {
      error = 'Network error loading skills';
      console.error('Error loading skills:', err);
    } finally {
      loading = false;
    }
  }

  // Group skills by category
  $: skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = [];
    }
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  // Calculate dashboard statistics
  $: dashboardStats = {
    total: skills.length,
    categories: Object.keys(skillsByCategory).length,
    expertLevel: skills.filter(skill => skill.proficiency_level >= 4).length,
    averageProficiency: skills.length > 0 
      ? Math.round((skills.reduce((sum, skill) => sum + skill.proficiency_level, 0) / skills.length) * 10) / 10
      : 0,
    totalExperience: skills.reduce((sum, skill) => sum + (skill.years_experience || 0), 0),
    certified: skills.filter(skill => skill.certification_level).length,
    recentlyUsed: skills.filter(skill => {
      if (!skill.last_used_date) return false;
      const lastUsed = new Date(skill.last_used_date);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return lastUsed > oneYearAgo;
    }).length
  };

  // Category icons mapping
  const categoryIcons = {
    'programming': '💻',
    'framework': '🛠️',
    'database': '🗄️',
    'tool': '⚡',
    'soft-skill': '🤝',
    'language': '🌐'
  };

  // Sort categories by total proficiency
  $: sortedCategories = Object.entries(skillsByCategory)
    .sort(([, a], [, b]) => {
      const avgA = a.reduce((sum, skill) => sum + skill.proficiency_level, 0) / a.length;
      const avgB = b.reduce((sum, skill) => sum + skill.proficiency_level, 0) / b.length;
      return avgB - avgA;
    });

  // Handle category expansion
  function toggleCategory(category: string) {
    if (expandedCategories.includes(category)) {
      expandedCategories = expandedCategories.filter(c => c !== category);
    } else {
      expandedCategories = [...expandedCategories, category];
    }
  }

  function expandAll() {
    expandedCategories = Object.keys(skillsByCategory);
  }

  function collapseAll() {
    expandedCategories = [];
  }
</script>

<div class="skills-dashboard">
  <!-- Dashboard Header -->
  <div class="dashboard-header">
    <div class="header-content">
      <h2 class="dashboard-title">Skills & Expertise</h2>
      <p class="dashboard-subtitle">
        Professional skills, technologies, and competencies
      </p>
    </div>

    <!-- View Mode Toggle -->
    <div class="view-controls">
      <div class="view-toggle">
        <button 
          class="view-btn"
          class:active={viewMode === 'categories'}
          on:click={() => viewMode = 'categories'}
          title="Categories View"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          Categories
        </button>
        <button 
          class="view-btn"
          class:active={viewMode === 'chart'}
          on:click={() => viewMode = 'chart'}
          title="Chart View"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Charts
        </button>
        <button 
          class="view-btn"
          class:active={viewMode === 'both'}
          on:click={() => viewMode = 'both'}
          title="Combined View"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="9" x2="9" y2="15"/>
            <line x1="15" y1="9" x2="15" y2="15"/>
          </svg>
          Both
        </button>
      </div>
    </div>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading skills data...</p>
    </div>
  {/if}

  <!-- Error State -->
  {#if error}
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h3>Error Loading Skills</h3>
        <p>{error}</p>
        <button on:click={loadSkills} class="retry-btn">
          Try Again
        </button>
      </div>
    </div>
  {/if}

  <!-- Dashboard Content -->
  {#if !loading && !error && skills.length > 0}
    <!-- Dashboard Statistics -->
    <div class="dashboard-stats">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-value">{dashboardStats.total}</div>
          <div class="stat-label">Total Skills</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🏆</div>
        <div class="stat-content">
          <div class="stat-value">{dashboardStats.expertLevel}</div>
          <div class="stat-label">Expert Level</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <div class="stat-value">{dashboardStats.averageProficiency}/5</div>
          <div class="stat-label">Avg Proficiency</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <div class="stat-value">{dashboardStats.totalExperience}y</div>
          <div class="stat-label">Total Experience</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🎓</div>
        <div class="stat-content">
          <div class="stat-value">{dashboardStats.certified}</div>
          <div class="stat-label">Certified</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🔄</div>
        <div class="stat-content">
          <div class="stat-value">{dashboardStats.recentlyUsed}</div>
          <div class="stat-label">Recently Used</div>
        </div>
      </div>
    </div>

    <!-- Chart View -->
    {#if (showChart && viewMode === 'chart') || viewMode === 'both'}
      <div class="chart-section">
        <div class="section-header">
          <h3 class="section-title">Skills Visualization</h3>
          <p class="section-subtitle">Interactive charts showing proficiency levels and experience</p>
        </div>
        <SkillChart {skills} />
      </div>
    {/if}

    <!-- Categories View -->
    {#if (showCategories && viewMode === 'categories') || viewMode === 'both'}
      <div class="categories-section">
        <div class="section-header">
          <div class="header-left">
            <h3 class="section-title">Skills by Category</h3>
            <p class="section-subtitle">Organized by technology type and domain</p>
          </div>
          <div class="category-controls">
            <button on:click={expandAll} class="control-btn">
              Expand All
            </button>
            <button on:click={collapseAll} class="control-btn">
              Collapse All
            </button>
          </div>
        </div>

        <div class="categories-grid">
          {#each sortedCategories as [category, categorySkills]}
            <SkillCategory
              {category}
              skills={categorySkills}
              icon={categoryIcons[category] || '📌'}
              expanded={expandedCategories.includes(category)}
              on:toggle={() => toggleCategory(category)}
            />
          {/each}
        </div>
      </div>
    {/if}
  {/if}

  <!-- Empty State -->
  {#if !loading && !error && skills.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🎯</div>
      <h3>No Skills Data</h3>
      <p>No skills information is available at the moment.</p>
      <button on:click={loadSkills} class="reload-btn">
        Reload Skills
      </button>
    </div>
  {/if}
</div>

<style>
  .skills-dashboard {
    @apply space-y-8;
  }

  .dashboard-header {
    @apply flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8;
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

  .view-controls {
    @apply flex items-center;
  }

  .view-toggle {
    @apply flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1;
  }

  .view-btn {
    @apply px-4 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors inline-flex items-center space-x-2;
  }

  .view-btn.active {
    @apply bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm;
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

  .dashboard-stats {
    @apply grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8;
  }

  .stat-card {
    @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center space-x-3;
  }

  .stat-icon {
    @apply text-2xl flex-shrink-0;
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

  .chart-section, .categories-section {
    @apply space-y-6;
  }

  .section-header {
    @apply flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4;
  }

  .header-left {
    @apply flex-1;
  }

  .section-title {
    @apply text-2xl font-semibold text-gray-900 dark:text-white mb-1;
  }

  .section-subtitle {
    @apply text-gray-600 dark:text-gray-400;
  }

  .category-controls {
    @apply flex space-x-2;
  }

  .control-btn {
    @apply px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors;
  }

  .categories-grid {
    @apply space-y-4;
  }

  .empty-state {
    @apply text-center py-16;
  }

  .empty-icon {
    @apply text-6xl mb-4;
  }

  .empty-state h3 {
    @apply text-xl font-semibold text-gray-900 dark:text-white mb-2;
  }

  .empty-state p {
    @apply text-gray-600 dark:text-gray-400 mb-6;
  }

  .reload-btn {
    @apply bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors;
  }
</style>