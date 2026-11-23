// Ko-fi goal bar (/api/goal → lib/kofi.js). Hidden unless a goal is switched on in the dashboard.
// Home: always while on. Garage: only if "Also show it in the Garage" is ticked.
(() => {
  const boxes = [...document.querySelectorAll('[data-kofi-goal]')];
  if (!boxes.length) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = n => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
  const safeUrl = u => (/^https:\/\/ko-fi\.com\//.test(String(u)) ? u : 'https://ko-fi.com/dismeigh');
  fetch('/api/goal').then(r => r.json()).then(g => {
    if (!g || !g.on) return;
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
