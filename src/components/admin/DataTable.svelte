<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let data: any[] = [];
  export let columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    searchable?: boolean;
    render?: (value: any, row: any) => string;
    component?: any;
    width?: string;
    align?: 'left' | 'center' | 'right';
  }> = [];
  export let loading: boolean = false;
  export let selectable: boolean = false;
  export let sortBy: string = '';
  export let sortOrder: 'asc' | 'desc' = 'asc';
  export let searchQuery: string = '';
  export let emptyMessage: string = 'No data available';
  export let emptyIcon: string = '';
  export let showSearch: boolean = true;
  export let showPagination: boolean = true;
  export let pageSize: number = 20;
  export let currentPage: number = 1;
  export let totalItems: number = 0;
  export let bulkActions: Array<{
    key: string;
    label: string;
    icon?: string;
    color?: string;
    confirm?: boolean;
  }> = [];
  
  const dispatch = createEventDispatcher();
  
  let selectedItems: Set<any> = new Set();
  let searchInput: string = searchQuery;
  let selectAllChecked: boolean = false;
  
  //computed values
  $: totalPages = Math.ceil(totalItems / pageSize);
  $: hasSelection = selectedItems.size > 0;
  $: allVisibleSelected = data.length > 0 && data.every(item => selectedItems.has(item.id || item));
  
  //reactive updates
  $: {
    selectAllChecked = allVisibleSelected;
  }
  
  function handleSort(column: any) {
    if (!column.sortable) return;
    
    const newSortOrder = sortBy === column.key && sortOrder === 'asc' ? 'desc' : 'asc';
    
    dispatch('sort', {
      sortBy: column.key,
      sortOrder: newSortOrder
    });
  }
  
  function handleSearch() {
    dispatch('search', {
      query: searchInput
    });
  }
  
  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchInput = target.value;
    
    //debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      handleSearch();
    }, 300);
  }
  
  let searchTimeout: number;
  
  function handleSelectAll() {
    if (selectAllChecked) {
      //deselect all visible items
      data.forEach(item => {
        selectedItems.delete(item.id || item);
      });
    } else {
      //select all visible items
      data.forEach(item => {
        selectedItems.add(item.id || item);
      });
    }
    selectedItems = selectedItems;
    
    dispatch('selection-change', {
      selectedItems: Array.from(selectedItems)
    });
  }
  
  function handleItemSelect(item: any) {
    const itemId = item.id || item;
    
    if (selectedItems.has(itemId)) {
      selectedItems.delete(itemId);
    } else {
      selectedItems.add(itemId);
    }
    selectedItems = selectedItems;
    
    dispatch('selection-change', {
      selectedItems: Array.from(selectedItems)
    });
  }
  
  function handleBulkAction(action: any) {
    if (selectedItems.size === 0) return;
    
    if (action.confirm) {
      if (!confirm(`Are you sure you want to ${action.label.toLowerCase()} ${selectedItems.size} item(s)?`)) {
        return;
      }
    }
    
    dispatch('bulk-action', {
      action: action.key,
      items: Array.from(selectedItems)
    });
  }
  
  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages) return;
    
    dispatch('page-change', {
      page
    });
  }
  
  function getSortIcon(column: any): string {
    if (!column.sortable) return '';
    if (sortBy !== column.key) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  }
  
  function getCellValue(row: any, column: any): string {
    const value = row[column.key];
    
    if (column.render) {
      return column.render(value, row);
    }
    
    if (value === null || value === undefined) {
      return '';
    }
    
    return String(value);
  }
  
  //generate pagination range
  function getPaginationRange(): number[] {
    const range: number[] = [];
    const maxButtons = 5;
    
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      const end = Math.min(totalPages, start + maxButtons - 1);
      
      for (let i = start; i <= end; i++) {
        range.push(i);
      }
    }
    
    return range;
  }
</script>

<div class="data-table">
  <!-- Header with Search and Bulk Actions -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
    {#if showSearch}
      <div class="flex-1 max-w-md">
        <div class="relative">
          <input
            type="text"
            bind:value={searchInput}
            on:input={handleSearchInput}
            placeholder="Search..."
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
          </div>
        </div>
      </div>
    {/if}
    
    {#if hasSelection && bulkActions.length > 0}
      <div class="flex items-center space-x-2">
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {selectedItems.size} selected
        </span>
        <div class="flex space-x-2">
          {#each bulkActions as action}
            <button
              type="button"
              on:click={() => handleBulkAction(action)}
              class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-{action.color || 'blue'}-600 hover:bg-{action.color || 'blue'}-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-{action.color || 'blue'}-500"
            >
              {#if action.icon}
                <span class="mr-1">{action.icon}</span>
              {/if}
              {action.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  
  <!-- Table -->
  <div class="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
    {#if loading}
      <div class="p-8 text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    {:else if data.length === 0}
      <div class="p-8 text-center">
        {#if emptyIcon}
          <div class="text-4xl mb-4">{emptyIcon}</div>
        {:else}
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        {/if}
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No data</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              {#if selectable}
                <th scope="col" class="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    bind:checked={selectAllChecked}
                    on:change={handleSelectAll}
                    class="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  >
                </th>
              {/if}
              
              {#each columns as column}
                <th
                  scope="col"
                  class="px-6 py-3 text-{column.align || 'left'} text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider {column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}"
                  style={column.width ? `width: ${column.width}` : ''}
                  on:click={() => handleSort(column)}
                >
                  <div class="flex items-center {column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end' : 'justify-start'}">
                    {column.label}
                    {#if column.sortable}
                      <span class="ml-1 text-xs">{getSortIcon(column)}</span>
                    {/if}
                  </div>
                </th>
              {/each}
            </tr>
          </thead>
          
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {#each data as row, index}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                {#if selectable}
                  <td class="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(row.id || row)}
                      on:change={() => handleItemSelect(row)}
                      class="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    >
                  </td>
                {/if}
                
                {#each columns as column}
                  <td class="px-6 py-4 text-{column.align || 'left'} text-sm text-gray-900 dark:text-white">
                    {#if column.component}
                      <svelte:component this={column.component} {row} {column} />
                    {:else}
                      <span class={column.align === 'right' ? 'whitespace-nowrap' : ''}>
                        {@html getCellValue(row, column)}
                      </span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
  
  <!-- Pagination -->
  {#if showPagination && totalPages > 1}
    <div class="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
      <div class="flex-1 flex justify-between sm:hidden">
        <button
          on:click={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          class="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          on:click={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      
      <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700 dark:text-gray-300">
            Showing
            <span class="font-medium">{(currentPage - 1) * pageSize + 1}</span>
            to
            <span class="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span>
            of
            <span class="font-medium">{totalItems}</span>
            results
          </p>
        </div>
        
        <div>
          <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              on:click={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="sr-only">Previous</span>
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </button>
            
            {#each getPaginationRange() as page}
              <button
                on:click={() => handlePageChange(page)}
                class="relative inline-flex items-center px-4 py-2 border text-sm font-medium {
                  page === currentPage
                    ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-200'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }"
              >
                {page}
              </button>
            {/each}
            
            <button
              on:click={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="sr-only">Next</span>
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .data-table {
    @apply w-full;
  }
</style>