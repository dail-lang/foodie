# Modalità Antinfiammatoria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a Foodie elenco dei cibi antinfiammatori con livello di prova, punteggio 0–10 delle ricette, modalità Antinfiammatoria nel piano, 20 ricette nuove, consigli dedicati e la correzione delle proteine del piano.

**Architecture:** Tutto in `src/app.html` come le funzioni esistenti: una tabella dati `ANTI`, funzioni pure di punteggio, un peso in più nella scelta casuale del piano (`choose`) e un passaggio di correzione proteine dentro `makePlan`. Test Playwright in `tools/test.cjs` che chiamano le funzioni globali.

**Tech Stack:** HTML/CSS/JS senza librerie; Python per la build; Node + Playwright per i test.

**Spec:** `docs/superpowers/specs/2026-11-24-antinfiammatorio-design.md`

## Global Constraints

- Dopo ogni modifica a `src/app.html`: `python3 -I tools/build.py`; test: `node tools/test.cjs`.
- Nessuna ricetta con maiale e derivati; nuove ricette ≤ 30 min.
- Ogni affermazione antinfiammatoria mostra il suo livello di prova: `solide`, `promettenti`, `tradizionale`; i cibi `limitare` sono mostrati come "da limitare".
- Nessuna promessa di cura, nessun integratore.
- Nuova chiave di profilo `ai` (booleana); assente = disattivata. Profili salvati non vanno modificati al caricamento.
- Calorie medie del piano entro ±5% dell'obiettivo; pesce ≥ 2 e legumi ≥ 3 a settimana; massimo 2 ripetizioni per ricetta a settimana.
- Colori da token, leggibile a 400 px in chiaro e scuro.

## Review Focus

1. Profilo vegano con modalità Antinfiammatoria e correzione proteine: il piano deve restare vegano e trovare sostituti proteici. **[RF 1]**
2. Ricetta "mia" senza grammi (tutti `q.b.`) o con unità strane: il punteggio non deve dare errori né `NaN`. **[RF 2]**
3. Correzione proteine quando nessuna alternativa ha più proteine: il piano non va in loop e resta valido. **[RF 3]**
4. Profilo salvato senza `ai`: casella spenta, piano invariato rispetto a oggi. **[RF 4]**
5. Ricette già presenti nel piano salvato: dopo l'aggiornamento il piano non si rigenera da solo. **[RF 5]**

---

### Task 1: Tabella dei cibi e punteggio antinfiammatorio

**Files:** Modify `src/app.html` (nuova sezione dopo `MICRO`); Test `tools/test.cjs`.

**Interfaces:**
- Produces: `ANTI: Array<{id:string, n:string, kw:string, lv:'solide'|'promettenti'|'tradizionale'|'limitare', why:string, spice?:true}>` — `kw` = parole chiave separate da `|`, riconosciute con `words()`/`stemMatch()` già esistenti.
- Produces: `aiMatch(r) -> Array<{a:ANTIentry, ing:[nome,qty,unità]}>` (un ingrediente prende la prima voce che combacia; le voci `limitare` si controllano per prime).
- Produces: `aiScore(r) -> number` tra 0 e 10, una cifra decimale; `isAI(r) -> boolean` = `aiScore(r) >= 6`.

Algoritmo (non determinato dalla firma):
```
grammi(ing): g/ml = qty; pz = qty*55 se nome contiene "uov", altrimenti qty*50; cucchiai = qty*10; q.b. = 0
tot  = somma grammi di tutti gli ingredienti (se 0 → punteggio 0 + bonus)
good = somma grammi × peso livello (solide 1, promettenti 0.7, tradizionale 0.4) degli ingredienti abbinati non-limitare
bad  = somma grammi degli ingredienti abbinati a limitare
bonus = 0.6 per ogni voce spice distinta presente (anche q.b.), massimo 1.8
score = clamp(K * 10 * (good - bad) / tot + bonus, 0, 10), arrotondato a 0.1; K costante di taratura (partire da 1.6)
```
Voci minime di `ANTI` (le parole chiave le sceglie l'implementatore): pesce azzurro e salmone, olio extravergine, verdure a foglia, legumi, cereali integrali (avena, farro, orzo, quinoa, riso integrale, pane/pasta/farina integrale), frutta secca; curcuma, zenzero, frutti di bosco e rossi, cacao e fondente, tè verde, fermentati (kefir, yogurt, skyr), crucifere, pomodoro, avocado; cannella, aglio, cipolla, rosmarino, origano, semi di lino e chia, brodo di ossa; da limitare: zucchero, miele, sciroppi, marmellata, farine raffinate e prodotti da forno (farina non integrale, pangrattato non integrale, savoiardi, biscotti, cracker non integrali, sfoglie), salumi, fritti, bibite.

- [ ] **Step 1: Test che falliscono**
```js
test('taratura: 25–40% delle ricette attuali antinfiammatorie', async p => {
  const r = await ev(p, () => { const base = R.filter(r => !r.tags.includes('mia')).slice(0, 100); return base.filter(isAI).length / base.length; });
  assert(r >= .25 && r <= .40, 'quota ' + r);
});
test('pizza e sgarri con farina sotto 6', async p => {
  const r = await ev(p, () => R.filter(r => r.id === 'pizza-yogurt' || (r.tags.includes('sgarro') && r.ing.some(i => /farina(?! d.avena)|savoiardi|biscotti/i.test(i[0])))).filter(isAI).map(r => r.id));
  assertEq(r, []);
});
test('salmone e zuppa di ceci sopra 6', async p => { assertEq(await ev(p, () => ['salmone-patate', 'zuppa-ceci'].map(id => isAI(byId[id]))), [true, true]); });
test('[RF 2] ricetta senza grammi', async p => {
  const s = await ev(p, () => aiScore({ ing: [['Curcuma', '0', 'q.b.'], ['Zenzero', '0', 'q.b.']], s: [], tags: [] }));
  assert(Number.isFinite(s) && s >= 0 && s <= 10, String(s));
});
test('livelli validi', async p => { assertEq(await ev(p, () => ANTI.filter(a => !['solide', 'promettenti', 'tradizionale', 'limitare'].includes(a.lv)).length), 0); });
```
- [ ] **Step 2:** `node tools/test.cjs` → FAIL (`isAI` non definita).
- [ ] **Step 3:** Implementare tabella e funzioni; regolare `K` e i pesi finché la taratura passa.
- [ ] **Step 4:** build + test → PASS.
- [ ] **Step 5:** Commit `feat: punteggio antinfiammatorio delle ricette`.

### Task 2: 20 ricette antinfiammatorie

**Files:** Modify `src/app.html` (array `R`, `MICRO`); Test.

**Interfaces:** Consumes `aiScore`, `isAI`. Le nuove ricette hanno id con prefisso `ai-`.

Ricette (nomi definitivi; dosi e macro realistici a cura dell'implementatore): Golden milk con curcuma e zenzero · Porridge ai frutti di bosco e semi di lino · Yogurt greco con mirtilli, noci e cannella · Smoothie verde con zenzero e kefir · Salmone alla curcuma e zenzero con riso integrale · Sardine al forno con pomodoro e origano · Zuppa di lenticchie e cavolo nero · Bowl di quinoa, broccoli, avocado e semi · Sgombro con insalata di farro e rucola · Pollo alla curcuma con verdure e orzo · Ceci e spinaci al curry con riso integrale · Minestra di orzo, fagioli e verdure a foglia · Insalata tiepida di salmone, spinaci e noci · Frittata di spinaci e curcuma con pane integrale · Vellutata di broccoli e zenzero con ceci croccanti · Tè verde freddo con zenzero e limone · Cioccolata calda al cacao e cannella · Barrette di noci, datteri e cacao · Mirtilli e yogurt con semi di chia · Hummus alla curcuma con verdure crude.
Almeno 4 con tag `vegan`; almeno 6 con proteine ≥ 30 g; nessuna sopra i 30 minuti.

- [ ] **Step 1: Test**
```js
test('20 ricette ai- valide e antinfiammatorie', async p => {
  const r = await ev(p, () => { const a = R.filter(r => r.id.startsWith('ai-')); return { n: a.length, notAI: a.filter(r => !isAI(r)).map(r => r.id), slow: a.filter(r => r.t > 30).map(r => r.id), vegan: a.filter(r => r.tags.includes('vegan')).length, prot30: a.filter(r => r.p >= 30).length, noMicro: a.filter(r => !MICRO[r.id]).map(r => r.id) }; });
  assert(r.n === 20 && !r.notAI.length && !r.slow.length && r.vegan >= 4 && r.prot30 >= 6 && !r.noMicro.length, JSON.stringify(r));
});
```
(I test esistenti "100 ricette valide", "nessun maiale", "id unici" continuano a valere su tutte le ricette.)
- [ ] **Steps 2–5:** FAIL → aggiungere → PASS (anche la taratura del Task 1, calcolata sulle prime 100) → commit `feat: 20 ricette antinfiammatorie`.

### Task 2b: 40 ricette in più di ogni tipo

**Files:** Modify `src/app.html` (array `R`, `MICRO`); Test.

**Interfaces:** id con prefisso `v3-`. Formato e regole come le ricette esistenti; i test "100 ricette valide", "nessun maiale", "id unici e micronutrienti" valgono anche per queste. La taratura del Task 1 resta calcolata sulle prime 100 ricette.

Ricette (nomi definitivi):
- **Sgarri sani (12, tag `sgarro`):** Cheesecake proteica in tazza · Brownie in tazza al burro d'arachidi · Tartellette d'avena con yogurt e frutta · Pizza con base di cavolfiore · Hamburger fatto in casa con panino integrale e patate al forno · Nuggets di ceci al forno con salsa allo yogurt · Gelato proteico al pistacchio · Banana bread in tazza · Waffle proteici con frutti di bosco · Crumble di mele in tazza · Patatine di patate dolci al forno · Bocconcini gelati di yogurt greco e frutta.
- **Colazioni (8):** Crêpes integrali con ricotta e fragole · French toast proteico · Porridge salato con uovo e spinaci · Yogurt parfait con muesli e pesca · Pane integrale con hummus e pomodori · Frittatine di albumi e zucchine in tazza · Bowl di skyr, banana e cacao · Bagel integrale con salmone affumicato e spalmabile light.
- **Pranzi e cene (12):** Orzotto alla zucca e salvia · Paella leggera di pollo e gamberi · Vellutata di piselli e menta con crostini · Polpettine di tacchino con verdure al forno · Melanzane ripiene di manzo magro · Insalata di pollo, mela e noci · Cous cous alla marocchina con verdure e ceci · Branzino al forno con limone e patate · Straccetti di manzo con rucola e pomodorini · Riso venere con gamberi e zucchine · Insalata di polpo e patate · Sushi bowl vegana con tofu e avocado.
- **Spuntini salati (8):** Rotolini di bresaola, rucola e grana · Uova sode alla paprika · Hummus di lenticchie con carote · Chips di cavolo riccio al forno · Tzatziki con grissini integrali · Mozzarella light e pomodorini · Muffin di ceci e verdure · Toast di segale con fiocchi di latte ed erba cipollina.

- [ ] **Step 1: Test**
```js
test('40 ricette v3- valide', async p => {
  const r = await ev(p, () => { const a = R.filter(r => r.id.startsWith('v3-')); const by = m => a.filter(r => r.m[0] === m).length; return { n: a.length, sgarri: a.filter(r => r.tags.includes('sgarro')).length, slow: a.filter(r => r.t > 30).map(r => r.id), tot: R.filter(r => !r.tags.includes('mia')).length }; });
  assert(r.n === 40 && r.sgarri >= 12 && !r.slow.length && r.tot >= 160, JSON.stringify(r));
});
```
- [ ] **Steps 2–5:** FAIL → aggiungere → PASS → commit `feat: 40 ricette in più`.

### Task 3: Modalità Antinfiammatoria nel piano, filtro e schede

**Files:** Modify `src/app.html` (`viewProfilo`, submit del profilo, `choose`, `cardHTML`, `openRecipe`, `viewRicette`, `filtered`, `viewPiano` pill); Test.

**Interfaces:**
- Consumes `aiScore`, `aiMatch`, `isAI`.
- `profile.ai` letto come `!!profile.ai`. Casella `#f-ai` sotto quella Superfood.
- `choose(a)`: se `profile.sf || profile.ai`, sceglie con peso `(profile.sf?(r.mi.length+1)**2:1) * (profile.ai?(1+aiScore(r))**2:1)`; altrimenti uniforme.
- Filtro chip `data-flt="ai"` etichetta "Antinfiammatoria" → `isAI(r)`.
- Card: badge con il punteggio se `isAI(r)`. Scheda ricetta: sezione "Ingredienti antinfiammatori" con per ogni abbinamento nome ingrediente, livello ("prove solide" / "prove promettenti" / "uso tradizionale" / "da limitare") e `why`.
- Piano: pill "Antinfiammatoria attiva" come quella Superfood.

- [ ] **Step 1: Test**
```js
test('[RF 4] profilo senza ai: casella spenta', async p => { await ev(p, () => { location.hash = 'profilo'; }); await p.waitForTimeout(150); assertEq(await p.locator('#f-ai').isChecked(), false); }, { seed: { 'pp.profile': REAL } });
test('modalità ai alza il punteggio medio del piano', async p => {
  const r = await ev(p, () => { const avg = () => { let s = 0, n = 0; for (let k = 0; k < 15; k++) { makePlan(); plan.days.forEach(d => SLOTS_IDS.forEach(sl => { s += aiScore(byId[d[sl].id]); n++; })); } return s / n; }; profile.ai = false; const off = avg(); profile.ai = true; const on = avg(); return on - off; });
  assert(r >= 0.8, 'differenza ' + r);
}, { seed: { 'pp.profile': REAL } });
test('filtro Antinfiammatoria', async p => { const r = await ev(p, () => { ui.flt = new Set(['ai']); return filtered().list.every(isAI) && filtered().list.length >= 30; }); assert(r); });
test('scheda mostra livelli di prova', async p => {
  await ev(p, () => openRecipe('salmone-patate', 1)); await p.waitForTimeout(100);
  assert(/prove solide/.test(await p.locator('.sheet').innerText()));
});
test('[RF 5] piano salvato non si rigenera', async p => {
  const r = await ev(p, () => { makePlan(); const a = JSON.stringify(plan.days); location.reload(); return a; });
  await p.waitForTimeout(300); assertEq(await ev(p, () => JSON.stringify(plan.days)), r);
}, { seed: { 'pp.profile': REAL } });
```
- [ ] **Steps 2–5:** FAIL → implementare → PASS → commit `feat: modalità antinfiammatoria nel piano, filtro e schede`.

### Task 4: Correzione delle proteine nel piano

**Files:** Modify `src/app.html` (`makePlan`); Test.

**Interfaces:**
- Produces: `dayTotals(day) -> {k:number, p:number}` (usa `byId[id]` e `x`).
- Produces: `fixProtein(days:Array, T:number, prot:number, used:Object)` — muta `days`. Per ogni giorno con `p < 0.9*prot`, prova in ordine `spuntino`, `colazione`, `pranzo`, `cena`: tra `pool(slot)` (rispetta già dieta) sceglie con `choose` una ricetta con più proteine per kcal di quella attuale, `used[id] < 2`, che non tolga l'unico pesce o legume necessario a restare a pesce ≥ 2 e legumi ≥ 3 (ricontrolla con i conteggi della settimana); ricalcola la porzione con `portion(r, T*quota)`. Si ferma al primo slot che porta il giorno ≥ 0.9*prot, poi passa al giorno successivo. Massimo 4 tentativi per giorno (nessun loop).
- `makePlan` chiama `fixProtein` dopo `ensure('pesce',2); ensure('legumi',3)`.

- [ ] **Step 1: Test**
```js
const planStats = async (p, opts) => ev(p, o => { Object.assign(profile, o); const c = calc(profile); let low = 0, n = 0, kcal = 0, bad = 0; for (let k = 0; k < 40; k++) { makePlan(); let f = 0, l = 0; const cnt = {}; plan.days.forEach(d => { const t = dayTotals(d); n++; kcal += t.k; if (t.p < .9 * c.prot) low++; ['pranzo','cena'].forEach(s => { const tg = byId[d[s].id].tags; if (tg.includes('pesce')) f++; if (tg.includes('legumi')) l++; }); SLOTS_IDS.forEach(s => cnt[d[s].id] = (cnt[d[s].id] || 0) + 1); }); if ((o.dieta === 'onni' && f < 2) || l < 3 || Object.values(cnt).some(v => v > 2)) bad++; } return { low: low / n, kcal: kcal / n / c.target, bad }; }, opts);
for (const [nome, o] of [['base', { sf: false, ai: false }], ['superfood', { sf: true, ai: false }], ['antinfiammatoria', { sf: false, ai: true }], ['entrambe', { sf: true, ai: true }]]) {
  test('proteine piano ' + nome, async p => { const r = await planStats(p, { ...o, dieta: 'onni' }); assert(r.low <= .10 && Math.abs(r.kcal - 1) <= .05 && r.bad === 0, JSON.stringify(r)); }, { seed: { 'pp.profile': REAL } });
}
test('[RF 1] vegano con antinfiammatoria resta vegano', async p => {
  const r = await ev(p, () => { profile.dieta = 'vegan'; profile.ai = true; makePlan(); return plan.days.every(d => SLOTS_IDS.every(s => byId[d[s].id].tags.includes('vegan'))); });
  assert(r);
}, { seed: { 'pp.profile': REAL } });
test('[RF 3] nessun sostituto possibile: niente loop', async p => {
  const r = await ev(p, () => { const t0 = performance.now(); profile.peso = 200; makePlan(); return [plan.days.length, performance.now() - t0 < 2000]; });
  assertEq(r, [7, true]);
}, { seed: { 'pp.profile': REAL } });
```
Nota: se con la ricetta di base il criterio `low ≤ 10%` non è raggiungibile per mancanza di spuntini proteici, il costruttore può alzare la quota proteica degli spuntini ammessi (ma non cambiare il criterio); va scritto come Ruling.
- [ ] **Steps 2–5:** FAIL → implementare → PASS → commit `feat: il piano corregge le proteine`.

### Task 5: Consigli "Antinfiammatorio"

**Files:** Modify `src/app.html` (`TIPS`, `viewConsigli`); Test.

**Interfaces:** voci `TIPS` con `cat:'Antinfiammatorio'` e campo nuovo `lv` (stessi valori di `ANTI.lv`); in `viewConsigli` le schede con `lv` mostrano un'etichetta di livello. Almeno 9 schede: pesce azzurro, olio extravergine, verdure a foglia e crucifere, legumi e integrali, frutta secca e semi, curcuma con pepe nero, zenzero, frutti di bosco e cacao, fermentati, più una "Cosa limitare". Ogni scheda: livello + indicazione pratica.

- [ ] **Step 1: Test**
```js
test('consigli antinfiammatori con livello', async p => {
  const r = await ev(p, () => TIPS.filter(t => t.cat === 'Antinfiammatorio').map(t => t.lv));
  assert(r.length >= 9 && r.every(l => ['solide', 'promettenti', 'tradizionale', 'limitare'].includes(l)), JSON.stringify(r));
});
```
- [ ] **Steps 2–5:** FAIL → implementare → PASS → commit `feat: consigli antinfiammatori`.

### Task 6: Verifica visiva e pubblicazione

- [ ] **Step 1:** `node tools/test.cjs` → tutti PASS.
- [ ] **Step 2:** Screenshot 400 px chiaro/scuro: Ricette con filtro, scheda ricetta antinfiammatoria, Profilo con le due caselle, Piano con le pill, Consigli. Correggere contrasto e testo tagliato.
- [ ] **Step 3:** Dopo la revisione finale: merge in `main`, push, ripubblicare l'artifact da `src/app.html`.
