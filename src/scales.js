/* 評估量表定義：自動計分、判讀、敘述句、照顧計畫建議 */
const SCALES = {
  barthel: {
    name: '巴氏量表 (ADL)', short: 'ADL', domain: '身體', cycle: 90, core: true,
    items: [
      ['進食', [[10,'自己在合理時間內進食，可自行取食'],[5,'需部分協助（切食物、攪拌）'],[0,'無法自行進食或需餵食']]],
      ['移位（輪椅↔床）', [[15,'可獨立完成，含煞車、移開腳踏板'],[10,'需少量協助或提醒'],[5,'可自行坐起，移位需他人協助'],[0,'需他人完全協助']]],
      ['個人衛生', [[5,'可獨立洗臉、刷牙、梳頭、刮鬍'],[0,'需他人協助']]],
      ['如廁', [[10,'可自行上下馬桶、穿脫衣、清潔'],[5,'需協助保持平衡、整理衣物或清潔'],[0,'需他人完全協助']]],
      ['洗澡', [[5,'可獨立完成盆浴或淋浴'],[0,'需他人協助']]],
      ['平地行走', [[15,'可獨立行走 50 公尺以上（可用輔具）'],[10,'需稍微扶持或口頭指導可走 50 公尺'],[5,'無法行走，但可獨立操作輪椅 50 公尺'],[0,'需他人完全協助']]],
      ['上下樓梯', [[10,'可自行上下樓梯（可扶扶手）'],[5,'需稍微扶持或口頭指導'],[0,'無法上下樓梯']]],
      ['穿脫衣褲鞋襪', [[10,'可自行穿脫，含扣扣子、拉鍊、綁鞋帶'],[5,'可完成一半以上，需他人協助'],[0,'需他人完全協助']]],
      ['大便控制', [[10,'不會失禁，必要時會自行使用塞劑'],[5,'偶爾失禁（每週不超過一次）'],[0,'失禁或需灌腸']]],
      ['小便控制', [[10,'日夜皆不會尿失禁，或可自行處理導尿'],[5,'偶爾失禁（每週不超過一次）'],[0,'失禁或需他人協助導尿']]],
    ],
    max: 100,
    level(s) { return s === 100 ? ['完全獨立','ok'] : s >= 91 ? ['輕度依賴','ok'] : s >= 61 ? ['中度依賴','warn'] : s >= 21 ? ['嚴重依賴','bad'] : ['完全依賴','bad']; },
  },
  spmsq: {
    name: '簡易心智狀態問卷 (SPMSQ)', short: 'SPMSQ', domain: '認知', cycle: 90, core: true, errorBased: true,
    items: [
      ['今天是幾年幾月幾日？'],['今天是星期幾？'],['這裡是什麼地方？'],['您的電話號碼（或住址）？'],['您今年幾歲？'],
      ['您的出生年月日？'],['現任總統是誰？'],['前任總統是誰？'],['您母親的姓名？'],['從 20 減 3，再一直減 3 下去'],
    ].map(q => [q[0], [[0,'答對'],[1,'答錯']]]),
    extra: [{ key: 'edu', label: '教育程度校正', type: 'select', options: ['國小（不校正）','未受教育（錯誤數可多 1）','高中以上（錯誤數需少 1）'] }],
    max: 10, unit: '錯',
    adjust(raw, ex) { const e = ex && ex.edu || ''; return e.startsWith('未受') ? Math.max(0, raw - 1) : e.startsWith('高中') ? Math.min(10, raw + 1) : raw; },
    level(s) { return s <= 2 ? ['心智功能完好','ok'] : s <= 4 ? ['輕度認知障礙','warn'] : s <= 7 ? ['中度認知障礙','bad'] : ['重度認知障礙','bad']; },
  },
  gds: {
    name: '老人憂鬱量表 (GDS-15)', short: 'GDS', domain: '心理', cycle: 90, core: true,
    items: [
      ['基本上，您對您的生活滿意嗎？','否'],['您是否減少很多活動和嗜好？','是'],['您是否覺得您的生活很空虛？','是'],
      ['您是否常常感到無聊？','是'],['您是否大部分時間精神都很好？','否'],['您是否會害怕將有不幸的事情發生？','是'],
      ['您是否大部分時間都感到快樂？','否'],['您是否常常感到無助？','是'],['您是否寧願待在房裡，不願出去做些新鮮的事？','是'],
      ['您是否覺得您的記憶力比大部分人差？','是'],['您是否覺得「現在還活著」是很好的事？','否'],['您是否覺得您現在活得很沒有價值？','是'],
      ['您是否覺得精力很充沛？','否'],['您是否覺得您的處境沒有希望？','是'],['您是否覺得大部分的人都比您好？','是'],
    ].map(([q, dep]) => [q, dep === '是' ? [[1,'是'],[0,'否']] : [[0,'是'],[1,'否']]]),
    extra: [{ key: 'na', label: '無法施測原因（如重度失智、失語）', type: 'text' }],
    max: 15,
    level(s) { return s >= 10 ? ['明顯憂鬱傾向','bad'] : s >= 5 ? ['可能有憂鬱傾向','warn'] : ['無明顯憂鬱','ok']; },
  },
  mna: {
    name: '迷你營養評估簡表 (MNA-SF)', short: 'MNA-SF', domain: '營養', cycle: 90, core: true,
    items: [
      ['過去 3 個月食量是否減少（食慾、消化、咀嚼吞嚥問題）', [[0,'嚴重減少'],[1,'中度減少'],[2,'沒有減少']]],
      ['過去 3 個月體重下降', [[0,'大於 3 公斤'],[1,'不知道'],[2,'1–3 公斤'],[3,'沒有下降']]],
      ['活動能力', [[0,'需臥床或長期坐輪椅'],[1,'可下床或離開輪椅，但不能外出'],[2,'可以外出']]],
      ['過去 3 個月內有無心理創傷或急性疾病', [[0,'是'],[2,'否']]],
      ['神經精神問題', [[0,'嚴重失智或憂鬱'],[1,'輕度失智'],[2,'無']]],
      ['BMI（無法測量時改用小腿圍）', [[0,'BMI < 19 ／ 小腿圍 < 31 cm'],[1,'BMI 19 – < 21'],[2,'BMI 21 – < 23'],[3,'BMI ≥ 23 ／ 小腿圍 ≥ 31 cm']]],
    ],
    extra: [{ key: 'height', label: '身高 (cm)', type: 'number' }, { key: 'weight', label: '體重 (kg)', type: 'number' }, { key: 'calf', label: '小腿圍 (cm)', type: 'number' }],
    max: 14,
    level(s) { return s >= 12 ? ['營養狀況正常','ok'] : s >= 8 ? ['有營養不良風險','warn'] : ['營養不良','bad']; },
  },
  morse: {
    name: '跌倒風險 (Morse Fall Scale)', short: 'Morse', domain: '安全', cycle: 90, core: true,
    items: [
      ['3 個月內跌倒史', [[0,'無'],[25,'有']]],
      ['次要診斷（兩個以上醫學診斷）', [[0,'無'],[15,'有']]],
      ['行走輔助', [[0,'無／臥床／由照顧者協助'],[15,'拐杖、助行器'],[30,'扶家具行走']]],
      ['靜脈注射或留置管路', [[0,'無'],[20,'有']]],
      ['步態', [[0,'正常／臥床／輪椅'],[10,'虛弱'],[20,'障礙（不穩、需扶持）']]],
      ['精神狀態', [[0,'了解自己的能力'],[15,'高估自己能力／忘記限制']]],
    ],
    max: 125,
    level(s) { return s >= 45 ? ['高跌倒風險','bad'] : s >= 25 ? ['中跌倒風險','warn'] : ['低跌倒風險','ok']; },
  },
  braden: {
    name: '壓力性損傷風險 (Braden Scale)', short: 'Braden', domain: '皮膚', cycle: 90, core: true, lowIsBad: true,
    items: [
      ['感覺知覺', [[1,'完全受限'],[2,'非常受限'],[3,'輕度受限'],[4,'未受損']]],
      ['皮膚潮濕', [[1,'持續潮濕'],[2,'經常潮濕'],[3,'偶爾潮濕'],[4,'很少潮濕']]],
      ['活動力', [[1,'臥床'],[2,'限坐輪椅'],[3,'偶爾行走'],[4,'經常行走']]],
      ['移動力', [[1,'完全無法移動'],[2,'非常受限'],[3,'輕度受限'],[4,'未受限']]],
      ['營養', [[1,'非常差'],[2,'可能不足'],[3,'足夠'],[4,'非常好']]],
      ['摩擦力與剪力', [[1,'有問題'],[2,'潛在問題'],[3,'無明顯問題']]],
    ],
    max: 23,
    level(s) { return s <= 9 ? ['極高風險','bad'] : s <= 12 ? ['高風險','bad'] : s <= 14 ? ['中度風險','warn'] : s <= 18 ? ['低度風險','warn'] : ['無明顯風險','ok']; },
  },
  pain: {
    name: '疼痛評估 (NRS／PAINAD)', short: '疼痛', domain: '疼痛', cycle: 90, core: true,
    items: [
      ['呼吸（非發聲時）', [[0,'正常'],[1,'偶爾費力、短時間換氣過度'],[2,'吵雜費力、長時間換氣過度、陳施氏呼吸']]],
      ['負面聲音表達', [[0,'沒有'],[1,'偶爾呻吟、低沉負面言語'],[2,'反覆叫喊、大聲呻吟、哭泣']]],
      ['臉部表情', [[0,'微笑或無表情'],[1,'難過、恐懼、皺眉'],[2,'愁眉苦臉']]],
      ['肢體語言', [[0,'放鬆'],[1,'緊繃、坐立不安、焦躁踱步'],[2,'僵直、緊握拳、膝蓋抬起、推開、攻擊']]],
      ['可安撫程度', [[0,'不需安撫'],[1,'可藉聲音或碰觸分散注意力'],[2,'無法安撫']]],
    ],
    extra: [
      { key: 'nrs', label: '數字量表 NRS 0–10（可溝通者填寫，會優先採用）', type: 'number' },
      { key: 'site', label: '疼痛位置', type: 'text' }, { key: 'onset', label: '開始時間', type: 'text' },
      { key: 'dur', label: '持續時間', type: 'text' }, { key: 'worse', label: '加重因素', type: 'text' },
      { key: 'relief', label: '緩解因素', type: 'text' },
    ],
    max: 10,
    adjust(raw, ex) { const n = parseFloat(ex && ex.nrs); return isNaN(n) ? raw : n; },
    level(s) { return s >= 7 ? ['重度疼痛','bad'] : s >= 4 ? ['中度疼痛','warn'] : s >= 1 ? ['輕度疼痛','ok'] : ['無疼痛','ok']; },
  },
  social: {
    name: '社會心理評估', short: '社心', domain: '社會', cycle: 90, core: true, form: true,
    fields: [
      { key: 'adapt', req: true, label: '入住適應狀況', type: 'select', options: ['適應良好','尚在適應','適應不良（需關懷輔導）'] },
      { key: 'mood', req: true, label: '情緒狀態', type: 'select', options: ['穩定','偶有低落或焦慮','經常不穩（需專業協處）'] },
      { key: 'family', req: true, label: '家庭支持', type: 'select', options: ['家屬定期探視','家屬偶爾探視','少有聯繫','無家屬／失聯'] },
      { key: 'econ', label: '經濟狀況', type: 'select', options: ['自費無虞','經濟較困難','低收／中低收','公費安置'] },
      { key: 'faith', label: '宗教信仰與文化需求', type: 'text' },
      { key: 'hobby', label: '興趣與生活習慣', type: 'text' },
      { key: 'wish', label: '服務對象期待與意願', type: 'text' },
      { key: 'acp', label: '預立醫療／DNR 討論', type: 'select', options: ['未討論','已初步討論','已簽署 DNR','已完成預立醫療決定 (AD)'] },
    ],
    level(a) {
      const bad = (a.adapt || '').includes('不良') || (a.mood || '').includes('經常') || (a.family || '').includes('無家屬');
      const warn = (a.adapt || '').includes('尚在') || (a.mood || '').includes('偶有') || (a.family || '').includes('少有');
      return bad ? ['需社工積極介入','bad'] : warn ? ['需持續關懷','warn'] : ['社會支持良好','ok'];
    },
  },
};
const CORE_SCALES = Object.keys(SCALES).filter(k => SCALES[k].core);

function scoreScale(type, answers, extra) {
  const sc = SCALES[type];
  if (sc.form) return { score: null, level: sc.level(extra || {}) };
  let raw = 0;
  sc.items.forEach((it, i) => { const v = answers[i]; if (v !== undefined && v !== null && v !== '') raw += +v; });
  const score = sc.adjust ? sc.adjust(raw, extra) : raw;
  return { score, level: sc.level(score) };
}
function answeredAll(type, answers, extra) {
  const sc = SCALES[type];
  if (sc.form) return true;
  if (type === 'gds' && extra && extra.na) return true;
  if (type === 'pain' && extra && extra.nrs !== undefined && extra.nrs !== '') return true;
  return sc.items.every((_, i) => answers[i] !== undefined && answers[i] !== null && answers[i] !== '');
}

/* 自動敘述句：給護理/專業紀錄直接複製 */
function narrative(type, a, r) {
  const sc = SCALES[type];
  const who = r ? r.name : '個案';
  if (sc.form) {
    const e = a.extra || {};
    return `${who}社會心理評估：入住適應「${e.adapt || '未填'}」，情緒「${e.mood || '未填'}」，家庭支持「${e.family || '未填'}」，經濟「${e.econ || '未填'}」。` +
      (e.faith ? `宗教文化需求：${e.faith}。` : '') + (e.hobby ? `興趣習慣：${e.hobby}。` : '') + (e.wish ? `本人期待：${e.wish}。` : '') +
      `預立醫療：${e.acp || '未討論'}。評估結果：${a.level}。`;
  }
  const low = [];
  if (!sc.errorBased && sc.items) sc.items.forEach((it, i) => {
    const opts = it[1]; const v = a.answers[i]; if (v === undefined) return;
    const best = sc.lowIsBad ? Math.max(...opts.map(o => o[0])) : (type === 'barthel' || type === 'mna' ? Math.max(...opts.map(o => o[0])) : Math.min(...opts.map(o => o[0])));
    if (+v !== best) { const o = opts.find(o => o[0] === +v); low.push(`${it[0]}（${o ? o[1] : v}）`); }
  });
  let s = `${who}於 ${a.date} 進行${sc.name}，`;
  if (sc.errorBased) s += `答錯 ${a.score} 題（已依教育程度校正），判讀為「${a.level}」。`;
  else s += `總分 ${a.score}/${sc.max} 分，判讀為「${a.level}」。`;
  if (low.length && type !== 'gds') s += `${type === 'barthel' || type === 'mna' || type === 'braden' ? '需協助或待改善項目' : '風險項目'}：${low.join('、')}。`;
  if (type === 'pain' && a.extra) { const e = a.extra; s += [e.site && `位置：${e.site}`, e.onset && `開始：${e.onset}`, e.dur && `持續：${e.dur}`, e.worse && `加重：${e.worse}`, e.relief && `緩解：${e.relief}`].filter(Boolean).join('；') + (e.site ? '。' : ''); }
  if (type === 'mna' && a.extra && a.extra.height && a.extra.weight) { const bmi = a.extra.weight / Math.pow(a.extra.height / 100, 2); s += `BMI ${bmi.toFixed(1)}。`; }
  return s;
}

/* 依評估結果建議照顧問題與措施（可一鍵加入照顧計畫） */
function suggestProblems(r, latest) {
  const out = [];
  const add = (key, disc, problem, goal, interventions, ref) => out.push({ key, disc, problem, goal, interventions, ref });
  const b = latest.barthel, m = latest.morse, br = latest.braden, n = latest.mna, g = latest.gds, sp = latest.spmsq, p = latest.pain, so = latest.social;
  if (b && b.score <= 60) add('adl', '照服／職能', `日常生活功能依賴（巴氏 ${b.score} 分，${b.level}）`, '維持現有 ADL 能力，3 個月內可自行參與進食或盥洗一項',
    '依可執行部分給予最少必要協助、鼓勵自行進食與盥洗；職能治療評估輔具（易握湯匙、高邊盤、穿衣輔具）；每日下床至少 2 次', 'B24 B27');
  if (b && b.answers && (+b.answers[9] < 10 || +b.answers[8] < 10)) add('toilet', '照服／護理', '有失禁之虞', '減少失禁次數、維持會陰部皮膚完整',
    '訂定每 2 小時定時如廁計畫並記錄；觀察失禁型態；可控制者執行自行如廁訓練（含給水計畫）', 'B26');
  if (m && m.score >= 45) add('fall', '護理／物理／照服', `高跌倒風險（Morse ${m.score} 分）`, '照顧期間無跌倒事件',
    '床降至最低並固定煞車、呼叫鈴放在可及處、夜燈；穿防滑鞋；定時如廁；物理治療平衡與下肢肌力訓練；藥物檢視（鎮靜安眠、降壓藥）', 'B12');
  else if (m && m.score >= 25) add('fall', '護理／照服', `中跌倒風險（Morse ${m.score} 分）`, '照顧期間無跌倒事件', '環境安全檢查、防滑鞋、提醒使用輔具、夜間定時巡視', 'B12');
  if (br && br.score <= 18) add('pi', '護理／照服／營養', `壓力性損傷風險（Braden ${br.score} 分，${br.level}）`, '皮膚完整、無新發壓力性損傷',
    '至少每 2 小時翻身擺位並記錄；使用減壓氣墊床與枕頭支撐骨突處；每日皮膚檢視；失禁後立即清潔與保護；營養師評估蛋白質與熱量', 'B13 B25');
  if (n && n.score <= 11) add('nut', '營養／護理', `營養${n.score <= 7 ? '不良' : '不良風險'}（MNA-SF ${n.score} 分）`, '1 個月內體重不再下降，3 個月內回升至目標體重',
    '營養師評估並調整個別化飲食與質地；記錄進食量；每週量體重；必要時補充營養品；口腔與吞嚥評估', 'B18 B28');
  if (g && g.score >= 5) add('mood', '社工／護理', `憂鬱傾向（GDS ${g.score} 分）`, '情緒穩定，主動參與團體活動每週至少 1 次',
    '社工定期關懷會談；安排有興趣的團體活動；增加家屬互動；症狀持續或有自傷意念時轉介精神科', 'B3 B5');
  if (sp && sp.score >= 3) add('cog', '職能／照服', `認知功能障礙（SPMSQ 錯 ${sp.score} 題）`, '維持定向感與參與度',
    '現實導向（日曆、時鐘、名牌）；規律的感官刺激與認知功能訓練並記錄；簡化指令、一次一步驟', 'B24');
  if (p && p.score >= 4) add('pain', '護理', `疼痛（${p.extra && p.extra.nrs !== undefined && p.extra.nrs !== '' ? 'NRS' : 'PAINAD'} ${p.score} 分）`, '疼痛分數降至 3 分以下',
    '依醫囑給予止痛處置並於 30–60 分鐘後評值；非藥物措施（擺位、熱敷、按摩、轉移注意力）；疼痛持續時通知醫師', 'B14');
  if (r && r.tubes && r.tubes.ng) add('ng', '護理／語言／營養', '留置鼻胃管', '管灌安全、評估移除可能',
    '個別灌食空針；每日至少一次天然食材；灌食前確認管路位置與回抽、床頭抬高 30–45 度並維持 1 小時；吞嚥評估與進食訓練以利移除鼻胃管', 'B29 B19');
  if (r && r.tubes && r.tubes.foley) add('foley', '護理', '留置導尿管', '預防泌尿道感染、評估移除可能',
    '會陰部清潔；尿袋低於膀胱；記錄尿量與性狀；評估膀胱訓練與移除時機', 'B19 B16');
  if (so && so.level && so.level.includes('社工')) add('social', '社工', `社會心理需求（${so.level}）`, '適應機構生活、維持家庭支持',
    '入住適應輔導；家屬聯繫每季至少 1 次；無家屬者依長照法第 46 條通報地方主管機關', 'B3 B7 D10');
  return out;
}
