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
  const render = (list, entries, emptyEl, emptyText, limit) => {
    const rows = entries.slice(0, limit);
    list.replaceChildren(...rows.map(e => {
      const li = document.createElement('li'); li.className = `log-entry${e.pinned ? ' is-pinned' : ''}`;
      const head = document.createElement('p'); head.className = 'log-entry-head';
      const name = document.createElement('strong'); name.textContent = e.name;
      const when = document.createElement('time'); when.dateTime = e.at; when.textContent = fmt(e.at);
      if (e.pinned) { const tag = document.createElement('span'); tag.className = 'log-pin'; tag.textContent = 'Pinned'; head.append(name, tag); }
      else head.append(name, when);
      const msg = document.createElement('p'); msg.className = 'log-entry-msg'; msg.textContent = e.message;
      li.append(head, msg);
      return li;
    }));
    emptyEl.textContent = emptyText; emptyEl.hidden = rows.length > 0;
  };
  const load = () => fetch('/api/log', { cache: 'no-store' }).then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => d.entries || []);

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
          body: JSON.stringify({ name, message, website: trap.value, elapsed: Date.now() - shownAt }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { msg.textContent = d.error || 'Couldn’t sign the log.'; if (d.field === 'name') nameIn.focus(); else if (d.field === 'message') msgIn.focus(); return; }
        try { localStorage.setItem('dismeigh-arcade-name', name); } catch {}
        msgIn.value = ''; updateCount();
        msg.textContent = 'Signed! Thanks for stopping by.';
        render(list, d.entries || [], empty, 'No entries yet.', 50);
        window.dismeighBuzz?.([20, 30, 40]);
      } catch { msg.textContent = 'Couldn’t reach the log. Try again.'; }
      finally { btn.disabled = false; }
    });
  }
})();
