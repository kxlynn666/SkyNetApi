(() => {
  if (window.__SKYNET_MOTION_V18__) return;
  window.__SKYNET_MOTION_V18__ = true;
  window.__SKYNET_MOTION_V17__ = true;
  window.__SKYNET_MOTION_V16__ = true;
  window.__SKYNET_MOTION_V15__ = true;
  window.__SKYNET_MOTION_REPEAT_V1__ = true;
  window.__SKYNET_MOTION_SCROLL_SCENES_V1__ = true;
  window.__SKYNET_MOTION_SCROLL_SCENES_V2__ = true;

  const observed = new WeakSet();
  const leaveTimers = new WeakMap();
  const pendingRoots = new Set();
  let decorateRaf = 0;
  let skyRaf = 0;

  document.querySelectorAll('.v17-sky,.v16-atmosphere,.v17-scroll-scenes,.v15-atmosphere,.v15-page-flash,.v16-page-flash').forEach(node => node.remove());
  ['motionV17Styles','motionV16Styles','motionV15Styles','motionScrollScenesV1Styles','motionScrollScenesV2Styles'].forEach(id => document.getElementById(id)?.remove());

  const MOON_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/1280px-FullMoon2010.jpg';
  const CLOUD_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Cumulus_Cloud.jpg/1280px-Cumulus_Cloud.jpg';

  const style = document.createElement('style');
  style.id = 'motionV18Styles';
  style.textContent = `
    body.workspace-body{background:#09070f!important}
    body.workspace-body .workspace-shell{position:relative;z-index:auto!important}
    body.workspace-body .workspace-loading{position:relative;z-index:50}
    body.workspace-body .workspace-main{position:relative;z-index:auto}
    body.workspace-body .workspace-content{position:relative;z-index:4}
    body.workspace-body .workspace-sidebar,body.workspace-body .workspace-topbar{position:relative;z-index:40}

    .v18-space{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:radial-gradient(circle at 50% 118%,rgba(88,70,146,.2),transparent 48%),linear-gradient(#08070d,#0b0813);contain:strict}
    .v18-stars{position:absolute;inset:0;opacity:.13;background-image:radial-gradient(circle,rgba(255,255,255,.38) 0 1px,transparent 1.35px),radial-gradient(circle,rgba(186,176,255,.22) 0 1px,transparent 1.3px);background-size:101px 101px,157px 157px;background-position:13px 27px,71px 43px}
    .v18-moon-stage{position:absolute;inset:0;opacity:var(--v18-moon-stage,0);will-change:opacity}
    .v18-moon{position:absolute;left:50%;top:48%;width:min(34vw,390px);aspect-ratio:1;object-fit:cover;clip-path:circle(46% at 50% 50%);transform:translate(-50%,-50%) scale(var(--v18-moon-scale,.82));opacity:var(--v18-moon-opacity,0);filter:drop-shadow(0 0 26px rgba(224,222,255,.18)) drop-shadow(0 0 78px rgba(131,113,224,.18));will-change:transform,opacity}
    .v18-moon-credit{position:absolute;right:8px;bottom:6px;font:500 6px/1.2 system-ui,sans-serif;color:rgba(255,255,255,.18);letter-spacing:.02em}

    .v18-cloud-curtain{position:fixed;inset:0;z-index:22;pointer-events:none;overflow:hidden;contain:layout paint style}
    .v18-cloud-bank{position:absolute;top:5vh;width:78vw;height:72vh;min-height:410px;background-color:#bfc1cc;background-image:linear-gradient(rgba(45,40,60,.34),rgba(20,18,28,.46)),url('${CLOUD_URL}');background-size:cover;background-position:center 38%;background-blend-mode:multiply,normal;-webkit-mask-image:url('/cloud-mask-v1.svg');mask-image:url('/cloud-mask-v1.svg');-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;opacity:var(--v18-cloud-opacity,.98);will-change:transform,opacity;transform:translate3d(0,0,0)}
    .v18-cloud-main-left{left:-15vw;transform:translate3d(var(--v18-cloud-left-x,0vw),var(--v18-cloud-y,0px),0) scale(1.08)}
    .v18-cloud-main-right{right:-15vw;transform:translate3d(var(--v18-cloud-right-x,0vw),var(--v18-cloud-y,0px),0) scaleX(-1) scale(1.08)}
    .v18-cloud-moon-left,.v18-cloud-moon-right{top:15vh;width:70vw;height:65vh;opacity:var(--v18-moon-cloud-opacity,0)}
    .v18-cloud-moon-left{left:-13vw;transform:translate3d(var(--v18-moon-left-x,0vw),var(--v18-moon-y,0px),0) scale(.98)}
    .v18-cloud-moon-right{right:-13vw;transform:translate3d(var(--v18-moon-right-x,0vw),var(--v18-moon-y,0px),0) scaleX(-1) scale(.98)}

    .v18-reveal{opacity:0;transform:translate3d(0,12px,0) scale(.997);transition:opacity .92s cubic-bezier(.16,1,.3,1),transform 1s cubic-bezier(.16,1,.3,1)}
    .v18-reveal.v18-visible{opacity:1;transform:translate3d(0,0,0) scale(1)}
    .v18-card-motion{transition:opacity .92s cubic-bezier(.16,1,.3,1),transform 1s cubic-bezier(.16,1,.3,1),box-shadow .42s cubic-bezier(.16,1,.3,1),border-color .32s ease}
    .v18-card-motion.v18-visible:hover{transform:translate3d(0,-3px,0) scale(1.002);box-shadow:0 20px 52px rgba(0,0,0,.2)}
    .v18-button-motion{transition:transform .22s cubic-bezier(.16,1,.3,1),background-color .22s ease,border-color .22s ease,box-shadow .28s ease!important}
    .v18-button-motion:hover{transform:translate3d(0,-1px,0)}
    .v18-button-motion:active{transform:translate3d(0,1px,0) scale(.986)!important}

    .profile-v3-shell video,.public-profile-shell video,.podium-card-v3 video,.panel-mini-podium-card video,.leaderboard-row video{pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important}
    .profile-v3-shell video::-webkit-media-controls,.public-profile-shell video::-webkit-media-controls,.podium-card-v3 video::-webkit-media-controls,.panel-mini-podium-card video::-webkit-media-controls,.leaderboard-row video::-webkit-media-controls{display:none!important;-webkit-appearance:none!important}

    @media(max-width:820px){
      .v18-cloud-bank{top:10vh;width:112vw;height:60vh;min-height:330px}
      .v18-cloud-main-left{left:-54vw}.v18-cloud-main-right{right:-54vw}
      .v18-cloud-moon-left,.v18-cloud-moon-right{width:108vw;height:58vh;top:18vh}
      .v18-cloud-moon-left{left:-50vw}.v18-cloud-moon-right{right:-50vw}
      .v18-moon{width:min(52vw,270px)}
      .v18-reveal{transform:translate3d(0,9px,0) scale(.998);transition-duration:.82s,.9s}
    }
    @media(prefers-reduced-motion:reduce){.v18-reveal{transform:translate3d(0,5px,0);transition-duration:.62s,.68s}}
  `;
  document.head.appendChild(style);

  function installSky() {
    if (document.querySelector('.v18-space')) return;
    const space = document.createElement('div');
    space.className = 'v18-space';
    space.setAttribute('aria-hidden','true');
    space.innerHTML = `<div class="v18-stars"></div><div class="v18-moon-stage"><img class="v18-moon" src="${MOON_URL}" alt="" decoding="async" fetchpriority="low" referrerpolicy="no-referrer"><span class="v18-moon-credit">Lua: Gregory H. Revera · CC BY-SA 3.0</span></div>`;
    document.body.prepend(space);

    const curtain = document.createElement('div');
    curtain.className = 'v18-cloud-curtain';
    curtain.setAttribute('aria-hidden','true');
    curtain.innerHTML = '<span class="v18-cloud-bank v18-cloud-main-left"></span><span class="v18-cloud-bank v18-cloud-main-right"></span><span class="v18-cloud-bank v18-cloud-moon-left"></span><span class="v18-cloud-bank v18-cloud-moon-right"></span>';
    document.body.appendChild(curtain);
  }

  const revealSelector = [
    '.hero','.home-section','.home-status-strip','.podium-wrap','.podium-card-v3','.panel-mini-podium-card','.leaderboard-row',
    '.workspace-content > section','.workspace-page-grid > *','.workspace-stat-grid > *',
    '.profile-v3-top > *','.profile-v3-summary-card','.profile-v3-panel > .profile-v3-grid > *','.profile-v3-product',
    '.chat-layout','.stickers-page-v1 > section','.music-hub-v13 > *','.visual-lab-v14 > *','.upscale-v1 > *',
    '#app > header','#app > .stats','#app > .tabs','#app > .tab-panel > *','.workspace-login-shell','.register-v14-shell','.public-profile-shell',
    '.card','.file-card','.ttt-v2 > *'
  ].join(',');
  const cardSelector = '.workspace-card,.workspace-quick,.home-feature,.file-card,.endpoint,.profile-v3-card,.profile-v3-summary-card,.profile-v3-product,.podium-card-v3,.panel-mini-podium-card,.sticker-create-v1,.sticker-library-v1,.upscale-controls-v1,.upscale-preview-v1,.ttt-panel';

  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const node = entry.target;
      const timer = leaveTimers.get(node);
      if (timer) { clearTimeout(timer); leaveTimers.delete(node); }
      if (entry.isIntersecting && entry.intersectionRatio > .015) {
        node.classList.add('v18-visible');
      } else if (!entry.isIntersecting) {
        const id = setTimeout(() => {
          if (node.isConnected) node.classList.remove('v18-visible');
          leaveTimers.delete(node);
        }, 75);
        leaveTimers.set(node,id);
      }
    }
  }, { threshold:[0,.02,.12], rootMargin:'1% 0px 1% 0px' }) : null;

  function decorate(root) {
    if (!(root instanceof Element) && root !== document.documentElement && root !== document.body) return;
    const reveals = [];
    if (root.matches?.(revealSelector)) reveals.push(root);
    reveals.push(...(root.querySelectorAll?.(revealSelector) || []));
    for (const node of reveals) {
      if (observed.has(node)) continue;
      observed.add(node);
      node.classList.add('v18-reveal');
      if (node.matches(cardSelector)) node.classList.add('v18-card-motion');
      if (revealObserver) requestAnimationFrame(() => requestAnimationFrame(() => node.isConnected && revealObserver.observe(node)));
      else requestAnimationFrame(() => node.classList.add('v18-visible'));
    }

    const buttons = [];
    if (root.matches?.('button,.button,.workspace-nav-link,.nav-link')) buttons.push(root);
    buttons.push(...(root.querySelectorAll?.('button,.button,.workspace-nav-link,.nav-link') || []));
    for (const button of buttons) button.classList.add('v18-button-motion');
  }

  function queueDecorate(root) {
    if (root instanceof Element) pendingRoots.add(root);
    if (decorateRaf) return;
    decorateRaf = requestAnimationFrame(() => {
      decorateRaf = 0;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.forEach(decorate);
    });
  }

  const clamp01 = value => Math.max(0,Math.min(1,value));
  const smoothstep = value => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  };

  function updateSky() {
    skyRaf = 0;
    const root = document.documentElement;
    const y = window.scrollY || root.scrollTop || 0;
    const vh = Math.max(360,innerHeight);
    const u = y / vh;
    const mobile = innerWidth <= 820;

    // Foreground curtain: closed at the top, opens while descending and closes on the same path while ascending.
    const open = smoothstep((u - .015) / .64);
    const firstScene = 1 - smoothstep((u - .88) / .34);
    const shift = open * (mobile ? 66 : 57);
    root.style.setProperty('--v18-cloud-left-x', `${(-shift).toFixed(2)}vw`);
    root.style.setProperty('--v18-cloud-right-x', `${shift.toFixed(2)}vw`);
    root.style.setProperty('--v18-cloud-y', `${(-Math.min(y,vh) * .018).toFixed(1)}px`);
    root.style.setProperty('--v18-cloud-opacity', Math.max(0,firstScene * .98).toFixed(4));

    // Second curtain farther down reveals a photographic moon.
    const moonSceneIn = smoothstep((u - .72) / .28);
    const moonSceneOut = 1 - smoothstep((u - 2.25) / .42);
    const moonScene = moonSceneIn * moonSceneOut;
    const moonOpen = smoothstep((u - .94) / .72);
    const moonShift = moonOpen * (mobile ? 62 : 52);
    const moonReveal = smoothstep((u - 1.05) / .58) * moonSceneOut;
    root.style.setProperty('--v18-moon-left-x', `${(-moonShift).toFixed(2)}vw`);
    root.style.setProperty('--v18-moon-right-x', `${moonShift.toFixed(2)}vw`);
    root.style.setProperty('--v18-moon-y', `${(-Math.max(0,y-vh*.72) * .01).toFixed(1)}px`);
    root.style.setProperty('--v18-moon-cloud-opacity', (moonScene * .94).toFixed(4));
    root.style.setProperty('--v18-moon-stage', moonScene.toFixed(4));
    root.style.setProperty('--v18-moon-opacity', (.08 + moonReveal * .88).toFixed(4));
    root.style.setProperty('--v18-moon-scale', (.82 + moonReveal * .18).toFixed(4));
  }

  function scheduleSky() {
    if (!skyRaf) skyRaf = requestAnimationFrame(updateSky);
  }

  function boot() {
    installSky();
    decorate(document.body);
    updateSky();
    const mutation = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1 && !node.classList?.contains('v18-cloud-curtain') && !node.classList?.contains('v18-space')) queueDecorate(node);
    });
    mutation.observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  addEventListener('scroll',scheduleSky,{passive:true});
  addEventListener('resize',scheduleSky,{passive:true});
})();
