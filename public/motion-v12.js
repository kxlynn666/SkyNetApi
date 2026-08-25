(() => {
  if (window.__SKYNET_MOTION_V12__) return;
  window.__SKYNET_MOTION_V12__ = true;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet();
  let observer = null;
  let scheduled = false;

  function getObserver() {
    if (observer || reduceMotion.matches) return observer;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('ux-visible');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
    return observer;
  }

  function eligible(root = document) {
    const selectors = [
      '.hero', '.home-section', '.podium-wrap',
      '.workspace-content > section', '.workspace-content > .workspace-card',
      '.workspace-page-grid > .workspace-card', '.workspace-stat-grid > .workspace-stat',
      '.profile-v3-shell > section', '.chat-layout', '.sticker-page-v1 > section',
      '#app > header', '#app > .stats', '#app > .tabs', '#app > .tab-panel.active > .card'
    ].join(',');
    const nodes = [];
    if (root.nodeType === 1 && root.matches?.(selectors)) nodes.push(root);
    nodes.push(...(root.querySelectorAll?.(selectors) || []));
    return nodes;
  }

  function prepare(root = document) {
    const nodes = eligible(root).filter(node => !seen.has(node));
    nodes.forEach((node, index) => {
      seen.add(node);
      if (reduceMotion.matches) {
        node.classList.add('ux-visible');
        return;
      }
      node.classList.add('ux-enter');
      node.style.transitionDelay = `${Math.min(index, 7) * 34}ms`;
      getObserver()?.observe(node);
    });

    const pressables = root.querySelectorAll?.('.button,.nav-link,.workspace-nav-link,.workspace-quick,.profile-v3-tab,.chat-conversation,.sticker-item-v1') || [];
    pressables.forEach(node => node.classList.add('ux-press'));
  }

  function schedule(root = document) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      prepare(root);
    });
  }

  function boot() {
    prepare(document);
    const root = document.getElementById('workspaceContent') || document.body;
    const mutations = new MutationObserver(records => {
      const added = [];
      for (const record of records) for (const node of record.addedNodes || []) if (node.nodeType === 1) added.push(node);
      if (!added.length) return;
      schedule(root);
    });
    mutations.observe(root, { childList: true, subtree: true });
  }

  reduceMotion.addEventListener?.('change', () => {
    if (!reduceMotion.matches) return;
    observer?.disconnect();
    observer = null;
    document.querySelectorAll('.ux-enter').forEach(node => node.classList.add('ux-visible'));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
