(() => {
  if (window.__SKYNET_WORKSPACE_BOOT_GUARD_V1__) return;
  window.__SKYNET_WORKSPACE_BOOT_GUARD_V1__ = true;

  const startedAt = Date.now();
  let settled = false;
  let lastClientError = '';

  window.addEventListener('error', event => {
    const message = event?.error?.message || event?.message || '';
    if (message) lastClientError = String(message).slice(0, 180);
  });

  window.addEventListener('unhandledrejection', event => {
    const reason = event?.reason;
    const message = reason?.message || (typeof reason === 'string' ? reason : '');
    if (message) lastClientError = String(message).slice(0, 180);
  });

  const watcher = setInterval(() => {
    const shell = document.getElementById('workspaceShell');
    if (shell && !shell.classList.contains('hidden')) finish();
  }, 250);

  const timeout = setTimeout(() => {
    if (settled) return;
    showRecovery(lastClientError || 'O painel demorou demais para iniciar.');
  }, 12000);

  window.addEventListener('offline', () => {
    if (!settled) showRecovery('Sem conexão com o servidor.');
  });

  function finish() {
    if (settled) return;
    settled = true;
    clearInterval(watcher);
    clearTimeout(timeout);
  }

  function showRecovery(detail) {
    if (settled) return;
    const shell = document.getElementById('workspaceShell');
    if (shell && !shell.classList.contains('hidden')) return finish();
    const loading = document.getElementById('workspaceLoading');
    if (!loading) return;

    clearInterval(watcher);
    clearTimeout(timeout);
    settled = true;
    loading.classList.remove('hidden');
    loading.replaceChildren();

    const mark = document.createElement('div');
    mark.className = 'workspace-loading-mark';
    mark.textContent = '!';

    const title = document.createElement('strong');
    title.textContent = 'Não foi possível iniciar o painel.';

    const text = document.createElement('div');
    text.textContent = navigator.onLine
      ? `${detail} Tente recarregar a página.`
      : 'Você está sem conexão. Reconecte e tente novamente.';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px';

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button primary';
    retry.textContent = 'Tentar novamente';
    retry.addEventListener('click', () => location.reload());

    const login = document.createElement('a');
    login.className = 'button';
    login.href = '/painel/login';
    login.textContent = 'Ir para o login';

    const meta = document.createElement('small');
    meta.style.opacity = '.65';
    meta.textContent = `Boot interrompido após ${Math.max(1, Math.round((Date.now() - startedAt) / 1000))}s.`;

    actions.append(retry, login);
    loading.append(mark, title, text, actions, meta);
  }
})();
