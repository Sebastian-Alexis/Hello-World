<script lang="ts">
  import type { PortfolioProject } from '../../lib/db/types';
  
  export let project: PortfolioProject;
  export let layout: 'grid' | 'masonry' | 'list' = 'grid';

  // Calculate project duration if dates available
  $: projectDuration = project.start_date && project.end_date
    ? calculateDuration(project.start_date, project.end_date)
    : null;

  function calculateDuration(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                   (endDate.getMonth() - startDate.getMonth());
    
    if (months < 1) return '< 1 month';
    if (months === 1) return '1 month';
    if (months < 12) return `${months} months`;
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years}y ${remainingMonths}m`;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'planning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }

  function getDifficultyColor(difficulty?: string): string {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  }

  // Tech stack display - limit to 6 items for clean layout
  $: displayedTechStack = project.technologies?.slice(0, 6) || [];
  $: additionalTechCount = (project.technologies?.length || 0) - 6;
</script>

<article 
  class="project-card" 
  class:featured={project.featured}
  class:list-layout={layout === 'list'}
>
  <div class="card-inner">
    <!-- Project Image -->
    {#if project.featured_image}
      <div class="image-container">
        <img 
          src={project.featured_image} 
          alt={project.title}
          loading="lazy"
          class="project-image"
        />
        <div class="image-overlay">
          <div class="overlay-content">
            <a href={`/portfolio/${project.slug}`} class="view-project-btn">
              View Project
            </a>
            {#if project.demo_url}
              <a 
                href={project.demo_url}
                target="_blank"
                rel="noopener noreferrer"
                class="demo-btn"
                title="View Live Demo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15,3 21,3 21,9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Demo
              </a>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Card Content -->
    <div class="card-content">
      <!-- Header -->
      <div class="card-header">
        <div class="title-row">
          <h3 class="project-title">
            <a href={`/portfolio/${project.slug}`}>
              {project.title}
            </a>
          </h3>
          {#if project.featured}
            <span class="featured-badge">Featured</span>
          {/if}
        </div>
        
        <div class="meta-info">
          <span class="status-badge {getStatusColor(project.status)}">
            {project.status.replace('-', ' ')}
          </span>
          
          {#if project.difficulty_level}
            <span class="difficulty-badge {getDifficultyColor(project.difficulty_level)}">
              {project.difficulty_level}
            </span>
          {/if}
          
          {#if projectDuration}
            <span class="duration">
              {projectDuration}
            </span>
          {/if}
        </div>
      </div>

      <!-- Description -->
      <p class="project-description">
        {project.short_description}
      </p>

      <!-- Technology Stack -->
      {#if displayedTechStack.length > 0}
        <div class="tech-stack">
          {#each displayedTechStack as tech}
            <span class="tech-tag" title={tech.name}>
              {tech.name}
            </span>
          {/each}
          {#if additionalTechCount > 0}
            <span class="tech-more" title="Additional technologies">
              +{additionalTechCount}
            </span>
          {/if}
        </div>
      {/if}

      <!-- Project Categories -->
      {#if project.categories && project.categories.length > 0}
        <div class="categories">
          {#each project.categories.slice(0, 2) as category}
            <span class="category-tag" style="color: {category.color};">
              {#if category.icon}
                <span class="category-icon">{category.icon}</span>
              {/if}
              {category.name}
            </span>
          {/each}
        </div>
      {/if}

      <!-- Card Footer -->
      <div class="card-footer">
        <div class="project-links">
          {#if project.demo_url}
            <a 
              href={project.demo_url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="project-link"
              title="Live Demo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Live
            </a>
          {/if}
          
          {#if project.source_url}
            <a 
              href={project.source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="project-link"
              title="Source Code"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Code
            </a>
          {/if}

          {#if project.case_study_url}
            <a 
              href={project.case_study_url}
              class="project-link"
              title="Case Study"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              Study
            </a>
          {/if}
        </div>

        <div class="engagement-stats">
          {#if project.view_count > 0}
            <span class="stat" title="Views">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {project.view_count}
            </span>
          {/if}
          
          {#if project.client_name}
            <span class="stat client-badge" title="Client project">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Client
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>
</article>

<style>
  .project-card {
    @apply bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1;
  }

  .project-card.featured {
    @apply ring-2 ring-blue-500 dark:ring-blue-400 shadow-md;
  }

  .project-card.list-layout {
    @apply flex items-center p-6;
  }

  .project-card.list-layout .image-container {
    @apply w-48 h-32 flex-shrink-0 mr-6;
  }

  .card-inner {
    @apply h-full flex flex-col;
  }

  .list-layout .card-inner {
    @apply flex-row items-center flex-1;
  }

  .image-container {
    @apply relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-700;
  }

  .project-image {
    @apply w-full h-full object-cover transition-transform duration-300 hover:scale-105;
  }

  .image-overlay {
    @apply absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100;
  }

  .overlay-content {
    @apply flex space-x-3;
  }

  .view-project-btn {
    @apply bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm;
  }

  .demo-btn {
    @apply bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center space-x-1 text-sm;
  }

  .card-content {
    @apply p-6 flex-1 flex flex-col;
  }

  .list-layout .card-content {
    @apply p-0 flex-1;
  }

  .card-header {
    @apply mb-4;
  }

  .title-row {
    @apply flex items-start justify-between mb-3;
  }

  .project-title {
    @apply text-xl font-bold text-gray-900 dark:text-white leading-tight;
  }

  .project-title a {
    @apply hover:text-blue-600 dark:hover:text-blue-400 transition-colors;
  }

  .featured-badge {
    @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ml-3;
  }

  .meta-info {
    @apply flex items-center flex-wrap gap-2 text-sm;
  }

  .status-badge {
    @apply px-2 py-1 text-xs font-medium rounded-full capitalize;
  }

  .difficulty-badge {
    @apply px-2 py-1 text-xs font-medium rounded-full capitalize;
  }

  .duration {
    @apply text-xs text-gray-600 dark:text-gray-400;
  }

  .project-description {
    @apply text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4 flex-1;
  }

  .tech-stack {
    @apply flex flex-wrap gap-2 mb-3;
  }

  .tech-tag {
    @apply bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2 py-1 rounded-full font-medium;
  }

  .tech-more {
    @apply bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs px-2 py-1 rounded-full font-medium;
  }

  .categories {
    @apply flex flex-wrap gap-2 mb-4;
  }

  .category-tag {
    @apply bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1;
  }

  .category-icon {
    @apply text-sm;
  }

  .card-footer {
    @apply flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700;
  }

  .project-links {
    @apply flex space-x-3;
  }

  .project-link {
    @apply inline-flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors;
  }

  .engagement-stats {
    @apply flex items-center space-x-3;
  }

  .stat {
    @apply inline-flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-500;
  }

  .client-badge {
    @apply text-purple-600 dark:text-purple-400;
  }
</style>