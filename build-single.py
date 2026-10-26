#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
index.html → સંપૂર્ણ એક-ફાઇલ (single-file) બિલ્ડ
------------------------------------------------
કેમ જરૂરી: GitHub પર ઘણી વાર ફક્ત index.html અપલોડ થાય છે અને vendor/ ફોલ્ડર
(આઇકોન ફોન્ટ, ગુજરાતી ફોન્ટ, PDF/QR લાઇબ્રેરી) સાથે જતું નથી → આઇકોન ખાલી
ચોરસ દેખાય, PDF બને નહીં. આ સ્ક્રિપ્ટ બધું જ ફાઇલની અંદર base64/ટેક્સ્ટ તરીકે
ભરી દે છે — પછી ફક્ત એક જ ફાઇલ અપલોડ કરો તો પણ બધું ચાલે (ઑફલાઇન પણ).

વાપરવું:  python3 build-single.py  →  out/index.html
"""
import base64, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'index.html'
OUTDIR = ROOT / 'github-upload'
OUT = OUTDIR / 'index.html'

MIME = {
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript',
}


def data_uri(path: pathlib.Path) -> str:
    mime = MIME.get(path.suffix.lower(), 'application/octet-stream')
    b64 = base64.b64encode(path.read_bytes()).decode('ascii')
    return 'data:%s;base64,%s' % (mime, b64)


# ફોન્ટની કઈ લિપિ રાખવી — બાકીની (સિરિલિક, ગ્રીક, વિયેતનામી…) કાઢી નાખવાથી
# ફાઇલ 4 MB ને બદલે ~3 MB નાની થાય, દેખાવમાં કોઈ ફરક નહીં
KEEP_SUBSETS = {'latin', 'gujarati', 'math', 'symbols', 'devanagari'}


def trim_font_faces(css: str) -> str:
    """Google Fonts CSS સાફ કરો:
    1) બિનજરૂરી લિપિના (સિરિલિક, ગ્રીક, વિયેતનામી) બ્લોક કાઢી નાખો
    2) એક જ ફોન્ટ-ફાઇલ પર ચાલતા અલગ-અલગ વજનના બ્લોક એકમાં ભેગા કરો
       (variable font હોવાથી `font-weight: 400 800` ચાલે) — ફાઇલ 5 વાર
       ભરાઈને ફૂલી ન જાય."""
    pattern = re.compile(r'/\*\s*([a-z-]+)\s*\*/\s*@font-face\s*\{([^}]*)\}', re.S)
    groups, dropped = {}, 0
    order = []
    for m in pattern.finditer(css):
        sub, body = m.group(1), m.group(2)
        if sub not in KEEP_SUBSETS:
            dropped += 1
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        style = (re.search(r'font-style:\s*([^;]+);', body) or [None, 'normal'])[1].strip()
        weight = float((re.search(r'font-weight:\s*([0-9.]+);', body) or [None, '400'])[1])
        url = re.search(r'url\(([^)]+)\)', body).group(1).strip()
        ur = (re.search(r'unicode-range:\s*([^;]+);', body) or [None, ''])[1].strip()
        key = (fam, style, url)
        if key not in groups:
            groups[key] = {'w': [], 'ur': [], 'sub': sub}
            order.append(key)
        groups[key]['w'].append(weight)
        if ur and ur not in groups[key]['ur']:
            groups[key]['ur'].append(ur)
    out = []
    for key in order:
        fam, style, url = key
        g = groups[key]
        ws = sorted(set(g['w']))
        wspec = ('%g %g' % (ws[0], ws[-1])) if len(ws) > 1 else ('%g' % ws[0])
        out.append(
            "@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;"
            "src:url(%s) format('woff2');%s}"
            % (fam, style, wspec, url,
               ('unicode-range:%s;' % ', '.join(g['ur'])) if g['ur'] else ''))
    if not out:
        # પહેલેથી ટ્રિમ થયેલી CSS (subset કોમેન્ટ વગરની) — એને જેમ છે તેમ રાખો,
        # નહીં તો બધા @font-face કપાઈ જાય અને ગુજરાતી અક્ષરો ખાલી ડબ્બા દેખાય.
        print('  ફોન્ટ: CSS પહેલેથી ટ્રિમ છે — જેમ છે તેમ રખાઈ (%d બ્લોક)' % css.count('@font-face'))
        return css
    print('  ફોન્ટ: %d બ્લોક રાખ્યા (%d માંથી), %d બિનજરૂરી કાઢ્યા'
          % (len(out), len(out) + dropped, dropped))
    return '\n'.join(out)


def inline_css(css_path: pathlib.Path) -> str:
    """CSS ની અંદરની બધી url(...) ફાઇલોને data URI બનાવો."""
    css = css_path.read_text(encoding='utf-8')
    if css_path.name == 'fonts.css':
        css = trim_font_faces(css)
    base = css_path.parent

    def rep(m):
        raw = m.group(1).strip().strip('"').strip("'")
        if raw.startswith(('data:', 'http:', 'https:', '#', 'about:')):
            return 'url(%s)' % raw
        f = (base / raw.split('?')[0].split('#')[0]).resolve()
        if f.is_file():
            return "url('%s')" % data_uri(f)
        print('  ⚠ મળી નહીં:', raw)
        return m.group(0)

    return re.sub(r'url\(([^)]+)\)', rep, css)


def main() -> int:
    html = SRC.read_text(encoding='utf-8')
    report = []

    # 1) સ્ટાઇલશીટ → <style> (ફોન્ટ સહિત)
    for href in ('vendor/fontawesome/all.min.css', 'vendor/fonts/fonts.css'):
        tag = '<link rel="stylesheet" href="%s">' % href
        if tag not in html:
            print('⚠ ટૅગ મળ્યો નહીં:', tag)
            continue
        css = inline_css(ROOT / href)
        html = html.replace(tag, '<style>/* %s (inline) */\n%s\n</style>' % (href, css), 1)
        report.append('CSS inline: %s (%d B)' % (href, len(css)))

    # 2) સ્ક્રિપ્ટ → <script> (PDF / QR / html2canvas)
    for m in list(re.finditer(r'<script src="(vendor/js/[^"]+)"\s*></script>', html)):
        src = m.group(1)
        js = (ROOT / src).read_text(encoding='utf-8')
        if '</script' in js.lower():
            print('✗ %s માં </script> છે — inline ન કરી શકાય' % src)
            continue
        html = html.replace(m.group(0), '<script>/* %s (inline) */\n%s\n</script>' % (src, js), 1)
        report.append('JS inline: %s (%d B)' % (src, len(js)))

    # 3) આઇકોન / લોગો / મેનિફેસ્ટ ઇમેજ → data URI
    for m in list(re.finditer(r'(icons/[A-Za-z0-9._-]+\.(?:png|svg|jpg))', html)):
        rel = m.group(1)
        f = ROOT / rel
        if f.is_file():
            html = html.replace(rel, data_uri(f))
            report.append('ઇમેજ inline: %s' % rel)
    svg_icon = ROOT / 'icon.svg'
    if svg_icon.is_file() and 'href="icon.svg"' in html:
        html = html.replace('href="icon.svg"', 'href="%s"' % data_uri(svg_icon), 1)
        report.append('favicon inline: icon.svg')

    # 4) ઑફલાઇન મેનિફેસ્ટ → data URI (ફોલ્ડર વગર પણ PWA માહિતી મળે)
    mf = ROOT / 'manifest.json'
    if mf.is_file() and 'href="manifest.json"' in html:
        mf_txt = mf.read_text(encoding='utf-8')
        for icon in re.findall(r'"src"\s*:\s*"([^"]+)"', mf_txt):
            p = ROOT / icon
            if p.is_file():
                mf_txt = mf_txt.replace('"%s"' % icon, '"%s"' % data_uri(p))
        html = html.replace('href="manifest.json"', 'href="%s"' % data_uri_text(mf_txt), 1)
        report.append('manifest inline')

    # 5) sync-config.json અને version.json → એચટીએમએલમાં જ ભરો
    #    (ફોલ્ડરમાં એ ફાઇલો ન હોય તો 404 ન આવે, ક્લાઉડ સેટિંગ/અપડેટ તપાસ શાંતિથી ચાલે)
    sc = ROOT / 'sync-config.json'
    if sc.is_file():
        blk = ('<script type="application/json" id="aymSyncConfig">%s</script>'
               % sc.read_text(encoding='utf-8').replace('</', '<\\/'))
        i = html.rfind('</body>')          # છેલ્લું જ — JS સ્ટ્રિંગમાં આવતું </body> નહીં
        html = html[:i] + blk + '\n' + html[i:]
        old_cfg = "fetch('./sync-config.json', { cache: 'no-store' })"
        new_cfg = ("Promise.resolve((function(){try{var el=document.getElementById('aymSyncConfig');"
                   "return el?JSON.parse(el.textContent):null}catch(e){return null}})())")
        if old_cfg in html:
            html = html.replace(old_cfg, new_cfg, 1)
            report.append('sync-config.json inline')
        else:
            print('⚠ sync-config fetch ન મળ્યું — જાતે તપાસો')

    vj = ROOT / 'version.json'
    if vj.is_file():
        blk = ('<script type="application/json" id="aymVersionJson">%s</script>'
               % vj.read_text(encoding='utf-8').replace('</', '<\\/'))
        i = html.find('<script type="application/json" id="aymSyncConfig">')
        html = html[:i] + blk + '\n' + html[i:]
        # વ્યર્થ 404 ટાળવા: version.json ફોલ્ડરમાં ન હોય તો fetch data-URI પર જાય
        old_default = "if (!u) u = './version.json';"
        new_default = ("if (!u) u = document.getElementById('aymVersionJson')"
                       " ? 'data:application/json;base64,' + btoa(unescape(encodeURIComponent("
                       "document.getElementById('aymVersionJson').textContent))) : './version.json';")
        if old_default in html:
            html = html.replace(old_default, new_default, 1)
            report.append('version.json → ડેટા-લિંક (404 નહીં)')
        old_fetch = ("return fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), "
                     "{ cache: 'no-store' })")
        # એક જ ફાઇલમાં ચાલે ત્યારે version.json બહાર ન હોય — અંદરની નકલ વાપરો
        new_fetch = (old_fetch +
                     "\n      .catch(function (err) { return { ok: false, __err: err }; })"
                     "\n      .then(function (r) {"
                     "\n        if (r && r.ok) return r;"
                     "\n        var el = document.getElementById('aymVersionJson');"
                     "\n        if (el) return { ok: true, json: function () { return JSON.parse(el.textContent); } };"
                     "\n        if (r && r.__err) throw r.__err;"
                     "\n        return r; })")
        if old_fetch in html:
            html = html.replace(old_fetch, new_fetch, 1)
            report.append('version.json inline (fallback)')
        else:
            print('⚠ version.json fetch ન મળ્યું — જાતે તપાસો')

    OUTDIR.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')

    left = [x for x in ('vendor/', 'icons/') if x in html]
    print('\n'.join(report))
    print('\n✅ %s — %.2f MB' % (OUT, OUT.stat().st_size / 1024 / 1024))
    if left:
        print('⚠ હજુ બહારની લિંક બાકી:', left)
        return 1
    print('✅ કોઈ બહારની ફાઇલ પર આધાર નથી (સિવાય sw.js / version.json — ઑફલાઇન+ઓટો-અપડેટ માટે વૈકલ્પિક)')
    return 0


def data_uri_text(text: str) -> str:
    b64 = base64.b64encode(text.encode('utf-8')).decode('ascii')
    return 'data:application/json;base64,' + b64


if __name__ == '__main__':
    sys.exit(main())
