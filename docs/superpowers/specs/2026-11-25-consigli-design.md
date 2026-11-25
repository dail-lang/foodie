# Foodie: sezione Consigli a righe (stile Netflix)

## Perché
La sezione Consigli oggi è una lista di 47 schede aperte, lunga circa 15 schermate, con in cima un riquadro "Lo sapevi?" fisso che contiene un solo consiglio. Alla persona dà fastidio proprio quel riquadro e vuole "sistemare meglio tutto" e avere più consigli. Ha visto due anteprime e ha scelto quella **tipo Netflix**: una riga per categoria, da scorrere di lato.

## Obiettivi
1. **Consiglio del giorno** al posto di "Lo sapevi?": in cima, ogni giorno un consiglio diverso preso da tutti (stesso consiglio per tutto il giorno), con categoria, titolo, anteprima, pulsanti "Leggi" e "Un altro". Il testo sulle patate raffreddate diventa una scheda normale.
2. **Una riga per categoria**: titolo della categoria, "Tutti N ›" a destra, schede affiancate da scorrere di lato (con aggancio alla scheda). Ogni scheda mostra livello di prova se c'è, titolo e anteprima di 3 righe; a 400 px se ne vede una e mezza, così si capisce che si scorre.
3. **Leggere per intero**: toccare una scheda apre il consiglio completo (titolo, testo, fonte, livello) in un pannello sopra la pagina, chiudibile con ×, Esc o tocco fuori.
4. **"Tutti N ›"** apre la categoria intera come lista verticale di schede complete, con "‹ Tutte le categorie" per tornare.
5. **Categorie riorganizzate da 8 a 6** con circa 80 consigli in totale, almeno 10 per categoria:
   - **Alimentazione** (dalle attuali Piatto, Glicemia, Abitudini + nuove: idratazione, fibre, mangiare fuori…)
   - **Dimagrire e muscoli** (dalle attuali Skinny fat e Dimagrimento + nuove su proteine e ricomposizione)
   - **Antinfiammatorio** (le 11 attuali, con livelli di prova)
   - **Voglie e sgarri** (le 11 attuali)
   - **Allenamento e sonno** (nuova: recupero, sonno, proteine dopo l'allenamento, passi…)
   - **Spesa e cucina** (dalla attuale Spesa + nuove: meal prep, conservazione, cucina veloce…)
6. **Tabella delle proteine**: diventa una scheda "Quante proteine ci sono in…" nella riga Dimagrire e muscoli; toccandola si apre la tabella nel pannello.

## Non obiettivi
- Nessuna ricerca testuale (non c'era nell'anteprima scelta).
- Nessuna modifica alle altre pagine.

## Anti-obiettivi
- Perdere consigli esistenti o le loro fonti e livelli di prova.
- Testo illeggibile o schede che a 400 px escono dallo schermo in modo confuso; scroll orizzontale della pagina intera.
- Consigli senza fonte, promesse di cura, toni colpevolizzanti.

## Vincoli
- Stessa app a file unico (`src/app.html`), build `tools/build.py`, test `tools/test.cjs`.
- Testi in italiano, colori da token, leggibile e toccabile a 400 px in chiaro e scuro; usabile anche con la tastiera (schede come pulsanti).
- Funziona offline.

## Strade considerate
1. **A — lista con schede chiuse, ricerca e consiglio del giorno:** più comoda per cercare e leggere; scartata dalla persona.
2. **B — righe per categoria stile Netflix (scelta dalla persona dopo aver visto le anteprime).**
3. C — solo spostare "Lo sapevi?" e aggiungere consigli: la pagina sarebbe ancora più lunga; scartata.

## Decisioni prese da Claude (correggibili)
- Le 6 categorie e i loro nomi; l'accorpamento delle 8 attuali.
- Consiglio del giorno scelto in modo fisso per data (cambia a mezzanotte), "Un altro" ne mostra uno a caso senza salvarlo.
- Lettura completa in un pannello sopra la pagina (non dentro la riga).
- Su schermi larghi (computer) le righe mostrano più schede insieme.

## Lasciato al costruttore
- Testo dei circa 33 nuovi consigli (con fonte, nessuna promessa di cura).
- Aspetto esatto di schede, pannello e righe, nello stile dell'anteprima approvata.
