// Bounty Run: dodge the rocks, grab the bounty chips, post your score to the board.
// Phone: drag inside the game to steer. Computer: mouse or arrow keys / A and D.
// Scoring must stay in step with lib/arcade.js (timeScore + 50 per chip).
(() => {
  const box = document.getElementById('game-box');
  const canvas = document.getElementById('game');
  if (!box || !canvas) return;
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = { score: $('g-score'), best: $('g-best'), overlay: $('g-overlay'), title: $('g-title'), sub: $('g-sub'), btn: $('g-start'),
    form: $('g-form'), name: $('g-name'), msg: $('g-msg'), post: $('g-post'), skip: $('g-skip') };
  const C = { ink: '#14110f', ink2: '#1e1a17', paper: '#efe6d2', mustard: '#e3a92b', red: '#b73b2c' };
  // Holiday skins: the game follows the site's holiday look (looks only; hitboxes and scoring don't change)
  const SKINS = {
    holiday: { sky: ['#0b1224', '#1a2238'], star: '239,246,255', starSize: 2.2, rock: '#d9e4ee', rockHi: 'rgba(255,255,255,0.55)', chip: '#c8322a', chipText: '#fff6e6', chipCap: '#e3a92b', sparks: ['#efe6d2', '#c8322a', '#3fa35a'] },
    thanksgiving: { sky: ['#1a100a', '#2c1b10'], star: '232,150,70', rock: '#7a4a26', chip: '#e8762b', sparks: ['#e8762b', '#b73b2c', '#e3a92b'], leaves: true },
    spooky: { sky: ['#11081a', '#1f1026'], star: '200,170,255', rock: '#e8762b', rockHi: 'rgba(255,220,150,0.25)', face: true, chip: '#8fd36a', sparks: ['#e8762b', '#9b6bd6', '#8fd36a'] },
    valentines: { sky: ['#19090f', '#2a0f1d'], star: '255,190,215', rock: '#6e4a5a', chip: '#f28ab2', chipShape: 'heart', sparks: ['#f28ab2', '#b73b2c', '#f7c6d9'] },
    stpatricks: { sky: ['#07130b', '#0f2418'], star: '180,240,190', rock: '#3f5a43', chip: '#f0c63a', chipText: '#1f6633', sparks: ['#5fbf6a', '#f0c63a', '#9bd88f'] },
    easter: { sky: ['#13102a', '#221a3a'], star: '230,215,255', rock: '#6b6080', chipShape: 'egg', chipColors: ['#f7b3c9', '#b3d9f7', '#c9f0b3', '#f7e7a3', '#d9b3f7'], sparks: ['#f7b3c9', '#b3d9f7', '#f7e7a3'] },
    mothers: { sky: ['#170c14', '#261422'], star: '255,205,225', chip: '#f28ab2', sparks: ['#f28ab2', '#f7c6d9', '#efe6d2'] },
    july4: { sky: ['#08102a', '#141c3c'], star: '255,255,255', rock: '#5a5f70', chip: '#efe6d2', chipText: '#b73b2c', sparks: ['#b73b2c', '#efe6d2', '#7fb3e8'], burst: true },
    newyear: { chip: '#e3a92b', sparks: ['#e3a92b', '#b73b2c', '#3f8f8c', '#efe6d2'], burst: true },
    birthday: { chip: '#e3a92b', sparks: ['#e3a92b', '#b73b2c', '#3f8f8c', '#efe6d2'], burst: true },
    anniversary: { chip: '#e3a92b', sparks: ['#e3a92b', '#efe6d2', '#b73b2c'], burst: true },
  };
  const BASE = { sky: ['#0f0d12', '#1e1a17'], star: '239,230,210', starSize: 1.6, rock: '#5a4c41', rockHi: 'rgba(239,230,210,0.12)', face: false,
    chip: '#e3a92b', chipText: '#14110f', chipCap: null, chipShape: 'coin', chipColors: null, sparks: ['#e3a92b'], leaves: false, burst: false };
  const T = { ...BASE, ...(SKINS[document.documentElement.dataset.season] || {}) };
  box.dataset.skin = SKINS[document.documentElement.dataset.season] ? document.documentElement.dataset.season : 'base';

  const buzz = p => { try { navigator.vibrate?.(p); } catch {} };
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  let W = 0, H = 0;
  let best = Number(store.get('dismeigh-bounty-run')) || 0;
  ui.best.textContent = best;
  ui.name.value = store.get('dismeigh-arcade-name') || '';

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = box.clientWidth; H = box.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ship) ship.y = H - Math.max(70, H * 0.14);
  }

  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * T.starSize + 0.3, v: Math.random() * 0.6 + 0.2, c: T.leaves ? T.sparks[Math.floor(Math.random() * T.sparks.length)] : null }));
  let state = 'ready', ship, rocks, chips, sparks, t, speed, score, chipCount, target, keys = {}, last = 0, shake = 0;
  let run = null, finalScore = 0, finalSeconds = 0;

  function reset() {
    ship = { x: W / 2, y: H - Math.max(70, H * 0.14), r: 15 };
    target = ship.x; rocks = []; chips = []; sparks = []; t = 0; speed = 1; score = 0; chipCount = 0;
  }
  new ResizeObserver(resize).observe(box); resize(); reset();

  const setPlaying = on => box.classList.toggle('is-playing', on);

  function start() {
    reset(); state = 'play'; setPlaying(true);
    ui.overlay.hidden = true; ui.form.hidden = true; ui.btn.hidden = false;
    last = performance.now(); wake();
    // Ticket for this run, so the server can time it
    run = null;
    fetch('/api/arcade/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.ok ? r.json() : null).then(d => { run = d?.run || null; }).catch(() => {});
  }
  ui.btn.addEventListener('click', () => { if (state === 'paused') resume(); else start(); });

  function pause() {
    state = 'paused'; setPlaying(false);
    ui.title.textContent = 'Paused'; ui.sub.textContent = `Score ${Math.floor(score)}`; ui.btn.textContent = 'Resume'; ui.overlay.hidden = false;
  }
  function resume() { state = 'play'; setPlaying(true); ui.overlay.hidden = true; last = performance.now(); wake(); }

  // Controls
  const toX = e => e.clientX - canvas.getBoundingClientRect().left;
  canvas.addEventListener('pointerdown', e => { if (state === 'play') { target = toX(e); canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', e => { if (state === 'play' && (e.pointerType === 'mouse' || e.buttons)) target = toX(e); });
  const steerKeys = ['arrowleft', 'arrowright', 'a', 'd'];
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (state === 'play' && steerKeys.includes(k) && !e.target.closest?.('input, textarea')) { keys[k] = true; e.preventDefault(); }
    if (state === 'play' && k === 'escape') pause();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });

  function spawn() {
    const r = 12 + Math.random() * 22 * Math.min(1.4, 0.8 + speed * 0.2);
    rocks.push({ x: r + Math.random() * (W - 2 * r), y: -r - 10, r, vy: (120 + Math.random() * 90) * speed, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2,
      pts: Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2, d: 0.72 + Math.random() * 0.32 })) });
  }

  function crash() {
    state = 'over'; shake = 14; setPlaying(false);
    for (let i = 0; i < 28; i++) sparks.push({ x: ship.x, y: ship.y, vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420, life: 0.8, c: i % 2 ? C.mustard : C.red });
    buzz([80, 40, 120]);
    finalScore = Math.floor(score); finalSeconds = t;
    if (finalScore >= (boards.master || 1500)) window.dismeighUnlock?.('arcade');  // Secret: Arcade master
    const isBest = finalScore > best;
    if (isBest) { best = finalScore; store.set('dismeigh-bounty-run', String(best)); ui.best.textContent = best; }
    setTimeout(() => {
      ui.title.textContent = isBest ? 'New best!' : 'Ship down';
      ui.sub.textContent = `Score ${finalScore.toLocaleString()} · ${chipCount} bounty chip${chipCount === 1 ? '' : 's'}`;
      ui.btn.textContent = 'Run it back';
      const ranked = qualifies(finalScore);
      ui.form.hidden = !ranked; ui.btn.hidden = ranked; ui.msg.textContent = '';
      ui.post.disabled = false;
      ui.overlay.hidden = false;
      if (ranked) {
        ui.sub.textContent += ranked === 'week' ? ' · Made this week’s board!' : ' · You made the board!';
        if (matchMedia('(pointer: fine)').matches) ui.name.focus({ preventScroll: true });
        else ui.post.focus({ preventScroll: true });
      } else ui.btn.focus({ preventScroll: true });
    }, 700);
  }

  function update(dt) {
    t += dt;
    speed = 1 + t / 40;
    if (keys.arrowleft || keys.a) target = ship.x - 380 * dt;
    if (keys.arrowright || keys.d) target = ship.x + 380 * dt;
    target = Math.max(ship.r, Math.min(W - ship.r, target));
    ship.x += (target - ship.x) * Math.min(1, dt * 14);
    score += dt * 10 * speed;
    if (Math.random() < dt * (1.3 + speed * 0.9) * Math.max(0.6, W / 520)) spawn();
    if (Math.random() < dt * 0.7) chips.push({ x: 20 + Math.random() * (W - 40), y: -20, vy: 140 * speed, spin: 0 });
    for (const r of rocks) { r.y += r.vy * dt; r.rot += r.vr * dt; if (Math.hypot(r.x - ship.x, r.y - ship.y) < r.r * 0.8 + ship.r * 0.7) { crash(); break; } }
    if (state !== 'play') return;
    for (const c of chips) { c.y += c.vy * dt; c.spin += dt * 5;
      if (!c.got && Math.hypot(c.x - ship.x, c.y - ship.y) < 26) { c.got = true; chipCount++; score += 50;
        for (let i = 0, n = T.burst ? 22 : 10; i < n; i++) { const a = (i / n) * Math.PI * 2, sp = T.burst ? 160 + Math.random() * 120 : Math.random() * 160;
          sparks.push({ x: c.x, y: c.y, vx: T.burst ? Math.cos(a) * sp : (Math.random() - 0.5) * 220, vy: T.burst ? Math.sin(a) * sp : (Math.random() - 0.5) * 220, life: T.burst ? 0.7 : 0.45, c: T.sparks[i % T.sparks.length] }); }
        buzz(15); } }
    rocks = rocks.filter(r => r.y < H + 60); chips = chips.filter(c => !c.got && c.y < H + 30);
  }

  function drawChip(c) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(Math.cos(c.spin), 1);
    ctx.fillStyle = T.chipColors ? T.chipColors[c.tint ?? (c.tint = Math.floor(Math.random() * T.chipColors.length))] : T.chip;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
    if (T.chipShape === 'heart') {
      ctx.moveTo(0, 10); ctx.bezierCurveTo(-14, 0, -11, -12, 0, -5); ctx.bezierCurveTo(11, -12, 14, 0, 0, 10);
    } else if (T.chipShape === 'egg') {
      ctx.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2);
    } else ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (T.chipCap) { ctx.fillStyle = T.chipCap; ctx.fillRect(-3.5, -14, 7, 5); ctx.strokeRect(-3.5, -14, 7, 5); }
    ctx.fillStyle = T.chipText; ctx.font = 'bold 11px Anton, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('B', 0, 1);
    ctx.restore();
  }
  function drawFace(r) {
    ctx.fillStyle = '#14110f';
    const e = r * 0.22;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.32 - e, -r * 0.05); ctx.lineTo(sx * r * 0.32 + e, -r * 0.05); ctx.lineTo(sx * r * 0.32, -r * 0.05 - e * 1.4); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.2); ctx.lineTo(-r * 0.2, r * 0.38); ctx.lineTo(0, r * 0.24); ctx.lineTo(r * 0.2, r * 0.38); ctx.lineTo(r * 0.4, r * 0.2); ctx.lineTo(0, r * 0.5); ctx.closePath(); ctx.fill();
  }

  function drawShip(x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = Math.random() > 0.5 ? C.mustard : C.red;
    ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(0, 22 + Math.random() * 8); ctx.lineTo(6, 14); ctx.fill();
    ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, 14); ctx.lineTo(0, 7); ctx.lineTo(-15, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(0, 6); ctx.stroke();
    ctx.restore();
  }

  function draw(dt) {
    ctx.save();
    if (shake > 0) { ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake = Math.max(0, shake - dt * 30); }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    for (const s of stars) { s.y += s.v * dt * 0.25 * (state === 'play' ? speed : 0.4); if (s.y > 1) { s.y = 0; s.x = Math.random(); }
      if (s.c) { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = s.c; ctx.translate(s.x * W, s.y * H); ctx.rotate(s.y * 12); ctx.beginPath(); ctx.ellipse(0, 0, s.s * 2.2, s.s * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      else if (T.starSize > 2) { ctx.fillStyle = `rgba(${T.star},${0.35 + s.s * 0.2})`; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.s, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = `rgba(${T.star},${0.25 + s.s * 0.3})`; ctx.fillRect(s.x * W, s.y * H, s.s, s.s * 2.4); } }
    for (const c of chips) drawChip(c);
    for (const r of rocks) { ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      ctx.fillStyle = T.rock; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath();
      r.pts.forEach((p, i) => { const px = Math.cos(p.a) * r.r * p.d, py = Math.sin(p.a) * r.r * p.d; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = T.rockHi; ctx.beginPath(); ctx.arc(-r.r * 0.25, -r.r * 0.25, r.r * 0.3, 0, Math.PI * 2); ctx.fill();
      if (T.face && r.r > 14) drawFace(r.r);
      ctx.restore(); }
    if (state !== 'over') drawShip(ship.x, ship.y);
    sparks.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; ctx.globalAlpha = Math.max(0, p.life * 1.5); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); });
    ctx.globalAlpha = 1; sparks = sparks.filter(p => p.life > 0);
    ctx.restore();
    ui.score.textContent = Math.floor(score).toLocaleString();
  }

  // Only animate while the game is on screen (or being played), to save battery
  let visible = false, looping = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (state === 'play') update(dt);
    draw(dt);
    if (visible || state === 'play' || sparks.length) requestAnimationFrame(frame); else looping = false;
  }
  function wake() { if (!looping) { looping = true; last = performance.now(); requestAnimationFrame(frame); } }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) wake(); else if (state === 'play') pause();
  }, { threshold: 0.35 }).observe(box);

  // ---- Scoreboard ----
  let boards = { all: [], week: [] }, boardsLoaded = false, tab = 'all', myName = '';
  const list = $('board-list'), boardMsg = $('board-msg'), tabs = [...document.querySelectorAll('[data-board]')];
  const SIZE = 10;

  function qualifies(s) {
    if (!boardsLoaded || !s) return false;
    const fits = rows => rows.length < SIZE || s > rows[rows.length - 1].score;
    return fits(boards.all) ? 'all' : fits(boards.week) ? 'week' : false;
  }

  function renderBoard() {
    tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.board === tab)));
    const rows = boards[tab] || [];
    list.replaceChildren(...rows.map((r, i) => {
      const li = document.createElement('li');
      if (myName && r.name.toLowerCase() === myName.toLowerCase()) li.className = 'is-me';
      const rank = document.createElement('span'); rank.className = 'board-rank'; rank.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('span'); name.className = 'board-name'; name.textContent = r.name;
      const sc = document.createElement('span'); sc.className = 'board-score'; sc.textContent = r.score.toLocaleString();
      li.append(rank, name, sc);
      return li;
    }));
    boardMsg.textContent = rows.length ? '' : tab === 'week' ? 'No scores this week yet. The top spot is open.' : 'No scores yet. Be the first on the board.';
    boardMsg.hidden = !!rows.length;
  }
  tabs.forEach(b => b.addEventListener('click', () => { tab = b.dataset.board; renderBoard(); }));

  async function loadBoards() {
    try {
      const r = await fetch('/api/arcade/scores', { cache: 'no-store' });
      if (!r.ok) throw 0;
      boards = await r.json(); boardsLoaded = true; renderBoard();
    } catch { boardMsg.textContent = 'The scoreboard is taking a break. Your best still saves on this device.'; boardMsg.hidden = false; }
  }
  loadBoards();

  ui.form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = ui.name.value.replace(/\s+/g, ' ').trim();
    if (!name) { ui.msg.textContent = 'Type a name first.'; ui.name.focus(); return; }
    if (!run) { ui.msg.textContent = 'Couldn’t reach the scoreboard for this run. Try the next one.'; return; }
    ui.post.disabled = true; ui.msg.textContent = 'Posting…';
    try {
      const r = await fetch('/api/arcade/score', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run, name, score: finalScore, seconds: Math.round(finalSeconds * 1000) / 1000 }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        ui.msg.textContent = d.error || 'Couldn’t post that score.'; ui.post.disabled = false;
        if (d.field === 'name') ui.name.focus(); else { ui.form.hidden = true; ui.btn.hidden = false; }
        return;
      }
      run = null; myName = d.name; store.set('dismeigh-arcade-name', d.name);
      boards = d.boards; boardsLoaded = true;
      if (!boards.all.some(x => x.name.toLowerCase() === myName.toLowerCase()) && boards.week.some(x => x.name.toLowerCase() === myName.toLowerCase())) tab = 'week';
      renderBoard();
      ui.form.hidden = true; ui.btn.hidden = false; ui.sub.textContent = `Posted as ${d.name}. Score ${finalScore.toLocaleString()}.`;
      ui.btn.focus({ preventScroll: true });
      buzz([30, 40, 60]);
    } catch { ui.msg.textContent = 'Couldn’t reach the scoreboard. Try again.'; ui.post.disabled = false; }
  });
  ui.skip.addEventListener('click', () => { ui.form.hidden = true; ui.btn.hidden = false; ui.btn.focus({ preventScroll: true }); });
})();
