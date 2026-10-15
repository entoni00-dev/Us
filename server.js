// Noi Due — server minimale.
// Dati: Postgres se c'è DATABASE_URL (es. Neon, gratuito e permanente),
// altrimenti un file JSON locale (comodo per provarlo sul computer, NON per Render free).

const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const SECRET_CODE = (process.env.SECRET_CODE || '').trim(); // facoltativo
const WHO = ['lui', 'lei'];
const KINDS = ['ping', 'msg', 'letter'];
const MAX_BODY = { ping: 200, msg: 2000, letter: 20000 };

/* ------------------------------ storage ------------------------------ */

function makeJsonStore(file) {
  let db = { seq: 0, items: [], settings: {} };
  if (fs.existsSync(file)) {
    try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* file rovinato: si riparte */ }
  }
  const save = () => fs.writeFileSync(file, JSON.stringify(db, null, 2));
  return {
    kind: 'file',
    async init() {},
    async listItems() { return db.items.slice(); },
    async addItem({ kind, author, body, open_at }) {
      const item = { id: ++db.seq, kind, author, body, open_at: open_at || null,
        created_at: new Date().toISOString(), read_at: null };
      db.items.push(item); save(); return item;
    },
    async markRead(ids, reader) {
      const now = new Date().toISOString();
      for (const it of db.items) {
        const sealed = it.open_at && new Date(it.open_at) > new Date();
        if (ids.includes(it.id) && it.author !== reader && !it.read_at && !sealed) it.read_at = now;
      }
      save();
    },
    async deleteItem(id, author) {
      const before = db.items.length;
      db.items = db.items.filter(it => !(it.id === id && it.author === author));
      save(); return db.items.length < before;
    },
    async getSettings() { return { ...db.settings }; },
    async setSetting(key, value) { db.settings[key] = value; save(); },
  };
}

function makePgStore(url) {
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX) || 3,
    idleTimeoutMillis: 30000,
  });
  // Neon chiude le connessioni inattive: senza questo handler il processo andrebbe in crash.
  pool.on('error', err => console.warn('Connessione al database chiusa:', err.message));
  const row = r => ({ ...r, created_at: r.created_at && new Date(r.created_at).toISOString(),
    open_at: r.open_at && new Date(r.open_at).toISOString(),
    read_at: r.read_at && new Date(r.read_at).toISOString() });
  return {
    kind: 'postgres',
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS items (
          id SERIAL PRIMARY KEY,
          kind TEXT NOT NULL,
          author TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '',
          open_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          read_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      `);
    },
    async listItems() {
      const r = await pool.query('SELECT * FROM items ORDER BY id');
      return r.rows.map(row);
    },
    async addItem({ kind, author, body, open_at }) {
      const r = await pool.query(
        'INSERT INTO items (kind, author, body, open_at) VALUES ($1,$2,$3,$4) RETURNING *',
        [kind, author, body, open_at || null]);
      return row(r.rows[0]);
    },
    async markRead(ids, reader) {
      await pool.query(
        'UPDATE items SET read_at = now() WHERE id = ANY($1::int[]) AND author <> $2 AND read_at IS NULL AND (open_at IS NULL OR open_at <= now())',
        [ids, reader]);
    },
    async deleteItem(id, author) {
      const r = await pool.query('DELETE FROM items WHERE id=$1 AND author=$2', [id, author]);
      return r.rowCount > 0;
    },
    async getSettings() {
      const r = await pool.query('SELECT key, value FROM settings');
      return Object.fromEntries(r.rows.map(x => [x.key, x.value]));
    },
    async setSetting(key, value) {
      await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, value]);
    },
  };
}

const store = process.env.DATABASE_URL
  ? makePgStore(process.env.DATABASE_URL)
  : makeJsonStore(process.env.DATA_FILE || path.join(__dirname, 'data.json'));

/* ------------------------------ app ------------------------------ */

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Chi sei + codice (se impostato). Niente account: due profili fissi.
function auth(req, res, next) {
  const who = String(req.get('x-who') || '').toLowerCase();
  if (!WHO.includes(who)) return res.status(401).json({ error: 'Scegli LUI o LEI' });
  if (SECRET_CODE && req.get('x-code') !== SECRET_CODE) {
    return res.status(401).json({ error: 'Codice sbagliato' });
  }
  req.who = who;
  next();
}

// Le lettere con data di apertura futura restano sigillate per chi le riceve.
function view(item, who) {
  const sealed = item.kind === 'letter' && item.open_at &&
    new Date(item.open_at) > new Date() && item.author !== who;
  return sealed ? { ...item, body: '', sealed: true } : { ...item, sealed: false };
}

const wrap = fn => (req, res) => fn(req, res).catch(err => {
  console.error(err);
  res.status(500).json({ error: 'Qualcosa è andato storto, riprova' });
});

app.get('/api/config', (req, res) => res.json({ needsCode: !!SECRET_CODE, storage: store.kind }));

app.post('/api/login', auth, (req, res) => res.json({ ok: true, who: req.who }));

app.get('/api/state', auth, wrap(async (req, res) => {
  const items = await store.listItems();
  const settings = await store.getSettings();
  res.json({ me: req.who, now: new Date().toISOString(), settings,
    items: items.map(i => view(i, req.who)) });
}));

app.post('/api/items', auth, wrap(async (req, res) => {
  const kind = String(req.body.kind || '');
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Tipo non valido' });
  const body = String(req.body.body || '').trim();
  if (kind !== 'ping' && !body) return res.status(400).json({ error: 'Scrivi qualcosa ♡' });
  if (body.length > MAX_BODY[kind]) return res.status(400).json({ error: 'Troppo lungo' });
  let open_at = null;
  if (kind === 'letter' && req.body.open_at) {
    const d = new Date(req.body.open_at);
    if (isNaN(d)) return res.status(400).json({ error: 'Data non valida' });
    open_at = d.toISOString();
  }
  const item = await store.addItem({ kind, author: req.who, body, open_at });
  res.status(201).json(view(item, req.who));
}));

app.post('/api/read', auth, wrap(async (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger);
  if (ids.length) await store.markRead(ids, req.who);
  res.json({ ok: true });
}));

app.delete('/api/items/:id', auth, wrap(async (req, res) => {
  const ok = await store.deleteItem(Number(req.params.id), req.who);
  res.status(ok ? 200 : 404).json({ ok });
}));

const SETTING_KEYS = ['next_meeting', 'together_since', 'name_lui', 'name_lei'];
app.put('/api/settings', auth, wrap(async (req, res) => {
  const { key } = req.body;
  if (!SETTING_KEYS.includes(key)) return res.status(400).json({ error: 'Impostazione sconosciuta' });
  const value = String(req.body.value ?? '').slice(0, 60);
  await store.setSetting(key, value);
  res.json({ ok: true });
}));

app.get('/healthz', (req, res) => res.send('ok'));

store.init().then(() => {
  app.listen(PORT, () => console.log(`Noi Due su http://localhost:${PORT} (dati: ${store.kind})`));
}).catch(err => { console.error('Database non raggiungibile:', err.message); process.exit(1); });
