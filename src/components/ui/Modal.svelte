<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let closeOnOverlay = true;
  export let closeOnEscape = true;
  
  const dispatch = createEventDispatcher<{
    close: void;
    open: void;
  }>();
  
  let dialog: HTMLDialogElement;
  let previousActiveElement: HTMLElement | null = null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  
  $: if (dialog) {
    if (open) {
      previousActiveElement = document.activeElement as HTMLElement;
      dialog.showModal();
      dispatch('open');
    } else {
      dialog.close();
      previousActiveElement?.focus();
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && closeOnEscape) {
      close();
    }
  }
  
  function handleOverlayClick(event: MouseEvent) {
    if (event.target === dialog && closeOnOverlay) {
      close();
    }
  }
  
  function close() {
    open = false;
    dispatch('close');
  }
  
  onMount(() => {
    // Trap focus within modal
    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
    });
  });
</script>

<dialog
  bind:this={dialog}
  on:keydown={handleKeydown}
  on:click={handleOverlayClick}
  class="backdrop:bg-black backdrop:bg-opacity-50 backdrop:backdrop-blur-sm bg-transparent border-none outline-none p-0 max-h-screen overflow-y-auto"
>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="bg-primary rounded-lg shadow-xl border border-border-primary w-full {sizeClasses[size]} max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      {#if title || $$slots.header}
        <div class="flex items-center justify-between p-6 border-b border-border-primary">
          <div class="flex-1">
            {#if title}
              <h2 class="text-xl font-semibold text-text-primary">{title}</h2>
            {:else}
              <slot name="header" />
            {/if}
          </div>
          <button
            on:click={close}
            class="p-2 hover:bg-secondary rounded-lg transition-colors duration-fast"
            aria-label="Close modal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      {/if}
      
      <!-- Content -->
      <div class="p-6">
        <slot />
      </div>
      
      <!-- Footer -->
      {#if $$slots.footer}
        <div class="flex items-center justify-end space-x-3 p-6 border-t border-border-primary">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
</dialog>

<style>
  dialog[open] {
    animation: fade-in 0.2s ease-out;
  }
  
  dialog[open] > div > div {
    animation: slide-in 0.2s ease-out;
  }
  
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slide-in {
    from { 
      opacity: 0;
      transform: translateY(-1rem) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>