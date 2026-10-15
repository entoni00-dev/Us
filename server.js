// Us — server.
// Dati: Postgres se c'è DATABASE_URL (consigliato: Neon, gratuito e senza scadenza),
// altrimenti una cartella locale ./data (solo per provarlo sul computer).

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const SECRET_CODE = (process.env.SECRET_CODE || '').trim();
const SESSION_SECRET = process.env.SESSION_SECRET || 'us-dev-secret-cambiami';
const WHO = ['lui', 'lei'];
const other = w => (w === 'lui' ? 'lei' : 'lui');

const MOODS = ['felice', 'innamorato', 'tranquillo', 'stanco', 'triste', 'ansioso', 'arrabbiato', 'mi-manchi'];
const WHEN = ['triste', 'dormire', 'geloso', 'manco', 'litigato', 'giornata', 'paura', 'felice'];
const LISTS = ['vedersi', 'guardare', 'sogni'];
const LIMITS = { msg: 4000, letter: 30000, mood: 140, comfort: 500, sos: 300, todo: 200, answer: 1500, photo: 300 };

/* ============================== storage ============================== */

function makeFileStore(dir) {
  fs.mkdirSync(path.join(dir, 'photos'), { recursive: true });
  const file = path.join(dir, 'db.json');
  let db = { seq: 0, ver: 0, items: [], settings: {} };
  if (fs.existsSync(file)) { try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {} }
  const save = () => fs.writeFileSync(file, JSON.stringify(db));
  const clone = x => JSON.parse(JSON.stringify(x));
  const find = id => db.items.find(i => i.id === id);
  return {
    kind: 'file',
    async init() {},
    async listSince(ver) { return clone(db.items.filter(i => i.ver > ver)); },
    async maxVer() { return db.ver; },
    async get(id) { const i = find(id); return i ? clone(i) : null; },
    async insert({ kind, author, body = '', open_at = null, meta = {} }) {
      const it = { id: ++db.seq, kind, author, body, open_at, meta, created_at: new Date().toISOString(),
        read_at: null, deleted: false, ver: ++db.ver };
      db.items.push(it); save(); return clone(it);
    },
    async update(id, patch) {
      const it = find(id); if (!it) return null;
      Object.assign(it, patch, { ver: ++db.ver }); save(); return clone(it);
    },
    async bump(ids) { for (const id of ids) { const it = find(id); if (it) it.ver = ++db.ver; } save(); },
    async markRead(ids, reader) {
      const now = new Date();
      for (const it of db.items) {
        const sealed = it.open_at && new Date(it.open_at) > now;
        if (ids.includes(it.id) && it.author !== reader && !it.read_at && !sealed && !it.deleted) {
          it.read_at = now.toISOString(); it.ver = ++db.ver;
        }
      }
      save();
    },
    async putPhoto(id, full, thumb) {
      fs.mkdirSync(path.join(dir, 'photos'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'photos', `${id}-full.jpg`), full);
      fs.writeFileSync(path.join(dir, 'photos', `${id}-thumb.jpg`), thumb);
    },
    async getPhoto(id, size) {
      const f = path.join(dir, 'photos', `${id}-${size}.jpg`);
      return fs.existsSync(f) ? fs.readFileSync(f) : null;
    },
    async delPhoto(id) {
      for (const s of ['full', 'thumb']) fs.rmSync(path.join(dir, 'photos', `${id}-${s}.jpg`), { force: true });
    },
    async answeredDays(who) {
      return new Set(db.items.filter(i => i.kind === 'answer' && i.author === who && !i.deleted).map(i => i.meta.day));
    },
    async getSettings() { return { ...db.settings }; },
    async setSetting(k, v) { db.settings[k] = v; save(); },
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
  const iso = d => (d ? new Date(d).toISOString() : null);
  const row = r => r && ({
    id: r.id, kind: r.kind, author: r.author, body: r.body, meta: r.meta || {},
    open_at: iso(r.open_at), created_at: iso(r.created_at), read_at: iso(r.read_at),
    deleted: r.deleted, ver: Number(r.ver),
  });
  const q = (sql, args) => pool.query(sql, args);
  return {
    kind: 'postgres',
    async init() {
      await q(`
        CREATE SEQUENCE IF NOT EXISTS us_ver;
        CREATE TABLE IF NOT EXISTS us_items (
          id SERIAL PRIMARY KEY,
          kind TEXT NOT NULL,
          author TEXT NOT NULL,
          body TEXT NOT NULL DEFAULT '',
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          open_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          read_at TIMESTAMPTZ,
          deleted BOOLEAN NOT NULL DEFAULT false,
          ver BIGINT NOT NULL DEFAULT nextval('us_ver')
        );
        CREATE INDEX IF NOT EXISTS us_items_ver ON us_items (ver);
        CREATE TABLE IF NOT EXISTS us_photos (
          item_id INT PRIMARY KEY REFERENCES us_items(id) ON DELETE CASCADE,
          full_data BYTEA NOT NULL,
          thumb BYTEA NOT NULL
        );
        CREATE TABLE IF NOT EXISTS us_settings (key TEXT PRIMARY KEY, value TEXT);
      `);
    },
    async listSince(ver) {
      return (await q('SELECT * FROM us_items WHERE ver > $1 ORDER BY id', [ver])).rows.map(row);
    },
    async maxVer() {
      return Number((await q('SELECT COALESCE(MAX(ver),0) AS v FROM us_items')).rows[0].v);
    },
    async get(id) { return row((await q('SELECT * FROM us_items WHERE id=$1', [id])).rows[0]); },
    async insert({ kind, author, body = '', open_at = null, meta = {} }) {
      const r = await q('INSERT INTO us_items (kind, author, body, open_at, meta) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [kind, author, body, open_at, JSON.stringify(meta)]);
      return row(r.rows[0]);
    },
    async update(id, patch) {
      const cols = Object.keys(patch);
      const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
      const vals = cols.map(c => (c === 'meta' ? JSON.stringify(patch[c]) : patch[c]));
      const r = await q(`UPDATE us_items SET ${sets}${sets ? ', ' : ''}ver = nextval('us_ver') WHERE id = $1 RETURNING *`, [id, ...vals]);
      return row(r.rows[0]);
    },
    async bump(ids) { if (ids.length) await q("UPDATE us_items SET ver = nextval('us_ver') WHERE id = ANY($1::int[])", [ids]); },
    async markRead(ids, reader) {
      await q(`UPDATE us_items SET read_at = now(), ver = nextval('us_ver')
        WHERE id = ANY($1::int[]) AND author <> $2 AND read_at IS NULL AND NOT deleted
        AND (open_at IS NULL OR open_at <= now())`, [ids, reader]);
    },
    async putPhoto(id, full, thumb) {
      await q('INSERT INTO us_photos (item_id, full_data, thumb) VALUES ($1,$2,$3)', [id, full, thumb]);
    },
    async getPhoto(id, size) {
      const col = size === 'full' ? 'full_data' : 'thumb';
      const r = await q(`SELECT ${col} AS d FROM us_photos WHERE item_id=$1`, [id]);
      return r.rows[0] ? r.rows[0].d : null;
    },
    async delPhoto(id) { await q('DELETE FROM us_photos WHERE item_id=$1', [id]); },
    async answeredDays(who) {
      const r = await q("SELECT meta->>'day' AS d FROM us_items WHERE kind='answer' AND author=$1 AND NOT deleted", [who]);
      return new Set(r.rows.map(x => x.d));
    },
    async getSettings() {
      return Object.fromEntries((await q('SELECT key, value FROM us_settings')).rows.map(x => [x.key, x.value]));
    },
    async setSetting(k, v) {
      await q('INSERT INTO us_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
    },
  };
}

const store = process.env.DATABASE_URL
  ? makePgStore(process.env.DATABASE_URL)
  : makeFileStore(process.env.DATA_DIR || path.join(__dirname, 'data'));

/* ============================== sessioni ============================== */

const sign = who => crypto.createHmac('sha256', SESSION_SECRET).update(`${who}|${SECRET_CODE}`).digest('base64url');
const parseCookies = h => Object.fromEntries((h || '').split(';').map(p => p.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));

function whoFromReq(req) {
  const c = parseCookies(req.headers.cookie).us_s || '';
  const [who, sig] = c.split('.');
  if (!WHO.includes(who) || !sig) return null;
  const good = sign(who);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? who : null;
}

function setSession(req, res, who) {
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  const val = who ? `${who}.${sign(who)}` : '';
  const age = who ? 60 * 60 * 24 * 365 : 0;
  res.setHeader('Set-Cookie', `us_s=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`);
}

// Freno ai tentativi di indovinare il codice: 10 errori ogni 10 minuti per IP.
const fails = new Map();
function tooManyFails(ip) {
  const now = Date.now(), f = (fails.get(ip) || []).filter(t => now - t < 600000);
  fails.set(ip, f); return f.length >= 10;
}

/* ============================== presenza ============================== */

const presence = { lui: { seen: 0, typing: 0 }, lei: { seen: 0, typing: 0 } };

/* ============================== app ============================== */

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use('/api/photos', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '1h' }));

const wrap = fn => (req, res) => fn(req, res).catch(err => {
  console.error(err);
  res.status(500).json({ error: 'Qualcosa è andato storto, riprova' });
});

function auth(req, res, next) {
  const who = whoFromReq(req);
  if (!who) return res.status(401).json({ error: 'Accedi di nuovo' });
  req.who = who;
  next();
}

const bad = (res, msg) => res.status(400).json({ error: msg });

// Cosa vede chi guarda: lettere sigillate e risposte dell'altro (se non hai ancora risposto) nascoste.
function view(item, who, answeredDays) {
  if (item.deleted) return { id: item.id, ver: item.ver, deleted: true };
  const out = { ...item };
  if (item.kind === 'letter' && item.open_at && new Date(item.open_at) > new Date() && item.author !== who) {
    out.body = ''; out.meta = { ...item.meta, title: '' }; out.sealed = true;
  }
  if (item.kind === 'answer' && item.author !== who && !answeredDays.has(item.meta.day)) {
    out.body = ''; out.hidden = true;
  }
  return out;
}

app.get('/api/config', (req, res) => res.json({ needsCode: !!SECRET_CODE, who: whoFromReq(req) }));

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (tooManyFails(ip)) return res.status(429).json({ error: 'Troppi tentativi, riprova tra qualche minuto' });
  const who = String(req.body.who || '').toLowerCase();
  if (!WHO.includes(who)) return bad(res, 'Scegli LUI o LEI');
  if (SECRET_CODE && String(req.body.code || '').trim() !== SECRET_CODE) {
    fails.get(ip).push(Date.now());
    return res.status(401).json({ error: 'Codice sbagliato' });
  }
  setSession(req, res, who);
  res.json({ who });
});

app.post('/api/logout', (req, res) => { setSession(req, res, null); res.json({ ok: true }); });

app.get('/api/state', auth, wrap(async (req, res) => {
  const since = Math.max(0, Number(req.query.since) || 0);
  presence[req.who].seen = Date.now();
  const items = await store.listSince(since);
  const ver = Math.max(since, await store.maxVer());
  const answeredDays = await store.answeredDays(req.who);
  const now = Date.now();
  const p = presence[other(req.who)];
  res.json({
    me: req.who,
    ver,
    now: new Date().toISOString(),
    items: items.map(i => view(i, req.who, answeredDays)),
    settings: await store.getSettings(),
    partner: { online: now - p.seen < 25000, seen: p.seen ? new Date(p.seen).toISOString() : null, typing: now - p.typing < 6000 },
  });
}));

app.post('/api/typing', auth, (req, res) => { presence[req.who].typing = Date.now(); res.json({ ok: true }); });

app.post('/api/items', auth, wrap(async (req, res) => {
  const kind = String(req.body.kind || '');
  const body = String(req.body.body || '').trim();
  const m = req.body.meta && typeof req.body.meta === 'object' ? req.body.meta : {};
  const who = req.who;
  if (body.length > (LIMITS[kind] || 0) && kind !== 'ping') return bad(res, 'Troppo lungo');
  let meta = {}, open_at = null;

  switch (kind) {
    case 'ping': break;
    case 'msg': if (!body) return bad(res, 'Scrivi qualcosa ♡'); break;
    case 'letter': {
      if (!body) return bad(res, 'La lettera è vuota');
      meta.title = String(m.title || '').trim().slice(0, 80);
      if (m.when) { if (!WHEN.includes(m.when)) return bad(res, 'Occasione non valida'); meta.when = m.when; }
      if (req.body.open_at && !meta.when) {
        const d = new Date(req.body.open_at);
        if (isNaN(d)) return bad(res, 'Data non valida');
        open_at = d.toISOString();
      }
      break;
    }
    case 'mood':
      if (!MOODS.includes(m.mood)) return bad(res, 'Umore non valido');
      meta.mood = m.mood; break;
    case 'comfort': if (!body) return bad(res, 'Scrivi una frase'); break;
    case 'sos': break;
    case 'todo':
      if (!body) return bad(res, 'Scrivi qualcosa');
      if (!LISTS.includes(m.list)) return bad(res, 'Lista non valida');
      meta.list = m.list; meta.done = false; break;
    case 'answer': {
      if (!body) return bad(res, 'Scrivi la tua risposta');
      const day = String(m.day || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return bad(res, 'Giorno non valido');
      meta.day = day; meta.q = Number(m.q) || 0;
      const all = await store.listSince(0);
      const mine = all.find(i => i.kind === 'answer' && i.author === who && i.meta.day === day && !i.deleted);
      const theirs = all.filter(i => i.kind === 'answer' && i.author !== who && i.meta.day === day && !i.deleted);
      const saved = mine ? await store.update(mine.id, { body }) : await store.insert({ kind, author: who, body, meta });
      await store.bump(theirs.map(i => i.id)); // così la sua risposta si svela anche a me
      return res.status(201).json(saved);
    }
    default: return bad(res, 'Tipo non valido');
  }
  const item = await store.insert({ kind, author: who, body, open_at, meta });
  res.status(201).json(item);
}));

app.patch('/api/items/:id', auth, wrap(async (req, res) => {
  const it = await store.get(Number(req.params.id));
  if (!it || it.deleted) return res.status(404).json({ error: 'Non trovato' });
  const who = req.who, action = req.body.action;
  const meta = { ...it.meta };

  if (action === 'react' && ['msg', 'photo', 'letter', 'comfort'].includes(it.kind)) {
    const emoji = String(req.body.emoji || '').slice(0, 8);
    meta.reactions = { ...(meta.reactions || {}) };
    if (!emoji || meta.reactions[who] === emoji) delete meta.reactions[who]; else meta.reactions[who] = emoji;
    return res.json(await store.update(it.id, { meta }));
  }
  if (action === 'toggle' && it.kind === 'todo') {
    meta.done = !meta.done; meta.done_by = meta.done ? who : null;
    meta.done_at = meta.done ? new Date().toISOString() : null;
    return res.json(await store.update(it.id, { meta }));
  }
  if (action === 'ack' && it.kind === 'sos' && it.author !== who) {
    meta.ack = new Date().toISOString();
    return res.json(await store.update(it.id, { meta, read_at: meta.ack }));
  }
  if (action === 'edit' && it.author === who && ['comfort', 'todo', 'photo', 'msg', 'mood'].includes(it.kind)) {
    const body = String(req.body.body || '').trim();
    if (!body && !['photo', 'mood'].includes(it.kind)) return bad(res, 'Testo vuoto');
    if (body.length > LIMITS[it.kind]) return bad(res, 'Troppo lungo');
    if (it.kind === 'msg') meta.edited = true;
    return res.json(await store.update(it.id, { body, meta }));
  }
  bad(res, 'Azione non permessa');
}));

app.post('/api/read', auth, wrap(async (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger).slice(0, 500);
  if (ids.length) await store.markRead(ids, req.who);
  res.json({ ok: true });
}));

app.delete('/api/items/:id', auth, wrap(async (req, res) => {
  const it = await store.get(Number(req.params.id));
  if (!it || it.deleted) return res.status(404).json({ error: 'Non trovato' });
  // Le voci delle liste sono di entrambi; il resto lo può cancellare solo chi l'ha scritto.
  if (it.author !== req.who && it.kind !== 'todo') return res.status(403).json({ error: 'Non è tuo' });
  if (it.kind === 'photo') await store.delPhoto(it.id);
  await store.update(it.id, { deleted: true, body: '', meta: {} });
  res.json({ ok: true });
}));

/* ------------------------------ foto ------------------------------ */

function decodeJpeg(dataUrl, maxBytes) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > maxBytes || buf[0] !== 0xff || buf[1] !== 0xd8) return null; // firma JPEG
  return buf;
}

app.post('/api/photos', auth, wrap(async (req, res) => {
  const full = decodeJpeg(req.body.full, 4 * 1024 * 1024);
  const thumb = decodeJpeg(req.body.thumb, 600 * 1024);
  if (!full || !thumb) return bad(res, 'Foto non valida');
  const caption = String(req.body.caption || '').trim().slice(0, LIMITS.photo);
  const taken = req.body.taken_at && !isNaN(new Date(req.body.taken_at)) ? new Date(req.body.taken_at).toISOString() : null;
  const meta = { w: Number(req.body.w) || 0, h: Number(req.body.h) || 0, taken_at: taken };
  const item = await store.insert({ kind: 'photo', author: req.who, body: caption, meta });
  await store.putPhoto(item.id, full, thumb);
  res.status(201).json(item);
}));

app.get('/api/photos/:id/:size', auth, wrap(async (req, res) => {
  const size = req.params.size === 'full' ? 'full' : 'thumb';
  const data = await store.getPhoto(Number(req.params.id), size);
  if (!data) return res.status(404).end();
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' });
  if (req.query.download) res.set('Content-Disposition', `attachment; filename="us-${req.params.id}.jpg"`);
  res.send(data);
}));

/* ------------------------------ impostazioni ------------------------------ */

const SETTING_KEYS = ['name_lui', 'name_lei', 'together_since', 'next_meeting'];
app.put('/api/settings', auth, wrap(async (req, res) => {
  const { key } = req.body;
  if (!SETTING_KEYS.includes(key)) return bad(res, 'Impostazione sconosciuta');
  await store.setSetting(key, String(req.body.value ?? '').trim().slice(0, 40));
  res.json({ ok: true });
}));

app.get('/healthz', (req, res) => res.send('ok'));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (SESSION_SECRET === 'us-dev-secret-cambiami' && process.env.NODE_ENV === 'production') {
  console.warn('ATTENZIONE: imposta SESSION_SECRET in produzione.');
}

store.init().then(() => {
  app.listen(PORT, () => console.log(`Us su http://localhost:${PORT} (dati: ${store.kind})`));
}).catch(err => { console.error('Database non raggiungibile:', err.message); process.exit(1); });
