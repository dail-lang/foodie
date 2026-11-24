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
  const odd = await ev(p, () => [...new Set(R.flatMap(r => r.ing).filter(i => i[2] !== 'q.b.').map(i => i[0]))].filter(n => aisleOf(n) === 'Dispensa e condimenti' && !/olio|miele|cacao|lievito|salsa|tahina|agar|brodo|aceto|curry|cannella|zucchero|granola|cioccolato|burro d|burro di|cocco|caff/i.test(n)));
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
