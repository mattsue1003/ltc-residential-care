/* ===== A4 列印表單 ===== */
function doPrint(pages) {
  $('#printArea').innerHTML = pages.map(p => `<div class="pg">${p}</div>`).join('');
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 500); }, 50);
}
function pgHead(title, sub = '') { return `<div class="org">${esc(DB.settings.org || '長期照顧服務機構')}</div><h1>${esc(title)}</h1>${sub ? `<div class="meta">${sub}</div>` : ''}`; }
function resLine(r) { return `<table><tr><th style="width:12%">姓名</th><td>${esc(r.name)}</td><th style="width:10%">床號</th><td>${esc(r.bed)}</td><th style="width:10%">性別</th><td>${esc(r.gender || '')}</td><th style="width:10%">年齡</th><td>${age(r.birth)}</td><th style="width:12%">入住日</th><td>${roc(r.admitDate)}</td></tr></table>`; }
function signRow(list) { return `<div class="sign">${list.map(s => `<span>${s}：＿＿＿＿＿＿</span>`).join('')}</div>`; }
const ck = (y, t) => `<span class="ck${y ? ' y' : ''}">${esc(t)}</span>`;

const PR = {
  resPack(rid) {
    logAccess('列印定期評估暨服務計畫表', rid);
    const r = resById(rid), la = latestAssess(rid), p = latestPlan(rid), w = weightsOf(rid).pop();
    doPrint([pgHead('住民定期評估暨服務計畫表', `<span>列印日期：${roc(today())}</span><span>評估週期：至少每 ${Math.round(facType().cycle / 30)} 個月</span>`) + resLine(r) +
      `<table><tr><th style="width:15%">主要診斷</th><td colspan="3">${esc(r.dx || '')}</td></tr><tr><th>過敏史</th><td>${esc(r.allergy || '無')}</td><th style="width:15%">飲食質地</th><td>${esc(r.diet || '')}</td></tr>
      <tr><th>活動能力</th><td>${esc(r.mobility || '')}</td><th>管路</th><td>${[r.tubes && r.tubes.ng && '鼻胃管', r.tubes && r.tubes.foley && '導尿管', r.tubes && r.tubes.trach && '氣切'].filter(Boolean).join('、') || '無'}</td></tr>
      <tr><th>體重</th><td>${w ? `${w.kg} kg（${roc(w.date)}）` : ''}</td><th>DNR／預立醫療</th><td>${ck(r.dnr, 'DNR')} ${ck(r.acp, '預立醫療決定')}</td></tr></table>
      <table><tr><th>面向</th><th>評估工具</th><th>評估日期</th><th>分數</th><th>判讀</th><th>下次評估</th><th>評估者</th></tr>
      ${CORE_SCALES.map(t => { const a = la[t]; return `<tr><td>${SCALES[t].domain}</td><td>${SCALES[t].name}</td><td>${a ? roc(a.date) : ''}</td><td>${a && a.score != null ? a.score : ''}</td><td>${a ? esc(a.level) : '未評估'}</td><td>${a ? roc(addDays(a.date, scaleCycle(t))) : ''}</td><td>${a ? esc((a.by || '').replace(/（.*）/, '')) : ''}</td></tr>`; }).join('')}</table>
      <h3>照顧計畫摘要${p ? `（${roc(p.date)}）` : ''}</h3>${planTable(p)}
      ${signRow(['護理人員', '社工人員', '職能／物理治療師', '營養師'])}${signRow(['業務負責人', '住民／家屬', '日期'])}`]);
  },
  plan(rid) {
    logAccess('列印照顧計畫', rid);
    const r = resById(rid), p = latestPlan(rid);
    doPrint([pgHead('個別化照顧計畫', `<span>擬定日期：${p ? roc(p.date) : ''}</span><span>與家屬共同討論：${p && p.familyDate ? roc(p.familyDate) : '＿＿＿＿'}</span>`) + resLine(r) + planTable(p) +
      `<table><tr><th style="width:18%">參與專業人員</th><td>${esc(p ? p.participants : '')}</td></tr><tr><th>參與家屬／本人</th><td>${esc(p ? p.familyName : '')}</td></tr></table>
      <p class="note">依評鑑基準 B2：至少每半年與服務對象或家屬共同討論修正照顧計畫，並定期追蹤評值。</p>${signRow(['擬定人員', '業務負責人', '住民／家屬簽名', '日期'])}`]);
  },
  scale(type, aid, rid) {
    const sc = SCALES[type], a = aid ? DB.assessments.find(x => x.id === aid) : null, r = resById(a ? a.rid : rid);
    let body = '';
    if (sc.form) body = `<table>${sc.fields.map(f => `<tr><th style="width:28%">${esc(f.label)}</th><td>${f.options ? f.options.map(o => ck(a && a.extra && a.extra[f.key] === o, o)).join('　') : esc(a && a.extra ? a.extra[f.key] || '' : '')}<div class="lines" style="${a ? 'display:none' : ''}"></div></td></tr>`).join('')}</table>`;
    else body = `<table><tr><th style="width:4%">#</th><th style="width:30%">項目</th><th>選項（分數）</th><th style="width:8%">得分</th></tr>${sc.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it[0])}</td><td>${it[1].map(([v, l]) => ck(a && +a.answers[i] === v, `${l}（${v}）`)).join('<br>')}</td><td style="text-align:center">${a ? a.answers[i] ?? '' : ''}</td></tr>`).join('')}
      <tr><th colspan="3" style="text-align:right">${sc.errorBased ? '錯誤題數（已校正）' : '總分'}</th><td style="text-align:center"><b>${a ? a.score : ''}</b></td></tr></table>`;
    const ex = sc.extra ? `<table>${sc.extra.map(f => `<tr><th style="width:28%">${esc(f.label)}</th><td>${esc(a && a.extra ? a.extra[f.key] ?? '' : '')}</td></tr>`).join('')}</table>` : '';
    doPrint([pgHead(sc.name, `<span>評估日期：${a ? roc(a.date) : '＿＿年＿＿月＿＿日'}</span><span>判讀：${a ? esc(a.level) : '＿＿＿＿＿＿'}</span>`) + (r ? resLine(r) : `<table><tr><th>姓名</th><td></td><th>床號</th><td></td><th>評估日期</th><td></td></tr></table>`) + body + ex +
      (a && a.note ? `<p>備註：${esc(a.note)}</p>` : '<p>備註：</p><div class="lines"></div>') + (a ? `<p class="note">${esc(narrative(type, a, r))}</p>` : '') + signRow(['評估者', '複核', '日期'])]);
  },
  restraint(id) {
    const x = DB.restraints.find(y => y.id === id), r = resById(x.rid);
    doPrint([pgHead('約束評估及同意書', `<span>開始日期：${roc(x.startDate)}</span><span>同意書有效期限：${roc(addDays(x.consentDate || x.startDate, 90))}（自簽訂日起 3 個月）</span>`) + resLine(r) +
      `<table><tr><th style="width:22%">判斷依據</th><td>${['醫師診斷', '護理人員專業判斷'].map(o => ck(x.judge === o, o)).join('　')}　評估人員：${esc(x.assessor || '')}</td></tr>
      <tr><th>約束目的</th><td>${['預防跌倒', '預防自拔管路', '行為紊亂', '因治療需要'].map(o => ck((x.reasons || []).includes(o), o)).join('　')}</td></tr>
      <tr><th>約束前替代措施</th><td>${(x.alternatives || []).map(o => ck(true, o)).join('<br>')}</td></tr>
      <tr><th>個別化評估說明</th><td>${esc(x.assessNote || '')}</td></tr><tr><th>約束型態</th><td>${esc(x.form || '')}</td></tr><tr><th>約束用物</th><td>${esc(x.items || '')}</td></tr>
      <tr><th>約束時間</th><td>${esc(x.period || '')}</td></tr><tr><th>約束技術</th><td>${esc(x.technique || '')}</td></tr><tr><th>約束過程的照顧</th><td>${esc(x.care || '')}</td></tr></table>
      <div class="box" style="margin-top:8pt">本人已了解上述約束之目的、型態、用物、時間、技術與照顧方式，以及約束可能帶來的影響，並了解機構會每日評估是否可以解除約束。本同意書自簽訂日起 3 個月內有效，期滿需重新評估並簽署。本人得隨時撤回同意。</div>
      <div class="sign"><span>同意人：${esc(x.consentBy || '＿＿＿＿＿＿')}</span><span>關係：${esc(x.consentRel || '＿＿＿＿')}</span><span>簽署日期：${x.consentDate ? roc(x.consentDate) : '＿＿＿＿'}</span></div>${signRow(['評估人員', '護理負責人', '業務負責人'])}`,
      pgHead('約束執行監測紀錄表') + resLine(r) + `<table><tr><th>日期</th><th>時間</th><th>皮膚</th><th>末梢循環</th><th>鬆綁活動</th><th>可否解除</th><th>備註</th><th>紀錄者</th></tr>${(x.checks || []).map(c => `<tr><td>${roc(c.date)}</td><td>${esc(c.time)}</td><td>${esc(c.skin)}</td><td>${esc(c.circ)}</td><td>${c.release ? '是' : '否'}</td><td>${esc(c.canStop || '')}</td><td>${esc(c.note || '')}</td><td>${esc((c.by || '').replace(/（.*）/, ''))}</td></tr>`).join('')}${'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(Math.max(3, 18 - (x.checks || []).length))}</table>`]);
  },
  async event(id) {
    const e = DB.events.find(x => x.id === id), r = resById(e.rid), def = EVENT_TYPES[e.type] || { fields: [] };
    logAccess(`列印${e.type}事件報告`, e.rid); const ph = await photosPrintHTML('event:' + id, '照片紀錄');
    doPrint([pgHead(`${e.type}事件報告暨個案分析檢討單`, `<span>發生時間：${roc(e.date)} ${esc(e.time || '')}</span><span>對應指標：${esc(def.ref || '')}</span>`) + resLine(r) +
      `<table>${def.fields.map(k => `<tr><th style="width:22%">${esc(EVENT_FIELD_DEF[k].label)}</th><td>${esc(e[k] || '')}</td></tr>`).join('')}
      <tr><th style="width:22%">事件經過</th><td style="height:70pt">${esc(e.desc || '')}</td></tr><tr><th>立即處置</th><td style="height:50pt">${esc(e.immediate || '')}</td></tr>
      <tr><th>通知</th><td>${['家屬', '醫師', '業務負責人', '主管機關'].map(o => ck((e.notify || []).includes(o), o)).join('　')}</td></tr>
      ${e.type === '跌倒' ? `<tr><th>危險因子</th><td>${FALL_FACTORS.map(o => ck((e.factors || []).includes(o), o)).join('<br>')}</td></tr>` : ''}
      <tr><th>原因分析</th><td style="height:60pt">${esc(e.cause || '')}</td></tr><tr><th>處置與追蹤</th><td style="height:50pt">${esc(e.action || '')}</td></tr><tr><th>改善方案</th><td style="height:50pt">${esc(e.improve || '')}</td></tr>
      <tr><th>狀態</th><td>${esc(e.status || '')}</td></tr></table>${signRow(['通報人', '護理負責人', '業務負責人', '日期'])}`].concat(ph ? [pgHead(`${e.type}事件照片`) + resLine(r) + ph] : []));
  },
  async meeting(id) {
    const m = DB.meetings.find(x => x.id === id); const ph = await photosPrintHTML('meeting:' + id, '活動照片');
    doPrint([pgHead(`${m.kind}紀錄`, `<span>日期：${roc(m.date)}</span><span>記錄：${esc((m.by || '').replace(/（.*）/, ''))}</span>`) +
      `<table><tr><th style="width:18%">主題</th><td>${esc(m.title || '')}</td></tr><tr><th>${/活動|座談/.test(m.kind) ? '參加成員' : '出席人員'}</th><td>${esc(m.participants || '')}${m.count ? `（${m.count} 人）` : ''}</td></tr>
      ${m.rids && m.rids.length ? `<tr><th>討論個案</th><td>${esc(m.rids.join('、'))}</td></tr>` : ''}
      <tr><th>${/活動/.test(m.kind) ? '活動內容與過程' : '討論內容'}</th><td style="height:160pt;white-space:pre-wrap">${esc(m.content || '')}</td></tr>
      <tr><th>${/活動/.test(m.kind) ? '評值成果' : '決議事項'}</th><td style="height:100pt;white-space:pre-wrap">${esc(m.decisions || '')}</td></tr>
      <tr><th>追蹤管考</th><td style="height:70pt;white-space:pre-wrap">${esc(m.followup || '')}</td></tr></table>${signRow(['記錄', '主席／業務負責人'])}`].concat(ph ? [pgHead(`${m.kind}照片`) + `<div class="meta"><span>${roc(m.date)} ${esc(m.title || '')}</span></div>` + ph] : /活動/.test(m.kind) ? [pgHead('活動照片黏貼處') + '<div class="box" style="height:600pt"></div>'] : []));
  },
  handover(d) {
    d = d || today(); const res = activeResidents(d).filter(inHouse);
    const ab = DB.daily.filter(x => x.date === d && vitalFlags(x).length);
    const ev = DB.events.filter(e => diffDays(e.date, d) <= 1 && e.date <= d);
    const rs = DB.restraints.filter(x => !x.endDate);
    doPrint([pgHead('交班單', `<span>日期：${roc(d)}</span><span>在住 ${res.length} 人・住院 ${res.filter(r => r.status === '住院中').length} 人・約束 ${rs.length} 人</span>`) +
      `<table><tr><th style="width:18%">住民</th><th>交班重點</th><th style="width:16%">白班</th><th style="width:16%">小夜</th><th style="width:16%">大夜</th></tr>
      ${ab.map(x => `<tr><td>${esc(resLabel(resById(x.rid)))}</td><td>生命徵象異常：${vitalFlags(x).join('、')}${x.note ? '；' + esc(x.note) : ''}</td><td></td><td></td><td></td></tr>`).join('')}
      ${DB.notes.filter(n => n.handover && diffDays(n.date, d) <= 1 && n.date <= d).map(n => `<tr><td>${esc(resLabel(resById(n.rid)))}</td><td>${esc(noteText(n).replace(/\n/g, '；'))}（${esc(n.disc || '')}）</td><td></td><td></td><td></td></tr>`).join('')}
      ${ev.map(e => `<tr><td>${esc(resLabel(resById(e.rid)))}</td><td>${esc(e.type)}：${esc((e.desc || '').slice(0, 60))}</td><td></td><td></td><td></td></tr>`).join('')}
      ${rs.map(x => `<tr><td>${esc(resLabel(resById(x.rid)))}</td><td>約束中（${esc((x.reasons || []).join('、'))}；${esc(x.form || '')}），同意書至 ${roc(addDays(x.consentDate || x.startDate, 90))}</td><td></td><td></td><td></td></tr>`).join('')}
      ${res.filter(r => r.status === '住院中').map(r => `<tr><td>${esc(resLabel(r))}</td><td>住院中</td><td></td><td></td><td></td></tr>`).join('')}
      ${res.filter(r => diffDays(r.admitDate, d) <= 7).map(r => `<tr><td>${esc(resLabel(r))}</td><td>新入住第 ${diffDays(r.admitDate, d) + 1} 天，注意適應狀況</td><td></td><td></td><td></td></tr>`).join('')}
      ${'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>'.repeat(8)}</table>${signRow(['白班', '小夜', '大夜', '護理負責人'])}`]);
  },
  dailySheet(d) {
    d = d || today(); const res = activeResidents(d);
    doPrint([pgHead('每日照護紀錄', `<span>日期：${roc(d)}</span>`) + `<table><tr><th>床號</th><th>姓名</th><th>體溫</th><th>血壓</th><th>脈搏</th><th>呼吸</th><th>血氧</th><th>疼痛</th><th>血糖</th><th>下床</th><th>洗澡</th><th>口腔</th><th>排便</th><th>備註</th></tr>
      ${res.map(r => { const x = DB.daily.find(y => y.rid === r.id && y.date === d) || {}; return `<tr><td>${esc(r.bed)}</td><td>${esc(r.name)}</td><td>${x.temp ?? ''}</td><td>${x.sbp ? x.sbp + '/' + (x.dbp || '') : ''}</td><td>${x.pulse ?? ''}</td><td>${x.resp ?? ''}</td><td>${x.spo2 ?? ''}</td><td>${x.pain ?? ''}</td><td>${x.sugar ?? ''}</td><td>${x.oob ?? ''}</td><td>${x.bath ? '✓' : ''}</td><td>${x.oral ? '✓' : ''}</td><td>${x.bowel ? '✓' : ''}</td><td>${esc(x.note || '')}</td></tr>`; }).join('')}</table>`]);
  },
  vitalsMonth(rid, m) {
    const r = resById(rid), [f, t] = monthRange(m); const days = diffDays(f, t) + 1;
    doPrint([pgHead('每月生命徵象紀錄表', `<span>${m.slice(0, 4) - 1911} 年 ${+m.slice(5)} 月</span>`) + resLine(r) + `<table><tr><th>日</th><th>體溫</th><th>血壓</th><th>脈搏</th><th>呼吸</th><th>血氧</th><th>疼痛</th><th>血糖</th><th>下床</th><th>洗澡</th><th>口腔</th><th>排便</th><th>簽名</th></tr>
      ${[...Array(days)].map((_, i) => { const d = addDays(f, i); const x = DB.daily.find(y => y.rid === rid && y.date === d) || {}; return `<tr><td>${i + 1}</td><td>${x.temp ?? ''}</td><td>${x.sbp ? x.sbp + '/' + (x.dbp || '') : ''}</td><td>${x.pulse ?? ''}</td><td>${x.resp ?? ''}</td><td>${x.spo2 ?? ''}</td><td>${x.pain ?? ''}</td><td>${x.sugar ?? ''}</td><td>${x.oob ?? ''}</td><td>${x.bath ? '✓' : ''}</td><td>${x.oral ? '✓' : ''}</td><td>${x.bowel ? '✓' : ''}</td><td></td></tr>`; }).join('')}</table><p class="note">疼痛評估含開始時間、位置、嚴重度、持續時間、緩解及加重因素（B14），疼痛 ≥ 4 分請另記錄處置與評值。</p>`]);
  },
  turning(rid, d) {
    const r = resById(rid); const slots = [...Array(12)].map((_, i) => String(i * 2).padStart(2, '0') + ':00');
    doPrint([pgHead('翻身擺位及定時如廁紀錄表', `<span>日期：${roc(d)}</span><span>B25 臥床者至少每 2 小時翻身；B26 有失禁之虞者至少每 2 小時如廁</span>`) + resLine(r) +
      `<table><tr><th style="width:11%">時間</th><th>翻身擺位<br><span class="note">平躺／左側／右側／半坐臥</span></th><th>皮膚狀況</th><th>如廁<br><span class="note">自解／協助如廁／更換尿布</span></th><th>失禁</th><th>給水 ml</th><th style="width:12%">簽名</th></tr>
      ${slots.map(s => { const x = DB.daily.find(y => y.rid === rid && y.date === d) || {}; const tv = (x.turns || {})[s.slice(0, 2)], tl = (x.toilets || {})[s.slice(0, 2)]; return `<tr style="height:30pt"><td>${s}</td><td>${tv ? '☑ ' + esc(tv) : '☐平 ☐左 ☐右 ☐半坐'}</td><td>☐正常 ☐發紅</td><td>${tl ? '☑ ' + esc(tl) : '☐自解 ☐協助 ☐尿布'}</td><td>${tl === '失禁' ? '☑ 有' : tl ? '☑ 無' : '☐無 ☐有'}</td><td></td><td></td></tr>`; }).join('')}</table>`]);
  },
  family(rid) {
    logAccess('列印家屬聯繫紀錄', rid);
    const r = resById(rid); const list = DB.contacts.filter(c => c.rid === rid && /家屬/.test(c.kind)).sort((a, b) => a.date.localeCompare(b.date));
    doPrint([pgHead('家屬聯繫紀錄單', `<span>主要聯絡人：${esc(r.contactName || '')} ${esc(r.contactRel || '')} ${esc(r.contactPhone || '')}</span>`) + resLine(r) +
      `<table><tr><th style="width:13%">日期</th><th style="width:14%">方式</th><th>聯繫內容</th><th style="width:20%">後續追蹤</th><th style="width:10%">紀錄者</th></tr>${list.map(c => `<tr><td>${roc(c.date)}</td><td>${esc(c.kind)}</td><td>${esc(c.content || '')}</td><td>${esc(c.followup || '')}</td><td>${esc((c.by || '').replace(/（.*）/, ''))}</td></tr>`).join('')}${'<tr style="height:26pt"><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(Math.max(3, 14 - list.length))}</table><p class="note">B7：每季至少 1 次與每位服務對象之家屬電訪或會談，了解其需要並提供支持服務。</p>`]);
  },
  matrix() {
    const res = activeResidents().filter(inHouse);
    doPrint([pgHead('評估進度總表', `<span>列印日期：${roc(today())}</span><span>★ 表示逾期</span>`) + `<table><tr><th>住民</th>${CORE_SCALES.map(t => `<th>${SCALES[t].short}</th>`).join('')}<th>照顧計畫</th><th>家屬討論</th><th>醫師</th><th>藥師</th><th>家屬電訪</th></tr>
      ${res.map(r => { const la = latestAssess(r.id), p = latestPlan(r.id); const c = (d, n) => d ? `${roc(d)}${diffDays(addDays(d, n), today()) > 0 ? ' ★' : ''}` : '★'; const cy = facType().cycle, dc = facType().doctor;
        return `<tr><td>${esc(resLabel(r))}</td>${CORE_SCALES.map(t => `<td>${c(la[t] && la[t].date, scaleCycle(t))}</td>`).join('')}<td>${c(p && p.date, cy + 2)}</td><td>${c(p && p.familyDate, 183)}</td><td>${c((latestContact(r.id, '醫師巡診') || {}).date, dc)}</td><td>${c((latestContact(r.id, '藥師評估') || {}).date, 90)}</td><td>${r.noFamily ? '－' : c((latestContact(r.id, '家屬電訪／會談') || {}).date, 90)}</td></tr>`; }).join('')}</table>`]);
  },
  quarter(q) {
    const [f, t] = quarterRange(q), s = qualityStats(f, t), Q = DB.quarterly[q] || { analysis: {} };
    doPrint([pgHead(`${q.slice(0, 4) - 1911} 年第 ${q.slice(-1)} 季 品質指標分析報告`, `<span>期間：${roc(f)}～${roc(t)}</span><span>住民人日數 ${s.rd}・平均在住 ${s.census} 人</span>`) +
      `<table><tr><th>指標</th><th>對應</th><th>件數</th><th>發生率</th></tr>${s.rows.map(r => `<tr><td>${esc(r.key)}</td><td>${r.ref}</td><td style="text-align:center">${r.n}</td><td>${r.rate === null ? '－' : r.rate.toFixed(2) + ' ' + r.unit}</td></tr>`).join('')}</table>
      <h3>個案清單</h3><table><tr><th>日期</th><th>住民</th><th>類別</th><th>原因分析</th><th>處置</th></tr>${DB.events.filter(e => e.date >= f && e.date <= t).sort((a, b) => a.date.localeCompare(b.date)).map(e => `<tr><td>${roc(e.date)}</td><td>${esc(resLabel(resById(e.rid)))}</td><td>${esc(e.type)}</td><td>${esc(e.cause || '')}</td><td>${esc(e.action || '')}</td></tr>`).join('') || '<tr><td colspan="5">本季無事件</td></tr>'}</table>
      <h3>分析與改善方案</h3><table><tr><th style="width:18%">指標</th><th>分析</th><th>改善方案</th></tr>${Object.entries(Q.analysis || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v.a || '')}</td><td>${esc(v.b || '')}</td></tr>`).join('')}</table>${signRow(['製表', '品管負責人', '業務負責人'])}`]);
  },
  accred() {
    doPrint(accredSet().map(c => pgHead(`評鑑自評表　${c.cat}. ${c.name}`, `<span>${esc(accredName())}</span><span>★ ${accVer() === 'elder' ? '一級必要項目' : '核心指標'}</span>`) +
      `<table><tr><th style="width:7%">項次</th><th style="width:24%">指標</th><th>系統佐證／準備狀況</th><th style="width:7%">自評</th></tr>${c.items.map(i => { const ev = accredEvidence(i[0]); const s = DB.accred[i[0]] || {};
        return `<tr><td>${i[0]}${i[2] ? ' ★' : ''}</td><td>${esc(i[1])}</td><td>${ev ? esc(ev[1]) + '<br>' : ''}${esc(s.note || '')}</td><td style="text-align:center;font-weight:700">${esc(s.r || '')}</td></tr>`; }).join('')}</table>`));
  },
};
function planTable(p) {
  return `<table><tr><th style="width:4%">#</th><th style="width:12%">職類</th><th style="width:20%">照顧問題</th><th style="width:18%">目標</th><th>措施</th><th style="width:10%">評值日</th><th style="width:9%">結果</th></tr>
  ${p && p.problems.length ? p.problems.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.disc)}</td><td>${esc(x.problem)}</td><td>${esc(x.goal)}</td><td>${esc(x.interventions)}</td><td>${roc(x.evalDate)}</td><td>${esc(x.result || '')}</td></tr>`).join('') : '<tr><td colspan="7" style="height:80pt"></td></tr>'}</table>`;
}
PR.notes = (rid, m) => {
  m = m || today().slice(0, 7); const r = resById(rid); logAccess('列印照護紀錄', rid);
  const list = DB.notes.filter(n => n.rid === rid && n.date.startsWith(m)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  doPrint([pgHead('照護紀錄', `<span>${m.slice(0, 4) - 1911} 年 ${+m.slice(5)} 月</span>`) + resLine(r) + `<table><tr><th style="width:14%">日期時間</th><th style="width:10%">職類</th><th>紀錄內容</th><th style="width:11%">簽名</th></tr>${list.map(n => `<tr><td>${roc(n.date)}<br>${esc(n.time || '')}</td><td>${esc(n.disc || '')}</td><td style="white-space:pre-wrap">${esc(noteText(n))}</td><td>${esc((n.by || '').replace(/（.*）/, ''))}</td></tr>`).join('') || '<tr><td colspan="4">本月無紀錄</td></tr>'}</table>`]);
};
ACT.printNotes = el => PR.notes(el.dataset.id);
ACT.printResPack = el => PR.resPack(el.dataset.id);
ACT.printPlan = el => PR.plan(el.dataset.id);
ACT.printAssess = el => { const a = DB.assessments.find(x => x.id === el.dataset.id); PR.scale(a.type, a.id); };
ACT.printRestraint = el => PR.restraint(el.dataset.id);
ACT.printEvent = el => PR.event(el.dataset.id);
ACT.printMeeting = el => PR.meeting(el.dataset.id);
ACT.printHandover = () => PR.handover(today());
ACT.printDailySheet = () => PR.dailySheet(dailyDate || today());
ACT.printMatrix = () => PR.matrix();
ACT.printQuarter = el => PR.quarter(el.dataset.q);
ACT.printAccred = () => PR.accred();
