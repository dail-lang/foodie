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
