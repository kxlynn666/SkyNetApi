(() => {
    if (window.__SKYNET_UI_ICONS_V4__) return;
    window.__SKYNET_UI_ICONS_V4__ = true;

    const I = {
        shop:'<path d="M3 9h18l-1-5H4z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>',
        cart:'<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.5h7.9a2 2 0 0 0 1.9-1.4L21 8H7"/>',
        equip:'<path d="M4 6h16M4 12h10M4 18h7"/><path d="m16 16 2 2 4-5"/>',
        camera:'<path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/>',
        image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
        shield:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-5"/>',
        coin:'<circle cx="12" cy="12" r="8"/><path d="M9 10.2c.7-1.6 5-1.6 5.8.2.8 1.8-1.1 2.3-2.8 2.5-1.8.2-3.4.7-2.5 2.6.9 1.9 5.1 1.7 5.8.1M12 7v10"/>',
        frame:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4"/>',
        spark:'<path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
        tag:'<path d="M20 13 13 20 4 11V4h7z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
        box:'<path d="m4 7 8-4 8 4-8 4z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
        music:'<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
        lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
        save:'<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
        edit:'<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM14 6l3.5 3.5"/>',
        trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>',
        gift:'<path d="M3 10h18v11H3zM2 7h20v3H2zM12 7v14"/><path d="M12 7H8.5A2.5 2.5 0 1 1 12 3.5zM12 7h3.5A2.5 2.5 0 1 0 12 3.5z"/>',
        filter:'<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
        eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>',
        upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
        check:'<path d="m5 12 4 4 10-10"/>'
    };

    const RULES = [
        [/comprar|carrinho/, 'cart'], [/loja/, 'shop'], [/equipar|aplicar/, 'equip'], [/foto|avatar|câmera|camera/, 'camera'],
        [/fundo|capa|banner|imagem/, 'image'], [/privacidade|seguran|admin/, 'shield'], [/moeda|saldo/, 'coin'], [/moldura/, 'frame'],
        [/decora|efeito|aparência|aparencia/, 'spark'], [/\btag\b|tags/, 'tag'], [/inventário|inventario/, 'box'], [/música|musica|player|áudio|audio/, 'music'],
        [/senha|bloque/, 'lock'], [/perfil|identidade|usuário|usuario/, 'user'], [/público|publico|site/, 'globe'], [/salvar/, 'save'], [/editar|alterar|renomear/, 'edit'],
        [/excluir|remover|revogar|limpar/, 'trash'], [/conceder|presente|grant/, 'gift'], [/filtrar|filtro/, 'filter'], [/visualizar|ver perfil|preview/, 'eye'],
        [/enviar|upload/, 'upload'], [/aceitar|confirmar/, 'check']
    ];

    function findIcon(text) {
        const value = String(text || '').replace(/\s+/g,' ').trim().toLowerCase();
        for (const [pattern, icon] of RULES) if (pattern.test(value)) return icon;
        return null;
    }

    function make(name) {
        const span = document.createElement('span');
        span.className = 'ui-action-icon-v4';
        span.setAttribute('aria-hidden','true');
        span.innerHTML = `<svg viewBox="0 0 24 24">${I[name]}</svg>`;
        return span;
    }

    function enhance(root = document) {
        const selector = '.button,.nav-link,.tab,.profile-v3-tab,.profile-v3-store-filter button,.workspace-card-header h2,.profile-v3-card h3';
        const nodes = [];
        if (root.matches?.(selector)) nodes.push(root);
        nodes.push(...(root.querySelectorAll?.(selector) || []));
        for (const el of nodes) {
            if (el.dataset.uiIconV4 === '1' || el.querySelector(':scope > .ui-icon,:scope > .ui-action-icon-v4,:scope > .ui-title-icon')) continue;
            const name = findIcon(el.textContent);
            if (!name) continue;
            el.prepend(make(name));
            el.dataset.uiIconV4 = '1';
        }
    }

    const style = document.createElement('style');
    style.id = 'uiIconsV4Styles';
    style.textContent = `
      .ui-action-icon-v4{width:16px;height:16px;display:inline-grid;place-items:center;flex:none;color:currentColor}
      .ui-action-icon-v4 svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      h2>.ui-action-icon-v4,h3>.ui-action-icon-v4{width:24px;height:24px;padding:5px;border-radius:8px;background:rgba(139,92,246,.10);border:1px solid rgba(139,92,246,.14);color:#c4b5fd;margin-right:7px;vertical-align:middle}
      .profile-v3-tab>.ui-action-icon-v4{width:15px;height:15px}
      .profile-v3-store-filter button>.ui-action-icon-v4{width:14px;height:14px}
      @media(max-width:520px){.button>.ui-action-icon-v4{width:15px;height:15px}h2>.ui-action-icon-v4,h3>.ui-action-icon-v4{width:22px;height:22px;padding:4px}}
    `;
    document.head.appendChild(style);

    enhance();
    const observer = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) enhance(node);
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
})();
