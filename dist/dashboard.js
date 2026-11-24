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
  // A random ID for this browser, so the dashboard can tell a new device from one it has seen before
  const deviceId = () => { try { let v = localStorage.getItem('dm-dash-device'); if (!v) { v = [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('dm-dash-device', v); } return v; } catch { return ''; } };
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

  $('use-backup').addEventListener('click', () => {
    const c = $('code'); c.value = ''; c.setAttribute('inputmode', 'text'); c.setAttribute('autocomplete', 'off');
    $('code-label').textContent = 'Backup code (like ABCD-EF23)'; $('use-backup').hidden = true; c.focus();
  });
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-msg').textContent = '';
    const { status, data } = await api('login', { password: $('pw').value, code: $('code').value, device: deviceId() });
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
    const { status, data } = await api('twostep', { code: $('setup-code').value, device: deviceId() });
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
  // A tapped phone alert opens #tab:item (like #guestbook:ask-12): open the tab, then scroll to and outline that item
  function fromHash() {
    const [raw, item] = location.hash.slice(1).split(':'), want = /^[a-z]+$/.test(raw || '') ? raw : 'overview';
    openTab(document.querySelector(`[data-panel="${want}"]`) ? want : 'overview', false);
    if (!/^[a-z]+-\d+$/.test(item || '')) return;
    let tries = 0;
    const find = () => {
      const el = document.querySelector(`[data-focus="${item}"]`);
      if (el) { el.classList.add('dash-focus'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.querySelector('textarea, button')?.focus({ preventScroll: true }); setTimeout(() => el.classList.remove('dash-focus'), 4000); history.replaceState(null, '', `#${want}`); }
      else if (++tries < 20) setTimeout(find, 200);
    };
    find();
  }
  document.addEventListener('dash:in', fromHash);
  addEventListener('hashchange', () => { if (location.hash.includes(':')) fromHash(); });

  // ---------- Overview: site stats ----------
  // Site health lights
  const HL = { ok: 'Working', warn: 'Heads up', down: 'Down' };
  async function loadHealth() {
    $('hl-body').innerHTML = '<li class="dash-note">Checking&hellip;</li>';
    const { data } = await api('health');
    $('hl-body').innerHTML = (data.checks || []).map(c => `<li class="hl-${esc(c.state)}"><span class="hl-dot" aria-hidden="true"></span><div><b>${esc(c.name)}</b> <span class="hl-state">${HL[c.state] || ''}</span><p>${esc(c.detail)}</p></div></li>`).join('');
    const bad = (data.checks || []).filter(c => c.state === 'down').length;
    $('hl-note').textContent = `${bad ? `${bad} thing${bad === 1 ? ' is' : 's are'} down. ` : ''}The site also checks itself every 30 minutes and can alert your phone (Alerts tab).`;
  }
  $('hl-refresh').addEventListener('click', loadHealth);

  // Monthly report
  async function loadReport(month) {
    const { data } = await api(`report${month ? `?month=${encodeURIComponent(month)}` : ''}`);
    const n = data.now, b = data.before, mname = k => new Date(`${k}-15T12:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });
    if (!$('rp-month').options.length || month === undefined) $('rp-month').innerHTML = data.months.map(k => `<option value="${k}"${k === data.month ? ' selected' : ''}>${mname(k)}</option>`).join('');
    const cash = c => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const diff = (a, z, isMoney) => { if (!z && !a) return ''; if (!z) return '<span class="rp-up">new</span>'; const p = Math.round((a - z) / z * 100); return p === 0 ? '<span class="rp-flat">same as last month</span>' : `<span class="${p > 0 ? 'rp-up' : 'rp-down'}">${p > 0 ? '&#9650;' : '&#9660;'} ${Math.abs(p)}% vs ${isMoney ? cash(z) : z.toLocaleString()}</span>`; };
    const tile = (label, val, cmp) => `<div class="rp-tile"><span>${label}</span><b>${val}</b>${cmp || ''}</div>`;
    const list = (rows, fmt) => rows.length ? `<ol>${rows.map(r => `<li>${fmt(r)}</li>`).join('')}</ol>` : '<p class="dash-hint">Nothing this month.</p>';
    $('report').innerHTML = `
      <h3 class="rp-title">${esc(mname(data.month))}</h3>
      <div class="rp-tiles">
        ${tile('Page views', n.views.toLocaleString(), diff(n.views, b.views))}
        ${tile('New visitors', n.visitors.toLocaleString(), diff(n.visitors, b.visitors))}
        ${tile('Money in', cash(n.money.total), diff(n.money.total, b.money.total, true))}
        ${tile('Profit', `<span class="${n.money.profit < 0 ? 'is-neg' : ''}">${cash(n.money.profit)}</span>`, diff(n.money.profit, b.money.profit, true))}
      </div>
      <div class="rp-cols">
        <div><h4>Site</h4><ul class="rp-facts">
          ${n.busiestDay ? `<li>Busiest day: <b>${esc(new Date(n.busiestDay.day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))}</b> (${n.busiestDay.n} views)</li>` : ''}
          <li>Ship&rsquo;s Log entries: <b>${n.logEntries}</b></li><li>Arcade scores posted: <b>${n.scores}</b>${n.topScore ? ` (top Bounty Run: ${esc(n.topScore.name)}, ${Number(n.topScore.score).toLocaleString()})` : ''}</li><li>Secrets found: <b>${n.secrets}</b></li></ul>
          <h4>Top pages</h4>${list(n.topPages, r => `${esc(r.path === '/' ? 'Home' : r.path)} <b>${r.n}</b>`)}
          <h4>Where visitors came from</h4>${list(n.sources, r => `${esc(r.source)} <b>${r.n}</b>`)}
          <h4>Top searches</h4>${list(n.searches, r => `${esc(r.term)} <b>${r.n}</b>`)}
          ${n.missed.length ? `<h4>Searched but not found</h4>${list(n.missed, r => `${esc(r.term)} <b>${r.n}</b>`)}` : ''}</div>
        <div><h4>Money</h4><ul class="rp-facts">
          <li>Ko-fi tips: <b>${cash(n.money.tips)}</b></li><li>Memberships: <b>${cash(n.money.memberships)}</b></li><li>Ko-fi sales &amp; commissions: <b>${cash(n.money.kofiSales)}</b></li>
          <li>Client payments: <b>${cash(n.money.clients)}</b></li><li>Expenses: <b>${cash(n.money.expenses)}</b></li><li>Ko-fi payments: <b>${n.kofiCount}</b></li></ul>
          <h4>Business</h4><ul class="rp-facts"><li>Quote requests: <b>${n.quotes}</b></li><li>New jobs: <b>${n.jobsNew}</b></li><li>Jobs finished: <b>${n.jobsDone.length}</b></li></ul>
          ${n.jobsDone.length ? list(n.jobsDone, r => `${esc(r.client)}${r.service ? ` &middot; ${esc(r.service)}` : ''}`) : ''}
          <h4>Voice</h4><ul class="rp-facts"><li>Auditions sent: <b>${n.auditionsSent}</b></li><li>Booked: <b>${n.auditionsBooked.length}</b></li></ul>
          ${n.auditionsBooked.length ? list(n.auditionsBooked, r => `${esc(r.project)}${r.role ? ` (${esc(r.role)})` : ''}`) : ''}</div>
      </div>
      <p class="dash-hint rp-note">Ship&rsquo;s Log entries and secrets are only kept about 60 days and quote requests 90, so older months may show fewer of those.</p>`;
  }
  $('rp-month').addEventListener('change', () => loadReport($('rp-month').value));
  $('rp-print').addEventListener('click', () => { document.body.classList.add('print-report'); print(); });
  addEventListener('afterprint', () => document.body.classList.remove('print-report'));

  // Activity feed
  let acts = [], actK = 'all';
  const ICON = { log: '\u270e', kofi: '$', arcade: '\u2605', secret: '?' };
  function drawActs() {
    const list = acts.filter(a => actK === 'all' || a.kind === actK).slice(0, 30);
    $('act-body').innerHTML = list.length ? `<ul class="dash-feed">${list.map(a => `<li class="feed-${esc(a.kind)}"><span class="feed-ic" aria-hidden="true">${ICON[a.kind] || '\u2022'}</span><div><b>${esc(a.text)}</b>${a.hidden ? ' <small class="dash-hint">(hidden)</small>' : ''}${a.detail ? `<p>${esc(a.detail)}</p>` : ''}<span class="dash-meta">${esc(when(a.at))}</span></div></li>`).join('')}</ul>` : '<p class="dash-note">Nothing yet.</p>';
  }
  const loadActs = async () => { const { data } = await api('activity'); acts = data.items || []; drawActs(); };
  $('act-refresh').addEventListener('click', loadActs);
  document.querySelectorAll('#act-filter [data-act-k]').forEach(b => b.addEventListener('click', () => {
    actK = b.dataset.actK; document.querySelectorAll('#act-filter [data-act-k]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawActs();
  }));
  loaders.overview = async () => {
    loadToday();
    loadActs(); loadHealth(); loadReport(); api('clients').then(r => { if (r.status === 200) drawBoard(r.data); }).catch(() => {});
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
        <div><h3 class="dash-h3">What people search for, 30 days</h3>${(s.searches || []).length ? `<ol class="dash-rank">${s.searches.map(r => `<li><span>${esc(r.term)}${r.misses >= r.n ? ' <em class="dash-miss">no results</em>' : r.misses ? ` <em class="dash-miss">${r.misses} with no results</em>` : ''}</span><b>${r.n}</b></li>`).join('')}</ol><p class="dash-hint">&ldquo;No results&rdquo; means people looked for it and the site had nothing. Good hint for what to add.</p>` : '<p class="dash-note">Nothing counted yet. This started on Nov 24, 2026.</p>'}</div>
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
    collabs: { note: 'Past collabs on the press kit page: who you worked with and what you made together. Newest first looks best.', fields: [
      F('name', 'Who (name or channel)', 'text', { max: 60, required: true }), F('link', 'Their link (https://...)', 'text', { max: 300 }),
      F('what', 'What you did', 'text', { max: 120 }), F('when', 'When (like Oct 2026)', 'text', { max: 30 }),
    ] },
    captions: { note: 'Subtitles for the clips on the home page. One line per caption: which clip, when it starts and ends (like 0:03 and 0:06), and what\u2019s said. Order doesn\u2019t matter.', fields: [
      F('clip', 'Clip', 'select', { options: [['1', 'Clip 1'], ['2', 'Clip 2'], ['3', 'Clip 3'], ['4', 'Clip 4'], ['5', 'Clip 5']] }),
      F('start', 'Starts (m:ss)', 'text', { max: 9 }), F('end', 'Ends (m:ss)', 'text', { max: 9 }), F('text', 'What\u2019s said', 'text', { max: 160, required: true }),
    ] },
    garage: { note: 'The Sojourn ST build sheet on the Garage page. Move a mod to Done when it\u2019s on the car; the progress bar updates on its own.', fields: [
      F('status', 'Status', 'select', { options: [['planned', 'Planned'], ['done', 'Done']] }), F('name', 'Mod', 'text', { max: 80, required: true }),
    ] },
    builder: { note: 'The "Build your project" price builder on the Work page. Base = pick one; add-on = optional extras; monthly = care plan. Prices in whole dollars.', fields: [
      F('group', 'Section', 'select', { options: [['web', 'Websites'], ['discord', 'Discord']] }), F('kind', 'Type', 'select', { options: [['base', 'Base (pick one)'], ['addon', 'Add-on'], ['monthly', 'Monthly']] }),
      F('name', 'Name', 'text', { max: 60, required: true }), F('price', 'Price in dollars', 'text', { max: 7 }),
      F('per', 'Charged', 'select', { options: [['once', 'Once'], ['each', 'Each (they pick how many)']] }), F('note', 'Small note (optional)', 'text', { max: 80 }),
    ] },
    faq: { note: 'Questions and answers on the Work page, in this order.', fields: [
      F('q', 'Question', 'text', { max: 140, required: true }), F('a', 'Answer', 'textarea', { max: 600, required: true }),
    ] },
    pricing: { note: 'Rates on the Work page. What\u2019s included: one point per line.', fields: [
      F('group', 'Section', 'select', { options: [['discord', 'Discord'], ['web', 'Websites']] }), F('name', 'Service', 'text', { max: 60, required: true }),
      F('price', 'Price (e.g. from $50, $25/month)', 'text', { max: 30 }), F('summary', 'One-line description', 'text', { max: 160 }),
      F('points', 'What\u2019s included (one per line)', 'textarea', { max: 960 }),
    ] },
    pinned: { single: true, note: 'Pins a clip at the top of Clips on the home page. Twitch, YouTube or TikTok links.', fields: [
      F('url', 'Clip link (https://...)', 'text', { max: 300 }), F('title', 'Title (optional)', 'text', { max: 100 }), F('by', 'Clipped by', 'text', { max: 40 }),
      F('reason', 'Why it’s pinned (optional, e.g. the bounty it won)', 'text', { max: 120 }), F('until', 'Unpin after', 'date'),
    ] },
  };
  const WRAP = { bounties: 'bounties', quotes: 'quotes', lore: 'entries', verdicts: 'verdicts', crew: 'crew', pinned: 'pinned', pricing: 'pricing', faq: 'faq', builder: 'builder', garage: 'garage', captions: 'captions', collabs: 'collabs' };
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
    flash($('content-msg'), kept < sent ? `Saved. ${sent - kept} entr${sent - kept === 1 ? 'y was' : 'ies were'} skipped (something was missing or not valid${kind === 'captions' ? ', like an end time before the start time' : ''}).` : 'Saved. It’s live on the site now.');
  });
  loaders.content = () => { if (!$('content-body').children.length) loadContent(kind); loadEvent(); loadClips(); loadVotes(); };

  // ---------- YouTube row ----------
  let clips = { count: 3, pinned: [], hidden: [] }, feed = [];
  const ytDate = iso => (iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '');
  function drawClips() {
    $('cl-count').value = String(clips.count);
    $('cl-pinned').innerHTML = clips.pinned.length ? `<ol class="dash-list">${clips.pinned.map((v, i) => `
      <li class="dash-row is-pinned"><div class="dash-row-main"><b>${esc(v.title)}</b> <span class="dash-meta">${v.short ? 'Short' : 'Video'} · ${esc(ytDate(v.published))}</span></div>
        <div class="dash-row-actions">
          <button type="button" class="dash-btn dash-small" data-cl="up" data-i="${i}" ${i ? '' : 'disabled'}>Up</button>
          <button type="button" class="dash-btn dash-small" data-cl="down" data-i="${i}" ${i < clips.pinned.length - 1 ? '' : 'disabled'}>Down</button>
          <button type="button" class="dash-btn dash-small" data-cl="unpin" data-i="${i}">Unfeature</button>
        </div></li>`).join('')}</ol>` : '<p class="dash-note">Nothing featured. The newest uploads show.</p>';
    const pinnedIds = new Set(clips.pinned.map(p => p.id)), hidden = new Set(clips.hidden);
    $('cl-feed').innerHTML = feed.length ? `<ul class="dash-list">${feed.map((v, i) => `
      <li class="dash-row${hidden.has(v.id) ? ' is-hidden' : ''}"><div class="dash-row-main"><b>${esc(v.title)}</b> <span class="dash-meta">${v.short ? 'Short' : 'Video'} · ${esc(ytDate(v.published))}${hidden.has(v.id) ? ' · hidden' : ''}${pinnedIds.has(v.id) ? ' · featured' : ''}</span></div>
        <div class="dash-row-actions">
          <a class="dash-btn dash-small" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">Watch</a>
          ${pinnedIds.has(v.id) ? '' : `<button type="button" class="dash-btn dash-small" data-cl="pin" data-i="${i}" ${clips.pinned.length >= 6 ? 'disabled' : ''}>Feature</button>`}
          ${pinnedIds.has(v.id) ? '' : `<button type="button" class="dash-btn dash-small${hidden.has(v.id) ? '' : ' dash-danger'}" data-cl="${hidden.has(v.id) ? 'unhide' : 'hide'}" data-i="${i}">${hidden.has(v.id) ? 'Show' : 'Hide'}</button>`}
        </div></li>`).join('')}</ul>` : '<p class="dash-note">Couldn\u2019t reach YouTube right now. Try Refresh in a bit.</p>';
  }
  // Clip of the Month counts
  const monthName = k => new Date(k + '-15T12:00:00').toLocaleDateString([], { month: 'long', year: 'numeric' });
  async function loadVotes() {
    const d = (await api('clipvote')).data; if (!d.tally) return;
    const top = Math.max(1, ...d.tally.map(t => t.n));
    $('cv-body').innerHTML = `<h3 class="dash-h3">${esc(monthName(d.month))} so far <span class="dash-meta">(${d.total} vote${d.total === 1 ? '' : 's'})</span></h3>
      <ul class="dash-bars">${d.tally.map(t => `<li><span>Clip ${t.clip}</span><span class="dash-bar"><i style="width:${Math.round(t.n / top * 100)}%"></i></span><b>${t.n}</b></li>`).join('')}</ul>
      ${d.winners.length ? `<h3 class="dash-h3">Past winners</h3><ul class="dash-pays">${d.winners.map(w => `<li>${esc(monthName(w.month))}: <b>Clip ${w.clip}</b> (${w.votes} of ${w.total} votes)</li>`).join('')}</ul>` : ''}`;
  }
  $('cv-reload').addEventListener('click', loadVotes);
  async function loadClips() {
    const { data } = await api('clips'); clips = data.settings; feed = data.feed || []; drawClips();
  }
  const clipsDirty = () => { $('cl-msg').textContent = 'Unsaved changes'; };
  $('cl-reload').addEventListener('click', loadClips);
  $('cl-count').addEventListener('change', () => { clips.count = Number($('cl-count').value); clipsDirty(); });
  document.querySelector('.dash-card-clips').addEventListener('click', e => {
    const b = e.target.closest('[data-cl]'); if (!b) return;
    const i = Number(b.dataset.i), act = b.dataset.cl, P = clips.pinned;
    if (act === 'up') [P[i - 1], P[i]] = [P[i], P[i - 1]];
    if (act === 'down') [P[i + 1], P[i]] = [P[i], P[i + 1]];
    if (act === 'unpin') P.splice(i, 1);
    if (act === 'pin') { const v = feed[i]; P.push({ id: v.id, title: v.title, published: v.published, short: v.short }); clips.hidden = clips.hidden.filter(x => x !== v.id); }
    if (act === 'hide') clips.hidden.push(feed[i].id);
    if (act === 'unhide') clips.hidden = clips.hidden.filter(x => x !== feed[i].id);
    clipsDirty(); drawClips();
  });
  $('cl-save').addEventListener('click', async () => {
    const { data } = await api('clips', clips); clips = data.settings; drawClips();
    flash($('cl-msg'), 'Saved. The home page updates within a couple of minutes.');
  });

  // ---------- Special event ----------
  const evLocal = iso => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const evIso = v => (v ? new Date(v).toISOString() : '');
  const schedRow = (x = {}) => `<div class="dash-ev-row"><label class="sr-only">Segment time</label><input type="datetime-local" data-ev="time" value="${esc(evLocal(x.time))}">
    <label class="sr-only">Segment</label><input data-ev="title" maxlength="80" placeholder="Opening ceremony" value="${esc(x.title || '')}">
    <button type="button" class="dash-btn dash-small dash-danger" data-ev-del>Remove</button></div>`;
  async function loadEvent() {
    const { data } = await api('content?key=events');
    const ev = data.event;
    $('ev-title-in').value = ev?.title || ''; $('ev-type-in').value = ev?.type || 'subathon';
    $('ev-start-in').value = evLocal(ev?.start); $('ev-end-in').value = evLocal(ev?.end);
    $('ev-desc-in').value = ev?.description || ''; $('ev-link-in').value = ev?.link || '';
    $('evg-label').value = ev?.goal?.label || ''; $('evg-unit').value = ev?.goal?.unit || ''; $('evg-cur').value = ev?.goal?.current ?? ''; $('evg-target').value = ev?.goal?.target ?? ''; $('evg-url').value = ev?.goal?.url || '';
    $('ev-sched').innerHTML = (ev?.schedule || []).map(schedRow).join('');
    const now = Date.now(), live = ev && now >= Date.parse(ev.start) && now < Date.parse(ev.end), over = ev && now >= Date.parse(ev.end);
    $('ev-chip').className = `dash-chip ${ev && !over ? 'dash-chip-ok' : ''}`; $('ev-chip-text').textContent = !ev ? 'None' : live ? 'Live now' : over ? 'Ended' : 'Coming up';
  }
  $('ev-sched-add').addEventListener('click', () => { $('ev-sched').insertAdjacentHTML('beforeend', schedRow()); $('ev-sched').lastElementChild.querySelector('input').focus(); });
  $('ev-sched').addEventListener('click', e => { if (e.target.closest('[data-ev-del]')) e.target.closest('.dash-ev-row').remove(); });
  $('ev-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('ev-title-in').value.trim() || !$('ev-start-in').value || !$('ev-end-in').value) return flash($('ev-msg'), 'Give it a name, a start and an end.');
    if (new Date($('ev-end-in').value) <= new Date($('ev-start-in').value)) return flash($('ev-msg'), 'The end has to be after the start.');
    const target = Number($('evg-target').value);
    const ev = {
      title: $('ev-title-in').value, type: $('ev-type-in').value, start: evIso($('ev-start-in').value), end: evIso($('ev-end-in').value),
      description: $('ev-desc-in').value, link: $('ev-link-in').value,
      goal: target > 0 ? { label: $('evg-label').value, unit: $('evg-unit').value, current: Number($('evg-cur').value) || 0, target, url: $('evg-url').value } : null,
      schedule: [...$('ev-sched').querySelectorAll('.dash-ev-row')].map(r => ({ time: evIso(r.querySelector('[data-ev="time"]').value), title: r.querySelector('[data-ev="title"]').value })).filter(x => x.time && x.title.trim()),
    };
    const { status, data } = await api('content', { key: 'events', data: ev });
    if (status !== 200) return flash($('ev-msg'), data.error || 'Couldn\u2019t save.');
    flash($('ev-msg'), data.event ? 'Saved. The event page and home page countdown are updated.' : 'That didn\u2019t save. Check the dates (events can be up to 31 days long).'); loadEvent();
  });
  $('ev-clear').addEventListener('click', async () => {
    if (!confirm('Remove the event? The event page goes back to "nothing planned".')) return;
    await api('content', { key: 'events', data: null }); flash($('ev-msg'), 'Event removed.'); loadEvent();
  });
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- Ask the captain ----------
  let askRows = [], askView = 'new';
  function drawAsk() {
    const list = askRows.filter(q => (askView === 'new') === !q.answered_at);
    const waiting = askRows.filter(q => !q.answered_at).length;
    document.querySelector('#ask-filter [data-ask="new"]').textContent = `Waiting${waiting ? ` (${waiting})` : ''}`;
    $('ask-body').innerHTML = list.length ? `<ul class="dash-list">${list.map(q => `
      <li class="dash-row${q.hidden ? ' is-hidden' : ''}" data-focus="ask-${q.id}"><div class="dash-row-main"><b>${esc(q.name)}</b> <span class="dash-meta">${esc(when(q.at))}${q.hidden ? ' · hidden' : ''}</span><p>${esc(q.q)}</p>
        <form class="dash-ask-form" data-ask-form="${q.id}"><label for="aa-${q.id}">${q.answered_at ? 'Your answer' : 'Answer'}</label><textarea id="aa-${q.id}" rows="3" maxlength="1200" placeholder="Your answer shows under the question on the Ask page">${esc(q.answer)}</textarea>
        <div class="dash-actions"><button type="submit" class="dash-btn dash-small dash-primary">${q.answered_at ? 'Update answer' : 'Answer and post'}</button></div></form></div>
        <div class="dash-row-actions">${q.answered_at ? `<button type="button" class="dash-btn dash-small" data-ask-act="${q.hidden ? 'unhide' : 'hide'}" data-id="${q.id}">${q.hidden ? 'Show' : 'Hide'}</button>` : ''}
          <button type="button" class="dash-btn dash-small dash-danger" data-ask-act="delete" data-id="${q.id}">Delete</button></div></li>`).join('')}</ul>`
      : `<p class="dash-note">${askView === 'new' ? 'No questions waiting.' : 'Nothing answered yet.'}</p>`;
  }
  const loadAsk = async () => { askRows = (await api('ask')).data.questions || []; drawAsk(); };
  const askAct = async body => { const { status, data } = await api('ask', body); if (status !== 200) { flash($('ask-msg'), data.error || 'Couldn’t save.'); return null; } askRows = data.questions || []; drawAsk(); return data; };
  $('ask-refresh').addEventListener('click', loadAsk);
  document.querySelectorAll('#ask-filter [data-ask]').forEach(b => b.addEventListener('click', () => { askView = b.dataset.ask; document.querySelectorAll('#ask-filter [data-ask]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawAsk(); }));
  $('ask-body').addEventListener('submit', async e => {
    const f = e.target.closest('[data-ask-form]'); if (!f) return; e.preventDefault();
    if (await askAct({ action: 'answer', id: Number(f.dataset.askForm), answer: $(`aa-${f.dataset.askForm}`).value })) flash($('ask-msg'), 'Posted on the Ask page.');
  });
  $('ask-body').addEventListener('click', async e => {
    const b = e.target.closest('[data-ask-act]'); if (!b) return;
    if (b.dataset.askAct === 'delete' && !confirm('Delete this question for good?')) return;
    await askAct({ action: b.dataset.askAct, id: Number(b.dataset.id) });
  });

  // ---------- Ship's Log ----------
  loaders.guestbook = async () => {
    loadAsk();
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
    presets = data.presets || []; drawPresets(b);
    $('b-live').checked = data.liveBar !== false;
    const q = data.queue || [];
    $('b-queue').innerHTML = q.length ? `<h3 class="dash-h3">Coming up</h3><ul class="dash-list">${q.map(x => `
      <li class="dash-row"><div class="dash-row-main"><b>${esc(x.text)}</b> <span class="dash-meta">starts ${esc(when(new Date(x.from).toISOString()))}${x.until ? ` · ends ${esc(when(new Date(x.until).toISOString()))}` : ''}</span></div>
        <div class="dash-row-actions"><button type="button" class="dash-btn dash-small dash-danger" data-unq="${x.id}">Cancel</button></div></li>`).join('')}</ul>` : '';
    $('l-mode').innerHTML = `<option value="auto">Automatic (by date)</option><option value="off">No holiday looks</option>${data.seasons.map(k => `<option value="${k}">${esc(NAMES[k] || k)}</option>`).join('')}`;
    $('n-text').value = data.now?.text || ''; $('n-until').value = toLocal(data.now?.until);
    $('now-chip').className = `dash-chip ${data.now ? 'dash-chip-ok' : ''}`; $('now-chip-text').textContent = data.now ? 'Showing' : 'Off';
    const cmSet = data.commissionsSet || data.commissions;
    for (const k of ['voice', 'web', 'discord']) { $(`cm-${k}`).value = cmSet?.[k] || 'off'; $(`cm-${k}-note`).value = cmSet?.notes?.[k] || ''; }
    $('cap-web').value = data.capacitySet?.web || ''; $('cap-discord').value = data.capacitySet?.discord || '';
    $('cap-status').textContent = ['web', 'discord'].filter(k => data.capacity?.[k]).map(k => `${k === 'web' ? 'Websites' : 'Discord'}: ${data.capacity[k].used} of ${data.capacity[k].max} spots taken${data.capacity[k].full ? ' (showing as full)' : ''}`).join(' · ');
    const co = data.collabSet || { on: false, kinds: [], note: '' };
    $('co-on').checked = !!co.on; $('co-note').value = co.note || '';
    $('co-kinds').innerHTML = (data.collabKinds || []).map((k, i) => `<label><input type="checkbox" value="${esc(k)}" id="co-k${i}"${co.kinds.includes(k) ? ' checked' : ''}> ${esc(k)}</label>`).join('');
    $('co-chip').className = `dash-chip ${co.on ? 'dash-chip-ok' : ''}`; $('co-chip-text').textContent = co.on ? 'Showing' : 'Off';
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
  // One-tap banners
  let presets = [], editPresets = false;
  function drawPresets(current) {
    $('b-presets').innerHTML = presets.map((p, i) => `<div class="dash-preset${current && current.text === p.text ? ' is-on' : ''}">
      <button type="button" class="dash-btn" data-preset="${i}">${esc(p.text)}<small>${p.hours ? `clears after ${p.hours < 48 ? `${p.hours}h` : `${Math.round(p.hours / 24)} days`}` : 'stays until you turn it off'}</small></button>
      ${editPresets ? `<button type="button" class="dash-btn dash-small dash-danger" data-preset-del="${i}" aria-label="Delete this one-tap banner">Delete</button>` : ''}</div>`).join('')
      + `<button type="button" class="dash-btn dash-small" id="b-edit-presets">${editPresets ? 'Done' : 'Edit one-taps'}</button>`;
  }
  $('b-presets').addEventListener('click', async e => {
    if (e.target.closest('#b-edit-presets')) { editPresets = !editPresets; return drawPresets(null); }
    const del = e.target.closest('[data-preset-del]');
    if (del && !confirm('Delete this one-tap banner?')) return;
    if (del) { presets.splice(Number(del.dataset.presetDel), 1); await api('site', { what: 'presets', presets }); return loaders.site(); }
    const b = e.target.closest('[data-preset]'); if (!b) return;
    const p = presets[Number(b.dataset.preset)];
    const { data } = await api('site', { what: 'banner', text: p.text, link: p.link, until: p.hours ? Date.now() + p.hours * 3600000 : null });
    flash($('banner-msg'), data.error || 'Banner is up on every page.'); loaders.site();
  });
  $('b-save-preset').addEventListener('click', async () => {
    const t = $('b-text').value.trim(); if (!t) return flash($('banner-msg'), 'Type a message first.');
    const until = fromLocal($('b-until').value), hours = until && until > Date.now() ? Math.round((until - Date.now()) / 3600000) : 0;
    const { data } = await api('site', { what: 'presets', presets: [...presets, { text: t, link: $('b-link').value, hours }] });
    flash($('banner-msg'), data.error || 'Saved as a one-tap banner.'); loaders.site();
  });
  const updatePreview = () => { const m = $('l-mode').value; $('l-preview').href = m === 'auto' ? '/' : `/?season=${encodeURIComponent(m)}`; };
  $('l-mode').addEventListener('change', updatePreview);
  $('banner-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('b-text').value.trim()) return flash($('banner-msg'), 'Type a message first.');
    const from = fromLocal($('b-from').value);
    if (from && from > Date.now() + 60000) {
      const { data } = await api('site', { what: 'schedule', text: $('b-text').value, link: $('b-link').value, from, until: fromLocal($('b-until').value) });
      flash($('banner-msg'), data.error || `Scheduled. It switches on ${when(new Date(from).toISOString())}.`);
      if (!data.error) { $('b-from').value = ''; } return loaders.site();
    }
    const { data } = await api('site', { what: 'banner', text: $('b-text').value, link: $('b-link').value, until: fromLocal($('b-until').value) });
    flash($('banner-msg'), data.error || 'Banner is showing on every page.'); $('b-from').value = ''; loaders.site();
  });
  $('b-live').addEventListener('change', async () => {
    await api('site', { what: 'livebar', on: $('b-live').checked });
    flash($('banner-msg'), $('b-live').checked ? 'The Live now strip is on.' : 'The Live now strip is off.');
  });
  $('b-queue').addEventListener('click', async e => {
    const b = e.target.closest('[data-unq]'); if (!b || !confirm('Cancel this scheduled banner?')) return;
    await api('site', { what: 'unschedule', id: Number(b.dataset.unq) }); loaders.site();
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
    await api('site', { what: 'capacity', web: $('cap-web').value, discord: $('cap-discord').value });
    const { data } = await api('site', { what: 'commissions', voice: $('cm-voice').value, web: $('cm-web').value, discord: $('cm-discord').value,
      notes: { voice: $('cm-voice-note').value, web: $('cm-web-note').value, discord: $('cm-discord-note').value } });
    flash($('comm-msg'), data.error || 'Saved. It shows on the Voice and Work pages now.'); loaders.site();
  });
  $('co-form').addEventListener('submit', async e => {
    e.preventDefault();
    const { data } = await api('site', { what: 'collab', on: $('co-on').checked, note: $('co-note').value, kinds: [...document.querySelectorAll('#co-kinds input:checked')].map(x => x.value) });
    flash($('co-msg'), data.error || (data.collab?.on ? 'Saved. It shows on the press kit page now.' : 'Saved. The collab card is hidden.')); loaders.site();
  });
  $('look-form').addEventListener('submit', async e => {
    e.preventDefault();
    const { data } = await api('site', { what: 'look', mode: $('l-mode').value, until: fromLocal($('l-until').value) });
    flash($('look-msg'), data.error || ($('l-mode').value === 'auto' ? 'Back to automatic.' : 'Saved. Visitors see it on their next page load.')); loaders.site();
  });

  // ---------- Link check ----------
  $('lk-go').addEventListener('click', async () => {
    const btn = $('lk-go'); btn.disabled = true; $('lk-body').innerHTML = '';
    try {
      $('lk-msg').textContent = 'Finding links\u2026';
      const { data } = await api('links'); const links = data.links || [], results = [];
      for (let i = 0; i < links.length; i += 10) {
        $('lk-msg').textContent = `Checking ${Math.min(i + 10, links.length)} of ${links.length}\u2026`;
        const { data: r } = await api('links', { urls: links.slice(i, i + 10).map(l => l.url) });
        results.push(...(r.results || []));
      }
      const by = Object.fromEntries(results.map(r => [r.url, r]));
      const rows = links.map(l => ({ ...l, ...(by[l.url] || { result: 'unknown', status: 0 }) }));
      const broken = rows.filter(r => r.result === 'broken'), unknown = rows.filter(r => r.result === 'unknown'), ok = rows.length - broken.length - unknown.length;
      $('lk-msg').textContent = broken.length ? `${broken.length} broken, ${ok} fine, ${unknown.length} couldn\u2019t check.` : `All good: ${ok} fine${unknown.length ? `, ${unknown.length} couldn\u2019t check` : ''}.`;
      const item = r => `<li class="dash-row${r.result === 'broken' ? ' is-bad' : ' is-hidden'}"><div class="dash-row-main"><b>${r.result === 'broken' ? 'Broken' : 'Couldn\u2019t check'}${r.status ? ` (${r.status})` : ''}</b> <span class="dash-meta">${esc(r.where.join(', '))}</span><code class="dash-code">${esc(r.url)}</code></div>
        <div class="dash-row-actions"><a class="dash-btn dash-small" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Open</a></div></li>`;
      $('lk-body').innerHTML = (broken.length || unknown.length) ? `<ul class="dash-list">${[...broken, ...unknown].map(item).join('')}</ul>` : '';
    } catch { $('lk-msg').textContent = 'The check stopped partway. Try again.'; }
    btn.disabled = false;
  });

  // ---------- Stream overlays ----------
  const OVERLAYS = [['goal', 'Ko-fi goal bar', '700 \u00d7 220', 'Hidden while no goal is on. Pops when a tip lands.'], ['log', 'Ship\u2019s Log messages', '700 \u00d7 150', 'Cycles through the newest five entries.'], ['arcade', 'Arcade top 5 this week', '420 \u00d7 330', 'Switches between Bounty Run and Launch Control.'], ['tips', 'Ko-fi tip alerts', '800 \u00d7 260', 'See-through until a tip or membership lands, then pops for 8 seconds. Amount only, never names. Preview shows a test $5 tip.']];
  $('ovl-list').innerHTML = OVERLAYS.map(([k, name, size, note]) => `<li class="dash-row"><div class="dash-row-main"><b>${name}</b> <span class="dash-meta">${size}</span><p>${note}</p><code class="dash-code">${location.origin}/overlay/?w=${k}</code></div>
    <div class="dash-row-actions"><button type="button" class="dash-btn dash-small" data-ovl="${k}">Copy link</button><a class="dash-btn dash-small" href="/overlay/?w=${k}&bg=1${k === 'tips' ? '&test=1' : ''}" target="_blank" rel="noopener">Preview</a></div></li>`).join('');
  $('ovl-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-ovl]'); if (!b) return;
    try { await navigator.clipboard.writeText(`${location.origin}/overlay/?w=${b.dataset.ovl}`); flash($('ovl-msg'), 'Copied. Paste it into an OBS Browser source.'); } catch { flash($('ovl-msg'), 'Couldn\u2019t copy. Press and hold the link to copy it.'); }
  });

  // ---------- Business card QR ----------
  // Everything is drawn in the browser. The link is built only from the fixed page list, never from typed text.
  const QR_PAGES = ['/', '/work/', '/voice/'];
  const qrUrl = () => { const pg = QR_PAGES.includes($('qr-page').value) ? $('qr-page').value : '/'; return `https://denizen-dismeigh.com${pg}${$('qr-count').checked ? '?src=card' : ''}`; };
  const qrPrefs = () => { try { return JSON.parse(localStorage.getItem('dm-qr') || '{}'); } catch { return {}; } };
  (p => { if (QR_PAGES.includes(p.page)) $('qr-page').value = p.page; if (typeof p.count === 'boolean') $('qr-count').checked = p.count; if (typeof p.l1 === 'string') $('qr-line1').value = p.l1.slice(0, 40); if (typeof p.l2 === 'string') $('qr-line2').value = p.l2.slice(0, 40); })(qrPrefs());
  const qrDraw = () => {
    const url = qrUrl();
    $('qr-url').textContent = url;
    $('qr-box').innerHTML = window.dismeighQrSvg ? window.dismeighQrSvg(url, 'H', 'QR code that opens denizen-dismeigh.com') : '';
    try { localStorage.setItem('dm-qr', JSON.stringify({ page: $('qr-page').value, count: $('qr-count').checked, l1: $('qr-line1').value, l2: $('qr-line2').value })); } catch {}
  };
  $('qr-form').addEventListener('input', qrDraw); $('qr-form').addEventListener('change', qrDraw); $('qr-form').addEventListener('submit', e => e.preventDefault());
  qrDraw();
  const qrPaint = (ctx, x, y, size) => {
    const m = window.dismeighQrMatrix(qrUrl(), 'H'), q = 4, cell = size / (m.n + q * 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, size, size); ctx.fillStyle = '#000';
    for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) ctx.fillRect(Math.floor(x + (c + q) * cell), Math.floor(y + (r + q) * cell), Math.ceil(cell), Math.ceil(cell));
  };
  const qrSave = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  const qrCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; };
  const qrDone = (cv, name) => cv.toBlob(b => { if (b) { qrSave(b, name); flash($('qr-msg'), 'Downloaded.'); } else flash($('qr-msg'), 'Couldn’t make the image. Try another browser.'); }, 'image/png');
  $('qr-png').addEventListener('click', () => { if (!window.dismeighQrMatrix) return; const [cv, ctx] = qrCanvas(1200, 1200); qrPaint(ctx, 0, 0, 1200); qrDone(cv, 'dismeigh-qr.png'); });
  $('qr-svg').addEventListener('click', () => { if (!window.dismeighQrSvg) return; qrSave(new Blob([window.dismeighQrSvg(qrUrl(), 'H', 'QR code that opens denizen-dismeigh.com')], { type: 'image/svg+xml' }), 'dismeigh-qr.svg'); flash($('qr-msg'), 'Downloaded.'); });
  $('qr-card').addEventListener('click', async () => {
    if (!window.dismeighQrMatrix) return;
    try { await Promise.all([document.fonts.load('80px Anton'), document.fonts.load('32px "Work Sans"'), document.fonts.load('600 32px "Work Sans"')]); } catch {}
    const W = 1050, H = 600, [cv, ctx] = qrCanvas(W, H), fit = (t, max, font) => { ctx.font = font; let s = String(t); while (s && ctx.measureText(s).width > max) s = s.slice(0, -1); return s; };
    ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e0a526'; ctx.fillRect(0, 0, 18, H);
    qrPaint(ctx, W - 440 - 50, 80, 440);
    const tx = 64, max = W - 440 - 50 - tx - 30;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e0a526'; ctx.fillText(fit('DISMEIGH', max, '84px Anton, Impact, sans-serif'), tx, 225);
    ctx.fillStyle = '#eeeeee'; ctx.fillText(fit($('qr-line1').value, max, '30px "Work Sans", sans-serif'), tx, 290);
    ctx.fillText(fit($('qr-line2').value, max, '30px "Work Sans", sans-serif'), tx, 336);
    ctx.fillStyle = '#4fb3a9'; ctx.fillText(fit('denizen-dismeigh.com', max, '600 30px "Work Sans", sans-serif'), tx, 450);
    ctx.fillStyle = '#9a9a9a'; ctx.fillText(fit('Scan to visit →', max, '24px "Work Sans", sans-serif'), tx, 494);
    qrDone(cv, 'dismeigh-business-card.png');
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

  // ---------- Clients: quote requests + job board ----------
  const STAGE = { quote: 'Quote', booked: 'Booked', deposit: 'Deposit paid', progress: 'In progress', done: 'Done' };
  let board = { requests: [], jobs: [], services: [] }, rqView = 'open', jbView = 'active', editingJob = null;
  const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  function drawRequests() {
    const list = board.requests.filter(r => (rqView === 'archived' ? r.status === 'archived' : r.status !== 'archived'));
    const n = board.requests.filter(r => r.status === 'new').length;
    $('cl-new').hidden = !n; $('cl-new').textContent = n;
    $('rq-body').innerHTML = list.length ? `<ul class="dash-list">${list.map(r => `
      <li class="dash-row dash-req${r.status === 'new' ? ' is-new' : ''}" data-focus="rq-${r.id}"><div class="dash-row-main">
        <b>${esc(r.name)}</b> <span class="dash-meta">${esc(r.service)} · ${esc(when(r.at))}${r.status === 'new' ? ' · <span class="dash-new">New</span>' : r.status === 'replied' ? ' · replied' : ''}</span>
        <p class="dash-req-meta">${esc(r.contact)} · Budget: ${esc(r.budget || 'not given')} · ${esc(r.timeline || '')}</p>
        ${r.referred_by ? `<p class="dash-req-ref">Referred by ${esc(r.referred_by)}</p>` : ''}
        <p class="dash-note-text">${esc(r.message)}</p>
        ${r.links.length ? `<p class="dash-req-links">${r.links.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(u.replace(/^https:\/\//, ''))}</a>`).join(' ')}</p>` : ''}
        <span class="dash-meta">${r.keep ? 'Kept' : `Deletes ${esc(when(r.expires))}`}</span></div>
        <div class="dash-row-actions">
          ${isEmail(r.contact) ? `<a class="dash-btn dash-small" href="mailto:${esc(r.contact)}?subject=${encodeURIComponent(`Your ${r.service} quote`)}">Email</a>` : ''}
          ${r.status === 'new' ? `<button type="button" class="dash-btn dash-small" data-rq-act="replied" data-id="${r.id}">Mark replied</button>` : ''}
          <button type="button" class="dash-btn dash-small dash-primary" data-rq-act="job" data-id="${r.id}">Make it a job</button>
          <button type="button" class="dash-btn dash-small" data-rq-act="${r.keep ? 'unkeep' : 'keep'}" data-id="${r.id}">${r.keep ? 'Don\u2019t keep' : 'Keep'}</button>
          ${r.status !== 'archived' ? `<button type="button" class="dash-btn dash-small" data-rq-act="archive" data-id="${r.id}">Archive</button>` : ''}
          <button type="button" class="dash-btn dash-small dash-danger" data-rq-act="delete" data-id="${r.id}">Delete</button>
        </div></li>`).join('')}</ul>` : `<p class="dash-note">${rqView === 'archived' ? 'Nothing archived.' : 'No requests right now.'}</p>`;
  }
  const jobForm = (j = {}) => `<form class="dash-job-form" data-job-form="${j.id || ''}">
    <div class="dash-two"><div><label for="jf-client">Client</label><input id="jf-client" maxlength="80" value="${esc(j.client || '')}" required></div>
      <div><label for="jf-contact">Contact</label><input id="jf-contact" maxlength="120" value="${esc(j.contact || '')}"></div></div>
    <div class="dash-two"><div><label for="jf-service">Service</label><input id="jf-service" maxlength="60" list="jf-services" value="${esc(j.service || '')}"><datalist id="jf-services">${(board.services || []).map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div><label for="jf-price">Price</label><input id="jf-price" maxlength="40" placeholder="$300" value="${esc(j.price || '')}"></div></div>
    <div class="dash-two"><div><label for="jf-stage">Stage</label><select id="jf-stage">${Object.entries(STAGE).map(([k, v]) => `<option value="${k}"${(j.stage || 'quote') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label for="jf-due">Due</label><input id="jf-due" type="date" value="${esc(j.due || '')}"></div></div>
    <label for="jf-notes">Notes</label><textarea id="jf-notes" rows="4" maxlength="3000">${esc(j.notes || '')}</textarea>
    <div class="dash-actions"><button type="submit" class="dash-btn dash-primary">Save job</button><button type="button" class="dash-btn" data-job-cancel>Cancel</button></div></form>`;
  const money = c => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const paidFor = id => (board.payments || []).filter(p => p.job_id === id).reduce((s, p) => s + p.amount_cents, 0);
  let openMore = null;
  const invRow = (i = {}) => `<div class="dash-inv-row"><label class="sr-only">Line</label><input data-inv="desc" maxlength="120" placeholder="Discord server setup" value="${esc(i.desc || '')}"><label class="sr-only">Amount</label><input data-inv="amount" inputmode="decimal" placeholder="50" value="${i.cents ? (i.cents / 100).toFixed(2) : ''}"><button type="button" class="dash-btn dash-small dash-danger" data-inv-del>Remove</button></div>`;
  function jobTools(j) {
    const inv = j.invoice || {}, today = new Date().toISOString().slice(0, 10);
    const pays = (board.payments || []).filter(p => p.job_id === j.id);
    const ag = j.agreement || {};
    const sv = (board.services || []).includes(j.service) ? j.service : '';
    return `<div class="dash-tools">
      <h4>Project agreement</h4>
      ${ag.signed ? `<p class="dash-signed">Signed by <b>${esc(ag.signed.name)}</b> on ${esc(when(ag.signed.at))}. Editing it makes a new version that needs signing again.</p>` : '<p class="dash-hint">What you\u2019re doing, for how much. The client signs it on a private link.</p>'}
      <label for="ags-${j.id}">What&rsquo;s included</label><textarea id="ags-${j.id}" rows="4" maxlength="2000" placeholder="One-page website: home section, links, contact form, mobile-friendly, connected to your domain.">${esc(ag.scope || '')}</textarea>
      <div class="dash-two"><div><label for="agp-${j.id}">Price</label><input id="agp-${j.id}" maxlength="40" placeholder="$300" value="${esc(ag.price || j.price || '')}"></div>
        <div><label for="agr-${j.id}">Rounds of changes</label><input id="agr-${j.id}" maxlength="60" placeholder="2 rounds" value="${esc(ag.rounds || '')}"></div></div>
      <label for="agt-${j.id}">Timeline</label><input id="agt-${j.id}" maxlength="120" placeholder="About 2 weeks after content is in" value="${esc(ag.timeline || '')}">
      <label for="agy-${j.id}">Payment</label><textarea id="agy-${j.id}" rows="2" maxlength="600" placeholder="50% to start, the rest before launch.">${esc(ag.payment || '')}</textarea>
      <label for="agx-${j.id}">Anything else <span>(optional)</span></label><textarea id="agx-${j.id}" rows="2" maxlength="1500" placeholder="Client provides text and photos. Client owns the site and domain.">${esc(ag.extra || '')}</textarea>
      <div class="dash-actions"><button type="button" class="dash-btn dash-small dash-primary" data-tool="ag-save" data-id="${j.id}">Save agreement</button>
        ${j.agreement ? (j.agr_token ? `<button type="button" class="dash-btn dash-small" data-tool="copy-ag" data-id="${j.id}">Copy signing link</button><a class="dash-btn dash-small" href="/agree/?a=${esc(j.agr_token)}" target="_blank" rel="noopener noreferrer">View</a><button type="button" class="dash-btn dash-small dash-danger" data-tool="ag-off" data-id="${j.id}">Turn off link</button>` : `<button type="button" class="dash-btn dash-small" data-tool="ag-on" data-id="${j.id}">Turn link back on</button>`) : ''}</div>
      <h4>Referral link</h4>
      <p class="dash-hint">For happy clients to share. Quote requests that come through it show &ldquo;Referred by ${esc(j.client)}&rdquo;.</p>
      <div class="dash-actions">${j.ref_code ? `<code class="dash-code">${esc(location.origin)}/work/?ref=${esc(j.ref_code)}</code><button type="button" class="dash-btn dash-small" data-tool="copy-ref" data-id="${j.id}">Copy</button><button type="button" class="dash-btn dash-small dash-danger" data-tool="ref-off" data-id="${j.id}">Turn off</button>` : `<button type="button" class="dash-btn dash-small" data-tool="ref-on" data-id="${j.id}">Make a referral link</button>`}</div>
      <h4>Client page</h4>
      <p class="dash-hint">One private link for ${esc(j.client)}: stage, due date, your note, plus their agreement and invoice when those are on. Never shows contact info or your private notes.</p>
      <div class="dash-actions">${j.token ? `<button type="button" class="dash-btn dash-small dash-primary" data-tool="copy-status" data-id="${j.id}">Copy link</button><a class="dash-btn dash-small" href="/status/?s=${esc(j.token)}" target="_blank" rel="noopener noreferrer">View</a><button type="button" class="dash-btn dash-small dash-danger" data-tool="status-off" data-id="${j.id}">Turn off</button>`
        : `<button type="button" class="dash-btn dash-small dash-primary" data-tool="status-on" data-id="${j.id}">Turn on client page</button>`}</div>
      <label for="cn-${j.id}">Note for the client <span>(shows on their page)</span></label>
      <textarea id="cn-${j.id}" rows="2" maxlength="600" placeholder="Homepage is done. Waiting on your photos for the gallery.">${esc(j.client_note || '')}</textarea>
      <button type="button" class="dash-btn dash-small" data-tool="note" data-id="${j.id}">Save note</button>
      <h4>Invoice</h4>
      <div class="dash-inv" id="inv-${j.id}">${(inv.items?.length ? inv.items : [{}]).map(invRow).join('')}</div>
      <button type="button" class="dash-btn dash-small" data-tool="inv-add" data-id="${j.id}">+ Add a line</button>
      <div class="dash-two">
        <div><label for="idp-${j.id}">Deposit %</label><input id="idp-${j.id}" type="number" min="0" max="100" inputmode="numeric" value="${inv.deposit ?? 50}"></div>
        <div><label for="ist-${j.id}">Status</label><select id="ist-${j.id}">${[['unpaid', 'Unpaid'], ['deposit', 'Deposit paid'], ['paid', 'Paid in full']].map(([k, v]) => `<option value="${k}"${(inv.status || 'unpaid') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="dash-two">
        <div><label for="ipl-${j.id}">Pay link <span>(Ko-fi, PayPal, Stripe&hellip;)</span></label><input id="ipl-${j.id}" type="url" placeholder="https://ko-fi.com/..." value="${esc(inv.payLink || '')}"></div>
        <div><label for="ipb-${j.id}">Button text</label><input id="ipb-${j.id}" maxlength="40" placeholder="Pay on Ko-fi" value="${esc(inv.payLabel || '')}"></div>
      </div>
      <label for="itm-${j.id}">Terms <span>(optional)</span></label>
      <textarea id="itm-${j.id}" rows="2" maxlength="600" placeholder="Half up front, the rest before launch.">${esc(inv.terms || '')}</textarea>
      <div class="dash-actions"><button type="button" class="dash-btn dash-small dash-primary" data-tool="inv-save" data-id="${j.id}">Save invoice</button>
        ${j.invoice ? (j.inv_token ? `<button type="button" class="dash-btn dash-small" data-tool="copy-inv" data-id="${j.id}">Copy invoice link</button><a class="dash-btn dash-small" href="/invoice/?i=${esc(j.inv_token)}" target="_blank" rel="noopener noreferrer">View</a><button type="button" class="dash-btn dash-small dash-danger" data-tool="inv-off" data-id="${j.id}">Turn off link</button>` : `<button type="button" class="dash-btn dash-small" data-tool="inv-on" data-id="${j.id}">Turn link back on</button>`) : ''}</div>
      <h4>Payments received</h4>
      ${pays.length ? `<ul class="dash-pays">${pays.map(p => `<li>${esc(p.day)} · <b>${esc(money(p.amount_cents))}</b> · ${esc(p.method)}${p.note ? ` · ${esc(p.note)}` : ''} <button type="button" class="dash-btn dash-small dash-danger" data-tool="pay-del" data-pid="${p.id}" data-id="${j.id}">Delete</button></li>`).join('')}</ul>` : '<p class="dash-hint">None recorded yet.</p>'}
      <div class="dash-pay-form">
        <div><label for="pa-${j.id}">Amount</label><input id="pa-${j.id}" inputmode="decimal" placeholder="150"></div>
        <div><label for="pd-${j.id}">Date</label><input id="pd-${j.id}" type="date" value="${today}"></div>
        <div><label for="pm-${j.id}">How</label><select id="pm-${j.id}">${(board.methods || []).map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
        <button type="button" class="dash-btn dash-small dash-primary" data-tool="pay-add" data-id="${j.id}">Record payment</button>
      </div>
      <p class="dash-hint">Ko-fi payments already count in Income automatically, so recording one here just ties it to this job.</p>
    </div>`;
  }
  function drawJobs() {
    const list = board.jobs.filter(j => (jbView === 'active' ? j.stage !== 'done' : j.stage === jbView));
    const today = new Date().toISOString().slice(0, 10);
    $('jb-body').innerHTML = (editingJob === 'new' ? jobForm() : '') + (list.length ? `<ul class="dash-list">${list.map(j => editingJob === j.id ? `<li class="dash-row">${jobForm(j)}</li>` : `
      <li class="dash-row dash-job stage-${esc(j.stage)}"><div class="dash-row-main">
        <b>${esc(j.client)}</b> <span class="dash-meta">${esc(j.service || '')}${j.price ? ` · ${esc(j.price)}` : ''}</span>
        <p class="dash-req-meta">${esc(STAGE[j.stage])}${j.due ? ` · due ${esc(j.due)}${j.stage !== 'done' && j.due < today ? ' <span class="dash-late">overdue</span>' : ''}` : ''}${j.contact ? ` · ${esc(j.contact)}` : ''}</p>
        ${j.notes ? `<p class="dash-note-text">${esc(j.notes)}</p>` : ''}
        <p class="dash-job-tags">${j.agreement ? `<span>${j.agreement.signed ? `Agreement signed by ${esc(j.agreement.signed.name)}` : 'Agreement not signed yet'}</span>` : ''}${j.token ? '<span>Client link on</span>' : ''}${j.invoice ? `<span>Invoice ${esc(j.invoice.number)} · ${esc({ unpaid: 'unpaid', deposit: 'deposit paid', paid: 'paid' }[j.invoice.status])}${j.inv_token ? '' : ' · link off'}</span>` : ''}${paidFor(j.id) ? `<span>Received ${esc(money(paidFor(j.id)))}</span>` : ''}</p>
        <details class="dash-job-more" data-job-more="${j.id}"${openMore === j.id ? ' open' : ''}><summary>Agreement, client link, invoice &amp; payments</summary>${jobTools(j)}</details></div>
        <div class="dash-row-actions">
          <label class="sr-only" for="js-${j.id}">Stage</label><select id="js-${j.id}" data-job-stage="${j.id}">${Object.entries(STAGE).map(([k, v]) => `<option value="${k}"${j.stage === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <button type="button" class="dash-btn dash-small" data-job-edit="${j.id}">Edit</button>
          <button type="button" class="dash-btn dash-small dash-danger" data-job-del="${j.id}">Delete</button>
        </div></li>`).join('')}</ul>` : `<p class="dash-note">${jbView === 'active' ? 'No active jobs.' : 'Nothing here.'}</p>`);
  }
  // Calendar: job due dates + upcoming streams
  let calMonth = new Date(); calMonth.setDate(1); let streams = null, calPick = null;
  const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  async function drawCal() {
    if (streams === null) { streams = []; try { const d = (await api('streams')).data; streams = (d.upcoming || []).map(s => ({ day: dkey(new Date(s.start)), title: s.title || 'Stream', time: new Date(s.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })); } catch {} }
    const y = calMonth.getFullYear(), m = calMonth.getMonth(), first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), today = dkey(new Date());
    $('cal-month').textContent = first.toLocaleDateString([], { month: 'long', year: 'numeric' });
    const due = {}; board.jobs.filter(j => j.due && j.stage !== 'done').forEach(j => (due[j.due] ||= []).push(j));
    const st = {}; streams.forEach(s => (st[s.day] ||= []).push(s));
    const au = {}; (board.auditions || []).filter(a => a.deadline && ['sent', 'callback'].includes(a.status)).forEach(a => (au[a.deadline] ||= []).push(a));
    let cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<span class="cal-h" aria-hidden="true">${d}</span>`).join('') + '<span></span>'.repeat(first.getDay());
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, J = due[k] || [], S = st[k] || [], A = au[k] || [];
      cells += `<button type="button" class="cal-d${k === today ? ' is-today' : ''}${k === calPick ? ' is-pick' : ''}${J.length && k < today ? ' is-late' : ''}" data-day="${k}" aria-label="${d}${J.length ? `, ${J.length} job${J.length > 1 ? 's' : ''} due` : ''}${A.length ? `, ${A.length} audition deadline${A.length > 1 ? 's' : ''}` : ''}${S.length ? `, ${S.length} stream${S.length > 1 ? 's' : ''}` : ''}">${d}<i>${J.length ? '<b class="cal-job"></b>' : ''}${A.length ? '<b class="cal-aud"></b>' : ''}${S.length ? '<b class="cal-stream"></b>' : ''}</i></button>`;
    }
    $('cal-grid').innerHTML = cells;
    const P = calPick && (due[calPick] || st[calPick] || au[calPick]) ? calPick : null;
    $('cal-day').innerHTML = P ? `<b>${esc(new Date(P + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }))}</b><ul>${(due[P] || []).map(j => `<li>Due: ${esc(j.client)} (${esc(j.service || 'job')}, ${esc(STAGE[j.stage])})</li>`).join('')}${(au[P] || []).map(a => `<li>Audition deadline: ${esc(a.project)}${a.role ? ` (${esc(a.role)})` : ''}</li>`).join('')}${(st[P] || []).map(s => `<li>Stream ${esc(s.time)}: ${esc(s.title)}</li>`).join('')}</ul>` : '';
  }
  $('cal-prev').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); drawCal(); });
  $('cal-next').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); drawCal(); });
  $('cal-grid').addEventListener('click', e => { const b = e.target.closest('[data-day]'); if (b) { calPick = b.dataset.day; drawCal(); } });


  // ---------- Streams (the stream calendar) ----------
  let stBoard = null, stEdit = null;
  const DN = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' }, DORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const LENS = [30, 60, 90, 120, 150, 180, 210, 240, 300, 360, 480, 600, 720];
  const t12 = hm => { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
  const len = m => (m % 60 ? `${Math.floor(m / 60) ? `${Math.floor(m / 60)}h ` : ''}${m % 60}m` : `${m / 60}h`);
  const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const todayET = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const etWhen = iso => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const stForm = (s = {}) => {
    const weekly = s.repeat === 'weekly', [d, t] = (s.start || `${todayET()}T20:00`).split('T'), mins = s.minutes || 180;
    return `<form class="dash-job-form" data-st-form="${s.id || ''}">
    <label for="sf-title">Title</label><input id="sf-title" maxlength="80" required placeholder="Chill games and car talk" value="${esc(s.title || '')}">
    <div class="dash-two"><div><label for="sf-repeat">Repeats</label><select id="sf-repeat"><option value="none">One time</option><option value="weekly"${weekly ? ' selected' : ''}>Every week</option></select></div>
      <div><label for="sf-date" id="sf-date-l">${weekly ? 'Starting' : 'Date'}</label><input id="sf-date" type="date" required value="${esc(d)}"></div></div>
    <fieldset class="dash-checks sf-weekly"${weekly ? '' : ' hidden'}><legend>On these days</legend><div class="dash-days">${DORDER.map(k => `<label><input type="checkbox" value="${k}"${(s.days || []).includes(k) ? ' checked' : ''}> ${DN[k]}</label>`).join('')}</div></fieldset>
    <div class="dash-two"><div><label for="sf-time">Starts (Eastern)</label><input id="sf-time" type="time" required value="${esc(t)}"></div>
      <div><label for="sf-len">Length</label><select id="sf-len">${[...new Set([...LENS, mins])].sort((a, b) => a - b).map(m => `<option value="${m}"${m === mins ? ' selected' : ''}>${len(m)}</option>`).join('')}</select></div></div>
    <div class="sf-weekly"${weekly ? '' : ' hidden'}><label for="sf-until">Ends on <span>(optional)</span></label><input id="sf-until" type="date" value="${esc(s.until || '')}"></div>
    <label for="sf-link">Link <span>(optional, like a special stream&rsquo;s page)</span></label><input id="sf-link" type="url" placeholder="https://..." value="${esc(s.link || '')}">
    <label for="sf-note">Description <span>(optional, shows in calendar apps)</span></label><textarea id="sf-note" rows="2" maxlength="400">${esc(s.note || '')}</textarea>
    <div class="dash-actions"><button type="submit" class="dash-btn dash-primary">Save</button><button type="button" class="dash-btn" data-st-cancel>Cancel</button></div></form>`;
  };
  function drawStreams() {
    const b = stBoard, today = todayET();
    if (!b) return;
    const weekly = b.streams.filter(s => s.repeat === 'weekly'), once = b.streams.filter(s => s.repeat !== 'weekly');
    const soon = once.filter(s => s.start.slice(0, 10) >= today), old = once.filter(s => s.start.slice(0, 10) < today).reverse();
    const item = s => {
      if (stEdit === s.id) return `<li class="dash-row">${stForm(s)}</li>`;
      const [d, t] = s.start.split('T'), w = s.repeat === 'weekly';
      const ended = w && s.until && s.until < today, skips = (s.skips || []).filter(x => x >= today);
      return `<li class="dash-row${ended || (!w && d < today) ? ' is-hidden' : ''}"><div class="dash-row-main"><b>${esc(s.title)}</b>
        <p class="dash-req-meta">${w ? `Every ${DORDER.filter(k => s.days.includes(k)).map(k => DN[k]).join(', ')}` : esc(fmtDay(d))} · ${esc(t12(t))} · ${esc(len(s.minutes))}${w ? ` · from ${esc(fmtDay(d))}${s.until ? ` until ${esc(fmtDay(s.until))}` : ''}${ended ? ' · <span class="dash-late">ended</span>' : ''}` : ''}</p>
        ${s.link ? `<p class="dash-req-links"><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer nofollow">Link</a></p>` : ''}${s.note ? `<p class="dash-note-text">${esc(s.note)}</p>` : ''}
        ${w ? `<div class="dash-skip"><label for="sk-${s.id}">Skip a date</label><input id="sk-${s.id}" type="date" min="${today}"><button type="button" class="dash-btn dash-small" data-st-skip="${s.id}">Skip</button></div>
        ${skips.length ? `<p class="dash-skips">Skipping: ${skips.map(x => `<button type="button" class="dash-chip-btn" data-st-unskip="${s.id}" data-date="${x}" aria-label="Stop skipping ${esc(fmtDay(x))}">${esc(fmtDay(x))} <span aria-hidden="true">&times;</span></button>`).join(' ')}</p>` : ''}` : ''}</div>
        <div class="dash-row-actions"><button type="button" class="dash-btn dash-small" data-st-edit="${s.id}">Edit</button><button type="button" class="dash-btn dash-small dash-danger" data-st-del="${s.id}">Delete</button></div></li>`;
    };
    $('st-body').innerHTML = (stEdit === 'new' ? stForm() : '')
      + (weekly.length ? `<h3 class="dash-h3">Every week</h3><ul class="dash-list">${weekly.map(item).join('')}</ul>` : '')
      + (soon.length ? `<h3 class="dash-h3">One-time</h3><ul class="dash-list">${soon.map(item).join('')}</ul>` : '')
      + (old.length ? `<details class="dash-job-more"><summary>Past one-time streams (${old.length})</summary><ul class="dash-list">${old.map(item).join('')}</ul></details>` : '')
      + (!b.streams.length && stEdit !== 'new' ? '<p class="dash-note">No streams yet. Tap &ldquo;Add a stream&rdquo; to set up your schedule.</p>' : '');
    $('st-up').innerHTML = b.upcoming.length ? `<ul class="dash-pays">${b.upcoming.slice(0, 20).map(e => `<li><b>${esc(etWhen(e.start))}</b> · ${esc(e.title)}</li>`).join('')}</ul>` : '<p class="dash-note">Nothing in the next few weeks. The home page shows &ldquo;no streams scheduled&rdquo; until you add some.</p>';
    $('st-import-card').hidden = !b.canImport && !b.pastCount;
    $('st-import').hidden = !b.canImport;
    $('st-clear-past').hidden = !b.pastCount;
    $('st-import-text').textContent = (b.pastCount ? `${b.pastCount} past stream${b.pastCount === 1 ? ' is' : 's are'} saved for Dismeigh Rewind. ` : '')
      + (b.canImport ? 'This copies the streams that already happened on Calendar.online (just titles and times) so Rewind keeps your history. Running it again replaces the copy. Upcoming streams aren’t copied: add your regular ones above. Once you’re happy, you can delete CALENDAR_FEED_URL in Cloudflare.' : '');
  }
  const stAct = async body => {
    const { status, data } = await api('streams', body);
    if (status !== 200) { flash($('st-msg'), data.error || 'Couldn’t save.'); return null; }
    stBoard = data; streams = null; drawStreams(); drawGraphic(); return data;
  };

  // Pre-stream checklist
  let ck = { items: [], done: [] };
  function drawCk() {
    const n = ck.done.length, t = ck.items.length;
    $('ck-list').innerHTML = ck.items.map(x => `<li><label class="dash-check-line"><input type="checkbox" data-ck="${x.id}"${ck.done.includes(x.id) ? ' checked' : ''}> <span>${esc(x.text)}</span></label></li>`).join('') || '<li class="dash-note">No items. Tap Edit list to add some.</li>';
    $('ck-chip').className = `dash-chip ${t && n === t ? 'dash-chip-ok' : ''}`; $('ck-chip-text').textContent = t && n === t ? 'Ready to go live' : `${n} of ${t}`;
  }
  const ckAct = async body => { const { status, data } = await api('checklist', body); if (status !== 200) return flash($('ck-msg'), data.error || 'Couldn’t save.'); ck = data; drawCk(); return data; };
  $('ck-list').addEventListener('change', async e => {
    const b = e.target.closest('[data-ck]'); if (!b) return;
    const d = await ckAct({ action: 'tick', id: Number(b.dataset.ck), on: b.checked });
    if (d && d.items.length && d.done.length === d.items.length) flash($('ck-msg'), 'All set. Have a good stream!');
  });
  $('ck-reset').addEventListener('click', () => ckAct({ action: 'reset' }));
  $('ck-edit').addEventListener('click', () => { $('ck-items').value = ck.items.map(x => x.text).join('\n'); $('ck-editor').hidden = false; $('ck-items').focus(); });
  $('ck-cancel').addEventListener('click', () => { $('ck-editor').hidden = true; });
  $('ck-save').addEventListener('click', async () => {
    const lines = $('ck-items').value.split('\n').map(x => x.trim()).filter(Boolean), used = new Set();
    const items = lines.map(t => { const old = ck.items.find(x => x.text === t && !used.has(x.id)); if (old) used.add(old.id); return { id: old ? old.id : 0, text: t }; });
    if (await ckAct({ action: 'items', items })) { $('ck-editor').hidden = true; flash($('ck-msg'), 'List saved.'); }
  });

  // Schedule graphic
  const SG = { square: [1080, 1080], story: [1080, 1920], wide: [1600, 900] };
  let sgAvatar = null;
  const etDay = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));
  const etTime = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  const plusDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const short = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  function drawGraphic() {
    const wk = stBoard?.weeks?.[$('sg-week').value]; if (!wk) return;
    const [W, H] = SG[$('sg-size').value], c = $('sg-canvas'), x = c.getContext('2d'); c.width = W; c.height = H;
    const C = { ink: '#14110f', ink2: '#1e1a17', paper: '#efe6d2', dim: '#8f8471', mustard: '#e3a92b', red: '#b73b2c' };
    const fit = (t, font, size, max, min = 12) => { let z = size; do { x.font = font.replace('#', z); if (x.measureText(t).width <= max) break; z -= 2; } while (z > min); return z; };
    const wide = W > H, P = Math.round(Math.min(W, H) * 0.065);
    x.fillStyle = C.ink; x.fillRect(0, 0, W, H);
    // Header
    const days = Array.from({ length: 7 }, (_, i) => { const d = plusDays(wk.start, i); return { d, ev: (wk.events || []).filter(e => etDay(e.start) === d) }; });
    const hx = P, hy = P, hw = wide ? W * 0.34 : W - 2 * P;
    const av = wide ? hw * 0.55 : Math.min(W, H) * (H > W ? 0.2 : 0.16);
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillStyle = C.mustard; x.font = `${Math.round(av * 0.16)}px "Special Elite", monospace`;
    const kick = 'STREAM SCHEDULE', range = `${short(days[0].d)} – ${short(days[6].d)}`;
    if (wide) {
      if (sgAvatar) { x.drawImage(sgAvatar, hx, hy, av, av); x.strokeStyle = C.paper; x.lineWidth = 6; x.strokeRect(hx, hy, av, av); }
      let y = hy + av + av * 0.3; x.fillText(kick, hx, y);
      x.fillStyle = C.paper; const z = fit('DISMEIGH', '#px Anton, Impact, sans-serif', av * 0.5, hw); y += z * 1.05; x.fillText('DISMEIGH', hx, y);
      x.fillStyle = C.dim; x.font = `${Math.round(av * 0.15)}px "Special Elite", monospace`; x.fillText(range, hx, y + av * 0.24);
    } else {
      if (sgAvatar) { x.drawImage(sgAvatar, W - P - av, hy, av, av); x.strokeStyle = C.paper; x.lineWidth = 6; x.strokeRect(W - P - av, hy, av, av); }
      let y = hy + av * 0.22; x.fillText(kick, hx, y);
      x.fillStyle = C.paper; const z = fit('DISMEIGH', '#px Anton, Impact, sans-serif', av * 0.62, W - 3 * P - av); y += z * 1.0; x.fillText('DISMEIGH', hx, y);
      x.fillStyle = C.dim; x.font = `${Math.round(av * 0.15)}px "Special Elite", monospace`; x.fillText(range, hx, y + av * 0.24);
    }
    // Rows
    const foot = Math.min(W, H) * 0.07;
    const rx = wide ? W * 0.42 : P, rw = W - P - rx, ry = wide ? P : hy + av + (H > W ? P * 2.2 : P * 1.6), rh = (H - P - foot - ry) / 7;
    // Slabs: under the header, never across the text
    const M = Math.min(W, H);
    x.save();
    if (wide) { x.beginPath(); x.rect(0, 0, rx - P * 0.6, H); x.clip(); x.translate(0, H - P - foot - M * 0.02); x.rotate(-0.05); }
    else { x.translate(0, ry - P * 0.55); x.rotate(-0.025); }
    x.fillStyle = C.mustard; x.fillRect(-W * 0.2, 0, W * 1.5, M * 0.026); x.fillStyle = C.red; x.fillRect(-W * 0.2, M * 0.026, W * 1.5, M * 0.012); x.restore();
    days.forEach((day, i) => {
      const y = ry + i * rh, on = day.ev.length > 0;
      x.fillStyle = i % 2 ? C.ink : C.ink2; x.fillRect(rx, y, rw, rh - 4);
      if (on) { x.fillStyle = C.mustard; x.fillRect(rx, y, 8, rh - 4); }
      const dn = new Date(`${day.d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' }).toUpperCase();
      x.fillStyle = on ? C.mustard : C.dim; x.font = `${Math.round(rh * 0.38)}px Anton, Impact, sans-serif`; x.fillText(dn, rx + rh * 0.35, y + rh * 0.5);
      x.font = `${Math.round(rh * 0.2)}px "Special Elite", monospace`; x.fillStyle = C.dim; x.fillText(short(day.d), rx + rh * 0.35, y + rh * 0.78);
      const tx = rx + rh * 1.75, tw = rw - (tx - rx) - rh * 0.3;
      if (!on) { x.fillStyle = C.dim; x.font = `${Math.round(rh * 0.28)}px "Special Elite", monospace`; x.fillText('Off', tx, y + rh * 0.6); return; }
      const e = day.ev[0], more = day.ev.length > 1 ? `  +${day.ev.length - 1} more` : '';
      x.fillStyle = C.mustard; x.font = `${Math.round(rh * 0.24)}px "Special Elite", monospace`; x.fillText(etTime(e.start) + ' ET' + more, tx, y + rh * 0.38);
      x.fillStyle = C.paper; let t = e.title;
      x.font = `800 ${Math.round(rh * (wide ? 0.22 : 0.24))}px "Work Sans", sans-serif`; while (x.measureText(t).width > tw && t.length > 4) t = t.slice(0, -2).trimEnd() + '…';
      x.fillText(t, tx, y + rh * 0.74);
    });
    x.fillStyle = C.paper; x.font = `${Math.round(foot * 0.42)}px "Special Elite", monospace`; x.textAlign = wide ? 'left' : 'center';
    x.fillText('twitch.tv/dismeigh', wide ? hx : W / 2, H - P * 0.6 - foot * 0.2);
  }
  const sgReady = Promise.all([document.fonts.load('40px Anton'), document.fonts.load('20px "Special Elite"'), document.fonts.load('800 20px "Work Sans"'),
    new Promise(res => { const i = new Image(); i.onload = () => { sgAvatar = i; res(); }; i.onerror = res; i.src = '/avatar-420.jpg?v=2'; })]).catch(() => {});
  ['sg-week', 'sg-size'].forEach(id => $(id).addEventListener('change', drawGraphic));
  const sgBlob = () => new Promise(r => $('sg-canvas').toBlob(r, 'image/png'));
  const sgName = () => `dismeigh-schedule-${stBoard?.weeks?.[$('sg-week').value]?.start || 'week'}-${$('sg-size').value}.png`;
  $('sg-dl').addEventListener('click', async () => {
    const b = await sgBlob(); if (!b) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = sgName(); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  if (navigator.canShare) {
    $('sg-share').hidden = false;
    $('sg-share').addEventListener('click', async () => { const b = await sgBlob(); if (!b) return; const f = new File([b], sgName(), { type: 'image/png' }); if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); } catch {} } else $('sg-dl').click(); });
  }

  // Stream stats log
  let ssRows = [], ssEdit = 0, ssBest = null;
  const ssNum = v => (v === null || v === undefined ? '' : String(v));
  const lenText = m => (m == null ? '' : `${Math.floor(m / 60) ? `${Math.floor(m / 60)}h ` : ''}${m % 60 ? `${m % 60}m` : ''}`.trim() || '0m');
  const lenParse = t => { const v = String(t || '').trim(); if (!v) return null; const c = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/); if (c) return +c[1] * 60 + +c[2];
    const h = v.match(/(\d+(?:\.\d+)?)\s*h/i), m = v.match(/(\d+)\s*m/i); if (h || m) return Math.round((h ? +h[1] * 60 : 0) + (m ? +m[1] : 0)); const n = Number(v); return Number.isFinite(n) ? Math.round(n * 60) : null; };
  // Reads numbers out of a pasted Twitch stream summary. Handles "Label 12" and "12 Label" layouts; you check them before saving.
  function readTwitch(raw) {
    const t = String(raw || '').replace(/ /g, ' ');
    const num = v => { const m = String(v).replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([kKmM]?)$/); if (!m) return null; return Math.round(Number(m[1]) * (m[2].toLowerCase() === 'k' ? 1e3 : m[2].toLowerCase() === 'm' ? 1e6 : 1) * 10) / 10; };
    const N = '(\\d[\\d,]*(?:\\.\\d+)?\\s*[kKmM]?)';
    const L = { avg: 'average viewers|avg\\.? viewers|average ccv', peak: 'peak viewers|max(?:imum)? viewers|peak ccv', follows: 'new followers|followers gained|follows gained|new follows', chatters: 'unique chatters|chatters', views: 'live views' };
    const fwd = {}, back = {};
    for (const [k, l] of Object.entries(L)) {
      const f = t.match(new RegExp(`(?:${l})\\s*:?[ \\t]*\\n?[ \\t]*${N}(?![\\d%])`, 'i')); if (f) fwd[k] = num(f[1]);
      const b = t.match(new RegExp(`${N}[ \\t]*\\n?[ \\t]*(?:${l})`, 'i')); if (b) back[k] = num(b[1]);
    }
    const use = Object.keys(back).length > Object.keys(fwd).length ? back : fwd;
    const len = t.match(/(?:stream(?:ed)? (?:length|time)|airtime|hours streamed|duration|time live)\s*:?\s*\n?\s*((?:\d+\s*h(?:ours?|rs?)?\s*)?(?:\d+\s*m(?:in(?:utes?)?)?)?|\d{1,2}:\d{2}(?::\d{2})?)/i);
    if (len && len[1].trim()) use.minutes = lenParse(len[1].replace(/ours?|rs?|in(?:utes?)?/gi, ''));
    return use;
  }
  function drawStats() {
    const rows = ssRows, day = 86400000, now = Date.now();
    const inRange = (r, a, b) => { const t = Date.parse(r.day + 'T12:00:00'); return t > now - a * day && t <= now - b * day; };
    const sum = (list, k) => list.reduce((s, r) => s + (r[k] || 0), 0), avgOf = (list, k) => { const v = list.filter(r => r[k] != null); return v.length ? sum(v, k) / v.length : null; };
    const cur = rows.filter(r => inRange(r, 30, 0)), prev = rows.filter(r => inRange(r, 60, 30));
    const delta = (a, b) => (a == null || b == null || !b ? '' : ` <span class="${a >= b ? 'is-up' : 'is-down'}">${a >= b ? '▲' : '▼'} ${Math.abs(Math.round((a - b) / b * 100))}%</span>`);
    const a1 = avgOf(cur, 'avg'), a0 = avgOf(prev, 'avg'), f1 = sum(cur, 'follows'), f0 = sum(prev, 'follows'), p1 = Math.max(0, ...cur.map(r => r.peak || 0));
    $('ss-sum').innerHTML = rows.length ? `<div class="dash-stats dash-ss-stats">
      <div class="dash-stat"><span class="dash-stat-k">Streams, 30 days</span><b>${cur.length}</b></div>
      <div class="dash-stat"><span class="dash-stat-k">Avg viewers</span><b>${a1 == null ? '–' : a1.toFixed(1)}${delta(a1, a0)}</b></div>
      <div class="dash-stat"><span class="dash-stat-k">New followers</span><b>+${f1}${delta(f1, f0)}</b></div>
      <div class="dash-stat"><span class="dash-stat-k">Best peak</span><b>${p1}</b></div></div><p class="dash-hint">Compared with the 30 days before.</p>` : '<p class="dash-note">No streams logged yet. After a stream, tap &ldquo;Log a stream&rdquo; and paste Twitch&rsquo;s summary email.</p>';
    // Chart: average and peak viewers for the last 20 logged streams
    const pts = rows.filter(r => r.avg != null || r.peak != null).slice(0, 20).reverse();
    if (pts.length >= 2) {
      const W = 600, H = 180, pad = 28, max = Math.max(1, ...pts.map(r => Math.max(r.avg || 0, r.peak || 0)));
      const X = i => pad + i * (W - 2 * pad) / (pts.length - 1), Y = v => H - pad - v / max * (H - 2 * pad);
      const line = k => pts.map((r, i) => r[k] == null ? '' : `${X(i)},${Y(r[k])}`).filter(Boolean).join(' ');
      $('ss-chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average and peak viewers for the last ${pts.length} logged streams, highest ${max}">
        <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" class="ss-axis"/><text x="${pad}" y="${pad - 10}" class="ss-lbl">${max}</text>
        <polyline points="${line('peak')}" class="ss-peak"/><polyline points="${line('avg')}" class="ss-avg"/>
        <text x="${pad}" y="${H - 6}" class="ss-lbl">${esc(pts[0].day)}</text><text x="${W - pad}" y="${H - 6}" class="ss-lbl" text-anchor="end">${esc(pts.at(-1).day)}</text></svg>
        <p class="dash-hint"><span class="ss-key ss-key-avg"></span> average <span class="ss-key ss-key-peak"></span> peak</p>`;
    } else $('ss-chart').innerHTML = '';
    const B = ssBest;
    if (!B || B.counted < 3) $('ss-best').innerHTML = rows.length ? `<h3 class="dash-h3">Best time to stream</h3><p class="dash-note">Log ${Math.max(1, 3 - (B?.counted || 0))} more stream${3 - (B?.counted || 0) === 1 ? '' : 's'} with average viewers to see which days and start times do best.</p>` : '';
    else {
      const bars = (list, unit) => { const top = Math.max(1, ...list.map(x => x.avg)); return `<ul class="dash-bars">${list.map(x => `<li><span>${esc(x.label)}</span><span class="dash-bar"><i style="width:${Math.round(x.avg / top * 100)}%"></i></span><b>${x.avg}</b></li>`).join('')}</ul><p class="dash-hint">Average viewers, from ${list.reduce((s, x) => s + x.n, 0)} logged ${unit}.</p>`; };
      const tip = [B.bestDay && `<b>${esc(B.bestDay.label)}s</b> (${B.bestDay.avg} avg over ${B.bestDay.n} streams)`, B.bestHour && `starting around <b>${esc(B.bestHour.label)}</b> (${B.bestHour.avg} avg)`].filter(Boolean).join(', ');
      $('ss-best').innerHTML = `<h3 class="dash-h3">Best time to stream</h3>${tip ? `<p class="dash-best-tip">Your best so far: ${tip}.</p>` : '<p class="dash-note">Not enough repeats yet to call a winner. Each day or time needs at least 2 streams.</p>'}
        <details class="dash-job-more"><summary>By day and start time</summary><h4 class="dash-h4">By day</h4>${bars(B.days, 'streams')}${B.hours.length ? `<h4 class="dash-h4">By start time <span class="dash-meta">(from your stream schedule)</span></h4>${bars(B.hours, 'streams that were on the schedule')}` : '<p class="dash-hint">Start times come from the Streams schedule. Streams that weren\u2019t on it only count by day.</p>'}</details>
        <p class="dash-hint">Small numbers swing a lot, so treat this as a hint, not a rule. It gets better the more you log.</p>`;
    }
    $('ss-list').innerHTML = rows.length ? `<div class="dash-table-wrap"><table class="dash-table"><thead><tr><th scope="col">Date</th><th scope="col">Avg</th><th scope="col">Peak</th><th scope="col">Follows</th><th scope="col">Chatters</th><th scope="col">Length</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${rows.slice(0, 30).map(r => `<tr><th scope="row">${esc(r.day)}${r.title ? `<small class="dash-meta"> ${esc(r.title)}</small>` : ''}${r.note ? `<br><small class="dash-meta">${esc(r.note)}</small>` : ''}</th><td>${ssNum(r.avg)}</td><td>${ssNum(r.peak)}</td><td>${r.follows == null ? '' : `+${r.follows}`}</td><td>${ssNum(r.chatters)}</td><td>${esc(lenText(r.minutes))}</td>
        <td><button type="button" class="dash-btn dash-small" data-ss-edit="${r.id}">Edit</button> <button type="button" class="dash-btn dash-small dash-danger" data-ss-del="${r.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '';
  }
  const ssFill = (r = {}) => {
    $('ss-day').value = r.day || todayET(); $('ss-title').value = r.title || ''; $('ss-note').value = r.note || ''; $('ss-paste').value = ''; $('ss-read-msg').textContent = '';
    for (const k of ['avg', 'peak', 'follows', 'chatters', 'views']) $(`ss-${k}`).value = ssNum(r[k]);
    $('ss-len').value = lenText(r.minutes);
  };
  // New records: celebrate, and offer a one-tap site banner
  const REC = { peak: ['Best peak ever', v => `${v} viewers at once`], avg: ['Best average ever', v => `${v} average viewers`], follows: ['Most new followers in one stream', v => `+${v} followers`] };
  function showRecords(list, day) {
    const box = $('ss-record');
    if (!list.length) { box.hidden = true; return; }
    const top = list[0], line = REC[top.kind][1](top.value);
    const recent = day >= plusDays(todayET(), -3), banner = `New record: ${line} ${recent ? 'last stream' : `on ${new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}! Thanks, crew.`;
    box.innerHTML = `<div class="dash-record-burst" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
      <p class="dash-record-kicker">New record${list.length > 1 ? 's' : ''}!</p>
      <ul>${list.map(r => `<li><b>${esc(REC[r.kind][0])}:</b> ${esc(REC[r.kind][1](r.value))} <span class="dash-meta">(was ${esc(String(r.before))})</span></li>`).join('')}</ul>
      <p class="dash-hint">Show it off? This puts a banner on every page for 2 days:</p><p class="dash-record-banner">&ldquo;${esc(banner)}&rdquo;</p>
      <div class="dash-actions"><button type="button" class="dash-btn dash-primary" id="rec-banner">Put it on the site</button><button type="button" class="dash-btn" id="rec-close">Not now</button></div>`;
    box.hidden = false; box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('rec-close').addEventListener('click', () => { box.hidden = true; });
    $('rec-banner').addEventListener('click', async () => {
      const { status, data } = await api('site', { what: 'banner', text: banner, link: 'https://twitch.tv/dismeigh', until: Date.now() + 48 * 3600000 });
      box.hidden = true; flash($('ss-msg'), status === 200 ? 'Banner is up for 2 days. Change it any time in the Site tab.' : (data.error || 'Couldn’t set the banner.'));
    });
  }
  const loadStats = async () => { const d = (await api('streamstats')).data; ssRows = d.stats || []; ssBest = d.best || null; drawStats(); };
  $('ss-new').addEventListener('click', () => { ssEdit = 0; ssFill(); $('ss-form').hidden = false; $('ss-paste').focus(); });
  $('ss-cancel').addEventListener('click', () => { $('ss-form').hidden = true; });
  $('ss-read').addEventListener('click', () => {
    const got = readTwitch($('ss-paste').value), names = { avg: 'average viewers', peak: 'peak viewers', follows: 'new followers', chatters: 'unique chatters', views: 'live views', minutes: 'length' };
    for (const k of ['avg', 'peak', 'follows', 'chatters', 'views']) if (got[k] != null) $(`ss-${k}`).value = got[k];
    if (got.minutes != null) $('ss-len').value = lenText(got.minutes);
    const found = Object.keys(got).filter(k => got[k] != null).map(k => names[k]);
    $('ss-read-msg').textContent = found.length ? `Found ${found.join(', ')}. Double-check them before saving.` : 'Couldn’t spot any numbers. Type them in below instead.';
  });
  $('ss-form').addEventListener('submit', async e => {
    e.preventDefault();
    const { status, data } = await api('streamstats', { action: 'save', id: ssEdit, day: $('ss-day').value, title: $('ss-title').value, note: $('ss-note').value, minutes: lenParse($('ss-len').value),
      ...Object.fromEntries(['avg', 'peak', 'follows', 'chatters', 'views'].map(k => [k, $(`ss-${k}`).value.trim()])) });
    if (status !== 200) return flash($('ss-msg'), data.error || 'Couldn’t save.');
    ssRows = data.stats || []; ssBest = data.best || null; drawStats(); $('ss-form').hidden = true; flash($('ss-msg'), 'Logged.');
    showRecords(data.records || [], $('ss-day').value);
  });
  $('ss-list').addEventListener('click', async e => {
    const ed = e.target.closest('[data-ss-edit]');
    if (ed) { const r = ssRows.find(x => x.id === Number(ed.dataset.ssEdit)); ssEdit = r.id; ssFill(r); $('ss-form').hidden = false; return $('ss-day').focus(); }
    const del = e.target.closest('[data-ss-del]');
    if (del && confirm('Delete these stats?')) { const { data } = await api('streamstats', { action: 'delete', id: Number(del.dataset.ssDel) }); ssRows = data.stats || []; ssBest = data.best || null; drawStats(); }
  });
  loaders.streams = async () => { stBoard = (await api('streams')).data; drawStreams(); sgReady.then(drawGraphic); ck = (await api('checklist')).data; drawCk(); loadStats(); };
  $('st-new').addEventListener('click', () => { stEdit = 'new'; drawStreams(); $('sf-title').focus(); });
  $('st-body').addEventListener('change', e => {
    if (e.target.id !== 'sf-repeat') return;
    const w = e.target.value === 'weekly';
    document.querySelectorAll('#st-body .sf-weekly').forEach(x => { x.hidden = !w; });
    $('sf-date-l').textContent = w ? 'Starting' : 'Date';
  });
  $('st-body').addEventListener('click', async e => {
    if (e.target.closest('[data-st-cancel]')) { stEdit = null; return drawStreams(); }
    const ed = e.target.closest('[data-st-edit]'); if (ed) { stEdit = Number(ed.dataset.stEdit); drawStreams(); return $('sf-title').focus(); }
    const del = e.target.closest('[data-st-del]'); if (del && confirm('Delete this stream? (To cancel just one night, use "Skip a date" instead.)')) { await stAct({ action: 'delete', id: Number(del.dataset.stDel) }); return flash($('st-msg'), 'Deleted.'); }
    const sk = e.target.closest('[data-st-skip]');
    if (sk) { const v = $(`sk-${sk.dataset.stSkip}`).value; if (!v) return flash($('st-msg'), 'Pick the date to skip first.'); if (await stAct({ action: 'skip', id: Number(sk.dataset.stSkip), date: v })) flash($('st-msg'), `Skipping ${fmtDay(v)}. It’s off the schedule.`); return; }
    const un = e.target.closest('[data-st-unskip]'); if (un && await stAct({ action: 'unskip', id: Number(un.dataset.stUnskip), date: un.dataset.date })) flash($('st-msg'), `${fmtDay(un.dataset.date)} is back on.`);
  });
  $('st-body').addEventListener('submit', async e => {
    const f = e.target.closest('[data-st-form]'); if (!f) return; e.preventDefault();
    const d = await stAct({ action: 'save', id: Number(f.dataset.stForm) || 0, title: $('sf-title').value, repeat: $('sf-repeat').value, date: $('sf-date').value, time: $('sf-time').value,
      minutes: Number($('sf-len').value), days: [...f.querySelectorAll('.dash-days input:checked')].map(x => x.value), until: $('sf-until').value, link: $('sf-link').value, note: $('sf-note').value });
    if (d) { stEdit = null; drawStreams(); flash($('st-msg'), 'Saved. It’s on the site now.'); }
  });
  $('st-import').addEventListener('click', async e => {
    e.target.disabled = true; flash($('st-import-msg'), 'Copying…');
    const { status, data } = await api('streams', { action: 'import' }); e.target.disabled = false;
    if (status !== 200) return flash($('st-import-msg'), data.error || 'Couldn’t copy them.');
    stBoard = data; drawStreams(); flash($('st-import-msg'), `Copied ${data.imported} past stream${data.imported === 1 ? '' : 's'}.`);
  });
  $('st-clear-past').addEventListener('click', async () => { if (confirm('Remove the imported past streams? Rewind will lose that history.')) { await stAct({ action: 'clearPast' }); flash($('st-import-msg'), 'Removed.'); } });


  // Today: the one card to check first
  async function loadToday() {
    $('td-date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    const get = p => api(p).then(r => r.data).catch(() => ({}));
    const [sched, ckd, ask, cl, co] = await Promise.all([fetch('/api/schedule', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})), get('checklist'), get('ask'), get('clients'), get('collab')]);
    const items = [], next = sched.next;
    const todayKey = todayET(), nextDay = next ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(next.start)) : '';
    if (next) items.push({ tab: 'streams', icon: next.live ? '🔴' : '📺', text: next.live ? `Live now: <b>${esc(next.title)}</b>` : `${nextDay === todayKey ? 'Streaming today' : 'Next stream'}: <b>${esc(next.title)}</b>, ${esc(etWhen(next.start))} ET` });
    else items.push({ tab: 'streams', icon: '📺', text: 'No streams on the schedule. Add some in the Streams tab.' });
    if (nextDay === todayKey && !next.live && ckd.items) { const d = ckd.done.length, t = ckd.items.length; items.push({ tab: 'streams', icon: d === t ? '✅' : '☐', text: d === t ? 'Pre-stream checklist done. Ready to go live.' : `Pre-stream checklist: <b>${d} of ${t}</b> done` }); }
    const waiting = (ask.questions || []).filter(q => !q.answered_at).length; if (waiting) items.push({ tab: 'guestbook', icon: '❓', text: `<b>${waiting}</b> question${waiting === 1 ? '' : 's'} waiting for an answer` });
    const newReq = (cl.requests || []).filter(r => r.status === 'new').length; if (newReq) items.push({ tab: 'clients', icon: '📥', text: `<b>${newReq}</b> new quote request${newReq === 1 ? '' : 's'}` });
    const newCo = (co.collabs || []).filter(c => !c.replied).length; if (newCo) items.push({ tab: 'clients', icon: '🤝', text: `<b>${newCo}</b> collab request${newCo === 1 ? '' : 's'} to answer` });
    const dueSoon = (cl.jobs || []).filter(j => j.due && j.stage !== 'done' && j.due <= plusDays(todayKey, 3)).length; if (dueSoon) items.push({ tab: 'clients', icon: '⏰', text: `<b>${dueSoon}</b> job${dueSoon === 1 ? '' : 's'} due in the next 3 days` });
    if (items.length === 1 && next) items.push({ tab: '', icon: '✨', text: 'Nothing else needs you right now.' });
    $('td-list').innerHTML = items.map(i => `<li>${i.tab ? `<button type="button" data-td="${i.tab}">` : '<span>'}<span aria-hidden="true">${i.icon}</span> <span>${i.text}</span>${i.tab ? '</button>' : '</span>'}</li>`).join('');
  }
  $('td-list').addEventListener('click', e => { const b = e.target.closest('[data-td]'); if (b) { openTab(b.dataset.td); $('panel').scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
  $('td-refresh').addEventListener('click', loadToday);
  // Income
  let incomeMonths = [];
  async function loadIncome() {
    const { data } = await api('clients?income=1'); incomeMonths = data.months || [];
    const sum = k => incomeMonths.reduce((s, m) => s + m[k], 0);
    const yr = String(new Date().getFullYear()), ytd = incomeMonths.filter(m => m.month.startsWith(yr)).reduce((s, m) => s + m.total, 0);
    const name = k => new Date(k + '-15').toLocaleDateString([], { month: 'short', year: 'numeric' });
    const ytdP = incomeMonths.filter(m => m.month.startsWith(yr)).reduce((s, m) => s + m.profit, 0);
    $('inc-body').innerHTML = incomeMonths.length ? `<p class="dash-inc-ytd">${yr} so far: <b>${esc(money(ytd))}</b> in &middot; <b class="${ytdP < 0 ? 'is-neg' : ''}">${esc(money(ytdP))}</b> profit</p>
      <div class="dash-table-wrap"><table class="dash-table"><thead><tr><th scope="col">Month</th><th scope="col">Tips</th><th scope="col">Memberships</th><th scope="col">Ko-fi sales</th><th scope="col">Clients</th><th scope="col">Total in</th><th scope="col">Expenses</th><th scope="col">Profit</th></tr></thead>
      <tbody>${incomeMonths.slice(0, 12).map(m => `<tr><th scope="row">${esc(name(m.month))}</th><td>${money(m.tips)}</td><td>${money(m.memberships)}</td><td>${money(m.kofiSales)}</td><td>${money(m.clients)}</td><td><b>${money(m.total)}</b></td><td>${m.expenses ? `&minus;${money(m.expenses)}` : money(0)}</td><td><b class="${m.profit < 0 ? 'is-neg' : ''}">${money(m.profit)}</b></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="dash-note">Nothing yet. Ko-fi payments and payments you record on jobs show up here.</p>';
  }
  function drawExpenses() {
    if (!$('ex-cat').options.length) { $('ex-cat').innerHTML = (board.categories || []).map(c => `<option>${esc(c)}</option>`).join(''); $('ex-day').value = new Date().toISOString().slice(0, 10); }
    const list = (board.expenses || []).slice(0, 15);
    $('ex-list').innerHTML = list.length ? `<ul class="dash-pays">${list.map(e => `<li>${esc(e.day)} · <b>${esc(money(e.amount_cents))}</b> · ${esc(e.category)}${e.note ? ` · ${esc(e.note)}` : ''} <button type="button" class="dash-btn dash-small dash-danger" data-exp-del="${e.id}">Delete</button></li>`).join('')}</ul>${(board.expenses || []).length > 15 ? '<p class="dash-hint">Showing the newest 15. The spreadsheet has them all.</p>' : ''}` : '<p class="dash-hint">No expenses logged yet.</p>';
  }
  $('ex-add').addEventListener('click', async () => {
    const d = await clientAct({ action: 'expAdd', amount: $('ex-amt').value, day: $('ex-day').value, category: $('ex-cat').value, note: $('ex-note').value });
    if (d) { $('ex-amt').value = ''; $('ex-note').value = ''; flash($('ex-msg'), 'Expense added.'); loadIncome(); }
  });
  $('ex-list').addEventListener('click', async e => { const b = e.target.closest('[data-exp-del]'); if (b && confirm('Delete this expense?')) { await clientAct({ action: 'expDelete', id: Number(b.dataset.expDel) }); loadIncome(); } });

  // Auditions
  const AUD = { sent: 'Sent', callback: 'Callback', booked: 'Booked', passed: 'Passed' };
  let auView = 'open', auEdit = null;
  const audForm = (a = {}) => `<form class="dash-job-form" data-aud-form="${a.id || ''}">
    <div class="dash-two"><div><label for="af-project">Project</label><input id="af-project" maxlength="80" required value="${esc(a.project || '')}"></div><div><label for="af-role">Role</label><input id="af-role" maxlength="80" value="${esc(a.role || '')}"></div></div>
    <div class="dash-two"><div><label for="af-sent">Sent</label><input id="af-sent" type="date" value="${esc(a.sent || new Date().toISOString().slice(0, 10))}"></div><div><label for="af-deadline">Deadline or results date</label><input id="af-deadline" type="date" value="${esc(a.deadline || '')}"></div></div>
    <div class="dash-two"><div><label for="af-status">Status</label><select id="af-status">${Object.entries(AUD).map(([k, v]) => `<option value="${k}"${(a.status || 'sent') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></div><div><label for="af-link">Casting link</label><input id="af-link" type="url" placeholder="https://..." value="${esc(a.link || '')}"></div></div>
    <label for="af-notes">Notes</label><textarea id="af-notes" rows="3" maxlength="1500">${esc(a.notes || '')}</textarea>
    <div class="dash-actions"><button type="submit" class="dash-btn dash-primary">Save</button><button type="button" class="dash-btn" data-aud-cancel>Cancel</button></div></form>`;
  function drawAuditions() {
    const all = board.auditions || [], list = all.filter(a => auView === 'all' || (auView === 'open' ? ['sent', 'callback'].includes(a.status) : a.status === auView));
    const booked = all.filter(a => a.status === 'booked').length, decided = all.filter(a => ['booked', 'passed'].includes(a.status)).length;
    $('au-stats').textContent = all.length ? `${all.length} audition${all.length === 1 ? '' : 's'} logged · ${booked} booked${decided ? ` (${Math.round(booked / decided * 100)}% of decided)` : ''}` : '';
    const today = new Date().toISOString().slice(0, 10);
    $('au-body').innerHTML = (auEdit === 'new' ? audForm() : '') + (list.length ? `<ul class="dash-list">${list.map(a => auEdit === a.id ? `<li class="dash-row">${audForm(a)}</li>` : `
      <li class="dash-row dash-aud aud-${esc(a.status)}"><div class="dash-row-main"><b>${esc(a.project)}</b>${a.role ? ` <span class="dash-meta">as ${esc(a.role)}</span>` : ''}
        <p class="dash-req-meta">${esc(AUD[a.status])}${a.sent ? ` · sent ${esc(a.sent)}` : ''}${a.deadline ? ` · deadline ${esc(a.deadline)}${['sent', 'callback'].includes(a.status) && a.deadline < today ? ' <span class="dash-late">past</span>' : ''}` : ''}</p>
        ${a.link ? `<p class="dash-req-links"><a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer nofollow">Casting link</a></p>` : ''}${a.notes ? `<p class="dash-note-text">${esc(a.notes)}</p>` : ''}</div>
        <div class="dash-row-actions"><label class="sr-only" for="as-${a.id}">Status</label><select id="as-${a.id}" data-aud-status="${a.id}">${Object.entries(AUD).map(([k, v]) => `<option value="${k}"${a.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <button type="button" class="dash-btn dash-small" data-aud-edit="${a.id}">Edit</button><button type="button" class="dash-btn dash-small dash-danger" data-aud-del="${a.id}">Delete</button></div></li>`).join('')}</ul>` : `<p class="dash-note">${auView === 'open' ? 'Nothing waiting on an answer.' : 'Nothing here.'}</p>`);
  }
  $('au-new').addEventListener('click', () => { auEdit = 'new'; drawAuditions(); $('af-project').focus(); });
  document.querySelectorAll('#au-filter [data-au]').forEach(b => b.addEventListener('click', () => { auView = b.dataset.au; document.querySelectorAll('#au-filter [data-au]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawAuditions(); }));
  $('au-body').addEventListener('click', async e => {
    if (e.target.closest('[data-aud-cancel]')) { auEdit = null; return drawAuditions(); }
    const ed = e.target.closest('[data-aud-edit]'); if (ed) { auEdit = Number(ed.dataset.audEdit); drawAuditions(); return $('af-project').focus(); }
    const del = e.target.closest('[data-aud-del]'); if (del && confirm('Delete this audition?')) await clientAct({ action: 'audDelete', id: Number(del.dataset.audDel) });
  });
  $('au-body').addEventListener('change', async e => { const s = e.target.closest('[data-aud-status]'); if (s) { await clientAct({ action: 'audStatus', id: Number(s.dataset.audStatus), status: s.value }); flash($('au-msg'), s.value === 'booked' ? 'Booked! Nice work.' : `Marked ${AUD[s.value]}.`); } });
  $('au-body').addEventListener('submit', async e => {
    const f = e.target.closest('[data-aud-form]'); if (!f) return; e.preventDefault();
    const d = await clientAct({ action: 'audSave', id: Number(f.dataset.audForm) || 0, project: $('af-project').value, role: $('af-role').value, sent: $('af-sent').value, deadline: $('af-deadline').value, status: $('af-status').value, link: $('af-link').value, notes: $('af-notes').value });
    if (d) { auEdit = null; drawAuditions(); flash($('au-msg'), 'Saved.'); }
  });

  $('inc-csv').addEventListener('click', () => {
    const q = v => `"${String(v).replace(/"/g, '""')}"`, rows = [['Month', 'Tips', 'Memberships', 'Ko-fi sales', 'Client payments', 'Total in', 'Expenses', 'Profit']];
    incomeMonths.forEach(m => rows.push([m.month, ...['tips', 'memberships', 'kofiSales', 'clients', 'total', 'expenses', 'profit'].map(k => (m[k] / 100).toFixed(2))]));
    rows.push([], ['Client payments'], ['Date', 'Client', 'Amount', 'How', 'Note']);
    (board.payments || []).forEach(p => rows.push([p.day, board.jobs.find(j => j.id === p.job_id)?.client || '', (p.amount_cents / 100).toFixed(2), p.method, p.note || '']));
    rows.push([], ['Expenses'], ['Date', 'Category', 'Amount', 'What for']);
    (board.expenses || []).forEach(e => rows.push([e.day, e.category, (e.amount_cents / 100).toFixed(2), e.note || '']));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = `dismeigh-income-${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  const drawBoard = d => { if (d && d.requests) board = d; drawRequests(); drawJobs(); drawExpenses(); drawAuditions(); if ($('cal-grid')) drawCal(); };
  // Collab requests
  let collabs = [];
  function drawCollabs() {
    $('cr-body').innerHTML = collabs.length ? `<ul class="dash-list">${collabs.map(c => `
      <li class="dash-row${c.replied ? ' is-hidden' : ''}" data-focus="cr-${c.id}"><div class="dash-row-main"><b>${esc(c.name)}</b> <span class="dash-meta">${esc(c.kind)} · ${esc(when(c.at))}${c.replied ? ' · replied' : ''}</span>
        <p class="dash-req-meta">Reply to: <b>${esc(c.contact)}</b></p>${c.link ? `<p class="dash-req-links"><a href="${esc(c.link)}" target="_blank" rel="noopener noreferrer nofollow">Their link</a></p>` : ''}
        <p class="dash-note-text">${esc(c.message)}</p></div>
        <div class="dash-row-actions"><button type="button" class="dash-btn dash-small" data-cr="${c.replied ? 'unreplied' : 'replied'}" data-id="${c.id}">${c.replied ? 'Mark not replied' : 'Mark replied'}</button>
          <button type="button" class="dash-btn dash-small dash-danger" data-cr="delete" data-id="${c.id}">Delete</button></div></li>`).join('')}</ul>` : '<p class="dash-note">No collab requests yet.</p>';
  }
  const loadCollabs = async () => { collabs = (await api('collab')).data.collabs || []; drawCollabs(); };
  $('cr-body').addEventListener('click', async e => {
    const b = e.target.closest('[data-cr]'); if (!b) return;
    if (b.dataset.cr === 'delete' && !confirm('Delete this collab request?')) return;
    const { status, data } = await api('collab', { action: b.dataset.cr, id: Number(b.dataset.id) });
    if (status !== 200) return flash($('cr-msg'), data.error || 'Couldn’t save.');
    collabs = data.collabs || []; drawCollabs();
  });
  loaders.clients = async () => { const { data } = await api('clients'); drawBoard(data); loadIncome(); loadCollabs(); };
  const clientAct = async body => { const { status, data } = await api('clients', body); if (status !== 200) return flash($('jb-msg'), data.error || 'Couldn\u2019t save.'); drawBoard(data); return data; };
  $('rq-refresh').addEventListener('click', loaders.clients);
  document.querySelectorAll('#rq-filter [data-rq]').forEach(b => b.addEventListener('click', () => { rqView = b.dataset.rq; document.querySelectorAll('#rq-filter [data-rq]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawRequests(); }));
  document.querySelectorAll('#jb-filter [data-jb]').forEach(b => b.addEventListener('click', () => { jbView = b.dataset.jb; document.querySelectorAll('#jb-filter [data-jb]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawJobs(); }));
  $('rq-body').addEventListener('click', async e => {
    const b = e.target.closest('[data-rq-act]'); if (!b) return;
    const id = Number(b.dataset.id), a = b.dataset.rqAct;
    if (a === 'delete' && !confirm('Delete this request for good?')) return;
    const body = { replied: { action: 'reqStatus', status: 'replied' }, archive: { action: 'reqStatus', status: 'archived' }, keep: { action: 'reqKeep', keep: true }, unkeep: { action: 'reqKeep', keep: false }, delete: { action: 'reqDelete' }, job: { action: 'toJob' } }[a];
    const d = await clientAct({ ...body, id });
    if (d && a === 'job') { flash($('jb-msg'), 'Added to your jobs as a Quote.'); $('jb-h').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('jb-new').addEventListener('click', () => { editingJob = 'new'; drawJobs(); $('jf-client').focus(); });
  $('jb-body').addEventListener('click', async e => {
    if (e.target.closest('[data-job-cancel]')) { editingJob = null; return drawJobs(); }
    const ed = e.target.closest('[data-job-edit]'); if (ed) { editingJob = Number(ed.dataset.jobEdit); drawJobs(); return $('jf-client').focus(); }
    const del = e.target.closest('[data-job-del]'); if (del && confirm('Delete this job?')) await clientAct({ action: 'jobDelete', id: Number(del.dataset.jobDel) });
  });
  $('jb-body').addEventListener('toggle', e => { const d = e.target.closest?.('[data-job-more]'); if (d) openMore = d.open ? Number(d.dataset.jobMore) : (openMore === Number(d.dataset.jobMore) ? null : openMore); }, true);
  $('jb-body').addEventListener('click', async e => {
    const t = e.target.closest('[data-tool]'); if (!t) return;
    const id = Number(t.dataset.id), job = board.jobs.find(j => j.id === id), act = t.dataset.tool;
    const copy = async (url, what) => { try { await navigator.clipboard.writeText(url); flash($('jb-msg'), `${what} copied. Send it to ${job.client}.`); } catch { prompt('Copy this link:', url); } };
    openMore = id;
    if (act === 'copy-status') return copy(`${location.origin}/status/?s=${job.token}`, 'Client link');
    if (act === 'copy-inv') return copy(`${location.origin}/invoice/?i=${job.inv_token}`, 'Invoice link');
    if (act === 'copy-ag') return copy(`${location.origin}/agree/?a=${job.agr_token}`, 'Signing link');
    if (act === 'copy-ref') return copy(`${location.origin}/work/?ref=${job.ref_code}`, 'Referral link');
    if (act === 'ag-save' && job.agreement?.signed && !confirm('This agreement is already signed. Saving makes a new version with a new link that needs signing again. Go ahead?')) return;
    if ((act === 'ag-off' || act === 'ref-off') && !confirm('Turn off this link? The old link stops working.')) return;
    if (act === 'inv-add') { $(`inv-${id}`).insertAdjacentHTML('beforeend', invRow()); return; }
    if (act === 'status-off' && !confirm('Turn off this client link? The old link stops working.')) return;
    if (act === 'inv-off' && !confirm('Turn off the invoice link? The old link stops working.')) return;
    if (act === 'pay-del' && !confirm('Delete this payment?')) return;
    const body = {
      'ag-save': { action: 'agreementSave', agreement: { scope: $(`ags-${id}`).value, price: $(`agp-${id}`).value, rounds: $(`agr-${id}`).value, timeline: $(`agt-${id}`).value, payment: $(`agy-${id}`).value, extra: $(`agx-${id}`).value } },
      'ag-off': { action: 'agreementOff' }, 'ag-on': { action: 'agreementOn' }, 'ref-on': { action: 'refOn' }, 'ref-off': { action: 'refOff' },
      'status-on': { action: 'jobShare', on: true }, 'status-off': { action: 'jobShare', on: false },
      note: { action: 'jobClientNote', note: $(`cn-${id}`)?.value },
      'inv-off': { action: 'invoiceOff' }, 'inv-on': { action: 'invoiceNewLink' },
      'inv-save': { action: 'invoiceSave', invoice: {
        number: job.invoice?.number, issued: job.invoice?.issued, deposit: $(`idp-${id}`).value, status: $(`ist-${id}`).value,
        payLink: $(`ipl-${id}`).value, payLabel: $(`ipb-${id}`).value, terms: $(`itm-${id}`).value,
        items: [...$(`inv-${id}`).querySelectorAll('.dash-inv-row')].map(r => ({ desc: r.querySelector('[data-inv="desc"]').value, amount: r.querySelector('[data-inv="amount"]').value })) } },
      'pay-add': { action: 'payAdd', job_id: id, amount: $(`pa-${id}`)?.value, day: $(`pd-${id}`)?.value, method: $(`pm-${id}`)?.value, note: '' },
      'pay-del': { action: 'payDelete', id: Number(t.dataset.pid) },
    }[act];
    if (!body) return;
    const d = await clientAct({ id, ...body });
    if (d && (act === 'pay-add' || act === 'pay-del')) loadIncome();
    if (d) flash($('jb-msg'), { 'ag-save': 'Agreement saved. Tap Copy signing link to send it.', 'ref-on': 'Referral link made. Tap Copy to send it.', 'status-on': 'Client link is on. Tap Copy link to send it.', note: 'Note saved. The client sees it on their page.', 'inv-save': 'Invoice saved.', 'pay-add': 'Payment recorded.' }[act] || 'Saved.');
  });
  $('jb-body').addEventListener('click', e => { if (e.target.closest('[data-inv-del]')) e.target.closest('.dash-inv-row').remove(); });
  $('jb-body').addEventListener('change', async e => {
    const s = e.target.closest('[data-job-stage]'); if (!s) return;
    await clientAct({ action: 'jobStage', id: Number(s.dataset.jobStage), stage: s.value }); flash($('jb-msg'), `Moved to ${STAGE[s.value]}.`);
  });
  $('jb-body').addEventListener('submit', async e => {
    const f = e.target.closest('[data-job-form]'); if (!f) return; e.preventDefault();
    const d = await clientAct({ action: 'jobSave', id: Number(f.dataset.jobForm) || 0, client: $('jf-client').value, contact: $('jf-contact').value, service: $('jf-service').value, price: $('jf-price').value, stage: $('jf-stage').value, due: $('jf-due').value, notes: $('jf-notes').value });
    if (d) { editingJob = null; drawJobs(); flash($('jb-msg'), 'Saved.'); }
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
    loadBackup(); loadDevices();
    const { data } = await api('history');
    const bad = ev => /wrong|blocked/i.test(ev);
    $('sec-body').innerHTML = (data.history || []).length ? `<ul class="dash-list">${data.history.map(h => `
      <li class="dash-row${bad(h.event) ? ' is-bad' : ''}"><div class="dash-row-main"><b>${esc(h.event)}</b> <span class="dash-meta">${esc(when(h.at))}</span><p>${esc(h.device)} · ${esc(h.place)}</p></div></li>`).join('')}</ul>` : '<p class="dash-note">Nothing yet.</p>';
  };

  // ---------- Phone alerts (Web Push) ----------
  const alertKinds = () => [...document.querySelectorAll('#al-kinds input:checked')].map(i => i.value);
  const deviceName = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android phone' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows PC' : 'Device'; };
  const KIND_NAMES = { log: 'Ship\u2019s Log', kofi: 'Ko-fi', goal: 'Goal', login: 'Logins', recap: 'Weekly recap', health: 'Site health', quote: 'Quote requests' };
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

  // ---------- Help search ----------
  $('help-find').addEventListener('input', () => {
    const q = $('help-find').value.trim().toLowerCase(); let shown = 0;
    document.querySelectorAll('.dash-help-item').forEach(d => { const hit = !q || d.textContent.toLowerCase().includes(q); d.hidden = !hit; d.open = !!q && hit; if (hit) shown++; });
    document.querySelectorAll('.dash-help h3').forEach(h => { let n = h.nextElementSibling, any = false; while (n && n.matches('.dash-help-item')) { if (!n.hidden) any = true; n = n.nextElementSibling; } h.hidden = !any; });
    $('help-none').hidden = shown > 0;
  });

  // ---------- Known devices + sign out everywhere ----------
  async function loadDevices() {
    const { data } = await api('devices'); const list = data.devices || [];
    $('dv-body').innerHTML = list.length ? `<ul class="dash-list">${list.map(d => `<li class="dash-row"><div class="dash-row-main"><b>${esc(d.label)}</b> <span class="dash-meta">${esc(d.place)}</span><p class="dash-req-meta">First seen ${esc(when(d.first))} · last login ${esc(when(d.last))}</p></div>
      <div class="dash-row-actions"><button type="button" class="dash-btn dash-small" data-dv="${esc(d.h)}">Forget</button></div></li>`).join('')}</ul>` : '<p class="dash-note">No devices remembered yet. They\u2019re added the next time you log in.</p>';
  }
  $('dv-body').addEventListener('click', async e => { const b = e.target.closest('[data-dv]'); if (!b || !confirm('Forget this device? Its next login will count as new and ping your phone.')) return; await api('devices', { action: 'forget', h: b.dataset.dv }); loadDevices(); });
  $('dv-out').addEventListener('click', async () => {
    if (!confirm('Sign out everywhere? Every other phone and computer gets logged out right away. You stay logged in here.')) return;
    const { status } = await api('devices', { action: 'signout' });
    flash($('dv-msg'), status === 200 ? 'Done. Everywhere else is signed out.' : 'That didn\u2019t work. Try again.');
  });

  // ---------- Backup codes ----------
  let shownCodes = [];
  const loadBackup = async () => {
    const { data } = await api('backupcodes');
    $('bc-info').textContent = data.made ? `${data.left} of 10 left, made ${when(data.made)}.${data.left <= 3 ? ' Running low: make a fresh set.' : ''}` : 'You don\u2019t have any yet. Make a set now, before you need them.';
  };
  $('bc-make').addEventListener('click', async () => {
    if (!confirm('Make a new set of 10 backup codes? Any old ones stop working.')) return;
    const { data } = await api('backupcodes', { action: 'make' }); shownCodes = data.codes || [];
    $('bc-list').innerHTML = shownCodes.map(c => `<li><code>${esc(c)}</code></li>`).join(''); $('bc-show').hidden = false; loadBackup();
  });
  const codesText = () => `Dismeigh dashboard backup codes (made ${new Date().toLocaleDateString()})\nEach works once instead of the 6-digit code.\n\n${shownCodes.join('\n')}\n`;
  $('bc-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(codesText()); flash($('bc-info'), 'Copied.'); } catch {} });
  $('bc-save').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([codesText()], { type: 'text/plain' })); a.download = 'dismeigh-backup-codes.txt'; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); });

  // ---------- Install as an app ----------
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('install-btn').hidden = false; });
  $('install-btn').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $('install-btn').hidden = true; });
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('install-note').textContent = 'You’re using the installed dashboard app.';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const offline = () => { document.body.classList.toggle('dash-offline', !navigator.onLine); };
  addEventListener('online', offline); addEventListener('offline', offline); offline();
})();
