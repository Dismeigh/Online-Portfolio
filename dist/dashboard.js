// Private dashboard (/dashboard/). Talks to /api/admin/* (see lib/admin.js and lib/kofi.js).
(() => {
  const $ = id => document.getElementById(id);
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
