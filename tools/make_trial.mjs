// 用密碼加密試用資料：node tools/make_trial.mjs <輸入.json> <輸出.enc.json> <密碼>
// 格式與網頁端 Store.enc 相同（PBKDF2-SHA256 200000 次 → AES-256-GCM）
import fs from 'node:fs';
const [, , src, out, pass] = process.argv;
const { subtle } = globalThis.crypto;
const b64 = u8 => Buffer.from(u8).toString('base64');
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const base = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
const key = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const plain = fs.readFileSync(src, 'utf8');
const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
fs.writeFileSync(out, JSON.stringify({ __app: 'ltc-trial', __at: new Date().toISOString(), salt: b64(salt), data: 'ENC:' + b64(iv) + ':' + b64(ct) }));
console.log('encrypted', Math.round(fs.statSync(out).size / 1024), 'KB');
