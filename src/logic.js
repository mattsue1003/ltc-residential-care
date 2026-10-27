/* 規則引擎：到期提醒、品質指標、評鑑佐證 */
function activeResidents(onDate) {
  const d = onDate || today();
  return DB.residents.filter(r => r.admitDate && r.admitDate <= d && (!r.dischargeDate || r.dischargeDate >= d))
    .sort((a, b) => (a.bed || '').localeCompare(b.bed || '', 'zh-Hant', { numeric: true }));
}
function inHouse(r) { return !r.dischargeDate && r.status !== '退住' && r.status !== '往生'; }
function resById(id) { return DB.residents.find(r => r.id === id); }
function resLabel(r) { return r ? `${r.bed || ''} ${r.name}` : '（已刪除）'; }
function byRes(coll, rid) { return DB[coll].filter(x => x.rid === rid).sort((a, b) => (b.date || '').localeCompare(a.date || '')); }
function latestAssess(rid) {
  const out = {};
  DB.assessments.filter(a => a.rid === rid).sort((a, b) => b.date.localeCompare(a.date)).forEach(a => { if (!out[a.type]) out[a.type] = a; });
  return out;
}
function latestContact(rid, kind) { return DB.contacts.filter(c => c.rid === rid && c.kind === kind).sort((a, b) => b.date.localeCompare(a.date))[0]; }
function planSort(a, b) { return b.date.localeCompare(a.date) || (b.created || '').localeCompare(a.created || ''); }
function latestPlan(rid) { return DB.plans.filter(p => p.rid === rid).sort(planSort)[0]; }
function weightsOf(rid) { return DB.weights.filter(w => w.rid === rid).sort((a, b) => a.date.localeCompare(b.date)); }
function activeRestraint(rid) { return DB.restraints.find(x => x.rid === rid && !x.endDate); }
function contactEvery(k) { return k === '醫師巡診' ? facType().doctor : (CONTACT_KINDS[k] || {}).every || 0; }
function scaleCycle(t) { return t === 'social' || accVer() !== 'elder' ? SCALES[t].cycle : facType().cycle; }
function isSummer(d) { const m = +d.slice(5, 7); return m >= 6 && m <= 9; }

/* 體重：30 天內 ±5% */
function weightAlert(rid) {
  const ws = weightsOf(rid); if (ws.length < 2) return null;
  const last = ws[ws.length - 1];
  const prev = ws.filter(w => diffDays(w.date, last.date) >= 1 && diffDays(w.date, last.date) <= 31);
  for (const p of prev) { const pct = (last.kg - p.kg) / p.kg * 100; if (Math.abs(pct) >= 5) return { pct, from: p, to: last }; }
  return null;
}

/* ===== 提醒引擎 ===== */
function buildReminders() {
  const T = today(), list = [];
  // 舊住民（入住已久卻無紀錄）從今天起算，不顯示上千天的逾期
  const firstDue = (admit, days) => diffDays(admit, T) > days + 30 ? T : addDays(admit, days);
  const push = (o) => list.push(Object.assign({ level: 'warn' }, o));
  const status = (due) => { const d = diffDays(T, due); return d < 0 ? 'bad' : d <= 7 ? 'warn' : 'info'; };
  activeResidents().forEach(r => {
    if (!inHouse(r)) return;
    const la = latestAssess(r.id), daysIn = diffDays(r.admitDate, T);
    // B2 入住 72 小時評估與每 3 個月評估
    // 同一住民同類到期的量表合併成一筆，處理時依序帶出
    const first = [], periodic = [];
    CORE_SCALES.forEach(t => {
      const a = la[t];
      if (!a || a.date < r.admitDate) first.push(t);
      else { const due = addDays(a.date, scaleCycle(t)); if (diffDays(T, due) <= 14) periodic.push([t, due, a.date]); }
    });
    if (first.length) { const old = diffDays(r.admitDate, T) > 33; const due = firstDue(r.admitDate, 3); push({ rid: r.id, cat: '評估', ref: 'B2', title: `${old ? '尚無評估紀錄，請補做定期評估' : '入住 72 小時評估'}：${first.map(t => SCALES[t].short).join('、')}`, due, level: status(due), act: `assess:${r.id}:${first.join(',')}` }); }
    if (periodic.length) { periodic.sort((x, y) => x[1].localeCompare(y[1])); const due = periodic[0][1]; push({ rid: r.id, cat: '評估', ref: 'B2', title: `每 ${Math.round(facType().cycle / 30)} 個月定期評估：${periodic.map(p => SCALES[p[0]].short).join('、')}（上次 ${roc(periodic[0][2])}）`, due, level: status(due), act: `assess:${r.id}:${periodic.map(p => p[0]).join(',')}` }); }
    // 照顧計畫
    const p = latestPlan(r.id);
    if (!p) { const due = firstDue(r.admitDate, 3); push({ rid: r.id, cat: '照顧計畫', ref: 'B2', title: '擬定個別化照顧計畫', due, level: status(due), act: `plan:${r.id}` }); }
    else {
      const fam = p.familyDate || '';
      const due = addDays(fam || p.date, 183);
      if (!fam) push({ rid: r.id, cat: '照顧計畫', ref: 'B2', title: '照顧計畫尚未與家屬共同討論', due: addDays(p.date, 30), level: status(addDays(p.date, 30)), act: `plan:${r.id}` });
      else if (diffDays(T, due) <= 14) push({ rid: r.id, cat: '照顧計畫', ref: 'B2', title: `每半年與家屬共同修正照顧計畫（上次 ${roc(fam)}）`, due, level: status(due), act: `plan:${r.id}` });
      const evalDue = (p.problems || []).filter(x => !/已達成|問題解除/.test(x.result || '')).map(x => x.evalDate).filter(Boolean).sort()[0];
      if (evalDue && diffDays(T, evalDue) <= 7) push({ rid: r.id, cat: '照顧計畫', ref: 'B2', title: '照顧問題到期評值', due: evalDue, level: status(evalDue), act: `plan:${r.id}` });
    }
    // 醫師、藥師、家屬、健檢
    Object.entries(CONTACT_KINDS).forEach(([k, c0]) => {
      const c = Object.assign({}, c0, { every: contactEvery(k) }); if (!c.every) return;
      if (k === '家屬電訪／會談' && r.noFamily) return;
      const last = latestContact(r.id, k);
      let due;
      if (!last) due = firstDue(r.admitDate, k === '醫師巡診' ? 30 : k === '年度健康檢查' ? 365 : c.every);
      else due = addDays(last.date, c.every);
      if (diffDays(T, due) <= (c.every >= 90 ? 14 : 5)) push({ rid: r.id, cat: '訪視聯繫', ref: c.ref, title: `${k}${last ? `（上次 ${roc(last.date)}）` : k === '醫師巡診' ? '：新入住 1 個月內完成醫師診察' : ''}`, due, level: status(due), act: `contact:${r.id}:${k}` });
    });
    // 約束
    const rs = activeRestraint(r.id);
    if (rs) {
      const exp = addDays(rs.consentDate || rs.startDate, 90);
      if (diffDays(T, exp) <= 14) push({ rid: r.id, cat: '約束', ref: 'D11', title: `約束同意書 ${diffDays(T, exp) < 0 ? '已過期' : '即將到期'}（3 個月有效）`, due: exp, level: status(exp), act: `restraint:${rs.id}` });
      if (!(rs.checks || []).some(c => c.date === T)) push({ rid: r.id, cat: '約束', ref: 'B15', title: '今日約束監測與解除評估未記錄', due: T, level: 'warn', act: `restraint:${rs.id}` });
    }
    // 體重
    const ws = weightsOf(r.id), lw = ws[ws.length - 1];
    const wdue = lw ? addDays(lw.date, 30) : firstDue(r.admitDate, 3);
    if (diffDays(T, wdue) <= 3) push({ rid: r.id, cat: '體重', ref: 'B18', title: `每月體重測量${lw ? `（上次 ${roc(lw.date)}）` : ''}`, due: wdue, level: status(wdue), act: `weight:${r.id}` });
    const wa = weightAlert(r.id);
    if (wa && !DB.events.some(e => e.rid === r.id && e.type === '非計畫性體重改變' && e.date >= wa.from.date))
      push({ rid: r.id, cat: '體重', ref: 'B18', title: `30 天內體重${wa.pct > 0 ? '增加' : '減少'} ${Math.abs(wa.pct).toFixed(1)}%，需收案分析`, due: wa.to.date, level: 'bad', act: `event:${r.id}:非計畫性體重改變` });
    // 每日照護
    const dToday = DB.daily.find(d => d.rid === r.id && d.date === T);
    const away = r.status === '住院中';
    if (!away && (!dToday || dToday.temp === undefined || dToday.temp === '')) push({ rid: r.id, cat: '每日', ref: 'B9', title: '今日體溫尚未記錄', due: T, level: 'info', act: 'daily' });
    const y = addDays(T, -1), dY = (r.admitDate < y && !away) ? (DB.daily.find(d => d.rid === r.id && d.date === y) || { oob: 0 }) : null;
    if (dY && r.mobility !== '臥床不宜移動' && (+dY.oob || 0) < (r.consciousness === '意識不清' ? 1 : 2))
      push({ rid: r.id, cat: '每日', ref: 'B24', title: `昨日下床 ${+dY.oob || 0} 次（應至少 ${r.consciousness === '意識不清' ? 1 : 2} 次）`, due: y, level: 'warn', act: 'daily' });
    if (daysIn >= 7 && !away) {
      const baths = DB.daily.filter(d => d.rid === r.id && d.bath && diffDays(d.date, T) < 7 && d.date <= T).length;
      const need = isSummer(T) ? 3 : 2;
      if (baths < need) push({ rid: r.id, cat: '每日', ref: 'B25', title: `近 7 天洗澡 ${baths} 次（${isSummer(T) ? '夏季' : ''}應至少 ${need} 次）`, due: T, level: 'warn', act: 'daily' });
    }
    // 每 2 小時翻身／如廁（昨日）
    if (dY && /臥床/.test(r.mobility || '')) { const n = Object.keys(dY.turns || {}).length; if (n < 10) push({ rid: r.id, cat: '每日', ref: 'B25', title: `昨日翻身紀錄 ${n}/12 次（臥床者每 2 小時）`, due: y, level: n < 6 ? 'bad' : 'warn', act: 'daily' }); }
    if (dY && r.incontinence) { const n = Object.keys(dY.toilets || {}).length; if (n < 8) push({ rid: r.id, cat: '每日', ref: 'B26', title: `昨日定時如廁紀錄 ${n} 次（每 2 小時）`, due: y, level: 'warn', act: 'daily' }); }
    // 異常生命徵象（今日）
    if (dToday) { const ab = vitalFlags(dToday); if (ab.length) push({ rid: r.id, cat: '異常', ref: 'B8 B14', title: `今日異常：${ab.join('、')}`, due: T, level: 'bad', act: `resident:${r.id}` }); }
    // 疫苗（每年 10 月起流感季）
    const season = +T.slice(5, 7) >= 10 ? T.slice(0, 4) : String(+T.slice(0, 4) - 1);
    if (+T.slice(5, 7) >= 10 || +T.slice(5, 7) <= 3) {
      const flu = DB.vaccines.find(v => v.rid === r.id && v.kind === '流感' && v.date >= season + '-09-01');
      if (!flu) push({ rid: r.id, cat: '疫苗', ref: 'B23', title: '本季流感疫苗未接種或未登錄原因', due: season + '-12-31', level: 'info', act: `vaccine:${r.id}` });
    }
    // 長照法 46 條
    if (r.noGuardian && !r.d10Notified) push({ rid: r.id, cat: '權益', ref: 'D10', title: '無扶養義務人／法定代理人：需通知地方主管機關', due: addDays(r.admitDate, 7), level: 'bad', act: `resident:${r.id}` });
    // 未結案事件
    DB.events.filter(e => e.rid === r.id && e.status !== '結案' && !(e.cause && e.action)).forEach(e =>
      push({ rid: r.id, cat: '事件', ref: EVENT_TYPES[e.type] ? EVENT_TYPES[e.type].ref : '', title: `${e.type}事件待完成原因分析與處置`, due: addDays(e.date, 7), level: status(addDays(e.date, 7)), act: `eventedit:${e.id}` }));
  });
  // 機構層級
  facilityTasks().forEach(t => {
    const last = DB.meetings.filter(m => m.kind === t.kind).sort((a, b) => b.date.localeCompare(a.date))[0];
    const due = last ? addDays(last.date, t.every) : T;
    if (diffDays(T, due) <= 14) push({ rid: null, cat: '機構', ref: t.ref, title: `${t.kind}${last ? `（上次 ${roc(last.date)}）` : '：尚無紀錄'}`, due, level: status(due), act: `meeting:${t.kind}` });
  });
  // 每月指標統計表（下個月 5 日前確認）
  { const d = new Date(T + 'T00:00:00'); d.setDate(0); const pm = ymd(d).slice(0, 7); const md = (DB.settings.qiMonthDone || {})[pm];
    if (!md && DB.residents.length) { const due = `${T.slice(0, 7)}-05`; push({ rid: null, cat: '機構', ref: 'B12–B19', title: `${+pm.slice(0, 4) - 1911} 年 ${+pm.slice(5)} 月指標監測月統計表待確認`, due, level: status(due), act: 'go:qimonth' }); } }
  // 年度分析（隔年 1 月底前）
  { const py = String(+T.slice(0, 4) - 1), Y = (DB.quarterly['Y' + py] || {}).pdca || {}; if (DB.residents.length && +T.slice(5, 7) <= 3 && !QI.every(i => Y[i.no] && Y[i.no].done)) { const due = `${T.slice(0, 4)}-01-31`; push({ rid: null, cat: '機構', ref: 'B12–B19', title: `${+py - 1911} 年度指標分析報告尚未完成`, due, level: status(due), act: 'go:qiyear' }); } }
  // 季分析
  const pq = prevQuarter(quarterOf(T));
  if (!(DB.quarterly[pq] && DB.quarterly[pq].done)) push({ rid: null, cat: '機構', ref: 'B12–B18', title: `${pq.replace('-Q', ' 年第 ')} 季 PDCA 改善報告單尚未完成`, due: addDays(quarterRange(quarterOf(T))[0], 4), level: status(addDays(quarterRange(quarterOf(T))[0], 4)), act: 'go:qipdca' });
  const order = { bad: 0, warn: 1, info: 2 };
  return list.sort((a, b) => order[a.level] - order[b.level] || a.due.localeCompare(b.due));
}
function prevQuarter(q) { let [y, n] = q.split('-Q').map(Number); n--; if (!n) { n = 4; y--; } return `${y}-Q${n}`; }

function vitalFlags(d) {
  const f = [];
  if (d.temp !== '' && d.temp != null && +d.temp >= 37.5) f.push(`體溫 ${d.temp}`);
  if (d.sbp && (+d.sbp >= 180 || +d.sbp < 90)) f.push(`收縮壓 ${d.sbp}`);
  if (d.pulse && (+d.pulse > 110 || +d.pulse < 50)) f.push(`脈搏 ${d.pulse}`);
  if (d.spo2 && +d.spo2 < 93) f.push(`血氧 ${d.spo2}%`);
  if (d.pain && +d.pain >= 4) f.push(`疼痛 ${d.pain} 分`);
  if (d.sugar && (+d.sugar >= 300 || +d.sugar < 70)) f.push(`血糖 ${d.sugar}`);
  return f;
}

/* ===== 品質指標 ===== */
function residentDays(from, to) {
  let n = 0;
  DB.residents.forEach(r => {
    if (!r.admitDate) return;
    const s = r.admitDate > from ? r.admitDate : from;
    const end = r.dischargeDate || today(); const e = end < to ? end : to;
    if (e >= s) n += diffDays(s, e) + 1;
  });
  return n;
}
function restraintDays(from, to) {
  let n = 0;
  DB.restraints.forEach(x => { const s = x.startDate > from ? x.startDate : from; const end = x.endDate || today(); const e = end < to ? end : to; if (e >= s) n += diffDays(s, e) + 1; });
  return n;
}
function avgCensus(from, to) { const days = diffDays(from, to < today() ? to : today()) + 1; return days > 0 ? residentDays(from, to) / days : 0; }
function qualityStats(from, to) {
  const rd = residentDays(from, to);
  const ev = t => DB.events.filter(e => e.type === t && e.date >= from && e.date <= to);
  const per1000 = n => rd ? (n / rd * 1000) : 0;
  const census = avgCensus(from, to);
  const pi = ev('壓力性損傷').filter(e => (e.origin || '機構內新發生') === '機構內新發生');
  const tubesRemoved = DB.events.filter(e => e.type === '管路移除' && e.date >= from && e.date <= to).length;
  const adlDecline = DB.residents.filter(r => {
    const as = DB.assessments.filter(a => a.rid === r.id && a.type === 'barthel' && a.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    if (as.length < 2) return false; const last = as[as.length - 1]; if (last.date < from) return false;
    return last.score < as[as.length - 2].score;
  }).length;
  const painHigh = DB.daily.filter(d => d.date >= from && d.date <= to && +d.pain >= 4).length;
  return {
    rd, census: census.toFixed(1),
    rows: [
      { key: '跌倒', ref: 'B12', n: ev('跌倒').length, rate: per1000(ev('跌倒').length), unit: '‰ 人日', inj: ev('跌倒').filter(e => e.injury && !e.injury.startsWith('無')).length },
      { key: '壓力性損傷（機構內新發生）', ref: 'B13', n: pi.length, rate: per1000(pi.length), unit: '‰ 人日' },
      { key: '約束', ref: 'B15', n: DB.restraints.filter(x => x.startDate <= to && (!x.endDate || x.endDate >= from)).length, rate: rd ? restraintDays(from, to) / rd * 100 : 0, unit: '% 人日' },
      { key: '感染', ref: 'B16', n: ev('感染').length, rate: per1000(ev('感染').length), unit: '‰ 人日' },
      { key: '非計畫性住院', ref: 'B17', n: ev('非計畫性住院').length, rate: per1000(ev('非計畫性住院').length), unit: '‰ 人日' },
      { key: '非計畫性體重改變', ref: 'B18', n: ev('非計畫性體重改變').length, rate: census ? ev('非計畫性體重改變').length / census * 100 : 0, unit: '% 平均住民' },
      { key: '管路滑脫／自拔', ref: 'B19', n: ev('管路滑脫／自拔').length, rate: per1000(ev('管路滑脫／自拔').length), unit: '‰ 人日' },
      { key: '管路成功移除', ref: 'B19', n: tubesRemoved, rate: null, unit: '件' },
      { key: '疼痛 ≥ 4 分紀錄', ref: 'B14', n: painHigh, rate: null, unit: '人次' },
      { key: 'ADL 退步', ref: 'B27', n: adlDecline, rate: census ? adlDecline / census * 100 : 0, unit: '% 平均住民' },
    ],
  };
}

/* ===== 評鑑自動佐證 ===== */
function accredEvidence(code) {
  const T = today(), res = activeResidents().filter(inHouse), N = res.length || 1;
  const pct = (n) => Math.round(n / N * 100);
  const within = (d, days) => d && diffDays(d, T) <= days;
  const lastMeet = k => DB.meetings.filter(m => m.kind === k).sort((a, b) => b.date.localeCompare(a.date))[0];
  const it = accredFlat().find(x => x.code === code); if (!it || !it.auto) return null;
  const a = it.auto;
  const meetLine = (k, days) => { const m = lastMeet(k); return m ? (within(m.date, days) ? ['ok', `最近一次 ${roc(m.date)}`] : ['bad', `上次 ${roc(m.date)}，已逾期`]) : ['bad', '系統內尚無紀錄']; };
  if (a === 'qmeet') return meetLine('服務品質會議', 92);
  if (a === 'idt') { const m = lastMeet('跨專業個案討論'); if (!m) return ['bad', '尚無跨專業個案討論紀錄']; const disc = (m.disciplines || []).length || (m.participants || '').split(/[、,，\s]+/).filter(Boolean).length; return within(m.date, 92) ? [disc >= 3 ? 'ok' : 'warn', `最近 ${roc(m.date)}，參與 ${disc} 人／職類`] : ['bad', `上次 ${roc(m.date)}，已逾 3 個月`]; }
  if (a === 'group') { const ms = [0, 1, 2].map(i => { const n = new Date(); return ymd(new Date(n.getFullYear(), n.getMonth() - i, 1)).slice(0, 7); }); const ok = ms.filter(m => DB.meetings.some(x => x.kind === '團體活動' && x.date.startsWith(m))).length; return [ok === 3 ? 'ok' : ok ? 'warn' : 'bad', `近 3 個月有辦理的月份 ${ok}/3`]; }
  if (a === 'b2') {
    let ok72 = 0, okQ = 0, okPlan = 0, okFam = 0;
    res.forEach(r => { const la = latestAssess(r.id);
      if (CORE_SCALES.every(t => DB.assessments.some(x => x.rid === r.id && x.type === t && diffDays(r.admitDate, x.date) <= 3 && x.date >= r.admitDate))) ok72++;
      if (CORE_SCALES.every(t => la[t] && within(la[t].date, scaleCycle(t) + 2))) okQ++;
      const p = latestPlan(r.id); if (p) okPlan++; if (p && p.familyDate && within(p.familyDate, 183)) okFam++; });
    const s = Math.min(pct(okQ), pct(okPlan));
    return [s >= 95 ? 'ok' : s >= 70 ? 'warn' : 'bad', `72 小時評估完成 ${pct(ok72)}%｜期限內評估齊全 ${pct(okQ)}%｜有照顧計畫 ${pct(okPlan)}%｜半年內家屬共同討論 ${pct(okFam)}%`];
  }
  if (a === 'adapt') { const n = res.filter(r => DB.assessments.some(x => x.rid === r.id && x.type === 'social')).length; return [n === res.length ? 'ok' : 'warn', `完成社會心理（適應）評估 ${pct(n)}%`]; }
  if (a === 'family') { const n = res.filter(r => r.noFamily || DB.contacts.some(c => c.rid === r.id && c.kind === '家屬電訪／會談' && within(c.date, 92))).length; const y = DB.meetings.filter(m => m.kind === '家屬座談／教育' && m.date.startsWith(T.slice(0, 4))).length; return [pct(n) >= 95 && y >= 2 ? 'ok' : 'warn', `本季家屬電訪覆蓋 ${pct(n)}%｜今年家屬座談／教育 ${y} 次（應 ≥ 2）`]; }
  if (a === 'doctor') { const dd = facType().doctor; const n = res.filter(r => DB.contacts.some(c => c.rid === r.id && c.kind === '醫師巡診' && within(c.date, dd + 1))).length; return [pct(n) >= 95 ? 'ok' : 'warn', `近 ${Math.round(dd / 30)} 個月醫師巡診覆蓋 ${pct(n)}%`]; }
  if (a === 'pharm') { const n = res.filter(r => DB.contacts.some(c => c.rid === r.id && c.kind === '藥師評估' && within(c.date, 92))).length; return [pct(n) >= 95 ? 'ok' : 'warn', `近 3 個月藥師評估覆蓋 ${pct(n)}%`]; }
  if (a === 'temp') { const days = [...Array(7)].map((_, i) => addDays(T, -i - 1)); let need = 0, got = 0; res.forEach(r => days.forEach(d => { if (d >= r.admitDate) { need++; if (DB.daily.some(x => x.rid === r.id && x.date === d && x.temp !== '' && x.temp != null)) got++; } })); const audit = lastMeet('手部衛生稽核'); return [need && got / need >= .98 ? 'ok' : 'warn', `近 7 天體溫紀錄完整率 ${need ? Math.round(got / need * 100) : 0}%｜手部衛生稽核 ${audit ? roc(audit.date) : '無紀錄'}`]; }
  if (a.startsWith('ev:')) {
    const t = a.slice(3); const q = prevQuarter(quarterOf(T)); const [f, e] = quarterRange(q);
    const all = DB.events.filter(x => x.type === t && x.date >= addDays(T, -365)); const done = all.filter(x => x.cause && x.action).length;
    const qd = DB.quarterly[q] && DB.quarterly[q].done;
    return [(!all.length || done === all.length) && qd ? 'ok' : 'warn', `近一年 ${all.length} 件，逐案分析完成 ${done} 件｜${q.replace('-Q', ' Q')} 季分析${qd ? '已完成' : '未完成'}`];
  }
  if (a === 'pain') { const n = res.filter(r => latestAssess(r.id).pain).length; const d = DB.daily.filter(x => x.date === addDays(T, -1)).filter(x => x.pain !== '' && x.pain != null).length; return [pct(n) >= 95 ? 'ok' : 'warn', `已完成疼痛評估 ${pct(n)}%｜昨日生命徵象含疼痛分數 ${d} 人`]; }
  if (a === 'restraint' || a === 'consent') {
    const act = DB.restraints.filter(x => !x.endDate);
    const bad = act.filter(x => !x.consentDate || diffDays(x.consentDate, T) > 90 || !(x.reasons || []).length || !(x.alternatives || []).length || (x.consentDate && x.consentDate < x.startDate && diffDays(x.consentDate, x.startDate) > 1));
    const noChk = act.filter(x => !(x.checks || []).some(c => c.date === T || c.date === addDays(T, -1)));
    return [bad.length || noChk.length ? 'bad' : 'ok', `目前約束 ${act.length} 人｜同意書／評估不完整 ${bad.length} 人｜近 2 日缺監測 ${noChk.length} 人`];
  }
  if (a === 'weight') { const n = res.filter(r => { const w = weightsOf(r.id).pop(); return w && within(w.date, 31); }).length; const al = res.filter(r => weightAlert(r.id)).length; return [pct(n) >= 95 ? 'ok' : 'warn', `近 1 個月量體重 ${pct(n)}%｜目前 ±5% 警示 ${al} 人`]; }
  if (a === 'tube') { const ng = res.filter(r => r.tubes && r.tubes.ng).length, fo = res.filter(r => r.tubes && r.tubes.foley).length; const tr = res.filter(r => r.tubes && (r.tubes.ng || r.tubes.foley)).filter(r => DB.contacts.some(c => c.rid === r.id && (c.kind === '吞嚥／管路移除訓練' || c.kind === '膀胱訓練'))).length; return [tr ? 'ok' : 'warn', `鼻胃管 ${ng} 人、導尿管 ${fo} 人｜有移除訓練紀錄 ${tr} 人`]; }
  if (a === 'check') { const n = res.filter(r => DB.contacts.some(c => c.rid === r.id && c.kind === '年度健康檢查' && within(c.date, 365))).length; return [pct(n) >= 95 ? 'ok' : 'warn', `一年內完成健康檢查 ${pct(n)}%`]; }
  if (a === 'invasive') return meetLine('侵入性技術稽核', 183);
  if (a === 'vaccine') { const season = +T.slice(5, 7) >= 10 ? T.slice(0, 4) : String(+T.slice(0, 4) - 1); const flu = res.filter(r => DB.vaccines.some(v => v.rid === r.id && v.kind === '流感' && !v.refused && v.date >= season + '-09-01')).length;
    const old = res.filter(r => age(r.birth) >= 65); const pn = old.filter(r => DB.vaccines.some(v => v.rid === r.id && v.kind === '肺鏈 PCV' && !v.refused) && DB.vaccines.some(v => v.rid === r.id && v.kind === '肺鏈 PPV23' && !v.refused)).length;
    const cv = res.filter(r => DB.vaccines.some(v => v.rid === r.id && v.kind === 'COVID-19' && !v.refused && within(v.date, 365))).length;
    const st = DB.settings.staff || {}; const sf = st.total ? Math.round((st.flu || 0) / st.total * 100) : null;
    const fp = pct(flu), pp = old.length ? Math.round(pn / old.length * 100) : 0, cp = pct(cv);
    return [fp >= 80 && pp >= 40 && cp >= 40 && (sf === null || sf >= 80) ? 'ok' : 'warn', `住民流感 ${fp}%（≥80）｜肺鏈兩劑 ${pp}%（≥40）｜COVID-19 ${cp}%（≥40）｜員工流感 ${sf === null ? '未填' : sf + '%'}`]; }
  if (a === 'oob') { const y = addDays(T, -1); const elig = new Set(res.filter(r => r.mobility !== '臥床不宜移動' && r.status !== '住院中' && r.consciousness !== '意識不清').map(r => r.id)); const ds = DB.daily.filter(d => d.date === y && elig.has(d.rid)); const ok = ds.filter(d => (+d.oob || 0) >= 2).length; return [ds.length && ok / ds.length >= .9 ? 'ok' : 'warn', `昨日下床 ≥ 2 次 ${ds.length ? Math.round(ok / ds.length * 100) : 0}%（${ok}/${ds.length}）`]; }
  if (a === 'bath') { const need = isSummer(T) ? 3 : 2; const ok = res.filter(r => DB.daily.filter(d => d.rid === r.id && d.bath && diffDays(d.date, T) < 7 && d.date <= T).length >= need).length; const bb = res.filter(r => /臥床/.test(r.mobility || '')), y = addDays(T, -1); const tOk = bb.filter(r => { const d = DB.daily.find(x => x.rid === r.id && x.date === y); return d && Object.keys(d.turns || {}).length >= 10; }).length; return [pct(ok) >= 95 && tOk === bb.length ? 'ok' : 'warn', `近 7 天洗澡達 ${need} 次 ${pct(ok)}%｜臥床者昨日翻身紀錄完整 ${tOk}/${bb.length}`]; }
  if (a === 'toilet') { const n = res.filter(r => r.incontinence).length; const p = res.filter(r => r.incontinence && latestPlan(r.id) && (latestPlan(r.id).problems || []).some(x => /如廁|失禁/.test(x.problem))).length; return [n === p ? 'ok' : 'warn', `有失禁之虞 ${n} 人，照顧計畫含定時如廁 ${p} 人`]; }
  if (a === 'diet') return meetLine('膳食滿意度調查', 183);
  if (a === 'ng') { const n = res.filter(r => r.tubes && r.tubes.ng).length; return [n ? 'warn' : 'ok', n ? `管灌 ${n} 人：請確認個別空針、每日天然食材與技術稽核` : '目前無管灌住民（不適用）']; }
  if (a === 'satis') return meetLine('服務滿意度調查', 365);
  if (a === 'drill' && accVer() === 'elder') { const ms = DB.meetings.filter(m => m.kind === '緊急災害應變演練' && m.date.startsWith(T.slice(0, 4))); const night = ms.some(m => /夜間/.test((m.title || '') + (m.drillTypes || []).join())), combo = ms.some(m => /複合/.test((m.title || '') + (m.drillTypes || []).join())); const el = DB.meetings.filter(m => m.kind === '用電設備自主檢查' && within(m.date, 31)).length; return [night && combo && el ? 'ok' : 'warn', `今年演練 ${ms.length} 次（夜間${night ? '✓' : '✗'}、複合型${combo ? '✓' : '✗'}）｜本月用電自主檢查${el ? '✓' : '✗'}`]; }
  if (a === 'drill') { const y = DB.meetings.filter(m => m.kind === '緊急災害應變演練' && m.date.startsWith(T.slice(0, 4))).length; return [y >= Math.ceil((+T.slice(5, 7)) / 3) ? 'ok' : 'warn', `今年已演練 ${y} 次（每季 1 次、全年 ≥ 4）`]; }
  if (a === 'risk') return meetLine('危機事件半年分析', 184);
  if (a === 'water') { const w = lastMeet('水塔清洗'), q = lastMeet('飲用水大腸桿菌群檢測'), f = lastMeet('飲水機保養'); const ok = w && within(w.date, 184) && q && within(q.date, 92) && f && within(f.date, 31); return [ok ? 'ok' : 'warn', `水塔清洗 ${w ? roc(w.date) : '無'}｜水質檢測 ${q ? roc(q.date) : '無'}｜飲水機保養 ${f ? roc(f.date) : '無'}`]; }
  if (a === 'disinfect') return meetLine('環境消毒', 92);
  if (a === 'manual') return meetLine('工作手冊審閱修訂', 365);
  if (a === 'training') return meetLine('教育訓練', 92);
  if (a === 'data') { const q = prevQuarter(quarterOf(T)); return [DB.quarterly[q] && DB.quarterly[q].done ? 'ok' : 'warn', `系統已提供權限身分、密碼加密、統計分析｜上季分析${DB.quarterly[q] && DB.quarterly[q].done ? '已' : '未'}完成`]; }
  if (a === 'spirit') { const n = DB.contacts.filter(c => c.kind === '靈性關懷' && within(c.date, 365)).length; return [n ? 'ok' : 'warn', `近一年靈性關懷紀錄 ${n} 筆`]; }
  if (a === 'acp') { const n = res.filter(r => r.dnr || r.acp).length; return ['info', `已簽 DNR 或預立醫療 ${n} 人（${pct(n)}%）`]; }
  if (a === 'd10') { const n = res.filter(r => r.noGuardian).length, ok = res.filter(r => r.noGuardian && r.d10Notified).length; return [n === ok ? 'ok' : 'bad', n ? `無扶養義務人 ${n} 人，已通報 ${ok} 人` : '目前無適用個案']; }
  if (a === 'admit') { const n = res.length, beds = +(DB.settings.beds || 0); return [beds && n > beds ? 'bad' : 'ok', `在住 ${n} 人${beds ? `／核定床數 ${beds}` : ''}`]; }
  return null;
}
