(() => {
  if (window.__SKYNET_WORKSPACE_SIDEBAR_STABILITY_V1__) return;
  window.__SKYNET_WORKSPACE_SIDEBAR_STABILITY_V1__ = true;

  const cleanPath = value => {
    try { return new URL(value, location.origin).pathname.replace(/\/+$/, '') || '/'; }
    catch { return String(value || '').replace(/\/+$/, '') || '/'; }
  };
  const currentPath = () => cleanPath(location.pathname);

  const icon = paths => `<span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg></span>`;
  const icons = {
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    friends: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7-4.6"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    game: '<path d="M5 5h14v14H5zM9.7 5v14M14.3 5v14M5 9.7h14M5 14.3h14"/>',
    upscale: '<path d="M4 5h15v15H4z"/><path d="M9 2v5M6.5 4.5h5M15 11h6M18 8v6"/>',
    music: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M16 6v7.5a2.5 2.5 0 1 1-2-2.45"/>',
    card: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="6" y="7" width="6" height="6" rx="1"/><path d="M14 8h4M14 11h4M6 16h12"/>',
    brat: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 9h10M7 15h10"/>'
  };

  function makeLink(href, label, iconName) {
    const a = document.createElement('a');
    a.className = 'workspace-nav-link';
    a.href = href;
    a.innerHTML = `${icon(icons[iconName])}<span>${label}</span>`;
    return a;
  }

  function findGroup(nav, label) {
    return [...nav.querySelectorAll('.workspace-nav-group')].find(group =>
      group.querySelector('.workspace-nav-label')?.textContent?.trim().toLowerCase() === label.toLowerCase()
    ) || null;
  }

  function ensureGroup(nav, id, label, items, placement = 'append') {
    let group = document.getElementById(id);
    if (!group || !nav.contains(group)) {
      group = document.createElement('div');
      group.className = 'workspace-nav-group';
      group.id = id;
      group.innerHTML = `<div class="workspace-nav-label">${label}</div>`;
      if (placement === 'after-general') {
        const first = nav.querySelector('.workspace-nav-group');
        if (first) first.insertAdjacentElement('afterend', group); else nav.prepend(group);
      } else nav.appendChild(group);
    }

    for (const [href, text, iconName] of items) {
      if (!nav.querySelector(`a.workspace-nav-link[href="${href}"]`)) group.appendChild(makeLink(href, text, iconName));
    }
    return group;
  }

  function ensureCreationItems(nav) {
    const group = findGroup(nav, 'Criação');
    if (!group) return;

    const cards = group.querySelector('a[href="/painel/cards"]');
    if (!nav.querySelector('a[href="/painel/card2"]')) {
      const link = makeLink('/painel/card2', 'Card 2.0', 'card');
      if (cards) cards.insertAdjacentElement('afterend', link); else group.appendChild(link);
    }
    if (!nav.querySelector('a[href="/painel/brat"]')) group.appendChild(makeLink('/painel/brat', 'Brat Generator', 'brat'));
  }

  function dedupe(nav) {
    const seen = new Map();
    for (const link of [...nav.querySelectorAll('a.workspace-nav-link[href]')]) {
      const key = cleanPath(link.getAttribute('href'));
      const previous = seen.get(key);
      if (!previous) {
        seen.set(key, link);
        continue;
      }
      const path = currentPath();
      const keep = key === path && link.classList.contains('active') ? link : previous;
      const remove = keep === link ? previous : link;
      remove.remove();
      seen.set(key, keep);
    }
    for (const group of [...nav.querySelectorAll('.workspace-nav-group')]) {
      if (!group.querySelector('.workspace-nav-link')) group.remove();
    }
  }

  function syncActive(nav) {
    const path = currentPath();
    nav.querySelectorAll('.workspace-nav-link[href]').forEach(link => {
      link.classList.toggle('active', cleanPath(link.getAttribute('href')) === path);
    });
  }

  function revealActive(nav, behavior = 'auto') {
    const active = nav.querySelector('.workspace-nav-link.active');
    if (!active) return;
    requestAnimationFrame(() => {
      const nr = nav.getBoundingClientRect();
      const ar = active.getBoundingClientRect();
      if (ar.top < nr.top + 6 || ar.bottom > nr.bottom - 6) active.scrollIntoView({ block:'nearest', behavior });
    });
  }

  function stabilize(nav) {
    ensureGroup(nav, 'socialNavGroup', 'Social', [
      ['/painel/perfil', 'Perfil', 'profile'],
      ['/painel/amigos', 'Amigos', 'friends'],
      ['/painel/chat', 'Chat', 'chat']
    ], 'after-general');

    ensureCreationItems(nav);

    ensureGroup(nav, 'upscaleNavV1', 'Imagem', [
      ['/painel/upscale', 'AI Upscaler', 'upscale']
    ]);

    ensureGroup(nav, 'musicNavV13', 'Mídia', [
      ['/painel/musica', 'Música', 'music']
    ]);

    ensureGroup(nav, 'tttNavGroup', 'Jogos', [
      ['/painel/jogos', 'Jogo da Velha', 'game']
    ]);

    dedupe(nav);
    syncActive(nav);
  }

  function setup() {
    const shell = document.getElementById('workspaceShell');
    const sidebar = document.getElementById('workspaceSidebar');
    const nav = sidebar?.querySelector('.workspace-nav');
    if (!shell || shell.classList.contains('hidden') || !nav) return false;

    let queued = false;
    const run = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        stabilize(nav);
      });
    };

    stabilize(nav);
    revealActive(nav);

    const observer = new MutationObserver(() => run());
    observer.observe(nav, { childList:true, subtree:true });

    // Dynamic page scripts finish at slightly different times. Reconcile after each wave.
    [120, 450, 1200, 2600].forEach(delay => setTimeout(() => {
      stabilize(nav);
      if (delay >= 450) revealActive(nav, 'smooth');
    }, delay));

    window.addEventListener('pageshow', () => {
      stabilize(nav);
      revealActive(nav);
    });
    return true;
  }

  if (setup()) return;
  const bootObserver = new MutationObserver(() => {
    if (!setup()) return;
    bootObserver.disconnect();
  });
  bootObserver.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  setTimeout(() => bootObserver.disconnect(), 15000);
})();
