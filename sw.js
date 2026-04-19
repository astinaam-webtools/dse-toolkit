const CACHE_NAME = 'stock-glossary-v40';
const RUNTIME_CACHE = 'runtime-stock-glossary-v40';
const PRECACHE_URLS = [
  './',
  './index.html',
  './analyzer.html',
  './guides.html',
  './chat.html',
  './market.html',
  './stock.html',
  './portfolio.html',
  './funds.html',
  './settings.html',
  './styles.css',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/app.js',
  './src/marketApp.js',
  './src/stockDetailApp.js',
  './src/portfolioApp.js',
  './src/fundsApp.js',
  './src/settingsApp.js',
  './src/chatApp.js',
  './src/navStatus.js',
  './src/swRegister.js',
  './src/mobile-nav.js',
  './src/data/terms.js',
  './src/lib/behaviorProfiler.js',
  './src/lib/filterTerms.js',
  './src/lib/marketLogic.js',
  './src/lib/portfolioLogic.js',
  './src/lib/fundsLogic.js',
  './src/lib/appSettings.js',
  './src/lib/serverClient.js',
  './src/lib/documentGateway.js',
  './src/lib/chatPrompts.js',
  './src/lib/chatStore.js',
  './src/lib/portfolioStore.js',
  './src/lib/fundsStore.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE_NAME, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for dynamic market data to avoid stale caches
  if (url.pathname.endsWith('/src/data/dse-market.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
        })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
