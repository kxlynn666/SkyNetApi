(() => {
  if (window.__SKYNET_MOTION_V19__) return;
  window.__SKYNET_MOTION_V19__ = true;
  window.__SKYNET_MOTION_V18__ = true;
  window.__SKYNET_MOTION_V17__ = true;
  window.__SKYNET_MOTION_V16__ = true;
  window.__SKYNET_MOTION_REPEAT_V1__ = true;

  document.querySelectorAll('.v18-space,.v18-cloud-curtain,.v17-sky,.v16-atmosphere,.v15-atmosphere,.v15-page-flash,.v16-page-flash').forEach(node => node.remove());
  ['motionV18Styles','motionV17Styles','motionV16Styles','motionV15Styles'].forEach(id => document.getElementById(id)?.remove());

  const style = document.createElement('style');
  style.id = 'motionV19Styles';
  style.textContent = `
    :root{--mr19-progress:0;--mr19-accent:142,130,232;--mr19-warm:212,69,54}
    body{background:#060608!important}
    .mr19-stage{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;contain:strict;background:#060608}
    .mr19-stage::before{content:'';position:absolute;inset:-12%;background:radial-gradient(55vw 48vw at calc(82% - var(--mr19-progress)*18%) 18%,rgba(var(--mr19-accent),.16),transparent 65%),radial-gradient(46vw 38vw at calc(16% + var(--mr19-progress)*16%) 78%,rgba(var(--mr19-warm),.09),transparent 70%);transform:translate3d(0,0,0)}
    .mr19-grid{position:absolute;inset:0;opacity:.18;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px;transform:translate3d(var(--mr19-grid-x,0px),var(--mr19-grid-y,0px),0)}
    .mr19-band{position:absolute;left:-18vw;width:136vw;height:clamp(90px,13vh,150px);border-top:1px solid rgba(255,255,255,.09);border-bottom:1px solid rgba(255,255,255,.06);background:linear-gradient(90deg,transparent,rgba(var(--mr19-accent),.08) 30%,rgba(var(--mr19-warm),.08) 68%,transparent);transform:translate3d(var(--mr19-band-x,0vw),var(--mr19-band-y,0vh),0) rotate(-3deg);opacity:.72}
    .mr19-band.b2{top:62%;height:clamp(55px,8vh,100px);opacity:.38;transform:translate3d(var(--mr19-band2-x,0vw),0,0) rotate(2deg)}
    .mr19-orbit{position:absolute;width:min(70vw,860px);aspect-ratio:1;border:1px solid rgba(255,255,255,.065);border-radius:50%;right:-28vw;top:8vh;transform:translate3d(var(--mr19-orbit-x,0px),var(--mr19-orbit-y,0px),0) rotate(var(--mr19-orbit-r,0deg));box-shadow:inset 0 0 0 1px rgba(var(--mr19-accent),.025)}
    .mr19-orbit::before,.mr19-orbit::after{content:'';position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.045);inset:12%}.mr19-orbit::after{inset:28%}

    .mr19-reveal{opacity:0;transform:translate3d(0,22px,0);transition:opacity .78s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1)}
    .mr19-reveal.mr19-visible{opacity:1;transform:none}
    .mr19-reveal[data-mr-side="left"]{transform:translate3d(-30px,10px,0)}
    .mr19-reveal[data-mr-side="right"]{transform:translate3d(30px,10px,0)}
    .mr19-reveal.mr19-visible[data-mr-side]{transform:none}
    .mr19-card{transition:opacity .78s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1),border-color .24s ease,box-shadow .28s ease}
    @media(hover:hover) and (pointer:fine){.mr19-card.mr19-visible:hover{transform:translate3d(0,-4px,0);box-shadow:0 24px 58px rgba(0,0,0,.22)!important}}
    .mr19-title{transition:letter-spacing .55s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
    .mr19-visible .mr19-title{letter-spacing:-.015em}

    @media(max-width:820px){.mr19-grid{opacity:.11;background-size:40px 40px}.mr19-orbit{width:105vw;right:-62vw;top:18vh}.mr19-band{height:80px}.mr19-reveal{transform:translate3d(0,15px,0)}.mr19-reveal[data-mr-side="left"],.mr19-reveal[data-mr-side="right"]{transform:translate3d(0,15px,0)}}
    @media(prefers-reduced-motion:reduce){.mr19-reveal{transform:translate3d(0,7px,0);transition-duration:.5s,.58s}.mr19-stage{opacity:.78}}
  `;
  document.head.appendChild(style);

  const stage = document.createElement('div');
  stage.className = 'mr19-stage';
  stage.setAttribute('aria-hidden','true');
  stage.innerHTML = '<div class="mr19-grid"></div><div class="mr19-band b1"></div><div class="mr19-band b2"></div><div class="mr19-orbit"></div>';
  document.body.prepend(stage);

  const visible = new Set();
  const observed = new WeakSet();
  const selectors = [
    '.hero','.home-status-strip','.home-section','.home-feature','.podium-wrap','.podium-card-v3','.leaderboard-row',
    '.workspace-content > section','.workspace-card','.workspace-stat','.workspace-quick','.profile-v3-top > *','.profile-v3-summary-card','.profile-v3-panel > .profile-v3-grid > *','.profile-v3-product',
    '.chat-layout','.music-hub-v13 > *','.visual-lab-v14 > *','.upscale-v1 > *','.ttt-v2 > *','.card','.file-card','.endpoint'
  ].join(',');
  const cardSelector = '.home-feature,.podium-card-v3,.workspace-card,.workspace-stat,.workspace-quick,.profile-v3-summary-card,.profile-v3-product,.file-card,.endpoint';

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        visible.add(entry.target);
        entry.target.classList.add('mr19-visible');
      } else {
        visible.delete(entry.target);
        entry.target.classList.remove('mr19-visible');
      }
    }
  }, { threshold:.06, rootMargin:'2% 0px 2% 0px' }) : null;

  function decorate(root) {
    const nodes = [];
    if (root.matches?.(selectors)) nodes.push(root);
    nodes.push(...(root.querySelectorAll?.(selectors) || []));
    nodes.forEach((node,index) => {
      if (observed.has(node)) return;
      observed.add(node);
      node.classList.add('mr19-reveal');
      if (node.matches(cardSelector)) node.classList.add('mr19-card');
      if (index % 3 === 0) node.dataset.mrSide = 'left';
      else if (index % 3 === 2) node.dataset.mrSide = 'right';
      node.querySelector?.('h1,h2,h3')?.classList.add('mr19-title');
      requestAnimationFrame(() => requestAnimationFrame(() => io ? io.observe(node) : node.classList.add('mr19-visible')));
    });
  }

  let mutationRaf = 0;
  const pending = new Set();
  const mutation = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1 && !node.classList?.contains('mr19-stage')) pending.add(node);
    if (!pending.size || mutationRaf) return;
    mutationRaf = requestAnimationFrame(() => {
      mutationRaf = 0;
      [...pending].forEach(decorate);
      pending.clear();
    });
  });
  mutation.observe(document.body,{childList:true,subtree:true});
  decorate(document.body);

  let raf = 0;
  function render() {
    raf = 0;
    const root = document.documentElement;
    const max = Math.max(1,root.scrollHeight-innerHeight);
    const y = window.scrollY || root.scrollTop || 0;
    const p = Math.max(0,Math.min(1,y/max));
    root.style.setProperty('--mr19-progress',p.toFixed(4));
    root.style.setProperty('--mr19-grid-x',`${(-y*.025).toFixed(1)}px`);
    root.style.setProperty('--mr19-grid-y',`${(-y*.04).toFixed(1)}px`);
    root.style.setProperty('--mr19-band-x',`${(-12+p*26).toFixed(2)}vw`);
    root.style.setProperty('--mr19-band-y',`${(16+p*25).toFixed(2)}vh`);
    root.style.setProperty('--mr19-band2-x',`${(10-p*24).toFixed(2)}vw`);
    root.style.setProperty('--mr19-orbit-x',`${(-p*90).toFixed(1)}px`);
    root.style.setProperty('--mr19-orbit-y',`${(p*72).toFixed(1)}px`);
    root.style.setProperty('--mr19-orbit-r',`${(p*22).toFixed(1)}deg`);
  }
  const schedule = () => { if (!raf) raf=requestAnimationFrame(render); };
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  render();
})();