(() => {
  if (window.__SKYNET_WORKSPACE_FEATURE_LOADER_V1__) return;
  window.__SKYNET_WORKSPACE_FEATURE_LOADER_V1__ = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';

  function loadStyle(href, marker) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset[marker] = '1';
    document.head.appendChild(link);
  }

  function loadScript(src, marker) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset[marker] = '1';
    document.body.appendChild(script);
  }

  function addGamesNav() {
    const nav = document.querySelector('#workspaceSidebar .workspace-nav');
    if (!nav || document.getElementById('tttNavGroup')) return false;
    const group = document.createElement('div');
    group.className = 'workspace-nav-group';
    group.id = 'tttNavGroup';
    group.innerHTML = `<div class="workspace-nav-label">Jogos</div><a class="workspace-nav-link ${path === '/painel/jogos' ? 'active' : ''}" href="/painel/jogos"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5zM9.7 5v14M14.3 5v14M5 9.7h14M5 14.3h14"/></svg></span><span>Jogo da Velha</span></a>`;
    nav.appendChild(group);
    if (path === '/painel/jogos') {
      document.querySelectorAll('.workspace-nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === '/painel/jogos'));
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

  if (path === '/painel/jogos') loadScript('/tictactoe-v2.js', 'tictactoeV2');
})();
