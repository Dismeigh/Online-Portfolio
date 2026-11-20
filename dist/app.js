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

  // Secret achievements: hidden easter eggs, tracked in this browser (and on your account if signed in)
  const SECRETS = { bang: 'BANG!', redline: 'Redline', bounty: 'Bounty claimed', realone: 'For the real ones', swordfish: 'Swordfish' };
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
    line.textContent = found.length >= total ? `All ${total} secrets found. Certified bounty hunter.` : `Secrets found: ${found.length} of ${total}`;
  }

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
    window.dismeighSyncSecret?.(id);
    const count = list.filter(x => SECRETS[x]).length;
    toast(SECRETS[id], count >= total ? `Secret ${count} of ${total}: all found!` : `Secret found: ${count} of ${total}`);
    buzz(count >= total ? [40, 60, 40, 60, 120] : [30, 50, 60]);
    updateFooter();
  };

  updateFooter();

  // Viewer accounts: Sign in with Twitch so secrets follow you across devices
  {
    const CLIENT_ID = '';  // public Twitch app ID, filled in once the Twitch app exists
    const footer = document.querySelector('.footer');
    let me = null;
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), credentials: 'same-origin' });

    function signIn() {
      const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      try { sessionStorage.setItem('dismeigh-auth-state', state); sessionStorage.setItem('dismeigh-auth-return', location.pathname + location.hash); } catch {}
      const params = new URLSearchParams({ response_type: 'token', client_id: CLIENT_ID, redirect_uri: `${location.origin}/auth/`, scope: '', state, force_verify: 'false' });
      location.href = `https://id.twitch.tv/oauth2/authorize?${params}`;
    }

    function renderAccount() {
      if (!footer) return;
      let box = document.getElementById('footer-account');
      if (!box) { box = document.createElement('div'); box.id = 'footer-account'; box.className = 'footer-account'; footer.appendChild(box); }
      box.replaceChildren();
      if (!me) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'twitch-signin';
        b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 2 2.5 6v14h5v3h3l3-3h4l5-5V2zm16 12-3 3h-5l-3 3v-3H5V4h15zM16 7h2v5h-2zm-5 0h2v5h-2z"/></svg><span>Sign in with Twitch</span>';
        b.addEventListener('click', signIn);
        const note = document.createElement('p');
        note.className = 'account-note';
        note.textContent = 'Save your secrets across devices.';
        box.append(b, note);
        return;
      }
      const who = document.createElement('p');
      who.className = 'account-who';
      if (me.avatar) { const img = document.createElement('img'); img.src = me.avatar; img.alt = ''; img.width = 28; img.height = 28; who.append(img); }
      who.append(document.createTextNode(`Signed in as ${me.displayName}`));
      const actions = document.createElement('p');
      actions.className = 'account-actions';
      const out = document.createElement('button');
      out.type = 'button'; out.textContent = 'Sign out';
      out.addEventListener('click', async () => { await post('/api/auth/logout').catch(() => {}); me = null; renderAccount(); });
      const del = document.createElement('button');
      del.type = 'button'; del.textContent = 'Delete my data';
      del.addEventListener('click', async () => {
        if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.textContent = 'Tap again to delete'; setTimeout(() => { del.dataset.confirm = ''; del.textContent = 'Delete my data'; }, 4000); return; }
        await fetch('/api/me', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' }).catch(() => {});
        me = null; renderAccount();
      });
      actions.append(out, document.createTextNode(' · '), del);
      box.append(who);
      box.append(actions);
    }

    function adopt(user) {
      me = user;
      if (me) {
        const merged = [...new Set([...load(), ...me.secrets])].filter(x => SECRETS[x]);
        save(merged);
        me.secrets = merged;
        updateFooter();
      }
      renderAccount();
    }

    window.dismeighSyncSecret = id => {
      if (!me) return;
      if (!me.secrets.includes(id)) me.secrets.push(id);
      post('/api/me/secrets', { ids: [id] }).catch(() => {});
      renderAccount();
    };
    window.dismeighAdoptUser = adopt;

    if (CLIENT_ID) {
      fetch('/api/me', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => {
        if (!d) return;
        adopt(d.user);
        if (d.user) {
          const missing = load().filter(x => SECRETS[x] && !d.user.secrets.includes(x));
          if (missing.length) post('/api/me/secrets', { ids: missing }).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  // Holiday looks: a light falling effect (the colors come from styles.css)
  {
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
  }

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
    const place = () => {
      const nav = moreBtn.closest('.site-nav').getBoundingClientRect();
      const b = moreBtn.getBoundingClientRect();
      menu.style.top = `${Math.round(nav.bottom)}px`;
      menu.style.right = `${Math.max(8, Math.round(innerWidth - b.right))}px`;
    };
    const setOpen = open => {
      menu.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open));
      if (open) { place(); menu.querySelector('a:not([hidden])')?.focus({ preventScroll: true }); }
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
  const quotesReady = getJSON('/quotes.json').then(d => (d?.quotes || []).filter(q => q && q.text));

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
        getJSON('/crew.json'), getJSON('/api/log'), getJSON('/api/arcade/scores?game=bounty'), getJSON('/api/arcade/scores?game=drag'),
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
    const [lore, quotes, crew, bounties, verdicts] = await Promise.all([getJSON('/lore.json'), quotesReady, getJSON('/crew.json'), getJSON('/bounties.json'), getJSON('/verdicts.json')]);
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
