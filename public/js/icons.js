// Icone a tratto, disegnate a mano (24x24).
const P = {
  home: '<path d="M12 20s-7-4.4-7-9.6C5 7.9 6.9 6 9.2 6c1.2 0 2.2.6 2.8 1.6.6-1 1.6-1.6 2.8-1.6C17.1 6 19 7.9 19 10.4 19 15.6 12 20 12 20z"/>',
  chat: '<path d="M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5z"/>',
  letter: '<path d="M3.5 6.5h17v11h-17z"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
  photo: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="9" cy="10.5" r="1.6"/><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="m3.5 7 1.2 1.2L6.8 6M3.5 12l1.2 1.2 2.1-2.2M3.5 17l1.2 1.2 2.1-2.2"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.8" r=".4" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
  us: '<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14 15.2c.6-.4 1.3-.7 2-.7 2 0 3.6 1.3 4.2 3.5"/>',
  send: '<path d="M4 11.5 20 4l-6.5 16-2.5-6.5z"/><path d="m11 13.5 9-9.5"/>',
  pen: '<path d="M4.5 19.5 5.5 15 15.5 5a2 2 0 0 1 3 3l-10 10z"/><path d="m14 6.5 3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 19.5h14"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M6.5 7l1 12.5h9l1-12.5"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
};

export function icon(name) {
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-ic]').forEach(el => {
    if (!el.dataset.done) { el.innerHTML = icon(el.dataset.ic); el.dataset.done = '1'; }
  });
}
