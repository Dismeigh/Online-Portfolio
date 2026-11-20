// The Crew: streamer friends with live status from Twitch (via decapi.me, same as the main channel).
// Used by /crew/ (full cards) and the home page console (a row that appears only when someone is live).
(() => {
  const ask = async path => {
    try {
      const r = await fetch(`https://decapi.me/twitch/${path}`, { cache: 'no-store' });
      const t = (await r.text()).trim();
      return r.ok && t && !/^error|not found|no user|user not found/i.test(t) ? t : '';
    } catch { return null; }   // null = couldn't reach Twitch
  };
  const isLive = t => t && !/offline|not live|not currently/i.test(t);
  // Fill a picture holder with the friend's avatar; show their initial if the image can't load
  function setPic(holder, f, size) {
    holder.textContent = f.name.slice(0, 1).toUpperCase();
    if (!f.avatar) return;
    const img = document.createElement('img');
    img.alt = ''; img.width = size; img.height = size; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.onload = () => holder.replaceChildren(img);
    img.src = f.avatar;
  }

  async function check(friend) {
    const user = encodeURIComponent(String(friend.twitch || '').toLowerCase());
    const [uptime, avatar] = await Promise.all([ask(`uptime/${user}`), ask(`avatar/${user}`)]);
    const live = isLive(uptime);
    const [game, title] = live ? await Promise.all([ask(`game/${user}`), ask(`title/${user}`)]) : ['', ''];
    // Profile picture: DecAPI's answer if it gives one, otherwise unavatar.io (looks up Twitch avatars by username)
    const pic = /^https:\/\/[^\s]+$/.test(avatar || '') ? avatar : `https://unavatar.io/twitch/${user}?fallback=false`;
    return { ...friend, live, unknown: uptime === null, game: game || '', title: title || '', avatar: pic, url: `https://twitch.tv/${user}` };
  }

  async function loadCrew() {
    const r = await fetch('/crew.json', { cache: 'no-store' });
    const list = (await r.json()).crew || [];
    const out = await Promise.all(list.filter(f => f && f.twitch).map(check));
    return out.sort((a, b) => (b.live - a.live) || a.name.localeCompare(b.name));
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // Crew page
  const grid = document.getElementById('crew-grid');
  if (grid) {
    const render = crew => {
      grid.replaceChildren(...crew.map(f => {
        const card = el('article', `crew-card${f.live ? ' is-live' : ''}`);
        const top = el('div', 'crew-top');
        const pic = el('div', 'crew-pic');
        setPic(pic, f, 72);
        const who = el('div', 'crew-who');
        who.append(el('h2', 'crew-name', f.name), el('p', `crew-status${f.live ? ' live' : ''}`, f.live ? 'Live now' : f.unknown ? 'Status unknown' : 'Offline'));
        top.append(pic, who);
        card.append(top);
        if (f.live && (f.game || f.title)) {
          const now = el('p', 'crew-now');
          if (f.game) now.append(el('strong', '', f.game));
          if (f.title) now.append(el('span', '', f.title));
          card.append(now);
        }
        if (f.note) card.append(el('p', 'crew-note', f.note));
        const a = el('a', 'social-btn crew-go', f.live ? 'Watch live' : 'Follow on Twitch');
        a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        card.append(a);
        return card;
      }));
      const n = crew.filter(f => f.live).length;
      if (!n && crew.length && crew.every(f => f.unknown)) { document.getElementById('crew-summary').textContent = 'Couldn’t check Twitch right now. The buttons below still take you to their channels.'; return; }
      document.getElementById('crew-summary').textContent = n ? `${n} of the crew ${n === 1 ? 'is' : 'are'} live right now.` : 'Nobody from the crew is live right now. Go give them a follow.';
    };
    const run = () => loadCrew().then(render).catch(() => { document.getElementById('crew-summary').textContent = 'Couldn’t reach Twitch right now. Try again in a bit.'; });
    run(); setInterval(run, 120000);
  }

  // Home page strip (bottom of the Live section)
  const strip = document.getElementById('crew-strip');
  if (strip) {
    const summary = document.getElementById('crew-strip-summary');
    const run = () => loadCrew().then(crew => {
      strip.replaceChildren(...crew.map(f => {
        const li = el('li');
        const a = el('a', `crew-chip${f.live ? ' is-live' : ''}`);
        a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', `${f.name}, ${f.live ? `live now${f.game ? ` playing ${f.game}` : ''}` : f.unknown ? 'on Twitch' : 'offline'}`);
        const pic = el('span', 'crew-chip-pic');
        setPic(pic, f, 44);
        const text = el('span', 'crew-chip-text');
        text.append(el('span', 'crew-chip-name', f.name),
          el('span', `crew-chip-status${f.live ? ' live' : ''}`, f.live ? `Live${f.game ? ` · ${f.game}` : ''}` : f.unknown ? 'On Twitch' : 'Offline'));
        a.append(pic, text); li.append(a);
        return li;
      }));
      const n = crew.filter(f => f.live).length;
      summary.textContent = n ? `${n === 1 ? `${crew.find(f => f.live).name} is` : `${n} of the crew are`} live right now. Go say hi!` : 'The streamers I run with. Go say hi.';
      lastCrew = crew; showCoop();
    }).catch(() => {});

    // "Co-op in progress": Dismeigh and a crew member live in the same game right now.
    // Preview with ?coop=1
    const coopRow = document.getElementById('coop-row');
    const status = document.getElementById('stream-status');
    let lastCrew = [];
    const preview = new URLSearchParams(location.search).has('coop');
    const sameGame = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
    function showCoop() {
      if (!coopRow) return;
      const mine = preview ? 'Phasmophobia' : window.dismeighLiveGame;
      const live = preview || status?.classList.contains('is-live');
      const crew = preview ? lastCrew.slice(0, 1).map(f => ({ ...f, live: true, game: 'Phasmophobia' })) : lastCrew;
      const mates = live ? crew.filter(f => f.live && sameGame(f.game, mine)) : [];
      if (!mates.length) { coopRow.hidden = true; return; }
      const names = document.getElementById('coop-names');
      names.replaceChildren();
      mates.forEach((f, i) => {
        if (i) names.append(document.createTextNode(i === mates.length - 1 ? ' & ' : ', '));
        const a = el('a', '', f.name); a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        names.append(a);
      });
      coopRow.hidden = false;
    }
    window.addEventListener('dismeigh:livegame', showCoop);
    if (status) new MutationObserver(showCoop).observe(status, { attributes: true, attributeFilter: ['class'] });
    run(); setInterval(run, 180000);
  }
})();
