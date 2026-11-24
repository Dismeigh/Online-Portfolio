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

  const C = { ink: '#14110f', paper: '#efe6d2', dim: '#8a7f6c', red: '#b73b2c', mustard: '#e3a92b' };
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

  function draw() {
    const name = clean(nameIn.value, 24) || 'Space Cowboy';
    const crime = clean(crimeIn.value, 70) || 'Being way too good at the arcade';
    const amount = Math.min(999999999, Math.max(1, Math.floor(Number(String(rewardIn.value).replace(/[^\d]/g, '')) || 6000000)));

    // Paper with a worn edge
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.paper; ctx.fillRect(24, 24, W - 48, H - 48);
    ctx.save();
    ctx.globalAlpha = 0.07; ctx.fillStyle = C.ink;
    for (let i = 0; i < 900; i++) { const x = (i * 7919) % (W - 48) + 24, y = (i * 104729) % (H - 48) + 24; ctx.fillRect(x, y, 2 + (i % 3), 2); }
    ctx.restore();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.strokeRect(54, 54, W - 108, H - 108);

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.ink;
    ctx.font = '34px "Special Elite", "Courier New", monospace';
    ctx.fillText('BOUNTY HUNTER BULLETIN  ·  NO. ' + String(amount % 10000).padStart(4, '0'), W / 2, 118);
    ctx.font = '210px Anton, Impact, sans-serif';
    ctx.fillText('WANTED', W / 2, 330);
    ctx.font = '34px "Special Elite", "Courier New", monospace';
    ctx.fillText('DEAD OR LIVE-STREAMING', W / 2, 382);

    // Photo frame
    const px = 150, py = 420, pw = W - 300, ph = 560;
    ctx.fillStyle = '#d8ccb3'; ctx.fillRect(px, py, pw, ph);
    if (photo) {
      const r = Math.max(pw / photo.width, ph / photo.height), iw = photo.width * r, ih = photo.height * r;
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      ctx.filter = 'grayscale(1) sepia(0.45) contrast(1.15)';
      ctx.drawImage(photo, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih);
      ctx.restore(); ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#a89c85';
      ctx.beginPath(); ctx.arc(W / 2, py + 220, 110, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W / 2, py + ph + 40, 260, 230, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C.paper; ctx.font = '150px Anton, Impact, sans-serif'; ctx.fillText('?', W / 2, py + 275);
    }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.strokeRect(px, py, pw, ph);

    // Name
    const ns = fit(name.toUpperCase(), 'Anton, Impact, sans-serif', 130, W - 200);
    ctx.fillStyle = C.ink; ctx.font = `${ns}px Anton, Impact, sans-serif`;
    ctx.fillText(name.toUpperCase(), W / 2, 1120);

    // Crime
    ctx.font = '38px "Special Elite", "Courier New", monospace';
    ctx.fillStyle = C.dim; ctx.fillText('WANTED FOR', W / 2, 1180);
    ctx.fillStyle = C.ink; ctx.font = '42px "Special Elite", "Courier New", monospace';
    wrap(crime, W - 240).forEach((l, i) => ctx.fillText(l, W / 2, 1232 + i * 50));

    // Reward slab
    ctx.fillStyle = C.mustard; ctx.fillRect(110, 1380, W - 220, 150);
    ctx.fillStyle = C.ink; ctx.font = '36px "Special Elite", "Courier New", monospace';
    ctx.fillText('REWARD', W / 2, 1424);
    const rw = amount.toLocaleString('en-US') + ' WOOLONGS';
    ctx.font = `${fit(rw, 'Anton, Impact, sans-serif', 84, W - 280)}px Anton, Impact, sans-serif`;
    ctx.fillText(rw, W / 2, 1510);

    // Stamp
    ctx.save(); ctx.translate(W - 230, 470); ctx.rotate(0.22);
    ctx.globalAlpha = 0.85; ctx.strokeStyle = C.red; ctx.fillStyle = C.red; ctx.lineWidth = 6;
    ctx.strokeRect(-130, -50, 260, 92);
    ctx.font = '62px Anton, Impact, sans-serif'; ctx.fillText('BOUNTY', 0, 26);
    ctx.restore();

    ctx.fillStyle = C.dim; ctx.font = '26px "Special Elite", "Courier New", monospace';
    ctx.fillText('Issued by Dismeigh’s crew  ·  denizen-dismeigh.com', W / 2, H - 76);
  }

  const fileName = () => 'wanted-' + (clean(nameIn.value, 24).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'space-cowboy') + '.png';
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
      try { await navigator.share({ files: [file], title: 'Wanted poster' }); } catch {}
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
