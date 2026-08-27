(() => {
  if (window.__SKYNET_PROFILE_STORE_PERFORMANCE_V1__) return;
  window.__SKYNET_PROFILE_STORE_PERFORMANCE_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  const style = document.createElement('style');
  style.id = 'profileStorePerformanceV1Styles';
  style.textContent = `
    [data-profile-panel="store"] .profile-v3-store{contain:layout style;align-items:start}
    [data-profile-panel="store"] .profile-v3-product{content-visibility:auto;contain-intrinsic-size:205px;contain:layout paint style}
    [data-profile-panel="store"] .profile-v3-product[data-sky-type-hidden="1"]{display:none!important}
    [data-profile-panel="store"] .profile-v3-product.store-card-sleep,
    [data-profile-panel="store"] .profile-v3-product.store-card-sleep *,
    [data-profile-panel="store"] .profile-v3-product.store-card-sleep::before,
    [data-profile-panel="store"] .profile-v3-product.store-card-sleep::after{animation-play-state:paused!important}
    [data-profile-panel="store"] .profile-v3-product.store-card-sleep{box-shadow:none!important}
    [data-profile-panel="store"] .profile-v3-product-visual{contain:paint}
  `;
  document.head.appendChild(style);

  const watched = new WeakSet();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('store-card-sleep', !entry.isIntersecting);
  }, { rootMargin:'260px 0px', threshold:0 }) : null;

  function cardType(card) {
    const visual = card.querySelector('.profile-v3-product-visual');
    if (visual?.classList.contains('tag')) return 'tag';
    if (visual?.classList.contains('frame')) return 'frame';
    if (visual?.classList.contains('decoration')) return 'decoration';
    return '';
  }

  function watch(card) {
    if (!card || watched.has(card)) return;
    watched.add(card);
    card.dataset.skyStoreType = cardType(card);
    io?.observe(card);
  }

  function scan(root = document) {
    const cards = [];
    if (root.matches?.('.profile-v3-product')) cards.push(root);
    cards.push(...(root.querySelectorAll?.('.profile-v3-product') || []));
    cards.forEach(watch);
  }

  function applyTypeFilter(button) {
    const panel = button.closest('[data-profile-panel="store"]');
    if (!panel) return false;
    const type = button.dataset.storeFilter || 'all';
    panel.dataset.skyStoreFilter = type;
    panel.querySelectorAll('[data-store-filter]').forEach(item => item.classList.toggle('active', item === button));
    panel.querySelectorAll('.profile-v3-product').forEach(card => {
      const cardTypeValue = card.dataset.skyStoreType || cardType(card);
      card.dataset.skyStoreType = cardTypeValue;
      card.dataset.skyTypeHidden = type !== 'all' && cardTypeValue !== type ? '1' : '0';
    });
    return true;
  }

  // Capture before the legacy handler, which rebuilt the entire store with innerHTML.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-store-filter]');
    if (!button || !button.closest('[data-profile-panel="store"]')) return;
    if (!applyTypeFilter(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  const root = document.getElementById('workspaceContent') || document.documentElement;
  let raf = 0;
  const pending = new Set();
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) pending.add(node);
    if (!pending.size || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const roots = [...pending];
      pending.clear();
      roots.forEach(scan);
      const panel = document.querySelector('[data-profile-panel="store"]');
      const active = panel?.querySelector(`[data-store-filter="${CSS.escape(panel.dataset.skyStoreFilter || 'all')}"]`);
      if (active) applyTypeFilter(active);
    });
  }).observe(root,{childList:true,subtree:true});

  scan();
})();
