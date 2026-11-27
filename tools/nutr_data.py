#!/usr/bin/env python3
"""Dati nutrizionali per Foodie.

Fonti: CREA – Tabelle di composizione degli alimenti (alimentinutrizione.it, 2019),
riutilizzabili citando la fonte; Banca dati svizzera dei valori nutritivi (USAV, V 7.1, dati
aperti) per i valori e gli alimenti che CREA non ha (vedi nutr_ch.py). Nessun dato USDA.

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
    v['_kcal'] = field(t, 'Energia (kcal)')
    eng = re.search(r'English Name\|([^|]+)\|', t)
    return name, (eng.group(1).strip() if eng else ''), v


def build():
    items = index()
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    import nutr_map, nutr_foods, nutr_ch
    used = set()
    for m in list(nutr_map.ING.values()) + list(nutr_foods.F.values()):
        used.update([m] if isinstance(m, str) else [c for c, _ in (m or [])])
    db, kcal, missing = {}, {}, 0
    for c, _ in items:
        if not os.path.exists(os.path.join(CACHE, c + '.html')):
            missing += 1
            continue
        name, _eng, v = parse(c)
        kcal[c] = v.pop('_kcal')
        for k in nutr_map.CREA_BAD.get(c, []):
            v[k] = None
        db[c] = {'n': name, 'v': [None if v[k] is None else round(v[k], 3) for k in KEYS], 'eu': 0, 'sim': 0}
    # 1) valori mancanti dalla Banca dati svizzera: abbinamento a mano per i cibi dell'app,
    #    automatico (stesso nome e stato, calorie simili) per gli altri; segnati in 'eu'
    CH = nutr_ch.load()
    ch_used, n_eu = set(), 0
    for c, d in db.items():
        fix = nutr_map.CH_FIX.get(c)
        if fix is None and c not in used:
            m = nutr_ch.match(d['n'], kcal[c])
            if m and kcal[c] and CH[m]['kcal'] and 0.75 < CH[m]['kcal'] / kcal[c] < 1.33:
                fix = int(m[2:])
        if fix is None:
            continue
        sid, scale = (fix if isinstance(fix, tuple) else (fix, None))
        s_ = CH['ch%d' % sid]
        f = (kcal[c] / s_['kcal']) if scale == 'k' and kcal[c] and s_['kcal'] else 1
        salted = 'acqua salata' in s_['n']
        for i, k in enumerate(KEYS):
            x = s_['v'].get(k)
            if d['v'][i] is None and x is not None and not (k == 'na' and salted):
                d['v'][i] = round(x * f, 3); d['eu'] |= 1 << i; n_eu += 1
    print(f'{n_eu} valori dalla Banca dati svizzera')
    # i vegetali non contengono B12 né vitamina D (tranne i funghi per la D): 0, non "dato mancante"
    ib12, ivd = KEYS.index('b12'), KEYS.index('vD')
    for c, d in db.items():
        if c[0] == '0' or c.startswith('40'):
            if d['v'][ib12] is None: d['v'][ib12] = 0.0
            if d['v'][ivd] is None and 'fungh' not in d['n'].lower(): d['v'][ivd] = 0.0
    # 2) ancora mancante: mediana delle varianti CREA dello stesso alimento, solo se nello stesso stato
    #    (una pesca fresca non prende i valori della pesca secca) e con calorie simili; segnato in 'sim'
    fam = {}
    for c, d in db.items():
        fam.setdefault((d['n'].split(',')[0].strip().lower(), frozenset(nutr_ch.states(d['n']) - {'crudo'})), []).append(c)
    filled = 0
    for c, d in db.items():
        key = (d['n'].split(',')[0].strip().lower(), frozenset(nutr_ch.states(d['n']) - {'crudo'}))
        sib = [o for o in fam[key] if o != c and kcal[o] and kcal[c] and 0.75 < kcal[o] / kcal[c] < 1.33]
        for i in range(len(KEYS)):
            if d['v'][i] is None:
                vals = sorted(db[o]['v'][i] for o in sib if db[o]['v'][i] is not None and not ((db[o]['sim'] | db[o]['eu']) >> i) & 1)
                if vals:
                    d['v'][i] = vals[len(vals) // 2]; d['sim'] |= 1 << i; filled += 1
    print(f'{filled} valori presi da varianti dello stesso alimento')
    # 3) alimenti svizzeri usati direttamente dalle ricette (tofu, chia, hummus…)
    def res(v):
        return nutr_map.ING.get(v, nutr_foods.F.get(v)) if isinstance(v, str) and not re.fullmatch(r'\d{6}|ch\d+', v) else v
    SYN = {k: res(v) for k, v in nutr_map.SYN.items()}
    assert all(v is not None for v in SYN.values()), [k for k, v in SYN.items() if v is None]
    for m in list(nutr_map.ING.values()) + list(nutr_foods.F.values()) + list(SYN.values()):
        for code in ([m] if isinstance(m, str) else [c for c, _ in (m or [])]):
            if code.startswith('ch'):
                ch_used.add(code)
    for code in sorted(ch_used):
        s_ = CH[code]; v = [None if s_['v'].get(k) is None else round(s_['v'][k], 3) for k in KEYS]
        cat = s_['cat']
        a = 1 if re.match(r'Carne|Pesce|Prodotti carnei', cat) else 2 if re.match(r'Latte|Uova', cat) or 'miele' in s_['n'].lower() else 0
        db[code] = {'n': s_['n'], 'v': v, 'eu': sum(1 << i for i, x in enumerate(v) if x is not None), 'sim': 0, **({'a': a} if a else {})}
    J = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    js = ('/* NUTDB:START */\n'
          f"const NUT_KEYS={json.dumps(KEYS)};\n"
          f"const ING_CREA={J(nutr_map.ING)};\nconst PZ_G={J(nutr_map.PZ_G)};\nconst CUCCH_G={J(nutr_map.CUCCH_G)};\n"
          f"const FOOD_CREA={J(nutr_foods.F)};\n"
          f"const NUT_SYN={J(SYN)};\n"
          "const NUT_SRC={crea:'CREA – Tabelle di composizione degli alimenti (2019)',ch:'Banca dati svizzera dei valori nutritivi (USAV, 2026)'};\n"
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
