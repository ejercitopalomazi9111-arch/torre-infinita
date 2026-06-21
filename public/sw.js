// sw.js — Service Worker de Torre Infinita (PWA instalable + juego offline).
// Estrategia honesta para un juego pesado (≈64MB de audio):
//   · NAVEGACIÓN (el HTML): network-first → si no hay red, sirve el index cacheado.
//   · MISMO ORIGEN (bundles, sprites, audio, i18n, data): cache-first y se va
//     llenando conforme juegas (el audio de un bioma queda cacheado al oírlo).
//   · OTRO ORIGEN (Google Fonts): se cachea de forma opaca para que la tipografía
//     funcione sin red en visitas posteriores.
// Subir CACHE_VERSION invalida cachés viejas en cada despliegue.
const CACHE_VERSION = 'ti-v1';
const CACHE = `torre-infinita-${CACHE_VERSION}`;

// App shell mínima a precachear en la instalación (rutas relativas al scope).
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegación (cargar la página): red primero, index cacheado de respaldo.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;

  // Recursos del juego: cache-first, y cachea al vuelo lo nuevo.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // cachea respuestas válidas propias y las opacas de fuentes (status 0).
        if (res && (res.ok || res.type === 'opaque') && (sameOrigin || url.hostname.includes('gstatic') || url.hostname.includes('googleapis'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
    })
  );
});

// Permite a la página forzar la activación de un SW nuevo.
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
