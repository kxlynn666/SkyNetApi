(() => {
    const S = window.SkyNet;
    if (!S) return;
    let cache = null;

    async function loadCache() {
        cache = await S.api('/api/admin/community/users');
        return cache;
    }

    function waitForAdmin() {
        const ready = () => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden');
        if (ready()) return boot();
        const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); boot(); } });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    async function boot() {
        try { await loadCache(); } catch { return; }
        const observer = new MutationObserver(() => enhanceModal().catch(() => {}));
        observer.observe(document.body, { childList: true, subtree: true });
        enhanceModal().catch(() => {});
    }

    async function enhanceModal() {
        const modal = document.getElementById('adminUserModal');
        if (!modal || modal.dataset.communityEnhanced) return;
        const idNode = modal.querySelector('.admin-modal-head .mono');
        const userId = idNode?.textContent?.trim();
        if (!userId) return;
        if (!cache) await loadCache();
        const state = cache.users?.find(item => item.id === userId);
        if (!state) return;
        modal.dataset.communityEnhanced = '1';
        const card = modal.querySelector('.admin-modal-card');
        const custom = state.custom || {};
        const section = document.createElement('section');
        section.style.marginTop = '20px';
        section.style.paddingTop = '18px';
        section.style.borderTop = '1px solid var(--border)';
        section.innerHTML = `
            <div class="workspace-card-header"><div><h2>Perfil avançado e estado social</h2><p>Controle visual público, amizades, bloqueios e participação em grupos.</p></div></div>
            <div class="message" id="adminCommunityMessage"></div>
            <form id="adminCommunityForm" class="admin-edit-grid">
                <div class="form-group"><label>Cor do perfil</label><input name="accent" type="color" value="${S.escapeHtml(custom.accent || '#a855f7')}"></div>
                <div class="form-group"><label>Estilo</label><select name="style"><option value="clean" ${custom.style === 'clean' ? 'selected' : ''}>Clean</option><option value="glass" ${custom.style === 'glass' ? 'selected' : ''}>Glass</option><option value="contrast" ${custom.style === 'contrast' ? 'selected' : ''}>Contraste</option></select></div>
                <div class="form-group admin-span-2"><label>Headline</label><input name="headline" maxlength="90" value="${S.escapeHtml(custom.headline || '')}"></div>
                <div class="form-group"><label>Banner upload ID</label><input name="bannerUploadId" maxlength="80" value="${S.escapeHtml(custom.bannerUploadId || '')}"></div>
                <div class="form-group"><label>Tags</label><input name="tags" value="${S.escapeHtml((custom.tags || []).join(', '))}" placeholder="Linux, Design, API"></div>
                <div class="form-group admin-span-2"><label>Amigos por ID</label><textarea name="friendIds" rows="3">${S.escapeHtml((state.friendIds || []).join(', '))}</textarea><div class="hint">Lista completa. Ao salvar, substitui as amizades aceitas deste usuário.</div></div>
                <div class="form-group admin-span-2"><label>Bloqueados por ID</label><textarea name="blockedIds" rows="3">${S.escapeHtml((state.blockedIds || []).join(', '))}</textarea></div>
                <div class="form-group admin-span-2"><label>Grupos por ID</label><textarea name="groupIds" rows="3">${S.escapeHtml((state.groupIds || []).join(', '))}</textarea><div class="hint">Participações comuns podem ser alteradas; propriedade de grupos é preservada.</div></div>
                <div class="form-group admin-span-2"><div class="admin-checks">
                    ${check('showXp','Mostrar XP público',custom.showXp !== false)}${check('showJoinDate','Mostrar data de entrada',custom.showJoinDate !== false)}${check('showFriendCount','Mostrar amigos',custom.showFriendCount !== false)}
                </div></div>
                <div class="admin-span-2"><button class="button primary" type="submit">Salvar estado social</button> <button class="button danger" type="button" id="adminPurgeMessages">Apagar mensagens da conta</button></div>
            </form>
            <div style="margin-top:16px"><h3 style="margin-bottom:8px">Grupos existentes</h3><div class="text-faint mono" style="white-space:pre-wrap">${S.escapeHtml((cache.groups || []).map(group => `${group.id}  ${group.name}${group.ownerId === userId ? '  [CRIADOR]' : ''}`).join('\n') || 'Nenhum grupo.')}</div></div>`;
        card.appendChild(section);
        document.getElementById('adminCommunityForm').addEventListener('submit', event => save(event, userId));
        document.getElementById('adminPurgeMessages').addEventListener('click', () => purgeMessages(userId));
    }

    function check(name, label, checked) { return `<label class="admin-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${S.escapeHtml(label)}</span></label>`; }
    function ids(value) { return [...new Set(String(value || '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean))]; }

    async function save(event, userId) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body = {
            custom: {
                accent: form.get('accent'), style: form.get('style'), headline: form.get('headline'), bannerUploadId: form.get('bannerUploadId'),
                tags: String(form.get('tags') || '').split(',').map(x => x.trim()).filter(Boolean),
                showXp: form.get('showXp') === 'on', showJoinDate: form.get('showJoinDate') === 'on', showFriendCount: form.get('showFriendCount') === 'on'
            },
            friendIds: ids(form.get('friendIds')),
            blockedIds: ids(form.get('blockedIds')),
            groupIds: ids(form.get('groupIds'))
        };
        const message = document.getElementById('adminCommunityMessage');
        try { await S.api(`/api/admin/community/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body }); S.message(message, 'Estado social atualizado.', 'success'); await loadCache(); }
        catch (error) { S.message(message, error.message, 'error'); }
    }

    async function purgeMessages(userId) {
        if (!confirm('Apagar todas as mensagens privadas envolvendo esta conta e todas as mensagens de grupo enviadas por ela?')) return;
        try { await S.api(`/api/admin/community/users/${encodeURIComponent(userId)}/purge-messages`, { method: 'POST' }); alert('Mensagens removidas.'); }
        catch (error) { alert(error.message); }
    }

    waitForAdmin();
})();
