// HLE Hub 배포용 암호화 스크립트
// src/index.html → gzip 압축 → AES-256-GCM 암호화 → payload.bin(데이터) + index.html(로그인 화면)
// 로그인 화면(~15KB)이 즉시 뜨고, 데이터는 백그라운드로 다운로드되는 구조.
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

const html = readFileSync("src/index.html");
const gz = gzipSync(html, { level: 9 });

const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    keyMat, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
);
const iv = randomBytes(12);
const cipher = Buffer.from(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, gz));

writeFileSync("payload.bin", cipher);
const hash = createHash("sha256").update(cipher).digest("hex").slice(0, 10);

const template = readFileSync("login-template.html", "utf8");
const out = template
    .replace("__SALT_B64__", salt.toString("base64"))
    .replace("__IV_B64__", iv.toString("base64"))
    .replace("__ITER__", String(ITER))
    .replace("__PAYLOAD_URL__", "payload.bin?v=" + hash);

writeFileSync("index.html", out);
console.log(
    "암호화 완료: 원본 " + (html.length / 1048576).toFixed(1) + "MB → payload.bin " +
    (cipher.length / 1048576).toFixed(1) + "MB · 로그인 화면 index.html " +
    (out.length / 1024).toFixed(0) + "KB"
);
