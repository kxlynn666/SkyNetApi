(() => {
  if (window.__SKYNET_STICKERS_V1__) return;
  window.__SKYNET_STICKERS_V1__ = true;
  const S = window.SkyNet;
  if (!S) return;

  const path = location.pathname.replace(/\/+$/,'') || '/';
  const MARKER = /^\[\[SKYNET_STICKER:([A-Za-z0-9_-]{3,120})\]\]$/;
  let library = null;
  let libraryPromise = null;
  let scheduled = false;
  let pickerTab = 'recent';
  let pickerPack = 'Reações';

  installStyles();
  waitForWorkspace();

  function installStyles() {
    if (document.getElementById('stickersV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'stickersV1Styles';
    style.textContent = `
      .sticker-nav-icon{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8}
      .sticker-picker-button-v1{width:42px!important;min-width:42px!important;height:42px!important;padding:0!important;display:grid!important;place-items:center}.sticker-picker-button-v1 svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8}
      .sticker-picker-v1{position:absolute;left:13px;right:13px;bottom:68px;z-index:30;display:none;max-height:min(520px,64dvh);border:1px solid rgba(167,139,250,.18);border-radius:20px;background:rgba(12,8,23,.98);box-shadow:0 24px 80px rgba(0,0,0,.42);overflow:hidden;backdrop-filter:blur(20px)}.sticker-picker-v1.open{display:grid;grid-template-rows:auto auto minmax(0,1fr)}
      .sticker-picker-head-v1{display:flex;align-items:center;gap:9px;padding:12px;border-bottom:1px solid rgba(139,92,246,.12)}.sticker-picker-head-v1 strong{font-size:13px;flex:1}.sticker-picker-head-v1 a{font-size:10px;color:#c4b5fd;text-decoration:none}.sticker-picker-close-v1{width:32px;height:32px;border:0;border-radius:10px;background:rgba(255,255,255,.04);color:#c4b5fd;cursor:pointer}
      .sticker-picker-tabs-v1{display:flex;gap:5px;padding:8px 10px;overflow:auto;border-bottom:1px solid rgba(139,92,246,.09)}.sticker-picker-tabs-v1 button,.sticker-pack-chip-v1{border:1px solid rgba(167,139,250,.12);border-radius:999px;background:rgba(255,255,255,.025);color:#9285a7;padding:7px 10px;font-size:9px;white-space:nowrap;cursor:pointer}.sticker-picker-tabs-v1 button.active,.sticker-pack-chip-v1.active{color:#fff;background:rgba(139,92,246,.13);border-color:rgba(167,139,250,.25)}
      .sticker-picker-body-v1{overflow:auto;padding:10px}.sticker-picker-search-v1{width:100%;min-height:38px!important;margin-bottom:9px!important;border-radius:11px!important}.sticker-pack-row-v1{display:flex;gap:5px;overflow:auto;margin-bottom:9px;padding-bottom:2px}.sticker-grid-v1{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}.sticker-item-v1{position:relative;min-width:0;aspect-ratio:1;border:1px solid rgba(167,139,250,.1);border-radius:15px;background:rgba(255,255,255,.025);padding:7px;cursor:pointer;overflow:hidden}.sticker-item-v1:hover{border-color:rgba(167,139,250,.25);background:rgba(139,92,246,.07)}.sticker-item-v1 img{width:100%;height:100%;object-fit:contain;display:block}.sticker-item-v1 .sticker-anim-v1{position:absolute;left:6px;bottom:6px;padding:3px 5px;border-radius:999px;background:rgba(5,4,10,.78);font:700 6px 'JetBrains Mono',monospace;color:#67e8f9}.sticker-fav-v1{position:absolute;right:5px;top:5px;width:24px;height:24px;border:0;border-radius:8px;background:rgba(5,4,10,.76);color:#c4b5fd;cursor:pointer;font-size:13px}.sticker-fav-v1.active{color:#fde68a}.sticker-empty-v1{grid-column:1/-1;padding:24px 12px;border:1px dashed rgba(167,139,250,.12);border-radius:14px;text-align:center;color:#80738f;font-size:10px}
      .chat-bubble.sticker-bubble-v1{background:transparent!important;border:0!important;box-shadow:none!important;padding:3px!important;max-width:220px!important}.chat-sticker-v1{display:block;width:min(190px,48vw);max-height:210px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(0,0,0,.18))}.chat-bubble.sticker-bubble-v1 .time{padding:2px 6px;width:max-content;border-radius:999px;background:rgba(8,6,14,.62);backdrop-filter:blur(7px)}
      .stickers-page-v1{display:grid;gap:16px;min-width:0}.stickers-hero-v1{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px;border:1px solid rgba(167,139,250,.14);border-radius:20px;background:linear-gradient(135deg,rgba(139,92,246,.08),rgba(34,211,238,.035))}.stickers-hero-v1 h2{margin:0 0 4px;font-size:18px}.stickers-hero-v1 p{margin:0;color:var(--text-muted);font-size:11px}.stickers-limit-v1{font:700 9px 'JetBrains Mono',monospace;color:#a5f3fc;white-space:nowrap}
      .stickers-layout-v1{display:grid;grid-template-columns:minmax(280px,.72fr) minmax(0,1.28fr);gap:15px}.sticker-create-v1,.sticker-library-v1{padding:17px;border:1px solid rgba(139,92,246,.14);border-radius:19px;background:rgba(20,13,35,.68);min-width:0}.sticker-create-v1 h3,.sticker-library-v1 h3{margin:0 0 4px}.sticker-create-preview-v1{aspect-ratio:1;max-width:280px;margin:12px auto;border:1px dashed rgba(167,139,250,.22);border-radius:24px;background:radial-gradient(circle at 35% 20%,rgba(34,211,238,.07),transparent 35%),rgba(255,255,255,.018);display:grid;place-items:center;overflow:hidden;color:#766987;font-size:11px;cursor:pointer}.sticker-create-preview-v1 img{width:100%;height:100%;object-fit:contain}.sticker-create-drop-v1.dragging{border-color:rgba(103,232,249,.38);box-shadow:0 0 30px rgba(34,211,238,.07)}.sticker-create-meta-v1{font-size:9px;color:#837692;margin-top:7px}.sticker-page-tabs-v1{display:flex;gap:6px;overflow:auto;margin:11px 0}.sticker-page-tabs-v1 button{border:1px solid rgba(167,139,250,.12);border-radius:999px;padding:7px 10px;background:rgba(255,255,255,.025);color:#8f82a5;font-size:9px;cursor:pointer;white-space:nowrap}.sticker-page-tabs-v1 button.active{color:white;background:rgba(139,92,246,.12)}.sticker-page-grid-v1{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:9px}.sticker-page-card-v1{position:relative;padding:9px;border:1px solid rgba(167,139,250,.1);border-radius:15px;background:rgba(255,255,255,.022);min-width:0}.sticker-page-card-v1 .visual{aspect-ratio:1;border-radius:12px;overflow:hidden;background:rgba(0,0,0,.12)}.sticker-page-card-v1 img{width:100%;height:100%;object-fit:contain}.sticker-page-card-v1 strong{display:block;margin-top:7px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sticker-page-card-v1 span{font-size:8px;color:#776b86}.sticker-page-actions-v1{display:flex;gap:5px;margin-top:7px}.sticker-page-actions-v1 button{flex:1;min-height:30px!important;padding:4px!important;font-size:8px!important}.sticker-packs-v1{display:grid;gap:12px}.sticker-pack-block-v1 h4{margin:0 0 7px;font-size:11px;color:#c4b5fd}
      @media(max-width:800px){.stickers-layout-v1{grid-template-columns:1fr}.sticker-create-preview-v1{max-width:220px}.sticker-picker-v1{left:8px;right:8px;bottom:61px}.sticker-grid-v1{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.chat-sticker-v1{width:min(170px,52vw)}}
      @media(max-width:420px){.stickers-hero-v1{align-items:flex-start;flex-direction:column}.sticker-grid-v1{grid-template-columns:repeat(3,minmax(0,1fr))}.sticker-page-grid-v1{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function waitForWorkspace() {
    const ready = () => document.getElementById('workspaceContent') && document.getElementById('workspaceShell') && !document.getElementById('workspaceShell').classList.contains('hidden');
    const start = () => {
      addNav();
      if (path === '/painel/figurinhas') renderPage();
      if (path === '/painel/chat') observeChat();
    };
    if (ready()) return start();
    const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); start(); } });
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    setTimeout(() => observer.disconnect(),12000);
  }

  function addNav() {
    const nav = document.querySelector('#workspaceSidebar .workspace-nav');
    if (!nav || nav.querySelector('[href="/painel/figurinhas"]')) return;
    const link = document.createElement('a');
    link.className = `workspace-nav-link ${path === '/painel/figurinhas' ? 'active' : ''}`;
    link.href = '/painel/figurinhas';
    link.innerHTML = '<span class="workspace-nav-icon"><svg class="sticker-nav-icon" viewBox="0 0 24 24"><path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6"/><circle cx="9" cy="9" r="1"/></svg></span><span>Figurinhas</span>';
    const socialGroup = document.getElementById('socialNavGroup');
    if (socialGroup) socialGroup.appendChild(link); else nav.appendChild(link);
  }

  async function getLibrary(force = false) {
    if (force) { library = null; libraryPromise = null; }
    if (library) return library;
    if (!libraryPromise) libraryPromise = S.api('/api/stickers/library').then(data => (library = data));
    return libraryPromise;
  }

  function stickerUrl(id) {
    return String(id).startsWith('builtin-') ? `/stickers/builtin/${encodeURIComponent(id)}.svg` : `/stickers/file/${encodeURIComponent(id)}`;
  }

  function markerFor(id) { return `[[SKYNET_STICKER:${id}]]`; }
  function parseMarker(value) { const match = String(value || '').trim().match(MARKER); return match ? match[1] : null; }

  function observeChat() {
    scheduleChat();
    const root = document.getElementById('workspaceContent');
    const observer = new MutationObserver(scheduleChat);
    observer.observe(root,{childList:true,subtree:true});
  }

  function scheduleChat() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; enhanceChat(); });
  }

  function enhanceChat() {
    const form = document.getElementById('chatForm');
    const main = document.getElementById('chatMain');
    if (form && main) enhanceComposer(form,main);
    enhanceMessageMarkers();
    enhanceConversationMarkers();
  }

  function enhanceComposer(form,main) {
    if (form.dataset.stickersV1 === '1') return;
    form.dataset.stickersV1 = '1';
    main.style.position = 'relative';
    const send = form.querySelector('button[type="submit"],button:not([type])');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button sticker-picker-button-v1';
    button.setAttribute('aria-label','Abrir figurinhas');
    button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6"/><circle cx="9" cy="9" r="1"/><path d="M8 13c1.2 1 2.8 1 4 0"/></svg>';
    form.insertBefore(button,send || form.firstChild);
    const picker = createPicker(main);
    button.addEventListener('click',async () => {
      picker.classList.toggle('open');
      if (picker.classList.contains('open')) await renderPicker(picker);
    });
  }

  function createPicker(main) {
    let picker = main.querySelector('.sticker-picker-v1');
    if (picker) return picker;
    picker = document.createElement('section');
    picker.className = 'sticker-picker-v1';
    picker.innerHTML = `<div class="sticker-picker-head-v1"><strong>Figurinhas</strong><a href="/painel/figurinhas">Criar / gerenciar</a><button class="sticker-picker-close-v1" type="button" aria-label="Fechar">×</button></div><div class="sticker-picker-tabs-v1"><button data-sticker-tab="recent" class="active">Recentes</button><button data-sticker-tab="favorites">Favoritas</button><button data-sticker-tab="packs">Packs</button><button data-sticker-tab="mine">Minhas</button></div><div class="sticker-picker-body-v1"><input class="sticker-picker-search-v1" type="search" placeholder="Buscar figurinha"><div class="sticker-pack-row-v1"></div><div class="sticker-grid-v1"></div></div>`;
    main.appendChild(picker);
    picker.querySelector('.sticker-picker-close-v1').addEventListener('click',() => picker.classList.remove('open'));
    picker.querySelectorAll('[data-sticker-tab]').forEach(button => button.addEventListener('click',() => {
      pickerTab = button.dataset.stickerTab;
      picker.querySelectorAll('[data-sticker-tab]').forEach(item => item.classList.toggle('active',item === button));
      renderPicker(picker);
    }));
    picker.querySelector('.sticker-picker-search-v1').addEventListener('input',() => renderPickerGrid(picker));
    return picker;
  }

  async function renderPicker(picker) {
    try {
      await getLibrary();
      const packRow = picker.querySelector('.sticker-pack-row-v1');
      if (pickerTab === 'packs') {
        packRow.style.display = 'flex';
        packRow.innerHTML = library.packs.map(pack => `<button type="button" class="sticker-pack-chip-v1 ${pack.name === pickerPack ? 'active' : ''}" data-pack="${escapeAttr(pack.name)}">${escapeHtml(pack.name)}</button>`).join('');
        packRow.querySelectorAll('[data-pack]').forEach(button => button.addEventListener('click',() => { pickerPack = button.dataset.pack; renderPicker(picker); }));
      } else { packRow.style.display = 'none'; packRow.innerHTML = ''; }
      renderPickerGrid(picker);
    } catch (error) {
      picker.querySelector('.sticker-grid-v1').innerHTML = `<div class="sticker-empty-v1">${escapeHtml(error.message || 'Falha ao carregar figurinhas.')}</div>`;
    }
  }

  function currentPickerItems() {
    if (!library) return [];
    if (pickerTab === 'recent') return library.recents || [];
    if (pickerTab === 'favorites') return library.favorites || [];
    if (pickerTab === 'mine') return library.custom || [];
    const pack = (library.packs || []).find(item => item.name === pickerPack) || library.packs?.[0];
    return pack?.stickers || [];
  }

  function renderPickerGrid(picker) {
    const grid = picker.querySelector('.sticker-grid-v1');
    if (!grid || !library) return;
    const query = picker.querySelector('.sticker-picker-search-v1').value.trim().toLowerCase();
    const favoriteIds = new Set((library.favorites || []).map(item => item.id));
    const items = currentPickerItems().filter(item => !query || String(item.name || '').toLowerCase().includes(query));
    grid.innerHTML = items.length ? items.map(item => `<button class="sticker-item-v1" type="button" data-send-sticker="${escapeAttr(item.id)}" title="${escapeAttr(item.name)}"><img src="${escapeAttr(item.url || stickerUrl(item.id))}" alt="${escapeAttr(item.name)}" loading="lazy" decoding="async">${item.animated ? '<span class="sticker-anim-v1">ANIM</span>' : ''}<span class="sticker-fav-v1 ${favoriteIds.has(item.id) ? 'active' : ''}" role="button" tabindex="0" data-fav-sticker="${escapeAttr(item.id)}">★</span></button>`).join('') : '<div class="sticker-empty-v1">Nenhuma figurinha aqui ainda.</div>';
    grid.querySelectorAll('[data-send-sticker]').forEach(button => button.addEventListener('click',async event => {
      if (event.target.closest('[data-fav-sticker]')) return;
      await sendSticker(button.dataset.sendSticker,picker);
    }));
    grid.querySelectorAll('[data-fav-sticker]').forEach(button => button.addEventListener('click',async event => {
      event.stopPropagation();
      const id = button.dataset.favSticker;
      const favorite = !button.classList.contains('active');
      try { await S.api(`/api/stickers/${encodeURIComponent(id)}/favorite`,{method:'PATCH',body:{favorite}}); await getLibrary(true); await renderPicker(picker); }
      catch (error) { console.warn('Sticker favorite:',error.message); }
    }));
  }

  async function sendSticker(id,picker) {
    const userId = new URLSearchParams(location.search).get('with') || document.querySelector('.chat-conversation.active')?.dataset.user;
    if (!userId) return;
    try {
      await S.api(`/api/social/messages/${encodeURIComponent(userId)}`,{method:'POST',body:{text:markerFor(id)}});
      await S.api(`/api/stickers/${encodeURIComponent(id)}/used`,{method:'POST'}).catch(() => {});
      picker.classList.remove('open');
      await getLibrary(true).catch(() => {});
    } catch (error) { alert(error.message || 'Não foi possível enviar a figurinha.'); }
  }

  function enhanceMessageMarkers() {
    document.querySelectorAll('.chat-bubble:not([data-sticker-checked-v1])').forEach(bubble => {
      bubble.dataset.stickerCheckedV1 = '1';
      const first = [...bubble.childNodes].find(node => node.nodeType === Node.TEXT_NODE && String(node.nodeValue || '').trim());
      const id = first ? parseMarker(first.nodeValue) : null;
      if (!id) return;
      first.remove();
      bubble.classList.add('sticker-bubble-v1');
      const img = document.createElement('img');
      img.className = 'chat-sticker-v1';
      img.src = stickerUrl(id);
      img.alt = 'Figurinha';
      img.loading = 'lazy';
      img.decoding = 'async';
      bubble.insertBefore(img,bubble.firstChild);
    });
  }

  function enhanceConversationMarkers() {
    document.querySelectorAll('.chat-conversation-copy span').forEach(span => {
      const id = parseMarker(span.textContent);
      if (id) span.textContent = 'Figurinha';
    });
  }

  async function renderPage() {
    setPage('Social','Figurinhas','Crie figurinhas estáticas ou animadas e organize sua biblioteca para usar no chat.');
    const root = document.getElementById('workspaceContent');
    root.innerHTML = `<div class="stickers-page-v1"><section class="stickers-hero-v1"><div><h2>Biblioteca de figurinhas</h2><p>Packs prontos, favoritas, recentes e suas próprias criações em um só lugar.</p></div><span class="stickers-limit-v1">ANIMADAS · ATÉ 10s</span></section><section class="stickers-layout-v1"><div class="sticker-create-v1"><h3>Criar figurinha</h3><div class="hint">PNG, JPG, WebP ou GIF. As animações são convertidas para WebP e limitadas a 10 segundos.</div><form id="stickerCreateFormV1"><div class="sticker-create-preview-v1 sticker-create-drop-v1" id="stickerCreatePreviewV1">Toque para escolher</div><input id="stickerCreateFileV1" name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required><div class="sticker-create-meta-v1" id="stickerCreateMetaV1">Máx. 8 MB · 512 px</div><div class="form-group" style="margin-top:12px"><label>Nome</label><input name="name" maxlength="48" placeholder="Minha figurinha"></div><div class="message" id="stickerCreateMessageV1"></div><button class="button primary" type="submit">Criar figurinha</button></form></div><div class="sticker-library-v1"><h3>Sua biblioteca</h3><div class="hint">Gerencie o que aparece no seletor do chat.</div><div class="sticker-page-tabs-v1"><button class="active" data-page-sticker-tab="packs">Packs</button><button data-page-sticker-tab="mine">Minhas</button><button data-page-sticker-tab="favorites">Favoritas</button><button data-page-sticker-tab="recent">Recentes</button></div><div id="stickerPageContentV1"></div></div></section></div>`;
    wireCreator();
    root.querySelectorAll('[data-page-sticker-tab]').forEach(button => button.addEventListener('click',async () => {
      root.querySelectorAll('[data-page-sticker-tab]').forEach(item => item.classList.toggle('active',item === button));
      await renderPageLibrary(button.dataset.pageStickerTab);
    }));
    await getLibrary(true);
    await renderPageLibrary('packs');
  }

  function setPage(kicker,title,description) {
    document.getElementById('workspaceKicker').textContent = kicker;
    document.getElementById('workspaceTitle').textContent = title;
    document.getElementById('workspaceDescription').textContent = description;
    document.title = `${title} - SkyNetApi`;
  }

  function wireCreator() {
    const form = document.getElementById('stickerCreateFormV1');
    const file = document.getElementById('stickerCreateFileV1');
    const preview = document.getElementById('stickerCreatePreviewV1');
    const meta = document.getElementById('stickerCreateMetaV1');
    const message = document.getElementById('stickerCreateMessageV1');
    let objectUrl = '';
    const show = selected => {
      if (!selected) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(selected);
      preview.innerHTML = `<img src="${objectUrl}" alt="Prévia">`;
      meta.textContent = `${selected.name} · ${formatBytes(selected.size)}`;
    };
    preview.addEventListener('click',() => file.click());
    file.addEventListener('change',() => show(file.files?.[0]));
    for (const name of ['dragenter','dragover']) preview.addEventListener(name,event => { event.preventDefault(); preview.classList.add('dragging'); });
    for (const name of ['dragleave','drop']) preview.addEventListener(name,event => { event.preventDefault(); preview.classList.remove('dragging'); });
    preview.addEventListener('drop',event => {
      const selected = event.dataTransfer?.files?.[0];
      if (!selected) return;
      try { const dt = new DataTransfer(); dt.items.add(selected); file.files = dt.files; show(selected); } catch { show(selected); }
    });
    form.addEventListener('submit',async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      S.message(message,'','success');
      try {
        const body = new FormData(form);
        await S.api('/api/stickers/create',{method:'POST',body});
        S.message(message,'Figurinha criada e adicionada à sua biblioteca.','success');
        form.reset(); preview.textContent = 'Toque para escolher'; meta.textContent = 'Máx. 8 MB · 512 px';
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ''; }
        await getLibrary(true); await renderPageLibrary('mine');
        document.querySelectorAll('[data-page-sticker-tab]').forEach(item => item.classList.toggle('active',item.dataset.pageStickerTab === 'mine'));
      } catch (error) { S.message(message,error.message || 'Falha ao criar figurinha.','error'); }
      finally { button.disabled = false; }
    });
  }

  async function renderPageLibrary(tab) {
    const host = document.getElementById('stickerPageContentV1');
    if (!host) return;
    try { await getLibrary(); } catch (error) { host.innerHTML = `<div class="sticker-empty-v1">${escapeHtml(error.message)}</div>`; return; }
    if (tab === 'packs') {
      host.className = 'sticker-packs-v1';
      host.innerHTML = library.packs.map(pack => `<section class="sticker-pack-block-v1"><h4>${escapeHtml(pack.name)}</h4><div class="sticker-page-grid-v1">${pack.stickers.map(item => pageStickerCard(item,false)).join('')}</div></section>`).join('');
    } else {
      host.className = 'sticker-page-grid-v1';
      const items = tab === 'mine' ? library.custom : tab === 'favorites' ? library.favorites : library.recents;
      host.innerHTML = items.length ? items.map(item => pageStickerCard(item,tab === 'mine')).join('') : '<div class="sticker-empty-v1">Nada aqui ainda.</div>';
    }
    wirePageActions(host,tab);
  }

  function pageStickerCard(item,own) {
    return `<article class="sticker-page-card-v1"><div class="visual"><img src="${escapeAttr(item.url || stickerUrl(item.id))}" alt="${escapeAttr(item.name)}" loading="lazy" decoding="async"></div><strong>${escapeHtml(item.name)}</strong><span>${item.animated ? `Animada · ${(Number(item.durationMs || 0)/1000).toFixed(1)}s` : 'Estática'}${item.pack ? ` · ${escapeHtml(item.pack)}` : ''}</span><div class="sticker-page-actions-v1"><button class="button" type="button" data-page-favorite="${escapeAttr(item.id)}">★</button>${own ? `<button class="button danger" type="button" data-page-delete="${escapeAttr(item.id)}">Excluir</button>` : ''}</div></article>`;
  }

  function wirePageActions(host,tab) {
    host.querySelectorAll('[data-page-favorite]').forEach(button => button.addEventListener('click',async () => {
      const id = button.dataset.pageFavorite;
      const isFavorite = (library.favorites || []).some(item => item.id === id);
      await S.api(`/api/stickers/${encodeURIComponent(id)}/favorite`,{method:'PATCH',body:{favorite:!isFavorite}});
      await getLibrary(true); await renderPageLibrary(tab);
    }));
    host.querySelectorAll('[data-page-delete]').forEach(button => button.addEventListener('click',async () => {
      if (!confirm('Remover esta figurinha da sua biblioteca? Mensagens antigas podem deixar de exibi-la se a conta for apagada.')) return;
      await S.api(`/api/stickers/${encodeURIComponent(button.dataset.pageDelete)}`,{method:'DELETE'});
      await getLibrary(true); await renderPageLibrary(tab);
    }));
  }

  function formatBytes(bytes) { const n=Number(bytes||0); return n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(1)} KB`:`${(n/1024/1024).toFixed(1)} MB`; }
  function escapeHtml(value) { const div=document.createElement('div'); div.textContent=String(value??''); return div.innerHTML; }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g,'&#96;'); }
})();
