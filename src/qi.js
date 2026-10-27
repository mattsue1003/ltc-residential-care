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
  fallCause: { label: '主要原因類別', type: 'select', options: ['住民健康情況', '治療或藥物反應', '環境中危險因子', '其他因素'] },
  healDate: { label: '癒合日期', type: 'date' },
  wChange: { label: '體重變化', type: 'select', options: ['減輕 ≥ 5%', '增加 ≥ 5%'] },
  qaSign: { label: '品管負責人', type: 'text' }, mgrSign: { label: '單位主管', type: 'text' },
});
EVENT_TYPES['非計畫性住院'].fields = ['hospPlanned', 'hospCause', 'hospCauseD', 'hospital', 'dx', 'returnDate'];
EVENT_TYPES['跌倒'].fields = ['place', 'injury', 'fallCause'];
EVENT_TYPES['非計畫性體重改變'].fields = ['wChange'];
EVENT_TYPES['壓力性損傷'].fields = ['site', 'stage', 'origin', 'healDate'];
EVENT_FIELD_DEF.injury = { label: '傷害嚴重度', type: 'select', options: ['無傷害', '1級（輕度：擦傷、瘀青）', '2級（中度：需縫合、扭傷）', '3級（重度：骨折、頭部外傷）', '死亡'] };
EVENT_FIELD_DEF.infType = { label: '感染類別', type: 'select', options: ['上呼吸道感染', '下呼吸道感染（肺炎）', '泌尿道感染', '皮膚（疥瘡）', '腸胃道（腹瀉）', '不明原因發燒', '傷口感染', '其他'] };
EVENT_FIELD_DEF.stage = { label: '分級', type: 'select', options: ['第 1 級', '第 2 級', '第 3 級', '第 4 級', '無法分級（Unstageable）', '深部組織損傷（SDTI）'] };
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

/* --- 指標定義：依原系統「指標月報」公式（住院依機構紙本月統計表）；閾值原系統未設定，以下為參考值，請在「閾值設定」修改 --- */
const QI = [
  { no: 1, name: '跌倒指標監測', type: '跌倒', main: 'C',
    data: [['A', '當月總住民人日數', '保留床人日數'], ['B', '當月有跌倒記錄住民人數'], ['C', '住民跌倒總件數'], ['D', '跌倒造成傷害總件數'], ['E', '重複跌倒者人數'], ['F1', '因住民健康情況而造成跌倒件數'], ['F2', '因治療或藥物反應而造成跌倒件數'], ['F3', '因環境中危險因子而造成跌倒件數'], ['F4', '因其他因素而造成跌倒件數'], ['G1', '跌倒傷害嚴重度1級'], ['G2', '跌倒傷害嚴重度2級'], ['G3', '跌倒傷害嚴重度3級']],
    mon: [['1.1', '跌倒發生密度', 'C', 'A', 100, '%', '<', 0.2, 'C/A'], ['1.2', '跌倒造成傷害發生率', 'D', 'C', 100, '%', '<', 50, 'D/C'], ['1.3', '重複跌倒者佔跌倒者之比率', 'E', 'B', 100, '%', '', '', 'E/B'], ['1.4', '因住民健康情況而造成跌倒發生率', 'F1', 'C', 100, '%', '', '', 'F1/C'], ['1.5', '因治療或藥物反應而造成跌倒發生率', 'F2', 'C', 100, '%', '', '', 'F2/C'], ['1.6', '因環境中危險因子而造成跌倒發生率', 'F3', 'C', 100, '%', '', '', 'F3/C'], ['1.7', '因其他因素而造成跌倒發生率', 'F4', 'C', 100, '%', '', '', 'F4/C'], ['1.8', '跌倒傷害嚴重度1級發生率', 'G1', 'D', 100, '%', '', '', 'G1/D'], ['1.9', '跌倒傷害嚴重度2級發生率', 'G2', 'D', 100, '%', '', '', 'G2/D'], ['1.10', '跌倒傷害嚴重度3級發生率', 'G3', 'D', 100, '%', '<', 5, 'G3/D']],
    cause: [['F1', '住民健康情況'], ['F2', '治療或藥物反應'], ['F3', '環境中危險因子'], ['F4', '其他因素']] },
  { no: 2, name: '壓瘡指標監測', type: '壓力性損傷', main: 'E',
    data: [['A', '測量當日住民總人數'], ['B', '測量當日有壓瘡人數'], ['C1', '第一級壓瘡現存人次'], ['C2', '第二級壓瘡現存人次'], ['C3', '第三級壓瘡現存人次'], ['C4', '第四級壓瘡現存人次'], ['C5', 'Unstageable現存人次'], ['C6', 'SDTI現存人次'], ['D', '當月住民總人數'], ['E', '入住後發生壓瘡總人次'], ['F1', '第一級壓瘡發生人次'], ['F2', '第二級壓瘡發生人次'], ['F3', '第三級壓瘡發生人次'], ['F4', '第四級壓瘡發生人次'], ['F5', 'Unstageable發生人次'], ['F6', 'SDTI發生人次']],
    mon: [['2.1', '壓瘡點盛行率', 'B', 'A', 100, '%', '<', 5, 'B/A'], ['2.2', '壓瘡發生率', 'E', 'D', 100, '%', '<', 2, 'E/D']].concat(['一', '二', '三', '四'].map((c, i) => [`2.${3 + i}`, `${c}級壓瘡點盛行率`, `C${i + 1}`, 'A', 100, '%', '', '', `C${i + 1}/A`]), [['2.7', 'Unstageable盛行率', 'C5', 'A', 100, '%', '', '', 'C5/A'], ['2.8', 'SDTI盛行率', 'C6', 'A', 100, '%', '', '', 'C6/A']], ['一', '二', '三', '四'].map((c, i) => [`2.${9 + i}`, `${c}級壓瘡發生率`, `F${i + 1}`, 'D', 100, '%', '', '', `F${i + 1}/D`]), [['2.13', 'Unstageable發生率', 'F5', 'D', 100, '%', '', '', 'F5/D'], ['2.14', 'SDTI發生率', 'F6', 'D', 100, '%', '', '', 'F6/D']]) },
  { no: 3, name: '身體約束指標監測', type: null, main: 'B',
    data: [['A', '當月住民總人日數', '保留床人日數'], ['B', '當月受身體約束住民人數'], ['C1', '因預防跌倒所造成的約束人數'], ['C2', '因預防管路自拔所造成的約束人數'], ['C3', '因預防自傷所造成的約束人數'], ['C4', '因行為紊亂所造成的約束人數'], ['C5', '因協助治療所造成的約束人數'], ['C6', '因其他因素所造成的約束人數'], ['D1', '約束持續時間 >4 至 ≤8 小時人數'], ['D2', '約束持續時間 >8 至 ≤16 小時人數'], ['D3', '約束持續時間 >16 至 ≤24 小時人數'], ['E1', '住民受身體約束2種以上人數'], ['F1', '移除身體約束人次'], ['F2', '移除約束至少維持24小時以上住民人數']],
    mon: [['3.1', '約束發生密度', 'B', 'A', 100, '%', '<', 0.5, 'B/A'], ['3.2', '約束持續時間 >4 至 ≤8 小時比率', 'D1', 'B', 100, '%', '', '', 'D1/B'], ['3.3', '約束持續時間 >8 至 ≤16 小時比率', 'D2', 'B', 100, '%', '', '', 'D2/B'], ['3.4', '約束持續時間 >16 至 ≤24 小時比率', 'D3', 'B', 100, '%', '', '', 'D3/B'], ['3.5', '約束移除成功率', 'F2', 'F1', 100, '%', '', '', 'F2/F1']],
    cause: [['C1', '預防跌倒'], ['C2', '預防管路自拔'], ['C3', '預防自傷'], ['C4', '行為紊亂'], ['C5', '協助治療'], ['C6', '其他因素']] },
  { no: 4, name: '感染指標監測', type: '感染', main: 'B',
    data: [['A', '當月總住民人日數', '保留床人日數'], ['B', '感染人次'], ['C1', '呼吸道感染人次'], ['C2', '下呼吸道感染人次'], ['C3', '泌尿道感染人次'], ['D', '當月使用導尿管人日數'], ['E', '使用存留導尿管的泌尿道感染人次'], ['F', '當月未使用導尿管人日數'], ['G', '未使用存留導尿管的泌尿道感染人次'], ['C4', '皮膚感染人次'], ['C5', '腸胃道感染人次'], ['C6', '其它感染人次']],
    mon: [['4.1', '感染發生密度', 'B', 'A', 1000, '‰', '<', 2, 'B/A'], ['4.2', '呼吸道感染發生密度', 'C1', 'A', 1000, '‰', '', '', 'C1/A'], ['4.3', '下呼吸道感染發生密度', 'C2', 'A', 1000, '‰', '', '', 'C2/A'], ['4.4', '泌尿道感染發生密度', 'C3', 'A', 1000, '‰', '', '', 'C3/A'], ['4.5', '使用存留導尿管的泌尿道感染發生密度', 'E', 'D', 1000, '‰', '', '', 'E/D'], ['4.6', '未使用存留導尿管的泌尿道感染發生密度', 'G', 'F', 1000, '‰', '', '', 'G/F'], ['4.7', '皮膚感染率發生密度', 'C4', 'A', 1000, '‰', '', '', 'C4/A'], ['4.8', '腸胃道感染率發生密度', 'C5', 'A', 1000, '‰', '', '', 'C5/A'], ['4.9', '其它感染率發生密度', 'C6', 'A', 1000, '‰', '', '', 'C6/A']],
    cause: [['C1', '呼吸道感染'], ['C3', '泌尿道感染'], ['C4', '皮膚感染'], ['C5', '腸胃道感染'], ['C6', '其它感染']] },
  { no: 5, name: '非計畫性轉至急性醫院住院指標監測', type: '非計畫性住院', main: 'uT',
    data: [['pd', '當月住民總人日數', '保留床人日數'], ['n', '當月住民總人數'], ['allP', '當月轉至急性醫院住院住民之總人數'], ['newR', '當月新住民人數'], ['uP', '當月非計畫性轉至急性醫院住院人數'], ['allT', '當月全體住民轉至急性醫院住院人次'], ['uT', '當月非計畫性轉至急性醫院住院人次'], ['h72', '當月入住72小時(含)內非計畫性轉至急性醫院住院人次'], ['c0', '因「心血管代償機能減退」非計畫性轉至急性醫院住院人次'], ['c1', '因「腸胃道出血」非計畫性轉至急性醫院住院人次'], ['c2', '因「骨折」非計畫性轉至急性醫院住院人次'], ['c3', '因「感染」非計畫性轉至急性醫院住院人次'], ['c4', '因「其他內外科」非計畫性轉至急性醫院住院人次']],
    mon: [['5.1', '轉至急性醫院住院比率', 'allT', 'n', 100, '%', '<', 5, '當月全體住民轉至急性醫院住院人次／當月住民總人數*100%'], ['5.2', '轉至急性醫院住院密度', 'allT', 'pd', 100, '%', '<', 0.5, '當月全體住民轉至急性醫院住院人次／當月住民總人日數*100%'], ['5.3', '非計畫性轉急性醫院住院比率', 'uT', 'allP', 100, '%', '<=', 100, '當月非計畫性轉至急性醫院住院人次／當月轉至急性醫院住院住民之總人數*100'], ['5.4', '新住民入住72小時(含)內非計畫性轉至急性醫院住院比率', 'h72', 'newR', 100, '%', '<=', 0, '當月入住72小時(含)內非計畫性轉至急性醫院住院人次／當月新住民人數*100%']].concat(['心血管代償機能減退', '腸胃道出血', '骨折', '感染', '其他內外科'].map((o, i) => [`5.5.${i + 1}`, `因「${o}」非計畫性轉至急性醫院住院之比率`, 'c' + i, 'uP', 100, '%', '', '', `因「${o}」非計畫性轉至急性醫院住院人次／當月非計畫性轉至急性醫院住院人數*100%`])),
    cause: [['c0', '心血管代償機能減退'], ['c1', '腸胃道出血'], ['c2', '骨折'], ['c3', '感染'], ['c4', '其他內外科']] },
  { no: 6, name: '非計畫性體重改變指標監測', type: '非計畫性體重改變', main: 'B',
    data: [['A', '入住超過30天(含)的住民數'], ['B', '體重減輕5%以上的住民數'], ['C', '體重增加5%以上的住民數'], ['D', '當月新住民人次'], ['D1', '入住時消瘦住民數（BMI<18.5）'], ['D2', '入住時過重住民數（BMI≥24）']],
    mon: [['6.1', '非計畫性體重減輕比率', 'B', 'A', 100, '%', '<', 5, 'B/A'], ['6.2', '非計畫性體重增加比率', 'C', 'A', 100, '%', '<', 5, 'C/A'], ['6.3', '入住時消瘦住民比率', 'D1', 'D', 100, '%', '', '', 'D1/D'], ['6.4', '入住時過重住民比率', 'D2', 'D', 100, '%', '', '', 'D2/D']] },
  { no: 7, name: '管路使用指標監測', type: '管路滑脫／自拔', main: 'B1',
    data: [['A', '當月住民總人日數', '保留床人日數'], ['B1', '使用鼻胃管人日數'], ['B2', '使用存留導尿管人日數'], ['B3', '膀胱造廔人日數'], ['B4', '結腸造廔人日數'], ['S', '管路滑脫／自拔人次'], ['R', '管路成功移除人次']],
    mon: [['7.1', '使用鼻胃管比率', 'B1', 'A', 100, '%', '', '', 'B1/A'], ['7.2', '使用存留導尿管比率', 'B2', 'A', 100, '%', '', '', 'B2/A'], ['7.3', '膀胱造廔比率', 'B3', 'A', 100, '%', '', '', 'B3/A'], ['7.4', '結腸造廔比率', 'B4', 'A', 100, '%', '', '', 'B4/A'], ['7.5', '管路滑脫／自拔密度', 'S', 'TD', 1000, '‰', '<', 1, '管路滑脫自拔人次／管路留置人日數*1000‰']] },
  { no: 8, name: '疼痛指標監測', type: null, main: 'P',
    data: [['A', '當月住民總人日數', '保留床人日數'], ['P', '疼痛（分數>0）紀錄人日數'], ['P4', '中重度疼痛（≥4分）紀錄人日數'], ['N', '有疼痛紀錄住民人數']],
    mon: [['8.1', '當月機構疼痛比率', 'P', 'A', 100, '%', '', '', 'P/A'], ['8.2', '中重度疼痛比率', 'P4', 'A', 100, '%', '<', 2, 'P4/A']] },
];
function qiThr(monId, def) { const t = (DB.settings.qiThr || {})[monId]; return t ? t : def; }

/* --- 計算：保留床（住院期間）人日數不列入住民總人日數 --- */
function hospDays(rid, f, t) {
  let n = 0;
  DB.events.filter(e => e.rid === rid && e.type === '非計畫性住院').forEach(e => {
    const s = e.date > f ? e.date : f; const lastH = DB.events.filter(x => x.rid === rid && x.type === '非計畫性住院').sort((a, b) => b.date.localeCompare(a.date))[0];
    let end = e.returnDate || (e === lastH && resById(rid) && resById(rid).status === '住院中' ? today() : e.date); end = end < t ? end : t;
    if (end >= s) n += diffDays(s, end) + (e.returnDate && e.returnDate <= t ? 0 : 1);
  });
  return n;
}
function injuryLevel(e) { const s = e.injury || ''; return /3級|重度|骨折|死亡/.test(s) ? 3 : /2級|中度/.test(s) ? 2 : /1級|輕度/.test(s) ? 1 : 0; }
function fallCauseKey(e) { const c = e.fallCause || ''; return /健康|個人/.test(c) ? 'F1' : /藥物|治療/.test(c) ? 'F2' : /環境|設備/.test(c) ? 'F3' : 'F4'; }
function stageKey(e) { const s = e.stage || ''; return /1/.test(s) ? 1 : /2/.test(s) ? 2 : /3/.test(s) ? 3 : /4/.test(s) ? 4 : /無法|Unstage/i.test(s) ? 5 : /深部|SDTI/i.test(s) ? 6 : 2; }
function infKey(e) { const s = e.infType || ''; return /下呼吸|肺炎/.test(s) ? 'low' : /呼吸/.test(s) ? 'resp' : /泌尿/.test(s) ? 'uti' : /皮膚|疥/.test(s) ? 'skin' : /腸|腹瀉/.test(s) ? 'gi' : 'other'; }
function heightOf(r) { if (r.height) return +r.height; const m = DB.assessments.filter(a => a.rid === r.id && a.type === 'mna' && a.extra && a.extra.height).sort((a, b) => b.date.localeCompare(a.date))[0]; return m ? +m.extra.height : 0; }
function qiCompute(ind, f, t) {
  const tt = t < today() ? t : today();
  const rs = DB.residents.filter(r => r.admitDate && r.admitDate <= t && (!r.dischargeDate || r.dischargeDate >= f));
  const stay = r => { const s = r.admitDate > f ? r.admitDate : f; const e0 = r.dischargeDate || tt; const e = e0 < tt ? e0 : tt; return e >= s ? diffDays(s, e) + 1 : 0; };
  let rawPd = 0, hosp = 0; rs.forEach(r => { rawPd += stay(r); hosp += hospDays(r.id, f, t); });
  const pd = rawPd - hosp, D = { A: pd, pd, pdEx: hosp, n: rs.length, newR: rs.filter(r => r.admitDate >= f && r.admitDate <= t).length };
  const ev = ind.type ? DB.events.filter(e => e.type === ind.type && e.date >= f && e.date <= t) : [];
  const uniq = a => new Set(a.map(e => e.rid)).size;
  const w72 = e => { const r = resById(e.rid); return e.within72 === '是' || (r && r.admitDate && diffDays(r.admitDate, e.date) <= 3 && e.date >= r.admitDate); };
  const exA = ['A'];
  if (ind.no === 1) { const byR = {}; ev.forEach(e => byR[e.rid] = (byR[e.rid] || 0) + 1); const allYear = DB.events.filter(e => e.type === '跌倒' && e.date <= t && diffDays(e.date, t) <= 365);
    Object.assign(D, { B: uniq(ev), C: ev.length, D: ev.filter(e => injuryLevel(e) > 0).length, E: Object.keys(byR).filter(rid => allYear.filter(e => e.rid === rid).length >= 2).length, F1: 0, F2: 0, F3: 0, F4: 0, G1: ev.filter(e => injuryLevel(e) === 1).length, G2: ev.filter(e => injuryLevel(e) === 2).length, G3: ev.filter(e => injuryLevel(e) === 3).length }); ev.forEach(e => D[fallCauseKey(e)]++); }
  if (ind.no === 2) { const all = DB.events.filter(e => e.type === '壓力性損傷' && e.date <= t && (!e.healDate || e.healDate > t) && !(e.status === '結案' && !e.healDate && (e.updated || e.date).slice(0, 10) <= t)); const nw = ev.filter(e => (e.origin || '機構內新發生') === '機構內新發生');
    Object.assign(D, { A: rs.filter(r => !r.dischargeDate || r.dischargeDate >= tt).length, B: uniq(all), D: rs.length, E: nw.length }); for (let i = 1; i <= 6; i++) { D['C' + i] = all.filter(e => stageKey(e) === i).length; D['F' + i] = nw.filter(e => stageKey(e) === i).length; } exA.length = 0; }
  if (ind.no === 3) { const rr = DB.restraints.filter(x => x.startDate <= t && (!x.endDate || x.endDate >= f)); const rk = x => (x.reasons || []).map(r => /跌倒/.test(r) ? 'C1' : /管路/.test(r) ? 'C2' : /自傷/.test(r) ? 'C3' : /行為/.test(r) ? 'C4' : /治療/.test(r) ? 'C5' : 'C6');
    Object.assign(D, { B: new Set(rr.map(x => x.rid)).size, C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0, D1: rr.filter(x => /4.*8/.test(x.hours || '')).length, D2: rr.filter(x => /8.*16/.test(x.hours || '')).length, D3: rr.filter(x => /16.*24/.test(x.hours || '')).length, E1: rr.filter(x => x.form2).length });
    rr.forEach(x => [...new Set(rk(x))].forEach(k => D[k]++)); const removed = DB.restraints.filter(x => x.endDate && x.endDate >= f && x.endDate <= t); D.F1 = removed.length; D.F2 = removed.filter(x => !DB.restraints.some(y => y.rid === x.rid && y !== x && y.startDate >= x.endDate && diffDays(x.endDate, y.startDate) <= 1)).length; }
  if (ind.no === 4) { const k = ev.map(e => [e, infKey(e)]); const foley = r => r.tubes && r.tubes.foley; const fd = rs.filter(foley).reduce((s, r) => s + stay(r), 0);
    Object.assign(D, { B: ev.length, C1: k.filter(x => x[1] === 'resp' || x[1] === 'low').length, C2: k.filter(x => x[1] === 'low').length, C3: k.filter(x => x[1] === 'uti').length, D: fd, F: pd - fd, E: k.filter(x => x[1] === 'uti' && ((x[0].tubesAt || []).includes('導尿管') || foley(resById(x[0].rid) || {}))).length, C4: k.filter(x => x[1] === 'skin').length, C5: k.filter(x => x[1] === 'gi').length, C6: k.filter(x => x[1] === 'other').length }); D.G = D.C3 - D.E; }
  if (ind.no === 5) { const un = ev.filter(e => !/^計畫性/.test(e.hospPlanned || '')); Object.assign(D, { allP: uniq(ev), allT: ev.length, uP: uniq(un), uT: un.length, h72: un.filter(w72).length }); ['心血管代償機能減退', '腸胃道出血', '骨折', '感染', '其他內外科'].forEach((o, i) => D['c' + i] = un.filter(e => (e.hospCause || '其他內外科') === o).length); ev.splice(0, ev.length, ...un); }
  if (ind.no === 6) { const A = rs.filter(r => diffDays(r.admitDate, tt) >= 30); const chg = r => { const ws = weightsOf(r.id).filter(w => w.date <= t); const inM = ws.filter(w => w.date >= f); let loss = false, gain = false; inM.forEach(w => ws.filter(p => p.date < w.date && diffDays(p.date, w.date) <= 31).forEach(p => { const pc = (w.kg - p.kg) / p.kg * 100; if (pc <= -5) loss = true; if (pc >= 5) gain = true; })); ev.filter(e => e.rid === r.id).forEach(e => { if (/增加/.test(e.wChange || '')) gain = true; else loss = true; }); return { loss, gain }; };
    const nr = rs.filter(r => r.admitDate >= f && r.admitDate <= t); const bmi0 = r => { const h = heightOf(r), w = weightsOf(r.id)[0]; return h && w ? w.kg / Math.pow(h / 100, 2) : 0; };
    Object.assign(D, { A: A.length, B: A.filter(r => chg(r).loss).length, C: A.filter(r => chg(r).gain).length, D: nr.length, D1: nr.filter(r => bmi0(r) && bmi0(r) < 18.5).length, D2: nr.filter(r => bmi0(r) >= 24).length }); exA.length = 0; }
  if (ind.no === 7) { const td = k => rs.filter(r => r.tubes && r.tubes[k]).reduce((s, r) => s + stay(r), 0); Object.assign(D, { B1: td('ng'), B2: td('foley'), B3: td('cysto'), B4: td('colo'), S: ev.length, R: DB.events.filter(e => e.type === '管路移除' && e.date >= f && e.date <= t).length }); D.TD = D.B1 + D.B2 + D.B3 + D.B4; }
  if (ind.no === 8) { const dd = DB.daily.filter(d => d.date >= f && d.date <= t && d.pain !== '' && d.pain != null); Object.assign(D, { P: dd.filter(d => +d.pain > 0).length, P4: dd.filter(d => +d.pain >= 4).length, N: new Set(dd.filter(d => +d.pain > 0).map(d => d.rid)).size }); }
  if (!exA.length) D.pdEx = '';
  const oneMonth = f.slice(8) === '01' && t === monthRange(f.slice(0, 7))[1];
  const ov = oneMonth ? (((DB.settings.qiOverride || {})[`${ind.no}|${f.slice(0, 7)}`]) || {}) : {}; Object.assign(D, ov); if (ov.pd !== undefined) D.A = ov.pd; if (ov.A !== undefined) D.pd = ov.A;
  const M = ind.mon.map(([id, name, num, den, mult, unit, op, thr, formula]) => { const T = qiThr(id, { op, v: thr }); const v = D[den] ? D[num] / D[den] * mult : 0; return { id, name, num, den, unit, v, op: T.op, thr: T.v, formula, ok: !T.op || T.v === '' ? null : qiPass(v, T) }; });
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
  const months = [...Array(12)].map((_, i) => { const n = new Date(); return ymd(new Date(n.getFullYear(), n.getMonth() - i, 1)).slice(0, 7); });
  return `${qiTabs('qimonth')}<div class="hd"><div><h1>指標監測月統計表</h1><p class="sub">資料收集數值由系統自動計算（人日數已扣除住院保留床人日）。數值有誤可直接修改，會記錄為人工校正。每月 5 日前確認上月報表。</p></div><span class="sp"></span>
    <select id="qmSel" style="padding:7px;border:1px solid var(--line);border-radius:8px">${months.map(x => `<option${x === m ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
  <div class="row" style="margin-bottom:12px"><span class="chip ${done ? 'ok' : 'warn'}">${done ? `已確認（${esc(done.by)}，${roc(done.date)}）` : '尚未確認'}</span><span class="sp"></span><button class="btn" data-act="qmPrint" data-m="${m}">列印／Word：全部指標</button><button class="btn pri" data-act="qmDone" data-m="${m}">確認本月報表</button></div>
  ${QI.map(ind => { const { D, M } = qiCompute(ind, f, t); const ov = (DB.settings.qiOverride || {})[`${ind.no}|${m}`] || {};
    return `<details class="acc-item" ${M.some(x => x.ok === false) ? 'open' : ''}><summary><span class="code">${ind.no}</span><b style="flex:1">${ind.name}</b>${M.some(x => x.ok === false) ? '<span class="chip bad">超過閾值</span>' : '<span class="chip ok">閾值內</span>'}<button class="btn sm" data-act="qmPrintOne" data-m="${m}" data-no="${ind.no}">列印</button></summary>
    <div class="body grid g2" style="align-items:start"><div><h3>資料收集</h3><table class="t">${ind.data.map(([k, l, ex]) => `<tr><td>${l}${/^[A-Z]\d?$/.test(k) ? `(${k})` : ''}</td><td style="width:90px"><input type="number" class="qmIn" data-no="${ind.no}" data-m="${m}" data-k="${k}" value="${D[k]}" style="width:80px;padding:4px;border:1px solid ${ov[k] !== undefined ? 'var(--amber)' : 'var(--line)'};border-radius:6px"></td><td class="small muted">${ex && D.pdEx !== '' ? `${ex} ${D.pdEx}` : ''}</td></tr>`).join('')}
</table></div>
    <div><h3>指標監測</h3><table class="t">${M.map(x => `<tr><td class="nowrap">${x.id}</td><td>${esc(x.name)}<div class="small muted">${esc(x.formula)}</div></td><td class="nowrap">${thrText(x)}</td><td class="nowrap"><b style="color:${x.ok === false ? 'var(--bad)' : 'inherit'}">${fmtV(x)}</b></td></tr>`).join('')}</table></div></div></details>`; }).join('')}`;
};
ROUTES.after_qimonth = () => {
  $('#qmSel').addEventListener('change', e => { qiMonth = e.target.value; refresh(); });
  $$('.qmIn').forEach(i => i.addEventListener('change', () => { const key = `${i.dataset.no}|${i.dataset.m}`; const o = DB.settings.qiOverride || {}; o[key] = Object.assign({}, o[key]); if (i.value === '') delete o[key][i.dataset.k]; else o[key][i.dataset.k] = +i.value; setKV('settings', 'qiOverride', o); toast(i.value === '' ? '已還原系統計算值' : '已人工校正，監測值已重新計算（清空欄位可還原）'); refresh(); }));
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
  const months = [0, 1, 2].map(i => { const d0 = new Date(f + 'T00:00:00'); return ymd(new Date(d0.getFullYear(), d0.getMonth() + i, 1)).slice(0, 7); }).filter(m => m <= today().slice(0, 7));
  const mm = months.map(m => qiCompute(ind, ...monthRange(m)));
  const qLabel = `${+q.slice(0, 4) - 1911} 年 ${(+q.slice(-1) - 1) * 3 + 1} 至 ${+q.slice(-1) * 3} 月`;
  const lbl = (ind.data.find(d => d[0] === ind.main) || [, '件數'])[1].replace(/^當月/, '');
  const problem = `${qLabel}${lbl.includes(ind.name.replace('指標監測', '')) ? '' : ind.name.replace('指標監測', '')}${lbl} N=${cur.D[ind.main] || 0}，${m0.name}為 ${fmtV(m0)}，${m0.op && m0.thr !== '' ? (m0.ok === false ? `超過設定閾值 ${thrText(m0)}` : `未超過設定閾值 ${thrText(m0)}`) : '尚未設定閾值'}。`;
  let cause = '';
  if (ind.cause) { const tot = ind.cause.reduce((s, [k]) => s + (cur.D[k] || 0), 0) || 1; cause = ind.cause.filter(([k]) => cur.D[k]).map(([k, o], i) => `${i + 1}. ${o} n=${cur.D[k]}（${(cur.D[k] / tot * 100).toFixed(1)}%）。`).join('\n'); }
  if (!cause) cause = cur.ev.map((e, i) => `${i + 1}. ${roc(e.date)} ${(e.cause || '原因待分析').slice(0, 40)}`).join('\n') || '本季無發生案件。';
  const check = `1. ${months.map(m => +m.slice(5)).join('、')} 月分別為 ${mm.map(x => `${x.D[ind.main] || 0}（${fmtV(x.M[0])}）`).join('、')}，續監測。`;
  return { A: thrText(m0), B: fmtV(p0), C: fmtV(m0), dA: m0.thr !== '' && m0.op ? (m0.v - m0.thr).toFixed(2) + m0.unit : '－', dB: (m0.v - p0.v).toFixed(2) + m0.unit, problem, cause, check, period: qLabel };
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
  const rows = ind.data.map(([k, l, ex]) => [l + (/^[A-Z]\d?$/.test(k) ? `(${k})` : ''), D[k], ex && D.pdEx !== '' ? `${ex}<br>${D.pdEx}` : '']);
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
