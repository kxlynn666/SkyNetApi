(() => {
  if (window.__SKYNET_SMOOTH_SCROLL_V4__) return;
  window.__SKYNET_SMOOTH_SCROLL_V4__ = true;
  // Prevent older smooth-scroll runtimes from attaching a second wheel handler.
  window.__SKYNET_SMOOTH_SCROLL_V3__ = true;
  window.__SKYNET_SMOOTH_SCROLL_V2__ = true;
  window.__SKYNET_SMOOTH_SCROLL_V1__ = true;

  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const softMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const states = new Map();
  let lastWheelAt = 0;

  const style = document.createElement('style');
  style.id = 'skynetSmoothScrollV4Styles';
  style.textContent = `
    html{scroll-padding-top:84px}
    .skynet-wheel-glide{scroll-behavior:auto!important;overscroll-behavior:contain;will-change:scroll-position}
  `;
  document.head.appendChild(style);

  const rootScroller = () => document.scrollingElement || document.documentElement;
  const maxScroll = el => Math.max(0, el.scrollHeight - el.clientHeight);

  function canScroll(el, delta) {
    const max = maxScroll(el);
    if (max < 2) return false;
    return delta > 0 ? el.scrollTop < max - .5 : el.scrollTop > .5;
  }

  function isScrollable(el) {
    if (!(el instanceof Element)) return false;
    const overflow = getComputedStyle(el).overflowY;
    return /(auto|scroll|overlay)/.test(overflow) && maxScroll(el) > 1;
  }

  function findScroller(start, delta) {
    let el = start instanceof Element ? start : start?.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      if (isScrollable(el) && canScroll(el, delta)) return el;
      el = el.parentElement;
    }
    const root = rootScroller();
    return canScroll(root, delta) ? root : null;
  }

  function likelyTrackpad(event) {
    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return false;
    const amount = Math.abs(event.deltaY);
    const now = performance.now();
    const interval = now - lastWheelAt;
    lastWheelAt = now;
    // High-frequency, small deltas already carry native smoothness.
    return amount < 7 || (amount < 30 && interval > 0 && interval < 32);
  }

  function normalizeWheel(event) {
    let raw = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) raw *= 40;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) raw *= innerHeight * .8;

    const sign = Math.sign(raw) || 1;
    const amount = Math.abs(raw);
    // Keep one wheel notch compact so the movement starts immediately instead
    // of creating a distant target the animation has to chase.
    const distance = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
      ? Math.max(82, Math.min(170, amount * .92))
      : Math.max(92, Math.min(200, amount));
    return distance * sign;
  }

  function finish(el, state) {
    if (state.raf) cancelAnimationFrame(state.raf);
    el.classList?.remove('skynet-wheel-glide');
    states.delete(el);
  }

  function finishAll() {
    for (const [el, state] of [...states]) finish(el, state);
  }

  function start(el) {
    const state = states.get(el);
    if (!state || state.raf) return;
    el.classList?.add('skynet-wheel-glide');
    let last = performance.now();

    const frame = now => {
      const s = states.get(el);
      if (!s) return;
      const dt = Math.min(.032, Math.max(.001, (now - last) / 1000));
      last = now;

      const position = el.scrollTop;
      const error = s.target - position;

      // A responsive spring: high enough stiffness to react at once, damping
      // high enough to prevent bounce. One integration step per rendered frame
      // avoids the CPU cost and perceived latency of the old 5-substep loop.
      const stiffness = softMotion.matches ? 300 : 255;
      const damping = softMotion.matches ? 35 : 31;
      const acceleration = error * stiffness - s.velocity * damping;
      s.velocity += acceleration * dt;

      const maxVelocity = softMotion.matches ? 2100 : 2700;
      s.velocity = Math.max(-maxVelocity, Math.min(maxVelocity, s.velocity));

      let next = position + s.velocity * dt;
      const max = maxScroll(el);
      if (next < 0) { next = 0; s.velocity = 0; }
      else if (next > max) { next = max; s.velocity = 0; }

      el.scrollTop = next;

      if (Math.abs(s.target - next) < .18 && Math.abs(s.velocity) < 4) {
        el.scrollTop = s.target;
        s.raf = 0;
        finish(el, s);
        return;
      }
      s.raf = requestAnimationFrame(frame);
    };

    state.raf = requestAnimationFrame(frame);
  }

  function onWheel(event) {
    if (event.defaultPrevented || !finePointer.matches) return;
    if (!event.deltaY || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (likelyTrackpad(event)) return;
    if (event.target instanceof Element && event.target.closest(
      'textarea,select,input[type="number"],input[type="range"],[contenteditable="true"],[data-native-scroll]'
    )) return;

    const delta = normalizeWheel(event);
    const el = findScroller(event.target, delta);
    if (!el) return;

    const direction = Math.sign(delta);
    const max = maxScroll(el);
    let state = states.get(el);
    if (!state) {
      state = { target: el.scrollTop, velocity: 0, direction, raf: 0 };
      states.set(el, state);
    }

    if (state.direction && state.direction !== direction) {
      // Reverse instantly instead of finishing the previous glide first.
      state.target = el.scrollTop;
      state.velocity *= -.08;
    }
    state.direction = direction;

    const lead = Math.min(760, Math.max(390, innerHeight * .72));
    const proposed = state.target + delta;
    state.target = direction > 0
      ? Math.min(max, proposed, el.scrollTop + lead)
      : Math.max(0, proposed, el.scrollTop - lead);

    // Small velocity impulse removes the feeling that the page is waiting for
    // the spring to start, while the spring still smooths every visible frame.
    state.velocity += delta * 5.4;
    state.velocity = Math.max(-1900, Math.min(1900, state.velocity));

    event.preventDefault();
    start(el);
  }

  addEventListener('wheel', onWheel, { passive:false });
  addEventListener('touchstart', finishAll, { passive:true });
  addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button === 0) finishAll();
  }, { passive:true });
  addEventListener('keydown', event => {
    if (['Home','End','PageUp','PageDown','ArrowUp','ArrowDown',' '].includes(event.key)) finishAll();
  });
  addEventListener('blur', finishAll, { passive:true });
})();
