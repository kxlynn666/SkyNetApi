(() => {
  if (window.__SKYNET_SMOOTH_SCROLL_V2__) return;
  window.__SKYNET_SMOOTH_SCROLL_V2__ = true;

  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const softMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const states = new Map();
  let lastWheelAt = 0;

  const style = document.createElement('style');
  style.id = 'skynetSmoothScrollV2Styles';
  style.textContent = `
    html{scroll-behavior:smooth;scroll-padding-top:84px}
    .workspace-nav,.workspace-content,.ttt-users,.list,.chat-messages,.profile-v3-shell,[data-smooth-scroll]{scroll-behavior:smooth;overscroll-behavior:contain}
    .skynet-inertial-active{scroll-behavior:auto!important}
  `;
  document.head.appendChild(style);

  function rootScroller() {
    return document.scrollingElement || document.documentElement;
  }

  function maxScroll(element) {
    return Math.max(0, element.scrollHeight - element.clientHeight);
  }

  function canScroll(element, delta) {
    const max = maxScroll(element);
    if (max < 2) return false;
    return delta > 0 ? element.scrollTop < max - 1 : element.scrollTop > 1;
  }

  function isScrollable(element) {
    if (!(element instanceof Element)) return false;
    const overflowY = getComputedStyle(element).overflowY;
    return /(auto|scroll|overlay)/.test(overflowY) && maxScroll(element) > 1;
  }

  function findScroller(start, delta) {
    let element = start instanceof Element ? start : start?.parentElement;
    while (element && element !== document.body && element !== document.documentElement) {
      if (isScrollable(element) && canScroll(element, delta)) return element;
      element = element.parentElement;
    }
    const root = rootScroller();
    return canScroll(root, delta) ? root : null;
  }

  function looksLikeTrackpad(event) {
    if (event.deltaMode !== 0) return false;
    const amount = Math.abs(event.deltaY);
    const now = performance.now();
    const interval = now - lastWheelAt;
    lastWheelAt = now;
    if (amount < 10) return true;
    if (amount < 30 && interval > 0 && interval < 38) return true;
    return false;
  }

  function normalizedDelta(event) {
    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 46;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= innerHeight * .84;

    const sign = Math.sign(delta) || 1;
    const magnitude = Math.abs(delta);
    const adjusted = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
      ? Math.max(92, Math.min(235, magnitude * 1.05))
      : Math.max(105, Math.min(270, magnitude));
    return adjusted * sign;
  }

  function stop(element) {
    const state = states.get(element);
    if (!state) return;
    if (state.raf) cancelAnimationFrame(state.raf);
    element.classList?.remove('skynet-inertial-active');
    states.delete(element);
  }

  function stopAll() {
    for (const element of [...states.keys()]) stop(element);
  }

  function animate(element) {
    const state = states.get(element);
    if (!state || state.raf) return;

    element.classList?.add('skynet-inertial-active');
    let lastFrame = performance.now();

    const frame = now => {
      const current = states.get(element);
      if (!current) return;

      const dt = Math.min(36, Math.max(1, now - lastFrame));
      lastFrame = now;
      const position = element.scrollTop;
      const diff = current.target - position;

      if (Math.abs(diff) < .32) {
        element.scrollTop = current.target;
        current.raf = 0;
        element.classList?.remove('skynet-inertial-active');
        states.delete(element);
        return;
      }

      // Intentionally long easing: discrete wheel notches melt into one glide.
      // A little faster under reduced-motion, but never a hard step.
      const timeConstant = softMotion.matches ? 245 : 335;
      const factor = 1 - Math.exp(-dt / timeConstant);
      let next = position + diff * factor;

      // Tiny minimum progress prevents the very end from feeling sticky.
      if (Math.abs(next - position) < .08) next = position + Math.sign(diff) * Math.min(.08, Math.abs(diff));

      const max = maxScroll(element);
      if (next < 0) next = 0;
      else if (next > max) next = max;

      element.scrollTop = next;
      current.raf = requestAnimationFrame(frame);
    };

    state.raf = requestAnimationFrame(frame);
  }

  function onWheel(event) {
    if (event.defaultPrevented || !finePointer.matches) return;
    if (!event.deltaY || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (looksLikeTrackpad(event)) return;
    if (event.target instanceof Element && event.target.closest('textarea,select,input[type="number"],input[type="range"],[contenteditable="true"],[data-native-scroll]')) return;

    const delta = normalizedDelta(event);
    const element = findScroller(event.target, delta);
    if (!element) return;

    const direction = Math.sign(delta);
    const max = maxScroll(element);
    let state = states.get(element);
    if (!state) {
      state = { target: element.scrollTop, raf: 0, direction };
      states.set(element, state);
    }

    if (state.direction && direction !== state.direction) state.target = element.scrollTop;
    state.direction = direction;

    const maxLead = Math.min(980, Math.max(520, innerHeight * 1.05));
    const proposed = state.target + delta;
    const leadLimited = direction > 0
      ? Math.min(proposed, element.scrollTop + maxLead)
      : Math.max(proposed, element.scrollTop - maxLead);

    state.target = Math.max(0, Math.min(max, leadLimited));
    event.preventDefault();
    animate(element);
  }

  addEventListener('wheel', onWheel, { passive:false });
  addEventListener('touchstart', stopAll, { passive:true });
  addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button === 0) stopAll();
  }, { passive:true });
  addEventListener('keydown', event => {
    if (['Home','End','PageUp','PageDown','ArrowUp','ArrowDown',' '].includes(event.key)) stopAll();
  });
  addEventListener('blur', stopAll, { passive:true });
})();
