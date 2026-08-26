(() => {
  if (window.__SKYNET_MOTION_V17__) return;
  window.__SKYNET_MOTION_V17__ = true;

  // Block older runtimes if an older cached loader tries to attach them later.
  window.__SKYNET_MOTION_V16__ = true;
  window.__SKYNET_MOTION_V15__ = true;
  window.__SKYNET_MOTION_SCROLL_SCENES_V2__ = true;
  window.__SKYNET_MOTION_SCROLL_SCENES_V1__ = true;
  window.__SKYNET_MOTION_REPEAT_V1__ = true;

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
    body.workspace-body{background:transparent!important}
    body.workspace-body .workspace-shell,body.workspace-body .workspace-loading{position:relative;z-index:1}
    .v17-sky{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:#0b0713 radial-gradient(circle at 50% 112%,rgba(70,58,121,.2),transparent 50%);contain:strict}
    .v17-stars{position:absolute;inset:0;opacity:var(--v17-stars-opacity,.12);background-image:radial-gradient(circle,rgba(255,255,255,.38) 0 1px,transparent 1.4px),radial-gradient(circle,rgba(186,176,255,.25) 0 1px,transparent 1.3px);background-size:97px 97px,151px 151px;background-position:17px 23px,71px 49px;transition:opacity .28s linear}
    .v17-cloud-scene,.v17-moon-scene{position:absolute;inset:0;pointer-events:none;will-change:opacity}
    .v17-cloud-scene{opacity:var(--v17-cloud-scene-opacity,.82)}
    .v17-cloud-bank{position:absolute;top:6vh;width:76vw;height:54vh;min-width:580px;min-height:320px;opacity:.96;filter:blur(10px);will-change:transform;background:radial-gradient(ellipse at 20% 50%,rgba(247,247,252,.3) 0 20%,transparent 49%),radial-gradient(ellipse at 47% 38%,rgba(210,203,248,.28) 0 23%,transparent 50%),radial-gradient(ellipse at 74% 58%,rgba(243,243,250,.25) 0 21%,transparent 48%),radial-gradient(ellipse at 50% 58%,rgba(102,88,170,.18),transparent 68%)}
    .v17-cloud-left{left:-18vw;transform:translate3d(var(--v17-cloud-left-x,0vw),var(--v17-cloud-y,0px),0) scale(var(--v17-cloud-scale,1.04))}
    .v17-cloud-right{right:-18vw;transform:translate3d(var(--v17-cloud-right-x,0vw),var(--v17-cloud-y,0px),0) scale(var(--v17-cloud-scale,1.04))}
    .v17-cloud-center-glow{position:absolute;left:50%;top:27%;width:62vw;height:38vh;transform:translate(-50%,-50%) scale(var(--v17-cloud-glow-scale,.9));opacity:var(--v17-cloud-glow-opacity,.1);filter:blur(28px);background:radial-gradient(ellipse,rgba(137,121,235,.34),transparent 68%);will-change:transform,opacity}

    .v17-moon-scene{opacity:var(--v17-moon-scene-opacity,0)}
    .v17-moon{position:absolute;left:50%;top:48%;width:min(23vw,280px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%) scale(var(--v17-moon-scale,.76));opacity:var(--v17-moon-opacity,.05);will-change:transform,opacity;background:radial-gradient(circle at 31% 27%,rgba(255,255,255,.62) 0 3.8%,transparent 4.7%),radial-gradient(circle at 68% 35%,rgba(66,65,80,.12) 0 7%,transparent 8%),radial-gradient(circle at 41% 69%,rgba(54,53,70,.11) 0 9%,transparent 10%),radial-gradient(circle at 65% 72%,rgba(45,44,58,.09) 0 6%,transparent 7%),radial-gradient(circle at 35% 32%,#fffef7,#deded8 56%,#aaa8b8 100%);box-shadow:0 0 42px rgba(229,225,255,.22),0 0 140px rgba(122,105,225,.2)}
    .v17-moon-cloud{position:absolute;top:29%;width:72vw;height:47vh;min-width:540px;filter:blur(11px);opacity:var(--v17-moon-cloud-opacity,.78);will-change:transform,opacity;background:radial-gradient(ellipse at 28% 50%,rgba(241,241,247,.26) 0 21%,transparent 49%),radial-gradient(ellipse at 55% 42%,rgba(193,184,235,.25) 0 23%,transparent 51%),radial-gradient(ellipse at 78% 58%,rgba(246,246,250,.21) 0 20%,transparent 48%)}
    .v17-moon-cloud-left{left:-18vw;transform:translate3d(var(--v17-moon-left-x,0vw),var(--v17-moon-y,0px),0)}
    .v17-moon-cloud-right{right:-18vw;transform:translate3d(var(--v17-moon-right-x,0vw),var(--v17-moon-y,0px),0)}

    .v17-reveal{opacity:0;transform:translate3d(0,14px,0) scale(.996);filter:blur(1.5px);transform-origin:50% 30%;transition:opacity 1.22s cubic-bezier(.16,1,.3,1),transform 1.28s cubic-bezier(.16,1,.3,1),filter 1.05s cubic-bezier(.16,1,.3,1)}
    .v17-reveal.v17-visible{opacity:1;transform:translate3d(0,0,0) scale(1);filter:none}
    .v17-reveal.v17-card-motion{transition:opacity 1.22s cubic-bezier(.16,1,.3,1),transform 1.28s cubic-bezier(.16,1,.3,1),filter 1.05s cubic-bezier(.16,1,.3,1),box-shadow .62s cubic-bezier(.16,1,.3,1),border-color .4s ease}
    .v17-card-motion.v17-visible:hover{transition:transform .48s cubic-bezier(.16,1,.3,1),box-shadow .58s cubic-bezier(.16,1,.3,1),border-color .35s ease;transform:translate3d(0,-3px,0) scale(1.002);box-shadow:0 22px 58px rgba(0,0,0,.22)}
    .v17-button-motion{transition:transform .3s cubic-bezier(.16,1,.3,1),background-color .28s ease,border-color .28s ease,box-shadow .35s ease!important}
    .v17-button-motion:hover{transform:translate3d(0,-1px,0)}
    .v17-button-motion:active{transform:translate3d(0,1px,0) scale(.985)!important}
    .v17-topbar-enter{animation:v17-topbar-enter .9s cubic-bezier(.16,1,.3,1) both}
    .v17-sidebar-enter{animation:v17-sidebar-enter .98s cubic-bezier(.16,1,.3,1) both}
    @keyframes v17-topbar-enter{from{opacity:0;transform:translate3d(0,-9px,0);filter:blur(1.5px)}to{opacity:1;transform:none;filter:none}}
    @keyframes v17-sidebar-enter{from{opacity:0;transform:translate3d(-11px,0,0);filter:blur(1.5px)}to{opacity:1;transform:none;filter:none}}

    @media(max-width:820px){
      .v17-cloud-bank{width:114vw;min-width:0;height:44vh;min-height:240px;top:10vh;filter:blur(8px)}
      .v17-cloud-left{left:-55vw}.v17-cloud-right{right:-55vw}
      .v17-moon{width:min(46vw,230px);top:48%}
      .v17-moon-cloud{width:114vw;min-width:0;height:40vh;top:31%}
      .v17-moon-cloud-left{left:-53vw}.v17-moon-cloud-right{right:-53vw}
      .v17-reveal{transform:translate3d(0,10px,0) scale(.998);filter:blur(1px);transition-duration:1s,1.08s,.9s}
    }
    @media(prefers-reduced-motion:reduce){
      .v17-reveal{transform:translate3d(0,6px,0) scale(.999);filter:blur(.7px);transition-duration:.78s,.84s,.7s}
      .v17-card-motion.v17-visible:hover{transform:translate3d(0,-2px,0)}
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

      if (entry.isIntersecting && entry.intersectionRatio > .02) {
        node.classList.add('v17-visible');
      } else if (!entry.isIntersecting) {
        const timer = setTimeout(() => {
          if (node.isConnected) node.classList.remove('v17-visible');
          leaveTimers.delete(node);
        }, 80);
        leaveTimers.set(node, timer);
      }
    }
  }, { threshold:[0,.02,.1], rootMargin:'1% 0px 1% 0px' }) : null;

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
      if (revealObserver) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (node.isConnected) revealObserver.observe(node);
        }));
      } else requestAnimationFrame(() => node.classList.add('v17-visible'));
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

    // Closed at the top -> open while descending -> close along the exact same
    // path when the user scrolls upward, because progress is position-based.
    const cloudOpen = smootherstep((u - .01) / .66);
    const cloudFade = 1 - smootherstep((u - 1.04) / .5);
    const cloudShift = cloudOpen * (mobile ? 50 : 38);

    // A little farther down, a second cloud bank opens to reveal the moon.
    const moonScene = smootherstep((u - .62) / .42);
    const moonOpen = smootherstep((u - .86) / .76);
    const moonReveal = smootherstep((u - 1.0) / .62);
    const moonShift = moonOpen * (mobile ? 48 : 36);

    root.style.setProperty('--v17-cloud-left-x', `${(-cloudShift).toFixed(2)}vw`);
    root.style.setProperty('--v17-cloud-right-x', `${cloudShift.toFixed(2)}vw`);
    root.style.setProperty('--v17-cloud-y', `${(-Math.min(y, vh * 1.7) * .014).toFixed(1)}px`);
    root.style.setProperty('--v17-cloud-scale', (1.04 + cloudOpen * .04).toFixed(4));
    root.style.setProperty('--v17-cloud-glow-scale', (.9 + cloudOpen * .24).toFixed(4));
    root.style.setProperty('--v17-cloud-glow-opacity', (.1 + cloudOpen * .2).toFixed(4));
    root.style.setProperty('--v17-cloud-scene-opacity', (.84 * cloudFade).toFixed(4));

    root.style.setProperty('--v17-moon-scene-opacity', moonScene.toFixed(4));
    root.style.setProperty('--v17-moon-left-x', `${(-moonShift).toFixed(2)}vw`);
    root.style.setProperty('--v17-moon-right-x', `${moonShift.toFixed(2)}vw`);
    root.style.setProperty('--v17-moon-y', `${(-Math.max(0, y - vh * .6) * .008).toFixed(1)}px`);
    root.style.setProperty('--v17-moon-cloud-opacity', (.82 - moonReveal * .3).toFixed(4));
    root.style.setProperty('--v17-moon-scale', (.76 + moonReveal * .26).toFixed(4));
    root.style.setProperty('--v17-moon-opacity', (.04 + moonReveal * .94).toFixed(4));
    root.style.setProperty('--v17-stars-opacity', (.1 + moonScene * .2).toFixed(4));
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

    // This observer never expires: content rendered after API calls or after the
    // page is fully loaded still receives reveal/hover animation behavior.
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
