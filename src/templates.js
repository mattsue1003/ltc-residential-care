/* ===== 快速紀錄範本：依機構實際護理紀錄寫法整理（填選項 → 產生文字 → 同時登錄品質指標） ===== */
const NURSE_TITLES = ['定期巡診', '藥物回', '回診', '施打疫苗', '跌倒', '送急診', '急診返回', '出院返院', '住院', '請假外出', '請假返室', '新入住', '喘息入住', '喘息轉自費', '痰多', '發燒', '血氧低', '呼吸喘', '食慾及精神差', '腹瀉', '便秘', '尿液混濁', '傷口', '情緒躁動', '拒絕服藥', '一般觀察'];
const V = (k, label, type = 'text', options, def, ph) => ({ key: k, label, type, options, def, ph });

/* 生命徵象：依機構慣用格式「36.4、101、21、BP:182/97mmHg、SpO2:97%(RA)」 */
function vsLine(o) {
  const parts = [];
  const tprs = [o.t, o.p, o.r].filter(x => x !== '' && x != null);
  if (tprs.length) parts.push(tprs.join('、'));
  if (o.sbp) parts.push(`BP:${o.sbp}/${o.dbp || ''}mmHg`);
  if (o.spo2) parts.push(`SpO2:${o.spo2}%(${o.o2 ? o.o2 : 'RA'})`);
  return parts.length ? '生命徵象:' + parts.join('、') : '';
}
function todayVS(rid) { const d = DB.daily.find(x => x.rid === rid && x.date === today()) || {}; return { t: d.temp ?? '', p: d.pulse ?? '', r: d.resp ?? '', sbp: d.sbp || '', dbp: d.dbp || '', spo2: d.spo2 || '' }; }
const VS_FIELDS = [V('t', '體溫'), V('p', '脈搏'), V('r', '呼吸'), V('sbp', '收縮壓'), V('dbp', '舒張壓'), V('spo2', '血氧 %'), V('o2', '給氧（空白＝室內空氣）', 'select', ['', '鼻導管 2L', '鼻導管 3L', '面罩 5L', '面罩 8L'])];
const j = (...a) => a.filter(Boolean).join('，');
const tail = s => (s || '').replace(/[，,。\s]+$/, '');

const NOTE_TEMPLATES = {
  '定期巡診': {
    fields: [V('who', '醫師', 'text', null, '巡診醫師'), V('why', '症狀／原因', 'text', null, '', '例：近日痰液多、色黃'), V('drug', '開立', 'select', ['口服藥', '抗生素', '藥膏', '止咳化痰藥', '退燒藥', '無開立新藥']), V('freq', '頻次', 'select', ['', 'QD', 'BID', 'TID', 'QID', 'PRN']), V('days', '天數', 'number', null, 7), V('adj', '用藥調整', 'select', ['無調整用藥', '有調整用藥，詳見藥單'])],
    text: (o) => j(o.why && tail(o.why), `今${o.who}診視後${o.drug === '無開立新藥' ? '未開立新藥' : `協助開立${o.drug}${o.freq ? o.freq : ''}${o.days ? '*' + o.days + '天' : ''}`}`, o.adj, '依醫囑給予藥物使用', '續觀。'),
    link: { contact: '醫師巡診' },
  },
  '藥物回': {
    fields: [V('src', '來源', 'select', ['家屬代拿藥', '常規口服藥回', '回診帶回']), V('dept', '科別', 'text', null, '', '例：神內、泌尿科'), V('days', '天數', 'number', null, 28), V('chronic', '慢籤次數', 'select', ['', '1', '2', '3']), V('adj', '用藥調整', 'select', ['無調整用藥', '醫師有調整藥物，詳見藥單', 'DC 部分藥物']), V('next', '下次回診', 'date')],
    text: (o) => j(`今${o.dept ? o.dept + '回診，' : ''}${o.src}${o.days ? '*' + o.days + '天' : ''}`, o.chronic && `慢籤*${o.chronic}回`, o.next && `下次回診時間於${roc(o.next)}`, o.adj, '依醫囑給予藥物使用', '續觀。'),
  },
  '施打疫苗': {
    fields: [V('vac', '疫苗', 'select', ['流感及新冠疫苗', '流感疫苗', '新冠疫苗', '肺炎鏈球菌疫苗（請另至疫苗頁登錄 PCV／PPV23）']), V('doc', '評估醫師', 'text', null, '巡診醫師'), V('consent', '同意', 'select', ['經家屬同意', '經住民本人同意'])],
    text: (o) => `${o.consent}，今由${o.doc}前來評估住民疫苗施打並與住民解釋施打疫苗之目的，現無不適之症狀，可以施打${o.vac}，衛教增加水份攝取，注意有無發燒及不適之症狀。`,
    link: { vaccine: true },
  },
  '跌倒': {
    fields: [V('time', '發現時間', 'time'), V('by', '發現者', 'select', ['巡視時發現', '照服員發現', '護理人員發現', '住民自行告知']), V('place', '地點', 'select', ['寢室床邊', '浴廁', '走廊', '餐廳／交誼廳', '活動室', '戶外']), V('how', '情境', 'select', ['自行下床', '自行拉開床欄下床', '自行解開約束下床', '如廁時', '推輪椅時重心不穩', '轉位時', '行走時', '坐在地上原因不明']),
      V('lv', '意識', 'select', ['意識清楚', '意識混亂', '嗜睡', '情緒躁動']), V('inj', '傷勢', 'select', ['身體檢查無外傷或紅腫', '擦傷', '瘀青', '撕裂傷需縫合', '疑似骨折']), V('cause', '主要原因', 'select', ['住民健康情況', '治療或藥物反應', '環境中危險因子', '其他因素']), V('injd', '傷口描述', 'text', null, '', '例：左額頭 3*0.8 公分'),
      V('pain', '疼痛', 'select', ['無疼痛不適之主訴', '主訴疼痛']), V('act', '處置', 'select', ['已協助臥床休息', '協助攙扶起來', '傷口清潔消毒', '評估後予以送醫']), V('notify', '通知', 'select', ['已通知主管及家屬', '已傳訊息告知家屬', '已通知主管、家屬及醫師'])].concat(VS_FIELDS),
    text: (o) => j(`於${o.time || '__:__'}分${o.by === '巡視時發現' ? '巡視時發現住民' : o.by === '住民自行告知' ? '住民告知' : o.by + '住民'}於${o.place}${o.how}跌倒`, o.lv, vsLine(o), o.inj === '身體檢查無外傷或紅腫' ? o.inj : `身體檢查${o.injd ? o.injd : ''}${o.inj}`, o.pain, o.act, o.notify, o.act === '評估後予以送醫' ? '待追蹤。' : '重新評估跌倒風險，續觀。'),
    link: { event: '跌倒', map: o => ({ place: o.place, injury: /無外傷/.test(o.inj) ? '無傷害' : /縫合/.test(o.inj) ? '2級（中度：需縫合、扭傷）' : /骨折/.test(o.inj) ? '3級（重度：骨折、頭部外傷）' : '1級（輕度：擦傷、瘀青）', fallCause: o.cause, time: o.time, notify: ['家屬'].concat(/醫師/.test(o.notify) ? ['醫師'] : []).concat(/主管/.test(o.notify) ? ['業務負責人'] : []), factors: [/床欄/.test(o.how) && '設備：床欄或煞車未固定', /如廁/.test(o.how) && '個人：如廁急迫', /躁動|混亂/.test(o.lv) && '個人：認知障礙或躁動', /輪椅|行走|轉位/.test(o.how) && '個人：肌力／平衡差', /^0[0-5]|^2[2-3]/.test(o.time || '') && '人力：交班或夜間人力'].filter(Boolean) }) },
  },
  '送急診': {
    fields: [V('time', '發現時間', 'time'), V('sym', '狀況', 'select', ['呼吸喘', '血氧下降', '意識改變、叫喚無反應', '發燒不退', '抽搐', '胸悶胸痛', '嘔吐咖啡色物', '跌倒受傷', '其他']), V('symd', '狀況描述', 'text', null, '', '例：呼吸喘且呈腹式呼吸'),
      V('act', '處置', 'select', ['予協助抽痰及給氧', '予氧氣面罩 5L 使用', '予傷口加壓止血', '予側躺保持呼吸道通暢']), V('rel', '聯絡家屬（關係）', 'select', ['兒子', '女兒', '配偶', '媳婦', '孫子女', '其他親屬', '委託人／社工']), V('hosp', '送往醫院', 'text', null, '', '例：○○醫院急診'),
      V('amb', '救護車抵達', 'time'), V('leave', '救護車離開', 'time')].concat(VS_FIELDS),
    text: (o) => j(`於${o.time || '__:__'}分發現住民${o.symd || o.sym}`, vsLine(o), o.act, `回報主管、聯絡家屬(${o.rel})同意送${o.hosp || '醫院'}急診`, '聯絡救護車', o.amb && `於${o.amb}分救護車抵達機構`, '將健保卡、藥物、日常用品交給救護人員並交班送醫概況', o.leave && `${o.leave}分救護車離開機構`, '待追蹤。'),
    link: { event: '緊急送醫', map: o => ({ hospital: o.hosp, familyTime: o.time, time: o.time, notify: ['家屬', '業務負責人'] }) },
  },
  '急診返回': {
    fields: [V('time', '返回時間', 'time'), V('by', '交通', 'select', ['救護車', '家屬陪同', '復康巴士']), V('hosp', '醫院', 'text'), V('res', '檢查結果／處置', 'text', null, '', '例：CT 無異常，頭部縫合 5 針'), V('drug', '帶回藥物', 'text', null, '', '例：抗生素軟膏、普拿疼 TID'), V('mood', '精神情緒', 'select', ['精神可、情緒穩定', '嗜睡', '情緒躁動'])].concat(VS_FIELDS),
    text: (o) => j(`住民於${o.time || '__:__'}由${o.by}從${o.hosp || '醫院'}急診返回機構`, o.res && `急診醫師表示${o.res}`, o.drug && `開回${o.drug}`, o.mood, vsLine(o), '續觀。'),
  },
  '出院返院': {
    fields: [V('by', '交通', 'select', ['救護車', '復康巴士', '家屬陪同']), V('dx', '此次住院原因', 'text', null, '', '例：肺炎'), V('gcs', 'GCS（E/M/V）', 'text', null, '', '例：E3M3V2'), V('lv', '意識', 'select', ['清楚', '清楚混亂', '嗜睡', '躁動']),
      V('tube', '管路', 'select', ['無', '鼻胃管留置', '鼻胃管及導尿管留置', '導尿管留置']), V('tubed', '管路規格', 'text', null, '', '例：16FR，固定 55 公分'), V('skin', '皮膚／傷口', 'text', null, '無傷口', '例：薦骨 1 級壓傷'), V('days', '出院帶藥天數', 'number', null, 7), V('next', '回診日期', 'date')].concat(VS_FIELDS),
    text: (o) => j(`今由${o.by}出院返回機構`, o.dx && `此次因${o.dx}住院`, o.gcs && `GCS:${o.gcs}`, `意識:${o.lv}`, o.tube !== '無' && `${o.tube}${o.tubed ? '，' + o.tubed : ''}`, vsLine(o), `皮膚:${o.skin}`, o.days && `出院帶藥*${o.days}天`, o.next && `預計${roc(o.next)}回診`, '持續機構照顧，續觀。'),
  },
  '住院': {
    fields: [V('hosp', '醫院', 'text'), V('dx', '住院原因', 'text', null, '', '例：肺炎及泌尿道感染'), V('src', '訊息來源', 'select', ['家屬病情回報', '醫院回報', '急診後收治住院'])],
    text: (o) => `${o.src}：因${o.dx || '__'}${o.hosp ? '於' + o.hosp : ''}需住院治療，續觀。`,
    link: { event: '非計畫性住院', map: o => ({ hospital: o.hosp, dx: o.dx }), status: '住院中' },
  },
  '請假外出': {
    fields: [V('time', '外出時間', 'time'), V('rel', '陪同家屬', 'select', ['兒子', '女兒', '配偶', '媳婦', '其他親屬']), V('why', '事由', 'select', ['返家', '外出聚餐', '回診', '宗教活動', '其他']), V('back', '預計返回', 'text', null, '', '例：今晚 18:00 前')],
    text: (o) => j(`於${o.time || '__:__'}分由家屬(${o.rel})陪同${o.why}`, '外出前精神、情緒可，檢查身體無傷口及紅臀', o.back && `預計${o.back}返回`, '已衛教家屬注意事項。'),
    link: { contact: '家屬探視' },
  },
  '請假返室': {
    fields: [V('time', '返回時間', 'time'), V('rel', '陪同家屬', 'select', ['兒子', '女兒', '配偶', '媳婦', '其他親屬']), V('mood', '精神情緒', 'select', ['精神、食慾、情緒皆可', '精神較差', '情緒不穩']), V('body', '身體檢查', 'select', ['檢查身體無傷口及紅臀', '有傷口或紅臀（另述）']), V('item', '帶回物品／財物', 'text', null, '', '例：零食、鞋子；200 元交還家屬')],
    text: (o) => j(`於${o.time || '__:__'}分由家屬(${o.rel})協助載回`, o.mood, o.body, o.item && `帶回${o.item}`, '續觀。'),
  },
  '新入住': {
    fields: [V('from', '入住來源', 'select', ['醫院出院', '家中', '其他機構轉入']), V('fromd', '醫院／機構', 'text'), V('by', '交通', 'select', ['救護車', '復康巴士', '家屬陪同']), V('kind', '入住類型', 'select', ['長期入住', '喘息入住']), V('period', '喘息期間', 'text', null, '', '例：10/26–11/15'),
      V('hx', '過去病史', 'text', null, '', '例：高血壓、失智症'), V('why', '此次原因', 'text', null, '', '例：跌倒致顱內出血術後'), V('gcs', 'GCS', 'text'), V('lv', '意識', 'select', ['清楚', '清楚混亂', '嗜睡', '躁動']), V('tube', '管路', 'select', ['無', '鼻胃管', '導尿管', '鼻胃管及導尿管']), V('skin', '皮膚', 'text', null, '完整'), V('allergy', '過敏', 'text', null, '無')],
    text: (o) => j(`今由${o.fromd || o.from}${o.by === '家屬陪同' ? '由家屬陪同' : '以' + o.by}接入住`, o.kind === '喘息入住' ? `喘息${o.period ? '(' + o.period + ')' : ''}` : '長期入住', o.hx && `過去病史:${o.hx}`, o.why && `此次因${o.why}`, o.gcs && `GCS:${o.gcs}`, `意識:${o.lv}`, o.tube !== '無' && `留置${o.tube}`, `皮膚:${o.skin}`, `過敏:${o.allergy}`, '已介紹環境與呼叫鈴使用，安排入住 72 小時評估，續觀。'),
  },
  '痰多': {
    fields: [V('look', '痰液性狀', 'select', ['色黃、稠', '色白、稠', '色白、稀', '帶血絲']), V('breath', '呼吸', 'select', ['呼吸平順、偶咳嗽', '呼吸稍喘', '需抽痰']), V('act', '處置', 'select', ['依醫囑用藥，囑照服員落實翻身拍背、加強化痰', '予抽痰並回報醫師', '回報巡診醫師診治'])],
    text: (o) => j(`今住民痰液多、${o.look}`, o.breath, o.act, '續觀。'),
    link: { infection: '上呼吸道感染' },
  },
  '發燒': {
    fields: [V('t', '體溫'), V('sym', '伴隨症狀', 'text', null, '', '例：咳嗽、尿液混濁'), V('act', '處置', 'select', ['予溫水擦澡、增加水份攝取並通知醫師', '依醫囑給予退燒藥', '冰枕使用並監測體溫 q4h']), V('re', '30 分鐘後體溫', 'text')],
    text: (o) => j(`住民體溫${o.t || '__'}℃`, o.sym && `伴隨${o.sym}`, o.act, o.re && `30 分鐘後複測體溫${o.re}℃`, '持續監測體溫，續觀。'),
    link: { infection: '不明原因發燒' },
  },
  '血氧低': {
    fields: [V('time', '時間', 'time'), V('act', '處置', 'select', ['予協助抽痰', '予鼻導管 2L 使用', '予氧氣面罩 5L 使用', '協助半坐臥並深呼吸']), V('after', '處置後血氧 %', 'text')].concat(VS_FIELDS),
    text: (o) => j(`於${o.time || '__:__'}分發現住民血氧下降`, vsLine(o), o.act, o.after && `處置後 SpO2:${o.after}%`, '回報護理主管，續觀。'),
  },
  '食慾及精神差': {
    fields: [V('eat', '進食量', 'select', ['約一半', '約三分之一', '僅少量', '拒食']), V('act', '處置', 'select', ['少量多餐、鼓勵進食並記錄進食量', '通知營養師評估', '回報醫師']), V('w', '近期體重變化', 'text')],
    text: (o) => j(`住民近日食慾及精神較差，進食${o.eat}`, o.w && `體重${o.w}`, o.act, '續觀。'),
  },
  '腹瀉': {
    fields: [V('n', '次數', 'number', null, 3), V('look', '性狀', 'select', ['水便', '糊便', '黃色稀便']), V('act', '處置', 'select', ['增加水份、觀察脫水徵象並通知醫師', '依醫囑給藥', '單獨照護並加強手部衛生'])],
    text: (o) => j(`今住民腹瀉${o.n}次，${o.look}`, o.act, o.n >= 3 ? '依人口密集機構傳染病監視作業注意事項監測' : '', '續觀。'),
    link: { infection: '腸胃道（腹瀉）' },
  },
  '傷口': {
    fields: [V('site', '部位', 'text', null, '', '例：右腳大拇趾'), V('size', '大小', 'text', null, '', '例：1*1 公分'), V('look', '外觀', 'select', ['無紅腫滲液', '有黑痂', '有化膿', '紅腫', '滲液多']), V('care', '換藥', 'text', null, '', '例：生理食鹽水清潔後敷料覆蓋 QD')],
    text: (o) => j(`${o.site}傷口${o.size ? o.size : ''}`, o.look, o.care && `予${o.care}`, '持續觀察傷口變化。'),
  },
  '情緒躁動': {
    fields: [V('beh', '行為', 'select', ['大聲叫喊', '打人、吐口水', '欲自行下床', '拉扯管路', '拒絕照護']), V('act', '處置', 'select', ['安撫並陪伴，轉移注意力', '評估疼痛、如廁、口渴等需求', '通知醫師評估用藥', '增加巡視'])],
    text: (o) => j(`住民今情緒躁動，${o.beh}`, o.act, '約束前已先執行替代措施', '續觀。'),
  },
};
/* 這些範本不一定要另開欄位，直接給常用句 */
const SIMPLE_TITLES = { '喘息轉自費': '住民今由機構喘息轉自費入住，持續提供機構照顧。', '喘息入住': '', '回診': '今家屬帶住民回診__科，醫師__，續觀。', '呼吸喘': '', '便秘': '住民已__天未解便，予腹部按摩、增加水份及纖維攝取，依醫囑給予軟便劑，續觀。', '尿液混濁': '住民尿液混濁、有異味，鼓勵增加水份攝取，回報醫師並留取尿液檢查，續觀。', '拒絕服藥': '住民今拒絕服藥，予以解釋用藥目的並安撫，30 分鐘後再次給藥已服用，續觀。', '一般觀察': '住民今精神可、食慾可，生命徵象穩定，無特殊不適主訴，續觀。' };

/* 範本面板（放在照護紀錄視窗裡） */
let tplState = null;
function tplPicker() {
  return `<div class="tpl-bar"><label class="f" style="margin:0">護理問題（標題）<select id="noteTitle" name="title"><option value="">－選擇或自行輸入內容－</option>${NURSE_TITLES.map(t => `<option${(window.__noteDraft && window.__noteDraft.n.title === t) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    <button class="btn sm pri" data-act="tplOpen" id="tplBtn" style="align-self:end">快速範本</button></div>`;
}
ACT.tplOpen = () => {
  const D = window.__noteDraft; const t = $('#noteTitle').value; if (!t) { toast('先選擇護理問題', 'bad'); return; }
  Object.assign(D.n, readForm(D.F(), $('#mbody'), true)); D.n.title = t;
  const T = NOTE_TEMPLATES[t];
  if (!T) { const s = SIMPLE_TITLES[t]; if (s) { D.n.kind = '一般'; D.n.text = (D.n.text ? D.n.text + '\n' : '') + s; $('#mbody').innerHTML = D.body(); toast('已帶入常用句，請修改底線處'); } else toast('這個問題沒有範本，請直接輸入'); return; }
  const vs = todayVS(D.n.rid);
  tplState = { t, o: Object.assign({}, Object.fromEntries(T.fields.map(f => [f.key, f.def ?? (vs[f.key] !== undefined ? vs[f.key] : f.type === 'select' ? f.options[0] : '')]))) };
  if (T.fields.some(f => f.key === 'time')) tplState.o.time = tplState.o.time || new Date().toTimeString().slice(0, 5);
  $('#mbody').innerHTML = `<div class="row"><b>快速範本：${esc(t)}</b><span class="sp"></span><button class="btn sm" data-act="tplBack">返回</button></div>
    <div class="grid g3" id="tplForm" style="margin-top:8px">${T.fields.map(f => `<div>${field(Object.assign({ blank: false }, f), tplState.o[f.key])}</div>`).join('')}</div>
    <div class="small muted">預覽（可在帶入後再修改）</div><div class="narr" id="tplPrev"></div>
    ${T.link ? `<div class="checks" style="margin-top:8px"><label><input type="checkbox" id="tplLink" checked> ${tplLinkLabel(T.link)}</label></div>` : ''}
    <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" data-act="tplApply">帶入紀錄</button></div>`;
  const upd = () => { tplState.o = readForm(T.fields, $('#tplForm'), true); $('#tplPrev').textContent = T.text(tplState.o); };
  $('#tplForm').addEventListener('input', upd); $('#tplForm').addEventListener('change', upd); upd();
};
function tplLinkLabel(L) {
  if (L.event) return `同時登錄品質指標事件「${L.event}」（原因分析與改善之後可補）`;
  if (L.infection) return `同時登錄「感染」監測（${L.infection}）`;
  if (L.contact) return `同時記一筆「${L.contact}」紀錄`;
  if (L.vaccine) return '同時登錄疫苗接種';
  return '';
}
ACT.tplBack = () => { const D = window.__noteDraft; $('#mbody').innerHTML = D.body(); };
ACT.tplApply = () => {
  const D = window.__noteDraft, T = NOTE_TEMPLATES[tplState.t];
  D.n.title = tplState.t; const gen = T.text(tplState.o);
  if (D.n.kind === 'DAR') D.n.D = (D.n.D ? D.n.D + '\n' : '') + gen; else if (D.n.kind === 'SOAP') D.n.O = (D.n.O ? D.n.O + '\n' : '') + gen; else D.n.text = (D.n.text ? D.n.text + '\n' : '') + gen;
  if (/緊急|送急診|跌倒|血氧|住院/.test(tplState.t)) D.n.handover = true;
  D.n._link = T.link && $('#tplLink') && $('#tplLink').checked ? { t: tplState.t, o: tplState.o } : null;
  if (tplState.o.t || tplState.o.sbp || tplState.o.spo2) D.n._vs = { t: tplState.o.t, p: tplState.o.p, r: tplState.o.r, sbp: tplState.o.sbp, dbp: tplState.o.dbp, spo2: tplState.o.spo2 };
  $('#mbody').innerHTML = D.body(); toast('已帶入，可再修改後儲存');
};
/* 儲存照護紀錄時，一併建立連動紀錄 */
function applyNoteLinks(n) {
  const L = n._link; delete n._link; const vs = n._vs; delete n._vs;
  if (vs && n.date === today()) { const x = getDaily(n.rid, n.date); const patch = {}; [['temp', 't'], ['pulse', 'p'], ['resp', 'r'], ['sbp', 'sbp'], ['dbp', 'dbp'], ['spo2', 'spo2']].forEach(([a, b]) => { if (vs[b] !== '' && vs[b] != null && (x[a] === '' || x[a] == null)) patch[a] = +vs[b]; }); if (Object.keys(patch).length) setDaily(n.rid, n.date, patch); }
  if (!L) return [];
  const T = NOTE_TEMPLATES[L.t].link, o = L.o, made = [];
  if (T.event) { const e = save('events', Object.assign({ rid: n.rid, type: T.event, date: n.date, time: o.time || n.time, desc: noteText(n), immediate: '', status: '追蹤中' }, T.map ? T.map(o) : {})); made.push(`${T.event}事件`); n.eventId = e.id; if (T.status) { const r = resById(n.rid); r.status = T.status; save('residents', r); } }
  if (T.infection) { const e = save('events', { rid: n.rid, type: '感染', date: n.date, time: n.time, infType: T.infection, reported: '不需通報', desc: noteText(n), status: '追蹤中' }); made.push('感染監測'); n.eventId = e.id; }
  if (T.contact) { save('contacts', { rid: n.rid, kind: T.contact, date: n.date, content: n.text }); made.push(T.contact); }
  if (T.vaccine) { const kinds = /流感及新冠/.test(o.vac) ? ['流感', 'COVID-19'] : /流感/.test(o.vac) ? ['流感'] : /新冠/.test(o.vac) ? ['COVID-19'] : []; kinds.forEach(k => save('vaccines', { rid: n.rid, kind: k, date: n.date, refused: false })); made.push('疫苗接種'); }
  return made;
}

/* ===== 品質指標事件：原因分析／處置／改善 片語 ===== */
const EVENT_PHRASES = {
  '跌倒': {
    cause: ['夜間如廁需求未被預期', '住民自行下床未按呼叫鈴', '床欄未拉起或煞車未固定', '下肢肌力與平衡不足', '認知障礙、高估自身能力', '地面潮濕', '鞋子不合腳或未穿防滑鞋', '服用鎮靜安眠或降壓藥物', '照明不足', '自行解開約束'],
    action: ['身體檢查無外傷，協助臥床休息', '傷口清潔消毒', '通知家屬及主管', '通知醫師評估', '評估後送醫檢查', '重新評估跌倒風險（Morse）', '24 小時內加強觀察意識與生命徵象'],
    improve: ['床降至最低並固定煞車', '加裝離床警示', '夜間每 2 小時定時如廁', '加強夜間巡視', '呼叫鈴放在伸手可及處並再次衛教', '改穿防滑鞋', '物理治療加強肌力與平衡訓練', '藥師與醫師檢視用藥', '照明改善、設置夜燈', '跨專業討論並修正照顧計畫'],
  },
  '壓力性損傷': {
    cause: ['翻身擺位不確實', '長期臥床活動力差', '營養攝取不足、白蛋白偏低', '失禁致皮膚潮濕', '摩擦力與剪力', '減壓設備不足', '住院期間發生（帶入）'],
    action: ['傷口清潔並依醫囑換藥', '使用減壓氣墊床', '每 2 小時翻身並以枕頭支撐骨突處', '失禁後立即清潔並使用皮膚保護劑', '營養師評估並補充蛋白質', '每週測量傷口大小並拍照'],
    improve: ['翻身紀錄改為每班稽核', '高風險住民（Braden ≤ 12）一律使用氣墊床', '照服員翻身擺位技術在職訓練', '每週營養評估', '失禁護理流程標準化'],
  },
  '感染': {
    cause: ['長期留置導尿管', '吞嚥困難致吸入', '口腔清潔不足', '免疫力低下、慢性病', '群聚接觸傳染', '水份攝取不足'],
    action: ['通知醫師，依醫囑使用抗生素', '監測體溫 q4h', '留取檢體送驗', '單獨照護並加強手部衛生', '依規定 24 小時內上網通報', '增加水份攝取'],
    improve: ['加強手部衛生稽核', '落實每日餐後與睡前口腔清潔', '管路照護標準作業再訓練', '評估移除導尿管（膀胱訓練）', '進食姿勢與吞嚥評估', '疫苗接種宣導'],
  },
  '非計畫性住院': {
    cause: ['肺炎', '泌尿道感染', '跌倒受傷', '心衰竭或慢性病急性惡化', '電解質異常', '腸胃道出血'],
    action: ['緊急送醫並通知家屬', '交班送醫概況', '住院期間與家屬保持聯繫', '出院返院後重新評估'],
    improve: ['早期辨識警訊（生命徵象異常即回報）', '加強呼吸道照護與口腔清潔', '醫師巡診時提出高風險個案', '返院後跨專業討論修正照顧計畫'],
  },
  '緊急送醫': {
    cause: ['呼吸喘、血氧下降', '意識改變', '跌倒受傷需檢查', '發燒不退'],
    action: ['給氧及抽痰', '聯絡家屬同意送醫', '聯絡救護車並交班', '交付健保卡、藥物與日常用品'],
    improve: ['檢視急救設備與流程', '辦理緊急送醫演練', '更新醫療資源網絡與家屬聯絡電話'],
  },
  '非計畫性體重改變': {
    cause: ['進食量減少', '吞嚥困難', '急性疾病', '情緒低落', '活動量改變', '利尿或水腫變化'],
    action: ['營養師評估', '記錄每餐進食量', '調整飲食質地與份量', '補充營養品', '每週量體重'],
    improve: ['每月體重追蹤納入照顧計畫', '低體重住民每週量體重', '跨專業討論進食問題'],
  },
  '管路滑脫／自拔': {
    cause: ['意識混亂或躁動', '管路固定不牢', '翻身或轉位時拉扯', '住民不適而自拔'],
    action: ['評估是否需重新放置並通知醫師', '重新固定管路', '檢查鼻腔或尿道口有無損傷'],
    improve: ['改善管路固定方式', '評估移除管路的可能（吞嚥訓練、膀胱訓練）', '先採替代措施再評估約束'],
  },
};
function eventPhraseHTML(type) {
  const P = EVENT_PHRASES[type]; if (!P) return '';
  const row = (k, l) => `<div class="small muted" style="margin-top:4px">${l}</div><div class="chips" style="margin-bottom:4px">${P[k].map(p => `<button class="chip" data-act="evPhrase" data-f="${k}" data-t="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
  return `<details class="acc-item" open><summary><b>常用片語</b><span class="small muted">點一下加入對應欄位</span></summary><div class="body">${row('cause', '原因分析')}${row('action', '處置與追蹤')}${row('improve', '改善方案')}</div></details>`;
}
ACT.evPhrase = el => { const ta = $(`#mbody textarea[name="${el.dataset.f}"]`); if (!ta) return; ta.value = (ta.value ? ta.value + '、' : '') + el.dataset.t; el.classList.add('on'); };

/* ===== 匯出 Word／PDF：所有列印表單共用 ===== */
function wordDoc(pages, title) {
  const land = pages.some(p => p.startsWith('<!--land-->'));
  const css = `@page WordSection1{${land ? 'size:29.7cm 21cm;mso-page-orientation:landscape' : 'size:21cm 29.7cm'};margin:1.2cm 1.2cm} div.WordSection1{page:WordSection1}
    body{font-family:"標楷體","DFKai-SB","BiauKai",serif;font-size:12pt} h1{text-align:center;font-size:17pt;margin:0 0 2pt} .org{text-align:center;font-size:12pt}
    table{border-collapse:collapse;width:100%;margin:4pt 0} td,th{border:1px solid #000;padding:3pt 5pt;vertical-align:top;font-size:11pt} th{background:#eee}
    .meta{font-size:11pt;margin:4pt 0} .note{font-size:9.5pt;color:#333} .box{border:1px solid #000;padding:4pt} .sign{margin-top:14pt}`;
  pages = pages.map(p => p.replace(/(white-space:pre-wrap[^>]*>)([\s\S]*?)(<\/t[dh]>|<\/div>)/g, (m, a, b, c) => a + b.replace(/\n/g, '<br>') + c));
  const body = pages.map((p, i) => (i ? '<br clear="all" style="page-break-before:always">' : '') + p.replace(/<span class="ck y">/g, '<span>☑ ').replace(/<span class="ck">/g, '<span>☐ ').replace(/<div class="meta">([\s\S]*?)<\/div>/g, (m, inner) => `<p class="meta">${inner.replace(/<\/span>\s*<span>/g, '　　')}</p>`).replace(/<div class="sign">([\s\S]*?)<\/div>/g, (m, inner) => `<p class="sign">${inner.replace(/<\/span>\s*<span>/g, '　　')}</p>`)).join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${css}</style></head><body><div class="WordSection1">${body}</div></body></html>`;
}
function downloadWord(pages) {
  const title = ((pages[0] || '').match(/<h1>(.*?)<\/h1>/) || [, '紀錄'])[1].replace(/<[^>]+>/g, '');
  const blob = new Blob(['﻿', wordDoc(pages, title)], { type: 'application/msword' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title}_${today()}.doc`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  logAccess('下載 Word：' + title); toast('已下載 Word 檔，可用 Word 開啟後編修');
}
