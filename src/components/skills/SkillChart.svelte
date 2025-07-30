<script lang="ts">
  import { onMount } from 'svelte';
  import type { Skill } from '../../lib/db/types';
  
  export let skills: Skill[] = [];

  let chartContainer: HTMLElement;
  let chartType: 'radar' | 'bar' | 'bubble' = 'radar';

  // Group skills by category
  $: skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = [];
    }
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  // Calculate category averages for radar chart
  $: categoryAverages = Object.entries(skillsByCategory).map(([category, categorySkills]) => ({
    category: category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    average: categorySkills.reduce((sum, skill) => sum + skill.proficiency_level, 0) / categorySkills.length,
    count: categorySkills.length,
    color: getCategoryColor(category)
  }));

  // Get top skills for bubble chart
  $: topSkills = [...skills]
    .sort((a, b) => {
      // Sort by proficiency first, then by years of experience
      const proficiencyDiff = b.proficiency_level - a.proficiency_level;
      if (proficiencyDiff !== 0) return proficiencyDiff;
      return (b.years_experience || 0) - (a.years_experience || 0);
    })
    .slice(0, 20);

  function getCategoryColor(category: string): string {
    const colors = {
      'programming': '#3B82F6',
      'framework': '#10B981',
      'database': '#F59E0B',
      'tool': '#8B5CF6',
      'soft-skill': '#EF4444',
      'language': '#06B6D4'
    };
    return colors[category] || '#6B7280';
  }

  function getProficiencyColor(level: number): string {
    switch (level) {
      case 1: return '#EF4444'; // Red
      case 2: return '#F97316'; // Orange
      case 3: return '#EAB308'; // Yellow
      case 4: return '#22C55E'; // Green
      case 5: return '#8B5CF6'; // Purple
      default: return '#6B7280'; // Gray
    }
  }

  // Simple radar chart implementation
  function drawRadarChart() {
    if (!chartContainer || categoryAverages.length === 0) return;

    const canvas = chartContainer.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 60;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid circles
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius / 5) * i, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw category axes
    const angleStep = (2 * Math.PI) / categoryAverages.length;
    
    categoryAverages.forEach((category, index) => {
      const angle = (index * angleStep) - Math.PI / 2;
      const endX = centerX + Math.cos(angle) * radius;
      const endY = centerY + Math.sin(angle) * radius;
      
      // Draw axis line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // Draw category label
      const labelX = centerX + Math.cos(angle) * (radius + 30);
      const labelY = centerY + Math.sin(angle) * (radius + 30);
      
      ctx.fillStyle = '#374151';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(category.category, labelX, labelY);
    });

    // Draw proficiency polygon
    ctx.beginPath();
    ctx.strokeStyle = '#3B82F6';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 2;

    categoryAverages.forEach((category, index) => {
      const angle = (index * angleStep) - Math.PI / 2;
      const distance = (category.average / 5) * radius;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw data points
    categoryAverages.forEach((category, index) => {
      const angle = (index * angleStep) - Math.PI / 2;
      const distance = (category.average / 5) * radius;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#3B82F6';
      ctx.fill();
    });
  }

  onMount(() => {
    if (chartType === 'radar') {
      setTimeout(drawRadarChart, 100);
    }
  });

  $: if (chartType === 'radar' && chartContainer) {
    setTimeout(drawRadarChart, 100);
  }
</script>

<div class="skill-chart">
  <!-- Chart Type Toggle -->
  <div class="chart-controls">
    <div class="chart-type-toggle">
      <button 
        class="chart-btn"
        class:active={chartType === 'radar'}
        on:click={() => chartType = 'radar'}
      >
        Radar
      </button>
      <button 
        class="chart-btn"
        class:active={chartType === 'bar'}
        on:click={() => chartType = 'bar'}
      >
        Bar
      </button>
      <button 
        class="chart-btn"
        class:active={chartType === 'bubble'}
        on:click={() => chartType = 'bubble'}
      >
        Bubble
      </button>
    </div>
  </div>

  <!-- Chart Container -->
  <div class="chart-wrapper" bind:this={chartContainer}>
    {#if chartType === 'radar'}
      <div class="radar-chart">
        <canvas width="400" height="400"></canvas>
        <div class="chart-legend">
          {#each categoryAverages as category}
            <div class="legend-item">
              <div class="legend-color" style="background-color: {category.color};"></div>
              <span class="legend-label">
                {category.category}: {category.average.toFixed(1)}/5 ({category.count} skills)
              </span>
            </div>
          {/each}
        </div>
      </div>
    
    {:else if chartType === 'bar'}
      <div class="bar-chart">
        <div class="chart-title">Skills by Proficiency Level</div>
        <div class="bars-container">
          {#each categoryAverages.sort((a, b) => b.average - a.average) as category}
            <div class="bar-group">
              <div class="bar-label">{category.category}</div>
              <div class="bar-container">
                <div 
                  class="bar" 
                  style="width: {(category.average / 5) * 100}%; background-color: {category.color};"
                >
                  <span class="bar-value">{category.average.toFixed(1)}</span>
                </div>
              </div>
              <div class="bar-count">{category.count} skills</div>
            </div>
          {/each}
        </div>
      </div>

    {:else if chartType === 'bubble'}
      <div class="bubble-chart">
        <div class="chart-title">Top Skills (Size = Experience, Color = Proficiency)</div>
        <div class="bubbles-container">
          {#each topSkills as skill, i}
            <div 
              class="bubble" 
              style="
                width: {Math.max(40, (skill.years_experience || 1) * 8)}px;
                height: {Math.max(40, (skill.years_experience || 1) * 8)}px;
                background-color: {getProficiencyColor(skill.proficiency_level)};
                left: {(i % 8) * 12 + Math.random() * 10}%;
                top: {Math.floor(i / 8) * 15 + Math.random() * 10}%;
              "
              title="{skill.name}: Level {skill.proficiency_level}/5, {skill.years_experience || 0} years"
            >
              <span class="bubble-label">{skill.name}</span>
              <span class="bubble-level">{skill.proficiency_level}/5</span>
            </div>
          {/each}
        </div>

        <div class="bubble-legend">
          <div class="legend-section">
            <h4>Proficiency Colors:</h4>
            <div class="color-legend">
              {#each [1, 2, 3, 4, 5] as level}
                <div class="color-item">
                  <div class="color-swatch" style="background-color: {getProficiencyColor(level)};"></div>
                  <span>{level}/5</span>
                </div>
              {/each}
            </div>
          </div>
          <div class="legend-section">
            <p><strong>Bubble size:</strong> Years of experience</p>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .skill-chart {
    @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6;
  }

  .chart-controls {
    @apply mb-6;
  }

  .chart-type-toggle {
    @apply flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1;
  }

  .chart-btn {
    @apply px-4 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors;
  }

  .chart-btn.active {
    @apply bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm;
  }

  .chart-wrapper {
    @apply relative;
  }

  .radar-chart {
    @apply flex flex-col items-center space-y-6;
  }

  .chart-legend {
    @apply grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl;
  }

  .legend-item {
    @apply flex items-center space-x-2 text-sm;
  }

  .legend-color {
    @apply w-4 h-4 rounded-full;
  }

  .legend-label {
    @apply text-gray-700 dark:text-gray-300;
  }

  .bar-chart {
    @apply space-y-6;
  }

  .chart-title {
    @apply text-lg font-semibold text-gray-900 dark:text-white text-center;
  }

  .bars-container {
    @apply space-y-4;
  }

  .bar-group {
    @apply grid grid-cols-12 gap-4 items-center;
  }

  .bar-label {
    @apply col-span-3 text-sm font-medium text-gray-700 dark:text-gray-300 text-right;
  }

  .bar-container {
    @apply col-span-7 relative bg-gray-200 dark:bg-gray-700 rounded-full h-8;
  }

  .bar {
    @apply h-full rounded-full flex items-center justify-end pr-3 min-w-[60px] transition-all duration-500;
  }

  .bar-value {
    @apply text-white text-sm font-medium;
  }

  .bar-count {
    @apply col-span-2 text-sm text-gray-600 dark:text-gray-400;
  }

  .bubble-chart {
    @apply space-y-6;
  }

  .bubbles-container {
    @apply relative h-80 bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden;
  }

  .bubble {
    @apply absolute rounded-full flex flex-col items-center justify-center text-white text-xs font-medium cursor-pointer transition-transform hover:scale-110 shadow-lg;
  }

  .bubble-label {
    @apply text-center leading-tight px-1;
  }

  .bubble-level {
    @apply text-xs opacity-75;
  }

  .bubble-legend {
    @apply space-y-4 text-sm;
  }

  .legend-section h4 {
    @apply font-semibold text-gray-900 dark:text-white mb-2;
  }

  .color-legend {
    @apply flex flex-wrap gap-3;
  }

  .color-item {
    @apply flex items-center space-x-1;
  }

  .color-swatch {
    @apply w-4 h-4 rounded-full;
  }

  .legend-section p {
    @apply text-gray-600 dark:text-gray-400;
  }
</style>