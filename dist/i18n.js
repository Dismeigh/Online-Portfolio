// Spanish toggle. Labels, headings, buttons and generated text switch languages;
// personal writing (bio, section intros, lore stories) stays as written.
(() => {
  const ES = {
    'Skip to content': 'Saltar al contenido',
    'Now showing': 'En pantalla', 'Session start': 'Comienza la sesión',
    'On air': 'En vivo', 'Dismeigh is live on Twitch right now.': 'Dismeigh está en vivo en Twitch ahora mismo.',
    'Streaming now': 'En vivo ahora', 'Watch now →': 'Ver ahora →',
    'Milestone': 'Meta', 'We hit': 'Llegamos a', 'followers on Twitch.': 'seguidores en Twitch.', 'Thanks for riding along!': '¡Gracias por acompañarme!',
    'Live': 'En vivo', 'Schedule': 'Horario', 'Garage': 'Garaje', 'Clips': 'Clips', 'Support': 'Apoyo', 'Extras': 'Extras',
    'VTuber • Car Enthusiast • Voice Actor • Creative Developer': 'VTuber • Fanático de los autos • Actor de voz • Desarrollador creativo',
    'Sponsors • Partners • Affiliates': 'Patrocinadores • Socios • Afiliados',
    'Business & sponsorships:': 'Negocios y patrocinios:',
    'Support & Shop': 'Apoyo y tienda',
    'Donations & Commissions': 'Donaciones y encargos', 'Merch': 'Mercancía',
    'Session 01': 'Sesión 01', 'Session 02': 'Sesión 02', 'Session 03': 'Sesión 03', 'Session 04': 'Sesión 04',
    'Session 05': 'Sesión 05', 'Session 06': 'Sesión 06', 'Session 07': 'Sesión 07',
    'Signal Check': 'Revisión de señal', 'Ship’s Console': 'Consola de la nave',
    'Live right now. Chat and follow on': 'En vivo ahora mismo. Chatea y sigue en',
    'Stream Status': 'Estado del stream', 'Next Stream': 'Próximo stream', 'On Now': 'En vivo',
    'Nothing on the calendar yet': 'Nada en el calendario todavía', 'Follow on Twitch for go-live alerts': 'Sígueme en Twitch para avisos en vivo',
    'Happening right now': 'Pasando ahora mismo', 'On air now': 'En vivo ahora', 'Checking the signal...': 'Revisando la señal...',
    'Current Energy': 'Energía actual', 'Join the server and say hey!': '¡Únete al servidor y saluda!',
    'Road to': 'Rumbo a', 'followers': 'seguidores', 'on Twitch': 'en Twitch',
    'Help me get there: follow on Twitch': 'Ayúdame a llegar: sígueme en Twitch',
    'Episode Guide': 'Guía de episodios', 'This Week’s Streams': 'Streams de esta semana',
    'Wanted': 'Se busca', 'Played or alive': 'Jugado o vivo', 'Bounty: one full session of chaos': 'Recompensa: una sesión entera de caos',
    'Next on the docket': 'Lo que sigue', 'Caught live right now': 'Atrapado en vivo ahora', 'On Twitch now': 'En Twitch ahora',
    'Be there on Twitch': 'Nos vemos en Twitch',
    'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles', 'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado', 'Sunday': 'Domingo',
    'Today': 'Hoy', 'Off night / rest day': 'Noche libre / día de descanso', 'All day': 'Todo el día',
    'Played': 'Jugado', 'Watch the VOD': 'Ver el VOD', 'Clip of the night': 'Clip de la noche',
    'The schedule board is taking a break. Follow on': 'El horario está descansando. Sígueme en', 'or': 'o', 'for this week’s times.': 'para los horarios de esta semana.',
    'All times Eastern. This board updates itself from the stream calendar.': 'Horarios en hora del Este (EE. UU.). Este horario se actualiza solo desde el calendario de streams.',
    'Never miss a session: put the schedule in your own calendar. It stays in sync when times change.': 'No te pierdas ninguna sesión: agrega el horario a tu calendario. Se actualiza solo cuando cambian los horarios.',
    'Google Calendar': 'Google Calendar', 'Apple / Outlook': 'Apple / Outlook', 'Copy link': 'Copiar enlace', 'Link copied': 'Enlace copiado',
    'Dismeigh Mode': 'Modo Dismeigh', 'Personality Loadout': 'Equipo de personalidad',
    'Stream Energy': 'Energía del stream', 'Garage Mood': 'Ánimo del garaje', 'Voice Lane': 'Carril de voz', 'Creative Stack': 'Arsenal creativo',
    'The Garage': 'El garaje', 'Cars Are Part Of The Lore': 'Los autos son parte de la historia', 'The ride:': 'La nave:',
    'Bounty: one more mod': 'Recompensa: un mod más',
    'Build sheet': 'Hoja de proyecto', 'done': 'listos', 'on the list': 'en la lista', 'Done': 'Listos', 'Planned': 'Planeados',
    'Highlights': 'Lo mejor', 'Gaming Clip Chaos': 'Caos en clips', 'Now playing': 'Reproduciendo', 'Swipe clips': 'Desliza los clips',
    'Fresh off YouTube': 'Recién salido de YouTube', 'More on YouTube': 'Más en YouTube', 'Latest': 'Lo último', 'Short': 'Short', 'Video': 'Video',
    'Off the Clock': 'Fuera de horario', 'The Usual Chaos': 'El caos de siempre', 'VTubing & Content': 'VTubing y contenido', 'Creative Tech': 'Tecnología creativa',
    'Side quest': 'Misión secundaria', 'Case files': 'Expedientes',
    'Event listings that update straight from the club’s calendar': 'Eventos que se actualizan directo del calendario del club',
    'RSVP, add-to-calendar and share on every event': 'Confirmar asistencia, agregar al calendario y compartir en cada evento',
    'Meetups, memories, age policy, connect and donate pages': 'Páginas de reuniones, recuerdos, política de edad, contacto y donaciones',
    'Visit 757animeclub.com': 'Visita 757animeclub.com',
    'The home base for a local anime community: meetups, memories and everything the club has coming up.': 'La base de una comunidad local de anime: reuniones, recuerdos y todo lo que viene para el club.',
    'Bonus Features': 'Contenido extra', 'Channel Lore': 'Historia del canal',
    'New here? The running jokes and legendary moments chat keeps bringing up, explained.': '¿Eres nuevo? Las bromas recurrentes y los momentos legendarios que el chat siempre menciona, explicados.',
    'Open the files': 'Abrir los expedientes', 'Year in review': 'Resumen del año', 'Dismeigh Rewind': 'Dismeigh Rewind',
    'Hours streamed, most-played games and the busiest nights, pulled straight from the schedule.': 'Horas en vivo, juegos más jugados y las noches más movidas, directo del horario.',
    'Roll the tape': 'Dale play', 'Take it with you': 'Llévalo contigo', 'Get the app': 'Obtén la app', 'Install the app': 'Instalar la app',
    'Add the site to your home screen. It opens full screen, like an app, with the schedule one tap away.': 'Agrega el sitio a tu pantalla de inicio. Se abre en pantalla completa, como una app, con el horario a un toque.',
    'The deleted scenes and director’s cut: deep lore, the year in streams, and the whole ship in your pocket.': 'Escenas eliminadas y versión del director: la historia del canal, el año en streams y toda la nave en tu bolsillo.',
    'BANG!': '¡BANG!', 'You found the secret session.': 'Encontraste la sesión secreta.',
    'See you next session.': 'Nos vemos en la próxima sesión.', 'Channel lore': 'Historia del canal', 'Rewind': 'Rewind', 'Home': 'Inicio',
    'Denizen Technologies. All rights reserved.': 'Denizen Technologies. Todos los derechos reservados.',
    '← Back to the ship': '← Volver a la nave',
    'Already in your collection': 'Ya está en tu colección', 'Achievement unlocked': 'Logro desbloqueado',
    'Redline': 'Al límite', 'Bounty claimed': 'Recompensa cobrada', 'For the real ones': 'Para los de verdad',
    'Late night session': 'Sesión de madrugada', 'The crew’s asleep. Keep it down.': 'La tripulación duerme. No hagas ruido.',
    'Birthday session': 'Sesión de cumpleaños', 'Holiday session': 'Sesión de fiestas', 'Spooky session': 'Sesión de terror',
    'Thanksgiving session': 'Sesión de Acción de Gracias', 'New year, new session': 'Año nuevo, sesión nueva',
    // Rewind and Lore pages
    'Rolling back the tape…': 'Rebobinando la cinta…', 'Streams': 'Streams', 'Hours live': 'Horas en vivo', 'Most played': 'Más jugado',
    'Favorite night': 'Noche favorita', 'Streams by month': 'Streams por mes', 'Top games': 'Juegos principales',
    'Copy link to this Rewind': 'Copiar enlace de este Rewind', 'Counted from the stream calendar using scheduled start and end times.': 'Calculado desde el calendario de streams con las horas programadas.',
    'Search the lore': 'Buscar en la historia', 'Nothing in the files matches that yet.': 'Nada en los expedientes coincide con eso todavía.',
    'New around here? These are the running jokes and legendary moments chat keeps bringing up.': '¿Eres nuevo? Estas son las bromas recurrentes y los momentos legendarios que el chat siempre menciona.',
    'Español': 'Español', 'English': 'English',
    // accessible names
    'Primary navigation': 'Navegación principal', 'Twitch follower goal': 'Meta de seguidores en Twitch',
    'Add the stream schedule to your calendar': 'Agrega el horario de streams a tu calendario', 'Build progress': 'Progreso del proyecto',
    'Mods done': 'Mods listos', 'Mods planned': 'Mods planeados', 'Previous clip': 'Clip anterior', 'Next clip': 'Clip siguiente',
    'Car photo viewer': 'Visor de fotos del auto', 'Close photo viewer': 'Cerrar visor de fotos', 'Previous photo': 'Foto anterior', 'Next photo': 'Foto siguiente',
    'Choose a year': 'Elige un año', 'Choose the site language': 'Elige el idioma del sitio',
  };
  const PATTERNS = [
    [/^Week of (.+) to (.+)$/, 'Semana del $1 al $2'],
    [/^in (\d+[dhm](?: \d+[hm])?)$/, 'en $1'],
    [/^(\d+) of (\d+) mods · (\d+)% built$/, '$1 de $2 mods · $3% completado'],
    [/^Clip (\d+) of (\d+)$/, 'Clip $1 de $2'],
    [/^Secret found: (\d+) of (\d+)$/, 'Secreto encontrado: $1 de $2'],
    [/^Secret (\d+) of (\d+): all found!$/, 'Secreto $1 de $2: ¡todos encontrados!'],
    [/^Secrets found: (\d+) of (\d+)$/, 'Secretos encontrados: $1 de $2'],
    [/^All (\d+) secrets found\. Certified bounty hunter\.$/, 'Los $1 secretos encontrados. Cazarrecompensas certificado.'],
    [/^([\d,.]+) reached!$/, '¡$1 alcanzado!'],
    [/^([\d,.]+) to go$/, 'faltan $1'],
    [/^([\d,.]+) online · ([\d,.]+) members$/, '$1 en línea · $2 miembros'],
    [/^Twitch anniversary: year (\d+)$/, 'Aniversario en Twitch: año $1'],
    [/^Today · (.+)$/, 'Hoy · $1'],
    [/^Tomorrow · (.+)$/, 'Mañana · $1'],
    [/^Dismeigh Rewind (\d{4})$/, 'Dismeigh Rewind $1'],
    [/^Play: (.+)$/, 'Reproducir: $1'],
    [/^Show clip (\d+)$/, 'Mostrar clip $1'],
    [/^Gaming clip (\d+)$/, 'Clip de juego $1'],
    [/^(\d+) hrs · (\d+) sessions?$/, '$1 h · $2 sesiones'],
    [/^Busiest month: (.+)\.$/, 'Mes más activo: $1.'],
  ];

  let lang = 'en';
  try { lang = localStorage.getItem('dismeigh-lang') || ''; } catch {}
  if (!lang) lang = /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
  const es = lang === 'es';
  window.DISMEIGH_LANG = lang;
  window.DISMEIGH_LOCALE = es ? 'es-US' : 'en-US';
  document.documentElement.lang = lang;

  const tr = text => {
    if (!es) return text;
    const t = text.trim();
    if (!t) return text;
    if (Object.prototype.hasOwnProperty.call(ES, t)) return text.replace(t, ES[t]);
    for (const [re, out] of PATTERNS) if (re.test(t)) return text.replace(t, t.replace(re, out));
    return text;
  };
  window.T = tr;

  const SKIP = 'script, style, .bio, .lore-card, .build-col li, .yt-card h4, .wanted-game, .wanted-title, .show-title, [data-no-translate]';
  function translateTree(root) {
    if (!es || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP)) continue;
      const next = tr(node.textContent);
      if (next !== node.textContent) node.textContent = next;
    }
    const els = root.nodeType === 1 ? [root, ...root.querySelectorAll('[aria-label], [placeholder], [title]')] : [];
    for (const el of els) {
      for (const attr of ['aria-label', 'placeholder', 'title']) {
        const v = el.getAttribute?.(attr);
        if (v) { const next = tr(v); if (next !== v) el.setAttribute(attr, next); }
      }
    }
  }

  function addToggle() {
    const make = cls => {
      const wrap = document.createElement('div');
      wrap.className = `lang-toggle ${cls}`;
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', es ? 'Elige el idioma del sitio' : 'Choose the site language');
      wrap.setAttribute('data-no-translate', '');
      for (const [code, label] of [['en', 'EN'], ['es', 'ES']]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.lang = code;
        b.setAttribute('aria-label', code === 'en' ? 'English' : 'Español');
        b.setAttribute('aria-pressed', String(code === lang));
        b.addEventListener('click', () => {
          if (code === lang) return;
          try { localStorage.setItem('dismeigh-lang', code); } catch {}
          location.reload();
        });
        wrap.appendChild(b);
      }
      return wrap;
    };
    document.querySelector('.profile-card')?.prepend(make('lang-hero'));
    document.querySelector('.footer')?.appendChild(make('lang-footer'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    addToggle();
    translateTree(document.body);
    document.title = tr(document.title);
    if (!es) return;
    new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'characterData') { const node = r.target; if (node.parentElement && !node.parentElement.closest(SKIP)) { const next = tr(node.textContent); if (next !== node.textContent) node.textContent = next; } }
        else r.addedNodes.forEach(node => node.nodeType === 3 ? (node.parentElement && !node.parentElement.closest(SKIP) && (node.textContent = tr(node.textContent))) : translateTree(node));
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
