<!--
================================================================================
BLOG SEARCH BOX - Interactive search component with live results
Provides instant search with debouncing, suggestions, and keyboard navigation
================================================================================
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { BlogPost } from '@/lib/db/types';
  import { blogCache } from '@/lib/performance/cache';
  import { performanceUtils } from '@/lib/performance/vitals';

  interface SearchResult {
    post: BlogPost;
    snippet?: string;
    rank?: number;
  }

  interface SearchSuggestion {
    query: string;
    type: 'recent' | 'suggestion' | 'category' | 'tag';
    data?: any;
  }

  //props
  export let placeholder = 'Search blog posts...';
  export let className = '';
  export let showCategories = true;
  export let showTags = false;
  export let maxResults = 8;
  export let debounceMs = 300;
  export let minQueryLength = 2;
  export let autoFocus = false;

  //reactive state
  let searchQuery = '';
  let isSearching = false;
  let showResults = false;
  let searchResults: SearchResult[] = [];
  let suggestions: SearchSuggestion[] = [];
  let categories: any[] = [];
  let tags: any[] = [];
  let selectedIndex = -1;
  let searchInput: HTMLInputElement;
  let searchContainer: HTMLDivElement;
  let debounceTimer: number;

  //recent searches (stored in localStorage)
  let recentSearches: string[] = [];

  onMount(() => {
    //load recent searches
    loadRecentSearches();
    
    //load categories and tags if needed
    if (showCategories) loadCategories();
    if (showTags) loadTags();

    //auto focus if requested
    if (autoFocus && searchInput) {
      searchInput.focus();
    }

    //click outside handler
    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleClickOutside);
    }
  });

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClickOutside);
    }
  });

  //load recent searches from localStorage
  function loadRecentSearches() {
    try {
      const stored = localStorage.getItem('blog-recent-searches');
      if (stored) {
        recentSearches = JSON.parse(stored).slice(0, 5);
      }
    } catch (error) {
      console.warn('Failed to load recent searches:', error);
    }
  }

  //save search to recent searches
  function saveRecentSearch(query: string) {
    if (query.length < minQueryLength) return;
    
    try {
      recentSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      localStorage.setItem('blog-recent-searches', JSON.stringify(recentSearches));
    } catch (error) {
      console.warn('Failed to save recent search:', error);
    }
  }

  //load categories for suggestions
  async function loadCategories() {
    try {
      const data = await blogCache.getCategories(async () => {
        const response = await fetch('/api/blog/categories?limit=10');
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to fetch categories');
        }
        return result.data;
      });
      categories = data;
    } catch (error) {
      console.warn('Failed to load categories:', error);
    }
  }

  //load tags for suggestions
  async function loadTags() {
    try {
      const data = await blogCache.getTags(async () => {
        const response = await fetch('/api/blog/tags?limit=20&minPosts=1');
        const result = await response.json();
        if (!result.success) {
          throw new Error('Failed to fetch tags');
        }
        return result.data;
      });
      tags = data;
    } catch (error) {
      console.warn('Failed to load tags:', error);
    }
  }

  //handle search input changes  
  const debouncedSearch = performanceUtils.debounce(() => {
    performSearch();
  }, debounceMs);

  function handleInput() {
    if (searchQuery.length < minQueryLength) {
      showResults = false;
      searchResults = [];
      generateSuggestions();
      return;
    }

    debouncedSearch();
  }

  //perform the actual search
  async function performSearch() {
    if (searchQuery.length < minQueryLength) return;

    isSearching = true;
    showResults = true;

    try {
      const searchFilters = { limit: maxResults.toString() };
      
      const data = await performanceUtils.measureAsync('search-api', async () => {
        return await blogCache.getSearchResults(
          searchQuery,
          searchFilters,
          async () => {
            const params = new URLSearchParams({
              q: searchQuery,
              limit: maxResults.toString(),
            });

            const response = await fetch(`/api/blog/search?${params}`);
            const result = await response.json();

            if (!result.success) {
              throw new Error('Search failed');
            }

            return result.data.map((post: any) => ({
              post,
              snippet: post.snippet,
              rank: post.rank,
            }));
          }
        );
      });

      searchResults = data;
      selectedIndex = -1;
    } catch (error) {
      console.error('Search failed:', error);
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  //generate suggestions based on current query
  function generateSuggestions() {
    suggestions = [];

    //recent searches
    if (recentSearches.length > 0) {
      const filteredRecent = searchQuery.length > 0
        ? recentSearches.filter(search => 
            search.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : recentSearches.slice(0, 3);

      suggestions.push(...filteredRecent.map(query => ({
        query,
        type: 'recent' as const,
      })));
    }

    //category suggestions
    if (showCategories && categories.length > 0) {
      const matchingCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 3);

      suggestions.push(...matchingCategories.map(cat => ({
        query: cat.name,
        type: 'category' as const,
        data: cat,
      })));
    }

    //tag suggestions
    if (showTags && tags.length > 0) {
      const matchingTags = tags.filter(tag =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 3);

      suggestions.push(...matchingTags.map(tag => ({
        query: tag.name,
        type: 'tag' as const,
        data: tag,
      })));
    }

    //limit total suggestions
    suggestions = suggestions.slice(0, 8);
  }

  //handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (!showResults && suggestions.length === 0) return;

    const totalItems = searchResults.length + suggestions.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        break;

      case 'Enter':
        event.preventDefault();
        handleItemSelection();
        break;

      case 'Escape':
        event.preventDefault();
        closeResults();
        break;
    }
  }

  //handle item selection (click or enter)
  function handleItemSelection(index?: number) {
    const targetIndex = index !== undefined ? index : selectedIndex;
    
    if (targetIndex < 0) {
      //submit current search query
      if (searchQuery.trim()) {
        navigateToSearch(searchQuery);
      }
      return;
    }

    if (targetIndex < searchResults.length) {
      //navigate to blog post
      const result = searchResults[targetIndex];
      saveRecentSearch(searchQuery);
      window.location.href = `/blog/${result.post.slug}`;
    } else {
      //handle suggestion
      const suggestionIndex = targetIndex - searchResults.length;
      const suggestion = suggestions[suggestionIndex];
      
      if (suggestion.type === 'category') {
        window.location.href = `/blog/category/${suggestion.data.slug}`;
      } else if (suggestion.type === 'tag') {
        window.location.href = `/blog/tag/${suggestion.data.slug}`;
      } else {
        searchQuery = suggestion.query;
        performSearch();
      }
    }
  }

  //navigate to search results page
  function navigateToSearch(query: string) {
    saveRecentSearch(query);
    window.location.href = `/blog/search?q=${encodeURIComponent(query)}`;
  }

  //close search results
  function closeResults() {
    showResults = false;
    selectedIndex = -1;
  }

  //handle click outside
  function handleClickOutside(event: Event) {
    if (searchContainer && !searchContainer.contains(event.target as Node)) {
      closeResults();
    }
  }

  //handle input focus
  function handleFocus() {
    if (searchQuery.length >= minQueryLength) {
      showResults = true;
    } else {
      generateSuggestions();
      showResults = suggestions.length > 0;
    }
  }

  //reactive updates
  $: if (searchQuery.length === 0) {
    showResults = false;
    searchResults = [];
    generateSuggestions();
  }
</script>

<div class="relative {className}" bind:this={searchContainer}>
  <!-- Search Input -->
  <div class="relative">
    <div class="absolute inset-y-0 left-0 flex items-center pl-3">
      <svg class="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    
    <input
      bind:this={searchInput}
      bind:value={searchQuery}
      on:input={handleInput}
      on:focus={handleFocus}
      on:keydown={handleKeydown}
      type="text"
      {placeholder}
      class="w-full pl-10 pr-4 py-3 bg-white border border-black text-black font-mono font-light placeholder-black focus:bg-black focus:text-white focus:placeholder-white transition-colors duration-200"
      autocomplete="off"
      spellcheck="false"
    />

    {#if isSearching}
      <div class="absolute inset-y-0 right-0 flex items-center pr-3">
        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
      </div>
    {/if}
  </div>

  <!-- Search Results Dropdown -->
  {#if showResults && (searchResults.length > 0 || suggestions.length > 0)}
    <div class="absolute z-50 w-full mt-2 bg-white border border-black max-h-96 overflow-y-auto">
      
      <!-- Search Results -->
      {#each searchResults as result, index}
        <button
          class="w-full px-4 py-3 text-left hover:bg-black hover:text-white border-b border-black last:border-b-0 transition-colors duration-150 {
            selectedIndex === index ? 'bg-black text-white' : ''
          }"
          on:click={() => handleItemSelection(index)}
        >
          <div class="flex items-start space-x-3">
            {#if result.post.featured_image_url}
              <img
                src={result.post.featured_image_url}
                alt=""
                class="w-12 h-12 rounded object-cover flex-shrink-0"
                loading="lazy"
              />
            {:else}
              <div class="w-12 h-12 bg-white border border-black flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            {/if}
            
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-light font-mono text-black truncate">
                {result.post.title}
              </h4>
              {#if result.snippet}
                <p class="text-xs text-black font-mono font-light mt-1 line-clamp-2">
                  {@html result.snippet}
                </p>
              {/if}
              <div class="flex items-center mt-1 text-xs text-black font-mono font-light">
                {#if result.post.categories && result.post.categories.length > 0}
                  <span class="mr-2">{result.post.categories[0].name}</span>
                {/if}
                {#if result.post.reading_time}
                  <span>{result.post.reading_time} min read</span>
                {/if}
              </div>
            </div>
          </div>
        </button>
      {/each}

      <!-- Suggestions -->
      {#if suggestions.length > 0 && (searchResults.length === 0 || searchQuery.length < minQueryLength)}
        {#if searchResults.length > 0}
          <div class="px-4 py-2 text-xs font-light font-mono text-black bg-white border-b border-black">
            Suggestions
          </div>
        {/if}
        
        {#each suggestions as suggestion, index}
          {@const adjustedIndex = searchResults.length + index}
          <button
            class="w-full px-4 py-2 text-left hover:bg-black hover:text-white border-b border-black last:border-b-0 transition-colors duration-150 {
              selectedIndex === adjustedIndex ? 'bg-black text-white' : ''
            }"
            on:click={() => handleItemSelection(adjustedIndex)}
          >
            <div class="flex items-center space-x-3">
              {#if suggestion.type === 'recent'}
                <svg class="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              {:else if suggestion.type === 'category'}
                <svg class="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              {:else if suggestion.type === 'tag'}
                <svg class="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              {/if}
              
              <span class="text-sm text-black font-mono font-light">
                {suggestion.query}
              </span>
              
              {#if suggestion.type === 'category' || suggestion.type === 'tag'}
                <span class="text-xs text-black font-mono font-light">
                  {suggestion.data.post_count} posts
                </span>
              {:else if suggestion.type === 'recent'}
                <span class="text-xs text-black font-mono font-light">Recent</span>
              {/if}
            </div>
          </button>
        {/each}
      {/if}

      <!-- No Results -->
      {#if searchResults.length === 0 && suggestions.length === 0 && searchQuery.length >= minQueryLength && !isSearching}
        <div class="px-4 py-6 text-center text-black">
          <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm font-mono font-light">No results found for "{searchQuery}"</p>
          <button
            class="mt-2 text-sm text-black font-mono font-light hover:bg-black hover:text-white border border-black px-2 py-1"
            on:click={() => navigateToSearch(searchQuery)}
          >
            Search all posts →
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>