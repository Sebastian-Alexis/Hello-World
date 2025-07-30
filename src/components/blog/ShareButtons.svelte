<!--
================================================================================
SHARE BUTTONS COMPONENT - Social media sharing with analytics tracking
Provides sharing buttons for various platforms with proper tracking
================================================================================
-->

<script lang="ts">
  import { onMount } from 'svelte';

  //props
  export let url: string;
  export let title: string;
  export let description = '';
  export let hashtags: string[] = [];
  export let via = ''; // Twitter username
  export let variant: 'horizontal' | 'vertical' | 'compact' = 'horizontal';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let showLabels = true;
  export let showCopyLink = true;
  export let className = '';

  //reactive state
  let showTooltip = '';
  let copySuccess = false;

  //ensure absolute URL
  $: absoluteUrl = url.startsWith('http') ? url : `${window?.location?.origin || ''}${url}`;
  
  //encode content for sharing
  $: encodedTitle = encodeURIComponent(title);
  $: encodedDescription = encodeURIComponent(description);
  $: encodedUrl = encodeURIComponent(absoluteUrl);
  $: encodedHashtags = hashtags.map(tag => encodeURIComponent(tag)).join(',');

  //share platform configurations
  const platforms = [
    {
      name: 'Twitter',
      icon: 'twitter',
      color: '#1DA1F2',
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}${via ? `&via=${via}` : ''}${hashtags.length ? `&hashtags=${encodedHashtags}` : ''}`,
      label: 'Share on Twitter'
    },
    {
      name: 'Facebook',
      icon: 'facebook',
      color: '#1877F2',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
      label: 'Share on Facebook'
    },
    {
      name: 'LinkedIn',
      icon: 'linkedin',
      color: '#0A66C2',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`,
      label: 'Share on LinkedIn'
    },
    {
      name: 'Reddit',
      icon: 'reddit',
      color: '#FF4500',
      url: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      label: 'Share on Reddit'
    },
    {
      name: 'Hacker News',
      icon: 'hackernews',
      color: '#FF6600',
      url: `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodedTitle}`,
      label: 'Share on Hacker News'
    },
    {
      name: 'Email',
      icon: 'email',
      color: '#6B7280',
      url: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
      label: 'Share via Email'
    }
  ];

  //size configurations
  const sizeConfig = {
    sm: { button: 'w-8 h-8', icon: 'w-4 h-4', text: 'text-xs' },
    md: { button: 'w-10 h-10', icon: 'w-5 h-5', text: 'text-sm' },
    lg: { button: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-base' }
  };

  //layout classes
  const layoutClasses = {
    horizontal: 'flex flex-wrap items-center gap-2',
    vertical: 'flex flex-col items-center space-y-2',
    compact: 'flex items-center space-x-1'
  };

  //handle platform sharing
  function shareToPlatform(platform: typeof platforms[0]) {
    //track sharing event
    trackShareEvent(platform.name.toLowerCase());

    //open share window
    if (platform.name === 'Email') {
      window.location.href = platform.url;
    } else {
      window.open(
        platform.url,
        `share-${platform.name.toLowerCase()}`,
        'width=600,height=400,scrollbars=yes,resizable=yes'
      );
    }
  }

  //copy link to clipboard
  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      copySuccess = true;
      trackShareEvent('copy-link');
      
      setTimeout(() => {
        copySuccess = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      //fallback for older browsers
      fallbackCopyToClipboard(absoluteUrl);
    }
  }

  //fallback copy method
  function fallbackCopyToClipboard(text: string) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      copySuccess = true;
      trackShareEvent('copy-link');
      setTimeout(() => { copySuccess = false; }, 2000);
    } catch (error) {
      console.error('Fallback copy failed:', error);
    }
    
    document.body.removeChild(textArea);
  }

  //track sharing events (integrate with your analytics)
  function trackShareEvent(platform: string) {
    //gtag integration
    if (typeof gtag !== 'undefined') {
      gtag('event', 'share', {
        method: platform,
        content_type: 'blog_post',
        item_id: url,
      });
    }

    //custom analytics
    if (typeof window !== 'undefined' && window.customAnalytics) {
      window.customAnalytics.track('blog_post_shared', {
        platform,
        url: absoluteUrl,
        title,
      });
    }
  }

  //native web share API
  function useNativeShare() {
    if (navigator.share) {
      navigator.share({
        title,
        text: description,
        url: absoluteUrl,
      }).then(() => {
        trackShareEvent('native-share');
      }).catch(error => {
        console.log('Native share cancelled or failed:', error);
      });
    }
  }

  //check if native share is available
  $: hasNativeShare = typeof navigator !== 'undefined' && navigator.share;

  //tooltip functions
  function showTooltipFor(platform: string) {
    showTooltip = platform;
  }

  function hideTooltip() {
    showTooltip = '';
  }
</script>

<div class="share-buttons {className}">
  
  <!-- Share Label -->
  {#if showLabels && variant !== 'compact'}
    <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
      Share this post:
    </span>
  {/if}

  <div class={layoutClasses[variant]}>
    
    <!-- Native Share Button (mobile) -->
    {#if hasNativeShare && variant !== 'compact'}
      <button
        on:click={useNativeShare}
        class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
        aria-label="Share via device"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
        Share
      </button>
    {/if}

    <!-- Social Platform Buttons -->
    {#each platforms as platform}
      <div class="relative">
        <button
          on:click={() => shareToPlatform(platform)}
          on:mouseenter={() => showTooltipFor(platform.name)}
          on:mouseleave={hideTooltip}
          class="inline-flex items-center justify-center {sizeConfig[size].button} rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
          style="background-color: {platform.color}; color: white;"
          aria-label={platform.label}
        >
          
          <!-- Platform Icons -->
          {#if platform.icon === 'twitter'}
            <svg class={sizeConfig[size].icon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
          {:else if platform.icon === 'facebook'}
            <svg class={sizeConfig[size].icon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          {:else if platform.icon === 'linkedin'}
            <svg class={sizeConfig[size].icon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          {:else if platform.icon === 'reddit'}
            <svg class={sizeConfig[size].icon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
            </svg>
          {:else if platform.icon === 'hackernews'}
            <svg class={sizeConfig[size].icon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896h-1.88z"/>
            </svg>
          {:else if platform.icon === 'email'}
            <svg class={sizeConfig[size].icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          {/if}

          <!-- Label for larger sizes -->
          {#if showLabels && size === 'lg' && variant === 'horizontal'}
            <span class="ml-2 {sizeConfig[size].text} font-medium">
              {platform.name}
            </span>
          {/if}
        </button>

        <!-- Tooltip -->
        {#if showTooltip === platform.name && variant === 'compact'}
          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg z-10">
            {platform.label}
            <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        {/if}
      </div>
    {/each}

    <!-- Copy Link Button -->
    {#if showCopyLink}
      <div class="relative">
        <button
          on:click={copyToClipboard}
          on:mouseenter={() => showTooltipFor('copy')}
          on:mouseleave={hideTooltip}
          class="inline-flex items-center justify-center {sizeConfig[size].button} bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          aria-label="Copy link to clipboard"
        >
          {#if copySuccess}
            <svg class={sizeConfig[size].icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {:else}
            <svg class={sizeConfig[size].icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          {/if}

          {#if showLabels && size === 'lg' && variant === 'horizontal'}
            <span class="ml-2 {sizeConfig[size].text} font-medium">
              {copySuccess ? 'Copied!' : 'Copy'}
            </span>
          {/if}
        </button>

        <!-- Copy Tooltip -->
        {#if (showTooltip === 'copy' || copySuccess) && variant === 'compact'}
          <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg z-10 whitespace-nowrap">
            {copySuccess ? 'Copied to clipboard!' : 'Copy link'}
            <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        {/if}
      </div>
    {/if}

  </div>
</div>

<style>
  .share-buttons :global(.share-buttons button:hover) {
    transform: translateY(-1px);
  }
</style>