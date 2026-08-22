(() => {
    const S = window.SkyNet;
    if (!S) return;

    const CARD2_PATH = '/painel/card2';

    function cleanPath() {
        return location.pathname.replace(/\/+$/, '') || '/';
    }

    function waitForWorkspace(callback) {
        const ready = () => {
            const sidebar = document.getElementById('workspaceSidebar');
            const content = document.getElementById('workspaceContent');
            const shell = document.getElementById('workspaceShell');
            return sidebar && content && shell && !shell.classList.contains('hidden') && sidebar.querySelector('a');
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

    function icon() {
        return '<span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><rect x="6" y="7" width="6" height="6" rx="1"/><path d="M14 8h4M14 11h4M6 16h12"/></svg></span>';
    }

    function patchNavigation() {
        const sidebar = document.getElementById('workspaceSidebar');
        if (!sidebar) return;

        sidebar.querySelectorAll('a[href="/painel/youtube"]').forEach(link => link.closest('.workspace-nav-link')?.remove());
        if (sidebar.querySelector(`a[href="${CARD2_PATH}"]`)) return;

        const cardLink = sidebar.querySelector('a[href="/painel/cards"]');
        if (!cardLink) return;
        const link = document.createElement('a');
        link.className = `workspace-nav-link ${cleanPath() === CARD2_PATH ? 'active' : ''}`;
        link.href = CARD2_PATH;
        link.innerHTML = `${icon()}<span>Card 2.0</span>`;
        cardLink.insertAdjacentElement('afterend', link);
    }

    function installStyles() {
        if (document.getElementById('cardV2WorkspaceStyles')) return;
        const style = document.createElement('style');
        style.id = 'cardV2WorkspaceStyles';
        style.textContent = `
            .card2-preview{aspect-ratio:21/9;min-height:0;width:100%;border:1px dashed var(--border);border-radius:16px;background:rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--text-faint)}
            .card2-preview img{width:100%;height:100%;display:block;object-fit:contain;background:#090b11}
            .card2-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
            .card2-form-grid .form-group{margin:0}
            .card2-span-2{grid-column:1/-1}
            .card2-info-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
            .card2-accent-row{display:grid;grid-template-columns:1fr 80px;gap:10px;align-items:end}
            .card2-accent-row input[type=color]{height:42px}
            .card2-format-note{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.025);color:var(--muted);font-size:13px;line-height:1.5}
            .card2-format-badge{flex:0 0 auto;padding:4px 8px;border-radius:8px;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.24);font-weight:700;color:var(--text)}
            @media(max-width:820px){.card2-form-grid,.card2-info-row{grid-template-columns:1fr}.card2-span-2{grid-column:auto}.card2-accent-row{grid-template-columns:1fr 70px}}
        `;
        document.head.appendChild(style);
    }

    function renderCard2Page() {
        installStyles();
        patchNavigation();

        document.querySelectorAll('.workspace-nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === CARD2_PATH));
        document.getElementById('workspaceKicker').textContent = 'Criação';
        document.getElementById('workspaceTitle').textContent = 'Card 2.0';
        document.getElementById('workspaceDescription').textContent = 'Crie um card de perfil ultrawide 21:9 com foto quadrada 1:1 e informações organizadas ao lado.';
        document.title = 'Card 2.0 - SkyNetApi';

        const root = document.getElementById('workspaceContent');
        root.innerHTML = `
            <section class="workspace-page-grid">
                <div class="workspace-card workspace-col-5">
                    <div class="workspace-card-header"><div><h2>Perfil visual</h2><p>Layout 21:9 de 1680 × 720, com avatar quadrado 1:1 sem deformação.</p></div></div>
                    <div class="card2-format-note" style="margin-bottom:16px"><span class="card2-format-badge">1:1</span><span>A foto principal é recortada em um quadro de 600 × 600. O formato 21:9 usa o espaço extra para nome, identificador, bio e informações livres.</span></div>
                    <div class="message" id="card2Message"></div>
                    <form id="card2Form" class="card2-form-grid">
                        <div class="form-group card2-span-2">
                            <label for="card2ImageUrl">Foto / avatar por URL</label>
                            <input id="card2ImageUrl" name="imagem_url" placeholder="https://... ou /uploads/...">
                        </div>
                        <div class="form-group card2-span-2">
                            <label for="card2ImageFile">Ou envie a imagem</label>
                            <input id="card2ImageFile" name="imagem_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
                        </div>
                        <div class="form-group">
                            <label for="card2Name">Nome principal</label>
                            <input id="card2Name" name="nome" maxlength="60" placeholder="João Augusto" required>
                        </div>
                        <div class="form-group">
                            <label for="card2Gamertag">Identificador / @</label>
                            <input id="card2Gamertag" name="gamertag" maxlength="38" placeholder="joaoaugusto">
                        </div>
                        <div class="form-group">
                            <label for="card2Status">Etiqueta opcional</label>
                            <input id="card2Status" name="status" maxlength="42" placeholder="Designer, Criador, Disponível...">
                        </div>
                        <div class="form-group card2-accent-row">
                            <div><label for="card2AccentText">Cor de destaque</label><input id="card2AccentText" value="#a855f7" pattern="#[0-9A-Fa-f]{6}" maxlength="7"></div>
                            <div><label for="card2Accent">Cor</label><input id="card2Accent" name="accent" type="color" value="#a855f7"></div>
                        </div>
                        <div class="form-group card2-span-2">
                            <label for="card2Bio">Descrição curta</label>
                            <textarea id="card2Bio" name="bio" maxlength="260" placeholder="Uma apresentação curta, projeto, área de atuação ou qualquer texto que combine com o perfil."></textarea>
                        </div>
                        <div class="form-group card2-span-2">
                            <label>Informação 1</label>
                            <div class="card2-info-row"><input name="stat1_label" maxlength="18" value="INFO 1" placeholder="RÓTULO"><input name="stat1_value" maxlength="28" placeholder="Valor"></div>
                        </div>
                        <div class="form-group card2-span-2">
                            <label>Informação 2</label>
                            <div class="card2-info-row"><input name="stat2_label" maxlength="18" value="INFO 2" placeholder="RÓTULO"><input name="stat2_value" maxlength="28" placeholder="Valor"></div>
                        </div>
                        <div class="form-group card2-span-2">
                            <label>Informação 3</label>
                            <div class="card2-info-row"><input name="stat3_label" maxlength="18" value="INFO 3" placeholder="RÓTULO"><input name="stat3_value" maxlength="28" placeholder="Valor"></div>
                        </div>
                        <div class="card2-span-2"><button class="button primary" id="card2Generate" type="submit">Gerar Card 2.0</button></div>
                    </form>
                </div>
                <div class="workspace-card workspace-col-7">
                    <div class="workspace-card-header"><div><h2>Pré-visualização 21:9</h2><p>O card final usa 1680 × 720 e mantém a foto em 1:1.</p></div></div>
                    <div class="card2-preview" id="card2Preview"><span>O Card 2.0 aparecerá aqui.</span></div>
                    <div class="workspace-tool-actions">
                        <a class="button primary hidden" id="card2Download" download="card-v2.png">Baixar</a>
                        <button class="button hidden" id="card2Copy" type="button">Copiar link</button>
                    </div>
                </div>
            </section>`;

        bindCard2();
    }

    function bindCard2() {
        const form = document.getElementById('card2Form');
        const message = document.getElementById('card2Message');
        const preview = document.getElementById('card2Preview');
        const download = document.getElementById('card2Download');
        const copy = document.getElementById('card2Copy');
        const accent = document.getElementById('card2Accent');
        const accentText = document.getElementById('card2AccentText');
        let currentUrl = '';

        accent.addEventListener('input', () => { accentText.value = accent.value; });
        accentText.addEventListener('input', () => {
            if (/^#[0-9a-f]{6}$/i.test(accentText.value)) accent.value = accentText.value;
        });

        form.addEventListener('submit', async event => {
            event.preventDefault();
            const file = document.getElementById('card2ImageFile');
            const imageUrl = document.getElementById('card2ImageUrl').value.trim();
            if (!file.files.length && !imageUrl) return S.message(message, 'Informe a foto ou avatar.', 'error');

            const button = document.getElementById('card2Generate');
            const body = new FormData(form);
            if (!file.files.length) body.delete('imagem_file');
            body.set('accent', accent.value);

            button.disabled = true;
            button.textContent = 'Gerando...';
            S.message(message, '');
            try {
                const result = await S.api('/painel/gerar-card2', { method: 'POST', body });
                currentUrl = new URL(result.url, location.origin).href;
                preview.innerHTML = `<img src="${S.escapeHtml(result.url)}?t=${Date.now()}" alt="Card 2.0 gerado">`;
                download.href = result.url;
                download.classList.remove('hidden');
                copy.classList.remove('hidden');
                S.message(message, `Card 2.0 gerado em ${result.width} × ${result.height}.`, 'success');
            } catch (error) {
                S.message(message, error.message, 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Gerar Card 2.0';
            }
        });

        copy.addEventListener('click', async () => {
            if (!currentUrl) return;
            try {
                await S.copy(currentUrl);
                S.message(message, 'Link do Card 2.0 copiado.', 'success');
            } catch {
                prompt('Copie o link:', currentUrl);
            }
        });
    }

    waitForWorkspace(() => {
        patchNavigation();
        if (cleanPath() === CARD2_PATH) renderCard2Page();
    });
})();
