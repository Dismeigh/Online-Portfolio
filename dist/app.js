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
    const count = list.filter(x => SECRETS[x]).length;
    toast(SECRETS[id], count >= total ? `Secret ${count} of ${total}: all found!` : `Secret found: ${count} of ${total}`);
    buzz(count >= total ? [40, 60, 40, 60, 120] : [30, 50, 60]);
    updateFooter();
  };

  updateFooter();

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
