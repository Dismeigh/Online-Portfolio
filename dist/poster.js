// Wanted poster maker. Everything happens in this browser: the name, the photo and the finished
// poster never leave the device (no uploads, no storage).
(() => {
  const form = document.getElementById('poster-form');
  const canvas = document.getElementById('poster-canvas');
  if (!form || !canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const $ = id => document.getElementById(id);
  const nameIn = $('poster-name'), crimeIn = $('poster-crime'), rewardIn = $('poster-reward'), photoIn = $('poster-photo');
  const dl = $('poster-download'), shareBtn = $('poster-share'), clearBtn = $('poster-clear-photo');
  let photo = null, photoUrl = '';

  const C = { ink: '#14110f', paper: '#efe6d2', dim: '#7a6f5c', red: '#b73b2c', mustard: '#e3a92b' };
  const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

  const fit = (text, font, size, maxW, min = 28) => {
    let s = size;
    do { ctx.font = `${s}px ${font}`; if (ctx.measureText(text).width <= maxW) break; s -= 4; } while (s > min);
    return s;
  };
  const wrap = (text, maxW) => {
    const words = text.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines.slice(0, 3);
  };

  const STYLES = {
    wanted: { crimeL: 'Wanted for', rewardL: 'Reward (Woolongs)', crime: 'Being way too good at the arcade', reward: 6000000, chips: true },
    mostwanted: { crimeL: 'Wanted for', rewardL: 'Reward (Woolongs)', crime: 'Crimes against the backseat', reward: 99000000, chips: true },
    missing: { crimeL: 'Last seen', rewardL: 'Reward if found (Woolongs)', crime: 'Lurking in chat at 2 AM', reward: 500000, chips: false },
    crewid: { crimeL: 'Role on the ship', rewardL: 'Crew number', crime: 'Professional backseat driver', reward: 7, chips: false },
  };
  const style = () => form.querySelector('[name="poster-style"]:checked')?.value || 'wanted';
  let lastStyle = '';
  function syncLabels() {
    const st = STYLES[style()]; if (lastStyle === style()) return; lastStyle = style();
    $('poster-crime-l').textContent = st.crimeL; $('poster-reward-l').textContent = st.rewardL;
    crimeIn.placeholder = st.crime; rewardIn.placeholder = st.reward.toLocaleString('en-US');
    document.querySelector('.poster-chips').hidden = !st.chips;
  }
  function photoBox(px, py, pw, ph, tone = 'grayscale(1) sepia(0.45) contrast(1.15)') {
    ctx.fillStyle = '#d8ccb3'; ctx.fillRect(px, py, pw, ph);
    if (photo) {
      const r = Math.max(pw / photo.width, ph / photo.height), iw = photo.width * r, ih = photo.height * r;
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      ctx.filter = tone; ctx.drawImage(photo, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih);
      ctx.restore(); ctx.filter = 'none';
    } else {
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      ctx.fillStyle = '#a89c85';
      ctx.beginPath(); ctx.arc(px + pw / 2, py + ph * 0.39, ph * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph + ph * 0.07, pw * 0.33, ph * 0.41, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.font = `${Math.round(ph * 0.27)}px Anton, Impact, sans-serif`; ctx.fillText('?', px + pw / 2, py + ph * 0.49);
      ctx.restore();
    }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.strokeRect(px, py, pw, ph);
  }
  function paper() {
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.paper; ctx.fillRect(24, 24, W - 48, H - 48);
    ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = C.ink;
    for (let i = 0; i < 900; i++) { const x = (i * 7919) % (W - 48) + 24, y = (i * 104729) % (H - 48) + 24; ctx.fillRect(x, y, 2 + (i % 3), 2); }
    ctx.restore();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.strokeRect(54, 54, W - 108, H - 108);
  }
  function stamp(text, x, y, color = C.red) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.22); ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 6;
    ctx.font = '62px Anton, Impact, sans-serif'; const w = ctx.measureText(text).width + 60;
    ctx.strokeRect(-w / 2, -50, w, 92); ctx.textAlign = 'center'; ctx.fillText(text, 0, 26); ctx.restore();
  }
  function footer() { ctx.textAlign = 'center'; ctx.fillStyle = C.dim; ctx.font = '26px "Special Elite", "Courier New", monospace'; ctx.fillText('Issued by Dismeigh’s crew  ·  denizen-dismeigh.com', W / 2, H - 84); }
  function poster(kind, name, crime, amount) {
    paper();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.ink;
    ctx.font = '34px "Special Elite", "Courier New", monospace';
    const top = { wanted: 'BOUNTY HUNTER BULLETIN', mostwanted: 'PRIORITY BULLETIN', missing: 'SHIP-WIDE NOTICE' }[kind];
    ctx.fillText(`${top}  ·  NO. ${String(amount % 10000).padStart(4, '0')}`, W / 2, 118);
    if (kind === 'mostwanted') {
      ctx.fillStyle = C.red; ctx.fillRect(90, 150, W - 180, 200);
      ctx.fillStyle = C.paper; ctx.font = `${fit('MOST WANTED', 'Anton, Impact, sans-serif', 180, W - 240)}px Anton, Impact, sans-serif`; ctx.fillText('MOST WANTED', W / 2, 322);
      ctx.fillStyle = C.ink; ctx.font = '34px "Special Elite", "Courier New", monospace'; ctx.fillText('EXTREMELY DANGEROUS IN CHAT', W / 2, 392);
    } else {
      const big = kind === 'missing' ? 'MISSING' : 'WANTED';
      ctx.font = '210px Anton, Impact, sans-serif'; ctx.fillText(big, W / 2, 330);
      ctx.font = '34px "Special Elite", "Courier New", monospace';
      ctx.fillText(kind === 'missing' ? 'HAVE YOU SEEN THIS CREW MEMBER?' : 'DEAD OR LIVE-STREAMING', W / 2, 382);
    }
    photoBox(150, 420, W - 300, 560, kind === 'missing' ? 'grayscale(1) contrast(1.05)' : undefined);
    const ns = fit(name.toUpperCase(), 'Anton, Impact, sans-serif', 130, W - 200);
    ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.font = `${ns}px Anton, Impact, sans-serif`; ctx.fillText(name.toUpperCase(), W / 2, 1120);
    ctx.font = '38px "Special Elite", "Courier New", monospace'; ctx.fillStyle = C.dim; ctx.fillText(kind === 'missing' ? 'LAST SEEN' : 'WANTED FOR', W / 2, 1180);
    ctx.fillStyle = C.ink; ctx.font = '42px "Special Elite", "Courier New", monospace';
    wrap(crime, W - 240).forEach((l, i) => ctx.fillText(l, W / 2, 1232 + i * 50));
    ctx.fillStyle = kind === 'mostwanted' ? C.red : C.mustard; ctx.fillRect(110, 1380, W - 220, 150);
    ctx.fillStyle = kind === 'mostwanted' ? C.paper : C.ink; ctx.font = '36px "Special Elite", "Courier New", monospace';
    ctx.fillText(kind === 'missing' ? 'REWARD IF FOUND' : 'REWARD', W / 2, 1424);
    const rw = amount.toLocaleString('en-US') + ' WOOLONGS';
    ctx.font = `${fit(rw, 'Anton, Impact, sans-serif', 84, W - 280)}px Anton, Impact, sans-serif`; ctx.fillText(rw, W / 2, 1510);
    if (kind === 'wanted') stamp('BOUNTY', W - 230, 470);
    if (kind === 'mostwanted') stamp('TOP 10', W - 230, 470);
    if (kind === 'missing') stamp('URGENT', W - 230, 470, C.ink);
    footer();
  }
  function crewId(name, role, num) {
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
    // lanyard
    ctx.fillStyle = C.red; ctx.fillRect(W / 2 - 60, 0, 120, 150);
    const cx = 110, cy = 150, cw = W - 220, ch = H - 260;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(cx + 16, cy + 16, cw, ch);
    ctx.fillStyle = C.paper; ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = C.ink; ctx.fillRect(W / 2 - 70, cy + 30, 140, 22);           // clip slot
    ctx.fillStyle = C.mustard; ctx.fillRect(cx, cy + 80, cw, 150);
    ctx.fillStyle = C.ink; ctx.textAlign = 'center';
    ctx.font = '96px Anton, Impact, sans-serif'; ctx.fillText('SHIP’S CREW ID', W / 2, cy + 196);
    photoBox(cx + 150, cy + 290, cw - 300, cw - 300, 'saturate(0.9) contrast(1.05)');
    const y0 = cy + 290 + cw - 300 + 110;
    ctx.fillStyle = C.ink; ctx.font = `${fit(name.toUpperCase(), 'Anton, Impact, sans-serif', 120, cw - 120)}px Anton, Impact, sans-serif`; ctx.fillText(name.toUpperCase(), W / 2, y0);
    ctx.fillStyle = C.dim; ctx.font = '34px "Special Elite", "Courier New", monospace'; ctx.fillText('ROLE ON THE SHIP', W / 2, y0 + 62);
    ctx.fillStyle = C.ink; ctx.font = '42px "Special Elite", "Courier New", monospace';
    wrap(role, cw - 140).slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, y0 + 112 + i * 50));
    // crew number + barcode
    const by = cy + ch - 190;
    ctx.fillStyle = C.red; ctx.font = '40px "Special Elite", "Courier New", monospace'; ctx.fillText(`CREW NO. ${String(num).padStart(4, '0')}`, W / 2, by - 20);
    ctx.fillStyle = C.ink; let x = cx + 160, seed = num * 9301 + name.length * 49297;
    while (x < cx + cw - 160) { seed = (seed * 9301 + 49297) % 233280; const w = 3 + (seed % 9); ctx.fillRect(x, by, w, 90); x += w + 4 + (seed % 7); }
    ctx.fillStyle = C.dim; ctx.font = '26px "Special Elite", "Courier New", monospace'; ctx.fillText('Authorized by Captain Dismeigh  ·  denizen-dismeigh.com', W / 2, cy + ch - 40);
  }
  function draw() {
    syncLabels();
    const kind = style(), st = STYLES[kind];
    const name = clean(nameIn.value, 24) || 'Space Cowboy';
    const crime = clean(crimeIn.value, 70) || st.crime;
    const max = kind === 'crewid' ? 9999 : 999999999;
    const amount = Math.min(max, Math.max(1, Math.floor(Number(String(rewardIn.value).replace(/[^\d]/g, '')) || st.reward)));
    if (kind === 'crewid') crewId(name, crime, amount); else poster(kind, name, crime, amount);
  }

  const fileName = () => ({ wanted: 'wanted', mostwanted: 'most-wanted', missing: 'missing', crewid: 'crew-id' }[style()] || 'poster') + '-' + (clean(nameIn.value, 24).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'space-cowboy') + '.png';
  const toBlob = () => new Promise(res => canvas.toBlob(res, 'image/png'));

  dl.addEventListener('click', async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  if (navigator.canShare) {
    shareBtn.hidden = false;
    shareBtn.addEventListener('click', async () => {
      const blob = await toBlob();
      if (!blob) return;
      const file = new File([blob], fileName(), { type: 'image/png' });
      if (!navigator.canShare({ files: [file] })) { dl.click(); return; }
      try { await navigator.share({ files: [file], title: 'Poster from denizen-dismeigh.com' }); } catch {}
    });
  }

  photoIn.addEventListener('change', () => {
    const f = photoIn.files && photoIn.files[0];
    if (!f || !/^image\//.test(f.type) || f.size > 15 * 1024 * 1024) { photoIn.value = ''; return; }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { photo = img; clearBtn.hidden = false; draw(); };
    img.onerror = () => { photo = null; photoIn.value = ''; };
    img.src = photoUrl;
  });
  clearBtn.addEventListener('click', () => {
    photo = null; photoIn.value = ''; clearBtn.hidden = true;
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = ''; }
    draw();
  });

  form.addEventListener('input', draw);
  form.addEventListener('submit', e => e.preventDefault());
  document.querySelectorAll('[data-crime]').forEach(b => b.addEventListener('click', () => { crimeIn.value = b.dataset.crime; draw(); }));

  draw();
  Promise.all([
    document.fonts.load('80px Anton'), document.fonts.load('40px "Special Elite"')
  ]).then(draw, draw);
})();
