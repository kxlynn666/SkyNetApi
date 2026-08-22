(() => {
    const S = window.SkyNet;
    if (!S) return;
    let users = [];

    function installStyles() {
        if (document.getElementById('adminExtendedStyles')) return;
        const style = document.createElement('style');
        style.id = 'adminExtendedStyles';
        style.textContent = `
            .admin-user-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.admin-user-card{padding:16px;border:1px solid var(--border);border-radius:16px;background:rgba(255,255,255,.025)}.admin-user-head{display:flex;gap:12px;align-items:center}.admin-user-head .grow{min-width:0;flex:1}.admin-user-head strong,.admin-user-head span{display:block}.admin-user-head span{font-size:12px;color:var(--muted)}.admin-user-level{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:rgba(168,85,247,.13);border:1px solid rgba(168,85,247,.25);font-weight:900}.admin-user-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.admin-user-stat{padding:9px;border:1px solid var(--border);border-radius:11px}.admin-user-stat strong,.admin-user-stat span{display:block}.admin-user-stat strong{font-size:14px}.admin-user-stat span{font-size:10px;color:var(--muted)}
            .admin-modal{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.72);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px}.admin-modal-card{width:min(980px,100%);max-height:92vh;overflow:auto;background:#0b0b12;border:1px solid var(--border);border-radius:22px;padding:22px}.admin-modal-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}.admin-modal-head .grow{flex:1}.admin-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.admin-edit-grid .form-group{margin:0}.admin-span-2{grid-column:1/-1}.admin-checks{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.admin-check{display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid var(--border);border-radius:12px}.admin-security-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.admin-xp-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.admin-xp-box{padding:12px;border:1px solid var(--border);border-radius:12px}.admin-xp-box strong,.admin-xp-box span{display:block}.admin-xp-box span{font-size:11px;color:var(--muted)}@media(max-width:760px){.admin-edit-grid,.admin-checks,.admin-xp-strip{grid-template-columns:1fr}.admin-span-2{grid-column:auto}}
        `;
        document.head.appendChild(style);
    }

    async function boot() {
        try {
            const session = await S.session();
            if (!session?.isAdmin) return;
        } catch { return; }
        installStyles();
        waitForAdmin(() => {
            addTab();
            loadUsers();
        });
    }

    function waitForAdmin(callback) {
        const ready = () => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && document.querySelector('.tabs');
        if (ready()) return callback();
        const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); callback(); } });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    function addTab() {
        if (document.querySelector('[data-tab="advancedUsers"]')) return;
        const tabs = document.querySelector('.tabs');
        const button = document.createElement('button');
        button.className = 'tab';
        button.type = 'button';
        button.dataset.tab = 'advancedUsers';
        button.textContent = 'Usuários avançado';
        tabs.appendChild(button);

        const panel = document.createElement('section');
        panel.className = 'tab-panel';
        panel.id = 'advancedUsers';
        panel.innerHTML = `<div class="card"><div class="toolbar"><h2 class="card-title" style="margin:0 auto 0 0">Editor completo de usuários</h2><input type="search" id="advancedUserSearch" placeholder="Buscar usuário"><button class="button small" id="advancedRefresh">Atualizar</button></div><div class="message" id="advancedMessage"></div><div id="advancedUsersWrap"><div class="empty">Carregando...</div></div></div>`;
        tabs.parentElement.appendChild(panel);

        document.querySelectorAll('.tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tabs .tab').forEach(item => item.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(item => item.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab)?.classList.add('active');
            });
        });
        document.getElementById('advancedUserSearch').addEventListener('input', renderUsers);
        document.getElementById('advancedRefresh').addEventListener('click', loadUsers);
    }

    async function loadUsers() {
        try {
            const data = await S.api('/api/admin/users/full');
            users = data.users || [];
            renderUsers();
        } catch (error) {
            S.message(document.getElementById('advancedMessage'), error.message, 'error');
        }
    }

    function renderUsers() {
        const root = document.getElementById('advancedUsersWrap');
        if (!root) return;
        const term = String(document.getElementById('advancedUserSearch')?.value || '').trim().toLowerCase();
        const shown = users.filter(user => `${user.username} ${user.profile?.displayName || ''} ${user.id}`.toLowerCase().includes(term));
        if (!shown.length) return root.innerHTML = '<div class="empty">Nenhum usuário encontrado.</div>';
        root.innerHTML = `<div class="admin-user-grid">${shown.map(user => `
            <article class="admin-user-card" data-user-id="${S.escapeHtml(user.id)}">
                <div class="admin-user-head"><div class="admin-user-level">${Number(user.xp?.level || 1)}</div><div class="grow"><strong>${S.escapeHtml(user.profile?.displayName || user.username)}</strong><span>@${S.escapeHtml(user.username)} · ${S.escapeHtml(user.id.slice(0,12))}</span></div><span class="badge ${user.active ? 'active' : 'inactive'}">${user.active ? 'Ativa' : 'Inativa'}</span></div>
                <div class="admin-user-stats"><div class="admin-user-stat"><strong>${Number(user.xp?.totalXp || 0).toLocaleString('pt-BR')}</strong><span>XP</span></div><div class="admin-user-stat"><strong>${Number(user.stats?.apiRequests || 0).toLocaleString('pt-BR')}</strong><span>requisições</span></div><div class="admin-user-stat"><strong>${Number(user.stats?.messages || 0).toLocaleString('pt-BR')}</strong><span>mensagens</span></div></div>
                <button class="button primary" data-edit-user="${S.escapeHtml(user.id)}" type="button">Editar usuário</button>
            </article>`).join('')}</div>`;
        root.querySelectorAll('[data-edit-user]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.editUser)));
    }

    function openEditor(id) {
        const user = users.find(item => item.id === id);
        if (!user) return;
        document.getElementById('adminUserModal')?.remove();
        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.id = 'adminUserModal';
        const p = user.profile || {};
        const privacy = p.privacy || {};
        modal.innerHTML = `<div class="admin-modal-card">
            <div class="admin-modal-head"><div class="grow"><div class="eyebrow">Administração avançada</div><h2 style="margin:4px 0 0">${S.escapeHtml(p.displayName || user.username)}</h2><div class="text-faint mono">${S.escapeHtml(user.id)}</div></div><button class="button" id="adminModalClose">Fechar</button></div>
            <div class="message" id="adminEditMessage"></div>
            <div class="admin-xp-strip"><div class="admin-xp-box"><strong>Level ${Number(user.xp?.level || 1)}</strong><span>level atual</span></div><div class="admin-xp-box"><strong>${Number(user.xp?.totalXp || 0).toLocaleString('pt-BR')} XP</strong><span>XP total</span></div><div class="admin-xp-box"><strong>${Number(user.xp?.activeMinutes || 0).toLocaleString('pt-BR')}</strong><span>minutos ativos</span></div><div class="admin-xp-box"><strong>${Number(user.stats?.sessions || 0)}</strong><span>sessões ativas</span></div></div>
            <form id="adminEditForm" class="admin-edit-grid">
                <div class="form-group"><label>Username</label><input name="username" value="${S.escapeHtml(user.username)}" maxlength="30"></div>
                <div class="form-group"><label>Nome de exibição</label><input name="displayName" value="${S.escapeHtml(p.displayName || '')}" maxlength="50"></div>
                <div class="form-group"><label>Status</label><input name="status" value="${S.escapeHtml(p.status || '')}" maxlength="60"></div>
                <div class="form-group"><label>Avatar upload ID</label><input name="avatarUploadId" value="${S.escapeHtml(p.avatarUploadId || '')}" maxlength="80"></div>
                <div class="form-group admin-span-2"><label>Bio</label><textarea name="bio" maxlength="320">${S.escapeHtml(p.bio || '')}</textarea></div>
                <div class="form-group"><label>Criada em</label><input name="createdAt" type="datetime-local" value="${toLocalInput(user.createdAt)}"></div>
                <div class="form-group"><label>Último login</label><input name="lastLoginAt" type="datetime-local" value="${toLocalInput(user.lastLoginAt)}"></div>
                <div class="form-group"><label>XP total desejado</label><input name="targetXp" type="number" min="0" max="1000000000" value="${Number(user.xp?.totalXp || 0)}"></div>
                <div class="form-group"><label>Level desejado</label><input name="targetLevel" type="number" min="1" max="10000" value="${Number(user.xp?.level || 1)}"><div class="hint">Ao salvar, XP total tem prioridade. Apague o campo XP para definir pelo level.</div></div>
                <div class="form-group"><label>Minutos ativos</label><input name="activeMinutes" type="number" min="0" max="10000000" value="${Number(user.xp?.activeMinutes || 0)}"></div>
                <div class="form-group"><label>Ajuste manual de XP</label><input name="xpAdjustment" type="number" min="-100000000" max="100000000" value="${Number(user.xp?.xpAdjustment || 0)}"></div>
                <div class="form-group admin-span-2"><label>Nota administrativa</label><textarea name="adminNote" maxlength="1000">${S.escapeHtml(user.adminNote || '')}</textarea></div>
                <div class="form-group admin-span-2"><label>Permissões e privacidade</label><div class="admin-checks">
                    ${check('active','Conta ativa',user.active)}${check('isAdmin','Administrador',user.isAdmin)}${check('allowFriendRequests','Permitir amizades',privacy.allowFriendRequests !== false)}${check('allowCallsFromFriends','Permitir chamadas',privacy.allowCallsFromFriends !== false)}${check('showOnPodium','Exibir no pódio',privacy.showOnPodium !== false)}${check('showOnline','Mostrar online',privacy.showOnline !== false)}
                </div></div>
                <div class="admin-span-2"><button class="button primary" type="submit">Salvar todas as alterações</button></div>
            </form>
            <div class="admin-security-actions"><button class="button" id="adminResetPassword">Redefinir senha</button><button class="button" id="adminLogoutAll">Encerrar sessões</button><button class="button" id="adminRevokeKeys">Revogar todas as API Keys</button><button class="button danger" id="adminDeleteUser">Excluir conta completa</button></div>
        </div>`;
        document.body.appendChild(modal);
        document.getElementById('adminModalClose').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); });
        document.getElementById('adminEditForm').addEventListener('submit', event => saveUser(event, user.id));
        document.getElementById('adminResetPassword').addEventListener('click', () => resetPassword(user.id));
        document.getElementById('adminLogoutAll').addEventListener('click', () => securityAction(user.id, 'logout-all', 'Sessões encerradas.'));
        document.getElementById('adminRevokeKeys').addEventListener('click', () => securityAction(user.id, 'revoke-keys', 'API Keys revogadas.'));
        document.getElementById('adminDeleteUser').addEventListener('click', () => deleteUser(user.id));
    }

    function check(name, label, checked) {
        return `<label class="admin-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${S.escapeHtml(label)}</span></label>`;
    }

    async function saveUser(event, id) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body = {
            username: form.get('username'),
            active: form.get('active') === 'on',
            isAdmin: form.get('isAdmin') === 'on',
            createdAt: form.get('createdAt') || null,
            lastLoginAt: form.get('lastLoginAt') || null,
            adminNote: form.get('adminNote'),
            activeMinutes: Number(form.get('activeMinutes') || 0),
            xpAdjustment: Number(form.get('xpAdjustment') || 0),
            profile: {
                displayName: form.get('displayName'), status: form.get('status'), bio: form.get('bio'), avatarUploadId: form.get('avatarUploadId'),
                privacy: { allowFriendRequests: form.get('allowFriendRequests') === 'on', allowCallsFromFriends: form.get('allowCallsFromFriends') === 'on', showOnPodium: form.get('showOnPodium') === 'on', showOnline: form.get('showOnline') === 'on' }
            }
        };
        const xpRaw = String(form.get('targetXp') || '').trim();
        const levelRaw = String(form.get('targetLevel') || '').trim();
        if (xpRaw !== '') body.targetXp = Number(xpRaw);
        else if (levelRaw !== '') body.targetLevel = Number(levelRaw);
        const message = document.getElementById('adminEditMessage');
        try {
            await S.api(`/api/admin/users/${encodeURIComponent(id)}/full`, { method: 'PATCH', body });
            S.message(message, 'Usuário atualizado.', 'success');
            await loadUsers();
            setTimeout(() => openEditor(id), 250);
        } catch (error) { S.message(message, error.message, 'error'); }
    }

    async function resetPassword(id) {
        const password = prompt('Digite a nova senha (mínimo 8 caracteres):');
        if (password === null) return;
        if (password.length < 8) return alert('A senha precisa ter ao menos 8 caracteres.');
        if (!confirm('Redefinir a senha e encerrar todas as sessões desta conta?')) return;
        try { await S.api(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST', body: { password } }); alert('Senha redefinida.'); await loadUsers(); }
        catch (error) { alert(error.message); }
    }

    async function securityAction(id, action, success) {
        if (!confirm('Confirmar esta ação?')) return;
        try { await S.api(`/api/admin/users/${encodeURIComponent(id)}/${action}`, { method: 'POST' }); alert(success); await loadUsers(); }
        catch (error) { alert(error.message); }
    }

    async function deleteUser(id) {
        if (!confirm('Excluir permanentemente esta conta, dados sociais, uploads, cards, sessões e API Keys?')) return;
        try { await S.api(`/api/admin/users/${encodeURIComponent(id)}/full`, { method: 'DELETE' }); document.getElementById('adminUserModal')?.remove(); await loadUsers(); }
        catch (error) { alert(error.message); }
    }

    function toLocalInput(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0,16);
    }

    boot();
})();
