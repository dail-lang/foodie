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
6. **Correzione delle proteine nel piano** (scelta dalla persona, vale con e senza modalità Antinfiammatoria). Oggi `makePlan` controlla solo le calorie: con il profilo di esempio circa 1 giorno su 3 resta sotto il 90% delle proteine. Dopo la scelta dei piatti, per ogni giorno sotto il 90% dell'obiettivo di proteine il piano sostituisce prima lo spuntino, poi la colazione, poi pranzo o cena con un'alternativa più proteica dello stesso pasto, rispettando dieta, modalità attive, pesce 2 e legumi 3 a settimana e il limite di 2 ripetizioni per ricetta. **Criterio di accettazione:** su 40 piani generati per il profilo di esempio (con e senza modalità Antinfiammatoria e Superfood), al massimo il 10% dei giorni sotto il 90% delle proteine e calorie medie entro ±5% dell'obiettivo.
7. **Sezione "Antinfiammatorio" nei Consigli**: una scheda per ogni gruppo di cibi, con il livello di prova in evidenza e la frase su come usarli (es. curcuma sempre con un pizzico di pepe nero e un grasso).

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
- **Punteggio per peso, non per somma** (decisione di Claude dopo la verifica del costruttore: una somma semplice dava 10/10 anche alla pizza). Il punteggio misura quanta parte del piatto, in grammi, è fatta di cibi antinfiammatori, pesata per livello di prova (solide 1, promettenti 0,7, tradizionali 0,4); gli ingredienti "da limitare" sottraggono in proporzione al loro peso; le spezie e gli ingredienti "q.b." della lista (curcuma, zenzero, cannella, aglio, rosmarino, origano) danno un piccolo bonus fisso ciascuno perché si usano in piccole quantità. Farine raffinate, impasti e dolci con zucchero contano come "da limitare"; la farina integrale e l'avena contano come cereale integrale. Risultato su 0–10. **Taratura richiesta:** circa un terzo (25–40%) delle 100 ricette attuali risulta ≥ 6; la pizza con impasto allo yogurt e le ricette con tag `sgarro` a base di farina risultano < 6; tutte le 20 nuove ricette ≥ 6.
- Nel piano, con la modalità attiva, la probabilità di scelta di una ricetta cresce con il suo punteggio (stesso meccanismo a pesi della modalità Superfood); se entrambe sono attive i pesi si moltiplicano.
- La parola chiave degli ingredienti si riconosce con lo stesso sistema di parole e singolari/plurali già usato da "Cosa hai in casa?".

## Domande chiuse con la verifica del costruttore
- "Calorie e proteine rispettate": risposto dalla persona con la correzione delle proteine (obiettivo 6) e il suo criterio di accettazione.
- Come deve funzionare il punteggio e quante ricette devono qualificarsi: deciso da Claude (punteggio per peso, taratura sopra).

## Lasciato al costruttore
- Nomi, dosi, macro e passaggi delle 20 ricette (realistici, con voce in `MICRO`).
- Aspetto del badge del punteggio e della lista ingredienti nella scheda.
- Testo delle schede consiglio, purché ogni scheda abbia livello di prova e indicazione pratica.
