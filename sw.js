// Each GitHub Pages project owns a separate cache namespace and URL scope.
const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = `apex-shell:${encodeURIComponent(APP_BASE.pathname)}:`;
const CACHE = `${CACHE_PREFIX}github-v1`;
const INDEX_URL = new URL('index.html', APP_BASE).href;
const SHOWCASE_URL = new URL('showcase.html', APP_BASE).href;
const ASSET_PATHS = [
  './', 'index.html', 'showcase.html', 'styles.css', 'app.js', 'engine.js',
  'api.js', 'replay.json', 'manifest.webmanifest', 'assets/icon.svg',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png',
  'assets/barlow.ttf'
];
const ASSET_URLS = ASSET_PATHS.map(path => new URL(path, APP_BASE).href);
const ASSET_ROUTES = new Set(ASSET_URLS.map(url => new URL(url).pathname));
const PAGE_ROUTES = new Set([APP_BASE.pathname, new URL(INDEX_URL).pathname, new URL(SHOWCASE_URL).pathname]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSET_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function fetchAndCache(request, cacheKey, isPage) {
  const cache = await caches.open(CACHE);
  try {
    // Network-first keeps future GitHub deployments fresh even when sw.js itself
    // has not changed. Offline requests fall back to this project's cache only.
    const response = await fetch(request, {cache: 'no-cache'});
    const valid = response.ok && !response.redirected && (!isPage || response.headers.get('content-type')?.includes('text/html'));
    if (valid) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== APP_BASE.origin) return;
  if (request.mode === 'navigate') {
    // Only actual app pages are handled, including ?demo=tour. Other projects,
    // API endpoints and arbitrary paths on the same github.io origin are ignored.
    if (!PAGE_ROUTES.has(url.pathname)) return;
    const page = url.pathname === new URL(SHOWCASE_URL).pathname ? SHOWCASE_URL : INDEX_URL;
    event.respondWith(fetchAndCache(request, page, true));
    return;
  }
  if (!ASSET_ROUTES.has(url.pathname)) return;
  event.respondWith(fetchAndCache(request, request, false));
});
