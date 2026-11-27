const CACHE = 'diano-v3';
const FILES = ['./', 'index.html', 'game.js', 'vendor/three.min.js', 'vendor/GLTFLoader.js', 'models/velociraptor.gltf', 'models/velociraptor.bin', 'fonts/fonts.css', 'manifest.json'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('fetch', (e) => e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))));
