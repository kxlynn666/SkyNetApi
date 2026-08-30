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
    const base = src.split('?')[0];
    const existing = [...document.scripts].find(script => (script.getAttribute('src') || '').split('?')[0] === base);
    if (existing) {
      if (typeof onload === 'function') {
        if (existing.dataset.loaded === '1' || existing.readyState === 'complete') onload();
        else existing.addEventListener('load', onload, { once: true });
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
    }, { once: true });
    document.body.appendChild(script);
  }

  function navLink(href, label, iconPath) {
    return `<a class="workspace-nav-link ${path === href ? 'active' : ''}" href="${href}"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}"/></svg></span><span>${label}</span></a>`;
  }

  function findOrCreateGroup(nav, label, id) {
    let group = [...nav.querySelectorAll('.workspace-nav-group')].find(node => {
      const current = node.querySelector('.workspace-nav-label')?.textContent.trim().toLowerCase() || '';
      return current === label.toLowerCase();
    });
    if (!group) {
      group = document.createElement('div');
      group.className = 'workspace-nav-group';
      group.innerHTML = `<div class="workspace-nav-label">${label}</div>`;
      nav.appendChild(group);
    }
    if (!group.id) group.id = id;
    return group;
  }

  function ensureNavLink(group, href, label, iconPath) {
    let link = group.querySelector(`a[href="${href}"]`);
    if (!link) {
      group.insertAdjacentHTML('beforeend', navLink(href, label, iconPath));
      link = group.querySelector(`a[href="${href}"]`);
    }
    if (link) link.classList.toggle('active', path === href);
  }

  function ensureExtendedNav() {
    const nav = document.querySelector('#workspaceSidebar .workspace-nav');
    if (!nav) return false;

    const games = findOrCreateGroup(nav, 'Jogos', 'workspaceGamesNav');
    ensureNavLink(games, '/painel/jogos', 'Jogo da Velha', 'M5 5h14v14H5zM9.7 5v14M14.3 5v14M5 9.7h14M5 14.3h14');
    ensureNavLink(games, '/painel/jogos/damas', 'Damas', 'M4 4h16v16H4zM4 8h16M4 12h16M4 16h16M8 4v16M12 4v16M16 4v16');
    ensureNavLink(games, '/painel/jogos/dados', 'Dados', 'M7 4h10l4 4v8l-4 4H7l-4-4V8zM7 4l-4 4 4 4 10-8M7 12v8M17 12v8M7 12l10-8M17 12l4-4');

    const tools = findOrCreateGroup(nav, 'Ferramentas', 'workspaceToolsNav');
    ensureNavLink(tools, '/painel/roblox-codes', 'Roblox Codes', 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm1 5H6v2h2V8zm10 0h-2v2h2V8zM8 15h8');

    if (gamePaths.has(path) || path === '/painel/roblox-codes') {
      nav.querySelectorAll('.workspace-nav-link[href]').forEach(link => {
        link.classList.toggle('active', (link.getAttribute('href') || '').replace(/\/+$/, '') === path);
      });
    }
    return true;
  }

  if (!ensureExtendedNav()) {
    const observer = new MutationObserver(() => {
      if (ensureExtendedNav()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 6000);
  }

  if (path === '/painel/perfil') {
    loadStyle('/profile-social-pack-v9.css', 'profileSocialPackV9');
    loadScript('/profile-media-v3.js', 'profileMediaV3');
  }
  if (path === '/painel/perfil/studio') loadScript('/profile-studio-v1.js?v=2', 'profileStudioV1');
  if (path === '/painel/status') loadScript('/system-status-v1.js?v=2', 'systemStatusV1');

  if (path === '/painel/youtube') loadScript('/youtube-search-transfer-v2.js?v=4', 'youtubeSearchTransferV2');
  if (path === '/painel/youtube-search') loadScript('/youtube-search-v1.js?v=4', 'youtubeSearchV1');
  if (path === '/painel/roblox-codes') loadScript('/roblox-codes-v1.js?v=3', 'robloxCodesV1');
  if (path === '/painel/jogos') loadScript('/tictactoe-v2.js', 'tictactoeV2');
  if (path === '/painel/jogos/damas') {
    loadScript('/checkers-rules-v1.js', 'checkersRulesV1', () => loadScript('/checkers-v1.js', 'checkersV1'));
  }
  if (path === '/painel/jogos/dados') loadScript('/dice-roller-v1.js', 'diceRollerV1');
})();
