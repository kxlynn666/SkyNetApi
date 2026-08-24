(() => {
    if (window.__SKYNET_SITE_UI_V3__) return;
    window.__SKYNET_SITE_UI_V3__ = true;

    const ICONS = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        spark: '<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
        message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
        group: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 21a5.5 5.5 0 0 1 11 0M13 21a4 4 0 0 1 8 0"/>',
        shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9.5 12 1.7 1.7 3.8-4"/>',
        key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>',
        code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
        upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
        download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
        image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
        activity: '<path d="M3 12h4l2.5-6 5 12 2.5-6H21"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
        trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>',
        refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18.8 6M17.9 15A7 7 0 0 1 5.2 18"/>',
        copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        edit: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
        save: '<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
        logout: '<path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/>',
        send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>'
    };

    function installTinyStyles() {
        if (document.getElementById('siteUiV3TinyStyles')) return;
        const style = document.createElement('style');
        style.id = 'siteUiV3TinyStyles';
        style.textContent = '.card-title.ui-title-enhanced::before{display:none}.card-title.ui-title-enhanced{gap:10px}.card-title.ui-title-enhanced .ui-title-icon{margin-right:1px}@media(max-width:520px){.button>.ui-icon,.nav-link>.ui-icon{flex:none}.button.small>.ui-icon{width:15px;height:15px}}';
        document.head.appendChild(style);
    }

    function iconNameFor(text, href = '') {
        const value = `${text || ''} ${href || ''}`.toLowerCase();
        if (value.includes('admin')) return 'shield';
        if (value.includes('brat')) return 'spark';
        if (value.includes('perfil')) return 'user';
        if (value.includes('amigo')) return 'users';
        if (value.includes('chat')) return 'message';
        if (value.includes('grupo')) return 'group';
        if (value.includes('api key') || value.includes('chave')) return 'key';
        if (value.includes('endpoint') || value.includes('rota') || value.includes('código')) return 'code';
        if (value.includes('upload')) return 'upload';
        if (value.includes('baixar') || value.includes('download')) return 'download';
        if (value.includes('copiar')) return 'copy';
        if (value.includes('criar') || value.includes('gerar')) return 'plus';
        if (value.includes('salvar')) return 'save';
        if (value.includes('editar') || value.includes('renomear')) return 'edit';
        if (value.includes('sair') || value.includes('logout')) return 'logout';
        if (value.includes('enviar')) return 'send';
        if (value.includes('card')) return 'image';
        if (value.includes('status')) return 'activity';
        if (value.includes('tempo') || value.includes('uptime')) return 'clock';
        if (value.includes('versão')) return 'code';
        if (value.includes('log')) return 'terminal';
        if (value.includes('excluir') || value.includes('limpar')) return 'trash';
        if (value.includes('atualizar')) return 'refresh';
        if (value.includes('painel') || value.includes('workspace')) return 'grid';
        return null;
    }

    function makeIcon(name, className = 'ui-icon') {
        const path = ICONS[name];
        if (!path) return null;
        const span = document.createElement('span');
        span.className = className;
        span.setAttribute('aria-hidden', 'true');
        span.innerHTML = `<svg viewBox="0 0 24 24">${path}</svg>`;
        return span;
    }

    function enhance(root = document) {
        root.querySelectorAll?.('.nav-link,.button').forEach(el => {
            if (el.dataset.uiIconReady === '1' || el.querySelector(':scope > .ui-icon')) return;
            const name = iconNameFor(el.textContent, el.getAttribute('href'));
            if (!name) return;
            const node = makeIcon(name);
            if (!node) return;
            el.prepend(node);
            el.dataset.uiIconReady = '1';
        });

        root.querySelectorAll?.('.stat').forEach(el => {
            if (el.dataset.uiStatReady === '1') return;
            const label = el.querySelector('.label')?.textContent || '';
            const name = iconNameFor(label);
            if (!name) return;
            const node = makeIcon(name, 'ui-stat-icon');
            if (!node) return;
            el.prepend(node);
            el.dataset.uiStatReady = '1';
        });

        root.querySelectorAll?.('.tab').forEach(el => {
            if (el.dataset.uiIconReady === '1') return;
            const name = iconNameFor(el.textContent);
            if (!name) return;
            const node = makeIcon(name);
            if (!node) return;
            el.prepend(node);
            el.dataset.uiIconReady = '1';
        });

        root.querySelectorAll?.('.card-title').forEach(el => {
            if (el.dataset.uiTitleReady === '1') return;
            const name = iconNameFor(el.textContent);
            if (!name) return;
            const node = makeIcon(name, 'ui-title-icon');
            if (!node) return;
            el.classList.add('ui-title-enhanced');
            el.prepend(node);
            el.dataset.uiTitleReady = '1';
        });
    }

    installTinyStyles();
    enhance();
    const observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node.nodeType === 1) enhance(node);
            }
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
