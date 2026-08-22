(() => {
    const S = window.SkyNet;
    if (!S) return;

    const ROUTES = {
        '/painel': { key: 'overview', kicker: 'Workspace', title: 'Visão geral', description: 'Acompanhe sua conta, atividade da API e acesse rapidamente todas as ferramentas.' },
        '/painel/conta': { key: 'account', kicker: 'Conta', title: 'Minha conta', description: 'Informações da conta e status de acesso ao SkyNetApi.' },
        '/painel/chaves': { key: 'keys', kicker: 'API', title: 'API Keys', description: 'Crie, copie, revogue e organize suas chaves de acesso.' },
        '/painel/cards': { key: 'cards', kicker: 'Criação', title: 'Card Studio', description: 'Gere cards 1080 × 1080 com fundo, avatar e textos personalizados.' },
        '/painel/uploads': { key: 'uploads', kicker: 'Biblioteca', title: 'Uploads', description: 'Gerencie imagens reutilizáveis no editor de cards.' },
        '/painel/tiktok': { key: 'tiktok', kicker: 'Downloader', title: 'TikTok Downloader', description: 'Analise um TikTok, visualize vídeo ou áudio e baixe somente quando quiser.' },
        '/painel/youtube': { key: 'youtube', kicker: 'Player', title: 'YouTube', description: 'Abra vídeos do YouTube no player oficial sem sair do workspace.' },
        '/painel/media': { key: 'media', kicker: 'Downloader', title: 'Media Downloader', description: 'Analise links públicos compatíveis com yt-dlp e escolha vídeo ou áudio.' },
        '/painel/roblox': { key: 'roblox', kicker: 'Lookup', title: 'Roblox Player Lookup', description: 'Consulte dados públicos de jogadores do Roblox por username, ID ou perfil.' },
        '/painel/historico': { key: 'history', kicker: 'Biblioteca', title: 'Histórico de cards', description: 'Veja, abra, baixe ou exclua cards gerados anteriormente.' },
        '/painel/api': { key: 'docs', kicker: 'Documentação', title: 'Rotas de API', description: 'Referência rápida para usar as funções do SkyNetApi por código.' }
    };

    const NAV_GROUPS = [
        { label: 'Geral', items: [
            ['/painel', 'Visão geral', 'grid'],
            ['/painel/conta', 'Minha conta', 'user']
        ]},
        { label: 'API', items: [
            ['/painel/chaves', 'API Keys', 'key'],
            ['/painel/api', 'Rotas de API', 'code']
        ]},
        { label: 'Criação', items: [
            ['/painel/cards', 'Card Studio', 'image'],
            ['/painel/uploads', 'Uploads', 'upload'],
            ['/painel/historico', 'Histórico', 'history']
        ]},
        { label: 'Downloaders', items: [
            ['/painel/tiktok', 'TikTok', 'download'],
            ['/painel/media', 'Media Downloader', 'media'],
            ['/painel/youtube', 'YouTube', 'play']
        ]},
        { label: 'Ferramentas', items: [
            ['/painel/roblox', 'Roblox Lookup', 'search']
        ]}
    ];

    let currentUser = null;
    let currentRoute = null;

    function cleanPath() {
        const path = location.pathname.replace(/\/+$/, '');
        return path || '/painel';
    }

    function icon(name) {
        const paths = {
            grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
            user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
            key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>',
            code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
            image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
            upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
            history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
            download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
            media: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
            play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
            search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
            shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/>'
        };
        return `<span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg></span>`;
    }

    function renderSidebar() {
        const root = document.getElementById('workspaceSidebar');
        const path = currentRoute.path;
        const groups = NAV_GROUPS.map(group => `
            <div class="workspace-nav-group">
                <div class="workspace-nav-label">${S.escapeHtml(group.label)}</div>
                ${group.items.map(([href, label, iconName]) => `
                    <a class="workspace-nav-link ${path === href ? 'active' : ''}" href="${href}">${icon(iconName)}<span>${S.escapeHtml(label)}</span></a>
                `).join('')}
            </div>`).join('');

        root.innerHTML = `
            <a class="workspace-logo" href="/painel"><span>S</span><strong>SkyNetApi</strong></a>
            <nav class="workspace-nav">${groups}${currentUser.isAdmin ? `
                <div class="workspace-nav-group">
                    <div class="workspace-nav-label">Sistema</div>
                    <a class="workspace-nav-link" href="/admin">${icon('shield')}<span>Administração</span></a>
                </div>` : ''}</nav>
            <div class="workspace-sidebar-footer">
                <div class="workspace-profile-mini">
                    <div class="workspace-profile-avatar">${S.escapeHtml((currentUser.username || 'U').slice(0,1).toUpperCase())}</div>
                    <div class="workspace-profile-copy"><strong>${S.escapeHtml(currentUser.username)}</strong><span>${currentUser.isAdmin ? 'Administrador' : 'Conta ativa'}</span></div>
                </div>
                <button class="button workspace-logout" id="workspaceLogout" type="button">Sair da conta</button>
            </div>`;

        document.getElementById('workspaceLogout').addEventListener('click', async () => {
            try { await S.api('/api/auth/logout', { method: 'POST' }); } catch {}
            location.replace('/painel/login');
        });
    }

    function setupShell() {
        document.getElementById('workspaceKicker').textContent = currentRoute.kicker;
        document.getElementById('workspaceTitle').textContent = currentRoute.title;
        document.getElementById('workspaceDescription').textContent = currentRoute.description;
        document.getElementById('workspaceUserChip').textContent = currentUser.username;
        document.title = `${currentRoute.title} - SkyNetApi`;
        renderSidebar();

        const sidebar = document.getElementById('workspaceSidebar');
        const backdrop = document.getElementById('workspaceSidebarBackdrop');
        const closeMenu = () => { sidebar.classList.remove('open'); backdrop.classList.add('hidden'); };
        document.getElementById('workspaceMenuButton').addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.remove('hidden'); });
        backdrop.addEventListener('click', closeMenu);
        sidebar.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });

        document.getElementById('workspaceLoading').classList.add('hidden');
        document.getElementById('workspaceShell').classList.remove('hidden');
    }

    function content(html) {
        document.getElementById('workspaceContent').innerHTML = html;
    }

    async function initOverview() {
        content(`
            <section class="workspace-stat-grid" id="overviewStats">
                ${['API Keys','Requisições','Uploads','Cards gerados'].map(label => `<div class="workspace-stat"><strong>—</strong><span>${label}</span></div>`).join('')}
            </section>
            <section class="workspace-page-grid" style="margin-top:18px">
                <div class="workspace-card workspace-col-8">
                    <div class="workspace-card-header"><div><h2>Acesso rápido</h2><p>Ferramentas usadas com mais frequência.</p></div></div>
                    <div class="workspace-quick-grid">
                        <a class="workspace-quick" href="/painel/cards"><strong>Card Studio</strong><span>Gerar cards 1080 × 1080.</span></a>
                        <a class="workspace-quick" href="/painel/tiktok"><strong>TikTok Downloader</strong><span>Vídeo e áudio com prévia.</span></a>
                        <a class="workspace-quick" href="/painel/media"><strong>Media Downloader</strong><span>Análise de links com yt-dlp.</span></a>
                        <a class="workspace-quick" href="/painel/roblox"><strong>Roblox Lookup</strong><span>Dados públicos de jogadores.</span></a>
                        <a class="workspace-quick" href="/painel/uploads"><strong>Uploads</strong><span>Biblioteca de imagens.</span></a>
                        <a class="workspace-quick" href="/painel/chaves"><strong>API Keys</strong><span>Gerenciar acessos à API.</span></a>
                    </div>
                </div>
                <div class="workspace-card workspace-col-4">
                    <div class="workspace-card-header"><div><h2>Sua conta</h2><p>Resumo do acesso atual.</p></div></div>
                    <div class="workspace-info-grid" style="grid-template-columns:1fr">
                        <div class="workspace-info"><div class="label">Usuário</div><div class="value">${S.escapeHtml(currentUser.username)}</div></div>
                        <div class="workspace-info"><div class="label">Status</div><div class="value"><span class="badge active">Ativa</span></div></div>
                        <div class="workspace-info"><div class="label">Último login</div><div class="value">${S.escapeHtml(S.formatDate(currentUser.lastLoginAt))}</div></div>
                    </div>
                </div>
            </section>`);

        try {
            const [keysData, uploadsData, generationsData] = await Promise.all([
                S.api('/api/keys'), S.api('/api/uploads'), S.api('/api/generations')
            ]);
            const keys = keysData.keys || [];
            const values = [keys.length, keys.reduce((sum, key) => sum + Number(key.requestCount || 0), 0), (uploadsData.uploads || []).length, (generationsData.generations || []).length];
            document.querySelectorAll('#overviewStats .workspace-stat strong').forEach((el, index) => { el.textContent = values[index]; });
        } catch {}
    }

    function initAccount() {
        content(`<section class="workspace-page-grid"><div class="workspace-card workspace-col-8">
            <div class="workspace-card-header"><div><h2>Informações da conta</h2><p>Dados básicos da sessão atual.</p></div></div>
            <div class="workspace-info-grid">
                <div class="workspace-info"><div class="label">Usuário</div><div class="value">${S.escapeHtml(currentUser.username)}</div></div>
                <div class="workspace-info"><div class="label">Status</div><div class="value"><span class="badge ${currentUser.active ? 'active' : 'inactive'}">${currentUser.active ? 'Ativa' : 'Inativa'}</span></div></div>
                <div class="workspace-info"><div class="label">Criada em</div><div class="value">${S.escapeHtml(S.formatDate(currentUser.createdAt))}</div></div>
                <div class="workspace-info"><div class="label">Último login</div><div class="value">${S.escapeHtml(S.formatDate(currentUser.lastLoginAt))}</div></div>
                <div class="workspace-info"><div class="label">Nível</div><div class="value">${currentUser.isAdmin ? 'Administrador' : 'Usuário'}</div></div>
                <div class="workspace-info"><div class="label">ID</div><div class="value mono">${S.escapeHtml(currentUser.id || '')}</div></div>
            </div>
        </div></section>`);
    }

    async function initKeys() {
        content(`<section class="workspace-card">
            <div class="workspace-card-header"><div><h2>Gerenciar API Keys</h2><p>Crie chaves separadas para cada integração e revogue quando necessário.</p></div></div>
            <div class="message" id="keysMessage"></div>
            <div class="toolbar"><input id="keyName" maxlength="50" placeholder="Nome da nova chave"><button class="button primary" id="createKeyButton" type="button">Criar chave</button></div>
            <div class="list" id="keysList"><div class="empty">Carregando...</div></div>
        </section>`);
        const message = document.getElementById('keysMessage');

        async function load() {
            const data = await S.api('/api/keys');
            const keys = data.keys || [];
            const root = document.getElementById('keysList');
            if (!keys.length) { root.innerHTML = '<div class="empty">Nenhuma chave criada.</div>'; return; }
            root.innerHTML = keys.map(key => `<div class="list-item workspace-key-row" data-id="${S.escapeHtml(key.id)}">
                <div class="grow"><div class="title">${S.escapeHtml(key.name)}</div><div class="workspace-key-code">${S.escapeHtml(key.preview)}</div><div class="meta">${Number(key.requestCount || 0)} requisições · último uso: ${S.escapeHtml(S.formatDate(key.lastUsedAt))}</div></div>
                <span class="badge ${key.active ? 'active' : 'inactive'}">${key.active ? 'Ativa' : 'Revogada'}</span>
                <div class="workspace-key-actions">
                    <button class="button small primary" data-action="${key.canReveal ? 'copy' : 'rotate'}" type="button">${key.canReveal ? 'Copiar' : 'Substituir'}</button>
                    <button class="button small" data-action="rename" type="button">Renomear</button>
                    <button class="button small" data-action="toggle" data-active="${key.active}" type="button">${key.active ? 'Revogar' : 'Reativar'}</button>
                    <button class="button small danger" data-action="delete" type="button">Excluir</button>
                </div></div>`).join('');
            root.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
                const row = button.closest('[data-id]');
                const id = row.dataset.id;
                const action = button.dataset.action;
                button.disabled = true;
                try {
                    if (action === 'copy') {
                        const result = await S.api(`/api/keys/${encodeURIComponent(id)}/reveal`);
                        try { await S.copy(result.apiKey); S.message(message, 'API key copiada.', 'success'); } catch { prompt('Copie sua API key:', result.apiKey); }
                        return;
                    }
                    if (action === 'rotate') {
                        if (!confirm('A chave antiga deixará de funcionar. Substituir agora?')) return;
                        const result = await S.api(`/api/keys/${encodeURIComponent(id)}/rotate`, { method: 'POST' });
                        try { await S.copy(result.apiKey); } catch { prompt('Copie sua nova API key:', result.apiKey); }
                        S.message(message, 'Chave substituída e copiada.', 'success');
                    } else if (action === 'rename') {
                        const name = prompt('Novo nome da chave:', row.querySelector('.title').textContent);
                        if (!name) return;
                        await S.api(`/api/keys/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } });
                    } else if (action === 'toggle') {
                        await S.api(`/api/keys/${encodeURIComponent(id)}`, { method: 'PATCH', body: { active: button.dataset.active !== 'true' } });
                    } else if (action === 'delete') {
                        if (!confirm('Excluir esta chave permanentemente?')) return;
                        await S.api(`/api/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
                    }
                    await load();
                } catch (error) { S.message(message, error.message, 'error'); }
                finally { button.disabled = false; }
            }));
        }

        document.getElementById('createKeyButton').addEventListener('click', async () => {
            const button = document.getElementById('createKeyButton');
            const name = document.getElementById('keyName').value.trim();
            if (!name) return S.message(message, 'Informe um nome para a chave.', 'error');
            button.disabled = true;
            try {
                const result = await S.api('/api/keys', { method: 'POST', body: { name } });
                try { await S.copy(result.apiKey); } catch { prompt('Copie sua API key:', result.apiKey); }
                document.getElementById('keyName').value = '';
                S.message(message, 'Chave criada e copiada.', 'success');
                await load();
            } catch (error) { S.message(message, error.message, 'error'); }
            finally { button.disabled = false; }
        });
        await load();
    }

    function initCards() {
        content(`<section class="workspace-page-grid">
            <div class="workspace-card workspace-col-6">
                <div class="workspace-card-header"><div><h2>Configuração do card</h2><p>O layout final é 1080 × 1080 e usa neon aleatório.</p></div></div>
                <div class="message" id="editorMessage"></div>
                <form id="editorForm">
                    <div class="form-group"><label for="backgroundUrl">Imagem de fundo por URL</label><input id="backgroundUrl" name="fundo_url" placeholder="https://... ou /uploads/..."></div>
                    <div class="form-group"><label for="backgroundFile">Ou envie o fundo</label><input id="backgroundFile" name="fundo_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></div>
                    <div class="form-group"><label for="avatarUrl">Avatar por URL</label><input id="avatarUrl" name="avatar_url" placeholder="https://... ou /uploads/..."></div>
                    <div class="form-group"><label for="avatarFile">Ou envie o avatar</label><input id="avatarFile" name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></div>
                    <div class="form-group"><label for="textoCima">Texto de cima</label><input id="textoCima" name="texto_cima" maxlength="160"></div>
                    <div class="form-group"><label for="textoPrincipal">Texto principal</label><textarea id="textoPrincipal" name="texto_principal" maxlength="360"></textarea></div>
                    <div class="form-group"><label for="textoBaixo">Texto de baixo</label><input id="textoBaixo" name="texto_baixo" maxlength="180"></div>
                    <button class="button primary" id="generateButton" type="submit">Gerar card</button>
                </form>
            </div>
            <div class="workspace-card workspace-col-6">
                <div class="workspace-card-header"><div><h2>Pré-visualização</h2><p>O resultado aparece aqui após a geração.</p></div></div>
                <div class="preview workspace-square-preview" id="cardPreview"><span>O card aparecerá aqui.</span></div>
                <div class="workspace-tool-actions"><a class="button primary hidden" id="cardDownload" download="card.png">Baixar</a><button class="button hidden" id="cardCopy" type="button">Copiar link</button></div>
            </div>
        </section>`);
        let currentUrl = '';
        const message = document.getElementById('editorMessage');
        document.getElementById('editorForm').addEventListener('submit', async event => {
            event.preventDefault();
            const button = document.getElementById('generateButton');
            const data = new FormData(event.currentTarget);
            if (!document.getElementById('backgroundFile').files.length) data.delete('fundo_file');
            if (!document.getElementById('avatarFile').files.length) data.delete('avatar_file');
            if (!String(data.get('fundo_url') || '').trim() && !document.getElementById('backgroundFile').files.length) return S.message(message, 'Informe uma imagem de fundo.', 'error');
            button.disabled = true; button.textContent = 'Gerando...';
            try {
                const result = await S.api('/painel/gerar', { method: 'POST', body: data });
                currentUrl = new URL(result.url, location.origin).href;
                document.getElementById('cardPreview').innerHTML = `<img src="${S.escapeHtml(result.url)}?t=${Date.now()}" alt="Card gerado">`;
                const download = document.getElementById('cardDownload'); download.href = result.url; download.classList.remove('hidden');
                document.getElementById('cardCopy').classList.remove('hidden');
                S.message(message, 'Card gerado com sucesso.', 'success');
            } catch (error) { S.message(message, error.message, 'error'); }
            finally { button.disabled = false; button.textContent = 'Gerar card'; }
        });
        document.getElementById('cardCopy').addEventListener('click', async () => { if (currentUrl) { await S.copy(currentUrl); S.message(message, 'Link copiado.', 'success'); } });
    }

    async function initUploads() {
        content(`<section class="workspace-stat-grid" id="uploadStats"><div class="workspace-stat"><strong>0</strong><span>Arquivos</span></div><div class="workspace-stat"><strong>0 B</strong><span>Espaço usado</span></div><div class="workspace-stat"><strong>—</strong><span>Último upload</span></div></section>
        <section class="workspace-card" style="margin-top:18px"><div class="workspace-card-header"><div><h2>Enviar imagem</h2><p>JPG, PNG, WEBP ou GIF.</p></div></div><div class="message" id="uploadMessage"></div><label class="dropzone" id="dropzone"><input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp,image/gif"><strong>Arraste uma imagem ou clique para escolher</strong><span class="hint">O servidor normaliza o arquivo antes de salvar.</span></label><div class="list-item hidden" id="selectedRow" style="margin-top:14px"><div class="grow"><div class="title" id="selectedName"></div><div class="meta" id="selectedMeta"></div></div><button class="button primary" id="uploadButton" type="button">Enviar</button><button class="button" id="clearButton" type="button">Limpar</button></div></section>
        <section class="workspace-card" style="margin-top:18px"><div class="workspace-card-header"><div><h2>Seus arquivos</h2><p>Copie links para reutilizar em outras ferramentas.</p></div><input type="search" id="uploadSearch" placeholder="Filtrar por nome" style="max-width:260px"></div><div class="files-grid" id="filesGrid"><div class="empty">Carregando...</div></div></section>`);
        let files = [];
        let selected = null;
        const input = document.getElementById('fileInput');
        const row = document.getElementById('selectedRow');
        const message = document.getElementById('uploadMessage');
        const dropzone = document.getElementById('dropzone');
        function select(file) { selected = file || null; row.classList.toggle('hidden', !selected); if (selected) { document.getElementById('selectedName').textContent = selected.name; document.getElementById('selectedMeta').textContent = S.formatSize(selected.size); } }
        input.addEventListener('change', () => select(input.files[0]));
        ['dragenter','dragover'].forEach(type => dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.add('dragging'); }));
        ['dragleave','drop'].forEach(type => dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.remove('dragging'); }));
        dropzone.addEventListener('drop', e => select(e.dataTransfer.files[0]));
        document.getElementById('clearButton').addEventListener('click', () => { input.value=''; select(null); });
        async function load() { const data = await S.api('/api/uploads'); files = data.uploads || []; render(); }
        function render() {
            const stats = document.querySelectorAll('#uploadStats strong');
            stats[0].textContent = files.length; stats[1].textContent = S.formatSize(files.reduce((sum,f)=>sum+Number(f.size||0),0)); stats[2].textContent = files[0] ? S.formatDate(files[0].createdAt) : '—';
            const term = document.getElementById('uploadSearch').value.trim().toLowerCase();
            const shown = files.filter(file => String(file.originalName || '').toLowerCase().includes(term));
            const root = document.getElementById('filesGrid');
            if (!shown.length) { root.innerHTML = '<div class="empty">Nenhum arquivo encontrado.</div>'; return; }
            root.innerHTML = shown.map(file => `<article class="file-card"><div class="thumb"><img src="${S.escapeHtml(file.url)}" alt="${S.escapeHtml(file.originalName)}" loading="lazy"></div><div class="info"><div class="name">${S.escapeHtml(file.originalName)}</div><div class="meta">${S.escapeHtml(S.formatSize(file.size))} · ${S.escapeHtml(S.formatDate(file.createdAt))}</div></div><div class="file-actions"><button class="button small" data-copy="${S.escapeHtml(file.url)}">Copiar link</button><button class="button small danger" data-delete="${S.escapeHtml(file.id)}">Apagar</button></div></article>`).join('');
            root.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => { await S.copy(new URL(btn.dataset.copy, location.origin).href); btn.textContent='Copiado'; setTimeout(()=>btn.textContent='Copiar link',1000); }));
            root.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => { if (!confirm('Apagar esta imagem?')) return; try { await S.api(`/api/uploads/${encodeURIComponent(btn.dataset.delete)}`, {method:'DELETE'}); await load(); } catch(error){ S.message(message,error.message,'error'); } }));
        }
        document.getElementById('uploadSearch').addEventListener('input', render);
        document.getElementById('uploadButton').addEventListener('click', async () => { if(!selected)return; const btn=document.getElementById('uploadButton'); btn.disabled=true; try { const body=new FormData(); body.append('file',selected); await S.api('/api/uploads',{method:'POST',body}); input.value='';select(null);S.message(message,'Upload concluído.','success');await load(); } catch(error){S.message(message,error.message,'error');} finally{btn.disabled=false;} });
        await load();
    }

    async function initHistory() {
        content(`<section class="workspace-card"><div class="workspace-card-header"><div><h2>Cards gerados</h2><p>Até 100 registros mais recentes da sua conta.</p></div><button class="button small" id="historyRefresh">Atualizar</button></div><div class="message" id="historyMessage"></div><div class="list" id="historyList"><div class="empty">Carregando...</div></div></section>`);
        const message = document.getElementById('historyMessage');
        async function load(){ const data=await S.api('/api/generations'); const items=data.generations||[]; const root=document.getElementById('historyList'); if(!items.length){root.innerHTML='<div class="empty">Nenhum card gerado ainda.</div>';return;} root.innerHTML=items.map(item=>`<div class="list-item" data-id="${S.escapeHtml(item.id)}"><div class="grow"><div class="title">${S.escapeHtml(item.title||'Card')}</div><div class="meta">${S.escapeHtml(S.formatDate(item.createdAt))} · ${S.escapeHtml(item.source||'painel')}</div></div><a class="button small" href="${S.escapeHtml(item.url)}" target="_blank" rel="noopener">Abrir</a><a class="button small" href="${S.escapeHtml(item.url)}" download>Baixar</a><button class="button small danger" data-delete>Excluir</button></div>`).join(''); root.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Excluir este card?'))return;try{await S.api(`/api/generations/${encodeURIComponent(btn.closest('[data-id]').dataset.id)}`,{method:'DELETE'});await load();}catch(error){S.message(message,error.message,'error');}})); }
        document.getElementById('historyRefresh').addEventListener('click',load); await load();
    }

    function formatDuration(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds || 0))); const hours=Math.floor(total/3600), minutes=Math.floor((total%3600)/60), rest=total%60; return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`:`${minutes}:${String(rest).padStart(2,'0')}`;
    }

    function initTikTok() {
        content(`<section class="workspace-page-grid"><div class="workspace-card workspace-col-5"><div class="workspace-card-header"><div><h2>Analisar TikTok</h2><p>Carregue a prévia antes de escolher baixar.</p></div></div><div class="message" id="tiktokMessage"></div><form id="tiktokForm"><div class="form-group"><label for="tiktokUrl">Link do TikTok</label><input id="tiktokUrl" type="url" placeholder="https://www.tiktok.com/@usuario/video/..." required></div><div class="form-group"><label for="tiktokType">Formato</label><select id="tiktokType"><option value="video">Vídeo MP4</option><option value="audio">Áudio MP3</option></select></div><button class="button primary" id="tiktokLoad" type="submit">Carregar mídia</button></form><p class="hint" style="margin-top:12px">Use somente conteúdo que você tenha direito ou permissão para baixar.</p></div><div class="workspace-card workspace-col-7"><div class="workspace-card-header"><div><h2>Pré-visualização</h2><p id="tiktokMetaText">Nenhuma mídia carregada.</p></div></div><div class="workspace-media-player" id="tiktokPlayer">O player aparecerá aqui.</div><div class="workspace-tool-actions"><button class="button hidden" id="tiktokCopy">Copiar link</button><a class="button primary hidden" id="tiktokDownload">Baixar</a></div></div></section>`);
        const message=document.getElementById('tiktokMessage'), type=document.getElementById('tiktokType'), player=document.getElementById('tiktokPlayer'), copy=document.getElementById('tiktokCopy'), download=document.getElementById('tiktokDownload'); let item=null,direct='';
        function render(){ if(!item)return; const audio=type.value==='audio', d=audio?item.audioUrl:item.videoUrl, stream=audio?item.audioStreamUrl:item.videoStreamUrl, dl=audio?item.audioDownloadUrl:item.videoDownloadUrl; if(!d||!stream||!dl){direct='';player.textContent=`${audio?'Áudio':'Vídeo'} não disponível.`;copy.classList.add('hidden');download.classList.add('hidden');return S.message(message,'Formato não disponível para este TikTok.','warning');} direct=d; download.href=dl;download.classList.remove('hidden');copy.classList.remove('hidden'); if(audio){player.innerHTML=`<div style="width:100%;display:grid;gap:14px;justify-items:center">${item.cover?`<img src="${S.escapeHtml(item.cover)}" alt="Capa">`:''}<audio controls preload="metadata" src="${S.escapeHtml(stream)}"></audio></div>`;}else{player.innerHTML=`<video controls playsinline preload="metadata" ${item.cover?`poster="${S.escapeHtml(item.cover)}"`:''} src="${S.escapeHtml(stream)}"></video>`;} S.message(message,'Mídia pronta para visualizar.','success'); }
        document.getElementById('tiktokForm').addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('tiktokLoad');btn.disabled=true;btn.textContent='Carregando...';try{const data=await S.api('/painel/tiktok-info',{method:'POST',body:{url:document.getElementById('tiktokUrl').value.trim()}});item=data.item;document.getElementById('tiktokMetaText').textContent=`${item.author?.username?'@'+item.author.username:'TikTok'}${item.duration?' · '+formatDuration(item.duration):''}`;if(type.value==='video'&&!item.hasVideo&&item.hasAudio)type.value='audio';if(type.value==='audio'&&!item.hasAudio&&item.hasVideo)type.value='video';render();}catch(error){S.message(message,error.message,'error');player.textContent='Não foi possível carregar a mídia.';}finally{btn.disabled=false;btn.textContent='Carregar mídia';}}); type.addEventListener('change',render); copy.addEventListener('click',async()=>{if(direct){try{await S.copy(direct);S.message(message,'Link copiado.','success');}catch{prompt('Copie o link:',direct);}}});
    }

    function parseYouTube(value) {
        const raw=String(value||'').trim(); let url; try{url=new URL(raw);}catch{throw new Error('Link do YouTube inválido.');} const host=url.hostname.toLowerCase().replace(/^www\./,''); let id=''; if(host==='youtu.be')id=url.pathname.split('/').filter(Boolean)[0]||''; else if(host==='youtube.com'||host.endsWith('.youtube.com')){if(url.pathname==='/watch')id=url.searchParams.get('v')||'';else{const parts=url.pathname.split('/').filter(Boolean);if(['shorts','embed','live'].includes(parts[0]))id=parts[1]||'';}} else throw new Error('Use um link do YouTube ou youtu.be.'); if(!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('Não foi possível identificar o vídeo.'); return{id,canonical:`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,embed:`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`};
    }

    function initYouTube() {
        content(`<section class="workspace-page-grid"><div class="workspace-card workspace-col-5"><div class="workspace-card-header"><div><h2>Abrir vídeo</h2><p>Use o player oficial incorporado.</p></div></div><div class="message" id="youtubeMessage"></div><form id="youtubeForm"><div class="form-group"><label for="youtubeUrl">Link do YouTube</label><input id="youtubeUrl" type="url" placeholder="https://www.youtube.com/watch?v=..." required></div><button class="button primary" type="submit">Carregar</button></form></div><div class="workspace-card workspace-col-7"><div class="workspace-card-header"><div><h2>Player</h2><p id="youtubeId">Nenhum vídeo carregado.</p></div></div><div class="workspace-media-player" id="youtubePlayer">O player aparecerá aqui.</div><div class="workspace-tool-actions"><button class="button hidden" id="youtubeCopy">Copiar link</button><a class="button primary hidden" id="youtubeOpen" target="_blank" rel="noopener">Abrir no YouTube</a></div></div></section>`);
        const message=document.getElementById('youtubeMessage'),player=document.getElementById('youtubePlayer'),copy=document.getElementById('youtubeCopy'),open=document.getElementById('youtubeOpen');let current=''; document.getElementById('youtubeForm').addEventListener('submit',e=>{e.preventDefault();try{const item=parseYouTube(document.getElementById('youtubeUrl').value);current=item.canonical;player.innerHTML=`<iframe src="${S.escapeHtml(item.embed)}" title="Player do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;document.getElementById('youtubeId').textContent=`ID: ${item.id}`;open.href=current;open.classList.remove('hidden');copy.classList.remove('hidden');S.message(message,'Vídeo carregado.','success');}catch(error){S.message(message,error.message,'error');}});copy.addEventListener('click',async()=>{if(current){await S.copy(current);S.message(message,'Link copiado.','success');}});
    }

    function initRoblox() {
        content(`<section class="workspace-page-grid"><div class="workspace-card workspace-col-5"><div class="workspace-card-header"><div><h2>Buscar jogador</h2><p>Somente informações públicas fornecidas pelo Roblox.</p></div></div><div class="message" id="robloxMessage"></div><form id="robloxForm"><div class="form-group"><label for="robloxQuery">Username, ID ou link do perfil</label><input id="robloxQuery" placeholder="Builderman, 156 ou link do perfil" required></div><button class="button primary" id="robloxSearch" type="submit">Buscar jogador</button></form></div><div class="workspace-card workspace-col-7"><div class="workspace-card-header"><div><h2>Perfil público</h2><p id="robloxSub">Nenhum jogador carregado.</p></div></div><div class="workspace-avatar-stage" id="robloxAvatar">O avatar aparecerá aqui.</div><div class="hidden" id="robloxProfile" style="margin-top:16px"><div class="workspace-info-grid"><div class="workspace-info"><div class="label">Display Name</div><div class="value" id="robloxDisplay"></div></div><div class="workspace-info"><div class="label">Username</div><div class="value" id="robloxUser"></div></div><div class="workspace-info"><div class="label">User ID</div><div class="value" id="robloxId"></div></div><div class="workspace-info"><div class="label">Conta criada</div><div class="value" id="robloxCreated"></div></div><div class="workspace-info"><div class="label">Verificada</div><div class="value" id="robloxVerified"></div></div><div class="workspace-info"><div class="label">Itens equipados</div><div class="value" id="robloxItems"></div></div></div><div class="workspace-info" style="margin-top:12px"><div class="label">Descrição pública</div><div class="value" id="robloxDescription" style="white-space:pre-wrap;font-weight:400"></div></div><div class="workspace-tool-actions"><a class="button primary" id="robloxOpen" target="_blank" rel="noopener">Abrir perfil</a><button class="button" id="robloxCopyId">Copiar ID</button><button class="button" id="robloxCopyUser">Copiar username</button></div></div></div></section>`);
        const message=document.getElementById('robloxMessage');let player=null;document.getElementById('robloxForm').addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('robloxSearch');btn.disabled=true;btn.textContent='Buscando...';try{const data=await S.api('/painel/roblox-user',{method:'POST',body:{username:document.getElementById('robloxQuery').value.trim()}});player=data.player;document.getElementById('robloxAvatar').innerHTML=player.avatarUrl?`<img src="${S.escapeHtml(player.avatarUrl)}" alt="Avatar de ${S.escapeHtml(player.username)}">`:'Thumbnail indisponível.';document.getElementById('robloxDisplay').textContent=player.displayName||player.username;document.getElementById('robloxUser').textContent=player.username?`@${player.username}`:'';document.getElementById('robloxId').textContent=player.id;document.getElementById('robloxCreated').textContent=player.createdAt?S.formatDate(player.createdAt):'Não informado';document.getElementById('robloxVerified').textContent=player.hasVerifiedBadge?'Sim':'Não';document.getElementById('robloxItems').textContent=Array.isArray(player.currentlyWearing)?player.currentlyWearing.length:0;document.getElementById('robloxDescription').textContent=player.description||'Sem descrição pública.';document.getElementById('robloxOpen').href=player.profileUrl;document.getElementById('robloxSub').textContent=`@${player.username}`;document.getElementById('robloxProfile').classList.remove('hidden');S.message(message,'Perfil público carregado.','success');}catch(error){S.message(message,error.message,'error');}finally{btn.disabled=false;btn.textContent='Buscar jogador';}});document.getElementById('robloxCopyId').addEventListener('click',async()=>{if(player){await S.copy(String(player.id));S.message(message,'ID copiado.','success');}});document.getElementById('robloxCopyUser').addEventListener('click',async()=>{if(player?.username){await S.copy(player.username);S.message(message,'Username copiado.','success');}});
    }

    function initMedia() {
        content(`<section class="workspace-page-grid"><div class="workspace-card workspace-col-5"><div class="workspace-card-header"><div><h2>Analisar mídia</h2><p>O download só começa depois do clique em Baixar.</p></div></div><div class="message" id="mediaMessage"></div><form id="mediaForm"><div class="form-group"><label for="mediaUrl">Link público</label><input id="mediaUrl" type="url" placeholder="https://..." required></div><div class="form-group"><label for="mediaType">Formato</label><select id="mediaType"><option value="video">Vídeo</option><option value="audio">Áudio</option></select></div><button class="button primary" id="mediaAnalyze" type="submit">Analisar</button></form><p class="hint" style="margin-top:12px">Sem login, cookies, DRM, playlists, lives ou conteúdo 18+. YouTube permanece separado.</p></div><div class="workspace-card workspace-col-7"><div class="workspace-card-header"><div><h2>Pré-visualização</h2><p id="mediaMetaText">Nenhuma mídia analisada.</p></div></div><div class="workspace-media-player" id="mediaPlayer">A mídia aparecerá aqui.</div><div class="workspace-tool-actions"><button class="button hidden" id="mediaCopy">Copiar link direto</button><a class="button primary hidden" id="mediaDownload">Baixar</a></div></div></section>`);
        const message=document.getElementById('mediaMessage'),type=document.getElementById('mediaType'),player=document.getElementById('mediaPlayer'),copy=document.getElementById('mediaCopy'),download=document.getElementById('mediaDownload');let item=null,direct='';function render(){if(!item)return;const audio=type.value==='audio',available=audio?item.hasAudio:item.hasVideo,preview=audio?item.audioPreviewUrl:item.videoPreviewUrl,dl=audio?item.audioDownloadUrl:item.videoDownloadUrl;direct=audio?item.audioDirectUrl:item.videoDirectUrl;if(!available||!dl){player.textContent='Formato não disponível.';copy.classList.add('hidden');download.classList.add('hidden');return S.message(message,'Formato não disponível para este link.','warning');}download.href=dl;download.classList.remove('hidden');copy.classList.toggle('hidden',!direct);if(preview){if(audio){player.innerHTML=`<div style="width:100%;display:grid;gap:14px;justify-items:center">${item.thumbnail?`<img src="${S.escapeHtml(item.thumbnail)}" alt="Capa">`:''}<audio controls preload="metadata" src="${S.escapeHtml(preview)}"></audio></div>`;}else{player.innerHTML=`<video controls playsinline preload="metadata" ${item.thumbnail?`poster="${S.escapeHtml(item.thumbnail)}"`:''} src="${S.escapeHtml(preview)}"></video>`;}}else{player.innerHTML=item.thumbnail?`<img src="${S.escapeHtml(item.thumbnail)}" alt="Capa">`:'Prévia indisponível; o download pode estar disponível.';}S.message(message,'Mídia analisada.','success');}document.getElementById('mediaForm').addEventListener('submit',async e=>{e.preventDefault();const btn=document.getElementById('mediaAnalyze');btn.disabled=true;btn.textContent='Analisando...';try{const data=await S.api('/painel/media-info',{method:'POST',body:{url:document.getElementById('mediaUrl').value.trim()}});item=data.item;document.getElementById('mediaMetaText').textContent=[item.title,item.uploader,item.site,item.duration?formatDuration(item.duration):''].filter(Boolean).join(' · ');if(type.value==='video'&&!item.hasVideo&&item.hasAudio)type.value='audio';if(type.value==='audio'&&!item.hasAudio&&item.hasVideo)type.value='video';render();}catch(error){S.message(message,error.message,'error');player.textContent='Não foi possível analisar a mídia.';}finally{btn.disabled=false;btn.textContent='Analisar';}});type.addEventListener('change',render);copy.addEventListener('click',async()=>{if(direct){try{await S.copy(direct);S.message(message,'Link direto copiado.','success');}catch{prompt('Copie o link:',direct);}}});
    }

    function initDocs() {
        content(`<section class="workspace-page-grid"><div class="workspace-card workspace-col-12"><div class="workspace-card-header"><div><h2>Autenticação</h2><p>Prefira o header x-api-key. Parâmetros apikey em URL podem aparecer em histórico e logs.</p></div></div><div class="endpoint"><span class="method get">HEADER</span>x-api-key: skynet_SUA_CHAVE</div></div><div class="workspace-card workspace-col-12"><div class="workspace-card-header"><div><h2>Gerar card</h2><p>O GET retorna a própria imagem PNG.</p></div></div><div class="endpoint api-example"><span class="method get">GET</span>/generate-card?avatar=LINK&amp;fundo=LINK&amp;textocima=TEXTO&amp;textopr=TEXTO&amp;textobaixo=TEXTO&amp;apikey=SUA_CHAVE</div></div><div class="workspace-card workspace-col-12"><div class="workspace-card-header"><div><h2>TikTok Downloader</h2><p>Retorna o arquivo solicitado.</p></div></div><div class="endpoint api-example"><span class="method get">GET</span>/download-tiktok?url=LINK_DO_TIKTOK&amp;tipo=video&amp;apikey=SUA_CHAVE</div><div class="endpoint api-example"><span class="method get">GET</span>/download-tiktok?url=LINK_DO_TIKTOK&amp;tipo=audio&amp;apikey=SUA_CHAVE</div></div><div class="workspace-card workspace-col-12"><div class="workspace-card-header"><div><h2>Roblox Player Lookup</h2><p>Retorna somente informações públicas do perfil.</p></div></div><div class="endpoint api-example"><span class="method get">GET</span>/roblox-user?username=Builderman&amp;apikey=SUA_CHAVE</div></div></section>`);
    }

    const INIT = { overview:initOverview, account:initAccount, keys:initKeys, cards:initCards, uploads:initUploads, history:initHistory, tiktok:initTikTok, youtube:initYouTube, roblox:initRoblox, media:initMedia, docs:initDocs };

    async function boot() {
        const path = cleanPath();
        const route = ROUTES[path] || ROUTES['/painel'];
        currentRoute = { ...route, path: ROUTES[path] ? path : '/painel' };
        try {
            currentUser = await S.session();
            if (!currentUser) {
                const next = encodeURIComponent(path.startsWith('/painel') ? path : '/painel');
                return location.replace(`/painel/login?next=${next}`);
            }
            setupShell();
            await INIT[currentRoute.key]();
        } catch (error) {
            const loading = document.getElementById('workspaceLoading');
            loading.innerHTML = `<div class="workspace-loading-mark">!</div><div>${S.escapeHtml(error.message || 'Não foi possível carregar o workspace.')}</div>`;
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
