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
  assertEq(n, 2);
});

/* ---------- Task 4: spesa per reparto ---------- */
test('reparti', async p => {
  const r = await ev(p, () => ['Salmone', 'Yogurt greco 0%', 'Uova', 'Zucchine', 'Pasta integrale', 'Ceci cotti', 'Noci', 'Olio extravergine d\'oliva', 'Tonno al naturale'].map(aisleOf));
  assertEq(r, ['Carne e pesce', 'Latticini e uova', 'Latticini e uova', 'Frutta e verdura', 'Pane, pasta e cereali', 'Legumi e conserve', 'Frutta secca e semi', 'Dispensa e condimenti', 'Carne e pesce']);
});
test('in Dispensa finiscono solo condimenti', async p => {
  const odd = await ev(p, () => [...new Set(R.flatMap(r => r.ing).filter(i => i[2] !== 'q.b.').map(i => i[0]))].filter(n => aisleOf(n) === 'Dispensa e condimenti' && !/olio|miele|cacao|lievito|salsa|tahina|agar|brodo|aceto|curry|cannella|zucchero|granola|cioccolato|burro d|burro di|cocco|caff|curcuma|tè verde|senape/i.test(n)));
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
  ['il secondo caffè', ['Caffè espresso']], ['secondo di pesce', ['Pesce bianco']], ['mousse di tonno', ['Tonno sott\'olio']], ['frappe di carnevale', ['Chiacchiere']], ['cipolline in agrodolce', ['Cipolla e porro'.replace('Cipolla e porro', 'Verdure miste')]],
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

/* ---------- Pezzi giusti ---------- */
const PIECE_REF = {
  'zucchero': [5, 'CREA'], 'birra': [330, 'CREA'], 'cornetto': [60, 'CREA'], 'brioche': [60, 'CREA'], 'croissant': [60, 'CREA'], 'cornetto crema': [60, 'CREA'],
  'cornetto cioccolato': [60, 'CREA'], 'cornetto marmellata': [60, 'CREA'], 'biscotti': [8, 'CREA'], 'biscotti secchi': [8, 'CREA'], 'biscotto': [8, 'CREA'], 'frollini': [10, 'CREA'],
  'biscotti frollini': [10, 'CREA'], 'biscotti al cioccolato': [10, 'CREA'], 'gocciole': [10, 'etichetta'], 'pan di stelle': [10, 'etichetta'], 'fette biscottate': [9, 'CREA'], 'fetta biscottata': [9, 'CREA'],
  'fette': [9, 'CREA'], 'yogurt': [125, 'CREA'], 'yogurt bianco': [125, 'CREA'], 'yogurt intero': [125, 'CREA'], 'yogurt greco': [170, 'CREA'], 'greco': [170, 'CREA'],
  'skyr': [170, 'CREA'], 'yogurt alla frutta': [125, 'CREA'], 'yogurt frutta': [125, 'CREA'], 'pane': [35, 'CREA'], 'pane bianco': [35, 'CREA'], 'rosetta': [60, 'USDA'],
  'baguette': [250, 'USDA'], 'pane integrale': [35, 'CREA'], 'pane di segale': [35, 'CREA'], 'pane ai cereali': [35, 'CREA'], 'piadina': [100, 'CREA'], 'piadina farcita': [250, 'CREA'],
  'piadina crudo': [250, 'CREA'], 'piadina prosciutto': [250, 'CREA'], 'crackers': [25, 'CREA'], 'cracker': [25, 'CREA'], 'grissini': [6, 'CREA'], 'grissino': [6, 'CREA'],
  'focaccia': [100, 'CREA'], 'schiacciata': [100, 'CREA'], 'toast': [120, 'CREA'], 'toast prosciutto formaggio': [120, 'CREA'], 'tramezzino': [100, 'CREA'], 'panino': [150, 'CREA'],
  'panino imbottito': [150, 'CREA'], 'panino al prosciutto': [150, 'CREA'], 'panino crudo': [150, 'CREA'], 'panino cotto': [150, 'CREA'], 'sandwich': [150, 'CREA'], 'pane del panino': [80, 'CREA'],
  'hamburger': [210, 'CREA'], 'burger': [210, 'CREA'], 'cheeseburger': [120, 'USDA'], 'big mac': [210, 'etichetta'], 'panino hamburger': [210, 'CREA'], 'hot dog': [150, 'CREA'],
  'hotdog': [150, 'CREA'], 'patatine in busta': [25, 'CREA'], 'chips': [25, 'CREA'], 'patatine busta': [25, 'CREA'], 'kebab': [350, 'CREA'], 'kebap': [350, 'CREA'],
  'doner': [350, 'CREA'], 'piadina kebab': [350, 'CREA'], 'sushi': [30, 'CREA'], 'nigiri': [30, 'CREA'], 'uramaki': [30, 'CREA'], 'maki': [30, 'CREA'],
  'hosomaki': [15, 'USDA'], 'california': [30, 'CREA'], 'sashimi': [15, 'CREA'], 'poke': [450, 'CREA'], 'poke bowl': [450, 'CREA'], 'bowl': [450, 'CREA'],
  'ramen': [550, 'CREA'], 'burrito': [300, 'CREA'], 'wrap': [300, 'CREA'], 'pizza': [330, 'CREA'], 'margherita': [330, 'CREA'], 'pizza margherita': [330, 'CREA'],
  'pizza rossa': [330, 'CREA'], 'pizza farcita': [350, 'CREA'], 'pizza salame': [350, 'CREA'], 'pizza diavola': [350, 'CREA'], 'pizza wurstel': [350, 'CREA'], 'pizza capricciosa': [350, 'CREA'],
  'pizza prosciutto': [350, 'CREA'], 'pizza quattro formaggi': [350, 'CREA'], 'pizza tonno': [350, 'CREA'], 'pizza al taglio': [120, 'CREA'], 'trancio di pizza': [120, 'CREA'], 'pizzetta': [50, 'USDA'],
  'calzone': [350, 'CREA'], 'panzerotto': [180, 'USDA'], 'arancino': [200, 'CREA'], 'arancina': [200, 'CREA'], 'suppli': [120, 'USDA'], 'cotoletta': [150, 'CREA'],
  'milanese': [150, 'CREA'], 'pollo impanato': [150, 'CREA'], 'nuggets': [18, 'USDA'], 'crocchette di pollo': [30, 'USDA'], 'cordon bleu': [100, 'USDA'], 'hamburger di manzo': [120, 'CREA'],
  'hamburger di carne': [120, 'CREA'], 'polpettone': [120, 'CREA'], 'polpette': [30, 'CREA'], 'polpetta': [30, 'CREA'], 'salsiccia': [100, 'CREA'], 'salsicce': [100, 'CREA'],
  'wurstel': [50, 'USDA'], 'wurstel di pollo': [50, 'USDA'], 'prosciutto crudo': [10, 'CREA'], 'crudo': [10, 'CREA'], 'speck': [10, 'CREA'], 'prosciutto cotto': [15, 'CREA'],
  'cotto': [15, 'CREA'], 'prosciutto': [15, 'CREA'], 'bresaola': [8, 'CREA'], 'fesa di tacchino': [15, 'CREA'], 'affettato di tacchino': [15, 'CREA'], 'affettato di pollo': [15, 'CREA'],
  'salame': [8, 'CREA'], 'salamino': [8, 'CREA'], 'chorizo': [8, 'CREA'], 'mortadella': [15, 'USDA'], 'tonno': [60, 'CREA'], 'tonno sott olio': [60, 'CREA'],
  'tonno in scatola': [60, 'CREA'], 'tonno al naturale': [56, 'CREA'], 'tonno naturale': [56, 'CREA'], 'uovo': [55, 'CREA'], 'uova': [55, 'CREA'], 'uovo sodo': [55, 'CREA'],
  'uova sode': [55, 'CREA'], 'uova lesse': [55, 'CREA'], 'uovo lesso': [55, 'CREA'], 'uova strapazzate': [55, 'CREA'], 'uovo al tegamino': [55, 'CREA'], 'albume': [33, 'CREA'],
  'albumi': [33, 'CREA'], 'chiare': [33, 'CREA'], 'mozzarella': [125, 'CREA'], 'bufala': [125, 'CREA'], 'fior di latte': [125, 'CREA'], 'burrata': [125, 'CREA'],
  'proteine': [30, 'CREA'], 'whey': [30, 'CREA'], 'proteine in polvere': [30, 'CREA'], 'frullato proteico': [30, 'CREA'], 'shake proteico': [30, 'CREA'], 'barretta proteica': [50, 'CREA'],
  'barretta': [50, 'CREA'], 'barrette proteiche': [50, 'CREA'], 'pomodori': [120, 'CREA'], 'pomodoro': [120, 'CREA'], 'pomodorini': [15, 'USDA'], 'pachino': [15, 'USDA'],
  'carote': [80, 'CREA'], 'carota': [80, 'CREA'], 'patate': [150, 'CREA'], 'patata': [150, 'CREA'], 'patate lesse': [150, 'CREA'], 'patate bollite': [150, 'CREA'],
  'avocado': [140, 'CREA'], 'mela': [180, 'CREA'], 'mele': [180, 'CREA'], 'banana': [120, 'CREA'], 'banane': [120, 'CREA'], 'arancia': [150, 'CREA'],
  'arance': [150, 'CREA'], 'mandarino': [70, 'USDA'], 'mandarini': [70, 'USDA'], 'clementine': [70, 'USDA'], 'pera': [170, 'CREA'], 'pere': [170, 'CREA'],
  'kiwi': [75, 'CREA'], 'datteri': [8, 'CREA'], 'dattero': [8, 'CREA'], 'fichi secchi': [20, 'USDA'], 'noci': [5, 'CREA'], 'noce': [5, 'CREA'],
  'gelato': [100, 'CREA'], 'gelato alla crema': [100, 'CREA'], 'gelato cioccolato': [100, 'CREA'], 'gelato pistacchio': [100, 'CREA'], 'cono': [100, 'CREA'], 'coppetta': [100, 'CREA'],
  'gelato stracciatella': [100, 'CREA'], 'gelato alla frutta': [100, 'CREA'], 'sorbetto': [100, 'CREA'], 'ghiacciolo': [60, 'USDA'], 'granita': [200, 'USDA'], 'torta': [80, 'CREA'],
  'dolce': [80, 'CREA'], 'ciambella': [80, 'CREA'], 'plumcake': [35, 'USDA'], 'torta al cioccolato': [80, 'CREA'], 'cheesecake': [80, 'CREA'], 'crostata': [80, 'CREA'],
  'strudel': [80, 'CREA'], 'panettone': [80, 'CREA'], 'pandoro': [80, 'CREA'], 'colomba': [80, 'CREA'], 'pasticcino': [25, 'USDA'], 'pasticcini': [25, 'USDA'],
  'bigne': [25, 'USDA'], 'cannolo': [110, 'USDA'], 'cannoli': [110, 'USDA'], 'sfogliatella': [90, 'USDA'], 'maritozzo': [110, 'USDA'], 'bombolone': [75, 'USDA'],
  'krapfen': [75, 'USDA'], 'ciambella fritta': [75, 'USDA'], 'donut': [65, 'USDA'], 'merendina': [35, 'CREA'], 'merendine': [35, 'CREA'], 'snack': [35, 'CREA'],
  'crostatina': [35, 'CREA'], 'kinder': [30, 'etichetta'], 'tortina': [35, 'CREA'], 'cioccolato fondente': [5, 'CREA'], 'fondente': [5, 'CREA'], 'cioccolato': [5, 'CREA'],
  'cioccolato al latte': [5, 'CREA'], 'cioccolato bianco': [5, 'CREA'], 'ovetto': [20, 'etichetta'], 'barretta di cioccolato': [50, 'USDA'], 'budino': [125, 'CREA'], 'panna cotta': [125, 'CREA'],
  'creme caramel': [125, 'CREA'], 'burek': [200, 'CREA'], 'borek': [200, 'CREA'], 'burek al formaggio': [200, 'CREA'], 'burek alla carne': [200, 'CREA'], 'zeljanica': [200, 'CREA'],
  'sirnica': [200, 'CREA'], 'krompirusa': [200, 'CREA'], 'pita agli spinaci': [200, 'CREA'], 'cevapcici': [30, 'CREA'], 'cevapi': [30, 'CREA'], 'pljeskavica': [200, 'CREA'],
  'gyros': [300, 'CREA'], 'gyro': [300, 'CREA'], 'pita gyros': [300, 'CREA'], 'shawarma': [300, 'CREA'], 'shawerma': [300, 'CREA'], 'falafel': [17, 'CREA'],
  'baklava': [30, 'CREA'], 'baclava': [30, 'CREA'], 'pierogi': [30, 'CREA'], 'tacos': [100, 'CREA'], 'taco': [100, 'CREA'], 'quesadilla': [200, 'CREA'],
  'empanada': [125, 'CREA'], 'empanadas': [125, 'CREA'], 'involtini primavera': [60, 'CREA'], 'involtino primavera': [60, 'CREA'], 'spring roll': [60, 'CREA'], 'ravioli cinesi': [25, 'CREA'],
  'gyoza': [25, 'CREA'], 'dim sum': [25, 'CREA'], 'ravioli al vapore': [25, 'CREA'], 'naan': [90, 'CREA'], 'pane naan': [90, 'CREA'], 'olive ascolane': [15, 'CREA'],
  'olive fritte': [15, 'CREA'], 'olive': [4, 'CREA'], 'olive verdi': [4, 'CREA'], 'olive nere': [4, 'CREA'], 'oliva': [4, 'CREA'], 'crocchette di patate': [30, 'CREA'],
  'crocche': [70, 'USDA'], 'crocchetta': [30, 'CREA'], 'tigelle': [40, 'CREA'], 'tigella': [40, 'CREA'], 'crescentine': [40, 'CREA'], 'crescentina': [40, 'CREA'],
  'gnocco fritto': [20, 'USDA'], 'bruschetta': [50, 'CREA'], 'bruschette': [50, 'CREA'], 'crostini': [15, 'USDA'], 'avocado toast': [150, 'CREA'], 'toast avocado': [150, 'CREA'],
  'toast con avocado': [150, 'CREA'], 'frittelle': [20, 'CREA'], 'frittella': [20, 'CREA'], 'zeppole': [90, 'USDA'], 'castagnole': [20, 'CREA'], 'chiacchiere': [10, 'USDA'],
  'frappe': [10, 'USDA'], 'frappe di carnevale': [10, 'USDA'], 'bugie': [10, 'USDA'], 'crepe': [120, 'CREA'], 'crepes': [120, 'CREA'], 'crespella': [120, 'CREA'],
  'pancake': [50, 'CREA'], 'pancakes': [50, 'CREA'], 'waffle': [100, 'CREA'], 'waffel': [100, 'CREA'], 'muffin': [90, 'CREA'], 'brownie': [60, 'CREA'],
  'brownies': [60, 'CREA'], 'cookie': [40, 'CREA'], 'cookies': [40, 'CREA'], 'biscottone': [40, 'CREA'], 'burger vegetale': [110, 'CREA'], 'burger vegano': [110, 'CREA'],
  'hamburger vegetariano': [110, 'CREA'], 'burger di soia': [110, 'CREA'], 'burger di legumi': [110, 'CREA'], 'pizza fritta': [200, 'CREA'], 'montanara': [100, 'USDA'], 'focaccia farcita': [200, 'CREA'],
  'focaccia ripiena': [200, 'CREA'], 'club sandwich': [250, 'CREA'], 'bagel': [90, 'CREA'], 'trapizzino': [200, 'CREA'], 'rustico': [30, 'CREA'], 'rustici': [30, 'CREA'],
  'salatini': [10, 'USDA'], 'cornetto salato': [90, 'CREA'], 'croissant salato': [90, 'CREA'], 'baba': [80, 'CREA'], 'baba al rum': [80, 'CREA'], 'pastiera': [120, 'CREA'],
  'cioccolatino': [12, 'CREA'], 'cioccolatini': [12, 'CREA'], 'pralina': [12, 'CREA'], 'praline': [12, 'CREA'], 'bacio perugina': [12, 'etichetta'], 'ferrero rocher': [12, 'etichetta'],
  'caramelle': [5, 'CREA'], 'caramella': [5, 'CREA'], 'gommose': [5, 'CREA'], 'orsetti gommosi': [5, 'CREA'], 'liquirizia': [5, 'CREA'], 'snickers': [50, 'etichetta'],
  'twix': [50, 'etichetta'], 'mars': [50, 'etichetta'], 'kitkat': [50, 'etichetta'], 'kit kat': [50, 'etichetta'], 'bounty': [50, 'etichetta'], 'duplo': [18, 'etichetta'],
  'kinder bueno': [43, 'etichetta'], 'pain chocolat': [70, 'CREA'], 'saccottino': [70, 'CREA'], 'fagottino al cioccolato': [70, 'CREA'], 'gallette': [8, 'CREA'], 'galletta': [8, 'CREA'],
  'gallette di riso': [8, 'CREA'], 'gallette di mais': [8, 'CREA'], 'pancarre': [25, 'CREA'], 'pan carre': [25, 'CREA'], 'pane in cassetta': [25, 'CREA'], 'pan bauletto': [25, 'CREA'],
  'pane arabo': [60, 'CREA'], 'pita': [60, 'CREA'], 'pane pita': [60, 'CREA'], 'castagne': [10, 'CREA'], 'caldarroste': [10, 'CREA'], 'castagna': [10, 'CREA'],
  'samosa': [70, 'CREA'], 'samosas': [70, 'CREA'], 'onigiri': [110, 'CREA'], 'quiche': [150, 'CREA'], 'torta salata': [150, 'CREA'], 'erbazzone': [150, 'CREA'],
  'torta pasqualina': [150, 'CREA'], 'torta rustica': [150, 'CREA'], 'panino con cotoletta': [250, 'CREA'], 'panino cotoletta': [250, 'CREA'], 'fico secco': [20, 'USDA'],
  'clementina': [70, 'USDA'], 'pomodorino': [15, 'USDA'], 'ciliegini': [15, 'USDA'], 'bignè alla crema': [25, 'USDA'], 'cannolo siciliano': [110, 'USDA'], 'bomboloni': [75, 'USDA'],
  'graffa': [75, 'USDA'], 'sfogliatelle': [90, 'USDA'], 'maritozzi': [110, 'USDA'], 'plum cake': [35, 'USDA'], 'ghiaccioli': [60, 'USDA'], 'kinder sorpresa': [20, 'etichetta'],
  'ovetti': [20, 'etichetta'], 'michetta': [60, 'USDA'], 'cheese burger': [120, 'USDA'], 'panzerotti': [180, 'USDA'], 'crocchetta di pollo': [30, 'USDA'], 'nugget': [18, 'USDA'],
  'gnocchi fritti': [20, 'USDA'], 'torta fritta': [20, 'USDA'], 'crostino': [15, 'USDA'], 'zeppola': [90, 'USDA'], 'zeppola di san giuseppe': [90, 'USDA'], 'chiacchiera': [10, 'USDA'],
  'crostoli': [10, 'USDA'], 'montanarina': [50, 'USDA'], 'salatino': [10, 'USDA'], 'vol vent': [12, 'USDA'], 'supplì': [120, 'USDA'], 'mandarancio': [70, 'USDA'],
  'rosette': [60, 'USDA'], 'michette': [60, 'USDA'], 'pizzette': [50, 'USDA'], 'panzerotto fritto': [180, 'USDA'], 'chicken nuggets': [18, 'USDA'], 'bocconcini di pollo impanati': [18, 'USDA'],
  'wurstel di tacchino': [50, 'USDA'], 'frankfurter': [50, 'USDA'], 'datterini': [12, 'USDA'], 'mandaranci': [70, 'USDA'], 'granite': [200, 'USDA'], 'granita al limone': [200, 'USDA'],
  'granita al caffè': [200, 'USDA'], 'plumcake confezionato': [35, 'etichetta'], 'pasticcini mignon': [25, 'USDA'], 'bigne alla crema': [25, 'USDA'], 'bigne al cioccolato': [25, 'USDA'], 'graffe': [80, 'USDA'],
  'maritozzo con la panna': [110, 'USDA'], 'ovetto kinder': [20, 'etichetta'], 'crocche napoletano': [70, 'USDA'], 'crocche di patate': [70, 'USDA'], 'frappa': [10, 'USDA'], 'cenci': [10, 'USDA'],
  'montanare': [100, 'USDA'], 'montanarine': [50, 'USDA'],
};

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

/* ---------- Righe del calcolatore ---------- */
test('rankFoods: il primo è bestFood', async p => {
  assertEq(await ev(p, () => ['pasta al pomodoro', 'pollo', 'kinder'].map(t => { const ws = fw(t); return rankFoods(ws)[0].food === bestFood(ws).food && rankFoods(ws, true).length > 2; })), [true, true, true]);
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
test('righe: grammi scritti restano in grammi, cibo sparito ignorato', async p => {
  assertEq(await ev(p, () => { const r = calcRows('pasta 90 g', {}, [])[0]; const k = calcRows('pollo', {}, [])[0].key; return [r.mode, calcRows('pollo', { [k]: { food: 'Non esiste' } }, [])[0].food.n === calcRows('pollo', {}, [])[0].food.n]; }), ['g', true]);
});

/* ---------- Conferma come Yazio ---------- */
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
  for (const v of ['abc', '0', '']) { await p.fill('input.qg', v); await p.dispatchEvent('input.qg', 'change'); await p.waitForTimeout(40); }
  const g1 = await ev(p, () => Math.round(calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].g));
  await p.fill('input.qg', '35,5'); await p.dispatchEvent('input.qg', 'change');
  assertEq([n1, g1, await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].g)], [1, 18, 35.5]);
});
test('conferma: mezzo pezzo scende fino a 0,5', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'mezza mela'); await p.waitForTimeout(80);
  await p.click('[data-act="qminus"]'); await p.click('[data-act="qplus"]'); await p.click('[data-act="qminus"]');
  assertEq(await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].n), 0.5);
});
test('conferma: Non è questo? cambia il cibo', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'pollo'); await p.waitForTimeout(80);
  await p.click('[data-act="qalt"]'); const alt = await p.locator('[data-act="qpick"]').first().getAttribute('data-food');
  await p.locator('[data-act="qpick"]').first().click(); assertEq(await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].food.n), alt);
  assert(await p.locator('[data-act="teach"]').count() === 0, 'menu chiuso dopo la scelta');
});
test('conferma: avviso Controlla la quantità', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '5 cotolette'); await p.waitForTimeout(80);
  assert(await p.locator('.qwarn').count() === 1);
});
test('conferma: il campo testo non perde il fuoco quando premo +', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '5 nuggets'); await p.waitForTimeout(80);
  await p.click('[data-act="qplus"]'); await p.type('#q-txt', ' e una mela'); await p.waitForTimeout(80);
  assertEq(await ev(p, () => [ui.qtxt, calcRows(ui.qtxt, ui.qedit, ui.qscan).map(r => r.n)]), ['5 nuggets e una mela', [6, 1]]);
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
  assertEq([(await p.textContent('.qgl')).trim(), await p.inputValue('input.qg')], ['ml', '330']);
});

/* ---------- Prodotti di marca salvati ---------- */
const OFF_BUENO = { code: '8000500121467', product_name_it: 'Kinder Bueno', brands: 'Ferrero,Kinder', serving_quantity: '21.5', serving_size: '1 barretta (21,5 g)', nutriments: { 'energy-kcal_100g': 572, proteins_100g: 9.2, carbohydrates_100g: 49.5, fat_100g: 37.3, fiber_100g: 2 } };
test('offNorm: dati puliti e sporchi', async p => {
  assertEq(await ev(p, B => [offNorm(B).n, offNorm(B).sv, Math.round(offNorm({ code: '1', brands: 'X', nutriments: { 'energy-kj_100g': 1000 } }).k), offNorm({ code: '1', brands: 'X', nutriments: { 'energy-kj_100g': 1000 } }).partial, offNorm({ code: '2', product_name: 'Y', nutriments: { 'energy-kcal_100g': 950 } }), offNorm({ code: '3', product_name: 'Z', nutriments: {} }), offNorm({ code: '4', nutriments: { 'energy-kcal_100g': 100 } }).n, offNorm({ code: '5', product_name: 'W', serving_quantity: 0, nutriments: { 'energy-kcal_100g': 100 } }).sv, offNorm({ code: '6', product_name: 'Cola', quantity: '330 ml', serving_quantity: 330, nutriments: { 'energy-kcal_100g': 42 } }).ml], OFF_BUENO),
    ['Kinder Bueno', 21.5, 239, true, null, null, 'Prodotto 4', 0, true]);
});
test('prodotto salvato: riconosciuto offline, nel backup, non ruba "spaghetti"', async p => {
  assertEq(await ev(p, B => { saveProduct(offNorm(B)); saveProduct(offNorm({ code: '9', product_name_it: 'Spaghetti n.5', brands: 'Barilla', serving_quantity: 80, nutriments: { 'energy-kcal_100g': 359, proteins_100g: 12, carbohydrates_100g: 71, fat_100g: 2 } }));
    const a = analyzeFood('2 kinder bueno').items[0], s = analyzeFood('spaghetti 80 g').items[0], b = analyzeFood('spaghetti barilla 80 g').items[0];
    return [a.food.n, Math.round(a.g), s.food.prod || false, b.food.n, store.get('products', []).length, BK_KEYS.includes('products'), importData(exportData()).ok]; }, OFF_BUENO),
    ['Kinder Bueno', 43, false, 'Spaghetti n.5', 2, true, true]);
});
test('prodotto a 0 kcal (bibita zero) è valido, senza calorie no', async p => {
  assertEq(await ev(p, () => { const z = offNorm({ code: '5449000133328', product_name: 'Cola zero', nutriments: { 'energy-kcal_100g': 0 } }); saveProduct(z);
    return [!!z, z && z.k, offNorm({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': '' } }), store.get('products', []).length]; }), [true, 0, null, 1]);
});
test('prodotto con parole scritte solo se il pezzo era sconosciuto', async p => {
  assertEq(await ev(p, B => { const f = saveProduct(offNorm(B), 'bueno bianco'); return f.kw.split('|').includes('bueno bianco'); }, OFF_BUENO), true);
});
test('prodotti salvati vecchi o rotti non rompono l’avvio', async p => {
  assertEq(await ev(p, () => [store.get('products', []).length, analyzeFood('ottimo snack').items.length]), [1, 1]);
}, { seed: { 'pp.products': [{ code: '1', n: 'Ottimo snack', b: '', k: 100, p: 1, c: 1, f: 1, fib: 0, sv: 0, ml: false }, 'rotto', { code: 2 }] } });
test('prodotto salvato due volte: una sola voce', async p => {
  assertEq(await ev(p, B => { saveProduct(offNorm(B)); saveProduct(offNorm(B)); return [store.get('products', []).length, FOODS.filter(f => f.prod).length]; }, OFF_BUENO), [1, 1]);
});

/* ---------- Open Food Facts nel calcolatore ---------- */
// simula Open Food Facts: ricerca nuova (solo codici), prodotto per codice, ricerca vecchia
const offRoute = (p, body, delay = 0) => p.route(/openfoodfacts\.org/, async r => {
  if (delay) await new Promise(s => setTimeout(s, delay));
  const u = r.request().url(), list = body.products || (body.product ? [body.product] : []);
  let out = body;
  if (/search\.openfoodfacts\.org/.test(u)) out = { hits: list.map(x => ({ code: x.code, product_name: x.product_name || x.product_name_it })) };
  else if (/api\/v2\/product\//.test(u)) { const c = u.match(/product\/(\w+)\.json/)[1], x = list.find(y => y.code === c); out = body.status !== undefined && !body.product ? body : x ? { status: 1, code: c, product: x } : { status: 0 }; }
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) });
});
test('pezzo sconosciuto: propone prodotti di marca e li usa', async p => {
  await offRoute(p, { products: [OFF_BUENO, { ...OFF_BUENO, code: '8000500290484', product_name_it: 'Bueno White', countries_tags: ['en:italy'] }, { code: '80000008', product_name: 'Senza kcal', nutriments: {} }] });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '2 bueno bianco'); await p.waitForTimeout(900);
  const names = await p.locator('[data-act="offpick"]').allTextContents();
  const attrib = /Open Food Facts/.test(await p.textContent('#q-res'));
  await p.locator('[data-act="offpick"]').first().click(); await p.waitForTimeout(80);
  assertEq([names.length, /Bueno White/.test(names[0]), attrib, await ev(p, () => { const r = calcRows(ui.qtxt, ui.qedit, ui.qscan)[0]; return [r.food.n, Math.round(r.g)]; })],
    [2, true, true, ['Bueno White', 43]]);
});
test('offline: messaggio e il resto funziona', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.context().setOffline(true);
  await p.fill('#q-txt', 'mela e bueno bianco'); await p.waitForTimeout(900);
  assert(/Sei offline/.test(await p.textContent('#q-res')) && await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan).length === 1));
});
test('ricerca non riuscita: messaggio', async p => {
  await p.route(/openfoodfacts\.org/, r => r.fulfill({ status: 503, body: 'no' }));
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', 'bueno bianco'); await p.waitForTimeout(900);
  assert(/non riuscita/.test(await p.textContent('#q-res')));
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

/* ---------- Codice a barre ---------- */
test('codice scritto a mano: prodotto aggiunto come riga', async p => {
  await offRoute(p, { status: 1, product: OFF_BUENO });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.fill('#scan-code', '8000500121467'); await p.click('[data-act="scancode"]'); await p.waitForTimeout(300);
  assertEq(await ev(p, () => [ui.qscan.length, calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].food.n, Math.round(calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].g), !!document.querySelector('#scan.on')]), [1, 'Kinder Bueno', 22, false]);
  await p.click('[data-act="addtxt"]'); await p.waitForTimeout(80);
  assertEq(await ev(p, () => [dayLog().items.length, ui.qscan.length]), [1, 0]);
});
test('stesso codice due volte: una riga con 2 porzioni', async p => {
  await offRoute(p, { status: 1, product: OFF_BUENO });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await ev(p, () => onBarcode('8000500121467')); await ev(p, () => onBarcode('8000500121467'));
  assertEq(await ev(p, () => [ui.qscan.length, calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].n]), [1, 2]);
});
test('codice sconosciuto: offre di inserirlo a mano', async p => {
  await offRoute(p, { status: 0 });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.fill('#scan-code', '12345678'); await p.click('[data-act="scancode"]'); await p.waitForTimeout(300);
  assert(/non trovato/i.test(await p.textContent('#scan')) && await p.locator('[data-act="scanmanual"]').count() === 1);
  await p.click('[data-act="scanmanual"]'); await p.waitForTimeout(80);
  assertEq(await ev(p, () => [document.querySelector('details.manual').open, !!document.querySelector('#scan.on')]), [true, false]);
});
test('codice non valido non fa richieste', async p => {
  let n = 0; await p.route(/openfoodfacts\.org/, r => { n++; r.abort(); });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await ev(p, () => onBarcode('12ab')); assertEq(n, 0);
});
test('riga scansionata si toglie', async p => {
  await offRoute(p, { status: 1, product: OFF_BUENO });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await ev(p, () => onBarcode('8000500121467')); await p.waitForTimeout(200);
  await p.click('[data-act="qdel"]'); assertEq(await ev(p, () => ui.qscan.length), 0);
});
test('fotocamera non disponibile: si può scrivere il codice', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.waitForTimeout(400);
  assert(/scrivi il codice/i.test(await p.textContent('#scan')) && await p.isVisible('#scan-code'));
  await p.click('[data-act="scanclose"]'); assertEq(await ev(p, () => !!document.querySelector('#scan.on')), false);
});

/* ---------- Revisione finale ---------- */
const fage = (code, k) => ({ code, product_name: 'Total', brands: 'Fage', serving_quantity: 170, nutriments: { 'energy-kcal_100g': k, proteins_100g: 9, carbohydrates_100g: 4, fat_100g: 2 } });
test('[RF 1] tre prodotti con lo stesso nome: ognuno coi suoi valori', async p => {
  await offRoute(p, { products: [fage('5201054010001', 54), fage('5201054010002', 73), fage('5201054010003', 96)] });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await ev(p, async () => { for (const c of ['5201054010001', '5201054010002', '5201054010003']) await onBarcode(c); });
  assertEq(await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan).map(r => Math.round(r.food.k))), [54, 73, 96]);
});
test('[RF 2] prodotto con nome non latino: la scansione non si blocca', async p => {
  await offRoute(p, { status: 1, product: { code: '5201054017128', product_name: 'Γιαούρτι', nutriments: { 'energy-kcal_100g': 70 } } });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.fill('#scan-code', '5201054017128'); await p.click('[data-act="scancode"]'); await p.waitForTimeout(300);
  assertEq(await ev(p, () => [ui.qscan.length, !!document.querySelector('#scan.on'), calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].food.n]), [1, false, 'Γιαούρτι']);
});
test('[RF 3] chiudere mentre la fotocamera si accende la spegne', async p => {
  await ev(p, () => { location.hash = 'oggi'; window.__stopped = 0;
    window.BarcodeDetector = class { detect() { return Promise.resolve([]); } };
    navigator.mediaDevices.getUserMedia = () => new Promise(ok => setTimeout(() => ok({ getTracks: () => [{ stop() { window.__stopped++; } }] }), 300)); });
  await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.click('[data-act="scanclose"]'); await p.waitForTimeout(500);
  assertEq(await ev(p, () => window.__stopped), 1);
});
test('[RF 3] senza BarcodeDetector (iPhone): chiudere subito spegne la fotocamera', async p => {
  await p.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/javascript', body: 'window.ZXing={BrowserMultiFormatReader:class{decodeFromStream(){return new Promise(()=>{})} decodeFromConstraints(c){return navigator.mediaDevices.getUserMedia(c).then(()=>new Promise(()=>{}))} reset(){}}};' }));
  await ev(p, () => { location.hash = 'oggi'; window.__stopped = 0; delete window.BarcodeDetector;
    navigator.mediaDevices.getUserMedia = () => new Promise(ok => setTimeout(() => ok({ getTracks: () => [{ stop() { window.__stopped++; } }] }), 300)); });
  await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.click('[data-act="scanclose"]'); await p.waitForTimeout(600);
  await p.click('[data-act="scan"]'); await p.waitForTimeout(600); await p.click('[data-act="scanclose"]'); await p.waitForTimeout(100);
  assertEq(await ev(p, () => window.__stopped), 2);
});
test('[RF 3] risposta del codice dopo aver chiuso: niente riga', async p => {
  await offRoute(p, { status: 1, product: OFF_BUENO }, 500);
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.click('[data-act="scan"]'); await p.fill('#scan-code', '8000500121467'); await p.click('[data-act="scancode"]'); await p.click('[data-act="scanclose"]'); await p.waitForTimeout(800);
  assertEq(await ev(p, () => ui.qscan.length), 0);
});
test('[RF 4] prodotto con macro mancanti: la riga dice dati incompleti', async p => {
  await offRoute(p, { status: 1, product: { code: '80000016', product_name: 'Biscotti misteriosi', nutriments: { 'energy-kcal_100g': 450 } } });
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await ev(p, () => onBarcode('80000016')); await p.waitForTimeout(100);
  assert(/dati incompleti/.test(await p.textContent('#q-res')));
});
test('[RF 5] prodotto senza porzione: si conta in etti', async p => {
  assertEq(await ev(p, () => { saveProduct(offNorm({ code: '80000024', product_name: 'Muesli croccante', brands: 'Bio', nutriments: { 'energy-kcal_100g': 420 } }));
    return [calcRows('2 muesli croccante', {}, [])[0].label, calcRows('', {}, [{ key: 'scan:80000024', code: '80000024', n: 1 }])[0].label]; }), ['2 etti · 200 g', '1 etto · 100 g']);
});
test('[RF 7] − sotto un pezzo non aumenta i grammi', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '5 nuggets'); await p.waitForTimeout(80);
  await p.fill('input.qg', '5'); await p.dispatchEvent('input.qg', 'change'); await p.waitForTimeout(40);
  await p.click('[data-act="qminus"]');
  assertEq(await ev(p, () => Math.round(calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].g)), 5);
});
test('[RF 8] svuotare il testo dimentica le correzioni', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  await p.fill('#q-txt', '5 nuggets'); await p.waitForTimeout(80); await p.click('[data-act="qplus"]');
  await p.fill('#q-txt', ''); await p.fill('#q-txt', '5 nuggets'); await p.waitForTimeout(80);
  assertEq(await ev(p, () => calcRows(ui.qtxt, ui.qedit, ui.qscan)[0].n), 5);
});

test('dentro un riquadro (artifact): niente fotocamera né richieste esterne, con spiegazione', async p => {
  let n = 0; await p.route(/openfoodfacts\.org/, r => { n++; r.abort(); });
  await p.goto('file://' + path.resolve(__dirname, 'embed.html')); await p.waitForTimeout(400);
  const f = p.frame({ url: /index\.html/ });
  await f.fill('#q-txt', 'bueno bianco'); await f.waitForTimeout(900);
  assertEq([await f.locator('[data-act="scan"]').count(), /app installata/.test(await f.textContent('body')), n], [0, true, 0]);
});

/* ---------- Ho voglia di: voglie, locali, suggerimenti ---------- */
test('voglie: 5 voglie e ricette sgarro esistenti assegnate', async p => {
  assertEq(await ev(p, () => [VOGLIE.map(v => v.id), R.filter(r => r.v).every(r => r.tags.includes('sgarro')), ['fast', 'pizza', 'gelato', 'dolce'].filter(v => !R.some(r => r.v === v))]),
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
  assertEq(await ev(p, () => { const minK = Math.min(...R.filter(r => r.v === 'pizza').map(r => r.k));
    const h = cravingSuggest('pizza', Math.ceil(minK * .6), 'onni'), l = cravingSuggest('pizza', Math.floor(minK * .45), 'onni'), z = cravingSuggest('pizza', -200, 'onni');
    return [h.mode, h.home.every(x => x.x === .5 && x.r.k * .5 <= Math.ceil(minK * .6)), l.mode === 'light' || l.mode === 'low', z.mode, z.home.length > 0, z.out.length > 0]; }),
    ['half', true, true, 'low', true, true]);
});
test('cravingSuggest: vegano e vegetariano senza carne né pesce', async p => {
  assertEq(await ev(p, () => ['veg', 'vegan'].flatMap(d => VOGLIE.map(v => { const s = cravingSuggest(v.id, 900, d); return s.home.every(h => dietOK(h.r, d)) && s.out.every(o => dietOK(o, d)) && (!s.avoid || dietOK(s.avoid, d)); })).every(Boolean)), true);
});

/* ---------- 25 sgarri fit ---------- */
test('25 sgarri fit v4-', async p => {
  const r = await ev(p, () => { const a = R.filter(r => r.id.startsWith('v4-')), by = v => a.filter(r => r.v === v);
    return { n: a.length, notSgarro: a.filter(r => !r.tags.includes('sgarro') || !r.v).map(r => r.id), slow: a.filter(r => r.t > 30).map(r => r.id),
      fast: by('fast').length, spalma: by('spalma').length, pizza: by('pizza').length, gelato: by('gelato').length, dolce: by('dolce').length,
      pasto: a.filter(r => r.m.some(m => m === 'pranzo' || m === 'cena')).length,
      vegFast: by('fast').filter(r => dietOK(r, 'veg')).length, vegPizza: by('pizza').filter(r => dietOK(r, 'veg')).length, noMicro: a.filter(r => !MICRO[r.id]).map(r => r.id) }; });
  assert(r.n >= 25 && !r.notSgarro.length && !r.slow.length && r.fast >= 8 && r.spalma >= 5 && r.pizza >= 4 && r.gelato >= 3 && r.dolce >= 3 && r.pasto >= 10 && r.vegFast >= 2 && r.vegPizza >= 2 && !r.noMicro.length, JSON.stringify(r));
});

/* ---------- Riquadro Ho voglia di ---------- */
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
  await ev(p, () => { location.hash = 'oggi'; const c = calc(profile), minK = Math.min(...R.filter(r => r.v === 'pizza' && dietOK(r, profile.dieta)).map(r => r.k));
    dayLog().items.push({ n: 'Pasti', k: c.target - Math.ceil(minK * .6), p: 0, c: 0, f: 0, src: 'q' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="pizza"]'); await p.waitForTimeout(80);
  const id = await p.locator('[data-act="vgadd"]').first().getAttribute('data-id');
  await p.locator('[data-act="vgadd"]').first().click(); await p.waitForTimeout(80);
  assertEq(await ev(p, () => { const i = dayLog().items.slice(-1)[0]; return [Math.round(i.k), /½/.test(i.n)]; }), [await ev(p, id => Math.round(byId[id].k / 2), id), true]);
});
test('ho voglia: conta il giorno selezionato', async p => {
  await ev(p, () => { location.hash = 'oggi'; ui.dayOff = 1; dayLog().items.push({ n: 'Ieri', k: 5000, p: 0, c: 0, f: 0, src: 'q' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="gelato"]'); await p.waitForTimeout(80);
  assert(/quasi finite/.test(await p.textContent('#vg-res')));
});

test('cravingSuggest: se esci, una scelta per locale prima di ripetere', async p => {
  assertEq(await ev(p, () => [...new Set(cravingSuggest('fast', 900, 'onni').out.map(o => o.at))].sort()), ['Burger King', 'KFC', "McDonald's"]);
});

test('consigli voglie e sgarri', async p => {
  const r = await ev(p, () => TIPS.filter(t => t.cat === 'Voglie e sgarri').map(t => !!(t.t && t.b && t.src)));
  assert(r.length >= 10 && r.every(Boolean), JSON.stringify(r));
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await p.click('[data-cat="Voglie e sgarri"]'); await p.waitForTimeout(80);
  assert(await p.locator('#v-consigli article.tip').count() >= 10);
});

/* ---------- Revisione finale sgarri ---------- */
test('[RF 1] se esci: se niente sta nelle calorie lo dice', async p => {
  assertEq(await ev(p, () => { const s = cravingSuggest('pizza', 320, 'onni'); return [s.mode, s.outFits, s.out.length > 0]; }), ['ok', false, true]);
  await ev(p, () => { location.hash = 'oggi'; const c = calc(profile); dayLog().items.push({ n: 'Pasti', k: c.target - 320, p: 0, c: 0, f: 0, src: 'q' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="pizza"]'); await p.waitForTimeout(80);
  assert(/Nessuna scelta da locale sta nelle calorie rimaste/.test(await p.textContent('#vg-res')));
});
test('[RF 2] vegetariano + Superfood: proteine come prima', async p => {
  const r = await ev(p, () => { profile.sf = true; profile.dieta = 'veg'; const c = calc(profile); let low = 0; for (let k = 0; k < 60; k++) { makePlan(); low += plan.days.filter(d => dayTotals(d).p < .9 * c.prot).length; } return low / 60; });
  assert(r <= .35, 'giorni con poche proteine per piano ' + r);
}, { seed: { 'pp.profile': REAL } });
test('[RF 3] calorie finite: le 3 scelte da locale più leggere', async p => {
  assertEq(await ev(p, () => { const s = cravingSuggest('gelato', 50, 'onni'), all = FUORI.filter(o => o.v === 'gelato' && !o.heavy).map(o => o.k).sort((a, b) => a - b).slice(0, 3); return [s.mode, s.out.map(o => o.k).sort((a, b) => a - b)]; }),
    ['low', [130, 200, 255]]);
});
test('[RF 4] giorno passato: niente "oggi" né "domani"', async p => {
  await ev(p, () => { location.hash = 'oggi'; ui.dayOff = 1; dayLog().items.push({ n: 'Ieri', k: 5000, p: 0, c: 0, f: 0, src: 'q' }); saveLog(); viewOggi(); }); await p.waitForTimeout(150);
  await p.click('[data-act="voglia"][data-v="gelato"]'); await p.waitForTimeout(80);
  const t = await p.textContent('#vg-res'); assert(!/oggi|domani/i.test(t), t);
});
test('[RF 6] fonte dei valori da locale onesta', async p => {
  assert(await ev(p, () => Object.values(FUORI_SRC).every(v => !/^tabelle nutrizionali di/.test(v))));
});
test('[RF 7] le proteine dichiarate nel testo corrispondono alla ricetta', async p => {
  assertEq(await ev(p, () => R.filter(r => r.id.startsWith('v4-')).filter(r => { const m = (r.h || '').match(/(\d+) g di proteine/); return m && +m[1] !== r.p; }).map(r => r.id)), []);
});

/* ---------- Consigli a righe ---------- */
const OLD_TIPS = ["Pesce azzurro 2–3 volte a settimana", "Olio extravergine come grasso principale", "Verdure a foglia e crucifere ogni giorno", "Legumi e cereali integrali per le fibre", "Una manciata di frutta secca", "Curcuma sempre con pepe nero e un grasso", "Zenzero fresco", "Frutti di bosco e cacao amaro", "Fermentati ogni giorno", "Erbe e spezie al posto del sale", "Cosa limitare", "Cos'è lo skinny fat", "Ricomposizione: perdere grasso e mettere muscolo", "Proteine alte: circa 2 g per kg", "Pesi prima del cardio", "Misura il giro vita, non solo il peso", "Ordine nel piatto: prima verdure e proteine", "Cammina 10 minuti dopo mangiato", "Pasta al dente, pane integrale vero", "Frutta intera, non succhi", "Il piatto sano in tre parti", "Legumi almeno 3 volte a settimana", "Pesce 2 volte a settimana", "Fibre: 25–30 grammi al giorno", "Carne rossa con moderazione", "Deficit moderato, non drastico", "Proteine a ogni pasto", "Attenzione all'olio: è sano ma calorico", "Dormi 7–9 ore", "La voglia passa in 15–20 minuti", "Fame o voglia?", "Prima le proteine", "Lo sgarro pianificato batte il \"tutto o niente\"", "Dormire poco fa venire voglia di schifezze", "Porziona nel piatto, mai dal sacchetto", "La porzione vera della crema spalmabile", "Dopo uno sgarro non compensare saltando pasti", "Zucchero + grasso: la combinazione che non sazia", "Mangia lo sgarro seduto e con calma", "Al fast food: pollo, panino singolo, bibita zero", "Bevi soprattutto acqua", "Zuccheri aggiunti sotto il 10%", "Meno di 5 g di sale al giorno", "Pochi cibi ultra-processati", "Leggi l'etichetta al contrario", "Meal prep: cucina una volta, mangia tre", "Surgelati e scatolame sono alleati", "Cuoci, raffredda, poi mangia"];
test('consigli: 6 categorie, quantità e niente persi', async p => {
  const r = await ev(p, O => { const by = c => TIPS.filter(t => t.cat === c).length;
    return { cats: TIP_CATS, tot: TIPS.length, min: Math.min(...TIP_CATS.map(by)), sf: by('Skinny fat e muscoli'), bad: TIPS.filter(t => !TIP_CATS.includes(t.cat) || !(t.t && t.b && t.src)).map(t => t.t), lost: O.filter(o => !TIPS.some(t => t.t === o)), table: TIPS.filter(t => t.table).map(t => t.cat) }; }, OLD_TIPS);
  assertEq([r.cats, r.tot >= 85, r.min >= 10, r.sf >= 18, r.bad, r.lost, r.table],
    [['Skinny fat e muscoli', 'Alimentazione', 'Antinfiammatorio', 'Voglie e sgarri', 'Allenamento e sonno', 'Spesa e cucina'], true, true, true, [], [], ['Skinny fat e muscoli']]);
});
test('consigli a righe: prima lo skinny fat, Tutti N, niente scroll laterale', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  assertEq(await ev(p, () => [document.querySelector('.trow h3').textContent, document.querySelectorAll('.trow').length, document.querySelectorAll('.trow [data-cat]').length, !document.querySelector('.myth'), document.documentElement.scrollWidth <= 400]),
    ['Skinny fat e muscoli', 6, 6, true, true]);
});
test('consigli: una scheda si apre per intero e si chiude', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  const i = +(await p.locator('.trow .tcard').nth(1).getAttribute('data-tip'));
  await p.locator('.trow .tcard').nth(1).click(); await p.waitForTimeout(60);
  const txt = await p.textContent('#tipd');
  await p.click('[data-act="tipclose"]');
  assertEq([txt.includes(await ev(p, i => TIPS[i].b, i)), /Fonte/.test(txt), await ev(p, () => !!document.querySelector('#tipd.on'))], [true, true, false]);
});
test('consigli: tastiera, Esc e il fuoco torna alla scheda', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await p.locator('.trow .tcard').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(60);
  const open = await ev(p, () => !!document.querySelector('#tipd.on'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(60);
  assertEq([open, ...await ev(p, () => [!!document.querySelector('#tipd.on'), document.activeElement.classList.contains('tcard')])], [true, false, true]);
});
test('consigli: cambiare pagina chiude il pannello', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await p.locator('.trow .tcard').first().click(); await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(120);
  assertEq(await ev(p, () => !!document.querySelector('#tipd.on')), false);
});
test('consiglio del giorno: fisso per data, Un altro lo cambia', async p => {
  assertEq(await ev(p, () => { const a = new Date(2026, 10, 25, 8), b = new Date(2026, 10, 25, 23), c = new Date(2026, 10, 26, 8);
    return [tipOfDay(a) === tipOfDay(b), [0, 1, 2, 3, 4, 5, 6].map(k => tipOfDay(new Date(2026, 10, 20 + k))).some(x => x !== tipOfDay(a)), !TIPS[tipOfDay(c)].table]; }), [true, true, true]);
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  const t1 = await p.textContent('.tday h3'); let changed = false;
  for (let k = 0; k < 5 && !changed; k++) { await p.click('[data-act="tipnext"]'); changed = (await p.textContent('.tday h3')) !== t1; }
  assert(changed);
});
test('consigli: Tutti apre la categoria e si torna indietro', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await p.click('[data-cat="Voglie e sgarri"]'); await p.waitForTimeout(60);
  const n = await p.locator('#v-consigli article.tip').count();
  await p.click('[data-cat=""]'); await p.waitForTimeout(60);
  assertEq([n, await ev(p, () => TIPS.filter(t => t.cat === 'Voglie e sgarri').length), await p.locator('.trow').count()], [n, n, 6]);
});
test('consigli: la scheda della tabella proteine apre la tabella', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await ev(p, () => document.querySelector(`.tcard[data-tip="${TIPS.findIndex(t => t.table)}"]`).click()); await p.waitForTimeout(60);
  assert(await p.locator('#tipd table').count() === 1);
});
test('consigli: testi lunghi restano dentro la scheda', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  assertEq(await ev(p, () => [...document.querySelectorAll('.tcard')].filter(c => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().height > 260).length), 0);
});

/* ---------- Revisione finale consigli ---------- */
test('[RF 1] consiglio del giorno: 14 giorni tutti diversi e almeno 4 categorie', async p => {
  assertEq(await ev(p, () => { const ids = [...Array(14)].map((_, k) => tipOfDay(new Date(2026, 10, 7 + k, 12))); return [new Set(ids).size, new Set(ids.map(i => TIPS[i].cat)).size >= 4, ids.every(i => !TIPS[i].table)]; }), [14, true, true]);
});
test('[RF 2] citazione della spesa affamati corretta', async p => {
  assert(await ev(p, () => !/Xu et al\./.test(TIPS.find(t => t.t === 'Non fare la spesa affamato').src)));
});
test('[RF 5] tabella proteine nel pannello: la colonna utile si vede a 400 px', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await ev(p, () => document.querySelector(`.tcard[data-tip="${TIPS.findIndex(t => t.table)}"]`).click()); await p.waitForTimeout(80);
  assertEq(await ev(p, () => { const th = [...document.querySelectorAll('#tipd th')].find(x => /ogni 100 kcal/.test(x.textContent)), box = document.querySelector('#tipd .scan-box').getBoundingClientRect(), r = th.getBoundingClientRect(); return [r.right <= box.right + 1, document.querySelectorAll('#tipd h2').length]; }), [true, 0]);
});
test('[RF 7] deficit leggero spiegato come ricomposizione', async p => {
  assert(await ev(p, () => /ricomposizione/i.test(TIPS.find(t => t.t === 'Non tagliare troppo le calorie').b)));
});

/* ---------- Logo al centro e icone che riportano indietro ---------- */
test('logo al centro sul telefono', async p => {
  const r = await ev(p, () => { const b = document.querySelector('.brand').getBoundingClientRect(); return Math.abs((b.left + b.right) / 2 - innerWidth / 2); });
  assert(r <= 8, 'distanza dal centro ' + r);
});
test('icona della sezione: dalla categoria torna alle righe dove eri', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await ev(p, () => window.scrollTo(0, 900)); await p.waitForTimeout(80);
  await p.click('[data-cat="Spesa e cucina"]'); await p.waitForTimeout(80);
  await ev(p, () => window.scrollTo(0, 1500)); await p.waitForTimeout(60);
  await p.click('nav.tabs a[data-v="consigli"]'); await p.waitForTimeout(150);
  assertEq(await ev(p, () => [document.querySelectorAll('.trow').length, Math.abs(scrollY - 900) < 60, location.hash]), [6, true, '#consigli']);
});
test('indietro del telefono dalla categoria torna alle righe', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await p.click('[data-cat="Alimentazione"]'); await p.waitForTimeout(80);
  await p.goBack(); await p.waitForTimeout(150);
  assertEq(await ev(p, () => [document.querySelectorAll('.trow').length, location.hash]), [6, '#consigli']);
});
test('cambiando sezione si ritrova il punto in cui eri', async p => {
  await ev(p, () => { location.hash = 'ricette'; }); await p.waitForTimeout(200);
  await ev(p, () => window.scrollTo(0, 800)); await p.waitForTimeout(80);
  await p.click('nav.tabs a[data-v="oggi"]'); await p.waitForTimeout(150);
  const top = await ev(p, () => scrollY);
  await p.click('nav.tabs a[data-v="ricette"]'); await p.waitForTimeout(200);
  assertEq([top, await ev(p, () => Math.abs(scrollY - 800) < 60)], [0, true]);
});
test('icona della sezione attiva senza niente aperto: torna in cima', async p => {
  await ev(p, () => { location.hash = 'ricette'; }); await p.waitForTimeout(200);
  await ev(p, () => window.scrollTo(0, 800)); await p.waitForTimeout(80);
  await p.click('nav.tabs a[data-v="ricette"]'); await p.waitForTimeout(700);
  assertEq(await ev(p, () => scrollY), 0);
});
test('icona Oggi su un giorno passato torna a oggi e chiude le voglie', async p => {
  await ev(p, () => { location.hash = 'oggi'; ui.dayOff = 2; ui.voglia = 'fast'; viewOggi(); }); await p.waitForTimeout(150);
  await p.click('nav.tabs a[data-v="oggi"]'); await p.waitForTimeout(150);
  assertEq(await ev(p, () => [ui.dayOff, ui.voglia]), [0, null]);
});
test('icona della sezione chiude la scheda ricetta aperta', async p => {
  await ev(p, () => { location.hash = 'ricette'; }); await p.waitForTimeout(200);
  await ev(p, () => openRecipe(R[0].id, 1)); await p.waitForTimeout(80);
  await ev(p, () => document.querySelector('nav.tabs a[data-v="ricette"]').click()); await p.waitForTimeout(100);
  assertEq(await ev(p, () => !!document.getElementById('ov')), false);
});
test('[RF 1] dopo aver ricaricato in una categoria, Tutte le categorie funziona al primo tocco', async p => {
  await ev(p, () => { location.hash = 'consigli'; }); await p.waitForTimeout(150);
  await p.click('[data-cat="Alimentazione"]'); await p.waitForTimeout(80);
  await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-cat="Spesa e cucina"]'); await p.waitForTimeout(80);
  await p.click('[data-cat=""]'); await p.waitForTimeout(150);
  assertEq(await ev(p, () => document.querySelectorAll('.trow').length), 6);
});
test('[RF 2] indietro del telefono conserva il punto della sezione lasciata', async p => {
  await ev(p, () => { location.hash = 'ricette'; }); await p.waitForTimeout(200);
  await ev(p, () => window.scrollTo(0, 800)); await p.waitForTimeout(80);
  await p.click('nav.tabs a[data-v="consigli"]'); await p.waitForTimeout(150);
  await ev(p, () => window.scrollTo(0, 700)); await p.waitForTimeout(80);
  const y = await ev(p, () => scrollY);
  await p.goBack(); await p.waitForTimeout(200);
  const r = await ev(p, () => [location.hash, Math.abs(scrollY - 800) < 60]);
  await p.click('nav.tabs a[data-v="consigli"]'); await p.waitForTimeout(200);
  assertEq([r, await ev(p, y => Math.abs(scrollY - y) < 60, y)], [['#ricette', true], true]);
});

/* ---------- Piano: menù di oggi subito visibile ---------- */
test('piano: il menù di oggi si vede nella prima schermata', async p => {
  await ev(p, () => { location.hash = 'piano'; }); await p.waitForTimeout(150);
  assertEq(await ev(p, () => { const t = document.querySelector('.day.today'); const vis = [...document.querySelectorAll('.day')].filter(d => !d.hidden); return [!!t && !t.hidden, vis.length, t.getBoundingClientRect().top < innerHeight - 150]; }), [true, 1, true]);
});
test('piano: la striscia dei giorni cambia giorno e Settimana li mostra tutti', async p => {
  await ev(p, () => { location.hash = 'piano'; }); await p.waitForTimeout(150);
  const other = await ev(p, () => ((new Date().getDay() + 6) % 7 + 1) % 7);
  await p.click(`[data-pday="${other}"]`); await p.waitForTimeout(60);
  const shown = await ev(p, () => [...document.querySelectorAll('.day')].filter(d => !d.hidden).map(d => d.querySelector('h3').textContent));
  await p.click('[data-act="pweek"]'); await p.waitForTimeout(60);
  assertEq([shown.length, shown[0].startsWith(await ev(p, o => DAYS[o], other)), await ev(p, () => [...document.querySelectorAll('.day')].filter(d => !d.hidden).length)], [1, true, 7]);
});
test('piano: scorrere di lato sul menù passa al giorno dopo', async p => {
  await ev(p, () => { location.hash = 'piano'; }); await p.waitForTimeout(150);
  const before = await ev(p, () => ui.pday);
  await ev(p, () => { const el = document.querySelector('.day:not([hidden])'), mk = (t, x) => { const e = new Event(t, { bubbles: true }); e.changedTouches = [{ clientX: x, clientY: 300 }]; e.touches = e.changedTouches; return e; }; el.dispatchEvent(mk('touchstart', 300)); el.dispatchEvent(mk('touchend', 150)); });
  await p.waitForTimeout(60);
  assertEq(await ev(p, () => ui.pday), (before + 1) % 7);
});
test('piano: obiettivo in alto, poi il menù, poi i nutrienti', async p => {
  await ev(p, () => { location.hash = 'piano'; }); await p.waitForTimeout(150);
  assertEq(await ev(p, () => { const y = sel => document.querySelector('#v-piano ' + sel).getBoundingClientRect().top, g = y('.goal'), d = y('.days'), c = y('.cov'); return [g < d, d < c, y('.dstrip') > g]; }), [true, true, true]);
});
test('[RF 1] piano: il fuoco resta sul giorno scelto con la tastiera', async p => {
  await ev(p, () => { location.hash = 'piano'; }); await p.waitForTimeout(150);
  await p.focus('[data-pday="5"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(60);
  const a = await ev(p, () => document.activeElement.dataset.pday);
  await p.focus('[data-act="pweek"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(60);
  assertEq([a, await ev(p, () => document.activeElement.dataset.act)], ['5', 'pweek']);
});
test('[RF 2] piano: dopo mezzanotte il primo tocco su un giorno funziona', async p => {
  await ev(p, () => { location.hash = 'piano'; }); await p.waitForTimeout(150);
  await ev(p, () => { ui.pdayKey = '2000-01-01'; });
  await p.click('[data-pday="6"]'); await p.waitForTimeout(60);
  assertEq(await ev(p, () => ui.pday), 6);
});
test('[RF 3] piano: scorrere in diagonale o in verticale non cambia giorno', async p => {
  await ev(p, () => { location.hash = 'piano'; }); await p.waitForTimeout(150);
  const before = await ev(p, () => ui.pday);
  await ev(p, () => { const sw = (x0, y0, x1, y1) => { const el = document.querySelector('.day:not([hidden])'), mk = (t, x, y) => { const e = new Event(t, { bubbles: true }); e.changedTouches = [{ clientX: x, clientY: y }]; e.touches = t === 'touchend' ? [] : e.changedTouches; return e; }; el.dispatchEvent(mk('touchstart', x0, y0)); el.dispatchEvent(mk('touchend', x1, y1)); };
    sw(300, 300, 230, 365); sw(200, 400, 210, 150); });
  await p.waitForTimeout(60);
  assertEq(await ev(p, () => ui.pday), before);
});
test('[RF 4] piano: oggi si riconosce anche quando guardi un altro giorno', async p => {
  await ev(p, () => { location.hash = 'piano'; }); await p.waitForTimeout(150);
  const ti = await ev(p, () => (new Date().getDay() + 6) % 7);
  await p.click(`[data-pday="${(ti + 1) % 7}"]`); await p.waitForTimeout(60);
  assert(await ev(p, ti => { const t = getComputedStyle(document.querySelector(`[data-pday="${ti}"]`)), o = getComputedStyle(document.querySelector(`[data-pday="${(ti + 2) % 7}"]`)); return t.borderTopColor !== o.borderTopColor; }, ti));
});

/* ---------- Nutrienti (CREA) ---------- */
test('nutrienti: tabella CREA incorporata', async p => {
  assertEq(await ev(p, () => { const sp = NUTDB['005700'], kf = NUT_KEYS.indexOf('fe'), kc = NUT_KEYS.indexOf('ca');
    return [NUT_KEYS.length, Object.keys(NUTDB).length >= 800, /Spinaci, crudi/.test(sp.n), sp.v[kf] > 2 && sp.v[kf] < 4, sp.v[kc] > 60, typeof NUT_SRC.crea]; }),
    [24, true, true, true, true, 'string']);
});

test('nutrienti: ogni ingrediente delle ricette è collegato', async p => {
  assertEq(await ev(p, () => [...new Set(R.filter(r => !r.tags.includes('mia')).flatMap(r => r.ing.filter(i => i[2] !== 'q.b.').map(i => i[0])))].filter(n => !(n in ING_CREA))), []);
});
test('nutrienti: ogni cibo del calcolatore è collegato', async p => {
  assertEq(await ev(p, () => FOODS.filter(f => !f.mine && !f.prod && !(f.n in FOOD_CREA)).map(f => f.n)), []);
});
test('nutrienti: collegamenti puntano a codici esistenti', async p => {
  assertEq(await ev(p, () => Object.values(ING_CREA).concat(Object.values(FOOD_CREA)).filter(v => v).flatMap(v => typeof v === 'string' ? [v] : v.map(x => x[0])).filter(c => !NUTDB[c])), []);
});
test('nutrienti: testo libero abbinato', async p => {
  assertEq(await ev(p, () => ['salmone', 'spinaci', 'ceci cotti', 'zzzz'].map(t => { const c = nutMatch(t); return c ? NUTDB[c].n.split(',')[0] : null; })), ['Salmone', 'Spinaci', 'Ceci', null]);
});

test('nutrienti: una ricetta scala con le porzioni e il sale è stimato', async p => {
  assertEq(await ev(p, () => { const r = R.find(x => x.s.some(t => /\bsale\b/i.test(t)) && !x.tags.includes('sgarro')), a = nutOfRecipe(r, 1), b = nutOfRecipe(r, .5), fe = NUT_KEYS.indexOf('fe'), na = NUT_KEYS.indexOf('na');
    return [Math.abs(b.v[fe] * 2 - a.v[fe]) < 1e-6, a.v[na] >= 393, a.est.na]; }), [true, true, true]);
});
test('nutrienti: 250 g di spinaci dal calcolatore', async p => {
  assertEq(await ev(p, () => { const it = rowsToItems(calcRows('250 g spinaci', {}, []))[0], fe = NUT_KEYS.indexOf('fe'), ref = nutOfCode(FOOD_CREA['Spinaci'], 250).v[fe]; return Math.abs(it.nu[fe] - ref) < .2 && ref > 0; }), true);
});
test('nutrienti: fabbisogni LARN cambiano con sesso ed età', async p => {
  assertEq(await ev(p, () => { const fe = NUT_KEYS.indexOf('fe'), ca = NUT_KEYS.indexOf('ca'); return [nutTargets({ sesso: 'f', eta: 25, peso: 60, alt: 165, att: 'leggero', obj: 'mant' })[fe], nutTargets({ sesso: 'm', eta: 65, peso: 75, alt: 175, att: 'leggero', obj: 'mant' })[ca], nutTargets({ sesso: 'm', eta: 30, peso: 72, alt: 178, att: 'leggero', obj: 'mant' })[ca]]; }), [18, 1100, 950]);
});
test('nutrienti: prodotti Open Food Facts convertiti in mg', async p => {
  assertEq(await ev(p, () => { const pr = offNorm({ code: '80000040', product_name: 'Cereali', nutriments: { 'energy-kcal_100g': 380, iron_100g: 0.012, 'vitamin-c_100g': 0.03 } }); return [Math.round(pr.nu[NUT_KEYS.indexOf('fe')]), Math.round(pr.nu[NUT_KEYS.indexOf('vC')]), pr.nu[NUT_KEYS.indexOf('ca')]]; }), [12, 30, null]);
});
test('nutrienti: voci senza dati non diventano carenze', async p => {
  assertEq(await ev(p, () => { const k = todayKey(); log[k] = { items: [{ n: 'Cibo insegnato', k: 500, p: 20, c: 50, f: 20, src: 'q' }], water: 0 }; const d = dayNutrients(k), fe = NUT_KEYS.indexOf('fe'); return [d.cover[fe], d.v[fe]]; }), [0, 0]);
});
test('nutrienti: la settimana conta solo i giorni con pasti', async p => {
  assertEq(await ev(p, () => { const r = R.find(x => x.id === 'mug-cake'); const add = off => { const d = new Date(); d.setDate(d.getDate() - off); log[todayKey(d)] = { items: [{ n: r.n, rid: r.id, k: r.k, p: r.p, c: r.c, f: r.f, src: 'r' }], water: 0 }; }; add(0); add(3);
    const w = weekNutrients(new Date()), dd = dayNutrients(todayKey()), ca = NUT_KEYS.indexOf('ca'); return [w.days, Math.abs(w.v[ca] - dd.v[ca]) < 1e-6]; }), [2, true]);
});

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
  const t = await p.textContent('#nutv');
  assert(/media/i.test(t) && /dati/i.test(t), t.slice(0, 300));
});
test('nutrienti: la scheda ricetta mostra i nutrienti per porzione', async p => {
  await ev(p, () => openRecipe('mug-cake', 1)); await p.waitForTimeout(80);
  assert(/Nutrienti per porzione/.test(await p.textContent('#ov')) && await p.locator('#ov .rnut').count() === 1);
});
test('nutrienti: senza pasti il riquadro invita a segnare', async p => {
  await ev(p, () => { location.hash = 'oggi'; }); await p.waitForTimeout(150);
  assert(/Segna/.test(await p.textContent('#nut-card')));
});

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
