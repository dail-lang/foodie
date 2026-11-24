"""Genera index.html (GitHub Pages / PWA) da src/app.html e aggiorna la versione della cache in sw.js."""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
HEAD = '''
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1A221D" media="(prefers-color-scheme: dark)">
<meta name="description" content="Ricette sane, piano pasti settimanale, diario e allenamento.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Foodie">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
img{max-width:100%}
</style>'''
SW = '''
<script>
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }
</script>
'''

def main():
    src = (ROOT / 'src/app.html').read_text(encoding='utf-8')
    src = src.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    t = src.index('</title>') + len('</title>')
    body = src[t:]
    i = body.index('</style>') + len('</style>')
    html = ('<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n' + src[:t] + HEAD + body[:i]
            + '\n</head>\n<body>' + body[i:] + SW + '</body>\n</html>\n')
    (ROOT / 'index.html').write_text(html, encoding='utf-8')
    sw = (ROOT / 'sw.js').read_text()
    n = int(re.search(r"foodie-v(\d+)", sw).group(1))
    (ROOT / 'sw.js').write_text(sw.replace(f"foodie-v{n}", f"foodie-v{n + 1}"))
    print(f"index.html generato, cache foodie-v{n + 1}")

if __name__ == '__main__':
    main()
