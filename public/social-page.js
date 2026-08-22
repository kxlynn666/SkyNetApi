(() => {
    const S = window.SkyNet;
    if (!S) return;

    const SOCIAL_ROUTES = new Set(['/painel/perfil', '/painel/amigos', '/painel/chat', '/painel/conta']);
    const pathNow = () => location.pathname.replace(/\/+$/, '') || '/painel';
    let socket = null;
    let currentUser = null;
    let currentChatUser = null;
    let peer = null;
    let localStream = null;
    let callUser = null;
    let rtcConfig = null;

    function waitForWorkspace(callback) {
        const ready = () => {
            const shell = document.getElementById('workspaceShell');
            return shell && !shell.classList.contains('hidden') && document.getElementById('workspaceSidebar')?.querySelector('a');
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

    function avatar(profile, size = 46) {
        if (profile?.avatarUrl) return `<img class="social-avatar-img" src="${S.escapeHtml(profile.avatarUrl)}" alt="" style="width:${size}px;height:${size}px">`;
        const letter = String(profile?.displayName || profile?.username || '?').slice(0, 1).toUpperCase();
        return `<div class="social-avatar-fallback" style="width:${size}px;height:${size}px">${S.escapeHtml(letter)}</div>`;
    }

    function installStyles() {
        if (document.getElementById('socialWorkspaceStyles')) return;
        const style = document.createElement('style');
        style.id = 'socialWorkspaceStyles';
        style.textContent = `
            .social-avatar-img,.social-avatar-fallback{border-radius:14px;object-fit:cover;display:grid;place-items:center;background:rgba(168,85,247,.16);border:1px solid rgba(168,85,247,.28);font-weight:800;flex:0 0 auto}
            .social-profile-hero{display:grid;grid-template-columns:150px 1fr;gap:22px;align-items:center}.social-profile-hero .social-avatar-img,.social-profile-hero .social-avatar-fallback{width:150px!important;height:150px!important;border-radius:26px;font-size:42px}
            .social-profile-name{font-size:30px;font-weight:800;margin:0 0 5px}.social-handle{color:var(--text-faint);font-size:15px}.social-status{display:inline-flex;margin-top:10px;padding:6px 10px;border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:13px}
            .social-checks{display:grid;gap:10px}.social-check{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.02)}.social-check input{margin-top:3px}
            .social-user-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)}.social-user-row:last-child{border-bottom:0}.social-user-copy{min-width:0;flex:1}.social-user-copy strong{display:block}.social-user-copy span{display:block;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .social-actions{display:flex;gap:8px;flex-wrap:wrap}.social-section-gap{margin-top:18px}.social-empty{padding:22px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:14px}
            .chat-layout{display:grid;grid-template-columns:320px minmax(0,1fr);height:min(720px,calc(100vh - 190px));min-height:520px;border:1px solid var(--border);border-radius:18px;overflow:hidden;background:rgba(5,5,10,.28)}
            .chat-sidebar{border-right:1px solid var(--border);overflow:auto}.chat-side-head{padding:16px;border-bottom:1px solid var(--border)}.chat-conversation{width:100%;display:flex;gap:11px;align-items:center;padding:13px 15px;border:0;border-bottom:1px solid var(--border);background:transparent;color:inherit;text-align:left;cursor:pointer}.chat-conversation:hover,.chat-conversation.active{background:rgba(168,85,247,.08)}.chat-conversation-copy{min-width:0;flex:1}.chat-conversation-copy strong,.chat-conversation-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-conversation-copy span{font-size:12px;color:var(--muted);margin-top:3px}.chat-unread{min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--accent,#a855f7);display:grid;place-items:center;font-size:11px;font-weight:800}
            .chat-main{display:grid;grid-template-rows:auto 1fr auto;min-width:0}.chat-header{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)}.chat-header-copy{flex:1}.chat-header-copy strong,.chat-header-copy span{display:block}.chat-header-copy span{font-size:12px;color:var(--muted)}
            .chat-messages{padding:18px;overflow:auto;display:flex;flex-direction:column;gap:9px}.chat-bubble{max-width:74%;padding:10px 12px;border-radius:15px;background:rgba(255,255,255,.06);align-self:flex-start;word-wrap:break-word}.chat-bubble.mine{align-self:flex-end;background:rgba(168,85,247,.16);border:1px solid rgba(168,85,247,.22)}.chat-bubble .time{display:block;margin-top:5px;font-size:10px;color:var(--text-faint)}
            .chat-compose{display:flex;gap:10px;padding:14px;border-top:1px solid var(--border)}.chat-compose input{flex:1}.chat-placeholder{height:100%;display:grid;place-items:center;color:var(--muted);padding:30px;text-align:center}
            .call-layer{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.65);backdrop-filter:blur(12px);display:grid;place-items:center;padding:20px}.call-card{width:min(420px,100%);padding:28px;border:1px solid var(--border);border-radius:24px;background:#0d0b14;box-shadow:0 30px 100px rgba(0,0,0,.5);text-align:center}.call-card .social-avatar-img,.call-card .social-avatar-fallback{width:96px!important;height:96px!important;margin:0 auto 16px;border-radius:24px;font-size:30px}.call-card h2{margin:0 0 6px}.call-card p{margin:0 0 20px;color:var(--muted)}.call-buttons{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.call-state{font-size:12px;color:var(--text-faint);margin-top:14px}
            .account-danger{border-color:rgba(255,70,90,.24)!important}.account-danger h2{color:#ff8b99}.social-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}.social-stat{padding:14px;border:1px solid var(--border);border-radius:14px}.social-stat strong{display:block;font-size:22px}.social-stat span{font-size:12px;color:var(--muted)}
            @media(max-width:900px){.chat-layout{grid-template-columns:1fr;height:auto;min-height:0}.chat-sidebar{max-height:240px;border-right:0;border-bottom:1px solid var(--border)}.chat-main{min-height:520px}.social-profile-hero{grid-template-columns:1fr;text-align:center}.social-profile-hero .social-avatar-img,.social-profile-hero .social-avatar-fallback{margin:auto}.social-stats{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    function addNav() {
        const nav = document.querySelector('#workspaceSidebar .workspace-nav');
        if (!nav || document.getElementById('socialNavGroup')) return;
        const group = document.createElement('div');
        group.className = 'workspace-nav-group';
        group.id = 'socialNavGroup';
        const active = pathNow();
        group.innerHTML = `
            <div class="workspace-nav-label">Social</div>
            <a class="workspace-nav-link ${active === '/painel/perfil' ? 'active' : ''}" href="/painel/perfil"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span><span>Perfil</span></a>
            <a class="workspace-nav-link ${active === '/painel/amigos' ? 'active' : ''}" href="/painel/amigos"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7-4.6"/></svg></span><span>Amigos</span></a>
            <a class="workspace-nav-link ${active === '/painel/chat' ? 'active' : ''}" href="/painel/chat"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg></span><span>Chat</span></a>`;
        const firstGroup = nav.querySelector('.workspace-nav-group');
        if (firstGroup) firstGroup.insertAdjacentElement('afterend', group); else nav.prepend(group);
    }

    function setPage(kicker, title, description) {
        document.getElementById('workspaceKicker').textContent = kicker;
        document.getElementById('workspaceTitle').textContent = title;
        document.getElementById('workspaceDescription').textContent = description;
        document.title = `${title} - SkyNetApi`;
        document.querySelectorAll('.workspace-nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === pathNow()));
    }

    function root() { return document.getElementById('workspaceContent'); }

    async function loadMe() {
        const data = await S.api('/api/social/me');
        currentUser = data.account;
        return data;
    }

    async function renderProfile() {
        setPage('Social', 'Meu perfil', 'Personalize como sua conta aparece no SkyNetApi e controle sua privacidade social.');
        const [me, uploadsData] = await Promise.all([loadMe(), S.api('/api/uploads')]);
        const account = me.account;
        const profile = account.profile;
        const uploads = uploadsData.uploads || [];
        root().innerHTML = `
            <section class="workspace-page-grid">
                <div class="workspace-card workspace-col-5">
                    <div class="social-profile-hero">
                        ${avatar({ ...profile, username: account.username, avatarUrl: account.avatarUrl }, 150)}
                        <div><h2 class="social-profile-name">${S.escapeHtml(profile.displayName)}</h2><div class="social-handle">@${S.escapeHtml(account.username)}</div>${profile.status ? `<div class="social-status">${S.escapeHtml(profile.status)}</div>` : ''}</div>
                    </div>
                    <div class="social-stats"><div class="social-stat"><strong>${me.stats.friendCount}</strong><span>Amigos</span></div><div class="social-stat"><strong>${me.stats.messageCount}</strong><span>Mensagens</span></div><div class="social-stat"><strong>${me.stats.points}</strong><span>Pontos</span></div></div>
                    <div class="workspace-tool-actions"><a class="button" href="/u/${encodeURIComponent(account.username)}" target="_blank" rel="noopener">Ver perfil público</a></div>
                </div>
                <div class="workspace-card workspace-col-7">
                    <div class="workspace-card-header"><div><h2>Editar perfil</h2><p>O avatar público usa somente imagens da sua biblioteca de uploads.</p></div></div>
                    <div class="message" id="profileMessage"></div>
                    <form id="profileForm">
                        <div class="form-group"><label>Nome de exibição</label><input name="displayName" maxlength="50" value="${S.escapeHtml(profile.displayName)}"></div>
                        <div class="form-group"><label>Status / frase curta</label><input name="status" maxlength="60" value="${S.escapeHtml(profile.status)}" placeholder="Disponível, criando algo novo..."></div>
                        <div class="form-group"><label>Bio</label><textarea name="bio" maxlength="320">${S.escapeHtml(profile.bio)}</textarea></div>
                        <div class="form-group"><label>Avatar</label><select name="avatarUploadId"><option value="">Sem avatar</option>${uploads.map(item => `<option value="${S.escapeHtml(item.id)}" ${profile.avatarUploadId === item.id ? 'selected' : ''}>${S.escapeHtml(item.originalName)}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Privacidade</label><div class="social-checks">
                            ${check('allowFriendRequests', 'Aceitar solicitações de amizade', 'Outras contas podem enviar pedidos de amizade.', profile.privacy.allowFriendRequests)}
                            ${check('allowCallsFromFriends', 'Aceitar chamadas de voz', 'Somente amigos aceitos poderão chamar você.', profile.privacy.allowCallsFromFriends)}
                            ${check('showOnline', 'Mostrar quando estou online', 'Seu status online aparece apenas para amigos.', profile.privacy.showOnline)}
                            ${check('showOnPodium', 'Participar do pódio', 'Seu perfil pode aparecer entre os 3 membros com mais pontos de atividade.', profile.privacy.showOnPodium)}
                        </div></div>
                        <button class="button primary" type="submit">Salvar perfil</button>
                    </form>
                </div>
            </section>`;
        const message = document.getElementById('profileMessage');
        document.getElementById('profileForm').addEventListener('submit', async event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const body = {
                displayName: form.get('displayName'), status: form.get('status'), bio: form.get('bio'), avatarUploadId: form.get('avatarUploadId'),
                privacy: {
                    allowFriendRequests: form.get('allowFriendRequests') === 'on',
                    allowCallsFromFriends: form.get('allowCallsFromFriends') === 'on',
                    showOnline: form.get('showOnline') === 'on',
                    showOnPodium: form.get('showOnPodium') === 'on'
                }
            };
            try { await S.api('/api/social/account/profile', { method: 'PATCH', body }); S.message(message, 'Perfil atualizado.', 'success'); setTimeout(renderProfile, 350); }
            catch (error) { S.message(message, error.message, 'error'); }
        });
    }

    function check(name, title, description, checked) {
        return `<label class="social-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span><strong>${title}</strong><br><span class="hint">${description}</span></span></label>`;
    }

    async function renderAccount() {
        setPage('Conta', 'Conta e segurança', 'Gerencie usuário, senha, sessões e exclusão da conta.');
        const me = await loadMe();
        const account = me.account;
        root().innerHTML = `
            <section class="workspace-page-grid">
                <div class="workspace-card workspace-col-6"><div class="workspace-card-header"><div><h2>Conta</h2><p>Dados e acesso atual.</p></div></div><div class="workspace-info-grid">
                    <div class="workspace-info"><div class="label">Usuário</div><div class="value">@${S.escapeHtml(account.username)}</div></div>
                    <div class="workspace-info"><div class="label">Criada em</div><div class="value">${S.escapeHtml(S.formatDate(account.createdAt))}</div></div>
                    <div class="workspace-info"><div class="label">Último login</div><div class="value">${S.escapeHtml(S.formatDate(account.lastLoginAt))}</div></div>
                    <div class="workspace-info"><div class="label">Tipo</div><div class="value">${account.isAdmin ? 'Administrador' : 'Usuário'}</div></div>
                </div><div class="workspace-tool-actions"><a class="button" href="/painel/perfil">Editar perfil</a></div></div>
                <div class="workspace-card workspace-col-6"><div class="workspace-card-header"><div><h2>Alterar usuário</h2><p>Seu link público também mudará.</p></div></div><div class="message" id="usernameMessage"></div><form id="usernameForm"><div class="form-group"><label>Novo usuário</label><input name="username" minlength="3" maxlength="30" value="${S.escapeHtml(account.username)}" required></div><div class="form-group"><label>Senha atual</label><input name="password" type="password" required></div><button class="button primary">Alterar usuário</button></form></div>
                <div class="workspace-card workspace-col-6"><div class="workspace-card-header"><div><h2>Alterar senha</h2><p>Ao alterar, todas as sessões serão encerradas.</p></div></div><div class="message" id="passwordMessage"></div><form id="passwordForm"><div class="form-group"><label>Senha atual</label><input name="currentPassword" type="password" required></div><div class="form-group"><label>Nova senha</label><input name="newPassword" type="password" minlength="8" maxlength="128" required></div><div class="form-group"><label>Confirmar nova senha</label><input name="confirmPassword" type="password" required></div><button class="button primary">Atualizar senha</button></form></div>
                <div class="workspace-card workspace-col-6"><div class="workspace-card-header"><div><h2>Sessões</h2><p>Desconecte todos os dispositivos que usam esta conta.</p></div></div><button class="button" id="logoutAll">Sair de todos os dispositivos</button></div>
                <div class="workspace-card workspace-col-12 account-danger"><div class="workspace-card-header"><div><h2>Excluir conta</h2><p>Remove perfil, amizades, mensagens, uploads, cards, API keys e sessões. Esta ação não pode ser desfeita.</p></div></div><div class="message" id="deleteAccountMessage"></div><form id="deleteAccountForm" style="max-width:520px"><div class="form-group"><label>Digite sua senha para confirmar</label><input name="password" type="password" required></div><button class="button danger">Excluir minha conta permanentemente</button></form></div>
            </section>`;

        document.getElementById('usernameForm').addEventListener('submit', async event => {
            event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const msg = document.getElementById('usernameMessage');
            try { await S.api('/api/social/account/username', { method: 'POST', body: data }); S.message(msg, 'Usuário alterado.', 'success'); setTimeout(() => location.reload(), 500); } catch (error) { S.message(msg, error.message, 'error'); }
        });
        document.getElementById('passwordForm').addEventListener('submit', async event => {
            event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const msg = document.getElementById('passwordMessage');
            if (data.newPassword !== data.confirmPassword) return S.message(msg, 'As novas senhas não coincidem.', 'error');
            try { await S.api('/api/social/account/password', { method: 'POST', body: data }); location.replace('/painel/login'); } catch (error) { S.message(msg, error.message, 'error'); }
        });
        document.getElementById('logoutAll').addEventListener('click', async () => { if (!confirm('Encerrar todas as sessões?')) return; await S.api('/api/social/account/logout-all', { method: 'POST' }); location.replace('/painel/login'); });
        document.getElementById('deleteAccountForm').addEventListener('submit', async event => {
            event.preventDefault(); const msg = document.getElementById('deleteAccountMessage');
            if (!confirm('Excluir permanentemente sua conta e todos os dados?')) return;
            try { await S.api('/api/social/account', { method: 'DELETE', body: Object.fromEntries(new FormData(event.currentTarget)) }); location.replace('/'); } catch (error) { S.message(msg, error.message, 'error'); }
        });
    }

    async function renderFriends() {
        setPage('Social', 'Amigos', 'Encontre contas, gerencie solicitações, amizades e bloqueios.');
        root().innerHTML = `
            <section class="workspace-card"><div class="workspace-card-header"><div><h2>Encontrar pessoas</h2><p>Busque por username ou nome de exibição.</p></div></div><div class="message" id="friendMessage"></div><div class="toolbar"><input id="friendSearch" placeholder="Buscar usuário..." minlength="2"><button class="button primary" id="friendSearchButton">Buscar</button></div><div id="friendSearchResults" class="social-section-gap"></div></section>
            <section class="workspace-page-grid social-section-gap"><div class="workspace-card workspace-col-6"><div class="workspace-card-header"><div><h2>Meus amigos</h2></div></div><div id="friendsList"></div></div><div class="workspace-card workspace-col-6"><div class="workspace-card-header"><div><h2>Solicitações recebidas</h2></div></div><div id="incomingList"></div></div><div class="workspace-card workspace-col-6"><div class="workspace-card-header"><div><h2>Solicitações enviadas</h2></div></div><div id="outgoingList"></div></div><div class="workspace-card workspace-col-6"><div class="workspace-card-header"><div><h2>Bloqueados</h2></div></div><div id="blockedList"></div></div></section>`;
        const message = document.getElementById('friendMessage');
        async function refresh() {
            const data = await S.api('/api/social/friends');
            listUsers('friendsList', data.friends, user => `<a class="button small" href="/painel/chat?with=${encodeURIComponent(user.id)}">Chat</a><button class="button small" data-action="remove" data-id="${user.id}">Remover</button><button class="button small danger" data-action="block" data-id="${user.id}">Bloquear</button>`);
            listUsers('incomingList', data.incoming, user => `<button class="button small primary" data-action="accept" data-request="${user.requestId}">Aceitar</button><button class="button small" data-action="reject" data-request="${user.requestId}">Recusar</button>`);
            listUsers('outgoingList', data.outgoing, user => `<button class="button small" data-action="reject" data-request="${user.requestId}">Cancelar</button>`);
            listUsers('blockedList', data.blocked, user => `<button class="button small" data-action="unblock" data-id="${user.id}">Desbloquear</button>`);
            bindFriendActions(refresh, message);
        }
        document.getElementById('friendSearchButton').addEventListener('click', search);
        document.getElementById('friendSearch').addEventListener('keydown', event => { if (event.key === 'Enter') search(); });
        async function search() {
            const q = document.getElementById('friendSearch').value.trim(); if (q.length < 2) return S.message(message, 'Digite pelo menos 2 caracteres.', 'error');
            try {
                const data = await S.api(`/api/social/users?q=${encodeURIComponent(q)}`);
                const box = document.getElementById('friendSearchResults');
                if (!data.users.length) box.innerHTML = '<div class="social-empty">Nenhum usuário encontrado.</div>';
                else box.innerHTML = data.users.map(user => userRow(user, relationshipButton(user))).join('');
                bindFriendActions(refresh, message);
            } catch (error) { S.message(message, error.message, 'error'); }
        }
        await refresh();
    }

    function listUsers(id, users, actions) {
        const el = document.getElementById(id);
        el.innerHTML = users?.length ? users.map(user => userRow(user, actions(user))).join('') : '<div class="social-empty">Nada por aqui.</div>';
    }
    function userRow(user, actions = '') {
        return `<div class="social-user-row">${avatar(user)}<div class="social-user-copy"><strong>${S.escapeHtml(user.displayName || user.username)}</strong><span>@${S.escapeHtml(user.username)}${user.online ? ' · online' : ''}${user.status ? ` · ${S.escapeHtml(user.status)}` : ''}</span></div><div class="social-actions">${actions}</div></div>`;
    }
    function relationshipButton(user) {
        const type = user.relationship?.type;
        if (type === 'friend') return `<a class="button small" href="/painel/chat?with=${encodeURIComponent(user.id)}">Chat</a>`;
        if (type === 'incoming') return `<button class="button small primary" data-action="accept" data-request="${user.relationship.id}">Aceitar</button>`;
        if (type === 'outgoing') return `<button class="button small" disabled>Solicitação enviada</button>`;
        if (type === 'blocked') return `<button class="button small" data-action="unblock" data-id="${user.id}">Desbloquear</button>`;
        if (type === 'unavailable') return `<button class="button small" disabled>Indisponível</button>`;
        return `<button class="button small primary" data-action="request" data-id="${user.id}">Adicionar</button>`;
    }
    function bindFriendActions(refresh, message) {
        document.querySelectorAll('[data-action]').forEach(button => {
            if (button.dataset.bound) return; button.dataset.bound = '1';
            button.addEventListener('click', async () => {
                button.disabled = true;
                try {
                    const action = button.dataset.action;
                    if (action === 'request') await S.api('/api/social/friends/request', { method: 'POST', body: { userId: button.dataset.id } });
                    if (action === 'accept') await S.api(`/api/social/friends/${encodeURIComponent(button.dataset.request)}/accept`, { method: 'POST' });
                    if (action === 'reject') await S.api(`/api/social/friends/${encodeURIComponent(button.dataset.request)}/reject`, { method: 'POST' });
                    if (action === 'remove') { if (!confirm('Remover esta amizade?')) return; await S.api(`/api/social/friends/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' }); }
                    if (action === 'block') { if (!confirm('Bloquear esta conta? A amizade será removida.')) return; await S.api('/api/social/block', { method: 'POST', body: { userId: button.dataset.id } }); }
                    if (action === 'unblock') await S.api(`/api/social/block/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' });
                    S.message(message, 'Atualizado.', 'success');
                    await refresh();
                } catch (error) { S.message(message, error.message, 'error'); }
                finally { button.disabled = false; }
            });
        });
    }

    async function renderChat() {
        setPage('Social', 'Chat', 'Converse em privado e faça chamadas de voz com seus amigos.');
        await loadMe();
        root().innerHTML = `<div class="chat-layout"><aside class="chat-sidebar"><div class="chat-side-head"><strong>Conversas</strong><div class="hint">Somente amigos aceitos</div></div><div id="conversationList"></div></aside><section class="chat-main" id="chatMain"><div class="chat-placeholder">Selecione um amigo para começar a conversar.</div></section></div>`;
        const data = await loadConversations();
        const requested = new URLSearchParams(location.search).get('with');
        const first = data.conversations.find(item => item.user.id === requested) || data.conversations[0];
        if (first) await openConversation(first.user);
    }

    async function loadConversations() {
        const data = await S.api('/api/social/conversations');
        const list = document.getElementById('conversationList');
        if (!list) return data;
        list.innerHTML = data.conversations.length ? data.conversations.map(item => `<button class="chat-conversation ${currentChatUser?.id === item.user.id ? 'active' : ''}" data-user="${item.user.id}">${avatar(item.user, 42)}<span class="chat-conversation-copy"><strong>${S.escapeHtml(item.user.displayName)}</strong><span>${item.lastMessage ? S.escapeHtml(item.lastMessage.text) : 'Inicie uma conversa'}</span></span>${item.unreadCount ? `<span class="chat-unread">${item.unreadCount}</span>` : ''}</button>`).join('') : '<div class="social-empty" style="margin:14px">Adicione amigos para conversar.</div>';
        list.querySelectorAll('[data-user]').forEach(button => button.addEventListener('click', () => {
            const item = data.conversations.find(entry => entry.user.id === button.dataset.user); if (item) openConversation(item.user);
        }));
        return data;
    }

    async function openConversation(user) {
        currentChatUser = user;
        const main = document.getElementById('chatMain');
        main.innerHTML = `<header class="chat-header">${avatar(user, 44)}<div class="chat-header-copy"><strong>${S.escapeHtml(user.displayName)}</strong><span>@${S.escapeHtml(user.username)}${user.online ? ' · online' : ''}</span></div><button class="button small primary" id="startCall">Chamar</button><a class="button small" href="/u/${encodeURIComponent(user.username)}" target="_blank">Perfil</a></header><div class="chat-messages" id="chatMessages"><div class="social-empty">Carregando mensagens...</div></div><form class="chat-compose" id="chatForm"><input id="chatInput" maxlength="2000" autocomplete="off" placeholder="Digite uma mensagem..."><button class="button primary">Enviar</button></form>`;
        document.getElementById('startCall').addEventListener('click', () => startOutgoingCall(user));
        document.getElementById('chatForm').addEventListener('submit', sendMessage);
        await loadMessages();
        await S.api(`/api/social/messages/${encodeURIComponent(user.id)}/read`, { method: 'POST' }).catch(() => {});
        await loadConversations();
        history.replaceState(null, '', `/painel/chat?with=${encodeURIComponent(user.id)}`);
    }

    async function loadMessages() {
        if (!currentChatUser) return;
        const data = await S.api(`/api/social/messages/${encodeURIComponent(currentChatUser.id)}?limit=80`);
        const box = document.getElementById('chatMessages');
        if (!box) return;
        box.innerHTML = data.messages.length ? data.messages.map(messageBubble).join('') : '<div class="social-empty">Nenhuma mensagem ainda.</div>';
        box.scrollTop = box.scrollHeight;
    }
    function messageBubble(message) {
        const mine = message.fromId === currentUser?.id;
        return `<div class="chat-bubble ${mine ? 'mine' : ''}" data-message-id="${message.id}">${S.escapeHtml(message.text)}<span class="time">${S.escapeHtml(S.formatDate(message.createdAt))}${mine ? ` · <button class="link-button" data-delete-message="${message.id}" type="button">apagar</button>` : ''}</span></div>`;
    }
    async function sendMessage(event) {
        event.preventDefault(); if (!currentChatUser) return;
        const input = document.getElementById('chatInput'); const text = input.value.trim(); if (!text) return;
        input.value = '';
        try { await S.api(`/api/social/messages/${encodeURIComponent(currentChatUser.id)}`, { method: 'POST', body: { text } }); }
        catch (error) { alert(error.message); input.value = text; }
    }

    function setupSocket() {
        if (!window.io || socket) return;
        socket = window.io({ path: '/socket.io', transports: ['websocket', 'polling'] });
        socket.on('chat:message', async ({ message }) => {
            if (pathNow() === '/painel/chat' && currentChatUser && (message.fromId === currentChatUser.id || message.toId === currentChatUser.id)) {
                await loadMessages();
                if (message.fromId === currentChatUser.id) await S.api(`/api/social/messages/${encodeURIComponent(currentChatUser.id)}/read`, { method: 'POST' }).catch(() => {});
            }
            if (pathNow() === '/painel/chat') loadConversations().catch(() => {});
        });
        socket.on('chat:deleted', ({ messageId }) => document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)?.remove());
        socket.on('social:presence', ({ userId, online }) => {
            if (currentChatUser?.id === userId) { currentChatUser.online = online; if (pathNow() === '/painel/chat') openConversation(currentChatUser).catch(() => {}); }
        });
        socket.on('friend:request', () => { if (pathNow() === '/painel/amigos') renderFriends().catch(() => {}); });
        socket.on('friend:accepted', () => { if (pathNow() === '/painel/amigos') renderFriends().catch(() => {}); if (pathNow() === '/painel/chat') loadConversations().catch(() => {}); });
        socket.on('call:incoming', ({ from }) => showIncomingCall(from));
        socket.on('call:ringing', () => updateCallState('Chamando...'));
        socket.on('call:accepted', async ({ by }) => { if (!callUser || callUser.id !== by) return; updateCallState('Conectando...'); await ensurePeer(); const offer = await peer.createOffer(); await peer.setLocalDescription(offer); socket.emit('rtc:offer', { to: callUser.id, data: offer }); });
        socket.on('call:rejected', () => finishCall('Chamada recusada.'));
        socket.on('call:ended', ({ reason }) => finishCall(reason || 'Chamada encerrada.'));
        socket.on('call:error', ({ error }) => finishCall(error || 'Não foi possível iniciar a chamada.'));
        socket.on('rtc:offer', async ({ from, data }) => { if (!callUser || callUser.id !== from) return; await ensurePeer(); await peer.setRemoteDescription(data); const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); socket.emit('rtc:answer', { to: from, data: answer }); });
        socket.on('rtc:answer', async ({ from, data }) => { if (callUser?.id === from && peer) await peer.setRemoteDescription(data); });
        socket.on('rtc:ice', async ({ from, data }) => { if (callUser?.id === from && peer && data) try { await peer.addIceCandidate(data); } catch {} });
        socket.on('connect_error', error => console.warn('Social realtime:', error.message));
    }

    async function startOutgoingCall(user) {
        if (!socket?.connected) return alert('O serviço de chamada não está conectado.');
        try {
            callUser = user;
            await getLocalAudio();
            showCallLayer(user, 'Chamando...', false);
            socket.emit('call:invite', { to: user.id });
        } catch (error) { finishCall(error.message || 'Não foi possível acessar o microfone.'); }
    }

    function showIncomingCall(user) {
        if (callUser) { socket?.emit('call:reject', { to: user.id }); return; }
        callUser = user;
        showCallLayer(user, 'Chamada de voz recebida', true);
    }

    function showCallLayer(user, state, incoming) {
        document.getElementById('callLayer')?.remove();
        const layer = document.createElement('div');
        layer.className = 'call-layer'; layer.id = 'callLayer';
        layer.innerHTML = `<div class="call-card">${avatar(user, 96)}<h2>${S.escapeHtml(user.displayName || user.username)}</h2><p>@${S.escapeHtml(user.username)}</p><div class="call-buttons">${incoming ? '<button class="button primary" id="callAccept">Atender</button><button class="button danger" id="callReject">Recusar</button>' : '<button class="button" id="callMute">Silenciar</button><button class="button danger" id="callHangup">Encerrar</button>'}</div><div class="call-state" id="callState">${S.escapeHtml(state)}</div><audio id="remoteAudio" autoplay></audio></div>`;
        document.body.appendChild(layer);
        if (incoming) {
            document.getElementById('callAccept').addEventListener('click', async () => {
                try { await getLocalAudio(); await ensurePeer(); replaceCallButtons(); socket.emit('call:accept', { to: user.id }); updateCallState('Conectando...'); }
                catch (error) { socket.emit('call:reject', { to: user.id }); finishCall(error.message || 'Microfone indisponível.'); }
            });
            document.getElementById('callReject').addEventListener('click', () => { socket.emit('call:reject', { to: user.id }); finishCall(); });
        } else bindActiveCallButtons();
    }

    function replaceCallButtons() {
        const box = document.querySelector('#callLayer .call-buttons'); if (!box) return;
        box.innerHTML = '<button class="button" id="callMute">Silenciar</button><button class="button danger" id="callHangup">Encerrar</button>';
        bindActiveCallButtons();
    }
    function bindActiveCallButtons() {
        document.getElementById('callHangup')?.addEventListener('click', () => { if (callUser) socket?.emit('call:end', { to: callUser.id }); finishCall(); });
        document.getElementById('callMute')?.addEventListener('click', event => {
            const track = localStream?.getAudioTracks()?.[0]; if (!track) return; track.enabled = !track.enabled; event.currentTarget.textContent = track.enabled ? 'Silenciar' : 'Ativar microfone';
        });
    }
    function updateCallState(text) { const el = document.getElementById('callState'); if (el) el.textContent = text; }

    async function getLocalAudio() {
        if (localStream) return localStream;
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Seu navegador não oferece captura de microfone.');
        localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        return localStream;
    }
    async function getRtcConfig() {
        if (rtcConfig) return rtcConfig;
        const data = await S.api('/api/social/rtc-config'); rtcConfig = { iceServers: data.iceServers || [] }; return rtcConfig;
    }
    async function ensurePeer() {
        if (peer) return peer;
        const config = await getRtcConfig();
        peer = new RTCPeerConnection(config);
        localStream?.getTracks().forEach(track => peer.addTrack(track, localStream));
        peer.onicecandidate = event => { if (event.candidate && callUser) socket.emit('rtc:ice', { to: callUser.id, data: event.candidate }); };
        peer.ontrack = event => { const audio = document.getElementById('remoteAudio'); if (audio) { audio.srcObject = event.streams[0]; audio.play().catch(() => {}); } };
        peer.onconnectionstatechange = () => { if (peer?.connectionState === 'connected') updateCallState('Em chamada'); if (['failed', 'closed'].includes(peer?.connectionState)) finishCall('Chamada encerrada.'); };
        return peer;
    }
    function finishCall(message = '') {
        if (peer) { try { peer.close(); } catch {} peer = null; }
        if (localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
        callUser = null;
        const layer = document.getElementById('callLayer');
        if (layer && message) { updateCallState(message); setTimeout(() => layer.remove(), 1200); } else layer?.remove();
    }

    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-delete-message]'); if (!button) return;
        if (!confirm('Apagar esta mensagem?')) return;
        try { await S.api(`/api/social/messages/item/${encodeURIComponent(button.dataset.deleteMessage)}`, { method: 'DELETE' }); button.closest('[data-message-id]')?.remove(); } catch (error) { alert(error.message); }
    });

    async function boot() {
        installStyles(); addNav(); setupSocket();
        const path = pathNow();
        if (!SOCIAL_ROUTES.has(path)) return;
        try {
            if (path === '/painel/perfil') await renderProfile();
            else if (path === '/painel/amigos') await renderFriends();
            else if (path === '/painel/chat') await renderChat();
            else if (path === '/painel/conta') await renderAccount();
        } catch (error) { root().innerHTML = `<div class="workspace-card"><div class="message show error">${S.escapeHtml(error.message || 'Não foi possível carregar a área social.')}</div></div>`; }
    }

    waitForWorkspace(boot);
})();
