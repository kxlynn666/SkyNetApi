(() => {
    const cleanPath = location.pathname.replace(/\/+$/, '') || '/';
    if (cleanPath !== '/painel') return;

    const S = window.SkyNet;
    if (!S) return;

    function installStyles() {
        if (document.getElementById('robloxPanelStyles')) return;
        const style = document.createElement('style');
        style.id = 'robloxPanelStyles';
        style.textContent = `
            .roblox-layout{align-items:start}
            .roblox-avatar{min-height:420px;border:1px solid var(--border);border-radius:18px;background:rgba(7,5,14,.58);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:18px}
            .roblox-avatar img{width:100%;max-width:520px;max-height:560px;object-fit:contain;display:block}
            .roblox-profile{display:grid;gap:12px;margin-top:16px}
            .roblox-name{font-size:24px;font-weight:800;line-height:1.2}
            .roblox-user{color:var(--muted);font-size:15px}
            .roblox-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
            .roblox-field{border:1px solid var(--border);border-radius:14px;padding:12px;background:rgba(255,255,255,.02)}
            .roblox-field .label{font-size:12px;color:var(--text-faint);margin-bottom:5px}
            .roblox-field .value{font-weight:650;word-break:break-word}
            .roblox-description{white-space:pre-wrap;line-height:1.55;color:var(--muted);max-height:190px;overflow:auto}
            .roblox-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
            .roblox-wearing{font-family:monospace;font-size:12px;color:var(--text-faint);word-break:break-word;max-height:100px;overflow:auto}
            @media(max-width:720px){.roblox-avatar{min-height:280px}.roblox-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    function installPanel() {
        const tabs = document.querySelector('.tabs');
        const historyPanel = document.getElementById('history');
        if (!tabs || !historyPanel || document.getElementById('roblox')) return;

        installStyles();

        const tabButton = document.createElement('button');
        tabButton.className = 'tab';
        tabButton.dataset.tab = 'roblox';
        tabButton.type = 'button';
        tabButton.textContent = 'Roblox Player Lookup';

        const historyButton = tabs.querySelector('[data-tab="history"]');
        tabs.insertBefore(tabButton, historyButton || tabs.lastElementChild);

        const panel = document.createElement('section');
        panel.className = 'tab-panel';
        panel.id = 'roblox';
        panel.innerHTML = `
            <div class="grid two roblox-layout">
                <div class="card">
                    <h2 class="card-title">Roblox Player Lookup</h2>
                    <p class="editor-note">Consulte apenas informações públicas de um perfil do Roblox.</p>
                    <div class="message" id="robloxMessage"></div>
                    <form id="robloxForm">
                        <div class="form-group">
                            <label for="robloxQuery">Username, ID ou link do perfil</label>
                            <input id="robloxQuery" placeholder="Builderman, 156 ou https://www.roblox.com/users/.../profile" required>
                        </div>
                        <button class="button primary" id="robloxSearchButton" type="submit">Buscar jogador</button>
                    </form>
                    <p class="hint" style="margin-top:12px">Mostra somente dados públicos fornecidos pelo Roblox. Não consulta IP, e-mail, localização real ou outras informações privadas.</p>
                </div>

                <div class="card">
                    <h2 class="card-title">Perfil público</h2>
                    <div class="roblox-avatar" id="robloxAvatar">
                        <span class="muted">O avatar aparecerá aqui.</span>
                    </div>
                    <div class="roblox-profile hidden" id="robloxProfile">
                        <div>
                            <div class="roblox-name" id="robloxDisplayName"></div>
                            <div class="roblox-user" id="robloxUsername"></div>
                        </div>

                        <div class="roblox-grid">
                            <div class="roblox-field">
                                <div class="label">ID do usuário</div>
                                <div class="value" id="robloxId"></div>
                            </div>
                            <div class="roblox-field">
                                <div class="label">Conta criada em</div>
                                <div class="value" id="robloxCreated"></div>
                            </div>
                            <div class="roblox-field">
                                <div class="label">Conta verificada</div>
                                <div class="value" id="robloxVerified"></div>
                            </div>
                            <div class="roblox-field">
                                <div class="label">Itens usados no avatar</div>
                                <div class="value" id="robloxWearingCount"></div>
                            </div>
                        </div>

                        <div class="roblox-field">
                            <div class="label">Descrição pública</div>
                            <div class="roblox-description" id="robloxDescription"></div>
                        </div>

                        <details class="roblox-field" id="robloxWearingDetails">
                            <summary>IDs dos itens equipados</summary>
                            <div class="roblox-wearing" id="robloxWearing" style="margin-top:10px"></div>
                        </details>

                        <div class="roblox-actions">
                            <a class="button primary" id="robloxOpenProfile" target="_blank" rel="noopener noreferrer">Abrir perfil</a>
                            <button class="button" id="robloxCopyId" type="button">Copiar ID</button>
                            <button class="button" id="robloxCopyUsername" type="button">Copiar username</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        historyPanel.parentNode.insertBefore(panel, historyPanel);

        tabs.addEventListener('click', event => {
            const button = event.target.closest('[data-tab]');
            if (!button || !tabs.contains(button)) return;
            const target = button.dataset.tab;
            document.querySelectorAll('.tabs [data-tab]').forEach(item => item.classList.toggle('active', item === button));
            document.querySelectorAll('.tab-panel').forEach(item => item.classList.toggle('active', item.id === target));
        }, true);

        bindPanel();
        installDocs();
    }

    function bindPanel() {
        const form = document.getElementById('robloxForm');
        const query = document.getElementById('robloxQuery');
        const message = document.getElementById('robloxMessage');
        const button = document.getElementById('robloxSearchButton');
        const avatar = document.getElementById('robloxAvatar');
        const profile = document.getElementById('robloxProfile');
        const copyId = document.getElementById('robloxCopyId');
        const copyUsername = document.getElementById('robloxCopyUsername');
        let currentPlayer = null;

        function clearResult() {
            currentPlayer = null;
            avatar.innerHTML = '<span class="muted">O avatar aparecerá aqui.</span>';
            profile.classList.add('hidden');
        }

        function render(player) {
            currentPlayer = player;
            if (player.avatarUrl) {
                avatar.innerHTML = `<img src="${S.escapeHtml(player.avatarUrl)}" alt="Avatar público de ${S.escapeHtml(player.username || 'jogador')}" referrerpolicy="no-referrer">`;
            } else {
                avatar.innerHTML = '<span class="muted">O Roblox ainda não retornou a thumbnail do avatar.</span>';
            }

            document.getElementById('robloxDisplayName').textContent = player.displayName || player.username || 'Jogador';
            document.getElementById('robloxUsername').textContent = player.username ? `@${player.username}` : '';
            document.getElementById('robloxId').textContent = String(player.id ?? '');
            document.getElementById('robloxCreated').textContent = player.createdAt ? S.formatDate(player.createdAt) : 'Não informado';
            document.getElementById('robloxVerified').textContent = player.hasVerifiedBadge ? 'Sim' : 'Não';
            document.getElementById('robloxDescription').textContent = player.description || 'Sem descrição pública.';

            const wearing = Array.isArray(player.currentlyWearing) ? player.currentlyWearing : [];
            document.getElementById('robloxWearingCount').textContent = String(wearing.length);
            document.getElementById('robloxWearing').textContent = wearing.length ? wearing.join(', ') : 'Nenhum ID retornado.';
            document.getElementById('robloxWearingDetails').classList.toggle('hidden', wearing.length === 0);

            const openProfile = document.getElementById('robloxOpenProfile');
            openProfile.href = player.profileUrl || `https://www.roblox.com/users/${encodeURIComponent(player.id)}/profile`;
            profile.classList.remove('hidden');
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            const value = query.value.trim();
            if (!value) return S.message(message, 'Informe um username, ID ou link do perfil.', 'error');

            button.disabled = true;
            button.textContent = 'Buscando...';
            S.message(message, '');
            clearResult();

            try {
                const data = await S.api('/painel/roblox-user', {
                    method: 'POST',
                    body: { username: value }
                });
                render(data.player);
                S.message(message, 'Perfil público carregado.', 'success');
            } catch (error) {
                clearResult();
                S.message(message, error.message, 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Buscar jogador';
            }
        });

        copyId.addEventListener('click', async () => {
            if (!currentPlayer) return;
            try {
                await S.copy(String(currentPlayer.id));
                S.message(message, 'ID copiado.', 'success');
            } catch {
                prompt('Copie o ID:', String(currentPlayer.id));
            }
        });

        copyUsername.addEventListener('click', async () => {
            if (!currentPlayer?.username) return;
            try {
                await S.copy(currentPlayer.username);
                S.message(message, 'Username copiado.', 'success');
            } catch {
                prompt('Copie o username:', currentPlayer.username);
            }
        });
    }

    function installDocs() {
        const docs = document.getElementById('docs');
        if (!docs || document.getElementById('robloxApiDocs')) return;
        const card = document.createElement('div');
        card.className = 'card';
        card.id = 'robloxApiDocs';
        card.style.marginTop = '16px';
        card.innerHTML = `
            <h2 class="card-title">Consultar jogador do Roblox</h2>
            <p class="hint">Retorna somente informações públicas do perfil.</p>
            <div class="endpoint api-example"><span class="method get">GET</span>/roblox-user?username=Builderman&amp;apikey=SUA_CHAVE</div>
            <p class="hint">Também aceita ID numérico ou link do perfil no parâmetro <span class="mono">username</span>. Prefira o header <span class="mono">x-api-key</span> em integrações.</p>
        `;
        docs.appendChild(card);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installPanel, { once: true });
    } else {
        installPanel();
    }
})();
