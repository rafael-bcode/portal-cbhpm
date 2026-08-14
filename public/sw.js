// Service worker leve: só cacheia o app shell estático (HTML/CSS/JS/logo)
// pra o portal ainda abrir com wifi instável ou caído dentro do hospital.
// NUNCA cacheia /api/* nem requisições não-GET — todo dado clínico/
// financeiro (consultas, validações, guias) é sempre buscado da rede, nunca
// servido do cache.
const CACHE_NAME = 'argus-fatura-shell-v1';
const SHELL_FILES = ['/index.html', '/style.css', '/app.js', '/md5.js', '/logo.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Network-first com fallback pro cache: sempre serve a versão mais nova
  // quando há conexão, e ainda assim abre o shell se a rede cair.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
