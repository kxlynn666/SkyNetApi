(() => {
  if (window.__SKYNET_YOUTUBE_MENU_V1__) return;
  window.__SKYNET_YOUTUBE_MENU_V1__ = true;

  const current = (location.pathname.replace(/\/+$/, '') || '/');
  let attempts = 0;

  function icon() {
    return '<span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5z"/><path d="m10 8.5 5 3.5-5 3.5z"/></svg></span>';
  }

  function ensure() {
    const nav = document.querySelector('#workspaceSidebar .workspace-nav');
    if (!nav) return false;
    const existing = nav.querySelector('a[href="/painel/youtube"]');
    if (existing) {
      existing.classList.toggle('active', current === '/painel/youtube');
      return true;
    }

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

    const link = document.createElement('a');
    link.className = `workspace-nav-link ${current === '/painel/youtube' ? 'active' : ''}`;
    link.href = '/painel/youtube';
    link.innerHTML = `${icon()}<span>YouTube Downloader</span>`;
    group.appendChild(link);
    return true;
  }

  function tick() {
    attempts += 1;
    ensure();
    if (attempts < 12) setTimeout(tick, attempts < 4 ? 180 : 650);
  }

  tick();
  const observer = new MutationObserver(() => ensure());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 12000);
})();
