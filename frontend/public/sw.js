// Offline support: network first, cached copy when offline. API calls are never cached.
const CACHE = 'moodprint-react-v1';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.json', './icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(res => { if (res.ok && (u.origin === location.origin || u.host.includes('fonts.g'))) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; }).catch(() => caches.match(e.request)));
});
