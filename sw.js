self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("app-cache-v4").then(cache => {
      return cache.addAll([
        "./",           // El punto indica la carpeta actual
        "index.html",   // Nombre actualizado
        "manifest.json", // ¡Importante agregarlo también!
        "icon-192.png"
      ]);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request).then(response => {
        return caches.open("app-cache-v4").then(cache => {
          cache.put(e.request, response.clone());
          return response;
        });
      }).catch(() => caches.match("/index.html"));
    })
  );
});