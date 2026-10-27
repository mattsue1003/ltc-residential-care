/* ===== 品質指標 ===== */
function recentQuarters(n) { const out = []; let q = quarterOf(today()); for (let i = 0; i < n; i++) { out.push(q); q = prevQuarter(q); } return out; }
ROUTES.quality = (q) => {
  q = q || quarterOf(today());
  const [f, t] = quarterRange(q);
  const months = [0, 1, 2].map(i => { const d = new Date(f + 'T00:00:00'); d.setMonth(d.getMonth() + i); return ymd(d).slice(0, 7); });
  const ms = months.map(m => qualityStats(...monthRange(m)));
  const qs = qualityStats(f, t);
  const hist = recentQuarters(4).reverse().map(x => [x, qualityStats(...quarterRange(x))]);
  const Q = DB.quarterly[q] || { analysis: {} };
  const fmt = (row, a, b) => { const inner = row.rate === null ? row.n : `${row.n}<div class="small muted">${row.rate.toFixed(2)} ${row.unit}</div>`; return row.n ? `<button class="qcell" data-act="qDrill" data-k="${esc(row.key)}" data-f="${a}" data-t="${b}" title="點開看是哪幾件">${inner}</button>` : inner; };
  return `${qiTabs('quality')}<div class="hd"><div><h1>品質指標</h1><p class="sub">由事件登錄、約束、體重、評估資料自動計算。人日數 = 每位住民在機構的天數加總。每季完成分析檢討即符合 B12–B18「定期（每季）分析」。</p></div><span class="sp"></span>
    <select id="qSel" style="padding:7px;border:1px solid var(--line);border-radius:8px">${recentQuarters(8).map(x => `<option value="${x}"${x === q ? ' selected' : ''}>${x.replace('-Q', ' 年第 ')} 季${x === quarterOf(today()) ? '（本季）' : ''}</option>`).join('')}</select></div>
  <p class="small muted" style="margin-top:-6px">數字可以點開看是哪幾件；右邊趨勢長條點一下切換季度。</p>
  <div class="grid g4"><div class="kpi"><div class="n">${qs.rd}</div><div class="l">本季住民人日數</div></div><div class="kpi"><div class="n">${qs.census}</div><div class="l">平均每日在住</div></div>
    <div class="kpi ${Q.done ? 'ok' : 'warn'}"><div class="n">${Q.done ? '已完成' : '未完成'}</div><div class="l">本季分析檢討</div></div><div class="kpi"><div class="n">${DB.events.filter(e => e.date >= f && e.date <= t).length}</div><div class="l">本季事件總數</div></div></div>
  <div class="card" style="margin-top:16px;padding:0"><div class="tw"><table class="t"><tr><th>指標</th>${months.map(m => `<th>${+m.slice(5)} 月</th>`).join('')}<th>本季</th><th>近 4 季趨勢</th></tr>
  ${qs.rows.map((row, i) => { const h = hist.map(([, s]) => s.rows[i].rate ?? s.rows[i].n); const mx = Math.max(...h, 0.0001);
    return `<tr><td>${esc(row.key)} ${refChip(row.ref)}</td>${ms.map((s, mi) => `<td>${fmt(s.rows[i], ...monthRange(months[mi]))}</td>`).join('')}<td><b>${fmt(row, f, t)}</b></td>
    <td><div style="display:flex;gap:3px;align-items:flex-end;height:30px">${h.map((v, j) => `<button data-act="qGo" data-q="${hist[j][0]}" title="${hist[j][0]}：${typeof v === 'number' ? v.toFixed(2) : v}（點一下切換到這一季）" style="width:18px;padding:0;border:0;cursor:pointer;height:${Math.max(3, v / mx * 28)}px;background:${hist[j][0] === q ? 'var(--pri)' : 'var(--line)'};border-radius:2px"></button>`).join('')}</div></td></tr>`; }).join('')}</table></div></div>
  <div class="banner info">每季的正式分析請到「<a href="#/qipdca">季 PDCA</a>」填寫 PDCA 改善報告單，每月報表在「<a href="#/qimonth">月統計表</a>」。</div><h2>本季分析與改善方案（簡式）</h2><p class="sub">逐項填寫後按「完成本季分析」。建議於品質會議中討論並記錄於「會議與活動」。</p>
  <div id="qForm">${qs.rows.filter(r => r.rate !== null || r.key.startsWith('管路成功')).map(row => { const a = (Q.analysis || {})[row.key] || {}; const evs = DB.events.filter(e => row.key.startsWith(e.type) && e.date >= f && e.date <= t);
    return `<div class="card"><div class="row"><b>${esc(row.key)}</b>${refChip(row.ref)}<span class="sp"></span><span class="chip">${row.n} 件</span></div>
    ${evs.length ? `<div class="small muted" style="margin:6px 0">${evs.map(e => `${roc(e.date)} ${esc(resById(e.rid) ? resById(e.rid).name : '')}：${esc((e.cause || '未分析').slice(0, 30))}`).join('；')}</div>` : ''}
    <div class="grid g2"><label class="f">分析（趨勢、共同原因）<textarea data-qk="${esc(row.key)}" data-qf="a">${esc(a.a || '')}</textarea></label><label class="f">檢討與改善方案<textarea data-qk="${esc(row.key)}" data-qf="b">${esc(a.b || '')}</textarea></label></div></div>`; }).join('')}</div>
  <div class="row"><button class="btn" data-act="qSave" data-q="${q}">暫存</button><button class="btn pri" data-act="qDone" data-q="${q}">完成本季分析</button><button class="btn" data-act="printQuarter" data-q="${q}">列印季報告</button></div>`;
};
const QKEY_TYPE = { '跌倒': ['跌倒'], '壓力性損傷（機構內新發生）': ['壓力性損傷'], '感染': ['感染'], '非計畫性住院': ['非計畫性住院'], '非計畫性體重改變': ['非計畫性體重改變'], '管路滑脫／自拔': ['管路滑脫／自拔'], '管路成功移除': ['管路移除'] };
ACT.qGo = el => go('quality/' + el.dataset.q);
ACT.qDrill = el => {
  const k = el.dataset.k, f = el.dataset.f, t = el.dataset.t; let html = '';
  if (QKEY_TYPE[k]) {
    const list = DB.events.filter(e => QKEY_TYPE[k].includes(e.type) && e.date >= f && e.date <= t).sort((a, b) => a.date.localeCompare(b.date));
    html = `<table class="t"><tr><th>日期</th><th>住民</th><th>經過</th><th>分析</th><th></th></tr>${list.map(e => `<tr><td class="nowrap">${roc(e.date)}</td><td class="nowrap">${esc(resLabel(resById(e.rid)))}</td><td class="small">${esc((e.desc || '').slice(0, 60))}</td><td>${e.cause && e.action ? '<span class="chip ok">已分析</span>' : '<span class="chip bad">待分析</span>'}</td><td><button class="btn sm" data-act="qOpenEv" data-id="${e.id}">開啟</button></td></tr>`).join('')}</table>`;
  } else if (k === '約束') {
    const list = DB.restraints.filter(x => x.startDate <= t && (!x.endDate || x.endDate >= f));
    html = `<table class="t"><tr><th>住民</th><th>期間</th><th>目的</th></tr>${list.map(x => `<tr><td>${esc(resLabel(resById(x.rid)))}</td><td>${roc(x.startDate)}～${x.endDate ? roc(x.endDate) : '持續中'}</td><td>${esc((x.reasons || []).join('、'))}</td></tr>`).join('')}</table>`;
  } else if (/疼痛/.test(k)) {
    const list = DB.daily.filter(d => d.date >= f && d.date <= t && +d.pain >= 4).sort((a, b) => a.date.localeCompare(b.date));
    html = `<table class="t"><tr><th>日期</th><th>住民</th><th>疼痛分數</th></tr>${list.map(d => `<tr><td>${roc(d.date)}</td><td>${esc(resLabel(resById(d.rid)))}</td><td>${d.pain}</td></tr>`).join('')}</table>`;
  } else html = '<p class="small muted">此指標由評估資料計算，請到住民個人頁查看評估紀錄。</p>';
  openModal(`${k}｜${roc(f)}～${roc(t)}`, html, null);
};
ACT.qOpenEv = el => { closeModal(); openEvent(el.dataset.id); };
ROUTES.after_quality = () => { $('#qSel').addEventListener('change', e => go('quality/' + e.target.value)); };
function readQ(q) { const Q = DB.quarterly[q] || { analysis: {} }; Q.analysis = Q.analysis || {}; $$('#qForm textarea').forEach(t => { (Q.analysis[t.dataset.qk] = Q.analysis[t.dataset.qk] || {})[t.dataset.qf] = t.value; }); return Q; }
ACT.qSave = el => { setKV('quarterly', el.dataset.q, readQ(el.dataset.q)); toast('已暫存'); };
ACT.qDone = el => { const Q = readQ(el.dataset.q); const empty = Object.values(Q.analysis).filter(x => !x.a && !x.b).length; if (empty > 3) { toast(`還有 ${empty} 項未填寫分析`, 'bad'); return; } Q.done = true; Q.doneDate = today(); Q.by = currentUser(); setKV('quarterly', el.dataset.q, Q); toast('本季分析已完成'); refresh(); };

/* ===== 評鑑準備 ===== */
let accOpen = 'B', accOnlyCore = false;
ROUTES.accred = () => {
  const A = DB.accred;
  const all = accredFlat(); const core = all.filter(x => x.core); const SET = accredSet(); const elder = accVer() === 'elder';
  const rated = all.filter(x => A[x.code] && A[x.code].r).length;
  const coreOk = core.filter(x => A[x.code] && ['A', 'B'].includes(A[x.code].r)).length;
  const autoBad = all.filter(x => { const e = accredEvidence(x.code); return e && e[0] === 'bad'; });
  return `<div class="hd"><div><h1>評鑑準備</h1><p class="sub">${esc(accredName())}：${SET.map(c => `${c.cat} ${c.items.length} 項`).join('、')}，${elder ? '一級必要項目' : '核心指標'} ${core.length} 項。系統能自動計算的項目會顯示即時佐證。${elder ? '<br>臺中市社會局每 4 年評鑑一次，指標於評鑑前 6 個月公告；公告後請以臺中市版本核對。' : ''}</p></div><span class="sp"></span><button class="btn" data-act="printAccred">列印自評表</button></div>
  <div class="grid g4"><div class="kpi"><div class="n">${rated}/${all.length}</div><div class="l">已自評</div></div><div class="kpi ${coreOk === core.length ? 'ok' : 'warn'}"><div class="n">${coreOk}/${core.length}</div><div class="l">${elder ? '一級必要項目' : '核心指標'}自評達 B 以上</div></div>
    <div class="kpi ${autoBad.length ? 'bad' : 'ok'}"><div class="n">${autoBad.length}</div><div class="l">系統偵測需補強</div></div><div class="kpi"><div class="n">${roc(today())}</div><div class="l">${elder ? '臺中市 109 年評鑑：優等' : '評鑑期間 115/7–9 月'}</div></div></div>
  ${autoBad.length ? `<div class="banner bad" style="margin-top:14px">需補強：${autoBad.map(x => `<b>${x.code}</b> ${esc(x.title)}`).join('、')}</div>` : ''}
  <div class="row" style="margin:14px 0"><div class="chips" style="margin:0">${SET.map(c => `<button class="chip ${c.cat === accOpen ? 'on' : ''}" data-act="accCat" data-c="${c.cat}">${c.cat}. ${c.name}</button>`).join('')}</div><span class="sp"></span><label class="small row" style="gap:4px"><input type="checkbox" data-act="accCore" ${accOnlyCore ? 'checked' : ''}> 只看${elder ? '一級必要項目' : '核心指標'}</label></div>
  ${all.filter(x => x.cat === accOpen && (!accOnlyCore || x.core)).map(x => { const ev = accredEvidence(x.code); const s = A[x.code] || {};
    return `<details class="acc-item" ${ev && ev[0] === 'bad' ? 'open' : ''}><summary><span class="code">${x.code}</span><span style="flex:1">${esc(x.title)} ${x.core ? `<span class="chip bad">${elder ? '一級必要' : '核心'}</span>` : ''}</span>${ev ? `<span class="chip ${ev[0]}">${ev[0] === 'ok' ? '佐證完整' : ev[0] === 'bad' ? '需補強' : ev[0] === 'warn' ? '注意' : '資訊'}</span>` : ''}${s.r ? `<span class="chip pri">自評 ${s.r}</span>` : ''}</summary>
    <div class="body"><p>${esc(x.desc)}</p>${ev ? `<div class="banner ${ev[0] === 'ok' ? 'info' : ev[0]}" style="margin:6px 0">系統佐證：${esc(ev[1])}</div>` : '<p class="small muted">此項需以文件、現場察看佐證，請於備註記錄準備狀況與文件位置。</p>'}
    <div class="row"><span class="small muted">自評</span><div class="rating">${['A', 'B', 'C', 'D', 'E'].map(g => `<button data-act="accRate" data-c="${x.code}" data-g="${g}" class="${s.r === g ? 'on' : ''}">${g}</button>`).join('')}</div></div>
    <label class="f" style="margin-top:8px">準備狀況／佐證文件位置<textarea data-accnote="${x.code}" placeholder="例：工作手冊第 3 章；114 年品質會議紀錄 4 份">${esc(s.note || '')}</textarea></label></div></details>`; }).join('')}`;
};
ROUTES.after_accred = () => { $$('[data-accnote]').forEach(t => t.addEventListener('change', () => { const c = t.dataset.accnote; setKV('accred', c, Object.assign({}, DB.accred[c], { note: t.value })); toast('已儲存備註'); })); };
ACT.accCat = el => { accOpen = el.dataset.c; refresh(); };
ACT.accCore = () => { accOnlyCore = !accOnlyCore; refresh(); };
ACT.accRate = el => { const c = el.dataset.c; const cur = DB.accred[c] || {}; setKV('accred', c, Object.assign({}, cur, { r: cur.r === el.dataset.g ? '' : el.dataset.g })); refresh(); };

/* ===== 列印中心 ===== */
ROUTES.print = () => {
  const res = DB.residents.slice().sort((a, b) => (a.bed || '').localeCompare(b.bed || '', 'zh-Hant', { numeric: true }));
  const rs = `<select data-p="rid">${res.map(r => `<option value="${r.id}">${esc(resLabel(r))}${inHouse(r) ? '' : '（結案）'}</option>`).join('')}</select>`;
  const forms = [
    ['住民定期評估暨服務計畫表', 'B2', '基本資料＋各量表最新結果＋照顧計畫＋簽章', rs, 'resPack'],
    ['個別化照顧計畫', 'B2 B4', '含跨專業參與與家屬共同討論簽名', rs, 'plan'],
    ['每月生命徵象紀錄表', 'B9 B14', '一位住民一個月', rs + `<input type="month" data-p="month" value="${today().slice(0, 7)}">`, 'vitalsMonth'],
    ['翻身擺位及定時如廁紀錄表（空白）', 'B25 B26', '每 2 小時一格，照服員紙本勾選', rs + `<input type="date" data-p="date" value="${today()}">`, 'turning'],
    ['家屬聯繫紀錄單', 'B8', '彙整該住民所有家屬聯繫', rs, 'family'],
    ['照護紀錄（月）', 'B2', '護理、社工、治療紀錄', rs + `<input type="month" data-p="month2" value="${today().slice(0, 7)}">`, 'notes'],
    ['空白評估量表', 'B2', '紙本評估用', `<select data-p="scale">${Object.keys(SCALES).map(t => `<option value="${t}">${esc(SCALES[t].name)}</option>`).join('')}</select>` + `<select data-p="rid2"><option value="">（不帶入住民）</option>${res.filter(inHouse).map(r => `<option value="${r.id}">${esc(resLabel(r))}</option>`).join('')}</select>`, 'blankScale'],
    ['全區交班單', 'B8', '異常徵象、事件、約束、住院、新入住', `<input type="date" data-p="date" value="${today()}">`, 'handover'],
    ['全區每日照護紀錄', 'B9 B24 B25', '當日生命徵象與照護一覽', `<input type="date" data-p="date" value="${today()}">`, 'dailySheet'],
    ['評估進度總表', 'B2', '所有住民評估與訪視期限', '', 'matrix'],
    ['季品質指標分析報告', 'B12–B18', '指標、案件清單、分析與改善', `<select data-p="q">${recentQuarters(8).map(x => `<option>${x}</option>`).join('')}</select>`, 'quarter'],
    ['評鑑自評表', 'A–E', '全部指標自評與佐證', '', 'accred'],
  ];
  return `<h1>列印中心</h1><p class="sub">A4 版面，標楷體。按「列印」後可在列印視窗選「另存為 PDF」。單筆事件、約束同意書、會議紀錄、評估量表也可在各自頁面直接列印。</p>
  <div class="card" style="padding:0"><table class="t">${forms.map(([n, ref, d, ctl, k]) => `<tr data-form="${k}"><td><b>${n}</b> ${refChip(ref)}<div class="small muted">${d}</div></td><td class="row" style="gap:6px">${ctl.replace(/<(select|input)/g, '<$1 style="padding:6px;border:1px solid var(--line);border-radius:6px;max-width:220px"')}</td><td><button class="btn pri sm" data-act="printForm">列印</button></td></tr>`).join('')}</table></div>`;
};
ACT.printForm = el => {
  const tr = el.closest('tr'), k = tr.dataset.form, p = {}; $$('[data-p]', tr).forEach(i => p[i.dataset.p] = i.value);
  ({ resPack: () => PR.resPack(p.rid), plan: () => PR.plan(p.rid), vitalsMonth: () => PR.vitalsMonth(p.rid, p.month), turning: () => PR.turning(p.rid, p.date), family: () => PR.family(p.rid), notes: () => PR.notes(p.rid, p.month2),
    blankScale: () => PR.scale(p.scale, null, p.rid2), handover: () => PR.handover(p.date), dailySheet: () => PR.dailySheet(p.date), matrix: () => PR.matrix(), quarter: () => PR.quarter(p.q), accred: () => PR.accred() })[k]();
};

/* ===== 設定與備份 ===== */
ROUTES.settings = () => {
  const S = DB.settings, u = S.user || {}, st = S.staff || {};
  return `<h1>設定與備份</h1><p class="sub">所有資料只存在這台電腦的瀏覽器（IndexedDB），不會傳到任何伺服器。換電腦或清除瀏覽器資料前，請先匯出備份。</p>
  <div class="grid g2" style="align-items:start"><div>
  <div class="card"><h2 style="margin-top:0">機構資料</h2>${formHTML([{ key: 'org', label: '機構名稱' }, { key: 'facType', label: '機構類型（決定評鑑版本與巡診週期）', type: 'select', options: Object.keys(FACILITY_TYPES), blank: false, def: '養護型（老人福利機構）' }, { key: 'beds', label: '核定床數', type: 'number' }, { key: 'manager', label: '業務負責人' }, { key: 'phone', label: '機構電話' }, { key: 'lastEval', label: '上次評鑑（年度與等第）', ph: '例：109 年 優等' }], S)}<p class="small muted">目前評鑑依據：${esc(accredName())}；醫師巡診每 ${Math.round(facType().doctor / 30)} 個月、定期評估每 ${Math.round(facType().cycle / 30)} 個月。</p><button class="btn pri" data-act="saveOrg">儲存</button></div>
  ${Cloud.on ? `<div class="card"><h2 style="margin-top:0">我的帳號</h2><p>${esc(Cloud.profile ? Cloud.profile.name + '（' + Cloud.profile.role + '）' : '')}<br><span class="small muted">${esc(Cloud.profile ? Cloud.profile.email : '')}</span></p><p class="small">兩步驟驗證：${Cloud.auth && Cloud.auth.currentUser && FB.multiFactor(Cloud.auth.currentUser).enrolledFactors.length ? '<span class="chip ok">已啟用</span>' : '<span class="chip warn">未啟用</span>'}</p><div class="row">${Cloud.isAdmin() ? '<button class="btn" data-act="go" data-to="accounts">帳號與資安</button>' : ''}<button class="btn" data-act="cLogout">登出</button></div></div>` : `<div class="card"><h2 style="margin-top:0">目前使用者</h2><p class="small muted">紀錄會自動標記填寫者（D1 使用者權限與可追溯）。換班時請切換使用者。</p>${formHTML([{ key: 'name', label: '姓名', req: true }, { key: 'role', label: '職類', type: 'select', options: ROLES, req: true }], u)}<button class="btn pri" data-act="saveUser">切換／儲存</button></div>`}
  <div class="card"><h2 style="margin-top:0">工作人員疫苗（B23）</h2>${formHTML([{ key: 'total', label: '直接照顧工作人員數', type: 'number' }, { key: 'flu', label: '本季已接種流感人數', type: 'number' }, { key: 'covid', label: '已接種 COVID-19 人數', type: 'number' }], st, 3)}<button class="btn" data-act="saveStaff">儲存</button></div>
  </div><div>
  ${Cloud.on ? '' : `<div class="card"><h2 style="margin-top:0">資料保護</h2><p class="small">設定密碼後，資料會以 AES-256 加密存放，開啟系統需輸入密碼。<b>忘記密碼將無法復原資料</b>，請務必保留備份。</p>
    <p>目前狀態：${Store.key ? '<span class="chip ok">已加密</span>' : '<span class="chip warn">未加密</span>'}</p>
    <label class="f">新密碼（至少 6 碼，留空並按「移除密碼」可取消）<input type="password" id="pw1" autocomplete="new-password"></label><label class="f">再輸入一次<input type="password" id="pw2" autocomplete="new-password"></label>
    <div class="row"><button class="btn pri" data-act="setPw">設定密碼</button>${Store.key ? '<button class="btn" data-act="clearPw">移除密碼</button><button class="btn" data-act="lockNow">立即鎖定</button>' : ''}</div></div>`}
  <div class="card"><h2 style="margin-top:0">手動備份與還原</h2><p class="small muted">上次手動備份：${S.lastBackup ? roc(S.lastBackup.slice(0, 10)) : '從未'}</p>
    <label class="small row" style="gap:6px;margin-bottom:8px"><input type="checkbox" id="bkPhotos" checked> 備份檔包含照片（檔案會變大）</label>
    <div class="row"><button class="btn pri" data-act="exportData">匯出備份檔 (.json)</button><label class="btn">匯入還原<input type="file" id="importFile" accept=".json" hidden></label></div>
    <p class="small muted">備份檔含住民個資${Cloud.on ? '，下載時會要求另設一組備份密碼加密' : Store.key ? '，已用你的密碼加密' : '，<b>尚未加密</b>，建議先設定密碼'}。請存放在機構的電腦或隨身碟，不要用通訊軟體傳送。</p></div>
  ${Cloud.on ? '' : `<div class="card"><h2 style="margin-top:0">試用與重置</h2><div class="row"><button class="btn" data-act="loadDemo">載入示範資料（12 位虛構住民）</button><button class="btn" data-act="openTrial">載入加密試用資料（需密碼）</button><button class="btn danger" data-act="clearAll">清除全部資料</button></div></div>`}
  <div class="card"><h2 style="margin-top:0">外觀</h2><div class="row" style="margin-bottom:8px"><span class="small muted">字級</span><button class="btn sm" data-act="zoom" data-z="1">標準</button><button class="btn sm" data-act="zoom" data-z="1.15">大</button><button class="btn sm" data-act="zoom" data-z="1.3">特大</button></div><div class="row"><span class="small muted">底色</span><button class="btn sm" data-act="theme" data-t="">白底（預設）</button><button class="btn sm" data-act="theme" data-t="dark">深色</button><button class="btn sm" data-act="theme" data-t="auto">跟隨電腦設定</button></div></div>
  </div></div>${Cloud.on ? cloudStorageCard() : storageCards()}`;
};
ROUTES.after_settings = () => { $('#importFile').addEventListener('change', importData); fillStorageEstimate(); if (Cloud.on) return;
  const sd = $('#snapDays'); if (sd) sd.addEventListener('change', () => { setKV('settings', 'snapDays', Math.max(7, +sd.value || 60)); toast('已更新'); });
  $('#retYears').addEventListener('change', e => { const v = Math.max(7, +e.target.value || 7); setKV('settings', 'retentionYears', v); toast(`住民結案後保存 ${v} 年`); refresh(); }); };
ACT.saveOrg = el => { const o = readForm([{ key: 'org' }, { key: 'facType' }, { key: 'beds', type: 'number' }, { key: 'manager' }, { key: 'phone' }, { key: 'lastEval' }], el.closest('.card')); Object.assign(DB.settings, o); Store.mark('settings'); updateBrand(); toast('已儲存機構資料，提醒與評鑑指標已依機構類型更新'); refresh(); };
ACT.saveUser = el => { const o = readForm([{ key: 'name', label: '姓名', req: true }, { key: 'role', label: '職類', req: true }], el.closest('.card')); if (!o) return; setKV('settings', 'user', o); updateBrand(); toast(`目前使用者：${o.name}（${o.role}）`); refresh(); };
ACT.saveStaff = el => { setKV('settings', 'staff', readForm([{ key: 'total', type: 'number' }, { key: 'flu', type: 'number' }, { key: 'covid', type: 'number' }], el.closest('.card'))); toast('已儲存'); };
ACT.setPw = async () => { const a = $('#pw1').value, b = $('#pw2').value; if (a.length < 6) { toast('密碼至少 6 碼', 'bad'); return; } if (a !== b) { toast('兩次輸入不一致', 'bad'); return; } await Store.setPassword(a); toast('已加密，下次開啟需輸入密碼'); refresh(); };
ACT.clearPw = () => confirmBox('移除密碼後資料將以未加密方式存放，確定？', async () => { await Store.setPassword(''); toast('已移除密碼'); refresh(); });
ACT.lockNow = () => { location.reload(); };
ACT.theme = el => { const t = el.dataset.t; if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; try { localStorage.setItem('ltc-theme', t); } catch (e) {} toast('已切換外觀'); };
ACT.exportData = async () => {
  const withPh = $('#bkPhotos') ? $('#bkPhotos').checked : true;
  let txt; try { txt = await buildBackup(withPh); } catch (e) { return; }
  const blob = new Blob([txt], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `長照照護資料備份_${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  setKV('settings', 'lastBackup', nowISO()); logAccess('匯出全機構備份'); toast('已下載備份檔'); setTimeout(refresh, 100);
};
function importData(e) { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => restoreBackup(rd.result); rd.readAsText(f); e.target.value = ''; }
ACT.loadDemo = () => confirmBox('載入示範資料會<b>覆蓋</b>目前所有資料（12 位虛構住民、近 4 個月紀錄），確定？', () => { loadDemo(); updateBrand(); toast('已載入示範資料'); go('dash'); }, '載入');
ACT.clearAll = () => confirmBox('確定清除全部資料？此動作無法復原，請先匯出備份。', async () => { const user = DB.settings.user; for (const p of DB.photos.slice()) await delPhoto(p.id); COLLECTIONS.forEach(c => { DB[c] = ['settings', 'quarterly', 'accred'].includes(c) ? {} : []; Store.mark(c); }); DB.settings.user = user; toast('已清除全部資料'); go('dash'); }, '全部清除');
