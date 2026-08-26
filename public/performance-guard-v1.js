(() => {
  if (window.__SKYNET_PERFORMANCE_GUARD_V1__) return;
  window.__SKYNET_PERFORMANCE_GUARD_V1__ = true;

  const root = document.documentElement;
  const mm = window.matchMedia?.('(max-width: 820px)');
  const coarse = window.matchMedia?.('(pointer: coarse)');
  let emergency = false;
  let longTasks = 0;
  let longTaskWindow = Date.now();

  function deviceState() {
    const mobile = Boolean(mm?.matches || coarse?.matches);
    const memory = Number(navigator.deviceMemory || 0);
    const cores = Number(navigator.hardwareConcurrency || 0);
    const lowPower = mobile && (
      window.innerWidth <= 520 ||
      (memory > 0 && memory <= 4) ||
      (cores > 0 && cores <= 4)
    );
    root.classList.toggle('skynet-mobile-runtime', mobile);
    root.classList.toggle('skynet-low-power', lowPower);
  }

  function installCss() {
    if (document.getElementById('skynetPerformanceGuardV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'skynetPerformanceGuardV1Styles';
    style.textContent = `
      html.skynet-mobile-runtime .topbar,
      html.skynet-mobile-runtime .workspace-topbar,
      html.skynet-mobile-runtime .workspace-mobile-dock,
      html.skynet-mobile-runtime .skynet-music-bar,
      html.skynet-mobile-runtime .profile-v3-tabs{backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important}
      html.skynet-mobile-runtime .profile-v3-metric{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      html.skynet-mobile-runtime .card,
      html.skynet-mobile-runtime .workspace-card,
      html.skynet-mobile-runtime .profile-v3-card{box-shadow:0 10px 28px rgba(0,0,0,.13)!important}
      html.skynet-low-power .profile-surface::before,
      html.skynet-low-power .profile-surface::after,
      html.skynet-low-power .cosmetic-avatar::before,
      html.skynet-low-power .cosmetic-avatar::after{filter:none!important}
      html.skynet-low-power .profile-surface[data-decoration]::before,
      html.skynet-low-power .profile-surface[data-decoration]::after{animation-duration:14s!important}
      html.skynet-low-power .cosmetic-avatar[data-frame]::before,
      html.skynet-low-power .cosmetic-avatar[data-frame]::after{animation-duration:10s!important}
      html.skynet-low-power .profile-tag{animation-duration:7s!important}
      .skynet-perf-offscreen::before,.skynet-perf-offscreen::after,
      .skynet-perf-offscreen{animation-play-state:paused!important}
      html.skynet-page-hidden .profile-surface::before,
      html.skynet-page-hidden .profile-surface::after,
      html.skynet-page-hidden .cosmetic-avatar::before,
      html.skynet-page-hidden .cosmetic-avatar::after,
      html.skynet-page-hidden .profile-tag{animation-play-state:paused!important}

      /* Emergency mode now keeps motion alive, only reducing GPU-heavy effects. */
      html.skynet-emergency-lite .profile-surface::before,
      html.skynet-emergency-lite .profile-surface::after{animation-duration:20s!important;filter:none!important}
      html.skynet-emergency-lite .cosmetic-avatar::before,
      html.skynet-emergency-lite .cosmetic-avatar::after{animation-duration:16s!important;filter:none!important}
      html.skynet-emergency-lite .profile-tag{animation-duration:12s!important;filter:none!important}
      html.skynet-emergency-lite .topbar,
      html.skynet-emergency-lite .workspace-topbar,
      html.skynet-emergency-lite .workspace-mobile-dock,
      html.skynet-emergency-lite .skynet-music-bar,
      html.skynet-emergency-lite .profile-v3-tabs{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      .skynet-action-busy{pointer-events:none!important;opacity:.72!important}
    `;
    document.head.appendChild(style);
  }

  function observeCosmetics() {
    if (!('IntersectionObserver' in window)) return;
    const watched = new WeakSet();
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.classList.toggle('skynet-perf-offscreen', !entry.isIntersecting);
      }
    }, { rootMargin: '180px 0px', threshold: 0 });

    const add = node => {
      const items = [];
      if (node?.matches?.('.profile-surface,.cosmetic-avatar,.profile-tag')) items.push(node);
      items.push(...(node?.querySelectorAll?.('.profile-surface,.cosmetic-avatar,.profile-tag') || []));
      for (const item of items) {
        if (watched.has(item)) continue;
        watched.add(item);
        io.observe(item);
      }
    };
    add(document);
    const mo = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes || []) if (node.nodeType === 1) add(node);
      }
    });
    mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
  }

  function protectRepeatedActions() {
    const last = new WeakMap();
    document.addEventListener('click', event => {
      const target = event.target.closest?.('button,[role="button"]');
      if (!target) return;
      const now = performance.now();
      const previous = last.get(target) || 0;
      if (now - previous < 350) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      last.set(target, now);
    }, true);

    const forms = new WeakMap();
    document.addEventListener('submit', event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const now = performance.now();
      const previous = forms.get(form) || 0;
      if (now - previous < 900) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      forms.set(form, now);
    }, true);
  }

  function installLongTaskFallback() {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver(list => {
        const now = Date.now();
        if (now - longTaskWindow > 10000) {
          longTaskWindow = now;
          longTasks = 0;
        }
        for (const entry of list.getEntries()) {
          if (entry.duration >= 140) longTasks++;
        }
        if (!emergency && longTasks >= 3) {
          emergency = true;
          root.classList.add('skynet-emergency-lite');
          try { sessionStorage.setItem('skynet_emergency_lite', '1'); } catch {}
        }
      });
      observer.observe({ entryTypes:['longtask'] });
    } catch {}
  }

  function visibility() {
    root.classList.toggle('skynet-page-hidden', document.hidden);
  }

  installCss();
  deviceState();
  visibility();
  protectRepeatedActions();
  observeCosmetics();
  installLongTaskFallback();
  try {
    if (sessionStorage.getItem('skynet_emergency_lite') === '1') {
      emergency = true;
      root.classList.add('skynet-emergency-lite');
    }
  } catch {}

  document.addEventListener('visibilitychange', visibility, { passive:true });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(deviceState, 120);
  }, { passive:true });
})();
