(() => {
    if (window.__SKYNET_PROFILE_CATALOG_V4__) return;
    window.__SKYNET_PROFILE_CATALOG_V4__ = true;

    let catalog = [];
    let byName = new Map();
    let loading = false;

    async function loadCatalog() {
        if (catalog.length || loading) return;
        loading = true;
        try {
            const response = await fetch('/api/profile-store/catalog', { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            catalog = Array.isArray(data.catalog) ? data.catalog : [];
            byName = new Map(catalog.map(item => [String(item.name || '').trim().toLowerCase(), item]));
            enhance(document);
        } catch {}
        finally { loading = false; }
    }

    function enhance(root) {
        if (!catalog.length || !root?.querySelectorAll) return;
        enhanceTags(root);
        enhanceProducts(root);
    }

    function enhanceTags(root) {
        const tags = [];
        if (root.matches?.('.profile-tag')) tags.push(root);
        tags.push(...root.querySelectorAll('.profile-tag'));
        for (const tag of tags) {
            const item = byName.get(String(tag.textContent || '').trim().toLowerCase());
            if (!item) continue;
            tag.dataset.collection = item.collection || 'core';
            tag.dataset.rarity = item.rarity || 'common';
            if (item.grantOnly) tag.dataset.grantOnly = '1';
        }
    }

    function enhanceProducts(root) {
        const products = [];
        if (root.matches?.('.profile-v3-product')) products.push(root);
        products.push(...root.querySelectorAll('.profile-v3-product'));
        for (const card of products) {
            const title = card.querySelector('.profile-v3-product-title strong');
            const item = byName.get(String(title?.textContent || '').trim().toLowerCase());
            if (!item) continue;
            card.dataset.catalogId = item.id;
            card.dataset.collection = item.collection || 'core';
            card.dataset.grantOnly = item.grantOnly ? '1' : '0';

            if (item.collection === 'sakura') {
                card.style.boxShadow = '0 0 0 1px rgba(244,114,182,.08),0 14px 35px rgba(236,72,153,.08)';
            }

            if (!item.grantOnly) continue;
            card.classList.add('profile-exclusive-product');
            const price = card.querySelector('.profile-v3-price');
            if (price) price.innerHTML = '<span class="profile-exclusive-label">Exclusivo · concessão administrativa</span>';

            const button = card.querySelector('button');
            if (button) {
                const owned = button.disabled || /comprado/i.test(button.textContent || '');
                button.disabled = true;
                button.removeAttribute('data-buy-profile-item');
                button.classList.remove('primary');
                button.textContent = owned ? 'Exclusivo · adquirido' : 'Não disponível na loja';
            }
        }
    }

    const observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node.nodeType === 1) enhance(node);
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    loadCatalog();
})();