# Foodie: logo al centro e icone in basso che riportano indietro

## Perché
La persona vuole il logo al centro ("più carino") e non vuole più risalire in cima alla pagina per tornare indietro (es. "‹ Tutte le categorie" nei Consigli): toccando le icone in basso deve tornare alla pagina precedente. Approvato in chat ("Sì") sulla proposta qui sotto.

## Cosa cambia
1. **Logo al centro** della barra in alto sul telefono (≤ 700 px, dove le icone sono in basso). Su schermi larghi resta com'è (logo a sinistra, sezioni a destra).
2. **Toccare l'icona della sezione in cui sei** chiude quello che è aperto e riporta alla pagina principale della sezione:
   - Consigli aperti su una categoria → torna alle righe, nel punto in cui eri;
   - Oggi su un giorno passato → torna a oggi; il riquadro "Ho voglia di…" aperto si chiude;
   - pannelli aperti (consiglio, codice a barre, scheda ricetta) si chiudono;
   - se non c'è niente da chiudere, la pagina torna su in cima.
3. **Il tasto "indietro" del telefono** dalla lista di una categoria dei Consigli torna alle righe (non esce dalla sezione).
4. **Cambiando sezione** ognuna si ritrova nel punto in cui era stata lasciata, invece di ripartire dall'alto.

## Non obiettivi
- Nessun cambio a icone, nomi o ordine delle sezioni.
- Modalità cucina e allenamento guidato (a schermo intero, con la loro uscita e la bozza salvata) non si chiudono toccando le icone.

## Strade considerate
1. **Icona della sezione attiva = torna alla pagina principale (scelta, approvata):** come le app di iPhone e Android.
2. Pulsante "indietro" fisso in basso: un pulsante in più nella barra già piena; scartata.

## Piano (cambio piccolo)
1. Test che falliscono: logo centrato a 400 px; tocco sull'icona Consigli dalla lista di una categoria → righe e posizione ripristinata; indietro del telefono → righe; scroll conservato tra Ricette e Oggi; tocco sull'icona attiva senza niente aperto → in cima; Oggi su ieri → oggi.
2. Implementazione in `src/app.html` (CSS della barra in alto, gestore dei tocchi sulle icone, posizione per sezione, `history.pushState` per la lista di categoria).
3. Tutti i test verdi, controllo visivo a 400 px chiaro e scuro, revisione, unione e pubblicazione.
