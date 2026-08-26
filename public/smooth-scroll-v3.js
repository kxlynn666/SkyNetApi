(() => {
  if (window.__SKYNET_SMOOTH_SCROLL_V3__) return;
  window.__SKYNET_SMOOTH_SCROLL_V3__ = true;

  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const softMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const states = new Map();
  let lastWheelAt = 0;

  const style = document.createElement('style');
  style.id = 'skynetSmoothScrollV3Styles';
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
    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return false;
    const amount = Math.abs(event.deltaY);
    const now = performance.now();
    const interval = now - lastWheelAt;
    lastWheelAt = now;
    if (amount < 8) return true;
    if (amount < 26 && interval > 0 && interval < 34) return true;
    return false;
  }

  function normalizedDelta(event) {
    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 44;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= innerHeight * .82;

    const sign = Math.sign(delta) || 1;
    const amount = Math.abs(delta);
    const distance = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
      ? Math.max(108, Math.min(238, amount * 1.08))
      : Math.max(118, Math.min(282, amount));
    return distance * sign;
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

  // Critically damped smoothing. It reacts quickly at the beginning while
  // preserving velocity between wheel notches, so it feels fluid instead of delayed.
  function smoothDamp(current, target, velocity, smoothTime, dt) {
    const omega = 2 / Math.max(.035, smoothTime);
    const x = omega * dt;
    const exp = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
    const change = current - target;
    const temp = (velocity + omega * change) * dt;
    const nextVelocity = (velocity - omega * temp) * exp;
    const output = target + (change + temp) * exp;
    return [output, nextVelocity];
  }

  function animate(element) {
    const state = states.get(element);
    if (!state || state.raf) return;
    element.classList?.add('skynet-inertial-active');
    let lastFrame = performance.now();

    const frame = now => {
      const current = states.get(element);
      if (!current) return;

      const dt = Math.min(.034, Math.max(.001, (now - lastFrame) / 1000));
      lastFrame = now;

      let position = element.scrollTop;
      let velocity = current.velocity;
      const smoothTime = softMotion.matches ? .085 : .11;

      // Five physics substeps per rendered frame make rapid wheel bursts merge
      // into one continuous trajectory without making the response slower.
      const subDt = dt / 5;
      for (let i = 0; i < 5; i++) {
        [position, velocity] = smoothDamp(position, current.target, velocity, smoothTime, subDt);
      }

      const max = maxScroll(element);
      position = Math.max(0, Math.min(max, position));
      element.scrollTop = position;
      current.velocity = velocity;

      const remaining = current.target - position;
      if (Math.abs(remaining) < .22 && Math.abs(velocity) < 2.4) {
        element.scrollTop = current.target;
        current.raf = 0;
        element.classList?.remove('skynet-inertial-active');
        states.delete(element);
        return;
      }

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
      state = { target: element.scrollTop, velocity: 0, raf: 0, direction };
      states.set(element, state);
    }

    if (state.direction && direction !== state.direction) {
      state.target = element.scrollTop;
      state.velocity *= .22;
    }
    state.direction = direction;

    const maxLead = Math.min(1120, Math.max(620, innerHeight * 1.18));
    const proposed = state.target + delta;
    const leadLimited = direction > 0
      ? Math.min(proposed, element.scrollTop + maxLead)
      : Math.max(proposed, element.scrollTop - maxLead);

    state.target = Math.max(0, Math.min(max, leadLimited));

    // Immediate but subtle impulse removes the old "waiting for the easing" feel.
    state.velocity += delta * 1.35;
    state.velocity = Math.max(-1650, Math.min(1650, state.velocity));

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
