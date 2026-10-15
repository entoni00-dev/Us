// Testi di Us. Tutto qui, così è facile cambiarli.

export const MOODS = [
  { id: 'felice', e: '😊', l: 'felice' },
  { id: 'innamorato', e: '🥰', l: 'innamorato/a' },
  { id: 'tranquillo', e: '😌', l: 'tranquillo/a' },
  { id: 'stanco', e: '😴', l: 'stanco/a' },
  { id: 'triste', e: '🥺', l: 'giù' },
  { id: 'ansioso', e: '😰', l: 'in ansia' },
  { id: 'arrabbiato', e: '😤', l: 'nervoso/a' },
  { id: 'mi-manchi', e: '🫂', l: 'mi manchi' },
];

// "Apri quando…": lettere che chi le riceve apre nel momento giusto.
export const WHEN = [
  { id: 'triste', l: 'sei triste', e: '🌧️' },
  { id: 'dormire', l: 'non riesci a dormire', e: '🌙' },
  { id: 'geloso', l: 'ti senti geloso/a', e: '🫧' },
  { id: 'manco', l: 'ti manco troppo', e: '🫂' },
  { id: 'litigato', l: 'abbiamo litigato', e: '🕊️' },
  { id: 'giornata', l: 'hai avuto una giornata storta', e: '☕' },
  { id: 'paura', l: 'hai paura che finisca', e: '⚓' },
  { id: 'felice', l: 'sei felice e vuoi festeggiare', e: '🎉' },
];

export const LISTS = [
  { id: 'vedersi', l: 'Quando ci vediamo', hint: 'es. colazione a letto, quel ristorante…' },
  { id: 'guardare', l: 'Da guardare insieme', hint: 'film o serie per la videochiamata' },
  { id: 'sogni', l: 'Sogni e posti', hint: 'viaggi, progetti, la casa che vorremmo' },
];

export const REACTIONS = ['❤️', '🥰', '😂', '😮', '🥺', '🔥'];

// Domanda del giorno: la stessa per entrambi, si vede la risposta dell'altro solo dopo aver risposto.
export const QUESTIONS = [
  'Qual è il primo ricordo che hai di me?',
  'Cosa ti ha fatto capire che ti piacevo davvero?',
  'Qual è una cosa piccola che faccio e che ami?',
  'Se fossimo insieme adesso, cosa faremmo?',
  'Qual è la cosa più difficile della distanza per te?',
  'Cosa ti fa sentire più amato/a da me?',
  'Descrivi il nostro weekend perfetto.',
  'Una canzone che ti fa pensare a me, e perché?',
  'Cosa vorresti che sapessi di te e che non ti ho mai chiesto?',
  'In quale città vorresti vivere con me?',
  'Qual è stata la nostra giornata più bella finora?',
  'Cosa ti fa ridere di me, anche quando non dovrebbe?',
  'Una cosa che vuoi imparare a fare insieme.',
  'Quando ti senti insicuro/a su di noi, cosa ti aiuta?',
  'Cosa ti manca di più del mio modo di toccarti o abbracciarti?',
  'Qual è il complimento più bello che ti ho fatto?',
  'Che tradizione vorresti che avessimo noi due?',
  'Se potessi teletrasportarti da me per un’ora, cosa faresti?',
  'Qual è una tua paura che non mi hai mai detto?',
  'Cosa vorresti che facessi più spesso?',
  'Come ti immagini noi due tra cinque anni?',
  'Quale mia abitudine strana ti è diventata cara?',
  'Qual è il cibo che vuoi assolutamente mangiare con me?',
  'Cosa ti ha insegnato questa relazione su di te?',
  'Un momento in cui ti sei sentito/a fiero/a di me.',
  'Cosa fai di solito quando ti manco?',
  'Il viaggio dei sogni con me: dove e come?',
  'Cosa ti fa sentire al sicuro con me?',
  'Qual è il messaggio mio che hai riletto più volte?',
  'Se dovessi descriverci con tre parole?',
  'Cosa vorresti dirmi più spesso ma ti vergogni?',
  'Qual è stato il nostro litigio più stupido?',
  'Cosa ti piacerebbe che facessimo in videochiamata?',
  'Quale tuo sogno vorresti che io sostenessi di più?',
  'Cosa ti piace del modo in cui ci siamo conosciuti?',
  'Una cosa che io faccio meglio di chiunque altro.',
  'Come vorresti essere consolato/a quando stai male?',
  'Qual è la prima cosa che farai quando ci rivedremo?',
  'Un odore o un suono che ti ricorda me.',
  'Cosa ti rende orgoglioso/a di noi due?',
  'Che film guarderemmo stasera, abbracciati sul divano?',
  'Qual è un piccolo gesto mio che ti ha cambiato la giornata?',
  'Cosa ti spaventa della distanza, e cosa ti rassicura?',
  'Quale parte della mia vita vorresti conoscere meglio?',
  'Se scrivessi un libro su di noi, come si intitolerebbe?',
  'Cosa ti aiuta a sentirmi vicino/a anche da lontano?',
  'Quale nostra foto ami di più, e perché?',
  'Qual è una promessa che vorresti farmi?',
  'Cosa ti piace di te quando sei con me?',
  'Una cosa che vorresti che smettessi di preoccuparmi.',
  'Come festeggeremo il prossimo anniversario?',
  'Cosa vuoi che ti dica quando hai una giornata no?',
  'Qual è il posto dove ti sei sentito/a più vicino/a a me?',
  'Che animale domestico avremmo insieme, e come si chiamerebbe?',
  'Qual è stata la cosa più coraggiosa che hai fatto per noi?',
  'Cosa ti fa venire voglia di scrivermi all’improvviso?',
  'Descrivi la nostra futura domenica mattina.',
  'Quando hai capito che ne valeva la pena, anche a distanza?',
  'Cosa vorresti che ricordassi di oggi?',
  'Scrivimi una cosa che ami di me che non ti ho mai sentito dire.',
];

// Frasi di scorta per il barattolo, finché l'altra persona non ne scrive di sue.
export const SPARE_COMFORT = [
  'Quello che senti adesso è una paura, non un fatto. Le paure di notte sembrano sempre più grandi.',
  'La distanza misura i chilometri, non quanto ci teniamo.',
  'Se una cosa ti preoccupa, chiedimela. Preferisco mille domande a un tuo silenzio pieno di dubbi.',
  'Non devi meritarti di essere rassicurato/a. Puoi semplicemente chiedere.',
  'Ti ho scelto. Anche oggi, anche se non lo vedi.',
  'Respira. Questa sensazione passa, come sono passate tutte le altre.',
  'Non sei “troppo”. Sei una persona che ama e ha paura di perdere ciò che ama.',
  'Se non rispondo subito, quasi sempre è perché sto vivendo la mia giornata, non perché ti sto lasciando fuori.',
  'Siamo una squadra, non due persone che si mettono alla prova.',
  'Domani mattina questa cosa avrà un peso diverso. Dalle tempo.',
  'Ogni giorno lontani è un giorno in meno al prossimo abbraccio.',
  'Puoi dirmi “ho una paranoia” senza vergogna. È così che la smontiamo, insieme.',
  'La fiducia non è non avere paura. È scegliere di non farti guidare da lei.',
  'Non stai rovinando niente sentendoti così. Ne stai solo parlando.',
  'Guarda le prove, non le ipotesi: cosa sai davvero, adesso?',
];

// Idee per chi scrive le frasi nel barattolo.
export const COMFORT_IDEAS = [
  'Ricordale/ricordagli un momento in cui ti sei sentito/a sicuro/a di voi',
  'Una cosa che ami di lei/lui che non cambierà',
  'Cosa vorresti sentirti dire tu, quando hai paura',
  'Una promessa piccola ma vera',
  'Un fatto: cosa fai davvero quando non rispondi',
];

// Per quando la testa corre: domande per fermarsi un attimo.
export const GROUNDING = [
  'È un fatto o una paura? Scrivi cosa sai davvero, senza aggiungere niente.',
  'Cosa diresti a un amico che ti raccontasse esattamente questo?',
  'Questo pensiero ti aiuta o ti fa solo male? Puoi metterlo giù per dieci minuti.',
  'Nomina 5 cose che vedi, 4 che senti col tatto, 3 suoni, 2 odori, 1 sapore.',
  'Se ti va, scrivile cosa provi. Una paura detta pesa la metà.',
];
