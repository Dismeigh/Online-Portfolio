// Dismeigh site service worker: makes the site installable and gives it an offline page.
// Pages are always fetched fresh when online; only static files are cached.
const CACHE = 'dismeigh-v101';
const PRECACHE = ['/offline.html', '/styles.css?v=114', '/app.js?v=63', '/favicon-32.png', '/icon-192.png', '/avatar-280.jpg?v=2', '/banner.webp'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Dashboard phone alerts (sent by lib/push.js). Tapping one opens the dashboard on the right tab.
self.addEventListener('push', event => {
  let d = {}; try { d = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(d.title || 'Dismeigh dashboard', {
    body: d.body || '', icon: '/dashboard/icon-192.png', badge: '/favicon-48.png', tag: d.tab || 'dash', data: { url: `/dashboard/#${String(d.tab || 'overview').replace(/[^a-z]/g, '')}` },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => new URL(c.url).pathname.startsWith('/dashboard/'));
    return open ? open.navigate(url).then(c => (c || open).focus()).catch(() => open.focus()) : self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.endsWith('.json') || url.pathname.endsWith('.ics') || url.pathname.endsWith('.mp4')) return;

  // Dashboard app: always fresh when online; keeps a copy of the page so the installed app still opens offline
  // (it shows an "offline" notice; nothing private is cached, the data always comes from /api/admin)
  if (request.mode === 'navigate' && url.pathname.startsWith('/dashboard/')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('/dashboard/', copy)); }
      return response;
    }).catch(async () => (await caches.match('/dashboard/')) || caches.match('/offline.html')));
    return;
  }

  // Pages: network first, offline page as the fallback
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || caches.match('/offline.html')));
    return;
  }

  // Static files: serve from cache, refresh in the background
  if (/\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      const fresh = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || fresh;
    }));
  }
});
