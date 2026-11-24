# Foodie: modalità Antinfiammatoria

## Perché
La persona che usa Foodie vuole mangiare in modo antinfiammatorio: pasti costruiti sui cibi a cui si attribuisce un effetto antinfiammatorio, anche quando le prove scientifiche sono deboli. Ha scelto la strada "modalità completa": deve cambiare cosa mangia ogni giorno attraverso il piano, non solo aggiungere ricette da consultare.

## Obiettivi
1. **Elenco dei cibi antinfiammatori** con un livello di prova visibile:
   - *Prove solide*: pesce azzurro e salmone (omega-3), olio extravergine d'oliva, verdure a foglia verde (spinaci, rucola, cavolo, bietola), legumi, cereali integrali, frutta secca (noci, mandorle).
   - *Prove promettenti*: curcuma (con pepe nero), zenzero, frutti di bosco e frutti rossi, cacao amaro e cioccolato fondente ≥ 85%, tè verde, fermentati (kefir, yogurt), broccoli e crucifere, pomodoro cotto, avocado.
   - *Uso tradizionale, pochi studi*: cannella, aglio, cipolla, rosmarino, origano, semi di lino e chia, brodo di ossa.
   - *Da limitare (favoriscono l'infiammazione)*: zuccheri aggiunti (zucchero, miele, sciroppi, marmellata), farine raffinate e prodotti da forno industriali, carni lavorate, fritti, bibite zuccherate, ultra-processati.
2. **Punteggio antinfiammatorio di ogni ricetta (0–10)**, calcolato dai suoi ingredienti: i cibi con prove solide pesano più di quelli promettenti, che pesano più di quelli tradizionali; gli ingredienti "da limitare" tolgono punti. Una ricetta con punteggio ≥ 6 è "Antinfiammatoria".
3. **Modalità Antinfiammatoria** in Profilo, una casella come "Modalità Superfood". Quando è attiva il piano sceglie più spesso le ricette con punteggio alto. Le due modalità possono essere attive insieme.
4. **Filtro "Antinfiammatoria"** in Ricette e **punteggio visibile** su card e scheda ricetta. Nella scheda: elenco degli ingredienti antinfiammatori presenti, ciascuno con il suo livello di prova e una riga su cosa contiene (es. "Salmone · prove solide · omega-3 EPA e DHA").
5. **Circa 20 nuove ricette antinfiammatorie** (punteggio ≥ 6), senza maiale, veloci (≤ 30 min), distribuite su tutti i pasti, con almeno 4 vegane. Esempi: golden milk con curcuma e zenzero, porridge con frutti di bosco e semi di lino, salmone con curcuma e zenzero, zuppa di lenticchie e cavolo, sardine con pomodoro e origano, bowl di quinoa con broccoli e avocado, tè verde freddo con zenzero, cioccolata calda al cacao e cannella.
6. **Sezione "Antinfiammatorio" nei Consigli**: una scheda per ogni gruppo di cibi, con il livello di prova in evidenza e la frase su come usarli (es. curcuma sempre con un pizzico di pepe nero e un grasso).

## Non obiettivi
- Nessun "indice antinfiammatorio del giorno" nel diario (si può aggiungere dopo).
- Nessuna promessa di cura: l'app non dice che un cibo cura malattie o guarisce l'intestino.
- Nessun integratore consigliato.

## Anti-obiettivi
- Presentare come certo ciò che non lo è: ogni affermazione ha il suo livello di prova accanto.
- Peggiorare il resto del piano: calorie, proteine, pesce 2 volte e legumi 3 volte a settimana restano rispettati.
- Togliere ricette o cambiare le esistenti.
- Perdere dati salvati.

## Vincoli
- Stessa app a file unico (`src/app.html`), stessa build (`tools/build.py`) e stessi test (`tools/test.cjs`).
- Il punteggio si calcola sugli ingredienti scritti nella ricetta, quindi vale anche per le "ricette mie" aggiunte a mano.
- Nuova impostazione di profilo `ai` (booleana), assente nei profili salvati finora = disattivata.
- Testi in italiano, colori da token, leggibile a 400 px in chiaro e scuro.

## Strade considerate
1. **Modalità completa (scelta dalla persona):** elenco cibi con livelli di prova, punteggio ricette, modalità nel piano, filtro, 20 ricette, consigli.
2. Solo contenuti (ricette + filtro + consigli, piano invariato): più veloce, ma non cambia il piano settimanale. Scartata dalla persona.

## Decisioni prese da Claude (correggibili)
- Livelli di prova visibili (la persona non ha chiesto di nasconderli).
- Pesi del punteggio: prove solide 3, promettenti 2, tradizionali 1; "da limitare" −2; somma normalizzata su 0–10 con tetto. I valori esatti dei pesi e della normalizzazione sono lasciati al costruttore, purché le ricette di esempio sopra risultino ≥ 6 e una ricetta come "Pizza veloce con impasto allo yogurt" risulti < 6.
- Nel piano, con la modalità attiva, la probabilità di scelta di una ricetta cresce con il suo punteggio (stesso meccanismo a pesi della modalità Superfood); se entrambe sono attive i pesi si moltiplicano.
- La parola chiave degli ingredienti si riconosce con lo stesso sistema di parole e singolari/plurali già usato da "Cosa hai in casa?".

## Lasciato al costruttore
- Nomi, dosi, macro e passaggi delle 20 ricette (realistici, con voce in `MICRO`).
- Aspetto del badge del punteggio e della lista ingredienti nella scheda.
- Testo delle schede consiglio, purché ogni scheda abbia livello di prova e indicazione pratica.
