(() => {
    if (window.__SKYNET_PROFILE_STORE_ORGANIZER_V5__) return;
    window.__SKYNET_PROFILE_STORE_ORGANIZER_V5__ = true;
    if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

    const LABELS = {
        core:'Core', sakura:'Sakura', cosmic:'Cosmic', holo:'Hologram', winter:'Winter', ember:'Ember', night:'Night', nature:'Nature',
        editorial:'Editorial', analog:'Analógico', minimal:'Minimal', textile:'Têxtil', developer:'DEV', admin:'ADMIN'
    };
    const observedStores = new WeakSet();
    let scheduled = false;

    function owned(card) {
        const button = card.querySelector('.button');
        const text = String(button?.textContent || '').toLowerCase();
        return /comprado|adquirido/.test(text);
    }

    function decorateCard(card) {
        if (!card || card.dataset.storeV5Decorated === '1') return;
        const collection = card.dataset.collection || '';
        if (!collection) return;
        const title = card.querySelector('.profile-v3-product-title');
        if (!title) return;
        const badge = document.createElement('span');
        badge.className = `profile-store-collection-v5 c-${collection}`;
        badge.textContent = LABELS[collection] || collection;
        title.appendChild(badge);
        card.dataset.storeV5Decorated = '1';
    }

    function install(store) {
        if (!store || store.dataset.organizerV5 === '1') return;
        store.dataset.organizerV5 = '1';
        const host = store.parentElement;
        if (!host) return;
        const tools = document.createElement('div');
        tools.className = 'profile-store-tools-v5';
        tools.innerHTML = `<label class="profile-store-search-v5"><span>Buscar</span><input type="search" placeholder="Nome, tag, moldura..." aria-label="Buscar cosmético"></label><label class="profile-store-select-v5"><span>Coleção</span><select aria-label="Filtrar por coleção"><option value="all">Todas as coleções</option></select></label><label class="profile-store-owned-v5"><input type="checkbox"><span>Somente adquiridos</span></label><div class="profile-store-count-v5" aria-live="polite"></div>`;
        host.insertBefore(tools, store);
        const search = tools.querySelector('input[type="search"]');
        const select = tools.querySelector('select');
        const check = tools.querySelector('input[type="checkbox"]');
        const apply = () => applyFilter(store, search.value, select.value, check.checked, tools);
        search.addEventListener('input', debounce(apply, 80));
        select.addEventListener('change', apply);
        check.addEventListener('change', apply);
        refreshCollections(store, select);
        apply();
        observeStore(store);
    }

    function observeStore(store) {
        if (observedStores.has(store)) return;
        observedStores.add(store);
        const observer = new MutationObserver(records => {
            let relevant = false;
            for (const record of records) {
                for (const node of record.addedNodes || []) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches?.('.profile-v3-product') || node.querySelector?.('.profile-v3-product')) { relevant = true; break; }
                }
                if (relevant) break;
            }
            if (relevant) scheduleRefresh(store);
        });
        observer.observe(store, { childList:true, subtree:true });
    }

    function scheduleRefresh(store) {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            if (!store?.isConnected) return;
            enhance(store);
            const tools = store.parentElement?.querySelector('.profile-store-tools-v5');
            if (!tools) return;
            const select = tools.querySelector('select');
            const current = select.value;
            refreshCollections(store, select);
            if ([...select.options].some(option => option.value === current)) select.value = current;
            applyFilter(store, tools.querySelector('input[type="search"]').value, select.value, tools.querySelector('input[type="checkbox"]').checked, tools);
        });
    }

    function refreshCollections(store, select) {
        const before = select.value || 'all';
        const collections = [...new Set([...store.querySelectorAll('.profile-v3-product')].map(card => card.dataset.collection).filter(Boolean))].sort((a,b) => (LABELS[a] || a).localeCompare(LABELS[b] || b));
        const html = '<option value="all">Todas as coleções</option>' + collections.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(LABELS[value] || value)}</option>`).join('');
        if (select.innerHTML !== html) select.innerHTML = html;
        select.value = collections.includes(before) ? before : 'all';
    }

    function applyFilter(store, query, collection, onlyOwned, tools) {
        const term = String(query || '').trim().toLowerCase();
        const cards = [...store.querySelectorAll('.profile-v3-product')];
        let visible = 0;
        for (const card of cards) {
            decorateCard(card);
            const text = String(card.textContent || '').toLowerCase();
            const show = (!term || text.includes(term)) && (collection === 'all' || card.dataset.collection === collection) && (!onlyOwned || owned(card));
            if (card.hidden === show) card.hidden = !show;
            if (show) visible++;
        }
        const count = tools.querySelector('.profile-store-count-v5');
        if (count) count.textContent = `${visible} de ${cards.length} itens`;
    }

    function enhance(root = document) {
        const stores = [];
        if (root.matches?.('.profile-v3-store')) stores.push(root);
        stores.push(...(root.querySelectorAll?.('.profile-v3-store') || []));
        for (const store of stores) install(store);
        const cards = [];
        if (root.matches?.('.profile-v3-product')) cards.push(root);
        cards.push(...(root.querySelectorAll?.('.profile-v3-product') || []));
        for (const card of cards) decorateCard(card);
    }

    function debounce(fn, delay) { let timer = 0; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
    function escapeHtml(value) { const el = document.createElement('div'); el.textContent = String(value ?? ''); return el.innerHTML; }

    const style = document.createElement('style');
    style.id = 'profileStoreOrganizerV5Styles';
    style.textContent = `.profile-store-tools-v5{display:grid;grid-template-columns:minmax(190px,1.3fr) minmax(150px,.7fr) auto auto;gap:9px;align-items:end;margin:0 0 14px;padding:11px;border:1px solid rgba(139,92,246,.14);border-radius:14px;background:rgba(12,8,23,.42)}.profile-store-search-v5,.profile-store-select-v5{display:grid;gap:5px}.profile-store-search-v5>span,.profile-store-select-v5>span{font-size:9px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.07em;font-weight:700}.profile-store-search-v5 input,.profile-store-select-v5 select{min-height:38px!important}.profile-store-owned-v5{display:flex;align-items:center;gap:7px;min-height:38px;padding:0 9px;border:1px solid var(--border-soft);border-radius:10px;background:rgba(30,22,56,.42);font-size:10px;color:var(--text-muted);white-space:nowrap}.profile-store-owned-v5 input{width:auto;min-height:0}.profile-store-count-v5{font:700 10px 'JetBrains Mono',monospace;color:#c4b5fd;white-space:nowrap;align-self:center}.profile-store-collection-v5{font-size:8px;line-height:1;padding:4px 6px;border:1px solid rgba(167,139,250,.22);border-radius:999px;color:#c4b5fd;background:rgba(139,92,246,.07);white-space:nowrap;margin-left:auto}.profile-store-collection-v5.c-sakura{color:#f9a8d4;border-color:rgba(244,114,182,.26);background:rgba(190,24,93,.08)}.profile-store-collection-v5.c-developer{color:#86efac;border-color:rgba(34,197,94,.28);background:rgba(5,46,22,.18)}.profile-store-collection-v5.c-admin{color:#fde68a;border-color:rgba(250,204,21,.28);background:rgba(120,53,15,.18)}.profile-store-collection-v5.c-editorial{color:#e7e5e4;border-color:rgba(214,211,209,.24);background:rgba(87,83,78,.12)}.profile-store-collection-v5.c-analog{color:#f5e7c8;border-color:rgba(168,143,97,.28);background:rgba(120,90,40,.12)}.profile-store-collection-v5.c-minimal{color:#dbeafe;border-color:rgba(191,219,254,.22);background:rgba(255,255,255,.045)}.profile-store-collection-v5.c-textile{color:#e9d5ff;border-color:rgba(216,180,254,.22);background:rgba(88,28,135,.08)}.profile-store-collection-v5.c-cosmic{color:#c4b5fd}.profile-store-collection-v5.c-holo{color:#67e8f9}.profile-store-collection-v5.c-nature{color:#bef264}.profile-v3-product[hidden]{display:none!important}@media(max-width:760px){.profile-store-tools-v5{grid-template-columns:1fr 1fr}.profile-store-owned-v5{grid-column:1/2}.profile-store-count-v5{grid-column:2/3;text-align:right}}@media(max-width:520px){.profile-store-tools-v5{grid-template-columns:1fr;padding:10px}.profile-store-owned-v5,.profile-store-count-v5{grid-column:auto}.profile-store-count-v5{text-align:left}.profile-store-collection-v5{font-size:7.5px}}`;
    document.head.appendChild(style);

    enhance();
    const root = document.getElementById('workspaceContent') || document.body;
    const observer = new MutationObserver(records => {
        const roots = new Set();
        for (const record of records) for (const node of record.addedNodes || []) if (node.nodeType === 1) roots.add(node);
        if (!roots.size) return;
        requestAnimationFrame(() => roots.forEach(enhance));
    });
    observer.observe(root, { childList:true, subtree:true });
})();
