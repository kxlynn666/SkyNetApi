(() => {
  if (window.__SKYNET_ROBLOX_CODES_V1__) return;
  window.__SKYNET_ROBLOX_CODES_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/roblox-codes') return;

  const S = window.SkyNet;
  if (!S) return;
  let payload = null;
  let currentFilter = 'all';
  let currentSearch = '';
  let workspaceWaitAttempts = 0;

  installStyles();
  waitForWorkspace();

  function waitForWorkspace() {
    const root = document.getElementById('workspaceContent');
    const shell = document.getElementById('workspaceShell');
    if (!root || !shell || shell.classList.contains('hidden')) {
      workspaceWaitAttempts += 1;
      if (workspaceWaitAttempts >= 125) return;
      setTimeout(waitForWorkspace, 80);
      return;
    }
    document.getElementById('workspaceKicker')?.replaceChildren(document.createTextNode('Roblox'));
    document.getElementById('workspaceTitle')?.replaceChildren(document.createTextNode('Roblox Codes'));
    document.getElementById('workspaceDescription')?.replaceChildren(document.createTextNode('Códigos atuais e expirados, organizados e verificados em fontes públicas.'));
    document.title = 'Roblox Codes - SkyNetApi';
    renderShell();
    loadCodes(false);
  }

  function renderShell() {
    const root = document.getElementById('workspaceContent');
    if (!root) return;
    root.innerHTML = `
      <section class="workspace-card roblox-codes-hero-v1">
        <div class="roblox-codes-hero-copy-v1">
          <div class="roblox-codes-game-icon-v1">VL</div>
          <div class="roblox-codes-hero-text-v1">
            <h2>Volleyball Legends</h2>
            <p>Lista reunida automaticamente e comparada entre fontes públicas para reduzir códigos desatualizados.</p>
          </div>
        </div>
        <div class="roblox-codes-hero-actions-v1">
          <button class="button" id="robloxCodesRefreshV1" type="button">Atualizar</button>
          <a class="button" href="https://www.eurogamer.pt/roblox-codigos-de-volleyball-legends" target="_blank" rel="noopener noreferrer">Eurogamer</a>
        </div>
      </section>

      <section class="roblox-codes-stats-v1" id="robloxCodesStatsV1">
        <div class="workspace-stat"><strong>—</strong><span>Ativos</span></div>
        <div class="workspace-stat"><strong>—</strong><span>Expirados</span></div>
        <div class="workspace-stat"><strong>—</strong><span>Total</span></div>
        <div class="workspace-stat"><strong>—</strong><span>Consulta</span></div>
      </section>

      <section class="workspace-card roblox-codes-main-v1">
        <div class="roblox-codes-toolbar-v1">
          <div class="roblox-codes-title-v1"><h2>Lista de códigos</h2><p id="robloxCodesSourceMetaV1">Carregando informações das fontes...</p></div>
          <input id="robloxCodesSearchV1" type="search" autocomplete="off" placeholder="Buscar código ou recompensa">
        </div>
        <div class="roblox-codes-filters-v1" id="robloxCodesFiltersV1">
          <button class="button small primary" type="button" data-filter="all">Todos</button>
          <button class="button small" type="button" data-filter="active">Ativos</button>
          <button class="button small" type="button" data-filter="expired">Expirados</button>
        </div>
        <div class="message" id="robloxCodesMessageV1"></div>
        <div class="roblox-codes-list-v1" id="robloxCodesListV1"><div class="empty">Consultando as fontes...</div></div>
        <p class="hint roblox-codes-note-v1">O status depende das fontes consultadas e pode mudar quando o jogo atualiza. Use o botão Atualizar para solicitar nova verificação.</p>
      </section>`;

    document.getElementById('robloxCodesRefreshV1')?.addEventListener('click', () => loadCodes(true));
    document.getElementById('robloxCodesSearchV1')?.addEventListener('input', event => {
      currentSearch = String(event.target.value || '').trim().toLowerCase();
      renderCodes();
    });
    document.getElementById('robloxCodesFiltersV1')?.querySelectorAll('[data-filter]').forEach(button => {
      button.addEventListener('click', () => {
        currentFilter = button.dataset.filter || 'all';
        document.querySelectorAll('#robloxCodesFiltersV1 [data-filter]').forEach(item => item.classList.toggle('primary', item === button));
        renderCodes();
      });
    });
  }

  async function loadCodes(force) {
    const button = document.getElementById('robloxCodesRefreshV1');
    const message = document.getElementById('robloxCodesMessageV1');
    if (!message) return;
    if (button) { button.disabled = true; button.textContent = 'Atualizando...'; }
    S.message(message, '', '');
    try {
      payload = await S.api(`/api/roblox-codes/volleyball-legends${force ? '?refresh=1' : ''}`);
      updateMeta();
      renderCodes();
      if (payload.warning) S.message(message, payload.warning, 'warning');
      else S.message(message, payload.cached ? 'Lista carregada do cache recente.' : 'Lista atualizada e verificada.', 'success');
    } catch (error) {
      const list = document.getElementById('robloxCodesListV1');
      if (list) list.innerHTML = '<div class="empty">Não foi possível carregar os códigos agora.</div>';
      S.message(message, error.message || 'Falha ao consultar as fontes.', 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Atualizar'; }
    }
  }

  function updateMeta() {
    if (!payload) return;
    const stats = document.querySelectorAll('#robloxCodesStatsV1 strong');
    if (stats[0]) stats[0].textContent = Number(payload.activeCount || 0);
    if (stats[1]) stats[1].textContent = Number(payload.expiredCount || 0);
    if (stats[2]) stats[2].textContent = Number(payload.totalCount || payload.codes?.length || 0);
    if (stats[3]) stats[3].textContent = shortDate(payload.fetchedAt);

    const meta = document.getElementById('robloxCodesSourceMetaV1');
    if (!meta) return;
    const names = Array.isArray(payload.sources) && payload.sources.length
      ? payload.sources.map(source => source.name).join(' + ')
      : (payload.source?.name || 'fonte pública');
    const sourceUpdate = payload.sourceUpdatedAt ? ` · atualização: ${formatDate(payload.sourceUpdatedAt)}` : '';
    const stale = payload.stale ? ' · cache antigo' : '';
    meta.textContent = `Fontes: ${names}${sourceUpdate}${stale}`;
  }

  function renderCodes() {
    const root = document.getElementById('robloxCodesListV1');
    if (!root || !payload) return;
    const codes = Array.isArray(payload.codes) ? payload.codes : [];
    const shown = codes.filter(item => {
      if (currentFilter !== 'all' && item.status !== currentFilter) return false;
      if (!currentSearch) return true;
      return `${item.code || ''} ${item.reward || ''} ${(item.verifiedBy || []).join(' ')}`.toLowerCase().includes(currentSearch);
    });

    if (!shown.length) {
      root.innerHTML = '<div class="empty">Nenhum código encontrado nesse filtro.</div>';
      return;
    }

    root.innerHTML = shown.map(item => {
      const sources = Array.isArray(item.verifiedBy) && item.verifiedBy.length ? item.verifiedBy.join(' + ') : '';
      return `
        <article class="roblox-code-row-v1">
          <div class="roblox-code-main-v1">
            <div class="roblox-code-top-v1">
              <code>${esc(item.code)}</code>
              <span class="badge ${item.status === 'active' ? 'active' : 'inactive'}">${item.status === 'active' ? 'Ativo' : 'Expirado'}</span>
            </div>
            <div class="roblox-code-reward-v1">${item.reward ? esc(item.reward) : (item.status === 'expired' ? 'Código arquivado/expirado.' : 'Recompensa não especificada.')}</div>
            ${sources ? `<div class="roblox-code-source-v1">Verificado em: ${esc(sources)}</div>` : ''}
          </div>
          <button class="button primary roblox-code-copy-v1" type="button" data-copy-code="${esc(item.code)}">Copiar</button>
        </article>`;
    }).join('');

    root.querySelectorAll('[data-copy-code]').forEach(button => {
      button.addEventListener('click', async () => {
        const code = button.getAttribute('data-copy-code') || '';
        if (!code) return;
        try {
          await S.copy(code);
          const original = button.textContent;
          button.textContent = 'Copiado!';
          setTimeout(() => { button.textContent = original; }, 1200);
        } catch {
          prompt('Copie o código:', code);
        }
      });
    });
  }

  function formatDate(value) {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
    catch { return String(value); }
  }

  function shortDate(value) {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
    catch { return '—'; }
  }

  function esc(value) {
    return S.escapeHtml(value == null ? '' : String(value));
  }

  function installStyles() {
    if (document.getElementById('robloxCodesV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'robloxCodesV1Styles';
    style.textContent = `
      .roblox-codes-hero-v1{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;overflow:hidden}.roblox-codes-hero-copy-v1{display:flex;align-items:center;gap:14px;min-width:0}.roblox-codes-hero-text-v1{min-width:0}.roblox-codes-game-icon-v1{width:52px;height:52px;min-width:52px;border-radius:14px;display:grid;place-items:center;font-weight:900;background:var(--theme-field);border:1px solid var(--theme-border-soft)}.roblox-codes-hero-copy-v1 h2{margin:0 0 4px;overflow-wrap:anywhere}.roblox-codes-hero-copy-v1 p{margin:0;color:var(--theme-muted);line-height:1.45}.roblox-codes-hero-actions-v1{display:flex;gap:8px;flex-wrap:wrap;flex:none}
      .roblox-codes-stats-v1{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.roblox-codes-stats-v1 .workspace-stat{min-width:0}.roblox-codes-stats-v1 .workspace-stat strong{overflow-wrap:anywhere}
      .roblox-codes-main-v1{min-width:0;overflow:hidden}.roblox-codes-toolbar-v1{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,300px);align-items:end;gap:12px;margin-bottom:10px}.roblox-codes-title-v1{min-width:0}.roblox-codes-title-v1 h2{margin:0 0 4px}.roblox-codes-title-v1 p{margin:0;color:var(--theme-muted);overflow-wrap:anywhere}.roblox-codes-toolbar-v1 input{width:100%;min-width:0}.roblox-codes-filters-v1{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.roblox-codes-list-v1{display:grid;gap:8px;min-width:0}.roblox-code-row-v1{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-field);min-width:0}.roblox-code-main-v1{min-width:0}.roblox-code-top-v1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}.roblox-code-top-v1 code{font-size:13px;font-weight:800;letter-spacing:.02em;overflow-wrap:anywhere;word-break:break-word;white-space:normal;min-width:0}.roblox-code-reward-v1{margin-top:5px;font-size:10px;line-height:1.45;color:var(--theme-muted);overflow-wrap:anywhere}.roblox-code-source-v1{margin-top:4px;font-size:9px;line-height:1.4;color:var(--theme-muted);opacity:.75;overflow-wrap:anywhere}.roblox-code-copy-v1{min-width:78px}.roblox-codes-note-v1{margin-top:14px;overflow-wrap:anywhere}
      @media(max-width:820px){.roblox-codes-stats-v1{grid-template-columns:repeat(2,minmax(0,1fr))}.roblox-codes-toolbar-v1{grid-template-columns:1fr;align-items:stretch}.roblox-codes-toolbar-v1 input{max-width:none}.roblox-code-row-v1{grid-template-columns:minmax(0,1fr) auto}}
      @media(max-width:560px){.roblox-codes-hero-v1{align-items:stretch;flex-direction:column;padding:14px}.roblox-codes-hero-copy-v1{align-items:flex-start}.roblox-codes-game-icon-v1{width:44px;height:44px;min-width:44px;border-radius:12px}.roblox-codes-hero-actions-v1{display:grid;grid-template-columns:1fr 1fr;width:100%}.roblox-codes-hero-actions-v1 .button{width:100%;justify-content:center;min-width:0}.roblox-codes-stats-v1{gap:8px}.roblox-codes-main-v1{padding:14px}.roblox-codes-filters-v1{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.roblox-codes-filters-v1 .button{min-width:0;width:100%;padding-left:8px;padding-right:8px}.roblox-code-row-v1{grid-template-columns:1fr;align-items:stretch;padding:12px;gap:10px}.roblox-code-copy-v1{width:100%;justify-content:center}.roblox-code-top-v1 code{font-size:12px}.roblox-code-reward-v1{font-size:10px}.roblox-codes-note-v1{font-size:9px}}
      @media(max-width:360px){.roblox-codes-hero-copy-v1{gap:10px}.roblox-codes-game-icon-v1{display:none}.roblox-codes-hero-actions-v1{grid-template-columns:1fr}.roblox-codes-filters-v1{grid-template-columns:1fr}.roblox-codes-stats-v1{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }
})();
