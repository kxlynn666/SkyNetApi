(() => {
  if (window.__SKYNET_SMOOTH_SCROLL_V1__) return;
  window.__SKYNET_SMOOTH_SCROLL_V1__ = true;

  const softMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const root = document.scrollingElement || document.documentElement;
  const states = new Map();

  const style = document.createElement('style');
  style.id = 'skynetSmoothScrollV1Styles';
  style.textContent = `
    html{scroll-behavior:smooth;scroll-padding-top:84px}
    .workspace-nav,.workspace-content,.ttt-users,.list,.chat-messages,[data-smooth-scroll]{scroll-behavior:smooth;overscroll-behavior:contain}
    .skynet-inertial-active{scroll-behavior:auto!important}
  `;
  document.head.appendChild(style);

  function maxScroll(element) {
    return Math.max(0, element.scrollHeight - element.clientHeight);
  }

  function canScroll(element, delta) {
    const max = maxScroll(element);
    if (max < 2) return false;
    if (delta > 0) return element.scrollTop < max - 1;
    if (delta < 0) return element.scrollTop > 1;
    return false;
  }

  function isScrollable(element) {
    if (!(element instanceof Element)) return false;
    const overflow = getComputedStyle(element).overflowY;
    return /(auto|scroll|overlay)/.test(overflow) && maxScroll(element) > 1;
  }

  function scrollTarget(start, delta) {
    let element = start instanceof Element ? start : start?.parentElement;
    while (element && element !== document.body && element !== document.documentElement) {
      if (isScrollable(element) && canScroll(element, delta)) return element;
      element = element.parentElement;
    }
    return canScroll(root, delta) ? root : null;
  }

  function normalizeDelta(event) {
    let value = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) value *= 18;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) value *= innerHeight * 0.88;
    const limit = softMotion.matches ? 300 : 460;
    return Math.max(-limit, Math.min(limit, value));
  }

  function likelyTrackpad(event) {
    return event.deltaMode === WheelEvent.DOM_DELTA_PIXEL && Math.abs(event.deltaY) < 48;
  }

  function cancel(element) {
    const state = states.get(element);
    if (!state) return;
    if (state.raf) cancelAnimationFrame(state.raf);
    element.classList?.remove('skynet-inertial-active');
    states.delete(element);
  }

  function cancelAll() {
    for (const element of [...states.keys()]) cancel(element);
  }

  function animate(element) {
    const state = states.get(element);
    if (!state || state.raf) return;
    element.classList?.add('skynet-inertial-active');
    let last = performance.now();

    const frame = now => {
      const current = states.get(element);
      if (!current) return;
      const dt = Math.min(40, Math.max(1, now - last));
      last = now;
      const position = element.scrollTop;
      const diff = current.target - position;
      if (Math.abs(diff) < 0.55) {
        element.scrollTop = current.target;
        current.raf = 0;
        element.classList?.remove('skynet-inertial-active');
        states.delete(element);
        return;
      }
      const base = softMotion.matches ? 0.72 : 0.80;
      const factor = 1 - Math.pow(base, dt / 16.667);
      element.scrollTop = position + diff * factor;
      current.raf = requestAnimationFrame(frame);
    };

    state.raf = requestAnimationFrame(frame);
  }

  function onWheel(event) {
    if (event.defaultPrevented || !finePointer.matches) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (!event.deltaY || likelyTrackpad(event)) return;
    if (event.target instanceof Element && event.target.closest('textarea,select,input[type="number"],input[type="range"],[contenteditable="true"],[data-native-scroll]')) return;

    const delta = normalizeDelta(event);
    const element = scrollTarget(event.target, delta);
    if (!element) return;

    const max = maxScroll(element);
    let state = states.get(element);
    if (!state) {
      state = { target: element.scrollTop, raf: 0 };
      states.set(element, state);
    }
    state.target = Math.max(0, Math.min(max, state.target + delta));
    event.preventDefault();
    animate(element);
  }

  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('touchstart', cancelAll, { passive: true });
  addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button === 0) cancelAll();
  }, { passive: true });
  addEventListener('keydown', event => {
    if (['Home','End','PageUp','PageDown','ArrowUp','ArrowDown',' '].includes(event.key)) cancelAll();
  });
  softMotion.addEventListener?.('change', cancelAll);
})();
