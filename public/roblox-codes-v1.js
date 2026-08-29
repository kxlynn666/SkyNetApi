(() => {
  if (window.__SKYNET_ROBLOX_CODES_V1__) return;
  window.__SKYNET_ROBLOX_CODES_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/roblox-codes') return;

  const S = window.SkyNet;
  if (!S) return;
  let payload = null;
  let currentFilter = 'active';
  let currentSearch = '';

  installStyles();
  waitForWorkspace();

  function waitForWorkspace() {
    const root = document.getElementById('workspaceContent');
    const shell = document.getElementById('workspaceShell');
    if (!root || !shell || shell.classList.contains('hidden')) return setTimeout(waitForWorkspace, 80);
    document.getElementById('workspaceKicker').textContent = 'Roblox';
    document.getElementById('workspaceTitle').textContent = 'Roblox Codes';
    document.getElementById('workspaceDescription').textContent = 'Códigos atualizados de jogos do Roblox, reunidos de fontes públicas.';
    document.title = 'Roblox Codes - SkyNetApi';
    renderShell();
    loadCodes(false);
  }

  function renderShell() {
    const root = document.getElementById('workspaceContent');
    root.innerHTML = `
      <section class="workspace-card roblox-codes-hero-v1">
        <div class="roblox-codes-hero-copy-v1">
          <div class="roblox-codes-game-icon-v1">VL</div>
          <div>
            <h2>Volleyball Legends</h2>
            <p>Códigos detectados automaticamente na página da Eurogamer Portugal.</p>
          </div>
        </div>
        <div class="roblox-codes-hero-actions-v1">
          <button class="button" id="robloxCodesRefreshV1" type="button">Atualizar</button>
          <a class="button" href="https://www.eurogamer.pt/roblox-codigos-de-volleyball-legends" target="_blank" rel="noopener noreferrer">Abrir fonte</a>
        </div>
      </section>

      <section class="workspace-stat-grid roblox-codes-stats-v1" id="robloxCodesStatsV1">
        <div class="workspace-stat"><strong>—</strong><span>Códigos ativos</span></div>
        <div class="workspace-stat"><strong>—</strong><span>Expirados</span></div>
        <div class="workspace-stat"><strong>—</strong><span>Última consulta</span></div>
      </section>

      <section class="workspace-card roblox-codes-main-v1">
        <div class="workspace-card-header roblox-codes-header-v1">
          <div><h2>Lista de códigos</h2><p id="robloxCodesSourceMetaV1">Carregando informações da fonte...</p></div>
          <input id="robloxCodesSearchV1" type="search" autocomplete="off" placeholder="Filtrar código ou recompensa">
        </div>
        <div class="roblox-codes-filters-v1" id="robloxCodesFiltersV1">
          <button class="button small primary" type="button" data-filter="active">Ativos</button>
          <button class="button small" type="button" data-filter="expired">Expirados</button>
          <button class="button small" type="button" data-filter="all">Todos</button>
        </div>
        <div class="message" id="robloxCodesMessageV1"></div>
        <div class="roblox-codes-list-v1" id="robloxCodesListV1"><div class="empty">Consultando a Eurogamer...</div></div>
        <p class="hint roblox-codes-note-v1">Os códigos pertencem aos criadores do jogo. A SkyNetApi apenas organiza informações publicadas pela fonte indicada.</p>
      </section>`;

    document.getElementById('robloxCodesRefreshV1').addEventListener('click', () => loadCodes(true));
    document.getElementById('robloxCodesSearchV1').addEventListener('input', event => {
      currentSearch = String(event.target.value || '').trim().toLowerCase();
      renderCodes();
    });
    document.getElementById('robloxCodesFiltersV1').querySelectorAll('[data-filter]').forEach(button => {
      button.addEventListener('click', () => {
        currentFilter = button.dataset.filter;
        document.querySelectorAll('#robloxCodesFiltersV1 [data-filter]').forEach(item => {
          item.classList.toggle('primary', item === button);
        });
        renderCodes();
      });
    });
  }

  async function loadCodes(force) {
    const button = document.getElementById('robloxCodesRefreshV1');
    const message = document.getElementById('robloxCodesMessageV1');
    if (button) { button.disabled = true; button.textContent = 'Atualizando...'; }
    S.message(message, '', '');
    try {
      payload = await S.api(`/api/roblox-codes/volleyball-legends${force ? '?refresh=1' : ''}`);
      updateMeta();
      renderCodes();
      if (payload.warning) S.message(message, payload.warning, 'warning');
      else S.message(message, payload.cached ? 'Códigos carregados do cache recente.' : 'Códigos atualizados pela fonte.', 'success');
    } catch (error) {
      document.getElementById('robloxCodesListV1').innerHTML = '<div class="empty">Não foi possível carregar os códigos agora.</div>';
      S.message(message, error.message || 'Falha ao consultar a fonte.', 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Atualizar'; }
    }
  }

  function updateMeta() {
    if (!payload) return;
    const stats = document.querySelectorAll('#robloxCodesStatsV1 strong');
    if (stats[0]) stats[0].textContent = Number(payload.activeCount || 0);
    if (stats[1]) stats[1].textContent = Number(payload.expiredCount || 0);
    if (stats[2]) stats[2].textContent = shortDate(payload.fetchedAt);
    const meta = document.getElementById('robloxCodesSourceMetaV1');
    const sourceUpdate = payload.sourceUpdatedAt ? ` · artigo: ${formatDate(payload.sourceUpdatedAt)}` : '';
    const stale = payload.stale ? ' · cache antigo' : '';
    meta.textContent = `Fonte: ${payload.source?.name || 'Eurogamer Portugal'}${sourceUpdate}${stale}`;
  }

  function renderCodes() {
    const root = document.getElementById('robloxCodesListV1');
    if (!root || !payload) return;
    const codes = Array.isArray(payload.codes) ? payload.codes : [];
    const shown = codes.filter(item => {
      if (currentFilter !== 'all' && item.status !== currentFilter) return false;
      if (!currentSearch) return true;
      return `${item.code || ''} ${item.reward || ''}`.toLowerCase().includes(currentSearch);
    });

    if (!shown.length) {
      root.innerHTML = '<div class="empty">Nenhum código encontrado nesse filtro.</div>';
      return;
    }

    root.innerHTML = shown.map(item => `
      <article class="roblox-code-row-v1">
        <div class="roblox-code-main-v1">
          <div class="roblox-code-top-v1">
            <code>${esc(item.code)}</code>
            <span class="badge ${item.status === 'active' ? 'active' : 'inactive'}">${item.status === 'active' ? 'Ativo' : 'Expirado'}</span>
          </div>
          <div class="roblox-code-reward-v1">${item.reward ? esc(item.reward) : 'Recompensa não especificada pela fonte.'}</div>
        </div>
        <button class="button primary" type="button" data-copy-code="${esc(item.code)}">Copiar código</button>
      </article>`).join('');

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
    try { return new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short' }).format(new Date(value)); }
    catch { return String(value); }
  }

  function shortDate(value) {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value)); }
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
      .roblox-codes-hero-v1{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.roblox-codes-hero-copy-v1{display:flex;align-items:center;gap:14px}.roblox-codes-game-icon-v1{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-weight:900;background:color-mix(in srgb,var(--theme-primary) 18%,var(--theme-field));border:1px solid var(--theme-border-soft)}.roblox-codes-hero-copy-v1 h2{margin:0 0 4px}.roblox-codes-hero-copy-v1 p{margin:0;color:var(--theme-muted)}.roblox-codes-hero-actions-v1{display:flex;gap:8px;flex-wrap:wrap}.roblox-codes-stats-v1{margin-bottom:16px}.roblox-codes-header-v1{align-items:end}.roblox-codes-header-v1 input{max-width:300px}.roblox-codes-filters-v1{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.roblox-codes-list-v1{display:grid;gap:8px}.roblox-code-row-v1{display:flex;align-items:center;gap:14px;padding:13px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-field)}.roblox-code-main-v1{min-width:0;flex:1}.roblox-code-top-v1{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.roblox-code-top-v1 code{font-size:13px;font-weight:800;letter-spacing:.03em;word-break:break-all}.roblox-code-reward-v1{margin-top:5px;font-size:10px;line-height:1.45;color:var(--theme-muted)}.roblox-codes-note-v1{margin-top:14px}
      @media(max-width:680px){.roblox-codes-hero-v1,.roblox-code-row-v1{align-items:stretch;flex-direction:column}.roblox-codes-hero-actions-v1 .button,.roblox-code-row-v1>.button{width:100%;justify-content:center}.roblox-codes-header-v1{align-items:stretch;flex-direction:column}.roblox-codes-header-v1 input{max-width:none;width:100%}}
    `;
    document.head.appendChild(style);
  }
})();
