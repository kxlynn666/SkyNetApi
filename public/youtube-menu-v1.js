(() => {
  if (window.__SKYNET_YOUTUBE_MENU_V1__) return;
  window.__SKYNET_YOUTUBE_MENU_V1__ = true;

  const current = location.pathname.replace(/\/+$/, '') || '/';
  let attempts = 0;

  function icon(kind) {
    const path = kind === 'search'
      ? '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'
      : '<path d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5z"/><path d="m10 8.5 5 3.5-5 3.5z"/>';
    return `<span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></span>`;
  }

  function findGroup(nav) {
    let group = [...nav.querySelectorAll('.workspace-nav-group')].find(node => {
      const label = node.querySelector('.workspace-nav-label')?.textContent.trim().toLowerCase() || '';
      return label === 'downloaders' || label === 'mídia' || label === 'midia';
    });
    if (!group) {
      group = document.createElement('div');
      group.className = 'workspace-nav-group';
      group.id = 'youtubeMenuGroupV1';
      group.innerHTML = '<div class="workspace-nav-label">Downloaders</div>';
      nav.appendChild(group);
    }
    return group;
  }

  function ensureLink(group, href, label, iconKind) {
    let link = group.querySelector(`a[href="${href}"]`);
    if (!link) {
      link = document.createElement('a');
      link.href = href;
      group.appendChild(link);
    }
    link.className = `workspace-nav-link ${current === href ? 'active' : ''}`;
    link.innerHTML = `${icon(iconKind)}<span>${label}</span>`;
  }

  function ensure() {
    const nav = document.querySelector('#workspaceSidebar .workspace-nav');
    if (!nav) return false;
    const group = findGroup(nav);
    ensureLink(group, '/painel/youtube', 'YouTube Downloader', 'play');
    ensureLink(group, '/painel/youtube-search', 'YouTube Search', 'search');

    if (current === '/painel/youtube' || current === '/painel/youtube-search') {
      nav.querySelectorAll('.workspace-nav-link').forEach(link => {
        link.classList.toggle('active', (link.getAttribute('href') || '') === current);
      });
    }
    return true;
  }

  function tick() {
    attempts += 1;
    if (ensure()) return;
    if (attempts < 10) setTimeout(tick, attempts < 4 ? 100 : 300);
  }

  tick();
  window.addEventListener('pageshow', ensure, { passive: true });
})();
