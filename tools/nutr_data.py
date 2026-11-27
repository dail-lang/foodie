#!/usr/bin/env python3
"""Dati nutrizionali per Foodie.

Fonti: CREA – Tabelle di composizione degli alimenti (alimentinutrizione.it, 2019),
riutilizzabili citando la fonte; Ciqual 2020 (ANSES, licenza aperta) solo per i valori
che CREA non ha. Nessun dato USDA.

Uso:
  python3 tools/nutr_data.py fetch-crea     # scarica le schede (1 al secondo, con cache)
  python3 tools/nutr_data.py build          # prepara la tabella e la inserisce in src/app.html
"""
import html, json, os, re, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.cache', 'crea')
BASE = 'https://www.alimentinutrizione.it'
APP = os.path.join(ROOT, 'src', 'app.html')

KEYS = ['fib', 'na', 'kk', 'ca', 'mg', 'p', 'fe', 'zn', 'cu', 'se', 'i', 'vA', 'b1', 'b2', 'b3',
        'b6', 'b12', 'fol', 'vC', 'vD', 'vE', 'o3', 'sat', 'zuc']
# campo CREA per ogni chiave (o3 e sat si calcolano dagli acidi grassi)
FIELDS = {
    'fib': 'Fibra totale (g)', 'na': 'Sodio (mg)', 'kk': 'Potassio (mg)', 'ca': 'Calcio (mg)',
    'mg': 'Magnesio (mg)', 'p': 'Fosforo (mg)', 'fe': 'Ferro (mg)', 'zn': 'Zinco (mg)',
    'cu': 'Rame (mg)', 'se': 'Selenio (μg)', 'i': 'Iodio (μg)',
    'vA': 'Vitamina A retinolo equivalente (μg)', 'b1': 'Tiamina (mg)', 'b2': 'Riboflavina (mg)',
    'b3': 'Niacina (mg)', 'b6': 'Vitamina B6 (mg)', 'b12': 'Vitamina B12 (μg)',
    'fol': 'Folati (μg)', 'vC': 'Vitamina C (mg)', 'vD': 'Vitamina D (μg)', 'vE': 'Vitamina E (mg)',
    'zuc': 'Zuccheri solubili (g)',
}
UA = {'User-Agent': 'Foodie-uso-personale/1.0 (una pagina al secondo)'}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode('utf-8', 'replace')


def text_of(page):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', page, flags=re.S)
    t = re.sub(r'<[^>]+>', '|', t)
    t = html.unescape(t)
    t = re.sub(r'\s+', ' ', t)
    return re.sub(r'(\| ?)+', '|', t)


def index():
    p = os.path.join(CACHE, '_index.html')
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        open(p, 'w', encoding='utf-8').write(get(BASE + '/tabelle-nutrizionali/ricerca-per-ordine-alfabetico'))
    s = open(p, encoding='utf-8').read()
    out = []
    for c, n in re.findall(r'href="/tabelle-nutrizionali/(\d{6})"[^>]*>(.*?)</a>', s, flags=re.S):
        n = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', n))).strip()
        if n and c not in [x[0] for x in out]:
            out.append((c, n))
    return out


def fetch_crea():
    items = index()
    todo = [c for c, _ in items if not os.path.exists(os.path.join(CACHE, c + '.html'))]
    print(f'{len(items)} alimenti, {len(todo)} da scaricare', flush=True)
    for k, c in enumerate(todo):
        for attempt in range(3):
            try:
                page = get(f'{BASE}/tabelle-nutrizionali/{c}')
                open(os.path.join(CACHE, c + '.html'), 'w', encoding='utf-8').write(page)
                break
            except Exception as e:  # rete instabile: riprova con calma
                print('errore', c, e, flush=True)
                time.sleep(5 * (attempt + 1))
        time.sleep(1)
        if k % 50 == 0:
            print(k, flush=True)
    print('fatto', flush=True)


def num(s):
    s = s.strip().replace(',', '.')
    if s.lower() in ('tr', 'traccia', 'tracce'):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return None


def field(t, name):
    m = re.search(r'\|' + re.escape(name) + r'\|[^|]*\|([^|]*)\|', t)
    return num(m.group(1)) if m else None


def parse(code):
    t = text_of(open(os.path.join(CACHE, code + '.html'), encoding='utf-8').read())
    m = re.search(r'Tabelle di Composizione degli Alimenti\|([^|]+)\|Categoria', t)
    name = m.group(1).strip() if m else code
    v = {k: field(t, f) for k, f in FIELDS.items()}
    lip = field(t, 'Lipidi (g)')
    epa, dha = field(t, 'C20:5 acido eicosapentenoico EPA (%)'), field(t, 'C22:6 acido docosaesenoico DHA (%)')
    sat = field(t, 'Acidi grassi Saturi (%)')
    if lip is not None and lip == 0:
        v['o3'] = 0.0; v['sat'] = 0.0
    else:
        # gli acidi grassi sono in % del totale degli acidi grassi; acidi grassi ≈ 90% dei lipidi
        v['o3'] = round((epa + dha) * lip * 0.9 * 10, 1) if lip is not None and epa is not None and dha is not None else None
        v['sat'] = round(sat * lip * 0.9 / 100, 2) if lip is not None and sat is not None else None
    eng = re.search(r'English Name\|([^|]+)\|', t)
    return name, (eng.group(1).strip() if eng else ''), v


def build():
    items = index()
    db = {}
    missing = 0
    for c, _ in items:
        if not os.path.exists(os.path.join(CACHE, c + '.html')):
            missing += 1
            continue
        name, _eng, v = parse(c)
        db[c] = {'n': name, 'v': [None if v[k] is None else round(v[k], 3) for k in KEYS], 'eu': 0}
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    import nutr_map, nutr_foods
    J = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    js = ('/* NUTDB:START */\n'
          f"const NUT_KEYS={json.dumps(KEYS)};\n"
          f"const ING_CREA={J(nutr_map.ING)};\nconst PZ_G={J(nutr_map.PZ_G)};\nconst CUCCH_G={J(nutr_map.CUCCH_G)};\n"
          f"const FOOD_CREA={J(nutr_foods.F)};\n"
          "const NUT_SRC={crea:'CREA – Tabelle di composizione degli alimenti (2019)',ciqual:'Ciqual 2020 – ANSES'};\n"
          f"const NUTDB={json.dumps(db, ensure_ascii=False, separators=(',', ':'))};\n"
          '/* NUTDB:END */')
    s = open(APP, encoding='utf-8').read()
    if '/* NUTDB:START */' in s:
        s = re.sub(r'/\* NUTDB:START \*/.*?/\* NUTDB:END \*/', lambda m: js, s, flags=re.S)
    else:
        anchor = 'const FOODS=['
        i = s.index(anchor)
        s = s[:i] + js + '\n' + s[i:]
    open(APP, 'w', encoding='utf-8').write(s)
    print(f'{len(db)} alimenti inseriti ({missing} non scaricati), {len(js)//1024} kB')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    {'fetch-crea': fetch_crea, 'build': build}.get(cmd, lambda: print(__doc__))()
