(() => {
  if (window.__SKYNET_WORKSPACE_ROUTE_READY_V1__) return;
  window.__SKYNET_WORKSPACE_ROUTE_READY_V1__ = true;

  const path = location.pathname.replace(/\/+$/, '') || '/painel';
  const coreRoutes = new Set([
    '/painel', '/painel/conta', '/painel/chaves', '/painel/cards', '/painel/uploads',
    '/painel/tiktok', '/painel/media', '/painel/roblox', '/painel/historico', '/painel/api'
  ]);
  const specialExpected = new Map([
    ['/painel/youtube', 'YouTube Downloader']
  ]);

  const gated = !coreRoutes.has(path);
  if (!gated) return;

  const labels = {
    '/painel/perfil': 'Perfil',
    '/painel/perfil/studio': 'Profile Studio',
    '/painel/amigos': 'Amigos',
    '/painel/chat': 'Chat',
    '/painel/figurinhas': 'Figurinhas',
    '/painel/grupos': 'Grupos',
    '/painel/jogos': 'Jogo da Velha',
    '/painel/jogos/damas': 'Damas',
    '/painel/jogos/dados': 'Dados',
    '/painel/musica': 'Música',
    '/painel/visual': 'Visual Lab',
    '/painel/upscale': 'AI Upscaler',
    '/painel/card2': 'Card 2.0',
    '/painel/brat': 'Brat Generator',
    '/painel/youtube': 'YouTube Downloader',
    '/painel/youtube-search': 'YouTube Search',
    '/painel/roblox-codes': 'Roblox Codes',
    '/painel/status': 'Status e diagnóstico'
  };

  const style = document.createElement('style');
  style.id = 'workspaceRouteReadyStyles';
  style.textContent = `
    body.workspace-route-pending #workspaceShell{visibility:hidden!important;pointer-events:none!important}
    body.workspace-route-pending #workspaceLoading{display:flex!important;visibility:visible!important;opacity:1!important}
  `;
  document.head.appendChild(style);
  document.body.classList.add('workspace-route-pending');

  const loading = document.getElementById('workspaceLoading');
  const loadingText = loading?.lastElementChild;
  if (loadingText) loadingText.textContent = `Abrindo ${labels[path] || 'página'}...`;

  let released = false;
  let observer = null;

  function isReady() {
    const title = String(document.getElementById('workspaceTitle')?.textContent || '').trim();
    if (!title) return false;
    const expected = specialExpected.get(path);
    if (expected) return title === expected;
    return title !== 'Visão geral';
  }

  function release(reason = 'ready') {
    if (released) return;
    released = true;
    observer?.disconnect();
    document.body.classList.remove('workspace-route-pending');
    document.body.dataset.workspaceRouteReady = reason;
  }

  function check() {
    if (isReady()) requestAnimationFrame(() => requestAnimationFrame(() => release('ready')));
  }

  observer = new MutationObserver(check);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  check();

  // Nunca deixe uma falha de módulo esconder a interface indefinidamente.
  setTimeout(() => release('timeout'), 7000);
})();
