// 電波がなくても開けるように、アプリのファイルをスマホに取っておく。
// 新しい版は裏で取り込み、次に開いたときから使われる。版を上げるときは VERSION と src/version.js を合わせる。

const VERSION = "2.0.0";
const CACHE = `workout-log-${VERSION}`;
const FONT_CACHE = "workout-log-fonts";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles/app.css",
  "./src/main.js",
  "./src/app-state.js",
  "./src/charts.js",
  "./src/export.js",
  "./src/menu-default.js",
  "./src/migrate.js",
  "./src/model.js",
  "./src/picker.js",
  "./src/store.js",
  "./src/ui.js",
  "./src/util.js",
  "./src/version.js",
  "./src/screens/common.js",
  "./src/screens/history.js",
  "./src/screens/menu.js",
  "./src/screens/progress.js",
  "./src/screens/record.js",
  "./src/screens/settings.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 書体は、取っておいたものをすぐ使い、裏で新しくする
  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    event.respondWith(caches.open(FONT_CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // アプリのファイルは、取っておいたものを先に使う（電波が弱くてもすぐ開く）
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match("./index.html"))),
  );
});
