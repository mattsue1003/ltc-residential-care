/* ===== 啟動 ===== */
function updateBrand() {
  $('#orgName').textContent = DB.settings.org || '長照住宿機構照護系統';
  const u = Cloud.on && Cloud.profile ? Cloud.profile : DB.settings.user; $('#userChip').textContent = u ? `${u.name}・${u.role}` : '設定使用者';
  document.title = (DB.settings.org ? DB.settings.org + '｜' : '') + '長照照護紀錄系統';
}
function askUser(first) {
  const F = [{ key: 'name', label: '您的姓名', req: true }, { key: 'role', label: '職類', type: 'select', options: ROLES, req: true }];
  openModal(first ? '歡迎使用｜請先設定使用者' : '切換使用者', `${first ? '<p class="small">每筆紀錄會標記填寫者與時間。所有資料只存在這台電腦，不會上傳。</p>' : ''}${formHTML(F, DB.settings.user || {})}
    ${first ? '<p class="small muted">想先看看系統長什麼樣子？設定好後到「設定與備份」載入示範資料。</p>' : ''}`, () => {
    const o = readForm(F); if (!o) return false; setKV('settings', 'user', o); dashRole = !!ROLE_CATS[o.role]; updateBrand(); toast(`您好，${o.name}`);
  });
}
ACT.switchUser = () => Cloud.on ? go('settings') : askUser(false);

function setupSearch() {
  const inp = $('#q'), drop = $('#qdrop');
  inp.addEventListener('input', () => {
    const v = inp.value.trim(); if (!v) { drop.style.display = 'none'; return; }
    const hits = DB.residents.filter(r => (r.name + r.bed + (r.dx || '')).includes(v)).slice(0, 10);
    const pages = NAV.flatMap(n => n[1]).filter(p => p[1].includes(v));
    drop.innerHTML = hits.map(r => `<a href="#/r/${r.id}">${esc(resLabel(r))} <span class="muted small">${esc(r.dx || '')}${inHouse(r) ? '' : '（結案）'}</span></a>`).join('') + pages.map(p => `<a href="#/${p[0]}">前往：${p[1]}</a>`).join('') || '<a class="muted">找不到</a>';
    drop.style.display = 'block';
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = drop.querySelector('a[href]'); if (a) { location.hash = a.getAttribute('href'); inp.value = ''; drop.style.display = 'none'; } } });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) drop.style.display = 'none'; else if (e.target.closest('#qdrop a')) { inp.value = ''; drop.style.display = 'none'; } });
  document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); inp.focus(); } });
}

async function boot() {
  try { const t = localStorage.getItem('ltc-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  await Store.open();
  if (Cloud.on) return bootCloud();
  const meta = await Store.meta();
  if (meta && meta.enc) {
    document.body.insertAdjacentHTML('beforeend', `<div class="lock" id="lock"><form class="box" id="lockForm"><h2 style="margin-top:0">🔒 系統已上鎖</h2><p class="small muted">請輸入密碼解鎖本機資料。</p>
      <label class="f">密碼<input type="password" id="lockPw" autocomplete="current-password" autofocus></label><button class="btn pri" style="width:100%">解鎖</button><p id="lockMsg" class="small" style="color:var(--bad)"></p></form></div>`);
    await new Promise(res => {
      $('#lockForm').addEventListener('submit', async e => {
        e.preventDefault(); $('#lockMsg').textContent = '解鎖中…';
        if (await Store.unlock($('#lockPw').value)) { $('#lock').remove(); res(); } else { $('#lockMsg').textContent = '密碼錯誤'; $('#lockPw').select(); }
      });
    });
  }
  await Store.loadAll();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await Folder.init(); cleanupOrphans();
  updateBrand(); setupSearch(); applyFontScale(); dashRole = !!ROLE_CATS[myRole()];
  window.addEventListener('hashchange', render);
  window.addEventListener('beforeunload', () => { if (Store.dirty.size) Store.flush(); });
  if (!location.hash || location.hash === '#/' || location.hash === '#/dash') { const role = myRole(); if (role === '照顧服務員') location.hash = '#/daily'; else if (role === '社工人員') location.hash = '#/notes'; }
  render();
  const force = /[?&]trial\b/.test(location.search); if (force) history.replaceState(null, '', location.pathname + location.hash);
  if (!(await trialCheckUpdate(force)) && !DB.settings.user) askUser(true);
  // 自動逾時鎖定（有密碼時，閒置 15 分鐘）
  let idle; const reset = () => { clearTimeout(idle); if (Store.key) idle = setTimeout(async () => { if (modalDirty) { reset(); return; } await Store.flush(); location.reload(); }, 15 * 60 * 1000); };
  ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, reset)); reset();
}
async function bootCloud() {
  $('header.top').insertAdjacentHTML('beforeend', '<span id="cloudStatus"></span>');
  await Cloud.boot();
  await Store.loadAll();
  if (Cloud.created) { DB.settings.org = Cloud.created.org; }
  Cloud.snapshotKnown();
  if (Cloud.created) { Cloud.known.clear(); }
  try { JSON.parse((await Store.rawGet('__pending')) || '[]').forEach(k => Cloud.pending.add(k)); } catch (e) {}
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  cleanupOrphans(); updateBrand(); setupSearch(); applyFontScale(); dashRole = !!ROLE_CATS[myRole()];
  window.addEventListener('hashchange', render);
  window.addEventListener('beforeunload', e => { if (Store.dirty.size) Store.flush(); if (Cloud.pending.size) { e.preventDefault(); e.returnValue = ''; } });
  render(); Cloud.setStatus();
  if (Cloud.created) Store.mark('settings'), COLLECTIONS.forEach(c => Store.mark(c));
  await Cloud.startPull(); Cloud.pushPending();
  let idle; const reset = () => { clearTimeout(idle); idle = setTimeout(async () => { await Store.flush(); Cloud.lockOut(); }, 15 * 60 * 1000); };
  ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, reset)); reset();
  document.addEventListener('focusout', () => { if (Cloud._needRefresh && !$('#modal.on')) { Cloud._needRefresh = false; setTimeout(refresh, 50); } });
}
boot();
