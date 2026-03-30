// ============================================================
// SERVICE WORKER — VDR Reportes
// Estrategia: Cache First para assets, Network First para datos
// ============================================================

const CACHE_VERSION  = 'vdr-v1';
const CACHE_STATIC   = 'vdr-static-v1';
const CACHE_DYNAMIC  = 'vdr-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
];

// ── INSTALACIÓN ───────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVACIÓN ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Stale-while-revalidate ─────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Apps Script (datos): Network first, caché como fallback
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Assets estáticos: Cache first
  e.respondWith(cacheFirst(e.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache    = await caches.open(CACHE_DYNAMIC);
    cache.put(request, response.clone());
    return response;
  } catch {
    return cached || new Response('Sin conexión', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache    = await caches.open(CACHE_DYNAMIC);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ ok: false, error: 'Sin conexión' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── SYNC EN BACKGROUND (reportes offline) ─────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-reportes-pendientes') {
    e.waitUntil(sincronizarReportesPendientes());
  }
});

async function sincronizarReportesPendientes() {
  // Los reportes guardados offline se reenvían cuando vuelve la conexión
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ tipo: 'sync-completado' }));
}

// ── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.titulo || 'VDR Reportes', {
      body:    data.cuerpo || '',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/badge-72.png',
      vibrate: [100, 50, 100],
      data:    { url: data.url || '/' },
      actions: data.acciones || []
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.openWindow(e.notification.data.url || '/')
  );
});
