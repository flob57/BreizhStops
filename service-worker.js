self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(names =>
        Promise.all(
          names.map(name => caches.delete(name))
        )
      ),

      self.registration.unregister(),

      self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      }).then(clients => {
        clients.forEach(client => {
          client.navigate(client.url);
        });
      })
    ])
  );
});
