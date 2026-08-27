(() => {
  if (window.__SKYNET_STORE_EXPERIENCE_V14__) return;
  window.__SKYNET_STORE_EXPERIENCE_V14__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  const style=document.createElement('style');
  style.id='storeExperienceV14Styles';
  style.textContent=`
    [data-profile-v3="1"] [data-profile-panel="store"]>.profile-v3-card{padding:14px!important;overflow:hidden!important;contain:layout inline-size!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:10px 18px!important;align-items:end!important;margin-bottom:10px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head h2{font-size:16px!important;margin:0!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head p{font-size:10px!important;line-height:1.45!important;margin:4px 0 0!important;max-width:560px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5{display:flex!important;gap:5px!important;align-items:center!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;padding:5px!important;margin:0 0 10px!important;scrollbar-width:thin;overscroll-behavior-inline:contain}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5>*{flex:0 0 auto!important;margin:0!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 input[type="search"]{width:190px!important;min-height:32px!important;padding:5px 8px!important;font-size:10px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 select{width:130px!important;min-height:32px!important;padding:5px 7px!important;font-size:9px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-owned-v5,[data-profile-v3="1"] [data-profile-panel="store"] .profile-store-count-v5{width:auto!important;min-height:30px!important;padding:5px 8px!important;font-size:8px!important;white-space:nowrap!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store{display:grid!important;grid-template-columns:none!important;grid-template-rows:repeat(3,max-content)!important;grid-auto-flow:column!important;grid-auto-columns:clamp(196px,19vw,228px)!important;gap:8px!important;width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:auto!important;overflow-y:hidden!important;padding:2px 2px 10px!important;scroll-snap-type:x proximity!important;overscroll-behavior-x:contain!important;contain:inline-size!important;-webkit-overflow-scrolling:touch}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product{display:grid!important;grid-template-columns:70px minmax(0,1fr)!important;grid-template-rows:auto auto 1fr!important;gap:4px 9px!important;align-items:start!important;padding:8px!important;min-height:105px!important;height:auto!important;border-radius:4px!important;overflow:hidden!important;scroll-snap-align:start!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-visual{grid-row:1/4!important;grid-column:1!important;width:70px!important;height:88px!important;min-height:88px!important;max-height:88px!important;margin:0!important;padding:5px!important;align-self:start!important;overflow:hidden!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini{height:76px!important;min-height:76px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini .cosmetic-avatar{width:56px!important;height:56px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini-surface{min-height:74px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-title{grid-column:2!important;display:flex!important;align-items:flex-start!important;gap:4px!important;min-width:0!important;margin:0!important;flex-wrap:wrap!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-title strong{width:100%!important;min-width:0!important;font-size:10px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-collection-v5,[data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-animated-badge{max-width:76px!important;font-size:6px!important;padding:2px 4px!important;line-height:1.1!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-price{grid-column:2!important;font-size:9px!important;line-height:1.2!important;margin:0!important;color:#a8a8ad!important;min-height:12px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-product-actions{grid-column:2!important;display:inline-flex!important;gap:5px!important;margin:1px 0 0!important;align-self:end!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product>.button,[data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-product-actions .button{width:30px!important;height:30px!important;min-height:30px!important;min-width:30px!important;padding:0!important;display:inline-grid!important;place-items:center!important;border-radius:3px!important;flex:0 0 30px!important;font-size:0!important;white-space:nowrap!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product>.button{grid-column:2!important;grid-row:3!important;justify-self:end!important;align-self:end!important;margin:0!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .v14-store-icon svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    [data-profile-v3="1"] [data-profile-panel="store"] .v14-store-icon[data-kind="buy"]{background:var(--theme-primary,#efefec)!important;border-color:var(--theme-primary,#efefec)!important;color:var(--theme-on-primary,#09090b)!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .v14-store-icon[data-kind="owned"]{background:var(--theme-field,#141416)!important;border-color:var(--theme-border,#35353a)!important;color:var(--theme-muted,#a7a7ad)!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .v14-store-icon[data-kind="preview"]{background:var(--theme-field,#111113)!important;border-color:var(--theme-border,#333338)!important;color:var(--theme-text,#f0f0ed)!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-exclusive-label{font-size:6px!important;line-height:1.2!important;display:block!important;max-width:100%!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-rail-v10{display:flex!important;align-items:center!important;gap:5px!important;flex-wrap:wrap!important;margin-top:7px!important;min-width:0!important;max-width:100%!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-rail-v10 .button{min-height:28px!important;padding:4px 7px!important;font-size:8px!important;border-radius:3px!important}
    .v14-store-hint{display:flex;align-items:center;gap:7px;margin:2px 0 8px;color:var(--theme-faint,#75757c);font:500 8px 'IBM Plex Mono',monospace}.v14-store-hint::before{content:'↔';color:var(--theme-bright,#b4abfa);font-size:11px}
    @media(max-width:760px){
      [data-profile-v3="1"] [data-profile-panel="store"]>.profile-v3-card{padding:10px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head{grid-template-columns:1fr!important;gap:5px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5{padding:4px!important;margin-bottom:7px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 input[type="search"]{width:158px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 select{width:112px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store{grid-auto-columns:clamp(188px,62vw,208px)!important;gap:7px!important;padding-bottom:9px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product{grid-template-columns:62px minmax(0,1fr)!important;min-height:98px!important;padding:7px!important;gap:3px 7px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-visual{width:62px!important;height:82px!important;min-height:82px!important;max-height:82px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini{height:70px!important;min-height:70px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini .cosmetic-avatar{width:50px!important;height:50px!important}
    }
    @media(max-width:390px){[data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store{grid-auto-columns:184px!important}}
  `;
  document.head.appendChild(style);

  const icons={
    preview:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>',
    buy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l-1 11H6L5 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/><path d="M12 10v5M9.5 12.5h5"/></svg>',
    owned:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    locked:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
  };

  function iconify(button,kind,label){
    if(!button)return;
    if(button.dataset.v14Icon==='1'&&button.dataset.kind===kind){button.title=label;button.setAttribute('aria-label',label);return;}
    button.dataset.v14Icon='1';
    button.dataset.kind=kind;
    button.classList.add('v14-store-icon');
    button.title=label;
    button.setAttribute('aria-label',label);
    button.innerHTML=icons[kind]||icons.preview;
  }

  function enhance(){
    const panel=document.querySelector('[data-profile-v3="1"] [data-profile-panel="store"]');
    if(!panel)return;
    const store=panel.querySelector('.profile-v3-store');
    if(store&&!panel.querySelector('.v14-store-hint')){
      const hint=document.createElement('div');hint.className='v14-store-hint';hint.textContent='3 linhas · deslize para ver mais';store.before(hint);
    }
    panel.querySelectorAll('.profile-v3-product').forEach(card=>{
      const preview=card.querySelector('[data-preview-cosmetic]');
      iconify(preview,'preview','Visualizar no perfil');
      const buy=card.querySelector('[data-buy-profile-item],:scope > .button');
      if(!buy)return;
      const text=`${buy.textContent||''} ${buy.getAttribute('aria-label')||''} ${buy.title||''}`.toLowerCase();
      const exclusive=card.dataset.grantOnly==='1'||/não disponível|exclusivo|bloqueado/.test(text);
      const acquired=/comprado|adquirido|item adquirido/.test(text)||(buy.disabled&&!exclusive&&!buy.hasAttribute('data-buy-profile-item'));
      if(exclusive)iconify(buy,'locked','Item exclusivo');
      else if(acquired)iconify(buy,'owned','Item adquirido');
      else iconify(buy,'buy','Comprar item');
    });
  }

  enhance();
  const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','data-grant-only','data-buy-profile-item']});
  setTimeout(()=>observer.disconnect(),30000);
})();
