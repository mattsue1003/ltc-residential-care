/* ===== 效率優化：床邊模式、每 2 小時翻身/如廁、照護紀錄、批次登錄、數字鍵評估、字級 ===== */

/* ---------- 1. 床邊模式（手機/平板一次一床） ---------- */
let dailyMode = null, bedIdx = 0;
const SLOTS = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22'];
const TURN_SEQ = ['平躺', '左側', '右側', '半坐'], TOILET_SEQ = ['自解', '協助如廁', '換尿布', '失禁'];
function isBedbound(r) { return /臥床/.test(r.mobility || ''); }
function needsToilet(r) { return !!r.incontinence; }
function dailyResidents() {
  const d = dailyDate || today();
  return activeResidents(d).filter(r => dailyFloor === '全部' || ((r.bed || '').match(/^\D*(\d)/) || [, '?'])[1] + ' 樓' === dailyFloor);
}
function getDaily(rid, d) { return DB.daily.find(x => x.rid === rid && x.date === d) || { rid, date: d }; }
function setDaily(rid, d, patch) { const x = getDaily(rid, d); Object.assign(x, patch); save('daily', x); return x; }
function curSlot() { const h = new Date().getHours(); return String(h - (h % 2)).padStart(2, '0'); }
function bedsideHTML() {
  const list = dailyResidents(); if (!list.length) return '<div class="empty">當天無在住住民</div>';
  bedIdx = Math.max(0, Math.min(bedIdx, list.length - 1));
  const r = list[bedIdx], d = dailyDate || today(), x = getDaily(r.id, d), fl = vitalFlags(x), isToday = d === today(), cs = curSlot();
  const num = (k, label, step, ph) => `<label class="bs-num ${fl.some(f => f.startsWith(label.slice(0, 2))) ? 'flag' : ''}"><span>${label}</span><input type="number" inputmode="decimal" step="${step}" data-bk="${k}" value="${esc(x[k] ?? '')}" placeholder="${ph || ''}"></label>`;
  const tog = (k, label) => `<button class="bs-tog ${x[k] ? 'on' : ''}" data-act="bsTog" data-k="${k}">${x[k] ? '✓ ' : ''}${label}</button>`;
  const slotRow = (field, seq, title) => `<div class="bs-sec"><div class="row"><b>${title}</b><span class="small muted">點一下換下一個狀態</span><span class="sp"></span><span class="small">${Object.keys(x[field] || {}).length}/12</span></div>
    <div class="bs-slots">${SLOTS.map(s => { const v = (x[field] || {})[s]; return `<button class="bs-slot ${v ? 'on' : ''} ${isToday && s === cs ? 'now' : ''} ${isToday && s > cs ? 'future' : ''}" data-act="bsSlot" data-f="${field}" data-s="${s}" data-seq="${seq.join(',')}"><small>${s}</small>${esc(v || '－')}</button>`; }).join('')}</div></div>`;
  const la = latestAssess(r.id);
  return `<div class="bedside">
    <div class="bs-head"><button class="btn" data-act="bsMove" data-n="-1" ${bedIdx === 0 ? 'disabled' : ''} aria-label="上一床">◀</button>
      <select id="bsSel" aria-label="選擇住民">${list.map((y, i) => `<option value="${i}"${i === bedIdx ? ' selected' : ''}>${esc(resLabel(y))}${DB.daily.some(z => z.rid === y.id && z.date === d && z.temp !== '' && z.temp != null) ? ' ✓' : ''}</option>`).join('')}</select>
      <button class="btn" data-act="bsMove" data-n="1" ${bedIdx === list.length - 1 ? 'disabled' : ''} aria-label="下一床">▶</button></div>
    <div class="pill-badges" style="margin:6px 0">${resBadges(r)}${la.morse && la.morse.score >= 45 ? '' : ''}</div>
    ${fl.length ? `<div class="banner bad">異常：${fl.join('、')}（已列入交班）</div>` : ''}
    <div class="bs-grid">${num('temp', '體溫', '0.1', '36.5')}${num('sbp', '收縮壓', '1')}${num('dbp', '舒張壓', '1')}${num('pulse', '脈搏', '1')}${num('resp', '呼吸', '1')}${num('spo2', '血氧', '1')}${/糖尿病/.test(r.dx || '') || x.sugar ? num('sugar', '血糖', '1') : ''}</div>
    <div class="bs-sec"><b>疼痛</b><div class="bs-pain">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="${String(x.pain) === String(n) ? 'on' : ''} ${n >= 4 ? 'hi' : ''}" data-act="bsPain" data-n="${n}">${n}</button>`).join('')}</div></div>
    <div class="bs-sec row"><b>下床次數</b><span class="sp"></span><button class="btn" data-act="bsOob" data-n="-1" aria-label="減少">－</button><span class="bs-big">${+x.oob || 0}</span><button class="btn" data-act="bsOob" data-n="1" aria-label="增加">＋</button></div>
    <div class="bs-togs">${tog('bath', '洗澡')}${tog('oral', '口腔清潔')}${tog('bowel', '排便')}</div>
    ${isBedbound(r) ? slotRow('turns', TURN_SEQ, '翻身擺位（每 2 小時）') : ''}
    ${needsToilet(r) ? slotRow('toilets', TOILET_SEQ, '定時如廁（每 2 小時）') : ''}
    <label class="f">備註<textarea data-bk="note" rows="2">${esc(x.note || '')}</textarea></label>
    <div class="chips">${['精神佳', '食慾差', '咳嗽有痰', '情緒不穩', '拒絕服藥', '皮膚發紅'].map(p => `<button class="chip" data-act="bsPhrase" data-t="${p}">${p}</button>`).join('')}</div>
    <div class="row"><button class="btn" data-act="newNoteFor" data-id="${r.id}">＋ 照護紀錄</button><span class="sp"></span><button class="btn pri bs-next" data-act="bsMove" data-n="1" ${bedIdx === list.length - 1 ? 'disabled' : ''}>下一床 ▶</button></div>
  </div>`;
}
function bindBedside() {
  const sel = $('#bsSel'); if (!sel) return;
  sel.onchange = () => { bedIdx = +sel.value; refresh(); };
  $$('.bedside [data-bk]').forEach(inp => inp.onchange = () => {
    const list = dailyResidents(), r = list[bedIdx], d = dailyDate || today();
    const v = inp.type === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value;
    const x = setDaily(r.id, d, { [inp.dataset.bk]: v }); const fl = vitalFlags(x);
    if (fl.length && inp.type === 'number') toast(`${r.name}：${fl.join('、')}，已列入交班`, 'bad');
    renderNav(); if (inp.type === 'number') { const n = $$('.bedside input[type=number]'); const i = n.indexOf(inp); }
  });
}
function bsCur() { const list = dailyResidents(); return list[bedIdx]; }
ACT.bsMove = el => { bedIdx += +el.dataset.n; refresh(); window.scrollTo(0, 0); };
ACT.bsTog = el => { const r = bsCur(), d = dailyDate || today(), x = getDaily(r.id, d); setDaily(r.id, d, { [el.dataset.k]: !x[el.dataset.k] }); refresh(); };
ACT.bsPain = el => { const r = bsCur(), d = dailyDate || today(); setDaily(r.id, d, { pain: +el.dataset.n }); if (+el.dataset.n >= 4) toast('疼痛 ≥ 4 分：請記錄部位與處置（B15），可按「＋ 照護紀錄」', 'bad'); refresh(); };
ACT.bsOob = el => { const r = bsCur(), d = dailyDate || today(), x = getDaily(r.id, d); setDaily(r.id, d, { oob: Math.max(0, (+x.oob || 0) + +el.dataset.n) }); refresh(); };
ACT.bsSlot = el => {
  const r = bsCur(), d = dailyDate || today(), x = getDaily(r.id, d), f = el.dataset.f, seq = el.dataset.seq.split(',');
  const m = Object.assign({}, x[f] || {}), cur = m[el.dataset.s], i = seq.indexOf(cur);
  if (i === seq.length - 1) delete m[el.dataset.s]; else m[el.dataset.s] = seq[i + 1];
  setDaily(r.id, d, { [f]: m }); refresh();
};
ACT.bsPhrase = el => { const ta = $('.bedside textarea[data-bk=note]'); ta.value = (ta.value ? ta.value + '，' : '') + el.dataset.t; ta.dispatchEvent(new Event('change')); };
ACT.dailyMode = el => { dailyMode = el.dataset.m; try { localStorage.setItem('ltc-dailyMode', dailyMode); } catch (e) {} refresh(); };

/* ---------- 2. 照護紀錄（護理／社工／治療） ---------- */
const NOTE_PHRASES = {
  '護理人員': ['生命徵象穩定', '意識清楚、對答切題', '食慾佳，進食約八分', '傷口無紅腫滲液', '已依醫囑給藥並觀察反應', '已通知家屬', '持續觀察'],
  '社工人員': ['住民情緒穩定，主動與他人互動', '住民表達思念家人，已聯繫家屬', '參與團體活動，表情愉悅', '協助處理財物／證件事宜', '持續關懷追蹤'],
  '職能治療師': ['執行 ADL 訓練（進食／穿衣）', '進行認知訓練與現實導向', '輔具評估並指導使用', '上肢功能訓練', '參與度佳'],
  '物理治療師': ['執行下肢肌力訓練', '平衡與步態訓練', '被動關節活動', '轉位訓練', '耐受度佳，無不適'],
  '營養師': ['評估進食量與體重變化', '調整飲食質地', '建議增加蛋白質攝取', '衛教家屬營養補充'],
  '照顧服務員': ['協助沐浴與更衣', '協助進食，進食良好', '定時翻身擺位', '協助如廁', '陪同散步'],
};
function notePhrases() { const role = (Cloud.on && Cloud.profile ? Cloud.profile.role : (DB.settings.user || {}).role) || '護理人員'; return NOTE_PHRASES[role] || NOTE_PHRASES['護理人員']; }
function myRole() { return (Cloud.on && Cloud.profile ? Cloud.profile.role : (DB.settings.user || {}).role) || ''; }
let noteFilter = '全部';
ROUTES.notes = () => {
  const T = today();
  const list = DB.notes.filter(n => diffDays(n.date, T) <= 3 && (noteFilter === '全部' || n.disc === noteFilter || (noteFilter === '交班' && n.handover))).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const discs = ['全部', '交班', ...new Set(DB.notes.map(n => n.disc).filter(Boolean))];
  return `<div class="hd"><div><h1>照護紀錄</h1><p class="sub">護理、社工、治療、照服紀錄。可一鍵帶入今日生命徵象、最新評估摘要與照顧計畫問題；勾「交班」會出現在交班摘要。以下為近 3 天。</p></div><span class="sp"></span><button class="btn pri" data-act="newNote">＋ 新增紀錄</button></div>
  <div class="chips">${discs.map(d => `<button class="chip ${d === noteFilter ? 'on' : ''}" data-act="noteFilter" data-f="${esc(d)}">${esc(d)}</button>`).join('')}</div>
  ${noteListHTML(list, true)}`;
};
function noteListHTML(list, showRes) {
  return list.length ? list.map(n => `<div class="card" style="padding:12px 14px"><div class="row small"><b>${roc(n.date)} ${esc(n.time || '')}</b>${showRes ? `<a href="#/r/${n.rid}">${esc(resLabel(resById(n.rid)))}</a>` : ''}${n.title ? `<span class="chip pri">${esc(n.title)}</span>` : ''}<span class="chip">${esc(n.disc || '')}</span>${n.kind !== '一般' ? `<span class="chip">${esc(n.kind)}</span>` : ''}${n.eventId ? '<span class="chip warn">已登錄品質指標</span>' : ''}${n.handover ? '<span class="chip warn">交班</span>' : ''}<span class="sp"></span><span class="muted">${esc(n.by || '')}</span><button class="btn sm" data-act="editNote" data-id="${n.id}">編輯</button></div>
    <div style="white-space:pre-wrap;margin-top:6px">${esc(noteText(n))}</div></div>`).join('') : '<div class="card empty">尚無紀錄</div>';
}
function noteText(n) { if (n.kind === 'SOAP') return ['S', 'O', 'A', 'P'].map(k => n[k] ? `${k}：${n[k]}` : '').filter(Boolean).join('\n'); if (n.kind === 'DAR') return [['D', '資料'], ['A', '措施'], ['R', '反應']].map(([k, l]) => n[k] ? `${l}：${n[k]}` : '').filter(Boolean).join('\n'); return n.text || ''; }
ACT.noteFilter = el => { noteFilter = el.dataset.f; refresh(); };
function vitalsSentence(rid) {
  const d = DB.daily.find(x => x.rid === rid && x.date === today()) || DB.daily.filter(x => x.rid === rid).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!d) return '今日尚無生命徵象紀錄。';
  const parts = [d.temp !== '' && d.temp != null && `體溫 ${d.temp}℃`, d.sbp && `血壓 ${d.sbp}/${d.dbp || ''} mmHg`, d.pulse && `脈搏 ${d.pulse} 次/分`, d.resp && `呼吸 ${d.resp} 次/分`, d.spo2 && `血氧 ${d.spo2}%`, d.pain !== '' && d.pain != null && `疼痛 ${d.pain} 分`, d.sugar && `血糖 ${d.sugar} mg/dL`].filter(Boolean);
  return `${d.date === today() ? '今日' : roc(d.date)}生命徵象：${parts.join('、')}。${vitalFlags(d).length ? '異常：' + vitalFlags(d).join('、') + '。' : ''}`;
}
function assessSentence(rid) { const la = latestAssess(rid), r = resById(rid); const recent = Object.values(la).filter(a => diffDays(a.date, today()) <= 30); return recent.length ? recent.map(a => narrative(a.type, a, r)).join('\n') : '近 30 天無評估。'; }
function planSentence(rid) { const p = latestPlan(rid); return p && p.problems.length ? '照顧問題：' + p.problems.map((x, i) => `#${i + 1} ${x.problem}`).join('；') : '尚無照顧計畫。'; }
function openNote(id, rid) {
  const n = id ? DB.notes.find(x => x.id === id) : { rid: rid || '', date: today(), time: new Date().toTimeString().slice(0, 5), kind: myRole() === '護理人員' ? 'DAR' : '一般', disc: myRole(), handover: false };
  const body = () => `${tplPicker()}<div class="grid g3">${field({ key: 'rid', label: '住民', type: 'select', options: DB.residents.filter(r => inHouse(r) || r.id === n.rid).map(r => [r.id, resLabel(r)]), req: true }, n.rid)}${field({ key: 'date', label: '日期', type: 'date' }, n.date)}${field({ key: 'time', label: '時間', type: 'time' }, n.time)}</div>
    <div class="chips">${['一般', 'DAR', 'SOAP'].map(k => `<button class="chip ${n.kind === k ? 'on' : ''}" data-act="noteKind" data-k="${k}">${k === 'DAR' ? 'DAR（資料／措施／反應）' : k === 'SOAP' ? 'SOAP' : '一般紀錄'}</button>`).join('')}</div>
    <div class="row small" style="margin-bottom:6px"><span class="muted">帶入：</span><button class="btn sm" data-act="noteIns" data-w="v">今日生命徵象</button><button class="btn sm" data-act="noteIns" data-w="a">最新評估摘要</button><button class="btn sm" data-act="noteIns" data-w="p">照顧計畫問題</button></div>
    ${n.kind === 'SOAP' ? ['S', 'O', 'A', 'P'].map(k => field({ key: k, label: { S: 'S 主觀資料（住民或家屬陳述）', O: 'O 客觀資料（觀察、量測）', A: 'A 評估', P: 'P 計畫' }[k], type: 'textarea' }, n[k])).join('')
      : n.kind === 'DAR' ? [['D', 'D 資料（觀察到的狀況）'], ['A', 'A 措施（做了什麼）'], ['R', 'R 反應（結果與評值）']].map(([k, l]) => field({ key: k, label: l, type: 'textarea' }, n[k])).join('')
      : field({ key: 'text', label: '紀錄內容', type: 'textarea' }, n.text)}
    <div class="chips">${notePhrases().map(p => `<button class="chip" data-act="notePhrase" data-t="${esc(p)}">${esc(p)}</button>`).join('')}</div>
    ${field({ key: 'handover', label: '列入交班', type: 'bool' }, n.handover)}`;
  const F = () => [{ key: 'rid', req: true, label: '住民' }, { key: 'title' }, { key: 'date' }, { key: 'time' }, { key: 'handover', type: 'bool' }].concat((n.kind === 'SOAP' ? ['S', 'O', 'A', 'P'] : n.kind === 'DAR' ? ['D', 'A', 'R'] : ['text']).map(k => ({ key: k })));
  window.__noteDraft = { n, body, F };
  openModal(id ? '編輯照護紀錄' : '新增照護紀錄', body(), () => {
    const o = readForm(F()); if (!o) return false;
    if (!noteText(Object.assign({ kind: n.kind }, o)).trim()) { toast('紀錄內容是空的', 'bad'); return false; }
    Object.assign(n, o); const made = applyNoteLinks(n); save('notes', n); toast('已儲存照護紀錄' + (made.length ? `，並登錄：${made.join('、')}` : '') + (n.handover ? '，已列入交班' : ''));
  }, { extraBtn: id ? `<button class="btn danger" data-act="delNote" data-id="${id}">刪除</button>` : '' });
  $('#mbody').addEventListener('focusin', e => { if (e.target.tagName === 'TEXTAREA') window.__noteTA = e.target; });
}
ACT.newNote = () => openNote(); ACT.newNoteFor = el => openNote(null, el.dataset.id); ACT.editNote = el => openNote(el.dataset.id);
ACT.delNote = el => { const id = el.dataset.id, x = DB.notes.find(y => y.id === id) || {}; if (!confirm('確定刪除這筆照護紀錄？刪除後無法復原。')) return; logAccess('刪除照護紀錄', x.rid); remove('notes', id); closeModal(); refresh(); toast('已刪除'); };
ACT.noteKind = el => { const D = window.__noteDraft; Object.assign(D.n, readForm(D.F(), $('#mbody'), true)); D.n.kind = el.dataset.k; $('#mbody').innerHTML = D.body(); };
ACT.noteIns = el => {
  const D = window.__noteDraft, rid = $('#mbody [name=rid]').value;
  const t = el.dataset.w === 'v' ? vitalsSentence(rid) : el.dataset.w === 'a' ? assessSentence(rid) : planSentence(rid);
  const ta = window.__noteTA && document.body.contains(window.__noteTA) ? window.__noteTA : $('#mbody textarea'); ta.value = (ta.value ? ta.value + '\n' : '') + t; ta.focus();
};
ACT.notePhrase = el => { const ta = window.__noteTA && document.body.contains(window.__noteTA) ? window.__noteTA : $('#mbody textarea'); ta.value = (ta.value ? ta.value + '，' : '') + el.dataset.t; ta.focus(); };

/* ---------- 3. 批次登錄 ---------- */
const BATCH_TYPES = {
  '醫師巡診': { kind: 'contact', def: '生命徵象穩定，續原醫囑。' },
  '藥師評估': { kind: 'contact', def: '用藥無重複或交互作用。' },
  '家屬電訪／會談': { kind: 'contact', def: '說明近況與照顧計畫，家屬了解並同意。' },
  '年度健康檢查': { kind: 'contact', def: '胸部 X 光、血液常規、生化、尿液檢查，醫師判讀無異常。' },
  '靈性關懷': { kind: 'contact', def: '陪伴宗教活動，情緒平穩。' },
  '體重': { kind: 'weight' },
  '流感疫苗': { kind: 'vaccine', v: '流感' }, 'COVID-19 疫苗': { kind: 'vaccine', v: 'COVID-19' },
};
let batchType = '醫師巡診', batchDate = null;
function batchDue(r) {
  const t = BATCH_TYPES[batchType];
  if (t.kind === 'contact') return (window.__rem || []).some(x => x.rid === r.id && x.act === `contact:${r.id}:${batchType}`) || (batchType === '靈性關懷' ? false : false);
  if (t.kind === 'weight') { const w = weightsOf(r.id).pop(); return !w || diffDays(w.date, today()) >= 25; }
  if (t.kind === 'vaccine') return !DB.vaccines.some(v => v.rid === r.id && v.kind === t.v && diffDays(v.date, today()) < 300);
  return false;
}
ROUTES.batch = () => {
  const t = BATCH_TYPES[batchType], d = batchDate || today();
  const res = activeResidents().filter(inHouse).filter(r => !(batchType === '家屬電訪／會談' && r.noFamily));
  const row = r => {
    const due = batchDue(r);
    if (t.kind === 'weight') { const w = weightsOf(r.id).pop(); return `<tr data-rid="${r.id}"><td class="nowrap">${esc(resLabel(r))}</td><td class="small muted nowrap">${w ? `${w.kg} kg（${roc(w.date)}）` : '無'}</td><td><input type="number" step="0.1" inputmode="decimal" data-kg data-prev="${w ? w.kg : ''}" style="width:90px"></td><td class="small" data-pct></td></tr>`; }
    return `<tr data-rid="${r.id}"><td><input type="checkbox" data-pick ${due ? 'checked' : ''} aria-label="選取"></td><td class="nowrap">${esc(resLabel(r))} ${due ? '<span class="chip warn">到期</span>' : ''}</td>
      ${t.kind === 'contact' ? `<td><input data-note placeholder="（空白則用共同內容）" style="width:100%"></td>` : `<td><select data-vs style="padding:4px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)"><option value="">已接種</option><option>本人或家屬拒絕</option><option>醫師評估暫緩</option><option>對疫苗成分過敏</option></select></td>`}</tr>`;
  };
  return `<div class="hd"><div><h1>批次登錄</h1><p class="sub">醫師巡診、藥師評估、家屬電訪、體重、疫苗一次登錄全部住民。系統會先勾好「到期」的住民。</p></div></div>
  <div class="chips">${Object.keys(BATCH_TYPES).map(k => `<button class="chip ${k === batchType ? 'on' : ''}" data-act="batchType" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>
  <div class="card"><div class="grid g3"><label class="f">日期<input type="date" id="bDate" value="${d}"></label>${t.kind === 'contact' ? `<label class="f" style="grid-column:span 2">共同內容<input id="bCommon" value="${esc(t.def)}"></label>` : ''}</div>
  ${t.kind === 'vaccine' ? '<div class="checks"><label><input type="checkbox" id="bNote"> 同時寫入護理紀錄（施打疫苗範本，已接種者）</label><label>同意者 <select id="bConsent" style="padding:4px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)"><option>經家屬同意</option><option>經住民本人同意</option></select></label><label>評估醫師 <input id="bDoc" value="巡診醫師" style="width:110px;padding:4px;border:1px solid var(--line);border-radius:6px"></label></div>' : ''}
  ${t.kind !== 'weight' ? '<div class="row" style="margin-bottom:8px"><button class="btn sm" data-act="bPick" data-v="all">全選</button><button class="btn sm" data-act="bPick" data-v="due">只選到期</button><button class="btn sm" data-act="bPick" data-v="none">全不選</button></div>' : '<p class="small muted">直接輸入本次體重，Enter 跳下一位；30 天內變化 ≥ 5% 會標紅（B19）。</p>'}
  <div class="tw"><table class="t" id="bTable">${t.kind === 'weight' ? '<tr><th>住民</th><th>上次</th><th>本次 kg</th><th>變化</th></tr>' : `<tr><th></th><th>住民</th><th>${t.kind === 'contact' ? '個別內容' : '狀態'}</th></tr>`}${res.map(row).join('')}</table></div>
  <div class="row" style="margin-top:12px"><span class="sp"></span><span id="bCount" class="small muted"></span><button class="btn pri" data-act="bSave">儲存</button></div></div>`;
};
ROUTES.after_batch = () => {
  const upd = () => { const n = BATCH_TYPES[batchType].kind === 'weight' ? $$('#bTable [data-kg]').filter(i => i.value).length : $$('#bTable [data-pick]:checked').length; $('#bCount').textContent = `將登錄 ${n} 位`; };
  $('#bTable').addEventListener('input', e => {
    if (e.target.dataset.kg !== undefined) { const p = +e.target.dataset.prev, v = +e.target.value, td = e.target.closest('tr').querySelector('[data-pct]'); if (p && v) { const pct = (v - p) / p * 100; td.innerHTML = `<span class="chip ${Math.abs(pct) >= 5 ? 'bad' : 'ok'}">${pct > 0 ? '+' : ''}${pct.toFixed(1)}%</span>`; } else td.innerHTML = ''; }
    upd();
  });
  $('#bTable').addEventListener('change', upd);
  $('#bTable').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.kg !== undefined) { e.preventDefault(); const nx = e.target.closest('tr').nextElementSibling; if (nx) nx.querySelector('[data-kg]').focus(); } });
  $('#bDate').addEventListener('change', e => batchDate = e.target.value);
  upd();
};
ACT.batchType = el => { batchType = el.dataset.k; refresh(); };
ACT.bPick = el => { $$('#bTable tr[data-rid]').forEach(tr => { const cb = tr.querySelector('[data-pick]'); cb.checked = el.dataset.v === 'all' || (el.dataset.v === 'due' && !!tr.querySelector('.chip.warn')); }); $('#bTable').dispatchEvent(new Event('change')); };
ACT.bSave = () => {
  const t = BATCH_TYPES[batchType], d = $('#bDate').value || today(); let n = 0, alerts = [];
  if (d > today()) { toast('日期不可晚於今天', 'bad'); return; }
  $$('#bTable tr[data-rid]').forEach(tr => {
    const rid = tr.dataset.rid;
    if (t.kind === 'weight') { const v = tr.querySelector('[data-kg]').value; if (!v) return; if (+v < 20 || +v > 200) { alerts.push(resLabel(resById(rid)) + ' 數值不合理'); return; } save('weights', { rid, date: d, kg: +v }); n++; const wa = weightAlert(rid); if (wa) alerts.push(`${resById(rid).name} ${wa.pct.toFixed(1)}%`); return; }
    if (!tr.querySelector('[data-pick]').checked) return;
    if (t.kind === 'contact') { save('contacts', { rid, kind: batchType, date: d, content: tr.querySelector('[data-note]').value.trim() || $('#bCommon').value.trim(), with: '' }); n++; }
    else { const s = tr.querySelector('[data-vs]').value; save('vaccines', { rid, kind: t.v, date: d, refused: !!s, reason: s }); n++;
      if (!s && $('#bNote') && $('#bNote').checked) save('notes', { rid, date: d, time: new Date().toTimeString().slice(0, 5), kind: '一般', title: '施打疫苗', disc: myRole(), handover: false, text: NOTE_TEMPLATES['施打疫苗'].text({ vac: t.v === '流感' ? '流感疫苗' : '新冠疫苗', doc: $('#bDoc').value || '巡診醫師', consent: $('#bConsent').value }) }); }
  });
  if (!n) { toast('沒有選取任何住民', 'bad'); return; }
  logAccess(`批次登錄${batchType} ${n} 位`);
  toast(`已登錄 ${n} 位住民的${batchType}` + (alerts.length ? `；注意：${alerts.join('、')}` : ''), alerts.length ? 'bad' : '');
  refresh();
};

/* ---------- 4. 評估量表數字鍵 ---------- */
document.addEventListener('keydown', e => {
  if (ROUTE.page !== 'assess' || !$('.q') || $('#modal.on') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && document.activeElement.type !== 'radio') return;
  if (!/^[1-9]$/.test(e.key)) return;
  const qs = $$('.q'); let q = qs.find(x => x.classList.contains('cur')) || qs.find(x => !x.querySelector('input:checked')); if (!q) return;
  const opt = q.querySelectorAll('input[type=radio]')[+e.key - 1]; if (!opt) return;
  e.preventDefault(); opt.checked = true; opt.dispatchEvent(new Event('change', { bubbles: true }));
  q.classList.remove('cur'); const nx = qs.slice(qs.indexOf(q) + 1).find(x => !x.querySelector('input:checked'));
  if (nx) { nx.classList.add('cur'); nx.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else $('[data-act=saveAssess]').focus();
});
document.addEventListener('click', e => { const q = e.target.closest('.q'); if (q && ROUTE.page === 'assess') { $$('.q.cur').forEach(x => x.classList.remove('cur')); const nx = $$('.q').slice($$('.q').indexOf(q) + 1).find(x => !x.querySelector('input:checked')); if (nx && e.target.type === 'radio') nx.classList.add('cur'); } });

/* ---------- 5. 字級 ---------- */
function applyFontScale() { let z = 1; try { z = +(localStorage.getItem('ltc-zoom') || 1); } catch (e) {} document.documentElement.style.setProperty('--zoom', z); $('#app') && ($('#app').style.zoom = z); }
ACT.zoom = el => { try { localStorage.setItem('ltc-zoom', el.dataset.z); } catch (e) {} applyFontScale(); toast('已調整字級'); };
