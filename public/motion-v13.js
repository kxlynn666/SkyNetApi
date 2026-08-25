(() => {
  if (window.__SKYNET_MOTION_V13__) return;
  window.__SKYNET_MOTION_V13__ = true;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const style = document.createElement('style');
  style.id = 'motionV13Styles';
  style.textContent = `
    .motion-v13-reveal{opacity:0;transform:translate3d(0,18px,0) scale(.992);filter:blur(4px);transition:opacity .58s ease,transform .68s cubic-bezier(.16,.78,.22,1),filter .58s ease}
    .motion-v13-reveal.is-visible{opacity:1;transform:none;filter:blur(0)}
    .motion-v13-surface{position:relative;isolation:isolate;overflow:hidden}
    .motion-v13-surface::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(108deg,transparent 0 38%,rgba(255,255,255,.045) 47%,transparent 56% 100%);background-size:240% 100%;background-position:120% 0;animation:motion-v13-sheen 9s cubic-bezier(.32,.64,.34,1) infinite}
    .motion-v13-surface>*{position:relative;z-index:1}
    .motion-v13-depth{transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s ease,border-color .35s ease!important}
    @media(hover:hover) and (pointer:fine){.motion-v13-depth:hover{transform:translateY(-3px) scale(1.006)!important;box-shadow:0 18px 38px rgba(0,0,0,.22)!important}}
    .motion-v13-ambient{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
    .motion-v13-ambient i{position:absolute;display:block;border-radius:50%;filter:blur(1px);opacity:.18;border:1px solid rgba(255,255,255,.07);animation:motion-v13-drift 18s ease-in-out infinite alternate}
    .motion-v13-ambient i:nth-child(1){width:34vw;height:34vw;min-width:260px;min-height:260px;left:-12vw;top:10vh}
    .motion-v13-ambient i:nth-child(2){width:22vw;height:22vw;min-width:180px;min-height:180px;right:-7vw;top:34vh;animation-duration:23s;animation-delay:-8s}
    .motion-v13-ambient i:nth-child(3){width:18vw;height:18vw;min-width:150px;min-height:150px;left:42vw;bottom:-9vw;animation-duration:26s;animation-delay:-14s}
    .motion-v13-focus{position:relative;overflow:hidden}.motion-v13-focus::before{content:'';position:absolute;inset:-2px;pointer-events:none;border-radius:inherit;background:radial-gradient(180px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.07),transparent 70%);opacity:0;transition:opacity .22s ease}.motion-v13-focus:hover::before{opacity:1}
    .motion-v13-breathe{animation:motion-v13-breathe 5.8s ease-in-out infinite}
    .motion-v13-float{animation:motion-v13-float 6.2s ease-in-out infinite}
    .motion-v13-stagger>*{opacity:0;transform:translateY(9px);animation:motion-v13-child-in .5s cubic-bezier(.2,.72,.2,1) forwards}.motion-v13-stagger>*:nth-child(2){animation-delay:.06s}.motion-v13-stagger>*:nth-child(3){animation-delay:.12s}.motion-v13-stagger>*:nth-child(4){animation-delay:.18s}.motion-v13-stagger>*:nth-child(5){animation-delay:.24s}.motion-v13-stagger>*:nth-child(6){animation-delay:.3s}
    .profile-preview-live-v2,.profile-preview-selected-v2{animation:motion-v13-preview-pulse 3.6s ease-in-out infinite}
    .profile-preview-live-v2 .profile-preview-mini-surface::after{content:'';position:absolute;inset:-20% -40%;background:linear-gradient(100deg,transparent 40%,rgba(255,255,255,.12) 50%,transparent 60%);transform:translateX(-35%);animation:motion-v13-preview-scan 4.5s ease-in-out infinite;pointer-events:none}
    .chat-bubble{transition:transform .22s ease,opacity .22s ease}.chat-bubble:last-child{animation:motion-v13-message-in .34s cubic-bezier(.16,.75,.24,1)}
    .sticker-item-v1 img,.sticker-item-v1 svg{transition:transform .28s cubic-bezier(.2,.75,.2,1)}.sticker-item-v1:hover img,.sticker-item-v1:hover svg{transform:scale(1.06) rotate(-1deg)}
    @keyframes motion-v13-sheen{0%,52%{background-position:130% 0}72%,100%{background-position:-130% 0}}
    @keyframes motion-v13-drift{from{transform:translate3d(-10px,-7px,0) scale(.96)}to{transform:translate3d(20px,18px,0) scale(1.06)}}
    @keyframes motion-v13-breathe{0%,100%{transform:scale(1);opacity:.82}50%{transform:scale(1.018);opacity:1}}
    @keyframes motion-v13-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
    @keyframes motion-v13-child-in{to{opacity:1;transform:none}}
    @keyframes motion-v13-preview-pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.07)}}
    @keyframes motion-v13-preview-scan{0%,28%{transform:translateX(-45%);opacity:0}45%{opacity:.65}72%,100%{transform:translateX(55%);opacity:0}}
    @keyframes motion-v13-message-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
    @media(max-width:760px){.motion-v13-ambient i{opacity:.11}.motion-v13-surface::after{opacity:.72;animation-duration:11s}.motion-v13-reveal{transform:translate3d(0,13px,0) scale(.995);filter:blur(2px)}}
    @media(prefers-reduced-motion:reduce){.motion-v13-reveal{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}.motion-v13-surface::after,.motion-v13-ambient i,.motion-v13-breathe,.motion-v13-float,.motion-v13-stagger>*,.profile-preview-live-v2,.profile-preview-selected-v2,.profile-preview-live-v2 .profile-preview-mini-surface::after,.chat-bubble:last-child{animation:none!important}.motion-v13-stagger>*{opacity:1!important;transform:none!important}}
  `;
  document.head.appendChild(style);

  if (!reduce.matches && !document.querySelector('.motion-v13-ambient') && !location.pathname.startsWith('/painel/login')) {
    const ambient = document.createElement('div');
    ambient.className = 'motion-v13-ambient';
    ambient.setAttribute('aria-hidden','true');
    ambient.innerHTML = '<i></i><i></i><i></i>';
    document.body.appendChild(ambient);
  }

  const seen = new WeakSet();
  const observer = reduce.matches ? null : new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold:.08, rootMargin:'0px 0px -5% 0px' });

  const revealSelector = [
    '.hero','.home-section','.podium-wrap','.workspace-content > section','.workspace-page-grid > .workspace-card',
    '.workspace-stat-grid > .workspace-stat','.profile-v3-shell > section','.chat-layout','.sticker-page-v1 > section',
    '#app > header','#app > .stats','#app > .tabs','#app > .tab-panel.active > .card'
  ].join(',');
  const surfaceSelector = '.workspace-card,.profile-v3-card,.chat-layout,.sticker-page-v1>section,.home-feature,.file-card';
  const depthSelector = '.workspace-card,.workspace-quick,.profile-v3-product,.file-card,.sticker-item-v1';

  function enhance(root=document){
    const reveal = [];
    if (root.nodeType===1 && root.matches?.(revealSelector)) reveal.push(root);
    reveal.push(...(root.querySelectorAll?.(revealSelector)||[]));
    reveal.forEach((node,index)=>{
      if (seen.has(node)) return;
      seen.add(node);
      node.classList.add('motion-v13-reveal');
      node.style.transitionDelay = `${Math.min(index,6)*45}ms`;
      if (reduce.matches) node.classList.add('is-visible'); else observer.observe(node);
    });
    (root.querySelectorAll?.(surfaceSelector)||[]).forEach(node=>node.classList.add('motion-v13-surface'));
    (root.querySelectorAll?.(depthSelector)||[]).forEach(node=>node.classList.add('motion-v13-depth','motion-v13-focus'));
    (root.querySelectorAll?.('.workspace-quick-grid,.workspace-stat-grid,.home-feature-grid,.profile-inventory-showroom-grid')||[]).forEach(node=>node.classList.add('motion-v13-stagger'));
  }

  function pointerLight(event){
    const target = event.target.closest?.('.motion-v13-focus');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--mx',`${event.clientX-rect.left}px`);
    target.style.setProperty('--my',`${event.clientY-rect.top}px`);
  }

  function boot(){
    enhance(document);
    document.addEventListener('pointermove',pointerLight,{passive:true});
    const mutation = new MutationObserver(records=>{
      requestAnimationFrame(()=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1) enhance(node)})));
    });
    mutation.observe(document.body,{childList:true,subtree:true});
  }

  reduce.addEventListener?.('change',()=>location.reload());
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();