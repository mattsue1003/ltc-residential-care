#!/usr/bin/env python3
"""把 src/ 合併成單一離線 HTML：dist/長照照護紀錄系統.html"""
import pathlib
ROOT = pathlib.Path(__file__).parent
S = ROOT / 'src'
JS = ['scales.js', 'indicators.js', 'store.js', 'logic.js', 'ui.js', 'pages_main.js', 'pages_care.js', 'pages_qa.js', 'print.js', 'storage.js', 'cloud.js', 'templates.js', 'pages_extra.js', 'demo.js', 'main.js']
css = (S / 'styles.css').read_text()
js = '\n'.join(f'/* ---- {f} ---- */\n' + (S / f).read_text() for f in JS)
html = f'''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">
<title>長照照護紀錄系統</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23028090'/%3E%3Cpath d='M9 17l5 5 9-11' stroke='white' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<style>{css}</style></head>
<body>
<div id="app">
  <header class="top"><div class="brand"><div class="logo">✓</div><div><span id="orgName">長照住宿機構照護系統</span><small>評估・紀錄・提醒・評鑑</small></div></div>
    <div class="search"><input id="q" placeholder="搜尋住民姓名、床號、功能（按 / ）" aria-label="搜尋"><div class="drop" id="qdrop"></div></div>
    <button class="userchip" id="userChip" data-act="switchUser">設定使用者</button></header>
  <nav class="side" aria-label="主選單"></nav>
  <main></main>
</div>
<div id="modal"></div><div id="toast" role="status" aria-live="polite"></div><div id="printArea"></div>
<script>{js}</script>
</body></html>'''
out = ROOT / 'dist'; out.mkdir(exist_ok=True)
(out / '長照照護紀錄系統.html').write_text(html)
(out / 'index.html').write_text(html)
(ROOT / 'docs').mkdir(exist_ok=True)
(ROOT / 'docs' / 'index.html').write_text(html)
print('built', len(html) // 1024, 'KB')

# ---- 雲端版：cloud/public（index.html + app.css + app.js），規則依設定產生 ----
import json, sys
cfg_name = sys.argv[1] if len(sys.argv) > 1 else None
if cfg_name:
    C = ROOT / 'cloud'
    cfg = json.loads((C / cfg_name).read_text())
    mfa = "request.auth.token.firebase.sign_in_second_factor != null" if cfg.get('requireMfa') else "true"
    (C / 'build').mkdir(exist_ok=True)
    for f in ['firestore.rules', 'storage.rules']:
        t = (C / (f + '.tmpl')).read_text().replace('__MFA__', mfa).replace('__ADMIN_EMAIL__', cfg['adminEmail'].lower())
        (C / 'build' / f).write_text(t)
    pub = C / 'public'; pub.mkdir(exist_ok=True)
    conf = 'const CLOUD_CONFIG = ' + json.dumps(cfg, ensure_ascii=False) + ';\n'
    (pub / 'app.js').write_text((S / 'vendor' / 'firebase.js').read_text() + '\n' + conf + js)
    (pub / 'app.css').write_text(css)
    emu = " http://127.0.0.1:9099 http://127.0.0.1:8080 http://127.0.0.1:9199 http://localhost:9099 http://localhost:8080 http://localhost:9199" if cfg.get('emulator') else ""
    csp = ("default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
           "connect-src 'self' https://*.googleapis.com https://firebasestorage.googleapis.com" + emu + "; frame-src https://*.firebaseapp.com; base-uri 'none'; form-action 'none'")
    page = html.split('<style>')[0].replace("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'\">",
        f'<meta http-equiv="Content-Security-Policy" content="{csp}">\n<meta name="referrer" content="no-referrer">')
    body = html.split('</style></head>')[1].split('<script>')[0]
    (pub / 'index.html').write_text(page + '<link rel="stylesheet" href="app.css"></head>' + body + '<script src="app.js"></script>\n</body></html>')
    print('cloud build', cfg_name, (pub / 'app.js').stat().st_size // 1024, 'KB')
