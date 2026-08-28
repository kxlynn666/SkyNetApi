(() => {
  if (window.__SKYNET_WORKSPACE_FEATURE_LOADER_V1__) return;
  window.__SKYNET_WORKSPACE_FEATURE_LOADER_V1__ = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const gamePaths = new Set(['/painel/jogos', '/painel/jogos/damas', '/painel/jogos/dados']);

  function loadStyle(href, marker) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset[marker] = '1';
    document.head.appendChild(link);
  }

  function loadScript(src, marker, onload) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (typeof onload === 'function') {
        if (existing.dataset.loaded === '1') onload();
        else existing.addEventListener('load', onload, { once:true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset[marker] = '1';
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      if (typeof onload === 'function') onload();
    }, { once:true });
    document.body.appendChild(script);
  }

  function gameLink(href, label, iconPath) {
    return `<a class="workspace-nav-link ${path === href ? 'active' : ''}" href="${href}"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}"/></svg></span><span>${label}</span></a>`;
  }

  function addGamesNav() {
    const nav = document.querySelector('#workspaceSidebar .workspace-nav');
    if (!nav || document.getElementById('tttNavGroup')) return false;
    const group = document.createElement('div');
    group.className = 'workspace-nav-group';
    group.id = 'tttNavGroup';
    group.innerHTML = `<div class="workspace-nav-label">Jogos</div>${gameLink('/painel/jogos','Jogo da Velha','M5 5h14v14H5zM9.7 5v14M14.3 5v14M5 9.7h14M5 14.3h14')}${gameLink('/painel/jogos/damas','Damas','M4 4h16v16H4zM4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16')}${gameLink('/painel/jogos/dados','Dados','M7 4h10l4 4v8l-4 4H7l-4-4V8zM7 4l-4 4 4 4 10-8M7 12v8M17 12v8M7 12l10-8M17 12l4-4')}`;
    nav.appendChild(group);
    if (gamePaths.has(path)) {
      document.querySelectorAll('.workspace-nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === path));
    }
    return true;
  }

  if (!addGamesNav()) {
    const navObserver = new MutationObserver(() => {
      if (addGamesNav()) navObserver.disconnect();
    });
    navObserver.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(() => navObserver.disconnect(), 12000);
  }

  if (path === '/painel/perfil') {
    loadStyle('/profile-social-pack-v9.css', 'profileSocialPackV9');
    loadScript('/profile-media-v3.js', 'profileMediaV3');
  }

  if (path === '/painel/youtube') loadScript('/youtube-downloader-v1.js', 'youtubeDownloaderV1');
  if (path === '/painel/jogos') loadScript('/tictactoe-v2.js', 'tictactoeV2');
  if (path === '/painel/jogos/damas') {
    loadScript('/checkers-rules-v1.js', 'checkersRulesV1', () => loadScript('/checkers-v1.js', 'checkersV1'));
  }
  if (path === '/painel/jogos/dados') loadScript('/dice-roller-v1.js', 'diceRollerV1');
})();
