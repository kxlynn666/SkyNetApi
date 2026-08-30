(() => {
  if (window.__SKYNET_STORE_FILTER_CONTROLLER_V2__) return;
  window.__SKYNET_STORE_FILTER_CONTROLLER_V2__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  const S = window.SkyNet;
  const TYPES = new Set(['all', 'tag', 'frame', 'decoration', 'name-decoration']);
  let scheduled = false;
  let preferredType = 'all';

  function typeFromButton(button) {
    if (!button) return '';
    if (button.hasAttribute('data-name-decoration-filter-v1')) return 'name-decoration';
    const value = String(button.dataset.storeFilter || '').trim();
    return TYPES.has(value) ? value : '';
  }

  function typeFromCard(card) {
    const declared = String(card.dataset.profileItemType || '').trim();
    if (declared) return declared;
    const visual = card.querySelector('.profile-v3-product-visual');
    if (!visual) return '';
    if (visual.classList.contains('name-decoration')) return 'name-decoration';
    if (visual.classList.contains('tag')) return 'tag';
    if (visual.classList.contains('frame')) return 'frame';
    if (visual.classList.contains('decoration')) return 'decoration';
    return '';
  }

  function stampCards(panel) {
    panel.querySelectorAll('.profile-v3-product').forEach(card => {
      const type = typeFromCard(card);
      if (type) card.dataset.profileItemType = type;
    });
  }

  function ensureNameButton(panel) {
    const row = panel.querySelector('.profile-v3-store-filter');
    if (!row || row.querySelector('[data-name-decoration-filter-v1]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.nameDecorationFilterV1 = '1';
    button.textContent = 'Nome';
    row.appendChild(button);
  }

  function currentType(panel) {
    const value = String(panel.dataset.storeTypeFilter || preferredType || 'all');
    return TYPES.has(value) ? value : 'all';
  }

  function syncLegacyNameFlag(panel, type) {
    if (type === 'name-decoration') panel.dataset.nameDecorationFilterV1 = '1';
    else delete panel.dataset.nameDecorationFilterV1;
  }

  function setActiveButton(panel, type) {
    const row = panel.querySelector('.profile-v3-store-filter');
    if (!row) return;
    row.querySelectorAll('button').forEach(button => {
      button.classList.toggle('active', typeFromButton(button) === type);
    });
  }

  function fallbackApply(panel) {
    const type = currentType(panel);
    const store = panel.querySelector('.profile-v3-store');
    if (!store) return;
    const tools = panel.querySelector('.profile-store-tools-v5');
    if (tools) return;
    store.querySelectorAll('.profile-v3-product').forEach(card => {
      const cardType = typeFromCard(card);
      card.hidden = type !== 'all' && cardType !== type;
    });
  }

  function notifyOrganizer(panel, type, force = false) {
    if (!panel.querySelector('.profile-store-tools-v5')) return;
    if (!force && panel.dataset.storeFilterSyncedV2 === type) return;
    panel.dataset.storeFilterSyncedV2 = type;
    panel.dispatchEvent(new CustomEvent('skynet:store-type-filter', { bubbles: true, detail: { type } }));
  }

  function apply(panel, type) {
    if (!panel || !TYPES.has(type)) return;
    preferredType = type;
    panel.dataset.storeTypeFilter = type;
    syncLegacyNameFlag(panel, type);
    stampCards(panel);
    setActiveButton(panel, type);
    notifyOrganizer(panel, type, true);
    fallbackApply(panel);
  }

  function enhance() {
    const panel = document.querySelector('[data-profile-panel="store"]');
    if (!panel) return;
    ensureNameButton(panel);
    stampCards(panel);
    if (!panel.dataset.storeTypeFilter) {
      const initialActive = typeFromButton(panel.querySelector('.profile-v3-store-filter button.active')) || 'all';
      panel.dataset.storeTypeFilter = preferredType !== 'all' ? preferredType : initialActive;
    }
    const type = currentType(panel);
    preferredType = type;
    syncLegacyNameFlag(panel, type);
    setActiveButton(panel, type);
    fallbackApply(panel);
    notifyOrganizer(panel, type);
  }

  function syncNameInventory(storeData) {
    const select = document.getElementById('profileNameDecorationSelectV1');
    if (!select || !storeData) return;
    const owned = (storeData.inventory || []).map(entry => entry?.item).filter(item => item?.type === 'name-decoration');
    const equipped = storeData.equipped?.nameDecorationId || '';
    const options = ['<option value="">Sem decoração de nome</option>', ...owned.map(item => `<option value="${S.escapeHtml(item.id)}">${S.escapeHtml(item.name)}</option>`)].join('');
    if (select.innerHTML !== options) select.innerHTML = options;
    select.value = owned.some(item => item.id === equipped) ? equipped : '';
  }

  async function refreshAfterPurchase() {
    if (!S?.api) return;
    try {
      const data = await S.api('/api/profile-store/me');
      syncNameInventory(data);
      window.SkyNetProfilePreview?.refresh?.();
      window.dispatchEvent(new CustomEvent('skynet:store-state-refreshed', { detail: { store: data } }));
    } catch {}
  }

  function watchPurchase(button) {
    if (!button || button.dataset.storePurchaseWatchV2 === '1') return;
    button.dataset.storePurchaseWatchV2 = '1';
    const observer = new MutationObserver(() => {
      if (button.hasAttribute('data-buy-profile-item') || !button.disabled) return;
      observer.disconnect();
      refreshAfterPurchase();
    });
    observer.observe(button, { attributes: true, childList: true, subtree: true, attributeFilter: ['disabled', 'data-buy-profile-item', 'data-kind'] });
    setTimeout(() => observer.disconnect(), 10000);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  }

  window.addEventListener('click', event => {
    const buy = event.target.closest?.('[data-buy-profile-item]');
    if (buy) watchPurchase(buy);
  }, true);

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-profile-panel="store"] .profile-v3-store-filter button');
    if (!button) return;
    const type = typeFromButton(button);
    if (!type) return;
    const panel = button.closest('[data-profile-panel="store"]');

    // The original profile controller owns the built-in store categories and
    // rebuilds their card list. Do not cancel those clicks. V2 only keeps its
    // state in sync and exclusively handles the extra name-decoration filter.
    preferredType = type;
    if (type !== 'name-decoration') {
      panel.dataset.storeTypeFilter = type;
      syncLegacyNameFlag(panel, type);
      setActiveButton(panel, type);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    apply(panel, type);
  }, true);

  const root = document.getElementById('workspaceContent') || document.documentElement;
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
})();
