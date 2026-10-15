# us ♥

Il nostro posto, anche da lontano. Un sito web per due: si apre dal browser
(Chrome, Safari…) con un link, su telefono, tablet e computer.

Ci sono due profili fissi, **LUI** e **LEI**, senza account. Volendo si può
aggiungere un codice segreto condiviso, così chi trova il link per caso non
legge niente.

## Cosa c'è

| Sezione | Cosa fa |
|---|---|
| **Casa** | Il cuore "ti penso", se l'altro è online, come si sente oggi, la domanda del giorno, una frase dal barattolo, un ricordo dall'album, da quanti giorni state insieme |
| **Chat** | Messaggi con reazioni (doppio tocco = ❤️, tieni premuto per scegliere), "sta scrivendo…", conferma di lettura, emoji rapide |
| **Lettere** | Lettere in calligrafia, con bozza salvata. Possono essere *sigillate* fino a una data, oppure **Apri quando…** (sei triste, non dormi, sei geloso/a, ti manco, abbiamo litigato…) |
| **Album** | Foto con didascalia e data, raggruppate per mese, visore a schermo intero (frecce o swipe), download |
| **Calma** | Per le paranoie: il barattolo con le frasi scritte dall'altro, un respiro guidato di 1 minuto, il tasto **"Ho bisogno di te"** che avvisa subito l'altra persona, domande per fermare la testa che corre |
| **Insieme** | Liste condivise: cose da fare quando vi vedete, da guardare in videochiamata, sogni e posti |
| **Domande** | Una domanda al giorno, uguale per entrambi. La risposta dell'altro si vede solo dopo aver scritto la propria |

## Metterlo online (gratis)

Il piano gratuito di Render **non** conserva i dati: il disco si azzera e il loro
database gratuito viene cancellato dopo 30 giorni. Per questo i dati stanno su
**Neon**, che offre un Postgres gratuito senza scadenza (1 GB, circa 3.000 foto,
perché le foto vengono compresse prima del caricamento).

1. **Neon**: crea un account su neon.tech e poi un progetto (regione Europa, ad esempio Frankfurt).
   Copia la *connection string*, quella che inizia con `postgresql://…`.
2. **Render**: vai su New → Blueprint e collega questo repository. Render legge `render.yaml`
   e ti chiede due valori:
   - `DATABASE_URL`: incolla la stringa di Neon
   - `SECRET_CODE`: una parola che sapete solo voi (lascialo vuoto se vuoi l'accesso libero)
3. Aspetta la fine del deploy e apri `https://us-xxxx.onrender.com`.

Le tabelle si creano da sole al primo avvio. `SESSION_SECRET` viene generato da Render.

> Il servizio gratuito di Render si addormenta dopo circa 15 minuti senza visite:
> la prima apertura dopo una pausa può impiegare fino a un minuto.

## In locale

```bash
npm install
npm start          # http://localhost:3000, dati nella cartella ./data
```

Variabili: `DATABASE_URL`, `SECRET_CODE`, `SESSION_SECRET`, `PORT`.

## Limiti onesti

- Le notifiche arrivano solo se Us è aperto, anche in un'altra scheda. Le notifiche push a telefono chiuso richiedono un service worker e chiavi VAPID: si possono aggiungere.
- Le foto HEIC dell'iPhone caricate da un computer Windows/Chrome possono non aprirsi. Dal telefono funzionano.
- Il codice segreto è una protezione leggera, non una cassaforte.
