(() => {
  if (window.__SKYNET_PROFILE_PREVIEW_V2__) return;
  window.__SKYNET_PROFILE_PREVIEW_V2__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  const S = window.SkyNet;
  if (!S) return;

  let catalog = [];
  let store = null;
  let social = null;
  let scheduled = false;
  let previewItem = null;

  const byId = new Map();
  const byName = new Map();

  function esc(value) { return S.escapeHtml(value == null ? '' : String(value)); }

  async function boot() {
    try {
      const [catalogData, storeData, socialData] = await Promise.all([
        S.api('/api/profile-store/catalog'),
        S.api('/api/profile-store/me'),
        S.api('/api/social/me')
      ]);
      catalog = Array.isArray(catalogData.catalog) ? catalogData.catalog : [];
      store = storeData;
      social = socialData;
      for (const item of catalog) {
        byId.set(item.id, item);
        byName.set(String(item.name || '').trim().toLowerCase(), item);
      }
      enhance();
      observe();
    } catch {}
  }

  function observe() {
    const root = document.getElementById('workspaceContent');
    if (!root) return;
    const observer = new MutationObserver(records => {
      if (!records.some(record => [...record.addedNodes].some(node => node.nodeType === 1))) return;
      scheduleEnhance();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  }

  function enhance() {
    enhanceStoreCards();
    enhanceInventory();
    installPreviewBar();
  }

  function resolveProduct(card) {
    const id = card.dataset.catalogId;
    if (id && byId.has(id)) return byId.get(id);
    const name = String(card.querySelector('.profile-v3-product-title strong')?.textContent || '').trim().toLowerCase();
    return byName.get(name) || null;
  }

  function miniVisual(item, className = '') {
    const avatar = social?.account?.avatarUrl || '';
    const initial = String(social?.account?.profile?.displayName || social?.account?.username || '?').slice(0, 1).toUpperCase();
    const colors = item.colors || ['#8b5cf6', '#22d3ee'];

    if (item.type === 'frame') {
      return `<div class="profile-preview-mini ${className}" data-preview-kind="frame"><div class="cosmetic-avatar" data-frame="${esc(item.id)}"><div class="cosmetic-avatar-inner">${avatar ? `<img src="${esc(avatar)}" alt="">` : esc(initial)}</div></div></div>`;
    }
    if (item.type === 'decoration') {
      return `<div class="profile-preview-mini ${className}" data-preview-kind="decoration"><div class="profile-preview-mini-surface profile-surface" data-decoration="${esc(item.id)}"><span class="profile-preview-mini-avatar">${avatar ? `<img src="${esc(avatar)}" alt="">` : esc(initial)}</span><i></i></div></div>`;
    }
    return `<div class="profile-preview-mini ${className}" data-preview-kind="tag"><span class="profile-tag" data-collection="${esc(item.collection || 'core')}" data-animated="${item.animated ? '1' : '0'}" style="--tag-a:${esc(colors[0])};--tag-b:${esc(colors[1] || colors[0])}">${esc(item.name)}</span></div>`;
  }

  function enhanceStoreCards() {
    document.querySelectorAll('.profile-v3-product').forEach(card => {
      const item = resolveProduct(card);
      if (!item) return;
      card.dataset.previewItemId = item.id;

      const visual = card.querySelector('.profile-v3-product-visual');
      if (visual && visual.dataset.realPreview !== '1') {
        visual.dataset.realPreview = '1';
        visual.classList.add('profile-preview-product-visual');
        visual.innerHTML = miniVisual(item, 'profile-preview-store-mini');
      }

      if (!card.querySelector('[data-preview-cosmetic]')) {
        const buy = card.querySelector('[data-buy-profile-item], .profile-v3-product > .button');
        const actions = document.createElement('div');
        actions.className = 'profile-preview-product-actions';
        actions.innerHTML = `<button class="button small" type="button" data-preview-cosmetic="${esc(item.id)}">Visualizar</button>`;
        if (buy?.parentNode === card) card.insertBefore(actions, buy);
        else card.appendChild(actions);
      }

      if (item.animated && !card.querySelector('.profile-preview-animated-badge')) {
        const badge = document.createElement('span');
        badge.className = 'profile-preview-animated-badge';
        badge.textContent = 'ANIMADO';
        card.querySelector('.profile-v3-product-title')?.appendChild(badge);
      }
    });
  }

  function enhanceInventory() {
    const form = document.getElementById('profileV3EquipForm');
    if (!form || !store || form.querySelector('#profileInventoryShowroomV2')) return;
    const owned = (store.inventory || []).map(entry => entry.item).filter(Boolean);
    if (!owned.length) return;

    const box = document.createElement('section');
    box.id = 'profileInventoryShowroomV2';
    box.className = 'profile-inventory-showroom-v2';
    box.innerHTML = `
      <div class="profile-inventory-showroom-head">
        <div><strong>Galeria do inventário</strong><span>Veja qualquer item no seu cartão sem equipar.</span></div>
        <span>${owned.length} itens</span>
      </div>
      <div class="profile-inventory-showroom-grid">
        ${owned.map(item => `<article class="profile-inventory-preview-card" data-preview-owned="${esc(item.id)}">
          ${miniVisual(item, 'profile-preview-inventory-mini')}
          <div class="profile-inventory-preview-copy"><strong>${esc(item.name)}</strong><span>${esc(typeLabel(item.type))} · ${esc(item.rarity || '')}${item.animated ? ' · animado' : ''}</span></div>
          <button class="button small" type="button" data-preview-cosmetic="${esc(item.id)}">Visualizar</button>
        </article>`).join('')}
      </div>`;
    form.appendChild(box);
  }

  function typeLabel(type) {
    return type === 'frame' ? 'moldura' : type === 'decoration' ? 'decoração' : 'tag';
  }

  function installPreviewBar() {
    const preview = document.querySelector('.profile-v3-preview');
    if (!preview || preview.querySelector('.profile-preview-livebar-v2')) return;
    const bar = document.createElement('div');
    bar.className = 'profile-preview-livebar-v2';
    bar.hidden = true;
    bar.innerHTML = `<div><span>PRÉVIA</span><strong id="profilePreviewLiveNameV2">Item</strong><small>Somente visual — não foi equipado.</small></div><button class="button small" type="button" data-preview-reset>Voltar ao equipado</button>`;
    preview.appendChild(bar);
  }

  function currentCosmetics() {
    return store?.cosmetics || { tags: [], frame: null, decoration: null };
  }

  function renderTags(tags) {
    const preview = document.querySelector('.profile-v3-preview');
    const copy = preview?.querySelector('.profile-v3-copy');
    if (!copy) return;
    copy.querySelector('.profile-tags')?.remove();
    if (!tags?.length) return;
    const holder = document.createElement('div');
    holder.className = 'profile-tags';
    for (const tag of tags.slice(0, 3)) {
      const colors = tag.colors || ['#7c3aed', '#a78bfa'];
      const span = document.createElement('span');
      span.className = 'profile-tag';
      span.dataset.collection = tag.collection || 'core';
      span.dataset.animated = tag.animated ? '1' : '0';
      span.style.setProperty('--tag-a', colors[0]);
      span.style.setProperty('--tag-b', colors[1] || colors[0]);
      span.textContent = tag.name || '';
      holder.appendChild(span);
    }
    copy.appendChild(holder);
  }

  function applyPreview(item) {
    const preview = document.querySelector('.profile-v3-preview');
    if (!preview || !item) return;
    const equipped = currentCosmetics();
    previewItem = item;

    preview.dataset.decoration = item.type === 'decoration' ? item.id : (equipped.decoration?.id || '');
    const avatar = preview.querySelector('.cosmetic-avatar');
    if (avatar) avatar.dataset.frame = item.type === 'frame' ? item.id : (equipped.frame?.id || '');

    const tags = [...(equipped.tags || [])];
    if (item.type === 'tag') {
      const without = tags.filter(tag => tag.id !== item.id);
      renderTags([item, ...without].slice(0, 3));
    } else renderTags(tags);

    preview.classList.add('profile-preview-live-v2');
    const bar = preview.querySelector('.profile-preview-livebar-v2');
    if (bar) {
      bar.hidden = false;
      const name = bar.querySelector('#profilePreviewLiveNameV2');
      if (name) name.textContent = item.name || 'Item';
    }

    document.querySelectorAll('[data-preview-item-id], [data-preview-owned]').forEach(card => {
      const id = card.dataset.previewItemId || card.dataset.previewOwned;
      card.classList.toggle('profile-preview-selected-v2', id === item.id);
    });
    preview.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function resetPreview() {
    const preview = document.querySelector('.profile-v3-preview');
    if (!preview) return;
    const equipped = currentCosmetics();
    preview.dataset.decoration = equipped.decoration?.id || '';
    const avatar = preview.querySelector('.cosmetic-avatar');
    if (avatar) avatar.dataset.frame = equipped.frame?.id || '';
    renderTags(equipped.tags || []);
    preview.classList.remove('profile-preview-live-v2');
    const bar = preview.querySelector('.profile-preview-livebar-v2');
    if (bar) bar.hidden = true;
    document.querySelectorAll('.profile-preview-selected-v2').forEach(card => card.classList.remove('profile-preview-selected-v2'));
    previewItem = null;
  }

  document.addEventListener('click', event => {
    const previewButton = event.target.closest?.('[data-preview-cosmetic]');
    if (previewButton) {
      event.preventDefault();
      event.stopPropagation();
      const item = byId.get(previewButton.dataset.previewCosmetic);
      if (item) applyPreview(item);
      return;
    }
    if (event.target.closest?.('[data-preview-reset]')) {
      event.preventDefault();
      resetPreview();
    }
  }, true);

  window.SkyNetProfilePreview = {
    preview(id) { const item = byId.get(id); if (item) applyPreview(item); },
    reset: resetPreview,
    get activeItem() { return previewItem; }
  };

  boot();
})();
