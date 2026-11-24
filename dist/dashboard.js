// Private dashboard (/dashboard/). Talks to /api/admin/* (see lib/admin.js and lib/kofi.js).
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = n => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
  const api = async (path, body) => {
    const r = await fetch(`/api/admin/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' } : { credentials: 'same-origin', cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  };
  const show = which => { for (const id of ['login', 'setup', 'panel']) $(id).hidden = which !== id; $('hero-bar').hidden = which !== 'panel'; };
  const money = v => Math.max(0, Number(String(v ?? '').replace(/[$,\s]/g, '')) || 0);

  // Preview follows what's typed, before saving
  function preview() {
    if (!state) return;
    const g = state.goal, p = state.progress;
    const title = $('g-title').value.trim(), blurb = $('g-blurb').value.trim();
    const target = money($('g-target').value), start = money($('g-start').value);
    const raised = Math.max(0, p.raised - (g.start || 0)) + start;
    const pct = target ? Math.min(100, Math.floor((raised / target) * 100)) : 0;
    $('pv-title').textContent = title || 'No goal yet';
    $('pv-blurb').textContent = blurb; $('pv-blurb').hidden = !blurb;
    $('pv-fill').style.width = `${pct}%`;
    $('pv-raised').textContent = usd(raised);
    $('pv-target').textContent = usd(target);
    $('pv-pct').textContent = pct;
    const dirty = title !== (g.title || '') || blurb !== (g.blurb || '') || target !== (g.target || 0) || start !== (g.start || 0)
      || $('g-memberships').checked !== (g.memberships !== false) || $('g-garage').checked !== !!g.garage;
    $('pv-dirty').hidden = !dirty;
  }
  let state = null;

  function render(s) {
    state = s;
    const g = s.goal, p = s.progress;
    const on = !!g.on;
    $('toggle').setAttribute('aria-checked', String(on));
    $('toggle').classList.toggle('is-on', on);
    $('toggle-label').textContent = on ? 'On' : 'Off';
    $('st-goal').textContent = on ? 'On' : 'Off';
    $('st-goal').closest('.dash-stat').classList.toggle('is-good', on);
    $('st-raised').textContent = g.target ? `${usd(p.raised)} of ${usd(g.target)}` : 'No goal yet';
    $('st-kofi').textContent = s.connected ? 'Connected' : 'Not connected';
    $('st-kofi').closest('.dash-stat').classList.toggle('is-good', s.connected);
    $('st-kofi').closest('.dash-stat').classList.toggle('is-warn', !s.connected);
    $('kofi-chip').className = `dash-chip ${s.connected ? 'dash-chip-ok' : 'dash-chip-warn'}`;
    $('kofi-chip-text').textContent = s.connected ? 'Connected' : 'Not connected';
    $('kofi-steps').open = !s.connected;
    $('state-note').textContent = on
      ? `Showing now in Support & Shop on the home page${g.garage ? ' and in the Garage' : ''}.`
      : 'Hidden. Turn it on to show the bar in Support & Shop on the home page.';
    $('pv-title').textContent = g.title || 'No goal yet';
    $('pv-fill').style.width = `${p.pct}%`;
    $('pv-raised').textContent = usd(p.raised);
    $('pv-target').textContent = usd(g.target);
    $('pv-pct').textContent = p.pct;
    $('pv-count').textContent = g.since ? `${p.payments} Ko-fi payment${p.payments === 1 ? '' : 's'} counted` : '';
    if (document.activeElement?.closest('#goal-form') == null) {
      $('g-title').value = g.title || '';
      $('g-blurb').value = g.blurb || '';
      $('g-target').value = g.target || '';
      $('g-start').value = g.start || '';
      $('g-memberships').checked = g.memberships !== false;
      $('g-garage').checked = !!g.garage;
    }
    preview();
    $('g-endplace').value = g.garage ? 'garage' : 'home';
    $('g-end').disabled = !g.title;
    const past = s.past || [];
    $('past-body').innerHTML = past.length ? `<ul class="dash-list">${past.map(p => `<li class="dash-row${p.funded ? ' is-pinned' : ''}">
      <div class="dash-row-main"><b>${esc(p.title)}</b> <span class="dash-meta">${esc(usd(p.raised))} of ${esc(usd(p.target))}${p.funded ? ' · Funded' : ''} · ended ${esc(new Date(p.ended).toLocaleDateString())}</span></div>
      <div class="dash-row-actions"><label class="sr-only" for="pp-${p.id}">Where it shows</label><select id="pp-${p.id}" data-past="${p.id}">
        ${[['garage', 'Garage'], ['home', 'Home page'], ['none', 'Hidden']].map(([v, l]) => `<option value="${v}"${p.place === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="dash-btn dash-small dash-danger" data-pastdel="${p.id}">Delete</button></div></li>`).join('')}</ul>` : '<p class="dash-note">None yet. When you finish a goal, use "End goal & save it".</p>';
    $('hook-url').textContent = s.webhookUrl;
    $('kofi-status').textContent = s.connected
      ? `Connected. Last payment received: ${s.lastPayment ? new Date(s.lastPayment).toLocaleString() : 'none yet'}.`
      : 'Not connected yet. Ko-fi payments won’t count until the steps below are done (the "already raised" amount still works).';
  }

  async function load() {
    const { status, data } = await api('goal');
    if (status === 401) return show('login');
    if (status !== 200) { show('login'); $('login-msg').textContent = data.error || 'The dashboard is offline.'; return; }
    const first = $('panel').hidden;
    show('panel'); render(data);
    if (first) document.dispatchEvent(new Event('dash:in'));
  }

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-msg').textContent = '';
    const { status, data } = await api('login', { password: $('pw').value, code: $('code').value });
    if (data.setup) {
      $('pw').value = '';
      $('setup-key').textContent = data.secret.replace(/(.{4})/g, '$1 ').trim();
      $('qr').innerHTML = window.dismeighQrSvg ? window.dismeighQrSvg(data.uri) : '';
      show('setup'); $('setup-code').focus();
      return;
    }
    if (data.need === 'code') {
      $('code-wrap').hidden = false;
      if (status !== 200) { $('login-msg').textContent = data.error; $('code').value = ''; }
      $('code').focus();
      return;
    }
    if (status === 200) { $('pw').value = ''; $('code').value = ''; $('code-wrap').hidden = true; return load(); }
    $('login-msg').textContent = data.error || 'Couldn\u2019t log in.';
  });
  $('setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const { status, data } = await api('twostep', { code: $('setup-code').value });
    if (status === 200) { $('setup-code').value = ''; $('qr').innerHTML = ''; $('setup-key').textContent = ''; return load(); }
    $('setup-msg').textContent = data.error || 'Couldn\u2019t turn it on.';
    if (status === 401 && /timed out/i.test(data.error || '')) setTimeout(() => show('login'), 2500);
  });
  $('logout').addEventListener('click', async () => { await api('logout', {}); $('code-wrap').hidden = true; show('login'); $('pw').focus(); });

  const save = async restart => {
    const msg = $('goal-msg'); msg.textContent = 'Saving…';
    const { status, data } = await api('goal', {
      action: 'save', restart, title: $('g-title').value, blurb: $('g-blurb').value, target: $('g-target').value, start: $('g-start').value,
      memberships: $('g-memberships').checked, garage: $('g-garage').checked,
    });
    if (status === 401) return show('login');
    msg.textContent = data.error || (restart ? 'Saved as a new goal. Counting Ko-fi payments from now.' : 'Saved.');
    if (!data.error) load();
  };
  $('goal-form').addEventListener('submit', e => { e.preventDefault(); save(false); });
  $('goal-form').addEventListener('input', preview);
  $('goal-form').addEventListener('change', preview);
  $('restart').addEventListener('click', () => {
    if (state?.goal?.since && !confirm('Start a new goal? Ko-fi payments will be counted from now, and the old count is set aside.')) return;
    save(true);
  });
  $('g-end').addEventListener('click', async () => {
    if (!confirm('End this goal? Its final total is saved to Past goals and the goal bar turns off.')) return;
    const { status, data } = await api('goal', { action: 'end', place: $('g-endplace').value });
    if (status === 401) return show('login');
    $('goal-msg').textContent = data.error || 'Goal ended and saved to Past goals.'; load();
  });
  $('past-body').addEventListener('change', async e => {
    const sel = e.target.closest('[data-past]'); if (!sel) return;
    await api('goal', { action: 'pastPlace', id: Number(sel.dataset.past), place: sel.value }); load();
  });
  $('past-body').addEventListener('click', async e => {
    const b = e.target.closest('[data-pastdel]'); if (!b || !confirm('Delete this past goal?')) return;
    await api('goal', { action: 'pastDelete', id: Number(b.dataset.pastdel) }); load();
  });
  $('toggle').addEventListener('click', async () => {
    const want = !state?.goal?.on;
    $('toggle').classList.toggle('is-on', want); $('toggle').setAttribute('aria-checked', String(want)); $('toggle-label').textContent = want ? 'On' : 'Off';
    $('toggle').disabled = true;
    const { status, data } = await api('goal', { action: 'toggle', on: want });
    $('toggle').disabled = false;
    if (status === 401) return show('login');
    $('goal-msg').textContent = data.error || (want ? 'Goal bar is on.' : 'Goal bar is off.');
    load();
  });
  $('copy-hook').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('hook-url').textContent); $('copy-hook').textContent = 'Copied'; } catch { $('copy-hook').textContent = 'Select and copy'; }
    setTimeout(() => { $('copy-hook').textContent = 'Copy'; }, 1600);
  });
  load();
})();

// Dashboard sections: tabs, stats, content editors, Ship's Log, leaderboards, banner and looks, login history, install
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (path, body) => {
    const r = await fetch(`/api/admin/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' } : { credentials: 'same-origin', cache: 'no-store' });
    if (r.status === 401) { location.reload(); throw new Error('signed out'); }
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  const when = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const flash = (el, msg) => { el.textContent = msg; clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = ''; }, 4000); };

  // ---------- Tabs ----------
  const loaders = {};
  let current = 'overview';
  function openTab(name, push = true) {
    current = name;
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== name; });
    document.querySelectorAll('.dash-tabs [data-tab]').forEach(b => { if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (push) history.replaceState(null, '', `#${name}`);
    loaders[name]?.();
  }
  document.querySelectorAll('.dash-tabs [data-tab]').forEach(b => b.addEventListener('click', () => { openTab(b.dataset.tab); $('panel').scrollIntoView({ block: 'start', behavior: 'smooth' }); }));
  document.querySelectorAll('[data-refresh]').forEach(b => b.addEventListener('click', () => loaders[b.dataset.refresh]?.()));
  document.addEventListener('dash:in', () => {
    const want = location.hash.slice(1);
    openTab(document.querySelector(`[data-panel="${want}"]`) ? want : 'overview', false);
  });

  // ---------- Overview: site stats ----------
  loaders.overview = async () => {
    const { data: s } = await api('stats');
    const max = Math.max(1, ...s.daily.map(d => d.n));
    const pageName = p => ({ '/': 'Home', other: 'Other' }[p] || p.replace(/\//g, ' ').trim().replace(/^\w/, c => c.toUpperCase()));
    $('stats-body').innerHTML = `
      <div class="dash-numbers">
        <div><b>${s.views.today}</b><span>views today</span></div>
        <div><b>${s.views.week}</b><span>views, 7 days</span></div>
        <div><b>${s.views.month}</b><span>views, 30 days</span></div>
        <div><b>${s.visitors.month}</b><span>new visitors, 30 days</span></div>
        <div><b>${s.arcade.bounty.month + s.arcade.drag.month}</b><span>arcade plays, 30 days</span></div>
        <div><b>${s.guestbook.month}</b><span>log signs, 30 days</span></div>
      </div>
      <h3 class="dash-h3">Last 14 days</h3>
      <div class="dash-chart" role="img" aria-label="Page views per day for the last 14 days: ${s.daily.map(d => d.n).join(', ')}">
        ${s.daily.map(d => `<span style="--h:${Math.round((d.n / max) * 100)}%" title="${esc(d.day)}: ${d.n}"><i></i><em>${new Date(`${d.day}T12:00:00Z`).getUTCDate()}</em></span>`).join('')}
      </div>
      <div class="dash-two-col">
        <div><h3 class="dash-h3">Top pages, 30 days</h3>${s.topPages.length ? `<ol class="dash-rank">${s.topPages.map(r => `<li><span>${esc(pageName(r.path))}</span><b>${r.n}</b></li>`).join('')}</ol>` : '<p class="dash-note">No views counted yet.</p>'}</div>
        <div><h3 class="dash-h3">Where visitors come from, 30 days</h3>${(s.sources || []).length ? `<ol class="dash-rank">${s.sources.map(r => `<li><span>${esc(r.source)}</span><b>${r.n}</b></li>`).join('')}</ol>` : '<p class="dash-note">Nothing counted yet. This started on Nov 23, 2026.</p>'}</div>
        <div><h3 class="dash-h3">Everything else</h3><ul class="dash-rank">
          <li><span>Visitors, all time</span><b>${s.visitors.total}</b></li>
          <li><span>Bounty Run plays (7 / 30 days)</span><b>${s.arcade.bounty.week} / ${s.arcade.bounty.month}</b></li>
          <li><span>Launch Control plays (7 / 30 days)</span><b>${s.arcade.drag.week} / ${s.arcade.drag.month}</b></li>
          <li><span>Ko-fi payments, 30 days</span><b>${s.kofi.month}</b></li>
        </ul></div>
      </div>
      <h3 class="dash-h3">Secrets found</h3>
      ${(s.secrets || []).length ? `<ul class="dash-rank dash-secrets">${s.secrets.map(x => `<li class="${x.id === 'license' ? 'is-license' : ''}"><span>${esc(x.name)}</span><b>${x.n}</b></li>`).join('')}</ul>` : ''}
      <p class="dash-hint">How many times each secret has been found (once per browser). Counting starts from this update.</p>
      ${s.since ? `<p class="dash-hint">Counting page views since ${esc(s.since)}.</p>` : '<p class="dash-hint">Page views start counting from now.</p>'}`;
  };

  // ---------- Content editors ----------
  const F = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
  const SCHEMA = {
    bounties: { note: 'The Bounty Board on the home page shows the first 6. Mark one claimed to stamp it.', fields: [
      F('title', 'Bounty', 'text', { max: 80, required: true }), F('details', 'Details', 'textarea', { max: 240 }), F('reward', 'Reward', 'text', { max: 120 }),
      F('status', 'Status', 'select', { options: [['open', 'Open'], ['progress', 'In progress'], ['claimed', 'Claimed']] }), F('claimedBy', 'Claimed by (if claimed)', 'text', { max: 40 }),
    ] },
    quotes: { note: 'The Quote Board on the Lore page, newest first. A random one shows in every page footer.', fields: [
      F('text', 'Quote', 'textarea', { max: 200, required: true }), F('game', 'Game', 'text', { max: 60 }), F('context', 'What was happening (optional)', 'text', { max: 160 }),
    ] },
    lore: { note: 'Channel Lore entries. Links: one per line as Label | https://link', fields: [
      F('term', 'Name of the bit', 'text', { max: 60, required: true }), F('game', 'Game (or "Off the clock")', 'text', { max: 40 }),
      F('what', 'What it is', 'textarea', { max: 400, required: true }), F('links', 'Links (Label | https://...)', 'links'),
    ] },
    verdicts: { note: 'Dismeigh’s Verdicts on the Shelf page.', fields: [
      F('game', 'Game', 'text', { max: 60, required: true }), F('score', 'Score', 'select', { options: [[5, '5 · Masterpiece'], [4, '4 · Solid'], [3, '3 · Decent'], [2, '2 · Rough ride'], [1, '1 · Uninstalled']] }),
      F('take', 'Hot take', 'text', { max: 160 }),
    ] },
    crew: { note: 'The Crew. Live status, game and profile picture come from Twitch automatically.', fields: [
      F('name', 'Name (as shown)', 'text', { max: 30, required: true }), F('twitch', 'Twitch username', 'text', { max: 25, required: true }), F('note', 'About them', 'textarea', { max: 200 }),
    ] },
    pinned: { single: true, note: 'Pins a clip at the top of Clips on the home page. Twitch, YouTube or TikTok links.', fields: [
      F('url', 'Clip link (https://...)', 'text', { max: 300 }), F('title', 'Title (optional)', 'text', { max: 100 }), F('by', 'Clipped by', 'text', { max: 40 }),
      F('reason', 'Why it’s pinned (optional, e.g. the bounty it won)', 'text', { max: 120 }), F('until', 'Unpin after', 'date'),
    ] },
  };
  const WRAP = { bounties: 'bounties', quotes: 'quotes', lore: 'entries', verdicts: 'verdicts', crew: 'crew', pinned: 'pinned' };
  let kind = 'bounties', items = [], dirty = false;
  const fieldHtml = (f, v, i) => {
    const id = `c-${i}-${f.key}`, val = f.type === 'links' ? (v || []).map(l => `${l.label} | ${l.url}`).join('\n') : (v ?? '');
    const attrs = `id="${id}" data-i="${i}" data-k="${f.key}"${f.max ? ` maxlength="${f.max}"` : ''}`;
    let input;
    if (f.type === 'textarea' || f.type === 'links') input = `<textarea ${attrs} rows="${f.type === 'links' ? 2 : 2}">${esc(val)}</textarea>`;
    else if (f.type === 'select') input = `<select ${attrs}>${f.options.map(([o, l]) => `<option value="${esc(o)}"${String(o) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else input = `<input ${attrs} type="${f.type === 'date' ? 'date' : 'text'}" value="${esc(val)}">`;
    return `<div class="dash-field"><label for="${id}">${esc(f.label)}</label>${input}</div>`;
  };
  function drawContent() {
    const s = SCHEMA[kind];
    $('content-note').textContent = s.note;
    if (s.single) {
      $('content-body').innerHTML = `<div class="dash-item">${s.fields.map(f => fieldHtml(f, items[0]?.[f.key], 0)).join('')}
        <div class="dash-item-actions"><button type="button" class="dash-btn dash-small" data-act="clearpin">Clear the pin</button></div></div>`;
      return;
    }
    $('content-body').innerHTML = `<button type="button" class="dash-btn dash-add" data-act="add">+ Add new (goes to the top)</button>
      ${items.length ? '' : '<p class="dash-note">Nothing here yet.</p>'}
      ${items.map((it, i) => `<div class="dash-item"><div class="dash-item-num">#${i + 1}</div>${s.fields.map(f => fieldHtml(f, it[f.key], i)).join('')}
        <div class="dash-item-actions">
          <button type="button" class="dash-btn dash-small" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move #${i + 1} up">Up</button>
          <button type="button" class="dash-btn dash-small" data-act="down" data-i="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move #${i + 1} down">Down</button>
          <button type="button" class="dash-btn dash-small dash-danger" data-act="remove" data-i="${i}" aria-label="Remove #${i + 1}">Remove</button>
        </div></div>`).join('')}`;
  }
  const blank = () => Object.fromEntries(SCHEMA[kind].fields.map(f => [f.key, f.type === 'links' ? [] : f.type === 'select' ? f.options[0][0] : '']));
  const onEdit = e => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    const i = Number(el.dataset.i), k = el.dataset.k, f = SCHEMA[kind].fields.find(x => x.key === k);
    if (!items[i]) items[i] = blank();
    items[i][k] = f.type === 'links'
      ? el.value.split('\n').map(line => { const [label, ...rest] = line.split('|'); const url = rest.join('|').trim() || (/^https?:/.test(label.trim()) ? label.trim() : ''); return url ? { label: /^https?:/.test(label.trim()) ? 'Watch' : label.trim(), url } : null; }).filter(Boolean)
      : f.key === 'score' ? Number(el.value) : el.value;
    dirty = true; $('content-msg').textContent = 'Unsaved changes';
  };
  $('content-body').addEventListener('input', onEdit);
  $('content-body').addEventListener('change', onEdit);
  $('content-body').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = Number(b.dataset.i), act = b.dataset.act;
    if (act === 'add') items.unshift(blank());
    if (act === 'remove' && confirm('Remove this one? It’s gone from the site once you save.')) items.splice(i, 1);
    if (act === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    if (act === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    if (act === 'clearpin') items = [];
    if (['add', 'remove', 'up', 'down', 'clearpin'].includes(act)) { dirty = true; $('content-msg').textContent = 'Unsaved changes'; drawContent(); }
    if (act === 'add') $('content-body').querySelector('[data-i="0"]')?.focus();
  });
  async function loadContent(k) {
    if (dirty && !confirm('You have unsaved changes. Leave them?')) return false;
    kind = k; dirty = false; $('content-msg').textContent = '';
    document.querySelectorAll('#content-pick [data-content]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.content === k)));
    $('content-body').innerHTML = '<p class="dash-note">Loading&hellip;</p>';
    const { data } = await api(`content?key=${k}`);
    const v = data[WRAP[k]];
    items = SCHEMA[k].single ? (v ? [v] : []) : (Array.isArray(v) ? v.map(x => ({ ...x })) : []);
    drawContent();
    return true;
  }
  document.querySelectorAll('#content-pick [data-content]').forEach(b => b.addEventListener('click', () => loadContent(b.dataset.content)));
  $('content-save').addEventListener('click', async () => {
    // Read the pinned form directly (single item)
    if (SCHEMA[kind].single) {
      const it = {}; SCHEMA[kind].fields.forEach(f => { const el = $(`c-0-${f.key}`); if (el) it[f.key] = el.value.trim(); });
      if (!items.length && !it.url) items = []; else items = it.url ? [it] : [];
    }
    const missing = SCHEMA[kind].single ? [] : items.map((it, i) => SCHEMA[kind].fields.filter(f => f.required && !String(it[f.key] ?? '').trim()).length ? i + 1 : 0).filter(Boolean);
    if (missing.length) { $('content-msg').textContent = `Fill in the required boxes on #${missing.join(', #')}, or remove ${missing.length > 1 ? 'them' : 'it'}.`; return; }
    $('content-msg').textContent = 'Saving…';
    const { status, data } = await api('content', { key: kind, data: SCHEMA[kind].single ? (items[0] || null) : items });
    if (status !== 200) { $('content-msg').textContent = data.error || 'Couldn’t save.'; return; }
    const v = data[WRAP[kind]], sent = SCHEMA[kind].single ? (items[0] ? 1 : 0) : items.length, kept = SCHEMA[kind].single ? (v ? 1 : 0) : (v || []).length;
    items = SCHEMA[kind].single ? (v ? [v] : []) : v.map(x => ({ ...x })); dirty = false; drawContent();
    flash($('content-msg'), kept < sent ? `Saved. ${sent - kept} entr${sent - kept === 1 ? 'y was' : 'ies were'} skipped (a link or Twitch name wasn’t valid).` : 'Saved. It’s live on the site now.');
  });
  loaders.content = () => { if (!$('content-body').children.length) loadContent(kind); };
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- Ship's Log ----------
  loaders.guestbook = async () => {
    const { data } = await api('log');
    const rows = data.entries || [];
    $('log-body').innerHTML = rows.length ? `<ul class="dash-list">${rows.map(r => `
      <li class="dash-row${r.hidden ? ' is-hidden' : ''}${r.pinned ? ' is-pinned' : ''}">
        <div class="dash-row-main"><b>${esc(r.name)}</b> <span class="dash-meta">${esc(when(r.at))}${r.pinned ? ' · 📌 pinned' : ''}${r.hidden ? ' · hidden' : ''}</span><p>${esc(r.message)}</p></div>
        <div class="dash-row-actions">
          <button type="button" class="dash-btn dash-small" data-log="${r.pinned ? 'unpin' : 'pin'}" data-id="${r.id}">${r.pinned ? 'Unpin' : 'Pin'}</button>
          <button type="button" class="dash-btn dash-small" data-log="${r.hidden ? 'unhide' : 'hide'}" data-id="${r.id}">${r.hidden ? 'Show' : 'Hide'}</button>
          <button type="button" class="dash-btn dash-small dash-danger" data-log="delete" data-id="${r.id}">Delete</button>
        </div></li>`).join('')}</ul>` : '<p class="dash-note">No entries yet.</p>';
  };
  $('log-body').addEventListener('click', async e => {
    const b = e.target.closest('[data-log]'); if (!b) return;
    if (b.dataset.log === 'delete' && !confirm('Delete this entry for good?')) return;
    b.disabled = true; await api('log', { id: Number(b.dataset.id), action: b.dataset.log }); loaders.guestbook();
  });

  // ---------- Leaderboards ----------
  let game = 'bounty';
  loaders.arcade = async () => {
    document.querySelectorAll('#arcade-pick [data-game]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.game === game)));
    const { data } = await api(`scores?game=${game}`);
    const fmt = v => (game === 'drag' ? `${v} ms` : Number(v).toLocaleString());
    const table = (title, rows) => `<h3 class="dash-h3">${title}</h3>${rows.length ? `<ol class="dash-list dash-scores">${rows.map((r, i) => `
      <li class="dash-row"><div class="dash-row-main"><b>${i + 1}. ${esc(r.name)}</b> <span class="dash-meta">${esc(fmt(r.score))} · ${esc(when(r.at))}</span></div>
      <div class="dash-row-actions"><button type="button" class="dash-btn dash-small dash-danger" data-score="${r.id}">Remove score</button>
      <button type="button" class="dash-btn dash-small dash-danger" data-name="${esc(r.name)}">Remove all by name</button></div></li>`).join('')}</ol>` : '<p class="dash-note">No scores yet.</p>'}`;
    $('arcade-body').innerHTML = table('This week', data.week || []) + table('All time', data.all || []);
    const drag = game === 'drag', [lo, hi] = data.limits || [0, 0];
    $('tu-label').textContent = `Arcade master target (${drag ? 'Launch Control' : 'Bounty Run'})`;
    Object.assign($('tu-target'), { value: data.master, min: lo, max: hi });
    $('tu-help').textContent = drag ? `Launch at or under this many ms to unlock Arcade master. Default ${data.masterDefault} ms.` : `Score at least this much to unlock Arcade master. Default ${data.masterDefault.toLocaleString()}.`;
    $('tu-week').textContent = data.early ? `Started early on ${when(data.weekStart)}. Resets again Monday at midnight (Eastern).` : 'Resets every Monday at midnight (Eastern). Reset early to clear it now; all-time scores stay.';
  };
  $('tune-form').addEventListener('submit', async e => {
    e.preventDefault();
    const { data } = await api('scores', { action: 'target', game, value: Number($('tu-target').value) });
    flash($('tune-msg'), data.error || 'Target saved. It applies on the next run.'); if (!data.error) loaders.arcade();
  });
  $('tu-reset').addEventListener('click', async () => {
    if (!confirm(`Start this week's ${game === 'drag' ? 'Launch Control' : 'Bounty Run'} board over? All-time scores stay.`)) return;
    const { data } = await api('scores', { action: 'resetWeek', game });
    flash($('tune-msg'), data.error || 'This week\u2019s board is fresh.'); loaders.arcade();
  });
  document.querySelectorAll('#arcade-pick [data-game]').forEach(b => b.addEventListener('click', () => { game = b.dataset.game; loaders.arcade(); }));
  $('arcade-body').addEventListener('click', async e => {
    const s = e.target.closest('[data-score]'), n = e.target.closest('[data-name]');
    if (s && confirm('Remove this score?')) { await api('scores', { action: 'delete', id: Number(s.dataset.score) }); loaders.arcade(); }
    if (n && confirm(`Remove every ${game === 'drag' ? 'Launch Control' : 'Bounty Run'} score by "${n.dataset.name}"?`)) { await api('scores', { action: 'deleteName', game, name: n.dataset.name }); loaders.arcade(); }
  });

  // ---------- Banner and looks ----------
  const toLocal = ms => { if (!ms) return ''; const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const fromLocal = v => (v ? new Date(v).getTime() : null);
  const NAMES = { newyear: 'New Year', mlk: 'MLK Day', valentines: 'Valentine’s', presidents: 'Presidents’ Day', stpatricks: 'St. Patrick’s', easter: 'Easter', mothers: 'Mother’s Day', memorial: 'Memorial Day', fathers: 'Father’s Day', juneteenth: 'Juneteenth', july4: 'Fourth of July', labor: 'Labor Day', spooky: 'Spooky (October)', veterans: 'Veterans Day', thanksgiving: 'Thanksgiving', holiday: 'Holidays (December)', birthday: 'Your birthday', anniversary: 'Twitch anniversary' };
  loaders.site = async () => {
    const { data } = await api('site');
    const b = data.banner;
    $('b-text').value = b?.text || ''; $('b-link').value = b?.link || ''; $('b-until').value = toLocal(b?.until);
    $('banner-chip').className = `dash-chip ${b ? 'dash-chip-ok' : ''}`; $('banner-chip-text').textContent = b ? 'Showing' : 'Off';
    $('l-mode').innerHTML = `<option value="auto">Automatic (by date)</option><option value="off">No holiday looks</option>${data.seasons.map(k => `<option value="${k}">${esc(NAMES[k] || k)}</option>`).join('')}`;
    $('n-text').value = data.now?.text || ''; $('n-until').value = toLocal(data.now?.until);
    $('now-chip').className = `dash-chip ${data.now ? 'dash-chip-ok' : ''}`; $('now-chip-text').textContent = data.now ? 'Showing' : 'Off';
    $('cm-voice').value = data.commissions?.voice || 'off'; $('cm-work').value = data.commissions?.work || 'off'; $('cm-note').value = data.commissions?.note || '';
    $('l-mode').value = data.look?.mode || 'auto'; $('l-until').value = toLocal(data.look?.until);
    updatePreview();
    const m = (await api('maintenance')).data.maintenance || {};
    shopOn = !!m.on; $('s-note').value = m.note || ''; $('s-until').value = toLocal(m.until);
    $('shop-chip').className = `dash-chip ${shopOn ? 'dash-chip-warn' : ''}`; $('shop-chip-text').textContent = shopOn ? 'Site is closed' : 'Off';
    $('s-go').textContent = shopOn ? 'Turn off (reopen site)' : 'Turn on';
  };
  let shopOn = false;
  $('shop-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!shopOn && !confirm('Close the public site? Visitors will see the "back soon" page until you turn this off.')) return;
    const { data } = await api('maintenance', { on: !shopOn, note: $('s-note').value, until: fromLocal($('s-until').value) });
    flash($('shop-msg'), data.error || (data.maintenance?.on ? 'Site is closed for maintenance.' : 'Site is open again.')); loaders.site();
  });
  const updatePreview = () => { const m = $('l-mode').value; $('l-preview').href = m === 'auto' ? '/' : `/?season=${encodeURIComponent(m)}`; };
  $('l-mode').addEventListener('change', updatePreview);
  $('banner-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('b-text').value.trim()) return flash($('banner-msg'), 'Type a message first.');
    const { data } = await api('site', { what: 'banner', text: $('b-text').value, link: $('b-link').value, until: fromLocal($('b-until').value) });
    flash($('banner-msg'), data.error || 'Banner is showing on every page.'); loaders.site();
  });
  $('b-clear').addEventListener('click', async () => { await api('site', { what: 'banner', text: '' }); flash($('banner-msg'), 'Banner is off.'); loaders.site(); });
  $('now-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('n-text').value.trim()) return flash($('now-msg'), 'Type something first, or use Clear.');
    const { data } = await api('site', { what: 'now', text: $('n-text').value, until: fromLocal($('n-until').value) });
    flash($('now-msg'), data.error || 'Saved. It shows on the home page now.'); loaders.site();
  });
  $('n-clear').addEventListener('click', async () => { await api('site', { what: 'now', text: '' }); flash($('now-msg'), 'Cleared.'); loaders.site(); });
  $('comm-form').addEventListener('submit', async e => {
    e.preventDefault();
    const { data } = await api('site', { what: 'commissions', voice: $('cm-voice').value, work: $('cm-work').value, note: $('cm-note').value });
    flash($('comm-msg'), data.error || 'Saved. It shows on the Voice and Work pages now.'); loaders.site();
  });
  $('look-form').addEventListener('submit', async e => {
    e.preventDefault();
    const { data } = await api('site', { what: 'look', mode: $('l-mode').value, until: fromLocal($('l-until').value) });
    flash($('look-msg'), data.error || ($('l-mode').value === 'auto' ? 'Back to automatic.' : 'Saved. Visitors see it on their next page load.')); loaders.site();
  });

  // ---------- Backup and restore ----------
  const saveFile = (obj, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  $('bk-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = $('bk-file').files[0]; if (!f) return flash($('bk-msg'), 'Pick a backup file first.');
    let backup; try { backup = JSON.parse(await f.text()); } catch { return flash($('bk-msg'), 'That file couldn\u2019t be read.'); }
    if (backup?.app !== 'dismeigh-dashboard-backup') return flash($('bk-msg'), 'That isn\u2019t a dashboard backup file.');
    const only = [...document.querySelectorAll('#bk-only input:checked')].map(i => i.value);
    if (!only.length) return flash($('bk-msg'), 'Pick at least one part to restore.');
    if (!confirm(`Restore from the backup made ${when(backup.at)}? The parts you picked get replaced (the Ship\u2019s Log only gets missing entries added).`)) return;
    const { data } = await api('backup', { backup, only });
    flash($('bk-msg'), data.error || `Restored: ${data.done.join(', ')}.`); $('bk-file').value = '';
  });
  $('bk-before').addEventListener('click', async () => {
    const { status, data } = await api('backup', { action: 'before' });
    if (status !== 200) return flash($('bk-msg'), data.error || 'Couldn\u2019t get it.');
    saveFile(data, 'dismeigh-backup-before-restore.json');
  });

  // ---------- Private notes ----------
  const CAT = { stream: 'Stream idea', bounty: 'Bounty idea', quote: 'Future quote', other: 'Other' };
  let notes = [], noteFilter = 'all', editing = null;
  function drawNotes() {
    const list = notes.filter(n => (noteFilter === 'done' ? n.done : !n.done && (noteFilter === 'all' || n.cat === noteFilter)));
    $('notes-body').innerHTML = list.length ? `<ul class="dash-list">${list.map(n => `
      <li class="dash-row dash-noterow cat-${esc(n.cat)}${n.done ? ' is-hidden' : ''}">
        <div class="dash-row-main"><span class="dash-meta">${esc(CAT[n.cat] || 'Other')} · ${esc(when(new Date(n.at).toISOString()))}${n.edited ? ' · edited' : ''}</span>
          ${editing === n.id ? `<label class="sr-only" for="ne-${n.id}">Edit note</label><textarea id="ne-${n.id}" rows="4" maxlength="1000">${esc(n.text)}</textarea>` : `<p class="dash-note-text">${esc(n.text)}</p>`}</div>
        <div class="dash-row-actions">
          ${editing === n.id ? `<button type="button" class="dash-btn dash-small dash-primary" data-note="save" data-id="${n.id}">Save</button><button type="button" class="dash-btn dash-small" data-note="cancel" data-id="${n.id}">Cancel</button>`
            : `<button type="button" class="dash-btn dash-small" data-note="${n.done ? 'undo' : 'done'}" data-id="${n.id}">${n.done ? 'Not done' : 'Done'}</button><button type="button" class="dash-btn dash-small" data-note="edit" data-id="${n.id}">Edit</button>`}
          <button type="button" class="dash-btn dash-small dash-danger" data-note="delete" data-id="${n.id}">Delete</button>
        </div></li>`).join('')}</ul>` : `<p class="dash-note">${noteFilter === 'done' ? 'Nothing marked done yet.' : 'No notes here yet.'}</p>`;
  }
  loaders.notes = async () => { const { data } = await api('notes'); notes = data.notes || []; drawNotes(); };
  $('note-form').addEventListener('submit', async e => {
    e.preventDefault();
    const { status, data } = await api('notes', { action: 'add', cat: $('nt-cat').value, text: $('nt-text').value });
    if (status !== 200) return flash($('note-msg'), data.error || 'Couldn\u2019t add it.');
    $('nt-text').value = ''; notes = data.notes; drawNotes(); flash($('note-msg'), 'Added.');
  });
  document.querySelectorAll('#note-filter [data-cat]').forEach(b => b.addEventListener('click', () => {
    noteFilter = b.dataset.cat;
    document.querySelectorAll('#note-filter [data-cat]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    drawNotes();
  }));
  $('notes-body').addEventListener('click', async e => {
    const b = e.target.closest('[data-note]'); if (!b) return;
    const id = Number(b.dataset.id), act = b.dataset.note;
    if (act === 'edit') { editing = id; drawNotes(); $(`ne-${id}`)?.focus(); return; }
    if (act === 'cancel') { editing = null; drawNotes(); return; }
    if (act === 'delete' && !confirm('Delete this note?')) return;
    const body = act === 'delete' ? { action: 'delete', id } : act === 'save' ? { action: 'update', id, text: $(`ne-${id}`).value } : { action: 'update', id, done: act === 'done' };
    const { status, data } = await api('notes', body);
    if (status !== 200) return alert(data.error || 'Couldn\u2019t save that.');
    editing = null; notes = data.notes; drawNotes();
  });

  // ---------- Login history ----------
  loaders.security = async () => {
    const { data } = await api('history');
    const bad = ev => /wrong|blocked/i.test(ev);
    $('sec-body').innerHTML = (data.history || []).length ? `<ul class="dash-list">${data.history.map(h => `
      <li class="dash-row${bad(h.event) ? ' is-bad' : ''}"><div class="dash-row-main"><b>${esc(h.event)}</b> <span class="dash-meta">${esc(when(h.at))}</span><p>${esc(h.device)} · ${esc(h.place)}</p></div></li>`).join('')}</ul>` : '<p class="dash-note">Nothing yet.</p>';
  };

  // ---------- Phone alerts (Web Push) ----------
  const alertKinds = () => [...document.querySelectorAll('#al-kinds input:checked')].map(i => i.value);
  const deviceName = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android phone' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows PC' : 'Device'; };
  const KIND_NAMES = { log: 'Ship\u2019s Log', kofi: 'Ko-fi', goal: 'Goal', login: 'Logins' };
  const toKey = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  let pushKey = '', mySub = null;
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  loaders.alerts = async () => {
    const { data } = await api('push'); pushKey = data.key;
    const iosBrowser = /iPhone|iPad/.test(navigator.userAgent) && !(matchMedia('(display-mode: standalone)').matches || navigator.standalone);
    mySub = pushOk() ? await navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).catch(() => null) : null;
    const mine = mySub && (data.devices || []).find(d => d.endpoint === mySub.endpoint);
    if (mine) document.querySelectorAll('#al-kinds input').forEach(i => { i.checked = mine.kinds.includes(i.value); });
    $('al-chip').className = `dash-chip ${mine ? 'dash-chip-ok' : ''}`; $('al-chip-text').textContent = mine ? 'On here' : 'Off here';
    $('al-on').textContent = mine ? 'Save choices' : 'Turn on alerts here';
    $('al-test').hidden = $('al-off').hidden = !mine;
    $('al-on').disabled = !pushOk() || iosBrowser;
    $('al-note').textContent = iosBrowser ? 'On iPhone, alerts only work in the installed dashboard app. Add it to your home screen (Share \u2192 Add to Home Screen), open it from there, then come back to this tab.'
      : !pushOk() ? 'This browser can\u2019t do alerts. Try the installed dashboard app on your phone.'
      : 'Get a notification when something happens on the site. Each phone or computer picks its own alerts.';
    $('al-devices').innerHTML = (data.devices || []).length ? `<ul class="dash-list">${data.devices.map(d => `
      <li class="dash-row"><div class="dash-row-main"><b>${esc(d.label)}${mySub && d.endpoint === mySub.endpoint ? ' (this one)' : ''}</b> <span class="dash-meta">since ${esc(when(d.at))}</span>
        <p>${d.kinds.length ? esc(d.kinds.map(k => KIND_NAMES[k] || k).join(', ')) : 'No alerts picked'}</p></div>
        <div class="dash-row-actions"><button type="button" class="dash-btn dash-small dash-danger" data-unsub="${esc(d.endpoint)}">Remove</button></div></li>`).join('')}</ul>` : '<p class="dash-note">None yet.</p>';
  };
  $('al-on').addEventListener('click', async () => {
    try {
      if (mySub && !$('al-off').hidden) { await api('push', { action: 'kinds', endpoint: mySub.endpoint, kinds: alertKinds() }); flash($('al-msg'), 'Saved.'); return loaders.alerts(); }
      if ((await Notification.requestPermission()) !== 'granted') return flash($('al-msg'), 'Notifications are blocked. Allow them in your phone\u2019s settings for this app, then try again.');
      const reg = await navigator.serviceWorker.ready;
      const old = await reg.pushManager.getSubscription();
      if (old && old.options?.applicationServerKey && btoa(String.fromCharCode(...new Uint8Array(old.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== pushKey) await old.unsubscribe();
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(pushKey) });
      const { data } = await api('push', { action: 'subscribe', sub: sub.toJSON(), kinds: alertKinds(), label: deviceName() });
      flash($('al-msg'), data.error || 'Alerts are on for this device. Try "Send a test".');
    } catch { flash($('al-msg'), 'Couldn\u2019t turn alerts on here. Try again in the installed app.'); }
    loaders.alerts();
  });
  $('al-test').addEventListener('click', async () => { if (!mySub) return; const { data } = await api('push', { action: 'test', endpoint: mySub.endpoint }); flash($('al-msg'), data.error || 'Sent. It should pop up in a few seconds.'); });
  $('al-off').addEventListener('click', async () => {
    if (!mySub) return;
    await api('push', { action: 'remove', endpoint: mySub.endpoint }); await mySub.unsubscribe().catch(() => {});
    flash($('al-msg'), 'Alerts are off for this device.'); loaders.alerts();
  });
  $('al-devices').addEventListener('click', async e => {
    const b = e.target.closest('[data-unsub]'); if (!b || !confirm('Stop alerts on that device?')) return;
    await api('push', { action: 'remove', endpoint: b.dataset.unsub });
    if (mySub && b.dataset.unsub === mySub.endpoint) await mySub.unsubscribe().catch(() => {});
    loaders.alerts();
  });

  // ---------- Install as an app ----------
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('install-btn').hidden = false; });
  $('install-btn').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $('install-btn').hidden = true; });
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('install-note').textContent = 'You’re using the installed dashboard app.';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const offline = () => { document.body.classList.toggle('dash-offline', !navigator.onLine); };
  addEventListener('online', offline); addEventListener('offline', offline); offline();
})();
