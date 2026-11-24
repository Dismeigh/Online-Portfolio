// Viewer suggestion forms (Quote Board on the Lore page, clips on the home page). Posts to /api/suggest.
(() => {
  document.querySelectorAll('form[data-suggest]').forEach(form => {
    const opened = Date.now(), kind = form.dataset.suggest, msg = form.querySelector('.suggest-msg'), btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async e => {
      e.preventDefault(); msg.textContent = ''; btn.disabled = true;
      const data = Object.fromEntries(new FormData(form)); data.kind = kind; data.elapsed = Date.now() - opened;
      try {
        const r = await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { msg.textContent = d.error || 'Couldn’t send that. Try again.'; if (d.field) document.getElementById(d.field)?.focus(); }
        else { msg.textContent = kind === 'quote' ? 'Sent! If it makes the Quote Board, you’ll see it here.' : 'Sent! Thanks for the clip.'; form.reset(); }
      } catch { msg.textContent = 'Couldn’t send that. Check your connection.'; }
      btn.disabled = false;
    });
  });
})();
