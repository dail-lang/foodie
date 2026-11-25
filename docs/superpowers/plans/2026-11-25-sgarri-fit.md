# Sgarri fit e "Ho voglia di…" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un riquadro "Ho voglia di…" nella pagina Oggi che, per la voglia scelta, propone sgarri fatti in casa e scelte da locale che stanno nelle calorie rimaste; più ~25 nuovi sgarri fit e ~10 consigli su voglie e sgarri.

**Architecture:** Tutto in `src/app.html`. Le ricette sgarro ricevono un campo `v` (voglia); una tabella `FUORI` contiene le scelte da locale con valori indicativi; una funzione pura `cravingSuggest` decide cosa proporre e il riquadro in `viewOggi` la mostra. Le nuove ricette entrano nel piano come le altre (nessuna modifica a `makePlan`).

**Tech Stack:** HTML/CSS/JS senza dipendenze, Playwright (`node tools/test.cjs [filtro]`), `python3 tools/build.py`.

**Spec:** `docs/superpowers/specs/2026-11-25-sgarri-fit-design.md`

## Global Constraints

- Voglie e nomi esatti: `fast` "Fast food", `spalma` "Pane e Nutella", `pizza` "Pizza", `gelato` "Gelato", `dolce` "Dolce".
- Ricette: senza maiale, ≤ 30 minuti, 100–700 kcal, tag e unità ammessi dal test "100 ricette valide", voce in `MICRO`, nessuna dose a pezzi con la virgola; id con prefisso `v4-`.
- Scelte da locale: niente maiale o bacon; valori indicativi con la fonte scritta in pagina ("Valori indicativi: …").
- Soglia "calorie quasi finite": 150 kcal. Ordine: più proteine per kcal prima.
- Nessun tono colpevolizzante nei testi.
- Testi in italiano, colori da token, leggibile e toccabile a 400 px in chiaro e scuro; funziona offline.
- Le nuove ricette entrano nel piano come le esistenti; i test del piano (proteine, calorie, pesce/legumi, vegano ≥ 6 per pasto) restano verdi.
- Dopo ogni modifica: `python3 tools/build.py` prima dei test.

## Review Focus

1. **Calorie già superate** (rimaste ≤ 0): modo `low`, le 3 più leggere, frase gentile, mai "Ti restano -200 kcal". Test in Task 1 e Task 3.
2. **Profilo vegetariano o vegano**: nessuna carne né pesce nei suggerimenti, a casa e fuori; se fuori non c'è niente di adatto, la riga "Nessuna scelta adatta alla tua dieta qui". Test in Task 1.
3. **Giorno selezionato diverso da oggi** (`ui.dayOff`): le calorie rimaste sono quelle di quel giorno. Test in Task 3.
4. **Mezza porzione**: segnata nel diario come 0,5 porzioni con kcal dimezzate. Test in Task 3.
5. **Toccare di nuovo la stessa voglia** chiude il riquadro dei suggerimenti. Test in Task 3.

---

### Task 1: Voglie, scelte da locale e `cravingSuggest`

**Files:**
- Modify: `src/app.html` (dopo `TIPS`/`R`: costanti `VOGLIE`, `VOGLIA`, `FUORI`, `FUORI_SRC`, `VOGLIA_TIP`, funzione `cravingSuggest`)
- Test: `tools/test.cjs` (sezione "Ho voglia di")

**Interfaces:**
- Produces:
  - `VOGLIE: Array<{id:'fast'|'spalma'|'pizza'|'gelato'|'dolce', n:string}>` nell'ordine sopra.
  - Campo `r.v` sulle ricette sgarro; per le esistenti da una mappa `VOGLIA = {'<id ricetta>':'<voglia>'}` applicata all'avvio (prima di `prep`). Ricette senza voglia chiara: nessun `v`.
  - `FUORI: Array<{id:string, v:string, at:"McDonald's"|'KFC'|'Burger King'|'Pizzeria'|'Gelateria'|'Bar'|'Supermercato', n:string, k, p, c, f, tags:string[], heavy?:true}>` — `tags` come le ricette (`veg`, `vegan`) per riusare `dietOK`; almeno 4 scelte leggere per ogni voglia più 1 `heavy` per voglia ("Da evitare").
  - Per la voglia `fast` solo `at` in McDonald's, KFC, Burger King, con almeno 2 scelte leggere per catena.
  - `FUORI_SRC = {"McDonald's":'tabelle nutrizionali di McDonald's Italia', KFC:'tabelle nutrizionali di KFC Italia', 'Burger King':'tabelle nutrizionali di Burger King Italia', Pizzeria:'tabelle CREA', Gelateria:'tabelle CREA', Bar:'tabelle CREA', Supermercato:'etichette dei prodotti'}`.
  - `VOGLIA_TIP = {fast:string, spalma:string, pizza:string, gelato:string, dolce:string}` (una frase pratica ciascuno).
  - `cravingSuggest(v: string, left: number, dieta: string) -> {mode:'ok'|'half'|'light'|'low', home: Array<{r, x:1|0.5}>, out: Array<object>, avoid: object|null, tip: string}`:
    - `home` da `R` con tag `sgarro`, `r.v===v`, `dietOK(r,dieta)`; `out` da `FUORI` con `o.v===v`, non `heavy`, `dietOK(o,dieta)`.
    - `left < 150` → `mode 'low'`: le 3 più leggere (kcal crescenti) per `home` (x=1) e `out`.
    - altrimenti, se almeno una ricetta ha `k ≤ left` → `mode 'ok'`: quelle che stanno, ordinate per `p/k` decrescente, max 3, x=1;
    - altrimenti se almeno una ha `k*0.5 ≤ left` → `mode 'half'`: quelle a mezza porzione che stanno, per `p/k`, max 3, x=0.5;
    - altrimenti `mode 'light'`: le 3 più leggere, x=1.
    - `out`: in `ok`/`half` le scelte con `k ≤ left` per `p/k`, max 3; se nessuna sta (o in `low`/`light`) le 3 più leggere.
    - `avoid`: la `heavy` della voglia (adatta alla dieta) o `null`.

- [ ] **Step 1: Verifica i valori di McDonald's, KFC e Burger King Italia**

Per ogni prodotto usato in `FUORI` (es. Big Mac, Cheeseburger, Hamburger, McChicken, Chicken McNuggets 6 e 9, Filet-O-Fish, patatine piccole/medie/grandi, insalata, McFlurry, Sundae, Coca-Cola Zero; niente bacon) cerca kcal, proteine, carboidrati, grassi dalle tabelle ufficiali di McDonald's Italia (sito, PDF o pagine prodotto). Lo stesso per KFC (es. pezzi di pollo, tenders/strips, popcorn chicken, panini, patatine, insalata; niente bacon) e Burger King (es. Whopper, Whopper Jr, cheeseburger, chicken burger, nuggets, patatine; niente bacon). Se il sito non si raggiunge, usa i valori riportati da fonti che citano la tabella ufficiale e annota nel ledger quali valori non sono stati letti dalla fonte ufficiale. Big Mac ufficiale: 544 kcal, 27 p, 42 c, 29 f.

- [ ] **Step 2: Write the failing tests**

```js
test('voglie: 5 voglie e ricette sgarro esistenti assegnate', async p => {
  assertEq(await ev(p, () => [VOGLIE.map(v => v.id), R.filter(r => r.v).every(r => r.tags.includes('sgarro')), ['fast', 'spalma', 'pizza', 'gelato', 'dolce'].filter(v => !R.some(r => r.v === v))]),
    [['fast', 'spalma', 'pizza', 'gelato', 'dolce'], true, []]);
});
test('fuori: fast food solo McDonald\'s, KFC e Burger King, almeno 2 scelte ciascuno', async p => {
  assertEq(await ev(p, () => { const f = FUORI.filter(o => o.v === 'fast'); return [[...new Set(f.map(o => o.at))].sort(), ["McDonald's", 'KFC', 'Burger King'].map(a => f.filter(o => o.at === a && !o.heavy).length >= 2)]; }),
    [['Burger King', 'KFC', "McDonald's"], [true, true, true]]);
});
test('fuori: ogni voglia ha scelte e una da evitare, niente maiale', async p => {
  assertEq(await ev(p, () => VOGLIE.map(v => [FUORI.filter(o => o.v === v.id && !o.heavy).length >= 4, FUORI.filter(o => o.v === v.id && o.heavy).length === 1]).concat([[FUORI.filter(o => /bacon|maiale|prosciutto|salame|speck|pancetta/i.test(o.n)).length, 0]])),
    [[true, true], [true, true], [true, true], [true, true], [true, true], [0, 0]]);
});
test('cravingSuggest: tutto nelle calorie, più proteico prima', async p => {
  assertEq(await ev(p, () => { const s = cravingSuggest('fast', 900, 'onni'); return [s.mode, s.home.length > 0 && s.home.every(h => h.r.k <= 900 && h.x === 1), s.home.every((h, i) => !i || h.r.p / h.r.k <= s.home[i - 1].r.p / s.home[i - 1].r.k), s.out.every(o => o.k <= 900), !!s.avoid && s.avoid.heavy, typeof s.tip]; }),
    ['ok', true, true, true, true, 'string']);
});
test('cravingSuggest: mezza porzione, più leggere, calorie finite', async p => {
  assertEq(await ev(p, () => { const minK = Math.min(...R.filter(r => r.v === 'fast').map(r => r.k));
    const h = cravingSuggest('fast', Math.ceil(minK * .6), 'onni'), l = cravingSuggest('fast', Math.floor(minK * .45), 'onni'), z = cravingSuggest('fast', -200, 'onni');
    return [h.mode, h.home.every(x => x.x === .5 && x.r.k * .5 <= Math.ceil(minK * .6)), l.mode === 'light' || l.mode === 'low', z.mode, z.home.length > 0, z.out.length > 0]; }),
    ['half', true, true, 'low', true, true]);
});
test('cravingSuggest: vegano e vegetariano senza carne né pesce', async p => {
  assertEq(await ev(p, () => ['veg', 'vegan'].flatMap(d => VOGLIE.map(v => { const s = cravingSuggest(v.id, 900, d); return s.home.every(h => dietOK(h.r, d)) && s.out.every(o => dietOK(o, d)) && (!s.avoid || dietOK(s.avoid, d)); })).every(Boolean)), true);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `python3 tools/build.py && node tools/test.cjs voglie; node tools/test.cjs cravingSuggest; node tools/test.cjs "fuori:"`
Expected: FAIL con "VOGLIE is not defined" / "cravingSuggest is not defined".

- [ ] **Step 4: Implementa costanti, mappa `VOGLIA` e `cravingSuggest`**

- [ ] **Step 5: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat: voglie, scelte da locale e suggerimenti per lo sgarro"`

---

### Task 2: 25 nuovi sgarri fit

**Files:**
- Modify: `src/app.html` (array `R`, `MICRO`)
- Test: `tools/test.cjs`

**Interfaces:**
- Consumes: campo `v` e `VOGLIE` (Task 1).
- Produces: ricette `v4-*` con `tags` che includono `sgarro`, campo `v`.

- [ ] **Step 1: Write the failing test**

```js
test('25 sgarri fit v4-', async p => {
  const r = await ev(p, () => { const a = R.filter(r => r.id.startsWith('v4-')), by = v => a.filter(r => r.v === v);
    return { n: a.length, notSgarro: a.filter(r => !r.tags.includes('sgarro') || !r.v).map(r => r.id), slow: a.filter(r => r.t > 30).map(r => r.id),
      fast: by('fast').length, spalma: by('spalma').length, pizza: by('pizza').length, gelato: by('gelato').length, dolce: by('dolce').length,
      pasto: a.filter(r => r.m.some(m => m === 'pranzo' || m === 'cena')).length,
      vegFast: by('fast').filter(r => dietOK(r, 'veg')).length, vegPizza: by('pizza').filter(r => dietOK(r, 'veg')).length, noMicro: a.filter(r => !MICRO[r.id]).map(r => r.id) }; });
  assert(r.n >= 25 && !r.notSgarro.length && !r.slow.length && r.fast >= 8 && r.spalma >= 5 && r.pizza >= 4 && r.gelato >= 3 && r.dolce >= 3 && r.pasto >= 10 && r.vegFast >= 2 && r.vegPizza >= 2 && !r.noMicro.length, JSON.stringify(r));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 tools/build.py && node tools/test.cjs "sgarri fit v4"`
Expected: FAIL con `n: 0`.

- [ ] **Step 3: Scrivi le ricette**

Ingredienti con i nomi già usati nelle ricette esistenti (così spesa, reparti e punteggio antinfiammatorio li riconoscono); burger e pizza con farina raffinata restano < 6 nel punteggio antinfiammatorio come richiede il test esistente. Esempi dalla spec: smash burger fit, cheeseburger fit, burger con salsa "big" leggera, chicken burger croccante, wrap di pollo croccante, tenders in friggitrice ad aria, fish burger, patatine in friggitrice ad aria, McFlurry fit con yogurt greco, milkshake proteico, crema spalmabile nocciole e cacao, toast crema e banana, crêpe con crema fit, pizza in padella integrale, pizza su tortilla, calzone fit, mozzarelline al forno.

- [ ] **Step 4: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS, compresi i test del piano (proteine, calorie, vegano ≥ 6 per pasto, nessuna dose a pezzi con la virgola, nessun maiale).

- [ ] **Step 5: Commit** — `git commit -am "feat: 25 sgarri fit (fast food, crema spalmabile, pizza)"`

---

### Task 3: Riquadro "Ho voglia di…" nella pagina Oggi

**Files:**
- Modify: `src/app.html` (`viewOggi`, `HANDLERS`, CSS)
- Test: `tools/test.cjs`

**Interfaces:**
- Consumes: `VOGLIE`, `cravingSuggest`, `FUORI_SRC` (Task 1).
- Produces:
  - Stato `ui.voglia: string|null`.
  - Riquadro `.panel` con titolo "Ho voglia di…" sopra "Fuori piano"; chip `[data-act="voglia"][data-v]` con `aria-pressed`; risultati in `#vg-res`.
  - Righe fatto in casa: pulsante `data-open="<id>" data-x="<x>"` "Ricetta" e `[data-act="vgadd"][data-id][data-x]` "Segna" (aggiunge come `addr`: `{n: r.n + (x!==1?' (½ porz.)':''), rid, k:r.k*x, …, src:'r'}`).
  - Righe da locale: `[data-act="vgout"][data-o="<id>"]` "Segna" → `{n:`${o.at}: ${o.n}`, k,p,c,f, src:'q'}`.
  - Testi: "Ti restano N kcal oggi." (N ≥ 0); `low`: "Oggi le calorie sono quasi finite: se proprio ti va, scegli la più leggera e domani riparti normale, senza saltare pasti."; `light`: "Ti restano N kcal: queste sono le scelte più leggere."; `half`: le righe dicono "½ porzione"; riga "Da evitare: …"; riga "Valori indicativi: <fonte>"; se `out` è vuoto per la dieta: "Nessuna scelta adatta alla tua dieta qui."

- [ ] **Step 1: Write the failing tests**

```js
test('ho voglia: suggerimenti, segna fatto in casa e da locale', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="fast"]'); await p.waitForTimeout(80);
  const txt = await p.textContent('#vg-res');
  await p.locator('[data-act="vgadd"]').first().click(); await p.waitForTimeout(80);
  await p.click('[data-act="voglia"][data-v="fast"]'); await p.waitForTimeout(80);
  await p.locator('[data-act="vgout"]').first().click(); await p.waitForTimeout(80);
  assertEq([/Ti restano \d+ kcal/.test(txt), /Da evitare/.test(txt), /Valori indicativi/.test(txt), await ev(p, () => dayLog().items.map(i => i.src))], [true, true, true, ['r', 'q']]);
});
test('ho voglia: stessa voglia di nuovo chiude', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="pizza"]'); await p.click('[data-act="voglia"][data-v="pizza"]'); await p.waitForTimeout(80);
  assertEq(await p.locator('#vg-res [data-act="vgadd"]').count(), 0);
});
test('ho voglia: calorie superate, frase gentile, niente numeri negativi', async p => {
  await ev(p, () => { location.hash = 'oggi'; dayLog().items.push({ n: 'Pranzo grande', k: 5000, p: 0, c: 0, f: 0, src: 'q' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="dolce"]'); await p.waitForTimeout(80);
  const t = await p.textContent('#vg-res');
  assert(/quasi finite/.test(t) && !/-\d+ kcal/.test(t) && await p.locator('#vg-res [data-act="vgadd"]').count() > 0, t);
});
test('ho voglia: mezza porzione segnata a metà', async p => {
  await ev(p, () => { location.hash = 'oggi'; const c = calc(profile), minK = Math.min(...R.filter(r => r.v === 'fast' && dietOK(r, profile.dieta)).map(r => r.k));
    dayLog().items.push({ n: 'Pasti', k: c.target - Math.ceil(minK * .6), p: 0, c: 0, f: 0, src: 'q' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="fast"]'); await p.waitForTimeout(80);
  const id = await p.locator('[data-act="vgadd"]').first().getAttribute('data-id');
  await p.locator('[data-act="vgadd"]').first().click(); await p.waitForTimeout(80);
  assertEq(await ev(p, id => { const i = dayLog().items.slice(-1)[0]; return [Math.round(i.k), /½/.test(i.n)]; }, id), [await ev(p, id => Math.round(byId[id].k / 2), id), true]);
});
test('ho voglia: conta il giorno selezionato', async p => {
  await ev(p, () => { location.hash = 'oggi'; ui.dayOff = 1; dayLog().items.push({ n: 'Ieri', k: 5000, p: 0, c: 0, f: 0, src: 'q' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="gelato"]'); await p.waitForTimeout(80);
  assert(/quasi finite/.test(await p.textContent('#vg-res')));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `python3 tools/build.py && node tools/test.cjs "ho voglia"`
Expected: FAIL (nessun `[data-act="voglia"]`).

- [ ] **Step 3: Implementa il riquadro e gli handler**

Le calorie rimaste sono `calc(profile).target` meno la somma `k` di `peekLog(selDate())`. Il riquadro si ridisegna con la vista (`viewOggi`) dopo "Segna", come gli altri pulsanti del diario.

- [ ] **Step 4: Controllo visivo**

Screenshot a 400 px chiaro e scuro con la voglia "Fast food" aperta: chip e pulsanti distinti dallo sfondo, niente scroll orizzontale.

- [ ] **Step 5: Run all tests**

Run: `python3 tools/build.py && node tools/test.cjs`
Expected: tutti PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat: riquadro Ho voglia di nella pagina Oggi"`

---

### Task 4: Consigli "Voglie e sgarri"

**Files:**
- Modify: `src/app.html` (`TIPS`)
- Test: `tools/test.cjs`

- [ ] **Step 1: Write the failing test**

```js
test('consigli voglie e sgarri', async p => {
  const r = await ev(p, () => TIPS.filter(t => t.cat === 'Voglie e sgarri').map(t => !!(t.t && t.b && t.src)));
  assert(r.length >= 10 && r.every(Boolean), JSON.stringify(r));
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await p.click('[data-cat="Voglie e sgarri"]'); await p.waitForTimeout(80);
  assert(await p.locator('#v-consigli article.tip').count() >= 10);
});
```

- [ ] **Step 2: Run to verify it fails** — `python3 tools/build.py && node tools/test.cjs "consigli voglie"` → FAIL (`[]`).

- [ ] **Step 3: Scrivi le 10+ schede** con i temi della spec, stesso formato di `cat:'Abitudini'` (`t`, `b`, `src`), nessun tono colpevolizzante, nessuna promessa di cura.

- [ ] **Step 4: Run all tests** — `python3 tools/build.py && node tools/test.cjs` → tutti PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: consigli su voglie e sgarri"`

---

### Task 5: Revisione finale, unione e pubblicazione

- [ ] **Step 1:** `python3 tools/build.py && node tools/test.cjs` → tutti PASS.
- [ ] **Step 2:** Revisione dell'intero ramo con un revisore indipendente sul modello più capace; Critical/Important corretti con test che falliscono prima.
- [ ] **Step 3:** Unisci `sgarri-fit` in `main`, push (GitHub Pages), pubblica l'artifact (`src/app.html`, stesso URL).
