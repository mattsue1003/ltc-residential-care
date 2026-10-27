/* 介面共用元件：路由、彈窗、表單、提示 */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const ROLES = ['機構主任','護理人員','社工人員','職能治療師','物理治療師','營養師','藥師','照顧服務員','行政人員'];

function toast(msg, cls = '') {
  const d = document.createElement('div'); d.textContent = msg; if (cls) d.className = cls;
  $('#toast').appendChild(d); setTimeout(() => d.remove(), cls === 'bad' ? 5000 : 2600);
}

/* 彈窗：html 內容 + 按鈕；onSave 回傳 false 代表驗證失敗不關閉 */
let modalSave = null, modalDirty = false;
function openModal(title, html, onSave, opts = {}) {
  modalSave = onSave; modalDirty = false;
  $('#modal').innerHTML = `<div class="box" role="dialog" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div id="mbody">${html}</div>
    <div class="foot">${opts.extraBtn || ''}<span class="sp"></span><button class="btn" data-act="closeModal">${onSave ? '取消' : '關閉'}</button>${onSave ? `<button class="btn pri" data-act="modalSave">${opts.saveText || '儲存'}</button>` : ''}</div></div>`;
  $('#modal').classList.add('on');
  enhanceResSelect();
  const first = $('#mbody input:not([type=hidden]):not([type=checkbox]):not([type=radio]), #mbody select, #mbody textarea'); if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
}
function tryCloseModal() { if (modalDirty && modalSave && !confirm('表單有未儲存的內容，確定要關閉嗎？')) return; closeModal(); }
function enhanceResSelect() {
  const sel = $('#mbody select[name=rid]'); if (!sel || sel.options.length < 8 || sel.dataset.enh) return; sel.dataset.enh = 1;
  const inp = document.createElement('input'); inp.placeholder = '輸入床號或姓名快速找住民'; inp.className = 'resfind';
  sel.parentNode.insertBefore(inp, sel);
  const all = [...sel.options].map(o => [o.value, o.text]);
  inp.addEventListener('input', () => { const q = inp.value.trim(); const keep = sel.value; sel.innerHTML = all.filter(([v, t]) => !v || !q || t.includes(q)).map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(''); const hits = all.filter(([v, t]) => v && q && t.includes(q)); sel.value = hits.length === 1 ? hits[0][0] : (all.some(([v]) => v === keep) && [...sel.options].some(o => o.value === keep) ? keep : sel.options[0].value); sel.dispatchEvent(new Event('change', { bubbles: true })); });
}
function closeModal() { modalDirty = false; $('#modal').classList.remove('on'); $('#modal').innerHTML = ''; modalSave = null; if (typeof cleanupOrphans === 'function') cleanupOrphans(); }

/* 表單產生器 */
function field(f, v) {
  const val = v ?? f.def ?? '';
  const cls = 'f' + (f.req ? ' req' : '');
  const lab = `<span>${esc(f.label)}</span>`;
  const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
  if (f.type === 'select') return `<label class="${cls}">${lab}<select name="${f.key}">${f.blank === false ? '' : '<option value="">－請選擇－</option>'}${f.options.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}"${String(ov) === String(val) ? ' selected' : ''}>${esc(ol)}</option>`; }).join('')}</select></label>`;
  if (f.type === 'textarea') return `<label class="${cls}">${lab}<textarea name="${f.key}"${ph}>${esc(val)}</textarea></label>`;
  if (f.type === 'checks') { const arr = Array.isArray(val) ? val : []; return `<div class="f"><span class="small muted">${esc(f.label)}${f.req ? ' <span style="color:var(--bad)">*</span>' : ''}</span><div class="checks" data-checks="${f.key}">${f.options.map(o => `<label><input type="checkbox" value="${esc(o)}"${arr.includes(o) ? ' checked' : ''}> ${esc(o)}</label>`).join('')}</div></div>`; }
  if (f.type === 'bool') return `<div class="checks"><label><input type="checkbox" name="${f.key}"${val ? ' checked' : ''}> ${esc(f.label)}</label></div>`;
  return `<label class="${cls}">${lab}<input name="${f.key}" type="${f.type || 'text'}" value="${esc(val)}"${f.step ? ` step="${f.step}"` : ''}${ph}></label>`;
}
function formHTML(fields, obj = {}, cols = 2) {
  return `<div class="grid g${cols}">${fields.map(f => `<div style="${f.wide ? 'grid-column:1/-1' : ''}">${field(f, obj[f.key])}</div>`).join('')}</div>`;
}
function readForm(fields, root = $('#mbody'), silent) {
  const o = {}; let miss = [];
  fields.forEach(f => {
    if (f.type === 'checks') o[f.key] = $$(`[data-checks="${f.key}"] input:checked`, root).map(i => i.value);
    else if (f.type === 'bool') o[f.key] = !!(root.querySelector(`[name="${f.key}"]`) || {}).checked;
    else { const el = root.querySelector(`[name="${f.key}"]`); o[f.key] = el ? el.value.trim() : ''; if (f.type === 'number' && o[f.key] !== '') o[f.key] = +o[f.key]; }
    if (f.req && (o[f.key] === '' || (Array.isArray(o[f.key]) && !o[f.key].length))) miss.push(f.label);
  });
  if (miss.length) { if (!silent) toast('請填寫：' + miss.join('、'), 'bad'); return silent ? o : null; }
  return o;
}
function confirmBox(msg, fn, btn = '確定') { openModal('請確認', `<p>${msg}</p>`, () => { fn(); }, { saveText: btn, noFocus: true }); }

/* 路由 */
const ROUTES = {};
const NAV = [
  ['工作', [['dash','今日待辦','◉'],['daily','每日照護紀錄','✎'],['notes','照護紀錄','✍'],['assess','評估量表','☑'],['batch','批次登錄','⧉'],['matrix','評估進度總表','▦']]],
  ['住民', [['res','住民名冊','☺'],['events','異常事件登錄','⚠'],['restraint','約束管理','⛓'],['meet','會議與活動','☷']]],
  ['品質與評鑑', [['quality','品質指標','▲'],['accred','評鑑準備','★'],['print','列印中心','⎙']]],
  ['系統', [['settings','設定與備份','⚙'], ['accounts','帳號與資安','🔐']]],
];
let ROUTE = { page: 'dash', args: [] };
function go(h) { if (location.hash === '#/' + h) render(); else location.hash = '#/' + h; }
function parseHash() { const p = (location.hash || '#/dash').slice(2).split('/').map(decodeURIComponent); ROUTE = { page: p[0] || 'dash', args: p.slice(1) }; }
function renderNav() {
  const rem = buildReminders(); const bad = rem.filter(r => r.level === 'bad').length;
  window.__rem = rem;
  $('nav.side').innerHTML = NAV.map(([sec, items]) => `<div class="sec">${sec}</div>` + items.map(([k, l, ic]) =>
    (k === 'accounts' && !(typeof Cloud !== 'undefined' && Cloud.on && Cloud.isAdmin())) ? '' : `<a href="#/${k}" class="${ROUTE.page === k || (k === 'res' && ROUTE.page === 'r') || (k === 'quality' && /^qi/.test(ROUTE.page)) ? 'on' : ''}"><span class="ic">${ic}</span>${l}${k === 'dash' && bad ? `<span class="badge">${bad}</span>` : ''}</a>`).join('')).join('');
}
function render() {
  parseHash(); renderNav();
  const fn = ROUTES[ROUTE.page] || ROUTES.dash;
  $('main').innerHTML = fn(...ROUTE.args) + `<footer class="cr">資料只存在這台電腦的瀏覽器中，不會上傳網路。請定期到「設定與備份」匯出備份。</footer>`;
  window.scrollTo(0, 0);
  if (ROUTES['after_' + ROUTE.page]) ROUTES['after_' + ROUTE.page](...ROUTE.args);
}
function refresh() { const y = window.scrollY; parseHash(); renderNav(); const fn = ROUTES[ROUTE.page] || ROUTES.dash; $('main').innerHTML = fn(...ROUTE.args) + `<footer class="cr">資料只存在這台電腦的瀏覽器中，不會上傳網路。請定期到「設定與備份」匯出備份。</footer>`; if (ROUTES['after_' + ROUTE.page]) ROUTES['after_' + ROUTE.page](...ROUTE.args); window.scrollTo(0, y); }

/* 行為分派 */
const ACT = {
  closeModal: tryCloseModal, modalSave() { if (modalSave && modalSave() !== false) { closeModal(); refresh(); } },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const fn = ACT[a.dataset.act]; if (fn) { e.preventDefault(); fn(a, e); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('on') && !$('#phView')) tryCloseModal(); });
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#mbody')) modalDirty = true; });
document.addEventListener('change', e => { if (e.target.closest && e.target.closest('#mbody')) modalDirty = true; });

/* 共用小元件 */
function lvChip(level, cls) { return `<span class="chip ${cls}">${esc(level)}</span>`; }
function refChip(ref) { ref = mapRef(ref); return ref ? `<span class="chip ref" title="對應評鑑指標">${esc(ref)}</span>` : ''; }
function dueText(due) { const d = diffDays(today(), due); return d < 0 ? `逾期 ${-d} 天` : d === 0 ? '今天到期' : `${d} 天後（${roc(due)}）`; }
function resBadges(r) {
  const la = latestAssess(r.id), b = [];
  if (la.morse && la.morse.score >= 45) b.push('<span class="chip bad">跌倒高風險</span>');
  if (la.braden && la.braden.score <= 12) b.push('<span class="chip bad">壓傷高風險</span>'); else if (la.braden && la.braden.score <= 18) b.push('<span class="chip warn">壓傷風險</span>');
  if (r.tubes && r.tubes.ng) b.push('<span class="chip info">鼻胃管</span>');
  if (r.tubes && r.tubes.foley) b.push('<span class="chip info">導尿管</span>');
  if (r.tubes && r.tubes.trach) b.push('<span class="chip info">氣切</span>');
  if (activeRestraint(r.id)) b.push('<span class="chip warn">約束中</span>');
  if (r.dnr) b.push('<span class="chip pri">DNR</span>');
  if (r.status === '住院中') b.push('<span class="chip bad">住院中</span>');
  if (r.allergy) b.push(`<span class="chip bad">過敏：${esc(r.allergy)}</span>`);
  return b.join(' ');
}
function sparkline(vals, w = 160, h = 36) {
  if (vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * (w - 6) + 3).toFixed(1)},${(h - 4 - (v - mn) / rg * (h - 8)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="var(--pri)" stroke-width="2" points="${pts}"/></svg>`;
}
function copyText(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('已複製，可貼到紀錄中')).catch(() => { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('已複製'); }); }
ACT.copy = el => copyText(el.dataset.text || $(el.dataset.from).innerText);
ACT.go = el => go(el.dataset.to);
