"""Banca dati svizzera dei valori nutritivi (USAV, V 7.1, 2026) – dati aperti, citando la fonte.

Serve a riempire i valori che le tabelle CREA non hanno (B12, vitamina D, magnesio, zinco,
selenio, iodio, folati, B6, E…) e gli alimenti che CREA non ha (tofu, chia, hummus…).
Nomi in italiano: l'abbinamento CREA → Svizzera è automatico (stessa parola principale,
stesso stato: crudo/cotto/secco/in polvere…) con correzioni a mano in nutr_map.CH_FIX.

File: https://naehrwertdaten.ch/wp-content/uploads/2026/07/Banca_dati_svizzera_dei_valori_nutritivi.xlsx
da salvare in tools/.cache/svizzera/ch.xlsx (alla prima build viene convertito in ch.json; serve openpyxl).
"""
import json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', '.cache', 'svizzera', 'ch.json')

COLS = {
    'fib': 'Fibra alimentare (g)', 'na': 'Sodio (Na) (mg)', 'kk': 'Potassio (K) (mg)',
    'ca': 'Calcio (Ca) (mg)', 'mg': 'Magnesio (Mg) (mg)', 'p': 'Fosforo (P) (mg)',
    'fe': 'Ferro (Fe) (mg)', 'zn': 'Zinco (Zn)  (mg)', 'se': 'Selenio (Se) (µg)', 'i': 'Iodio (I) (µg)',
    'vA': 'Attività di vitamina A, RE (µg)', 'b1': 'Vitamina B1 (tiamina) (mg)',
    'b2': 'Vitamina B2 (riboflavina) (mg)', 'b3': 'Niacina (mg)', 'b6': 'Vitamina B6 (piridossina) (mg)',
    'b12': 'Vitamina B12 (cobalamina) (µg)', 'fol': 'Folati (µg)', 'vC': 'Vitamina C (acido ascorbico) (mg)',
    'vD': 'Vitamina D (calciferolo) (µg)', 'vE': 'Vitamina E (α-tocoferolo) (mg)',
    'sat': 'Acidi grassi, saturi (g)', 'zuc': 'Zuccheri (g)',
}
KCAL = 'Energia, kilocalorie (kcal)'

# stati che cambiano molto i valori per 100 g: devono coincidere
STATES = {
    'crudo': r'crud|fresc', 'cotto': r'cott|bollit|lessat|arrost|grigliat|forno|saltat|stufat|brasat|fritt|vapore|padella',
    'secco': r'secc|essicc|disidrat|liofil', 'polvere': r'polver', 'scatola': r'scatol|conserv|sciropp|salamoia|naturale|sott.?olio|sgocciol',
    'congelato': r'congel|surgel', 'condensato': r'condens|concentr', 'integrale': r'integral',
}
STOP = set('con senza di del della dei delle allo alla alle al ai agli e ed o in per tipo media medio valori parte edibile non aggiunta grassi sale cottura'.split())


def norm(t):
    t = unicodedata.normalize('NFD', str(t or '').lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')


def words(t):
    return [w for w in re.split(r'[^a-z]+', norm(t)) if len(w) > 2 and w not in STOP]


def stem(w):
    return w[:max(4, len(w) - 2)]


def states(t):
    n = norm(t)
    return {k for k, rx in STATES.items() if re.search(rx, n)}


def val(x):
    if x is None or x == 'nd':
        return None
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip()
    if s.startswith('tr') or s.startswith('<'):
        return 0.0
    try:
        return float(s.replace(',', '.'))
    except ValueError:
        return None


_DB = None


def convert():
    import openpyxl
    rows = list(openpyxl.load_workbook(SRC[:-4] + 'xlsx', read_only=True, data_only=True)['Alimenti generici'].iter_rows(values_only=True))
    h = rows[2]
    out = [{'id': r[0], 'n': r[3], 'syn': r[4], 'cat': r[5],
            'v': {x: r[i] for i, x in enumerate(h) if i >= 8 and x and x not in ('Deduzione del valore', 'Fonte', 'Voce modificata')}}
           for r in rows[3:] if r[3]]
    json.dump(out, open(SRC, 'w', encoding='utf-8'), ensure_ascii=False)


def load():
    global _DB
    if _DB is None:
        if not os.path.exists(SRC):
            convert()
        _DB = {}
        for r in json.load(open(SRC, encoding='utf-8')):
            v = {k: val(r['v'].get(c)) for k, c in COLS.items()}
            epa, dha = val(r['v'].get('Acido eicosapentaenoico (EPA) (g)')), val(r['v'].get('Acido docosaesaenoico (DHA) (g)'))
            v['o3'] = (epa + dha) * 1000 if epa is not None and dha is not None else None
            v['cu'] = None  # la banca dati svizzera non riporta il rame
            _DB['ch%d' % r['id']] = {'n': r['n'], 'syn': r['syn'] or '', 'cat': r['cat'] or '', 'v': v,
                                     'kcal': val(r['v'].get(KCAL)), 'w': [stem(w) for w in words(r['n'])],
                                     'st': states(r['n'])}
    return _DB


def match(name, kcal=None):
    """Alimento svizzero più vicino al nome CREA, o None se non ce n'è uno affidabile."""
    db = load()
    qw = [stem(w) for w in words(name)]
    if not qw:
        return None
    qs = states(name)
    best, bs = None, 0
    for c, d in db.items():
        if not d['w'] or d['w'][0] != qw[0]:
            continue
        # lo stato deve coincidere (una pesca fresca non è una pesca secca)
        if (d['st'] - {'crudo'}) != (qs - {'crudo'}):
            continue
        sc = 10 + 3 * len(set(qw) & set(d['w'])) - 0.5 * len(set(d['w']) - set(qw))
        if kcal and d['kcal']:
            r = d['kcal'] / kcal if kcal else 1
            if r > 1.6 or r < 1 / 1.6:
                continue  # stesso nome ma alimento troppo diverso
            sc -= abs(1 - r) * 4
        if sc > bs:
            best, bs = c, sc
    return best
