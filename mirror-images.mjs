// 허브가 참조하는 외부 이미지를 로컬(img/)로 미러링하고 URL→로컬경로 매핑(img-map.json)을 생성.
// 사용: node mirror-images.mjs   (새 챔피언/아이템이 추가됐을 때만 다시 실행하면 됨)
// 이후 encrypt.mjs가 빌드 때 매핑을 적용해 허브의 이미지 URL을 로컬로 바꿔치기한다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const UA = { headers: { "User-Agent": "Mozilla/5.0 (HLE-Hub image mirror)" } };
const html = readFileSync("src/index.html", "utf8");
mkdirSync("img/champ", { recursive: true });
mkdirSync("img/item", { recursive: true });
mkdirSync("img/misc", { recursive: true });

const map = existsSync("img-map.json") ? JSON.parse(readFileSync("img-map.json", "utf8")) : {};
let ok = 0, fail = 0, skip = 0;

async function grab(url, local) {
    if (map[url] && existsSync(local)) { skip++; return; }
    try {
        const res = await fetch(url, UA);
        if (!res.ok) throw new Error("HTTP " + res.status);
        writeFileSync(local, Buffer.from(await res.arrayBuffer()));
        map[url] = "/" + local.replace(/\\/g, "/");
        ok++;
    } catch (e) {
        fail++;
        console.error("실패: " + url + " (" + e.message + ")");
    }
}

// 동시 다운로드 제한
async function pool(jobs, n = 8) {
    const q = [...jobs];
    await Promise.all(Array.from({ length: n }, async () => {
        while (q.length) { const j = q.shift(); await j(); }
    }));
}

const jobs = [];

// 1) 챔피언 아이콘 — 전체 로스터를 최신 참조 버전으로 (동적 생성 URL 대응)
const vers = [...new Set(html.match(/ddragon\.leagueoflegends\.com\/cdn\/([\d.]+)\/img\/champion\//g) || [])]
    .map((s) => s.match(/cdn\/([\d.]+)\//)[1]);
const ver = vers.sort().reverse()[0] || "16.14.1";
console.log("ddragon 버전: " + ver + " (발견: " + vers.join(", ") + ")");
const champData = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/ko_KR/champion.json`, UA)).json();
const champIds = Object.keys(champData.data);
console.log("챔피언 " + champIds.length + "종 미러링...");
for (const id of champIds) {
    jobs.push(() => grab(`https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${id}.png`, `img/champ/${id}.png`));
}

// 2) 위키 썸네일 → ddragon 동일 아이콘으로 대체 미러링
//    (위키 서버는 봇을 차단하므로, 아이템/챔피언 아이콘을 이름→ID 매핑으로 라이엇 CDN에서 받는다)
const itemData = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/item.json`, UA)).json();
const itemByName = {};
for (const [id, it] of Object.entries(itemData.data)) itemByName[it.name.toLowerCase()] = id;
const champEn = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`, UA)).json();
const champByName = {};
for (const [id, c] of Object.entries(champEn.data)) champByName[c.name.toLowerCase()] = id;

const thumbRe = /https:\/\/wiki\.leagueoflegends\.com\/en-us\/images\/thumb\/([^\/"'?\s&]+)\/(\d+px-[^"'?\s&]+?)(?:\?[0-9a-f]*)?(?=["'&\s<)])/g;
const thumbs = new Map();
for (const m of html.matchAll(thumbRe)) thumbs.set(m[0].replace(/\?[0-9a-f]*$/, ""), decodeURIComponent(m[1]));
let mapped = 0, unmapped = [];
for (const [url, rawName] of thumbs) {
    const base = rawName.replace(/\.(png|jpg|webp)$/i, "");
    if (/_item$/i.test(base)) {
        const name = base.replace(/_item$/i, "").replace(/_/g, " ").toLowerCase();
        const id = itemByName[name];
        if (id) { jobs.push(() => grab_as(url, `https://ddragon.leagueoflegends.com/cdn/${ver}/img/item/${id}.png`, `img/item/i${id}.png`)); mapped++; continue; }
    }
    if (/_OriginalSquare$/i.test(base)) {
        const name = base.replace(/_OriginalSquare$/i, "").replace(/_/g, " ").toLowerCase();
        const id = champByName[name];
        if (id) { map[url] = "/img/champ/" + id + ".png"; mapped++; continue; } // 이미 1)에서 받음
    }
    unmapped.push(url);
}
console.log("위키 이미지: 매핑 성공 " + mapped + " · 원본 유지 " + unmapped.length + "종");

// 원본 URL은 유지하되 ddragon 파일로 저장하는 다운로드
async function grab_as(origUrl, srcUrl, local) {
    if (map[origUrl] && existsSync(local)) { skip++; return; }
    try {
        const res = await fetch(srcUrl, UA);
        if (!res.ok) throw new Error("HTTP " + res.status);
        writeFileSync(local, Buffer.from(await res.arrayBuffer()));
        map[origUrl] = "/" + local.replace(/\\/g, "/");
        ok++;
    } catch (e) { fail++; console.error("실패: " + srcUrl + " (" + e.message + ")"); }
}

// 3) 기타 (팀 로고 등 wikia / communitydragon)
const miscRe = /https:\/\/(?:static\.wikia\.nocookie\.net|cdn\.communitydragon\.org)\/[^"'\s&<)]+/g;
const miscs = new Set((html.match(miscRe) || []).map((u) => u.replace(/\?.*$/, "")));
console.log("기타 이미지 " + miscs.size + "종 미러링...");
let mi = 0;
for (const url of miscs) {
    const cdItem = url.match(/cdn\.communitydragon\.org\/[^/]+\/item\/(\d+)/);
    if (cdItem) { jobs.push(() => grab_as(url, `https://ddragon.leagueoflegends.com/cdn/${ver}/img/item/${cdItem[1]}.png`, `img/item/i${cdItem[1]}.png`)); continue; }
    const ext = (url.match(/\.(png|jpg|jpeg|webp|gif|svg)/i) || [null, "png"])[1];
    const fname = "m" + (mi++) + "_" + url.split("/").filter(Boolean).slice(-3, -1).join("_").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60) + "." + ext;
    jobs.push(() => grab(url, `img/misc/${fname}`));
}

await pool(jobs);

// 챔피언 접두사 매핑(개별 파일이 아닌 접두사 치환용) 기록
map["__PREFIXES__"] = {};
for (const v of vers.length ? vers : [ver]) {
    map["__PREFIXES__"][`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/`] = "/img/champ/";
}

writeFileSync("img-map.json", JSON.stringify(map, null, 1));
console.log(`완료: 다운로드 ${ok} · 기존 유지 ${skip} · 실패 ${fail} → img-map.json 갱신`);
