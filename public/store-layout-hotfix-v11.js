(() => {
  if (window.__SKYNET_STORE_LAYOUT_HOTFIX_V11__) return;
  window.__SKYNET_STORE_LAYOUT_HOTFIX_V11__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  const style = document.createElement('style');
  style.id = 'storeLayoutHotfixV11Styles';
  style.textContent = `
    [data-profile-v3="1"] .profile-v3-shell,
    [data-profile-v3="1"] .profile-v3-panel,
    [data-profile-v3="1"] [data-profile-panel="store"],
    [data-profile-v3="1"] [data-profile-panel="store"] > .profile-v3-card,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 {
      min-width:0!important;
      max-width:100%!important;
      box-sizing:border-box!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] {
      width:100%!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] > .profile-v3-card {
      width:100%!important;
      overflow:hidden!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head {
      width:100%!important;
      flex-wrap:wrap!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store-head > *,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 > *,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 input,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 select {
      min-width:0!important;
      max-width:100%!important;
      box-sizing:border-box!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 {
      width:100%!important;
      overflow:hidden!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store {
      display:grid!important;
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      box-sizing:border-box!important;
      contain:inline-size!important;
      grid-template-columns:none!important;
      grid-template-rows:repeat(3,max-content)!important;
      grid-auto-flow:column!important;
      grid-auto-columns:clamp(188px,24vw,232px)!important;
      align-content:start!important;
      justify-content:start!important;
      gap:9px!important;
      overflow-x:auto!important;
      overflow-y:hidden!important;
      overscroll-behavior-x:contain!important;
      -webkit-overflow-scrolling:touch;
      scroll-snap-type:x proximity!important;
      padding:3px 3px 10px!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store > .profile-v3-product {
      width:100%!important;
      min-width:0!important;
      max-width:100%!important;
      min-height:145px!important;
      height:auto!important;
      box-sizing:border-box!important;
      overflow:hidden!important;
      scroll-snap-align:start;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-title,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-title strong,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-visual,
    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-price {
      min-width:0!important;
      max-width:100%!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-product-title strong {
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-collection-v5 {
      flex:0 1 auto!important;
      min-width:0!important;
      max-width:46%!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }

    [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-rail-v10 {
      min-width:0!important;
      max-width:100%!important;
      flex-wrap:wrap!important;
    }

    @media(max-width:760px) {
      [data-profile-v3="1"] [data-profile-panel="store"] > .profile-v3-card {
        padding-left:12px!important;
        padding-right:12px!important;
      }
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store {
        grid-auto-columns:clamp(176px,76vw,258px)!important;
        gap:8px!important;
        padding-left:2px!important;
        padding-right:2px!important;
      }
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 {
        grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
      }
    }

    @media(max-width:520px) {
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-tools-v5 {
        grid-template-columns:minmax(0,1fr)!important;
      }
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-owned-v5,
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-count-v5 {
        grid-column:auto!important;
        width:100%!important;
      }
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-store-rail-v10 {
        width:100%!important;
        margin-left:0!important;
        justify-content:flex-start!important;
      }
      [data-profile-v3="1"] [data-profile-panel="store"] .profile-v3-store {
        grid-auto-columns:clamp(170px,78vw,246px)!important;
      }
    }
  `;
  document.head.appendChild(style);
})();