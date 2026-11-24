# Foodie

Ricette sane e veloci, piano pasti settimanale sulle tue calorie (anche ricomposizione "skinny fat" e modalità Superfood), diario giornaliero, modalità cucina con timer, lista della spesa, schede di allenamento a casa e in palestra, consigli nutrizionali.

È un'app web installabile (PWA): funziona anche offline e i dati restano solo sul tuo dispositivo.

## Installarla sul telefono

- **iPhone (Safari):** apri il sito → Condividi → "Aggiungi alla schermata Home".
- **Android (Chrome):** apri il sito → menu ⋮ → "Installa app".

## Pubblicazione

GitHub Pages dal branch `main`, cartella `/ (root)`.

Le calorie e i valori nutrizionali sono stime indicative e non sostituiscono il parere di un medico o di un dietista.

## Sviluppo

- Il sorgente è `src/app.html`. Dopo ogni modifica: `python3 -I tools/build.py` (genera `index.html` e aggiorna la cache di `sw.js`).
- Test: `node tools/test.cjs` (richiede Playwright). `node tools/test.cjs voto` esegue solo i test con "voto" nel nome.
