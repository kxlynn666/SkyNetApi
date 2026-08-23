(() => {
  const S = window.SkyNet;
  if (!S) return;

  const PATH = '/painel/brat';

  function cleanPath() {
    return location.pathname.replace(/\/+$/, '') || '/';
  }

  function waitForWorkspace(callback) {
    const ready = () => {
      const shell = document.getElementById('workspaceShell');
      const sidebar = document.getElementById('workspaceSidebar');
      const content = document.getElementById('workspaceContent');
      return shell && sidebar && content && !shell.classList.contains('hidden') && sidebar.querySelector('a');
    };
    if (ready()) return callback();
    const observer = new MutationObserver(() => {
      if (!ready()) return;
      observer.disconnect();
      callback();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setTimeout(() => observer.disconnect(), 10000);
  }

  function installStyles() {
    if (document.getElementById('bratWorkspaceStyles')) return;
    const style = document.createElement('style');
    style.id = 'bratWorkspaceStyles';
    style.textContent = `
      .brat-workspace-preview{width:100%;aspect-ratio:1/1;border:1px solid var(--border);border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer}
      .brat-workspace-preview img{width:100%;height:100%;display:block;object-fit:contain;background:#fff;image-rendering:auto}
      .brat-workspace-preview.loading{opacity:.72}
      .brat-preview-state{padding:24px;color:#111;font-size:13px;line-height:1.5;text-align:center;cursor:default}
      .brat-workspace-form{display:grid;gap:14px}
      .brat-workspace-note{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.025);color:var(--muted);font-size:13px;line-height:1.5}
      .brat-workspace-badge{flex:0 0 auto;padding:4px 8px;border-radius:8px;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.24);font-weight:700;color:var(--text)}
      .brat-workspace-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
      .brat-workspace-form input{width:100%}
      .brat-api-code{display:block;margin-top:6px;word-break:break-all;color:var(--text);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px}
      @media(max-width:820px){.brat-workspace-preview{max-width:620px;margin:0 auto}}
    `;
    document.head.appendChild(style);
  }

  function setActiveNav() {
    document.querySelectorAll('.workspace-nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === PATH);
    });
  }

  function renderPage() {
    installStyles();
    setActiveNav();

    document.getElementById('workspaceKicker').textContent = 'Criação';
    document.getElementById('workspaceTitle').textContent = 'Brat Generator';
    document.getElementById('workspaceDescription').textContent = 'Gere uma imagem quadrada em baixa resolução, com fundo branco, texto preto, blur suave e alinhamento justify puxado para a esquerda.';
    document.title = 'Brat Generator - SkyNetApi';

    const root = document.getElementById('workspaceContent');
    root.innerHTML = `
      <section class="workspace-page-grid">
        <div class="workspace-card workspace-col-5">
          <div class="workspace-card-header"><div><h2>Configuração</h2><p>O texto é ajustado automaticamente dentro da composição e permanece ancorado à esquerda.</p></div></div>
          <div class="brat-workspace-note" style="margin-bottom:16px"><span class="brat-workspace-badge">JUSTIFY</span><span>As palavras são distribuídas para preencher a largura da linha. Linhas com uma única palavra continuam alinhadas à esquerda, nunca centralizadas.</span></div>
          <div class="brat-workspace-form">
            <div class="form-group">
              <label for="bratInput">Texto</label>
              <input id="bratInput" type="text" maxlength="450" autocomplete="off" spellcheck="false" value="brat and it’s completely different but also still brat">
              <div class="hint">Até 450 caracteres. A prévia usa exatamente o mesmo renderer da rota GET.</div>
            </div>
            <div class="workspace-info-grid" style="grid-template-columns:1fr 1fr">
              <div class="workspace-info"><div class="label">Formato</div><div class="value">450 × 450</div></div>
              <div class="workspace-info"><div class="label">Estilo</div><div class="value">Branco / preto</div></div>
              <div class="workspace-info"><div class="label">Alinhamento</div><div class="value">Justify à esquerda</div></div>
              <div class="workspace-info"><div class="label">Qualidade</div><div class="value">Baixa / suave</div></div>
            </div>
            <div class="brat-workspace-note">
              <span class="brat-workspace-badge">API</span>
              <span>Também funciona por rota e responde diretamente com o mesmo PNG de baixa resolução.
                <code class="brat-api-code">GET /generate-brat?texto=SEU_TEXTO&amp;apikey=SUA_API_KEY</code>
                <code class="brat-api-code">GET /brat?texto=SEU_TEXTO&amp;apikey=SUA_API_KEY</code>
              </span>
            </div>
            <div class="brat-workspace-actions">
              <button class="button primary" id="saveButton" type="button">Baixar PNG</button>
              <button class="button" id="bratReset" type="button">Restaurar texto</button>
            </div>
          </div>
        </div>
        <div class="workspace-card workspace-col-7">
          <div class="workspace-card-header"><div><h2>Pré-visualização</h2><p>O arquivo real é 450 × 450; a interface apenas amplia a exibição.</p></div></div>
          <div class="brat-workspace-preview" id="bratPreview">
            <div class="brat-preview-state">Gerando prévia...</div>
          </div>
        </div>
      </section>`;

    document.getElementById('bratReset').addEventListener('click', () => {
      const input = document.getElementById('bratInput');
      input.value = 'brat and it’s completely different but also still brat';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const script = document.createElement('script');
    script.src = `/brat-generator.js?v=7`;
    script.dataset.bratRenderer = '1';
    document.head.appendChild(script);
  }

  waitForWorkspace(() => {
    if (cleanPath() === PATH) renderPage();
  });
})();
