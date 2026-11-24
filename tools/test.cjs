// Test di Foodie: apre index.html in Chromium e chiama le funzioni globali della pagina.
// Uso: node tools/test.cjs [filtro-nome]
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const tests = [];
const test = (name, fn, opts = {}) => tests.push({ name, fn, opts });
const ev = (p, fn, ...args) => p.evaluate(fn, ...args);
const assert = (c, msg = 'asserzione fallita') => { if (!c) throw new Error(msg); };
const assertEq = (a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`atteso ${y}\n      trovato ${x}`); };
const keyOf = (offset = 0) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - offset); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const REAL = { sesso: 'm', eta: 30, peso: 72, alt: 178, att: 'leggero', obj: 'ricomp', dieta: 'onni', sf: true };

/* ---------- Task 1: comportamento esistente ---------- */
test('si apre senza errori', async p => { assert(await ev(p, () => document.querySelectorAll('.day').length) === 7); });
test('piano: 7 giorni, 2 pesce e 3 legumi', async p => {
  const r = await ev(p, () => { makePlan(); let f = 0, l = 0; plan.days.forEach(d => ['pranzo', 'cena'].forEach(s => { const t = byId[d[s].id].tags; if (t.includes('pesce')) f++; if (t.includes('legumi')) l++; })); return { n: plan.days.length, f, l }; });
  assert(r.n === 7 && r.f >= 2 && r.l >= 3, JSON.stringify(r));
});
test('calcolatore: pizza e birra', async p => {
  const a = await ev(p, () => analyzeFood('2 fette di pizza margherita e una birra media').items.map(i => Math.round(i.g)));
  assertEq(a, [110, 400]);
});
test('[RF 1] dati vecchi non rompono l’app', async p => {
  assert(await ev(p, () => plan.days.length === 7 && plan.days.every(d => byId[d.colazione.id])), 'piano non rigenerato');
}, { seed: { 'pp.plan': { days: [{ colazione: { id: 'non-esiste', x: 1 } }], target: 2000 }, ['pp.log']: { [keyOf(1)]: { items: [{ n: 'x', k: 100, p: 5, c: 0, f: 0, src: 'q' }], water: 2 } } } });

/* ---------- Task 2: ricette ---------- */
test('100 ricette valide', async p => {
  const r = await ev(p, () => ({ n: R.length, bad: R.filter(r => !r.id || !r.n || !r.m.length || !r.ing.length || !r.s.length || r.k < 100 || r.k > 700 || !r.m.every(m => ['colazione', 'pranzo', 'cena', 'spuntino'].includes(m)) || !r.tags.every(t => ['veg', 'vegan', 'pesce', 'legumi', 'carne', 'gf', 'sgarro', 'mia'].includes(t)) || !r.ing.every(i => ['g', 'ml', 'pz', 'cucchiai', 'q.b.'].includes(i[2]))).map(r => r.id) }));
  assert(r.n >= 100 && r.bad.length === 0, `ricette ${r.n}, non valide: ${r.bad.join(',')}`);
});
test('id unici e micronutrienti', async p => {
  const r = await ev(p, () => ({ dup: R.length - new Set(R.map(r => r.id)).size, noMicro: R.filter(r => !r.tags.includes('mia') && !MICRO[r.id]).map(r => r.id) }));
  assert(r.dup === 0 && r.noMicro.length === 0, JSON.stringify(r));
});
test('nessun maiale', async p => {
  const bad = await ev(p, () => R.flatMap(r => r.ing.map(i => i[0]).concat(r.n)).map(x => x.replace(/senza \w+/gi, '')).filter(x => /maiale|strutto|pancetta|guanciale|prosciutto|salame|speck|mortadella|gelatina|lardo/i.test(x)));
  assertEq(bad, []);
});
test('[RF 4] vegano e vegetariano hanno ≥ 6 ricette per pasto', async p => {
  const r = await ev(p, () => { const out = {}; for (const d of ['veg', 'vegan']) { profile.dieta = d; for (const m of ['colazione', 'pranzo', 'cena', 'spuntino']) out[d + '-' + m] = pool(m).length; } return out; });
  const low = Object.entries(r).filter(([, n]) => n < 6);
  assert(!low.length, JSON.stringify(low));
});

/* ---------- Task 3: diario rapido ---------- */
test('segna dal piano e annulla', async p => {
  const r = await ev(p, () => { const k = todayKey(), ti = (new Date().getDay() + 6) % 7; toggleEaten(ti, 'pranzo', k); const a = (log[k] || { items: [] }).items.filter(i => i.src === 'plan:pranzo').length; toggleEaten(ti, 'pranzo', k); const b = (log[k] || { items: [] }).items.length; return [a, b]; });
  assertEq(r, [1, 0]);
});
test('tutto come da piano', async p => {
  const r = await ev(p, () => { const k = todayKey(), ti = (new Date().getDay() + 6) % 7; toggleEaten(ti, 'colazione', k); eatAllPlanned(k); eatAllPlanned(k); return log[k].items.map(i => i.src).sort(); });
  assertEq(r, ['plan:cena', 'plan:colazione', 'plan:pranzo', 'plan:spuntino']);
});
test('recenti: max 8, niente doppioni', async p => {
  const r = await ev(p, () => { for (let i = 0; i < 9; i++) pushRecent({ t: 'cibo ' + i }); pushRecent({ t: 'cibo 3' }); const x = store.get('recent', []); return [x.length, x[0].t, x.filter(e => e.t === 'cibo 3').length]; });
  assertEq(r, [8, 'cibo 3', 1]);
});
test('recente con un tocco aggiunge al diario', async p => {
  await ev(p, () => { pushRecent({ t: 'cappuccino e cornetto' }); location.hash = 'oggi'; });
  await p.waitForTimeout(150);
  await p.locator('[data-act="recent"]').first().click();
  const n = await ev(p, () => dayLog().items.length);
  assertEq(n, 1);
});

/* ---------- Task 4: spesa per reparto ---------- */
test('reparti', async p => {
  const r = await ev(p, () => ['Salmone', 'Yogurt greco 0%', 'Uova', 'Zucchine', 'Pasta integrale', 'Ceci cotti', 'Noci', 'Olio extravergine d\'oliva', 'Tonno al naturale'].map(aisleOf));
  assertEq(r, ['Carne e pesce', 'Latticini e uova', 'Latticini e uova', 'Frutta e verdura', 'Pane, pasta e cereali', 'Legumi e conserve', 'Frutta secca e semi', 'Dispensa e condimenti', 'Carne e pesce']);
});
test('in Dispensa finiscono solo condimenti', async p => {
  const odd = await ev(p, () => [...new Set(R.flatMap(r => r.ing).filter(i => i[2] !== 'q.b.').map(i => i[0]))].filter(n => aisleOf(n) === 'Dispensa e condimenti' && !/olio|miele|cacao|lievito|salsa|tahina|agar|brodo|aceto|curry|cannella|zucchero|granola|cioccolato|burro d|burro di|cocco|caff|curcuma|tè verde/i.test(n)));
  assertEq(odd, []);
});
test('lista spesa raggruppata', async p => {
  await ev(p, () => { ui.showShop = true; location.hash = 'piano'; render(); });
  const heads = await ev(p, () => [...document.querySelectorAll('.shop .aisle h3')].map(h => h.textContent.replace(/\s*\d+$/, '').trim()));
  assert(heads.length >= 5 && heads[0] === 'Frutta e verdura', JSON.stringify(heads));
});

/* ---------- Task 5: backup ---------- */
test('export → import ripristina', async p => {
  const r = await ev(p, () => { const s = exportData(); const before = localStorage.getItem('pp.profile'); localStorage.clear(); const res = importData(s); return [res.ok, localStorage.getItem('pp.profile') === before, JSON.parse(s).app]; });
  assertEq(r, [true, true, 'foodie']);
}, { seed: { 'pp.profile': REAL, 'pp.log': { [keyOf(0)]: { items: [{ n: 'x', k: 100, p: 5, c: 0, f: 0, src: 'q' }], water: 3 } } } });
test('[RF 2] backup non valido non tocca i dati', async p => {
  const r = await ev(p, () => { const before = localStorage.getItem('pp.profile'); const a = importData('ciao'), b = importData('{"app":"altra","data":{"profile":{}}}'), c = importData('{"app":"foodie","v":1,"data":"x"}'); return [a.ok, b.ok, c.ok, !!a.msg, localStorage.getItem('pp.profile') === before]; });
  assertEq(r, [false, false, false, true, true]);
}, { seed: { 'pp.profile': REAL } });
test('riquadro backup in Profilo', async p => {
  await ev(p, () => { location.hash = 'profilo'; });
  await p.waitForTimeout(150);
  assert(await p.locator('[data-act="backup-copy"]').count() === 1 && await p.locator('#bk-in').count() === 1);
});

/* ---------- Task 6: voto, serie, allenamenti ---------- */
const fibItems = (k, p) => [{ n: 'a', k: k - 2, p, c: 0, f: 0, fib: 5, src: 'q' }, { n: 'b', k: 1, p: 0, c: 0, f: 0, fib: 4, src: 'q' }, { n: 'c', k: 1, p: 0, c: 0, f: 0, fib: 3, src: 'q' }];
test('voto: giorno perfetto = 100', async p => {
  const r = await ev(p, its => dayScore({ items: its, water: 8, train: 'A' }, { target: 2000, prot: 140 }, true), fibItems(2000, 150));
  assertEq(r.score, 100);
});
test('voto: calorie +25% → 15 punti kcal', async p => {
  const r = await ev(p, its => dayScore({ items: its, water: 8, train: 'A' }, { target: 2000, prot: 140 }, true), fibItems(2500, 150));
  assertEq(Math.round(r.parts.kcal), 15);
});
test('voto: riposo conta pieno, allenamento saltato conta 0', async p => {
  const r = await ev(p, its => [dayScore({ items: its, water: 8 }, { target: 2000, prot: 140 }, false).parts.train, dayScore({ items: its, water: 8 }, { target: 2000, prot: 140 }, true).parts.train], fibItems(2000, 150));
  assertEq(r, [15, 0]);
});
test('voto: giorno vuoto = null', async p => { assertEq(await ev(p, () => dayScore({ items: [], water: 5 }, { target: 2000, prot: 140 }, false)), null); });
test('voto: fibre dalle ricette del piano', async p => {
  const r = await ev(p, () => { const ids = R.filter(r => r.mi.includes('fibre')).slice(0, 3); const its = ids.map(r => ({ n: r.n, rid: r.id, k: 600, p: 40, c: 0, f: 0, src: 'r' })); return dayScore({ items: its, water: 0 }, { target: 1800, prot: 120 }, false).parts.fibre; });
  assertEq(r, 15);
});
const it1 = { items: [{ n: 'x', k: 500, p: 30, c: 0, f: 0, src: 'q' }], water: 0 };
test('[RF 3] serie con un buco', async p => { assertEq((await ev(p, () => streaks(todayKey()))).logged, 2); }, { seed: { 'pp.log': { [keyOf(0)]: it1, [keyOf(1)]: it1, [keyOf(3)]: it1 } } });
test('serie da ieri se oggi è vuoto', async p => { assertEq((await ev(p, () => streaks(todayKey()))).logged, 2); }, { seed: { 'pp.log': { [keyOf(1)]: it1, [keyOf(2)]: it1, [keyOf(4)]: it1 } } });
test('allenamenti della settimana', async p => {
  const r = await ev(p, () => { const d = new Date(); d.setHours(12); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const wed = new Date(mon); wed.setDate(mon.getDate() + 2); setTrain(todayKey(mon), 'A'); setTrain(todayKey(wed), 'B'); return weekTrainCount(d); });
  assertEq(r, 2);
});
test('isTrainDay: lun, mer, ven', async p => {
  assertEq(await ev(p, () => [1, 2, 3, 4, 5, 6, 0].map(g => { const d = new Date(2026, 10, 23); d.setDate(23 + ((g + 6) % 7)); return isTrainDay(d); })), [true, false, true, false, true, false, false]);
});
test('Oggi mostra voto e serie', async p => {
  await ev(p, () => { location.hash = 'oggi'; });
  await p.waitForTimeout(150);
  assert(await p.locator('.score-ring').count() === 1 && await p.locator('.streak').count() === 1);
}, { seed: { 'pp.log': { [keyOf(0)]: it1 } } });

/* ---------- Task 7: medaglie ---------- */
test('14 medaglie definite', async p => { assertEq(await ev(p, () => BADGES.length), 14); });
test('primo passo si sblocca una volta', async p => {
  const r = await ev(p, () => { toggleEaten((new Date().getDay() + 6) % 7, 'pranzo', todayKey()); const a = checkBadges(); const b = checkBadges(); return [a.includes('primo'), b.length, !!store.get('badges', {}).primo]; });
  assertEq(r, [true, 0, true]);
}, { seed: { 'pp.profile': REAL } });
test('[RF 5] profilo di esempio non sblocca medaglie', async p => {
  const r = await ev(p, () => { toggleEaten((new Date().getDay() + 6) % 7, 'pranzo', todayKey()); return [checkBadges().length, Object.keys(store.get('badges', {})).length]; });
  assertEq(r, [0, 0]);
});
test('−1 cm di giro vita', async p => {
  const r = await ev(p, () => checkBadges());
  assert(r.includes('vita1') && !r.includes('vita3'), JSON.stringify(r));
}, { seed: { 'pp.profile': REAL, 'pp.prog': [{ d: keyOf(14), t: 1, peso: 72, vita: 90 }, { d: keyOf(0), t: 2, peso: 71, vita: 88.5 }] } });
test('serie 3', async p => {
  const r = await ev(p, () => checkBadges());
  assert(r.includes('serie3') && !r.includes('serie7'), JSON.stringify(r));
}, { seed: { 'pp.profile': REAL, 'pp.log': { [keyOf(0)]: it1, [keyOf(1)]: it1, [keyOf(2)]: it1 } } });
test('chef 10 dopo 10 cotture', async p => {
  const r = await ev(p, () => { store.set('cooked', 9); const a = checkBadges().includes('chef10'); store.set('cooked', 10); return [a, checkBadges().includes('chef10')]; });
  assertEq(r, [false, true]);
}, { seed: { 'pp.profile': REAL } });
test('toast quando si sblocca una medaglia', async p => {
  await ev(p, () => { location.hash = 'oggi'; });
  await p.waitForTimeout(150);
  await p.locator('.meal [data-act="eat"]').first().click();
  await p.waitForTimeout(200);
  assert(await p.locator('.toast').count() >= 1, 'nessun toast');
}, { seed: { 'pp.profile': REAL } });
test('griglia medaglie in Oggi', async p => {
  await ev(p, () => { location.hash = 'oggi'; });
  await p.waitForTimeout(150);
  assertEq(await p.locator('.badge-card').count(), 14);
});

test('più medaglie insieme = un solo avviso', async p => {
  const n = await ev(p, () => { toggleEaten((new Date().getDay() + 6) % 7, 'pranzo', todayKey()); celebrate(); return document.querySelectorAll('.toast').length; });
  assertEq(n, 1);
}, { seed: { 'pp.profile': REAL, 'pp.log': { [keyOf(1)]: it1, [keyOf(2)]: it1 }, 'pp.prog': [{ d: keyOf(9), t: 1, vita: 90 }, { d: keyOf(0), t: 2, vita: 88 }] } });

test('gnocchi tra i cereali', async p => { assertEq(await ev(p, () => aisleOf('Gnocchi di patate')), 'Pane, pasta e cereali'); });
test('anello del voto grande', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(150);
  const w = await p.locator('.score-ring').evaluate(e => e.getBoundingClientRect().width);
  assert(w >= 80, 'larghezza ' + w);
});

/* ---------- Revisione finale ---------- */
test('backup con contenuto rovinato non tocca i dati', async p => {
  const r = await ev(p, () => { const before = JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    const bad = [{ profile: null }, { profile: 'x' }, { plan: { target: 2000 } }, { mine: {} }, { prog: null }, { log: { '2026-01-01': { water: 2 } } }, { profile: { peso: 70, alt: 175, eta: 30, sesso: 'm', att: 'leggero', obj: 'giu', dieta: 'onni' }, cooked: 'tanti' }];
    const res = bad.map(d => importData(JSON.stringify({ app: 'foodie', v: 1, data: d })).ok);
    return [res, JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))) === before]; });
  assertEq(r, [[false, false, false, false, false, false, false], true]);
}, { seed: { 'pp.profile': REAL } });
test('nell’obiettivo resiste a un giorno appena iniziato', async p => {
  const r = await ev(p, () => { const c = calc(profile); const good = { items: [{ n: 'a', k: c.target - 2, p: c.prot + 5, c: 0, f: 0, fib: 5, src: 'q' }, { n: 'b', k: 1, p: 0, c: 0, f: 0, fib: 4, src: 'q' }, { n: 'c', k: 1, p: 0, c: 0, f: 0, fib: 3, src: 'q' }], water: 8, train: 'A' };
    for (let i = 1; i <= 3; i++) { const d = new Date(); d.setDate(d.getDate() - i); log[todayKey(d)] = JSON.parse(JSON.stringify(good)); }
    log[todayKey()] = { items: [{ n: 'colazione', k: 400, p: 20, c: 0, f: 0, src: 'q' }], water: 1 };
    return streaks(todayKey()); });
  assertEq(r, { logged: 4, good: 3 });
}, { seed: { 'pp.profile': REAL } });
test('Oggi: pasti prima di allenamento e medaglie in fondo', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(150);
  const y = await ev(p, () => { const top = s => document.querySelector(s).getBoundingClientRect().top; return { eat: top('#v-oggi [data-act="eat"]'), txt: top('#q-txt'), train: top('#v-oggi [data-act="train"]'), badges: top('#v-oggi .badges'), prog: top('#pr-peso') }; });
  assert(y.eat < y.train && y.txt < y.train && y.badges > y.prog, JSON.stringify(y));
});
test('ricette senza glutine non hanno cereali col glutine', async p => {
  const bad = await ev(p, () => R.filter(r => r.tags.includes('gf') && r.ing.some(i => /pangrattato|pasta|^pane|farro|orzo|cous|avena|farina(?! di mais)|piadina|biscotti|savoiardi|cracker|tortillas integrali|sfoglie|gnocchi|corn flakes/i.test(i[0]))).map(r => r.id));
  assertEq(bad, []);
});

/* ---------- Antinfiammatorio, Task 1: punteggio ---------- */
test('taratura: 25–40% delle ricette attuali antinfiammatorie', async p => {
  const r = await ev(p, () => { const base = R.filter(r => !r.tags.includes('mia')).slice(0, 100); return base.filter(isAI).length / base.length; });
  assert(r >= .25 && r <= .40, 'quota ' + r);
});
test('pizza e sgarri con farina sotto 6', async p => {
  const r = await ev(p, () => R.filter(r => r.id === 'pizza-yogurt' || (r.tags.includes('sgarro') && r.ing.some(i => /farina(?! d.avena)|savoiardi|biscotti/i.test(i[0])))).filter(isAI).map(r => r.id));
  assertEq(r, []);
});
test('salmone ai pistacchi e zuppa di ceci sopra 6', async p => { assertEq(await ev(p, () => ['salmone-pistacchi', 'zuppa-ceci'].map(id => isAI(byId[id]))), [true, true]); });
test('[RF 2] ricetta senza grammi', async p => {
  const s = await ev(p, () => aiScore({ ing: [['Curcuma', '0', 'q.b.'], ['Zenzero', '0', 'q.b.']], s: [], tags: [] }));
  assert(Number.isFinite(s) && s >= 0 && s <= 10, String(s));
});
test('livelli validi', async p => { assertEq(await ev(p, () => ANTI.filter(a => !['solide', 'promettenti', 'tradizionale', 'limitare'].includes(a.lv)).length), 0); });

/* ---------- Antinfiammatorio, Task 2: 20 ricette ---------- */
test('20 ricette ai- valide e antinfiammatorie', async p => {
  const r = await ev(p, () => { const a = R.filter(r => r.id.startsWith('ai-')); return { n: a.length, notAI: a.filter(r => !isAI(r)).map(r => r.id + ':' + aiScore(r)), slow: a.filter(r => r.t > 30).map(r => r.id), vegan: a.filter(r => r.tags.includes('vegan')).length, prot30: a.filter(r => r.p >= 30).length, noMicro: a.filter(r => !MICRO[r.id]).map(r => r.id) }; });
  assert(r.n === 20 && !r.notAI.length && !r.slow.length && r.vegan >= 4 && r.prot30 >= 6 && !r.noMicro.length, JSON.stringify(r));
});

/* ---------- Task 2b: 40 ricette in più ---------- */
test('40 ricette v3- valide', async p => {
  const r = await ev(p, () => { const a = R.filter(r => r.id.startsWith('v3-')); return { n: a.length, sgarri: a.filter(r => r.tags.includes('sgarro')).length, slow: a.filter(r => r.t > 30).map(r => r.id), tot: R.filter(r => !r.tags.includes('mia')).length }; });
  assert(r.n === 40 && r.sgarri >= 12 && !r.slow.length && r.tot >= 160, JSON.stringify(r));
});

/* ---------- Antinfiammatorio, Task 3: modalità, filtro, schede ---------- */
test('[RF 4] profilo senza ai: casella spenta', async p => { await ev(p, () => { location.hash = 'profilo'; }); await p.waitForTimeout(150); assertEq(await p.locator('#f-ai').isChecked(), false); }, { seed: { 'pp.profile': REAL } });
test('modalità ai alza il punteggio medio del piano', async p => {
  const r = await ev(p, () => { const avg = () => { let s = 0, n = 0; for (let k = 0; k < 15; k++) { makePlan(); plan.days.forEach(d => SLOTS_IDS.forEach(sl => { s += aiScore(byId[d[sl].id]); n++; })); } return s / n; }; profile.ai = false; const off = avg(); profile.ai = true; const on = avg(); return on - off; });
  assert(r >= 0.8, 'differenza ' + r);
}, { seed: { 'pp.profile': REAL } });
test('filtro Antinfiammatoria', async p => { const r = await ev(p, () => { ui.flt = new Set(['ai']); const l = filtered().list; return [l.every(isAI), l.length]; }); assert(r[0] && r[1] >= 30, JSON.stringify(r)); });
test('scheda mostra livelli di prova', async p => {
  await ev(p, () => openRecipe('salmone-pistacchi', 1)); await p.waitForTimeout(100);
  assert(/prove solide/.test(await p.locator('.sheet').innerText()));
});
test('[RF 5] piano salvato non si rigenera', async p => {
  const a = await ev(p, () => { makePlan(); return JSON.stringify(plan.days); });
  await p.reload(); await p.waitForTimeout(300);
  assertEq(await ev(p, () => JSON.stringify(plan.days)), a);
}, { seed: { 'pp.profile': REAL } });
test('salvare il profilo memorizza ai', async p => {
  await ev(p, () => { location.hash = 'profilo'; }); await p.waitForTimeout(150);
  await p.check('#f-ai'); await p.click('#pf button[type=submit]'); await p.waitForTimeout(150);
  assertEq(await ev(p, () => store.get('profile', {}).ai), true);
}, { seed: { 'pp.profile': REAL } });

/* ---------- Antinfiammatorio, Task 4: proteine del piano ---------- */
const planStats = async (p, opts) => ev(p, o => { Object.assign(profile, o); const c = calc(profile); let low = 0, n = 0, kcal = 0, bad = 0; for (let k = 0; k < 40; k++) { makePlan(); let f = 0, l = 0; const cnt = {}; plan.days.forEach(d => { const t = dayTotals(d); n++; kcal += t.k; if (t.p < .9 * c.prot) low++; ['pranzo', 'cena'].forEach(s => { const tg = byId[d[s].id].tags; if (tg.includes('pesce')) f++; if (tg.includes('legumi')) l++; }); SLOTS_IDS.forEach(s => cnt[d[s].id] = (cnt[d[s].id] || 0) + 1); }); if ((o.dieta === 'onni' && f < 2) || l < 3 || Object.values(cnt).some(v => v > 2)) bad++; } return { low: low / n, kcal: kcal / n / c.target, bad }; }, opts);
for (const [nome, o] of [['base', { sf: false, ai: false }], ['superfood', { sf: true, ai: false }], ['antinfiammatoria', { sf: false, ai: true }], ['entrambe', { sf: true, ai: true }]]) {
  test('proteine piano ' + nome, async p => { const r = await planStats(p, { ...o, dieta: 'onni' }); assert(r.low <= .10 && Math.abs(r.kcal - 1) <= .05 && r.bad === 0, JSON.stringify(r)); }, { seed: { 'pp.profile': REAL } });
}
test('[RF 1] vegano con antinfiammatoria resta vegano', async p => {
  const r = await ev(p, () => { profile.dieta = 'vegan'; profile.ai = true; let ok = true; for (let k = 0; k < 10; k++) { makePlan(); ok = ok && plan.days.every(d => SLOTS_IDS.every(s => byId[d[s].id].tags.includes('vegan'))); } return ok; });
  assert(r);
}, { seed: { 'pp.profile': REAL } });
test('[RF 3] nessun sostituto possibile: niente loop', async p => {
  const r = await ev(p, () => { const t0 = performance.now(); profile.peso = 200; makePlan(); return [plan.days.length, performance.now() - t0 < 2000]; });
  assertEq(r, [7, true]);
}, { seed: { 'pp.profile': REAL } });

/* ---------- Antinfiammatorio, Task 5: consigli ---------- */
test('consigli antinfiammatori con livello', async p => {
  const r = await ev(p, () => TIPS.filter(t => t.cat === 'Antinfiammatorio').map(t => t.lv));
  assert(r.length >= 9 && r.every(l => ['solide', 'promettenti', 'tradizionale', 'limitare'].includes(l)), JSON.stringify(r));
});
test('consigli mostrano il livello', async p => {
  await ev(p, () => { ui.cat = 'Antinfiammatorio'; location.hash = 'consigli'; }); await p.waitForTimeout(150);
  assert(/prove solide/.test(await p.locator('#v-consigli .tips').innerText()));
});

/* ---------- Revisione finale antinfiammatorio ---------- */
test('niente falsi abbinamenti antinfiammatori', async p => {
  const r = await ev(p, () => ['Latte parz. scremato', 'Fiocchi di latte', 'Latte di cocco light', 'Grana', 'Verdure per minestrone (anche surgelate)', 'Olive verdi', 'Fagioli cannellini cotti', 'Tè verde', 'Lattuga', 'Granola fatta in casa'].map(n => { const a = aiEntry(n); return a ? a.id : null; }));
  assertEq(r, [null, null, null, null, null, null, 'legumi', 'te', 'foglia', 'integrali']);
});
test('farine di avena e ceci e muesli non sono da limitare', async p => {
  const r = await ev(p, () => [aiEntry('Farina d\'avena'), aiEntry('Farina di ceci'), aiEntry('Muesli senza zucchero'), aiEntry('Farina d\'avena', { dough: true }), aiEntry('Farina integrale', { dough: true })].map(a => a && a.id));
  assertEq(r, ['integrali', 'legumi', 'integrali', 'integrali', 'raffinati']);
});
test('correzione proteine non peggiora la copertura Superfood', async p => {
  const r = await ev(p, () => { profile.sf = true; let miss = 0; for (let k = 0; k < 40; k++) { makePlan(); const c = coverage(plan.days); miss += Object.keys(NUTR).filter(m => c[m] < NUTR[m].w).length; } return miss / 40; });
  assert(r <= .75, 'nutrienti mancanti in media ' + r);
}, { seed: { 'pp.profile': REAL } });
test('niente stesso piatto due giorni di fila', async p => {
  const r = await ev(p, () => { profile.sf = true; profile.ai = true; let rep = 0; for (let k = 0; k < 40; k++) { makePlan(); for (let d = 1; d < 7; d++) SLOTS_IDS.forEach(s => { if (plan.days[d][s].id === plan.days[d - 1][s].id) rep++; }); } return rep; });
  assert(r <= 10, 'ripetizioni consecutive ' + r);
}, { seed: { 'pp.profile': REAL } });
test('il punteggio non viene salvato nelle ricette mie', async p => {
  const r = await ev(p, () => { const f = new FormData(); f.set('n', 'Prova'); f.append('m', 'pranzo'); f.set('t', '10'); f.set('p', '30'); f.set('c', '40'); f.set('f', '10'); f.set('ing', '150 g salmone\n100 g spinaci'); f.set('s', 'Cuoci.'); f.set('h', ''); saveMine(f); const r = R[R.length - 1]; aiScore(r); store.set('mine', mine); return '_ai' in store.get('mine', [])[0]; });
  assertEq(r, false);
});
test('consiglio zenzero senza certezze', async p => { assert(await ev(p, () => !TIPS.some(t => t.cat === 'Antinfiammatorio' && /sicuramente/i.test(t.b)))); });

/* ---------- Uova intere ---------- */
test('nessuna ricetta con pezzi frazionari', async p => {
  assertEq(await ev(p, () => R.flatMap(r => r.ing.filter(i => i[2] === 'pz' && !Number.isInteger(+i[1])).map(i => r.id))), []);
});
test('pezzi mostrati sempre interi', async p => {
  assertEq(await ev(p, () => [qty(2.5, 'pz'), qty(1.5, 'pz'), qty(0.6, 'pz'), qty(2, 'pz')]), ['3', '2', '1', '2']);
});
test('nessuna dose a pezzi con la virgola, a qualsiasi porzione', async p => {
  const bad = await ev(p, () => { const out = []; R.forEach(r => [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].forEach(x => r.ing.filter(i => i[2] === 'pz').forEach(i => { const t = qty(i[1] * x, 'pz'); if (/[.,]/.test(t)) out.push(r.id + ' x' + x + ' ' + t); }))); return out; });
  assertEq(bad, []);
});
test('lista spesa: uova intere arrotondate per eccesso', async p => {
  const r = await ev(p, () => { plan = { days: Array.from({ length: 7 }, () => ({ colazione: { id: 'v3-uova-paprika', x: 1.25 }, pranzo: { id: 'brownies-fagioli', x: 1 }, cena: { id: 'pollo-limone', x: 1 }, spuntino: { id: 'mela-mandorle', x: 1 } })), target: 2000 }; return shopList().filter(([, i]) => /^uov/i.test(i.n)).map(([, i]) => [i.n, i.u, qty(i.q, i.u)]); });
  assertEq(r, [['Uova', 'pz', '23']]);
});

/* ---------- Allenamento: guidato, registro, stretching ---------- */
test('lettura serie e ripetizioni', async p => {
  assertEq(await ev(p, () => ['3 × 6–8', '3 × max −2', '3 × 30–45 s', '2 × 12 in superserie', '3 × 10 per gamba', '3 × 5'].map(parseSR)), [
    { sets: 3, min: 6, max: 8, unit: 'rip' }, { sets: 3, min: null, max: null, unit: 'rip' }, { sets: 3, min: 30, max: 45, unit: 's' },
    { sets: 2, min: 12, max: 12, unit: 'rip' }, { sets: 3, min: 10, max: 10, unit: 'rip' }, { sets: 3, min: 5, max: 5, unit: 'rip' }]);
});
test('suggerimento: prima volta, stesso peso, +2,5 kg', async p => {
  const r = await ev(p, () => { const id = exId('palestra', 'Panca piana con bilanciere o manubri'); const a = suggest(id, '3 × 6–8', true).text;
    logExercise(id, [{ kg: 40, reps: 8 }, { kg: 40, reps: 7 }, { kg: 40, reps: 6 }]); const b = suggest(id, '3 × 6–8', true);
    logExercise(id, [{ kg: 40, reps: 8 }, { kg: 40, reps: 8 }, { kg: 40, reps: 8 }]); const c = suggest(id, '3 × 6–8', true);
    return [/prima volta/i.test(a), b.kg, /ripetizione in più/.test(b.text), c.kg]; });
  assertEq(r, [true, 40, true, 42.5]);
});
test('stretching prima dinamico e dopo statico', async p => {
  const r = await ev(p, () => [STRETCH.pre.length, STRETCH.post.length, STRETCH.post.every(x => x.s >= 30), STRETCH.pre.every(x => x.n && x.d && x.c)]);
  assertEq(r, [7, 7, true, true]);
});
test('allenamento guidato completo salva serie e segna la giornata', async p => {
  await ev(p, () => { location.hash = 'allenamento'; ui.wk = 'palestra'; viewAllenamento(); }); await p.waitForTimeout(150);
  await p.locator('[data-act="wostart"][data-s="0"]').click(); await p.waitForTimeout(100);
  assert(/Riscaldamento/i.test(await p.locator('.wo-run').innerText()), 'manca il riscaldamento');
  await p.click('#wo-next'); await p.waitForTimeout(50);
  await p.fill('#set-0-kg', '40'); await p.fill('#set-0-reps', '8'); await p.click('[data-set="0"]'); await p.waitForTimeout(50);
  const t = await ev(p, () => timers.length);
  for (let i = 0; i < 7; i++) { if (await p.locator('#wo-next').count()) await p.click('#wo-next'); await p.waitForTimeout(30); }
  assert(/Defaticamento|stretching/i.test(await p.locator('.wo-run').innerText()), 'manca lo stretching finale');
  await p.click('#wo-end'); await p.waitForTimeout(100);
  const r = await ev(p, () => { const id = exId('palestra', WK.palestra.s[0].ex[0][0]); return [log[todayKey()] && log[todayKey()].train, (store.get('wlog', {})[id] || []).length, store.get('wlog', {})[id][0].sets[0]]; });
  assertEq([t >= 1, ...r], [true, 'A', 1, { kg: 40, reps: 8 }]);
}, { seed: { 'pp.profile': REAL } });
test('registro pesi nel backup', async p => { assert(await ev(p, () => BK_KEYS.includes('wlog') && BK_SHAPE.wlog({ a: [{ d: '2026-01-01', sets: [] }] }) && !BK_SHAPE.wlog([]))); });
test('ultima volta mostrata nella scheda', async p => {
  await ev(p, () => { logExercise(exId('casa', 'Squat a corpo libero'), [{ kg: null, reps: 18 }, { kg: null, reps: 16 }]); ui.wk = 'casa'; location.hash = 'allenamento'; viewAllenamento(); }); await p.waitForTimeout(100);
  assert(/Ultima volta: 18 · 16/.test(await p.locator('#v-allenamento').innerText()));
});

test('ultima volta compatta con lo stesso peso', async p => { assertEq(await ev(p, () => [fmtSets({ sets: [{ kg: 60, reps: 8 }, { kg: 60, reps: 7 }] }), fmtSets({ sets: [{ kg: 60, reps: 8 }, { kg: 62.5, reps: 6 }] })]), ['60 kg × 8 · 7', '60 kg × 8 · 62,5 kg × 6']); });

/* ---------- Revisione allenamento ---------- */
const openWo = async (p, where = 'palestra') => { await ev(p, w => { location.hash = 'allenamento'; ui.wk = w; viewAllenamento(); }, where); await p.waitForTimeout(100); await p.locator('[data-act="wostart"][data-s="0"]').click(); await p.waitForTimeout(80); await p.click('#wo-next'); await p.waitForTimeout(50); };
test('un solo timer di recupero alla volta, tolto alla chiusura', async p => {
  await openWo(p); await p.fill('#set-0-reps', '8'); await p.click('[data-set="0"]'); await p.fill('#set-1-reps', '8'); await p.click('[data-set="1"]');
  const a = await ev(p, () => timers.filter(t => t.kind === 'rest').length);
  await p.click('[data-set="0"]'); await p.click('[data-set="0"]');
  const b = await ev(p, () => timers.filter(t => t.kind === 'rest').length);
  await ev(p, () => woClose(true)); const c = await ev(p, () => timers.filter(t => t.kind === 'rest').length);
  assertEq([a, b, c], [1, 1, 0]);
}, { seed: { 'pp.profile': REAL } });
test('spunta senza scrivere: ripetizioni minime, niente +2,5 kg', async p => {
  await openWo(p); for (const i of [0, 1, 2]) { await p.fill(`#set-${i}-kg`, '60'); await p.click(`[data-set="${i}"]`); }
  for (let i = 0; i < 7; i++) { if (await p.locator('#wo-next').count()) await p.click('#wo-next'); }
  await p.click('#wo-end'); await p.waitForTimeout(80);
  const r = await ev(p, () => { const id = exId('palestra', WK.palestra.s[0].ex[0][0]); return [store.get('wlog', {})[id][0].sets.map(s => s.reps), suggest(id, WK.palestra.s[0].ex[0][1], true).kg]; });
  assertEq(r, [[6, 6, 6], 60]);
}, { seed: { 'pp.profile': REAL } });
test('× con serie segnate chiede conferma e la bozza sopravvive al ricaricamento', async p => {
  await openWo(p); await p.fill('#set-0-reps', '7'); await p.click('[data-set="0"]');
  await p.click('#wo-x'); await p.waitForTimeout(50);
  const still = await p.locator('.wo-run').count(); const ask = await p.locator('#wo-confirm').count();
  await p.reload(); await p.waitForTimeout(250); await ev(p, () => { location.hash = 'allenamento'; }); await p.waitForTimeout(120);
  await p.locator('[data-act="woresume"]').click(); await p.waitForTimeout(80);
  const r = await ev(p, () => [document.querySelector('[data-set="0"]').getAttribute('aria-pressed'), document.getElementById('set-0-reps').value]);
  assertEq([still, ask, ...r], [1, 1, 'true', '7']);
}, { seed: { 'pp.profile': REAL } });
test('consigli per esercizi a tempo', async p => {
  const r = await ev(p, () => { const id = exId('casa', 'Plank'); const a = suggest(id, '3 × 30–45 s', false).text; logExercise(id, [{ kg: null, reps: 45 }, { kg: null, reps: 45 }, { kg: null, reps: 45 }]); const b = suggest(id, '3 × 30–45 s', false).text; return [/second/i.test(a) || /prima volta/i.test(a), /second/.test(b) && !/scendi/.test(b), fmtSets(lastOf(id), 's')]; });
  assertEq(r, [true, true, '45 s · 45 s · 45 s']);
});
test('spuntare una serie non fa saltare la pagina', async p => {
  await p.setViewportSize({ width: 375, height: 600 }); await openWo(p);
  await ev(p, () => { document.querySelector('.ck-body').scrollTop = 200; }); const before = await ev(p, () => document.querySelector('.ck-body').scrollTop);
  await p.locator('[data-set="2"]').click({ force: true }); await p.waitForTimeout(50);
  const r = await ev(p, () => [document.querySelector('.ck-body').scrollTop, document.activeElement && document.activeElement.dataset.set]);
  assertEq([r[0] === before && before > 0, r[1]], [true, '2']);
}, { seed: { 'pp.profile': REAL } });
test('finire senza serie non conta come allenamento', async p => {
  await openWo(p); for (let i = 0; i < 7; i++) { if (await p.locator('#wo-next').count()) await p.click('#wo-next'); }
  await p.click('#wo-end'); await p.waitForTimeout(80);
  assertEq(await ev(p, () => !!(log[todayKey()] && log[todayKey()].train)), false);
}, { seed: { 'pp.profile': REAL } });
test('backup con registro pesi rovinato rifiutato', async p => { assertEq(await ev(p, () => BK_SHAPE.wlog({ a: [{ d: 'x' }] })), false); });

/* ---------- Cibi più intelligenti ---------- */
test('burek e altri cibi da strada riconosciuti', async p => {
  const r = await ev(p, () => ['2 burek', 'un gyros', 'falafel', 'baklava', 'cevapcici', 'tortellini al ragù', 'mojito', 'frullato di frutta'].map(t => { const a = analyzeFood(t); return a.items.length ? a.items[0].food.n : null; }));
  assert(r.every(Boolean) && r[0] === 'Burek', JSON.stringify(r));
});
test('errori di battitura: bureq, margerita, cornettto', async p => {
  const r = await ev(p, () => ['2 bureq', 'pizza margerita', 'cornettto', 'cappucino'].map(t => { const it = analyzeFood(t).items[0]; return it ? [it.food.n, !!it.guess] : null; }));
  assertEq(r, [['Burek', true], ['Pizza margherita', false], ['Cornetto', true], ['Cappuccino', true]]);
});
test('niente indovinelli a caso', async p => {
  const r = await ev(p, () => ['xyz abc', 'qwerty', 'pasta'].map(t => { const it = analyzeFood(t).items[0]; return it ? it.food.n + (it.guess ? '?' : '') : null; }));
  assertEq(r, [null, null, 'Pasta (peso da cruda)']);
});
test('inserimento a mano: stima carboidrati e grassi', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await ev(p, () => { document.querySelector('details.manual').open = true; });
  await p.fill('#q-n', 'Bureq della nonna'); await p.fill('#q-k', '600'); await p.fill('#q-p', '20'); await p.click('[data-act="addq"]'); await p.waitForTimeout(80);
  const a = await ev(p, () => dayLog().items.slice(-1)[0]);
  await ev(p, () => { document.querySelector('details.manual').open = true; });
  await p.fill('#q-n', 'Altro'); await p.fill('#q-p', '10'); await p.fill('#q-c', '30'); await p.fill('#q-f', '5'); await p.click('[data-act="addq"]'); await p.waitForTimeout(80);
  const b = await ev(p, () => dayLog().items.slice(-1)[0]);
  assert(a.c > 30 && a.f > 10 && Math.abs(a.k - 600) < 1 && a.est === true && b.k === 205 && !b.est, JSON.stringify([a, b]));
});
test('insegna un cibo: poi viene riconosciuto e va nel backup', async p => {
  const r = await ev(p, () => { teachFood({ n: 'Torta della nonna Pina', g: 120, k: 380, p: 6, c: 50, f: 17 }); const it = analyzeFood('una torta della nonna pina').items[0]; return [it && it.food.n, it && Math.round(it.k), BK_KEYS.includes('myfoods'), (store.get('myfoods', [])).length]; });
  assertEq(r, ['Torta della nonna Pina', 380, true, 1]);
});
test('cibo sconosciuto offre di insegnarlo', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'zighini'); await p.waitForTimeout(80);
  assert(await p.locator('[data-act="teach"]').count() === 1);
});

test('olive riconosciute', async p => { assertEq(await ev(p, () => analyzeFood('spritz e olive').items.map(i => i.food.n)), ['Spritz', 'Olive']); });

/* ---------- Revisione cibi intelligenti ---------- */
test('cibo insegnato senza kcal: backup ancora ripristinabile', async p => {
  const r = await ev(p, () => { const it = manualItem('Bibimbap', null, 10, 30, null); teachFood({ n: it.n, g: 200, k: it.k, p: it.p, c: it.c, f: it.f }); return [it.f, importData(exportData()).ok]; });
  assertEq(r, [0, true]);
});
test('cibi insegnati vecchi con valori vuoti vengono sistemati', async p => {
  assertEq(await ev(p, () => [store.get('myfoods', [])[0].f, importData(exportData()).ok]), [0, true]);
}, { seed: { 'pp.myfoods': [{ n: 'Bibimbap', g: 200, k: 250, p: 10, c: 30, f: null }, 'rotto', { n: 5 }] } });
test('insegnami: nome pulito da quantità e unità', async p => { assertEq(await ev(p, () => ['2 bibimbop', 'una fetta di bibimbap', 'mezza porzione di bibimbap grande'].map(teachName)), ['Bibimbop', 'Bibimbap', 'Bibimbap']); });
test('dopo aver aggiunto a mano il testo si svuota', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'zighini'); await p.waitForTimeout(60);
  await p.click('[data-act="teach"]'); await p.fill('#q-k', '500'); await p.click('[data-act="addq"]'); await p.waitForTimeout(80);
  assertEq(await ev(p, () => [ui.qtxt, $('q-txt').value, dayLog().items.length]), ['', '', 1]);
});
test('niente parole comuni scambiate per cibi', async p => {
  const r = await ev(p, () => ['basta', 'sera', 'nonno', 'porta', 'sono stato bravo', 'cosa', 'resto', 'cane', 'sotto casa', 'misto', 'giro', 'pepe', 'nulla', 'zampone'].filter(t => analyzeFood(t).items.some(i => i.guess)));
  assertEq(r, []);
});
test('errori di battitura veri ancora capiti', async p => { assertEq(await ev(p, () => ['2 bureq', 'cappucino', 'cornettto', 'falafell'].map(t => (analyzeFood(t).items[0] || {}).food ? analyzeFood(t).items[0].food.n : null)), ['Burek', 'Cappuccino', 'Cornetto', 'Falafel']); });
test('un cibo insegnato con nome già noto ha la precedenza', async p => {
  assertEq(await ev(p, () => { teachFood({ n: 'Burek', g: 250, k: 700, p: 20, c: 70, f: 38 }); const it = analyzeFood('un burek').items[0]; return [it.food.mine, Math.round(it.k)]; }), [true, 700]);
});
test('numeri con la virgola nel modulo a mano', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120); await ev(p, () => { document.querySelector('details.manual').open = true; });
  await p.fill('#q-n', 'Prova'); await p.fill('#q-k', '300'); await p.fill('#q-p', '12,5'); await p.fill('#q-c', '30'); await p.fill('#q-f', '10,5'); await p.click('[data-act="addq"]'); await p.waitForTimeout(80);
  assertEq(await ev(p, () => { const i = dayLog().items.slice(-1)[0]; return [i.p, i.f]; }), [12.5, 10.5]);
});
test('valori corretti: nachos, liquori, piña colada', async p => {
  assertEq(await ev(p, () => [analyzeFood('nachos').items[0].food.k, analyzeFood('limoncello').items[0].food.c >= 20, analyzeFood('pina colada').items[0].food.k >= 170]), [306, true, true]);
});

/* ---------- Piatti più comuni ---------- */
const COMMON = ['penne all\'arrabbiata', 'spaghetti aglio olio e peperoncino', 'pasta alla norma', 'pasta al tonno', 'pasta con zucchine', 'pasta al salmone', 'pasta e piselli', 'pasta e patate', 'orecchiette alle cime di rapa', 'insalata di pasta', 'gnocchi al pomodoro', 'gnocchi alla sorrentina', 'risotto alla pescatora', 'risotto alla zucca', 'paella', 'zuppa di pesce', 'brodo', 'ribollita', 'pizzoccheri', 'tagliatelle ai funghi', 'pollo al forno', 'pollo alla cacciatora', 'scaloppine al limone', 'arrosto di vitello', 'involtini di carne', 'bollito', 'fegato alla veneziana', 'agnello', 'coniglio', 'burger vegetale', 'cozze', 'tonno fresco', 'insalata di mare', 'insalata di farro', 'insalata russa', 'panzanella', 'peperonata', 'caponata', 'purè', 'carciofi alla romana', 'funghi trifolati', 'mais', 'pizza fritta', 'focaccia farcita', 'club sandwich', 'bagel', 'trapizzino', 'rustici', 'anelli di cipolla', 'milkshake', 'profiteroles', 'babà', 'pastiera', 'zuppa inglese', 'semifreddo', 'macedonia', 'crema catalana', 'torrone', 'cioccolatini', 'caramelle', 'snickers', 'pain au chocolat', 'ginseng', 'caffè macchiato', 'marocchino', 'cioccolata calda', 'caffè d\'orzo', 'philadelphia', 'feta', 'seitan', 'gallette di riso', 'taralli', 'pane carasau', 'pancarrè', 'pane arabo', 'castagne', 'birra analcolica', 'kombucha', 'gatorade', 'pho', 'bibimbap', 'pollo tikka masala', 'biryani', 'samosa', 'tabbouleh', 'tajine', 'chili con carne', 'fajitas', 'guacamole', 'fish and chips', 'noodles saltati', 'pollo alle mandorle', 'onigiri', 'souvlaki', 'kofte', 'shakshuka', 'crepe salata', 'quiche', 'gazpacho', 'chinotto', 'pompelmo', 'paccheri al pomodoro'];
test('i piatti più comuni sono tutti riconosciuti', async p => {
  const miss = await ev(p, L => L.filter(t => { const a = analyzeFood(t); return !a.items.length || a.unknown.length; }), COMMON);
  assertEq(miss, []);
});
test('piatti specifici vincono sull\'ingrediente', async p => {
  assertEq(await ev(p, () => ['gnocchi al pomodoro', 'risotto alla zucca', 'insalata di farro', 'caffè d\'orzo', 'birra analcolica', 'purè', 'crepe salata', 'quiche', 'noodles saltati', 'involtini primavera'].map(t => analyzeFood(t).items[0].food.n)),
    ['Gnocchi al pomodoro', 'Risotto alla zucca', 'Insalata di farro', 'Caffè d\'orzo', 'Birra analcolica', 'Purè di patate', 'Crêpe salata', 'Torta salata o quiche', 'Noodles saltati', 'Involtini primavera']);
});

test('petto di pollo con patate: due cibi', async p => { assertEq(await ev(p, () => analyzeFood('150 g petto di pollo con patate al forno').items.map(i => i.food.n)), ['Petto di pollo', 'Patate al forno']); });

/* ---------- Revisione piatti comuni ---------- */
const PIN = [
  ['pollo e patate al forno', ['Pollo al forno con patate']], ['petto di pollo e patate lesse', ['Petto di pollo', 'Patate lesse']], ['pollo e patate fritte', ['Petto di pollo', 'Patatine fritte']],
  ['insalata con tonno sott\'olio', ['Insalata', 'Tonno sott\'olio']], ['spinaci aglio e olio', ['Spinaci', 'Olio d\'oliva']], ['zucchine aglio olio', ['Zucchine']], ['spaghetti aglio e olio', ['Pasta aglio, olio e peperoncino']],
  ['spaghetti aglio olio e peperoncino', ['Pasta aglio, olio e peperoncino']], ['paccheri al ragù', ['Pasta al ragù']], ['tagliatelle alla carbonara', ['Carbonara']], ['linguine alle vongole', ['Spaghetti alle vongole']],
  ['mezze maniche cacio e pepe', ['Amatriciana']], ['orecchiette al ragù', ['Pasta al ragù']], ['orecchiette con le cime di rapa', ['Pasta con broccoli o cime di rapa']], ['orecchiette', ['Pasta (peso da cruda)']],
  ['spiedini di verdure', ['Verdure miste']], ['spiedini di carne', ['Souvlaki o spiedini']], ['uova lesse', ['Uova']], ['lasagne gratinate', ['Lasagne']], ['verdure gratinate', ['Verdure gratinate']],
  ['il secondo caffè', ['Caffè espresso']], ['secondo di pesce', ['Pesce bianco']], ['mousse di tonno', ['Tonno sott\'olio']], ['frappe di carnevale', ['Frittelle']], ['cipolline in agrodolce', ['Cipolla e porro'.replace('Cipolla e porro', 'Verdure miste')]],
  ['pollo al forno', ['Pollo arrosto']], ['mezze maniche alla carbonara', ['Carbonara']], ['fusilli al pomodoro', ['Pasta al pomodoro']], ['penne al pesto', ['Pasta al pesto']],
  ['insalata con tonno', ['Insalata', 'Tonno sott\'olio']], ['pasta in brodo', ['Pastina in brodo']], ['orecchiette con salsiccia', ['Pasta (peso da cruda)', 'Salsiccia']], ['pasta 90 g', ['Pasta (peso da cruda)']], ['chili con carne e riso', ['Chili con carne', 'Riso (peso da crudo)']], ['pasta e fagioli', ['Zuppa di legumi']], ['150 g petto di pollo con patate al forno', ['Petto di pollo', 'Patate al forno']]
];
test('frasi comuni danno il piatto giusto', async p => {
  const bad = await ev(p, L => L.filter(([t, exp]) => JSON.stringify(analyzeFood(t).items.map(i => i.food.n)) !== JSON.stringify(exp)).map(([t]) => t + ' → ' + analyzeFood(t).items.map(i => i.food.n).join(' + ')), PIN);
  assertEq(bad, []);
});
test('nome insegnato con simboli non rompe il calcolatore', async p => {
  const r = await ev(p, () => { ['Yogurt + miele e noci', 'Riso con (pollo', 'Toast con *salsa*', 'Insalata e [mix', 'Caffè con panna $&'].forEach((n, i) => teachFood({ n, g: 100, k: 100 + i, p: 5, c: 10, f: 3 })); return [analyzeFood('pasta al pomodoro').items.length, analyzeFood('caffè con panna $&').items.map(i => i.food.n)]; });
  assertEq(r, [1, ['Caffè con panna $&']]);
});
test('cibo sconosciuto mantiene maiuscole e accenti', async p => { assertEq(await ev(p, () => analyzeFood('Zighinì della mamma').unknown), ['Zighinì della mamma']); });

test('fagottino di mele non è pain au chocolat', async p => { assert(await ev(p, () => !analyzeFood('fagottino di mele').items.some(i => i.food.n === 'Pain au chocolat'))); });

module.exports = { test, ev, assert, assertEq, keyOf, REAL };

(async () => {
  if (require.main !== module) return;
  const filter = process.argv[2] || '';
  const b = await chromium.launch();
  let fails = 0, n = 0;
  for (const t of tests.filter(t => t.name.includes(filter))) {
    n++;
    const ctx = await b.newContext({ viewport: { width: 400, height: 860 } });
    if (t.opts.seed) await ctx.addInitScript(seed => { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('__seeded', '1'); } }, t.opts.seed);
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    try {
      await p.goto(URL + (t.opts.hash || '')); await p.waitForTimeout(150);
      await t.fn(p);
      if (errs.length) throw new Error('errori nella pagina: ' + errs.join(' | '));
      console.log('PASS', t.name);
    } catch (e) { fails++; console.log('FAIL', t.name + ':', e.message.split('\n').slice(0, 3).join('\n      ')); }
    await ctx.close();
  }
  await b.close();
  console.log(`\n${n - fails}/${n} passati`);
  process.exit(fails ? 1 : 0);
})();
