<script lang="ts">
  import { onMount } from 'svelte';
  import type { PortfolioProject } from '../../lib/db/types';
  import ProjectCard from './ProjectCard.svelte';
  import FilterControls from './FilterControls.svelte';
  
  // Props
  export let initialProjects: PortfolioProject[] = [];
  export let showFilters = true;
  export let limit = 12;
  export let layout: 'grid' | 'masonry' | 'list' = 'grid';

  // State
  let projects = initialProjects;
  let loading = false;
  let currentPage = 1;
  let hasNextPage = true;
  let totalProjects = 0;

  // Filter states
  let selectedCategory = '';
  let selectedTechnology = '';
  let selectedStatus = '';
  let sortBy = 'latest';
  let searchQuery = '';

  // Available filter options
  let categories: Array<{id: number, name: string, slug: string}> = [];
  let technologies: Array<{id: number, name: string, slug: string, category: string}> = [];
  let statuses = ['all', 'completed', 'in-progress', 'planning'];

  // Load initial data
  onMount(async () => {
    await loadFilterOptions();
    if (initialProjects.length === 0) {
      await loadProjects(true);
    } else {
      totalProjects = initialProjects.length;
    }
  });

  // Load filter options from API
  async function loadFilterOptions() {
    try {
      const response = await fetch('/api/portfolio/filter-options');
      const data = await response.json();
      
      if (data.success) {
        categories = data.data.categories || [];
        technologies = data.data.technologies || [];
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }

  // Load projects with current filters
  async function loadProjects(reset = false) {
    if (loading) return;
    
    loading = true;
    const page = reset ? 1 : currentPage;

    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      // Add filters
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedTechnology) params.set('technology', selectedTechnology);
      if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (sortBy) params.set('sort', sortBy);

      // Choose endpoint based on whether we're searching
      const endpoint = searchQuery.trim() 
        ? `/api/portfolio/search?q=${encodeURIComponent(searchQuery.trim())}&${params.toString()}`
        : `/api/portfolio?${params.toString()}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (data.success) {
        if (reset) {
          projects = data.data.data || [];
          currentPage = 1;
        } else {
          projects = [...projects, ...(data.data.data || [])];
        }
        
        hasNextPage = data.data.pagination?.hasNext || false;
        totalProjects = data.data.pagination?.total || data.data.data?.length || 0;
        currentPage = data.data.pagination?.currentPage || page;
      } else {
        console.error('API error:', data.error);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      loading = false;
    }
  }

  // Handle filter changes
  async function handleFilterChange() {
    currentPage = 1;
    await loadProjects(true);
  }

  // Load more projects (pagination)
  async function loadMore() {
    if (hasNextPage && !loading) {
      currentPage++;
      await loadProjects();
    }
  }

  // Clear all filters
  function clearFilters() {
    selectedCategory = '';
    selectedTechnology = '';
    selectedStatus = '';
    searchQuery = '';
    sortBy = 'latest';
    handleFilterChange();
  }

  // Debounce search input
  let searchTimeout: NodeJS.Timeout;
  $: if (searchQuery !== undefined) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleFilterChange();
    }, 500);
  }

  // Handle other filter changes immediately
  $: if (selectedCategory !== undefined || selectedTechnology !== undefined || 
         selectedStatus !== undefined || sortBy !== undefined) {
    handleFilterChange();
  }
</script>

<div class="portfolio-container">
  <!-- Filter Controls -->
  {#if showFilters}
    <FilterControls
      bind:selectedCategory
      bind:selectedTechnology
      bind:selectedStatus
      bind:sortBy
      bind:searchQuery
      {categories}
      {technologies}
      {statuses}
      {totalProjects}
      on:clear={clearFilters}
      on:filterChange={handleFilterChange}
    />
  {/if}

  <!-- Layout Toggle -->
  <div class="layout-controls">
    <div class="layout-toggle">
      <button 
        class="layout-btn"
        class:active={layout === 'grid'}
        on:click={() => layout = 'grid'}
        title="Grid View"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      </button>
      <button 
        class="layout-btn"
        class:active={layout === 'list'}
        on:click={() => layout = 'list'}
        title="List View"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Projects Grid -->
  <div class="portfolio-grid" class:masonry={layout === 'masonry'} class:list={layout === 'list'}>
    {#each projects as project (project.id)}
      <ProjectCard {project} {layout} />
    {/each}
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="loading-container">
      <div class="loading-grid" class:list={layout === 'list'}>
        {#each Array(limit > 6 ? 6 : limit) as _}
          <div class="loading-card" class:list-layout={layout === 'list'}>
            <div class="loading-image"></div>
            <div class="loading-content">
              <div class="loading-title"></div>
              <div class="loading-text"></div>
              <div class="loading-text short"></div>
              <div class="loading-tags">
                <div class="loading-tag"></div>
                <div class="loading-tag"></div>
                <div class="loading-tag"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Load More Button -->
  {#if hasNextPage && !loading && projects.length > 0}
    <div class="load-more-container">
      <button 
        on:click={loadMore}
        class="load-more-btn"
      >
        Load More Projects
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Empty State -->
  {#if projects.length === 0 && !loading}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
      </div>
      <h3>No projects found</h3>
      <p>
        {#if searchQuery || selectedCategory || selectedTechnology || (selectedStatus && selectedStatus !== 'all')}
          Try adjusting your filters or search terms.
        {:else}
          There are no projects to display at the moment.
        {/if}
      </p>
      {#if searchQuery || selectedCategory || selectedTechnology || (selectedStatus && selectedStatus !== 'all')}
        <button on:click={clearFilters} class="clear-filters-btn">
          Clear All Filters
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .portfolio-container {
    @apply space-y-8;
  }

  .layout-controls {
    @apply flex justify-end;
  }

  .layout-toggle {
    @apply flex bg-white border border-black p-1;
  }

  .layout-btn {
    @apply p-2 text-black hover:bg-black hover:text-white transition-colors;
  }

  .layout-btn.active {
    @apply bg-black text-white;
  }

  .portfolio-grid {
    @apply grid gap-6;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }

  .portfolio-grid.masonry {
    @apply columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6;
    column-fill: balance;
  }

  .portfolio-grid.list {
    @apply grid-cols-1 gap-4;
  }

  .loading-container {
    @apply mt-8;
  }

  .loading-grid {
    @apply grid gap-6;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }

  .loading-grid.list {
    @apply grid-cols-1 gap-4;
  }

  .loading-card {
    @apply bg-white border border-black p-6 animate-pulse;
  }

  .loading-card.list-layout {
    @apply flex items-center p-6;
  }

  .loading-image {
    @apply bg-gray-200 border border-black h-48 mb-4;
  }

  .list-layout .loading-image {
    @apply w-48 h-32 flex-shrink-0 mr-6 mb-0;
  }

  .loading-content {
    @apply flex-1;
  }

  .loading-content .loading-title {
    @apply bg-gray-200 border border-black h-6 mb-3;
  }

  .loading-content .loading-text {
    @apply bg-gray-200 border border-black h-4 mb-2;
  }

  .loading-content .loading-text.short {
    @apply w-3/4;
  }

  .loading-tags {
    @apply flex space-x-2 mt-4;
  }

  .loading-tag {
    @apply bg-gray-200 border border-black h-6 w-16;
  }

  .load-more-container {
    @apply text-center mt-12;
  }

  .load-more-btn {
    @apply bg-white text-black border border-black px-8 py-3 font-mono font-light hover:bg-black hover:text-white transition-colors inline-flex items-center space-x-2;
  }

  .empty-state {
    @apply text-center py-16;
  }

  .empty-icon {
    @apply text-black mb-4 flex justify-center;
  }

  .empty-state h3 {
    @apply text-xl font-light text-black font-mono mb-2;
  }

  .empty-state p {
    @apply text-black font-mono font-light mb-6 max-w-md mx-auto;
  }

  .clear-filters-btn {
    @apply bg-white text-black border border-black px-6 py-2 font-mono font-light hover:bg-black hover:text-white transition-colors;
  }
</style>