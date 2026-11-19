// Launch Control: a drag-strip reaction game on the Garage page.
// Stage, wait for the ambers, launch on green. Lower reaction time wins.
// Timing rules must stay in step with lib/arcade.js (tree takes at least 2.5 s to reach green).
(() => {
  const panel = document.getElementById('lc-panel');
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const btn = $('lc-btn'), timeEl = $('lc-time'), verdict = $('lc-verdict'), bestEl = $('lc-best'), car = $('lc-car'), smoke = $('lc-smoke');
  const form = $('lc-form'), nameIn = $('lc-name'), msg = $('lc-msg'), post = $('lc-post'), skip = $('lc-skip');
  const bulbs = name => panel.querySelectorAll(`[data-bulb="${name}"]`);
  const light = (name, on = true) => bulbs(name).forEach(b => b.classList.toggle('on', on));
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const buzz = p => { try { navigator.vibrate?.(p); } catch {} };
  const fmt = ms => (ms / 1000).toFixed(3);

  let best = Number(store.get('dismeigh-launch-best')) || 0;
  if (best) bestEl.textContent = fmt(best);
  nameIn.value = store.get('dismeigh-arcade-name') || '';

  let state = 'idle', timers = [], greenAt = 0, run = null, lastMs = 0, launchedAt = -1e9;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const resetTree = () => ['pre', 'stage', 'a1', 'a2', 'a3', 'go', 'red'].forEach(n => light(n, false));

  function stage() {
    clearTimers(); resetTree();
    state = 'staging'; form.hidden = true;
    panel.classList.remove('launched', 'fouled'); panel.classList.add('armed');
    car.style.transition = 'none'; car.style.transform = ''; void car.getBoundingClientRect(); car.style.transition = '';
    timeEl.textContent = '0.000'; verdict.textContent = 'Staged. Eyes on the tree…';
    btn.textContent = 'Launch'; btn.hidden = false; btn.focus({ preventScroll: true });
    run = null;
    fetch('/api/arcade/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'drag' }) })
      .then(r => (r.ok ? r.json() : null)).then(d => { run = d?.run || null; }).catch(() => {});
    light('pre');
    at(400, () => light('stage'));
    const d = 1000 + Math.random() * 1500;               // random wait, so nobody can count it out
    at(d, () => light('a1'));
    at(d + 500, () => light('a2'));
    at(d + 1000, () => light('a3'));
    at(d + 1500, () => requestAnimationFrame(() => {
      if (state !== 'staging') return;
      light('go'); state = 'green'; greenAt = performance.now();
      at(2000, () => { if (state === 'green') finish(null, 'Asleep at the tree. Over 2 seconds, so no time.'); });
    }));
  }

  function launch(stamp) {
    launchedAt = performance.now();
    if (state === 'staging') {
      clearTimers(); state = 'done'; light('red');
      panel.classList.add('fouled'); panel.classList.remove('armed');
      timeEl.textContent = 'RED';
      verdict.textContent = 'Red light! You jumped the start.';
      buzz([60, 40, 60]);
      btn.textContent = 'Stage again';
      return;
    }
    if (state !== 'green') return;
    const ms = Math.max(0, Math.round((stamp ?? performance.now()) - greenAt));
    finish(ms);
  }

  function finish(ms, note) {
    clearTimers(); state = 'done';
    panel.classList.remove('armed');
    btn.textContent = 'Run it back';
    if (ms === null) { timeEl.textContent = '—'; verdict.textContent = note; return; }
    panel.classList.add('launched');
    smoke.classList.remove('puff'); void smoke.offsetWidth; smoke.classList.add('puff');
    buzz(30);
    lastMs = ms;
    timeEl.textContent = fmt(ms);
    if (ms < 100) { verdict.textContent = 'Too quick to be real. That counts as a guess, so no time.'; return; }
    verdict.textContent = ms < 150 ? 'Holeshot! Unreal launch.' : ms < 250 ? 'Great launch.' : ms < 400 ? 'Solid launch.' : 'A little sleepy on the tree.';
    const isBest = !best || ms < best;
    if (isBest) { best = ms; store.set('dismeigh-launch-best', String(ms)); bestEl.textContent = fmt(ms); verdict.textContent += ' New personal best!'; }
    const ranked = ms <= 1500 && qualifies(ms);
    if (ranked) {
      verdict.textContent += ranked === 'week' ? ' You made this week’s board!' : ' You made the board!';
      form.hidden = false; btn.hidden = true; msg.textContent = ''; post.disabled = false;
      if (matchMedia('(pointer: fine)').matches) nameIn.focus({ preventScroll: true }); else post.focus({ preventScroll: true });
    }
  }

  // Launch on press (pointerdown is quicker than click), or with the space bar while staged
  btn.addEventListener('pointerdown', e => {
    if (state === 'staging' || state === 'green') { e.preventDefault(); launch(e.timeStamp); }
  });
  btn.addEventListener('click', () => {
    // The press that launched also ends in a click; don't let it restage straight away
    if (performance.now() - launchedAt < 700) return;
    if (state === 'idle' || state === 'done') stage();
  });
  window.addEventListener('keydown', e => {
    if ((state === 'staging' || state === 'green') && (e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault(); launch(e.timeStamp);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state === 'staging' || state === 'green')) {
      clearTimers(); resetTree(); state = 'idle'; panel.classList.remove('armed');
      btn.textContent = 'Stage'; verdict.textContent = 'Run cancelled. Hit Stage when you’re ready.';
    }
  });

  // ---- Scoreboard ----
  let boards = { all: [], week: [] }, loaded = false, tab = 'all', me = '';
  const list = $('lc-board-list'), boardMsg = $('lc-board-msg'), tabs = [...document.querySelectorAll('[data-lc-board]')];
  function qualifies(ms) {
    if (!loaded) return false;
    const fits = rows => rows.length < 10 || ms < rows[rows.length - 1].score;
    return fits(boards.all) ? 'all' : fits(boards.week) ? 'week' : false;
  }
  function render() {
    tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.lcBoard === tab)));
    const rows = boards[tab] || [];
    list.replaceChildren(...rows.map((r, i) => {
      const li = document.createElement('li');
      if (me && r.name.toLowerCase() === me.toLowerCase()) li.className = 'is-me';
      const rank = document.createElement('span'); rank.className = 'board-rank'; rank.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('span'); name.className = 'board-name'; name.textContent = r.name;
      const sc = document.createElement('span'); sc.className = 'board-score'; sc.textContent = fmt(r.score);
      li.append(rank, name, sc);
      return li;
    }));
    boardMsg.textContent = rows.length ? '' : tab === 'week' ? 'No launches this week yet. The top spot is open.' : 'No launches yet. Be the first on the board.';
    boardMsg.hidden = !!rows.length;
  }
  tabs.forEach(b => b.addEventListener('click', () => { tab = b.dataset.lcBoard; render(); }));
  fetch('/api/arcade/scores?game=drag', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(d => { boards = d; loaded = true; render(); })
    .catch(() => { boardMsg.textContent = 'The scoreboard is taking a break. Your best still saves on this device.'; boardMsg.hidden = false; });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameIn.value.replace(/\s+/g, ' ').trim();
    if (!name) { msg.textContent = 'Type a name first.'; nameIn.focus(); return; }
    if (!run) { msg.textContent = 'Couldn’t reach the scoreboard for this run. Try the next one.'; return; }
    post.disabled = true; msg.textContent = 'Posting…';
    try {
      const r = await fetch('/api/arcade/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ run, name, score: lastMs }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        msg.textContent = d.error || 'Couldn’t post that time.'; post.disabled = false;
        if (d.field === 'name') nameIn.focus(); else { form.hidden = true; btn.hidden = false; }
        return;
      }
      run = null; me = d.name; store.set('dismeigh-arcade-name', d.name);
      boards = d.boards; loaded = true;
      if (!boards.all.some(x => x.name.toLowerCase() === me.toLowerCase())) tab = 'week';
      render();
      form.hidden = true; btn.hidden = false; verdict.textContent = `Posted as ${d.name}: ${fmt(lastMs)}.`;
      btn.focus({ preventScroll: true });
    } catch { msg.textContent = 'Couldn’t reach the scoreboard. Try again.'; post.disabled = false; }
  });
  skip.addEventListener('click', () => { form.hidden = true; btn.hidden = false; btn.focus({ preventScroll: true }); });
})();
