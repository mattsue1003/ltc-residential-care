/* ===== 雲端模式：Firebase（台灣機房）＋帳號＋兩步驟驗證＋端對端加密 =====
   金鑰設計：
   - 機構資料金鑰 DEK（AES-256）只存在使用者的瀏覽器記憶體；雲端只有「被包起來的 DEK」。
   - 每位員工的密碼在本機導出兩把鑰匙：KEK（解開 DEK）與 登入密碼雜湊（送給 Firebase 驗證）。
     Google 收到的不是原始密碼，也無法用它解開資料。
   - 所有住民資料、照片在上傳前用 DEK 加密；雲端只看得到亂碼。 */
const Cloud = {
  on: typeof CLOUD_CONFIG !== 'undefined', app: null, auth: null, db: null, st: null,
  user: null, profile: null, unsub: null, known: new Map(), pending: new Set(), pulling: false, online: navigator.onLine, status: '',
  ADMIN_ROLES: ['機構主任', '系統管理員'],
  init() {
    const c = CLOUD_CONFIG;
    this.app = FB.initializeApp(c.firebase);
    this.auth = FB.getAuth(this.app);
    this.db = FB.initializeFirestore(this.app, { localCache: FB.memoryLocalCache() });
    this.st = FB.getStorage(this.app);
    if (c.emulator) {
      FB.connectAuthEmulator(this.auth, `http://${location.hostname}:9099`, { disableWarnings: true });
      FB.connectFirestoreEmulator(this.db, location.hostname, 8080);
      FB.connectStorageEmulator(this.st, location.hostname, 9199);
    }
    window.addEventListener('online', () => { this.online = true; this.setStatus(); this.pushPending(); });
    window.addEventListener('offline', () => { this.online = false; this.setStatus(); });
  },
  isAdmin() { return this.profile && this.ADMIN_ROLES.includes(this.profile.role); },
  setStatus(s) { if (s !== undefined) this.status = s; const el = $('#cloudStatus'); if (el) el.innerHTML = this.badge(); },
  badge() {
    if (!this.on) return '';
    if (!this.user) return '<span class="chip warn">離線作業</span>';
    if (!this.online) return '<span class="chip warn">網路中斷・資料暫存本機</span>';
    return this.pending.size ? `<span class="chip warn">同步中 ${this.pending.size}</span>` : '<span class="chip ok">已同步</span>';
  },

  /* --- 金鑰 --- */
  async kdf(pass, saltB64, usage, iter = 310000) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
    if (usage === 'bits') return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(saltB64), iterations: iter, hash: 'SHA-256' }, base, 256));
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
  },
  async authPw(email, pass) { const b = await this.kdf(pass, 'ltc-auth:' + email.toLowerCase(), 'bits', 100000); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); },
  async wrap(dek, pass) { const salt = b64(crypto.getRandomValues(new Uint8Array(16))); const kek = await this.kdf(pass, salt); const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv }); return { salt, iv: b64(iv), ct: b64(new Uint8Array(ct)) }; },
  async unwrap(w, pass) { const kek = await this.kdf(pass, w.salt); return crypto.subtle.unwrapKey('raw', unb64(w.ct), kek, { name: 'AES-GCM', iv: unb64(w.iv) }, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); },
  async sha256hex(s) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); },
  newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint8Array(16)); return [...r].map(x => A[x % 32]).join('').match(/.{4}/g).join('-'); },
  pwProblem(p) { if (p.length < 10) return '密碼至少 10 個字元'; if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return '密碼需同時包含英文字母與數字'; if (/^(.)\1+$/.test(p) || /(1234|abcd|password|qwer)/i.test(p)) return '密碼太容易猜到'; return ''; },

  /* --- 登入畫面 --- */
  async boot() {
    this.init();
    const q = new URLSearchParams(location.search);
    if (q.get('mode') === 'resetPassword' && q.get('oobCode')) return this.resetScreen(q.get('oobCode'));
    return this.loginScreen();
  },
  shell(html) {
    let el = $('#lock'); if (!el) { document.body.insertAdjacentHTML('beforeend', '<div class="lock" id="lock"></div>'); el = $('#lock'); }
    el.innerHTML = `<div class="box" style="max-width:440px"><div class="brand" style="margin-bottom:12px"><div class="logo">✓</div><div>${esc(CLOUD_CONFIG.org || '長照照護紀錄系統')}<small>雲端版・資料端對端加密</small></div></div>${html}<p id="lkMsg" class="small" style="color:var(--bad);min-height:1.2em"></p></div>`;
  },
  msg(t, ok) { const m = $('#lkMsg'); if (m) { m.style.color = ok ? 'var(--ok)' : 'var(--bad)'; m.textContent = t; } },
  loginScreen(tab = 'login') {
    return new Promise(resolve => {
      this._resolve = resolve;
      const tabs = `<div class="chips"><button class="chip ${tab === 'login' ? 'on' : ''}" data-lk="login">登入</button><button class="chip ${tab === 'invite' ? 'on' : ''}" data-lk="invite">我有邀請碼（新員工）</button><button class="chip ${tab === 'setup' ? 'on' : ''}" data-lk="setup">第一次設定機構</button></div>`;
      const forms = {
        login: `<form id="lkForm"><label class="f">電子郵件<input id="lkEmail" type="email" autocomplete="username" required></label><label class="f">密碼<input id="lkPw" type="password" autocomplete="current-password" required></label><button class="btn pri" style="width:100%">登入</button></form>
          <p class="small muted">員工忘記密碼：請找機構主任產生重設碼。<br><a href="#" id="lkForgot">主任忘記密碼（使用緊急復原碼）</a></p>`,
        invite: `<form id="lkForm"><label class="f">電子郵件（主任邀請時填的那個）<input id="lkEmail" type="email" autocomplete="username" required></label><label class="f">邀請碼（XXXX-XXXX-XXXX-XXXX）<input id="lkCode" required autocomplete="off" style="text-transform:uppercase"></label>
          <label class="f">設定你的密碼（至少 10 字元，含英文與數字）<input id="lkPw" type="password" autocomplete="new-password" required></label><label class="f">再輸入一次<input id="lkPw2" type="password" autocomplete="new-password" required></label><button class="btn pri" style="width:100%">建立帳號</button></form>`,
        setup: `<p class="small">只有設定檔指定的主任信箱（${esc(CLOUD_CONFIG.adminEmail || '')}）可以建立機構，且只能做一次。</p><form id="lkForm"><label class="f">機構名稱<input id="lkOrg" value="${esc(CLOUD_CONFIG.org || '')}" required></label><label class="f">主任姓名<input id="lkName" required></label><label class="f">電子郵件<input id="lkEmail" type="email" value="${esc(CLOUD_CONFIG.adminEmail || '')}" required></label>
          <label class="f">密碼（至少 10 字元，含英文與數字）<input id="lkPw" type="password" autocomplete="new-password" required></label><label class="f">再輸入一次<input id="lkPw2" type="password" autocomplete="new-password" required></label>
          <p class="small" style="color:var(--warn)">主任密碼是整個機構資料的鑰匙之一。請另外抄寫保存「緊急復原碼」（建立後會顯示）。</p><button class="btn pri" style="width:100%">建立機構</button></form>`,
      };
      this.shell(tabs + forms[tab]);
      $$('#lock [data-lk]').forEach(b => b.onclick = () => this.loginScreen(b.dataset.lk).then(resolve));
      const fg = $('#lkForgot'); if (fg) fg.onclick = async ev => { ev.preventDefault(); const em = ($('#lkEmail').value || '').trim().toLowerCase(); if (!em) { this.msg('請先在上方填入主任信箱'); return; }
        try { await FB.sendPasswordResetEmail(this.auth, em, { url: location.origin + location.pathname }); this.msg('已寄出重設信。請點信中連結，再輸入保險櫃裡的緊急復原碼與新密碼。', true); } catch (x) { this.msg(this.errText(x)); } };
      $('#lkForm').onsubmit = async e => {
        e.preventDefault(); const btn = $('#lkForm button'); btn.disabled = true; this.msg('處理中…', true);
        try { await this['do_' + tab](); } catch (err) { console.error(err); this.msg(this.errText(err)); }
        btn.disabled = false;
      };
    });
  },
  errText(e) {
    const c = e && e.code || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return '帳號或密碼錯誤';
    if (/too-many-requests/.test(c)) return '嘗試次數過多，帳號暫時鎖定，請稍後再試';
    if (/email-already-in-use/.test(c)) return '這個信箱已經有帳號，請直接登入';
    if (/network-request-failed/.test(c)) return '無法連線到伺服器';
    if (/permission-denied/.test(c)) return '沒有權限（帳號可能已停用，或邀請已失效）';
    if (/invalid-verification-code|invalid-mfa/.test(c)) return '驗證碼錯誤';
    return e && e.message || String(e);
  },
  async finish(dek, profile) {
    Store.key = dek; this.profile = profile; this.user = this.auth.currentUser;
    // 本機快取：用 DEK 加密，並保存一份被包起來的 DEK 供網路中斷時離線解鎖
    await Store.rawSet('__cloud', JSON.stringify({ uid: this.user ? this.user.uid : profile.uid, email: profile.email, wrapped: profile.wrapped, name: profile.name, role: profile.role, check: await Store.enc('ok') }));
    $('#lock') && $('#lock').remove();
    this._resolve && this._resolve();
  },
  async do_login() {
    const email = $('#lkEmail').value.trim().toLowerCase(), pass = $('#lkPw').value;
    let cred;
    try { await FB.setPersistence(this.auth, FB.browserSessionPersistence); cred = await FB.signInWithEmailAndPassword(this.auth, email, await this.authPw(email, pass)); }
    catch (e) {
      if (e.code === 'auth/multi-factor-auth-required') { cred = await this.mfaChallenge(e); if (!cred) return; }
      else if (e.code === 'auth/network-request-failed') return this.offlineUnlock(email, pass);
      else throw e;
    }
    const snap = await FB.getDoc(FB.doc(this.db, 'users', cred.user.uid));
    if (!snap.exists()) throw new Error('找不到員工資料，請洽機構主任');
    const p = snap.data(); if (!p.active) { await FB.signOut(this.auth); throw new Error('此帳號已停用'); }
    const dek = await this.unwrap(p.wrapped, pass); this._dek = dek;
    if (CLOUD_CONFIG.requireMfa && !FB.multiFactor(cred.user).enrolledFactors.length) return this.mfaEnroll();
    await this.audit('登入');
    await this.finish(dek, Object.assign({ uid: cred.user.uid }, p));
  },
  async offlineUnlock(email, pass) {
    const c = await Store.rawGet('__cloud'); if (!c) throw new Error('無法連線，且這台裝置沒有離線資料');
    const o = JSON.parse(c); if (o.email !== email) throw new Error('無法連線；離線時只能用最後一次在這台裝置登入的帳號');
    let dek; try { dek = await this.unwrap(o.wrapped, pass); } catch (e) { throw new Error('密碼錯誤'); }
    toast('目前離線：可以照常紀錄，恢復連線並重新登入後會自動上傳', 'bad');
    await this.finish(dek, Object.assign({ uid: o.uid, email: o.email }, o)); this.user = null;
  },
  async mfaChallenge(err) {
    const resolver = FB.getMultiFactorResolver(this.auth, err);
    const hint = resolver.hints.find(h => h.factorId === FB.TotpMultiFactorGenerator.FACTOR_ID) || resolver.hints[0];
    this.shell(`<h2 style="margin-top:0">兩步驟驗證</h2><p class="small">請打開手機的驗證 App（Google Authenticator 等），輸入 6 位數驗證碼。</p><form id="mfaForm"><label class="f">驗證碼<input id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label><button class="btn pri" style="width:100%">驗證</button></form>`);
    return new Promise(res => {
      $('#mfaForm').onsubmit = async e => {
        e.preventDefault();
        try { const a = FB.TotpMultiFactorGenerator.assertionForSignIn(hint.uid, $('#mfaCode').value.trim()); res(await resolver.resolveSignIn(a)); }
        catch (x) { this.msg(this.errText(x)); }
      };
    });
  },
  async do_setup() {
    const email = $('#lkEmail').value.trim().toLowerCase(), pass = $('#lkPw').value, name = $('#lkName').value.trim(), org = $('#lkOrg').value.trim();
    if (pass !== $('#lkPw2').value) throw new Error('兩次密碼不一致');
    const bad = this.pwProblem(pass); if (bad) throw new Error(bad);
    if (CLOUD_CONFIG.adminEmail && email !== CLOUD_CONFIG.adminEmail.toLowerCase()) throw new Error('只有設定檔指定的主任信箱可以建立機構');
    await FB.setPersistence(this.auth, FB.browserSessionPersistence);
    const cred = await FB.createUserWithEmailAndPassword(this.auth, email, await this.authPw(email, pass));
    const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); this._dek = dek;
    const recovery = this.newCode() + '-' + this.newCode().slice(0, 9);
    const profile = { email, name, role: '機構主任', active: true, wrapped: await this.wrap(dek, pass), mfa: false, created: FB.serverTimestamp() };
    const b = FB.writeBatch(this.db);
    b.set(FB.doc(this.db, 'users', cred.user.uid), profile);
    b.set(FB.doc(this.db, 'facility', 'meta'), { org, created: FB.serverTimestamp(), by: cred.user.uid, recovery: await this.wrap(dek, recovery), recoveryHash: await this.sha256hex(recovery) });
    await b.commit();
    this.shell(`<h2 style="margin-top:0">機構建立完成</h2><p>這是<b>緊急復原碼</b>。如果主任忘記密碼且沒有其他主任帳號，只能用它救回資料。請抄在紙上，放進保險櫃，<b>不要拍照、不要存在電腦</b>。</p>
      <div class="narr" style="font-size:18px;letter-spacing:1px;text-align:center">${recovery}</div><label class="checks" style="margin-top:10px"><input type="checkbox" id="rcOk"> 我已經抄寫並妥善保存</label><button class="btn pri" id="rcGo" style="width:100%" disabled>繼續</button>`);
    $('#rcOk').onchange = e => $('#rcGo').disabled = !e.target.checked;
    await new Promise(r => $('#rcGo').onclick = r);
    DB.settings.org = org;
    this.created = { org };
    if (CLOUD_CONFIG.requireMfa) { this.profile = Object.assign({ uid: cred.user.uid }, profile); return this.mfaEnroll(); }
    await this.finish(dek, Object.assign({ uid: cred.user.uid }, profile));
    await this.audit('建立機構');
  },
  async do_invite() {
    const email = $('#lkEmail').value.trim().toLowerCase(), code = $('#lkCode').value.trim().toUpperCase(), pass = $('#lkPw').value;
    if (pass !== $('#lkPw2').value) throw new Error('兩次密碼不一致');
    const bad = this.pwProblem(pass); if (bad) throw new Error(bad);
    await FB.setPersistence(this.auth, FB.browserSessionPersistence);
    const ap = await this.authPw(email, pass); let cred;
    try { cred = await FB.createUserWithEmailAndPassword(this.auth, email, ap); }
    catch (e) {
      if (e.code !== 'auth/email-already-in-use') throw e;
      // 上次輸入錯的邀請碼時帳號已建立：用同一組密碼登入後繼續
      try { cred = await FB.signInWithEmailAndPassword(this.auth, email, ap); }
      catch (x) { throw new Error('這個信箱已經有帳號。若是你第一次輸入邀請碼失敗，請用當時設定的密碼；否則請主任到 Firebase 後台刪除該帳號後重新邀請。'); }
      if ((await FB.getDoc(FB.doc(this.db, 'users', cred.user.uid))).exists()) throw new Error('這個帳號已完成設定，請直接登入');
    }
    const inv = await FB.getDoc(FB.doc(this.db, 'invites', email));
    if (!inv.exists()) throw new Error('找不到這個信箱的邀請，請洽機構主任');
    const I = inv.data(); let dek;
    try { dek = await this.unwrap(I.wrapped, code); } catch (e) { throw new Error('邀請碼錯誤'); } this._dek = dek;
    const profile = { email, name: I.name, role: I.role, active: true, wrapped: await this.wrap(dek, pass), mfa: false, inviteCode: code, created: FB.serverTimestamp() };
    await FB.setDoc(FB.doc(this.db, 'users', cred.user.uid), profile);
    await FB.updateDoc(FB.doc(this.db, 'users', cred.user.uid), { inviteCode: '' });
    await FB.deleteDoc(FB.doc(this.db, 'invites', email));
    await this.audit('接受邀請建立帳號');
    if (CLOUD_CONFIG.requireMfa) { this.profile = Object.assign({ uid: cred.user.uid }, profile); return this.mfaEnroll(); }
    await this.finish(dek, Object.assign({ uid: cred.user.uid }, profile));
  },
  async resetScreen(oob) {
    return new Promise(resolve => {
      this._resolve = resolve;
      this.shell(`<h2 style="margin-top:0">重設密碼</h2><form id="lkForm"><label class="f">主任給你的重設碼（主任本人請輸入緊急復原碼）<input id="lkCode" required style="text-transform:uppercase" autocomplete="off"></label><label class="f">新密碼（至少 10 字元，含英文與數字）<input id="lkPw" type="password" autocomplete="new-password" required></label><label class="f">再輸入一次<input id="lkPw2" type="password" required></label><button class="btn pri" style="width:100%">重設並登入</button></form>`);
      $('#lkForm').onsubmit = async e => {
        e.preventDefault();
        try {
          const code = $('#lkCode').value.trim().toUpperCase(), pass = $('#lkPw').value;
          if (pass !== $('#lkPw2').value) throw new Error('兩次密碼不一致'); const bad = this.pwProblem(pass); if (bad) throw new Error(bad);
          const email = (await FB.verifyPasswordResetCode(this.auth, oob)).toLowerCase();
          await FB.confirmPasswordReset(this.auth, oob, await this.authPw(email, pass));
          await FB.setPersistence(this.auth, FB.browserSessionPersistence);
          let cred; try { cred = await FB.signInWithEmailAndPassword(this.auth, email, await this.authPw(email, pass)); } catch (x) { if (x.code === 'auth/multi-factor-auth-required') cred = await this.mfaChallenge(x); else throw x; }
          const I = (await FB.getDoc(FB.doc(this.db, 'invites', email)).catch(() => null))?.data();
          let dek;
          if (I && I.type === 'reset') { try { dek = await this.unwrap(I.wrapped, code); } catch (x) { throw new Error('重設碼錯誤'); } }
          else { const M = (await FB.getDoc(FB.doc(this.db, 'facility', 'meta'))).data(); try { dek = await this.unwrap(M.recovery, code); } catch (x) { throw new Error('重設碼或緊急復原碼錯誤'); } }
          this._dek = dek; const w = await this.wrap(dek, pass);
          await FB.updateDoc(FB.doc(this.db, 'users', cred.user.uid), { wrapped: w, resetCode: code });
          await FB.updateDoc(FB.doc(this.db, 'users', cred.user.uid), { resetCode: '' });
          if (I) await FB.deleteDoc(FB.doc(this.db, 'invites', email));
          history.replaceState(null, '', location.pathname);
          const p = (await FB.getDoc(FB.doc(this.db, 'users', cred.user.uid))).data();
          await this.audit('重設密碼'); await this.finish(dek, Object.assign({ uid: cred.user.uid }, p));
        } catch (x) { console.error(x); this.msg(this.errText(x)); }
      };
    });
  },

  /* --- 兩步驟驗證（TOTP） --- */
  async mfaEnroll() {
    const u = this.auth.currentUser; if (!u) return;
    this.profile = this.profile || {};
    const email = u.email;
    let secret;
    try { const ses = await FB.multiFactor(u).getSession(); secret = await FB.TotpMultiFactorGenerator.generateSecret(ses); }
    catch (e) {
      this.shell(`<h2 style="margin-top:0">需要設定兩步驟驗證</h2><p class="small">系統要求每位員工啟用兩步驟驗證，但目前無法產生驗證金鑰（${esc(e.code || e.message)}）。請主任確認 Firebase 後台已開啟 TOTP 多重要素驗證（設定步驟 6）。</p><button class="btn pri" id="mfaBack" style="width:100%">回登入頁</button>`);
      $('#mfaBack').onclick = () => this.lockOut(); return;
    }
    const url = secret.generateQrCodeUrl(email, CLOUD_CONFIG.org || 'LTC');
    const qr = FB.qrcode(0, 'M'); qr.addData(url); qr.make();
    this.shell(`<h2 style="margin-top:0">設定兩步驟驗證（必要）</h2><p class="small">1. 手機安裝「Google Authenticator」或「Microsoft Authenticator」。<br>2. 用 App 掃描 QR 碼（或手動輸入金鑰）。<br>3. 輸入 App 顯示的 6 位數字。</p>
      <div style="text-align:center;background:#fff;padding:10px;border-radius:8px">${qr.createSvgTag({ cellSize: 4, margin: 2 })}</div><p class="small muted" style="word-break:break-all">金鑰：${esc(secret.secretKey)}</p>
      <form id="mfaForm"><label class="f">6 位數驗證碼<input id="mfaNew" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label><button class="btn pri" style="width:100%">啟用並重新登入</button></form>`);
    $('#mfaForm').onsubmit = async e => {
      e.preventDefault();
      try {
        await FB.multiFactor(u).enroll(FB.TotpMultiFactorGenerator.assertionForEnrollment(secret, $('#mfaNew').value.trim()), '驗證 App');
        await FB.updateDoc(FB.doc(this.db, 'users', u.uid), { mfa: true }); await this.audit('啟用兩步驟驗證');
        await FB.signOut(this.auth);
        this.loginScreen('login'); this.msg('已啟用兩步驟驗證，請重新登入並輸入驗證碼', true);
      } catch (x) { this.msg(this.errText(x)); }
    };
  },

  /* --- 同步：本機 IndexedDB（加密）⇄ Firestore records（加密） --- */
  SKIP_SETTINGS: ['user', 'lastBackup', 'snapDays'],
  KV: ['settings', 'quarterly', 'accred'],
  SYNC: ['residents', 'assessments', 'daily', 'weights', 'events', 'restraints', 'plans', 'contacts', 'meetings', 'vaccines', 'notes', 'photos', 'quarterly', 'accred', 'settings'],
  entries(c) {
    if (this.KV.includes(c)) return Object.entries(DB[c]).filter(([k]) => !(c === 'settings' && this.SKIP_SETTINGS.includes(k))).map(([k, v]) => [k, { k, v }]);
    return DB[c].map(x => [x.id, x]);
  },
  snapshotKnown() { this.known.clear(); this.SYNC.forEach(c => this.entries(c).forEach(([id, v]) => this.known.set(c + '__' + id, JSON.stringify(v)))); },
  diff(colls) {
    for (const c of colls) {
      if (!this.SYNC.includes(c)) continue;
      const seen = new Set();
      for (const [id, v] of this.entries(c)) { const k = c + '__' + id, j = JSON.stringify(v); seen.add(k); if (this.known.get(k) !== j) { this.known.set(k, j); this.pending.add(k); } }
      for (const k of [...this.known.keys()]) if (k.startsWith(c + '__') && !seen.has(k)) { this.known.delete(k); this.pending.add(k); }
    }
    this.savePending(); this.pushPending();
  },
  async savePending() { await Store.rawSet('__pending', JSON.stringify([...this.pending])); },
  async pushPending() {
    if (!this.user || !this.online || this._pushing || this.blocked || !this.pending.size) { this.setStatus(); return; }
    this._pushing = true; this.setStatus();
    try {
      const keys = [...this.pending].slice(0, 400), b = FB.writeBatch(this.db);
      for (const k of keys) {
        const j = this.known.get(k), c = k.split('__')[0];
        b.set(FB.doc(this.db, 'records', k), j === undefined ? { c, del: true, d: '', u: FB.serverTimestamp(), by: this.user.uid } : { c, del: false, d: await Store.enc(j), u: FB.serverTimestamp(), by: this.user.uid });
      }
      await b.commit();
      keys.forEach(k => this.pending.delete(k)); await this.savePending();
      this._fail = 0;
    } catch (e) {
      console.error('push', e);
      if (/permission|unauthenticated/.test(e.code)) { this._pushing = false; this.blocked = true; this.setStatus(); toast('雲端拒絕寫入：帳號可能已被停用，已停止上傳（資料仍保存在本機）', 'bad'); return; }
      this._fail = (this._fail || 0) + 1;
    }
    this._pushing = false; this.setStatus();
    // 失敗時逐步拉長間隔（最多 5 分鐘），避免無限快速重試產生大量請求
    if (this.pending.size && this.online && !this.blocked) setTimeout(() => this.pushPending(), this._fail ? Math.min(300000, 2000 * 2 ** this._fail) : 300);
  },
  async startPull() {
    if (!this.user) return;
    const meta = JSON.parse((await Store.rawGet('__sync')) || '{}');
    let since = meta.last ? FB.Timestamp.fromMillis(meta.last - 60000) : FB.Timestamp.fromMillis(0);
    const q = FB.query(FB.collection(this.db, 'records'), FB.where('u', '>', since));
    this.unsub = FB.onSnapshot(q, async snap => {
      let changed = 0, maxU = meta.last || 0;
      for (const ch of snap.docChanges()) {
        const d = ch.doc.data(); if (!d.u) continue; // 自己剛寫、伺服器時間尚未回填
        maxU = Math.max(maxU, d.u.toMillis());
        const k = ch.doc.id, [c, id] = [k.slice(0, k.indexOf('__')), k.slice(k.indexOf('__') + 2)];
        if (!this.SYNC.includes(c) || this.pending.has(k)) continue;
        let val = null; if (!d.del) { try { val = JSON.parse(await Store.dec(d.d)); } catch (e) { console.warn('無法解密', k); continue; } }
        const j = val === null ? undefined : JSON.stringify(val);
        if (this.known.get(k) === j) continue;
        if (this.KV.includes(c)) { if (val === null) delete DB[c][id]; else DB[c][val.k] = val.v; }
        else { const i = DB[c].findIndex(x => x.id === id); if (val === null) { if (i >= 0) DB[c].splice(i, 1); } else if (i >= 0) DB[c][i] = val; else DB[c].push(val); }
        if (j === undefined) this.known.delete(k); else this.known.set(k, j);
        Store.dirty.add(c); changed++;
      }
      meta.last = maxU; await Store.rawSet('__sync', JSON.stringify(meta));
      if (changed) { this.pulling = true; await Store.flush(); this.pulling = false; this.softRefresh(changed); }
      this.setStatus();
    }, e => { console.error('pull', e); this.setStatus(); if (/permission/.test(e.code)) toast('雲端拒絕讀取：帳號可能已被停用', 'bad'); });
  },
  softRefresh(n) {
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ($('#modal.on') || typing) { this._needRefresh = true; toast(`其他同仁更新了 ${n} 筆資料`); return; }
    refresh(); updateBrand();
  },
  async afterFlush(list) { if (this.pulling) return; this.diff(list); },

  /* --- 照片：加密後存 Cloud Storage --- */
  async uploadPhoto(id, encStr) { if (!this.user) return; try { await FB.uploadString(FB.ref(this.st, 'photos/' + id), encStr, 'raw', { contentType: 'text/plain' }); } catch (e) { console.error('upload', e); } },
  async downloadPhoto(id) { if (!this.user) return null; try { return new TextDecoder().decode(await FB.getBytes(FB.ref(this.st, 'photos/' + id))); } catch (e) { return null; } },
  async deletePhoto(id) { if (!this.user) return; try { await FB.deleteObject(FB.ref(this.st, 'photos/' + id)); } catch (e) {} },

  /* --- 稽核紀錄（雲端只可新增，不可修改刪除） --- */
  async encWith(str) { if (Store.key) return Store.enc(str); if (!this._dek) return ''; Store.key = this._dek; try { return await Store.enc(str); } finally { Store.key = null; } },
  async audit(action, rid) {
    if (!this.on || !this.auth || !this.auth.currentUser) return;
    try { await FB.setDoc(FB.doc(FB.collection(this.db, 'audit')), { uid: this.auth.currentUser.uid, at: FB.serverTimestamp(), d: await this.encWith(JSON.stringify({ action, rid: rid || '' })) }); } catch (e) { console.warn('audit', e); }
  },
  async auditList() {
    const s = await FB.getDocs(FB.query(FB.collection(this.db, 'audit'), FB.orderBy('at', 'desc'), FB.limit(200)));
    const users = await this.users(); const out = [];
    for (const d of s.docs) { const x = d.data(); let a = {}; try { a = JSON.parse(await Store.dec(x.d)); } catch (e) {} out.push({ at: x.at ? x.at.toDate() : null, user: (users.find(u => u.uid === x.uid) || {}).name || x.uid, action: a.action || '', rid: a.rid }); }
    return out;
  },

  /* --- 帳號管理（主任） --- */
  async users() { const s = await FB.getDocs(FB.collection(this.db, 'users')); return s.docs.map(d => Object.assign({ uid: d.id }, d.data())); },
  async invites() { const s = await FB.getDocs(FB.collection(this.db, 'invites')); return s.docs.map(d => Object.assign({ email: d.id }, d.data())); },
  async createInvite(email, name, role, type = 'invite') {
    email = email.trim().toLowerCase(); const code = this.newCode();
    await FB.setDoc(FB.doc(this.db, 'invites', email), { name, role, type, wrapped: await this.wrap(Store.key, code), codeHash: await this.sha256hex(code), by: this.user.uid, created: FB.serverTimestamp() });
    await this.audit(`${type === 'reset' ? '產生密碼重設碼' : '邀請員工'}：${name}（${role}）`);
    return code;
  },
  async lockOut() { if (this.unsub) this.unsub(); try { await this.audit('登出'); await FB.signOut(this.auth); } catch (e) {} location.reload(); },
};

/* 帳號管理頁 */
ROUTES.accounts = () => {
  if (!Cloud.on) return '<div class="empty">本機版沒有帳號管理</div>';
  if (!Cloud.isAdmin()) return '<div class="empty">只有機構主任可以管理帳號</div>';
  return `<div class="hd"><div><h1>帳號與資安</h1><p class="sub">每位員工一個帳號。邀請碼、重設碼請<b>當面</b>交給本人，不要用 LINE 或簡訊傳送。</p></div><span class="sp"></span><button class="btn pri" data-act="cInvite">＋ 邀請員工</button></div>
  <div class="card" id="accList"><div class="empty">載入中…</div></div>
  <div class="card"><h2 style="margin-top:0">登入與調閱紀錄（雲端，無法修改或刪除）</h2><div id="auditList" class="small muted">載入中…</div></div>`;
};
ROUTES.after_accounts = async () => {
  if (!Cloud.isAdmin() || !Cloud.user) { const a = $('#accList'); if (a && Cloud.isAdmin()) a.innerHTML = '<div class="empty">目前離線，無法管理帳號</div>'; return; }
  const [us, inv] = await Promise.all([Cloud.users(), Cloud.invites()]);
  $('#accList').innerHTML = `<table class="t"><tr><th>姓名</th><th>信箱</th><th>職類</th><th>兩步驟驗證</th><th>狀態</th><th></th></tr>
    ${us.map(u => `<tr><td class="nowrap">${esc(u.name)}</td><td class="small">${esc(u.email)}</td><td><select data-role="${u.uid}" ${u.uid === Cloud.user.uid ? 'disabled' : ''} style="padding:4px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)">${ROLES.concat(['系統管理員']).map(r => `<option${r === u.role ? ' selected' : ''}>${r}</option>`).join('')}</select></td>
      <td>${u.mfa ? '<span class="chip ok">已啟用</span>' : '<span class="chip warn">未啟用</span>'}</td><td>${u.active ? '<span class="chip ok">啟用中</span>' : '<span class="chip bad">已停用</span>'}</td>
      <td class="nowrap">${u.uid === Cloud.user.uid ? '<span class="small muted">（你）</span>' : `<button class="btn sm" data-act="cToggle" data-uid="${u.uid}" data-on="${u.active ? 1 : 0}">${u.active ? '停用' : '啟用'}</button><button class="btn sm" data-act="cReset" data-email="${esc(u.email)}" data-name="${esc(u.name)}" data-role="${esc(u.role)}">重設密碼</button>`}</td></tr>`).join('')}
    ${inv.map(i => `<tr><td class="nowrap">${esc(i.name)}</td><td class="small">${esc(i.email)}</td><td>${esc(i.role)}</td><td></td><td><span class="chip info">${i.type === 'reset' ? '等待重設' : '等待接受邀請'}</span></td><td><button class="btn sm" data-act="cRevoke" data-email="${esc(i.email)}">取消</button></td></tr>`).join('')}</table>
    <p class="small muted">員工離職：按「停用」立即生效，該帳號無法再讀寫任何資料。</p>`;
  $$('[data-role]').forEach(s => s.onchange = async () => { await FB.updateDoc(FB.doc(Cloud.db, 'users', s.dataset.role), { role: s.value }); await Cloud.audit('變更職類為 ' + s.value); toast('已變更職類'); });
  const al = await Cloud.auditList();
  $('#auditList').innerHTML = al.length ? `<table class="t">${al.map(a => `<tr><td class="nowrap">${a.at ? a.at.toLocaleString() : ''}</td><td>${esc(a.user)}</td><td>${esc(a.action)}${a.rid && resById(a.rid) ? '：' + esc(resLabel(resById(a.rid))) : ''}</td></tr>`).join('')}</table>` : '尚無紀錄';
};
ACT.cInvite = () => {
  const F = [{ key: 'email', label: '員工電子郵件', type: 'email', req: true }, { key: 'name', label: '姓名', req: true }, { key: 'role', label: '職類', type: 'select', options: ROLES.concat(['系統管理員']), req: true }];
  openModal('邀請員工', formHTML(F, {}), () => {
    const o = readForm(F); if (!o) return false;
    Cloud.createInvite(o.email, o.name, o.role).then(code => showCode('邀請碼', code, `請當面交給 ${o.name}。對方打開系統，選「我有邀請碼」，輸入信箱、邀請碼並設定自己的密碼。`));
  });
};
ACT.cReset = el => confirmBox(`為 ${esc(el.dataset.name)} 產生重設碼，並寄送重設連結到 ${esc(el.dataset.email)}？`, async () => {
  const code = await Cloud.createInvite(el.dataset.email, el.dataset.name, el.dataset.role, 'reset');
  try { await FB.sendPasswordResetEmail(Cloud.auth, el.dataset.email, { url: location.origin + location.pathname }); } catch (e) { toast('寄信失敗：' + Cloud.errText(e), 'bad'); }
  showCode('密碼重設碼', code, `請當面交給 ${el.dataset.name}。對方點信箱裡的重設連結後，輸入這組重設碼與新密碼。`);
}, '產生');
ACT.cToggle = el => confirmBox(el.dataset.on === '1' ? '停用後此帳號立即無法讀寫任何資料，確定？' : '重新啟用此帳號？', async () => { await FB.updateDoc(FB.doc(Cloud.db, 'users', el.dataset.uid), { active: el.dataset.on !== '1' }); await Cloud.audit(el.dataset.on === '1' ? '停用帳號' : '啟用帳號'); toast('已更新'); });
ACT.cRevoke = el => confirmBox('取消這個邀請／重設？', async () => { await FB.deleteDoc(FB.doc(Cloud.db, 'invites', el.dataset.email)); toast('已取消'); });
ACT.cLogout = () => Cloud.lockOut();
ACT.cMfa = () => Cloud.mfaEnroll(false);
function showCode(title, code, note) { setTimeout(() => openModal(title, `<div class="narr" style="font-size:20px;letter-spacing:1px;text-align:center">${code}</div><p class="small">${esc(note)}</p><p class="small" style="color:var(--warn)">這組碼只會顯示這一次。</p>`, null), 50); }
