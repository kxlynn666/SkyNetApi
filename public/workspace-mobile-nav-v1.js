(() => {
  if (window.__SKYNET_WORKSPACE_MOBILE_NAV_V1__) return;
  window.__SKYNET_WORKSPACE_MOBILE_NAV_V1__ = true;

  const mobileQuery = window.matchMedia('(max-width:820px)');
  let sidebar = null;
  let backdrop = null;
  let menuButton = null;
  let closeButton = null;
  let nav = null;
  let lastFocus = null;
  let navObserver = null;
  let initialized = false;
  let touchStartX = null;
  let touchStartY = null;

  const isMobile = () => mobileQuery.matches;
  const isOpen = () => Boolean(sidebar?.classList.contains('open'));

  function setInert(element, value) {
    if (!element) return;
    try { element.inert = Boolean(value); }
    catch {
      if (value) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    }
  }

  function setDocumentLock(locked) {
    document.documentElement.classList.toggle('workspace-nav-open', locked);
    document.body.classList.toggle('workspace-nav-open', locked);
  }

  function syncButton(open) {
    if (!menuButton) return;
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }

  function syncSidebarState(open) {
    if (!sidebar || !backdrop) return;
    sidebar.classList.toggle('open', open);
    backdrop.classList.toggle('hidden', !open);
    sidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
    setInert(sidebar, !open);
    setDocumentLock(open);
    syncButton(open);
  }

  function activeLink() {
    return nav?.querySelector('.workspace-nav-link.active') || null;
  }

  function scrollActiveIntoView() {
    const link = activeLink();
    if (!link || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top < navRect.top || linkRect.bottom > navRect.bottom) {
      link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function openMenu({ focus = true } = {}) {
    if (!isMobile() || !sidebar || !backdrop) return;
    if (!isOpen()) lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : menuButton;
    syncSidebarState(true);
    requestAnimationFrame(() => {
      scrollActiveIntoView();
      if (focus) closeButton?.focus({ preventScroll: true });
    });
  }

  function closeMenu({ restoreFocus = true } = {}) {
    if (!sidebar || !backdrop) return;
    syncSidebarState(false);
    if (restoreFocus && lastFocus instanceof HTMLElement && document.contains(lastFocus)) {
      requestAnimationFrame(() => lastFocus.focus({ preventScroll: true }));
    }
    lastFocus = null;
  }

  function toggleMenu() {
    if (!isMobile()) return;
    if (isOpen()) closeMenu();
    else openMenu();
  }

  function focusableItems() {
    if (!sidebar) return [];
    return [...sidebar.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hidden && element.getClientRects().length > 0);
  }

  function trapFocus(event) {
    if (!isMobile() || !isOpen() || event.key !== 'Tab') return;
    const items = focusableItems();
    if (!items.length) {
      event.preventDefault();
      closeButton?.focus({ preventScroll: true });
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!sidebar.contains(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function dedupeNavigation() {
    if (!nav) return;
    const seen = new Map();
    const links = [...nav.querySelectorAll('.workspace-nav-link[href]')];
    for (const link of links) {
      let key = link.getAttribute('href') || '';
      try { key = new URL(key, location.origin).pathname.replace(/\/+$/, '') || '/'; } catch {}
      const previous = seen.get(key);
      if (!previous) {
        seen.set(key, link);
        continue;
      }
      if (link.classList.contains('active') && !previous.classList.contains('active')) {
        previous.remove();
        seen.set(key, link);
      } else {
        link.remove();
      }
    }
    nav.querySelectorAll('.workspace-nav-group').forEach(group => {
      if (!group.querySelector('.workspace-nav-link')) group.remove();
    });
  }

  function scheduleNavigationCleanup() {
    if (!nav || nav.dataset.mobileCleanupPending === '1') return;
    nav.dataset.mobileCleanupPending = '1';
    queueMicrotask(() => {
      delete nav.dataset.mobileCleanupPending;
      dedupeNavigation();
      if (isOpen()) scrollActiveIntoView();
    });
  }

  function ensureCloseButton() {
    if (!sidebar) return null;
    let button = sidebar.querySelector('#workspaceSidebarClose');
    if (!button) {
      button = document.createElement('button');
      button.id = 'workspaceSidebarClose';
      button.className = 'workspace-sidebar-close';
      button.type = 'button';
      button.setAttribute('aria-label', 'Fechar menu');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      sidebar.prepend(button);
    }
    return button;
  }

  function handleMenuButton(event) {
    if (!isMobile()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleMenu();
  }

  function handleBackdrop(event) {
    if (!isMobile() || !isOpen()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeMenu();
  }

  function handleSidebarClick(event) {
    if (!isMobile() || !event.target.closest('.workspace-nav-link')) return;
    window.setTimeout(() => closeMenu({ restoreFocus: false }), 0);
  }

  function handleKeydown(event) {
    if (!isMobile() || !isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    trapFocus(event);
  }

  function handleTouchStart(event) {
    if (!isMobile() || !isOpen() || event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }

  function resetTouchGesture() {
    touchStartX = null;
    touchStartY = null;
  }

  function handleTouchEnd(event) {
    if (touchStartX == null || touchStartY == null || !isMobile() || !isOpen()) return resetTouchGesture();
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    resetTouchGesture();
    if (dx < -64 && Math.abs(dx) > Math.abs(dy) * 1.25) closeMenu();
  }

  function syncViewportMode() {
    if (!sidebar || !backdrop || !menuButton) return;
    resetTouchGesture();
    if (isMobile()) {
      if (!isOpen()) {
        sidebar.setAttribute('aria-hidden', 'true');
        setInert(sidebar, true);
      }
      syncButton(isOpen());
    } else {
      sidebar.classList.remove('open');
      sidebar.setAttribute('aria-hidden', 'false');
      setInert(sidebar, false);
      backdrop.classList.add('hidden');
      setDocumentLock(false);
      syncButton(false);
      lastFocus = null;
    }
  }

  function setup() {
    if (initialized) return true;
    const shell = document.getElementById('workspaceShell');
    sidebar = document.getElementById('workspaceSidebar');
    backdrop = document.getElementById('workspaceSidebarBackdrop');
    menuButton = document.getElementById('workspaceMenuButton');
    if (!shell || shell.classList.contains('hidden') || !sidebar || !backdrop || !menuButton || !sidebar.querySelector('.workspace-nav')) return false;

    nav = sidebar.querySelector('.workspace-nav');
    closeButton = ensureCloseButton();
    sidebar.setAttribute('aria-label', 'Menu do workspace');
    menuButton.setAttribute('aria-controls', 'workspaceSidebar');

    menuButton.addEventListener('click', handleMenuButton, true);
    backdrop.addEventListener('click', handleBackdrop, true);
    closeButton?.addEventListener('click', () => closeMenu());
    sidebar.addEventListener('click', handleSidebarClick, true);
    sidebar.addEventListener('touchstart', handleTouchStart, { passive: true });
    sidebar.addEventListener('touchend', handleTouchEnd, { passive: true });
    sidebar.addEventListener('touchcancel', resetTouchGesture, { passive: true });
    document.addEventListener('keydown', handleKeydown, true);

    navObserver = new MutationObserver(scheduleNavigationCleanup);
    navObserver.observe(nav, { childList: true, subtree: true });

    if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', syncViewportMode);
    else mobileQuery.addListener(syncViewportMode);

    window.addEventListener('pagehide', () => {
      setDocumentLock(false);
      resetTouchGesture();
    }, { once: true });
    dedupeNavigation();
    syncViewportMode();
    initialized = true;
    return true;
  }

  if (setup()) return;
  const observer = new MutationObserver(() => {
    if (!setup()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setTimeout(() => observer.disconnect(), 15000);
})();
