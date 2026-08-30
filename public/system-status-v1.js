(() => {
  if (window.__SKYNET_SYSTEM_STATUS_V1__) return;
  window.__SKYNET_SYSTEM_STATUS_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/status') return;
  const S = window.SkyNet;
  if (!S) return;
  installStyles();
  wait();

  function wait(attempt = 0) {
    const shell = document.getElementById('workspaceShell');
    if (!shell || shell.classList.contains('hidden')) {
      if (attempt < 120) setTimeout(() => wait(attempt + 1), 80);
      return;
    }
    load();
  }

  async function load() {
    document.getElementById('workspaceKicker').textContent = 'Sistema';
    document.getElementById('workspaceTitle').textContent = 'Status e diagnóstico';
    document.getElementById('workspaceDescription').textContent = 'Saúde do serviço, capacidades publicadas e rotas documentadas.';
    document.title = 'Status - SkyNetApi';
    const root = document.getElementById('workspaceContent');
    root.innerHTML = '<div class="status-loading-v1">Executando diagnóstico…</div>';
    const started = performance.now();
    const [health, meta, routes, session] = await Promise.all([
      fetchJson('/health'),
      fetchJson('/api/meta'),
      fetchJson('/api/meta/routes'),
      fetchJson('/api/auth/me')
    ]);
    const latency = Math.max(1, Math.round(performance.now() - started));
    render(root, { health, meta, routes, session, latency });
  }

  async function fetchJson(url) {
    const started = performance.now();
    try {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, data, ms: Math.max(1, Math.round(performance.now() - started)) };
    } catch (error) {
      return { ok: false, status: 0, data: null, error: error.message || 'Falha de rede', ms: Math.max(1, Math.round(performance.now() - started)) };
    }
  }

  function render(root, state) {
    const serviceOk = state.health.ok && state.meta.ok;
    const pages = state.routes.data?.pages || [];
    const endpoints = state.routes.data?.endpoints || [];
    const version = state.meta.data?.version || state.health.data?.version || '—';
    root.innerHTML = `
      <div class="system-status-v1">
        <section class="status-hero-v1 workspace-card ${serviceOk ? 'ok' : 'bad'}">
          <div class="status-pulse-v1"></div>
          <div><span>SERVIÇO</span><h2>${serviceOk ? 'Operacional' : 'Atenção necessária'}</h2><p>${serviceOk ? 'Os endpoints essenciais responderam ao diagnóstico desta sessão.' : 'Uma ou mais verificações essenciais falharam.'}</p></div>
          <button class="button" type="button" id="statusReloadV1">Executar novamente</button>
        </section>
        <section class="status-grid-v1">
          ${metric('Versão', version, 'build atual')}
          ${metric('Diagnóstico', `${state.latency} ms`, 'tempo total')}
          ${metric('Páginas', pages.length, 'manifestadas')}
          ${metric('Endpoints', endpoints.length, 'documentados')}
        </section>
        <section class="status-two-v1">
          <div class="workspace-card"><div class="status-head-v1"><div><h3>Verificações</h3><p>Respostas reais do navegador nesta sessão.</p></div></div>${checkRow('/health', state.health)}${checkRow('/api/meta', state.meta)}${checkRow('/api/meta/routes', state.routes)}${checkRow('/api/auth/me', state.session)}</div>
          <div class="workspace-card"><div class="status-head-v1"><div><h3>Capacidades</h3><p>Contrato público publicado pelo backend.</p></div></div><div class="status-capabilities-v1">${Object.entries(state.meta.data?.capabilities || {}).map(([key, enabled]) => `<div><span>${S.escapeHtml(pretty(key))}</span><b class="${enabled ? 'yes' : 'no'}">${enabled ? 'Ativo' : 'Desativado'}</b></div>`).join('') || '<div class="empty">Manifesto indisponível.</div>'}</div></div>
        </section>
        <section class="workspace-card"><div class="status-head-v1"><div><h3>Mapa do produto</h3><p>Páginas canônicas publicadas pela API; útil para encontrar divergências entre menu, servidor e frontend.</p></div></div><div class="status-pages-v1">${pages.map(page => `<a href="${S.escapeHtml(page.path)}"><span>${S.escapeHtml(page.label)}</span><small>${S.escapeHtml(page.group)}</small></a>`).join('')}</div></section>
        <section class="workspace-card"><div class="status-head-v1"><div><h3>Contrato GET/API</h3><p>Resumo legível das rotas documentadas nesta versão.</p></div></div><div class="status-endpoints-v1">${endpoints.map(item => `<div><code>${S.escapeHtml(item.method)}</code><strong>${S.escapeHtml(item.path)}</strong><span>${S.escapeHtml(item.description)}</span><small>${item.auth ? 'sessão' : 'público'}</small></div>`).join('')}</div></section>
      </div>`;
    document.getElementById('statusReloadV1')?.addEventListener('click', load);
  }

  function metric(label, value, note) { return `<div class="workspace-stat status-stat-v1"><strong>${S.escapeHtml(String(value))}</strong><span>${S.escapeHtml(label)}</span><small>${S.escapeHtml(note)}</small></div>`; }
  function checkRow(label, result) { return `<div class="status-check-v1"><div><strong>${S.escapeHtml(label)}</strong><span>${S.escapeHtml(result.error || (result.ok ? 'Resposta válida' : `HTTP ${result.status || '—'}`))}</span></div><div><b class="${result.ok ? 'yes' : 'no'}">${result.ok ? 'OK' : 'Falha'}</b><small>${result.ms} ms</small></div></div>`; }
  function pretty(value) { return String(value).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()); }

  function installStyles() {
    if (document.getElementById('systemStatusV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'systemStatusV1Styles';
    style.textContent = `
      .system-status-v1{display:grid;gap:14px;max-width:1320px;margin:0 auto}.status-loading-v1{padding:24px;color:var(--theme-muted)}.status-hero-v1{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center}.status-hero-v1>div:nth-child(2)>span{font-size:9px;letter-spacing:.14em;color:var(--theme-muted)}.status-hero-v1 h2{margin:2px 0 3px;font-size:19px}.status-hero-v1 p{margin:0;color:var(--theme-muted);font-size:10px}.status-pulse-v1{width:14px;height:14px;border-radius:50%;background:#34d399;box-shadow:0 0 0 6px rgba(52,211,153,.09),0 0 24px rgba(52,211,153,.35)}.status-hero-v1.bad .status-pulse-v1{background:#fb7185;box-shadow:0 0 0 6px rgba(251,113,133,.09),0 0 24px rgba(251,113,133,.35)}.status-grid-v1{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.status-stat-v1 small{display:block;margin-top:4px;font-size:8px;color:var(--theme-muted)}.status-two-v1{display:grid;grid-template-columns:1fr 1fr;gap:14px}.status-head-v1{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}.status-head-v1 h3{margin:0;font-size:14px}.status-head-v1 p{margin:3px 0 0;color:var(--theme-muted);font-size:9px}.status-check-v1{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--theme-border-soft)}.status-check-v1:last-child{border-bottom:0}.status-check-v1 strong,.status-check-v1 span,.status-check-v1 small{display:block}.status-check-v1 strong{font-size:10px}.status-check-v1 span,.status-check-v1 small{font-size:8px;color:var(--theme-muted);margin-top:2px}.status-check-v1>div:last-child{text-align:right}.yes{color:#6ee7b7}.no{color:#fda4af}.status-capabilities-v1{display:grid;grid-template-columns:1fr 1fr;gap:7px}.status-capabilities-v1>div{display:flex;justify-content:space-between;gap:8px;padding:9px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-field);font-size:9px}.status-pages-v1{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}.status-pages-v1 a{display:flex;justify-content:space-between;gap:8px;padding:10px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-field);color:var(--theme-text);text-decoration:none}.status-pages-v1 span{font-size:9px;font-weight:700}.status-pages-v1 small{font-size:8px;color:var(--theme-muted)}.status-endpoints-v1{display:grid;gap:6px}.status-endpoints-v1>div{display:grid;grid-template-columns:56px minmax(180px,.7fr) minmax(220px,1.3fr) 58px;gap:9px;align-items:center;padding:9px 10px;border:1px solid var(--theme-border-soft);border-radius:9px;background:var(--theme-field)}.status-endpoints-v1 code{font-size:8px;color:var(--theme-primary)}.status-endpoints-v1 strong{font-size:9px;font-family:ui-monospace,monospace}.status-endpoints-v1 span,.status-endpoints-v1 small{font-size:8px;color:var(--theme-muted)}.status-endpoints-v1 small{text-align:right}
      @media(max-width:900px){.status-grid-v1{grid-template-columns:repeat(2,1fr)}.status-two-v1{grid-template-columns:1fr}.status-endpoints-v1>div{grid-template-columns:50px minmax(0,1fr) auto}.status-endpoints-v1 span{grid-column:2/-1}.status-endpoints-v1 small{grid-column:3;grid-row:1}}
      @media(max-width:560px){.status-hero-v1{grid-template-columns:auto 1fr}.status-hero-v1 .button{grid-column:1/-1;width:100%}.status-capabilities-v1{grid-template-columns:1fr}.status-pages-v1{grid-template-columns:1fr}.status-endpoints-v1>div{grid-template-columns:44px minmax(0,1fr)}.status-endpoints-v1 small{grid-column:1}.status-endpoints-v1 span{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }
})();
