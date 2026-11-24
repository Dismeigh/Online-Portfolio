// Ko-fi goal bar (/api/goal → lib/kofi.js). Hidden unless a goal is switched on in the dashboard.
// Home: always while on. Garage: only if "Also show it in the Garage" is ticked.
(() => {
  const boxes = [...document.querySelectorAll('[data-kofi-goal]')];
  const pastBoxes = [...document.querySelectorAll('[data-kofi-past]')];
  if (!boxes.length && !pastBoxes.length) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = n => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
  const safeUrl = u => (/^https:\/\/ko-fi\.com\//.test(String(u)) ? u : 'https://ko-fi.com/dismeigh');
  fetch('/api/goal').then(r => r.json()).then(g => {
    if (!g) return;
    // Finished goals picked to show on this page
    for (const box of pastBoxes) {
      const list = (g.past || []).filter(p => p.place === box.dataset.kofiPast).slice(0, 6);
      if (!list.length) continue;
      box.innerHTML = `<p class="past-label">Funded by you</p><ul class="past-list">${list.map(p => `<li class="${p.funded ? 'is-funded' : ''}">
        <b>${esc(p.title)}</b><span>${esc(usd(p.raised))} of ${esc(usd(p.target))}${p.funded ? ' &middot; Funded' : ''} &middot; ${esc(new Date(p.ended).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))}</span></li>`).join('')}</ul>`;
      box.hidden = false;
    }
    if (!g.on) return;
    const pct = Math.max(0, Math.min(100, Math.round(Number(g.pct) || 0)));
    const html = `<div class="goal-card">
      <div class="goal-head"><span class="goal-label">Ko-fi goal</span><b>${esc(g.title)}</b></div>
      ${g.blurb ? `<p class="goal-blurb">${esc(g.blurb)}</p>` : ''}
      <div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(g.title)}: ${pct} percent raised"><span style="width:${pct}%"></span></div>
      <div class="goal-foot"><span><b>${esc(usd(g.raised))}</b> of ${esc(usd(g.target))} &middot; ${pct}%</span>
        <a class="goal-btn" href="${esc(safeUrl(g.url))}" target="_blank" rel="noopener noreferrer">${pct >= 100 ? 'We did it! Thank you' : 'Chip in on Ko-fi'}</a></div>
    </div>`;
    for (const box of boxes) {
      if (box.dataset.kofiGoal === 'garage' && !g.garage) continue;
      box.innerHTML = html; box.hidden = false;
    }
  }).catch(() => {});
})();
