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

  // Secret achievements: three hidden easter eggs, tracked in this browser only
  const SECRETS = { bang: 'BANG!', redline: 'Redline', bounty: 'Bounty claimed', realone: 'For the real ones' };
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
