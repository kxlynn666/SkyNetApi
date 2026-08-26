(() => {
  if (window.__SKYNET_MOTION_V17__) return;
  window.__SKYNET_MOTION_V17__ = true;

  // Block older runtimes if an older cached loader tries to attach them later.
  window.__SKYNET_MOTION_V16__ = true;
  window.__SKYNET_MOTION_V15__ = true;
  window.__SKYNET_MOTION_SCROLL_SCENES_V2__ = true;
  window.__SKYNET_MOTION_SCROLL_SCENES_V1__ = true;
  window.__SKYNET_MOTION_REPEAT_V1__ = true;

  const softMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const observed = new WeakSet();
  const leaveTimers = new WeakMap();
  const pendingRoots = new Set();
  let enhanceRaf = 0;
  let scrollRaf = 0;

  function cleanupLegacy() {
    document.querySelectorAll('.v16-atmosphere,.v17-scroll-scenes,.v15-atmosphere,.v15-page-flash,.v16-page-flash').forEach(node => node.remove());
    ['motionV16Styles','motionV15Styles','motionScrollScenesV1Styles','motionScrollScenesV2Styles','skynetMotionBlackScreenGuard'].forEach(id => document.getElementById(id)?.remove());
  }

  cleanupLegacy();

  const style = document.createElement('style');
  style.id = 'motionV17Styles';
  style.textContent = `
    body{position:relative;isolation:isolate}
    .v17-sky{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:radial-gradient(circle at 50% 115%,rgba(70,58,121,.13),transparent 48%);contain:strict}
    .v17-stars{position:absolute;inset:0;opacity:var(--v17-stars-opacity,.12);background-image:radial-gradient(circle,rgba(255,255,255,.38) 0 1px,transparent 1.4px),radial-gradient(circle,rgba(186,176,255,.25) 0 1px,transparent 1.3px);background-size:97px 97px,151px 151px;background-position:17px 23px,71px 49px;transition:opacity .35s linear}
    .v17-cloud-scene,.v17-moon-scene{position:absolute;inset:0;pointer-events:none;will-change:opacity}
    .v17-cloud-scene{opacity:var(--v17-cloud-scene-opacity,.72)}
    .v17-cloud-bank{position:absolute;top:8vh;width:74vw;height:50vh;min-width:560px;min-height:300px;opacity:.88;filter:blur(11px);will-change:transform;background:radial-gradient(ellipse at 22% 50%,rgba(242,242,248,.23) 0 20%,transparent 48%),radial-gradient(ellipse at 48% 38%,rgba(205,199,244,.22) 0 22%,transparent 49%),radial-gradient(ellipse at 73% 57%,rgba(239,239,247,.19) 0 21%,transparent 47%),radial-gradient(ellipse at 50% 58%,rgba(101,88,166,.14),transparent 66%)}
    .v17-cloud-left{left:-17vw;transform:translate3d(var(--v17-cloud-left-x,0vw),var(--v17-cloud-y,0px),0) scale(var(--v17-cloud-scale,1.04))}
    .v17-cloud-right{right:-17vw;transform:translate3d(var(--v17-cloud-right-x,0vw),var(--v17-cloud-y,0px),0) scale(var(--v17-cloud-scale,1.04))}
    .v17-cloud-center-glow{position:absolute;left:50%;top:28%;width:58vw;height:34vh;transform:translate(-50%,-50%) scale(var(--v17-cloud-glow-scale,.9));opacity:var(--v17-cloud-glow-opacity,.08);filter:blur(30px);background:radial-gradient(ellipse,rgba(137,121,235,.27),transparent 68%);will-change:transform,opacity}

    .v17-moon-scene{opacity:var(--v17-moon-scene-opacity,0)}
    .v17-moon{position:absolute;left:50%;top:48%;width:min(23vw,280px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%) scale(var(--v17-moon-scale,.76));opacity:var(--v17-moon-opacity,.05);will-change:transform,opacity;background:radial-gradient(circle at 31% 27%,rgba(255,255,255,.62) 0 3.8%,transparent 4.7%),radial-gradient(circle at 68% 35%,rgba(66,65,80,.12) 0 7%,transparent 8%),radial-gradient(circle at 41% 69%,rgba(54,53,70,.11) 0 9%,transparent 10%),radial-gradient(circle at 65% 72%,rgba(45,44,58,.09) 0 6%,transparent 7%),radial-gradient(circle at 35% 32%,#fffef7,#deded8 56%,#aaa8b8 100%);box-shadow:0 0 42px rgba(229,225,255,.18),0 0 130px rgba(122,105,225,.15)}
    .v17-moon-cloud{position:absolute;top:30%;width:70vw;height:45vh;min-width:520px;filter:blur(12px);opacity:var(--v17-moon-cloud-opacity,.72);will-change:transform,opacity;background:radial-gradient(ellipse at 28% 50%,rgba(236,236,244,.22) 0 21%,transparent 48%),radial-gradient(ellipse at 55% 42%,rgba(188,180,230,.21) 0 23%,transparent 50%),radial-gradient(ellipse at 78% 58%,rgba(242,242,247,.17) 0 20%,transparent 47%)}
    .v17-moon-cloud-left{left:-18vw;transform:translate3d(var(--v17-moon-left-x,0vw),var(--v17-moon-y,0px),0)}
    .v17-moon-cloud-right{right:-18vw;transform:translate3d(var(--v17-moon-right-x,0vw),var(--v17-moon-y,0px),0)}

    .v17-reveal{opacity:0;transform:translate3d(0,16px,0) scale(.995);filter:blur(2.2px);transition:opacity 1.05s cubic-bezier(.16,1,.3,1),transform 1.12s cubic-bezier(.16,1,.3,1),filter .9s cubic-bezier(.16,1,.3,1);transform-origin:50% 30%}
    .v17-reveal.v17-visible{opacity:1;transform:translate3d(0,0,0) scale(1);filter:none}
    .v17-card-motion{transition:transform .62s cubic-bezier(.16,1,.3,1),box-shadow .62s cubic-bezier(.16,1,.3,1),border-color .4s ease!important}
    .v17-card-motion.v17-visible:hover{transform:translate3d(0,-3px,0) scale(1.002);box-shadow:0 22px 58px rgba(0,0,0,.22)}
    .v17-button-motion{transition:transform .28s cubic-bezier(.16,1,.3,1),background-color .28s ease,border-color .28s ease,box-shadow .35s ease!important}
    .v17-button-motion:hover{transform:translate3d(0,-1px,0)}
    .v17-button-motion:active{transform:translate3d(0,1px,0) scale(.985)!important}
    .v17-topbar-enter{animation:v17-topbar-enter .78s cubic-bezier(.16,1,.3,1) both}
    .v17-sidebar-enter{animation:v17-sidebar-enter .86s cubic-bezier(.16,1,.3,1) both}
    @keyframes v17-topbar-enter{from{opacity:0;transform:translate3d(0,-10px,0);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
    @keyframes v17-sidebar-enter{from{opacity:0;transform:translate3d(-12px,0,0);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}

    @media(max-width:820px){
      .v17-cloud-bank{width:112vw;min-width:0;height:42vh;min-height:230px;top:11vh;filter:blur(9px)}
      .v17-cloud-left{left:-54vw}.v17-cloud-right{right:-54vw}
      .v17-moon{width:min(46vw,230px);top:48%}
      .v17-moon-cloud{width:112vw;min-width:0;height:38vh;top:32%}
      .v17-moon-cloud-left{left:-52vw}.v17-moon-cloud-right{right:-52vw}
      .v17-reveal{transform:translate3d(0,12px,0) scale(.997);filter:blur(1.6px);transition-duration:.88s,.96s,.78s}
    }
    @media(prefers-reduced-motion:reduce){
      .v17-reveal{transform:translate3d(0,7px,0) scale(.998);filter:blur(1px);transition-duration:.65s,.72s,.58s}
      .v17-card-motion{transition-duration:.4s!important}.v17-button-motion{transition-duration:.2s!important}
    }
  `;
  document.head.appendChild(style);

  function installSky() {
    if (document.querySelector('.v17-sky')) return;
    const sky = document.createElement('div');
    sky.className = 'v17-sky';
    sky.setAttribute('aria-hidden','true');
    sky.innerHTML = `
      <div class="v17-stars"></div>
      <div class="v17-cloud-scene">
        <span class="v17-cloud-center-glow"></span>
        <span class="v17-cloud-bank v17-cloud-left"></span>
        <span class="v17-cloud-bank v17-cloud-right"></span>
      </div>
      <div class="v17-moon-scene">
        <span class="v17-moon"></span>
        <span class="v17-moon-cloud v17-moon-cloud-left"></span>
        <span class="v17-moon-cloud v17-moon-cloud-right"></span>
      </div>`;
    document.body.prepend(sky);
  }

  const revealSelector = [
    '.hero','.home-section','.home-status-strip','.podium-wrap',
    '.workspace-content > section','.workspace-page-grid > *','.workspace-stat-grid > *',
    '.profile-v3-top > *','.profile-v3-summary-card','.profile-v3-panel > .profile-v3-grid > *',
    '.profile-v3-product','.chat-layout','.stickers-page-v1 > section','.music-hub-v13 > *',
    '.visual-lab-v14 > *','.upscale-v1 > *','#app > header','#app > .stats','#app > .tabs',
    '#app > .tab-panel > *','.workspace-login-shell','.register-v14-shell','.public-profile-shell',
    '.card','.file-card','.ttt-v2 > *'
  ].join(',');

  const cardSelector = '.workspace-card,.workspace-quick,.home-feature,.file-card,.endpoint,.profile-v3-card,.profile-v3-summary-card,.sticker-create-v1,.sticker-library-v1,.upscale-controls-v1,.upscale-preview-v1,.ttt-panel';

  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const node = entry.target;
      const oldTimer = leaveTimers.get(node);
      if (oldTimer) { clearTimeout(oldTimer); leaveTimers.delete(node); }

      if (entry.isIntersecting && entry.intersectionRatio > .025) {
        node.classList.add('v17-visible');
      } else if (!entry.isIntersecting) {
        // Re-arm only after the element is actually outside the viewport.
        const timer = setTimeout(() => {
          if (node.isConnected) node.classList.remove('v17-visible');
          leaveTimers.delete(node);
        }, 90);
        leaveTimers.set(node, timer);
      }
    }
  }, { threshold:[0,.03,.12], rootMargin:'2% 0px 2% 0px' }) : null;

  function decorate(root) {
    if (!(root instanceof Element) && root !== document.documentElement && root !== document.body) return;
    const revealNodes = [];
    if (root.matches?.(revealSelector)) revealNodes.push(root);
    revealNodes.push(...(root.querySelectorAll?.(revealSelector) || []));

    for (const node of revealNodes) {
      if (observed.has(node)) continue;
      observed.add(node);
      node.classList.add('v17-reveal');
      if (node.matches(cardSelector)) node.classList.add('v17-card-motion');
      if (revealObserver) requestAnimationFrame(() => revealObserver.observe(node));
      else requestAnimationFrame(() => node.classList.add('v17-visible'));
    }

    const cards = [];
    if (root.matches?.(cardSelector)) cards.push(root);
    cards.push(...(root.querySelectorAll?.(cardSelector) || []));
    cards.forEach(node => node.classList.add('v17-card-motion'));

    const buttons = [];
    if (root.matches?.('button,.button,.workspace-nav-link,.nav-link')) buttons.push(root);
    buttons.push(...(root.querySelectorAll?.('button,.button,.workspace-nav-link,.nav-link') || []));
    buttons.forEach(node => node.classList.add('v17-button-motion'));
  }

  function queueDecorate(root) {
    if (root instanceof Element) pendingRoots.add(root);
    if (enhanceRaf) return;
    enhanceRaf = requestAnimationFrame(() => {
      enhanceRaf = 0;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.forEach(decorate);
    });
  }

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const smootherstep = value => {
    const t = clamp01(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };

  function updateSky() {
    scrollRaf = 0;
    const root = document.documentElement;
    const y = window.scrollY || root.scrollTop || 0;
    const vh = Math.max(320, innerHeight);
    const u = y / vh;
    const mobile = innerWidth <= 820;

    // Scene 1: at the top the banks meet in the middle. Scrolling down parts
    // them; scrolling up runs the exact same progress backwards and closes them.
    const cloudOpen = smootherstep((u - .02) / .72);
    const cloudFade = 1 - smootherstep((u - 1.02) / .58);
    const cloudShift = cloudOpen * (mobile ? 48 : 36);

    // Scene 2 starts shortly below: another bank opens and reveals the moon.
    // Because this is driven only by scroll position, going upward closes it.
    const moonScene = smootherstep((u - .68) / .48);
    const moonOpen = smootherstep((u - .93) / .82);
    const moonReveal = smootherstep((u - 1.08) / .68);
    const moonShift = moonOpen * (mobile ? 46 : 34);

    root.style.setProperty('--v17-cloud-left-x', `${(-cloudShift).toFixed(2)}vw`);
    root.style.setProperty('--v17-cloud-right-x', `${cloudShift.toFixed(2)}vw`);
    root.style.setProperty('--v17-cloud-y', `${(-Math.min(y, vh * 1.8) * .018).toFixed(1)}px`);
    root.style.setProperty('--v17-cloud-scale', (1.04 + cloudOpen * .035).toFixed(4));
    root.style.setProperty('--v17-cloud-glow-scale', (.9 + cloudOpen * .22).toFixed(4));
    root.style.setProperty('--v17-cloud-glow-opacity', (.07 + cloudOpen * .16).toFixed(4));
    root.style.setProperty('--v17-cloud-scene-opacity', (.72 * cloudFade).toFixed(4));

    root.style.setProperty('--v17-moon-scene-opacity', moonScene.toFixed(4));
    root.style.setProperty('--v17-moon-left-x', `${(-moonShift).toFixed(2)}vw`);
    root.style.setProperty('--v17-moon-right-x', `${moonShift.toFixed(2)}vw`);
    root.style.setProperty('--v17-moon-y', `${(-Math.max(0, y - vh * .65) * .012).toFixed(1)}px`);
    root.style.setProperty('--v17-moon-cloud-opacity', (.78 - moonReveal * .25).toFixed(4));
    root.style.setProperty('--v17-moon-scale', (.76 + moonReveal * .25).toFixed(4));
    root.style.setProperty('--v17-moon-opacity', (.04 + moonReveal * .92).toFixed(4));
    root.style.setProperty('--v17-stars-opacity', (.11 + moonScene * .18).toFixed(4));
  }

  function scheduleSky() {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(updateSky);
  }

  function boot() {
    installSky();
    decorate(document.body);
    document.querySelector('.workspace-topbar,.topbar')?.classList.add('v17-topbar-enter');
    document.querySelector('.workspace-sidebar')?.classList.add('v17-sidebar-enter');
    updateSky();

    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes || []) if (node.nodeType === 1 && !node.classList?.contains('v17-sky')) queueDecorate(node);
      }
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  addEventListener('scroll', scheduleSky, { passive:true });
  addEventListener('resize', scheduleSky, { passive:true });
  addEventListener('pageshow', () => { scheduleSky(); queueDecorate(document.body); }, { passive:true });
})();
