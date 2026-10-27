/* ===== 品質指標：收案分析改善單、指標監測月統計表、季 PDCA、年度分析（依機構現行紙本格式） ===== */

/* --- 收案單共用欄位 --- */
Object.assign(EVENT_FIELD_DEF, {
  shift: { label: '發生班別', type: 'select', options: ['D 白班', 'E 小夜', 'N 大夜'] },
  within72: { label: '入住 72 小時內', type: 'select', options: ['否', '是'] },
  tubesAt: { label: '留置管路', type: 'checks', options: ['鼻胃管', '導尿管', '氣切管', '造廔口', '透析', '其他', '無'] },
  dxs: { label: '主診斷', type: 'checks', options: ['高血壓', '糖尿病', '慢性腎病', '失智症', '腦中風', '心臟病', '巴金森氏症', '其他'] },
  dxOther: { label: '其他診斷', type: 'text' },
  hospPlanned: { label: '住院類別', type: 'select', options: ['非計畫性', '計畫性（排程檢查、手術）'] },
  hospCause: { label: '住院原因', type: 'select', options: ['心血管代償機能減退', '腸胃道出血', '骨折', '感染', '其他內外科'] },
  hospCauseD: { label: '原因說明', type: 'text', ph: '例：肺積水、肺炎' },
  returnDate: { label: '返回機構日期（保留床截止）', type: 'date' },
  fallCause: { label: '主要原因類別', type: 'select', options: ['個人因素', '環境因素', '藥物因素', '設備因素', '照護人力因素', '其他'] },
  wChange: { label: '體重變化', type: 'select', options: ['減輕 ≥ 5%', '增加 ≥ 5%'] },
  qaSign: { label: '品管負責人', type: 'text' }, mgrSign: { label: '單位主管', type: 'text' },
});
EVENT_TYPES['非計畫性住院'].fields = ['hospPlanned', 'hospCause', 'hospCauseD', 'hospital', 'dx', 'returnDate'];
EVENT_TYPES['跌倒'].fields = ['place', 'injury', 'fallCause'];
EVENT_TYPES['非計畫性體重改變'].fields = ['wChange'];
const EVENT_COMMON_TOP = ['shift', 'within72', 'tubesAt', 'dxs', 'dxOther'];
function shiftOf(time) { const h = +(time || '12').slice(0, 2); return h >= 7 && h < 15 ? 'D 白班' : h >= 15 && h < 23 ? 'E 小夜' : 'N 大夜'; }
function eventDefaults(e) {
  const r = resById(e.rid) || {};
  if (!e.shift) e.shift = shiftOf(e.time);
  if (!e.within72 && r.admitDate && e.date) e.within72 = diffDays(r.admitDate, e.date) <= 3 ? '是' : '否';
  if (!e.tubesAt) e.tubesAt = r.tubes ? [r.tubes.ng && '鼻胃管', r.tubes.foley && '導尿管', r.tubes.trach && '氣切管'].filter(Boolean) : [];
  if (!e.tubesAt.length) e.tubesAt = ['無'];
  if (!e.followups) e.followups = [];
  return e;
}
function followupHTML(e) {
  return `<div class="f"><span class="small muted">成果追蹤（逐日記錄後續狀況）</span><div id="fuList">${(e.followups || []).map((f, i) => fuRow(f, i)).join('')}</div>
    <button class="btn sm" data-act="fuAdd">＋ 新增追蹤</button></div>`;
}
function fuRow(f, i) { return `<div class="row fu" style="margin:4px 0"><input type="date" value="${esc(f.date || today())}" data-fu="date" style="padding:6px;border:1px solid var(--line);border-radius:6px"><input value="${esc(f.text || '')}" data-fu="text" placeholder="例：轉普通病房、穩定出院返機構" style="flex:1;padding:6px;border:1px solid var(--line);border-radius:6px"><button class="btn sm ghost" data-act="fuDel" title="刪除">✕</button></div>`; }
ACT.fuAdd = () => { $('#fuList').insertAdjacentHTML('beforeend', fuRow({ date: today(), text: '' }, 0)); $$('#fuList [data-fu=text]').pop().focus(); };
ACT.fuDel = el => el.closest('.fu').remove();
function readFollowups() { return $$('#fuList .fu').map(r => ({ date: r.querySelector('[data-fu=date]').value, text: r.querySelector('[data-fu=text]').value.trim() })).filter(f => f.text); }

/* --- 指標定義：資料收集項目 + 監測公式 + 預設閾值（可在系統內修改） --- */
const QI = [
  { no: 1, name: '跌倒指標監測', type: '跌倒',
    data: [['pd', '當月住民總人日數', '保留床人日數'], ['n', '當月住民總人數'], ['t', '當月住民跌倒人次'], ['p', '當月住民跌倒人數'], ['inj', '當月跌倒造成傷害人次'], ['sev', '當月跌倒造成重度傷害人次'], ['h72', '當月入住72小時(含)內跌倒人次'], ['night', '當月大夜班跌倒人次']],
    cat: { field: 'fallCause', label: '因「%」跌倒人次', opts: ['個人因素', '環境因素', '藥物因素', '設備因素', '照護人力因素', '其他'] },
    mon: [['1.1', '跌倒發生率', 't', 'n', 100, '%', '<', 3, '當月住民跌倒人次／當月住民總人數*100%'], ['1.2', '跌倒發生密度', 't', 'pd', 1000, '‰', '<', 1, '當月住民跌倒人次／當月住民總人日數*1000‰'], ['1.3', '跌倒造成傷害比率', 'inj', 't', 100, '%', '<', 50, '跌倒造成傷害人次／當月跌倒人次*100%'], ['1.4', '跌倒造成重度傷害比率', 'sev', 't', 100, '%', '<', 5, '重度傷害人次／當月跌倒人次*100%']] },
  { no: 2, name: '壓力性損傷指標監測', type: '壓力性損傷',
    data: [['pd', '當月住民總人日數', '保留床人日數'], ['n', '當月住民總人數'], ['newT', '當月機構內新發生壓力性損傷人次'], ['newP', '當月機構內新發生壓力性損傷人數'], ['inT', '當月帶入（入住或住院返回）人次'], ['prevP', '當月有壓力性損傷之住民人數'], ['g2', '當月新發生第 2 級以上人次']],
    mon: [['2.1', '機構內新發生率', 'newT', 'n', 100, '%', '<', 2, '當月新發生人次／當月住民總人數*100%'], ['2.2', '機構內新發生密度', 'newT', 'pd', 1000, '‰', '<', 0.5, '當月新發生人次／當月住民總人日數*1000‰'], ['2.3', '壓力性損傷盛行率', 'prevP', 'n', 100, '%', '<', 5, '當月有壓力性損傷住民人數／當月住民總人數*100%'], ['2.4', '新發生第 2 級以上比率', 'g2', 'newT', 100, '%', '', '', '第 2 級以上人次／當月新發生人次*100%']] },
  { no: 3, name: '約束指標監測', type: null,
    data: [['pd', '當月住民總人日數', '保留床人日數'], ['n', '當月住民總人數'], ['rd', '當月約束人日數'], ['rp', '當月約束人數'], ['bad', '當月同意書逾期或評估不完整人數']],
    mon: [['3.1', '約束率（人日）', 'rd', 'pd', 100, '%', '<', 10, '當月約束人日數／當月住民總人日數*100%'], ['3.2', '約束人數比率', 'rp', 'n', 100, '%', '<', 10, '當月約束人數／當月住民總人數*100%'], ['3.3', '約束同意書完整率', 'okp', 'rp', 100, '%', '>=', 100, '同意書與評估完整人數／當月約束人數*100%']] },
  { no: 4, name: '感染指標監測', type: '感染',
    data: [['pd', '當月住民總人日數', '保留床人日數'], ['n', '當月住民總人數'], ['t', '當月住民感染人次'], ['p', '當月住民感染人數'], ['h72', '當月入住72小時(含)內感染人次']],
    cat: { field: 'infType', label: '「%」人次', opts: ['呼吸道感染', '泌尿道感染', '皮膚（疥瘡）', '腸胃道（腹瀉）', '不明原因發燒', '傷口感染', '其他'] },
    mon: [['4.1', '感染發生率', 't', 'n', 100, '%', '<', 5, '當月住民感染人次／當月住民總人數*100%'], ['4.2', '感染密度', 't', 'pd', 1000, '‰', '<', 2, '當月住民感染人次／當月住民總人日數*1000‰']] },
  { no: 5, name: '非計畫性轉至急性醫院住院指標監測', type: '非計畫性住院',
    data: [['pd', '當月住民總人日數', '保留床人日數'], ['n', '當月住民總人數'], ['allP', '當月轉至急性醫院住院住民之總人數'], ['newR', '當月新住民人數'], ['uP', '當月非計畫性轉至急性醫院住院人數'], ['allT', '當月全體住民轉至急性醫院住院人次'], ['uT', '當月非計畫性轉至急性醫院住院人次'], ['h72', '當月入住72小時(含)內非計畫性轉至急性醫院住院人次']],
    cat: { field: 'hospCause', label: '因「%」非計畫性轉至急性醫院住院人次', opts: ['心血管代償機能減退', '腸胃道出血', '骨折', '感染', '其他內外科'], den: 'uP', monLabel: '因「%」非計畫性轉至急性醫院住院之比率', base: '5.5' },
    mon: [['5.1', '轉至急性醫院住院比率', 'allT', 'n', 100, '%', '<', 5, '當月全體住民轉至急性醫院住院人次／當月住民總人數*100%'], ['5.2', '轉至急性醫院住院密度', 'allT', 'pd', 100, '%', '<', 0.5, '當月全體住民轉至急性醫院住院人次／當月住民總人日數*100%'], ['5.3', '非計畫性轉急性醫院住院比率', 'uT', 'allP', 100, '%', '<=', 100, '當月非計畫性轉至急性醫院住院人次／當月轉至急性醫院住院住民之總人數*100'], ['5.4', '新住民入住72小時(含)內非計畫性轉至急性醫院住院比率', 'h72', 'newR', 100, '%', '<=', 0, '當月入住72小時(含)內非計畫性轉至急性醫院住院人次／當月新住民人數*100%']] },
  { no: 6, name: '非計畫性體重改變指標監測', type: '非計畫性體重改變',
    data: [['n', '當月住民總人數'], ['meas', '當月完成體重測量人數'], ['t', '當月非計畫性體重改變人數'], ['loss', '當月體重減輕 ≥ 5% 人數'], ['gain', '當月體重增加 ≥ 5% 人數']],
    mon: [['6.1', '非計畫性體重改變比率', 't', 'n', 100, '%', '<', 5, '當月非計畫性體重改變人數／當月住民總人數*100%'], ['6.2', '體重測量完成率', 'meas', 'n', 100, '%', '>=', 95, '當月完成體重測量人數／當月住民總人數*100%']] },
  { no: 7, name: '管路照護指標監測', type: '管路滑脫／自拔',
    data: [['ngP', '當月留置鼻胃管人數'], ['foP', '當月留置導尿管人數'], ['tubeD', '當月管路留置人日數'], ['slip', '當月管路滑脫／自拔人次'], ['rem', '當月管路成功移除人次']],
    mon: [['7.1', '管路滑脫／自拔密度', 'slip', 'tubeD', 1000, '‰', '<', 1, '當月管路滑脫自拔人次／當月管路留置人日數*1000‰'], ['7.2', '管路移除比率', 'rem', 'tubeP', 100, '%', '', '', '當月管路成功移除人次／當月留置管路人數*100%']] },
];
function qiThr(monId, def) { const t = (DB.settings.qiThr || {})[monId]; return t ? t : def; }

/* --- 計算：保留床（住院期間）人日數不列入住民總人日數 --- */
function hospDays(rid, f, t) {
  let n = 0;
  DB.events.filter(e => e.rid === rid && e.type === '非計畫性住院' || (e.rid === rid && e.type === '計畫性住院')).forEach(e => {
    const s = e.date > f ? e.date : f; let end = e.returnDate || (resById(rid) && resById(rid).status === '住院中' ? today() : e.date); end = end < t ? end : t;
    if (end >= s) n += diffDays(s, end) + (e.returnDate && e.returnDate <= t ? 0 : 1);
  });
  return n;
}
function qiCompute(ind, f, t) {
  const rs = DB.residents.filter(r => r.admitDate && r.admitDate <= t && (!r.dischargeDate || r.dischargeDate >= f));
  let rawPd = 0, hosp = 0; rs.forEach(r => { const s = r.admitDate > f ? r.admitDate : f; const end0 = r.dischargeDate || t; const e = end0 < t ? end0 : (t < today() ? t : today()); if (e >= s) rawPd += diffDays(s, e) + 1; hosp += hospDays(r.id, f, t); });
  const D = { pd: rawPd - hosp, pdEx: hosp, n: rs.length, newR: rs.filter(r => r.admitDate >= f && r.admitDate <= t).length };
  const ev = ind.type ? DB.events.filter(e => e.type === ind.type && e.date >= f && e.date <= t) : [];
  const uniq = a => new Set(a.map(e => e.rid)).size;
  const w72 = e => { const r = resById(e.rid); return e.within72 === '是' || (r && r.admitDate && diffDays(r.admitDate, e.date) <= 3 && e.date >= r.admitDate); };
  if (ind.no === 1) Object.assign(D, { t: ev.length, p: uniq(ev), inj: ev.filter(e => e.injury && !/^無/.test(e.injury)).length, sev: ev.filter(e => /重度|死亡/.test(e.injury || '')).length, h72: ev.filter(w72).length, night: ev.filter(e => /^N/.test(e.shift || shiftOf(e.time))).length });
  if (ind.no === 2) { const nw = ev.filter(e => (e.origin || '機構內新發生') === '機構內新發生'); Object.assign(D, { newT: nw.length, newP: uniq(nw), inT: ev.length - nw.length, prevP: uniq(DB.events.filter(e => e.type === '壓力性損傷' && e.date <= t && (e.status !== '結案' || (e.updated || '').slice(0, 10) >= f))), g2: nw.filter(e => !/第 1 級/.test(e.stage || '')).length }); }
  if (ind.no === 3) { const rr = DB.restraints.filter(x => x.startDate <= t && (!x.endDate || x.endDate >= f)); let rd = 0; rr.forEach(x => { const s = x.startDate > f ? x.startDate : f; const e0 = x.endDate || today(); const e = e0 < t ? e0 : t; if (e >= s) rd += diffDays(s, e) + 1; }); const bad = rr.filter(x => !x.consentDate || diffDays(x.consentDate, t < today() ? t : today()) > 90 || !(x.alternatives || []).length).length; Object.assign(D, { rd, rp: new Set(rr.map(x => x.rid)).size, bad, okp: new Set(rr.map(x => x.rid)).size - bad }); }
  if (ind.no === 4) Object.assign(D, { t: ev.length, p: uniq(ev), h72: ev.filter(w72).length });
  if (ind.no === 5) { const all = ev, un = ev.filter(e => !/^計畫性/.test(e.hospPlanned || '')); Object.assign(D, { allP: uniq(all), allT: all.length, uP: uniq(un), uT: un.length, h72: un.filter(w72).length }); ev.splice(0, ev.length, ...un); }
  if (ind.no === 6) Object.assign(D, { meas: rs.filter(r => DB.weights.some(w => w.rid === r.id && w.date >= f && w.date <= t)).length, t: uniq(ev), loss: uniq(ev.filter(e => /減輕/.test(e.wChange || '減輕'))), gain: uniq(ev.filter(e => /增加/.test(e.wChange || ''))) });
  if (ind.no === 7) { const ng = rs.filter(r => r.tubes && r.tubes.ng), fo = rs.filter(r => r.tubes && r.tubes.foley); const days = diffDays(f, t < today() ? t : today()) + 1; Object.assign(D, { ngP: ng.length, foP: fo.length, tubeP: ng.length + fo.length, tubeD: (ng.length + fo.length) * days, slip: ev.length, rem: DB.events.filter(e => e.type === '管路移除' && e.date >= f && e.date <= t).length }); }
  if (ind.cat) ind.cat.opts.forEach((o, i) => D['c' + i] = ev.filter(e => (e[ind.cat.field] || (ind.no === 1 ? '其他' : ind.cat.opts[ind.cat.opts.length - 1])) === o).length);
  // 人工覆寫（例如保留床人日數）
  const ov = ((DB.settings.qiOverride || {})[`${ind.no}|${f.slice(0, 7)}`]) || {}; Object.assign(D, ov);
  const M = ind.mon.map(([id, name, num, den, mult, unit, op, thr, formula]) => { const T = qiThr(id, { op, v: thr }); const v = D[den] ? D[num] / D[den] * mult : 0; return { id, name, num, den, unit, v, op: T.op, thr: T.v, formula, ok: !T.op || T.v === '' ? null : qiPass(v, T) }; });
  if (ind.cat && ind.cat.base) ind.cat.opts.forEach((o, i) => M.push({ id: `${ind.cat.base}.${i + 1}`, name: ind.cat.monLabel.replace('%', o), unit: '%', v: D[ind.cat.den] ? D['c' + i] / D[ind.cat.den] * 100 : 0, op: '', thr: '', formula: `${ind.cat.label.replace('%', o)}／當月非計畫性轉至急性醫院住院人數*100%`, ok: null }));
  return { D, M, ev };
}
function qiPass(v, T) { const x = +(+v).toFixed(2), y = +T.v; return T.op === '<' ? x < y : T.op === '<=' ? x <= y : T.op === '>=' ? x >= y : T.op === '>' ? x > y : null; }
function fmtV(m) { return m.unit === '‰' ? m.v.toFixed(2) + '‰' : m.v.toFixed(1) + '%'; }
function thrText(m) { return m.op && m.thr !== '' ? `${m.op === '<=' ? '≤' : m.op === '>=' ? '≥' : m.op}${m.thr}${m.unit}` : '－'; }

/* --- 頁籤 --- */
function qiTabs(active) {
  const T = [['quality', '季總覽'], ['qimonth', '月統計表'], ['qipdca', '季 PDCA'], ['qiyear', '年度分析'], ['qiset', '閾值設定']];
  return `<div class="tabs" style="margin-top:0">${T.map(([k, l]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}">${l}</a>`).join('')}</div>`;
}
let qiMonth = null;
ROUTES.qimonth = () => {
  const m = qiMonth || today().slice(0, 7), [f, t] = monthRange(m), done = (DB.settings.qiMonthDone || {})[m];
  const months = [...Array(12)].map((_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return ymd(d).slice(0, 7); });
  return `${qiTabs('qimonth')}<div class="hd"><div><h1>指標監測月統計表</h1><p class="sub">資料收集數值由系統自動計算（人日數已扣除住院保留床人日）。數值有誤可直接修改，會記錄為人工校正。每月 5 日前確認上月報表。</p></div><span class="sp"></span>
    <select id="qmSel" style="padding:7px;border:1px solid var(--line);border-radius:8px">${months.map(x => `<option${x === m ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
  <div class="row" style="margin-bottom:12px"><span class="chip ${done ? 'ok' : 'warn'}">${done ? `已確認（${esc(done.by)}，${roc(done.date)}）` : '尚未確認'}</span><span class="sp"></span><button class="btn" data-act="qmPrint" data-m="${m}">列印／Word：全部指標</button><button class="btn pri" data-act="qmDone" data-m="${m}">確認本月報表</button></div>
  ${QI.map(ind => { const { D, M } = qiCompute(ind, f, t); const ov = (DB.settings.qiOverride || {})[`${ind.no}|${m}`] || {};
    return `<details class="acc-item" ${M.some(x => x.ok === false) ? 'open' : ''}><summary><span class="code">${ind.no}</span><b style="flex:1">${ind.name}</b>${M.some(x => x.ok === false) ? '<span class="chip bad">超過閾值</span>' : '<span class="chip ok">閾值內</span>'}<button class="btn sm" data-act="qmPrintOne" data-m="${m}" data-no="${ind.no}">列印</button></summary>
    <div class="body grid g2" style="align-items:start"><div><h3>資料收集</h3><table class="t">${ind.data.map(([k, l, ex]) => `<tr><td>${l}</td><td style="width:90px"><input type="number" class="qmIn" data-no="${ind.no}" data-m="${m}" data-k="${k}" value="${D[k]}" style="width:80px;padding:4px;border:1px solid ${ov[k] !== undefined ? 'var(--amber)' : 'var(--line)'};border-radius:6px"></td><td class="small muted">${ex ? `${ex} ${D.pdEx}` : ''}</td></tr>`).join('')}
      ${ind.cat ? ind.cat.opts.map((o, i) => `<tr><td>${ind.cat.label.replace('%', o)}</td><td>${D['c' + i]}</td><td></td></tr>`).join('') : ''}</table></div>
    <div><h3>指標監測</h3><table class="t">${M.map(x => `<tr><td class="nowrap">${x.id}</td><td>${esc(x.name)}<div class="small muted">${esc(x.formula)}</div></td><td class="nowrap">${thrText(x)}</td><td class="nowrap"><b style="color:${x.ok === false ? 'var(--bad)' : 'inherit'}">${fmtV(x)}</b></td></tr>`).join('')}</table></div></div></details>`; }).join('')}`;
};
ROUTES.after_qimonth = () => {
  $('#qmSel').addEventListener('change', e => { qiMonth = e.target.value; refresh(); });
  $$('.qmIn').forEach(i => i.addEventListener('change', () => { const key = `${i.dataset.no}|${i.dataset.m}`; const o = DB.settings.qiOverride || {}; o[key] = Object.assign({}, o[key], { [i.dataset.k]: +i.value }); setKV('settings', 'qiOverride', o); toast('已人工校正，監測值已重新計算'); refresh(); }));
};
ACT.qmDone = el => { const o = DB.settings.qiMonthDone || {}; o[el.dataset.m] = { by: currentUser(), date: today() }; setKV('settings', 'qiMonthDone', o); toast('已確認本月指標報表'); refresh(); };

/* --- 季 PDCA --- */
let qiQ = null;
const PDCA_HINT = {
  plan: ['降低發生人次至閾值以下', '提升高風險住民評估完成率至 100%', '提升手部衛生執行率及正確率 100%', '落實逐案分析與追蹤'],
  do: ['每日指派資深照服員不定時稽核', '針對稽核不落實人員個別輔導教育', '每月由專責人員稽查並檢討分析', '辦理相關教育訓練', '高風險住民床頭標示並交班'],
  action: ['針對個案進行逐案分析', '執行年度總檢討', '定期每季開會討論', '修訂標準作業流程', '持續監測'],
};
function pdcaAuto(ind, q) {
  const [f, t] = quarterRange(q), pq = prevQuarter(q), cur = qiCompute(ind, f, t), prev = qiCompute(ind, ...quarterRange(pq)), m0 = cur.M[0], p0 = prev.M[0];
  const months = [0, 1, 2].map(i => { const d = new Date(f + 'T00:00:00'); d.setMonth(d.getMonth() + i); return ymd(d).slice(0, 7); }).filter(m => m <= today().slice(0, 7));
  const mm = months.map(m => qiCompute(ind, ...monthRange(m)));
  const qLabel = `${+q.slice(0, 4) - 1911} 年 ${(+q.slice(-1) - 1) * 3 + 1} 至 ${+q.slice(-1) * 3} 月`;
  const cnt = (ind.no === 5 ? cur.D.uT : cur.D.t ?? cur.D.newT ?? cur.D.rp ?? cur.D.slip) || 0;
  const problem = `${qLabel}${ind.name.replace('指標監測', '')}${ind.no === 3 ? `約束人數 N=${cur.D.rp}` : `人次 N=${cnt}`}，${m0.name}為 ${fmtV(m0)}，${m0.ok === false ? `超過設定閾值 ${thrText(m0)}` : `未超過設定閾值 ${thrText(m0)}`}。`;
  let cause = '';
  if (ind.cat) { const tot = ind.cat.opts.reduce((s, o, i) => s + cur.D['c' + i], 0) || 1; cause = ind.cat.opts.map((o, i) => [o, cur.D['c' + i]]).filter(x => x[1]).map(([o, n], i) => `${i + 1}. ${o}人次 n=${n}（${(n / tot * 100).toFixed(1)}%）。`).join('\n'); }
  if (!cause) cause = cur.ev.map((e, i) => `${i + 1}. ${roc(e.date)} ${(e.cause || '原因待分析').slice(0, 40)}`).join('\n') || '本季無發生案件。';
  const check = `1. ${months.map(m => +m.slice(5)).join('、')} 月分別為 ${mm.map(x => `${ind.no === 5 ? x.D.uT : (x.D.t ?? x.D.newT ?? x.D.rp ?? x.D.slip ?? 0)}（${fmtV(x.M[0])}）`).join('、')}，續監測。`;
  return { A: thrText(m0), B: fmtV(p0), C: fmtV(m0), dA: m0.thr !== '' && m0.op ? (m0.v - m0.thr).toFixed(1) + m0.unit : '－', dB: (m0.v - p0.v).toFixed(1) + m0.unit, problem, cause, check, period: qLabel };
}
ROUTES.qipdca = () => {
  const q = qiQ || prevQuarter(quarterOf(today())), P = ((DB.quarterly[q] || {}).pdca) || {};
  const due = addDays(quarterRange(q)[1], 5);
  return `${qiTabs('qipdca')}<div class="hd"><div><h1>PDCA 改善報告單（每季）</h1><p class="sub">閾值、上次、本次、差異、問題點、原因分析、效果確認由系統自動帶入，可再修改。請於下個月 5 日前填寫完成（本季期限 ${roc(due)}）。</p></div><span class="sp"></span>
    <select id="qpSel" style="padding:7px;border:1px solid var(--line);border-radius:8px">${recentQuarters(8).map(x => `<option value="${x}"${x === q ? ' selected' : ''}>${x.replace('-Q', ' 年第 ')} 季</option>`).join('')}</select></div>
  <div class="row" style="margin-bottom:10px"><span class="sp"></span><button class="btn" data-act="qpPrintAll" data-q="${q}">列印／Word：全部指標</button></div>
  ${QI.map(ind => { const a = pdcaAuto(ind, q), s = P[ind.no] || {}; const v = k => esc(s[k] ?? a[k] ?? '');
    return `<details class="acc-item" data-pd="${ind.no}"><summary><span class="code">${ind.no}</span><b style="flex:1">${ind.name}</b><span class="small">閾值 ${a.A}｜上次 ${a.B}｜本次 <b>${a.C}</b></span>${s.done ? '<span class="chip ok">已完成</span>' : '<span class="chip warn">待填寫</span>'}</summary>
    <div class="body"><div class="grid g4 small"><div>閾值(A)：<b>${a.A}</b></div><div>上次(B)：<b>${a.B}</b></div><div>本次(C)：<b>${a.C}</b></div><div>差異 C−A：${a.dA}｜C−B：${a.dB}</div></div>
    <div class="grid g2" style="margin-top:8px">${[['problem', '問題點'], ['cause', '原因分析'], ['plan', '對策擬定（Plan）'], ['do', '對策實施（Do）'], ['check', '效果確認（Check）'], ['action', '對策檢討及處理（Action）']].map(([k, l]) => `<label class="f">${l}<textarea data-pk="${k}" rows="4">${v(k)}</textarea>${PDCA_HINT[k] ? `<div class="chips" style="margin-top:4px">${PDCA_HINT[k].map(p => `<button class="chip" data-act="pdPhrase" data-t="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}</label>`).join('')}</div>
    <div class="grid g3"><label class="f">單位<input data-pk="unit" value="${esc(s.unit || '照護組')}"></label><label class="f">監測者<input data-pk="monitor" value="${esc(s.monitor || '')}"></label><label class="f">資料分析者<input data-pk="analyst" value="${esc(s.analyst || '')}"></label></div>
    <div class="row"><button class="btn sm" data-act="pdReset" data-no="${ind.no}">重新帶入系統數據</button><span class="sp"></span><button class="btn sm" data-act="pdSave" data-no="${ind.no}">暫存</button><button class="btn sm pri" data-act="pdDone" data-no="${ind.no}">完成</button><button class="btn sm" data-act="qpPrintOne" data-q="${q}" data-no="${ind.no}">列印</button></div></div></details>`; }).join('')}`;
};
ROUTES.after_qipdca = () => { $('#qpSel').addEventListener('change', e => { qiQ = e.target.value; refresh(); }); $$('[data-pd] textarea').forEach(t => t.addEventListener('focus', () => window.__pdTA = t)); };
ACT.pdPhrase = el => { const ta = el.closest('label').querySelector('textarea'); const n = (ta.value.match(/^\d+[-.]/gm) || []).length; ta.value = (ta.value ? ta.value + '\n' : '') + `${n + 1}. ${el.dataset.t}。`; };
function pdRead(no) { const box = $(`[data-pd="${no}"]`); const o = {}; $$('[data-pk]', box).forEach(i => o[i.dataset.pk] = i.value); return o; }
function pdStore(no, o) { const q = qiQ || prevQuarter(quarterOf(today())); const Q = DB.quarterly[q] || { analysis: {} }; Q.pdca = Q.pdca || {}; Q.pdca[no] = Object.assign({}, Q.pdca[no], o, { date: today(), by: currentUser() }); if (QI.every(i => Q.pdca[i.no] && Q.pdca[i.no].done)) { Q.done = true; Q.doneDate = today(); } setKV('quarterly', q, Q); }
ACT.pdSave = el => { pdStore(el.dataset.no, pdRead(el.dataset.no)); toast('已暫存'); };
ACT.pdDone = el => { const o = pdRead(el.dataset.no); if (!o.plan || !o.do) { toast('請至少填寫 Plan 與 Do', 'bad'); return; } pdStore(el.dataset.no, Object.assign(o, { done: true })); toast('已完成'); refresh(); };
ACT.pdReset = el => { const q = qiQ || prevQuarter(quarterOf(today())); const Q = DB.quarterly[q]; if (Q && Q.pdca && Q.pdca[el.dataset.no]) ['problem', 'cause', 'check'].forEach(k => delete Q.pdca[el.dataset.no][k]); if (Q) setKV('quarterly', q, Q); refresh(); toast('已重新帶入系統數據'); };

/* --- 年度分析 --- */
let qiYear = null;
ROUTES.qiyear = () => {
  const y = qiYear || String(new Date().getFullYear()), Y = (DB.quarterly['Y' + y] || {}).pdca || {};
  const months = [...Array(12)].map((_, i) => `${y}-${String(i + 1).padStart(2, '0')}`).filter(m => m <= today().slice(0, 7));
  return `${qiTabs('qiyear')}<div class="hd"><div><h1>年度指標分析</h1><p class="sub">每月監測值、年度合計與閾值比較，並撰寫年度總檢討（PDCA）。</p></div><span class="sp"></span>
    <select id="qySel" style="padding:7px;border:1px solid var(--line);border-radius:8px">${[0, 1, 2].map(i => String(new Date().getFullYear() - i)).map(x => `<option${x === y ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
  <div class="row" style="margin-bottom:10px"><span class="sp"></span><button class="btn" data-act="qyPrint" data-y="${y}">列印／Word：年度報告</button></div>
  ${QI.map(ind => { const yr = qiCompute(ind, `${y}-01-01`, `${y}-12-31`), mm = months.map(m => qiCompute(ind, ...monthRange(m))); const s = Y[ind.no] || {};
    const vals = mm.map(x => x.M[0].v), mx = Math.max(...vals, +yr.M[0].thr || 0, 0.01);
    return `<details class="acc-item" data-py="${ind.no}"><summary><span class="code">${ind.no}</span><b style="flex:1">${ind.name}</b><span class="small">年度 ${esc(yr.M[0].name)} <b>${fmtV(yr.M[0])}</b>（閾值 ${thrText(yr.M[0])}）</span>${s.done ? '<span class="chip ok">已完成</span>' : ''}</summary>
    <div class="body"><div class="tw"><table class="t"><tr><th>監測項目</th>${months.map(m => `<th>${+m.slice(5)}月</th>`).join('')}<th>全年</th><th>閾值</th></tr>${yr.M.slice(0, 4).map((x, k) => `<tr><td class="nowrap">${x.id} ${esc(x.name)}</td>${mm.map(z => `<td style="color:${z.M[k].ok === false ? 'var(--bad)' : 'inherit'}">${fmtV(z.M[k])}</td>`).join('')}<td><b>${fmtV(x)}</b></td><td class="nowrap">${thrText(x)}</td></tr>`).join('')}</table></div>
    <svg viewBox="0 0 360 80" style="width:100%;max-width:520px;height:90px" aria-label="每月趨勢">${yr.M[0].thr !== '' ? `<line x1="0" x2="360" y1="${76 - (+yr.M[0].thr) / mx * 70}" y2="${76 - (+yr.M[0].thr) / mx * 70}" stroke="var(--bad)" stroke-dasharray="4 3"/>` : ''}<polyline fill="none" stroke="var(--pri)" stroke-width="2.5" points="${vals.map((v, i) => `${10 + i * 30},${76 - v / mx * 70}`).join(' ')}"/>${vals.map((v, i) => `<circle cx="${10 + i * 30}" cy="${76 - v / mx * 70}" r="3" fill="var(--pri)"/>`).join('')}</svg>
    <div class="grid g2">${[['problem', '年度問題點'], ['cause', '原因分析'], ['plan', '明年度對策（Plan）'], ['do', '執行情形（Do）'], ['check', '效果確認（Check）'], ['action', '檢討及處理（Action）']].map(([k, l]) => `<label class="f">${l}<textarea data-yk="${k}" rows="3">${esc(s[k] || (k === 'problem' ? `${y - 1911} 年度${ind.name.replace('指標監測', '')}${esc(yr.M[0].name)}為 ${fmtV(yr.M[0])}，${yr.M[0].ok === false ? '超過' : '未超過'}設定閾值 ${thrText(yr.M[0])}。` : ''))}</textarea></label>`).join('')}</div>
    <div class="row"><span class="sp"></span><button class="btn sm pri" data-act="pyDone" data-no="${ind.no}" data-y="${y}">儲存</button></div></div></details>`; }).join('')}`;
};
ROUTES.after_qiyear = () => $('#qySel').addEventListener('change', e => { qiYear = e.target.value; refresh(); });
ACT.pyDone = el => { const box = $(`[data-py="${el.dataset.no}"]`), o = { done: true, date: today(), by: currentUser() }; $$('[data-yk]', box).forEach(t => o[t.dataset.yk] = t.value); const k = 'Y' + el.dataset.y; const Y = DB.quarterly[k] || {}; Y.pdca = Y.pdca || {}; Y.pdca[el.dataset.no] = o; setKV('quarterly', k, Y); toast('已儲存年度分析'); };

/* --- 閾值設定 --- */
ROUTES.qiset = () => `${qiTabs('qiset')}<h1>閾值設定</h1><p class="sub">系統預設值僅供參考，請改成機構品管會議訂定的閾值。修改後月統計、PDCA、年度分析都會套用。</p>
  ${QI.map(ind => `<div class="card"><h3 style="margin-top:0">${ind.no}. ${ind.name}</h3><table class="t">${ind.mon.map(([id, name, , , , unit, op, thr]) => { const T = qiThr(id, { op, v: thr }); return `<tr><td class="nowrap">${id}</td><td>${esc(name)}</td><td><select data-thop="${id}" style="padding:4px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)">${['', '<', '<=', '>=', '>'].map(o => `<option value="${o}"${o === T.op ? ' selected' : ''}>${o || '不設'}</option>`).join('')}</select> <input type="number" step="0.1" data-thv="${id}" value="${T.v}" style="width:80px;padding:4px;border:1px solid var(--line);border-radius:6px"> ${unit}</td></tr>`; }).join('')}</table></div>`).join('')}
  <button class="btn pri" data-act="thSave">儲存閾值</button>`;
ACT.thSave = () => { const o = {}; $$('[data-thop]').forEach(s => { o[s.dataset.thop] = { op: s.value, v: $(`[data-thv="${s.dataset.thop}"]`).value === '' ? '' : +$(`[data-thv="${s.dataset.thop}"]`).value }; }); setKV('settings', 'qiThr', o); toast('已儲存閾值'); };

/* --- 列印：依機構紙本格式 --- */
const EVENT_FORM_NAME = { '跌倒': '住民跌倒收案分析改善單', '壓力性損傷': '住民壓力性損傷收案分析改善單', '感染': '住民感染收案分析改善單', '非計畫性住院': '住民住院收案分析改善單', '非計畫性體重改變': '住民非計畫性體重改變收案分析改善單', '管路滑脫／自拔': '住民管路滑脫收案分析改善單', '緊急送醫': '住民緊急送醫收案分析改善單' };
PR.event = async function (id) {
  const e = eventDefaults(DB.events.find(x => x.id === id)), r = resById(e.rid) || {}, def = EVENT_TYPES[e.type] || { fields: [] };
  logAccess(`列印${e.type}收案單`, e.rid); const ph = await photosPrintHTML('event:' + id, '照片紀錄');
  const ck = (on, t) => `${on ? '☑' : '☐'}${t}`;
  const tubes = ['鼻胃管', '導尿管', '氣切管', '造廔口', '透析'].map(t => ck((e.tubesAt || []).includes(t), t)).join(' ') + ` ${ck((e.tubesAt || []).includes('其他') || (e.tubesAt || []).includes('無'), '其他')}:${(e.tubesAt || []).includes('無') ? '無' : ''}`;
  const dx = ['高血壓', '糖尿病', '慢性腎病'].map(t => ck((e.dxs || []).includes(t), t)).join(' ') + ` ${ck((e.dxs || []).some(x => !['高血壓', '糖尿病', '慢性腎病'].includes(x)) || e.dxOther, '其他')}:${esc([...(e.dxs || []).filter(x => !['高血壓', '糖尿病', '慢性腎病', '其他'].includes(x)), e.dxOther].filter(Boolean).join('、'))}`;
  let typeRow = '';
  if (e.type === '非計畫性住院') typeRow = `<tr><th>住院資料</th><td>入住 72 小時：${ck(e.within72 === '是', '是')} ${ck(e.within72 !== '是', '否')}</td><td colspan="3">住院原因：${['心血管代償機能減退', '腸胃道出血', '骨折', '感染'].map(t => ck(e.hospCause === t, (t === '心血管代償機能減退' ? '因' : '') + t)).join(' ')}<br>${ck(e.hospCause === '其他內外科', '其他')}:${esc(e.hospCauseD || '')}${e.hospital ? `　醫院：${esc(e.hospital)}` : ''}</td></tr>`;
  else if (e.type === '跌倒') typeRow = `<tr><th>跌倒資料</th><td>入住 72 小時：${ck(e.within72 === '是', '是')} ${ck(e.within72 !== '是', '否')}<br>地點：${esc(e.place || '')}</td><td colspan="3">傷害程度：${esc(e.injury || '')}<br>原因類別：${esc(e.fallCause || '')}${(e.factors || []).length ? `<br>危險因子：${esc(e.factors.join('、'))}` : ''}</td></tr>`;
  else if (def.fields.length) typeRow = `<tr><th>${esc(e.type)}資料</th><td>入住 72 小時：${ck(e.within72 === '是', '是')} ${ck(e.within72 !== '是', '否')}</td><td colspan="3">${def.fields.map(k => `${esc(EVENT_FIELD_DEF[k].label)}：${esc(Array.isArray(e[k]) ? e[k].join('、') : e[k] || '')}`).join('　')}</td></tr>`;
  const fu = (e.followups || []).map(f => `${roc(f.date)} ${esc(f.text)}`).join('<br>') || esc(e.action || '');
  const page = `<div class="org">${esc(DB.settings.org || '長期照顧服務機構')}</div><h1>${EVENT_FORM_NAME[e.type] || esc(e.type) + '收案分析改善單'}</h1>
    <table><tr><th rowspan="2" style="width:11%">住民資料</th><td colspan="1">床號:${esc(r.bed || '')}　姓名:${esc(r.name || '')}　入住日:${roc(r.admitDate)}　年齡:${age(r.birth)}</td><th style="width:14%">發生日期</th><th style="width:14%">發生班別</th><th style="width:13%">填寫者</th></tr>
      <tr><td>留置管路:${tubes}<br><br>主診斷:${dx}</td><td style="text-align:center;vertical-align:middle">${roc(e.date)}<br>${esc(e.time || '')}</td><td style="text-align:center;vertical-align:middle">${['D', 'E', 'N'].map(s => ck((e.shift || '')[0] === s, s)).join(' ')}</td><td style="text-align:center;vertical-align:middle">${esc((e.by || '').replace(/（.*）/, ''))}</td></tr>
      ${typeRow}
      <tr><th>${e.type === '非計畫性住院' ? '住院' : '事件'}狀況說明</th><td colspan="4" style="height:60pt">${esc(e.desc || '')}${e.immediate ? '<br>處置：' + esc(e.immediate) : ''}</td></tr>
      <tr><th>原因分析</th><td colspan="4" style="height:70pt;white-space:pre-wrap">${esc(e.cause || '')}</td></tr>
      <tr><th>改善策略<div class="note">(手寫填完簽章)</div></th><td colspan="4" style="height:90pt;white-space:pre-wrap">${esc(e.improve || '')}</td></tr>
      <tr><th>成果追蹤<div class="note">(手寫填完簽章)</div></th><td colspan="4" style="height:80pt">${fu}</td></tr></table>
    <table><tr><th>品管負責人／日期</th><th>單位主管／日期</th></tr><tr><td style="height:36pt;text-align:center">${esc(e.qaSign || '')}</td><td style="text-align:center">${esc(e.mgrSign || '')}</td></tr></table>`;
  doPrint([page].concat(ph ? [pgHead(`${e.type}事件照片`) + resLine(r) + ph] : []));
};
function monthPage(ind, m) {
  const [f, t] = monthRange(m), { D, M } = qiCompute(ind, f, t);
  const rows = ind.data.map(([k, l, ex]) => [l, D[k], ex ? `${ex}<br>${D.pdEx}` : '']).concat(ind.cat ? ind.cat.opts.map((o, i) => [ind.cat.label.replace('%', o), D['c' + i], '']) : []);
  const n = Math.max(rows.length, M.length);
  return `<!--land--><div class="org">${esc(DB.settings.org || '')}</div><h1>指標監測月統計表-${ind.no}${ind.name}</h1><div class="meta"><span>年度：${+m.slice(0, 4) - 1911}　　月份：${+m.slice(5)}</span><span>監測人：＿＿＿＿＿</span></div>
    <table><tr><th colspan="4">資料收集</th><th colspan="6">指標監測</th></tr><tr><th style="width:4%">項次</th><th style="width:19%">品質管理項目</th><th style="width:5%">數值</th><th style="width:6%">排除因子</th><th style="width:5%">項次</th><th style="width:14%">監測項目</th><th style="width:30%">公式</th><th style="width:6%">閾值</th><th style="width:6%">監測值</th><th style="width:5%">備註</th></tr>
    ${[...Array(n)].map((_, i) => { const a = rows[i], b = M[i]; return `<tr><td>${a ? i + 1 : ''}</td><td>${a ? a[0] : ''}</td><td style="text-align:center">${a ? a[1] : ''}</td><td class="note">${a ? a[2] : ''}</td><td>${b ? b.id : ''}</td><td>${b ? esc(b.name) : ''}</td><td class="note">${b ? esc(b.formula) : ''}</td><td style="text-align:center">${b ? thrText(b) : ''}</td><td style="text-align:center">${b ? fmtV(b) : ''}</td><td>${b && b.ok === false ? '超標' : ''}</td></tr>`; }).join('')}</table>`;
}
function pdcaPage(ind, q) {
  const a = pdcaAuto(ind, q), s = (((DB.quarterly[q] || {}).pdca) || {})[ind.no] || {}, v = k => esc(s[k] ?? a[k] ?? '').replace(/\n/g, '<br>');
  return `<!--land--><div class="org">${esc(DB.settings.org || '')}</div><h1>PDCA 改善報告單</h1>
    <table><tr><th style="width:10%">單位</th><td style="width:14%">${esc(s.unit || '照護組')}</td><th style="width:10%">監測項目</th><td>${esc(ind.name)}</td><th style="width:10%">監測日期</th><td style="width:14%">${a.period}</td><th style="width:8%">監測者</th><td style="width:10%">${esc(s.monitor || '')}</td></tr></table>
    <table><tr><th rowspan="2">閾值(%)<br>(A)</th><th colspan="2">監測值</th><th rowspan="2">差異(C-A)</th><th rowspan="2">差異(C-B)</th><th rowspan="2">資料分析者</th><th rowspan="2">填寫日期</th></tr><tr><th>上次(B)</th><th>本次(C)</th></tr>
    <tr style="text-align:center"><td>${a.A}</td><td>${a.B}</td><td>${a.C}</td><td>${a.dA}</td><td>${a.dB}</td><td>${esc(s.analyst || '')}</td><td>${roc(s.date || today())}</td></tr></table>
    <table><tr><th style="width:12%">問題點</th><td style="height:60pt">${v('problem')}</td><th style="width:12%">原因分析</th><td>${v('cause')}</td></tr></table>
    <table><tr><th style="width:50%">對策擬定(Plan)</th><th>對策實施(Do)</th></tr><tr><td style="height:120pt">${v('plan')}</td><td>${v('do')}</td></tr>
    <tr><th>對策檢討及處理(Action)</th><th>效果確認(Check)</th></tr><tr><td style="height:100pt">${v('action')}</td><td>${v('check')}</td></tr></table>
    <p class="note">備註：請於下個月 5 日前填寫完成，並依流程呈核。</p><div class="sign"><span>單位主管：＿＿＿＿＿＿</span></div>`;
}
function yearPage(ind, y) {
  const months = [...Array(12)].map((_, i) => `${y}-${String(i + 1).padStart(2, '0')}`), yr = qiCompute(ind, `${y}-01-01`, `${y}-12-31`), mm = months.map(m => m <= today().slice(0, 7) ? qiCompute(ind, ...monthRange(m)) : null);
  const s = (((DB.quarterly['Y' + y] || {}).pdca) || {})[ind.no] || {};
  return `<!--land--><div class="org">${esc(DB.settings.org || '')}</div><h1>${+y - 1911} 年度 ${esc(ind.name)} 分析報告</h1>
    <table><tr><th>監測項目</th>${months.map(m => `<th>${+m.slice(5)}月</th>`).join('')}<th>全年</th><th>閾值</th></tr>${yr.M.slice(0, 4).map((x, k) => `<tr><td>${x.id} ${esc(x.name)}</td>${mm.map(z => `<td style="text-align:center">${z ? fmtV(z.M[k]) : ''}</td>`).join('')}<td style="text-align:center"><b>${fmtV(x)}</b></td><td>${thrText(x)}</td></tr>`).join('')}</table>
    <table>${[['problem', '年度問題點'], ['cause', '原因分析'], ['plan', '明年度對策(Plan)'], ['do', '執行情形(Do)'], ['check', '效果確認(Check)'], ['action', '檢討及處理(Action)']].map(([k, l]) => `<tr><th style="width:18%">${l}</th><td style="height:46pt;white-space:pre-wrap">${esc(s[k] || '')}</td></tr>`).join('')}</table>${signRow(['品管負責人', '單位主管', '日期'])}`;
}
ACT.qmPrint = el => doPrint(QI.map(i => monthPage(i, el.dataset.m)));
ACT.qmPrintOne = el => { doPrint([monthPage(QI.find(i => i.no === +el.dataset.no), el.dataset.m)]); };
ACT.qpPrintAll = el => doPrint(QI.map(i => pdcaPage(i, el.dataset.q)));
ACT.qpPrintOne = el => { pdStore(el.dataset.no, pdRead(el.dataset.no)); doPrint([pdcaPage(QI.find(i => i.no === +el.dataset.no), el.dataset.q)]); };
ACT.qyPrint = el => doPrint(QI.map(i => yearPage(i, el.dataset.y)));
PR.quarter = q => doPrint(QI.map(i => pdcaPage(i, q)));
