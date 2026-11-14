// Service worker do telão: guarda as páginas do telão e os arquivos do app
// para o modo apresentação abrir sem internet no dia da cerimônia.
// Filmes, pôsteres e trilha ficam no OPFS (não passam por aqui).
const STATIC = "telao-static-v1";
const PAGES = "telao-pages-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC, PAGES];
      for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // JS, CSS e fontes do Next: nomes com hash, nunca mudam → cache primeiro.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Páginas do telão: rede primeiro (dados frescos); sem rede, a última cópia.
  if (req.mode === "navigate" && url.pathname.startsWith("/telao/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          if (res.ok && !res.redirected) cache.put(url.pathname, res.clone());
          return res;
        } catch (err) {
          const hit = await cache.match(url.pathname, { ignoreVary: true, ignoreSearch: true });
          if (hit) return hit;
          throw err;
        }
      })(),
    );
  }
});
