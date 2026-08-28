(() => {
  if (window.__SKYNET_STORE_FILTER_CONTROLLER_V2__) return;
  window.__SKYNET_STORE_FILTER_CONTROLLER_V2__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  const TYPES = new Set(['all', 'tag', 'frame', 'decoration', 'name-decoration']);
  let scheduled = false;

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
    const value = String(panel.dataset.storeTypeFilter || 'all');
    return TYPES.has(value) ? value : 'all';
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

  function apply(panel, type) {
    if (!panel || !TYPES.has(type)) return;
    panel.dataset.storeTypeFilter = type;
    delete panel.dataset.nameDecorationFilterV1;
    stampCards(panel);
    setActiveButton(panel, type);
    panel.dispatchEvent(new CustomEvent('skynet:store-type-filter', { bubbles: true, detail: { type } }));
    fallbackApply(panel);
  }

  function enhance() {
    const panel = document.querySelector('[data-profile-panel="store"]');
    if (!panel) return;
    ensureNameButton(panel);
    stampCards(panel);
    if (!panel.dataset.storeTypeFilter) {
      const active = panel.querySelector('.profile-v3-store-filter button.active');
      panel.dataset.storeTypeFilter = typeFromButton(active) || 'all';
    }
    setActiveButton(panel, currentType(panel));
    fallbackApply(panel);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-profile-panel="store"] .profile-v3-store-filter button');
    if (!button) return;
    const type = typeFromButton(button);
    if (!type) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const panel = button.closest('[data-profile-panel="store"]');
    apply(panel, type);
  }, true);

  const root = document.getElementById('workspaceContent') || document.documentElement;
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
})();
