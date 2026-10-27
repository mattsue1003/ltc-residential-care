/* 示範資料：12 位虛構住民（姓名、病史皆為虛構） */
function loadDemo() {
  let seed = 20261026; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)]; const T = today();
  COLLECTIONS.forEach(c => DB[c] = ['settings', 'quarterly', 'accred'].includes(c) ? {} : []);
  DB.settings = { org: '幸福示範老人長期照顧中心（養護型）', facType: '養護型（老人福利機構）', lastEval: '109 年 優等（示範）', retentionYears: 7, beds: 49, manager: '範例主任', user: { name: '示範護理師', role: '護理人員' }, staff: { total: 24, flu: 20, covid: 11 }, lastBackup: nowISO() };
  const P = [
    ['王大明','男','1938-03-12','101-1',900,'失智症、高血壓',{ ng: false },'輪椅','嗜睡／混亂',[45,8,6,9,50,14,1]],
    ['林美玉','女','1942-07-08','101-2',620,'腦中風右側偏癱、糖尿病',{ ng: true },'臥床可移動','清醒',[15,4,4,6,40,11,3]],
    ['陳阿土','男','1935-11-20','101-3',410,'巴金森氏症',{},'輔具行走','清醒',[60,3,7,11,55,17,2]],
    ['張秀英','女','1940-01-30','102-1',300,'退化性關節炎、骨質疏鬆',{},'輔具行走','清醒',[75,2,3,12,45,19,4]],
    ['李文雄','男','1944-05-17','102-2',200,'慢性阻塞性肺病、心衰竭',{},'輪椅','清醒',[55,1,8,10,35,16,2]],
    ['黃春花','女','1936-09-09','102-3',150,'失智症（中度）',{},'可獨立行走','嗜睡／混亂',[80,7,4,10,70,20,0]],
    ['吳金水','男','1939-12-01','103-1',95,'腦中風、吞嚥困難',{ ng: true, foley: true },'臥床不宜移動','意識不清',[0,10,0,3,25,9,5]],
    ['周玉蘭','女','1943-04-22','103-2',60,'髖關節骨折術後',{},'輪椅','清醒',[50,1,5,9,60,15,6]],
    ['鄭天助','男','1941-08-14','103-3',40,'帕金森、憂鬱症',{},'輔具行走','清醒',[65,2,11,8,70,16,3]],
    ['蔡阿桃','女','1937-02-05','105-1',22,'失智症、尿失禁',{ foley: false },'輪椅','嗜睡／混亂',[35,9,5,7,45,13,2]],
    ['許清風','男','1945-06-28','105-2',8,'糖尿病足、腎功能不全',{},'輪椅','清醒',[60,0,4,10,40,15,4]],
    ['劉月娥','女','1934-10-10','105-3',1,'衰弱、營養不良',{},'臥床可移動','清醒',[30,3,6,6,35,12,2]],
  ];
  const famNames = ['長子','長女','次子','女兒','姪子','配偶'];
  P.forEach((p, idx) => {
    const [name, gender, birth, bed, daysIn, dx, tubes, mobility, consciousness, base] = p;
    const r = save('residents', { name, gender, birth, bed, admitDate: addDays(T, -daysIn), dx, tubes: Object.assign({ ng: false, foley: false, trach: false }, tubes), mobility, consciousness,
      diet: tubes.ng ? '管糊' : pick(['一般', '軟質', '細碎']), funding: idx === 6 ? '公費安置' : pick(['自費', '自費', '中低收入戶']), religion: pick(['佛教', '道教', '基督教', '民間信仰', '無']),
      allergy: idx === 2 ? 'Penicillin' : '', contactName: idx === 6 ? '' : name[0] + '先生', contactRel: pick(famNames), contactPhone: '0900-000-' + String(100 + idx),
      doctor: '特約醫師（示範）', incontinence: base[0] <= 50, dnr: idx % 3 === 0, acp: idx === 4, noFamily: idx === 6, noGuardian: idx === 6, d10Notified: false, status: '在住', by: '示範護理師（護理人員）' });
    if (r.diet === '管糊') r.diet = '管灌';
    // 評估：入住時一次，之後每 ~90 天，部分故意逾期
    const dates = [r.admitDate]; let d = addDays(r.admitDate, 2);
    for (let t = d; diffDays(t, T) > 0; t = addDays(t, 85 + Math.floor(rnd() * 20))) if (t !== r.admitDate) dates.push(t);
    let use = dates.map((x, i) => i === 0 ? addDays(r.admitDate, Math.min(2, daysIn)) : x).filter(x => x <= T);
    if (idx === 11) use = []; // 剛入住，尚未評估
    if (idx === 3 || idx === 0) use = use.filter(x => diffDays(x, T) > 100); // 故意逾期
    use.forEach((date, k) => {
      const drift = k - use.length + 1;
      const mk = (type, target) => {
        const sc = SCALES[type]; const ans = {};
        if (sc.form) return;
        // 以目標分數為準，貪婪選擇選項
        let remain = target;
        sc.items.forEach((it, i) => { const opts = it[1].map(o => o[0]).sort((a, b) => b - a); const left = sc.items.length - i - 1; let v = opts[opts.length - 1];
          for (const o of opts) { if (o <= remain - left * Math.min(...opts) + 0.01) { v = o; break; } } ans[i] = v; remain -= v; });
        const extra = type === 'mna' ? { height: gender === '男' ? 165 : 152, weight: 0 } : type === 'pain' ? { nrs: '', site: target >= 4 ? pick(['右膝', '下背', '左髖']) : '' } : type === 'spmsq' ? { edu: '國小（不校正）' } : {};
        const { score, level } = scoreScale(type, ans, extra);
        DB.assessments.push({ id: uid(), rid: r.id, type, date, answers: ans, extra, score, level: level[0], cls: level[1], note: '', by: pick(['示範護理師（護理人員）', '示範社工（社工人員）', '示範職能治療師（職能治療師）']), created: nowISO() });
      };
      mk('barthel', Math.max(0, Math.min(100, Math.round((base[0] - drift * 2) / 5) * 5)));
      mk('spmsq', Math.min(10, base[1])); mk('gds', base[2]); mk('mna', base[3]); mk('morse', Math.min(125, Math.round(base[4] / 5) * 5)); mk('braden', base[5]); mk('pain', base[6]);
      DB.assessments.push({ id: uid(), rid: r.id, type: 'social', date, answers: {}, extra: { adapt: daysIn < 30 ? '尚在適應' : '適應良好', mood: base[2] >= 8 ? '偶有低落或焦慮' : '穩定', family: idx === 6 ? '無家屬／失聯' : pick(['家屬定期探視', '家屬偶爾探視']), econ: idx === 6 ? '公費安置' : '自費無虞', faith: r.religion, hobby: pick(['聽老歌', '看布袋戲', '種花', '下象棋', '摺紙']), wish: '希望身體健康、家人常來看', acp: r.dnr ? '已簽署 DNR' : '未討論' }, score: null, level: '', cls: '', by: '示範社工（社工人員）', created: nowISO() });
      const s = DB.assessments[DB.assessments.length - 1]; const lv = SCALES.social.level(s.extra); s.level = lv[0]; s.cls = lv[1];
    });
    Store.mark('assessments');
    // 照顧計畫
    if (idx !== 11 && idx !== 10) {
      const la = latestAssess(r.id); const sug = suggestProblems(r, la);
      const pd = use.length ? use[use.length - 1] : r.admitDate;
      save('plans', { rid: r.id, date: addDays(pd, 1) > T ? T : addDays(pd, 1), problems: sug.map(s => Object.assign({}, s, { evalDate: addDays(pd, 90), result: '持續' })), participants: '護理師、社工、職能治療師、營養師', familyDate: idx === 1 ? '' : addDays(pd, Math.min(5, diffDays(pd, T))), familyName: r.contactRel + ' ' + r.contactName });
    }
    // 體重（每月）
    let kg = (gender === '男' ? 60 : 50) + rnd() * 10;
    for (let m = Math.min(5, Math.floor(daysIn / 30)); m >= 0; m--) {
      const date = addDays(T, -m * 30 - 3); if (date < r.admitDate) continue;
      if (idx === 7 && m === 0) kg = kg * 0.935; else kg += (rnd() - 0.5) * 1.2;
      if (idx === 5 && m === 0) continue; // 本月未量
      DB.weights.push({ id: uid(), rid: r.id, date, kg: Math.round(kg * 10) / 10, created: nowISO() });
    }
    Store.mark('weights');
    // 每日紀錄（近 35 天）
    for (let i = 35; i >= 0; i--) {
      const date = addDays(T, -i); if (date < r.admitDate) continue;
      if (i === 0 && idx % 4 === 3) continue; // 今天部分未量
      const x = { id: uid(), rid: r.id, date, temp: +(36.2 + rnd() * 0.8).toFixed(1), sbp: Math.round(115 + rnd() * 30), dbp: Math.round(65 + rnd() * 15), pulse: Math.round(66 + rnd() * 20), resp: Math.round(16 + rnd() * 4), spo2: Math.round(95 + rnd() * 4),
        pain: base[6] >= 4 ? Math.round(base[6] - 1 + rnd() * 2) : Math.round(rnd() * 2), oob: mobility === '臥床不宜移動' ? 0 : (rnd() < 0.12 ? 1 : 2 + Math.round(rnd())), bath: (i + idx) % 3 === 0, oral: true, bowel: rnd() < 0.6, note: '', created: nowISO() };
      if (/糖尿病/.test(dx)) x.sugar = Math.round(110 + rnd() * 90);
      if (i === 0 && idx === 4) { x.temp = 38.2; x.spo2 = 91; x.note = '咳嗽有痰，已通知醫師'; }
      if (i === 0 && idx === 10) { x.sugar = 320; }
      if (idx === 7 && i < 10) x.bath = i % 5 === 0;
      DB.daily.push(x);
    }
    Store.mark('daily');
    // 訪視聯繫
    const addC = (kind, every, content, skip) => { for (let t = addDays(r.admitDate, Math.min(7, daysIn)); t <= T; t = addDays(t, every)) { if (skip && skip(t)) continue; DB.contacts.push({ id: uid(), rid: r.id, kind, date: t, content, with: '', by: pick(['示範護理師（護理人員）', '示範社工（社工人員）']), created: nowISO() }); } };
    if (daysIn >= 7) addC('醫師巡診', 28, '生命徵象穩定，續原醫囑。', t => idx === 2 && diffDays(t, T) < 40);
    if (daysIn >= 7) addC('藥師評估', 88, '用藥無重複或交互作用。');
    if (!r.noFamily && daysIn >= 7) addC('家屬電訪／會談', 85, '說明近況與照顧計畫，家屬了解並同意。', t => idx === 3 && diffDays(t, T) < 120);
    if (daysIn > 30) DB.contacts.push({ id: uid(), rid: r.id, kind: '年度健康檢查', date: addDays(T, -((daysIn - 10) % 330)), content: '胸部 X 光、血液常規、生化、尿液檢查，醫師判讀無異常。', by: '示範護理師（護理人員）', created: nowISO() });
    if (r.tubes.ng) DB.contacts.push({ id: uid(), rid: r.id, kind: '吞嚥／管路移除訓練', date: addDays(T, -6), content: '語言治療師評估：可嘗試布丁質地少量由口進食。', by: '示範護理師（護理人員）', created: nowISO() });
    Store.mark('contacts');
    // 疫苗
    if (idx % 5 !== 4) DB.vaccines.push({ id: uid(), rid: r.id, kind: '流感', date: addDays(T, -10 - idx), refused: false, created: nowISO() });
    else DB.vaccines.push({ id: uid(), rid: r.id, kind: '流感', date: addDays(T, -12), refused: true, reason: '本人或家屬拒絕', created: nowISO() });
    if (idx % 2 === 0) { DB.vaccines.push({ id: uid(), rid: r.id, kind: '肺鏈 PCV', date: addDays(T, -400), created: nowISO() }); DB.vaccines.push({ id: uid(), rid: r.id, kind: '肺鏈 PPV23', date: addDays(T, -300), created: nowISO() }); }
    if (idx % 3 !== 2) DB.vaccines.push({ id: uid(), rid: r.id, kind: 'COVID-19', date: addDays(T, -60), created: nowISO() });
    Store.mark('vaccines');
  });
  save('residents', { name: '示範結案住民', gender: '女', birth: '1930-05-05', bed: '106-1', admitDate: addDays(T, -3200), dischargeDate: addDays(T, -2700), status: '往生', dx: '示範', tubes: {}, by: '示範' });
  const R = DB.residents.filter(r => !r.dischargeDate);
  // 事件
  const ev = (i, type, back, o) => save('events', Object.assign({ rid: R[i].id, type, date: addDays(T, -back), time: '14:20', status: '結案', notify: ['家屬', '醫師'] }, o));
  ev(0, '跌倒', 40, { place: '寢室床邊', injury: '輕度（擦傷、瘀青）', desc: '夜間自行下床如廁，滑坐於床邊。', immediate: '檢查無骨折，傷口消毒。', factors: ['個人：認知障礙或躁動', '個人：如廁急迫', '人力：交班或夜間人力'], cause: '夜間如廁需求未被預期，床欄未降低。', action: '加強夜間 2 小時巡視並提醒如廁。', improve: '增設離床警示墊，夜間定時如廁。' });
  ev(2, '跌倒', 110, { place: '浴廁', injury: '無傷害', desc: '如廁起身時重心不穩跌坐。', immediate: '評估無外傷。', factors: ['個人：肌力／平衡差', '環境：地面濕滑'], cause: '浴廁地面潮濕。', action: '浴廁加防滑墊。', improve: '物理治療加強平衡訓練。' });
  ev(8, '跌倒', 5, { place: '走廊', injury: '輕度（擦傷、瘀青）', desc: '步行時跌倒，左膝擦傷。', immediate: '傷口處理，通知家屬。', status: '追蹤中' });
  ev(1, '壓力性損傷', 70, { site: '薦骨', stage: '第 2 級', origin: '機構內新發生', desc: '薦骨 2×3 cm 表皮破損。', immediate: '換藥、減壓。', cause: '翻身間隔不確實、營養攝取不足。', action: '使用氣墊床，營養師調整配方。', improve: '翻身紀錄改為每班稽核。' });
  ev(6, '感染', 50, { infType: '泌尿道感染', reported: '不需通報', desc: '發燒 38.5℃，尿液混濁。', immediate: '通知醫師，留尿液培養。', cause: '長期留置導尿管。', action: '依醫囑抗生素治療，3 天後退燒。', improve: '評估膀胱訓練與移除導尿管。' });
  ev(4, '非計畫性住院', 120, { hospital: '示範醫院', dx: '肺炎', desc: '呼吸喘、血氧 88%，送急診收住院。', immediate: '給氧，聯絡救護車與家屬。', cause: '慢性肺病急性惡化。', action: '住院 7 天後返回機構。', improve: '加強呼吸道衛教與流感疫苗接種。' });
  ev(4, '緊急送醫', 120, { hospital: '示範醫院', familyTime: '14:35', desc: '同上，緊急送醫。', immediate: '急救處置後送醫。', cause: '急性惡化。', action: '家屬到院陪同。' });
  ev(5, '申訴／意見反應', 30, { desc: '家屬反映衣物遺失。', immediate: '協助尋找。', cause: '洗衣房標示不清。', action: '找回並致歉，衣物重新標示。', improve: '衣物入住時統一標示姓名。' });
  // 約束
  save('restraints', { rid: R[6].id, startDate: addDays(T, -82), judge: '醫師診斷', assessor: '示範護理師', reasons: ['預防自拔管路'], alternatives: ['管路固定／遮蔽／改變管路位置', '增加巡視與陪伴', '處理疼痛、口渴、如廁等需求'], assessNote: '意識不清，曾自拔鼻胃管 2 次，替代措施無效。', form: '手部約束（手套）', items: '約束手套', period: '管灌時及夜間', technique: '手套不綁縛', care: '每 2 小時鬆脫活動、觀察末梢循環', consentBy: '縣市政府社工（委託）', consentRel: '委託之縣市政府', consentDate: addDays(T, -82),
    checks: [...Array(5)].map((_, i) => ({ date: addDays(T, -i - 1), time: '10:00', skin: '完整', circ: '正常', release: true, canStop: '否，仍需約束', by: '示範護理師（護理人員）' })) });
  save('restraints', { rid: R[0].id, startDate: addDays(T, -150), endDate: addDays(T, -120), endReason: '改用離床警示與夜間巡視', judge: '護理人員專業判斷', assessor: '示範護理師', reasons: ['預防跌倒'], alternatives: ['增加巡視與陪伴', '調整床高與床邊防護墊'], assessNote: '夜間躁動欲下床。', form: '腰部約束帶', consentBy: '王先生', consentRel: '長子', consentDate: addDays(T, -150), checks: [] });
  // 會議與活動
  const mt = (kind, back, title, extra) => save('meetings', Object.assign({ kind, date: addDays(T, -back), title, participants: '主任、護理長、社工、職能治療師、營養師', content: '（示範內容）', decisions: '（示範決議）', followup: '' }, extra));
  [10, 100, 190].forEach(b => mt('服務品質會議', b, '季品質指標檢討'));
  [100, 190].forEach(b => mt('跨專業個案討論', b, '高跌倒風險個案討論'));
  [5, 33, 65, 96].forEach((b, i) => mt('團體活動', b, ['懷舊歌曲團體', '園藝治療', '中秋節慶活動', '手作摺紙'][i], { participants: '住民 15 人、志工 3 人', count: 15 }));
  mt('家屬座談／教育', 140, '防災與公共安全宣導');
  mt('手部衛生稽核', 60, '第三季手部衛生稽核', { decisions: '遵從率 92%、正確率 88%' });
  mt('緊急災害應變演練', 20, '夜間火災應變演練'); mt('緊急災害應變演練', 110, '複合型災害（地震＋停電）應變演練'); mt('緊急災害應變演練', 200, '桌上模擬演練');
  mt('用電設備自主檢查', 12, '每月用電設備與延長線自主檢查'); mt('用電設備委託檢驗', 120, '委託用電設備檢驗維護業者檢驗');
  mt('水塔清洗', 150, '水塔清洗消毒'); mt('飲用水大腸桿菌群檢測', 70, '飲水機出水大腸桿菌群檢測：合格'); mt('飲水機保養', 20, '飲水機保養與濾芯更換');
  mt('危機事件半年分析', 170, '上半年意外事件與危機事件分析');
  mt('環境消毒', 45, '機構內外環境消毒'); mt('病媒防治（委外）', 100, '委外病媒防治');
  mt('教育訓練', 25, '約束替代措施與安寧緩和教育訓練'); mt('侵入性技術稽核', 150, '抽痰與換管技術稽核');
  mt('膳食滿意度調查', 160, '上半年膳食滿意度'); mt('服務滿意度調查', 300, '年度服務滿意度'); mt('感染管制計畫檢視更新', 200, '感管計畫年度更新'); mt('工作手冊審閱修訂', 250, '工作手冊年度修訂');
  // 每 2 小時翻身／如廁、照護紀錄
  const SL = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22'], TS = ['平躺', '左側', '右側', '半坐'];
  DB.daily.forEach(x => { const r = DB.residents.find(y => y.id === x.rid); if (!r || diffDays(x.date, T) > 3) return;
    if (/臥床/.test(r.mobility || '')) { x.turns = {}; SL.forEach((s, i) => { if (x.date === T && +s > new Date().getHours()) return; if (rnd() < 0.92) x.turns[s] = TS[i % 4]; }); }
    if (r.incontinence) { x.toilets = {}; SL.forEach(s => { if (x.date === T && +s > new Date().getHours()) return; if (rnd() < 0.8) x.toilets[s] = pick(['自解', '協助如廁', '換尿布']); }); } });
  const nt = (i, back, disc, kind, o, ho) => DB.notes.push(Object.assign({ id: uid(), rid: R[i].id, date: addDays(T, -back), time: pick(['08:30', '10:15', '14:40', '20:10']), disc, kind, handover: !!ho, by: `示範${disc.replace('人員', '')}（${disc}）`, created: nowISO() }, o));
  nt(4, 0, '護理人員', 'DAR', { D: '體溫 38.2℃、血氧 91%，咳嗽有黃痰。', A: '通知醫師，依醫囑給予退燒藥、抽痰，床頭抬高 30 度。', R: '30 分鐘後體溫 37.8℃，持續觀察。' }, true);
  nt(8, 0, '護理人員', 'DAR', { D: '步行時跌倒，左膝擦傷 2 cm。', A: '傷口清潔消毒，通知家屬，重新評估跌倒風險。', R: '無其他不適，步態穩定。' }, true);
  nt(1, 1, '職能治療師', '一般', { text: '進行進食訓練，使用易握湯匙與高邊盤，可自行進食約一半。' });
  nt(5, 1, '社工人員', '一般', { text: '住民表達思念家人，已聯繫長女本週六探視。情緒穩定。' });
  nt(10, 2, '護理人員', 'SOAP', { S: '「腳有點麻。」', O: '右足背傷口 1×1 cm，無滲液；血糖 320 mg/dL。', A: '血糖控制不佳，傷口癒合延遲風險。', P: '通知醫師調整用藥，每日換藥並監測血糖。' });
  // 前前季分析已完成
  const pq2 = prevQuarter(prevQuarter(quarterOf(T)));
  DB.quarterly[pq2] = { done: true, doneDate: addDays(T, -80), analysis: { '跌倒': { a: '夜間如廁跌倒 1 件。', b: '夜間定時如廁、離床警示。' } } };
  // 評鑑自評示範
  ['A1', 'A2', 'A7', 'A8', 'A9', 'A11', 'B1', 'B11', 'C4', 'C9', 'C15', 'D2', 'D6'].forEach(c => DB.accred[c] = { r: 'B', note: '文件已備妥（示範）' });
  DB.residents[9].portraitConsent = true; DB.residents[6].portraitConsent = true;
  COLLECTIONS.forEach(c => Store.mark(c));
}
