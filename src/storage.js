/* ===== 照片、資料夾自動存檔、保存年限、調閱紀錄 ===== */

/* --- 照片：壓縮後存在本機 IndexedDB（有密碼時加密），中繼資料在 DB.photos --- */
const PhotoCache = new Map();
function compressImage(file, max = 1600, q = 0.72) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res({ data: c.toDataURL('image/jpeg', q), w: c.width, h: c.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('無法讀取這張圖片')); };
    img.src = url;
  });
}
async function addPhotos(files, owner) {
  let n = 0;
  for (const f of files) {
    if (!/^image\//.test(f.type)) continue;
    try {
      const { data, w, h } = await compressImage(f);
      const id = uid();
      const encd = await Store.enc(data); await Store.rawSet('ph:' + id, encd);
      if (Cloud.on) Cloud.uploadPhoto(id, encd);
      PhotoCache.set(id, data);
      DB.photos.push({ id, owner, date: today(), w, h, size: Math.round(data.length * 0.75), caption: '', by: currentUser(), created: nowISO() });
      n++;
    } catch (e) { toast(e.message, 'bad'); }
  }
  Store.mark('photos'); Folder.schedule();
  return n;
}
async function getPhoto(id) {
  if (PhotoCache.has(id)) return PhotoCache.get(id);
  let v = await Store.rawGet('ph:' + id);
  if (!v && Cloud.on) { v = await Cloud.downloadPhoto(id); if (v) await Store.rawSet('ph:' + id, v); }
  if (!v) return null;
  const d = await Store.dec(v); PhotoCache.set(id, d); return d;
}
async function delPhoto(id) {
  DB.photos = DB.photos.filter(p => p.id !== id); PhotoCache.delete(id); Store.mark('photos');
  if (Store.idb) await new Promise(r => { const tx = Store.idb.transaction('kv', 'readwrite'); tx.objectStore('kv').delete('ph:' + id); tx.oncomplete = r; tx.onerror = r; });
  Folder.removePhoto(id); if (Cloud.on) Cloud.deletePhoto(id);
}
function photosOf(owner) { return DB.photos.filter(p => p.owner === owner); }
function ownerExists(owner) {
  const [k, id] = owner.split(':');
  return k === 'event' ? DB.events.some(e => e.id === id) : k === 'meeting' ? DB.meetings.some(m => m.id === id) : k === 'res' ? DB.residents.some(r => r.id === id) : true;
}
async function cleanupOrphans() { for (const p of DB.photos.filter(p => !ownerExists(p.owner))) await delPhoto(p.id); }
function photoStrip(owner, opts = {}) {
  const ps = photosOf(owner);
  return `<div class="photos" data-owner="${owner}">${ps.map(p => `<button class="ph" data-act="viewPhoto" data-id="${p.id}" title="${esc(p.caption || roc(p.date))}"><img data-ph="${p.id}" alt="${esc(p.caption || '照片')}"></button>`).join('')}
    ${opts.readonly ? '' : `<label class="ph add" title="新增照片（可直接用手機拍照）">＋ 照片<input type="file" accept="image/*" multiple hidden data-photo-owner="${owner}"></label>`}</div>
    ${opts.hint ? `<div class="small muted">${opts.hint}</div>` : ''}`;
}
async function hydratePhotos(root = document) { for (const img of $$('img[data-ph]:not([src])', root)) { const d = await getPhoto(img.dataset.ph); if (d) img.src = d; } }
document.addEventListener('change', async e => {
  const inp = e.target.closest('input[data-photo-owner]'); if (!inp) return;
  const owner = inp.dataset.photoOwner; toast('照片壓縮儲存中…');
  const n = await addPhotos([...inp.files], owner); inp.value = '';
  if (n) toast(`已加入 ${n} 張照片`);
  const strip = inp.closest('.photos'); if (strip) { strip.outerHTML = photoStrip(owner); hydratePhotos(); }
});
ACT.viewPhoto = async el => {
  const p = DB.photos.find(x => x.id === el.dataset.id); if (!p) return;
  const d = await getPhoto(p.id);
  const ov = document.createElement('div'); ov.id = 'phView'; ov.className = 'phview';
  ov.innerHTML = `<div class="box"><h2 style="margin-top:0">照片｜${roc(p.date)}</h2><img src="${d}" style="max-width:100%;border-radius:8px" alt="">
    <label class="f">說明<input id="phCap" value="${esc(p.caption || '')}" placeholder="例：薦骨傷口 2×3 cm、中秋活動合照"></label>
    <div class="small muted">${p.w}×${p.h}・約 ${Math.round(p.size / 1024)} KB・${esc(p.by || '')}</div>
    <div class="foot"><button class="btn danger" id="phDel">刪除照片</button><span class="sp"></span><button class="btn pri" id="phOk">完成</button></div></div>`;
  document.body.appendChild(ov);
  const done = () => { ov.remove(); const s = $(`.photos[data-owner="${p.owner}"]`); if (s) { s.outerHTML = photoStrip(p.owner); hydratePhotos(); } };
  ov.querySelector('#phOk').onclick = () => { p.caption = ov.querySelector('#phCap').value; Store.mark('photos'); done(); };
  ov.querySelector('#phDel').onclick = async () => { if (!confirm('確定刪除這張照片？')) return; await delPhoto(p.id); toast('已刪除照片'); done(); };
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); done(); } });
};
async function photosPrintHTML(owner, title = '照片') {
  const ps = photosOf(owner); if (!ps.length) return '';
  const imgs = []; for (const p of ps) imgs.push(`<figure style="margin:0;break-inside:avoid"><img src="${await getPhoto(p.id)}" style="width:100%;max-height:200pt;object-fit:contain;border:1px solid #999"><figcaption class="note">${esc(p.caption || roc(p.date))}</figcaption></figure>`);
  return `<h3>${title}</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:6pt">${imgs.join('')}</div>`;
}

/* --- 資料夾自動存檔（Chrome / Edge 的 File System Access） --- */
const Folder = {
  handle: null, ok: false, timer: null, lastWrite: null, err: '',
  supported() { return 'showDirectoryPicker' in window; },
  async init() {
    if (!this.supported() || !Store.idb) return;
    const h = await Store.rawGet('__dir'); if (!h || typeof h !== 'object') return;
    this.handle = h;
    try { this.ok = (await h.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { this.ok = false; }
  },
  async choose() {
    try { this.handle = await window.showDirectoryPicker({ id: 'ltc-data', mode: 'readwrite' }); }
    catch (e) { if (e.name !== 'AbortError') toast('無法使用這個資料夾：' + e.message, 'bad'); return false; }
    await Store.rawSet('__dir', this.handle); this.ok = true;
    let existing = null;
    try { const fh = await this.handle.getFileHandle('長照照護資料.json'); existing = JSON.parse(await (await fh.getFile()).text()); } catch (e) {}
    if (existing && existing.__app === 'ltc-facility') {
      this.ok = false; // 先暫停，避免覆蓋既有資料
      openModal('這個資料夾已有資料', `<p>資料夾內已有 ${esc(existing.org || '')} 的資料（最後存檔 ${existing.__at ? new Date(existing.__at).toLocaleString() : ''}）。</p>
        <p class="small">・如果這是新電腦，請選「從資料夾還原」。<br>・只有確定這台電腦的資料比較新，才選「以這台電腦覆蓋」。</p>`, null,
        { extraBtn: `<button class="btn pri" data-act="folderRestoreHere">從資料夾還原</button><button class="btn danger" data-act="folderOverwrite">以這台電腦覆蓋</button>` });
      return false;
    }
    await this.writeAll(true); return true;
  },
  async regrant(noWrite) {
    if (!this.handle) return false;
    try { this.ok = (await this.handle.requestPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { this.ok = false; }
    if (this.ok && !noWrite) { await this.writeAll(); toast('已恢復自動存檔到資料夾'); }
    return this.ok;
  },
  async unlink() { this.handle = null; this.ok = false; if (Store.idb) await new Promise(r => { const tx = Store.idb.transaction('kv', 'readwrite'); tx.objectStore('kv').delete('__dir'); tx.oncomplete = r; }); },
  schedule() { if (!this.ok) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.writeAll(), 3000); },
  async file(dir, name, content) { const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(content); await w.close(); },
  async writeAll(full) {
    if (!this.ok || !this.handle) return;
    try {
      const payload = await buildBackup(false);
      await this.file(this.handle, '長照照護資料.json', payload);
      const snap = await this.handle.getDirectoryHandle('每日備份', { create: true });
      await this.file(snap, `備份_${today()}.json`, payload);
      const names = []; for await (const [n] of snap.entries()) if (/^備份_\d{4}-\d{2}-\d{2}\.json$/.test(n)) names.push(n);
      names.sort(); const keep = +(DB.settings.snapDays || 60);
      for (const n of names.slice(0, Math.max(0, names.length - keep))) await snap.removeEntry(n);
      const pd = await this.handle.getDirectoryHandle('照片', { create: true });
      const have = new Set(); for await (const [n] of pd.entries()) have.add(n.split('.')[0]);
      for (const p of DB.photos) if (!have.has(p.id)) {
        const d = await getPhoto(p.id); if (!d) continue;
        if (Store.key) await this.file(pd, `${p.id}.enc.txt`, await Store.enc(d));
        else await this.file(pd, `${p.id}.jpg`, await (await fetchDataURL(d)).blob());
      }
      this.lastWrite = nowISO(); this.err = '';
    } catch (e) { this.err = e.message; if (e.name === 'NotAllowedError') this.ok = false; console.error(e); }
  },
  async removePhoto(id) {
    if (!this.ok || !this.handle) return;
    try { const pd = await this.handle.getDirectoryHandle('照片', { create: true }); for (const n of [`${id}.jpg`, `${id}.enc.txt`]) { try { await pd.removeEntry(n); } catch (e) {} } } catch (e) {}
  },
  async restore() {
    if (!this.handle) return;
    try {
      const fh = await this.handle.getFileHandle('長照照護資料.json'); const txt = await (await fh.getFile()).text();
      const photos = {};
      try { const pd = await this.handle.getDirectoryHandle('照片'); for await (const [n, h] of pd.entries()) { const id = n.split('.')[0]; const f = await h.getFile(); photos[id] = n.endsWith('.enc.txt') ? { enc: await f.text() } : { data: await blobToDataURL(f) }; } } catch (e) {}
      await restoreBackup(txt, photos);
    } catch (e) { toast('資料夾內找不到「長照照護資料.json」', 'bad'); }
  },
};
function fetchDataURL(d) { const [h, b] = d.split(','); const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return Promise.resolve(new Response(new Blob([u], { type: h.slice(5, h.indexOf(';')) }))); }
function blobToDataURL(b) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }

/* --- 備份檔格式（下載與資料夾共用）：有密碼時整包加密 --- */
async function buildBackup(withPhotos) {
  if (Cloud.on) return buildCloudBackup(withPhotos);
  const data = {}; COLLECTIONS.forEach(c => data[c] = DB[c]);
  if (withPhotos) { data.__photos = {}; for (const p of DB.photos) data.__photos[p.id] = await getPhoto(p.id); }
  const head = { __app: 'ltc-facility', __ver: 2, __at: nowISO(), org: DB.settings.org || '' };
  if (Store.key) return JSON.stringify(Object.assign(head, { enc: true, salt: b64(Store.salt), data: await Store.enc(JSON.stringify(data)) }));
  return JSON.stringify(Object.assign(head, { data }));
}
async function restoreBackup(txt, folderPhotos) {
  let f; try { f = JSON.parse(txt); } catch (e) { toast('檔案格式錯誤', 'bad'); return; }
  if (f.__app !== 'ltc-facility') { toast('這不是本系統的備份檔', 'bad'); return; }
  let data = f.data || f, key = null, salt = null;
  if (f.enc) {
    const pass = await promptPassword('這份備份有加密，請輸入當時設定的密碼'); if (pass === null) return;
    salt = unb64(f.salt); key = await Store.deriveKey(pass, salt);
    const keep0 = Store.key; try { Store.key = key; data = JSON.parse(await Store.dec(f.data)); } catch (e) { toast('密碼錯誤，無法解開備份', 'bad'); return; } finally { Store.key = keep0; }
  }
  if (Cloud.on && !Cloud.isAdmin()) { toast('雲端版只有主任可以還原備份', 'bad'); return; }
  confirmBox(`將以備份（${f.__at ? new Date(f.__at).toLocaleString() : ''}，住民 ${(data.residents || []).length} 位、照片 ${(data.photos || []).length} 張）<b>覆蓋</b>這台電腦目前的資料，確定？`, async () => {
    const fileKey = key; if (Cloud.on) key = null;
    if (key) { Store.key = key; Store.salt = salt; await Store.rawSet('__meta', JSON.stringify({ enc: true, salt: b64(salt), check: await Store.enc('ok') })); }
    COLLECTIONS.forEach(c => { DB[c] = data[c] || (['settings', 'quarterly', 'accred'].includes(c) ? {} : []); Store.mark(c); });
    const emb = data.__photos || {}; PhotoCache.clear();
    for (const p of DB.photos) {
      let d = emb[p.id];
      const fp = folderPhotos && folderPhotos[p.id];
      if (!d && fp) d = fp.data || (fileKey ? await (async () => { const s = Store.key; try { Store.key = fileKey; return await Store.dec(fp.enc); } catch (e) { return null; } finally { Store.key = s; } })() : null);
      if (d) { const e2 = await Store.enc(d); await Store.rawSet('ph:' + p.id, e2); if (Cloud.on) Cloud.uploadPhoto(p.id, e2); }
    }
    await Store.flush(); if (Folder.handle) Folder.ok = true; toast('已還原'); updateBrand(); go('dash');
  }, '覆蓋還原');
}
function promptPassword(msg) {
  return new Promise(res => {
    openModal('輸入密碼', `<p class="small">${esc(msg)}</p><label class="f">密碼<input type="password" id="ppw"></label>`, () => { const v = $('#ppw').value; setTimeout(() => res(v), 0); }, { saveText: '確定' });
    const c = $('#modal [data-act=closeModal]'); if (c) c.addEventListener('click', () => res(null), { once: true });
  });
}

/* 雲端版的下載備份：另設一組備份密碼加密（與登入密碼無關） */
async function buildCloudBackup(withPhotos) {
  const pass = await promptPassword('為這份備份檔設定一組密碼（至少 10 字元）。還原時需要輸入，請另外保存。');
  if (!pass || pass.length < 10) { toast('備份密碼至少 10 字元', 'bad'); throw new Error('cancel'); }
  const data = {}; COLLECTIONS.forEach(c => data[c] = DB[c]);
  if (withPhotos) { data.__photos = {}; for (const p of DB.photos) data.__photos[p.id] = await getPhoto(p.id); }
  const salt = crypto.getRandomValues(new Uint8Array(16)), k = await Store.deriveKey(pass, salt), keep = Store.key;
  Store.key = k; const enc = await Store.enc(JSON.stringify(data)); Store.key = keep;
  return JSON.stringify({ __app: 'ltc-facility', __ver: 2, __at: nowISO(), org: DB.settings.org || '', enc: true, salt: b64(salt), data: enc });
}

/* --- 加密試用包：網站上只有加密檔，輸入密碼才解得開 --- */
async function trialAvailable() { if (Cloud.on) return false; try { const r = await fetch('trial.enc.json', { method: 'HEAD', cache: 'no-store' }); return r.ok; } catch (e) { return false; } }
function trialPwSaved() { try { return localStorage.getItem('ltcTrialPw') || ''; } catch (e) { return ''; } }
// 開啟時檢查：試用包有新版就自動換成新版（記得密碼的裝置不用再輸入）
async function trialCheckUpdate(force) {
  if (Cloud.on) return false;
  let f; try { f = await fetch('trial.enc.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null); } catch (e) { return false; }
  if (!f) return false;
  if (!DB.settings.trial && /試用/.test(DB.settings.org || '')) DB.settings.trial = true; // 早期匯入的試用資料沒有標記
  const isTrial = !DB.residents.length || DB.settings.trial;
  if (!force && (!isTrial || DB.settings.trialAt === f.__at)) return false;
  const pw = trialPwSaved();
  if (pw && await loadTrial(pw, f, true)) return true;
  openTrialLoader(true, DB.settings.trial && DB.settings.trialAt !== f.__at); return true;
}
function openTrialLoader(auto, isUpdate) {
  openModal(isUpdate ? '試用資料有新版本' : '載入試用資料', `<p class="small">${isUpdate ? '<b>網站上的試用資料已更新</b>，輸入一次密碼就會換成新版（之後這台裝置會記住，不用再輸入）。<br>' : ''}這份是健復養護中心的<b>去識別化試用資料</b>（47 位住民、今年 1 月起的護理紀錄、事件、聯繫與評估），已加密。</p>
    <label class="f">試用密碼<input id="trialPw" autocomplete="off" placeholder="jf-xxxx-xxxx-xxxx"></label>
    <p class="small muted">資料只會載入到這台裝置的這個瀏覽器。${DB.residents.length ? '<b style="color:var(--warn)">注意：會覆蓋這台裝置目前的資料。</b>' : ''}</p><p id="trialMsg" class="small" style="color:var(--bad)"></p>`, () => { loadTrial($('#trialPw').value.trim()); return false; }, { saveText: '解鎖並載入', extraBtn: auto ? '<button class="btn ghost" data-act="skipTrial">不用，從空白開始</button>' : '' });
  setTimeout(() => { const i = $('#trialPw'); if (i) { i.focus(); i.addEventListener('keydown', e => { if (e.key === 'Enter') loadTrial(i.value.trim()); }); } }, 50);
}
ACT.skipTrial = () => { closeModal(); if (!DB.settings.user) askUser(true); };
async function loadTrial(pass, f, silent) {
  const msg = $('#trialMsg') || { style: {} }; if (!pass) { msg.textContent = '請輸入密碼'; return false; }
  msg.style.color = 'var(--muted)'; msg.textContent = '解密中…';
  try {
    f = f || await fetch('trial.enc.json', { cache: 'no-store' }).then(r => r.json());
    const key = await Store.deriveKey(pass, unb64(f.salt)), keep = Store.key; let txt;
    Store.key = key; try { txt = await Store.dec(f.data); } finally { Store.key = keep; }
    const pkg = JSON.parse(txt), data = pkg.data || pkg, user = DB.settings.user;
    COLLECTIONS.forEach(c => { DB[c] = data[c] || (['settings', 'quarterly', 'accred'].includes(c) ? {} : []); Store.mark(c); });
    DB.settings.trial = true; DB.settings.trialAt = f.__at; if (user) DB.settings.user = user;
    trialSimFill(true);
    try { localStorage.setItem('ltcTrialPw', pass); } catch (e) {}
    await Store.flush(); if (!silent) closeModal(); updateBrand(); toast(`已載入${silent ? '最新版' : ''}試用資料：${DB.residents.length} 位住民（${(f.__at || '').slice(0, 10)} 版）`);
    if (!DB.settings.user) askUser(true); if (silent) render(); else go('dash'); return true;
  } catch (e) { if (silent) { try { localStorage.removeItem('ltcTrialPw'); } catch (x) {} return false; } msg.style.color = 'var(--bad)'; msg.textContent = '密碼錯誤，或無法讀取試用資料'; return false; }
}
ACT.openTrial = () => openTrialLoader();

/* --- 示範站登入／登出：每次登入都重新載入最新的示範資料 --- */
const DEMO_ACCOUNT = '1111';
function demoLoggedIn() { try { return sessionStorage.getItem('demoIn') === '1'; } catch (e) { return false; } }
function showDemoLogin() {
  if ($('#demoLogin')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="demoLogin" class="login-wrap"><form class="login-card" autocomplete="off">
    <div class="logo" style="margin:0 auto 8px">✓</div><h2>長照照護紀錄系統</h2><p class="muted small">示範站（資料皆已去識別化）</p>
    <label class="f">帳號<input id="dlUser" value="" placeholder="1111" autocapitalize="off" inputmode="numeric"></label>
    <label class="f">密碼<input id="dlPw" type="password" placeholder="1111" inputmode="numeric"></label>
    <div class="login-hint">示範帳號：<b>1111</b>　密碼：<b>1111</b><br><span class="small">此為示範用帳號，登入後會載入最新的示範資料；正式上線後每位員工會有自己的帳號密碼。</span></div>
    <p id="dlMsg" class="small" style="color:var(--bad);min-height:1em"></p>
    <button class="btn pri" style="width:100%" id="dlBtn">登入</button></form></div>`);
  const f = $('#demoLogin form'); setTimeout(() => $('#dlUser').focus(), 50);
  f.addEventListener('submit', async e => {
    e.preventDefault(); const u = $('#dlUser').value.trim().toLowerCase(), pw = $('#dlPw').value.trim(), msg = $('#dlMsg');
    if (u !== DEMO_ACCOUNT) { msg.textContent = '帳號錯誤（示範帳號是 1111）'; return; }
    msg.style.color = 'var(--muted)'; msg.textContent = '登入中，正在載入最新示範資料…'; $('#dlBtn').disabled = true;
    if (!DB.settings.user) DB.settings.user = { name: '示範使用者', role: '機構主任' };
    const ok = await loadTrial(pw, null, true);
    if (!ok) { msg.style.color = 'var(--bad)'; msg.textContent = '密碼錯誤（示範密碼是 1111）'; $('#dlBtn').disabled = false; return; }
    try { sessionStorage.setItem('demoIn', '1'); } catch (x) {}
    $('#demoLogin').remove(); $('#logoutBtn').hidden = false; updateBrand(); go('dash'); render();
  });
}
ACT.logout = async () => {
  if (!confirm('確定要登出？下次登入會重新載入最新的示範資料（你在這台電腦做的修改不會保留）。')) return;
  await Store.flush(); try { sessionStorage.removeItem('demoIn'); localStorage.removeItem('ltcTrialPw'); } catch (e) {}
  location.hash = '#/dash'; location.reload();
};

/* --- 調閱紀錄（B2-4、D1） --- */
function logAccess(action, rid) {
  if (Cloud.on) Cloud.audit(action, rid);
  DB.audit.push({ id: uid(), at: nowISO(), user: currentUser(), action, rid: rid || '' });
  if (DB.audit.length > 3000) DB.audit = DB.audit.slice(-3000);
  Store.mark('audit');
}

/* --- 保存年限 --- */
const RETENTION_BASIS = [
  ['照護紀錄（含護理、醫事照護）', '至少 7 年', '長期照顧服務法第 38 條：醫事照護紀錄除依醫事法令外，機構至少保存 7 年；醫療法第 70 條病歷亦為 7 年。老人福利機構評鑑 B2 要求「依規定年限妥善保存」，實務一般比照 7 年。'],
  ['會計憑證', '至少 5 年', '長期照顧服務機構設立許可及管理辦法第 30 條（老人福利機構可比照，並依稅法規定）。'],
  ['會計帳簿、財務報表', '至少 10 年', '同上。'],
  ['照片（活動、傷口、辨識）', '隨所屬紀錄', '屬個人資料，傷口照片隨照護紀錄保存；活動照片作為評鑑佐證至少保存到下次評鑑（臺中市每 4 年一次）；肖像權同意書撤回時應刪除。'],
];
function retentionYears() { return +(DB.settings.retentionYears || 7); }
function retentionUntil(r) { return r.dischargeDate ? addDays(r.dischargeDate, Math.round(retentionYears() * 365.25)) : null; }
function residentRecords(rid) {
  const out = {}; ['assessments', 'daily', 'weights', 'events', 'restraints', 'plans', 'contacts', 'vaccines', 'notes'].forEach(c => out[c] = DB[c].filter(x => x.rid === rid));
  out.residents = DB.residents.filter(r => r.id === rid); out.photos = DB.photos.filter(p => p.owner === 'res:' + rid || out.events.some(e => p.owner === 'event:' + e.id));
  return out;
}
ACT.exportResident = async el => {
  const rid = el.dataset.id, r = resById(rid), recs = residentRecords(rid); recs.__photos = {};
  for (const p of recs.photos) recs.__photos[p.id] = await getPhoto(p.id);
  logAccess('匯出個人完整紀錄', rid);
  const blob = new Blob([JSON.stringify({ __app: 'ltc-resident', __at: nowISO(), data: recs })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `住民紀錄_${r.bed}_${r.name}_${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('已匯出，請存放於加密媒體');
};
ACT.purgeResident = el => {
  const r = resById(el.dataset.id);
  confirmBox(`永久刪除 <b>${esc(r.name)}</b> 的所有紀錄與照片？已超過保存期限（${roc(retentionUntil(r))}）。刪除前建議先匯出封存，此動作無法復原。`, async () => {
    const recs = residentRecords(r.id);
    for (const p of recs.photos) await delPhoto(p.id);
    ['assessments', 'daily', 'weights', 'events', 'restraints', 'plans', 'contacts', 'vaccines', 'notes'].forEach(c => { DB[c] = DB[c].filter(x => x.rid !== r.id); Store.mark(c); });
    DB.residents = DB.residents.filter(x => x.id !== r.id); Store.mark('residents');
    logAccess(`銷毀已屆保存期限紀錄（${r.name}）`, '');
    toast('已刪除');
  }, '永久刪除');
};

/* --- 設定頁的儲存卡片 --- */
function cloudStorageCard() {
  return `<div class="card"><h2 style="margin-top:0">資料存放在哪裡（雲端版）</h2>
    <p class="small">1. <b>Google Firebase 台灣機房（彰化）</b>：所有紀錄與照片在你的裝置先加密再上傳，雲端只存放亂碼；多台裝置即時同步。<br>
    2. <b>每台裝置的本機快取</b>：同樣加密；網路中斷時可照常紀錄，恢復連線後自動上傳。<br>
    3. <b>每週手動下載備份</b>：另設備份密碼，存到機構的實體位置。</p>
    <p>同步狀態：<span id="cloudStatus">${Cloud.badge()}</span></p><div id="storeEst" class="small muted"></div></div>
    <div class="card"><h2 style="margin-top:0">紀錄保存年限</h2><table class="t">${RETENTION_BASIS.map(([a, b, c]) => `<tr><td class="nowrap"><b>${a}</b></td><td class="nowrap">${b}</td><td class="small muted">${c}</td></tr>`).join('')}</table></div>`;
}
function storageCards() {
  const S = DB.settings, closed = DB.residents.filter(r => r.dischargeDate).sort((a, b) => a.dischargeDate.localeCompare(b.dischargeDate));
  const photoKB = DB.photos.reduce((s, p) => s + (p.size || 0), 0) / 1024;
  return `<div class="card"><h2 style="margin-top:0">資料存放在哪裡</h2>
    <p class="small">1. <b>這台電腦的瀏覽器</b>（IndexedDB）：每次輸入立即存檔，不上網。${Store.key ? '已加密。' : '<span style="color:var(--warn)">尚未設密碼加密。</span>'}<br>
    2. <b>自動存檔資料夾</b>（建議）：系統同時把資料寫到你指定的資料夾，例如機構 NAS、加密隨身碟或公司電腦的 D 槽，另保留每日備份。<br>
    3. <b>手動匯出備份檔</b>：每週至少一次，存到另一個實體位置。</p>
    <div id="storeEst" class="small muted">計算使用空間中…</div>
    <h3>自動存檔資料夾</h3>
    ${!Folder.supported() ? '<p class="small" style="color:var(--warn)">這個瀏覽器不支援資料夾存檔，請改用 Chrome 或 Edge 開啟本系統。</p>' :
      Folder.handle ? `<p class="small">已連結資料夾：<b>${esc(Folder.handle.name)}</b>　${Folder.ok ? `<span class="chip ok">自動存檔中</span>${Folder.lastWrite ? `　最後寫入 ${new Date(Folder.lastWrite).toLocaleTimeString()}` : ''}` : '<span class="chip warn">需要重新授權</span>'}${Folder.err ? `<br><span style="color:var(--bad)">錯誤：${esc(Folder.err)}</span>` : ''}</p>
      <div class="row">${Folder.ok ? '<button class="btn sm" data-act="folderNow">立即寫入</button>' : '<button class="btn sm pri" data-act="folderRegrant">恢復自動存檔</button>'}<button class="btn sm" data-act="folderChoose">改選資料夾</button><button class="btn sm" data-act="folderRestore">從資料夾還原</button><button class="btn sm ghost" data-act="folderUnlink">取消連結</button></div>
      <label class="f" style="margin-top:8px">每日備份保留天數<input type="number" id="snapDays" value="${esc(S.snapDays || 60)}" style="max-width:120px"></label>`
      : '<div class="row"><button class="btn pri" data-act="folderChoose">選擇存檔資料夾</button><button class="btn" data-act="folderRestoreNew">從現有資料夾還原到這台電腦</button></div><p class="small muted">資料夾內會產生：長照照護資料.json（最新）、每日備份/、照片/。有設密碼時，檔案內容一併加密。</p>'}
  </div>
  <div class="card"><h2 style="margin-top:0">照片</h2>
    <p class="small">可在<b>異常事件</b>（傷口、跌倒現場）、<b>會議與活動</b>（評鑑要的活動照片）、<b>住民個人頁</b>（辨識照，需先勾選已簽肖像權同意書）加入照片。手機或平板開啟可直接拍照。</p>
    <p class="small">照片會自動縮到長邊 1600 像素、約 150–300 KB 一張。目前 ${DB.photos.length} 張，約 ${photoKB > 1024 ? (photoKB / 1024).toFixed(1) + ' MB' : Math.round(photoKB) + ' KB'}。</p></div>
  <div class="card"><h2 style="margin-top:0">紀錄保存年限</h2>
    <table class="t">${RETENTION_BASIS.map(([a, b, c]) => `<tr><td class="nowrap"><b>${a}</b></td><td class="nowrap">${b}</td><td class="small muted">${c}</td></tr>`).join('')}</table>
    <label class="f" style="margin-top:10px">住民結案後保存年數<input type="number" id="retYears" value="${retentionYears()}" min="7" style="max-width:120px"></label>
    <h3>已結案住民（${closed.length}）</h3>
    ${closed.length ? `<table class="t"><tr><th>住民</th><th>結案</th><th>保存至</th><th></th></tr>${closed.map(r => { const u = retentionUntil(r), exp = u <= today(); return `<tr><td>${esc(resLabel(r))}</td><td>${roc(r.dischargeDate)} ${esc(r.status || '')}</td><td><span class="chip ${exp ? 'warn' : 'ok'}">${roc(u)}${exp ? ' 已屆期' : ''}</span></td><td class="nowrap"><button class="btn sm" data-act="exportResident" data-id="${r.id}">匯出封存</button>${exp ? `<button class="btn sm danger" data-act="purgeResident" data-id="${r.id}">刪除</button>` : ''}</td></tr>`; }).join('')}</table>` : '<p class="small muted">尚無結案住民。系統不會自動刪除任何紀錄，屆期時才會出現刪除按鈕。</p>'}
  </div>
  <div class="card"><h2 style="margin-top:0">資料調閱紀錄（最近 30 筆）</h2><p class="small muted">列印個案資料、匯出備份、匯出個人紀錄都會留下紀錄（B2 調閱紀錄、D1 資料保密）。</p>
    ${DB.audit.length ? `<table class="t">${DB.audit.slice(-30).reverse().map(a => `<tr><td class="nowrap small">${new Date(a.at).toLocaleString()}</td><td class="small">${esc(a.user)}</td><td class="small">${esc(a.action)}${a.rid && resById(a.rid) ? `：${esc(resLabel(resById(a.rid)))}` : ''}</td></tr>`).join('')}</table>` : '<p class="small muted">尚無紀錄</p>'}</div>`;
}
async function fillStorageEstimate() {
  const el = $('#storeEst'); if (!el) return;
  if (!navigator.storage || !navigator.storage.estimate) { el.textContent = '此瀏覽器無法顯示空間資訊'; return; }
  const e = await navigator.storage.estimate(), p = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const mb = x => x > 1024 ** 3 ? (x / 1024 ** 3).toFixed(1) + ' GB' : (x / 1024 ** 2).toFixed(1) + ' MB';
  el.innerHTML = `本機已使用 <b>${mb(e.usage || 0)}</b>，瀏覽器允許上限約 <b>${mb(e.quota || 0)}</b>（約可再放 ${Math.floor(((e.quota || 0) - (e.usage || 0)) / 250000).toLocaleString()} 張照片）。
    ${p ? '<span class="chip ok">已設為永久保存，瀏覽器不會自動清除</span>' : '<span class="chip warn">尚未設為永久保存</span> <button class="btn sm" data-act="persistNow">申請永久保存</button>'}`;
}
ACT.persistNow = async () => { const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; toast(ok ? '已設為永久保存' : '瀏覽器未同意，請將本系統加入書籤或安裝為應用程式後再試', ok ? '' : 'bad'); fillStorageEstimate(); };
ACT.folderChoose = async () => { if (await Folder.choose()) { toast('已連結資料夾，之後每次輸入都會自動存檔'); refresh(); } };
ACT.folderRegrant = async () => { await Folder.regrant(); refresh(); };
ACT.folderNow = async () => { await Folder.writeAll(); toast(Folder.err ? '寫入失敗：' + Folder.err : '已寫入資料夾', Folder.err ? 'bad' : ''); refresh(); };
ACT.folderUnlink = () => confirmBox('取消連結後不再自動存檔到資料夾（資料夾內既有檔案不會刪除）。', async () => { await Folder.unlink(); toast('已取消連結'); });
ACT.folderRestore = async () => { const was = Folder.ok; if (!was) await Folder.regrant(true); Folder.ok = false; await Folder.restore(); if (!$('#modal.on')) Folder.ok = was || !!Folder.handle; };
ACT.folderRestoreNew = async () => { if (await Folder.choose()) { toast('資料夾是空的，已改為把這台電腦的資料存進去'); refresh(); } };
ACT.folderRestoreHere = async () => { closeModal(); Folder.ok = true; await Folder.restore(); };
ACT.folderOverwrite = () => { closeModal(); confirmBox('確定用這台電腦的資料覆蓋資料夾內的「長照照護資料.json」？（每日備份資料夾內的舊檔仍會保留）', async () => { Folder.ok = true; await Folder.writeAll(); toast('已覆蓋並開始自動存檔'); }, '覆蓋'); };
