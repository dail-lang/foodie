# Allenamento: modalità guidata, registro pesi, stretching

## Perché
La persona vuole una sezione Allenati "perfetta" e ha chiesto lo stretching prima e dopo. Ha scelto tre migliorie (la sostituzione degli esercizi resta fuori).

## Cosa
1. **Modalità allenamento guidata** (come la modalità cucina): riscaldamento dinamico → un esercizio alla volta con le serie da spuntare (kg in palestra, ripetizioni o secondi) → timer di recupero automatico che usa i timer globali esistenti (palestra: 150 s per i primi due esercizi della scheda, 90 s per gli altri; casa: 60 s) → stretching statico finale → "Fine" salva le serie e segna l'allenamento del giorno (scheda A/B).
2. **Registro pesi** `pp.wlog` = `{exId: [{d, sets:[{kg,reps}]}]}`, incluso nel backup. Per ogni esercizio: "Ultima volta" e un suggerimento: prima volta → scegliere un carico con 1–2 ripetizioni di riserva; tutte le serie al massimo dell'intervallo → +2,5 kg (palestra) o versione più difficile (casa); altrimenti stesso carico e una ripetizione in più.
3. **Stretching**: 7 esercizi dinamici prima (non statici: lo stretching statico prolungato prima dei pesi può ridurre un po' la forza) e 7 statici dopo, 30 s per lato, con timer.

## Vincoli
Stesso file `src/app.html`, test in `tools/test.cjs`, leggibile a 400 px in chiaro e scuro, nessun dato perso; dati vecchi senza `wlog` funzionano.

## Strade
Una sola sensata: estendere la sezione esistente come la modalità cucina. Un'app separata per l'allenamento sarebbe scollegata dal diario e dalle medaglie.
