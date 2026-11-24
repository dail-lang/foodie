# Quantità giuste, conferma come Yazio, prodotti di marca e codice a barre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il calcolatore "Fuori piano" dà pezzi giusti per ogni nome, mostra ogni cibo con quantità e cibo correggibili prima di salvare, trova prodotti di marca su Open Food Facts e legge i codici a barre.

**Architecture:** Tutto resta in `src/app.html` (app a file unico). Si separano le voci di `FOODS` con pezzi diversi; il risultato del calcolatore diventa una lista di "righe" calcolata da una funzione pura (`calcRows`) a partire dal testo, dalle correzioni (`ui.qedit`) e dai prodotti scansionati (`ui.qscan`); i prodotti di Open Food Facts scelti diventano voci di `FOODS` salvate in `pp.products`.

**Tech Stack:** HTML/CSS/JS senza dipendenze (lettore codici di riserva `@zxing/library@0.21.3` UMD da jsDelivr caricato solo al primo uso), Playwright per i test (`node tools/test.cjs [filtro]`), `python3 tools/build.py` per `index.html` e `sw.js`.

**Spec:** `docs/superpowers/specs/2026-11-24-porzioni-yazio-design.md`

## Global Constraints

- Testi in italiano, colori solo da token CSS, leggibile e toccabile a 400 px in chiaro e scuro; pulsanti − / + almeno 40 px.
- Tutto tranne prodotti di marca e codice a barre funziona offline.
- I test non dipendono da internet: le risposte di Open Food Facts si simulano con `p.route`.
- A Open Food Facts va solo il nome del cibo cercato o il codice a barre.
- I test esistenti (111) restano verdi, in particolare "frasi comuni danno il piatto giusto" (PIN) e "i piatti più comuni sono tutti riconosciuti" (COMMON).
- Nessun dato salvato perso: diario, recenti nel vecchio formato `{t}` o `{n,k,p,c,f}`, `myfoods`.
- Dopo ogni modifica a `src/app.html`: `python3 tools/build.py` prima di lanciare i test (i test aprono `index.html`).
- Commit con le righe di attribuzione della sessione.

## Review Focus

1. **Quantità modificata con valori strani** (campo grammi vuoto, "abc", "0", "1,5", − sul pezzo minimo): i grammi accettano la virgola, valori non validi o ≤ 0 lasciano la riga com'era, − non scende sotto 1 pezzo (sotto 0,5 se la frase partiva da mezzo). Test in Task 3.
2. **Si continua a scrivere dopo una correzione, o la stessa frase compare due volte** ("mela e mela"): la riga corretta resta corretta, la gemella no; cambiare quel pezzo di testo cancella la correzione. Test in Task 2.
3. **Risposta di Open Food Facts che arriva tardi** (testo già cambiato o pagina cambiata): nessun errore e nessun risultato attaccato al pezzo sbagliato. Test in Task 5.
4. **Prodotti con dati sporchi** (solo kJ, nome mancante, `serving_quantity` stringa o 0, kcal > 900/100 g, macro mancanti): conversione kJ ÷ 4,184, nome di riserva marca o "Prodotto <codice>", porzione assente → 100 g, oltre 900 kcal scartato, macro mancanti = 0 con `partial`. Test in Task 4.
5. **Bevande e cibi in ml** (prodotto con porzione in ml, "una birra" corretta a 330): la riga mostra ml, non g. Test in Task 3.

---

### Task 1: Pezzi giusti per ogni nome

**Files:**
- Modify: `src/app.html` (tabella `FOODS`, righe ~2200–2380)
- Test: `tools/test.cjs` (nuova sezione "Pezzi giusti")

**Interfaces:**
- Consumes: `analyzeFood(text) -> {items:[{food,g,...}],unknown}`
- Produces: voci nuove in `FOODS` (nomi esatti usati dai test): `'Nuggets di pollo'`, `'Crocchette di pollo'`, `'Cordon bleu'`, `'Wurstel'`, `'Mandarino'`, `'Fichi secchi'`, `'Uvetta'`, `'Supplì'`, `'Pizzetta'`, `'Bignè'`, `'Cannolo siciliano'`, `'Krapfen'` più quelle che l'audit trova.

- [ ] **Step 1: Write the failing tests**

In `tools/test.cjs` aggiungi `PIECE_REF`: un oggetto `{ '<parola chiave>': [grammi, 'CREA'|'USDA'|'etichetta'] }` con **ogni** parola chiave di ogni voce di `FOODS` che ha `pz>0` (379 oggi, più quelle nuove). Il peso è quello di **un** pezzo o di una unità come la intende chi lo scrive ("1 nuggets" = 18, "1 wurstel" = 50, "1 mandarino" = 70, "1 bignè" = 25, "1 cannolo" = 100, "1 supplì" = 120, "1 pizzetta" = 50, "1 fico secco" = 20, "1 cordon bleu" = 100, "1 crocchetta di pollo" = 30, "1 pizza" = 330, "1 fetta di pizza" si esclude perché ha un'unità). Poi:

```js
test('ogni nome con un pezzo ha il peso di riferimento', async p => {
  const miss = await ev(p, R => FOODS.filter(f => f.pz && !f.mine && !f.prod).flatMap(f => f.kw.split('|')).filter(k => !(k in R)), PIECE_REF);
  assertEq(miss, []);
});
test('un pezzo pesa come il riferimento (±30%)', async p => {
  const bad = await ev(p, R => Object.entries(R).map(([k, [g]]) => { const it = analyzeFood('1 ' + k).items; return it.length === 1 && Math.abs(it[0].g - g) <= g * .3 ? null : `${k}: ${it.map(i => i.food.n + ' ' + Math.round(i.g) + 'g').join('+')} (rif ${g})`; }).filter(Boolean), PIECE_REF);
  assertEq(bad, []);
});
test('5 nuggets non sono 5 cotolette', async p => {
  assertEq(await ev(p, () => ['5 nuggets', '3 mandarini', '2 wurstel', '4 bignè', '2 supplì', '3 fichi secchi'].map(t => { const i = analyzeFood(t).items[0]; return [i.food.n, Math.round(i.g)]; })),
    [['Nuggets di pollo', 90], ['Mandarino', 210], ['Wurstel', 100], ['Bignè', 100], ['Supplì', 240], ['Fichi secchi', 60]]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && node tools/test.cjs "pezz"; node tools/test.cjs nuggets`
Expected: FAIL; il secondo test elenca i nomi fuori riferimento (nuggets 150 g, mandarino 150 g, …).

- [ ] **Step 3: Separa le voci in `FOODS`**

Per ogni nome fuori ±30% togli la parola chiave dalla voce attuale e crea una voce propria con `F(n,kw,k,p,c,f,fib,por,porl,pz,pzl,u,mi)`, valori per 100 g da CREA o USDA (es. Nuggets di pollo 260 kcal, 15 p, 16 c, 15 f, pz 18 'nugget', por 108 '6 nuggets'; Wurstel 270 kcal, 13 p, 2 c, 24 f, pz 50; Mandarino 53 kcal, pz 70). Dove sbagliava solo il peso del pezzo e i valori per 100 g sono simili, va bene anche una voce nuova con gli stessi valori. Se una voce nuova è un piatto di pasta o una bevanda, aggiungila a `DRY` o `LIQ`.

- [ ] **Step 4: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS (inclusi PIN e COMMON; se un PIN atteso cambia per una voce separata, aggiorna il valore atteso solo se la voce nuova è più giusta, e scrivilo nel commit).

- [ ] **Step 5: Commit** — `git commit -am "fix: ogni nome ha il suo peso del pezzo (nuggets, wurstel, mandarini…)"`

---

### Task 2: Righe del calcolatore con correzioni

**Files:**
- Modify: `src/app.html` (`bestFood`, `parseFoodChunk`, `analyzeFood`, nuove `rankFoods`, `calcRows`)
- Test: `tools/test.cjs` (sezione "Righe")

**Interfaces:**
- Consumes: `FOODS`, `fw`, `fmatch`, `plainWord`, `fuzzyFood`.
- Produces:
  - `rankFoods(ws: string[]) -> Array<{food, guess, sc}>` ordinata per punteggio decrescente, un elemento per cibo. `bestFood(ws)` diventa `rankFoods(ws)[0] || null` (stesso risultato di oggi).
  - `parseFoodChunk(ch, ctx)` accetta `ctx.food` (cibo imposto, salta il riconoscimento) e restituisce in più: `n` (numero di unità, 1 se non scritto), `unitG` (grammi di una unità, dimensione inclusa), `unitL` (nome unità al singolare), `mode` (`'pz'` se la quantità è in unità, `'g'` se scritta in grammi/ml o piatto "da crudo"), `ws` (parole usate per il riconoscimento).
  - `analyzeFood(text)` restituisce in più `chunks: Array<{key, text, ctx}>` per ogni pezzo riconosciuto, e ogni item ha `key`. `key` = `` `${occorrenza}|${testo del pezzo normalizzato minuscolo senza spazi doppi}` `` (occorrenza 0, 1, … tra pezzi con lo stesso testo).
  - `nutr(food, g) -> {g, k, p, c, f, fib}`.
  - `calcRows(text: string, edits: Object, scans: Array) -> Array<Row>` con `Row = {key, src:'txt'|'scan', food, g, n, unitG, unitL, mode, k, p, c, f, fib, guess, warn, label}`. `edits[key]` può avere `{food?: string /* nome in FOODS */, n?: number, g?: number}`: `food` ri-analizza il pezzo con `ctx.food`; `n` (solo `mode 'pz'`) dà `g = n*unitG`; `g` dà i grammi. `scans` è `[{key:'scan:<code>', food: string, n, g}]` e produce righe `src:'scan'` dopo quelle del testo. `warn = g > 3*food.por || k > 1200`. `label` = "5 nuggets · 90 g" (o "250 ml").

- [ ] **Step 1: Write the failing tests**

```js
test('rankFoods: il primo è bestFood', async p => {
  assertEq(await ev(p, () => ['pasta al pomodoro', 'pollo', 'kinder'].map(t => { const ws = fw(t); return rankFoods(ws)[0].food === bestFood(ws).food && rankFoods(ws).length > 1; })), [true, true, true]);
});
test('righe: correzione dei pezzi e dei grammi', async p => {
  assertEq(await ev(p, () => { const r0 = calcRows('5 nuggets e una mela', {}, []); const k = r0[0].key;
    const r1 = calcRows('5 nuggets e una mela', { [k]: { n: 8 } }, []); const r2 = calcRows('5 nuggets e una mela', { [k]: { g: 50 } }, []);
    return [r0.length, r0[0].mode, r1[0].n, Math.round(r1[0].g), Math.round(r2[0].g), r2[1].food.n]; }), [2, 'pz', 8, 144, 50, 'Mela']);
});
test('righe: la correzione resta se continuo a scrivere, sparisce se cambio quel pezzo', async p => {
  assertEq(await ev(p, () => { const k = calcRows('5 nuggets', {}, [])[0].key, e = { [k]: { n: 8 } };
    return [calcRows('5 nuggets e una mela', e, [])[0].n, calcRows('6 nuggets', e, [])[0].n]; }), [8, 6]);
});
test('righe: la stessa frase due volte ha due chiavi', async p => {
  assertEq(await ev(p, () => { const r = calcRows('mela e mela', {}, []); const e = { [r[0].key]: { n: 3 } }; const r2 = calcRows('mela e mela', e, []); return [r[0].key !== r[1].key, r2[0].n, r2[1].n]; }), [true, 3, 1]);
});
test('righe: cambio cibo mantiene i pezzi', async p => {
  assertEq(await ev(p, () => { const k = calcRows('5 nuggets', {}, [])[0].key; const r = calcRows('5 nuggets', { [k]: { food: 'Cotoletta impanata' } }, [])[0]; return [r.food.n, r.n]; }), ['Cotoletta impanata', 5]);
});
test('righe: avviso quantità sospetta', async p => {
  assertEq(await ev(p, () => [calcRows('5 cotolette', {}, [])[0].warn, calcRows('1 cotoletta', {}, [])[0].warn, calcRows('una pizza margherita', {}, [])[0].warn]), [true, false, false]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && node tools/test.cjs righe; node tools/test.cjs rankFoods`
Expected: FAIL con "rankFoods is not defined" / "calcRows is not defined".

- [ ] **Step 3: Implementa `rankFoods`, i campi nuovi di `parseFoodChunk`, `chunks`/`key` in `analyzeFood`, `nutr`, `calcRows`**

`calcRows` usa `analyzeFood(text)` una volta, poi per ogni item con `edits[key]`: se c'è `food` rifà `parseFoodChunk(chunk.text, {...chunk.ctx, food: FOODS.find(f=>f.n===edits[key].food)})`; poi applica `n` o `g`. Un `food` che non esiste più in `FOODS` si ignora.

- [ ] **Step 4: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: righe del calcolatore con correzioni di quantità e cibo"`

---

### Task 3: Righe modificabili nell'interfaccia e diario per cibo

**Files:**
- Modify: `src/app.html` (`foodResHTML`, `HANDLERS` `addtxt`/`recent`, nuovi handler, CSS `.qrow`, `textItem`)
- Test: `tools/test.cjs` (sezione "Conferma")

**Interfaces:**
- Consumes: `calcRows`, `rankFoods`, `nutr` (Task 2).
- Produces:
  - Stato: `ui.qedit = {}` e `ui.qscan = []` (si svuotano dopo "Aggiungi"); `ui.qalt = key|null` (menu "Non è questo?" aperto).
  - Markup per riga: contenitore `.qrow[data-key]`; pulsanti `[data-act="qminus"]`, `[data-act="qplus"]` (solo `mode 'pz'`), campo `input.qg[data-key]` (grammi, `inputmode="decimal"`, sempre presente), link `[data-act="qalt"]` "Non è questo?", nel menu `[data-act="qpick"][data-food="<nome>"]` per fino a 3 alternative locali e `[data-act="teach"]`; riga con `warn` mostra `.qwarn` "Controlla la quantità"; righe `scan` hanno `[data-act="qdel"]` ×.
  - `rowsToItems(rows) -> Array<{n, k, p, c, f, fib, src:'q'}>` con `n = `${food.n} · ${label}``.
  - Recenti: `pushRecent({t, items})`; il chip con `items` li riaggiunge uguali; i vecchi `{t}` passano da `calcRows(t,{},[])` → `rowsToItems`; i vecchi `{n,k,p,c,f}` come oggi.

- [ ] **Step 1: Write the failing tests**

```js
test('conferma: − e + cambiano pezzi e totale', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '5 nuggets'); await p.waitForTimeout(80);
  await p.click('[data-act="qplus"]'); await p.click('[data-act="qplus"]'); await p.click('[data-act="qminus"]');
  assertEq(await ev(p, () => [calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].n, /6 nuggets/.test($('q-res').textContent)]), [6, true]);
});
test('conferma: grammi con la virgola, valori non validi ignorati, minimo 1 pezzo', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '1 nuggets'); await p.waitForTimeout(80);
  await p.click('[data-act="qminus"]');
  const n1 = await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].n);
  for (const v of ['abc', '0', '']) { await p.fill('input.qg', v); await p.dispatchEvent('input.qg', 'change'); }
  const g1 = await ev(p, () => Math.round(calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].g));
  await p.fill('input.qg', '35,5'); await p.dispatchEvent('input.qg', 'change');
  assertEq([n1, g1, await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].g)], [1, 18, 35.5]);
});
test('conferma: Non è questo? cambia il cibo', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'pollo'); await p.waitForTimeout(80);
  await p.click('[data-act="qalt"]'); const alt = await p.locator('[data-act="qpick"]').first().getAttribute('data-food');
  await p.click('[data-act="qpick"]'); assertEq(await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].food.n), alt);
});
test('conferma: avviso Controlla la quantità', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '5 cotolette'); await p.waitForTimeout(80);
  assert(await p.locator('.qwarn').count() === 1);
});
test('aggiungi: una voce per cibo con le correzioni, recente le ripete', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '5 nuggets e una mela'); await p.waitForTimeout(80);
  await p.click('[data-act="qplus"]'); await p.click('[data-act="addtxt"]'); await p.waitForTimeout(80);
  await p.locator('[data-act="recent"]').first().click(); await p.waitForTimeout(80);
  assertEq(await ev(p, () => [dayLog().items.length, dayLog().items[0].n, Math.round(dayLog().items[0].k) === Math.round(dayLog().items[2].k), ui.qtxt, Object.keys(ui.qedit).length]),
    [4, 'Nuggets di pollo · 6 nuggets · 108 g', true, '', 0]);
});
test('recenti vecchi solo testo: una voce per cibo', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.locator('[data-act="recent"]').first().click(); await p.waitForTimeout(80);
  assertEq(await ev(p, () => dayLog().items.map(i => i.n.split(' · ')[0])), ['Cappuccino', 'Cornetto']);
}, { seed: { 'pp.recent': [{ t: 'cappuccino e cornetto' }] } });
test('bevanda: la riga mostra ml', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'una birra'); await p.waitForTimeout(80);
  await p.fill('input.qg', '330'); await p.dispatchEvent('input.qg', 'change');
  assert(/330 ml/.test(await p.textContent('#q-res')));
});
```

Le unità al plurale si scrivono come le scrive una persona ("6 nuggets", non "6 nugget"). L'esatto testo del nome (`'Nuggets di pollo · 6 nuggets · 108 g'`) dipende da `porl/pzl` scelti nel Task 1: se diverso, aggiorna l'atteso al formato `${food.n} · ${label}`.

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && node tools/test.cjs conferma; node tools/test.cjs recent`
Expected: FAIL (selettori `[data-act="qplus"]` assenti).

- [ ] **Step 3: Implementa righe, handler e salvataggio**

`foodResHTML` costruisce le righe da `calcRows(ui.qtxt, ui.qedit, ui.qscan)` e si mostra anche con testo vuoto se `ui.qscan.length`. Modificare una riga aggiorna solo `#q-res` (come oggi per `input` su `#q-txt`) senza ridisegnare la vista, così il fuoco nel campo testo non si perde. Il campo grammi si applica su `change` (non a ogni lettera). − non scende sotto 1 (sotto 0,5 se `n` iniziale era 0,5). `addtxt` aggiunge `rowsToItems(rows)`, fa `pushRecent({t: testo || nomi dei prodotti scansionati uniti da ", ", items})`, svuota `ui.qtxt`, `ui.qedit`, `ui.qscan`. `textItem` resta solo se usato altrove; altrimenti rimuovilo.

- [ ] **Step 4: Controllo visivo**

Screenshot a 400 px in chiaro e scuro di `#q-res` con "5 nuggets e una mela" e con il menu "Non è questo?" aperto: pulsanti − / + ≥ 40 px, contrasto dei pulsanti diverso dallo sfondo, niente scroll orizzontale.

- [ ] **Step 5: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS (aggiorna "recente con un tocco aggiunge al diario" a 2 voci se ora sono per cibo).

- [ ] **Step 6: Commit** — `git commit -am "feat: conferma come Yazio con quantità modificabili e diario per cibo"`

---

### Task 4: Prodotti salvati (dati di Open Food Facts, offline)

**Files:**
- Modify: `src/app.html` (vicino a `addMyFood`/`cleanMyFoods`; `BK_KEYS`, `BK_SHAPE`; `bestFood` bonus)
- Test: `tools/test.cjs` (sezione "Prodotti")

**Interfaces:**
- Consumes: `F`, `fw`, `FOODS`, `PROTECT`.
- Produces:
  - `offNorm(product: object) -> Prod|null` con `Prod = {code, n, b, k, p, c, f, fib, sv, ml, partial}`: nome da `product_name_it` → `product_name` → `generic_name_it` → marca → `"Prodotto <code>"`; kcal da `nutriments['energy-kcal_100g']` oppure `energy-kj_100g/4.184` oppure `energy_100g/4.184`; `null` se kcal mancanti, ≤ 0 o > 900; macro mancanti = 0 con `partial:true`; `sv` = `+serving_quantity` se > 0 e ≤ 1000, altrimenti 0; `ml` = vero se `serving_size`/`quantity` contiene "ml" o "cl" o "l".
  - `prodKeywords(prod, typed?: string) -> string[]`: "marca + nome" e "nome", in minuscolo, senza pesi/numeri/unità (`39 g`, `x2`, `500ml`); più `typed` ripulito con `teachName` solo se passato.
  - `saveProduct(prod, typed?) -> food`: aggiunge/aggiorna in `pp.products` (per `code`, max 200, il più recente in fondo) e in `FOODS` una voce con `prod:true`, `por = sv || 100`, `porl = sv ? 'porzione' : '100 g'`, `pz = sv`, `pzl = 'porzione'`, `liq = ml`; `PROTECT = null`.
  - Avvio: `cleanProducts().forEach(addProductFood)` dopo i cibi insegnati.
  - `bestFood/rankFoods`: le voci `prod` non hanno il bonus `mine`.
  - Backup: `'products'` in `BK_KEYS`, `BK_SHAPE.products = Array.isArray`.

- [ ] **Step 1: Write the failing tests**

```js
const OFF_BUENO = { code: '8000500121467', product_name_it: 'Kinder Bueno', brands: 'Ferrero,Kinder', serving_quantity: '21.5', serving_size: '1 barretta (21,5 g)', nutriments: { 'energy-kcal_100g': 572, proteins_100g: 9.2, carbohydrates_100g: 49.5, fat_100g: 37.3, fiber_100g: 2 } };
test('offNorm: dati puliti e sporchi', async p => {
  assertEq(await ev(p, B => [offNorm(B).n, offNorm(B).sv, Math.round(offNorm({ code: '1', brands: 'X', nutriments: { 'energy-kj_100g': 1000 } }).k), offNorm({ code: '1', brands: 'X', nutriments: { 'energy-kj_100g': 1000 } }).partial, offNorm({ code: '2', product_name: 'Y', nutriments: { 'energy-kcal_100g': 950 } }), offNorm({ code: '3', product_name: 'Z', nutriments: {} }), offNorm({ code: '4', nutriments: { 'energy-kcal_100g': 100 } }).n, offNorm({ code: '5', product_name: 'W', serving_quantity: 0, nutriments: { 'energy-kcal_100g': 100 } }).sv], OFF_BUENO),
    ['Kinder Bueno', 21.5, 239, true, null, null, 'Prodotto 4', 0]);
});
test('prodotto salvato: riconosciuto offline, nel backup, non ruba "spaghetti"', async p => {
  assertEq(await ev(p, B => { saveProduct(offNorm(B)); saveProduct(offNorm({ code: '9', product_name_it: 'Spaghetti n.5', brands: 'Barilla', serving_quantity: 80, nutriments: { 'energy-kcal_100g': 359, proteins_100g: 12, carbohydrates_100g: 71, fat_100g: 2 } }));
    const a = analyzeFood('2 kinder bueno').items[0], s = analyzeFood('spaghetti 80 g').items[0], b = analyzeFood('spaghetti barilla 80 g').items[0];
    return [a.food.n, Math.round(a.g), s.food.prod || false, b.food.n, store.get('products', []).length, BK_KEYS.includes('products'), importData(exportData()).ok]; }, OFF_BUENO),
    ['Kinder Bueno', 43, false, 'Spaghetti n.5', 2, true, true]);
});
test('prodotto con parole scritte solo se il pezzo era sconosciuto', async p => {
  assertEq(await ev(p, B => { const f = saveProduct(offNorm(B), 'bueno bianco'); return f.kw.split('|').includes('bueno bianco'); }, OFF_BUENO), true);
});
test('prodotti salvati vecchi o rotti non rompono l’avvio', async p => {
  assertEq(await ev(p, () => store.get('products', []).length), 1);
}, { seed: { 'pp.products': [{ code: '1', n: 'Ok', b: '', k: 100, p: 1, c: 1, f: 1, fib: 0, sv: 0, ml: false }, 'rotto', { code: 2 }] } });
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && node tools/test.cjs prodott; node tools/test.cjs offNorm`
Expected: FAIL con "offNorm is not defined".

- [ ] **Step 3: Implementa `offNorm`, `prodKeywords`, `saveProduct`, `cleanProducts`, `addProductFood`, backup**

`cleanProducts()` tiene solo elementi con `code` stringa, `n` stringa non vuota e `k > 0`, e riscrive `pp.products` se ha tolto qualcosa (come `cleanMyFoods`).

- [ ] **Step 4: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: prodotti di marca salvati sul telefono e nel backup"`

---

### Task 5: Ricerca su Open Food Facts nel calcolatore

**Files:**
- Modify: `src/app.html` (nuove `offSearch`, render dei risultati in `foodResHTML`, handler `qoff`, `offpick`)
- Test: `tools/test.cjs` (sezione "Open Food Facts", con `p.route`)

**Interfaces:**
- Consumes: `offNorm`, `saveProduct` (Task 4); `calcRows`, `ui.qalt`, `ui.qedit` (Task 2–3).
- Produces:
  - `const OFF = 'https://world.openfoodfacts.org'`.
  - `offSearch(q: string) -> Promise<{ok:true, list: Prod[]} | {ok:false, why:'offline'|'error'}>`: `GET ${OFF}/cgi/search.pl?search_terms=<q>&search_simple=1&action=process&json=1&page_size=24&sort_by=unique_scans_n&fields=code,product_name,product_name_it,generic_name_it,brands,nutriments,serving_quantity,serving_size,quantity,countries_tags`; prodotti passati da `offNorm`, quelli con `countries_tags` che include `en:italy` prima, massimo 5; cache in memoria per `q` (minuscolo); `navigator.onLine === false` → `offline` senza richiesta; timeout 8 s → `error`.
  - Stato per riga: `ui.qoff = { [key]: {q, st:'wait'|'ok'|'offline'|'error', list} }`.
  - Avvio ricerca: per ogni pezzo **sconosciuto** (chiave `u|<testo>`) dopo 500 ms senza scrivere; per una riga riconosciuta solo con `[data-act="qoff"][data-key]` "Cerca tra i prodotti di marca" nel menu "Non è questo?".
  - Risultati: `[data-act="offpick"][data-key][data-code]` con nome, marca, kcal/100 g; sotto, "Dati: Open Food Facts". Stati: "Cerco tra i prodotti di marca…", "Sei offline: i prodotti di marca non sono disponibili", "Ricerca non riuscita, riprova più tardi".
  - `offpick`: `saveProduct(prod, typed se il pezzo era sconosciuto)`, poi per righe riconosciute `ui.qedit[key].food = food.n`; per i pezzi sconosciuti il nuovo nome salvato basta perché il ricalcolo lo riconosca.
  - Una risposta si applica solo se `ui.qtxt` contiene ancora quel pezzo e la vista "oggi" è aperta (`$('q-res')` esiste).

- [ ] **Step 1: Write the failing tests**

```js
const offRoute = (p, body, delay = 0) => p.route('**/world.openfoodfacts.org/**', async r => { if (delay) await new Promise(s => setTimeout(s, delay)); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }); });
test('pezzo sconosciuto: propone prodotti di marca e li usa', async p => {
  await offRoute(p, { products: [OFF_BUENO, { ...OFF_BUENO, code: '7', product_name_it: 'Bueno White', countries_tags: ['en:italy'] }, { code: '8', product_name: 'Senza kcal', nutriments: {} }] });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '2 bueno bianco'); await p.waitForTimeout(900);
  const names = await p.locator('[data-act="offpick"]').allTextContents();
  await p.locator('[data-act="offpick"]').first().click(); await p.waitForTimeout(80);
  assertEq([names.length, /Bueno White/.test(names[0]), /Open Food Facts/.test(await p.textContent('#q-res')), await ev(p, () => { const r = calcRows(ui.qtxt, ui.qedit, ui.qscan)[0]; return [r.food.n, Math.round(r.g)]; })],
    [2, true, true, ['Bueno White', 43]]);
});
test('offline: messaggio e il resto funziona', async p => {
  await p.context().setOffline(true);
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'mela e bueno bianco'); await p.waitForTimeout(900);
  assert(/Sei offline/.test(await p.textContent('#q-res')) && await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan).length === 1));
});
test('risposta tardiva dopo aver cambiato testo: ignorata', async p => {
  await offRoute(p, { products: [OFF_BUENO] }, 1200);
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'bueno bianco'); await p.waitForTimeout(700);
  await p.fill('#q-txt', 'mela'); await p.waitForTimeout(1000);
  assertEq(await p.locator('[data-act="offpick"]').count(), 0);
});
test('Non è questo? cerca anche tra le marche', async p => {
  await offRoute(p, { products: [OFF_BUENO] });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'barretta'); await p.waitForTimeout(80);
  await p.click('[data-act="qalt"]'); await p.click('[data-act="qoff"]'); await p.waitForTimeout(300);
  await p.locator('[data-act="offpick"]').first().click(); await p.waitForTimeout(80);
  assertEq(await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].food.n), 'Kinder Bueno');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && node tools/test.cjs marca; node tools/test.cjs offline; node tools/test.cjs tardiva`
Expected: FAIL (nessun `[data-act="offpick"]`).

- [ ] **Step 3: Implementa `offSearch`, stato `ui.qoff`, rendering, handler**

- [ ] **Step 4: Prova reale**

Con l'accesso a `world.openfoodfacts.org` permesso (chiedere la modifica dell'ambiente se la richiesta è bloccata), da Node: `fetch(OFF + '/cgi/search.pl?...search_terms=kinder bueno...')` e `offNorm` sui primi risultati: almeno un prodotto con nome e kcal sensati. Se l'accesso resta bloccato, annotalo nel ledger e nel rapporto finale.

- [ ] **Step 5: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat: prodotti di marca da Open Food Facts nel calcolatore"`

---

### Task 6: Lettura del codice a barre

**Files:**
- Modify: `src/app.html` (pulsante "Scansiona" accanto a `#q-txt`, finestra `#scan`, `offProduct`, `onBarcode`, `startScan`/`stopScan`, CSS)
- Test: `tools/test.cjs` (sezione "Codice a barre")

**Interfaces:**
- Consumes: `offNorm`, `saveProduct` (Task 4); `ui.qscan`, `foodResHTML` (Task 3).
- Produces:
  - `offProduct(code: string) -> Promise<{ok:true, prod} | {ok:false, why:'offline'|'notfound'|'nokcal'|'error'}>`: `GET ${OFF}/api/v2/product/<code>.json?fields=<come offSearch>`; `status !== 1` → `notfound`; `offNorm` null → `nokcal`.
  - `onBarcode(code: string) -> Promise<void>`: accetta solo 8–14 cifre; con `ok` fa `saveProduct(prod)`, aggiunge `{key:'scan:'+code, food: food.n, n: 1}` a `ui.qscan` (se c'è già, `n+1`), chiude la finestra e aggiorna `#q-res`; altrimenti mostra nella finestra "Prodotto non trovato" / "Il prodotto non ha le calorie" / offline, con `[data-act="scanmanual"]` "Inseriscilo a mano" che apre il modulo manuale.
  - Finestra: `[data-act="scan"]` apre `#scan` con `<video>` (fotocamera posteriore `facingMode:'environment'`), campo `#scan-code` (`inputmode="numeric"`) e `[data-act="scancode"]` "Cerca"; `[data-act="scanclose"]` chiude e ferma la fotocamera. Lettore: `BarcodeDetector` con formati `ean_13, ean_8, upc_a, upc_e` se disponibile, altrimenti `loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js')` al primo uso. Fotocamera negata o assente: messaggio "Fotocamera non disponibile: scrivi il codice qui sotto" e il campo resta usabile.
  - Righe scansionate: × `[data-act="qdel"][data-key]` le toglie.

- [ ] **Step 1: Write the failing tests**

```js
test('codice scritto a mano: prodotto aggiunto come riga', async p => {
  await offRoute(p, { status: 1, product: OFF_BUENO });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.fill('#scan-code', '8000500121467'); await p.click('[data-act="scancode"]'); await p.waitForTimeout(300);
  assertEq(await ev(p, () => [ui.qscan.length, calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].food.n, Math.round(calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].g), !!document.querySelector('#scan[open], #scan.on')]), [1, 'Kinder Bueno', 22, false]);
  await p.click('[data-act="addtxt"]'); await p.waitForTimeout(80);
  assertEq(await ev(p, () => [dayLog().items.length, ui.qscan.length]), [1, 0]);
});
test('codice sconosciuto: offre di inserirlo a mano', async p => {
  await offRoute(p, { status: 0 });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.fill('#scan-code', '12345678'); await p.click('[data-act="scancode"]'); await p.waitForTimeout(300);
  assert(/non trovato/i.test(await p.textContent('#scan')) && await p.locator('[data-act="scanmanual"]').count() === 1);
});
test('codice non valido non fa richieste', async p => {
  let n = 0; await p.route('**/world.openfoodfacts.org/**', r => { n++; r.abort(); });
  await ev(p, () => onBarcode('12ab')); assertEq(n, 0);
});
test('riga scansionata si toglie con ×', async p => {
  await offRoute(p, { status: 1, product: OFF_BUENO });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await ev(p, () => onBarcode('8000500121467')); await p.waitForTimeout(200);
  await p.click('[data-act="qdel"]'); assertEq(await ev(p, () => ui.qscan.length), 0);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && node tools/test.cjs codice; node tools/test.cjs scansionata`
Expected: FAIL (nessun `[data-act="scan"]`).

- [ ] **Step 3: Implementa finestra, lettore, `offProduct`, `onBarcode`**

- [ ] **Step 4: Controllo visivo**

Screenshot a 400 px chiaro e scuro della finestra di scansione (senza fotocamera in Chromium headless: si vede il messaggio e il campo del codice) e del risultato con una riga scansionata.

- [ ] **Step 5: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat: lettura del codice a barre con Open Food Facts"`

---

### Task 7: Revisione finale, unione e pubblicazione

**Files:** `index.html`, `sw.js` (generati)

- [ ] **Step 1:** `python3 tools/build.py && node tools/test.cjs` → tutti PASS; ripeti 2 volte per escludere test instabili.
- [ ] **Step 2:** Revisione dell'intero ramo con un revisore indipendente (modello più capace, modello `code-reviewer`); correggi Critical/Important con un test che fallisce prima.
- [ ] **Step 3:** Unisci `porzioni-yazio` in `main`, push (GitHub Pages).
- [ ] **Step 4:** Pubblica l'artifact aggiornato. Prima di pubblicare carica `artifact-capabilities` per sapere se la pagina artifact può usare fotocamera e richieste a `world.openfoodfacts.org`; se no, in quella versione "Scansiona" e la ricerca di marca si nascondono con la riga di spiegazione della spec.
