(() => {
  if (window.__SKYNET_STORE_COMPACT_V13__) return;
  window.__SKYNET_STORE_COMPACT_V13__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  const style = document.createElement('style');
  style.id = 'storeCompactV13Styles';
  style.textContent = `
    [data-profile-v3="1"] [data-profile-panel="store"],
    [data-profile-v3="1"] [data-profile-panel="store"] > .profile-v3-card,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 {
      width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] > .profile-v3-card{
      padding:12px!important;overflow:hidden!important;contain:layout!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head{
      display:flex!important;align-items:flex-start!important;gap:10px!important;flex-wrap:wrap!important;margin-bottom:8px!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head h2,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head p{margin-bottom:0!important}

    /* One compact horizontal toolbar instead of a tall stack of filters. */
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5{
      display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:nowrap!important;
      overflow-x:auto!important;overflow-y:hidden!important;padding:7px!important;margin:0 0 9px!important;
      overscroll-behavior-x:contain;scrollbar-width:thin;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 > *{
      flex:0 0 auto!important;min-width:0!important;margin:0!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 input[type="search"]{width:clamp(148px,24vw,230px)!important;min-height:34px!important;padding:6px 9px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 select{width:clamp(112px,17vw,158px)!important;min-height:34px!important;padding:6px 8px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-owned-v5,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-count-v5{width:auto!important;min-height:32px!important;padding:6px 9px!important;white-space:nowrap!important}

    /* Exactly three rows. More products continue to the right. */
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store{
      display:grid!important;grid-template-columns:none!important;grid-template-rows:repeat(3,max-content)!important;
      grid-auto-flow:column!important;grid-auto-columns:clamp(148px,16vw,176px)!important;
      align-content:start!important;justify-content:start!important;gap:7px!important;
      overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain!important;
      -webkit-overflow-scrolling:touch;scroll-snap-type:x proximity!important;contain:inline-size!important;
      padding:2px 2px 8px!important;max-width:100%!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product{
      width:100%!important;min-width:0!important;max-width:100%!important;min-height:0!important;height:auto!important;
      padding:8px!important;border-radius:10px!important;display:flex!important;flex-direction:column!important;gap:5px!important;
      overflow:hidden!important;scroll-snap-align:start;box-sizing:border-box!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-visual{
      height:52px!important;min-height:52px!important;max-height:52px!important;padding:4px!important;margin:0!important;overflow:hidden!important;border-radius:8px!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini{height:44px!important;min-height:44px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini .cosmetic-avatar{width:40px!important;height:40px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-title{
      display:flex!important;align-items:center!important;gap:5px!important;min-width:0!important;margin:0!important;line-height:1.15!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-title strong{
      min-width:0!important;max-width:100%!important;font-size:10px!important;line-height:1.2!important;
      white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-collection-v5,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-animated-badge{
      max-width:70px!important;padding:2px 4px!important;font-size:6px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-price{font-size:9px!important;line-height:1.2!important;margin:0!important;min-height:12px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-product-actions{margin:0!important;gap:4px!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product .button{
      min-height:29px!important;height:auto!important;padding:5px 7px!important;border-radius:7px!important;font-size:8px!important;line-height:1.2!important;width:100%!important;
      white-space:normal!important;text-align:center!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-exclusive-label{font-size:7px!important;line-height:1.25!important;display:block!important}
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-rail-v10{
      width:100%!important;min-width:0!important;max-width:100%!important;display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important;margin-top:7px!important;
    }
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-rail-v10 .button{min-height:30px!important;padding:5px 8px!important;font-size:8px!important}

    @media(max-width:760px){
      [data-profile-v3="1"] [data-profile-panel="store"] > .profile-v3-card{padding:9px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head{gap:6px!important;margin-bottom:6px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5{margin-left:0!important;margin-right:0!important;padding:5px!important;gap:5px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 input[type="search"]{width:142px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 select{width:112px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store{
        grid-auto-columns:clamp(136px,43vw,158px)!important;gap:6px!important;padding-bottom:7px!important;
      }
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product{padding:7px!important;gap:4px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-visual{height:48px!important;min-height:48px!important;max-height:48px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini{height:40px!important;min-height:40px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-preview-mini .cosmetic-avatar{width:37px!important;height:37px!important}
    }
    @media(max-width:390px){
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store{grid-auto-columns:132px!important}
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-title strong{font-size:9px!important}
    }
  `;
  document.head.appendChild(style);

  function markScrollable(){
    const store = document.querySelector('[data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store');
    if (!store || store.dataset.compactV13 === '1') return;
    store.dataset.compactV13 = '1';
    store.setAttribute('aria-label','Itens da loja. Deslize horizontalmente para ver mais.');
  }
  markScrollable();
  const observer = new MutationObserver(markScrollable);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),15000);
})();