(() => {
  if (window.__SKYNET_SMOOTH_SCROLL_V5__) return;
  window.__SKYNET_SMOOTH_SCROLL_V5__ = true;
  window.__SKYNET_SMOOTH_SCROLL_V4__ = true;
  window.__SKYNET_SMOOTH_SCROLL_V3__ = true;
  window.__SKYNET_SMOOTH_SCROLL_V2__ = true;
  window.__SKYNET_SMOOTH_SCROLL_V1__ = true;

  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const states = new Map();
  let lastWheelAt = 0;

  const style = document.createElement('style');
  style.id = 'skynetSmoothScrollV5Styles';
  style.textContent = `html{scroll-padding-top:84px}.skynet-wheel-glide{scroll-behavior:auto!important;overscroll-behavior:contain}`;
  document.head.appendChild(style);

  const rootScroller = () => document.scrollingElement || document.documentElement;
  const maxScroll = el => Math.max(0, el.scrollHeight - el.clientHeight);

  function canScroll(el, direction) {
    const max = maxScroll(el);
    if (max < 2) return false;
    return direction > 0 ? el.scrollTop < max - .5 : el.scrollTop > .5;
  }

  function isScrollable(el) {
    if (!(el instanceof Element)) return false;
    const overflow = getComputedStyle(el).overflowY;
    return /(auto|scroll|overlay)/.test(overflow) && maxScroll(el) > 1;
  }

  function findScroller(start, direction) {
    let el = start instanceof Element ? start : start?.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      if (isScrollable(el) && canScroll(el, direction)) return el;
      el = el.parentElement;
    }
    const root = rootScroller();
    return canScroll(root, direction) ? root : null;
  }

  function looksLikeTrackpad(event) {
    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return false;
    const amount = Math.abs(event.deltaY);
    const now = performance.now();
    const gap = now - lastWheelAt;
    lastWheelAt = now;
    return amount < 6 || (amount < 28 && gap > 0 && gap < 30);
  }

  function normalize(event) {
    let raw = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) raw *= 38;
    else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) raw *= innerHeight * .78;
    const sign = Math.sign(raw) || 1;
    const amount = Math.abs(raw);
    const distance = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
      ? Math.max(76, Math.min(164, amount * .9))
      : Math.max(88, Math.min(188, amount));
    return distance * sign;
  }

  function stop(el) {
    const state = states.get(el);
    if (!state) return;
    if (state.raf) cancelAnimationFrame(state.raf);
    el.classList?.remove('skynet-wheel-glide');
    states.delete(el);
  }

  function stopAll() {
    for (const el of [...states.keys()]) stop(el);
  }

  function run(el) {
    const state = states.get(el);
    if (!state || state.raf) return;
    el.classList?.add('skynet-wheel-glide');
    let last = performance.now();

    const frame = now => {
      const s = states.get(el);
      if (!s) return;
      const dt = Math.min(.032, Math.max(.001, (now - last) / 1000));
      last = now;

      let next = el.scrollTop + s.velocity * dt;
      const max = maxScroll(el);
      if (next <= 0) {
        next = 0;
        if (s.velocity < 0) s.velocity = 0;
      } else if (next >= max) {
        next = max;
        if (s.velocity > 0) s.velocity = 0;
      }
      el.scrollTop = next;

      // Exponential friction gives a continuous glide without a delayed target.
      s.velocity *= Math.exp(-13.2 * dt);
      if (Math.abs(s.velocity) < 7) {
        stop(el);
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
    if (looksLikeTrackpad(event)) return;
    if (event.target instanceof Element && event.target.closest('textarea,select,input[type="number"],input[type="range"],[contenteditable="true"],[data-native-scroll]')) return;

    const delta = normalize(event);
    const direction = Math.sign(delta);
    const el = findScroller(event.target, direction);
    if (!el) return;

    let state = states.get(el);
    if (!state) {
      state = { velocity: 0, direction, raf: 0 };
      states.set(el, state);
    }

    if (state.direction && state.direction !== direction) state.velocity *= .1;
    state.direction = direction;

    // A tiny immediate movement removes perceived input latency; the rest is inertia.
    const immediate = delta * .055;
    el.scrollTop = Math.max(0, Math.min(maxScroll(el), el.scrollTop + immediate));
    state.velocity += delta * 12.8;
    state.velocity = Math.max(-3300, Math.min(3300, state.velocity));

    event.preventDefault();
    run(el);
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
