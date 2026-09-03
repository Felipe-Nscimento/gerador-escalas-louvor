// v2: corrige o bug em que o site nunca mostrava atualizações (ficava
// preso na primeira versão cacheada). Agora só usa cache-first para os
// arquivos estáticos com hash no nome (que só mudam de nome quando o
// conteúdo muda); tudo o mais busca da rede primeiro, e só cai no cache
// se estiver realmente offline.
const CACHE = "escalas-louvor-shell-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const ehAssetComHash = url.pathname.startsWith("/_next/static/");

  if (ehAssetComHash) {
    // nome do arquivo muda quando o conteúdo muda: cache-first é seguro
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // páginas, manifest, ícones etc: sempre tenta a rede primeiro, e só usa
  // o cache como reserva quando não há internet
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
