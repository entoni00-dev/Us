# Noi Due ♡

Un posticino online solo per noi due: un cuore da toccare quando ci pensiamo,
messaggini, lettere (anche sigillate fino a una data) e il conto alla rovescia
al prossimo abbraccio.

Due profili fissi, **LUI** e **LEI**, senza account. Facoltativo: un codice
segreto condiviso, così chi trova il link per caso non legge niente.

## Cosa c'è

- **Casa** — il cuore "Ti penso" (l'altra persona lo vede entro pochi secondi), quante volte vi siete pensati oggi, countdown al prossimo incontro, da quanti giorni state insieme.
- **Messaggi** — chat semplice, con "letto".
- **Lettere** — lettere lunghe in calligrafia; se scegli una data di apertura resta sigillata (il testo non arriva nemmeno al telefono dell'altra persona) fino a quel giorno. La bozza si salva da sola.
- **Noi** — nomi, data in cui vi siete messi insieme, data del prossimo incontro, notifiche del browser.
- Si installa come app: dal telefono, "Aggiungi a schermata Home".

## Metterlo online (gratis)

Il piano gratuito di Render **non** conserva i dati: il disco si azzera e il loro
database gratuito viene cancellato dopo 30 giorni. Per questo i dati stanno su
**Neon**, che ha un Postgres gratuito senza scadenza.

1. **Neon** — crea un account su neon.tech, poi un progetto (regione Europa, es. Frankfurt).
   Copia la *connection string* (inizia con `postgresql://…`).
2. **Render** — New → Blueprint → collega questo repository. Render legge `render.yaml`
   e ti chiede due valori:
   - `DATABASE_URL` → incolla la stringa di Neon
   - `SECRET_CODE` → una parola che sapete solo voi (o lascialo vuoto per accesso libero)
3. Aspetta il deploy e apri l'indirizzo `https://noi-due-xxxx.onrender.com`.

Le tabelle si creano da sole al primo avvio.

> Il servizio gratuito di Render si addormenta dopo ~15 minuti senza visite:
> la prima apertura dopo una pausa può impiegare fino a un minuto. Poi è veloce.

## In locale

```bash
npm install
npm start          # http://localhost:3000, dati in data.json
```

Variabili utili: `DATABASE_URL` (Postgres), `SECRET_CODE`, `PORT`.

## Limiti onesti

- Le notifiche arrivano solo se il sito è aperto (anche in un'altra scheda). Le notifiche push a telefono chiuso richiedono un service worker e chiavi VAPID: si possono aggiungere dopo.
- Il codice segreto è una protezione leggera, non una cassaforte: non scriveteci password o dati sensibili.
