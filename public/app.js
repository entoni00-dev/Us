// Noi Due — frontend (vanilla JS, nessuna build)
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const POLL_MS = 8000;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  let me = store.get('nd_who');
  let code = store.get('nd_code') || '';
  let state = { items: [], settings: {} };
  let seen = new Set();        // id già visti (per avvisi "nuovo")
  let firstLoad = true;
  let tab = 'home';
  let pollTimer = null;
  let needsCode = false;

  const other = w => (w === 'lui' ? 'lei' : 'lui');
  const nameOf = w => (state.settings['name_' + w] || w.toUpperCase());
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------ API ------------------------------ */
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'x-who': me || '', 'x-code': code, ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'Errore di rete'); e.status = res.status; throw e; }
    return data;
  }

  /* ------------------------------ tempo ------------------------------ */
  const fmtTime = d => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = d => {
    const x = new Date(d), t = new Date();
    const y = new Date(); y.setDate(t.getDate() - 1);
    if (x.toDateString() === t.toDateString()) return 'Oggi';
    if (x.toDateString() === y.toDateString()) return 'Ieri';
    return x.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const fmtDate = d => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  function ago(d) {
    const s = Math.max(0, (Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'proprio adesso';
    if (s < 3600) return `${Math.floor(s / 60)} min fa`;
    if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
    const g = Math.floor(s / 86400);
    return g === 1 ? 'ieri' : `${g} giorni fa`;
  }
  const isToday = d => new Date(d).toDateString() === new Date().toDateString();

  /* ------------------------------ accesso ------------------------------ */
  async function boot() {
    try { needsCode = (await api('/api/config')).needsCode; } catch { needsCode = false; }
    $('#code-wrap').hidden = !needsCode;
    if (me) {
      try { await api('/api/login', { method: 'POST' }); return enter(); }
      catch { /* codice cambiato o profilo non valido */ }
    }
    showLogin();
  }

  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    if (needsCode) $('#code').value = code;
  }

  $$('.who').forEach(b => b.addEventListener('click', async () => {
    me = b.dataset.who;
    code = needsCode ? $('#code').value.trim() : '';
    $('#login-err').textContent = '';
    try {
      await api('/api/login', { method: 'POST' });
      store.set('nd_who', me); store.set('nd_code', code);
      enter();
    } catch (e) {
      $('#login-err').textContent = e.message;
      me = null;
    }
  }));

  function enter() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#me-chip').textContent = me.toUpperCase();
    firstLoad = true; seen = new Set();
    go(location.hash.slice(1) || 'home');
    refresh();
    clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
  }

  $('#logout').addEventListener('click', () => {
    store.del('nd_who'); me = null; clearInterval(pollTimer); showLogin();
  });

  /* ------------------------------ navigazione ------------------------------ */
  function go(t) {
    if (!['home', 'chat', 'letters', 'us'].includes(t)) t = 'home';
    tab = t;
    $$('.screen[data-tab]').forEach(s => (s.hidden = s.dataset.tab !== t));
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === t));
    history.replaceState(null, '', '#' + t);
    render();
    if (t === 'chat') { markChatRead(); scrollChat(); }
    if (t === 'us') fillSettings();
  }
  $$('.tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

  /* ------------------------------ sync ------------------------------ */
  async function refresh() {
    try {
      const data = await api('/api/state');
      const fresh = data.items.filter(i => !seen.has(i.id) && i.author !== me);
      state = data;
      data.items.forEach(i => seen.add(i.id));
      if (!firstLoad && fresh.length) announce(fresh);
      firstLoad = false;
      render();
      if (tab === 'chat') markChatRead();
    } catch (e) {
      if (e.status === 401) { store.del('nd_who'); showLogin(); }
    }
  }

  function announce(fresh) {
    const who = nameOf(other(me));
    const last = fresh[fresh.length - 1];
    const text = last.kind === 'ping' ? `${who} ti sta pensando ♡`
      : last.kind === 'msg' ? `${who}: ${last.body.slice(0, 60)}`
      : `${who} ti ha scritto una lettera ✉`;
    toast(text);
    if (navigator.vibrate) navigator.vibrate(last.kind === 'ping' ? [60, 80, 60] : 40);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Noi Due', { body: text, icon: '/icon-192.png', tag: 'noi-due' }); } catch {}
    }
    if (last.kind === 'ping') floatHearts(5);
  }

  function toast(t) {
    const el = $('#toast');
    el.textContent = t; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /* ------------------------------ render ------------------------------ */
  function render() {
    if (!me) return;
    renderHome(); renderChat(); renderLetters(); renderBadges();
    const unread = unreadCount();
    document.title = unread ? `(${unread}) Noi Due` : 'Noi Due';
  }

  const theirs = kind => state.items.filter(i => i.kind === kind && i.author !== me);
  const unreadCount = () => state.items.filter(i => i.author !== me && !i.read_at && !i.sealed).length;

  function renderBadges() {
    const chat = state.items.filter(i => i.author !== me && !i.read_at && (i.kind === 'msg' || i.kind === 'ping')).length;
    const letters = theirs('letter').filter(i => !i.read_at && !i.sealed).length;
    setBadge('chat', tab === 'chat' ? 0 : chat);
    setBadge('letters', letters);
  }
  function setBadge(k, n) {
    const b = $(`[data-badge="${k}"]`);
    b.textContent = n > 9 ? '9+' : n; b.classList.toggle('show', n > 0);
  }

  function renderHome() {
    const h = new Date().getHours();
    const saluto = h < 6 ? 'Notte fonda' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
    $('#hello').innerHTML = `${saluto}, <em>${esc(nameOf(me))}</em>`;

    const pings = state.items.filter(i => i.kind === 'ping');
    $('#today-me').textContent = pings.filter(p => p.author === me && isToday(p.created_at)).length;
    $('#today-them').textContent = pings.filter(p => p.author !== me && isToday(p.created_at)).length;
    $('#today-them-cap').textContent = `i pensieri di ${nameOf(other(me))} oggi`;

    const lastTheirs = [...pings].reverse().find(p => p.author !== me);
    $('#last-ping').innerHTML = lastTheirs
      ? `<b>${esc(nameOf(other(me)))}</b> ti ha pensato ${ago(lastTheirs.created_at)}`
      : '';

    renderCountdown();

    const since = state.settings.together_since;
    $('#together-card').hidden = !since;
    if (since) {
      const days = Math.floor((Date.now() - new Date(since + 'T00:00')) / 86400000);
      $('#together').textContent = days >= 0 ? `${days.toLocaleString('it-IT')} giorni` : '…quasi!';
    }
  }

  function renderCountdown() {
    const el = $('#countdown');
    const nm = state.settings.next_meeting;
    if (!nm) {
      el.innerHTML = `<span class="set">Quando vi rivedete? <button class="linkish" data-goto="us">Impostalo</button></span>`;
      return;
    }
    const diff = new Date(nm) - Date.now();
    if (diff <= 0) {
      el.innerHTML = `<span class="big-serif">Oggi vi vedete! ♡</span>`;
      return;
    }
    const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24,
      m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;
    const u = (n, l) => `<span class="u"><span class="n">${n}</span><span class="l">${l}</span></span>`;
    el.innerHTML = u(d, d === 1 ? 'giorno' : 'giorni') + u(h, 'ore') + u(m, 'min') + u(String(s).padStart(2, '0'), 'sec');
  }
  setInterval(() => { if (me && tab === 'home' && !document.hidden) renderCountdown(); }, 1000);
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) go(g.dataset.goto); });

  function renderChat() {
    const box = $('#chat');
    const items = state.items.filter(i => i.kind === 'msg' || i.kind === 'ping');
    if (!items.length) { box.innerHTML = `<p class="empty">Il primo messaggino è il più bello</p>`; return; }
    const atBottom = box.parentElement && (window.innerHeight + window.scrollY >= document.body.scrollHeight - 120);
    let html = '', lastDay = '';
    for (const i of items) {
      const day = new Date(i.created_at).toDateString();
      if (day !== lastDay) { html += `<p class="day-sep">${esc(fmtDay(i.created_at))}</p>`; lastDay = day; }
      if (i.kind === 'ping') {
        const who = i.author === me ? 'Hai pensato a ' + esc(nameOf(other(me))) : esc(nameOf(i.author)) + ' ti ha pensato';
        html += `<p class="ping-line"><span class="h">♡</span> ${who} · ${fmtTime(i.created_at)}</p>`;
      } else {
        const mine = i.author === me;
        const tick = mine ? (i.read_at ? ' · letto' : '') : '';
        html += `<div class="bubble${mine ? ' mine' : ''}">${esc(i.body)}<span class="t">${fmtTime(i.created_at)}${tick}</span></div>`;
      }
    }
    const changed = box.dataset.sig !== String(items.length) + (items.at(-1)?.read_at || '');
    box.innerHTML = html;
    box.dataset.sig = String(items.length) + (items.at(-1)?.read_at || '');
    if (tab === 'chat' && changed && atBottom) scrollChat();
  }
  const scrollChat = () => requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));

  async function markChatRead() {
    const ids = state.items.filter(i => i.author !== me && !i.read_at && (i.kind === 'msg' || i.kind === 'ping')).map(i => i.id);
    if (!ids.length) return;
    ids.forEach(id => { const it = state.items.find(x => x.id === id); if (it) it.read_at = new Date().toISOString(); });
    renderBadges();
    try { await api('/api/read', { method: 'POST', body: { ids } }); } catch {}
  }

  function renderLetters() {
    const box = $('#letters');
    const letters = state.items.filter(i => i.kind === 'letter').reverse();
    if (!letters.length) { box.innerHTML = `<p class="empty">Ancora nessuna lettera.<br>Scrivi la prima ✉</p>`; return; }
    box.innerHTML = letters.map(l => {
      const mine = l.author === me;
      const from = mine ? `Per ${esc(nameOf(other(me)))}` : `Da ${esc(nameOf(l.author))}`;
      const initial = esc(nameOf(l.author).charAt(0).toUpperCase());
      if (l.sealed) {
        return `<div class="env sealed"><span class="seal">🔒</span>
          <div class="from">${from}</div>
          <div class="meta">Spedita il ${fmtDate(l.created_at)}</div>
          <div class="peek">Sigillata fino al ${fmtDate(l.open_at)} · ${countdownShort(l.open_at)}</div></div>`;
      }
      const isNew = !mine && !l.read_at;
      const futureNote = mine && l.open_at && new Date(l.open_at) > Date.now() ? ` · si apre il ${fmtDate(l.open_at)}` : '';
      const readNote = mine ? (l.read_at ? ' · letta' : ' · non ancora letta') : '';
      return `<button class="env${!mine && l.read_at ? ' read' : ''}" data-letter="${l.id}">
        <span class="seal">${initial}</span>
        ${isNew ? '<span class="new">NUOVA</span>' : ''}
        <div class="from">${from}</div>
        <div class="meta">${fmtDate(l.created_at)}${futureNote}${readNote}</div>
        <div class="peek">${esc(l.body.split('\n')[0].slice(0, 80))}</div></button>`;
    }).join('');
  }
  function countdownShort(d) {
    const diff = new Date(d) - Date.now();
    const g = Math.ceil(diff / 86400000);
    return g > 1 ? `tra ${g} giorni` : diff > 3600000 ? `tra ${Math.ceil(diff / 3600000)} ore` : 'tra poco';
  }

  /* ------------------------------ azioni ------------------------------ */
  $('#ping').addEventListener('click', async () => {
    const btn = $('#ping');
    btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
    floatHearts(3);
    if (navigator.vibrate) navigator.vibrate(25);
    try {
      const item = await api('/api/items', { method: 'POST', body: { kind: 'ping' } });
      state.items.push(item); seen.add(item.id); render();
      toast(`${nameOf(other(me))} lo saprà ♡`);
    } catch (e) { toast(e.message); }
  });

  function floatHearts(n) {
    const btn = $('#ping');
    if (!btn || tab !== 'home') return;
    for (let k = 0; k < n; k++) {
      const s = document.createElement('span');
      s.className = 'float'; s.textContent = '♥';
      s.style.setProperty('--dx', `${(Math.random() - .5) * 120}px`);
      s.style.animationDelay = `${k * 90}ms`;
      btn.appendChild(s);
      setTimeout(() => s.remove(), 1400 + k * 90);
    }
  }

  const chatInput = $('#chat-input');
  chatInput.addEventListener('input', () => { chatInput.style.height = 'auto'; chatInput.style.height = chatInput.scrollHeight + 'px'; });
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); $('#chat-form').requestSubmit(); }
  });
  $('#chat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = chatInput.value.trim();
    if (!body) return;
    chatInput.value = ''; chatInput.style.height = 'auto';
    try {
      const item = await api('/api/items', { method: 'POST', body: { kind: 'msg', body } });
      state.items.push(item); seen.add(item.id); render(); scrollChat();
    } catch (err) { chatInput.value = body; toast(err.message); }
  });

  // Lettere
  const lw = $('#letter-write'), lv = $('#letter-view');
  $('#new-letter').addEventListener('click', () => {
    $('#lw-body').value = store.get('nd_draft') || '';
    $('#lw-body').placeholder = `Car${me === 'lui' ? 'a' : 'o'} ${nameOf(other(me))},`;
    $('#lw-open').value = '';
    lw.showModal();
  });
  $('#lw-body').addEventListener('input', e => store.set('nd_draft', e.target.value));
  $('#letter-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = $('#lw-body').value.trim();
    if (!body) return;
    const openVal = $('#lw-open').value;
    try {
      const item = await api('/api/items', { method: 'POST', body: { kind: 'letter', body, open_at: openVal ? new Date(openVal).toISOString() : null } });
      state.items.push(item); seen.add(item.id);
      store.del('nd_draft'); lw.close(); render();
      toast('Lettera spedita ✉');
    } catch (err) { toast(err.message); }
  });

  $('#letters').addEventListener('click', async e => {
    const b = e.target.closest('[data-letter]');
    if (!b) return;
    const l = state.items.find(i => i.id === Number(b.dataset.letter));
    if (!l) return;
    $('#lv-meta').textContent = `${l.author === me ? 'Hai scritto' : nameOf(l.author) + ' ha scritto'} · ${fmtDate(l.created_at)}, ${fmtTime(l.created_at)}`;
    $('#lv-body').textContent = l.body;
    $('#lv-sign').textContent = nameOf(l.author);
    $('#lv-delete').hidden = l.author !== me;
    $('#lv-delete').dataset.id = l.id;
    lv.showModal();
    $('.paper').scrollTop = 0;
    if (l.author !== me && !l.read_at) {
      l.read_at = new Date().toISOString(); render();
      try { await api('/api/read', { method: 'POST', body: { ids: [l.id] } }); } catch {}
    }
  });
  $('#lv-delete').addEventListener('click', async e => {
    if (!confirm('Eliminare questa lettera per sempre?')) return;
    const id = Number(e.target.dataset.id);
    try {
      await api('/api/items/' + id, { method: 'DELETE' });
      state.items = state.items.filter(i => i.id !== id); lv.close(); render();
    } catch (err) { toast(err.message); }
  });
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  // Impostazioni
  function fillSettings() {
    const f = $('#settings');
    for (const k of ['name_lui', 'name_lei', 'together_since']) f[k].value = state.settings[k] || '';
    const nm = state.settings.next_meeting;
    if (nm) {
      const d = new Date(nm);
      const pad = n => String(n).padStart(2, '0');
      f.next_meeting.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else f.next_meeting.value = '';
  }
  $('#settings').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const vals = {
      name_lui: f.name_lui.value.trim(),
      name_lei: f.name_lei.value.trim(),
      together_since: f.together_since.value,
      next_meeting: f.next_meeting.value ? new Date(f.next_meeting.value).toISOString() : '',
    };
    try {
      for (const [key, value] of Object.entries(vals)) {
        if ((state.settings[key] || '') !== value) await api('/api/settings', { method: 'PUT', body: { key, value } });
      }
      Object.assign(state.settings, vals); render();
      $('#settings-ok').textContent = 'Salvato ♡';
      setTimeout(() => ($('#settings-ok').textContent = ''), 2500);
    } catch (err) { $('#settings-ok').textContent = err.message; }
  });

  // Notifiche (solo con il sito aperto: niente push server-side)
  const notifBtn = $('#notif');
  function syncNotifBtn() {
    if (!('Notification' in window)) { notifBtn.disabled = true; notifBtn.textContent = 'Non supportate qui'; return; }
    if (Notification.permission === 'granted') { notifBtn.disabled = true; notifBtn.textContent = 'Notifiche attive ✓'; }
  }
  notifBtn.addEventListener('click', async () => { await Notification.requestPermission(); syncNotifBtn(); });
  syncNotifBtn();

  document.addEventListener('visibilitychange', () => { if (!document.hidden && me) refresh(); });

  boot();
})();
