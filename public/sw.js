// =============================================================================
// SERVICE WORKER - Caching and offline functionality for blog system
// Provides intelligent caching strategies for optimal performance
// =============================================================================

const CACHE_VERSION = 'v2.1.0';
const CACHE_NAMES = {
  STATIC: `blog-static-${CACHE_VERSION}`,
  DYNAMIC: `blog-dynamic-${CACHE_VERSION}`,
  IMAGES: `blog-images-${CACHE_VERSION}`,
  API: `blog-api-${CACHE_VERSION}`,
};

//resources to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/blog',
  '/manifest.json',
  //add core CSS and JS files here
];

//critical resources for cache warming
const CRITICAL_RESOURCES = [
  '/api/blog?limit=5', // latest blog posts
  '/api/blog/categories',
  '/css/main.css',
  '/js/main.js',
];

//prefetch resources for improved performance
const PREFETCH_RESOURCES = [
  '/api/blog/popular',
  '/api/blog/featured',
  '/images/hero-bg.webp',
  '/fonts/inter-var.woff2',
];

//API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/blog(\?.*)?$/,
  /\/api\/blog\/categories/,
  /\/api\/blog\/tags/,
  /\/api\/blog\/search/,
];

//cache duration configurations (in milliseconds) - Plan 7 specifications
const CACHE_DURATIONS = {
  STATIC: 30 * 24 * 60 * 60 * 1000, // 30 days - static assets
  DYNAMIC: 24 * 60 * 60 * 1000,     // 1 day - dynamic content
  IMAGES: 7 * 24 * 60 * 60 * 1000,  // 7 days - images
  API: 5 * 60 * 1000,               // 5 minutes - API responses
};

//cache size limits for intelligent cleanup
const CACHE_LIMITS = {
  STATIC: 50,   // max 50 static files
  DYNAMIC: 30,  // max 30 dynamic pages
  IMAGES: 100,  // max 100 images
  API: 20,      // max 20 API responses
};

//performance monitoring configuration
const PERF_CONFIG = {
  ENABLED: true,
  SAMPLE_RATE: 0.1, // 10% sampling
  METRICS: ['FCP', 'LCP', 'FID', 'CLS', 'TTFB'],
  BATCH_SIZE: 10,
  FLUSH_INTERVAL: 30000, // 30 seconds
};

//install event - cache static assets and warm cache
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      //cache static assets
      caches.open(CACHE_NAMES.STATIC)
        .then(cache => {
          console.log('Service Worker: Caching static assets');
          return cache.addAll(STATIC_ASSETS);
        }),
      
      //warm critical caches
      warmCriticalCaches(),
      
      //initialize IndexedDB
      dbManager.init().catch(error => {
        console.warn('Service Worker: IndexedDB initialization failed', error);
      })
    ])
    .then(() => {
      console.log('Service Worker: Installation completed');
      //skip waiting to activate immediately
      return self.skipWaiting();
    })
    .catch(error => {
      console.error('Service Worker: Installation failed', error);
    })
  );
});

//cache warming for critical resources
async function warmCriticalCaches() {
  console.log('Service Worker: Warming critical caches');
  
  const cachePromises = CRITICAL_RESOURCES.map(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const cache = await getCacheForResource(url);
        const responseWithTimestamp = addTimestamp(response.clone());
        await cache.put(url, responseWithTimestamp);
        console.log(`Service Worker: Warmed cache for ${url}`);
      }
    } catch (error) {
      console.warn(`Service Worker: Failed to warm cache for ${url}`, error);
    }
  });
  
  await Promise.allSettled(cachePromises);
}

//determine appropriate cache for a resource
async function getCacheForResource(url) {
  if (isAPIRequest({ url })) {
    return caches.open(CACHE_NAMES.API);
  } else if (isImageRequest({ url })) {
    return caches.open(CACHE_NAMES.IMAGES);
  } else if (isStaticAsset({ url })) {
    return caches.open(CACHE_NAMES.STATIC);
  } else {
    return caches.open(CACHE_NAMES.DYNAMIC);
  }
}

//prefetch resources in the background
async function prefetchResources() {
  if (!navigator.onLine) return;
  
  console.log('Service Worker: Prefetching resources');
  
  const prefetchPromises = PREFETCH_RESOURCES.map(async (url) => {
    try {
      //only prefetch if not already cached
      const cache = await getCacheForResource(url);
      const cached = await cache.match(url);
      
      if (!cached || isExpired(cached, CACHE_DURATIONS.DYNAMIC)) {
        const response = await fetch(url, { 
          headers: { 'X-Purpose': 'prefetch' } 
        });
        
        if (response.ok) {
          const responseWithTimestamp = addTimestamp(response.clone());
          await cache.put(url, responseWithTimestamp);
          console.log(`Service Worker: Prefetched ${url}`);
        }
      }
    } catch (error) {
      console.warn(`Service Worker: Failed to prefetch ${url}`, error);
    }
  });
  
  await Promise.allSettled(prefetchPromises);
}

//activate event - cleanup old caches and initialize systems
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      //cleanup old caches
      caches.keys()
        .then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => {
              //delete old cache versions
              if (cacheName.startsWith('blog-') && !Object.values(CACHE_NAMES).includes(cacheName)) {
                console.log('Service Worker: Deleting old cache', cacheName);
                return caches.delete(cacheName);
              }
            })
          );
        }),
      
      //initialize performance monitoring
      initializePerformanceMonitoring(),
      
      //setup periodic cleanup
      setupPeriodicCleanup()
    ])
    .then(() => {
      console.log('Service Worker: Activated');
      //claim all clients immediately
      return self.clients.claim();
    })
    .catch(error => {
      console.error('Service Worker: Activation failed', error);
    })
  );
});

//initialize performance monitoring systems
async function initializePerformanceMonitoring() {
  if (!PERF_CONFIG.ENABLED) return;
  
  try {
    //setup periodic performance capture
    setInterval(() => {
      capturePerformanceMetrics().catch(error => {
        console.warn('Service Worker: Periodic performance capture failed', error);
      });
    }, PERF_CONFIG.FLUSH_INTERVAL);
    
    console.log('Service Worker: Performance monitoring initialized');
  } catch (error) {
    console.warn('Service Worker: Performance monitoring initialization failed', error);
  }
}

//setup periodic cache cleanup
async function setupPeriodicCleanup() {
  try {
    //register periodic background sync for cleanup
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      
      //schedule cleanup every hour
      setInterval(async () => {
        try {
          await registration.sync.register('cache-cleanup');
        } catch (error) {
          console.warn('Service Worker: Failed to register cleanup sync', error);
        }
      }, 60 * 60 * 1000); // 1 hour
    }
    
    console.log('Service Worker: Periodic cleanup scheduled');
  } catch (error) {
    console.warn('Service Worker: Periodic cleanup setup failed', error);
  }
}

//fetch event - handle caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  //only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  //trigger prefetch on first request (with throttling)
  if (Math.random() < 0.05) { // 5% chance to avoid overwhelming
    prefetchResources().catch(error => {
      console.warn('Service Worker: Prefetch failed', error);
    });
  }
  
  //determine caching strategy based on request type
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isBlogPageRequest(request)) {
    event.respondWith(handleBlogPageRequest(request));
  }
});

//static assets: cache-first strategy with performance tracking
async function handleStaticAsset(request) {
  const startTime = performance.now();
  let cacheHit = false;
  
  try {
    const cache = await caches.open(CACHE_NAMES.STATIC);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.STATIC)) {
      cacheHit = true;
      trackCachePerformance(request, true, performance.now() - startTime);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      //add timestamp to response for expiration checking
      const responseWithTimestamp = addTimestamp(networkResponse.clone());
      cache.put(request, responseWithTimestamp);
    }
    
    trackCachePerformance(request, false, performance.now() - startTime);
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Static asset error', error);
    
    //fallback to cache if network fails
    const cache = await caches.open(CACHE_NAMES.STATIC);
    const fallbackResponse = await cache.match(request);
    
    if (fallbackResponse) {
      cacheHit = true;
    }
    
    trackCachePerformance(request, cacheHit, performance.now() - startTime);
    
    return fallbackResponse || new Response('Asset not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

//images: cache-first with long expiration
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAMES.IMAGES);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.IMAGES)) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseWithTimestamp = addTimestamp(networkResponse.clone());
      cache.put(request, responseWithTimestamp);
      
      //intelligent cleanup for images
      if (Math.random() < 0.1) { // 10% chance to trigger cleanup
        cleanupCache(CACHE_NAMES.IMAGES, CACHE_LIMITS.IMAGES);
      }
    }
    
    return networkResponse;
  } catch (error) {
    //fallback to cached version or placeholder
    const cache = await caches.open(CACHE_NAMES.IMAGES);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    //return an enhanced placeholder image
    const url = new URL(request.url);
    const filename = url.pathname.split('/').pop();
    const isLoading = url.searchParams.has('loading');
    
    return new Response(
      createPlaceholderSVG(300, 200, 
        isLoading ? 'Loading image...' : `${filename} unavailable offline`, 
        isLoading
      ),
      {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache',
          'X-Placeholder-Type': isLoading ? 'loading' : 'offline'
        }
      }
    );
  }
}

//API requests: network-first with cache fallback
async function handleAPIRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAMES.API);
    
    //try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      //cache successful API responses
      const responseWithTimestamp = addTimestamp(networkResponse.clone());
      cache.put(request, responseWithTimestamp);
      return networkResponse;
    }
    
    throw new Error(`API request failed: ${networkResponse.status}`);
    
  } catch (error) {
    console.warn('Service Worker: API network failed, trying cache', error);
    
    //fallback to cache
    const cache = await caches.open(CACHE_NAMES.API);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.API)) {
      //add header to indicate this is cached data
      const response = cachedResponse.clone();
      response.headers.set('X-Cache-Status', 'cached');
      return response;
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: 'API unavailable offline',
      message: 'Please check your internet connection'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache-Status': 'offline'
      }
    });
  }
}

//blog pages: network-first with stale-while-revalidate
async function handleBlogPageRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAMES.DYNAMIC);
    
    //check cache first for immediate response
    const cachedResponse = await cache.match(request);
    
    //try network
    const networkPromise = fetch(request)
      .then(networkResponse => {
        if (networkResponse.ok) {
          const responseWithTimestamp = addTimestamp(networkResponse.clone());
          cache.put(request, responseWithTimestamp);
        }
        return networkResponse;
      })
      .catch(() => null);
    
    //return cached response immediately if available, otherwise wait for network
    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.DYNAMIC)) {
      //serve from cache and update in background
      networkPromise.catch(() => {}); // Fire and forget
      return cachedResponse;
    }
    
    //wait for network response
    const networkResponse = await networkPromise;
    if (networkResponse) {
      return networkResponse;
    }
    
    //fallback to stale cache if network fails
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw new Error('No cached version available');
    
  } catch (error) {
    //enhanced offline fallback with better UX
    return createOfflineFallbackResponse(request.url);
  }
}

//create enhanced offline fallback responses
function createOfflineFallbackResponse(url) {
  const urlPath = new URL(url).pathname;
  const isHomePage = urlPath === '/' || urlPath === '/blog';
  const isBlogPost = urlPath.startsWith('/blog/');
  
  const pageTitle = isHomePage ? 'Blog - Offline' : 
                   isBlogPost ? 'Blog Post - Offline' : 
                   'Page - Offline';
  
  const specificMessage = isHomePage ? 
    'The latest blog posts aren\'t available offline, but you can browse cached posts.' :
    isBlogPost ? 
    'This blog post isn\'t cached. Try viewing it online or check other cached posts.' :
    'This page isn\'t available offline. Please check your internet connection.';
  
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${pageTitle}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#3b82f6">
        <style>
          :root {
            --bg-color: #ffffff;
            --text-color: #1f2937;
            --accent-color: #3b82f6;
            --border-color: #e5e7eb;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg-color: #111827;
              --text-color: #f9fafb;
              --accent-color: #60a5fa;
              --border-color: #374151;
            }
          }
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            background: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            margin: 0;
            padding: 2rem;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .offline-container {
            max-width: 500px;
            text-align: center;
            padding: 2rem;
            border-radius: 1rem;
            border: 1px solid var(--border-color);
            background: var(--bg-color);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .offline-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 1.5rem;
            opacity: 0.8;
          }
          h1 {
            margin: 0 0 1rem;
            font-size: 1.5rem;
            font-weight: 600;
          }
          p {
            margin: 0 0 1.5rem;
            opacity: 0.8;
          }
          .actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
          }
          .btn {
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            border: none;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: all 0.2s;
          }
          .btn-primary {
            background: var(--accent-color);
            color: white;
          }
          .btn-secondary {
            background: transparent;
            color: var(--text-color);
            border: 1px solid var(--border-color);
          }
          .btn:hover {
            transform: translateY(-1px);
          }
          .network-status {
            margin-top: 1.5rem;
            padding: 1rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            opacity: 0.9;
          }
          .status-offline {
            background: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
          }
          @media (prefers-color-scheme: dark) {
            .status-offline {
              background: #1f1617;
              color: #fca5a5;
              border: 1px solid #7f1d1d;
            }
          }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <div class="offline-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <path d="M9 22V12h6v10"/>
              <path d="M12 8v4"/>
              <path d="M12 16h.01"/>
            </svg>
          </div>
          <h1>You're offline</h1>
          <p>${specificMessage}</p>
          <div class="actions">
            <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
            ${isHomePage ? '' : '<a href="/" class="btn btn-secondary">Go Home</a>'}
            <button class="btn btn-secondary" onclick="showCacheInfo()">Cache Info</button>
          </div>
          <div id="network-status" class="network-status status-offline">
            📡 Network: Offline
          </div>
        </div>
        
        <script>
          //enhanced offline page functionality
          function showCacheInfo() {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                const channel = new MessageChannel();
                channel.port1.onmessage = event => {
                  const stats = event.data;
                  alert('Cache Status:\n' + 
                    'Static files: ' + (stats.static || 0) + '\n' +
                    'Images: ' + (stats.images || 0) + '\n' +
                    'Dynamic pages: ' + (stats.dynamic || 0) + '\n' +
                    'API responses: ' + (stats.api || 0)
                  );
                };
                registration.active.postMessage(
                  { type: 'GET_CACHE_STATS' },
                  [channel.port2]
                );
              });
            }
          }
          
          //monitor network status
          function updateNetworkStatus() {
            const statusEl = document.getElementById('network-status');
            if (navigator.onLine) {
              statusEl.textContent = '📡 Network: Online';
              statusEl.className = 'network-status';
              statusEl.style.background = '#f0fdf4';
              statusEl.style.color = '#166534';
              statusEl.style.borderColor = '#bbf7d0';
            } else {
              statusEl.textContent = '📡 Network: Offline';
              statusEl.className = 'network-status status-offline';
            }
          }
          
          window.addEventListener('online', updateNetworkStatus);
          window.addEventListener('offline', updateNetworkStatus);
          updateNetworkStatus();
          
          //auto-retry when back online
          window.addEventListener('online', () => {
            setTimeout(() => {
              if (confirm('Network is back! Reload the page?')) {
                location.reload();
              }
            }, 1000);
          });
        </script>
      </body>
    </html>
  `, {
    status: 503,
    headers: {
      'Content-Type': 'text/html',
      'X-Cache-Status': 'offline',
      'Cache-Control': 'no-cache'
    }
  });
}

//helper functions with enhanced detection
function isStaticAsset(request) {
  const url = new URL(request.url);
  return /\.(css|js|woff2?|ttf|eot|ico)$/.test(url.pathname) ||
         url.pathname === '/manifest.json' ||
         url.pathname === '/favicon.ico' ||
         url.pathname.startsWith('/static/') ||
         url.pathname.startsWith('/assets/');
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(url.pathname);
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isBlogPageRequest(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && 
         (url.pathname.startsWith('/blog') || url.pathname === '/');
}

function addTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('X-SW-Cache-Time', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

function isExpired(response, maxAge) {
  const cacheTime = response.headers.get('X-SW-Cache-Time');
  if (!cacheTime) return true;
  
  return Date.now() - parseInt(cacheTime) > maxAge;
}

//enhanced placeholder generation with progressive loading support
function createPlaceholderSVG(width, height, text, showSpinner = false) {
  const spinnerSVG = showSpinner ? `
    <circle cx="50%" cy="30%" r="20" fill="none" stroke="#3b82f6" stroke-width="3" stroke-dasharray="31.416" stroke-dashoffset="31.416">
      <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
    </circle>
  ` : '';
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style="stroke:#e5e7eb,stroke-width:1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#diagonalHatch)"/>
      ${spinnerSVG}
      <text x="50%" y="${showSpinner ? '70%' : '50%'}" font-family="system-ui, sans-serif" font-size="14" 
            fill="#6b7280" text-anchor="middle" dy="0.3em">${text}</text>
    </svg>
  `;
}

//progressive image loading with blur-up technique
function createProgressiveImagePlaceholder(width, height, blurDataURL = null) {
  if (blurDataURL) {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <filter id="blur">
          <feGaussianBlur stdDeviation="10"/>
        </filter>
        <image href="${blurDataURL}" width="100%" height="100%" style="filter:url(#blur)"/>
        <rect width="100%" height="100%" fill="rgba(255,255,255,0.1)"/>
      </svg>
    `;
  }
  
  //fallback to geometric placeholder
  return createPlaceholderSVG(width, height, 'Loading...', true);
}

//intelligent cache cleanup with size and expiration management
async function cleanupCache(cacheName, limit) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    //remove expired entries first
    const responses = await Promise.all(
      requests.map(async request => ({
        request,
        response: await cache.match(request),
        timestamp: await getCacheTimestamp(cache, request)
      }))
    );
    
    //filter out expired entries
    const cacheType = Object.keys(CACHE_NAMES).find(key => CACHE_NAMES[key] === cacheName);
    const maxAge = CACHE_DURATIONS[cacheType] || CACHE_DURATIONS.DYNAMIC;
    
    const expiredRequests = responses.filter(({ timestamp }) => 
      Date.now() - timestamp > maxAge
    );
    
    //delete expired entries
    await Promise.all(
      expiredRequests.map(({ request }) => cache.delete(request))
    );
    
    //check if we still need to cleanup by size
    const remainingRequests = await cache.keys();
    if (remainingRequests.length > limit) {
      const remainingResponses = await Promise.all(
        remainingRequests.map(async request => ({
          request,
          timestamp: await getCacheTimestamp(cache, request)
        }))
      );
      
      //sort by timestamp and remove oldest entries
      const toDelete = remainingResponses
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, remainingRequests.length - limit);
      
      await Promise.all(
        toDelete.map(({ request }) => cache.delete(request))
      );
    }
    
    console.log(`Service Worker: Cleaned up cache ${cacheName}, removed ${expiredRequests.length} expired entries`);
  } catch (error) {
    console.warn(`Service Worker: Failed to cleanup cache ${cacheName}`, error);
  }
}

//get cache timestamp from response headers
async function getCacheTimestamp(cache, request) {
  try {
    const response = await cache.match(request);
    const timestamp = response?.headers.get('X-SW-Cache-Time');
    return timestamp ? parseInt(timestamp) : 0;
  } catch {
    return 0;
  }
}

//cleanup all caches based on their limits
async function performIntelligentCleanup() {
  const cleanupPromises = Object.entries(CACHE_NAMES).map(([type, cacheName]) => 
    cleanupCache(cacheName, CACHE_LIMITS[type])
  );
  
  await Promise.all(cleanupPromises);
}

//handle background sync for failed requests and performance data
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  switch (event.tag) {
    case 'blog-analytics':
      event.waitUntil(syncAnalytics());
      break;
    case 'performance-metrics':
      event.waitUntil(syncPerformanceMetrics());
      break;
    case 'cache-cleanup':
      event.waitUntil(performIntelligentCleanup());
      break;
    default:
      console.log('Service Worker: Unknown sync tag', event.tag);
  }
});

//enhanced analytics sync with IndexedDB support
async function syncAnalytics() {
  try {
    const analyticsQueue = await getAnalyticsQueue();
    
    if (analyticsQueue.length === 0) {
      console.log('Service Worker: No analytics to sync');
      return;
    }
    
    //batch sync for better performance
    const batchSize = 10;
    for (let i = 0; i < analyticsQueue.length; i += batchSize) {
      const batch = analyticsQueue.slice(i, i + batchSize);
      
      try {
        await fetch('/api/analytics/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batch })
        });
        
        //remove successfully synced events
        await removeAnalyticsEvents(batch.map(e => e.id));
      } catch (error) {
        console.warn('Service Worker: Batch analytics sync failed', error);
        break; // stop on first failure to avoid overwhelming server
      }
    }
    
    console.log('Service Worker: Analytics sync completed');
  } catch (error) {
    console.error('Service Worker: Analytics sync failed', error);
  }
}

//sync performance metrics to server
async function syncPerformanceMetrics() {
  try {
    const metrics = await getPerformanceMetrics();
    
    if (metrics.length === 0) {
      console.log('Service Worker: No performance metrics to sync');
      return;
    }
    
    await fetch('/api/performance/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics })
    });
    
    await clearPerformanceMetrics();
    console.log('Service Worker: Performance metrics synced');
  } catch (error) {
    console.error('Service Worker: Performance sync failed', error);
  }
}

//IndexedDB wrapper for robust offline storage
class IndexedDBManager {
  constructor(dbName = 'ServiceWorkerDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }
  
  async init() {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        //create analytics store
        if (!db.objectStoreNames.contains('analytics')) {
          const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id' });
          analyticsStore.createIndex('timestamp', 'timestamp');
        }
        
        //create performance metrics store
        if (!db.objectStoreNames.contains('performance')) {
          const perfStore = db.createObjectStore('performance', { keyPath: 'id' });
          perfStore.createIndex('timestamp', 'timestamp');
        }
        
        //create cache metadata store
        if (!db.objectStoreNames.contains('cacheMetadata')) {
          db.createObjectStore('cacheMetadata', { keyPath: 'url' });
        }
      };
    });
  }
  
  async add(storeName, data) {
    await this.init();
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.add(data);
  }
  
  async getAll(storeName) {
    await this.init();
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async delete(storeName, key) {
    await this.init();
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.delete(key);
  }
  
  async clear(storeName) {
    await this.init();
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.clear();
  }
}

//global IndexedDB instance
const dbManager = new IndexedDBManager();

//enhanced analytics queue management
async function getAnalyticsQueue() {
  try {
    return await dbManager.getAll('analytics');
  } catch (error) {
    console.warn('Service Worker: Failed to get analytics from IndexedDB, falling back to localStorage', error);
    //fallback to localStorage
    try {
      const stored = localStorage.getItem('sw-analytics-queue');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

async function removeAnalyticsEvents(ids) {
  try {
    await Promise.all(ids.map(id => dbManager.delete('analytics', id)));
  } catch (error) {
    console.warn('Service Worker: Failed to remove analytics events', error);
  }
}

async function getPerformanceMetrics() {
  try {
    return await dbManager.getAll('performance');
  } catch (error) {
    console.warn('Service Worker: Failed to get performance metrics', error);
    return [];
  }
}

async function clearPerformanceMetrics() {
  try {
    await dbManager.clear('performance');
  } catch (error) {
    console.warn('Service Worker: Failed to clear performance metrics', error);
  }
}

//enhanced message handling for communication with main thread
self.addEventListener('message', event => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_ANALYTICS':
      queueAnalyticsEvent(payload);
      break;
      
    case 'CACHE_PERFORMANCE':
      capturePerformanceMetrics().catch(error => {
        console.warn('Service Worker: Performance capture failed', error);
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0]?.postMessage({ success: true });
      }).catch(error => {
        event.ports[0]?.postMessage({ success: false, error: error.message });
      });
      break;
      
    case 'GET_CACHE_STATS':
      getCacheStats().then(stats => {
        event.ports[0]?.postMessage(stats);
      }).catch(error => {
        event.ports[0]?.postMessage({ error: error.message });
      });
      break;
      
    case 'PREFETCH_RESOURCES':
      prefetchResources().catch(error => {
        console.warn('Service Worker: Manual prefetch failed', error);
      });
      break;
      
    case 'WARM_CACHE':
      warmCriticalCaches().catch(error => {
        console.warn('Service Worker: Manual cache warming failed', error);
      });
      break;
      
    case 'CLEANUP_CACHE':
      performIntelligentCleanup().catch(error => {
        console.warn('Service Worker: Manual cleanup failed', error);
      });
      break;
      
    default:
      console.warn('Service Worker: Unknown message type', type);
  }
});

//enhanced analytics and performance tracking
async function queueAnalyticsEvent(event) {
  try {
    const eventWithId = {
      ...event,
      id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    await dbManager.add('analytics', eventWithId);
    
    //register background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('blog-analytics');
    }
  } catch (error) {
    console.error('Service Worker: Failed to queue analytics event', error);
    //fallback to localStorage
    try {
      const queue = JSON.parse(localStorage.getItem('sw-analytics-queue') || '[]');
      queue.push({ ...event, timestamp: Date.now() });
      localStorage.setItem('sw-analytics-queue', JSON.stringify(queue));
    } catch (fallbackError) {
      console.error('Service Worker: Analytics fallback failed', fallbackError);
    }
  }
}

//performance monitoring integration
async function capturePerformanceMetrics() {
  if (!PERF_CONFIG.ENABLED || Math.random() > PERF_CONFIG.SAMPLE_RATE) {
    return;
  }
  
  try {
    const metrics = {};
    
    //collect Core Web Vitals
    if ('PerformanceObserver' in self) {
      //collect paint metrics
      const paintEntries = performance.getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-contentful-paint') {
          metrics.FCP = entry.startTime;
        }
      }
      
      //collect navigation timing
      const navigationEntries = performance.getEntriesByType('navigation');
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0];
        metrics.TTFB = nav.responseStart - nav.requestStart;
        metrics.domLoad = nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart;
        metrics.windowLoad = nav.loadEventEnd - nav.loadEventStart;
      }
      
      //collect resource timing for cache analysis
      const resourceEntries = performance.getEntriesByType('resource');
      const cacheHitRatio = resourceEntries.filter(entry => 
        entry.transferSize === 0 || entry.transferSize < entry.encodedBodySize
      ).length / resourceEntries.length;
      
      metrics.cacheHitRatio = cacheHitRatio;
      metrics.resourceCount = resourceEntries.length;
    }
    
    //add service worker specific metrics
    metrics.swVersion = CACHE_VERSION;
    metrics.timestamp = Date.now();
    metrics.url = self.location.href;
    metrics.userAgent = navigator.userAgent;
    
    const perfEvent = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metrics,
      timestamp: Date.now()
    };
    
    await dbManager.add('performance', perfEvent);
    
    //batch send performance data
    const allMetrics = await dbManager.getAll('performance');
    if (allMetrics.length >= PERF_CONFIG.BATCH_SIZE) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('performance-metrics');
    }
    
  } catch (error) {
    console.warn('Service Worker: Performance metrics capture failed', error);
  }
}

//monitor cache performance
function trackCachePerformance(request, cacheHit, responseTime) {
  if (!PERF_CONFIG.ENABLED) return;
  
  const metrics = {
    url: request.url,
    method: request.method,
    cacheHit,
    responseTime,
    timestamp: Date.now()
  };
  
  //queue for batch processing
  queueAnalyticsEvent({
    type: 'cache_performance',
    ...metrics
  }).catch(error => {
    console.warn('Service Worker: Cache performance tracking failed', error);
  });
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith('blog-'))
      .map(name => caches.delete(name))
  );
}

async function getCacheStats() {
  const stats = {};
  
  for (const [name, cacheName] of Object.entries(CACHE_NAMES)) {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      stats[name.toLowerCase()] = keys.length;
    } catch (error) {
      stats[name.toLowerCase()] = 0;
    }
  }
  
  return {
    ...stats,
    version: CACHE_VERSION,
    timestamp: Date.now(),
    totalSize: Object.values(stats).reduce((sum, count) => sum + count, 0)
  };
}

//error handling and recovery mechanisms
class ServiceWorkerErrorHandler {
  static handleError(error, context = 'unknown') {
    console.error(`Service Worker Error [${context}]:`, error);
    
    //track error for analytics
    if (PERF_CONFIG.ENABLED) {
      queueAnalyticsEvent({
        type: 'sw_error',
        context,
        error: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        swVersion: CACHE_VERSION
      }).catch(() => {
        //silently fail error tracking to avoid recursion
      });
    }
    
    //attempt recovery based on error type
    if (error.name === 'QuotaExceededError') {
      this.handleQuotaExceeded();
    } else if (error.name === 'NetworkError') {
      this.handleNetworkError();
    }
  }
  
  static async handleQuotaExceeded() {
    console.log('Service Worker: Handling quota exceeded error');
    try {
      //aggressive cache cleanup
      await performIntelligentCleanup();
      
      //reduce cache limits temporarily
      Object.keys(CACHE_LIMITS).forEach(key => {
        CACHE_LIMITS[key] = Math.floor(CACHE_LIMITS[key] * 0.5);
      });
      
      console.log('Service Worker: Quota recovery completed');
    } catch (error) {
      console.error('Service Worker: Quota recovery failed', error);
    }
  }
  
  static handleNetworkError() {
    console.log('Service Worker: Handling network error');
    //could implement network retry logic or fallback mechanisms
  }
}

//global error handler
self.addEventListener('error', event => {
  ServiceWorkerErrorHandler.handleError(event.error, 'global');
});

self.addEventListener('unhandledrejection', event => {
  ServiceWorkerErrorHandler.handleError(event.reason, 'unhandled_promise');
});

//production optimizations
const ProductionOptimizations = {
  //debounce function for expensive operations
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  //throttle function for frequent operations
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  //batch operations for better performance
  createBatcher(batchSize = 10, flushInterval = 5000) {
    let batch = [];
    let timeout;
    
    const flush = () => {
      if (batch.length > 0) {
        const currentBatch = [...batch];
        batch = [];
        return currentBatch;
      }
      return [];
    };
    
    return {
      add(item) {
        batch.push(item);
        
        if (batch.length >= batchSize) {
          return flush();
        }
        
        if (!timeout) {
          timeout = setTimeout(() => {
            timeout = null;
            flush();
          }, flushInterval);
        }
        
        return null;
      },
      flush
    };
  }
};

//final initialization
console.log(`Service Worker v${CACHE_VERSION} loaded successfully`);