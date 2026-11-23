// Private dashboard (/dashboard/). Talks to /api/admin/* (see lib/admin.js and lib/kofi.js).
(() => {
  const $ = id => document.getElementById(id);
  const usd = n => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
  const api = async (path, body) => {
    const r = await fetch(`/api/admin/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' } : { credentials: 'same-origin', cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  };
  const show = which => { $('login').hidden = which !== 'login'; $('panel').hidden = which !== 'panel'; };
  let state = null;

  function render(s) {
    state = s;
    const g = s.goal, p = s.progress;
    const on = !!g.on;
    $('toggle').setAttribute('aria-checked', String(on));
    $('toggle').classList.toggle('is-on', on);
    $('toggle-label').textContent = on ? 'On' : 'Off';
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
    $('hook-url').textContent = s.webhookUrl;
    $('kofi-status').textContent = s.connected
      ? `Connected. Last payment received: ${s.lastPayment ? new Date(s.lastPayment).toLocaleString() : 'none yet'}.`
      : 'Not connected yet. Ko-fi payments won’t count until the steps below are done (the "already raised" amount still works).';
  }

  async function load() {
    const { status, data } = await api('goal');
    if (status === 401) return show('login');
    if (status !== 200) { show('login'); $('login-msg').textContent = data.error || 'The dashboard is offline.'; return; }
    show('panel'); render(data);
  }

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-msg').textContent = '';
    const { status, data } = await api('login', { password: $('pw').value });
    $('pw').value = '';
    if (status === 200) return load();
    $('login-msg').textContent = data.error || 'Couldn’t log in.';
  });
  $('logout').addEventListener('click', async () => { await api('logout', {}); show('login'); $('pw').focus(); });

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
  $('restart').addEventListener('click', () => {
    if (state?.goal?.since && !confirm('Start a new goal? Ko-fi payments will be counted from now, and the old count is set aside.')) return;
    save(true);
  });
  $('toggle').addEventListener('click', async () => {
    const want = !state?.goal?.on;
    const { status, data } = await api('goal', { action: 'toggle', on: want });
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
