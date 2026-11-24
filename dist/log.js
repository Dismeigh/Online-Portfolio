// Ship's Log guestbook: full page at /log/ and the latest few on the home page.
(() => {
  const fmt = iso => {
    const d = new Date(iso), s = (Date.now() - d) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  };
  // Stamps visitors can sign with (keys match functions/api/log/index.js)
  const STAMPS = { rocket: ['\u{1F680}', 'Rocket'], cowboy: ['\u{1F920}', 'Space cowboy'], wrench: ['\u{1F527}', 'Wrench'], car: ['\u{1F3CE}\uFE0F', 'Race car'], controller: ['\u{1F3AE}', 'Controller'],
    moon: ['\u{1F319}', 'Moon'], star: ['\u2B50', 'Star'], alien: ['\u{1F47E}', 'Space invader'], mic: ['\u{1F399}\uFE0F', 'Mic'], coffee: ['\u2615', 'Coffee'],
    party: ['\u{1F389}', 'Party popper'], heart: ['\u{1F498}', 'Heart'], clover: ['\u2618\uFE0F', 'Clover'], chick: ['\u{1F423}', 'Chick'], firework: ['\u{1F386}', 'Fireworks'],
    pumpkin: ['\u{1F383}', 'Pumpkin'], ghost: ['\u{1F47B}', 'Ghost'], turkey: ['\u{1F983}', 'Turkey'], snowflake: ['\u2744\uFE0F', 'Snowflake'], gift: ['\u{1F381}', 'Gift'], cake: ['\u{1F382}', 'Cake'] };
  const BASE = ['rocket', 'cowboy', 'wrench', 'car', 'controller', 'moon', 'star', 'alien', 'mic', 'coffee'];
  // Holiday stamps: only offered while that holiday look is on (see the season script at the top of each page)
  const HOLIDAY = { newyear: ['party'], valentines: ['heart'], stpatricks: ['clover'], easter: ['chick'], july4: ['firework'], spooky: ['pumpkin', 'ghost'],
    thanksgiving: ['turkey'], holiday: ['snowflake', 'gift'], birthday: ['cake'], anniversary: ['cake'] };
  window.dismeighLogStamps = STAMPS;
  const render = (list, entries, emptyEl, emptyText, limit) => {
    const rows = entries.slice(0, limit);
    list.replaceChildren(...rows.map(e => {
      const li = document.createElement('li'); li.className = `log-entry${e.pinned ? ' is-pinned' : ''}`;
      const head = document.createElement('p'); head.className = 'log-entry-head';
      const name = document.createElement('strong'); name.textContent = e.name;
      if (STAMPS[e.stamp]) { const st = document.createElement('span'); st.className = 'log-stamp'; st.textContent = STAMPS[e.stamp][0]; st.title = STAMPS[e.stamp][1]; st.setAttribute('aria-hidden', 'true'); name.prepend(st); }
      const when = document.createElement('time'); when.dateTime = e.at; when.textContent = fmt(e.at);
      if (e.pinned) { const tag = document.createElement('span'); tag.className = 'log-pin'; tag.textContent = 'Pinned'; head.append(name, tag); }
      else head.append(name, when);
      const msg = document.createElement('p'); msg.className = 'log-entry-msg'; msg.textContent = e.message;
      li.append(head, msg, reactBar(e));
      return li;
    }));
    emptyEl.textContent = emptyText; emptyEl.hidden = rows.length > 0;
  };
  // Emoji reactions: one per visitor per entry
  const EMOJI = { fire: ['\u{1F525}', 'Fire'], lol: ['\u{1F602}', 'Funny'], rocket: ['\u{1F680}', 'Rocket'], cowboy: ['\u{1F920}', 'Space cowboy'] };
  let mine = {}; try { mine = JSON.parse(localStorage.getItem('dm-log-reacted') || '{}') || {}; } catch {}
  const paint = (bar, counts, picked) => bar.querySelectorAll('button').forEach(b => {
    const k = b.dataset.kind, n = counts[k] || 0;
    b.querySelector('b').textContent = n ? n : '';
    b.setAttribute('aria-pressed', String(picked === k));
    b.setAttribute('aria-label', `${EMOJI[k][1]}${n ? `, ${n}` : ''}${picked === k ? ' (you)' : ''}`);
    b.disabled = !!picked && picked !== k;
  });
  function reactBar(e) {
    const bar = document.createElement('div'); bar.className = 'log-react'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', `React to ${e.name}'s entry`);
    bar.innerHTML = Object.entries(EMOJI).map(([k, [em]]) => `<button type="button" data-kind="${k}"><span aria-hidden="true">${em}</span><b></b></button>`).join('');
    paint(bar, e.reactions || {}, mine[e.id]);
    bar.addEventListener('click', async ev => {
      const b = ev.target.closest('button'); if (!b || mine[e.id]) return;
      const kind = b.dataset.kind; mine[e.id] = kind;
      const optimistic = { ...(e.reactions || {}), [kind]: ((e.reactions || {})[kind] || 0) + 1 }; paint(bar, optimistic, kind);
      try {
        const r = await fetch('/api/log/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, kind }) });
        const d = await r.json();
        if (r.ok) { e.reactions = d.reactions; paint(bar, d.reactions, kind); } else { delete mine[e.id]; paint(bar, e.reactions || {}, null); }
      } catch { delete mine[e.id]; paint(bar, e.reactions || {}, null); }
      try { localStorage.setItem('dm-log-reacted', JSON.stringify(mine)); } catch {}
    });
    return bar;
  }
  const load = () => fetch('/api/log', { cache: 'no-store' }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => { if (d.birthday) document.dispatchEvent(new Event('dismeigh:birthday')); return d.entries || []; });

  // Home page: newest three
  const mini = document.getElementById('log-mini');
  if (mini) {
    const empty = document.getElementById('log-mini-empty');
    load().then(e => render(mini, e, empty, 'No entries yet. Be the first to sign the log!', 3))
      .catch(() => { empty.textContent = 'The log is taking a break. Try again later.'; });
  }

  // Full page
  const list = document.getElementById('log-list');
  const form = document.getElementById('log-form');
  if (list && form) {
    const empty = document.getElementById('log-empty');
    const nameIn = document.getElementById('log-name'), msgIn = document.getElementById('log-message'), trap = document.getElementById('log-website');
    const msg = document.getElementById('log-msg'), btn = document.getElementById('log-submit'), count = document.getElementById('log-count');
    const shownAt = Date.now();
    const picker = document.getElementById('log-stamps');
    let stamp = ''; try { stamp = localStorage.getItem('dm-log-stamp') || ''; } catch {}
    if (picker) {
      const limited = HOLIDAY[document.documentElement.dataset.season] || [];
      if (!BASE.includes(stamp) && !limited.includes(stamp)) stamp = '';
      picker.replaceChildren(...['', ...limited, ...BASE].map(k => {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.stamp = k; b.className = `log-stamp-pick${limited.includes(k) ? ' is-limited' : ''}`;
        b.textContent = k ? STAMPS[k][0] : 'None'; b.setAttribute('aria-label', k ? `${STAMPS[k][1]}${limited.includes(k) ? ' (holiday stamp, limited time)' : ''}` : 'No stamp'); b.setAttribute('aria-pressed', String(k === stamp));
        if (limited.includes(k)) b.title = 'Holiday stamp: only here for a limited time';
        return b;
      }));
      if (limited.length) { const note = document.createElement('p'); note.className = 'log-stamp-note'; note.textContent = 'Holiday stamps (outlined in red) are only here for a limited time. They stay on your entry after.'; picker.after(note); }
      picker.addEventListener('click', e => { const b = e.target.closest('[data-stamp]'); if (!b) return; stamp = b.dataset.stamp; picker.querySelectorAll('[data-stamp]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    }
    try { nameIn.value = localStorage.getItem('dismeigh-arcade-name') || ''; } catch {}
    const updateCount = () => { count.textContent = `${[...msgIn.value].length} / 140`; };
    msgIn.addEventListener('input', updateCount); updateCount();
    load().then(e => render(list, e, empty, 'No entries yet. Be the first to sign the log!', 50))
      .catch(() => { empty.textContent = 'The log is taking a break. Try again later.'; });
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const name = nameIn.value.replace(/\s+/g, ' ').trim(), message = msgIn.value.replace(/\s+/g, ' ').trim();
      if (!name) { msg.textContent = 'Type a name first.'; nameIn.focus(); return; }
      if (message.length < 2) { msg.textContent = 'Write a message first.'; msgIn.focus(); return; }
      btn.disabled = true; msg.textContent = 'Signing…';
      try {
        const r = await fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, message, stamp, website: trap.value, elapsed: Date.now() - shownAt }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { msg.textContent = d.error || 'Couldn’t sign the log.'; if (d.field === 'name') nameIn.focus(); else if (d.field === 'message') msgIn.focus(); return; }
        try { localStorage.setItem('dismeigh-arcade-name', name); localStorage.setItem('dm-log-stamp', stamp); } catch {}
        msgIn.value = ''; updateCount();
        msg.textContent = 'Signed! Thanks for stopping by.';
        render(list, d.entries || [], empty, 'No entries yet.', 50);
        window.dismeighBuzz?.([20, 30, 40]);
      } catch { msg.textContent = 'Couldn’t reach the log. Try again.'; }
      finally { btn.disabled = false; }
    });
  }
})();
