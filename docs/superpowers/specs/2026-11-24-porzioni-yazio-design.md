# Foodie: quantità giuste e conferma come Yazio

## Perché
"5 nuggets" veniva segnato come 5 cotolette (750 g, circa 1950 kcal). La persona vuole che il calcolatore "Fuori piano" sia affidabile come Yazio: scrivi cosa hai mangiato e i numeri tornano, senza dover ricontrollare i conti. Ha scelto la strada "come Yazio": prima di salvare vedi ogni cibo con la sua quantità e puoi correggerla.

## Causa
Nella tabella dei cibi, nomi diversi condividono una sola voce e quindi lo stesso peso del pezzo: nuggets, crocchette di pollo e cordon bleu dentro "Cotoletta impanata" (150 g); bignè e cannolo dentro "Pasticcini" (70 g); wurstel dentro "Salsiccia" (100 g); mandarino dentro "Arancia" (150 g); fichi secchi e uvetta dentro "Datteri" (8 g); supplì dentro "Arancino" (200 g); pizzetta dentro "Pizza al taglio" (120 g). Inoltre nessun controllo segnala una quantità assurda.

## Obiettivi
1. **Pezzi giusti per ogni nome.** Separare in voci proprie i nomi che hanno un pezzo o una porzione molto diversi dalla voce in cui stanno (es. Nuggets ~18 g a pezzo, Cordon bleu ~100 g, Wurstel ~50 g, Mandarino ~70 g, Fico secco ~20 g, Supplì ~120 g, Pizzetta ~50 g, Bignè ~25 g), con valori nutrizionali propri. Il controllo riguarda **tutte** le voci con più nomi, non solo quelle elencate qui.
2. **Test che impedisce il ritorno dell'errore.** Una tabella di riferimento "1 <nome> → grammi attesi" che copre ogni nome delle voci con un peso del pezzo; il test fallisce se un nome dà un pezzo fuori di ±30% dal riferimento. Più frasi di prova del tipo "5 nuggets", "3 mandarini", "2 wurstel".
3. **Conferma come Yazio.** Nel risultato del calcolatore ogni cibo riconosciuto ha la sua quantità modificabile:
   - se è contato a pezzi (o unità come fetta, bicchiere, vasetto): pulsanti − / + e il numero di pezzi, con i grammi accanto;
   - altrimenti: i grammi (o ml) in un campo modificabile.
   Calorie e macro della riga, il totale e il pulsante "Aggiungi al diario · N kcal" si aggiornano subito. Se non tocchi nulla, un solo tocco su "Aggiungi" come oggi.
4. **"Non è questo?"** Su ogni riga un piccolo link che mostra fino a 3 altri cibi plausibili per quelle parole (i migliori dopo il primo) più "Insegnami"; sceglierne uno ricalcola la riga con la stessa quantità in pezzi o grammi.
5. **Avviso di quantità sospetta.** Se un singolo cibo supera 3 porzioni normali oppure 1200 kcal, la riga mostra "Controlla la quantità" (non blocca il salvataggio).
6. **Salvataggio fedele.** Il diario riceve i valori dopo le modifiche; i "Recenti" ripropongono la versione corretta (se hai modificato qualcosa, salvano i numeri finali invece del testo).

## Non obiettivi
- Database online di prodotti di marca, codice a barre, foto del piatto.
- Cambiare il resto dell'app (piano, ricette, allenamento).

## Anti-obiettivi
- Rendere più lento il caso in cui tutto è già giusto.
- Peggiorare le frasi che oggi funzionano: i test delle 100 frasi comuni e delle frasi fissate restano verdi.
- Perdere dati del diario, dei recenti o dei cibi insegnati.

## Vincoli
- Stessa app a file unico (`src/app.html`), build `tools/build.py`, test `tools/test.cjs` (Playwright).
- Testi in italiano, colori da token, leggibile e toccabile a 400 px in chiaro e scuro (pulsanti − / + almeno 40 px).
- Funziona offline.

## Strade considerate
1. **Solo dati corretti:** si sistemano le voci, il flusso resta "scrivi e aggiungi". Più veloce, ma una frase ambigua entra nel diario senza che te ne accorga.
2. **Dati corretti + conferma come Yazio (scelta dalla persona):** voci sistemate, quantità e cibo modificabili prima di salvare, avviso per quantità sospette.
3. Database online (Open Food Facts): serve internet e non risolve i piatti fatti in casa; scartata.

## Decisioni prese da Claude (correggibili)
- "Non è questo?" con alternative (obiettivo 4): la persona si è lamentata anche dell'identità del cibo, non solo dei grammi.
- Soglie dell'avviso: 3 porzioni o 1200 kcal per singolo cibo.
- Le modifiche restano legate al pezzo di testo a cui si riferiscono: se continui a scrivere, le righe già corrette non tornano indietro; se cambi quel pezzo di testo, la riga si ricalcola da capo.
- Pezzi a passi di 1 (mezzo pezzo se la frase lo diceva già), grammi a passi liberi.

## Lasciato al costruttore
- Valori nutrizionali delle nuove voci (fonti CREA/USDA, realistici).
- Aspetto esatto delle righe modificabili e del menu "Non è questo?".
