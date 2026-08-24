(() => {
    const S = window.SkyNet;
    if (!S) return;

    const ICONS = {
        home:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        chat:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
        create:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
        more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
        menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
        key:'<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>',
        upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
        download:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
        search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
        history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
        code:'<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
        activity:'<path d="M3 12h4l2.5-6 5 12 2.5-6H21"/>',
        spark:'<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'
    };

    function svg(name) {
        return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.home}</svg>`;
    }

    function cleanPath() {
        return location.pathname.replace(/\/+$/, '') || '/painel';
    }

    function iconForHref(href) {
        const value = String(href || '').toLowerCase();
        if (value.includes('/chaves')) return 'key';
        if (value.includes('/upload')) return 'upload';
        if (value.includes('/tiktok') || value.includes('/media')) return 'download';
        if (value.includes('/roblox')) return 'search';
        if (value.includes('/historico')) return 'history';
        if (value.includes('/api')) return 'code';
        if (value.includes('/brat')) return 'spark';
        if (value.includes('/cards') || value.includes('/card2')) return 'create';
        return 'home';
    }

    function installDock() {
        if (document.getElementById('workspaceMobileDock')) return;
        const dock = document.createElement('nav');
        dock.id = 'workspaceMobileDock';
        dock.className = 'workspace-mobile-dock';
        dock.setAttribute('aria-label','Navegação rápida');
        document.body.appendChild(dock);
        renderDock();
    }

    function renderDock() {
        const dock = document.getElementById('workspaceMobileDock');
        if (!dock) return;
        const path = cleanPath();
        const items = [
            ['/painel','Início','home'],
            ['/painel/perfil','Perfil','user'],
            ['/painel/chat','Chat','chat'],
            ['/painel/cards','Criar','create']
        ];
        dock.innerHTML = items.map(([href,label,icon]) => {
            const active = path === href || (href === '/painel/perfil' && path.startsWith('/painel/perfil')) || (href === '/painel/chat' && path.startsWith('/painel/chat')) || (href === '/painel/cards' && (path.startsWith('/painel/cards') || path.startsWith('/painel/card2') || path.startsWith('/painel/brat')));
            return `<a class="workspace-mobile-dock-item ${active ? 'active' : ''}" href="${href}" aria-label="${label}">${svg(icon)}<span>${label}</span></a>`;
        }).join('') + `<button class="workspace-mobile-dock-item" id="workspaceDockMore" type="button" aria-label="Abrir menu completo">${svg('more')}<span>Mais</span></button>`;

        document.getElementById('workspaceDockMore')?.addEventListener('click', () => {
            document.getElementById('workspaceMenuButton')?.click();
        });
    }

    function enhanceMenuButton() {
        const button = document.getElementById('workspaceMenuButton');
        if (!button || button.dataset.uiV3 === '1') return;
        button.innerHTML = `${svg('menu')}<span class="workspace-menu-label">Menu</span>`;
        button.setAttribute('aria-expanded','false');
        button.dataset.uiV3 = '1';

        const sidebar = document.getElementById('workspaceSidebar');
        const backdrop = document.getElementById('workspaceSidebarBackdrop');
        button.addEventListener('click', () => setTimeout(() => button.setAttribute('aria-expanded', sidebar?.classList.contains('open') ? 'true' : 'false'), 0));
        backdrop?.addEventListener('click', () => button.setAttribute('aria-expanded','false'));
        sidebar?.addEventListener('click', event => { if (event.target.closest('a')) button.setAttribute('aria-expanded','false'); });
    }

    function enhanceUserChip() {
        const chip = document.getElementById('workspaceUserChip');
        if (!chip || chip.dataset.uiV3 === '1') return;
        const name = chip.textContent.trim();
        chip.dataset.initial = (name || 'U').slice(0,1).toUpperCase();
        chip.dataset.uiV3 = '1';
    }

    function enhanceStats(root = document) {
        root.querySelectorAll?.('.workspace-stat').forEach((card,index) => {
            if (card.dataset.uiV3 === '1') return;
            const label = card.querySelector('span')?.textContent.toLowerCase() || '';
            let name = 'activity';
            if (label.includes('key')) name = 'key';
            else if (label.includes('upload')) name = 'upload';
            else if (label.includes('card')) name = 'create';
            else if (label.includes('requisi')) name = 'activity';
            const holder = document.createElement('div');
            holder.className = 'workspace-stat-ui-icon';
            holder.innerHTML = svg(name);
            card.prepend(holder);
            card.dataset.uiV3 = '1';
        });
    }

    function enhanceQuick(root = document) {
        root.querySelectorAll?.('.workspace-quick').forEach((card,index) => {
            if (card.dataset.uiV3 === '1') return;
            const holder = document.createElement('div');
            holder.className = 'workspace-quick-ui-icon';
            holder.innerHTML = svg(iconForHref(card.getAttribute('href')));
            card.prepend(holder);
            card.dataset.tone = ['violet','cyan','pink'][index % 3];
            card.dataset.uiV3 = '1';
        });
    }

    function enhanceAll(root = document) {
        enhanceMenuButton();
        enhanceUserChip();
        enhanceStats(root);
        enhanceQuick(root);
    }

    function waitForWorkspace() {
        const ready = () => document.getElementById('workspaceShell') && !document.getElementById('workspaceShell').classList.contains('hidden');
        if (ready()) {
            installDock();
            enhanceAll();
            return;
        }
        const observer = new MutationObserver(() => {
            if (!ready()) return;
            observer.disconnect();
            installDock();
            enhanceAll();
        });
        observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }

    const observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node.nodeType === 1) enhanceAll(node);
            }
        }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});

    window.addEventListener('popstate', renderDock);
    waitForWorkspace();
})();
