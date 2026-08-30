(() => {
  if (window.__SKYNET_WORKSPACE_POSTBOOT_V1__) return;
  window.__SKYNET_WORKSPACE_POSTBOOT_V1__ = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const lightweightToolRoute = new Set([
    '/painel/youtube',
    '/painel/youtube-search',
    '/painel/roblox-codes',
    '/painel/perfil/studio',
    '/painel/status'
  ]).has(path);

  // A camada de rota/menu começa imediatamente. Os scripts sabem esperar seus
  // elementos de DOM, então não precisam aguardar o shell ficar visível.
  const routeLayer = startRouteLayer().catch(error => {
    console.error('Falha ao carregar camada de rota do workspace:', error);
  });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const shell = document.getElementById('workspaceShell');
    if (shell && !shell.classList.contains('hidden')) {
      clearInterval(timer);
      startAfterShell().catch(error => console.error('Falha no pós-boot do workspace:', error));
      return;
    }
    if (attempts >= 100) clearInterval(timer);
  }, 100);

  async function startRouteLayer() {
    // Menu canônico e navegação precisam estar prontos assim que o sidebar nascer.
    await Promise.all([
      loadScript('/youtube-menu-v1.js?v=4'),
      loadScript('/workspace-menu-v2.js?v=route-ready-2')
    ]);

    // Recursos realmente críticos da rota podem ser buscados enquanto a sessão
    // termina de validar. O shell continua visualmente protegido pelo route-ready.
    if (path === '/painel/youtube') {
      await loadScript('/youtube-input-normalizer-v1.js?v=1');
      await loadScript('/youtube-auth-error-hotfix-v1.js?v=1');
      await loadScript('/youtube-v4-block-legacy.js?v=1');
      await loadScript('/youtube-downloader-v4.js?v=stability-2');
    }

    await loadScript('/workspace-feature-loader-v1.js?v=route-ready-2');
  }

  async function startAfterShell() {
    await routeLayer;

    if (lightweightToolRoute) {
      scheduleIdle(async () => {
        await loadScript('/workspace-ui-v3.js?v=route-ready-2');
      }, 700);
      return;
    }

    await loadScript('/common.js?v=route-ready-2');
    await loadScript('/workspace-ui-v3.js?v=route-ready-2');
    scheduleIdle(loadSecondary, 1000);
  }

  async function loadSecondary() {
    const scripts = [
      '/xp-panel.js',
      '/card-v2-page.js',
      '/profile-customization-v3.js',
      '/profile-name-decorations-v1.js',
      '/store-filter-controller-v2.js',
      '/brat-link.js',
      '/brat-page.js'
    ];
    for (const src of scripts) await loadScript(src);

    await loadScript('/socket.io/socket.io.js');
    await loadScript('/realtime-core-v1.js');
    for (const src of [
      '/social-router-v15.js',
      '/community-groups-v3.js',
      '/realtime-chat-v2-adapter.js',
      '/realtime-groups-v2-adapter.js',
      '/realtime-calls-v3.js'
    ]) await loadScript(src);
  }

  function scheduleIdle(fn, timeout = 1000) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => fn().catch(error => console.error('Falha ao carregar recursos secundários:', error)), { timeout });
      return;
    }
    setTimeout(() => fn().catch(error => console.error('Falha ao carregar recursos secundários:', error)), 180);
  }

  function loadScript(src) {
    return new Promise(resolve => {
      const base = src.split('?')[0];
      const existing = [...document.scripts].find(script => (script.getAttribute('src') || '').split('?')[0] === base);
      if (existing) {
        if (existing.dataset.workspaceLoaded === '1' || existing.readyState === 'complete') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => resolve(), { once: true });
        // Scripts que já executaram e não expõem readyState em todos os browsers.
        setTimeout(resolve, 0);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.workspacePostboot = '1';
      script.addEventListener('load', () => {
        script.dataset.workspaceLoaded = '1';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => {
        console.warn(`Não foi possível carregar ${src}`);
        resolve();
      }, { once: true });
      document.body.appendChild(script);
    });
  }
})();
