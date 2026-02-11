// Service Worker para RazaiSystem PWA
const CACHE_NAME = 'razaisystem-v1';

// Arquivos para cache inicial (shell do app)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalação - cache dos arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Ativação - limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - estratégia Network First com fallback para cache
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Ignorar requisições para Firebase e APIs externas
  if (
    requestUrl.pathname.startsWith('/api/') ||
    event.request.url.includes('firebaseapp.com') ||
    event.request.url.includes('googleapis.com') ||
    event.request.url.includes('firebaseio.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone a resposta para cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback para cache quando offline
        return caches.match(event.request);
      })
  );
});
