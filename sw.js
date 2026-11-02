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

// 연결 없음 화면 — 출입문과 같은 모양(주황 빛 배경 · 유리 카드) · 다시 연결되면 저절로 새로 고침
const OFFLINE = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0a0b"><title>HLE 허브 — 연결 없음</title><style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;color:#fff;text-align:center;
background:radial-gradient(70vmax 70vmax at 10% -10%,rgba(243,115,33,.26),transparent 62%),radial-gradient(60vmax 60vmax at 100% 110%,rgba(255,154,77,.16),transparent 62%),#0a0a0b;
font-family:Pretendard,system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;-webkit-font-smoothing:antialiased}
.c{width:min(360px,100%);padding:30px 26px 24px;border-radius:20px;background:linear-gradient(180deg,rgba(34,32,30,.66),rgba(16,16,17,.62));
-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 80px rgba(0,0,0,.55)}
img{display:block;margin:0 auto;width:64px;height:64px;border-radius:16px;box-shadow:0 0 30px rgba(243,115,33,.25)}
.s{display:inline-flex;align-items:center;gap:7px;margin:16px 0 0;padding:3px 11px;border-radius:999px;font-size:11.5px;font-weight:700;color:#ffb27a;background:rgba(243,115,33,.12);border:1px solid rgba(243,115,33,.3)}
.s i{width:6px;height:6px;border-radius:50%;background:#f37321;animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.25}}
h1{font-size:18px;margin:12px 0 8px;word-break:keep-all}p{color:#a9a59c;font-size:13.5px;margin:0 0 22px;line-height:1.6;word-break:keep-all}
button{width:100%;height:46px;background:linear-gradient(180deg,#ff8a3d,#ee6413);color:#fff;border:0;border-radius:12px;font:inherit;font-size:15px;font-weight:700;box-shadow:0 10px 26px rgba(243,115,33,.3)}
</style></head><body><div class="c"><img src="/icons/icon-192.png" alt=""><div class="s"><i></i>연결 기다리는 중</div><h1>인터넷에 연결되어 있지 않습니다</h1>
<p>허브는 보안을 위해 기기에 저장하지 않습니다.<br>연결되면 저절로 다시 열립니다.</p><button onclick="location.reload()">지금 다시 시도</button></div>
<script>addEventListener("online",function(){location.reload()})</script></body></html>`;

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
    return;
  }
  if (new URL(r.url).pathname === KEEP[0]) e.respondWith(fetch(r).catch(() => caches.match(r)));
});
