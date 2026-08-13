// HLE Hub 배포용 암호화 스크립트 (한/영 2개 언어)
// src/index.html(한국어) + src/index_en.html(영어, 있으면) →
//   gzip 압축 → AES-256-GCM 암호화 → payload.bin / payload_en.bin + index.html(로그인 화면)
// 각 허브에는 우상단 언어 전환 버튼(EN/KO)이 주입되며, 세션 키로 재로그인 없이 즉시 전환된다.
// 사용: node encrypt.mjs   (비밀번호는 비밀번호.txt에서 읽음)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { webcrypto as crypto, randomBytes, createHash } from "node:crypto";

const ITER = 600_000;

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

// 언어 전환 버튼 + 즉시 전환 스크립트 (허브 </body> 직전에 주입)
function langSwitchSnippet(label, otherLang, otherUrl, loadingLabel) {
    return `
<style>/* Cowork 원본의 헤더 언어 링크(master_en.html 상대경로, 배포 구조에선 404)를 숨김 — 전환은 우상단 버튼으로 통일 */
#langtoggle{display:none!important}</style>
<div id="hlelang" title="${otherLang === "en" ? "Switch to English" : "한국어로 전환"}" style="position:fixed;right:68px;top:14px;z-index:50;letter-spacing:.14em;font-size:10px;font-weight:700;color:#c3c2b7;background:#1a1a19;border:1px solid rgba(255,255,255,.10);border-radius:999px;padding:4px 12px;cursor:pointer;opacity:.55;transition:opacity .2s,color .2s;user-select:none" onmouseover="this.style.opacity=1;this.style.color='#f37321'" onmouseout="this.style.opacity=.55;this.style.color='#c3c2b7'">${label}</div>
<script>
(function(){
    var btn = document.getElementById("hlelang");
    btn.addEventListener("click", async function(){
        btn.textContent = "${loadingLabel}";
        try {
            try { localStorage.setItem("hlehub_lang", "${otherLang}"); } catch(e) {}
            var b64 = null;
            try { b64 = sessionStorage.getItem("hlehub_sk") || localStorage.getItem("hlehub_k"); } catch(e) {}
            if (!b64) { location.reload(); return; }
            var raw = Uint8Array.from(atob(b64), function(c){ return c.charCodeAt(0); });
            var key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
            var res = await fetch("${otherUrl}");
            if (!res.ok) throw new Error("fetch " + res.status);
            var buf = new Uint8Array(await res.arrayBuffer());
            var plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, key, buf.slice(12));
            var html = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
            document.open();
            var CH = 262144;
            for (var i = 0; i < html.length; i += CH) {
                document.write(html.slice(i, i + CH));
                if (i + CH < html.length) await new Promise(function(r){ setTimeout(r, 0); });
            }
            document.close();
        } catch(e) { location.reload(); }
    });
})();
<\/script>`;
}

function build(srcPath, outBin) {
    let html = readFileSync(srcPath, "utf8");
    html = rewriteImages(html);
    return { html, outBin };
}

function encryptToFile(html, outBin) {
    const gz = gzipSync(Buffer.from(html), { level: 9 });
    const iv = randomBytes(12);
    return crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, gz).then((cipher) => {
        const payload = Buffer.concat([iv, Buffer.from(cipher)]);
        writeFileSync(outBin, payload);
        const hash = createHash("sha256").update(payload).digest("hex").slice(0, 10);
        console.log("  " + outBin + ": " + (payload.length / 1048576).toFixed(1) + "MB");
        return outBin + "?v=" + hash;
    });
}

// ── 빌드 ──
const hasEn = existsSync("src/index_en.html");
console.log("한국어판 빌드...");
let ko = build("src/index.html", "payload.bin");
let en = hasEn ? (console.log("영어판 빌드..."), build("src/index_en.html", "payload_en.bin")) : null;

// payload URL(해시 포함)을 먼저 계산해야 서로의 전환 버튼에 넣을 수 있으므로 2패스:
// 1패스 — 스니펫 없이 암호화해 해시 확보 → 2패스 — 스니펫 주입 후 재암호화(최종)
let koUrl = await encryptToFile(ko.html, "payload.bin");
let enUrl = en ? await encryptToFile(en.html, "payload_en.bin") : "";

if (en) {
    console.log("언어 전환 버튼 주입 후 최종 암호화...");
    const inject = (html, snippet) => {
        const i = html.lastIndexOf("</body>");
        return i === -1 ? html + snippet : html.slice(0, i) + snippet + html.slice(i);
    };
    ko.html = inject(ko.html, langSwitchSnippet("EN", "en", enUrl, "..."));
    en.html = inject(en.html, langSwitchSnippet("KO", "ko", koUrl, "..."));
    koUrl = await encryptToFile(ko.html, "payload.bin");
    enUrl = await encryptToFile(en.html, "payload_en.bin");
}

const template = readFileSync("login-template.html", "utf8");
const out = template
    .replace("__SALT_B64__", salt.toString("base64"))
    .replace("__ITER__", String(ITER))
    .replace("__PAYLOAD_URL__", koUrl)
    .replace("__PAYLOAD_EN_URL__", enUrl);

writeFileSync("index.html", out);
console.log("완료: index.html " + (out.length / 1024).toFixed(0) + "KB · 한국어" + (en ? " + 영어" : " 단독"));
