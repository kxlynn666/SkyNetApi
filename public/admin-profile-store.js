(() => {
    const S = window.SkyNet;
    if (!S) return;

    let users = [];
    let catalog = [];
    let selectedUserId = '';
    let selectedStore = null;

    function installStyles() {
        if (document.getElementById('adminProfileStoreStyles')) return;
        const style = document.createElement('style');
        style.id = 'adminProfileStoreStyles';
        style.textContent = `
            .admin-cosmetic-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:10px;align-items:end}.admin-cosmetic-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.admin-cosmetic-stat{padding:12px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.025)}.admin-cosmetic-stat strong,.admin-cosmetic-stat span{display:block}.admin-cosmetic-stat strong{font-size:18px}.admin-cosmetic-stat span{font-size:10px;color:var(--text-faint);margin-top:3px}.admin-cosmetic-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px}.admin-cosmetic-section{margin-top:18px}.admin-cosmetic-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.admin-cosmetic-section-head h3{margin:0}.admin-cosmetic-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}.admin-cosmetic-card{padding:13px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.022)}.admin-cosmetic-card[data-owned="1"]{border-color:rgba(74,222,128,.26);background:rgba(74,222,128,.035)}.admin-cosmetic-card[data-collection="developer"]{box-shadow:inset 3px 0 0 rgba(34,197,94,.62)}.admin-cosmetic-card[data-collection="admin"]{box-shadow:inset 3px 0 0 rgba(250,204,21,.62)}.admin-cosmetic-swatch{height:48px;border-radius:10px;margin-bottom:9px;background:linear-gradient(135deg,var(--a,#8b5cf6),var(--b,#22d3ee))}.admin-cosmetic-card strong{display:block}.admin-cosmetic-meta{display:flex;gap:6px;flex-wrap:wrap;margin:5px 0 10px}.admin-cosmetic-meta span{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint)}.admin-cosmetic-card .button{width:100%}.admin-cosmetic-empty{padding:22px;text-align:center;color:var(--text-faint);border:1px dashed var(--border);border-radius:14px}@media(max-width:700px){.admin-cosmetic-toolbar{grid-template-columns:1fr}.admin-cosmetic-summary{grid-template-columns:repeat(2,1fr)}.admin-cosmetic-grid{grid-template-columns:1fr 1fr}}@media(max-width:430px){.admin-cosmetic-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    async function boot() {
        try {
            const session = await S.session();
            if (!session?.isAdmin) return;
        } catch { return; }
        installStyles();
        waitForAdmin(async () => {
            addTab();
            await loadBase();
        });
    }

    function waitForAdmin(callback) {
        const ready = () => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && document.querySelector('.tabs');
        if (ready()) return callback();
        const observer = new MutationObserver(() => {
            if (!ready()) return;
            observer.disconnect();
            callback();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    function addTab() {
        if (document.querySelector('[data-tab="profileCosmeticsAdmin"]')) return;
        const tabs = document.querySelector('.tabs');
        const button = document.createElement('button');
        button.className = 'tab';
        button.type = 'button';
        button.dataset.tab = 'profileCosmeticsAdmin';
        button.textContent = 'Cosméticos';
        tabs.appendChild(button);

        const panel = document.createElement('section');
        panel.className = 'tab-panel';
        panel.id = 'profileCosmeticsAdmin';
        panel.innerHTML = `
            <div class="card">
                <div class="toolbar"><h2 class="card-title" style="margin:0 auto 0 0">Cosméticos e moedas</h2><button class="button small" id="adminCosmeticRefresh" type="button">Atualizar</button></div>
                <p class="muted">Itens DEV e ADMIN são exclusivos: nunca podem ser comprados na loja e só entram no inventário por concessão administrativa.</p>
                <div class="message" id="adminCosmeticMessage"></div>
                <div class="admin-cosmetic-toolbar">
                    <div class="form-group" style="margin:0"><label>Usuário</label><select id="adminCosmeticUser"><option value="">Selecione uma conta</option></select></div>
                    <button class="button primary" id="adminCosmeticLoad" type="button">Abrir inventário</button>
                </div>
                <div id="adminCosmeticContent"><div class="admin-cosmetic-empty">Selecione uma conta para gerenciar os cosméticos.</div></div>
            </div>`;
        tabs.parentElement.appendChild(panel);

        document.querySelectorAll('.tabs .tab').forEach(tab => {
            if (tab.dataset.cosmeticTabWired === '1') return;
            tab.dataset.cosmeticTabWired = '1';
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tabs .tab').forEach(item => item.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(item => item.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab)?.classList.add('active');
                if (tab.dataset.tab === 'profileCosmeticsAdmin' && selectedUserId) loadUserStore(selectedUserId);
            });
        });

        document.getElementById('adminCosmeticRefresh').addEventListener('click', loadBase);
        document.getElementById('adminCosmeticLoad').addEventListener('click', () => {
            const id = document.getElementById('adminCosmeticUser').value;
            if (id) loadUserStore(id);
        });
        document.getElementById('adminCosmeticUser').addEventListener('change', event => {
            if (event.target.value) loadUserStore(event.target.value);
        });
    }

    async function loadBase() {
        const message = document.getElementById('adminCosmeticMessage');
        try {
            const [userData, catalogData] = await Promise.all([
                S.api('/api/admin/users/full'),
                S.api('/api/profile-store/catalog')
            ]);
            users = (userData.users || []).sort((a, b) => String(a.username).localeCompare(String(b.username)));
            catalog = catalogData.catalog || [];
            const select = document.getElementById('adminCosmeticUser');
            if (select) {
                const current = selectedUserId || select.value;
                select.innerHTML = '<option value="">Selecione uma conta</option>' + users.map(user => `<option value="${S.escapeHtml(user.id)}" ${current === user.id ? 'selected' : ''}>@${S.escapeHtml(user.username)}${user.isAdmin ? ' · admin' : ''}</option>`).join('');
            }
            if (selectedUserId) await loadUserStore(selectedUserId);
        } catch (error) {
            S.message(message, error.message, 'error');
        }
    }

    async function loadUserStore(id) {
        const root = document.getElementById('adminCosmeticContent');
        const message = document.getElementById('adminCosmeticMessage');
        if (!root) return;
        root.innerHTML = '<div class="admin-cosmetic-empty">Carregando inventário...</div>';
        try {
            selectedUserId = id;
            selectedStore = await S.api(`/api/admin/profile-store/${encodeURIComponent(id)}`);
            render();
        } catch (error) {
            root.innerHTML = '<div class="admin-cosmetic-empty">Não foi possível carregar o inventário.</div>';
            S.message(message, error.message, 'error');
        }
    }

    function render() {
        const root = document.getElementById('adminCosmeticContent');
        if (!root || !selectedStore) return;
        const owned = new Set((selectedStore.inventory || []).map(entry => entry.item?.id).filter(Boolean));
        const user = users.find(entry => entry.id === selectedUserId);
        const devItems = catalog.filter(item => item.grantOnly && item.collection === 'developer');
        const adminItems = catalog.filter(item => item.grantOnly && item.collection === 'admin');
        const wallet = selectedStore.wallet || {};

        root.innerHTML = `
            <div class="admin-cosmetic-summary">
                ${stat(wallet.balance, 'Saldo')}
                ${stat(wallet.earnedCoins, 'Moedas ganhas')}
                ${stat(wallet.bonusCoins, 'Bônus admin')}
                ${stat((selectedStore.inventory || []).length, 'Itens possuídos')}
            </div>
            <div class="admin-cosmetic-actions">
                <button class="button small" data-coins="100" type="button">+100 moedas</button>
                <button class="button small" data-coins="500" type="button">+500 moedas</button>
                <button class="button small" data-coins="1000" type="button">+1000 moedas</button>
                <button class="button small danger" data-coins="-100" type="button">-100 moedas</button>
            </div>
            ${section('Pacote DEV', 'Itens de desenvolvimento. Somente concessão administrativa.', 'developer', devItems, owned, 'Conceder pacote DEV')}
            ${section('Pacote ADMIN', user?.isAdmin ? 'Coleção administrativa exclusiva.' : 'A conta selecionada não é admin, mas a concessão continua sob controle administrativo.', 'admin', adminItems, owned, 'Conceder pacote ADMIN')}
        `;

        root.querySelectorAll('[data-coins]').forEach(button => button.addEventListener('click', () => adjustCoins(Number(button.dataset.coins || 0))));
        root.querySelectorAll('[data-grant-item]').forEach(button => button.addEventListener('click', () => grant(button.dataset.grantItem)));
        root.querySelectorAll('[data-revoke-item]').forEach(button => button.addEventListener('click', () => revoke(button.dataset.revokeItem)));
        root.querySelectorAll('[data-grant-pack]').forEach(button => button.addEventListener('click', () => grantPack(button.dataset.grantPack)));
    }

    function section(title, description, collection, items, owned, packLabel) {
        return `<section class="admin-cosmetic-section"><div class="admin-cosmetic-section-head"><div><h3>${S.escapeHtml(title)}</h3><div class="hint">${S.escapeHtml(description)}</div></div><button class="button primary small" data-grant-pack="${S.escapeHtml(collection)}" type="button">${S.escapeHtml(packLabel)}</button></div><div class="admin-cosmetic-grid">${items.map(item => itemCard(item, owned.has(item.id))).join('')}</div></section>`;
    }

    function itemCard(item, isOwned) {
        const colors = item.colors || ['#8b5cf6', '#22d3ee'];
        return `<article class="admin-cosmetic-card" data-owned="${isOwned ? '1' : '0'}" data-collection="${S.escapeHtml(item.collection || '')}"><div class="admin-cosmetic-swatch" style="--a:${S.escapeHtml(colors[0])};--b:${S.escapeHtml(colors[1] || colors[0])}"></div><strong>${S.escapeHtml(item.name)}</strong><div class="admin-cosmetic-meta"><span>${S.escapeHtml(typeLabel(item.type))}</span><span>${S.escapeHtml(item.rarity)}</span>${item.animated ? '<span>animado</span>' : ''}${item.overlay ? '<span>overlay</span>' : ''}</div>${isOwned ? `<button class="button small danger" data-revoke-item="${S.escapeHtml(item.id)}" type="button">Revogar</button>` : `<button class="button small primary" data-grant-item="${S.escapeHtml(item.id)}" type="button">Conceder</button>`}</article>`;
    }

    async function adjustCoins(delta) {
        const message = document.getElementById('adminCosmeticMessage');
        try {
            await S.api(`/api/admin/profile-store/${encodeURIComponent(selectedUserId)}/coins`, { method: 'PATCH', body: { delta } });
            S.message(message, `${delta >= 0 ? '+' : ''}${delta} moedas aplicadas.`, 'success');
            await loadUserStore(selectedUserId);
        } catch (error) { S.message(message, error.message, 'error'); }
    }

    async function grant(itemId) {
        const message = document.getElementById('adminCosmeticMessage');
        try {
            await S.api(`/api/admin/profile-store/${encodeURIComponent(selectedUserId)}/grant/${encodeURIComponent(itemId)}`, { method: 'POST' });
            S.message(message, 'Item concedido.', 'success');
            await loadUserStore(selectedUserId);
        } catch (error) { S.message(message, error.message, 'error'); }
    }

    async function revoke(itemId) {
        if (!confirm('Revogar este cosmético da conta? Se estiver equipado, será removido do perfil.')) return;
        const message = document.getElementById('adminCosmeticMessage');
        try {
            await S.api(`/api/admin/profile-store/${encodeURIComponent(selectedUserId)}/revoke/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
            S.message(message, 'Item revogado.', 'success');
            await loadUserStore(selectedUserId);
        } catch (error) { S.message(message, error.message, 'error'); }
    }

    async function grantPack(collection) {
        const items = catalog.filter(item => item.grantOnly && item.collection === collection);
        if (!items.length || !confirm(`Conceder todos os ${items.length} itens do pacote ${collection.toUpperCase()}?`)) return;
        const message = document.getElementById('adminCosmeticMessage');
        try {
            for (const item of items) {
                await S.api(`/api/admin/profile-store/${encodeURIComponent(selectedUserId)}/grant/${encodeURIComponent(item.id)}`, { method: 'POST' });
            }
            S.message(message, `Pacote ${collection.toUpperCase()} concedido.`, 'success');
            await loadUserStore(selectedUserId);
        } catch (error) { S.message(message, error.message, 'error'); }
    }

    function stat(value, label) {
        return `<div class="admin-cosmetic-stat"><strong>${Number(value || 0).toLocaleString('pt-BR')}</strong><span>${S.escapeHtml(label)}</span></div>`;
    }

    function typeLabel(type) {
        return type === 'frame' ? 'moldura' : type === 'decoration' ? 'decoração' : 'tag';
    }

    boot();
})();