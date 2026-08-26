(() => {
  if (window.__SKYNET_MOTION_REPEAT_V1__) return;
  window.__SKYNET_MOTION_REPEAT_V1__ = true;

  if (!('IntersectionObserver' in window)) return;

  const observed = new WeakSet();
  const leaveTimers = new WeakMap();

  const setVisible = (node, visible) => {
    const timer = leaveTimers.get(node);
    if (timer) {
      clearTimeout(timer);
      leaveTimers.delete(node);
    }

    if (visible) {
      node.classList.add('v16-visible');
      node.querySelectorAll?.('h1,h2,h3').forEach(h => h.classList.add('v16-heading-on'));
      return;
    }

    // Avoid flicker at viewport boundaries, but re-arm once the item is really gone.
    const id = setTimeout(() => {
      if (!node.isConnected) return;
      node.classList.remove('v16-visible');
      node.querySelectorAll?.('h1,h2,h3').forEach(h => h.classList.remove('v16-heading-on'));
      leaveTimers.delete(node);
    }, 70);
    leaveTimers.set(node, id);
  };

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) setVisible(entry.target, entry.isIntersecting);
  }, {
    threshold: 0,
    rootMargin: '2% 0px 2% 0px'
  });

  function observeNode(node) {
    if (!(node instanceof Element)) return;
    const items = [];
    if (node.matches?.('.v16-reveal')) items.push(node);
    items.push(...(node.querySelectorAll?.('.v16-reveal') || []));
    for (const item of items) {
      if (observed.has(item)) continue;
      observed.add(item);
      observer.observe(item);
    }
  }

  function scan() {
    observeNode(document.documentElement);
  }

  scan();

  const mutations = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) observeNode(node);
    }
  });
  mutations.observe(document.documentElement, { childList:true, subtree:true });

  // Motion v16 can decorate existing nodes shortly after this script starts.
  setTimeout(scan, 250);
  setTimeout(scan, 900);
})();
