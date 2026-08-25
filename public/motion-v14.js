(() => {
  if (window.__SKYNET_MOTION_V14__) return;
  window.__SKYNET_MOTION_V14__ = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const seen = new WeakSet();
  let raf = 0;
  let scrollY = window.scrollY;

  const style = document.createElement('style');
  style.id = 'motionV14Styles';
  style.textContent = `
    .v14-reveal{opacity:0;transform:translate3d(0,24px,0);filter:blur(7px);clip-path:inset(0 0 18% 0);transition:opacity .66s ease,transform .82s cubic-bezier(.16,.78,.18,1),filter .66s ease,clip-path .82s cubic-bezier(.16,.78,.18,1)}
    .v14-reveal.v14-visible{opacity:1;transform:none;filter:none;clip-path:inset(0)}
    .v14-parallax{will-change:transform;transform:translate3d(0,var(--v14-parallax-y,0px),0)}
    .v14-perspective-wrap{perspective:1200px;perspective-origin:50% 45%}
    .v14-tilt{transform-style:preserve-3d;transition:transform .45s cubic-bezier(.2,.7,.2,1),border-color .24s ease,box-shadow .32s ease;will-change:transform}
    .v14-tilt.v14-hovered{transition:transform .08s linear,border-color .24s ease,box-shadow .32s ease;box-shadow:0 28px 70px rgba(0,0,0,.28)!important}
    .v14-slice{position:relative;isolation:isolate;overflow:hidden}
    .v14-slice::after{content:'';position:absolute;inset:-18% -42%;z-index:0;pointer-events:none;background:linear-gradient(106deg,transparent 38%,rgba(255,255,255,.055) 48%,rgba(141,128,237,.035) 51%,transparent 61%);transform:translate3d(-28%,0,0);animation:v14-slice-pass 11s cubic-bezier(.45,.05,.2,1) infinite}
    .v14-slice>*{position:relative;z-index:1}
    .v14-stock-lines{position:fixed;inset:0;z-index:-2;pointer-events:none;overflow:hidden}
    .v14-stock-lines i{position:absolute;display:block;width:1px;height:36vh;background:linear-gradient(transparent,rgba(255,255,255,.1),transparent);opacity:.25;animation:v14-line-drift 16s ease-in-out infinite alternate}
    .v14-stock-lines i:nth-child(1){left:12%;top:5%}.v14-stock-lines i:nth-child(2){left:68%;top:19%;height:48vh;animation-delay:-6s;animation-duration:21s}.v14-stock-lines i:nth-child(3){left:88%;top:49%;height:30vh;animation-delay:-11s;animation-duration:18s}.v14-stock-lines i:nth-child(4){left:38%;top:61%;height:26vh;animation-delay:-3s}
    .v14-orbit-stock{position:absolute;border:1px solid rgba(255,255,255,.085);border-radius:50%;pointer-events:none;animation:v14-orbit 18s linear infinite}
    .v14-orbit-stock::before{content:'';position:absolute;width:6px;height:6px;border-radius:50%;background:#e8e8e4;box-shadow:0 0 0 3px rgba(141,128,237,.12);top:13%;left:17%}
    .v14-scroll-progress{position:fixed;left:0;top:0;z-index:99999;height:1px;width:var(--v14-scroll,0%);background:linear-gradient(90deg,#f0f0ed 0 78%,#8d80ed);pointer-events:none}
    .v14-pointer-depth{--v14-px:0;--v14-py:0}
    .v14-pointer-depth .v14-depth-a{transform:translate3d(calc(var(--v14-px)*8px),calc(var(--v14-py)*8px),20px)}
    .v14-pointer-depth .v14-depth-b{transform:translate3d(calc(var(--v14-px)*-13px),calc(var(--v14-py)*-13px),36px)}
    @keyframes v14-slice-pass{0%,55%{transform:translate3d(-38%,0,0);opacity:0}65%{opacity:.9}82%,100%{transform:translate3d(38%,0,0);opacity:0}}
    @keyframes v14-line-drift{from{transform:translate3d(0,-24px,0) rotate(5deg)}to{transform:translate3d(18px,36px,0) rotate(-4deg)}}
    @keyframes v14-orbit{to{transform:rotate(360deg)}}
    @media(max-width:820px){.v14-reveal{transform:translate3d(0,16px,0);filter:blur(3px)}.v14-slice::after{opacity:.55;animation-duration:14s}.v14-stock-lines i{opacity:.15}.v14-tilt{transform:none!important}}
    @media(prefers-reduced-motion:reduce){.v14-reveal{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important;transition:none!important}.v14-slice::after,.v14-stock-lines i,.v14-orbit-stock{animation:none!important}.v14-parallax,.v14-tilt{transform:none!important}}
  `;
  document.head.appendChild(style);

  const progress = document.createElement('div');
  progress.className = 'v14-scroll-progress';
  progress.setAttribute('aria-hidden','true');
  document.body.appendChild(progress);

  if (!reduce.matches && !document.querySelector('.v14-stock-lines')) {
    const stocks = document.createElement('div');
    stocks.className = 'v14-stock-lines';
    stocks.setAttribute('aria-hidden','true');
    stocks.innerHTML = '<i></i><i></i><i></i><i></i>';
    document.body.appendChild(stocks);
  }

  const revealObserver = reduce.matches ? null : new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('v14-visible');
      revealObserver.unobserve(entry.target);
    }
  }, { threshold:.06, rootMargin:'0px 0px -6% 0px' });

  const revealSelector = [
    '.hero','.home-section','.podium-wrap','.workspace-content > section','.workspace-page-grid > .workspace-card',
    '.workspace-stat-grid > .workspace-stat','.profile-v3-shell > section','.chat-layout','.sticker-page-v1 > section',
    '#app > header','#app > .stats','#app > .tabs','#app > .tab-panel.active > .card','.music-hub-v13','.visual-lab-v14'
  ].join(',');
  const tiltSelector = '.workspace-card,.workspace-quick,.file-card,.home-feature,.profile-v3-product';
  const sliceSelector = '.workspace-card,.home-feature,.chat-layout,.profile-v3-card';
  const parallaxSelector = '.hero,.home-section-head,.workspace-heading,.profile-v3-preview,.music-hub-visual-v13';

  function enhance(root=document){
    const reveals=[];
    if(root.nodeType===1&&root.matches?.(revealSelector)) reveals.push(root);
    reveals.push(...(root.querySelectorAll?.(revealSelector)||[]));
    reveals.forEach((node,index)=>{
      if(seen.has(node)) return;
      seen.add(node);
      node.classList.add('v14-reveal');
      node.style.transitionDelay=`${Math.min(index,7)*42}ms`;
      if(reduce.matches) node.classList.add('v14-visible'); else revealObserver.observe(node);
    });
    (root.querySelectorAll?.(tiltSelector)||[]).forEach(node=>{
      node.classList.add('v14-tilt');
      node.dataset.v14Tilt='1';
    });
    (root.querySelectorAll?.(sliceSelector)||[]).forEach(node=>node.classList.add('v14-slice'));
    (root.querySelectorAll?.(parallaxSelector)||[]).forEach((node,index)=>{
      node.classList.add('v14-parallax');
      if(!node.dataset.v14Depth) node.dataset.v14Depth=String(.035+Math.min(index,3)*.012);
    });
  }

  function updateScroll(){
    raf=0;
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    document.documentElement.style.setProperty('--v14-scroll',`${Math.min(100,scrollY/max*100)}%`);
    if(!reduce.matches){
      document.querySelectorAll('.v14-parallax').forEach(node=>{
        const rect=node.getBoundingClientRect();
        const center=rect.top+rect.height/2-innerHeight/2;
        const depth=Number(node.dataset.v14Depth||.04);
        const y=Math.max(-28,Math.min(28,-center*depth));
        node.style.setProperty('--v14-parallax-y',`${y.toFixed(2)}px`);
      });
    }
  }

  function scheduleScroll(){scrollY=window.scrollY;if(!raf)raf=requestAnimationFrame(updateScroll)}

  function pointerMove(event){
    if(reduce.matches||!fine.matches) return;
    const node=event.target.closest?.('[data-v14-tilt]');
    document.querySelectorAll('.v14-tilt.v14-hovered').forEach(item=>{if(item!==node){item.classList.remove('v14-hovered');item.style.transform=''}});
    if(!node) return;
    const r=node.getBoundingClientRect();
    const x=(event.clientX-r.left)/Math.max(1,r.width)-.5;
    const y=(event.clientY-r.top)/Math.max(1,r.height)-.5;
    const rx=(-y*3.2).toFixed(2);
    const ry=(x*4.2).toFixed(2);
    node.classList.add('v14-hovered');
    node.style.transform=`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
    node.style.setProperty('--v14-px',x.toFixed(3));
    node.style.setProperty('--v14-py',y.toFixed(3));
  }

  function pointerOut(event){
    if(!fine.matches) return;
    const node=event.target.closest?.('[data-v14-tilt]');
    if(!node||node.contains(event.relatedTarget)) return;
    node.classList.remove('v14-hovered');
    node.style.transform='';
  }

  function boot(){
    enhance(document);
    updateScroll();
    addEventListener('scroll',scheduleScroll,{passive:true});
    addEventListener('resize',scheduleScroll,{passive:true});
    document.addEventListener('pointermove',pointerMove,{passive:true});
    document.addEventListener('pointerout',pointerOut,{passive:true});
    const mutation=new MutationObserver(records=>requestAnimationFrame(()=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)enhance(node)}))));
    mutation.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
