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
  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;
    const shell = document.getElementById('workspaceShell');
    if (shell && !shell.classList.contains('hidden')) {
      clearInterval(timer);
      start().catch(error => console.error('Falha no pós-boot do workspace:', error));
      return;
    }
    if (attempts >= 100) clearInterval(timer);
  }, 100);

  async function start() {
    // Menu do YouTube deve existir em qualquer página do painel.
    await loadScript('/youtube-menu-v1.js?v=3');

    // Recursos críticos somente na rota que realmente precisa deles.
    if (path === '/painel/youtube') {
      await loadScript('/youtube-auth-error-hotfix-v1.js?v=1');
      await loadScript('/youtube-v4-block-legacy.js?v=1');
      await loadScript('/youtube-downloader-v4.js?v=stability-2');
    }

    await loadScript('/workspace-feature-loader-v1.js?v=product-audit-1');
    await loadScript('/workspace-menu-v2.js?v=product-audit-1');

    // Ferramentas isoladas, Studio e diagnóstico usam somente o núcleo mínimo.
    // Isso evita que dezenas de scripts globais disputem o DOM dessas páginas.
    if (lightweightToolRoute) {
      scheduleIdle(async () => {
        await loadScript('/workspace-ui-v3.js?v=product-audit-1');
      }, 900);
      return;
    }

    await loadScript('/common.js?v=product-audit-1');
    await loadScript('/workspace-ui-v3.js?v=product-audit-1');
    scheduleIdle(loadSecondary, 1200);
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

  function scheduleIdle(fn, timeout = 1200) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => fn().catch(error => console.error('Falha ao carregar recursos secundários:', error)), { timeout });
      return;
    }
    setTimeout(() => fn().catch(error => console.error('Falha ao carregar recursos secundários:', error)), 220);
  }

  function loadScript(src) {
    return new Promise(resolve => {
      const base = src.split('?')[0];
      const existing = [...document.scripts].find(script => (script.getAttribute('src') || '').split('?')[0] === base);
      if (existing) return resolve();

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.workspacePostboot = '1';
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => {
        console.warn(`Não foi possível carregar ${src}`);
        resolve();
      }, { once: true });
      document.body.appendChild(script);
    });
  }
})();
