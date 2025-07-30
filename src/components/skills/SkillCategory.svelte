<script lang="ts">
  import type { Skill } from '../../lib/db/types';
  
  export let category: string;
  export let skills: Skill[] = [];
  export let icon: string = '📌';
  export let expanded: boolean = false;

  // Toggle expansion
  let isExpanded = expanded;

  function getProficiencyLabel(level: number): string {
    const labels = ['', 'Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master'];
    return labels[level] || 'Unknown';
  }

  function getProficiencyColor(level: number): string {
    switch (level) {
      case 1: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 2: return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 3: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 4: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 5: return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }

  function getProficiencyBarColor(level: number): string {
    switch (level) {
      case 1: return 'bg-red-400';
      case 2: return 'bg-orange-400';
      case 3: return 'bg-yellow-400';
      case 4: return 'bg-green-400';
      case 5: return 'bg-purple-400';
      default: return 'bg-gray-400';
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  }

  // Calculate category statistics
  $: categoryStats = {
    total: skills.length,
    averageProficiency: skills.length > 0 
      ? Math.round((skills.reduce((sum, skill) => sum + skill.proficiency_level, 0) / skills.length) * 10) / 10
      : 0,
    expertLevel: skills.filter(skill => skill.proficiency_level >= 4).length,
    totalExperience: skills.reduce((sum, skill) => sum + (skill.years_experience || 0), 0)
  };

  // Sort skills by priority and proficiency
  $: sortedSkills = [...skills].sort((a, b) => {
    // First by priority (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = (priorityOrder[b.priority_level] || 0) - (priorityOrder[a.priority_level] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by proficiency level
    const proficiencyDiff = b.proficiency_level - a.proficiency_level;
    if (proficiencyDiff !== 0) return proficiencyDiff;
    
    // Finally alphabetically
    return a.name.localeCompare(b.name);
  });
</script>

<div class="skill-category">
  <!-- Category Header -->
  <div class="category-header" class:expanded={isExpanded}>
    <button 
      class="category-toggle"
      on:click={() => isExpanded = !isExpanded}
    >
      <div class="category-info">
        <div class="category-title">
          <span class="category-icon">{icon}</span>
          <h3 class="category-name">
            {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h3>
          <span class="skill-count">
            {skills.length} skill{skills.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div class="category-summary">
          <div class="summary-item">
            <span class="summary-label">Avg Level:</span>
            <span class="summary-value {getProficiencyColor(Math.round(categoryStats.averageProficiency))}">
              {categoryStats.averageProficiency}/5
            </span>
          </div>
          
          <div class="summary-item">
            <span class="summary-label">Expert:</span>
            <span class="summary-value">
              {categoryStats.expertLevel}/{categoryStats.total}
            </span>
          </div>
          
          {#if categoryStats.totalExperience > 0}
            <div class="summary-item">
              <span class="summary-label">Experience:</span>
              <span class="summary-value">
                {categoryStats.totalExperience}y total
              </span>
            </div>
          {/if}
        </div>
      </div>
      
      <div class="expand-indicator">
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
          class="chevron"
          class:rotated={isExpanded}
        >
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </div>
    </button>
  </div>

  <!-- Skills Grid -->
  {#if isExpanded}
    <div class="skills-grid">
      {#each sortedSkills as skill}
        <div class="skill-card {getPriorityColor(skill.priority_level)}">
          <div class="skill-header">
            <div class="skill-name-row">
              <h4 class="skill-name">{skill.name}</h4>
              <span class="proficiency-badge {getProficiencyColor(skill.proficiency_level)}">
                {getProficiencyLabel(skill.proficiency_level)}
              </span>
            </div>
            
            <div class="proficiency-bar-container">
              <div class="proficiency-bar-bg">
                <div 
                  class="proficiency-bar {getProficiencyBarColor(skill.proficiency_level)}"
                  style="width: {(skill.proficiency_level / 5) * 100}%"
                ></div>
              </div>
              <span class="proficiency-level">{skill.proficiency_level}/5</span>
            </div>
          </div>

          {#if skill.description}
            <p class="skill-description">{skill.description}</p>
          {/if}

          <div class="skill-meta">
            {#if skill.years_experience}
              <div class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span>{skill.years_experience} years</span>
              </div>
            {/if}
            
            {#if skill.projects_count > 0}
              <div class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
                <span>{skill.projects_count} projects</span>
              </div>
            {/if}
            
            {#if skill.last_used_date}
              <div class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>Used {new Date(skill.last_used_date).getFullYear()}</span>
              </div>
            {/if}
          </div>

          {#if skill.certification_level}
            <div class="certification-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
              <span>Certified: {skill.certification_level}</span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .skill-category {
    @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden;
  }

  .category-header {
    @apply transition-colors duration-200;
  }

  .category-header.expanded {
    @apply bg-gray-50 dark:bg-gray-700/50;
  }

  .category-toggle {
    @apply w-full p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors;
  }

  .category-info {
    @apply space-y-3;
  }

  .category-title {
    @apply flex items-center space-x-3;
  }

  .category-icon {
    @apply text-2xl flex-shrink-0;
  }

  .category-name {
    @apply text-xl font-bold text-gray-900 dark:text-white flex-1;
  }

  .skill-count {
    @apply bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-sm font-medium;
  }

  .category-summary {
    @apply flex items-center space-x-6 text-sm;
  }

  .summary-item {
    @apply flex items-center space-x-1;
  }

  .summary-label {
    @apply text-gray-600 dark:text-gray-400;
  }

  .summary-value {
    @apply font-medium text-gray-900 dark:text-white px-2 py-1 rounded text-xs;
  }

  .expand-indicator {
    @apply absolute top-6 right-6 text-gray-400;
  }

  .chevron {
    @apply transition-transform duration-200;
  }

  .chevron.rotated {
    @apply rotate-180;
  }

  .category-toggle {
    @apply relative;
  }

  .skills-grid {
    @apply grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6 pt-0;
  }

  .skill-card {
    @apply bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border-l-4 space-y-3;
  }

  .skill-header {
    @apply space-y-2;
  }

  .skill-name-row {
    @apply flex items-center justify-between;
  }

  .skill-name {
    @apply font-semibold text-gray-900 dark:text-white text-sm;
  }

  .proficiency-badge {
    @apply px-2 py-1 text-xs font-medium rounded-full;
  }

  .proficiency-bar-container {
    @apply flex items-center space-x-2;
  }

  .proficiency-bar-bg {
    @apply flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden;
  }

  .proficiency-bar {
    @apply h-full transition-all duration-300;
  }

  .proficiency-level {
    @apply text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[2rem] text-right;
  }

  .skill-description {
    @apply text-xs text-gray-600 dark:text-gray-400 leading-relaxed;
  }

  .skill-meta {
    @apply flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-500;
  }

  .meta-item {
    @apply flex items-center space-x-1;
  }

  .certification-badge {
    @apply inline-flex items-center space-x-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full text-xs font-medium;
  }
</style>