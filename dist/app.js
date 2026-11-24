// Shared across every page: app install support, the spaceship cursor, and the secret achievements.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Installable app: register the service worker
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  // Spaceship cursor with a faint trail (mouse and trackpad only)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.documentElement.classList.add('ship-cursor');
    if (!reduceMotion) {
      let last = 0;
      window.addEventListener('pointermove', e => {
        const now = performance.now();
        if (now - last < 45 || e.pointerType !== 'mouse') return;
        last = now;
        const dot = document.createElement('span');
        dot.className = 'ship-trail';
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 600);
      }, { passive: true });
    }
  }

  // Secret achievements: hidden easter eggs, tracked in this browser
  const SECRETS = { bang: 'BANG!', redline: 'Redline', bounty: 'Bounty claimed', realone: 'For the real ones', swordfish: 'Swordfish', explorer: 'Explorer', spotted: 'Spotted in the wild', konami: 'Cheat code', nightowl: 'Night owl', arcade: 'Arcade master', lorebuff: 'Lore buff', tourgrad: 'Tour graduate' };
  const KEY = 'dismeigh-secrets';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const save = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };

  function updateFooter() {
    const footer = document.querySelector('.footer');
    if (!footer) return;
    const found = load().filter(id => SECRETS[id]);
    let line = document.getElementById('footer-secrets');
    if (!found.length) { if (line) line.remove(); return; }
    if (!line) {
      line = document.createElement('p');
      line.id = 'footer-secrets';
      line.className = 'footer-secrets';
      footer.appendChild(line);
    }
    const total = Object.keys(SECRETS).length;
    if (found.length >= total) {
      line.replaceChildren(`All ${total} secrets found. `);
      const get = document.createElement('button');
      get.type = 'button'; get.className = 'footer-license'; get.textContent = 'Get your Bounty Hunter license';
      get.addEventListener('click', showReward);
      line.append(get);
    } else line.textContent = `Secrets found: ${found.length} of ${total}`;
  }

  // Reward for finding every secret: a downloadable "Certified Bounty Hunter" license wallpaper
  const LICENSE = '/assets/wallpapers/certified-bounty-hunter-7q4k.jpg';
  function showReward() {
    let dlg = document.getElementById('reward-dialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'reward-dialog';
      dlg.className = 'reward';
      dlg.setAttribute('aria-labelledby', 'reward-title');
      dlg.innerHTML = `
        <p class="reward-kicker">All secrets found</p>
        <h2 id="reward-title">Certified Bounty Hunter</h2>
        <p class="reward-text">You found every hidden thing on the ship. Here&rsquo;s your license, sized as a phone wallpaper.</p>
        <img src="/assets/wallpapers/certified-bounty-hunter-7q4k-thumb.webp" width="360" height="780" alt="Bounty Hunter License wallpaper: Certified Bounty Hunter, 12 of 12 secrets, with Dismeigh's art and a Verified stamp">
        <div class="reward-actions"><a class="reward-dl" href="${LICENSE}" download="dismeigh-bounty-hunter-license.jpg">Download license</a><button type="button" class="reward-close">Close</button></div>`;
      document.body.append(dlg);
      dlg.querySelector('.reward-close').addEventListener('click', () => dlg.close());
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    }
    if (!dlg.open) dlg.showModal();
  }
  window.dismeighShowReward = showReward;

  function toast(title, detail) {
    const old = document.querySelector('.achievement-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'achievement-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<p class="at-kicker"></p><p class="at-title"></p>';
    el.querySelector('.at-kicker').textContent = detail;
    el.querySelector('.at-title').textContent = title;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('is-leaving'), 3600);
    setTimeout(() => el.remove(), 4200);
  }

  window.dismeighUnlock = id => {
    if (!SECRETS[id]) return;
    const list = load();
    const total = Object.keys(SECRETS).length;
    if (list.includes(id)) {
      toast(SECRETS[id], 'Already in your collection');
      return;
    }
    list.push(id);
    save(list);
    const count = list.filter(x => SECRETS[x]).length;
    // Count it for the private stats: which secret, nothing about who found it
    try {
      const send = sid => { const body = JSON.stringify({ id: sid }); if (!(navigator.sendBeacon && navigator.sendBeacon('/api/secret', new Blob([body], { type: 'application/json' })))) fetch('/api/secret', { method: 'POST', body, keepalive: true }).catch(() => {}); };
      send(id); if (count >= total) send('license');
    } catch {}
    toast(SECRETS[id], count >= total ? `Secret ${count} of ${total}: all found!` : `Secret found: ${count} of ${total}`);
    if (count >= total) setTimeout(showReward, 2400);
    buzz(count >= total ? [40, 60, 40, 60, 120] : [30, 50, 60]);
    updateFooter();
  };

  updateFooter();

  // Holiday looks: a light falling effect (the colors come from styles.css). Re-run if the dashboard changes the look.
  window.dismeighSeasonFx = () => {
    document.querySelector('.season-fx')?.remove();
    const FX = {
      newyear: ['confetti', ['#e3a92b', '#b73b2c', '#3f8f8c', '#efe6d2']],
      valentines: ['heart', ['#f28ab2', '#b73b2c', '#efe6d2']],
      stpatricks: ['clover', ['#5fbf6a', '#1f6633', '#9bd88f']],
      easter: ['egg', ['#f7b3c9', '#b3d9f7', '#c9f0b3', '#f7e7a3', '#d9b3f7']],
      mothers: ['petal', ['#f28ab2', '#f7c6d9', '#efe6d2']],
      july4: ['star', ['#b73b2c', '#efe6d2', '#7fb3e8']],
      thanksgiving: ['leaf', ['#e8762b', '#b73b2c', '#e3a92b', '#8a4b2a']],
      holiday: ['flake', ['#efe6d2']],
      birthday: ['confetti', ['#e3a92b', '#b73b2c', '#3f8f8c', '#efe6d2']],
      anniversary: ['confetti', ['#e3a92b', '#efe6d2', '#b73b2c']],
    };
    const look = FX[document.documentElement.dataset.season];
    if (look && !reduceMotion && !document.querySelector('.season-fx')) {
      const [shape, colors] = look;
      const fx = document.createElement('div');
      fx.className = `season-fx fx-${shape}`;
      fx.setAttribute('aria-hidden', 'true');
      const sized = { flake: [3, 8], confetti: [5, 10], heart: [10, 18], clover: [12, 18], egg: [9, 14], petal: [8, 14], star: [9, 16], leaf: [12, 20] }[shape] || [4, 8];
      for (let i = 0, n = innerWidth < 600 ? 16 : 28; i < n; i++) {
        const piece = document.createElement('i');
        const size = sized[0] + Math.random() * (sized[1] - sized[0]);
        const tall = shape === 'confetti' ? 1.6 : shape === 'egg' ? 1.3 : 1;
        piece.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size * tall}px;` +
          `background-color:${colors[i % colors.length]};animation-duration:${10 + Math.random() * 10}s;animation-delay:${-Math.random() * 20}s;` +
          `--drift:${(Math.random() * 80 - 40).toFixed(0)}px;--spin:${(Math.random() * 540 - 270).toFixed(0)}deg;opacity:${(0.3 + Math.random() * 0.35).toFixed(2)}`;
        fx.append(piece);
      }
      document.body.append(fx);
    }
  };
  window.dismeighSeasonFx();

  // Secret 4: visit on Dismeigh's birthday or Twitch anniversary (the real date, not a preview)
  {
    const special = document.documentElement.dataset.season;
    let previewing = false;
    try { previewing = new URLSearchParams(location.search).has('season'); } catch {}
    if ((special === 'birthday' || special === 'anniversary') && !previewing) {
      setTimeout(() => window.dismeighUnlock('realone'), 2600);
    }
  }

  // Secret 5: type "swordfish" anywhere (or search it) and the password gets accepted
  {
    const WORD = 'swordfish';
    let typed = '';
    const launch = () => {
      document.querySelector('.swordfish-fx')?.remove();
      const fx = document.createElement('div');
      fx.className = 'swordfish-fx';
      fx.setAttribute('aria-hidden', 'true');
      fx.innerHTML = `
        <span class="sf-streak"></span>
        <svg class="sf-ship" viewBox="0 0 28 28"><path d="M2 2 L25 11 L15.5 13.5 L13 24 Z" fill="#efe6d2" stroke="#14110f" stroke-width="1.6" stroke-linejoin="miter"/><path d="M2 2 L15.5 13.5" stroke="#b73b2c" stroke-width="1.4"/><path d="M15.5 13.5 L19.5 17.5" stroke="#e3a92b" stroke-width="2.2" stroke-linecap="square"/></svg>
        <div class="sf-words"><p class="sf-big">Swordfish</p><p class="sf-small">Password accepted. Cleared for launch.</p></div>`;
      document.body.append(fx);
      requestAnimationFrame(() => fx.classList.add('is-firing'));
      setTimeout(() => fx.classList.add('is-leaving'), 2600);
      setTimeout(() => fx.remove(), 3200);
      setTimeout(() => window.dismeighUnlock('swordfish'), 900);
    };
    window.dismeighSwordfish = launch;
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      typed = (typed + e.key.toLowerCase()).slice(-WORD.length);
      if (typed === WORD) { typed = ''; launch(); }
    });
  }

  // Secret 6: visit every main page on the site (tracked in this browser)
  {
    const PAGES = ['/', '/garage/', '/work/', '/voice/', '/crew/', '/shelf/', '/guide/', '/log/', '/lore/', '/rewind/', '/wallpapers/'];
    const VKEY = 'dismeigh-explored';
    let path = location.pathname.replace(/index\.html$/, '');
    if (!path.endsWith('/')) path += '/';
    if (PAGES.includes(path)) {
      let seen = [];
      try { seen = JSON.parse(localStorage.getItem(VKEY)) || []; } catch {}
      if (!seen.includes(path)) {
        seen.push(path);
        try { localStorage.setItem(VKEY, JSON.stringify(seen)); } catch {}
        if (PAGES.every(p => seen.includes(p))) setTimeout(() => window.dismeighUnlock('explorer'), 1500);
      }
    }
  }

  // Secret: the Konami code (up up down down left right left right B A), or the same as swipes + two taps on a phone
  {
    const CODE = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', b: 'b', B: 'b', a: 'a', A: 'a' };
    let got = [];
    const feed = k => {
      got = [...got, k].slice(-CODE.length);
      if (got.join() === CODE.join()) { got = []; cheat(); }
    };
    function cheat() {
      document.querySelector('.cheat-fx')?.remove();
      const fx = document.createElement('div');
      fx.className = 'cheat-fx';
      fx.setAttribute('aria-hidden', 'true');
      fx.innerHTML = '<div class="cheat-words"><p class="cheat-big">Cheat code accepted</p><p class="cheat-small">Infinite lives unlocked. (Not really.)</p></div>';
      document.body.append(fx);
      setTimeout(() => fx.classList.add('is-leaving'), 2600);
      setTimeout(() => fx.remove(), 3200);
      setTimeout(() => window.dismeighUnlock('konami'), 700);
    }
    document.addEventListener('keydown', e => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const k = KEYS[e.key];
      if (k) feed(k);
    });
    // Phones: swipe up, up, down, down, left, right, left, right, then tap twice (B, A)
    let sx = 0, sy = 0, st = 0;
    document.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    document.addEventListener('touchend', e => {
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st > 600) return;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) { if (got.length >= 8) feed(got.length === 8 ? 'b' : 'a'); return; }
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
      feed(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive: true });
  }

  // Secret: visit between 3 and 4 in the morning (your own time)
  if (new Date().getHours() === 3) setTimeout(() => window.dismeighUnlock('nightowl'), 2000);

  // Haptic buzz on Android phones (iPhones don't allow websites to vibrate)
  function buzz(pattern) {
    try { if (!reduceMotion && navigator.vibrate) navigator.vibrate(pattern); } catch {}
  }
  window.dismeighBuzz = buzz;

  // Touchscreens: a crosshair shockwave wherever you tap
  if (!reduceMotion) {
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      const wave = document.createElement('span');
      wave.className = 'tap-wave';
      wave.style.left = `${e.clientX}px`;
      wave.style.top = `${e.clientY}px`;
      document.body.appendChild(wave);
      setTimeout(() => wave.remove(), 650);
    }, { passive: true });
  }

  // Fuel gauge: how far down the page you are (shown on phones and tablets)
  const fuel = document.getElementById('fuel-gauge-fill');
  if (fuel) {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      fuel.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // "More" menu in the top nav
  const moreBtn = document.querySelector('.nav-more');
  const menu = document.getElementById('nav-menu');
  if (moreBtn && menu) {
    // Phones: the top bar shrinks to the name, Menu and Search, and the Menu holds every link
    // (the main links are copied in above the usual "More" ones, and only shown on small screens)
    const navEl = moreBtn.closest('.site-nav');
    navEl.classList.add('has-menu');
    const primary = document.createElement('div');
    primary.className = 'nav-menu-primary';
    navEl.querySelectorAll(':scope > a:not(.nav-brand)').forEach(link => primary.append(link.cloneNode(true)));
    menu.prepend(primary);
    const small = matchMedia('(max-width: 900px)');
    const label = () => { moreBtn.textContent = small.matches ? 'Menu' : 'More'; };
    label();
    small.addEventListener?.('change', label);
    const place = () => {
      const nav = moreBtn.closest('.site-nav').getBoundingClientRect();
      const b = moreBtn.getBoundingClientRect();
      menu.style.top = `${Math.round(nav.bottom)}px`;
      menu.style.right = `${Math.max(8, Math.round(innerWidth - b.right))}px`;
    };
    const setOpen = open => {
      menu.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open));
      if (open) { place(); [...menu.querySelectorAll('a:not([hidden])')].find(l => l.offsetParent)?.focus({ preventScroll: true }); }
    };
    moreBtn.addEventListener('click', e => { e.stopPropagation(); setOpen(menu.hidden); });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); moreBtn.focus(); } });
    menu.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    window.addEventListener('resize', () => { if (!menu.hidden) place(); });
    window.addEventListener('scroll', () => { if (!menu.hidden) place(); }, { passive: true });
  }

  // Install as an app
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; hideInstall(); if (quick) quick.hidden = true; });

  function hideInstall() {
    document.querySelectorAll('[data-install-card], [data-install], [data-install-sep]').forEach(el => { el.hidden = true; });
  }
  if (standalone) hideInstall();

  // On the install page: offer the one-tap install where the browser supports it
  const quick = document.getElementById('ins-quick');
  const showQuick = () => { if (quick && deferredPrompt && !standalone) quick.hidden = false; };
  window.addEventListener('beforeinstallprompt', showQuick);
  showQuick();
  document.getElementById('ins-now')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    quick.hidden = true;
    if (choice?.outcome === 'accepted') document.getElementById('ins-installed').hidden = false;
  });
})();

// Clean up the language setting from the removed Spanish toggle
try { localStorage.removeItem('dismeigh-lang'); } catch {}

// Random Quote Board line in the footer, and site-wide search (button in the top nav; "/" or Ctrl+K opens it)
(() => {
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getJSON = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const quotesReady = getJSON('/api/content/quotes').then(d => (d?.quotes || []).filter(q => q && q.text));

  // Footer quote
  const footer = document.querySelector('.footer');
  if (footer) {
    quotesReady.then(quotes => {
      if (!quotes.length) return;
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      const p = document.createElement('p');
      p.className = 'footer-quote';
      p.innerHTML = `<a href="/lore/#quotes"><q>${esc(q.text)}</q> <span>&mdash; Dismeigh${q.game ? `, ${esc(q.game)}` : ''}</span></a>`;
      const after = footer.querySelector('.footer-latenight') || footer.querySelector('.footer-signoff');
      after ? after.after(p) : footer.prepend(p);
    });
  }

  // Retro visitor counter: each visitor's number, odometer style (functions/api/visits.js)
  if (footer) {
    const KEY = 'dismeigh-visitor';
    const show = n => {
      if (!Number.isInteger(n) || n < 1) return;
      const digits = String(n).padStart(6, '0');
      const p = document.createElement('p');
      p.className = 'footer-visitor';
      p.innerHTML = `<span>You are visitor</span> <span class="odo" aria-hidden="true">${[...digits].map(d => `<b>${d}</b>`).join('')}</span><span class="sr-only">number ${n.toLocaleString('en-US')}</span>`;
      const brand = footer.querySelector('.footer-brand');
      brand ? brand.before(p) : footer.append(p);
    };
    let saved = null;
    try { saved = Number(localStorage.getItem(KEY)) || null; } catch {}
    if (saved) show(saved);
    else fetch('/api/visits', { method: 'POST' }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d?.n) return;
      try { localStorage.setItem(KEY, String(d.n)); } catch {}
      show(d.n);
    }).catch(() => {});
  }

  // End credits: "Roll credits" in the footer plays a credits scroll of the people around the channel
  if (footer && typeof HTMLDialogElement !== 'undefined') {
    const SPONSORS = ['Xssy', 'Dubby'];  // keep in step with the sponsor buttons on the home page
    const rollBtn = document.createElement('button');
    rollBtn.type = 'button';
    rollBtn.className = 'roll-credits';
    rollBtn.textContent = 'Roll credits';
    const links = footer.querySelector('.footer-links');
    links ? links.after(rollBtn) : footer.append(rollBtn);

    const dlg = document.createElement('dialog');
    dlg.className = 'credits';
    dlg.setAttribute('aria-label', 'End credits');
    dlg.innerHTML = '<button type="button" class="credits-close">Close</button><div class="credits-window"><div class="credits-roll"></div></div>';
    document.body.append(dlg);
    const roll = dlg.querySelector('.credits-roll');
    const unique = names => [...new Map(names.filter(Boolean).map(n => [String(n).toLowerCase(), String(n)])).values()];
    const block = (title, names) => names.length ? `<section class="cr-block"><h3>${esc(title)}</h3>${names.map(n => `<p>${esc(n)}</p>`).join('')}</section>` : '';

    const build = async () => {
      const [crew, log, bounty, drag] = await Promise.all([
        getJSON('/api/content/crew'), getJSON('/api/log'), getJSON('/api/arcade/scores?game=bounty'), getJSON('/api/arcade/scores?game=drag'),
      ]);
      let visitor = null;
      try { visitor = Number(localStorage.getItem('dismeigh-visitor')) || null; } catch {}
      roll.innerHTML = `
        <p class="cr-title">Dismeigh</p>
        <p class="cr-sub">a stream about questionable decisions</p>
        <section class="cr-block"><h3>Starring</h3><p>Dismeigh <span>as themselves</span></p></section>
        <section class="cr-block"><h3>And introducing</h3><p>The Sojourn ST <span>as the car</span></p></section>
        ${block('The Crew', unique((crew?.crew || []).map(c => c.name)))}
        ${block('With support from', SPONSORS)}
        ${block('Bounty Run legends', unique((bounty?.all || []).map(r => r.name)).slice(0, 5))}
        ${block('Launch Control legends', unique((drag?.all || []).map(r => r.name)).slice(0, 5))}
        ${block('Signed the Ship\u2019s Log', unique((log?.entries || []).map(e => e.name)).slice(0, 24))}
        <section class="cr-block"><h3>Special thanks</h3><p>${visitor ? `You, visitor #${visitor.toLocaleString('en-US')}` : 'You, for watching'}</p><p>Everyone in chat</p></section>
        <p class="cr-end">See you next session.</p>`;
    };
    const start = async () => {
      roll.innerHTML = '<p class="cr-sub">Rolling&hellip;</p>';
      dlg.showModal();
      document.documentElement.classList.add('search-open');
      await build();
      if (!dlg.open) return;
      const windowH = dlg.querySelector('.credits-window').clientHeight;
      const distance = roll.scrollHeight + windowH * 0.55;
      roll.style.setProperty('--cr-from', `${Math.round(windowH * 0.55)}px`);
      roll.style.setProperty('--cr-to', `${-roll.scrollHeight}px`);
      roll.style.setProperty('--cr-time', `${Math.max(12, distance / 45)}s`);
      roll.classList.remove('is-rolling'); void roll.offsetWidth;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) roll.classList.add('is-rolling');
      dlg.querySelector('.credits-close').focus();
    };
    rollBtn.addEventListener('click', start);
    dlg.querySelector('.credits-close').addEventListener('click', () => dlg.close());
    roll.addEventListener('animationend', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { roll.classList.remove('is-rolling'); document.documentElement.classList.remove('search-open'); rollBtn.focus(); });
  }

  // Site search
  const nav = document.querySelector('.site-nav');
  if (typeof HTMLDialogElement === 'undefined') return;
  const PAGES = [
    ['Live', '/#live', 'Home', 'See if Dismeigh is live on Twitch right now.', 'twitch stream live now watch status'],
    ['This Week’s Streams', '/#schedule', 'Home', 'The stream schedule, plus buttons to add it to your own calendar.', 'schedule when times calendar google apple outlook subscribe ics next stream'],
    ['Bounty Board', '/#bounties', 'Home', 'Challenges up for grabs on stream, and what you win.', 'bounty bounties challenge reward claim'],
    ['Clips', '/#highlights', 'Home', 'Highlights and the latest YouTube Shorts.', 'clips highlights youtube shorts videos pinned clip'],
    ['Bounty Run', '/#bounty-run-section', 'Arcade', 'The arcade game on the home page, with a weekly leaderboard.', 'game arcade play high score leaderboard scoreboard'],
    ['Support & Shop', '/#support-heading', 'Home', 'Ways to support the stream.', 'support tip donate shop merch sponsor xssy'],
    ['Ship’s Log', '/log/', 'Page', 'The guestbook. Leave a note for the crew.', 'guestbook log sign message note'],
    ['The Garage', '/garage/', 'Page', 'Project Sojourn: the 2014 Ford Focus ST and its build sheet.', 'car garage sojourn st focus ford mods build sheet'],
    ['Launch Control', '/garage/#launch-control', 'Arcade', 'Drag race the Sojourn ST. Best reaction and time wins.', 'drag race game launch quarter mile reaction leaderboard'],
    ['Work', '/work/', 'Page', 'Websites, Discord servers, VTubing and creative tech.', 'work website web design discord server denizen technologies vtuber hire commission'],
    ['Voice', '/voice/', 'Page', 'Voice acting: Sir Ian in Alvion, and open for roles.', 'voice acting actor sir ian alvion roles commissions'],
    ['The Crew', '/crew/', 'Page', 'Streamer friends, with live status from Twitch.', 'crew friends streamers'],
    ['Dismeigh’s Shelf', '/shelf/', 'Page', 'Favorite anime, games, cars and music.', 'shelf favorites anime cowboy bebop arifureta games fallout new vegas fallout 4 phasmophobia repo r.e.p.o. music xssy wesghost'],
    ['New Viewer Guide', '/guide/', 'Page', 'House rules, chat commands and what to expect.', 'guide new viewer rules chat commands botrix first time'],
    ['Channel Lore', '/lore/', 'Page', 'The running jokes and legendary moments, explained.', 'lore jokes inside moments'],
    ['Quote Board', '/lore/#quotes', 'Page', 'Things that were said out loud, on purpose, in front of chat.', 'quotes quote said'],
    ['Dismeigh Rewind', '/rewind/', 'Page', 'The year in streams: hours, games and busiest nights.', 'rewind year review stats hours top games wrapped'],
    ['Events', '/event/', 'Page', 'Special streams and their run of show.', 'event special stream charity marathon'],
    ['Wallpapers', '/wallpapers/', 'Page', 'Free phone wallpapers with Dismeigh\u2019s art.', 'wallpaper wallpapers lock screen background download free phone'],
    ['Get the app', '/install/', 'Page', 'Add the site to your phone or computer as an app.', 'install app home screen download'],
  ].map(([title, url, kind, text, words]) => ({ title, url, kind, text, words }));

  let index = null;
  // Same slugs as the lore page's share links
  const slug = s => String(s).toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 6).join('-');
  const buildIndex = async () => {
    if (index) return index;
    const [lore, quotes, crew, bounties, verdicts] = await Promise.all([getJSON('/api/content/lore'), quotesReady, getJSON('/api/content/crew'), getJSON('/api/content/bounties'), getJSON('/api/content/verdicts')]);
    index = [
      ...PAGES,
      ...(lore?.entries || []).map(e => ({ title: e.term, url: `/lore/#lore-${slug(e.term)}`, kind: 'Lore', text: e.what, words: e.game || '' })),
      ...quotes.map(q => ({ title: `“${q.text}”`, url: `/lore/#quote-${slug(q.text)}`, kind: 'Quote', text: [q.game, q.context].filter(Boolean).join(' · '), words: '' })),
      ...(crew?.crew || []).map(c => ({ title: c.name, url: '/crew/', kind: 'Crew', text: c.note || 'Part of the crew.', words: c.twitch || '' })),
      ...(verdicts?.verdicts || []).filter(v => v && v.game).map(v => ({ title: v.game, url: '/shelf/#verdicts', kind: 'Verdict', text: `${Math.round(v.score)}/5${v.take ? ` \u00b7 ${v.take}` : ''}`, words: 'verdict rating review' })),
      ...(bounties?.bounties || []).filter(b => b && b.title).map(b => ({ title: b.title, url: '/#bounties', kind: 'Bounty', text: b.reward ? `Reward: ${b.reward}` : '', words: '' })),
    ];
    return index;
  };
  const norm = s => String(s || '').toLowerCase().replace(/[‘’']/g, '').replace(/[^a-z0-9.]+/g, ' ');
  const search = (items, query) => {
    const terms = norm(query).split(' ').filter(Boolean);
    if (!terms.length) return [];
    // Results that match every word first; if nothing does, fall back to results matching any word
    const scored = items.map(it => {
      const title = norm(it.title), all = `${title} ${norm(it.text)} ${norm(it.words)} ${norm(it.kind)}`;
      const hits = terms.filter(t => all.includes(t));
      if (!hits.length) return null;
      let score = 0;
      for (const t of hits) score += title.startsWith(t) ? 6 : title.includes(t) ? 4 : 1;
      if (it.kind === 'Page' || it.kind === 'Home' || it.kind === 'Arcade') score += 0.5;
      return { it, score, full: hits.length === terms.length };
    }).filter(Boolean);
    const full = scored.filter(r => r.full);
    return (full.length ? full : scored).sort((a, b) => b.score - a.score).slice(0, 8).map(r => r.it);
  };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-search';
  btn.setAttribute('aria-label', 'Search the site');
  btn.innerHTML = '<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false"><path d="M416 208c0 45.9-14.9 88.3-40 122.7l126.6 126.7c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0s208 93.1 208 208M208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288"/></svg><span>Search</span>';
  if (nav) {
    const gauge = nav.querySelector('.fuel-gauge');
    gauge ? nav.insertBefore(btn, gauge) : nav.append(btn);
  }

  const dlg = document.createElement('dialog');
  dlg.className = 'search-dialog';
  dlg.setAttribute('aria-labelledby', 'search-title');
  dlg.innerHTML = `
    <form method="dialog" class="search-box" role="search">
      <div class="search-top">
        <h2 id="search-title">Search the ship</h2>
        <button class="search-close" type="submit" aria-label="Close search">&times;</button>
      </div>
      <label class="search-label" for="site-search-input">Pages, lore, quotes, crew and bounties</label>
      <input id="site-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Try &ldquo;Sir Ian&rdquo; or &ldquo;Phasmophobia&rdquo;" aria-controls="site-search-results">
      <ul class="search-results" id="site-search-results" aria-live="polite"></ul>
      <p class="search-empty" hidden>Nothing on the ship matches that yet.</p>
    </form>`;
  document.body.append(dlg);
  const input = dlg.querySelector('input');
  const list = dlg.querySelector('.search-results');
  const none = dlg.querySelector('.search-empty');
  const render = async () => {
    const q = input.value;
    const results = search(await buildIndex(), q);
    if (q !== input.value) return;
    list.innerHTML = results.map(r => `
      <li><a href="${esc(r.url)}"><span class="search-kind">${esc(r.kind)}</span><strong>${esc(r.title)}</strong>${r.text ? `<small>${esc(r.text)}</small>` : ''}</a></li>`).join('');
    none.hidden = !q.trim() || results.length > 0;
  };
  input.addEventListener('input', () => {
    if (input.value.trim().toLowerCase() === 'swordfish' && window.dismeighSwordfish) {
      input.value = ''; list.innerHTML = ''; dlg.close(); window.dismeighSwordfish(); return;
    }
    render();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); list.querySelector('a')?.click(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); list.querySelector('a')?.focus(); }
  });
  list.addEventListener('keydown', e => {
    const links = [...list.querySelectorAll('a')], i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i > -1) { e.preventDefault(); links[Math.min(i + 1, links.length - 1)].focus(); }
    if (e.key === 'ArrowUp' && i > -1) { e.preventDefault(); (i === 0 ? input : links[i - 1]).focus(); }
  });
  // Close after picking a result (also handles links to a spot on the same page)
  list.addEventListener('click', e => { if (e.target.closest('a')) dlg.close(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => document.documentElement.classList.remove('search-open'));
  const open = (query) => {
    if (typeof query === 'string') input.value = query;
    if (dlg.open) return;
    document.querySelector('#nav-menu:not([hidden])') && document.querySelector('.nav-more')?.click();
    dlg.showModal();
    document.documentElement.classList.add('search-open');
    input.select();
    buildIndex();
    if (input.value) render();
  };
  btn.addEventListener('click', () => open());
  window.dismeighSearch = open;
  document.addEventListener('keydown', e => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey)) {
      e.preventDefault(); open();
    }
  });
})();

// Back-to-top ship (long pages) and the first-visit tour (home page)
(() => {
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  // Back to top: appears once you've scrolled a good way down, and flies you back up
  const ship = document.createElement('button');
  ship.type = 'button';
  ship.className = 'to-top';
  ship.setAttribute('aria-label', 'Back to top');
  ship.hidden = true;
  ship.innerHTML = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M2 2 L25 11 L15.5 13.5 L13 24 Z" fill="#efe6d2" stroke="#14110f" stroke-width="1.6" stroke-linejoin="miter"/><path d="M2 2 L15.5 13.5" stroke="#b73b2c" stroke-width="1.4"/><path d="M15.5 13.5 L19.5 17.5" stroke="#e3a92b" stroke-width="2.2" stroke-linecap="square"/></svg>';
  document.body.append(ship);
  const toggle = () => { ship.hidden = window.scrollY < window.innerHeight * 1.5 && !ship.classList.contains('is-flying'); };
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
  ship.addEventListener('click', () => {
    ship.classList.add('is-flying');
    window.scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' });
    setTimeout(() => {
      ship.classList.remove('is-flying'); toggle();
      (document.querySelector('.nav-brand') || document.body).focus?.({ preventScroll: true });
    }, reduce() ? 0 : 700);
  });

  // First-visit tour: home page only, offered once. Preview again with ?tour=1
  if (location.pathname !== '/' && location.pathname !== '/index.html') return;
  const forced = new URLSearchParams(location.search).has('tour');
  if (store.get('dismeigh-tour') && !forced) return;
  // alt: used when the main target is hidden (phones, where top-bar links live in the Menu)
  const STEPS = [
    { sel: '.status-console', title: 'Am I live?', text: 'Check here. When I\u2019m on, an On Air bar pops up at the top too.' },
    { sel: '#crew-strip-heading', title: 'The crew', text: 'The streamers I run with, with their live status. If we\u2019re in the same game, you\u2019ll see it.' },
    { sel: '#schedule-heading', title: 'When I\u2019m live', text: 'The stream schedule. Add it to your own calendar so you never miss a session.' },
    { sel: '#bounties-heading', title: 'Bounty Board', text: 'Challenges up for grabs on stream. Pull one off and you win the reward.' },
    { sel: '#highlights h2', title: 'Clips', text: 'The best bursts of chaos from past streams, playable right here.' },
    { sel: '#shelf-strip-heading', title: 'Dismeigh\u2019s Shelf', text: 'My favorite anime, games, cars and music, plus my verdicts on the games I\u2019ve played.' },
    { sel: '#bounty-run-heading', title: 'The arcade', text: 'Play Bounty Run, set a high score, and get your name on the board.' },
    { sel: '#log-strip-heading', title: 'Ship\u2019s Log', text: 'The guestbook. Sign it before you head out.' },
    { sel: '.site-nav a[href="/lore/"]', title: 'Channel lore', text: 'The running jokes, explained, plus the Quote Board. Start here if chat isn\u2019t making sense.',
      alt: { sel: '.nav-more', title: 'The Menu', text: 'Everything else lives in here: the lore and Quote Board, the Garage, my voice and web work, the viewer guide, free wallpapers and more.' } },
    { sel: '.site-nav a[href="/garage/"]', title: 'The Garage', text: 'My car, the Sojourn ST, plus Launch Control: a drag race you can play.' },
    { sel: '.site-nav a[href="/voice/"]', title: 'Voice and Work', text: 'Voice is my voice acting, like Sir Ian in Alvion. Work is the websites and Discord servers I build.' },
    { sel: '.nav-more', wide: true, title: 'More', text: 'The rest of the ship: the new viewer guide, the crew page, the Ship\u2019s Log, free wallpapers and my year in review.' },
    { sel: '.nav-search', title: 'Search the ship', text: 'Looking for something? Search the whole site from here. On a keyboard, just press /.' },
    { sel: null, title: 'That\u2019s the tour', text: 'One more thing: there are a few secrets hidden around the ship. Happy hunting.' },
  ];
  const done = () => store.set('dismeigh-tour', '1');

  const offer = document.createElement('div');
  offer.className = 'tour-offer';
  offer.setAttribute('role', 'dialog');
  offer.setAttribute('aria-label', 'Site tour');
  offer.hidden = true;
  offer.innerHTML = '<p><strong>New here?</strong> Take a quick tour of the ship.</p><div class="tour-actions"><button type="button" class="tour-start">Start tour</button><button type="button" class="tour-skip">No thanks</button></div>';
  document.body.append(offer);
  offer.querySelector('.tour-skip').addEventListener('click', () => { offer.hidden = true; done(); });
  offer.querySelector('.tour-start').addEventListener('click', () => { offer.hidden = true; done(); run(0); });
  setTimeout(() => { if (!document.querySelector('.title-intro:not([hidden])')) offer.hidden = false; else setTimeout(() => { offer.hidden = false; }, 2500); }, forced ? 600 : 4500);

  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  spot.hidden = true;
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.setAttribute('aria-labelledby', 'tour-title');
  card.hidden = true;
  card.innerHTML = '<p class="tour-count"></p><h2 id="tour-title"></h2><p class="tour-text"></p><div class="tour-actions"><button type="button" class="tour-next">Next</button><button type="button" class="tour-end">End tour</button></div>';
  document.body.append(spot, card);
  let step = -1, target = null;
  const place = () => {
    if (!target) { card.style.width = `${Math.min(340, innerWidth - 24)}px`; card.style.left = `${(innerWidth - card.offsetWidth) / 2}px`; card.style.top = `${Math.max(12, (innerHeight - card.offsetHeight) / 2)}px`; return; }
    const r = target.getBoundingClientRect(), pad = 8;
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const cw = Math.min(340, innerWidth - 24);
    card.style.width = `${cw}px`;
    card.style.left = `${Math.min(Math.max(12, r.left), innerWidth - cw - 12)}px`;
    const below = r.bottom + 18, ch = card.offsetHeight;
    card.style.top = `${below + ch < innerHeight - 12 ? below : Math.max(12, r.top - ch - 18)}px`;
  };
  const end = () => { step = -1; target = null; spot.hidden = card.hidden = true; window.removeEventListener('scroll', place); window.removeEventListener('resize', place); };
  // Work out which stops apply on this screen (phones swap top-bar stops for the Menu), so the count is right
  let plan = [];
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const buildPlan = () => STEPS.map(st => {
    if (!st.sel) return st;
    if (st.wide && matchMedia('(max-width: 900px)').matches) return null;
    if (visible(document.querySelector(st.sel))) return st;
    if (st.alt && visible(document.querySelector(st.alt.sel))) return { ...st, ...st.alt };
    return null;
  }).filter(Boolean);
  function run(i) {
    if (i === 0) plan = buildPlan();
    step = i;
    if (i >= plan.length) return end();
    const s = plan[i];
    target = s.sel ? document.querySelector(s.sel) : null;
    if (target && !target.closest('.site-nav')) target.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
    card.querySelector('.tour-count').textContent = `${i + 1} of ${plan.length}`;
    card.querySelector('#tour-title').textContent = s.title;
    card.querySelector('.tour-text').textContent = s.text;
    card.querySelector('.tour-next').textContent = i === plan.length - 1 ? 'Done' : 'Next';
    spot.hidden = !target;
    card.hidden = false;
    card.classList.toggle('is-center', !target);
    place();
    setTimeout(place, reduce() ? 0 : 450);
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    card.querySelector('.tour-next').focus({ preventScroll: true });
  }

  card.querySelector('.tour-next').addEventListener('click', () => { if (step === plan.length - 1) setTimeout(() => window.dismeighUnlock?.('tourgrad'), 300); run(step + 1); });
  card.querySelector('.tour-end').addEventListener('click', end);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && step > -1) end(); });
})();

// Live favicon: a red dot on the browser tab icon while Dismeigh is live
(() => {
  const links = [...document.querySelectorAll('link[rel="icon"]')];
  if (!links.length) return;
  const originals = links.map(l => l.href);
  let dotted = null, isOn = false;
  const makeDotted = () => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, 64, 64);
      x.beginPath(); x.arc(48, 16, 14, 0, Math.PI * 2);
      x.fillStyle = '#e0312a'; x.fill();
      x.lineWidth = 5; x.strokeStyle = '#14110f'; x.stroke();
      try { resolve(c.toDataURL('image/png')); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = '/favicon-48.png';
  });
  const set = async on => {
    if (on === isOn) return;
    isOn = on;
    window.dismeighLive = on; dispatchEvent(new CustomEvent('dismeigh:live', { detail: on }));
    if (on && !dotted) dotted = await makeDotted();
    links.forEach((l, i) => { l.href = on && dotted ? dotted : originals[i]; });
  };
  const status = document.getElementById('stream-status');
  if (status) {
    // Home page already checks Twitch; just follow its status light
    const sync = () => set(status.classList.contains('is-live'));
    new MutationObserver(sync).observe(status, { attributes: true, attributeFilter: ['class'] });
    sync();
    return;
  }
  const check = async () => {
    try {
      const r = await fetch(`https://decapi.me/twitch/uptime/dismeigh?t=${Date.now()}`, { cache: 'no-store' });
      const t = (await r.text()).trim().toLowerCase();
      set(r.ok && !!t && !/offline|not live|not currently|error|not found/.test(t));
    } catch {}
  };
  if (new URLSearchParams(location.search).has('livefavicon')) set(true);
  else { check(); setInterval(check, 180000); }
})();

// Site banner and holiday look set from the dashboard (/api/site), plus the private page-view count (/api/hit)
(() => {
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Count this page view: page and day only, nothing about the visitor
  try {
    if (!/^\/(dashboard|spotted)/.test(location.pathname)) {
      // Where they came from: just the other site's name, once per visit (not when clicking around this site)
      let r = null;
      try {
        if (!sessionStorage.getItem('dm-src')) {
          const ref = document.referrer ? new URL(document.referrer).hostname : '';
          if (ref !== location.hostname) { r = ref || 'direct'; sessionStorage.setItem('dm-src', '1'); }
        }
      } catch {}
      const body = JSON.stringify(r ? { p: location.pathname, r } : { p: location.pathname });
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/hit', new Blob([body], { type: 'application/json' })))) fetch('/api/hit', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch {}

  fetch('/api/site').then(r => (r.ok ? r.json() : null)).then(s => {
    if (!s) return;
    // Holiday look: cache it so the next page load applies it right away (see the head script), and apply it now
    const previewing = new URLSearchParams(location.search).has('season');
    const before = localStorage.getItem('dm-look');
    try { s.look ? localStorage.setItem('dm-look', JSON.stringify(s.look)) : localStorage.removeItem('dm-look'); } catch {}
    const after = s.look ? JSON.stringify(s.look) : null;
    if (!previewing && before !== after) {
      const root = document.documentElement;
      if (s.look) { if (s.look.mode === 'off') delete root.dataset.season; else root.dataset.season = s.look.mode; }
      else { try { const old = JSON.parse(before || 'null'); if (old?.mode && root.dataset.season === old.mode) delete root.dataset.season; } catch {} }
      window.dismeighSeasonFx?.();
    }
    // "Right now" status line on the home page
    const rn = document.getElementById('right-now');
    if (rn) {
      if (s.now?.text) { rn.innerHTML = `<span class="right-now-k">Right now</span> ${esc(s.now.text)}`; rn.hidden = false; }
      else rn.hidden = true;
    }
    // Commissions open/closed badge on the Voice and Work pages
    document.querySelectorAll('[data-commissions]').forEach(el => {
      const st = s.commissions?.[el.dataset.commissions];
      if (st !== 'open' && st !== 'closed') { el.hidden = true; return; }
      el.className = `commission-badge is-${st}`;
      el.innerHTML = `<span class="commission-dot" aria-hidden="true"></span><b>Commissions ${st}</b>${s.commissions.note ? `<span>${esc(s.commissions.note)}</span>` : ''}`;
      el.hidden = false;
    });
    // "Live now" strip on every page while streaming (the home page has its own On Air bar)
    if (s.liveBar !== false && !document.getElementById('onair-bar') && !/^\/(dashboard|spotted)/.test(location.pathname)) {
      const nav = document.querySelector('.site-nav');
      const live = document.createElement('div');
      live.className = 'site-banner is-live'; live.setAttribute('role', 'status'); live.hidden = true;
      live.innerHTML = '<p><span class="live-dot" aria-hidden="true"></span> Dismeigh is live on Twitch right now. <a href="https://twitch.tv/dismeigh" target="_blank" rel="noopener noreferrer">Watch now</a></p>';
      if (nav) nav.prepend(live); else { live.classList.add('is-loose'); document.body.prepend(live); }
      const sync = on => {
        live.hidden = !on;
        nav?.classList.toggle('is-live-now', on);
        if (nav) nav.classList.toggle('has-banner', on || !!nav.querySelector('.site-banner:not(.is-live)'));
      };
      addEventListener('dismeigh:live', e => sync(e.detail));
      sync(!!window.dismeighLive);
    }
    // Banner across the top of every page, until it ends or the visitor closes it
    const b = s.banner;
    let closed = null; try { closed = localStorage.getItem('dm-banner-closed'); } catch {}
    if (!b || !b.text || String(b.id) === closed || document.querySelector('.site-banner:not(.is-live)')) return;
    const safeLink = typeof b.link === 'string' && (/^https:\/\//.test(b.link) || /^\/(?!\/)/.test(b.link)) ? b.link : '';
    const bar = document.createElement('div');
    bar.className = 'site-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Announcement');
    bar.innerHTML = `<p>${esc(b.text)}${safeLink ? ` <a href="${esc(safeLink)}"${/^https:/.test(safeLink) ? ' target="_blank" rel="noopener noreferrer"' : ''}>More</a>` : ''}</p><button type="button" aria-label="Close announcement">&times;</button>`;
    bar.querySelector('button').addEventListener('click', () => { bar.remove(); const n = document.querySelector('.site-nav'); n?.classList.toggle('has-banner', !!n.querySelector('.site-banner.is-live:not([hidden])')); try { localStorage.setItem('dm-banner-closed', String(b.id)); } catch {} });
    // Sits inside the sticky top bar so it stays on screen while scrolling (and below the phone's status bar)
    const nav = document.querySelector('.site-nav');
    if (nav) { nav.classList.add('has-banner'); nav.prepend(bar); } else { bar.classList.add('is-loose'); document.body.prepend(bar); }
  }).catch(() => {});
})();
