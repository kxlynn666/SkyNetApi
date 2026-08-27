(() => {
  if (window.__SKYNET_PROFILE_NAME_DECORATIONS_V1__) return;
  window.__SKYNET_PROFILE_NAME_DECORATIONS_V1__ = true;
  const S = window.SkyNet;
  if (!S) return;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  let store = null;
  let catalog = [];
  let loading = null;
  let scheduled = false;
  let requestNameFilter = false;
  let namePreviewBaseline = '';
  let namePreviewActive = false;
  const byId = new Map();
  const byName = new Map();

  ensureStyle();
  boot().catch(() => {});

  function ensureStyle() {
    if (document.querySelector('link[href="/profile-name-decorations-v1.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/profile-name-decorations-v1.css';
    link.dataset.profileNameDecorationsV1 = '1';
    document.head.appendChild(link);
  }

  async function boot() {
    if (path === '/painel/perfil') {
      await refreshStore();
      enhanceProfile();
      observe(document.getElementById('workspaceContent') || document.documentElement);
      document.addEventListener('click', handleProfileClick, true);
      document.addEventListener('input', handleStoreControlChange, true);
      document.addEventListener('change', handleStoreControlChange, true);
      return;
    }
    if (path.startsWith('/u/')) {
      await enhancePublicProfile();
      observe(document.getElementById('publicProfileRoot') || document.documentElement);
      return;
    }
    if (path === '/') {
      await enhancePodium();
      observe(document.getElementById('podiumRoot') || document.documentElement);
    }
  }

  async function refreshStore() {
    if (loading) return loading;
    loading = S.api('/api/profile-store/me').then(data => {
      setStore(data);
      return data;
    }).finally(() => { loading = null; });
    return loading;
  }

  function setStore(data) {
    store = data || store;
    catalog = Array.isArray(store?.catalog) ? store.catalog : catalog;
    byId.clear();
    byName.clear();
    for (const item of catalog) {
      if (!item?.id) continue;
      byId.set(item.id, item);
      byName.set(String(item.name || '').trim().toLowerCase(), item);
    }
  }

  function observe(root) {
    if (!root) return;
    const observer = new MutationObserver(() => scheduleEnhance());
    observer.observe(root, { childList:true, subtree:true });
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (path === '/painel/perfil') enhanceProfile();
      else if (path.startsWith('/u/')) enhancePublicDom();
      else if (path === '/') enhancePodiumDom();
    });
  }

  function resolveProduct(card) {
    const id = card?.dataset?.catalogId || card?.dataset?.previewItemId;
    if (id && byId.has(id)) return byId.get(id);
    const name = String(card?.querySelector?.('.profile-v3-product-title strong')?.textContent || '').trim().toLowerCase();
    return byName.get(name) || null;
  }

  function enhanceProfile() {
    if (!store) return;
    markEquippedName(document);
    enhanceAppearance();
    enhanceStore();
  }

  function markEquippedName(root) {
    const id = store?.equipped?.nameDecorationId || store?.cosmetics?.nameDecoration?.id || '';
    root.querySelectorAll?.('.profile-v3-preview .profile-v3-copy h2').forEach(node => setNameDecoration(node, id));
  }

  function enhanceAppearance() {
    const form = document.getElementById('profileV3EquipForm');
    if (!form || form.querySelector('#profileNameDecorationSelectV1')) return;
    const owned = (store?.inventory || []).map(entry => entry?.item).filter(item => item?.type === 'name-decoration');
    const group = document.createElement('div');
    group.className = 'form-group profile-name-decoration-picker-v1';
    group.innerHTML = `<label for="profileNameDecorationSelectV1">Decoração do nome</label><select id="profileNameDecorationSelectV1"><option value="">Sem decoração de nome</option>${owned.map(item => `<option value="${esc(item.id)}" ${store?.equipped?.nameDecorationId === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select><div class="hint" style="margin-top:5px">Aplica o efeito ao nome de exibição no perfil e no pódio.</div>`;
    const inline = form.querySelector('.profile-v3-inline');
    if (inline) inline.appendChild(group); else form.insertBefore(group, form.firstChild);
    group.querySelector('select')?.addEventListener('change', async event => {
      const select = event.currentTarget;
      const message = document.getElementById('profileV3EquipMessage');
      select.disabled = true;
      try {
        const data = await S.api('/api/profile-store/equipped', { method:'PATCH', body:{ nameDecorationId:select.value } });
        setStore(data);
        setNameDecoration(document.querySelector('.profile-v3-preview .profile-v3-copy h2'), data?.equipped?.nameDecorationId || '');
        if (message) S.message(message, 'Decoração do nome atualizada.', 'success');
      } catch (error) {
        if (message) S.message(message, error.message, 'error');
        select.value = store?.equipped?.nameDecorationId || '';
      } finally { select.disabled = false; }
    });
  }

  function enhanceStore() {
    const panel = document.querySelector('[data-profile-panel="store"]');
    if (!panel) return;
    const hint = panel.querySelector('.profile-v3-store-head .hint');
    if (hint && !/nome/i.test(hint.textContent || '')) hint.textContent = 'Tags, molduras, decorações e efeitos de nome são permanentes depois da compra.';
    installNameFilter(panel);
    panel.querySelectorAll('.profile-v3-product').forEach(card => {
      const item = resolveProduct(card);
      if (!item) return;
      card.dataset.profileItemType = item.type || '';
      if (item.type !== 'name-decoration') return;
      card.dataset.catalogId = item.id;
      const visual = card.querySelector('.profile-v3-product-visual');
      if (visual && visual.dataset.namePreviewV1 !== item.id) {
        visual.dataset.namePreviewV1 = item.id;
        visual.className = 'profile-v3-product-visual name-decoration';
        visual.innerHTML = `<span class="profile-name-decoration-demo" data-name-decoration="${esc(item.id)}">Seu nome</span>`;
      }
    });
    if (requestNameFilter) {
      requestNameFilter = false;
      activateNameFilter(panel);
    } else if (panel.dataset.nameDecorationFilterV1 === '1') {
      updateNameFilterCount(panel);
    }
  }

  function installNameFilter(panel) {
    const row = panel.querySelector('.profile-v3-store-filter');
    if (!row) return;
    let button = row.querySelector('[data-name-decoration-filter-v1]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.nameDecorationFilterV1 = '1';
      button.textContent = 'Nome';
      row.appendChild(button);
      button.addEventListener('click', () => {
        const all = row.querySelector('[data-store-filter="all"]');
        if (all && !all.classList.contains('active')) {
          requestNameFilter = true;
          all.click();
          return;
        }
        activateNameFilter(panel);
      });
    }
    button.classList.toggle('active', panel.dataset.nameDecorationFilterV1 === '1');
  }

  function activateNameFilter(panel) {
    if (!panel) return;
    panel.dataset.nameDecorationFilterV1 = '1';
    const row = panel.querySelector('.profile-v3-store-filter');
    const button = row?.querySelector('[data-name-decoration-filter-v1]');
    row?.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    updateNameFilterCount(panel);
  }

  function updateNameFilterCount(panel) {
    const names = [...panel.querySelectorAll('.profile-v3-product')].filter(card => card.dataset.profileItemType === 'name-decoration');
    const visible = names.filter(card => !card.hidden).length;
    const counter = panel.querySelector('.profile-store-count-v5');
    if (counter) counter.textContent = `${visible} de ${names.length} efeitos de nome`;
  }

  function handleStoreControlChange(event) {
    if (!event.target.closest?.('.profile-store-tools-v5')) return;
    const panel = document.querySelector('[data-profile-panel="store"][data-name-decoration-filter-v1="1"]');
    if (panel) requestAnimationFrame(() => updateNameFilterCount(panel));
  }

  function handleProfileClick(event) {
    const builtinFilter = event.target.closest?.('[data-store-filter]');
    if (builtinFilter) {
      const panel = builtinFilter.closest('[data-profile-panel="store"]');
      if (panel) delete panel.dataset.nameDecorationFilterV1;
      return;
    }

    const buy = event.target.closest?.('[data-buy-profile-item]');
    if (buy) {
      const item = byId.get(buy.dataset.buyProfileItem);
      if (item?.type === 'name-decoration') setTimeout(async () => {
        try { await refreshStore(); enhanceProfile(); } catch {}
      }, 420);
    }

    const preview = event.target.closest?.('[data-preview-cosmetic]');
    if (preview) {
      const item = byId.get(preview.dataset.previewCosmetic);
      if (item?.type === 'name-decoration') {
        const name = document.querySelector('.profile-v3-preview .profile-v3-copy h2');
        if (name) {
          if (!namePreviewActive) namePreviewBaseline = store?.equipped?.nameDecorationId || '';
          namePreviewActive = true;
          requestAnimationFrame(() => setNameDecoration(name, item.id));
        }
      }
      return;
    }

    if (event.target.closest?.('[data-preview-reset]') && namePreviewActive) {
      namePreviewActive = false;
      requestAnimationFrame(() => setNameDecoration(document.querySelector('.profile-v3-preview .profile-v3-copy h2'), namePreviewBaseline));
    }
  }

  async function enhancePublicProfile() {
    const username = decodeURIComponent(path.split('/').filter(Boolean)[1] || '');
    if (!username) return;
    try {
      const data = await S.api(`/api/profile-v3/profile/${encodeURIComponent(username)}`);
      window.__SKYNET_PUBLIC_NAME_DECORATION_V1__ = data?.profile?.cosmetics?.nameDecoration?.id || '';
      enhancePublicDom();
    } catch {}
  }

  function enhancePublicDom() {
    const id = window.__SKYNET_PUBLIC_NAME_DECORATION_V1__ || '';
    document.querySelectorAll('.public-profile-v3 .public-copy-v3 h1').forEach(node => setNameDecoration(node, id));
  }

  async function enhancePodium() {
    try {
      const data = await S.api('/api/profile-v3/leaderboard?limit=20');
      const map = {};
      for (const entry of data?.leaderboard || []) map[String(entry.username || '').toLowerCase()] = entry?.cosmetics?.nameDecoration?.id || '';
      window.__SKYNET_PODIUM_NAME_DECORATIONS_V1__ = map;
      enhancePodiumDom();
    } catch {}
  }

  function enhancePodiumDom() {
    const map = window.__SKYNET_PODIUM_NAME_DECORATIONS_V1__ || {};
    document.querySelectorAll('a[href^="/u/"]').forEach(link => {
      const match = link.getAttribute('href')?.match(/^\/u\/([^/?#]+)/);
      if (!match) return;
      let username = '';
      try { username = decodeURIComponent(match[1]).toLowerCase(); } catch { username = match[1].toLowerCase(); }
      const id = map[username] || '';
      const name = link.querySelector('.podium-name-v3,.leaderboard-copy strong,.panel-mini-podium-name');
      if (name) setNameDecoration(name, id);
    });
  }

  function setNameDecoration(node, id) {
    if (!node) return;
    const clean = String(id || '').replace(/[^a-z0-9_-]/gi, '').slice(0,80);
    if (clean) node.dataset.nameDecoration = clean; else delete node.dataset.nameDecoration;
  }

  function esc(value) { return S.escapeHtml(value == null ? '' : String(value)); }
})();
