// Ko-fi goal bar (/api/goal → lib/kofi.js). Hidden unless a goal is switched on in the dashboard.
// Home: always while on. Garage: only if "Also show it in the Garage" is ticked.
(() => {
  const boxes = [...document.querySelectorAll('[data-kofi-goal]')];
  const pastBoxes = [...document.querySelectorAll('[data-kofi-past]')];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const usd = n => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
  const safeUrl = u => (/^https:\/\/ko-fi\.com\//.test(String(u)) ? u : 'https://ko-fi.com/dismeigh');
  // Shared with the dashboard preview. Car goals (shown in the Garage) get a fuel gauge with a little car riding it.
  window.dismeighGoalCard = g => {
    const pct = Math.max(0, Math.min(100, Math.round(Number(g.pct) || 0))), done = pct >= 100, car = !!g.garage;
    const left = Math.max(0, Number(g.target) - Number(g.raised));
    const count = Number(g.count) || 0;
    const rider = car
      ? '<svg viewBox="0 0 64 28" aria-hidden="true"><path d="M6 18l4-7c1-2 3-3 5-3h20c2 0 4 1 6 2l7 5 9 2c2 0 3 2 3 4v3H2v-4c0-1 2-2 4-2z"/><circle cx="16" cy="23" r="5"/><circle cx="48" cy="23" r="5"/><circle cx="16" cy="23" r="2" class="hub"/><circle cx="48" cy="23" r="2" class="hub"/></svg>'
      : '<svg viewBox="0 0 40 28" aria-hidden="true"><path d="M2 14L30 4l8 10-8 10z"/><path d="M2 14h12" class="hub"/></svg>';
    const status = done ? 'Fully funded. Thank you, crew!'
      : count ? `${count} tip${count === 1 ? '' : 's'} so far \u00b7 ${usd(left)} to go`
      : Number(g.raised) > 0 ? `${usd(left)} to go` : 'Nothing in the tank yet. Be the first to chip in!';
    return `<div class="goal-card gc${car ? ' gc-car' : ''}${done ? ' is-done' : ''}" style="--pct:${pct}%">
      <div class="gc-top"><span class="gc-stamp">Ko-fi goal</span><span class="gc-pct"><b>${pct}</b>%</span></div>
      <h3 class="gc-title">${esc(g.title)}</h3>
      ${g.blurb ? `<p class="gc-blurb">${esc(g.blurb)}</p>` : ''}
      <div class="gc-money"><b>${esc(usd(g.raised))}</b><span>raised of ${esc(usd(g.target))}</span></div>
      <div class="gc-gauge">
        <div class="gc-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(g.title)}: ${pct} percent raised">
          <span class="gc-fill"></span><i class="gc-tick" style="left:25%"></i><i class="gc-tick" style="left:50%"></i><i class="gc-tick" style="left:75%"></i>
          <span class="gc-rider">${rider}</span>
        </div>
        <div class="gc-scale" aria-hidden="true"><span style="left:0">${car ? 'E' : '0%'}</span><span style="left:25%">25</span><span style="left:50%">50</span><span style="left:75%">75</span><span style="left:100%">${car ? 'F' : '100%'}</span></div>
      </div>
      <p class="gc-status">${esc(status)}</p>
      <a class="goal-btn gc-btn" href="${esc(safeUrl(g.url))}" target="_blank" rel="noopener noreferrer">${done ? 'Say thanks on Ko-fi' : 'Chip in on Ko-fi'}</a>
    </div>`;
  };
  if (!boxes.length && !pastBoxes.length) return;
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
    const html = window.dismeighGoalCard(g);
    for (const box of boxes) {
      if (box.dataset.kofiGoal === 'garage' && !g.garage) continue;
      box.innerHTML = html; box.hidden = false;
    }
  }).catch(() => {});
})();
