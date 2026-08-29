(() => {
  if (window.__SKYNET_WORKSPACE_POSTBOOT_V1__) return;
  window.__SKYNET_WORKSPACE_POSTBOOT_V1__ = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
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
    // Recursos necessários para a rota atual entram primeiro.
    if (path === '/painel/youtube') {
      await loadScript('/youtube-auth-error-hotfix-v1.js?v=1');
      await loadScript('/youtube-v4-block-legacy.js?v=1');
      await loadScript('/youtube-downloader-v4.js?v=audio-integrity-1');
      await loadScript('/youtube-menu-v1.js?v=2');
    } else if (path === '/painel/youtube-search') {
      await loadScript('/youtube-menu-v1.js?v=2');
    }

    await loadScript('/workspace-feature-loader-v1.js?v=panel-runtime-1');
    await loadScript('/workspace-menu-v2.js?v=panel-runtime-1');

    // common.js mantém as melhorias existentes, mas só depois que o shell já abriu.
    await loadScript('/common.js?v=panel-runtime-1');
    await loadScript('/workspace-ui-v3.js?v=panel-runtime-1');

    scheduleIdle(loadSecondary);
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

    // Realtime é útil para chat/grupos/jogos, mas nunca deve bloquear a abertura do painel.
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

  function scheduleIdle(fn) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => fn().catch(error => console.error('Falha ao carregar recursos secundários:', error)), { timeout: 1200 });
      return;
    }
    setTimeout(() => fn().catch(error => console.error('Falha ao carregar recursos secundários:', error)), 180);
  }

  function loadScript(src) {
    return new Promise(resolve => {
      const exact = [...document.scripts].find(script => script.getAttribute('src') === src);
      if (exact) return resolve();

      // Evita carregar a mesma base duas vezes quando só muda o cache-busting.
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
