<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let selectedCategory = '';
  export let selectedTechnology = '';
  export let selectedStatus = '';
  export let sortBy = 'latest';
  export let searchQuery = '';
  export let categories: Array<{id: number, name: string, slug: string}> = [];
  export let technologies: Array<{id: number, name: string, slug: string, category: string}> = [];
  export let statuses = ['all', 'completed', 'in-progress', 'planning'];
  export let totalProjects = 0;

  const dispatch = createEventDispatcher();

  // Sort options
  const sortOptions = [
    { value: 'latest', label: 'Latest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'alphabetical', label: 'A-Z' }
  ];

  // Group technologies by category
  $: groupedTechnologies = technologies.reduce((acc, tech) => {
    if (!acc[tech.category]) {
      acc[tech.category] = [];
    }
    acc[tech.category].push(tech);
    return acc;
  }, {} as Record<string, typeof technologies>);

  // Clear all filters
  function clearAllFilters() {
    selectedCategory = '';
    selectedTechnology = '';
    selectedStatus = '';
    searchQuery = '';
    sortBy = 'latest';
    dispatch('clear');
  }

  // Active filter count
  $: activeFilterCount = [
    selectedCategory,
    selectedTechnology, 
    selectedStatus !== 'all' ? selectedStatus : '',
    searchQuery
  ].filter(Boolean).length;

  // Reactive handlers for filter changes
  $: if (selectedCategory !== undefined) dispatch('filterChange');
  $: if (selectedTechnology !== undefined) dispatch('filterChange');
  $: if (selectedStatus !== undefined) dispatch('filterChange');
  $: if (sortBy !== undefined) dispatch('filterChange');
  $: if (searchQuery !== undefined) dispatch('filterChange');
</script>

<div class="filter-controls">
  <!-- Search and Results Summary -->
  <div class="search-section">
    <div class="search-wrapper">
      <div class="search-input-container">
        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search projects, technologies, or descriptions..."
          class="search-input"
        />
        {#if searchQuery}
          <button 
            on:click={() => searchQuery = ''}
            class="clear-search-btn"
            title="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>
    
    <div class="results-summary">
      <span class="results-count">
        {totalProjects} project{totalProjects !== 1 ? 's' : ''}
      </span>
      {#if activeFilterCount > 0}
        <button on:click={clearAllFilters} class="clear-filters-btn">
          Clear {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
        </button>
      {/if}
    </div>
  </div>

  <!-- Filter Controls Grid -->
  <div class="filters-grid">
    <!-- Category Filter -->
    <div class="filter-group">
      <label for="category-select" class="filter-label">
        Category
      </label>
      <select 
        id="category-select"
        bind:value={selectedCategory}
        class="filter-select"
      >
        <option value="">All Categories</option>
        {#each categories as category}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
    </div>

    <!-- Technology Filter -->
    <div class="filter-group">
      <label for="technology-select" class="filter-label">
        Technology
      </label>
      <select 
        id="technology-select"
        bind:value={selectedTechnology}
        class="filter-select"
      >
        <option value="">All Technologies</option>
        {#each Object.entries(groupedTechnologies) as [category, techs]}
          <optgroup label={category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}>
            {#each techs as tech}
              <option value={tech.id}>{tech.name}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>

    <!-- Status Filter -->
    <div class="filter-group">
      <label for="status-select" class="filter-label">
        Status
      </label>
      <select 
        id="status-select"
        bind:value={selectedStatus}
        class="filter-select"
      >
        {#each statuses as status}
          <option value={status}>
            {status === 'all' ? 'All Statuses' : status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </option>
        {/each}
      </select>
    </div>

    <!-- Sort Control -->
    <div class="filter-group">
      <label for="sort-select" class="filter-label">
        Sort By
      </label>
      <select 
        id="sort-select"
        bind:value={sortBy}
        class="filter-select"
      >
        {#each sortOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Active Filters Display -->
  {#if activeFilterCount > 0}
    <div class="active-filters">
      <div class="active-filters-label">Active filters:</div>
      <div class="filter-tags">
        {#if selectedCategory}
          <span class="filter-tag">
            Category: {categories.find(c => c.id == selectedCategory)?.name}
            <button on:click={() => selectedCategory = ''} class="remove-filter">×</button>
          </span>
        {/if}
        
        {#if selectedTechnology}
          <span class="filter-tag">
            Tech: {technologies.find(t => t.id == selectedTechnology)?.name}
            <button on:click={() => selectedTechnology = ''} class="remove-filter">×</button>
          </span>
        {/if}
        
        {#if selectedStatus && selectedStatus !== 'all'}
          <span class="filter-tag">
            Status: {selectedStatus.replace('-', ' ')}
            <button on:click={() => selectedStatus = 'all'} class="remove-filter">×</button>
          </span>
        {/if}
        
        {#if searchQuery}
          <span class="filter-tag">
            Search: "{searchQuery}"
            <button on:click={() => searchQuery = ''} class="remove-filter">×</button>
          </span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-controls {
    @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8 space-y-6;
  }

  .search-section {
    @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4;
  }

  .search-wrapper {
    @apply flex-1;
  }

  .search-input-container {
    @apply relative;
  }

  .search-icon {
    @apply absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none;
  }

  .search-input {
    @apply w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors;
  }

  .clear-search-btn {
    @apply absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors;
  }

  .results-summary {
    @apply flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400;
  }

  .results-count {
    @apply font-medium;
  }

  .clear-filters-btn {
    @apply text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline transition-colors;
  }

  .filters-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4;
  }

  .filter-group {
    @apply space-y-2;
  }

  .filter-label {
    @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
  }

  .filter-select {
    @apply w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm;
  }

  .active-filters {
    @apply flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700;
  }

  .active-filters-label {
    @apply text-sm font-medium text-gray-700 dark:text-gray-300;
  }

  .filter-tags {
    @apply flex flex-wrap gap-2;
  }

  .filter-tag {
    @apply inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm rounded-full;
  }

  .remove-filter {
    @apply ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100 font-bold transition-colors;
  }
</style>