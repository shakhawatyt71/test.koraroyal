/* ================================================================
   KORA ROYAL — Service Worker v1.0
   PWA Offline Support + Caching Strategy
   
   Features:
   - Static asset caching (HTML, CSS, JS, images)
   - Offline fallback page
   - Background sync for orders
   - Push notification support (ready)
   - Cache versioning & cleanup
   ================================================================ */

'use strict';

// ===== CACHE CONFIGURATION =====
const CACHE_VERSION = 'kr-v2';
const CACHE_STATIC = 'kr-static-v2';
const CACHE_DYNAMIC = 'kr-dynamic-v2';
const CACHE_IMAGES = 'kr-images-v2';
const CACHE_FONTS = 'kr-fonts-v2';

// Static assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/success.html',
  '/track.html',
  '/css/style.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/product-system.css',
  '/css/checkout-v2.css',
  '/css/responsive.css',
  '/css/operations.css',
  '/css/reviews.css',
  '/css/size-guide.css',
  '/css/phase3a.css',
  '/css/phase3b.css',
  '/js/main.js',
  '/js/api.js',
  '/js/catalog.js',
  '/js/integrations.js',
  '/js/main.js',
  '/js/policies.js',
  '/js/product-details.js',
  '/js/product-image-viewer.js',
  '/js/reviews.js',
  '/js/size-guide.js',
  '/js/success-v2.js',
  '/js/track-v2.js',
  '/js/ui-icons.js',
  '/js/ui-tracking.js',
  '/js/pwa-install.js',
  '/js/pwa-bug-report.js',
  '/js/diag.js',
  '/js/notify.js',
  '/offline.html',
  '/manifest.json'
];

// URLs that should always go to network first
const NETWORK_FIRST_URLS = [
  '/api/',
  '/api/order',
  '/api/track',
  '/api/catalog',
  '/api/reviews',
  '/api/coupons'
];

// Maximum cache sizes
const MAX_CACHE_SIZE = {
  [CACHE_DYNAMIC]: 100,
  [CACHE_IMAGES]: 60,
  [CACHE_FONTS]: 20
};

// ===== INSTALL EVENT =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Pre-cache failed:', error);
        // Don't fail install if some assets are unavailable
        return self.skipWaiting();
      })
  );
});

// ===== ACTIVATE EVENT =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old caches
              return name.startsWith('kr-') && 
                     name !== CACHE_STATIC && 
                     name !== CACHE_DYNAMIC && 
                     name !== CACHE_IMAGES &&
                     name !== CACHE_FONTS;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// ===== FETCH EVENT =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s)
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Skip cross-origin requests except allowed CDNs
  if (url.origin !== self.location.origin && !isAllowedCDN(url)) {
    return;
  }
  
  // API requests: Network First
  if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Images: Cache First
  if (isImageRequest(url)) {
    event.respondWith(cacheFirst(request, CACHE_IMAGES));
    return;
  }
  
  // Fonts: Cache First
  if (isFontRequest(url)) {
    event.respondWith(cacheFirst(request, CACHE_FONTS));
    return;
  }
  
  // Static assets: Stale While Revalidate
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
    return;
  }
  
  // Default: Network First with cache fallback
  event.respondWith(networkFirst(request));
});

// ===== CACHING STRATEGIES =====

// Network First — try network, fall back to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, networkResponse.clone());
      limitCacheSize(CACHE_DYNAMIC, MAX_CACHE_SIZE[CACHE_DYNAMIC]);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    // Return a simple offline response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain' })
    });
  }
}

// Cache First — return from cache, update in background
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          caches.open(cacheName)
            .then((cache) => {
              cache.put(request, networkResponse);
            });
        }
      })
      .catch(() => {
        // Network failed, that's OK
      });
    
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      limitCacheSize(cacheName, MAX_CACHE_SIZE[cacheName]);
    }
    
    return networkResponse;
  } catch (error) {
    // Return placeholder for images
    if (isImageRequest(new URL(request.url))) {
      return createPlaceholderImage();
    }
    
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stale While Revalidate — return cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed, return cached if available
      return cachedResponse;
    });
  
  return cachedResponse || fetchPromise;
}

// ===== HELPER FUNCTIONS =====

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || 
         NETWORK_FIRST_URLS.some(path => url.pathname.startsWith(path));
}

function isImageRequest(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
  const pathname = url.pathname.toLowerCase();
  
  return imageExtensions.some(ext => pathname.endsWith(ext)) ||
         url.hostname.includes('cloudinary.com') ||
         url.hostname.includes('res.cloudinary.com');
}

function isFontRequest(url) {
  const fontExtensions = ['.woff', '.woff2', '.ttf', '.eot', '.otf'];
  const pathname = url.pathname.toLowerCase();
  
  return fontExtensions.some(ext => pathname.endsWith(ext)) ||
         url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com');
}

function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.json'];
  const pathname = url.pathname.toLowerCase();
  
  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname === '/' ||
         pathname.endsWith('.html');
}

function isAllowedCDN(url) {
  const allowedHosts = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'res.cloudinary.com',
    'cdn.jsdelivr.net'
  ];
  
  return allowedHosts.some(host => url.hostname.includes(host));
}

async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    // Delete oldest entries
    const deleteCount = keys.length - maxSize;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
    console.log(`[SW] Cleaned ${deleteCount} entries from ${cacheName}`);
  }
}

function createPlaceholderImage() {
  // Create a simple placeholder SVG image
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f0f0f0"/>
      <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" 
            font-family="Arial" font-size="14" fill="#999">
        Image offline
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store'
    }
  });
}

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('[SW] Background sync: orders');
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  // This would sync any pending orders stored in IndexedDB
  // Implementation depends on your offline storage strategy
  console.log('[SW] Syncing pending orders...');
}

// ===== PUSH NOTIFICATIONS =====
//
// Payload shape (sent by the Cloudflare Worker notification engine):
// { id, run, title, body, image, url, category, priority,
//   timer_ends_at, poll:{question,options:[{id,label,image}]}, actions:[{action,title,url}] }
//
const KR_NOTIFY_ICON  = '/icons/icon-192x192.png';
const KR_NOTIFY_BADGE = '/icons/badge-96x96.png';
const KR_ACTION_OPEN  = '/icons/action-open.png';
const KR_ACTION_CLOSE = '/icons/action-close.png';

/* ---------- Notification presentation ----------
   Options map to the Android notification features that matter:
   - badge           -> small monochrome icon on the notification
   - icon/image      -> large icon + big picture (highlight important info)
   - vibrate         -> vibration pattern
   - silent:false    -> notification sound plays
   - requireInteraction -> "permanent": stays until the user acts (critical only)
   - renotify/tag    -> re-alerts (heads-up / floating) even for same sender
   - lock screen     -> normal notifications show on the lock screen by default
   - data.url        -> deep link on tap
*/
function krBuildNotifyOptions(data) {
  const prio = String(data.priority || 'normal');
  const isImportant = prio === 'critical' || prio === 'high';
  const options = {
    body: data.body || 'KORA ROYAL',
    tag: data.run || data.id || 'kr-notify',
    renotify: true,
    vibrate: isImportant ? [200, 80, 200, 80, 200] : [120, 60, 140],
    silent: false,                       /* sound ON */
    visibility: 'public',                /* show full text on the lock screen */
    timestamp: Date.now(),
    requireInteraction: prio === 'critical',   /* permanent until dismissed */
    data: {
      url: data.url || '/',
      run: data.run || '',
      id: data.id || '',
      priority: prio,
      timerEndsAt: Number(data.timer_ends_at) || 0,
      poll: data.poll || null
    }
  };
  if (data.image) options.image = data.image;

  /* Action buttons: poll options first (max 2 + close), else configured actions. */
  const actions = [];
  if (data.poll && Array.isArray(data.poll.options)) {
    data.poll.options.slice(0, 2).forEach((o) => {
      actions.push({ action: 'vote:' + o.id, title: String(o.label || o.id).slice(0, 24) });
    });
  }
  if (!actions.length && Array.isArray(data.actions)) {
    data.actions.slice(0, 2).forEach((a) => {
      actions.push({ action: a.action || 'open', title: String(a.title || 'Open').slice(0, 24) });
    });
  }
  if (actions.length) {
    actions.push({ action: 'close', title: 'Close' });
    options.actions = actions.slice(0, 3);
  }
  return options;
}

/* Report back to the admin panel whether the phone REALLY displayed it.
   This is what makes notification on/off detection accurate. */
function krReportEvent(payload, type, run) {
  try {
    const body = JSON.stringify({ sid: payload.sid || '', run: run || payload.run || payload.id || '', type: type });
    return fetch('https://kora-api.shakhawatyt77.workers.dev/api/notify/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true
    }).catch(() => {});
  } catch (e) { return Promise.resolve(); }
}

/* Show the notification with graceful fallbacks — NEVER silently drop a
   push (a silent drop breaks userVisibleOnly and browsers kill the
   subscription, after which nothing ever shows again). */
async function krShowPush(data, sidValue) {
  const title = data && data.title ? String(data.title) : 'KORA ROYAL';
  const body = data && data.body ? String(data.body) : '';
  const run = (data && (data.run || data.id)) || '';
  const attempts = [];

  /* 1) full options */
  const full = krBuildNotifyOptions(data || {});
  full.icon = KR_NOTIFY_ICON;
  full.badge = KR_NOTIFY_BADGE;
  full.data.sid = sidValue || '';
  attempts.push(full);

  /* 2) lite: drop icon/badge/image/actions (missing files, odd payloads) */
  const lite = krBuildNotifyOptions(data || {});
  lite.data.sid = sidValue || '';
  delete lite.icon; delete lite.badge; delete lite.image; delete lite.actions;
  attempts.push(lite);

  /* 3) minimal */
  attempts.push({ body: body || 'New notification from KORA ROYAL', data: { url: '/', run: run, sid: sidValue || '' } });

  /* 4) last resort — cannot fail while permission is granted */
  attempts.push({});

  for (let i = 0; i < attempts.length; i++) {
    try {
      await self.registration.showNotification(title, attempts[i]);
      /* Home-screen icon red dot — new content indicator. */
      try {
        if (self.navigator && self.navigator.setAppBadge) self.navigator.setAppBadge().catch(function () {});
      } catch (e) {}
      return true;
    } catch (e) { /* try the next shape */ }
  }
  return false;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try { data = { title: 'KORA ROYAL', body: event.data ? event.data.text() : '' }; }
    catch (e2) { data = {}; }
  }
  /* Even an empty push MUST show something (Chrome requirement). */
  if (!data.title && !data.body) {
    data = { title: 'KORA ROYAL', body: 'New notification' };
  }

  /* Sid travels with the payload when the worker sends it; fall back to
     the run id so click/seen tracking still links up. */
  const sidValue = data.sid || '';

  event.waitUntil(
    krShowPush(data, sidValue).then((ok) => {
      const run = (data.run || data.id || '');
      return krReportEvent({ sid: sidValue, run: run }, ok ? 'shown' : 'show_failed', run);
    })
  );
});

function krTargetUrl(notification, action) {
  const base = (notification.data && notification.data.url) || '/';
  const run = (notification.data && notification.data.run) || '';
  const url = new URL(base, self.location.origin);
  if (run) url.searchParams.set('ntf', run);
  if (action && String(action).indexOf('vote:') === 0) {
    url.searchParams.set('vote', String(action).slice(5));
    url.hash = url.hash || '#kr-notifications';
  }
  return url.pathname + url.search + url.hash;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action || '';
  if (action === 'close') return;

  const target = krTargetUrl(event.notification, action);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        try {
          if (new URL(client.url).origin === self.location.origin) {
            client.postMessage({ type: 'KR_NOTIFY_CLICK', url: target, action: action });
            return client.focus();
          }
        } catch (e) {}
      }
      return clients.openWindow(target);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  const run = (event.notification.data && event.notification.data.run) || '';
  if (run) console.log('[SW] notification dismissed:', run);
});

// ===== MESSAGE HANDLER =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((name) => caches.delete(name))
          );
        })
        .then(() => {
          console.log('[SW] All caches cleared');
        })
    );
  }
});

console.log('[SW] Service Worker loaded');
