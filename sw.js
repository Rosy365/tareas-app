self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("app-cache-v4").then(cache => {
      return cache.addAll([
        "./",
        "index.html",
        "style.css",    // <--- AGREGAR ESTO
        "script.js",    // <--- AGREGAR ESTO
        "manifest.json",
        "icon-192.png"
      ]);
    })
  );
});

// El evento fetch se mantiene igual, ya que es una estrategia 
// "Cache First" con actualización dinámica.
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request).then(response => {
        return caches.open("app-cache-v4").then(cache => {
          // Guardamos en caché lo que no estaba inicialmente
          cache.put(e.request, response.clone());
          return response;
        });
      }).catch(() => caches.match("index.html")); // Quité la barra "/" para consistencia
    })
  );
});