// HLE 허브 앱(PWA) 서비스 워커
// 허브 내용은 저장하지 않는다 — 출입문 · 암호화 조각 · 서버 응답은 늘 네트워크에서 새로 받는다(최신화 즉시 반영).
// 하는 일: 앱 설치 조건 충족 + 네트워크가 끊겼을 때 안내 화면만 보여 준다.
const VER = "hle-app-1";
const KEEP = ["/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VER).then((c) => c.addAll(KEEP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const OFFLINE = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>HLE 허브 — 연결 없음</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0d0d;color:#fff;
font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;text-align:center;padding:24px;box-sizing:border-box}
img{width:72px;height:72px;border-radius:16px}h1{font-size:18px;margin:18px 0 8px}p{color:#c3c2b7;font-size:14px;margin:0 0 22px;line-height:1.6}
button{background:#f37321;color:#fff;border:0;border-radius:10px;padding:12px 26px;font-size:15px;font-weight:600}
</style></head><body><div><img src="/icons/icon-192.png" alt=""><h1>인터넷에 연결되어 있지 않습니다</h1>
<p>허브는 보안을 위해 기기에 저장하지 않습니다.<br>연결된 뒤 다시 시도하세요.</p><button onclick="location.reload()">다시 시도</button></div></body></html>`;

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
    return;
  }
  if (new URL(r.url).pathname === KEEP[0]) e.respondWith(fetch(r).catch(() => caches.match(r)));
});
