// service-worker.js
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. For more information, visit https://thegreekdirectory.org/legal.

const STATIC_CACHE_NAME = 'tgd-static-v4';
const RUNTIME_CACHE_NAME = 'tgd-runtime-v4';
const OFFLINE_PAGE = '/offline.html';

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/listings.html',
  '/map.html',
  '/starred.html',
  '/settings.html',
  '/offline.html',
  '/src/output.css',
  '/css/index.css',
  '/css/listings.css',
  '/css/admin.css',
  '/css/business.css',
  '/css/pwa.css',
  '/js/index.js',
  '/js/listing-hours.js',
  '/js/listings.js',
  '/js/partials-loader.js',
  '/js/pwa/app.js',
  '/js/pwa/dock.js',
  '/js/pwa/settings.js',
  '/js/pwa/starred.js',
  '/js/pwa/storage.js',
  '/js/pwa/offline-translation.js',
  '/js/pwa/directions.js',
  'https://static.thegreekdirectory.org/img/logo/blue.svg',
  'https://static.thegreekdirectory.org/img/logo/white.svg',
  'https://static.thegreekdirectory.org/img/logo/bluefavicon.png',
  'https://static.thegreekdirectory.org/img/logo/whitefavicon.png'
];

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => ![STATIC_CACHE_NAME, RUNTIME_CACHE_NAME].includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(networkFirst(event.request, RUNTIME_CACHE_NAME, true));
    return;
  }

  if (requestUrl.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request, RUNTIME_CACHE_NAME));
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

async function networkFirst(request, cacheName, isNavigation = false) {
  try {
    const response = await fetch(request, { cache: 'no-store' });

    if (response && response.status === 200 && response.type !== 'error' && !response.redirected) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (isNavigation) {
      return caches.match(OFFLINE_PAGE);
    }

    return new Response('Offline', { status: 503 });
  }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_IMAGE') {
    const imageUrl = event.data.url;
    caches.open(RUNTIME_CACHE_NAME).then((cache) => {
      fetch(imageUrl).then((response) => {
        if (response && response.ok && !response.redirected) {
          cache.put(imageUrl, response.clone());
        }
      }).catch(() => {});
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. For more information, visit https://thegreekdirectory.org/legal.