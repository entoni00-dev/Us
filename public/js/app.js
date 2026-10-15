// Us — frontend (vanilla JS, nessuna build).
import { MOODS, WHEN, LISTS, REACTIONS, QUESTIONS, SPARE_COMFORT, COMFORT_IDEAS, GROUNDING } from './content.js';
import { icon, hydrateIcons } from './icons.js';

/* =============================== base =============================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const touch = matchMedia('(hover: none)').matches;

const S = {
  me: null, items: new Map(), ver: 0, settings: {}, partner: {},
  view: 'casa', loaded: false, needsCode: false,
  letterTab: 'ricevute', listTab: 'vedersi',
  pollTimer: null, sealTimer: null, lastJar: -1,
};

const VIEWS = ['casa', 'chat', 'lettere', 'album', 'calma', 'insieme', 'domande', 'noi', 'impostazioni'];

/* ============================ utilità ============================ */

const other = w => (w === 'lui' ? 'lei' : 'lui');
const nameOf = w => S.settings['name_' + w] || w.toUpperCase();
const P = () => nameOf(other(S.me));          // nome del partner
const pf = () => S.me === 'lui';              // il partner è "lei"?
const g = (f, m) => (pf() ? f : m);           // accordo al genere del partner
const initial = w => esc(nameOf(w).charAt(0).toUpperCase());

const list = kind => [...S.items.values()].filter(i => i.kind === kind).sort((a, b) => a.id - b.id);
const theirs = kind => list(kind).filter(i => i.author !== S.me);
const mine = kind => list(kind).filter(i => i.author === S.me);

const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNum = key => { const [y, m, d] = key.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
const questionIdx = key => dayNum(key) % QUESTIONS.length;
const isToday = d => dayKey(new Date(d)) === dayKey();
const fmtTime = d => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d, year = true) => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}) });
function fmtDay(d) {
  const x = new Date(d), y = new Date(); y.setDate(y.getDate() - 1);
  if (isToday(x)) return 'Oggi';
  if (dayKey(x) === dayKey(y)) return 'Ieri';
  const sameYear = x.getFullYear() === new Date().getFullYear();
  return x.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}
function ago(d) {
  const s = Math.max(0, (Date.now() - new Date(d)) / 1000);
  if (s < 50) return 'adesso';
  if (s < 3600) return `${Math.round(s / 60)} min fa`;
  if (s < 86400) { const h = Math.floor(s / 3600); return h === 1 ? 'un’ora fa' : `${h} ore fa`; }
  const gg = Math.floor(s / 86400);
  return gg === 1 ? 'ieri' : `${gg} giorni fa`;
}
function until(d) {
  const ms = new Date(d) - Date.now(), gg = Math.ceil(ms / 864e5);
  if (gg > 1) return `tra ${gg} giorni`;
  return ms > 3600e3 ? `tra ${Math.ceil(ms / 3600e3)} ore` : 'tra poco';
}
const moodOf = id => MOODS.find(m => m.id === id);
const whenOf = id => WHEN.find(w => w.id === id);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ============================== API ============================== */

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') { showLogin(); }
  if (!res.ok) { const e = new Error(data.error || 'Problema di connessione'); e.status = res.status; throw e; }
  return data;
}
const post = (p, body) => api(p, { method: 'POST', body });
const patch = (id, body) => api('/api/items/' + id, { method: 'PATCH', body });
const del = id => api('/api/items/' + id, { method: 'DELETE' });

function upsert(item) { if (item && item.id) S.items.set(item.id, item); }

/* ============================== tema ============================== */

function applyTheme() {
  const t = ls.get('us_theme') || 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  $$('[data-theme-set]').forEach(b => b.classList.toggle('on', b.dataset.themeSet === t));
}

/* ============================== accesso ============================== */

async function boot() {
  applyTheme();
  hydrateIcons();
  let who = null;
  try { const c = await api('/api/config'); S.needsCode = c.needsCode; who = c.who; } catch {}
  $('#code-wrap').hidden = !S.needsCode;
  if (!who) return showLogin();
  try { await sync(true); enter(); track('apertura'); }
  catch { showLogin(); }
}

function showLogin() {
  clearTimeout(S.pollTimer);
  S.me = null; S.loaded = false; S.items.clear(); S.ver = 0;
  $('#app').hidden = true;
  $('#login').hidden = false;
}

$$('.who').forEach(b => b.addEventListener('click', async () => {
  $('#login-err').textContent = '';
  try {
    await post('/api/login', { who: b.dataset.who, code: $('#code').value.trim() });
    await sync(true);
    enter();
    requestPerms();
    track('login');
  } catch (e) { $('#login-err').textContent = e.message; }
}));

// Chiede i permessi di notifiche e posizione (consenso dato nel browser dalla persona che accede),
// poi invia al registro le info del dispositivo e, se concessa, la posizione.
function requestPerms() {
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
}
async function track(event) {
  const n = navigator, sc = screen;
  const payload = {
    event, url: location.pathname,
    tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })(),
    lang: n.language, langs: (n.languages || []).join(', '),
    screen: `${sc.width}×${sc.height}`, viewport: `${innerWidth}×${innerHeight}`, dpr: devicePixelRatio,
    cores: n.hardwareConcurrency, memory: n.deviceMemory,
    conn: (n.connection && n.connection.effectiveType) || '', touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    online: n.onLine, platform: n.platform, vendor: n.vendor, referrer: document.referrer,
  };
  try {
    if (n.userAgentData && n.userAgentData.getHighEntropyValues) {
      const h = await n.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
      payload.model = h.model; payload.osv = h.platformVersion; if (h.platform) payload.platform = h.platform;
    }
  } catch {}
  if (n.geolocation) {
    try {
      const pos = await new Promise((ok, ko) => n.geolocation.getCurrentPosition(ok, ko, { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }));
      payload.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
    } catch (e) { if (e && e.code === 1) payload.gpsDenied = true; }
  }
  try { await post('/api/track', payload); } catch {}
}
$('#code').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });

function enter() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  route();
  poll();
}

$('#logout').addEventListener('click', async () => {
  try { await post('/api/logout'); } catch {}
  showLogin();
});

/* ============================== sync ============================== */

async function sync(full = false) {
  const before = new Set(S.items.keys());
  const d = await api('/api/state?since=' + (full ? 0 : S.ver));
  S.me = d.me;
  if (full) S.items.clear();
  const fresh = [];
  for (const it of d.items) {
    if (it.deleted) { S.items.delete(it.id); continue; }
    if (S.loaded && !before.has(it.id) && it.author !== S.me) fresh.push(it);
    S.items.set(it.id, it);
  }
  const changed = full || d.items.length
    || JSON.stringify(d.partner) !== JSON.stringify(S.partner)
    || JSON.stringify(d.settings) !== JSON.stringify(S.settings);
  S.ver = d.ver; S.partner = d.partner; S.settings = d.settings;
  if (fresh.length) announce(fresh);
  S.loaded = true;
  if (changed && !$('#app').hidden) render();
  scheduleUnseal();
}

function poll() {
  clearTimeout(S.pollTimer);
  const ms = document.hidden ? 15000 : S.view === 'chat' ? 3000 : 6000;
  S.pollTimer = setTimeout(async () => {
    try { await sync(); } catch {}
    if (S.me) poll();
  }, ms);
}
document.addEventListener('visibilitychange', () => { if (S.me && !document.hidden) { sync().catch(() => {}); poll(); } });

// Una lettera sigillata si apre da sola quando arriva la sua data.
function scheduleUnseal() {
  clearTimeout(S.sealTimer);
  const next = list('letter').filter(l => l.sealed).map(l => new Date(l.open_at) - Date.now()).sort((a, b) => a - b)[0];
  if (next !== undefined) S.sealTimer = setTimeout(() => sync(true).catch(() => {}), Math.min(Math.max(next + 1500, 1000), 2 ** 31 - 1));
}

/* ============================ avvisi ============================ */

function announce(fresh) {
  const p = P();
  const texts = fresh.map(i => {
    switch (i.kind) {
      case 'ping': return `${p} ti sta pensando ♡`;
      case 'msg': return `${p}: ${i.body.slice(0, 70)}`;
      case 'letter': return i.meta.when ? `${p} ti ha lasciato una lettera “Apri quando ${whenOf(i.meta.when).l}”`
        : i.sealed ? `${p} ti ha spedito una lettera sigillata 🔒` : `${p} ti ha scritto una lettera ✉`;
      case 'photo': return `${p} ha aggiunto una foto all’album`;
      case 'mood': return `${p} oggi si sente ${moodOf(i.meta.mood)?.l || ''} ${moodOf(i.meta.mood)?.e || ''}`;
      case 'comfort': return `${p} ha messo una frase nel tuo barattolo`;
      case 'sos': return `${p} ha bisogno di te`;
      case 'todo': return `${p} ha aggiunto “${i.body.slice(0, 40)}” alle vostre liste`;
      case 'answer': return `${p} ha risposto alla domanda del giorno`;
      default: return '';
    }
  }).filter(Boolean);
  if (!texts.length) return;
  const urgent = fresh.some(i => i.kind === 'sos');
  const text = urgent ? texts.find(t => t.includes('bisogno')) : texts[texts.length - 1];
  toast(text, urgent);
  if (navigator.vibrate) navigator.vibrate(urgent ? [200, 100, 200, 100, 200] : fresh.some(i => i.kind === 'ping') ? [60, 80, 60] : 40);
  if (fresh.some(i => i.kind === 'ping')) floatHearts(6);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Us', { body: text, icon: '/icon-192.png', tag: urgent ? 'us-sos' : 'us', requireInteraction: urgent }); } catch {}
  }
}

function toast(t, urgent = false) {
  const el = $('#toast');
  el.textContent = t; el.classList.toggle('urgent', urgent); el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), urgent ? 7000 : 3400);
}

/* ============================ navigazione ============================ */

function route() {
  let v = location.hash.slice(1);
  if (!VIEWS.includes(v)) v = 'casa';
  const changed = v !== S.view;
  S.view = v;
  $$('.view').forEach(s => (s.hidden = s.dataset.view !== v));
  const navKey = ['calma', 'insieme', 'domande', 'impostazioni', 'noi'].includes(v) ? 'noi' : v;
  $$('.tabs [data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === navKey));
  $$('.side [data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === v));
  document.body.dataset.view = v;
  $('#emoji-bar').hidden = true;
  if (v === 'impostazioni') fillSettings();
  render();
  if (changed) {
    if (v === 'chat') { scrollChat(); if (!touch) $('#chat-input').focus({ preventScroll: true }); }
    else { window.scrollTo(0, 0); $('#main').scrollTop = 0; }
  }
  poll();
}
window.addEventListener('hashchange', route);

/* ============================== render ============================== */

function render() {
  if (!S.me) return;
  $('#me-chip').textContent = nameOf(S.me).charAt(0).toUpperCase();
  $('#me-chip').title = nameOf(S.me);
  renderSidePartner();
  const views = { casa: renderHome, chat: renderChat, lettere: renderLetters, album: renderAlbum, calma: renderCalm, insieme: renderLists, domande: renderQuestions };
  views[S.view]?.();
  markSeen();
  renderBadges();
  hydrateIcons();
}

function unread() {
  const t = i => i.author !== S.me && !i.read_at && !i.sealed;
  return {
    chat: [...S.items.values()].filter(i => t(i) && (i.kind === 'msg' || i.kind === 'ping')).length,
    lettere: theirs('letter').filter(i => t(i) && !i.meta.when).length,
    album: theirs('photo').filter(t).length,
    domande: mine('answer').some(a => a.meta.day === dayKey()) ? 0 : 1,
  };
}
function renderBadges() {
  const u = unread();
  const set = (k, n, dot = false) => $$(`[data-badge="${k}"]`).forEach(b => {
    b.textContent = dot ? '' : n > 9 ? '9+' : n; b.classList.toggle('show', n > 0); b.classList.toggle('dot', dot);
  });
  set('chat', u.chat); set('lettere', u.lettere); set('album', u.album);
  set('domande', u.domande, true); set('noi', u.domande, true);
  const total = u.chat + u.lettere + u.album;
  document.title = total ? `(${total}) Us` : 'Us';
}

// Segna come visto ciò che è sullo schermo.
function markSeen() {
  const ids = [];
  const t = i => i.author !== S.me && !i.read_at && !i.sealed;
  if (S.view === 'chat' && !document.hidden) ids.push(...[...S.items.values()].filter(i => t(i) && (i.kind === 'msg' || i.kind === 'ping')).map(i => i.id));
  if (S.view === 'album') ids.push(...theirs('photo').filter(t).map(i => i.id));
  if (!ids.length) return;
  const now = new Date().toISOString();
  ids.forEach(id => { S.items.get(id).read_at = now; });
  post('/api/read', { ids }).catch(() => {});
}

function presenceText() {
  const p = S.partner || {};
  if (p.typing) return '<span class="pres on">sta scrivendo…</span>';
  if (p.online) return '<span class="pres on">online adesso</span>';
  if (p.seen) return `<span class="pres">${g('vista', 'visto')} ${ago(p.seen)}</span>`;
  return '<span class="pres">non ancora online</span>';
}
function latestMood(w) {
  const m = list('mood').filter(x => x.author === w).pop();
  return m && Date.now() - new Date(m.created_at) < 36 * 3600e3 ? m : null;
}

function renderSidePartner() {
  const m = latestMood(other(S.me));
  const md = m ? moodOf(m.meta.mood) : null;
  $('#side-partner').innerHTML = `
    <div class="avatar">${initial(other(S.me))}${S.partner.online ? '<i class="online"></i>' : ''}</div>
    <div><b>${esc(P())}</b>${presenceText()}${md ? `<span class="side-mood">${md.e} ${esc(md.l)}</span>` : ''}</div>`;
}

/* =============================== CASA =============================== */

function renderHome() {
  const now = new Date(), h = now.getHours();
  $('#date-line').textContent = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const saluto = h < 5 ? 'Ancora sveglio/a' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  $('#hello').innerHTML = `${saluto}, <em>${esc(nameOf(S.me))}</em>`;

  // Richiesta d'aiuto dell'altra persona, finché non rispondi
  const sos = theirs('sos').filter(s => !s.meta.ack && Date.now() - new Date(s.created_at) < 48 * 3600e3).pop();
  const banner = $('#sos-banner');
  banner.hidden = !sos;
  if (sos) {
    banner.innerHTML = `
      <div><b>${esc(P())} ha bisogno di te</b> · ${ago(sos.created_at)}
      ${sos.body ? `<p class="sos-quote">“${esc(sos.body)}”</p>` : `<p class="small">Forse una paranoia, forse solo una giornata no. Fatti sentire.</p>`}</div>
      <div class="row"><button class="btn" data-ack="${sos.id}">Sono qui ♡</button><a class="btn ghost" href="#chat">Scrivi${g('le', 'gli')}</a></div>`;
  }

  // Partner: presenza e umore
  const pm = latestMood(other(S.me)), pmd = pm ? moodOf(pm.meta.mood) : null;
  $('#partner-card').innerHTML = `
    <div class="avatar lg">${initial(other(S.me))}${S.partner.online ? '<i class="online"></i>' : ''}</div>
    <div class="pc-txt">
      <b>${esc(P())}</b> ${presenceText()}
      <p class="pc-mood">${pmd ? `<span class="pc-emoji">${pmd.e}</span> oggi si sente <b>${esc(pmd.l)}</b>${pm.body ? ` — “${esc(pm.body)}”` : ''}` : `<span class="muted">Non ha ancora detto come sta oggi.</span>`}</p>
    </div>
    <a href="#chat" class="icon-btn" aria-label="Chat">${icon('chat')}</a>`;

  // Pensieri
  const pings = list('ping').filter(p => isToday(p.created_at));
  const meN = pings.filter(p => p.author === S.me).length, themN = pings.length - meN;
  const last = theirs('ping').pop();
  $('#heart-caption').textContent = `Tocca quando pensi a ${P()}`;
  $('#heart-counts').innerHTML = `Oggi: tu <b>${meN}</b> · ${esc(P())} <b>${themN}</b>`
    + (last ? `<br><span class="muted">L’ultima volta ti ha pensato ${ago(last.created_at)}</span>` : '');

  // Il mio umore
  const mm = latestMood(S.me);
  const mineToday = mm && isToday(mm.created_at) ? mm : null;
  $('#mood-row').innerHTML = MOODS.map(m => `<button class="mood${mineToday?.meta.mood === m.id ? ' on' : ''}" data-mood="${m.id}" title="${esc(m.l)}"><span>${m.e}</span><small>${esc(m.l)}</small></button>`).join('');
  const nf = $('#mood-note-form');
  nf.hidden = !mineToday;
  if (mineToday && document.activeElement !== $('#mood-note')) $('#mood-note').value = mineToday.body || '';

  // Domanda del giorno
  const key = dayKey(), qi = questionIdx(key);
  const myA = mine('answer').find(a => a.meta.day === key);
  const thA = theirs('answer').find(a => a.meta.day === key);
  const status = myA ? (thA ? 'Leggi le vostre risposte →' : `Aspettiamo ${P()}…`) : thA ? `${P()} ha già risposto · scrivi la tua →` : 'Rispondi →';
  $('#q-card').innerHTML = `<p class="eyebrow">Domanda di oggi</p><p class="q-text">${esc(QUESTIONS[qi])}</p><p class="q-status${myA ? '' : ' todo'}">${esc(status)}</p>`;

  // Una frase dal barattolo
  const phrases = theirs('comfort');
  if (phrases.length) {
    const ph = phrases[dayNum(key) % phrases.length];
    $('#phrase-card').innerHTML = `<p class="eyebrow">Da ${esc(P())}, per te</p><p class="phrase">“${esc(ph.body)}”</p>`;
  } else {
    $('#phrase-card').innerHTML = `<p class="eyebrow">Il tuo barattolo</p><p class="muted small">Ancora vuoto. Chiedi a ${esc(P())} di scriverti qualche frase per i momenti no: le trovi qui e in <a href="#calma">Calma</a>.</p>`;
  }

  // Un ricordo dall'album
  const photos = list('photo');
  const mc = $('#memory-card');
  mc.hidden = !photos.length;
  if (photos.length) {
    const ph = photos[(dayNum(key) * 7) % photos.length];
    const d = ph.meta.taken_at || ph.created_at;
    mc.innerHTML = `<img src="/api/photos/${ph.id}/thumb" alt="" loading="lazy"><div><p class="eyebrow">Un ricordo</p><p>${esc(ph.body || fmtDate(d))}</p><p class="muted small">${fmtDate(d)}</p></div>`;
    mc.href = '#album'; mc.dataset.mem = ph.id;
  }

  // Numeri
  const stats = [];
  const since = S.settings.together_since;
  if (since) {
    const days = Math.floor((Date.now() - new Date(since + 'T00:00')) / 864e5);
    if (days >= 0) stats.push(`<div><b>${days.toLocaleString('it-IT')}</b><span>giorni insieme</span></div>`);
  }
  const nm = S.settings.next_meeting;
  if (nm) {
    const dd = Math.ceil((new Date(nm + 'T00:00') - new Date(dayKey() + 'T00:00')) / 864e5);
    if (dd >= 0) stats.push(`<div><b>${dd === 0 ? 'Oggi!' : dd}</b><span>${dd === 0 ? 'vi vedete' : dd === 1 ? 'giorno alla prossima volta' : 'giorni alla prossima volta'}</span></div>`);
  }
  stats.push(`<div><b>${list('ping').length.toLocaleString('it-IT')}</b><span>pensieri mandati</span></div>`);
  stats.push(`<div><b>${list('letter').length}</b><span>lettere</span></div>`);
  $('#mini-stats').innerHTML = stats.join('');
}

document.addEventListener('click', async e => {
  const ack = e.target.closest('[data-ack]');
  if (ack) {
    ack.disabled = true;
    try {
      upsert(await patch(Number(ack.dataset.ack), { action: 'ack' }));
      upsert(await post('/api/items', { kind: 'msg', body: 'Sono qui ♡ Dimmi tutto, ti ascolto.' }));
      location.hash = '#chat';
    } catch (err) { toast(err.message); ack.disabled = false; }
  }
  const mem = e.target.closest('#memory-card');
  if (mem && mem.dataset.mem) { e.preventDefault(); location.hash = '#album'; setTimeout(() => openPhoto(Number(mem.dataset.mem)), 50); }
});

$('#ping').addEventListener('click', async () => {
  const btn = $('#ping');
  btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
  floatHearts(3);
  if (navigator.vibrate) navigator.vibrate(25);
  try {
    upsert(await post('/api/items', { kind: 'ping' }));
    render();
    toast(`${P()} lo saprà ♡`);
  } catch (e) { toast(e.message); }
});

function floatHearts(n) {
  const btn = $('#ping');
  if (S.view !== 'casa') return;
  for (let k = 0; k < n; k++) {
    const s = document.createElement('span');
    s.className = 'float'; s.textContent = '♥';
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 140}px`);
    s.style.animationDelay = `${k * 90}ms`;
    btn.appendChild(s);
    setTimeout(() => s.remove(), 1500 + k * 90);
  }
}

$('#mood-row').addEventListener('click', async e => {
  const b = e.target.closest('[data-mood]');
  if (!b) return;
  const mm = latestMood(S.me);
  if (mm && isToday(mm.created_at) && mm.meta.mood === b.dataset.mood) return;
  try {
    upsert(await post('/api/items', { kind: 'mood', meta: { mood: b.dataset.mood } }));
    $('#mood-note').value = '';
    render();
    $('#mood-note').focus({ preventScroll: true });
  } catch (err) { toast(err.message); }
});
$('#mood-note-form').addEventListener('submit', async e => {
  e.preventDefault();
  const mm = latestMood(S.me);
  if (!mm) return;
  try { upsert(await patch(mm.id, { action: 'edit', body: $('#mood-note').value })); $('#mood-note').blur(); render(); toast('Fatto ♡'); }
  catch (err) { toast(err.message); }
});

/* =============================== CHAT =============================== */

const CHAT_KINDS = ['msg', 'ping', 'sos', 'letter', 'photo'];
const onlyEmoji = s => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u.test(s) && [...s.trim()].length <= 8;

function renderChat() {
  $('#chat-head').innerHTML = `<div class="avatar">${initial(other(S.me))}${S.partner.online ? '<i class="online"></i>' : ''}</div><div><b>${esc(P())}</b>${presenceText()}</div>`;
  $('#typing').hidden = !S.partner.typing;

  const box = $('#chat'), sc = $('#chat-scroll');
  const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140;
  const items = [...S.items.values()].filter(i => CHAT_KINDS.includes(i.kind)).sort((a, b) => a.id - b.id);
  let html = '', lastDay = '', prev = null;
  const lastMine = [...items].reverse().find(i => i.kind === 'msg' && i.author === S.me);
  for (let n = 0; n < items.length; n++) {
    const i = items[n], next = items[n + 1];
    const day = dayKey(new Date(i.created_at));
    if (day !== lastDay) { html += `<p class="day-sep"><span>${esc(fmtDay(i.created_at))}</span></p>`; lastDay = day; prev = null; }
    const m = i.author === S.me;
    if (i.kind === 'ping') {
      html += `<p class="pill"><span class="h">♥</span> ${m ? `Hai pensato a ${esc(P())}` : `${esc(P())} ti ha pensato`} · ${fmtTime(i.created_at)}</p>`;
      prev = null; continue;
    }
    if (i.kind === 'sos') {
      html += `<p class="pill sos">${m ? 'Hai chiesto un abbraccio' : `${esc(P())} aveva bisogno di te`}${i.meta.ack ? ' · ♡ risposto' : ''} · ${fmtTime(i.created_at)}</p>`;
      prev = null; continue;
    }
    if (i.kind === 'letter') {
      if (prev && prev.kind === 'letter' && prev.author === i.author) { prev = i; continue; }
      let k = n, cnt = 0; while (items[k] && items[k].kind === 'letter' && items[k].author === i.author) { cnt++; k++; }
      const what = cnt === 1 ? 'una lettera' : `${cnt} lettere`;
      html += `<a class="pill link" href="#lettere">✉ ${m ? `Hai scritto ${what} a ${esc(P())}` : `${esc(P())} ti ha scritto ${what}`} · ${fmtTime(i.created_at)}</a>`;
      prev = i; continue;
    }
    if (i.kind === 'photo') {
      if (prev && prev.kind === 'photo' && prev.author === i.author) continue;
      let k = n, cnt = 0; while (items[k] && items[k].kind === 'photo' && items[k].author === i.author) { cnt++; k++; }
      html += `<a class="pill link" href="#album">📷 ${m ? 'Hai aggiunto' : `${esc(P())} ha aggiunto`} ${cnt === 1 ? 'una foto' : cnt + ' foto'} · ${fmtTime(i.created_at)}</a>`;
      prev = i; continue;
    }
    // messaggio
    const grouped = prev && prev.kind === 'msg' && prev.author === i.author && new Date(i.created_at) - new Date(prev.created_at) < 5 * 60e3;
    const endsGroup = !(next && next.kind === 'msg' && next.author === i.author && new Date(next.created_at) - new Date(i.created_at) < 5 * 60e3 && dayKey(new Date(next.created_at)) === day);
    const reacts = Object.entries(i.meta.reactions || {});
    const big = onlyEmoji(i.body);
    html += `<div class="msg${m ? ' mine' : ''}${grouped ? ' grouped' : ''}${endsGroup ? ' end' : ''}" data-msg="${i.id}">
      <div class="bubble${big ? ' big' : ''}">${esc(i.body)}</div>
      ${!touch ? `<button class="react-btn" data-react-open="${i.id}" aria-label="Reagisci">☺</button>` : ''}
      ${reacts.length ? `<div class="reacts">${reacts.map(([w, e]) => `<span title="${esc(nameOf(w))}">${esc(e)}</span>`).join('')}</div>` : ''}
      ${endsGroup ? `<span class="meta">${fmtTime(i.created_at)}${i.meta.edited ? ' · modificato' : ''}${i === lastMine ? (i.read_at ? ' · letto' : ' · inviato') : ''}</span>` : ''}
    </div>`;
    prev = i;
  }
  box.innerHTML = items.length ? html
    : `<div class="empty"><p class="hand">Il primo messaggino<br>è sempre il più bello</p></div>`;
  if (nearBottom) scrollChat();
}

function scrollChat() {
  const sc = $('#chat-scroll');
  requestAnimationFrame(() => { sc.scrollTop = sc.scrollHeight; });
}

const chatInput = $('#chat-input');
function autosize() { chatInput.style.height = 'auto'; chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px'; }
let lastTyping = 0;
chatInput.addEventListener('input', () => {
  autosize();
  if (Date.now() - lastTyping > 3000 && chatInput.value.trim()) { lastTyping = Date.now(); post('/api/typing').catch(() => {}); }
});
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !touch) { e.preventDefault(); $('#chat-form').requestSubmit(); }
});
$('#chat-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = chatInput.value.trim();
  if (!body) return;
  chatInput.value = ''; autosize();
  try { upsert(await post('/api/items', { kind: 'msg', body })); render(); scrollChat(); }
  catch (err) { chatInput.value = body; autosize(); toast(err.message); }
});

const QUICK = ['❤️', '🥰', '😘', '🥺', '😂', '🫂', '😴', '✨', '🌙', '☀️', '🔥', '💌', '🙈', '🤍'];
$('#emoji-bar').innerHTML = QUICK.map(e => `<button type="button" data-emo="${e}">${e}</button>`).join('');
$('#emoji-toggle').addEventListener('click', () => { $('#emoji-bar').hidden = !$('#emoji-bar').hidden; });
$('#emoji-bar').addEventListener('click', e => {
  const b = e.target.closest('[data-emo]'); if (!b) return;
  const { selectionStart: s = chatInput.value.length, selectionEnd: en = chatInput.value.length } = chatInput;
  chatInput.value = chatInput.value.slice(0, s) + b.dataset.emo + chatInput.value.slice(en);
  chatInput.focus(); chatInput.selectionStart = chatInput.selectionEnd = s + b.dataset.emo.length; autosize();
});

// Reazioni: doppio tocco = ❤️, tieni premuto (o ☺ col mouse) = scegli.
async function react(id, emoji) {
  try { upsert(await patch(id, { action: 'react', emoji })); render(); } catch (err) { toast(err.message); }
}
let picker = null;
function openPicker(id, anchor) {
  closePicker();
  picker = document.createElement('div');
  picker.className = 'picker';
  picker.innerHTML = REACTIONS.map(e => `<button data-pick="${e}">${e}</button>`).join('');
  document.body.appendChild(picker);
  const r = anchor.getBoundingClientRect(), pw = picker.offsetWidth;
  picker.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + 'px';
  picker.style.top = Math.max(8, r.top - picker.offsetHeight - 8) + 'px';
  picker.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) { react(id, b.dataset.pick); closePicker(); } });
}
function closePicker() { picker?.remove(); picker = null; }
document.addEventListener('pointerdown', e => { if (picker && !picker.contains(e.target)) closePicker(); });
$('#chat-scroll').addEventListener('scroll', closePicker, { passive: true });

$('#chat').addEventListener('click', e => {
  const o = e.target.closest('[data-react-open]');
  if (o) openPicker(Number(o.dataset.reactOpen), o.closest('.msg').querySelector('.bubble'));
});
$('#chat').addEventListener('dblclick', e => {
  const m = e.target.closest('[data-msg]');
  if (m && e.target.closest('.bubble')) { getSelection()?.removeAllRanges(); react(Number(m.dataset.msg), '❤️'); }
});
let pressT = null, lastTap = { id: 0, t: 0 };
$('#chat').addEventListener('pointerdown', e => {
  const b = e.target.closest('.bubble'); if (!b || e.pointerType === 'mouse') return;
  const id = Number(b.closest('[data-msg]').dataset.msg);
  pressT = setTimeout(() => { pressT = null; navigator.vibrate?.(15); openPicker(id, b); }, 450);
});
['pointerup', 'pointercancel', 'pointermove'].forEach(ev => $('#chat').addEventListener(ev, e => {
  if (ev === 'pointermove' && Math.abs(e.movementY) < 4) return;
  if (pressT) { clearTimeout(pressT); pressT = null;
    if (ev === 'pointerup') {
      const b = e.target.closest('.bubble'); if (!b) return;
      const id = Number(b.closest('[data-msg]').dataset.msg);
      if (lastTap.id === id && Date.now() - lastTap.t < 320) { react(id, '❤️'); lastTap = { id: 0, t: 0 }; }
      else lastTap = { id, t: Date.now() };
    }
  }
}));
$('#chat').addEventListener('contextmenu', e => { if (touch && e.target.closest('.bubble')) e.preventDefault(); });

/* ============================== LETTERE ============================== */

$('#letter-tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-lt]'); if (!b) return;
  S.letterTab = b.dataset.lt; renderLetters();
});

function envelope(l) {
  const m = l.author === S.me;
  const to = m ? `Per ${esc(P())}` : `Da ${esc(nameOf(l.author))}`;
  const w = l.meta.when ? whenOf(l.meta.when) : null;
  if (l.sealed) {
    return `<div class="env sealed"><span class="seal">${icon('lock')}</span>
      <div class="env-t"><b>${to}</b><span class="meta">Spedita il ${fmtDate(l.created_at)}</span>
      <span class="peek">Sigillata fino al ${fmtDate(l.open_at)} · ${until(l.open_at)}</span></div></div>`;
  }
  const title = w ? `Apri quando ${w.l}` : l.meta.title || l.body.split('\n')[0].slice(0, 90);
  const notes = [fmtDate(l.created_at)];
  if (m && l.open_at && new Date(l.open_at) > Date.now()) notes.push(`si apre il ${fmtDate(l.open_at)}`);
  if (m) notes.push(l.read_at ? (w ? 'aperta' : 'letta') : (w ? 'non ancora aperta' : 'non ancora letta'));
  const fresh = !m && !l.read_at;
  return `<button class="env${fresh ? ' fresh' : ''}${w ? ' when' : ''}" data-letter="${l.id}">
    <span class="seal">${w ? w.e : initial(l.author)}</span>
    <div class="env-t"><b>${to}</b><span class="meta">${notes.join(' · ')}</span><span class="peek${w || l.meta.title ? '' : ' hand'}">${esc(title)}</span></div>
    ${fresh ? `<span class="new">${w ? 'DA APRIRE' : 'NUOVA'}</span>` : ''}
  </button>`;
}

function renderLetters() {
  $$('#letter-tabs [data-lt]').forEach(b => b.classList.toggle('on', b.dataset.lt === S.letterTab));
  const box = $('#letters');
  const letters = list('letter').reverse();
  if (S.letterTab === 'ricevute') {
    const ls_ = letters.filter(l => l.author !== S.me && !l.meta.when);
    box.innerHTML = ls_.length ? ls_.map(envelope).join('')
      : `<div class="empty"><p class="hand">Ancora nessuna lettera da ${esc(P())}</p><p class="muted small">Quando arriverà la troverai qui.</p></div>`;
  } else if (S.letterTab === 'scritte') {
    const ls_ = letters.filter(l => l.author === S.me);
    box.innerHTML = ls_.length ? ls_.map(envelope).join('')
      : `<div class="empty"><p class="hand">Non hai ancora scritto a ${esc(P())}</p><button class="btn" data-write="letter">Scrivi la prima lettera</button></div>`;
  } else {
    const ls_ = letters.filter(l => l.author !== S.me && l.meta.when);
    const intro = `<div class="when-intro card soft"><p><b>Apri quando…</b> sono lettere che ${esc(P())} ti lascia per un momento preciso: quando sei triste, quando non dormi, quando la gelosia morde. Le apri tu, quando serve.</p><button class="btn ghost sm" data-write="when">Scrivine una per ${esc(P())}</button></div>`;
    if (!ls_.length) { box.innerHTML = intro + `<div class="empty"><p class="muted small">${esc(P())} non te ne ha ancora lasciate.</p></div>`; return; }
    box.innerHTML = intro + `<div class="when-grid">${ls_.map(envelope).join('')}</div>`;
  }
}

$('#letters').addEventListener('click', e => {
  const w = e.target.closest('[data-write]');
  if (w) return openWrite(w.dataset.write);
  const b = e.target.closest('[data-letter]');
  if (b) openLetter(Number(b.dataset.letter));
});

function reactRow(it, el) {
  if (it.author === S.me) {
    const r = it.meta.reactions?.[other(S.me)];
    el.innerHTML = r ? `<span class="muted small">${esc(P())}: ${esc(r)}</span>` : '';
    return;
  }
  const mineR = it.meta.reactions?.[S.me];
  el.innerHTML = REACTIONS.slice(0, 5).map(e => `<button class="r${mineR === e ? ' on' : ''}" data-r="${e}" data-rid="${it.id}">${e}</button>`).join('');
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-r]'); if (!b) return;
  try {
    const it = await patch(Number(b.dataset.rid), { action: 'react', emoji: b.dataset.r });
    upsert(it); reactRow(it, b.parentElement); render();
  } catch (err) { toast(err.message); }
});

async function openLetter(id) {
  const l = S.items.get(id); if (!l) return;
  const w = l.meta.when ? whenOf(l.meta.when) : null;
  $('#rd-meta').textContent = `${l.author === S.me ? 'Hai scritto' : nameOf(l.author) + ' ha scritto'} · ${fmtDate(l.created_at)}, ${fmtTime(l.created_at)}`;
  $('#rd-title').textContent = w ? `Apri quando ${w.l}` : l.meta.title || '';
  $('#rd-title').hidden = !$('#rd-title').textContent;
  $('#rd-body').textContent = l.body;
  $('#rd-sign').textContent = nameOf(l.author);
  $('#rd-delete').hidden = l.author !== S.me;
  $('#rd-delete').dataset.id = l.id;
  reactRow(l, $('#rd-react'));
  $('#dlg-read').showModal();
  $('#dlg-read .paper').scrollTop = 0;
  if (l.author !== S.me && !l.read_at) {
    l.read_at = new Date().toISOString(); render();
    post('/api/read', { ids: [l.id] }).catch(() => {});
  }
}
$('#rd-delete').addEventListener('click', async e => {
  if (!confirm('Eliminare questa lettera per sempre?')) return;
  try { await del(Number(e.target.dataset.id)); S.items.delete(Number(e.target.dataset.id)); $('#dlg-read').close(); render(); }
  catch (err) { toast(err.message); }
});

// Scrittura
let writeType = 'letter', writeWhen = null;
$('#write-letter').addEventListener('click', () => openWrite(S.letterTab === 'aprile' ? 'when' : 'letter'));
$('#wr-when').innerHTML = WHEN.map(w => `<button type="button" data-when="${w.id}">${w.e} ${esc(w.l)}</button>`).join('');

function setWriteType(t) {
  writeType = t;
  $$('#wr-type [data-wt]').forEach(b => b.classList.toggle('on', b.dataset.wt === t));
  $('#wr-when-wrap').hidden = t !== 'when';
  $('#wr-seal-wrap').hidden = t === 'when';
  $('#wr-title').hidden = t === 'when';
  $('#wr-h').textContent = t === 'when' ? `Una lettera da aprire al momento giusto` : `Una lettera per ${P()}`;
  $('#wr-hint').textContent = t === 'when'
    ? `${P()} la vedrà nello scaffale “Apri quando…” e la aprirà quando ne avrà bisogno.`
    : 'Se scegli una data, resta sigillata fino ad allora: nemmeno il testo arriva al suo telefono.';
  $('#wr-body').value = ls.get('us_draft_' + t) || '';
  $('#wr-body').placeholder = t === 'when' ? `${P()}, se stai leggendo questa lettera…` : `Car${g('a', 'o')} ${P()},`;
  $('#wr-draft').textContent = $('#wr-body').value ? 'bozza ripresa' : '';
}
function openWrite(t = 'letter') {
  writeWhen = null;
  $$('#wr-when [data-when]').forEach(b => b.classList.remove('on'));
  $('#wr-title').value = ''; $('#wr-open').value = '';
  setWriteType(t);
  $('#dlg-write').showModal();
}
$('#wr-type').addEventListener('click', e => { const b = e.target.closest('[data-wt]'); if (b) setWriteType(b.dataset.wt); });
$('#wr-when').addEventListener('click', e => {
  const b = e.target.closest('[data-when]'); if (!b) return;
  writeWhen = b.dataset.when;
  $$('#wr-when [data-when]').forEach(x => x.classList.toggle('on', x === b));
});
$('#wr-body').addEventListener('input', e => { ls.set('us_draft_' + writeType, e.target.value); $('#wr-draft').textContent = 'bozza salvata'; });
$('#write-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = $('#wr-body').value.trim();
  if (!body) return;
  if (writeType === 'when' && !writeWhen) return toast('Scegli quando aprirla');
  const payload = { kind: 'letter', body, meta: { title: $('#wr-title').value } };
  if (writeType === 'when') payload.meta = { when: writeWhen };
  else if ($('#wr-open').value) payload.open_at = new Date($('#wr-open').value).toISOString();
  try {
    upsert(await post('/api/items', payload));
    ls.del('us_draft_' + writeType);
    $('#dlg-write').close();
    S.letterTab = 'scritte'; render();
    toast('Lettera spedita ✉');
  } catch (err) { toast(err.message); }
});

/* =============================== ALBUM =============================== */

function photosSorted() {
  const t = p => new Date(p.meta.taken_at || p.created_at).getTime();
  return list('photo').sort((a, b) => t(b) - t(a) || b.id - a.id);
}

function renderAlbum() {
  const ps = photosSorted();
  $('#album-sub').textContent = ps.length ? `${plural(ps.length, 'foto', 'foto')} · le più recenti in alto` : 'Le vostre foto, in ordine di tempo.';
  if (!ps.length) {
    $('#album').innerHTML = `<div class="empty"><p class="hand">Il vostro album è vuoto</p><p class="muted small">Aggiungi la prima foto: un selfie in videochiamata vale.</p><label class="btn" for="photo-input">Aggiungi foto</label></div>`;
    return;
  }
  let html = '', month = '';
  for (const p of ps) {
    const d = new Date(p.meta.taken_at || p.created_at);
    const mk = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    if (mk !== month) { html += `${month ? '</div>' : ''}<h3 class="month">${esc(mk)}</h3><div class="grid">`; month = mk; }
    const reacts = Object.values(p.meta.reactions || {});
    html += `<button class="tile${p.author !== S.me && !p.read_at ? ' fresh' : ''}" data-photo="${p.id}" aria-label="${esc(p.body || 'Foto')}">
      <img src="/api/photos/${p.id}/thumb" alt="" loading="lazy" decoding="async">
      ${reacts.length ? `<span class="tile-r">${esc(reacts.join(''))}</span>` : ''}
    </button>`;
  }
  $('#album').innerHTML = html + '</div>';
}
$('#album').addEventListener('click', e => { const t = e.target.closest('[data-photo]'); if (t) openPhoto(Number(t.dataset.photo)); });

// Caricamento: le foto vengono rimpicciolite nel browser prima di partire.
let pending = [];
async function shrink(file, max, q) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { bmp = await new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = URL.createObjectURL(file); }); }
  const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return { url: c.toDataURL('image/jpeg', q), w: c.width, h: c.height };
}
$('#photo-input').addEventListener('change', async e => {
  const files = [...e.target.files].slice(0, 30);
  e.target.value = '';
  if (!files.length) return;
  pending = [];
  $('#up-list').innerHTML = '<p class="muted small">Preparo le foto…</p>';
  $('#up-status').textContent = '';
  $('#up-go').disabled = true;
  $('#dlg-upload').showModal();
  const bad = [];
  for (const f of files) {
    try {
      const full = await shrink(f, 1800, 0.82), thumb = await shrink(f, 520, 0.74);
      pending.push({ full, thumb, date: dayKey(new Date(f.lastModified || Date.now())) });
    } catch { bad.push(f.name); }
  }
  if (bad.length) toast(`Non riesco ad aprire: ${bad.join(', ')} (se è HEIC, prova da telefono o esportala in JPG)`);
  if (!pending.length) { $('#dlg-upload').close(); return; }
  $('#up-list').innerHTML = pending.map((p, n) => `
    <div class="up-item"><img src="${p.thumb.url}" alt="">
      <div><input data-cap="${n}" maxlength="300" placeholder="Didascalia (facoltativa)">
      <label class="small muted">Data <input type="date" data-date="${n}" value="${p.date}"></label></div></div>`).join('');
  $('#up-go').disabled = false;
});
$('#up-go').addEventListener('click', async () => {
  $('#up-go').disabled = true;
  let ok = 0;
  for (let n = 0; n < pending.length; n++) {
    $('#up-status').textContent = `Carico ${n + 1} di ${pending.length}…`;
    const p = pending[n];
    try {
      upsert(await post('/api/photos', {
        full: p.full.url, thumb: p.thumb.url, w: p.full.w, h: p.full.h,
        caption: $(`[data-cap="${n}"]`).value, taken_at: $(`[data-date="${n}"]`).value ? $(`[data-date="${n}"]`).value + 'T12:00:00' : null,
      }));
      ok++;
    } catch (err) { toast(err.message); }
  }
  pending = [];
  $('#dlg-upload').close();
  render();
  if (ok) toast(ok === 1 ? 'Foto aggiunta ♡' : `${ok} foto aggiunte ♡`);
});

// Visore
let lbList = [], lbIdx = 0;
function openPhoto(id) {
  lbList = photosSorted();
  lbIdx = Math.max(0, lbList.findIndex(p => p.id === id));
  showPhoto();
  if (!$('#dlg-photo').open) $('#dlg-photo').showModal();
}
function showPhoto() {
  const p = lbList[lbIdx]; if (!p) return;
  const img = $('#lb-img');
  img.src = `/api/photos/${p.id}/thumb`;
  const full = new Image(); full.onload = () => { if (lbList[lbIdx] === p) img.src = full.src; }; full.src = `/api/photos/${p.id}/full`;
  $('#lb-cap').textContent = p.body || '';
  $('#lb-meta').textContent = `${p.author === S.me ? 'Aggiunta da te' : 'Aggiunta da ' + nameOf(p.author)} · ${fmtDate(p.meta.taken_at || p.created_at)}`;
  $('#lb-dl').href = `/api/photos/${p.id}/full?download=1`;
  $('#lb-del').hidden = $('#lb-edit').hidden = p.author !== S.me;
  reactRow(p, $('#lb-react'));
  $('#lb-prev').hidden = lbIdx === 0;
  $('#lb-next').hidden = lbIdx === lbList.length - 1;
}
const lbMove = d => { const n = lbIdx + d; if (n >= 0 && n < lbList.length) { lbIdx = n; showPhoto(); } };
$('#lb-prev').addEventListener('click', () => lbMove(-1));
$('#lb-next').addEventListener('click', () => lbMove(1));
$('#dlg-photo').addEventListener('keydown', e => { if (e.key === 'ArrowLeft') lbMove(-1); if (e.key === 'ArrowRight') lbMove(1); });
let swX = null;
$('#lb-img').addEventListener('pointerdown', e => { swX = e.clientX; });
$('#lb-img').addEventListener('pointerup', e => { if (swX !== null && Math.abs(e.clientX - swX) > 50) lbMove(e.clientX < swX ? 1 : -1); swX = null; });
$('#lb-del').addEventListener('click', async () => {
  const p = lbList[lbIdx];
  if (!confirm('Eliminare questa foto per sempre?')) return;
  try { await del(p.id); S.items.delete(p.id); $('#dlg-photo').close(); render(); } catch (err) { toast(err.message); }
});
$('#lb-edit').addEventListener('click', async () => {
  const p = lbList[lbIdx];
  const t = prompt('Didascalia', p.body || '');
  if (t === null) return;
  try { const it = await patch(p.id, { action: 'edit', body: t }); upsert(it); lbList[lbIdx] = it; showPhoto(); render(); } catch (err) { toast(err.message); }
});

/* =============================== CALMA =============================== */

function renderCalm() {
  const p = P();
  const own = theirs('comfort');
  if (!$('#jar-slip').dataset.init) {
    $('#jar-slip').innerHTML = own.length
      ? `<p class="muted">${esc(p)} ti ha lasciato ${plural(own.length, 'frase', 'frasi')} qui dentro.</p>`
      : `<p class="muted">Per ora ci sono solo frasi di scorta. Le più belle te le scriverà ${esc(p)}.</p>`;
  }
  $('#sos-sub').textContent = `${p} riceve un avviso subito e lo vede appena apre Us. Non serve spiegare tutto.`;
  const mySos = mine('sos').pop();
  const st = $('#sos-status');
  if (mySos && Date.now() - new Date(mySos.created_at) < 24 * 3600e3) {
    st.innerHTML = mySos.meta.ack
      ? `<b>${esc(p)} ha risposto: è qui per te ♡</b> <a href="#chat">Apri la chat →</a>`
      : `Avviso inviato ${ago(mySos.created_at)}. ${esc(p)} ${g('la', 'lo')} vedrà appena apre Us.`;
  } else st.textContent = '';

  $('#ground').innerHTML = GROUNDING.map(t => `<li>${esc(t)}</li>`).join('');
  const whenL = theirs('letter').filter(l => ['geloso', 'paura', 'triste', 'dormire', 'litigato'].includes(l.meta.when));
  $('#when-links').innerHTML = whenL.length ? `<p class="eyebrow">Lettere di ${esc(p)} per questi momenti</p>` + whenL.map(l => `<button class="btn ghost sm" data-letter-open="${l.id}">${whenOf(l.meta.when).e} Apri quando ${esc(whenOf(l.meta.when).l)}</button>`).join('') : '';

  const myC = mine('comfort').reverse();
  $('#mine-sub').textContent = myC.length
    ? `${p} ha ${myC.length === 1 ? 'una tua frase' : myC.length + ' tue frasi'} da pescare quando la testa corre.`
    : `Scrivi qualcosa che ${p} potrà pescare nei momenti difficili. Vale più di qualsiasi frase fatta.`;
  $('#comfort-ideas').innerHTML = 'Idee: ' + COMFORT_IDEAS.map(t => `<span>${esc(t.replace('lei/lui', p).replace('Ricordale/ricordagli', 'Ricorda' + g('le', 'gli')))}</span>`).join('');
  $('#mine-list').innerHTML = myC.map(c => `<li><span>“${esc(c.body)}”</span><button class="icon-btn sm" data-del-comfort="${c.id}" aria-label="Elimina">${icon('trash')}</button></li>`).join('');
}

$('#jar-draw').addEventListener('click', () => {
  const own = theirs('comfort');
  const pool = own.length ? own.map(c => ({ t: c.body, by: P() })) : SPARE_COMFORT.map(t => ({ t, by: null }));
  let k = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && k === S.lastJar) k = (k + 1) % pool.length;
  S.lastJar = k;
  const slip = $('#jar-slip');
  slip.dataset.init = '1';
  slip.classList.remove('drawn'); void slip.offsetWidth; slip.classList.add('drawn');
  slip.innerHTML = `<p class="slip-t">“${esc(pool[k].t)}”</p><p class="slip-by">${pool[k].by ? '— ' + esc(pool[k].by) : 'frase di scorta'}</p>`;
});

let breathing = null;
$('#breathe-btn').addEventListener('click', () => {
  const box = $('#breathe'), t = $('#breathe-t'), btn = $('#breathe-btn');
  if (breathing) { clearTimeout(breathing); breathing = null; box.className = 'breathe'; t.textContent = 'Pronto/a?'; btn.textContent = 'Inizia · 1 minuto'; return; }
  btn.textContent = 'Ferma';
  const steps = [['in', 'Inspira…', 4000], ['hold', 'Trattieni', 2000], ['out', 'Espira, piano…', 6000]];
  let n = 0;
  const run = () => {
    if (n >= 15) { box.className = 'breathe'; t.textContent = 'Brav' + (S.me === 'lui' ? 'o' : 'a') + '. Va un po’ meglio?'; btn.textContent = 'Ancora un minuto'; breathing = null; return; }
    const [cls, txt, ms] = steps[n % 3];
    box.className = 'breathe ' + cls; t.textContent = txt; n++;
    breathing = setTimeout(run, ms);
  };
  run();
});

$('#sos-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.submitter || $('.sos-btn');
  btn.disabled = true;
  try {
    upsert(await post('/api/items', { kind: 'sos', body: $('#sos-note').value }));
    $('#sos-note').value = '';
    render();
    toast(`${P()} è stat${g('a', 'o')} avvisat${g('a', 'o')} ♡`);
  } catch (err) { toast(err.message); }
  btn.disabled = false;
});

$('#comfort-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = $('#comfort-input').value.trim();
  if (!body) return;
  try { upsert(await post('/api/items', { kind: 'comfort', body })); $('#comfort-input').value = ''; render(); toast('Nel barattolo ♡'); }
  catch (err) { toast(err.message); }
});
document.addEventListener('click', async e => {
  const d = e.target.closest('[data-del-comfort]');
  if (d) { try { await del(Number(d.dataset.delComfort)); S.items.delete(Number(d.dataset.delComfort)); render(); } catch (err) { toast(err.message); } }
  const lo = e.target.closest('[data-letter-open]');
  if (lo) openLetter(Number(lo.dataset.letterOpen));
});

/* ============================== INSIEME ============================== */

function renderLists() {
  const todos = list('todo');
  $('#list-tabs').innerHTML = LISTS.map(l => {
    const n = todos.filter(t => t.meta.list === l.id && !t.meta.done).length;
    return `<button data-list="${l.id}" class="${S.listTab === l.id ? 'on' : ''}">${esc(l.l)}${n ? ` <small>${n}</small>` : ''}</button>`;
  }).join('');
  const L = LISTS.find(l => l.id === S.listTab);
  $('#todo-input').placeholder = L.hint;
  const items = todos.filter(t => t.meta.list === S.listTab);
  const open = items.filter(t => !t.meta.done), done = items.filter(t => t.meta.done).reverse();
  const row = t => `<li class="todo${t.meta.done ? ' done' : ''}">
    <button class="check" data-toggle="${t.id}" aria-label="Fatto">${t.meta.done ? icon('check') : ''}</button>
    <div class="todo-t"><span>${esc(t.body)}</span><small>${t.meta.done ? `fatto ${ago(t.meta.done_at)} · ${t.meta.done_by === S.me ? 'segnato da te' : 'segnato da ' + esc(nameOf(t.meta.done_by))}` : `aggiunto da ${t.author === S.me ? 'te' : esc(nameOf(t.author))}`}</small></div>
    <button class="icon-btn sm" data-del-todo="${t.id}" aria-label="Elimina">${icon('trash')}</button></li>`;
  $('#todos').innerHTML = (open.length ? open.map(row).join('') : `<li class="empty-li muted">Niente qui per ora. Aggiungi la prima cosa.</li>`)
    + (done.length ? `<li class="done-h">Fatte insieme · ${done.length}</li>` + done.map(row).join('') : '');
}
$('#list-tabs').addEventListener('click', e => { const b = e.target.closest('[data-list]'); if (b) { S.listTab = b.dataset.list; renderLists(); } });
$('#todo-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = $('#todo-input').value.trim(); if (!body) return;
  try { upsert(await post('/api/items', { kind: 'todo', body, meta: { list: S.listTab } })); $('#todo-input').value = ''; render(); }
  catch (err) { toast(err.message); }
});
$('#todos').addEventListener('click', async e => {
  const t = e.target.closest('[data-toggle]');
  if (t) { try { upsert(await patch(Number(t.dataset.toggle), { action: 'toggle' })); render(); } catch (err) { toast(err.message); } }
  const d = e.target.closest('[data-del-todo]');
  if (d) { try { await del(Number(d.dataset.delTodo)); S.items.delete(Number(d.dataset.delTodo)); render(); } catch (err) { toast(err.message); } }
});

/* ============================== DOMANDE ============================== */

function answerBlock(key, compact = false) {
  const qi = questionIdx(key);
  const myA = mine('answer').find(a => a.meta.day === key);
  const thA = theirs('answer').find(a => a.meta.day === key);
  const p = esc(P());
  let html = `<p class="eyebrow">${key === dayKey() ? 'Oggi' : esc(fmtDate(key + 'T12:00'))}</p><p class="q-big">${esc(QUESTIONS[qi])}</p>`;
  if (!myA) {
    html += `<form class="answer-form" data-day="${key}">
      <textarea maxlength="1500" rows="${compact ? 2 : 4}" placeholder="La tua risposta…" required></textarea>
      <div class="row"><button class="btn">Rispondi</button><span class="muted small">${thA ? `${p} ha già risposto: la leggi appena scrivi la tua.` : `${p} non ha ancora risposto.`}</span></div></form>`;
  } else {
    html += `<div class="answers">
      <div class="ans mine"><span class="who-tag">Tu</span><p>${esc(myA.body)}</p><button class="linkish small" data-edit-answer="${key}">modifica</button></div>
      <div class="ans"><span class="who-tag">${p}</span>${thA ? `<p>${esc(thA.body)}</p>` : `<p class="muted">Non ha ancora risposto. Glielo ricordi?</p>`}</div>
    </div>`;
  }
  return html;
}

function renderQuestions() {
  const key = dayKey();
  if (!$('#q-today form textarea')?.value) $('#q-today').innerHTML = answerBlock(key);
  const days = [...new Set(list('answer').map(a => a.meta.day))].filter(d => d !== key).sort().reverse();
  if ([...$$('#q-archive textarea')].some(t => t.value || t === document.activeElement)) return;
  $('#q-archive').innerHTML = days.length
    ? days.map(d => `<div class="card q-old">${answerBlock(d, true)}</div>`).join('')
    : `<p class="muted small">Qui finiranno le domande dei giorni passati, con le vostre risposte.</p>`;
}
document.addEventListener('submit', async e => {
  const f = e.target.closest('.answer-form'); if (!f) return;
  e.preventDefault();
  const body = f.querySelector('textarea').value.trim(); if (!body) return;
  const day = f.dataset.day;
  try {
    upsert(await post('/api/items', { kind: 'answer', body, meta: { day, q: questionIdx(day) } }));
    f.querySelector('textarea').value = '';
    await sync();
    render();
  } catch (err) { toast(err.message); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-edit-answer]'); if (!b) return;
  const key = b.dataset.editAnswer;
  const a = mine('answer').find(x => x.meta.day === key);
  const box = b.closest('.card');
  box.innerHTML = `<p class="q-big">${esc(QUESTIONS[questionIdx(key)])}</p><form class="answer-form" data-day="${key}"><textarea maxlength="1500" rows="4" required>${esc(a.body)}</textarea><div class="row"><button class="btn">Salva</button></div></form>`;
  box.querySelector('textarea').focus();
});

/* =========================== IMPOSTAZIONI =========================== */

function fillSettings() {
  const f = $('#settings');
  for (const k of ['name_lui', 'name_lei', 'together_since', 'next_meeting']) f[k].value = S.settings[k] || '';
  syncNotifBtn();
  applyTheme();
}
$('#settings').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    for (const key of ['name_lui', 'name_lei', 'together_since', 'next_meeting']) {
      const value = f[key].value.trim();
      if ((S.settings[key] || '') !== value) { await api('/api/settings', { method: 'PUT', body: { key, value } }); S.settings[key] = value; }
    }
    render();
    $('#settings-ok').textContent = 'Salvato ♡';
    setTimeout(() => ($('#settings-ok').textContent = ''), 2500);
  } catch (err) { $('#settings-ok').textContent = err.message; }
});
$('#theme-seg').addEventListener('click', e => { const b = e.target.closest('[data-theme-set]'); if (b) { ls.set('us_theme', b.dataset.themeSet); applyTheme(); } });

const notifBtn = $('#notif');
function syncNotifBtn() {
  if (!('Notification' in window)) { notifBtn.disabled = true; notifBtn.textContent = 'Non disponibili su questo browser'; return; }
  if (Notification.permission === 'granted') { notifBtn.disabled = true; notifBtn.textContent = 'Notifiche attive ✓'; }
  if (Notification.permission === 'denied') { notifBtn.disabled = true; notifBtn.textContent = 'Bloccate dal browser'; }
}
notifBtn.addEventListener('click', async () => { await Notification.requestPermission(); syncNotifBtn(); });

/* ============================== dialoghi ============================== */

$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

setInterval(() => { if (S.me && !document.hidden && ['casa', 'chat'].includes(S.view)) render(); }, 30000);

boot();
