(() => {
  const S = window.SkyNet;
  if (!S || window.__SKYNET_WORKSPACE_SESSION_HOTFIX_V1__) return;
  window.__SKYNET_WORKSPACE_SESSION_HOTFIX_V1__ = true;

  S.session = async function sessionWithTimeout() {
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });

        if (response.status === 401) return null;

        const type = response.headers.get('content-type') || '';
        const data = type.includes('application/json')
          ? await response.json().catch(() => null)
          : await response.text().catch(() => null);

        if (!response.ok) {
          const error = new Error(data?.error || data?.message || `Erro HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }

        return data?.account || null;
      } catch (error) {
        lastError = error?.name === 'AbortError'
          ? new Error('O servidor demorou demais para responder à sessão.')
          : error;
        if (attempt === 0) await delay(350);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error('Não foi possível verificar a sessão.');
  };

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
