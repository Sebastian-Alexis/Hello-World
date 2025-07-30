// =============================================================================
// SERVICE WORKER - Caching and offline functionality for blog system
// Provides intelligent caching strategies for optimal performance
// =============================================================================

const CACHE_VERSION = 'v1.0.0';
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

//API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/blog(\?.*)?$/,
  /\/api\/blog\/categories/,
  /\/api\/blog\/tags/,
  /\/api\/blog\/search/,
];

//cache duration configurations (in milliseconds)
const CACHE_DURATIONS = {
  STATIC: 7 * 24 * 60 * 60 * 1000, // 7 days
  DYNAMIC: 24 * 60 * 60 * 1000,     // 1 day
  IMAGES: 30 * 24 * 60 * 60 * 1000, // 30 days
  API: 15 * 60 * 1000,              // 15 minutes
};

//install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        //skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

//activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...', CACHE_VERSION);
  
  event.waitUntil(
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
      })
      .then(() => {
        console.log('Service Worker: Activated');
        //claim all clients immediately
        return self.clients.claim();
      })
  );
});

//fetch event - handle caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  //only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
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

//static assets: cache-first strategy
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(CACHE_NAMES.STATIC);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.STATIC)) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      //add timestamp to response for expiration checking
      const responseWithTimestamp = addTimestamp(networkResponse.clone());
      cache.put(request, responseWithTimestamp);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Static asset error', error);
    
    //fallback to cache if network fails
    const cache = await caches.open(CACHE_NAMES.STATIC);
    return cache.match(request) || new Response('Asset not available offline', {
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
      
      //cleanup old images if cache is getting large
      cleanupImageCache(cache);
    }
    
    return networkResponse;
  } catch (error) {
    //fallback to cached version or placeholder
    const cache = await caches.open(CACHE_NAMES.IMAGES);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    //return a placeholder image
    return new Response(
      createPlaceholderSVG(300, 200, 'Image unavailable offline'),
      {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache'
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
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Blog</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; }
            .offline-message { max-width: 500px; margin: 0 auto; }
            .retry-btn { 
              background: #3b82f6; 
              color: white; 
              border: none; 
              padding: 0.75rem 1.5rem; 
              border-radius: 0.5rem; 
              cursor: pointer; 
              margin-top: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="offline-message">
            <h1>You're offline</h1>
            <p>This page isn't available offline. Please check your internet connection and try again.</p>
            <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>
    `, {
      status: 503,
      headers: {
        'Content-Type': 'text/html',
        'X-Cache-Status': 'offline'
      }
    });
  }
}

//helper functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  return /\.(css|js|woff2?|ttf|eot)$/.test(url.pathname) ||
         url.pathname === '/manifest.json' ||
         url.pathname === '/favicon.ico';
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

function createPlaceholderSVG(width, height, text) {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" font-family="system-ui, sans-serif" font-size="14" 
            fill="#6b7280" text-anchor="middle" dy="0.3em">${text}</text>
    </svg>
  `;
}

async function cleanupImageCache(cache) {
  try {
    const requests = await cache.keys();
    
    //if we have more than 100 images, remove oldest ones
    if (requests.length > 100) {
      const responses = await Promise.all(
        requests.map(async request => ({
          request,
          response: await cache.match(request)
        }))
      );
      
      //sort by cache time and remove oldest 20
      responses
        .sort((a, b) => {
          const timeA = parseInt(a.response.headers.get('X-SW-Cache-Time') || '0');
          const timeB = parseInt(b.response.headers.get('X-SW-Cache-Time') || '0');
          return timeA - timeB;
        })
        .slice(0, 20)
        .forEach(({ request }) => cache.delete(request));
    }
  } catch (error) {
    console.warn('Service Worker: Failed to cleanup image cache', error);
  }
}

//handle background sync for failed requests
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'blog-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

async function syncAnalytics() {
  //sync any queued analytics events when back online
  try {
    const analyticsQueue = await getAnalyticsQueue();
    
    for (const event of analyticsQueue) {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    }
    
    //clear queue after successful sync
    await clearAnalyticsQueue();
    console.log('Service Worker: Analytics sync completed');
  } catch (error) {
    console.error('Service Worker: Analytics sync failed', error);
  }
}

async function getAnalyticsQueue() {
  //retrieve queued analytics from IndexedDB or localStorage
  try {
    const stored = localStorage.getItem('sw-analytics-queue');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function clearAnalyticsQueue() {
  try {
    localStorage.removeItem('sw-analytics-queue');
  } catch (error) {
    console.warn('Failed to clear analytics queue', error);
  }
}

//listen for messages from main thread
self.addEventListener('message', event => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_ANALYTICS':
      queueAnalyticsEvent(payload);
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'GET_CACHE_STATS':
      getCacheStats().then(stats => {
        event.ports[0].postMessage(stats);
      });
      break;
  }
});

async function queueAnalyticsEvent(event) {
  try {
    const queue = await getAnalyticsQueue();
    queue.push({ ...event, timestamp: Date.now() });
    localStorage.setItem('sw-analytics-queue', JSON.stringify(queue));
    
    //register background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('blog-analytics');
    }
  } catch (error) {
    console.error('Failed to queue analytics event', error);
  }
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
  
  return stats;
}