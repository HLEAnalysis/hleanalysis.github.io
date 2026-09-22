// HLE Hub 배포용 암호화 스크립트 (한/영 2개 언어)
// src/index.html(한국어) + src/index_en.html(영어, 있으면) →
//   ① 셸 + 내장문서(x-doc)로 분할
//   ② 각각 gzip 압축 → AES-256-GCM 암호화
//      · 셸    → payload.bin / payload_en.bin
//      · 문서  → p/<lang>-<id>-<hash>.bin   (탭을 열 때 그때 내려받음)
//   ③ 로그인 화면(index.html) 생성
// 사용: node encrypt.mjs   (비밀번호는 비밀번호.txt에서 읽음)
//
// 분할하는 이유: 셸은 0.5MB인데 내장문서 6개가 22MB다. 예전에는 탭 하나를 보려고
// 22.5MB를 전부 내려받아 파싱했다. 이제 첫 화면은 셸 + 보고 있던 문서 하나만 받는다.
//
// IV를 난수가 아니라 평문 해시에서 유도하는 이유: 내용이 그대로면 결과 바이트도
// 그대로여서, 바뀐 문서의 파일만 새로 커밋된다(저장소 용량 절약). 같은 평문은 같은
// 암호문이 되고 다른 평문은 다른 IV를 받으므로 AES-GCM의 IV 재사용 조건에 걸리지 않는다.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { webcrypto as crypto, randomBytes, createHash } from "node:crypto";

const ITER = 600_000;
const PART_DIR = "p";

const password = readFileSync("비밀번호.txt", "utf8").trim();
if (password.length < 14) {
    console.error("오류: 비밀번호는 14자 이상이어야 합니다 (현재 " + password.length + "자)");
    process.exit(1);
}

// salt는 재배포 간 유지 (기기 기억 기능이 배포 후에도 살아있도록). 없으면 생성.
let salt;
if (existsSync("salt.txt")) {
    salt = Buffer.from(readFileSync("salt.txt", "utf8").trim(), "base64");
} else {
    salt = randomBytes(16);
    writeFileSync("salt.txt", salt.toString("base64"));
    console.log("salt.txt 신규 생성");
}

const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    keyMat, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
);

const imgMap = existsSync("img-map.json") ? JSON.parse(readFileSync("img-map.json", "utf8")) : null;

function rewriteImages(html) {
    if (!imgMap) return html;
    let n = 0;
    for (const [url, local] of Object.entries(imgMap)) {
        if (url === "__PREFIXES__") continue;
        if (html.includes(url)) { html = html.split(url).join(local); n++; }
    }
    for (const [prefix, local] of Object.entries(imgMap["__PREFIXES__"] || {})) {
        if (html.includes(prefix)) { html = html.split(prefix).join(local); n++; }
        const p2 = prefix.replace(/\/$/, ""), l2 = local.replace(/\/$/, "");
        if (html.includes(p2)) { html = html.split(p2).join(l2); n++; }
    }
    console.log("  이미지 URL 로컬 치환: " + n + "건");
    return html;
}

// ── 암호화 (IV는 평문에서 결정론적으로 유도) ──
async function seal(text, label) {
    const gz = gzipSync(Buffer.from(text), { level: 9 });
    const iv = createHash("sha256").update("hle-iv|" + label + "|").update(gz).digest().subarray(0, 12);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, gz);
    const payload = Buffer.concat([iv, Buffer.from(cipher)]);
    const hash = createHash("sha256").update(payload).digest("hex").slice(0, 10);
    return { payload, hash };
}

// ── 셸 ↔ 내장문서 분할 ──
// 내장문서 본문 안의 닫는 script 태그는 이미 %%ENDSCRIPT%% 토큰으로 치환되어 있으므로
// 여는 태그 뒤 첫 닫는 태그가 곧 그 문서의 끝이다.
const XDOC = /<script type="text\/x-doc" id="([a-z0-9-]+)">/g;
const CLOSE = "</" + "script>";

function splitDocs(html) {
    const parts = [];
    let out = "", cursor = 0, m;
    XDOC.lastIndex = 0;
    while ((m = XDOC.exec(html)) !== null) {
        const bodyStart = m.index + m[0].length;
        const bodyEnd = html.indexOf(CLOSE, bodyStart);
        if (bodyEnd === -1) throw new Error("내장문서 " + m[1] + " 의 닫는 태그를 찾지 못했습니다");
        const id = m[1].replace(/^src-/, "");
        parts.push({ id, body: html.slice(bodyStart, bodyEnd) });
        out += html.slice(cursor, bodyStart);   // 여는 태그까지만 남기고 본문은 비운다
        cursor = bodyEnd;
        XDOC.lastIndex = bodyEnd;
    }
    out += html.slice(cursor);
    return { shell: out, parts };
}

// ── 허브 안에 주입할 스크립트 (지연 로딩 + 언어 전환) ──
function hubRuntime(manifest, otherLang, label, title) {
    const S = "<" + "script", E = "</" + "script>";
    return `
${S} type="application/json" id="hle-parts">${JSON.stringify(manifest)}${E}
<style>/* Cowork 원본의 헤더 언어 링크(master_en.html 상대경로, 배포 구조에선 404)를 숨김 */
#langtoggle{display:none!important}</style>
<div id="hlelang" title="${title}" style="position:fixed;right:68px;top:14px;z-index:50;letter-spacing:.14em;font-size:10px;font-weight:700;color:#c3c2b7;background:#1a1a19;border:1px solid rgba(255,255,255,.10);border-radius:999px;padding:4px 12px;cursor:pointer;opacity:.55;transition:opacity .2s,color .2s;user-select:none" onmouseover="this.style.opacity=1;this.style.color='#f37321'" onmouseout="this.style.opacity=.55;this.style.color='#c3c2b7'">${label}</div>
${S}>
/* ══ 내장문서 지연 로딩 ══
   셸에는 문서 본문이 비어 있다. 처음 열리는 문서 하나만 로그인 화면이 채워 넣고,
   나머지는 그 탭을 처음 누를 때 여기서 내려받아 채운다. */
(function(){
    "use strict";
    var MAN = {};
    try { MAN = JSON.parse(document.getElementById("hle-parts").textContent); } catch(e) {}
    var PARTS = MAN.parts || {};
    var loaded = Object.create(null);
    var inflight = Object.create(null);
    var keyPromise = null;

    /* 이미 본문이 채워져 있는 문서(로그인 화면이 넣어준 시작 문서)는 받을 필요가 없다 */
    Object.keys(PARTS).forEach(function(id){
        var el = document.getElementById("src-" + id);
        if (el && el.textContent.length > 0) loaded[id] = true;
    });

    function getKey(){
        if (keyPromise) return keyPromise;
        var b64 = null;
        try { b64 = sessionStorage.getItem("hlehub_sk") || localStorage.getItem("hlehub_k"); } catch(e) {}
        if (!b64) return Promise.reject(new Error("no key"));
        var raw = Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0); });
        keyPromise = crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
        return keyPromise;
    }

    function note(msg){
        var el = document.getElementById("loading");
        if (el) { el.textContent = msg; el.style.display = "grid"; }
    }

    function fetchPart(id, onProgress){
        if (loaded[id]) return Promise.resolve();
        if (inflight[id]) return inflight[id];
        var url = PARTS[id];
        if (!url) return Promise.reject(new Error("unknown part " + id));
        inflight[id] = (async function(){
            var k = await getKey();
            var res = await fetch(url);
            if (!res.ok) throw new Error("fetch " + res.status);
            var total = Number(res.headers.get("content-length") || 0);
            var buf;
            if (res.body && onProgress && total) {
                var reader = res.body.getReader(), chunks = [], got = 0;
                for (;;) {
                    var r = await reader.read();
                    if (r.done) break;
                    chunks.push(r.value); got += r.value.length;
                    onProgress(Math.min(99, Math.round(got / total * 100)));
                }
                buf = new Uint8Array(got);
                var off = 0;
                chunks.forEach(function(c){ buf.set(c, off); off += c.length; });
            } else {
                buf = new Uint8Array(await res.arrayBuffer());
            }
            var plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, k, buf.slice(12));
            var text = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
            var el = document.getElementById("src-" + id);
            if (!el) throw new Error("no slot " + id);
            el.textContent = text;
            loaded[id] = true;
        })();
        inflight[id].catch(function(){ delete inflight[id]; });
        return inflight[id];
    }

    function openDoc(id){
        if (loaded[id] || !PARTS[id]) { if (shellShow) shellShow(id); return; }
        note("문서 여는 중…");
        fetchPart(id, function(p){ note("문서 여는 중… " + p + "%"); }).then(function(){
            if (shellShow) shellShow(id);
        }).catch(function(){
            note("문서를 불러오지 못했습니다. 새로고침 해주세요.");
        });
    }

    /* 탭 클릭을 캡처 단계에서 가로챈다 — 셸의 기존 핸들러(버블)보다 먼저 돈다.
       셸은 그룹 탭을 누르면 「그 그룹에서 마지막으로 보던 문서」를 연다. 어떤 문서가
       열릴지 미리 알아야 그 조각만 받으므로 같은 규칙을 여기서도 따라 둔다. */
    var GROUPS = { scout: ["scout"], data: ["db", "planner"], vault: ["lab", "old"] };
    var OWNER = {}, LAST = {};
    Object.keys(GROUPS).forEach(function(g){
        GROUPS[g].forEach(function(d){ OWNER[d] = g; });
        LAST[g] = GROUPS[g][0];
    });
    Object.keys(loaded).forEach(function(id){ if (OWNER[id]) LAST[OWNER[id]] = id; });

    var tabs = document.getElementById("tabs");
    if (tabs) tabs.addEventListener("click", function(e){
        var t = e.target;
        if (!t || !t.closest) return;
        var s = t.closest(".subnav button");
        var id = s ? s.dataset.doc : null;
        if (!id) {
            var b = t.closest("button.tab");
            if (!b) return;
            id = LAST[b.dataset.tab];
            if (!id) return;
        }
        if (OWNER[id]) LAST[OWNER[id]] = id;       // 셸과 같은 상태를 유지한다
        if (loaded[id] || !PARTS[id]) return;      // 이미 있으면 셸에 그대로 넘긴다
        e.stopPropagation();
        e.preventDefault();
        openDoc(id);
    }, true);

    /* 안전망 — 위 규칙이 어긋나 빈 문서가 열렸을 때 되살린다.
       셸의 show() 는 실제로 연 문서 id 를 localStorage 에 남기므로 그걸 믿는다.
       (탭 구성이 나중에 바뀌어도 이 경로가 있으면 빈 화면으로 끝나지 않는다) */
    var frame = document.getElementById("frame");
    var recovering = false;
    if (frame) frame.addEventListener("load", function(){
        if (recovering) return;
        var id = null;
        try { id = localStorage.getItem("hle-hub-tab"); } catch(e) {}
        if (!id || loaded[id] || !PARTS[id]) return;
        recovering = true;
        note("문서 여는 중…");
        fetchPart(id, function(p){ note("문서 여는 중… " + p + "%"); }).then(function(){
            if (OWNER[id]) LAST[OWNER[id]] = id;
            if (shellShow) shellShow(id);
        }).catch(function(){
            note("문서를 불러오지 못했습니다. 새로고침 해주세요.");
        }).then(function(){ recovering = false; });
    });

    /* LOG 드로어 등에서 쓰는 전역 진입점에도 같은 보호를 씌운다 */
    var shellShow = window.hubShow;
    window.hubShow = function(id){
        if (!loaded[id] && PARTS[id]) { openDoc(id); return; }
        if (shellShow) shellShow(id);
    };

    /* 한가할 때 나머지 문서를 미리 내려받아 캐시에 올려 둔다(복호화는 필요할 때).
       파일 이름에 내용 해시가 들어 있어 바뀌지 않은 문서는 다음 방문 때 다시 받지 않는다. */
    function warm(){
        try { if (navigator.connection && navigator.connection.saveData) return; } catch(e) {}
        var rest = Object.keys(PARTS).filter(function(id){ return !loaded[id] && !inflight[id]; });
        (function next(){
            var id = rest.shift();
            if (!id) return;
            fetch(PARTS[id]).then(function(){ setTimeout(next, 300); }, function(){ setTimeout(next, 2000); });
        })();
    }
    if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 8000 });
    else setTimeout(warm, 4000);

    /* 언어 전환: 언어만 기록하고 새로고침. 세션 키가 남아 있어 재로그인은 없다. */
    var btn = document.getElementById("hlelang");
    if (btn) btn.addEventListener("click", function(){
        btn.textContent = "…";
        try { localStorage.setItem("hlehub_lang", "${otherLang}"); } catch(e) {}
        location.reload();
    });
})();
${E}`;
}

// ── p/ 디렉터리 ──
if (!existsSync(PART_DIR)) mkdirSync(PART_DIR);
const keepFiles = new Set();

async function buildLang(srcPath, shellOut, lang, otherLang, label, title) {
    const html = rewriteImages(readFileSync(srcPath, "utf8"));
    const { shell, parts } = splitDocs(html);

    const manifest = { lang, parts: {} };
    let partBytes = 0;
    for (const p of parts) {
        const { payload, hash } = await seal(p.body, lang + "-" + p.id);
        const file = PART_DIR + "/" + lang + "-" + p.id + "-" + hash + ".bin";
        // 내용이 그대로면 파일도 그대로 — 굳이 다시 쓰지 않는다
        if (!existsSync(file)) writeFileSync(file, payload);
        keepFiles.add(file.slice(PART_DIR.length + 1));
        manifest.parts[p.id] = file;
        partBytes += payload.length;
        console.log("    " + file + "  " + (payload.length / 1048576).toFixed(2) + "MB");
    }

    const runtime = hubRuntime(manifest, otherLang, label, title);
    const i = shell.lastIndexOf("</body>");
    const shellFinal = i === -1 ? shell + runtime : shell.slice(0, i) + runtime + shell.slice(i);

    const { payload, hash } = await seal(shellFinal, lang + "-shell");
    writeFileSync(shellOut, payload);
    console.log("  " + shellOut + " (셸): " + (payload.length / 1048576).toFixed(2) + "MB"
        + "  · 문서 " + parts.length + "개 합계 " + (partBytes / 1048576).toFixed(1) + "MB");
    return { url: shellOut + "?v=" + hash, manifest };
}

// ── 빌드 ──
console.log("한국어판 빌드...");
const ko = await buildLang("src/index.html", "payload.bin", "ko", "en", "EN", "Switch to English");

let en = null;
if (existsSync("src/index_en.html")) {
    console.log("영어판 빌드...");
    en = await buildLang("src/index_en.html", "payload_en.bin", "en", "ko", "KO", "한국어로 전환");
}

// 더 이상 쓰이지 않는 조각 파일 정리
let pruned = 0;
for (const f of readdirSync(PART_DIR)) {
    if (f.endsWith(".bin") && !keepFiles.has(f)) { unlinkSync(PART_DIR + "/" + f); pruned++; }
}
if (pruned) console.log("사용하지 않는 조각 " + pruned + "개 삭제");

const template = readFileSync("login-template.html", "utf8");
const out = template
    .replace("__SALT_B64__", salt.toString("base64"))
    .replace("__ITER__", String(ITER))
    .replace("__PAYLOAD_URL__", ko.url)
    .replace("__PAYLOAD_EN_URL__", en ? en.url : "")
    .replace("__PARTS_KO__", JSON.stringify(ko.manifest.parts))
    .replace("__PARTS_EN__", JSON.stringify(en ? en.manifest.parts : {}));

writeFileSync("index.html", out);
console.log("완료: index.html " + (out.length / 1024).toFixed(0) + "KB · 한국어" + (en ? " + 영어" : " 단독"));
