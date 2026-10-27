/* ===== 評估量表 ===== */
let assessState = null;
ROUTES.assess = (rid, type) => {
  const res = activeResidents().filter(inHouse);
  if (!rid || !type) {
    const due = (window.__rem || []).filter(r => r.cat === '評估');
    return `<h1>評估量表</h1><p class="sub">選擇住民與量表開始評估。系統自動計分、判讀、產生紀錄敘述句，並建議照顧計畫。</p>
    <div class="card"><div class="grid g3"><label class="f">住民<select id="asRes">${res.map(r => `<option value="${r.id}">${esc(resLabel(r))}</option>`).join('')}</select></label>
      <label class="f">量表<select id="asType">${Object.keys(SCALES).map(t => `<option value="${t}">${esc(SCALES[t].name)}</option>`).join('')}</select></label>
      <div style="align-self:end;margin-bottom:10px"><button class="btn pri" data-act="startAssess">開始評估</button></div></div></div>
    <h2>到期與逾期評估（${due.length}）</h2><div class="card" style="padding:0">${due.length ? due.map(remRow).join('') : '<div class="empty">沒有到期的評估</div>'}</div>
    <h2>批次評估</h2><p class="sub">選一個量表，系統依床號排出所有到期住民，存檔後自動跳下一位。</p>
    <div class="chips">${Object.keys(SCALES).map(t => { const n = due.filter(d => d.act.split(':')[2].split(',').includes(t)).length; return `<button class="chip ${n ? 'warn' : ''}" data-act="batchAssess" data-t="${t}" ${n ? '' : 'disabled'}>${SCALES[t].short}　${n} 位</button>`; }).join('')}</div>`;
  }
  const r = resById(rid), sc = SCALES[type];
  if (!assessState || assessState.rid !== rid || assessState.type !== type) {
    const prev = latestAssess(rid)[type];
    assessState = { rid, type, answers: {}, extra: {}, date: today(), note: '', prev };
    if (type === 'mna') { const w = weightsOf(rid).pop(); if (w) assessState.extra.weight = w.kg; const ph = prev && prev.extra; if (ph && ph.height) assessState.extra.height = ph.height; }
    if (type === 'morse') { const f = DB.events.some(e => e.rid === rid && e.type === '跌倒' && diffDays(e.date, today()) <= 92); assessState.answers[0] = f ? 25 : 0; if (r.tubes && (r.tubes.ng || r.tubes.foley || r.tubes.trach)) assessState.answers[3] = 20; }
  }
  const S = assessState;
  const queue = window.__batch && window.__batch.type === type ? window.__batch.list : null;
  const chain = window.__chain && window.__chain.rid === rid ? window.__chain.list : null;
  return `<div class="hd"><div><h1>${esc(sc.name)}</h1><p class="sub"><a href="#/r/${r.id}">${esc(resLabel(r))}</a>　${esc(r.gender || '')} ${age(r.birth)} 歲${S.prev ? `　上次：${roc(S.prev.date)} ${S.prev.score ?? ''} ${esc(S.prev.level)}` : '　首次評估'}</p></div><span class="sp"></span>
    <label class="f" style="margin:0">評估日期<input type="date" id="asDate" value="${S.date}"></label></div>
  ${S.prev ? `<div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="copyPrev">帶入上次答案再修改</button><span class="small muted">狀況沒有變化時，可帶入上次答案後只修改有變的項目</span></div>` : ''}
  ${type === 'morse' ? '<div class="banner info small">已依系統紀錄自動帶入「3 個月內跌倒史」與「留置管路」，請確認。</div>' : ''}
  <div id="asForm">${sc.form ? formHTML(sc.fields, S.extra) :
    sc.items.map((it, i) => `<div class="q" data-q="${i}"><div class="qt">${i + 1}. ${esc(it[0])}</div><div class="opts">${it[1].map(([v, l]) => `<label><input type="radio" name="q${i}" value="${v}"${S.answers[i] !== undefined && +S.answers[i] === v ? ' checked' : ''}> ${esc(l)} <span class="muted small">(${v})</span></label>`).join('')}</div></div>`).join('')
    + (sc.extra ? `<div class="card">${formHTML(sc.extra, S.extra, 3)}</div>` : '')}
    ${sc.form ? '' : '<p class="small muted">小技巧：可用鍵盤數字鍵 1、2、3… 依序作答，答完自動跳下一題。</p>'}<label class="f">備註<textarea id="asNote" placeholder="觀察重點、特殊狀況">${esc(S.note)}</textarea></label></div>
  <div class="scorebar"><div><div class="small muted">即時計分</div><div class="big" id="asScore">－</div></div><div id="asLevel"></div><span class="sp"></span>
    ${queue ? `<span class="small muted">批次：剩 ${queue.length} 位</span>` : ''}${chain && chain.length ? `<span class="small muted">接著：${chain.map(t => SCALES[t].short).join('、')}</span>` : ''}<button class="btn" data-act="go" data-to="r/${r.id}">取消</button><button class="btn pri" data-act="saveAssess">${queue && queue.length ? '儲存並下一位' : chain && chain.length ? '儲存並下一個量表' : '儲存評估'}</button></div>
  <div id="asResult"></div>`;
};
ROUTES.after_assess = (rid, type) => {
  if (!rid || !type) return;
  const upd = () => {
    const S = assessState, sc = SCALES[type];
    if (sc.form) { S.extra = readForm(sc.fields, $('#asForm'), true); }
    else { sc.items.forEach((_, i) => { const c = $(`input[name=q${i}]:checked`); if (c) S.answers[i] = +c.value; }); if (sc.extra) S.extra = Object.assign(S.extra, readForm(sc.extra, $('#asForm'), true)); }
    if (type === 'mna' && S.extra.height && S.extra.weight) { const bmi = S.extra.weight / Math.pow(S.extra.height / 100, 2); const v = bmi < 19 ? 0 : bmi < 21 ? 1 : bmi < 23 ? 2 : 3; const rb = $(`input[name=q5][value="${v}"]`); if (rb && !rb.checked) { rb.checked = true; S.answers[5] = v; } }
    else if (type === 'mna' && S.extra.calf && !S.extra.weight) { const v = +S.extra.calf < 31 ? 0 : 3; const rb = $(`input[name=q5][value="${v}"]`); if (rb) { rb.checked = true; S.answers[5] = v; } }
    S.note = $('#asNote').value; S.date = $('#asDate').value;
    const { score, level } = scoreScale(type, S.answers, S.extra);
    const done = answeredAll(type, S.answers);
    $('#asScore').textContent = sc.form ? '－' : (done ? score : `${score}…`) + (sc.form ? '' : sc.errorBased ? ' 錯' : ` / ${sc.max}`);
    $('#asLevel').innerHTML = sc.form ? (S.extra.adapt && S.extra.mood && S.extra.family ? lvChip(level[0], level[1]) : '<span class="small muted">請填寫適應、情緒、家庭支持</span>') : done ? lvChip(level[0], level[1]) : `<span class="small muted">尚有 ${sc.items.filter((_, i) => S.answers[i] === undefined).length} 題未答</span>`;
    $$('.q').forEach(q => q.classList.remove('miss'));
  };
  $('#asForm').addEventListener('change', upd); $('#asForm').addEventListener('input', upd); upd();
};
ACT.startAssess = () => go(`assess/${$('#asRes').value}/${$('#asType').value}`);
ACT.copyPrev = () => { const p = assessState.prev; if (!p) return; assessState.answers = Object.assign({}, p.answers); assessState.extra = Object.assign({}, p.extra); refresh(); toast('已帶入上次答案，請確認有變化的項目'); };
ACT.batchAssess = el => {
  const t = el.dataset.t; const list = (window.__rem || []).filter(r => r.cat === '評估' && r.act.split(':')[2].split(',').includes(t)).map(r => r.rid); window.__chain = null;
  const uniq = [...new Set(list)].sort((a, b) => (resById(a).bed || '').localeCompare(resById(b).bed || '', 'zh-Hant', { numeric: true }));
  window.__batch = { type: t, list: uniq.slice(1) }; assessState = null; go(`assess/${uniq[0]}/${t}`);
};
ACT.saveAssess = () => {
  const S = assessState, sc = SCALES[S.type], r = resById(S.rid);
  if (!sc.form && !answeredAll(S.type, S.answers)) { sc.items.forEach((_, i) => { if (S.answers[i] === undefined) $(`.q[data-q="${i}"]`).classList.add('miss'); }); const m = $('.q.miss'); if (m) m.scrollIntoView({ block: 'center' }); toast('還有題目未作答（黃框）', 'bad'); return; }
  if (sc.form && !readForm(sc.fields, $('#asForm'))) return;
  if (S.date > today()) { toast('評估日期不可晚於今天', 'bad'); return; }
  const { score, level } = scoreScale(S.type, S.answers, S.extra);
  const a = save('assessments', { rid: S.rid, type: S.type, date: S.date, answers: Object.assign({}, S.answers), extra: Object.assign({}, S.extra), score, level: level[0], cls: level[1], note: S.note });
  if (S.type === 'mna' && S.extra.weight && !DB.weights.some(w => w.rid === S.rid && w.date === S.date)) save('weights', { rid: S.rid, date: S.date, kg: +S.extra.weight });
  const n = narrative(S.type, a, r);
  const sug = suggestProblems(r, latestAssess(r.id)).filter(s => { const p = latestPlan(r.id); return !(p && p.problems.some(x => x.key === s.key)); });
  assessState = null;
  const b = window.__batch;
  if (b && b.type === S.type && b.list.length) { const next = b.list.shift(); toast(`已儲存 ${r.name}：${level[0]}，下一位`); go(`assess/${next}/${S.type}`); return; }
  window.__batch = null;
  const ch = window.__chain;
  if (ch && ch.rid === S.rid && ch.list.length) { const nt = ch.list.shift(); toast(`已儲存 ${sc.short}：${level[0]}，接著評估 ${SCALES[nt].short}`); go(`assess/${S.rid}/${nt}`); return; }
  window.__chain = null;
  renderNav();
  $('#asResult').innerHTML = '';
  openModal('評估已儲存', `<p>${lvChip(level[0], level[1])}　${sc.form ? '' : `<b style="font-size:20px">${score}</b>`}</p>
    <h3>紀錄敘述句（可直接複製到護理／專業紀錄）</h3><div class="narr" id="narrOut">${esc(n)}</div><button class="btn sm" data-act="copy" data-from="#narrOut" style="margin-top:6px">複製</button>
    ${sug.length ? `<h3>照顧計畫建議（${sug.length}）</h3>${sug.map(s => `<div class="sugg"><b>${esc(s.problem)}</b> ${refChip(s.ref)}<div class="small muted">${esc(s.interventions)}</div></div>`).join('')}` : ''}`,
    sug.length ? () => { go(`r/${r.id}/plan`); } : null, { saveText: '前往照顧計畫加入建議', noFocus: true });
};

/* ===== 評估進度總表（矩陣） ===== */
ROUTES.matrix = () => {
  const res = activeResidents().filter(inHouse), T = today();
  const cols = [...CORE_SCALES.map(t => ['s', t, SCALES[t].short]), ['p', 'plan', '照顧計畫'], ['f', 'fam', '家屬討論'], ['c', '醫師巡診', '醫師'], ['c', '藥師評估', '藥師'], ['c', '家屬電訪／會談', '家屬電訪'], ['w', 'w', '體重']];
  const cell = (r, [k, x]) => {
    let last, cycle, act;
    if (k === 's') { const a = latestAssess(r.id)[x]; last = a && a.date >= r.admitDate ? a.date : null; cycle = scaleCycle(x); act = `assess:${r.id}:${x}`; if (!last) { const due = addDays(r.admitDate, 3); return [due < T ? 'bad' : 'warn', due < T ? '未評估' : '72h 內', act]; } }
    else if (k === 'p') { const p = latestPlan(r.id); last = p && p.date; cycle = 92; act = `plan:${r.id}`; if (!last) return [diffDays(r.admitDate, T) > 3 ? 'bad' : 'warn', '未擬定', act]; }
    else if (k === 'f') { const p = latestPlan(r.id); last = p && p.familyDate; cycle = 183; act = `plan:${r.id}`; if (!last) return [diffDays(r.admitDate, T) > 30 ? 'bad' : 'warn', '未討論', act]; }
    else if (k === 'c') { if (x === '家屬電訪／會談' && r.noFamily) return ['na', '不適用', '']; const c = latestContact(r.id, x); last = c && c.date; cycle = contactEvery(x); act = `contact:${r.id}:${x}`; if (!last) { const d = diffDays(r.admitDate, T); return [d > cycle ? 'bad' : 'warn', '無紀錄', act]; } }
    else if (k === 'w') { const w = weightsOf(r.id).pop(); last = w && w.date; cycle = 31; act = `weight:${r.id}`; if (!last) return ['bad', '無紀錄', act]; }
    const due = addDays(last, cycle), d = diffDays(T, due);
    return [d < 0 ? 'bad' : d <= 14 ? 'warn' : 'ok', roc(last).slice(roc(last).indexOf('/') + 1), act];
  };
  let nbad = 0; const rows = res.map(r => { const cs = cols.map(c => cell(r, c)); nbad += cs.filter(c => c[0] === 'bad').length; return `<tr><td class="nowrap"><a href="#/r/${r.id}">${esc(resLabel(r))}</a></td>${cs.map(([cls, txt, act]) => `<td><button class="cell ${cls}" ${act ? `data-act="doRem" data-a="${esc(act)}"` : ''} title="${cls === 'bad' ? '逾期' : cls === 'warn' ? '14 天內到期' : ''}">${esc(txt)}</button></td>`).join('')}</tr>`; });
  return `<h1>評估進度總表</h1><p class="sub">一眼看出每位住民各項評估與訪視是否在期限內（評估每 ${Math.round(facType().cycle / 30)} 個月、每半年家屬討論、醫師巡診每 ${Math.round(facType().doctor / 30)} 個月、每季藥師、每季家屬電訪、每月體重）。格子顯示上次日期，點格子直接處理。</p>
  <div class="row chips"><span class="cell ok">期限內</span><span class="cell warn">14 天內到期</span><span class="cell bad">逾期／未做</span><span class="sp"></span><span class="chip ${nbad ? 'bad' : 'ok'}">逾期 ${nbad} 格</span><button class="btn sm" data-act="printMatrix">列印總表</button></div>
  <div class="card" style="padding:0"><div class="tw"><table class="t matrix"><tr><th>住民</th>${cols.map(c => `<th>${c[2]}</th>`).join('')}</tr>${rows.join('') || '<tr><td colspan="20" class="empty">尚無在住住民</td></tr>'}</table></div></div>`;
};

/* ===== 每日照護紀錄（全區批次輸入） ===== */
let dailyDate = null, dailyFloor = '全部';
const DAILY_COLS = [['temp','體溫',0.1],['sbp','收縮壓',1],['dbp','舒張壓',1],['pulse','脈搏',1],['resp','呼吸',1],['spo2','血氧',1],['pain','疼痛',1],['sugar','血糖',1],['oob','下床次數',1]];
ROUTES.daily = () => {
  if (!dailyMode) { try { dailyMode = localStorage.getItem('ltc-dailyMode'); } catch (e) {} if (!dailyMode) dailyMode = innerWidth < 760 ? 'card' : 'grid'; }
  const d = dailyDate || today();
  const all = activeResidents(d).filter(r => r.admitDate <= d && (!r.dischargeDate || r.dischargeDate >= d));
  const floors = ['全部', ...new Set(all.map(r => (r.bed || '').match(/^[A-Za-z]*\d/) ? (r.bed.match(/^\D*(\d)/) || [, '?'])[1] + ' 樓' : '其他'))];
  const res = all.filter(r => dailyFloor === '全部' || ((r.bed || '').match(/^\D*(\d)/) || [, '?'])[1] + ' 樓' === dailyFloor);
  const filled = res.filter(r => DB.daily.some(x => x.rid === r.id && x.date === d && x.temp !== '' && x.temp != null)).length;
  const modeBar = `<div class="chips" style="margin:0"><button class="chip ${dailyMode === 'card' ? 'on' : ''}" data-act="dailyMode" data-m="card">床邊模式（一次一床）</button><button class="chip ${dailyMode === 'grid' ? 'on' : ''}" data-act="dailyMode" data-m="grid">全區表格</button></div>`;
  if (dailyMode === 'card') return `<div class="hd"><div><h1>每日照護紀錄</h1><p class="sub">床邊模式：手機、平板在床邊逐床紀錄，每個按鈕按下就存檔。</p></div></div><div class="row" style="margin-bottom:10px">${modeBar}<span class="sp"></span><input type="date" id="dailyDate" value="${d}" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px"><span class="chip ${filled === res.length ? 'ok' : 'warn'}">體溫 ${filled}/${res.length}</span></div><div class="chips">${floors.map(f => `<button class="chip ${f === dailyFloor ? 'on' : ''}" data-act="dailyFloor" data-f="${f}">${f}</button>`).join('')}</div>${bedsideHTML()}`;
  return `<div class="hd"><div><h1>每日照護紀錄</h1><p class="sub">全區一次輸入，自動存檔。異常值會變紅並出現在交班摘要（每日體溫、疼痛、下床、洗澡與口腔）。用 Tab 鍵往右、Enter 往下。</p></div></div><div style="margin-bottom:8px">${modeBar}</div>
  <div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="dailyShift" data-n="-1">◀ 前一天</button><input type="date" id="dailyDate" value="${d}" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px"><button class="btn sm" data-act="dailyShift" data-n="1" ${d >= today() ? 'disabled' : ''}>後一天 ▶</button>
    <div class="chips" style="margin:0 0 0 8px">${floors.map(f => `<button class="chip ${f === dailyFloor ? 'on' : ''}" data-act="dailyFloor" data-f="${f}">${f}</button>`).join('')}</div><span class="sp"></span>
    <span class="chip ${filled === res.length ? 'ok' : 'warn'}">體溫已記錄 ${filled}/${res.length}</span><button class="btn sm" data-act="dailyCopyOob">帶入昨日下床次數</button><button class="btn sm" data-act="printDailySheet">列印本日紀錄</button></div>
  <div class="card" style="padding:0"><div class="tw"><table class="t grid-in" id="dailyGrid"><tr><th>住民</th>${DAILY_COLS.map(c => `<th>${c[1]}</th>`).join('')}<th>洗澡</th><th>口腔清潔</th><th>排便</th><th>備註</th></tr>
  ${res.map(r => { const x = DB.daily.find(y => y.rid === r.id && y.date === d) || {}; const fl = vitalFlags(x);
    return `<tr data-rid="${r.id}" class="${x.id ? 'saved' : ''}"><td class="nowrap"><b>${esc(r.bed)}</b> ${esc(r.name)}${r.diet === '管灌' ? ' <span class="chip info">管灌</span>' : ''}</td>
    ${DAILY_COLS.map(([k, , st]) => `<td><input type="number" step="${st}" data-k="${k}" value="${esc(x[k] ?? '')}" class="${fl.some(f => f.startsWith({ temp: '體溫', sbp: '收縮壓', pulse: '脈搏', spo2: '血氧', pain: '疼痛', sugar: '血糖' }[k] || '#')) ? 'flag' : ''}" aria-label="${k}"></td>`).join('')}
    <td><input type="checkbox" data-k="bath" ${x.bath ? 'checked' : ''}></td><td><input type="checkbox" data-k="oral" ${x.oral ? 'checked' : ''}></td><td><input type="checkbox" data-k="bowel" ${x.bowel ? 'checked' : ''}></td>
    <td><input data-k="note" value="${esc(x.note || '')}" style="min-width:140px;text-align:left"></td></tr>`; }).join('') || '<tr><td colspan="14" class="empty">當天無在住住民</td></tr>'}</table></div></div>`;
};
ROUTES.after_daily = () => {
  const dd = $('#dailyDate'); if (dd) dd.addEventListener('change', e => { dailyDate = e.target.value; refresh(); });
  bindBedside();
  const g = $('#dailyGrid'); if (!g) return;
  g.addEventListener('change', e => {
    const inp = e.target, tr = inp.closest('tr[data-rid]'); if (!tr) return;
    const d = dailyDate || today(); const rid = tr.dataset.rid;
    let x = DB.daily.find(y => y.rid === rid && y.date === d) || { rid, date: d };
    const k = inp.dataset.k; x[k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value;
    if (k === 'temp' && x.temp !== '' && (x.temp < 34 || x.temp > 42)) { toast('體溫數值不合理，請確認', 'bad'); }
    save('daily', x); tr.classList.add('saved');
    const fl = vitalFlags(x); const map = { temp: '體溫', sbp: '收縮壓', pulse: '脈搏', spo2: '血氧', pain: '疼痛', sugar: '血糖' };
    $$('input[type=number]', tr).forEach(i => i.classList.toggle('flag', fl.some(f => f.startsWith(map[i.dataset.k] || '#'))));
    if (fl.length && ['temp', 'sbp', 'pulse', 'spo2', 'pain', 'sugar'].includes(k) && fl.some(f => f.startsWith(map[k]))) toast(`${resLabel(resById(rid))}：${fl.join('、')}，已列入交班`, 'bad');
    renderNav();
  });
  g.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return; e.preventDefault();
    const td = e.target.closest('td'), idx = [...td.parentNode.children].indexOf(td), next = td.parentNode.nextElementSibling;
    if (next) { const i = next.children[idx].querySelector('input'); if (i) { i.focus(); i.select && i.select(); } }
  });
};
ACT.dailyShift = el => { dailyDate = addDays(dailyDate || today(), +el.dataset.n); if (dailyDate > today()) dailyDate = today(); refresh(); };
ACT.dailyFloor = el => { dailyFloor = el.dataset.f; refresh(); };
ACT.dailyCopyOob = () => {
  const d = dailyDate || today(), y = addDays(d, -1); let n = 0;
  $$('#dailyGrid tr[data-rid]').forEach(tr => { const rid = tr.dataset.rid; const py = DB.daily.find(x => x.rid === rid && x.date === y); if (!py || py.oob === '' || py.oob == null) return; let x = DB.daily.find(z => z.rid === rid && z.date === d) || { rid, date: d }; if (x.oob === '' || x.oob == null) { x.oob = py.oob; save('daily', x); n++; } });
  toast(n ? `已帶入 ${n} 位住民昨日的下床次數，請確認` : '沒有可帶入的資料'); refresh();
};

/* ===== 異常事件 ===== */
let evType = '全部';
ROUTES.events = () => {
  const list = DB.events.filter(e => evType === '全部' || e.type === evType).sort((a, b) => b.date.localeCompare(a.date));
  const open = DB.events.filter(e => e.status !== '結案').length;
  return `<div class="hd"><div><h1>異常事件登錄</h1><p class="sub">跌倒、壓傷、感染、非計畫性住院、體重改變、管路、緊急送醫、申訴。每件需完成「原因分析＋處置＋改善」才算逐案分析（B12–B18、B22、D4）。</p></div><span class="sp"></span><button class="btn pri" data-act="newEvent">＋ 登錄事件</button></div>
  <div class="chips">${['全部', ...Object.keys(EVENT_TYPES), '管路移除'].map(t => `<button class="chip ${t === evType ? 'on' : ''}" data-act="evType" data-t="${esc(t)}">${esc(t)} ${t === '全部' ? DB.events.length : DB.events.filter(e => e.type === t).length}</button>`).join('')}</div>
  ${open ? `<div class="banner warn">尚有 ${open} 件未結案</div>` : ''}${eventTable(list, true)}`;
};
function eventTable(list, showRes) {
  return `<div class="card" style="padding:0"><div class="tw"><table class="t"><tr><th>日期</th>${showRes ? '<th>住民</th>' : ''}<th>類別</th><th>經過</th><th>分析／處置</th><th>狀態</th><th></th></tr>
  ${list.map(e => { const ok = e.cause && e.action; return `<tr><td class="nowrap">${roc(e.date)} ${esc(e.time || '')}</td>${showRes ? `<td class="nowrap"><a href="#/r/${e.rid}">${esc(resLabel(resById(e.rid)))}</a></td>` : ''}<td class="nowrap">${esc(e.type)} ${refChip((EVENT_TYPES[e.type] || {}).ref)}</td><td class="small">${esc((e.desc || '').slice(0, 60))}</td>
  <td>${ok ? '<span class="chip ok">已分析</span>' : '<span class="chip bad">待分析</span>'}</td><td><span class="chip ${e.status === '結案' ? '' : 'warn'}">${esc(e.status || '追蹤中')}</span></td>
  <td class="nowrap"><button class="btn sm" data-act="editEvent" data-id="${e.id}">開啟</button><button class="btn sm" data-act="printEvent" data-id="${e.id}">列印</button></td></tr>`; }).join('') || `<tr><td colspan="${showRes ? 7 : 6}" class="empty">尚無事件</td></tr>`}</table></div></div>`;
}
ACT.evType = el => { evType = el.dataset.t; refresh(); };
function openEvent(id, rid, type) {
  const e = id ? DB.events.find(x => x.id === id) : { id: uid(), _new: true, rid, type: type || '跌倒', date: today(), time: new Date().toTimeString().slice(0, 5), status: '追蹤中' };
  const draw = (t = e.type) => {
    const def = EVENT_TYPES[t] || { fields: [] };
    const base = [
      { key: 'rid', label: '住民', type: 'select', options: DB.residents.filter(r => inHouse(r) || r.id === e.rid).map(r => [r.id, resLabel(r)]), req: true },
      { key: 'date', label: '發生日期', type: 'date', req: true }, { key: 'time', label: '時間', type: 'time' },
      ...def.fields.map(k => Object.assign({ key: k }, EVENT_FIELD_DEF[k])),
      { key: 'desc', label: '事件經過（人、時、地、事、物）', type: 'textarea', wide: true, req: true },
      { key: 'immediate', label: '立即處置', type: 'textarea', wide: true },
      { key: 'notify', label: '通知', type: 'checks', options: ['家屬','醫師','業務負責人','主管機關'], wide: true },
      ...(t === '跌倒' ? [{ key: 'factors', label: '跌倒危險因子分析', type: 'checks', options: FALL_FACTORS, wide: true }] : []),
      { key: 'cause', label: '原因分析（逐案分析）', type: 'textarea', wide: true },
      { key: 'action', label: '處置與追蹤', type: 'textarea', wide: true },
      { key: 'improve', label: '改善方案（預防再發）', type: 'textarea', wide: true },
      { key: 'status', label: '狀態', type: 'select', options: ['追蹤中','結案'], blank: false },
    ];
    return base;
  };
  const render = () => `<label class="f req"><span>事件類別</span><select id="evTypeSel">${[...Object.keys(EVENT_TYPES), '管路移除'].map(t => `<option${t === e.type ? ' selected' : ''}>${t}</option>`).join('')}</select></label>${formHTML(draw(), e)}<div class="f"><span class="small muted">照片（傷口、現場；壓傷建議每次換藥拍照並放量尺）</span>${photoStrip('event:' + e.id)}</div><p class="small muted">原因分析與處置填寫完整，才會計為「已逐案分析」。</p>`;
  openModal(e._new ? '登錄異常事件' : `${e.type}事件`, render(), () => {
    const F = draw($('#evTypeSel').value); const o = readForm(F); if (!o) return false; o.type = $('#evTypeSel').value;
    if (o.status === '結案' && !(o.cause && o.action)) { toast('結案前請完成原因分析與處置', 'bad'); return false; }
    save('events', Object.assign(e, o));
    if (o.type === '管路移除') { const r = resById(o.rid); if (r && r.tubes) { if (/鼻胃/.test(o.desc)) r.tubes.ng = false; if (/導尿/.test(o.desc)) r.tubes.foley = false; save('residents', r); } }
    toast('事件已儲存' + (o.type === '跌倒' ? '，記得重新評估跌倒風險' : ''));
  }, { extraBtn: !e._new ? `<button class="btn danger" data-act="delEvent" data-id="${e.id}">刪除</button>` : '' });
  const bindEv = () => $('#evTypeSel').addEventListener('change', () => {
    const nt = $('#evTypeSel').value;
    const cur = readForm(draw(e.type), $('#mbody'), true);
    Object.assign(e, cur, { type: nt }); $('#mbody').innerHTML = render(); bindEv(); hydratePhotos($('#mbody'));
  });
  bindEv(); hydratePhotos($('#mbody'));
}
ACT.newEvent = () => openEvent(null, (activeResidents().filter(inHouse)[0] || {}).id);
ACT.newEventFor = el => openEvent(null, el.dataset.id, el.dataset.t);
ACT.editEvent = el => openEvent(el.dataset.id);
ACT.delEvent = el => { remove('events', el.dataset.id); closeModal(); refresh(); toast('已刪除'); };

/* ===== 約束管理 ===== */
ROUTES.restraint = () => {
  const act = DB.restraints.filter(x => !x.endDate), T = today();
  const past = DB.restraints.filter(x => x.endDate).sort((a, b) => b.endDate.localeCompare(a.endDate));
  return `<div class="hd"><div><h1>約束管理</h1><p class="sub">B15 與 D11 兩項皆須達 B 以上核心指標才達標。系統強制：個別化評估、約束前替代措施、目的限於「預防跌倒、預防自拔管路、行為紊亂、治療」、同意書 3 個月效期且不得預先簽署、每日監測與解除評估。</p></div><span class="sp"></span><button class="btn pri" data-act="newRestraint">＋ 約束評估與開始</button></div>
  <h2>目前約束中（${act.length}）</h2>${restraintTable(act)}
  <h2>已解除</h2>${restraintTable(past.slice(0, 30))}`;
};
function restraintTable(list) {
  const T = today();
  return `<div class="card" style="padding:0"><div class="tw"><table class="t"><tr><th>住民</th><th>開始</th><th>目的</th><th>型態</th><th>同意書效期</th><th>今日監測</th><th></th></tr>
  ${list.map(x => { const exp = addDays(x.consentDate || x.startDate, 90), d = diffDays(T, exp); const chk = (x.checks || []).filter(c => c.date === T);
    return `<tr><td class="nowrap"><a href="#/r/${x.rid}">${esc(resLabel(resById(x.rid)))}</a></td><td class="nowrap">${roc(x.startDate)}${x.endDate ? `<div class="small muted">解除 ${roc(x.endDate)}</div>` : ''}</td><td class="small">${esc((x.reasons || []).join('、'))}</td><td class="small">${esc(x.form || '')}</td>
    <td>${x.endDate ? '' : `<span class="chip ${d < 0 ? 'bad' : d <= 14 ? 'warn' : 'ok'}">${d < 0 ? '已過期' : `剩 ${d} 天`}</span>`}</td>
    <td>${x.endDate ? '' : chk.length ? `<span class="chip ok">已記錄 ${chk.length} 次</span>` : '<span class="chip bad">未記錄</span>'}</td>
    <td class="nowrap">${x.endDate ? '' : `<button class="btn sm pri" data-act="rsCheck" data-id="${x.id}">監測</button><button class="btn sm" data-act="rsEnd" data-id="${x.id}">解除</button>`}<button class="btn sm" data-act="rsEdit" data-id="${x.id}">開啟</button><button class="btn sm" data-act="printRestraint" data-id="${x.id}">同意書</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">無</td></tr>'}</table></div></div>`;
}
const RS_FIELDS = () => [
  { key: 'rid', label: '住民', type: 'select', options: activeResidents().filter(inHouse).map(r => [r.id, resLabel(r)]), req: true },
  { key: 'startDate', label: '開始日期', type: 'date', def: today(), req: true },
  { key: 'judge', label: '判斷依據', type: 'select', options: ['醫師診斷','護理人員專業判斷'], req: true }, { key: 'assessor', label: '評估人員', req: true, def: DB.settings.user ? DB.settings.user.name : '' },
  { key: 'reasons', label: '約束目的（僅限以下，其餘皆屬不當約束）', type: 'checks', options: ['預防跌倒','預防自拔管路','行為紊亂','因治療需要'], req: true, wide: true },
  { key: 'alternatives', label: '約束前已嘗試的替代措施', type: 'checks', options: ['增加巡視與陪伴','調整床高與床邊防護墊','離床警示','管路固定／遮蔽／改變管路位置','轉移注意力與活動安排','處理疼痛、口渴、如廁等需求','調整環境（光線、噪音）','醫師檢視藥物','家屬陪伴'], req: true, wide: true },
  { key: 'assessNote', label: '個別化評估說明', type: 'textarea', wide: true, req: true },
  { key: 'form', label: '約束型態', type: 'select', options: ['手部約束（手套）','手腕約束帶','約束背心','腰部約束帶','輪椅安全帶','其他'], req: true },
  { key: 'items', label: '約束用物' }, { key: 'period', label: '約束時間', ph: '例：夜間 22:00–06:00、管灌時' },
  { key: 'technique', label: '約束技術', ph: '例：可伸入兩指、綁於床架不可綁床欄' }, { key: 'care', label: '約束過程照顧', ph: '例：每 2 小時鬆綁 15 分鐘、觀察末梢循環' },
  { key: 'consentBy', label: '同意書簽署人', req: true }, { key: 'consentRel', label: '與住民關係', req: true, ph: '本人／配偶／子女／委託之縣市政府' },
  { key: 'consentDate', label: '同意書簽署日期（自簽訂日起 3 個月內有效）', type: 'date', def: today(), req: true },
];
function openRestraint(id, rid) {
  const x = id ? DB.restraints.find(y => y.id === id) : { rid, checks: [] };
  const F = RS_FIELDS();
  openModal(id ? '約束評估紀錄' : '約束評估與同意', formHTML(F, x) + (x.checks && x.checks.length ? `<h3>監測紀錄（${x.checks.length}）</h3><div class="small" style="max-height:160px;overflow:auto">${x.checks.slice().reverse().map(c => `● ${roc(c.date)} ${c.time}　皮膚${c.skin}／循環${c.circ}　${c.release ? '已鬆綁' : ''} ${esc(c.note || '')}　<span class="muted">${esc(c.by)}</span>`).join('<br>')}</div>` : ''), () => {
    const o = readForm(F); if (!o) return false;
    if (o.consentDate < o.startDate && diffDays(o.consentDate, o.startDate) > 1) { toast('同意書不可在評估前預先簽署（D11 逕評 E）。請以實際評估後簽署日期為準。', 'bad'); return false; }
    if (!id && activeResident(o.rid)) { toast('這位住民已有進行中的約束', 'bad'); return false; }
    save('restraints', Object.assign(x, o)); toast('已儲存約束評估，系統將每日提醒監測與到期');
  });
}
function activeResident(rid) { return activeRestraint(rid); }
function openRestraintCheck(id) {
  const x = DB.restraints.find(y => y.id === id); if (!x) return;
  const F = [{ key: 'time', label: '時間', type: 'time', def: new Date().toTimeString().slice(0, 5), req: true }, { key: 'skin', label: '皮膚', type: 'select', options: ['完整','發紅','破損'], def: '完整', blank: false }, { key: 'circ', label: '末梢循環', type: 'select', options: ['正常','冰冷／發紺','腫脹'], def: '正常', blank: false },
    { key: 'release', label: '已鬆綁活動並滿足需求（進食、如廁、翻身）', type: 'bool', def: true }, { key: 'canStop', label: '評估可解除約束', type: 'select', options: ['否，仍需約束','是，今日解除'], def: '否，仍需約束', blank: false }, { key: 'note', label: '備註', wide: true }];
  openModal(`約束監測：${resLabel(resById(x.rid))}`, formHTML(F, {}), () => {
    const o = readForm(F); if (!o) return false; o.date = today(); o.by = currentUser();
    x.checks = x.checks || []; x.checks.push(o); if (o.canStop.startsWith('是')) { x.endDate = today(); x.endReason = '監測評估可解除'; }
    save('restraints', x); toast(x.endDate ? '已解除約束' : '已記錄監測');
  });
}
ACT.newRestraint = () => openRestraint();
ACT.newRestraintFor = el => openRestraint(null, el.dataset.id);
ACT.rsEdit = el => openRestraint(el.dataset.id);
ACT.rsCheck = el => openRestraintCheck(el.dataset.id);
ACT.rsEnd = el => { const x = DB.restraints.find(y => y.id === el.dataset.id); const F = [{ key: 'endDate', label: '解除日期', type: 'date', def: today(), req: true }, { key: 'endReason', label: '解除原因', type: 'textarea', req: true }]; openModal('解除約束', formHTML(F, {}, 1), () => { const o = readForm(F); if (!o) return false; Object.assign(x, o); save('restraints', x); toast('已解除約束'); }); };

/* ===== 會議與活動 ===== */
let meetKind = '全部';
ROUTES.meet = () => {
  const list = DB.meetings.filter(m => meetKind === '全部' || m.kind === meetKind).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="hd"><div><h1>會議與活動</h1><p class="sub">品質會議、跨專業個案討論、團體活動、家屬座談、稽核、演練、滿意度調查。記錄後系統自動計算下次到期日。</p></div><span class="sp"></span><button class="btn pri" data-act="newMeeting">＋ 新增紀錄</button></div>
  <div class="card">${facilityStatusTable()}</div>
  <div class="chips">${['全部', ...MEETING_KINDS].map(k => `<button class="chip ${k === meetKind ? 'on' : ''}" data-act="meetKind" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>
  <div class="card" style="padding:0"><div class="tw"><table class="t"><tr><th>日期</th><th>類別</th><th>主題</th><th>參與</th><th>決議／評值</th><th></th></tr>
  ${list.map(m => `<tr><td class="nowrap">${roc(m.date)}</td><td class="nowrap">${esc(m.kind)}</td><td>${esc(m.title || '')}</td><td class="small">${esc(m.participants || '')}</td><td class="small">${esc((m.decisions || '').slice(0, 60))}</td><td class="nowrap"><button class="btn sm" data-act="editMeeting" data-id="${m.id}">開啟</button><button class="btn sm" data-act="printMeeting" data-id="${m.id}">列印</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">尚無紀錄</td></tr>'}</table></div></div>`;
};
ACT.meetKind = el => { meetKind = el.dataset.k; refresh(); };
function openMeeting(id, kind) {
  const m = id === '__tmp' ? DB.__tmpMeeting : id ? DB.meetings.find(x => x.id === id) : { id: uid(), _new: true, kind: kind || '服務品質會議', date: today() };
  const isGroup = /活動|座談/.test(m.kind);
  const F = [{ key: 'kind', label: '類別', type: 'select', options: MEETING_KINDS, req: true }, { key: 'date', label: '日期', type: 'date', req: true },
    { key: 'title', label: '主題', req: true, wide: true }, { key: 'participants', label: isGroup ? '參加成員' : '出席人員（職類）', wide: true, ph: isGroup ? '' : '主任、護理長、社工、職能治療師、營養師…' },
    ...(isGroup ? [{ key: 'count', label: '參加人數', type: 'number' }] : []),
    ...(m.kind === '跨專業個案討論' ? [{ key: 'rids', label: '討論個案', type: 'checks', options: activeResidents().filter(inHouse).map(r => resLabel(r)), wide: true }] : []),
    { key: 'content', label: isGroup ? '活動內容與過程' : '討論內容', type: 'textarea', wide: true },
    { key: 'decisions', label: isGroup ? '量與質之評值成果' : '決議事項', type: 'textarea', wide: true },
    { key: 'followup', label: '追蹤管考（執行情形）', type: 'textarea', wide: true }];
  openModal(m._new ? '新增會議／活動紀錄' : m.kind, formHTML(F, m) + `<div class="f"><span class="small muted">照片${isGroup ? '（評鑑需活動照片）' : '（簽到單、現場）'}</span>${photoStrip('meeting:' + m.id)}</div>`, () => { const o = readForm(F); if (!o) return false; save('meetings', Object.assign(m, o)); toast('已儲存，下次到期日已更新'); },
    { extraBtn: !m._new ? `<button class="btn danger" data-act="delMeeting" data-id="${m.id}">刪除</button>` : '' });
  hydratePhotos($('#mbody'));
  $('#mbody select[name=kind]').addEventListener('change', e => { const cur = readForm(F, $('#mbody'), true); $('#modal').classList.remove('on'); $('#modal').innerHTML = ''; modalSave = null; DB.__tmpMeeting = Object.assign({}, m, { kind: e.target.value }); openMeeting('__tmp'); Object.entries(cur || {}).forEach(([k, v]) => { const el = $(`#mbody [name="${k}"]`); if (el && k !== 'kind' && v !== '' && !Array.isArray(v)) el.value = v; }); });
}
ACT.newMeeting = el => openMeeting(null, el.dataset.k);
ACT.editMeeting = el => openMeeting(el.dataset.id);
ACT.delMeeting = el => { remove('meetings', el.dataset.id); closeModal(); refresh(); toast('已刪除'); };
