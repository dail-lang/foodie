# Foodie: tutti i nutrienti, con valori italiani (ispirato a Kiwi)

## Perché
La persona vuole sapere **se mangia tutti i nutrienti** e **a cosa servono quelli che mangia**. Ha visto l'app *Kiwi: Nutrition Tracker* (Kiwi Labs), che segue oltre 70 nutrienti con obiettivi giornalieri, raggruppa i nutrienti per funzione (muscoli, energia, sonno, difese, ossa…) e mostra le tendenze settimanali. Vive in Italia e mangia cibo italiano: **i valori devono essere italiani, non USDA**. Ha scelto la strada più completa ("A": tanti nutrienti in quantità vere), e per i nutrienti che la tabella italiana non ha ha scelto la **tabella francese Ciqual** come riserva.

## Fonti dei dati (decise)
- **Composizione dei cibi: Tabelle CREA** (Centro di ricerca Alimenti e Nutrizione, alimentinutrizione.it, 832 alimenti, aggiornamento 2019). Riutilizzabili citando la fonte: l'app mostra "Fonte: CREA – Tabelle di composizione degli alimenti" dove servono.
- **Riserva: Ciqual (ANSES, Francia, licenza aperta Etalab)** solo per i valori che CREA non ha: in pratica **vitamina D, B12, B6, E e iodio** (e qualunque altro nutriente mancante per un alimento). Nell'app questi valori sono segnati "valore europeo".
- **Fabbisogni: LARN** (Società Italiana di Nutrizione Umana, IV revisione) per sesso ed età del profilo: PRI o AI per vitamine e minerali, obiettivi per fibre; limiti per sodio, grassi saturi e zuccheri.
- La banca dati BDA dell'Istituto Europeo di Oncologia è stata scartata: il suo sito ha il certificato di sicurezza scaduto. USDA non si usa.

## Obiettivi
1. **Nutrienti seguiti (circa 24)** oltre a calorie e macro: fibre; sodio, potassio, calcio, magnesio, fosforo, ferro, zinco, rame, selenio, iodio; vitamine A, B1, B2, B3 (niacina), B6, B12, folati, C, D, E; omega-3 (EPA+DHA e ALA quando disponibili); grassi saturi e zuccheri (da limitare).
2. **Valori per tutto quello che si può segnare nel diario**:
   - **ingredienti delle ricette** (circa 194 nomi) → collegati ciascuno a un alimento CREA (o Ciqual se manca);
   - **ricette** (187) → somma degli ingredienti per porzione, scalata come oggi con le porzioni;
   - **cibi del calcolatore** (circa 370): quelli semplici collegati a un alimento CREA; i piatti composti (lasagne, carbonara, pizza…) descritti come composizione per 100 g di alimenti CREA;
   - **prodotti di marca e codici a barre (Open Food Facts)**: si usano vitamine e minerali dell'etichetta se ci sono, altrimenti "dati mancanti";
   - **cibi insegnati a mano**: solo calorie e macro, nutrienti "dati mancanti".
   Le voci del diario salvate da ora in poi conservano anche i nutrienti; le voci vecchie li ricalcolano dove possibile (ricette e cibi riconosciuti), altrimenti restano senza.
3. **"Nutrienti" nella pagina Oggi**: un riquadro riassuntivo per il giorno selezionato ("18 nutrienti raggiunti su 24 · ti mancano vitamina D, iodio…") che apre la vista completa.
4. **Vista completa dei nutrienti**, con **Oggi / Settimana** (media degli ultimi 7 giorni con almeno un pasto segnato):
   - ogni nutriente con barra della percentuale del fabbisogno LARN, valore e obiettivo (es. "Ferro 8,2 / 10 mg · 82%"); per quelli da limitare la barra indica quanto si è vicini al limite;
   - **raggruppati per funzione** (es. Muscoli e recupero, Energia e stanchezza, Ossa e denti, Difese immunitarie, Cuore e circolazione, Cervello e umore, Pelle e vista, Da limitare); un nutriente può stare in più gruppi;
   - toccando un nutriente: **a cosa serve** (2–3 frasi semplici), **da cosa l'hai preso** oggi/in settimana (i cibi che hanno contribuito di più), **cibi italiani che ne sono ricchi** (dalla tabella CREA, per porzione tipica) e la fonte del dato.
5. **Scheda ricetta**: una riga "Nutrienti per porzione" con i nutrienti in cui la ricetta copre di più (es. "Vitamina C 120% · Folati 45% · Ferro 30%") e tocco per vedere tutto.
6. **Onestà sui dati**: se una parte di quello che hai mangiato non ha dati per un nutriente, la vista lo dice ("i dati coprono il 70% di quello che hai segnato: il valore reale può essere più alto"). Note fisse su iodio (dipende dal sale iodato) e vitamina D (dipende soprattutto dal sole).

## Non obiettivi
- Il piano settimanale e la modalità Superfood restano come sono (usano le etichette "fonte di" delle ricette); niente cambi alla generazione del piano.
- Niente amminoacidi, niente 70 nutrienti come Kiwi: i circa 24 sopra coprono la domanda della persona.
- Niente integratori consigliati, niente diagnosi.

## Anti-obiettivi
- Valori americani (USDA) o inventati presentati come italiani.
- Mostrare "100%" o "carenza" quando mancano dati: meglio dire che il dato è parziale.
- Rallentare l'app: tutto offline, calcoli istantanei.
- Perdere dati già salvati.

## Vincoli
- Stessa app a file unico (`src/app.html`), build `tools/build.py`, test `tools/test.cjs`; i dati nutrizionali sono incorporati nell'app (funziona offline). Se i dati pesano troppo nell'HTML (oltre circa 1 MB in più) si includono solo gli alimenti CREA effettivamente usati.
- Gli script che scaricano e preparano i dati CREA/Ciqual stanno in `tools/` e producono un file dati versionato; i dati grezzi non si pubblicano.
- Download educato da alimentinutrizione.it (una pagina al secondo, una volta sola, con cache locale).
- Testi in italiano, colori da token, leggibile a 400 px chiaro e scuro.

## Strade considerate
1. **A — tanti nutrienti in quantità vere, valori CREA + Ciqual per i mancanti (scelta dalla persona).**
2. B — solo le etichette "fonte di" già presenti, senza quantità: non dice "quanto", scartata.
3. C — quantità solo per 13 nutrienti chiave: proposta da Claude, scartata dalla persona a favore di A.
- Fonti: solo CREA (niente vitamina D, B12, B6, E, iodio) o valori a memoria per i mancanti: scartate dalla persona a favore di Ciqual.

## Decisioni prese da Claude (correggibili)
- Elenco dei circa 24 nutrienti e dei gruppi per funzione.
- Settimana = media degli ultimi 7 giorni con almeno un pasto segnato.
- Il riquadro va nella pagina Oggi, sotto le barre di calorie e macro.
- Ciqual 2020 come versione della tabella francese.

## Domande chiuse con la verifica del costruttore (decisioni di Claude)
- **Ricette scritte dalla persona** ("le mie ricette", ingredienti in testo libero): incluse. Si incorpora **tutta** la tabella CREA (832 alimenti × circa 24 nutrienti, poche centinaia di kB) e un abbinamento nell'app collega ogni riga ("150 g salmone") all'alimento CREA più vicino; se non trova niente, quella riga è "dati mancanti". Così funziona anche per cibi futuri.
- **Se Ciqual è ancora irraggiungibile quando si costruisce**: si pubblica lo stesso con i valori CREA; vitamina D, B12, B6, E e iodio compaiono come "dati in arrivo" e il riassunto conta solo i nutrienti con dati ("16 su 19 · 5 in arrivo"). I valori Ciqual si aggiungono appena il sito torna.
- **Calorie e macro delle ricette restano quelle di oggi** (scritte a mano, usate dal piano): non cambiano né il piano né i totali passati. Da CREA si prendono solo micronutrienti, fibre, grassi saturi e zuccheri; le percentuali di saturi e zuccheri si calcolano sulle calorie mostrate.
- **Sale "q.b."**: nelle ricette salate si stima 1 g di sale per porzione (circa 400 mg di sodio), segnato come "stima" nel dettaglio del sodio; nei dolci 0. Contarlo zero darebbe una falsa sicurezza sul sodio.

## Lasciato al costruttore
- Collegamento di ogni ingrediente e cibo all'alimento CREA più adatto (es. "Petto di pollo" → "Pollo, petto, senza pelle, crudo"), e composizione dei piatti del calcolatore.
- Testi "a cosa serve" (semplici, con fonte generale), aspetto esatto delle viste.
- Formato del file dati.

## Rischi noti
- Il sito Ciqual era in manutenzione il 27/11/2026: i valori di riserva si scaricano appena torna raggiungibile (anche tramite data.gouv.fr).

## Aggiornamento 27/11/2026: banca dati svizzera al posto di Ciqual

Ciqual è rimasto irraggiungibile (manutenzione; web.archive.org non consentito dall'ambiente). La persona ha chiesto
una soluzione per vitamina B12, D, magnesio e gli altri. Si usa la **Banca dati svizzera dei valori nutritivi**
(USAV, V 7.1 del 01/07/2026, dati aperti citando la fonte, nomi in italiano, nessun dato USDA) con lo stesso ruolo
previsto per Ciqual: riempie solo i valori che CREA non ha, segnati come "valore europeo".

- Ordine: valore CREA → valore svizzero dell'alimento corrispondente → mediana delle varianti CREA **nello stesso stato**
  (crudo/cotto/secco/in polvere/in scatola/integrale) e con calorie simili → nessun dato.
- Corrispondenza scelta a mano per i 219 alimenti CREA usati dall'app (`nutr_map.CH_FIX`); per gli altri, automatica
  e prudente (stessa parola principale, stesso stato, calorie entro ±33%). Se la Svizzera non ha l'alimento si usa il più
  simile (sgombro → sardina, orata/spigola → pesce medio, polpo/seppia → calamaro); stato diverso → scalato sulle calorie.
- Il sodio dei cibi svizzeri "cotti in acqua salata" non si usa. I vegetali hanno B12 = 0 e vitamina D = 0 (tranne i funghi).
- Alimenti che CREA non ha (tofu, chia, hummus, tahina, edamame, semi, bevande vegetali, cavolo riccio…) presi direttamente
  dalla banca dati svizzera.
- Il rame non c'è nella banca dati svizzera: resta solo CREA.
