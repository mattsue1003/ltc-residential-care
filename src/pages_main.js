/* ===== 今日待辦 ===== */
let dashCat = '全部', dashRole = false;
const ROLE_CATS = {
  '護理人員': ['評估','照顧計畫','約束','體重','每日','異常','事件','疫苗','訪視聯繫'],
  '社工人員': ['評估','照顧計畫','訪視聯繫','權益','事件'],
  '營養師': ['評估','體重'], '職能治療師': ['評估','照顧計畫','每日'], '物理治療師': ['評估','照顧計畫','每日'],
  '藥師': ['訪視聯繫'], '照顧服務員': ['每日','體重'],
};
const ROLE_SCALES = { '社工人員': ['social','gds'], '營養師': ['mna'], '職能治療師': ['barthel','spmsq'], '物理治療師': ['barthel','morse'], '護理人員': ['barthel','morse','braden','pain','mna','spmsq'] };
const ROLE_CONTACTS = { '社工人員': ['家屬電訪／會談'], '藥師': ['藥師評估'], '護理人員': ['醫師巡診','年度健康檢查'] };
function roleFilter(r) {
  const role = DB.settings.user && DB.settings.user.role; if (!dashRole || !role || role === '機構主任' || role === '行政人員') return true;
  const cats = ROLE_CATS[role] || []; if (!cats.includes(r.cat)) return false;
  if (r.cat === '評估' && ROLE_SCALES[role]) return ROLE_SCALES[role].some(s => r.act.split(':')[2].split(',').includes(s));
  if (r.cat === '訪視聯繫' && ROLE_CONTACTS[role]) return ROLE_CONTACTS[role].some(k => r.act.endsWith(':' + k));
  return true;
}
ROUTES.dash = () => {
  const rem = window.__rem || buildReminders();
  const res = activeResidents().filter(inHouse);
  const T = today();
  const cats = ['全部', ...new Set(rem.map(r => r.cat))];
  const shown = rem.filter(r => (dashCat === '全部' || r.cat === dashCat) && roleFilter(r) && (!dashBadOnly || r.level === 'bad'));
  const bad = rem.filter(r => r.level === 'bad').length;
  const monthEv = DB.events.filter(e => e.date.startsWith(T.slice(0, 7))).length;
  const restr = DB.restraints.filter(x => !x.endDate).length;
  const abnormal = DB.daily.filter(d => d.date === T && vitalFlags(d).length);
  const newAdm = res.filter(r => diffDays(r.admitDate, T) <= 7);
  const hosp = res.filter(r => r.status === '住院中');
  const recentEv = DB.events.filter(e => diffDays(e.date, T) <= 1);
  const hoNotes = DB.notes.filter(n => n.handover && diffDays(n.date, T) <= 1);
  const backup = DB.settings.lastBackup;
  const u = DB.settings.user;
  return `
  ${DB.settings.trial ? `<div class="banner info">這是<b>去識別化試用資料</b>，只存在這台裝置。可以放心新增、修改來模擬操作；要重來可到「設定與備份」重新載入。</div>` : ''}
  ${!DB.residents.length ? `<div class="banner info" style="font-size:16px">目前沒有任何資料。<button class="btn pri" data-act="openTrial">載入試用資料（需密碼）</button><span>或到<a href="#/settings">設定與備份</a>載入示範資料、直接<a href="#/res">新增住民</a>。</span></div>` : ''}
  ${Folder.handle && !Folder.ok ? `<div class="banner warn">自動存檔資料夾「${esc(Folder.handle.name)}」需要重新授權才能繼續寫入。<button class="btn sm pri" data-act="folderRegrant">恢復自動存檔</button></div>` : ''}
  ${DB.residents.length && !Folder.ok && (!backup || diffDays(backup.slice(0, 10), T) > 7) ? `<div class="banner warn">已超過 7 天沒有備份，資料只存在這台電腦。建議到「設定與備份」連結自動存檔資料夾，或每週匯出一次。<button class="btn sm" data-act="exportData">立即備份</button></div>` : ''}
  <div class="hd"><div><h1>今日待辦</h1><p class="sub">${roc(T)}　${u ? esc(u.name) + '，' : ''}系統依評鑑指標自動計算到期與逾期項目，點「處理」直接開啟對應表單。<br><span class="small">評鑑依據：${esc(accredName())}｜${esc(DB.settings.facType || '養護型（老人福利機構）')}</span></p></div></div>
  <div class="grid g4">
    <button class="kpi" data-act="go" data-to="res"><div class="n">${res.length}</div><div class="l">在住人數${DB.settings.beds ? `／床數 ${DB.settings.beds}` : ''} ›</div></button>
    <button class="kpi ${bad ? 'bad' : 'ok'}" data-act="dashBad"><div class="n">${bad}</div><div class="l">逾期／需立即處理 ›</div></button>
    <button class="kpi ${restr ? 'warn' : ''}" data-act="go" data-to="restraint"><div class="n">${restr}</div><div class="l">約束中 ›</div></button>
    <button class="kpi" data-act="go" data-to="events"><div class="n">${monthEv}</div><div class="l">本月異常事件 ›</div></button>
  </div>
  <div class="grid g2" style="margin-top:16px;align-items:start">
    <div class="card" style="padding:0">
      <div style="padding:14px 16px 0"><div class="row"><h2 style="margin:0">待辦清單 <span class="muted small">${shown.length} 項${dashBadOnly ? '（只看逾期，再點一次逾期方塊可取消）' : ''}</span></h2><span class="sp"></span>
        ${u && ROLE_CATS[u.role] ? `<label class="small row" style="gap:4px"><input type="checkbox" data-act="toggleRole" ${dashRole ? 'checked' : ''}> 只看${esc(u.role.replace('人員', ''))}的工作</label>` : ''}</div>
      <div class="chips" style="margin-top:10px">${cats.map(c => `<button class="chip ${c === dashCat ? 'on' : ''}" data-act="dashCat" data-c="${esc(c)}">${esc(c)} ${c === '全部' ? rem.length : rem.filter(r => r.cat === c).length}</button>`).join('')}</div></div>
      <div style="max-height:620px;overflow:auto">${shown.length ? shown.slice(0, 300).map(remRow).join('') : '<div class="empty">沒有待辦事項，做得好！</div>'}</div>
    </div>
    <div>
      <div class="card"><div class="row"><h2 style="margin:0">交班摘要</h2><span class="sp"></span><button class="btn sm" data-act="printHandover">列印交班單</button></div>
        <h3>今日生命徵象異常（${abnormal.length}）</h3>${abnormal.length ? abnormal.map(d => `<div class="small">● <a href="#/r/${d.rid}">${esc(resLabel(resById(d.rid)))}</a>：${vitalFlags(d).join('、')}</div>`).join('') : '<div class="small muted">無</div>'}
        <h3>交班紀錄（${hoNotes.length}）</h3>${hoNotes.length ? hoNotes.map(n => `<div class="small">● <a href="#/r/${n.rid}">${esc(resLabel(resById(n.rid)))}</a>：${esc(noteText(n).replace(/\n/g, ' ').slice(0, 70))} <span class="muted">${esc(n.disc || '')}</span></div>`).join('') : '<div class="small muted">無</div>'}
        <h3>24 小時內事件（${recentEv.length}）</h3>${recentEv.length ? recentEv.map(e => `<div class="small">● ${esc(resLabel(resById(e.rid)))}：${esc(e.type)}　${esc((e.desc || '').slice(0, 40))}</div>`).join('') : '<div class="small muted">無</div>'}
        <h3>住院中（${hosp.length}）・新入住 7 天內（${newAdm.length}）・約束中（${restr}）</h3>
        <div class="small">${[...hosp.map(r => `<span class="chip bad">${esc(resLabel(r))}</span>`), ...newAdm.map(r => `<span class="chip pri">${esc(resLabel(r))} 第 ${diffDays(r.admitDate, T) + 1} 天</span>`)].join(' ') || '<span class="muted">無</span>'}</div>
      </div>
      <div class="card"><h2 style="margin-top:0">機構例行工作</h2>${facilityStatusTable()}</div>
    </div>
  </div>`;
};
function remRow(r) {
  const res = r.rid ? resById(r.rid) : null;
  return `<div class="rem"><span class="dot ${r.level}"></span><span class="who">${res ? `<a href="#/r/${res.id}">${esc(resLabel(res))}</a>` : '<span class="muted">全機構</span>'}</span>
    <span class="what">${esc(r.title)} ${refChip(r.ref)}<div class="due ${r.level === 'bad' ? 'bad' : ''}">${dueText(r.due)}</div></span>
    <button class="btn sm pri" data-act="doRem" data-a="${esc(r.act)}">處理</button></div>`;
}
function facilityStatusTable() {
  const T = today();
  return `<table class="t"><tr><th>項目</th><th>上次</th><th>下次</th><th></th></tr>${facilityTasks().map(t => {
    const last = DB.meetings.filter(m => m.kind === t.kind).sort((a, b) => b.date.localeCompare(a.date))[0];
    const due = last ? addDays(last.date, t.every) : null; const d = due ? diffDays(T, due) : -1;
    return `<tr><td>${esc(t.kind)} ${refChip(t.ref)}</td><td class="nowrap">${last ? roc(last.date) : '<span class="muted">無</span>'}</td><td class="nowrap"><span class="chip ${d < 0 ? 'bad' : d <= 14 ? 'warn' : 'ok'}">${due ? roc(due) : '待辦'}</span></td><td><button class="btn sm" data-act="newMeeting" data-k="${esc(t.kind)}">記錄</button></td></tr>`;
  }).join('')}</table>`;
}
let dashBadOnly = false;
ACT.dashBad = () => { dashBadOnly = !dashBadOnly; dashCat = '全部'; refresh(); const c = $('.rem'); if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
ACT.dashCat = el => { dashCat = el.dataset.c; refresh(); };
ACT.toggleRole = () => { dashRole = !dashRole; refresh(); };
ACT.doRem = el => doAct(el.dataset.a);
function doAct(a) {
  const [k, x, y] = a.split(':');
  if (k === 'assess') { const l = y.split(','); window.__chain = l.length > 1 ? { rid: x, list: l.slice(1) } : null; window.__batch = null; assessState = null; go(`assess/${x}/${l[0]}`); }
  else if (k === 'plan') go(`r/${x}/plan`);
  else if (k === 'contact') openContact(null, x, y);
  else if (k === 'restraint') { go('restraint'); setTimeout(() => openRestraintCheck(x), 50); }
  else if (k === 'weight') openWeight(x);
  else if (k === 'event') openEvent(null, x, y);
  else if (k === 'eventedit') openEvent(x);
  else if (k === 'daily') go('daily');
  else if (k === 'resident') go(`r/${x}`);
  else if (k === 'vaccine') openVaccine(null, x);
  else if (k === 'meeting') openMeeting(null, x);
  else if (k === 'quality') go(`quality/${x}`);
  else if (k === 'go') go(x);
}

/* ===== 住民名冊 ===== */
let resFilter = '在住';
ROUTES.res = () => {
  const rem = window.__rem || [];
  let list = DB.residents.slice().sort((a, b) => (a.bed || '').localeCompare(b.bed || '', 'zh-Hant', { numeric: true }));
  if (resFilter === '在住') list = list.filter(inHouse); else if (resFilter === '已結案') list = list.filter(r => !inHouse(r));
  return `<div class="hd"><div><h1>住民名冊</h1><p class="sub">點選住民查看完整資料、評估、照顧計畫與紀錄。</p></div><span class="sp"></span><button class="btn pri" data-act="newRes">＋ 新增住民（入住）</button></div>
  <div class="chips">${['在住','已結案','全部'].map(f => `<button class="chip ${f === resFilter ? 'on' : ''}" data-act="resFilter" data-f="${f}">${f}</button>`).join('')}</div>
  <div class="card" style="padding:0"><div class="tw"><table class="t"><tr><th>床號</th><th>姓名</th><th>性別／年齡</th><th>入住日</th><th>ADL</th><th>風險與照護重點</th><th>待辦</th></tr>
  ${list.map(r => { const la = latestAssess(r.id); const n = rem.filter(x => x.rid === r.id); const nb = n.filter(x => x.level === 'bad').length;
    return `<tr class="click" data-act="go" data-to="r/${r.id}"><td class="nowrap"><b>${esc(r.bed)}</b></td><td class="nowrap">${esc(r.name)}${!inHouse(r) ? ` <span class="chip">${esc(r.status)}</span>` : ''}</td><td class="nowrap">${esc(r.gender || '')} ${age(r.birth)}</td><td class="nowrap">${roc(r.admitDate)}</td>
    <td>${la.barthel ? `${la.barthel.score}` : '<span class="muted">－</span>'}</td><td><div class="pill-badges">${resBadges(r)}</div></td>
    <td class="nowrap">${nb ? `<span class="chip bad">逾期 ${nb}</span>` : ''} ${n.length - nb ? `<span class="chip warn">${n.length - nb}</span>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">尚無住民</td></tr>'}
  </table></div></div>`;
};
ACT.resFilter = el => { resFilter = el.dataset.f; refresh(); };

const RES_FIELDS = [
  { key: 'name', label: '姓名', req: true }, { key: 'bed', label: '床號', req: true, ph: '例：101-1' },
  { key: 'gender', label: '性別', type: 'select', options: ['男', '女'] }, { key: 'birth', label: '出生日期', type: 'date' },
  { key: 'admitDate', label: '入住日期', type: 'date', req: true, def: today() }, { key: 'idLast4', label: '身分證末 4 碼（辨識用，可留空）' },
  { key: 'funding', label: '身分別', type: 'select', options: ['自費','公費安置','低收入戶','中低收入戶','榮民'] },
  { key: 'religion', label: '宗教信仰' },
  { key: 'dx', label: '主要診斷', wide: true }, { key: 'allergy', label: '過敏史（藥物、食物）' },
  { key: 'diet', label: '飲食質地', type: 'select', options: ['一般','軟質','細碎','半流質','流質','管灌'] },
  { key: 'mobility', label: '活動能力', type: 'select', options: ['可獨立行走','輔具行走','輪椅','臥床可移動','臥床不宜移動'] },
  { key: 'consciousness', label: '意識', type: 'select', options: ['清醒','嗜睡／混亂','意識不清'] },
  { key: 'contactName', label: '主要聯絡人' }, { key: 'contactRel', label: '關係' }, { key: 'contactPhone', label: '聯絡電話' },
  { key: 'doctor', label: '特約／主治醫師' },
  { key: 'tube_ng', label: '留置鼻胃管', type: 'bool' }, { key: 'tube_foley', label: '留置導尿管', type: 'bool' }, { key: 'tube_trach', label: '氣切', type: 'bool' },
  { key: 'incontinence', label: '有失禁之虞（需定時如廁）', type: 'bool' },
  { key: 'dnr', label: '已簽署 DNR', type: 'bool' }, { key: 'acp', label: '已完成預立醫療決定 (AD)', type: 'bool' },
  { key: 'noFamily', label: '無家屬（不需家屬電訪）', type: 'bool' }, { key: 'noGuardian', label: '無扶養義務人或法定代理人（長照法 §46）', type: 'bool' },
  { key: 'd10Notified', label: '已通知地方主管機關（§46）', type: 'bool' },
  { key: 'portraitConsent', label: '已簽肖像權使用同意書（才可存住民照片）', type: 'bool' },
  { key: 'note', label: '備註', type: 'textarea', wide: true },
];
function openRes(id) {
  const r = id ? resById(id) : {};
  const obj = Object.assign({}, r, r.tubes ? { tube_ng: r.tubes.ng, tube_foley: r.tubes.foley, tube_trach: r.tubes.trach } : {});
  openModal(id ? `編輯住民資料：${r.name}` : '新增住民（入住）', formHTML(RES_FIELDS, obj) + (id ? '' : '<p class="small muted">儲存後系統會自動排入「入住 72 小時評估」「照顧計畫」「1 個月內醫師診察」等待辦。</p>'), () => {
    const o = readForm(RES_FIELDS); if (!o) return false;
    if (DB.residents.some(x => x.id !== id && inHouse(x) && x.bed === o.bed)) { toast(`床號 ${o.bed} 已有在住住民`, 'bad'); return false; }
    o.tubes = { ng: o.tube_ng, foley: o.tube_foley, trach: o.tube_trach }; delete o.tube_ng; delete o.tube_foley; delete o.tube_trach;
    const saved = save('residents', Object.assign(r, o, { status: r.status || '在住' }));
    toast(id ? '已更新住民資料' : `已新增 ${saved.name}，入住評估已排入待辦`);
    if (!id) setTimeout(() => go(`r/${saved.id}`), 10);
  });
}
ACT.newRes = () => openRes();
ACT.editRes = el => openRes(el.dataset.id);
ACT.dischargeRes = el => {
  const r = resById(el.dataset.id);
  const F = [{ key: 'status', label: '結案類別', type: 'select', options: ['退住','往生','轉介其他機構'], req: true }, { key: 'dischargeDate', label: '結案日期', type: 'date', req: true, def: today() }, { key: 'dischargeNote', label: '說明（物品點收、去向）', type: 'textarea', wide: true }];
  openModal(`結案：${r.name}`, formHTML(F, {}), () => { const o = readForm(F); if (!o) return false; if (o.status === '轉介其他機構') o.status = '退住'; Object.assign(r, o); save('residents', r); toast('已結案'); });
};
ACT.hospRes = el => { const r = resById(el.dataset.id); r.status = r.status === '住院中' ? '在住' : '住院中'; save('residents', r); toast(r.status === '住院中' ? '已標記住院中，記得登錄非計畫性住院事件' : '已標記返回機構'); if (r.status === '住院中') openEvent(null, r.id, '非計畫性住院'); else refresh(); };

/* ===== 住民個人頁 ===== */
ROUTES.after_r = () => hydratePhotos();
ROUTES.r = (id, tab = 'ov') => {
  const r = resById(id); if (!r) return '<div class="empty">找不到這位住民</div>';
  const tabs = [['ov','總覽'],['nt','照護紀錄'],['as','評估紀錄'],['plan','照顧計畫'],['daily','每日紀錄'],['wt','體重'],['ev','事件'],['rs','約束'],['ct','訪視聯繫'],['vc','疫苗']];
  const body = { ov: resOverview, nt: r => `<div class="row" style="margin-bottom:10px"><button class="btn pri" data-act="newNoteFor" data-id="${r.id}">＋ 新增照護紀錄</button><button class="btn" data-act="printNotes" data-id="${r.id}">列印本月照護紀錄</button></div>` + noteListHTML(DB.notes.filter(n => n.rid === r.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 100), false), as: resAssess, plan: resPlan, daily: resDaily, wt: resWeight, ev: resEvents, rs: resRestraints, ct: resContacts, vc: resVaccines }[tab](r);
  return `<div class="hd"><div><h1>${esc(r.bed)}　${esc(r.name)} <span class="muted" style="font-size:15px;font-weight:400">${esc(r.gender || '')} ${age(r.birth)} 歲・入住第 ${diffDays(r.admitDate, r.dischargeDate || today()) + 1} 天</span></h1>
    <div class="pill-badges">${resBadges(r)}</div></div><span class="sp"></span>
    <div class="row"><button class="btn" data-act="editRes" data-id="${r.id}">編輯資料</button>${inHouse(r) ? `<button class="btn" data-act="hospRes" data-id="${r.id}">${r.status === '住院中' ? '返回機構' : '標記住院'}</button><button class="btn" data-act="dischargeRes" data-id="${r.id}">結案</button>` : ''}<button class="btn" data-act="printResPack" data-id="${r.id}">列印評估總表</button></div></div>
  <div class="tabs">${tabs.map(([k, l]) => `<a href="#/r/${r.id}/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>${body}`;
};
function scaleCard(r, t, a) {
  const sc = SCALES[t];
  if (!a) return `<div class="scorecard none"><div class="small"><b>${sc.short}</b> ${esc(sc.domain)}</div><div class="s muted">未評估</div><button class="btn sm pri" data-act="go" data-to="assess/${r.id}/${t}">開始評估</button></div>`;
  const due = addDays(a.date, scaleCycle(t)), d = diffDays(today(), due);
  const hist = DB.assessments.filter(x => x.rid === r.id && x.type === t && x.score != null).sort((x, y) => x.date.localeCompare(y.date)).map(x => x.score);
  return `<div class="scorecard ${a.cls}"><div class="row small"><b>${sc.short}</b><span class="muted">${esc(sc.domain)}</span><span class="sp"></span>${sparkline(hist, 70, 22)}</div>
    <div class="s">${a.score != null ? a.score + `<span class="small muted">${sc.errorBased ? ' 錯' : '/' + sc.max}</span>` : ''}</div><div class="lv">${lvChip(a.level, a.cls)}</div>
    <div class="meta">${roc(a.date)}・下次 <span style="color:${d < 0 ? 'var(--bad)' : d <= 14 ? 'var(--warn)' : 'inherit'}">${roc(due)}</span></div>
    <button class="btn sm" data-act="go" data-to="assess/${r.id}/${t}" style="margin-top:6px">再評估</button></div>`;
}
function resOverview(r) {
  const la = latestAssess(r.id); const rem = (window.__rem || []).filter(x => x.rid === r.id);
  const p = latestPlan(r.id); const ws = weightsOf(r.id); const lw = ws[ws.length - 1];
  const info = [['主要診斷', r.dx], ['過敏', r.allergy], ['飲食', r.diet], ['活動', r.mobility], ['意識', r.consciousness], ['身分別', r.funding], ['宗教', r.religion], ['聯絡人', [r.contactName, r.contactRel, r.contactPhone].filter(Boolean).join('／')], ['醫師', r.doctor], ['入住日', roc(r.admitDate)], ['體重', lw ? `${lw.kg} kg（${roc(lw.date)}）` : ''], ['備註', r.note]];
  return `<div class="grid g4">${CORE_SCALES.map(t => scaleCard(r, t, la[t])).join('')}</div>
  <div class="grid g2" style="margin-top:16px;align-items:start">
    <div class="card"><h2 style="margin-top:0">待辦（${rem.length}）</h2>${rem.length ? rem.map(remRow).join('') : '<div class="empty">無待辦</div>'}</div>
    <div class="card"><h2 style="margin-top:0">基本資料</h2><table class="t">${info.filter(x => x[1]).map(([k, v]) => `<tr><td class="muted nowrap">${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      <h3>照顧計畫</h3>${p ? `<div class="small">最近版本 ${roc(p.date)}，${(p.problems || []).length} 個問題${p.familyDate ? `，家屬共同討論 ${roc(p.familyDate)}` : '，<span style="color:var(--bad)">尚未與家屬討論</span>'}</div>` : '<div class="small" style="color:var(--bad)">尚未擬定</div>'}
      <h3>照片</h3>${r.portraitConsent ? photoStrip('res:' + r.id, { hint: '辨識照、輔具或擺位照片。' }) : '<div class="small muted">尚未勾選「已簽肖像權使用同意書」，暫不能存放住民照片（D1）。</div>'}
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="go" data-to="r/${r.id}/plan">開啟照顧計畫</button><button class="btn sm" data-act="newContactFor" data-id="${r.id}">＋ 訪視聯繫</button><button class="btn sm" data-act="newWeightFor" data-id="${r.id}">＋ 體重</button><button class="btn sm" data-act="newEventFor" data-id="${r.id}">＋ 事件</button></div>
    </div></div>`;
}
function resAssess(r) {
  const list = DB.assessments.filter(a => a.rid === r.id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="row" style="margin-bottom:10px">${Object.keys(SCALES).map(t => `<button class="btn sm" data-act="go" data-to="assess/${r.id}/${t}">＋ ${SCALES[t].short}</button>`).join('')}</div>
  <div class="card" style="padding:0"><div class="tw"><table class="t"><tr><th>日期</th><th>量表</th><th>分數</th><th>判讀</th><th>評估者</th><th></th></tr>
  ${list.map(a => `<tr><td class="nowrap">${roc(a.date)}</td><td>${esc(SCALES[a.type].name)}</td><td>${a.score ?? '－'}</td><td>${lvChip(a.level, a.cls)}</td><td class="small">${esc(a.by)}</td>
    <td class="nowrap"><button class="btn sm" data-act="viewAssess" data-id="${a.id}">檢視</button><button class="btn sm" data-act="printAssess" data-id="${a.id}">列印</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">尚無評估</td></tr>'}</table></div></div>`;
}
ACT.viewAssess = el => {
  const a = DB.assessments.find(x => x.id === el.dataset.id), r = resById(a.rid), sc = SCALES[a.type];
  const n = narrative(a.type, a, r);
  openModal(`${sc.name}｜${roc(a.date)}`, `<div class="narr" id="narrV">${esc(n)}</div><div class="row" style="margin:8px 0"><button class="btn sm" data-act="copy" data-from="#narrV">複製敘述</button></div>
   ${sc.form ? `<table class="t">${sc.fields.map(f => `<tr><td class="muted">${esc(f.label)}</td><td>${esc((a.extra || {})[f.key] || '')}</td></tr>`).join('')}</table>` :
   `<table class="t">${sc.items.map((it, i) => { const o = it[1].find(o => o[0] === +a.answers[i]); return `<tr><td>${esc(it[0])}</td><td>${o ? esc(o[1]) : ''}</td><td class="right">${a.answers[i] ?? ''}</td></tr>`; }).join('')}</table>`}
   ${a.note ? `<p><b>備註：</b>${esc(a.note)}</p>` : ''}<p class="small muted">評估者：${esc(a.by)}</p>`, null,
   { extraBtn: `<button class="btn danger" data-act="delAssess" data-id="${a.id}">刪除</button>` });
};
ACT.delAssess = el => confirmBox('確定刪除這筆評估？', () => { remove('assessments', el.dataset.id); toast('已刪除'); });

/* 照顧計畫 */
let planDraft = null;
function resPlan(r) {
  const plans = DB.plans.filter(p => p.rid === r.id).sort((a, b) => b.date.localeCompare(a.date));
  if (!planDraft || planDraft.rid !== r.id) planDraft = plans[0] ? JSON.parse(JSON.stringify(plans[0])) : { rid: r.id, date: today(), problems: [], participants: '', familyDate: '', familyName: '' };
  const sug = suggestProblems(r, latestAssess(r.id)).filter(s => !planDraft.problems.some(p => p.key === s.key));
  return `<div class="grid g2" style="align-items:start">
  <div>
    <div class="card"><div class="row"><h2 style="margin:0">個別化照顧計畫</h2><span class="sp"></span><span class="small muted">${plans.length} 個版本</span></div>
      <div class="grid g3" style="margin-top:10px">
        <label class="f">擬定日期<input type="date" id="pdDate" value="${esc(planDraft.date)}"></label>
        <label class="f">與家屬共同討論日期<input type="date" id="pdFam" value="${esc(planDraft.familyDate || '')}"></label>
        <label class="f">參與家屬／本人<input id="pdFamName" value="${esc(planDraft.familyName || '')}" placeholder="例：長子 王先生"></label></div>
      <label class="f">參與專業人員（B4 至少 3 種職類）<input id="pdPart" value="${esc(planDraft.participants || '')}" placeholder="護理師 林、社工 陳、職能治療師 鍾、營養師 黃"></label>
    </div>
    ${planDraft.problems.map((p, i) => `<div class="card" data-pi="${i}">
      <div class="row"><b>#${i + 1}</b><input data-pk="disc" value="${esc(p.disc)}" style="width:130px;padding:5px 8px;border:1px solid var(--line);border-radius:6px" placeholder="負責職類">${refChip(p.ref)}<span class="sp"></span><button class="btn sm ghost" data-act="delProb" data-i="${i}" title="刪除">✕</button></div>
      <label class="f">照顧問題<input data-pk="problem" value="${esc(p.problem)}"></label>
      <label class="f">照顧目標<input data-pk="goal" value="${esc(p.goal)}"></label>
      <label class="f">照顧措施<textarea data-pk="interventions">${esc(p.interventions)}</textarea></label>
      <div class="grid g2"><label class="f">預定評值日<input type="date" data-pk="evalDate" value="${esc(p.evalDate || '')}"></label>
      <label class="f">評值結果<select data-pk="result">${['','持續','已達成','部分達成','未達成，修正措施','問題解除'].map(o => `<option${o === (p.result || '') ? ' selected' : ''}>${o}</option>`).join('')}</select></label></div>
    </div>`).join('') || '<div class="card empty">尚未加入照顧問題。可從右側「依評估建議」一鍵加入。</div>'}
    <div class="row"><button class="btn pri" data-act="savePlan" data-id="${r.id}">儲存為新版本</button><button class="btn" data-act="printPlan" data-id="${r.id}">列印照顧計畫</button><button class="btn" data-act="resetPlan">放棄修改</button></div>
  </div>
  <div>
    <div class="card"><h2 style="margin-top:0">依評估結果建議（${sug.length}）</h2>${sug.length ? sug.map(s => `<div class="sugg"><div class="row"><b>${esc(s.problem)}</b><span class="sp"></span>${refChip(s.ref)}</div><div class="small">${esc(s.disc)}｜目標：${esc(s.goal)}</div><div class="small muted">${esc(s.interventions)}</div><button class="btn sm pri" data-act="addSug" data-k="${s.key}" data-id="${r.id}" style="margin-top:6px">＋ 加入計畫</button></div>`).join('') + `<button class="btn sm" data-act="addAllSug" data-id="${r.id}">全部加入</button>` : '<div class="small muted">目前評估結果的建議都已加入，或尚未完成評估。</div>'}</div>
    <div class="card"><h2 style="margin-top:0">護理診斷／問題範本</h2><select id="libSel" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px">${PROBLEM_LIBRARY.map((p, i) => `<option value="${i}">【${p[0]}】${p[1]}</option>`).join('')}</select><button class="btn sm" data-act="addLib" style="margin-top:8px">＋ 加入</button> <button class="btn sm" data-act="addBlank">＋ 空白問題</button></div>
    ${plans.length > 1 ? `<div class="card"><h3 style="margin-top:0">歷史版本</h3>${plans.map(p => `<div class="small">● ${roc(p.date)}　${(p.problems || []).length} 個問題　${esc(p.by || '')}</div>`).join('')}</div>` : ''}
  </div></div>`;
}
function syncPlanDraft() {
  if (!planDraft) return;
  const d = $('#pdDate'); if (!d) return;
  planDraft.date = d.value; planDraft.familyDate = $('#pdFam').value; planDraft.familyName = $('#pdFamName').value; planDraft.participants = $('#pdPart').value;
  $$('[data-pi]').forEach(c => { const p = planDraft.problems[+c.dataset.pi]; $$('[data-pk]', c).forEach(i => p[i.dataset.pk] = i.value); });
}
function addProblem(p) { syncPlanDraft(); planDraft.problems.push(Object.assign({ evalDate: addDays(today(), 90), result: '' }, p)); refresh(); }
ACT.addSug = el => { const r = resById(el.dataset.id); const s = suggestProblems(r, latestAssess(r.id)).find(x => x.key === el.dataset.k); addProblem(s); toast('已加入，記得按「儲存為新版本」'); };
ACT.addAllSug = el => { const r = resById(el.dataset.id); syncPlanDraft(); suggestProblems(r, latestAssess(r.id)).filter(s => !planDraft.problems.some(p => p.key === s.key)).forEach(s => planDraft.problems.push(Object.assign({ evalDate: addDays(today(), 90), result: '' }, s))); refresh(); toast('已全部加入，記得儲存'); };
ACT.addLib = () => { const p = PROBLEM_LIBRARY[+$('#libSel').value]; addProblem({ key: 'lib' + uid(), disc: p[0], problem: p[1], goal: p[2], interventions: p[3] }); };
ACT.addBlank = () => addProblem({ key: 'b' + uid(), disc: '', problem: '', goal: '', interventions: '' });
ACT.delProb = el => { syncPlanDraft(); planDraft.problems.splice(+el.dataset.i, 1); refresh(); };
ACT.resetPlan = () => { planDraft = null; refresh(); toast('已還原為最近儲存的版本'); };
ACT.savePlan = el => {
  syncPlanDraft();
  if (!planDraft.problems.length) { toast('照顧計畫至少要有一個問題', 'bad'); return; }
  if (planDraft.problems.some(p => !p.problem.trim())) { toast('有照顧問題尚未填寫名稱', 'bad'); return; }
  const o = JSON.parse(JSON.stringify(planDraft)); delete o.id; delete o.created; delete o.updated; o.by = currentUser();
  save('plans', o); planDraft = null; toast('照顧計畫已儲存為新版本'); refresh();
};

function resDaily(r) {
  const list = DB.daily.filter(d => d.rid === r.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
  return `<p class="sub">每日紀錄請到<a href="#/daily">每日照護紀錄</a>以全區表格快速輸入。以下為近 60 天。</p>
  <div class="card" style="padding:0"><div class="tw"><table class="t"><tr><th>日期</th><th>體溫</th><th>血壓</th><th>脈搏</th><th>呼吸</th><th>血氧</th><th>疼痛</th><th>血糖</th><th>下床</th><th>洗澡</th><th>口腔</th><th>排便</th><th>備註</th></tr>
  ${list.map(d => { const f = vitalFlags(d); return `<tr${f.length ? ' style="background:var(--bad-soft)"' : ''}><td class="nowrap">${roc(d.date)}</td><td>${d.temp ?? ''}</td><td class="nowrap">${d.sbp ? d.sbp + '/' + (d.dbp || '') : ''}</td><td>${d.pulse ?? ''}</td><td>${d.resp ?? ''}</td><td>${d.spo2 ?? ''}</td><td>${d.pain ?? ''}</td><td>${d.sugar ?? ''}</td><td>${d.oob ?? ''}</td><td>${d.bath ? '✓' : ''}</td><td>${d.oral ? '✓' : ''}</td><td>${d.bowel ? '✓' : ''}</td><td class="small">${esc(d.note || '')}</td></tr>`; }).join('') || '<tr><td colspan="13" class="empty">尚無紀錄</td></tr>'}</table></div></div>`;
}
function resWeight(r) {
  const ws = weightsOf(r.id); const wa = weightAlert(r.id);
  return `${wa ? `<div class="banner bad">30 天內體重${wa.pct > 0 ? '增加' : '減少'} ${Math.abs(wa.pct).toFixed(1)}%（${wa.from.kg} → ${wa.to.kg} kg），符合 B18 非計畫性體重改變收案條件。<button class="btn sm" data-act="newEventFor" data-id="${r.id}" data-t="非計畫性體重改變">收案登錄</button></div>` : ''}
  <div class="row" style="margin-bottom:10px"><button class="btn pri" data-act="newWeightFor" data-id="${r.id}">＋ 新增體重</button></div>
  <div class="card">${sparkline(ws.map(w => w.kg), 600, 90) || '<span class="muted small">至少兩筆資料才會顯示趨勢圖</span>'}</div>
  <div class="card" style="padding:0"><table class="t"><tr><th>日期</th><th>體重 kg</th><th>與前次差</th><th>BMI</th><th></th></tr>
  ${ws.slice().reverse().map((w, i, arr) => { const prev = arr[i + 1]; const ht = (latestAssess(r.id).mna || {}).extra; const h = ht && ht.height; return `<tr><td>${roc(w.date)}</td><td>${w.kg}</td><td>${prev ? ((w.kg - prev.kg) / prev.kg * 100).toFixed(1) + '%' : ''}</td><td>${h ? (w.kg / Math.pow(h / 100, 2)).toFixed(1) : ''}</td><td><button class="btn sm ghost" data-act="delRow" data-c="weights" data-id="${w.id}">✕</button></td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">尚無紀錄</td></tr>'}</table></div>`;
}
function resEvents(r) {
  const list = byRes('events', r.id);
  return `<div class="row" style="margin-bottom:10px"><button class="btn pri" data-act="newEventFor" data-id="${r.id}">＋ 登錄事件</button></div>${eventTable(list, false)}`;
}
function resRestraints(r) {
  const list = DB.restraints.filter(x => x.rid === r.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return `<div class="row" style="margin-bottom:10px"><button class="btn pri" data-act="newRestraintFor" data-id="${r.id}" ${activeRestraint(r.id) ? 'disabled title="已有進行中的約束"' : ''}>＋ 約束評估與開始</button></div>${restraintTable(list)}`;
}
function resContacts(r) {
  const list = byRes('contacts', r.id);
  return `<div class="row" style="margin-bottom:10px"><button class="btn pri" data-act="newContactFor" data-id="${r.id}">＋ 新增訪視／聯繫紀錄</button></div>
  <div class="card" style="padding:0"><table class="t"><tr><th>日期</th><th>類別</th><th>內容</th><th>紀錄者</th><th></th></tr>
  ${list.map(c => `<tr><td class="nowrap">${roc(c.date)}</td><td class="nowrap">${esc(c.kind)} ${refChip((CONTACT_KINDS[c.kind] || {}).ref)}</td><td>${esc(c.content || '')}${c.followup ? `<div class="small muted">追蹤：${esc(c.followup)}</div>` : ''}</td><td class="small">${esc(c.by)}</td><td class="nowrap"><button class="btn sm" data-act="editContact" data-id="${c.id}">編輯</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">尚無紀錄</td></tr>'}</table></div>`;
}
function resVaccines(r) {
  const list = byRes('vaccines', r.id);
  return `<div class="row" style="margin-bottom:10px"><button class="btn pri" data-act="newVaccineFor" data-id="${r.id}">＋ 登錄疫苗</button></div>
  <div class="card" style="padding:0"><table class="t"><tr><th>日期</th><th>疫苗</th><th>狀態</th><th></th></tr>
  ${list.map(v => `<tr><td>${roc(v.date)}</td><td>${esc(v.kind)}</td><td>${v.refused ? `<span class="chip warn">未接種：${esc(v.reason || '')}</span>` : '<span class="chip ok">已接種</span>'}</td><td><button class="btn sm ghost" data-act="delRow" data-c="vaccines" data-id="${v.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">尚無紀錄</td></tr>'}</table></div>`;
}
ACT.delRow = el => confirmBox('確定刪除這筆紀錄？', () => { remove(el.dataset.c, el.dataset.id); toast('已刪除'); });

/* 快速新增：體重、聯繫、疫苗 */
function openWeight(rid) {
  const r = resById(rid); const ws = weightsOf(rid); const last = ws[ws.length - 1];
  const F = [{ key: 'date', label: '日期', type: 'date', def: today(), req: true }, { key: 'kg', label: '體重 (kg)', type: 'number', step: '0.1', req: true }];
  openModal(`體重：${resLabel(r)}`, formHTML(F, {}) + (last ? `<p class="small muted">上次 ${roc(last.date)}：${last.kg} kg</p>` : ''), () => {
    const o = readForm(F); if (!o) return false; if (o.kg < 20 || o.kg > 200) { toast('體重數值不合理，請確認', 'bad'); return false; }
    save('weights', Object.assign(o, { rid })); const wa = weightAlert(rid);
    if (wa) toast(`注意：30 天內體重改變 ${wa.pct.toFixed(1)}%，請收案（B18）`, 'bad'); else toast('已儲存體重');
  });
}
ACT.newWeightFor = el => openWeight(el.dataset.id);
function contactFields(kind) {
  return [
    { key: 'rid', label: '住民', type: 'select', options: activeResidents().filter(inHouse).map(r => [r.id, resLabel(r)]), req: true },
    { key: 'kind', label: '類別', type: 'select', options: Object.keys(CONTACT_KINDS), req: true, def: kind },
    { key: 'date', label: '日期', type: 'date', def: today(), req: true }, { key: 'with', label: kind && kind.includes('家屬') ? '聯繫對象' : '執行人員／對象' },
    { key: 'content', label: '內容摘要', type: 'textarea', wide: true, req: true }, { key: 'followup', label: '後續追蹤事項', type: 'textarea', wide: true },
  ];
}
const CONTACT_PHRASES = {
  '醫師巡診': ['生命徵象穩定，續原醫囑。', '調整藥物，請護理人員觀察用藥反應。', '建議轉診門診進一步檢查。'],
  '藥師評估': ['用藥無重複或交互作用。', '建議醫師評估減少鎮靜安眠藥物以降低跌倒風險。', '已指導護理人員藥物保存與給藥時間。'],
  '家屬電訪／會談': ['說明近況與照顧計畫，家屬了解並同意。', '家屬表達需求，已轉知相關專業。', '邀請家屬參加家屬座談會。'],
  '社工關懷會談': ['住民情緒穩定，表示適應良好。', '住民表達思念家人，已聯繫家屬安排探視。', '住民情緒低落，持續追蹤並轉知護理人員。'],
};
function openContact(id, rid, kind) {
  const c = id ? DB.contacts.find(x => x.id === id) : { rid, kind };
  const F = contactFields(c.kind);
  const ph = CONTACT_PHRASES[c.kind] || [];
  openModal(id ? '編輯訪視聯繫紀錄' : '新增訪視聯繫紀錄', formHTML(F, c) + (ph.length ? `<div class="small muted">常用片語（點一下帶入）：</div><div class="chips">${ph.map(p => `<button class="chip" data-act="phrase" data-t="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''), () => {
    const o = readForm(F); if (!o) return false; save('contacts', Object.assign(c, o)); toast('已儲存紀錄');
  }, { extraBtn: id ? `<button class="btn danger" data-act="delContact" data-id="${id}">刪除</button>` : '' });
}
ACT.phrase = el => { const ta = $('#mbody textarea'); ta.value = (ta.value ? ta.value + '\n' : '') + el.dataset.t; ta.focus(); };
ACT.newContactFor = el => openContact(null, el.dataset.id);
ACT.editContact = el => openContact(el.dataset.id);
ACT.delContact = el => { remove('contacts', el.dataset.id); closeModal(); refresh(); toast('已刪除'); };
function openVaccine(id, rid) {
  const F = [{ key: 'kind', label: '疫苗', type: 'select', options: ['流感','肺鏈 PCV','肺鏈 PPV23','COVID-19','其他'], req: true }, { key: 'date', label: '日期', type: 'date', def: today(), req: true },
    { key: 'refused', label: '未接種（需註明原因）', type: 'bool' }, { key: 'reason', label: '未接種原因', type: 'select', options: ['對疫苗成分過敏','曾有嚴重不良反應','醫師評估暫緩','本人或家屬拒絕','急性疾病','其他'] }];
  openModal(`疫苗：${resLabel(resById(rid))}`, formHTML(F, {}), () => { const o = readForm(F); if (!o) return false; if (o.refused && !o.reason) { toast('未接種請註明原因（B23）', 'bad'); return false; } save('vaccines', Object.assign(o, { rid })); toast('已登錄'); });
}
ACT.newVaccineFor = el => openVaccine(null, el.dataset.id);
