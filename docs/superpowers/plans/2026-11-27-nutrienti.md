# Nutrienti con valori italiani — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seguire circa 24 nutrienti di tutto quello che si segna, con valori CREA (riserva Ciqual) e fabbisogni LARN, e mostrare se si raggiungono e a cosa servono.

**Architecture:** Uno script Python in `tools/` scarica CREA (e Ciqual se raggiungibile), prepara una tabella compatta e la inserisce in `src/app.html` tra due marcatori. Nell'app: collegamenti ingrediente/cibo → alimento CREA, calcolo dei nutrienti di ogni voce del diario, fabbisogni LARN, e le viste in Oggi e nella scheda ricetta.

**Tech Stack:** Python 3 (standard library + `xlrd` solo se serve per Ciqual .xls), HTML/CSS/JS senza dipendenze, Playwright (`node tools/test.cjs [filtro]`), `python3 tools/build.py`.

**Spec:** `docs/superpowers/specs/2026-11-27-nutrienti-design.md`

## Global Constraints

- Nutrienti (chiavi fisse, in quest'ordine): `fib` g, `na` mg, `kk` mg (potassio), `ca` mg, `mg` mg, `p` mg, `fe` mg, `zn` mg, `cu` mg, `se` µg, `i` µg, `vA` µg RE, `b1` mg, `b2` mg, `b3` mg, `b6` mg, `b12` µg, `fol` µg, `vC` mg, `vD` µg, `vE` mg, `o3` mg (EPA+DHA), `sat` g, `zuc` g.
- Fonti: CREA per tutto ciò che ha; Ciqual solo per i valori mancanti (segnati "valore europeo"); mai USDA, mai valori inventati. Fonte citata nell'app ("Fonte: CREA – Tabelle di composizione degli alimenti"; "Ciqual – ANSES").
- Fabbisogni LARN 2014 per sesso ed età del profilo.
- Calorie e macro di ricette e piano NON cambiano.
- Sale "q.b." nelle ricette salate = 1 g di sale per porzione (393 mg di sodio), segnato "stima"; nei dolci (tag `sgarro` con zuccheri o miele, o colazioni dolci) 0.
- Download da alimentinutrizione.it: una pagina al secondo, una volta, cache in `tools/.cache/` (git-ignorata).
- Tutto offline; dati incorporati nell'app; nessuna perdita di dati salvati.
- Testi in italiano, colori da token, leggibile a 400 px chiaro e scuro.

## Review Focus

1. **Voci del diario senza dati** (cibi insegnati a mano, voci vecchie non ricalcolabili, prodotti senza vitamine in etichetta): niente "carenza" falsa; la vista dice quanta parte è coperta dai dati. Test in Task 3 e 4.
2. **Porzioni e grammi** (mezza porzione di ricetta, 250 g nel calcolatore, "2 uova"): i nutrienti scalano allo stesso modo delle calorie. Test in Task 3.
3. **Profilo che cambia** (donna 25 anni vs uomo 65): cambiano i fabbisogni (ferro 18 vs 10 mg, calcio 1000 vs 1200 mg). Test in Task 3.
4. **Unità dei prodotti Open Food Facts** (vitamine e minerali in grammi per 100 g): convertite in mg/µg correttamente. Test in Task 3.
5. **Settimana con giorni vuoti**: la media usa solo i giorni con almeno un pasto. Test in Task 3.

---

### Task 1: Dati CREA (e Ciqual) dentro l'app

**Files:**
- Create: `tools/nutr_data.py` (scarica, cache, prepara, inserisce), `tools/.cache/` in `.gitignore`
- Modify: `src/app.html` (blocco tra `/* NUTDB:START */` e `/* NUTDB:END */`)
- Test: `tools/test.cjs`

**Interfaces:**
- Produces nell'app:
  - `NUT_KEYS: string[]` (le 24 chiavi sopra, in ordine).
  - `NUTDB: {[code: string]: {n: string, v: (number|null)[], eu: number}}` — `n` nome CREA, `v` valori per 100 g di parte edibile nell'ordine di `NUT_KEYS` (null = dato assente), `eu` bitmask delle posizioni prese da Ciqual.
  - `NUT_SRC = {crea:'CREA – Tabelle di composizione degli alimenti (2019)', ciqual:'Ciqual 2020 – ANSES'}`.
- `o3` = (EPA% + DHA%) × lipidi g × 0,9 × 10 (mg per 100 g), dai campi acidi grassi di CREA; `sat` dai saturi (%) × lipidi × 0,9 se CREA dà solo percentuali.

- [ ] **Step 1: Write the failing test**

```js
test('nutrienti: tabella CREA incorporata', async p => {
  assertEq(await ev(p, () => { const sp = NUTDB['005700'], kf = NUT_KEYS.indexOf('fe'), kc = NUT_KEYS.indexOf('ca');
    return [NUT_KEYS.length, Object.keys(NUTDB).length >= 800, /Spinaci, crudi/.test(sp.n), sp.v[kf] > 2 && sp.v[kf] < 4, sp.v[kc] > 60, typeof NUT_SRC.crea]; }),
    [24, true, true, true, true, 'string']);
});
```

- [ ] **Step 2: Run to verify it fails** — `python3 tools/build.py && node tools/test.cjs "tabella CREA"` → FAIL ("NUTDB is not defined").
- [ ] **Step 3: Write `tools/nutr_data.py`** (`fetch-crea`, `fetch-ciqual`, `build` sottocomandi). Ciqual: prova `ciqual.anses.fr` (xls/xml 2020); abbinamento CREA↔Ciqual tramite nome inglese (CREA "English Name") con abbinamenti manuali per gli alimenti usati dall'app; se Ciqual non è raggiungibile, `eu = 0` e i 5 nutrienti restano null. Esegui `fetch-crea` (circa 15 minuti), poi `build`.
- [ ] **Step 4: Run all tests** — `python3 tools/build.py && node tools/test.cjs` → tutti PASS; peso aggiunto a `index.html` stampato e ≤ 1 MB.
- [ ] **Step 5: Commit** — `git commit -am "feat: tabella CREA dei nutrienti dentro l'app"` (cache non inclusa).

---

### Task 2: Collegamenti ingredienti e cibi → alimenti CREA

**Files:** Modify `src/app.html` (`ING_CREA`, `FOOD_CREA`, `nutMatch`); Test `tools/test.cjs`.

**Interfaces:**
- Consumes: `NUTDB`, `NUT_KEYS` (Task 1).
- Produces:
  - `ING_CREA: {[ingredientName: string]: string | [string, number][]}` — codice CREA, oppure composizione `[[codice, grammi per 100 g], …]` per ingredienti misti (es. "Sedano, carota, cipolla"). Unità: `pz` usa i grammi del pezzo (uovo 55 g, tortilla 60 g…) definiti in `PZ_G: {[name]: number}`; `cucchiai` = 10 g (olio 13,5 g).
  - `FOOD_CREA: {[foodName: string]: string | [string, number][]}` per ogni voce di `FOODS` (piatti composti come composizione per 100 g).
  - `nutMatch(text: string) -> string|null`: abbina testo libero (righe delle ricette scritte a mano) all'alimento CREA più vicino usando prima `ING_CREA`, poi le parole dei nomi CREA (preferendo "crudo" quando non è detto "cotto").

- [ ] **Step 1: Write the failing tests**

```js
test('nutrienti: ogni ingrediente delle ricette è collegato', async p => {
  assertEq(await ev(p, () => [...new Set(R.filter(r => !r.tags.includes('mia')).flatMap(r => r.ing.filter(i => i[2] !== 'q.b.').map(i => i[0])))].filter(n => !ING_CREA[n])), []);
});
test('nutrienti: ogni cibo del calcolatore è collegato', async p => {
  assertEq(await ev(p, () => FOODS.filter(f => !f.mine && !f.prod && !FOOD_CREA[f.n]).map(f => f.n)), []);
});
test('nutrienti: collegamenti puntano a codici esistenti', async p => {
  assertEq(await ev(p, () => Object.values(ING_CREA).concat(Object.values(FOOD_CREA)).flatMap(v => typeof v === 'string' ? [v] : v.map(x => x[0])).filter(c => !NUTDB[c])), []);
});
test('nutrienti: testo libero abbinato', async p => {
  assertEq(await ev(p, () => ['salmone', 'spinaci', 'ceci cotti', 'zzzz'].map(t => { const c = nutMatch(t); return c ? NUTDB[c].n.split(',')[0] : null; })), ['Salmone', 'Spinaci', 'Ceci', null]);
});
```

(I nomi attesi del test sul testo libero si allineano ai nomi esatti CREA se diversi; ruling nel ledger.)

- [ ] **Step 2: Run to verify they fail** — `node tools/test.cjs "collegat"` → FAIL.
- [ ] **Step 3: Scrivi i collegamenti** (194 ingredienti, ~370 cibi) e `nutMatch`.
- [ ] **Step 4: Run all tests** → tutti PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: ingredienti e cibi collegati alla tabella CREA"`

---

### Task 3: Calcolo dei nutrienti e fabbisogni LARN

**Files:** Modify `src/app.html` (funzioni nutrienti, `rowsToItems`, `HANDLERS.addr/vgadd/vgout/eat…`, `offNorm`, `LARN`); Test `tools/test.cjs`.

**Interfaces:**
- Consumes: `NUTDB`, `ING_CREA`, `FOOD_CREA`, `nutMatch` (Task 1–2).
- Produces:
  - `nutOfCode(code|composition, grams) -> {v: number[], miss: boolean[]}` (miss = dato assente per quella chiave).
  - `nutOfRecipe(r, x=1) -> {v, miss, est: {na: boolean}}` (somma ingredienti per porzione × x; sale q.b. stimato come da Global Constraints).
  - `nutOfItem(item) -> {v, miss}|null` per una voce del diario: `item.nu` salvato se c'è; altrimenti ricette (`rid` o `src:'plan:…'`) e righe del calcolatore riconoscibili; `null` se non calcolabile.
  - Le nuove voci del diario salvano `nu: number[]` (arrotondato, 24 valori, null per mancanti) quando calcolabile.
  - `offNorm` aggiunge `nu` dai campi Open Food Facts `*_100g` (g → mg ×1000, g → µg ×1e6), es. `iron_100g`, `calcium_100g`, `vitamin-c_100g`, `vitamin-d_100g`, `vitamin-b12_100g`, `fiber_100g`, `sodium_100g`, `saturated-fat_100g`, `sugars_100g`.
  - `LARN` tabella per sesso (`m`/`f`) e fasce d'età (18–29, 30–59, 60–74, ≥75) e `nutTargets(profile) -> number[]` (obiettivo per chiave; per `sat`, `zuc`, `na` è un limite: `sat` 10% kcal / 9, `zuc` 15% kcal / 4, `na` 2000 mg). Valori da LARN 2014 (verificati con una ricerca), es. uomo 30–59: ca 1000, fe 10, mg 240, kk 3900, p 700, zn 12, cu 0,9, se 55, i 150, vA 700, b1 1,2, b2 1,6, b3 18, b6 1,3, b12 2,4, fol 400, vC 105, vD 15, vE 13, fib 25 g, o3 250; donna 18–49: fe 18, zn 9, vA 600, b1 1,1, b2 1,3, vC 85, vE 12.
  - `dayNutrients(dateKey) -> {v, cover: number[] (0–1, quota di kcal con dato per chiave), n: number (voci)}` e `weekNutrients(endDate) -> {v (media dei giorni con almeno una voce), cover, days}`.

- [ ] **Step 1: Write the failing tests**

```js
test('nutrienti: una ricetta scala con le porzioni e il sale è stimato', async p => {
  assertEq(await ev(p, () => { const r = R.find(x => x.ing.some(i => /sale/i.test(i[0]) && i[2] === 'q.b.') && !x.tags.includes('sgarro')), a = nutOfRecipe(r, 1), b = nutOfRecipe(r, .5), fe = NUT_KEYS.indexOf('fe'), na = NUT_KEYS.indexOf('na');
    return [Math.abs(b.v[fe] * 2 - a.v[fe]) < 1e-6, a.v[na] >= 393, a.est.na]; }), [true, true, true]);
});
test('nutrienti: 250 g di spinaci dal calcolatore', async p => {
  assertEq(await ev(p, () => { const it = rowsToItems(calcRows('250 g spinaci', {}, []))[0], fe = NUT_KEYS.indexOf('fe'); return Math.abs(it.nu[fe] - NUTDB['005700'].v[fe] * 2.5) < .2; }), true);
});
test('nutrienti: fabbisogni LARN cambiano con sesso ed età', async p => {
  assertEq(await ev(p, () => { const fe = NUT_KEYS.indexOf('fe'), ca = NUT_KEYS.indexOf('ca'); return [nutTargets({ sesso: 'f', eta: 25, peso: 60, alt: 165, att: 'leggero', obj: 'mant' })[fe], nutTargets({ sesso: 'm', eta: 65, peso: 75, alt: 175, att: 'leggero', obj: 'mant' })[ca]]; }), [18, 1200]);
});
test('nutrienti: prodotti Open Food Facts convertiti in mg', async p => {
  assertEq(await ev(p, () => { const pr = offNorm({ code: '80000040', product_name: 'Cereali', nutriments: { 'energy-kcal_100g': 380, iron_100g: 0.012, 'vitamin-c_100g': 0.03 } }); return [Math.round(pr.nu[NUT_KEYS.indexOf('fe')]), Math.round(pr.nu[NUT_KEYS.indexOf('vC')])]; }), [12, 30]);
});
test('nutrienti: voci senza dati non diventano carenze', async p => {
  assertEq(await ev(p, () => { const k = todayKey(); log[k] = { items: [{ n: 'Cibo insegnato', k: 500, p: 20, c: 50, f: 20, src: 'q' }], water: 0 }; const d = dayNutrients(k), fe = NUT_KEYS.indexOf('fe'); return [d.cover[fe], d.v[fe]]; }), [0, 0]);
});
test('nutrienti: la settimana conta solo i giorni con pasti', async p => {
  assertEq(await ev(p, () => { const r = R.find(x => x.id === 'mug-cake'); const add = off => { const d = new Date(); d.setDate(d.getDate() - off); log[todayKey(d)] = { items: [{ n: r.n, rid: r.id, k: r.k, p: r.p, c: r.c, f: r.f, src: 'r' }], water: 0 }; }; add(0); add(3);
    const w = weekNutrients(new Date()), dd = dayNutrients(todayKey()), ca = NUT_KEYS.indexOf('ca'); return [w.days, Math.abs(w.v[ca] - dd.v[ca]) < 1e-6]; }), [2, true]);
});
```

- [ ] **Step 2: Run to verify they fail** — `node tools/test.cjs "nutrienti:"` → i nuovi FAIL.
- [ ] **Step 3: Implementa** calcoli, salvataggio `nu`, `offNorm`, `LARN`/`nutTargets` (verifica i valori LARN con una ricerca; segna nel ledger quelli non verificati).
- [ ] **Step 4: Run all tests** → tutti PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: calcolo dei nutrienti e fabbisogni LARN"`

---

### Task 4: Riquadro in Oggi, vista completa e scheda ricetta

**Files:** Modify `src/app.html` (`viewOggi`, nuova vista nutrienti, `openRecipe`, `NUT_INFO`, `NUT_GROUPS`, CSS, `HANDLERS`); Test `tools/test.cjs`.

**Interfaces:**
- Consumes: `dayNutrients`, `weekNutrients`, `nutTargets`, `nutOfRecipe`, `NUT_SRC`, `NUTDB` (Task 1–3).
- Produces:
  - `NUT_INFO: {[key]: {n: string, u: string, why: string, limit?: true}}` (nome italiano, unità, a cosa serve in 2–3 frasi).
  - `NUT_GROUPS: [string, string[]][]` — `['Muscoli e recupero', …], ['Energia e stanchezza', …], ['Ossa e denti', …], ['Difese immunitarie', …], ['Cuore e circolazione', …], ['Cervello e umore', …], ['Pelle e vista', …], ['Da limitare', ['na','sat','zuc']]`.
  - In Oggi, sotto le barre di calorie e macro: `#nut-card` con "N nutrienti raggiunti su M" (M = nutrienti con dati; "· K in arrivo" se mancano Ciqual) e i 2–3 più bassi; pulsante `[data-act="nutopen"]`.
  - Vista nutrienti a schermo pieno (stile del pannello esistente) `#nutv` con interruttore `[data-act="nutmode"][data-m="day"|"week"]`, gruppi, righe `button.nrow[data-nk]` (barra %, valore/obiettivo), nota sulla copertura dati, note fisse su iodio e vitamina D.
  - Dettaglio `[data-nk]` → a cosa serve, "Da cosa l'hai preso" (fino a 5 voci del diario con il contributo maggiore), "Cibi italiani ricchi" (5 alimenti CREA con il valore più alto per porzione tipica, esclusi integratori e prodotti in polvere), fonte (CREA / "valore europeo" Ciqual).
  - Scheda ricetta: riga `.rnut` "Nutrienti per porzione" con i 3 nutrienti a percentuale più alta e link alla lista completa.

- [ ] **Step 1: Write the failing tests**

```js
test('nutrienti: riquadro in Oggi e vista completa', async p => {
  await ev(p, () => { location.hash = 'oggi'; const r = R.find(x => x.id === 'mug-cake'); dayLog().items.push({ n: r.n, rid: r.id, k: r.k, p: r.p, c: r.c, f: r.f, src: 'r' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  const card = await p.textContent('#nut-card');
  await p.click('[data-act="nutopen"]'); await p.waitForTimeout(80);
  const groups = await p.locator('#nutv .ngroup h3').allTextContents();
  await p.locator('#nutv .nrow[data-nk="ca"]').first().click(); await p.waitForTimeout(80);
  const det = await p.textContent('#nutv');
  assertEq([/raggiunti su \d+/.test(card), groups.includes('Ossa e denti'), groups.includes('Da limitare'), /A cosa serve/.test(det), /Mug cake/.test(det), /Fonte/.test(det)], [true, true, true, true, true, true]);
});
test('nutrienti: settimana e nota sui dati mancanti', async p => {
  await ev(p, () => { location.hash = 'oggi'; dayLog().items.push({ n: 'Cibo insegnato', k: 600, p: 20, c: 60, f: 25, src: 'q' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  await p.click('[data-act="nutopen"]'); await p.click('[data-act="nutmode"][data-m="week"]'); await p.waitForTimeout(80);
  assert(/media/i.test(await p.textContent('#nutv')) && /dati/i.test(await p.textContent('#nutv')));
});
test('nutrienti: la scheda ricetta mostra i nutrienti per porzione', async p => {
  await ev(p, () => openRecipe('mug-cake', 1)); await p.waitForTimeout(80);
  assert(/Nutrienti per porzione/.test(await p.textContent('#ov')) && await p.locator('#ov .rnut').count() === 1);
});
```

- [ ] **Step 2: Run to verify they fail** — `node tools/test.cjs "nutrienti:"` → i nuovi FAIL.
- [ ] **Step 3: Implementa** riquadro, vista, dettaglio, riga ricetta e testi `NUT_INFO`.
- [ ] **Step 4: Controllo visivo** — screenshot a 400 px chiaro e scuro: riquadro in Oggi, vista completa, dettaglio di un nutriente, scheda ricetta.
- [ ] **Step 5: Run all tests** → tutti PASS.
- [ ] **Step 6: Commit** — `git commit -am "feat: nutrienti in Oggi, vista completa e scheda ricetta"`

---

### Task 5: Revisione finale, unione e pubblicazione

- [ ] **Step 1:** `python3 tools/build.py && node tools/test.cjs` → tutti PASS.
- [ ] **Step 2:** Revisione dell'intero ramo con un revisore indipendente sul modello più capace; Critical/Important corretti con un test che fallisce prima.
- [ ] **Step 3:** Unisci `nutrienti` in `main`, push (GitHub Pages), pubblica l'artifact.
