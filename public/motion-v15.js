(() => {
  if (window.__SKYNET_MOTION_V15__) return;
  window.__SKYNET_MOTION_V15__ = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  let raf = 0;
  let scrollY = window.scrollY;
  const seen = new WeakSet();

  const style = document.createElement('style');
  style.id = 'motionV15Styles';
  style.textContent = `
    .v15-atmosphere{position:fixed;inset:0;z-index:-12;pointer-events:none;overflow:hidden;isolation:isolate}
    .v15-cloud{position:absolute;width:58vw;height:24vw;min-width:420px;min-height:170px;opacity:.18;will-change:transform,opacity;background:radial-gradient(ellipse at 32% 54%,rgba(255,255,255,.075),transparent 36%),radial-gradient(ellipse at 56% 46%,rgba(255,255,255,.055),transparent 35%),radial-gradient(ellipse at 73% 57%,rgba(142,130,232,.055),transparent 32%);mask-image:linear-gradient(to right,transparent,#000 18%,#000 82%,transparent)}
    .v15-cloud-a{left:-16vw;top:7vh;transform:translate3d(calc(var(--v15-cloud-x,0px) * .25),calc(var(--v15-scroll-px,0px) * -.035),0) scale(1.05);animation:v15-cloud-a 24s ease-in-out infinite alternate}
    .v15-cloud-b{right:-18vw;top:42vh;opacity:.13;transform:translate3d(calc(var(--v15-cloud-x,0px) * -.18),calc(var(--v15-scroll-px,0px) * -.055),0) scale(.92);animation:v15-cloud-b 31s ease-in-out infinite alternate}
    .v15-cloud-c{left:22vw;bottom:-8vh;opacity:.1;transform:translate3d(calc(var(--v15-cloud-x,0px) * .12),calc(var(--v15-scroll-px,0px) * -.025),0) scale(1.15);animation:v15-cloud-c 36s ease-in-out infinite alternate}
    .v15-depth-grid{position:absolute;inset:auto -12vw -14vh;height:48vh;opacity:.16;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:54px 54px;transform:perspective(700px) rotateX(68deg) translate3d(0,calc(var(--v15-scroll-px,0px) * -.018),0);transform-origin:center bottom;mask-image:linear-gradient(to top,#000,transparent 80%)}
    .v15-depth-rail{position:absolute;top:8%;bottom:9%;width:1px;background:linear-gradient(transparent,rgba(255,255,255,.12),transparent);opacity:.22;animation:v15-rail 13s ease-in-out infinite alternate}
    .v15-depth-rail:nth-child(5){left:17%;animation-delay:-4s}.v15-depth-rail:nth-child(6){left:72%;animation-delay:-8s}.v15-depth-rail:nth-child(7){left:91%;animation-delay:-2s}

    .v15-reveal{opacity:0;transform:translate3d(0,28px,-28px) rotateX(3.2deg) scale(.988);filter:blur(6px);transition:opacity .62s ease,transform .82s cubic-bezier(.16,.78,.18,1),filter .62s ease;transform-origin:50% 20%;will-change:transform,opacity}
    .v15-reveal.v15-visible{opacity:1;transform:translate3d(0,0,0) rotateX(0) scale(1);filter:none}
    .v15-parallax{will-change:transform;transform:translate3d(0,var(--v15-parallax-y,0px),0)}
    .v15-layer-card{transform-style:preserve-3d;backface-visibility:hidden;transition:transform .34s cubic-bezier(.2,.7,.2,1),border-color .2s ease,box-shadow .3s ease}
    .v15-layer-card.v15-hover{transition:transform .08s linear,border-color .2s ease,box-shadow .3s ease;box-shadow:0 30px 78px rgba(0,0,0,.30)!important}
    .v15-layer-card>*{transform:translateZ(8px)}
    .v15-layer-card h1,.v15-layer-card h2,.v15-layer-card h3,.v15-layer-card .workspace-card-header{transform:translateZ(18px)}
    .v15-sheen::before{animation:v15-sheen 10s cubic-bezier(.45,.05,.2,1) infinite!important}
    .v15-heading-motion{position:relative;display:block;overflow:visible}
    .v15-heading-motion::after{content:'';display:block;width:0;height:1px;margin-top:7px;background:linear-gradient(90deg,#f1f1ed,var(--v15-purple,#8e82e8),transparent);transition:width .8s cubic-bezier(.16,.78,.18,1)}
    .v15-visible .v15-heading-motion::after,.v15-heading-motion.v15-heading-on::after{width:min(150px,38%)}
    .v15-button-motion{transition:transform .16s ease,background .16s ease,border-color .16s ease,box-shadow .2s ease!important}
    .v15-button-motion:active{transform:translate3d(0,1px,0) scale(.982)!important}
    .v15-float{animation:v15-float 7s ease-in-out infinite}
    .v15-mobile-depth{transform-style:preserve-3d}
    .v15-page-ready .workspace-topbar,.v15-page-ready .topbar{animation:v15-topbar-in .55s cubic-bezier(.16,.78,.18,1) both}
    .v15-page-ready .workspace-sidebar{animation:v15-sidebar-in .62s cubic-bezier(.16,.78,.18,1) both}
    .v15-page-ready .workspace-heading{animation:v15-heading-in .7s .08s cubic-bezier(.16,.78,.18,1) both}
    .v15-message-enter{animation:v15-message-in .36s cubic-bezier(.18,.78,.24,1) both}
    .v15-page-flash{position:fixed;inset:0;z-index:999999;pointer-events:none;background:#050506;opacity:1;animation:v15-page-unveil .48s ease forwards}

    @keyframes v15-cloud-a{from{margin-left:-2vw;margin-top:-1vh;opacity:.12}to{margin-left:6vw;margin-top:3vh;opacity:.22}}
    @keyframes v15-cloud-b{from{margin-right:-5vw;margin-top:2vh}to{margin-right:4vw;margin-top:-4vh}}
    @keyframes v15-cloud-c{from{margin-left:1vw}to{margin-left:-7vw}}
    @keyframes v15-rail{from{transform:translate3d(0,-18px,0);opacity:.08}to{transform:translate3d(14px,28px,0);opacity:.28}}
    @keyframes v15-sheen{0%,48%{transform:translate3d(-58%,0,0);opacity:0}58%{opacity:.55}76%,100%{transform:translate3d(58%,0,0);opacity:0}}
    @keyframes v15-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-6px,0)}}
    @keyframes v15-topbar-in{from{opacity:0;transform:translate3d(0,-12px,0)}to{opacity:1;transform:none}}
    @keyframes v15-sidebar-in{from{opacity:0;transform:translate3d(-14px,0,0)}to{opacity:1;transform:none}}
    @keyframes v15-heading-in{from{opacity:0;transform:translate3d(0,14px,-16px);filter:blur(5px)}to{opacity:1;transform:none;filter:none}}
    @keyframes v15-message-in{from{opacity:0;transform:translate3d(0,8px,-8px) scale(.985)}to{opacity:1;transform:none}}
    @keyframes v15-page-unveil{to{opacity:0;visibility:hidden}}

    @media(max-width:820px){
      .v15-cloud{width:96vw;height:44vw;min-width:0;min-height:140px;opacity:.16}
      .v15-cloud-a{left:-42vw;top:9vh}.v15-cloud-b{right:-46vw;top:48vh;opacity:.12}.v15-cloud-c{left:2vw;bottom:2vh;opacity:.09}
      .v15-depth-grid{height:36vh;background-size:38px 38px;opacity:.12}
      .v15-reveal{transform:translate3d(0,20px,-18px) rotateX(2deg) scale(.99);filter:blur(3px)}
      .v15-layer-card>*{transform:translateZ(5px)}.v15-layer-card h1,.v15-layer-card h2,.v15-layer-card h3,.v15-layer-card .workspace-card-header{transform:translateZ(10px)}
      .v15-sheen::before{animation-duration:13s!important}
    }

    @media(prefers-reduced-motion:reduce){
      .v15-cloud,.v15-depth-rail,.v15-float,.v15-sheen::before,.v15-page-ready .workspace-topbar,.v15-page-ready .topbar,.v15-page-ready .workspace-sidebar,.v15-page-ready .workspace-heading,.v15-message-enter,.v15-page-flash{animation:none!important}
      .v15-reveal{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}
      .v15-parallax,.v15-layer-card,.v15-layer-card>*{transform:none!important}
    }
  `;
  document.head.appendChild(style);

  function installAtmosphere(){
    if (reduce.matches || document.querySelector('.v15-atmosphere')) return;
    const scene = document.createElement('div');
    scene.className = 'v15-atmosphere';
    scene.setAttribute('aria-hidden','true');
    scene.innerHTML = '<span class="v15-cloud v15-cloud-a"></span><span class="v15-cloud v15-cloud-b"></span><span class="v15-cloud v15-cloud-c"></span><span class="v15-depth-rail"></span><span class="v15-depth-rail"></span><span class="v15-depth-rail"></span><span class="v15-depth-grid"></span>';
    document.body.appendChild(scene);
  }

  const revealSelector = [
    '.hero','.home-section','.home-status-strip','.podium-wrap','.workspace-content > section','.workspace-page-grid > *',
    '.workspace-stat-grid > *','.profile-v3-shell > section','.profile-v3-card','.chat-layout','.stickers-page-v1 > section',
    '.music-hub-v13','.visual-lab-v14','.upscale-v1 > *','#app > header','#app > .stats','#app > .tabs','#app > .tab-panel.active > *',
    '.workspace-login-shell','.register-v14-shell','.public-profile-shell','.card','.file-card'
  ].join(',');
  const parallaxSelector = '.hero,.home-section-head,.workspace-heading,.profile-v3-preview,.music-hub-visual-v13,.visual-lab-stage-v14,.upscale-hero-v1,.workspace-login-brand,.register-v14-stage';
  const cardSelector = '.workspace-card,.workspace-quick,.home-feature,.file-card,.endpoint,.profile-v3-card:not(.profile-v3-product),.sticker-create-v1,.sticker-library-v1,.upscale-controls-v1,.upscale-preview-v1,.upscale-api-v1';

  const revealObserver = reduce.matches ? null : new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('v15-visible');
      entry.target.querySelectorAll?.('h1,h2,h3').forEach(h => h.classList.add('v15-heading-on'));
      revealObserver.unobserve(entry.target);
    }
  }, { threshold:.055, rootMargin:'0px 0px -4% 0px' });

  function enhance(root=document){
    const nodes = [];
    if (root.nodeType === 1 && root.matches?.(revealSelector)) nodes.push(root);
    nodes.push(...(root.querySelectorAll?.(revealSelector) || []));
    nodes.forEach((node,index) => {
      if (!seen.has(node)) {
        seen.add(node);
        node.classList.add('v15-reveal');
        node.style.transitionDelay = `${Math.min(index,8) * 36}ms`;
        if (reduce.matches) node.classList.add('v15-visible'); else revealObserver.observe(node);
      }
    });
    (root.querySelectorAll?.(parallaxSelector) || []).forEach((node,index) => {
      node.classList.add('v15-parallax','v15-mobile-depth');
      if (!node.dataset.v15Depth) node.dataset.v15Depth = String(.026 + Math.min(index,3) * .009);
    });
    (root.querySelectorAll?.(cardSelector) || []).forEach(node => {
      node.classList.add('v15-layer-card','v15-sheen');
      if (!node.querySelector(':scope > .profile-surface')) node.querySelectorAll(':scope > h1,:scope > h2,:scope > h3').forEach(h => h.classList.add('v15-heading-motion'));
    });
    (root.querySelectorAll?.('.button,.nav-link,.workspace-nav-link,button') || []).forEach(node => node.classList.add('v15-button-motion'));
  }

  function updateScroll(){
    raf = 0;
    document.documentElement.style.setProperty('--v15-scroll-px', `${scrollY}px`);
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    document.documentElement.style.setProperty('--v15-progress', String(Math.min(1, scrollY / max)));
    if (!reduce.matches) {
      document.querySelectorAll('.v15-parallax').forEach(node => {
        const rect = node.getBoundingClientRect();
        const center = rect.top + rect.height/2 - innerHeight/2;
        const depth = Number(node.dataset.v15Depth || .03);
        const limit = innerWidth < 820 ? 18 : 32;
        const y = Math.max(-limit, Math.min(limit, -center * depth));
        node.style.setProperty('--v15-parallax-y', `${y.toFixed(2)}px`);
      });
    }
  }

  function onPointerMove(event){
    if (reduce.matches || !fine.matches) return;
    const x = (event.clientX / innerWidth - .5);
    document.documentElement.style.setProperty('--v15-cloud-x', `${(x * 42).toFixed(1)}px`);
    const card = event.target.closest?.('.v15-layer-card');
    document.querySelectorAll('.v15-layer-card.v15-hover').forEach(node => { if (node !== card) { node.classList.remove('v15-hover'); node.style.transform=''; } });
    if (!card || card.closest('.profile-surface')) return;
    const r = card.getBoundingClientRect();
    const px = (event.clientX-r.left)/Math.max(1,r.width)-.5;
    const py = (event.clientY-r.top)/Math.max(1,r.height)-.5;
    card.classList.add('v15-hover');
    card.style.transform = `perspective(900px) rotateX(${(-py*2.8).toFixed(2)}deg) rotateY(${(px*3.7).toFixed(2)}deg) translate3d(0,-2px,10px)`;
  }

  function onPointerOut(event){
    if (!fine.matches) return;
    const card = event.target.closest?.('.v15-layer-card');
    if (!card || card.contains(event.relatedTarget)) return;
    card.classList.remove('v15-hover');
    card.style.transform = '';
  }

  function boot(){
    installAtmosphere();
    const flash = document.createElement('div');
    flash.className = 'v15-page-flash';
    flash.setAttribute('aria-hidden','true');
    document.body.appendChild(flash);
    document.body.classList.add('v15-page-ready');
    enhance(document);
    updateScroll();
    addEventListener('scroll', () => { scrollY = window.scrollY; if (!raf) raf = requestAnimationFrame(updateScroll); }, { passive:true });
    addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(updateScroll); }, { passive:true });
    document.addEventListener('pointermove', onPointerMove, { passive:true });
    document.addEventListener('pointerout', onPointerOut, { passive:true });
    const observer = new MutationObserver(records => requestAnimationFrame(() => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) enhance(node); }))));
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
