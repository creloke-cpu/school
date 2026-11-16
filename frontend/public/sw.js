const CACHE_NAME = 'firstgear-shell-v2';
const APP_ROOT = new URL('./', self.registration.scope).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch(APP_ROOT);
      if (!response.ok) throw new Error(`Unable to cache FirstGear app shell: ${response.status}`);

      const html = await response.clone().text();
      const assetUrls = Array.from(html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g))
        .map((match) => new URL(match[1], self.registration.scope))
        .filter((url) => url.origin === self.location.origin)
        .map((url) => url.href);
      const cache = await caches.open(CACHE_NAME);

      await cache.put(APP_ROOT, response);
      await Promise.all(assetUrls.map(async (url) => {
        const asset = await fetch(url);
        if (!asset.ok) throw new Error(`Unable to cache FirstGear app asset: ${url}`);
        await cache.put(url, asset);
      }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname === APP_ROOT) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedShell = await caches.match(APP_ROOT);
          if (cachedShell) return cachedShell;
          throw new Error('FirstGear is offline and no cached app shell is available.');
        }),
    );
    return;
  }

  if (['script', 'style', 'font', 'image'].includes(request.destination)) {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then((cachedAsset) => {
        if (cachedAsset) return cachedAsset;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
});
