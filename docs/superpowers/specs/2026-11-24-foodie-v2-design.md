# Foodie v2: più ricette, più motivante, più comoda

## Perché
Foodie è usata ogni giorno da una persona sola (obiettivo ricomposizione "skinny fat", alimentazione senza maiale, modalità Superfood). Ha chiesto tre cose: più scelta di piatti, una spinta a usarla ogni giorno e a vedere i miglioramenti, meno tocchi per le azioni quotidiane.

## Obiettivi
1. **Più ricette:** da 45 a circa 100, tutte senza maiale e derivati, veloci (≤ 30 min, la maggior parte ≤ 20), con macro e micronutrienti, distribuite su tutti i pasti.
2. **Più motivante:** voto del giorno 0–100, serie di giorni, allenamenti segnati con contatore settimanale, medaglie da sbloccare con avviso.
3. **Più comoda:** segnare i pasti dalla schermata Piano con un tocco, "Ho mangiato tutto come da piano", cibi recenti riutilizzabili, lista della spesa divisa per reparto, backup esporta/importa.

## Non obiettivi
- Nessun account, server, sincronizzazione o libreria esterna: i dati restano sul telefono.
- Niente foto dei piatti (non ci sono immagini libere da usare offline).
- Niente riscrittura con framework.

## Anti-obiettivi (sarebbe un fallimento anche se funziona)
- Perdere i dati già salvati (profilo, diario, ricette personali, progressi).
- Rendere più lente o più nascoste le azioni che oggi funzionano.
- Medaglie e voti che colpevolizzano: i messaggi incoraggiano, non rimproverano.
- Ricette con maiale, strutto, salumi di maiale o gelatina.

## Vincoli
- App web in un unico file HTML, pubblicata su GitHub Pages (PWA offline) e come artifact su Claude.
- Dati solo in `localStorage` con chiavi `pp.*` (già esistenti: `profile`, `plan`, `favs`, `shop`, `mine`, `log`, `prog`, `timers`).
- Leggibile in tema chiaro e scuro, a 400 px di larghezza, pulsanti sempre distinguibili dallo sfondo.

## Strade considerate
1. **Continuare con l'app attuale a file unico (scelta).** Veloce, nessun rischio per ciò che funziona, offline già pronto.
2. Riscrivere con React o simili: più ordinata se cresce molto, ma lunga e rischiosa per le funzioni esistenti. Scartata.

## Decisioni (prese da Claude, correggibili)
- Il sorgente passa nel repository (`src/app.html`) con uno script che genera `index.html` per GitHub Pages; prima viveva solo in una cartella temporanea.
- Voto del giorno: calorie 30 punti, proteine 25, acqua 15, cibi ricchi di fibre 15, allenamento 15 (nei giorni di riposo il punteggio dell'allenamento è pieno). Un giorno senza pasti registrati non ha voto.
- Serie: giorni consecutivi con almeno un pasto registrato, fino a oggi (o fino a ieri se oggi è ancora vuoto). "Giorni nell'obiettivo" = voto ≥ 70.
- 14 medaglie (elenco nel piano).
- Reparti della spesa: Frutta e verdura, Carne e pesce, Latticini e uova, Pane pasta e cereali, Legumi e conserve, Dispensa e condimenti, Frutta secca e semi.
- Backup: file JSON scaricabile nell'app installata, più "Copia" e "Incolla" come alternativa (nell'artifact i download sono bloccati).
