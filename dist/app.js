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
  const SECRETS = { bang: 'BANG!', redline: 'Redline', bounty: 'Bounty claimed', realone: 'For the real ones', swordfish: 'Swordfish', explorer: 'Explorer', spotted: 'Spotted in the wild', konami: 'Cheat code', nightowl: 'Night owl', arcade: 'Arcade master', lorebuff: 'Lore buff', tourgrad: 'Tour graduate', stowaway: 'Stowaway', catspotter: 'Cat spotter' };
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
    } else {
      const a = document.createElement('a'); a.href = '/secrets/'; a.textContent = 'Need a hint?';
      line.replaceChildren(`Secrets found: ${found.length} of ${total}. `, a);
    }
  }

  // Reward for finding every secret: a downloadable "Certified Bounty Hunter" license wallpaper
  const LICENSE = '/assets/wallpapers/certified-bounty-hunter-k7w3.jpg';
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
        <img src="/assets/wallpapers/certified-bounty-hunter-k7w3-thumb.webp" width="360" height="780" alt="Bounty Hunter License wallpaper: Certified Bounty Hunter, 14 of 14 secrets, with Dismeigh's art and a Verified stamp">
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
    document.dispatchEvent(new CustomEvent('dismeigh:secret', { detail: id }));
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
    const PAGES = ['/', '/garage/', '/work/', '/voice/', '/crew/', '/shelf/', '/guide/', '/log/', '/lore/', '/rewind/', '/wallpapers/', '/press/', '/ask/', '/map/'];
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

  // The ship's cat: a little pixel cat that lives on the footer of every page. Everyone feeds it together
  // (a treat from its bubble once a day, plus the Ship's Log, Ko-fi tips, arcade runs, votes and more). It naps while Dismeigh is live.
  (() => {
    const foot = document.querySelector('.footer');
    if (!foot || /^\/(dashboard|overlay|booth|spotted)/.test(location.pathname)) return;
    let hidden = false; try { hidden = localStorage.getItem('dm-cat-hide') === '1'; } catch {}
    if (hidden) {
      const back = document.createElement('p'); back.className = 'cat-callback';
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Call the ship’s cat back';
      b.addEventListener('click', () => { try { localStorage.removeItem('dm-cat-hide'); } catch {} location.reload(); });
      back.append(b); foot.append(back); return;
    }
    // Sprites: o fur, s stripes, e eyes, p nose, w belly, - closed eyes
    const SPRITES = {
      sit: ['.........o...o..', '.........oo.oo..', '.........ooooo..', '........ooeooeo.', '........oooopoo.', '.........ooooo..', '....ooooooooo...', '...oossosssoo...', '..ooosossooooo..', 'o.oooooooowooo..', 'o.oooooooowwoo..', '.oooooooooowoo..', '..oo.oo..oo.oo..'],
      walkA: ['............o.o.', '............ooo.', '...........ooeoo', 'o..........oooop', 'o.ooooooooooooo.', '.oosossossoooo..', '..oooooooowwoo..', '..oooooooowwoo..', '..o..o.....o..o.', '.o...o.....o...o'],
      walkB: ['............o.o.', '............ooo.', '...........ooeoo', '.o.........oooop', '.oooooooooooooo.', '..osossossoooo..', '..oooooooowwoo..', '..oooooooowwoo..', '...oo.......oo..', '...o.o.....o.o..'],
      sleep: ['..........o.o...', '...ooooooooooo..', '..oossossoo--oo.', '.ooooooooooopoo.', 'ooooooooooooooo.', 'oooowwwwoooooo..', '.oooooooooooo...'],
    };
    const COL = { o: '#c9772f', s: '#8f4f1d', e: '#14110f', p: '#e58a9b', w: '#efe6d2', '-': '#14110f' };
    // Outfits that match the site's holiday looks (R red, W white, K witch purple, O orange, G green, Y gold, P pink, B blue, N pilgrim gray)
    const HC = { R: '#d23a2f', W: '#f4efe4', K: '#7b4bb7', O: '#e08a2c', G: '#2f9a4a', Y: '#e3a92b', P: '#ec7fa0', B: '#3a64c8', N: '#7d7268' };
    const party = ['..Y..', '..P..', '.PYP.', 'PYPYP'], flag = ['.BBB.', '.RWR.', '.BBB.', 'RRRRR'];
    const HATS = { holiday: ['....W', '..RR.', '.RRR.', 'WWWWW'], spooky: ['...K.', '..KK.', '.KOK.', 'KKKKK'], thanksgiving: ['.NNN.', '.NYN.', 'NNNNN'],
      valentines: ['P...P', 'PP.PP', '.PPP.', '..P..'], stpatricks: ['.GGG.', '.GGG.', '.YYY.', 'GGGGG'], easter: ['W...W', 'W...W', 'P...P'],
      birthday: party, anniversary: party, newyear: party, july4: flag, veterans: flag, memorial: flag, presidents: flag };
    const HAT_X = { sit: 9, walkA: 11, walkB: 11, sleep: 9 };
    const svg = name => {
      const rows = SPRITES[name], w = 16, h = rows.length, hat = HATS[document.documentElement.dataset.season]; let r = '';
      rows.forEach((row, y) => [...row].forEach((c, x) => { if (COL[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${COL[c]}"/>`; }));
      const top = hat ? hat.length - 1 : 0;
      if (hat) hat.forEach((row, y) => [...row].forEach((c, x) => { if (HC[c]) r += `<rect x="${HAT_X[name] + x}" y="${y - top}" width="1.02" height="1.02" fill="${HC[c]}"/>`; }));
      return `<svg viewBox="0 ${-top} ${w} ${h + top}" width="${w * 3}" height="${(h + top) * 3}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
    };
    const wrap = document.createElement('div'); wrap.className = 'ship-cat';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cat-btn'; btn.setAttribute('aria-label', 'The ship’s cat. Tap to check on it.');
    const bub = document.createElement('div'); bub.className = 'cat-bubble'; bub.hidden = true; bub.setAttribute('role', 'status');
    wrap.append(bub, btn); foot.prepend(wrap);

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let st = { food: 60, mood: 'content', fedToday: 0 }, pose = 'sit', pos = 12, dir = 1, walking = false, frame = 0;
    const live = () => !!window.dismeighLive;
    const draw = () => { btn.innerHTML = svg(pose); wrap.style.setProperty('--x', `${pos}%`); wrap.classList.toggle('is-left', dir < 0); wrap.dataset.mood = live() ? 'nap' : st.mood; wrap.classList.toggle('is-far', pos > 50); };
    const LINES = {
      happy: ['Purring loudly. The crew’s been taking good care of it.', 'Tail up, belly full. Life on the ship is good.'],
      content: ['Content. Could go for a snack, though.', 'Doing a lap of the deck.'],
      hungry: ['Meowing at the galley door. It could use more visitors.', 'Staring at you. Hungrily.'],
      sulky: ['Sulking with its back to everyone. It’s been a quiet week on the ship.', 'Ignoring you. Visit more often and it might forgive the crew.'],
      nap: ['Napping while the captain’s live. Shh.', 'Curled up asleep. The stream’s on, so it’s off duty.'],
    };
    const pick = a => a[Math.floor(Math.random() * a.length)];
    function say(extra = '') {
      const mood = live() ? 'nap' : st.mood, bar = Math.round(st.food / 10);
      bub.replaceChildren();
      const h = document.createElement('p'); h.className = 'cat-name'; h.textContent = 'The ship’s cat';
      const l = document.createElement('p'); l.textContent = extra || pick(LINES[mood]);
      const m = document.createElement('p'); m.className = 'cat-meter'; m.textContent = `Full: ${'■'.repeat(bar)}${'□'.repeat(10 - bar)} ${st.food}%`;
      const f = document.createElement('p'); f.className = 'cat-fed'; f.textContent = st.fedToday ? `${st.fedToday} crew member${st.fedToday === 1 ? '' : 's'} gave it a treat today` : 'Nobody’s given it a treat yet today';
      const treat = document.createElement('button'); treat.type = 'button'; treat.className = 'cat-treat';
      const done = treatedToday();
      treat.textContent = done ? 'You gave a treat today' : 'Give a treat'; treat.setAttribute('aria-disabled', String(done));
      treat.addEventListener('click', giveTreat);
      const di = document.createElement('p'); di.className = 'cat-diary';
      if (st.today?.text) { di.append(Object.assign(document.createElement('b'), { textContent: `Diary, day ${st.today.n}: ` }), st.today.text === 'Quiet day. Nobody came by. Sulked under the console.' ? 'Nothing yet today. Waiting by the door.' : `${st.today.text} (so far)`); }
      const dl = document.createElement('a'); dl.href = '/cat/'; dl.className = 'cat-diary-link'; dl.textContent = 'Read the cat\u2019s diary';
      const hide = document.createElement('button'); hide.type = 'button'; hide.className = 'cat-hide'; hide.textContent = 'Shoo (hide the cat)';
      hide.addEventListener('click', () => { try { localStorage.setItem('dm-cat-hide', '1'); } catch {} wrap.remove(); });
      bub.append(h, l, m, f, treat, ...(st.today ? [di] : []), dl, hide); bub.hidden = false;
      clearTimeout(say.t); say.t = setTimeout(() => { bub.hidden = true; }, 7000);
    }
    function puff(text) {
      const p = document.createElement('span'); p.className = 'cat-puff'; p.textContent = text; p.setAttribute('aria-hidden', 'true');
      wrap.append(p); setTimeout(() => p.remove(), 1600);
    }
    btn.addEventListener('click', () => {
      if (!bub.hidden) { bub.hidden = true; return; }
      say(); if (!live() && st.mood === 'happy') puff('♥'); window.dismeighBuzz?.(15);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') bub.hidden = true; });

    // Behavior loop: nap while live, sulk in place when very hungry, otherwise wander along the footer now and then
    function tick() {
      if (live()) { pose = 'sleep'; walking = false; draw(); return; }
      if (walking) {
        frame++; pose = frame % 2 ? 'walkA' : 'walkB'; pos += dir * (st.mood === 'happy' ? 1.4 : 0.9);
        if (pos > 86 || pos < 4) { dir = -dir; pos = Math.max(4, Math.min(86, pos)); }
        if (Math.random() < 0.03) { walking = false; pose = 'sit'; }
      } else {
        pose = 'sit';
        if (st.mood === 'sulky') dir = -1;
        const chance = { happy: 0.06, content: 0.035, hungry: 0.012, sulky: 0 }[st.mood];
        if (!still && Math.random() < chance) { walking = true; if (Math.random() < 0.4) dir = -dir; }
      }
      draw();
    }
    draw();
    if (!still) setInterval(() => { if (!document.hidden) tick(); }, 220);
    addEventListener('dismeigh:live', tick);

    // Cat sightings: now and then the cat peeks out from behind something on the page. Catch it for a bonus treat;
    // catch it 5 times for the "Cat spotter" secret.
    const PEEK = ['..o.....o...', '..oo...oo...', '..ooooooo...', '.ooeoooeoo..', '.oooopoooo..', '..ooooooo...', 'oo.......oo.'];
    const peekSvg = () => {
      const hat = HATS[document.documentElement.dataset.season], top = hat ? hat.length - 1 : 0; let r = '';
      PEEK.forEach((row, y) => [...row].forEach((c, x) => { if (COL[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${COL[c]}"/>`; }));
      if (hat) hat.forEach((row, y) => [...row].forEach((c, x) => { if (HC[c]) r += `<rect x="${3 + x}" y="${y - top}" width="1.02" height="1.02" fill="${HC[c]}"/>`; }));
      return `<svg viewBox="0 ${-top} 12 ${PEEK.length + top}" width="48" height="${(PEEK.length + top) * 4}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
    };
    function peekOut() {
      if (live() || document.querySelector('.cat-peek')) return;
      const vh = innerHeight, picks = [...document.querySelectorAll('main section, main article, .content-section > div, .clip-stage, .split-title, main h2, main img, .site-nav')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 120 && r.top > vh * 0.18 && r.top < vh * 0.8 && getComputedStyle(el).visibility !== 'hidden'; });
      if (!picks.length) return false;
      const t = picks[Math.floor(Math.random() * picks.length)], r = t.getBoundingClientRect();
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cat-peek'; b.innerHTML = peekSvg();
      b.setAttribute('aria-label', 'The ship’s cat is peeking out! Tap to catch it.');
      b.style.left = `${Math.round(scrollX + r.left + 16 + Math.random() * Math.max(0, r.width - 80))}px`;
      b.style.top = `${Math.round(scrollY + r.top)}px`;
      document.body.append(b);
      const gone = setTimeout(() => { b.classList.add('is-gone'); setTimeout(() => b.remove(), 400); }, 7000);
      b.addEventListener('click', async () => {
        clearTimeout(gone); b.classList.add('is-caught'); window.dismeighBuzz?.([20, 30, 20]);
        let n = 0; try { n = Number(localStorage.getItem('dm-cat-spots') || 0) + 1; localStorage.setItem('dm-cat-spots', String(n)); } catch {}
        const tag = document.createElement('span'); tag.className = 'cat-peek-tag'; tag.textContent = n >= 5 ? 'Caught!' : `Caught! (${Math.min(n, 5)}/5)`; b.append(tag);
        if (n >= 5) window.dismeighUnlock?.('catspotter');
        try { const d = await (await fetch('/api/cat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"spot":true}' })).json(); if (d && d.food != null) { st = d; draw(); } } catch {}
        setTimeout(() => { b.classList.add('is-gone'); setTimeout(() => b.remove(), 400); }, 1400);
      }, { once: true });
      return true;
    }
    // About 1 in 4 page views, sometime between 10 and 40 seconds in (only while the page is open and someone's looking)
    if (Math.random() < 0.25 || new URLSearchParams(location.search).has('catpeek')) {
      let tries = 0;
      const wait = new URLSearchParams(location.search).has('catpeek') ? 1500 : 10000 + Math.random() * 30000;
      const go = () => { if (document.hidden) return setTimeout(go, 3000); if (peekOut() === false && ++tries < 5) setTimeout(go, 5000); };
      setTimeout(go, wait);
    }

    // A treat from you, once a day (the server makes sure). Everything else that feeds it happens on the server.
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    function treatedToday() { try { return localStorage.getItem('dm-cat-fed') === todayKey; } catch { return false; } }
    async function giveTreat(e) {
      const b = e.currentTarget; if (b.getAttribute('aria-disabled') === 'true') return;
      b.setAttribute('aria-disabled', 'true');
      try {
        const d = await (await fetch('/api/cat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
        if (d && d.food != null) {
          try { localStorage.setItem('dm-cat-fed', todayKey); } catch {}
          st = d; draw();
          if (d.fed) { wrap.classList.remove('is-hop'); void wrap.offsetWidth; wrap.classList.add('is-hop'); puff('+ nom'); window.dismeighBuzz?.([15, 40, 15]); say(live() ? 'It woke up just long enough to eat it. Back to napping.' : 'Nom. It looks very pleased with you.'); }
          else say('It already had a treat from you today. Come back tomorrow!');
        }
      } catch { b.setAttribute('aria-disabled', 'false'); }
    }
    fetch('/api/cat').then(r => (r.ok ? r.json() : null)).then(d => { if (d && d.food != null) { st = d; tick(); } }).catch(() => {});
  })();

  // Site feedback box: a small link in every footer that sends a note to the dashboard
  (() => {
    const foot = document.querySelector('.footer');
    if (!foot || /^\/(dashboard|overlay|booth)/.test(location.pathname)) return;
    const p = document.createElement('p'); p.className = 'footer-feedback';
    const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Spot a bug or have an idea?';
    p.append(open); foot.append(p);
    let dlg = null, opened = 0;
    const browser = () => { const u = navigator.userAgent; return /SamsungBrowser/.test(u) ? 'Samsung Internet' : /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /Chrome|CriOS/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Other'; };
    open.addEventListener('click', () => {
      if (!dlg) {
        dlg = document.createElement('dialog'); dlg.className = 'fb-dialog'; dlg.setAttribute('aria-labelledby', 'fb-h');
        dlg.innerHTML = `<form class="fb-form" novalidate>
          <h2 id="fb-h">Tell Dismeigh</h2>
          <fieldset class="fb-types"><legend>What is it?</legend>
            <label><input type="radio" name="type" value="bug" checked> Something&rsquo;s broken</label>
            <label><input type="radio" name="type" value="idea"> An idea</label>
            <label><input type="radio" name="type" value="other"> Something else</label></fieldset>
          <label for="fb-message">What happened, or what&rsquo;s the idea?</label><textarea id="fb-message" name="message" rows="4" maxlength="1000" required></textarea>
          <label for="fb-contact">How to reach you <span>(optional, if you want a reply)</span></label><input id="fb-contact" name="contact" maxlength="100" placeholder="Email or Discord name">
          <label class="log-trap" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off"></label>
          <p class="fb-fine">To help fix bugs, this also sends which page you&rsquo;re on, your screen width and your browser name. Nothing else.</p>
          <div class="fb-actions"><button type="submit" class="fb-send">Send</button><button type="button" class="fb-close">Close</button></div>
          <p class="fb-msg" role="alert"></p></form>`;
        document.body.append(dlg);
        const form = dlg.querySelector('form'), msg = dlg.querySelector('.fb-msg');
        dlg.querySelector('.fb-close').addEventListener('click', () => dlg.close());
        dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
        form.addEventListener('submit', async e => {
          e.preventDefault(); msg.textContent = ''; msg.classList.remove('is-ok'); const btn = form.querySelector('.fb-send'); btn.disabled = true;
          const data = Object.fromEntries(new FormData(form));
          Object.assign(data, { page: location.pathname, width: innerWidth, browser: browser(), elapsed: Date.now() - opened });
          try {
            const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { msg.textContent = d.error || 'Couldn’t send that. Try again.'; if (d.field) document.getElementById(d.field)?.focus(); }
            else { msg.textContent = 'Sent. Thank you!'; msg.classList.add('is-ok'); form.reset(); setTimeout(() => dlg.open && dlg.close(), 1600); }
          } catch { msg.textContent = 'Couldn’t send that. Check your connection.'; }
          btn.disabled = false;
        });
      }
      opened = Date.now(); dlg.querySelector('.fb-msg').textContent = ''; dlg.showModal(); dlg.querySelector('#fb-message').focus();
    });
  })();

  // Link tap counts for the dashboard: only which kind of outside link (Twitch, Discord, Ko-fi...), nothing about who tapped
  if (!/^\/(dashboard|overlay|booth)/.test(location.pathname)) {
    document.addEventListener('click', e => {
      const a = e.target.closest?.('a[href]'); if (!a) return;
      let h = '';
      if (/^mailto:/i.test(a.href)) h = 'email';
      else if (/^webcal:/i.test(a.href)) h = 'calendar';
      else { try { const u = new URL(a.href); if (u.origin === location.origin || !/^https?:$/.test(u.protocol)) return; h = u.hostname; } catch { return; } }
      const body = JSON.stringify({ h });
      try { if (!(navigator.sendBeacon && navigator.sendBeacon('/api/click', new Blob([body], { type: 'application/json' })))) fetch('/api/click', { method: 'POST', body, keepalive: true }).catch(() => {}); } catch {}
    }, { capture: true, passive: true });
  }

  // "What's new" dot: shows on the menu button and the What's new link when there's a post this visitor hasn't seen.
  // It goes away when they open /new/, or on its own 14 days after the newest post.
  (() => {
    const more = document.querySelector('.nav-more'), link = document.querySelector('.nav-new-link');
    if (!more || !link) return;
    const show = latest => {
      let seen = ''; try { seen = localStorage.getItem('dm-seen-new') || ''; } catch {}
      const fresh = latest && latest > seen && Date.now() - Date.parse(`${latest}T12:00:00`) < 14 * 86400000 && location.pathname !== '/new/';
      more.classList.toggle('has-new', !!fresh); link.classList.toggle('has-new', !!fresh);
      if (fresh) link.setAttribute('aria-label', 'What’s new (new update)'); else link.removeAttribute('aria-label');
    };
    window.dismeighNewSeen = () => show('');
    let cached = null; try { cached = JSON.parse(sessionStorage.getItem('dm-new-latest') || 'null'); } catch {}
    if (cached && Date.now() - cached.at < 30 * 60000) return show(cached.date);
    fetch('/api/content/updates').then(r => (r.ok ? r.json() : null)).then(d => {
      const date = d?.updates?.[0]?.date || '';
      try { sessionStorage.setItem('dm-new-latest', JSON.stringify({ date, at: Date.now() })); } catch {}
      show(date);
    }).catch(() => {});
  })();

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

  // Retro visitor counter: how many people have visited the site so far, odometer style (functions/api/visits.js)
  if (footer) {
    const KEY = 'dismeigh-visitor';
    const show = n => {
      if (!Number.isInteger(n) || n < 1) return;
      const digits = String(n).padStart(6, '0');
      const p = document.createElement('p');
      p.className = 'footer-visitor';
      p.innerHTML = `<span class="odo" aria-hidden="true">${[...digits].map(d => `<b>${d}</b>`).join('')}</span> <span>visitors so far</span><span class="sr-only">: ${n.toLocaleString('en-US')} people have visited</span>`;
      const brand = footer.querySelector('.footer-brand');
      brand ? brand.before(p) : footer.append(p);
    };
    let saved = null;
    try { saved = Number(localStorage.getItem(KEY)) || null; } catch {}
    // First visit: count this visitor once. After that: just read the total.
    (saved ? fetch('/api/visits') : fetch('/api/visits', { method: 'POST' })).then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      if (d.n) { try { localStorage.setItem(KEY, String(d.n)); } catch {} }
      show(Math.max(d.total || 0, d.n || 0, saved || 0));
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
    ['Wanted poster maker', '/wallpapers/#poster', 'Page', 'Make your own Bebop-style wanted poster.', 'wanted poster maker bounty profile picture pfp woolongs make generator'],
    ['Ask the Captain', '/ask/', 'Page', 'Send Dismeigh a question and read the answers.', 'ask question questions q&a qa answer captain faq'],
    ['What\u2019s new', '/new/', 'Page', 'The latest upgrades to the site.', 'new whats news updates changelog changes latest'],
    ['Car meets', '/garage/#meets', 'Page', 'Where the Sojourn ST will be next.', 'car meet meets meetup event cars and coffee show'],
    ['The cat\u2019s diary', '/cat/', 'Page', 'What the ship\u2019s cat got up to each day.', 'cat kitty pet diary ship cat treats feed'],
    ['Secret hints', '/secrets/', 'Page', 'Clues for the hidden secrets around the site.', 'secret secrets hint hints achievements easter eggs clue clues license bounty hunter'],
    ['Ship map', '/map/', 'Page', 'A deck plan of the ship: every room is a page.', 'map ship deck plan rooms directory sitemap navigate'],
    ['Clip of the Month', '/#highlights', 'Page', 'Vote for your favorite home page clip.', 'clip of the month vote voting favorite clips'],
    ['Press kit', '/press/', 'Page', 'Bios, images, colors and links for events and collabs.', 'press kit media kit bio logo avatar colors fonts collab event feature contact'],
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
  // Count what people searched for (the words only), once they stop typing or pick a result
  let logged = '', logTimer = 0, lastCount = 0;
  const logTerm = () => {
    clearTimeout(logTimer);
    const t = input.value.trim().toLowerCase();
    if (t.length < 2 || t === logged) return;
    logged = t;
    const body = JSON.stringify({ t, n: lastCount });
    try { navigator.sendBeacon ? navigator.sendBeacon('/api/searchlog', new Blob([body], { type: 'text/plain' })) : fetch('/api/searchlog', { method: 'POST', body, keepalive: true }); } catch {}
  };
  const render = async () => {
    const q = input.value;
    const results = search(await buildIndex(), q);
    if (q !== input.value) return;
    lastCount = results.length; clearTimeout(logTimer); logTimer = setTimeout(logTerm, 2500);
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
  list.addEventListener('click', e => { if (e.target.closest('a')) { logTerm(); dlg.close(); } });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { logTerm(); document.documentElement.classList.remove('search-open'); });
  const open = (query) => {
    if (typeof query === 'string') input.value = query;
    if (dlg.open) { if (typeof query === 'string') render(); return; }
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
        const qs = new URLSearchParams(location.search);
        if (qs.get('src') === 'card' || qs.get('src') === 'booth') {
          // Scanned from the business card or booth QR: count it once, then drop ?src= so shared links don't count as scans
          r = qs.get('src') === 'booth' ? 'qr-booth' : 'qr-card'; sessionStorage.setItem('dm-src', '1');
          qs.delete('src'); history.replaceState(history.state, '', location.pathname + (qs.toString() ? `?${qs}` : '') + location.hash);
        } else if (!sessionStorage.getItem('dm-src')) {
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
    // Commissions open/closed: voice, web and discord each have their own switch. "work" shows both web and discord.
    const cm = s.commissions || {}, NAME = { voice: 'Voice acting', web: 'Websites', discord: 'Discord servers' };
    const shown = k => cm[k] === 'open' || cm[k] === 'closed';
    document.querySelectorAll('[data-commissions]').forEach(el => {
      const k = el.dataset.commissions;
      if (k === 'work') {
        const parts = ['web', 'discord'].filter(shown);
        if (!parts.length) { el.hidden = true; return; }
        const anyOpen = parts.some(p => cm[p] === 'open');
        el.className = `commission-badge is-${anyOpen ? 'open' : 'closed'}`;
        el.innerHTML = `<span class="commission-dot" aria-hidden="true"></span>${parts.map(p => `<b>${NAME[p]}: ${cm[p]}</b>${cm.notes?.[p] ? `<span>${esc(cm.notes[p])}</span>` : ''}`).join('<i class="commission-sep" aria-hidden="true">&middot;</i>')}`;
        el.hidden = false; return;
      }
      if (!shown(k)) { el.hidden = true; return; }
      el.className = `${el.classList.contains('rate-status') ? 'rate-status ' : ''}commission-badge is-${cm[k]}`;
      el.innerHTML = `<span class="commission-dot" aria-hidden="true"></span><b>${el.classList.contains('rate-status') ? cm[k] : `${k === 'voice' ? 'Commissions' : NAME[k]} ${cm[k]}`}</b>${cm.notes?.[k] ? `<span>${esc(cm.notes[k])}</span>` : ''}`;
      el.hidden = false;
    });
    // Spots left (from the dashboard's Spots setting), next to the Discord/Websites headings
    for (const k of ['web', 'discord']) {
      const c = s.capacity?.[k], el = document.querySelector(`.rate-status[data-commissions="${k}"]`);
      if (!c || !el || el.hidden || c.full) continue;
      const sp = document.createElement('span'); sp.className = 'rate-spots'; sp.textContent = `${c.left} spot${c.left === 1 ? '' : 's'} left`; el.append(sp);
    }
    // Quote button on the Work page: a waitlist when both web and discord are closed
    const qb = document.getElementById('rates-quote');
    if (qb && cm.web === 'closed' && cm.discord === 'closed') { qb.textContent = 'Join the waitlist'; qb.href = 'mailto:denizen.dismeigh@gmail.com?subject=Waitlist'; }
    window.dismeighCommissions = cm;
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
    // Birthday (April 12) and Twitch anniversary (June 10): a strip across every page for the day, closable
    {
      const day = document.documentElement.dataset.season;
      if ((day === 'birthday' || day === 'anniversary') && !/^\/(dashboard|overlay)/.test(location.pathname)) {
        const key = `dm-party-${day}-${new Date().getFullYear()}`;
        let shut = false; try { shut = localStorage.getItem(key) === '1'; } catch {}
        if (!shut) {
          const yrs = Number(document.documentElement.dataset.streamYears || 1);
          const strip = document.createElement('div');
          strip.className = 'site-banner is-party'; strip.setAttribute('role', 'note');
          strip.innerHTML = day === 'birthday'
            ? '<p>It\u2019s Dismeigh\u2019s birthday! Come hang out and celebrate on stream. <a href="https://twitch.tv/dismeigh" target="_blank" rel="noopener noreferrer">Say happy birthday</a></p><button type="button" aria-label="Close">&times;</button>'
            : `<p>${yrs} year${yrs === 1 ? '' : 's'} of Dismeigh on Twitch! Thanks for being part of the crew. <a href="/rewind/">See the Rewind</a></p><button type="button" aria-label="Close">&times;</button>`;
          const nav = document.querySelector('.site-nav');
          if (nav) { nav.prepend(strip); nav.classList.add('has-banner'); } else { strip.classList.add('is-loose'); document.body.prepend(strip); }
          strip.querySelector('button').addEventListener('click', () => {
            strip.remove(); try { localStorage.setItem(key, '1'); } catch {}
            if (nav) nav.classList.toggle('has-banner', !!nav.querySelector('.site-banner:not([hidden])'));
          });
        }
      }
    }
    // Banner across the top of every page, until it ends or the visitor closes it
    const b = s.banner;
    let closed = null; try { closed = localStorage.getItem('dm-banner-closed'); } catch {}
    if (!b || !b.text || String(b.id) === closed || document.querySelector('.site-banner:not(.is-live):not(.is-party)')) return;
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

// "Refuel the ship": any [data-kofi-tip] link opens Ko-fi's own tip panel in a window over the page.
// The payment happens entirely on Ko-fi (inside their frame); if anything fails, the link just opens Ko-fi normally.
(() => {
  const URL_ = 'https://ko-fi.com/dismeigh/?hidefeed=true&widget=true&embed=true&preview=true';
  let dlg = null;
  const build = () => {
    dlg = document.createElement('dialog');
    dlg.className = 'tip-dialog';
    dlg.setAttribute('aria-labelledby', 'tip-title');
    dlg.innerHTML = `<div class="tip-head"><div><p class="tip-kicker">Tip on Ko-fi</p><h2 id="tip-title">Refuel the ship</h2></div>
      <button type="button" class="tip-close" aria-label="Close">&times;</button></div>
      <p class="tip-copy">Every tip keeps the streams, the site and the Sojourn ST running. Thank you, space cowboy.</p>
      <div class="tip-frame"><p class="tip-loading">Loading Ko-fi&hellip;</p><iframe title="Tip Dismeigh on Ko-fi" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"></iframe></div>
      <p class="tip-alt"><a href="https://ko-fi.com/dismeigh" target="_blank" rel="noopener noreferrer">Open Ko-fi in a new tab instead</a></p>`;
    document.body.append(dlg);
    const close = () => dlg.close();
    dlg.querySelector('.tip-close').addEventListener('click', close);
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
    dlg.querySelector('.tip-alt a').addEventListener('click', close);
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-kofi-tip]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || typeof HTMLDialogElement !== 'function') return;
    e.preventDefault();
    try {
      if (!dlg) build();
      const f = dlg.querySelector('iframe');
      if (!f.src) { f.addEventListener('load', () => dlg.querySelector('.tip-loading')?.remove(), { once: true }); f.src = URL_; }
      dlg.showModal();
    } catch { window.open(a.href, '_blank', 'noopener'); }
  });
})();
