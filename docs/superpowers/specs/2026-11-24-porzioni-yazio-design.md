# Foodie: quantità giuste, conferma come Yazio, prodotti di marca e codice a barre

## Perché
"5 nuggets" veniva segnato come 5 cotolette (750 g, circa 1950 kcal). La persona vuole che il calcolatore "Fuori piano" sia affidabile come Yazio: scrivi cosa hai mangiato e i numeri tornano, senza dover ricontrollare i conti. Ha scelto la strada "come Yazio": prima di salvare vedi ogni cibo con la sua quantità e puoi correggerla. Dopo aver chiesto come fa Yazio ad avere un database così preciso (non si può copiare: è proprietario e sta sui loro server), ha scelto di fare tutte e due le cose possibili: pesi di riferimento presi da tabelle pubbliche (CREA, USDA) **e** prodotti di marca da Open Food Facts quando c'è internet, **con lettura del codice a barre**.

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
6. **Pesi di riferimento da fonti pubbliche.** I pesi dei pezzi (obiettivi 1 e 2) si prendono dalle tabelle CREA e dai pesi delle porzioni USDA FoodData Central (pubblico dominio); nella tabella di riferimento del test ogni riga indica la fonte.
7. **Prodotti di marca da Open Food Facts (online).** Database aperto (licenza ODbL), oltre 4 milioni di prodotti confezionati.
   - **Nel calcolatore:** se un pezzo di frase non è riconosciuto, o se apri "Non è questo?", l'app cerca anche tra i prodotti di marca (preferendo quelli venduti in Italia e i più diffusi) e propone fino a 5 risultati con nome, marca e kcal per 100 g. Sceglierne uno mette quel prodotto nella riga, con la quantità modificabile (porzione dell'etichetta se c'è, altrimenti 100 g; se la frase diceva un numero di pezzi e il prodotto ha la porzione, pezzi × porzione).
   - **Ricerca solo quando serve:** non a ogni lettera; si aspetta che smetti di scrivere (circa mezzo secondo) e si cerca solo per i pezzi non riconosciuti o su richiesta.
   - **Offline o errore:** l'app lo dice in una riga ("Sei offline: i prodotti di marca non sono disponibili") e tutto il resto funziona come prima.
   - **Prodotti ricordati:** ogni prodotto scelto (da ricerca o codice a barre) viene salvato sul telefono con i suoi valori per 100 g e la porzione, così la volta dopo "kinder bueno" si riconosce anche offline, come i cibi insegnati. Sono inclusi nel backup.
   - Si scartano i prodotti senza calorie; se mancano proteine, carboidrati o grassi valgono 0 e la riga lo segnala ("dati incompleti").
   - Sotto i risultati: "Dati: Open Food Facts" (richiesto dalla licenza).
8. **Lettura del codice a barre.** Un pulsante "Scansiona" accanto al campo del calcolatore apre la fotocamera posteriore; letto il codice, l'app chiede il prodotto a Open Food Facts e lo aggiunge come riga modificabile del risultato. Se il prodotto non esiste o non ha le calorie: "Prodotto non trovato" con la possibilità di inserirlo a mano (modulo manuale già esistente). Funziona anche scrivendo le cifre del codice a mano. Se il telefono non supporta la lettura nel browser, la libreria di lettura si scarica solo al primo uso (serve comunque internet per il prodotto).
9. **Salvataggio fedele.** Il diario riceve i valori dopo le modifiche; i "Recenti" ripropongono la versione corretta (se hai modificato qualcosa, salvano i numeri finali invece del testo).

## Non obiettivi
- Riconoscimento del piatto da foto.
- Aggiungere o correggere prodotti su Open Food Facts dall'app.
- Cambiare il resto dell'app (piano, ricette, allenamento).

## Anti-obiettivi
- Rendere più lento il caso in cui tutto è già giusto.
- Peggiorare le frasi che oggi funzionano: i test delle 100 frasi comuni e delle frasi fissate restano verdi.
- Perdere dati del diario, dei recenti o dei cibi insegnati.

## Vincoli
- Stessa app a file unico (`src/app.html`), build `tools/build.py`, test `tools/test.cjs` (Playwright).
- Testi in italiano, colori da token, leggibile e toccabile a 400 px in chiaro e scuro (pulsanti − / + almeno 40 px).
- Tutto tranne prodotti di marca e codice a barre funziona offline.
- I test non dipendono da internet: le risposte di Open Food Facts si simulano.
- Privacy: a Open Food Facts va solo il nome del cibo cercato o il codice a barre, nient'altro.
- L'app installata (GitHub Pages) è quella che conta; se nella versione artifact fotocamera o richieste esterne non sono permesse, lì la funzione si nasconde con una riga di spiegazione.

## Strade considerate
1. **Solo dati corretti:** si sistemano le voci, il flusso resta "scrivi e aggiungi". Più veloce, ma una frase ambigua entra nel diario senza che te ne accorga.
2. **Dati corretti + conferma come Yazio (scelta dalla persona):** voci sistemate, quantità e cibo modificabili prima di salvare, avviso per quantità sospette.
3. **Copiare il database di Yazio:** non permesso (proprietario, sui loro server); scartata.
4. **Solo pesi da tabelle pubbliche (A):** offline, copre piatti e cibi generici, ma i prodotti di marca restano stime.
5. **A + prodotti di marca da Open Food Facts + codice a barre (scelta dalla persona).**

## Decisioni prese da Claude (correggibili)
- "Non è questo?" con alternative (obiettivo 4): la persona si è lamentata anche dell'identità del cibo, non solo dei grammi.
- Soglie dell'avviso: 3 porzioni o 1200 kcal per singolo cibo.
- Le modifiche restano legate al pezzo di testo a cui si riferiscono: se continui a scrivere, le righe già corrette non tornano indietro; se cambi quel pezzo di testo, la riga si ricalcola da capo.
- Pezzi a passi di 1 (mezzo pezzo se la frase lo diceva già), grammi a passi liberi.
- Fino a 5 risultati di marca, preferendo prodotti venduti in Italia e i più scansionati.
- Prodotti scelti salvati automaticamente sul telefono (non serve "Ricordalo").
- Lettore di codici: quello del browser se c'è, altrimenti una libreria scaricata al primo uso.

## Domande chiuse con la verifica del costruttore
- **Diario: una voce per cibo, come Yazio** (risposto dalla scelta "fai come Yazio"). "Aggiungi" salva una voce per ogni riga, con nome del cibo e quantità finale (es. "Nuggets di pollo · 5 pezzi"), così ognuna si può togliere da sola. Il chip dei "Recenti" resta uno per frase, ma salva le righe finali (cibo, grammi e valori) e le riaggiunge identiche; i recenti salvati con il vecchio formato (solo testo) continuano a funzionare.
- **Quali parole richiamano un prodotto salvato (decisione di Claude).** Un prodotto scelto si salva con nomi ripuliti da pesi e numeri: "marca + nome" e "nome" (es. "kinder bueno", "bueno white"). Le parole scritte dalla persona si aggiungono come nome solo se quel pezzo di frase non era stato riconosciuto da nessun cibo della tabella. Un prodotto salvato non riceve il bonus dei cibi insegnati: vince solo se i suoi nomi combaciano con più parole di un cibo generico. Così "spaghetti" resta pasta generica anche dopo aver scelto una volta un prodotto Barilla.
- **Scelta di un'alternativa generica da "Non è questo?" (decisione di Claude):** vale solo per quella frase, non viene ricordata.
- **Prodotti scansionati (decisione di Claude):** compaiono come righe in più nello stesso riquadro del risultato, sotto quelle della frase, anche se il campo di testo è vuoto. Restano finché non premi "Aggiungi" o la × della riga; cambiare il testo non le tocca.
- **Codice a barre scritto a mano (decisione di Claude):** si scrive nella finestra della fotocamera, non nel campo del calcolatore, quindi la lettura delle frasi non cambia.

## Lasciato al costruttore
- Valori nutrizionali delle nuove voci (fonti CREA/USDA, realistici).
- Aspetto esatto delle righe modificabili, del menu "Non è questo?" e della finestra della fotocamera.
- Quali campi di Open Food Facts usare e come scegliere il nome italiano del prodotto.
