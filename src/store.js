/* 本機資料庫：IndexedDB（失敗時退回 localStorage），可選擇以密碼 AES-GCM 加密 */
const COLLECTIONS = ['residents','assessments','daily','weights','events','restraints','plans','contacts','meetings','vaccines','notes','photos','audit','quarterly','accred','settings'];
const DB = {};
COLLECTIONS.forEach(c => DB[c] = c === 'settings' || c === 'quarterly' || c === 'accred' ? {} : []);

const Store = {
  idb: null, key: null, salt: null, dirty: new Set(), timer: null,
  async open() {
    try {
      this.idb = await new Promise((res, rej) => {
        const rq = indexedDB.open('ltc-facility', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
      });
    } catch (e) { this.idb = null; }
  },
  async rawGet(k) {
    if (!this.idb) { try { return localStorage.getItem('ltc:' + k); } catch (e) { return null; } }
    return new Promise(res => { const t = this.idb.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result ?? null); t.onerror = () => res(null); });
  },
  async rawSet(k, v) {
    if (!this.idb) { try { localStorage.setItem('ltc:' + k, v); } catch (e) { toast('儲存空間不足，請先匯出備份', 'bad'); } return; }
    return new Promise(res => { const tx = this.idb.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = res; });
  },
  async rawClear() {
    if (!this.idb) { Object.keys(localStorage).filter(k => k.startsWith('ltc:')).forEach(k => localStorage.removeItem(k)); return; }
    return new Promise(res => { const tx = this.idb.transaction('kv', 'readwrite'); tx.objectStore('kv').clear(); tx.oncomplete = res; });
  },
  async meta() { const m = await this.rawGet('__meta'); return m ? JSON.parse(m) : null; },
  async deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async enc(str) {
    if (!this.key) return str;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, new TextEncoder().encode(str)));
    return 'ENC:' + b64(iv) + ':' + b64(ct);
  },
  async dec(str) {
    if (!str || !str.startsWith('ENC:')) return str;
    const [, iv, ct] = str.split(':');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, this.key, unb64(ct));
    return new TextDecoder().decode(pt);
  },
  async unlock(pass) {
    const m = await this.meta();
    this.salt = unb64(m.salt); this.key = await this.deriveKey(pass, this.salt);
    try { const chk = await this.dec(m.check); if (chk !== 'ok') throw 0; } catch (e) { this.key = null; return false; }
    return true;
  },
  async loadAll() {
    for (const c of COLLECTIONS) {
      const v = await this.rawGet(c);
      if (v) { try { DB[c] = JSON.parse(await this.dec(v)); } catch (e) { console.error('load', c, e); } }
    }
  },
  mark(c) { this.dirty.add(c); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 300); },
  async flush() {
    const list = [...this.dirty]; this.dirty.clear();
    for (const c of list) await this.rawSet(c, await this.enc(JSON.stringify(DB[c])));
    if (typeof Cloud !== 'undefined' && Cloud.on) { await this.rawSet('__meta', JSON.stringify({ cloud: true, saved: new Date().toISOString() })); Cloud.afterFlush(list); return; }
    const m = (await this.meta()) || {}; m.saved = new Date().toISOString(); m.enc = !!this.key;
    if (this.key && !m.check) { m.salt = b64(this.salt); m.check = await this.enc('ok'); }
    await this.rawSet('__meta', JSON.stringify(m));
    if (typeof Folder !== 'undefined') Folder.schedule();
  },
  async setPassword(pass) {
    // 先用舊金鑰解開所有照片，換金鑰後重新加密
    const ph = {}; for (const p of (DB.photos || [])) { const v = await this.rawGet('ph:' + p.id); if (v) { try { ph[p.id] = await this.dec(v); } catch (e) {} } }
    if (!pass) { this.key = null; await this.rawSet('__meta', JSON.stringify({ enc: false })); }
    else { this.salt = crypto.getRandomValues(new Uint8Array(16)); this.key = await this.deriveKey(pass, this.salt);
      await this.rawSet('__meta', JSON.stringify({ enc: true, salt: b64(this.salt), check: await this.enc('ok') })); }
    for (const id in ph) await this.rawSet('ph:' + id, await this.enc(ph[id]));
    COLLECTIONS.forEach(c => this.dirty.add(c)); await this.flush();
  },
};
function b64(u8) { let s = ''; u8.forEach(b => s += String.fromCharCode(b)); return btoa(s); }
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

/* 通用 CRUD */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function save(coll, obj) {
  const arr = DB[coll];
  if (!obj.id) { obj.id = uid(); obj.created = nowISO(); obj.by = obj.by || currentUser(); arr.push(obj); }
  else { const i = arr.findIndex(x => x.id === obj.id); delete obj._new; if (i >= 0) { obj.updated = nowISO(); arr[i] = obj; } else { obj.created = nowISO(); obj.by = obj.by || currentUser(); arr.push(obj); } }
  Store.mark(coll); return obj;
}
function remove(coll, id) { DB[coll] = DB[coll].filter(x => x.id !== id); Store.mark(coll); }
function setKV(coll, k, v) { DB[coll][k] = v; Store.mark(coll); }

/* 日期工具 */
const DAY = 86400000;
function today() { return ymd(new Date()); }
function ymd(d) { d = new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function nowISO() { return new Date().toISOString(); }
function addDays(s, n) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
function diffDays(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / DAY); }
function roc(s) { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+y - 1911}/${m}/${d}`; }
function age(birth) { if (!birth) return ''; const b = new Date(birth), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
function quarterOf(s) { const d = new Date(s + 'T00:00:00'); return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1); }
function quarterRange(q) { const [y, n] = q.split('-Q').map(Number); const s = new Date(y, (n - 1) * 3, 1), e = new Date(y, n * 3, 0); return [ymd(s), ymd(e)]; }
function monthRange(m) { const [y, n] = m.split('-').map(Number); return [ymd(new Date(y, n - 1, 1)), ymd(new Date(y, n, 0))]; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function currentUser() { if (typeof Cloud !== 'undefined' && Cloud.on && Cloud.profile) return `${Cloud.profile.name}（${Cloud.profile.role}）`; const u = DB.settings.user; return u ? `${u.name}（${u.role}）` : '未設定'; }
