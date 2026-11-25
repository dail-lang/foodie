# Foodie: sgarri fit e "Ho voglia di…"

## Perché
Le voglie della persona sono due: **fast food tipo McDonald's** (burger, patatine, nuggets) e **pane con la Nutella** e simili. Oggi l'app ha 30 sgarri sani, quasi tutti dolci da cucchiaio e spuntini (23 spuntini, 2 pranzi, 6 cene); il fast food salato è quasi assente. La persona vuole (1) più sgarri fit, e (2) una funzione che, quando ha voglia di sgarrare, le consiglia cosa prendere. Ha scelto la strada A: un pulsante "Ho voglia di…" che guarda le calorie che restano oggi e propone sia versioni fatte in casa sia cosa ordinare se esce. Va ancora da McDonald's ogni tanto ("Vai" alla proposta della guida su cosa ordinare).

## Obiettivi
1. **"Ho voglia di…" nella pagina Oggi** (giorno selezionato), un riquadro con 5 voglie: **Fast food**, **Pane e Nutella** (dolce spalmabile), **Pizza**, **Gelato**, **Dolce/cioccolato**. Toccandone una compare:
   - **Quanto ti resta oggi**: obiettivo calorie del profilo meno quanto è già segnato nel diario di quel giorno.
   - **Fatto in casa**: fino a 3 ricette sgarro di quella voglia che stanno nelle calorie rimaste (1 porzione), compatibili con la dieta del profilo (onnivora/vegetariana/vegana; senza maiale come tutta l'app), dalla più proteica per kcal. Per ognuna: nome, kcal, proteine, pulsanti "Ricetta" (apre la scheda) e "Segna" (aggiunge 1 porzione al diario come le ricette da "Oppure una ricetta dell'app").
   - **Se esci**: fino a 3 scelte da locale per quella voglia che stanno nelle calorie rimaste, dalla più proteica per kcal, ciascuna con kcal e proteine e pulsante "Segna" (va nel diario come voce del giorno). Più una riga **"Da evitare"** con la scelta tipica più pesante e le sue kcal (es. menu Big Mac con patatine grandi e bibita).
   - **Un consiglio pratico** per quella voglia (una frase).
   - Se le calorie rimaste non bastano per nessuna ricetta intera ma bastano per **mezza porzione**, si propone la mezza porzione (si segna con 0,5 porzioni) — decisione di Claude.
   - Se non basta nemmeno così, si mostrano le 3 opzioni più leggere con "Ti restano X kcal: queste sono le scelte più leggere." (decisione di Claude).
   - Se le calorie rimaste sono poche (< 150) o finite: si mostrano comunque le 3 opzioni più leggere con la frase "Oggi le calorie sono quasi finite: se proprio ti va, scegli la più leggera e domani riparti normale, senza saltare pasti." Niente toni colpevolizzanti.
2. **Scelte da locale** (valori indicativi, scritti come tali in pagina con la fonte):
   - **McDonald's** per Fast food e per Gelato/Dolce (McFlurry, Sundae): panini, nuggets, patatine, insalata, bibite zero, combinazioni sensate (es. "McChicken + insalata + Coca-Cola Zero"). **Niente prodotti con maiale o bacon.**
   - **Pizzeria** per Pizza (margherita, marinara, ortolana, mezza pizza + insalata…).
   - **Gelateria** per Gelato (coppetta piccola 2 gusti alla frutta, cono piccolo…).
   - **Bar/pasticceria** per Dolce (cornetto vuoto, crostatina, quadratini di fondente…).
   - **Supermercato** per Pane e Nutella: la porzione vera (es. 1 fetta di pane + 15 g di crema = 1 cucchiaino colmo) e alternative.
   I valori McDonald's si prendono dalle tabelle ufficiali di McDonald's Italia; gli altri dalle voci già presenti nel calcolatore (CREA/USDA).
3. **~25 nuovi sgarri fit** (tag `sgarro`), senza maiale, ≤ 30 minuti, con voce in `MICRO` e la loro **voglia** (una delle 5). Almeno 10 adatti a pranzo o cena. Copertura minima per voglia: Fast food ≥ 8, Pane e Nutella ≥ 5, Pizza ≥ 4, Gelato ≥ 3, Dolce ≥ 3; almeno 2 vegetariani per Fast food e Pizza. Esempi: smash burger fit, cheeseburger fit, burger con salsa "big" leggera, chicken burger croccante al forno, wrap di pollo croccante, crispy chicken tenders in friggitrice ad aria, fish burger, patatine in friggitrice ad aria, "McFlurry" fit con yogurt greco, milkshake proteico, crema spalmabile nocciole e cacao fatta in casa, toast crema e banana, crêpe con crema fit, pizza in padella integrale, pizza su tortilla, calzone fit, mozzarelline al forno.
4. **Le ricette sgarro esistenti** ricevono la loro voglia quando ne hanno una chiara (es. pizze → Pizza, mousse e brownie → Dolce, gelati → Gelato), così compaiono anche loro nei suggerimenti. Quelle che non corrispondono a nessuna voglia (es. popcorn al cacao, palline energetiche) restano senza (decisione di Claude: forzarle peggiorerebbe i suggerimenti).
5. **Consigli "Voglie e sgarri"**: circa 10 schede nuove nella sezione Consigli, nello stesso formato delle altre (titolo, testo, fonte): la voglia passa in 15–20 minuti, fame o voglia, proteine prima, lo sgarro pianificato batte il "tutto o niente", sonno e voglie, porzionare nel piatto, la porzione vera della crema spalmabile, non compensare saltando pasti, cibi zucchero+grasso iperappetibili, mangiare con calma.

## Non obiettivi
- Nessuno sgarro programmato in un giorno fisso (strada B scartata dalla persona); gli sgarri restano normali candidati del piano.
- Nessun ordine, consegna o posizione dei locali; nessuna altra catena oltre a McDonald's.
- Nessuna modifica al calcolatore "Fuori piano".

## Anti-obiettivi
- Toni colpevolizzanti ("hai sgarrato", "cattivo").
- Valori dei locali presentati come esatti: sono indicativi e lo dice la pagina.
- Prodotti con maiale o derivati.
- Peggiorare il piano: calorie, proteine, pesce e legumi restano rispettati (vedi domanda aperta sugli sgarri nel piano).

## Vincoli
- Stessa app a file unico (`src/app.html`), build `tools/build.py`, test `tools/test.cjs`.
- Testi in italiano, colori da token, leggibile e toccabile a 400 px in chiaro e scuro.
- Funziona offline (tutti i dati sono nell'app).
- Ricette: stesso formato e controlli dei test esistenti (100–700 kcal, tag ammessi, unità ammesse, niente dosi a pezzi con la virgola).

## Strade considerate
1. **A — "Ho voglia di…" in Oggi (scelta dalla persona):** consiglio nel momento della voglia, calcolato sulle calorie rimaste, fatto in casa + locale.
2. B — A più sgarro programmato nel piano: scartata dalla persona.
3. C — solo consigli e ricette statiche: non tiene conto delle calorie del giorno; scartata.

## Decisioni prese da Claude (correggibili)
- 5 voglie (Fast food, Pane e Nutella, Pizza, Gelato, Dolce/cioccolato), dalle due voglie dette dalla persona più le tre più comuni.
- Ordine "più proteico per kcal": aiuta lo skinny fat e la sazietà.
- Il riquadro sta nella pagina Oggi, sopra "Fuori piano".
- Le scelte da locale si segnano nel diario con un tocco come voce unica (nome della combinazione).
- Soglia "calorie quasi finite": 150 kcal.

## Domande chiuse con la verifica del costruttore
- **Correzione di una premessa:** oggi gli sgarri **entrano già nel piano settimanale** come le altre ricette (`pool` filtra solo per pasto e dieta). **Risposta della persona: "mettili nel piano quando rientrano"** — i nuovi sgarri entrano nel piano come quelli di oggi, scelti solo se rispettano calorie, proteine e regole del piano (nessun limite settimanale aggiunto).
- Calorie rimaste ≥ 150 ma nessuna ricetta intera ci sta: mezza porzione, poi le più leggere (decisione di Claude, sopra).
- Sgarri esistenti senza voglia chiara: restano senza (decisione di Claude, sopra).

## Lasciato al costruttore
- Nomi, dosi, macro e passaggi delle nuove ricette (realistici, con `MICRO`).
- Elenco preciso delle combinazioni da locale e dei valori (fonti come sopra), testo dei consigli.
- Aspetto esatto del riquadro e dei pulsanti delle voglie.
