(() => {
  if (window.__SKYNET_AUTH_EXPERIENCE_V13__) return;
  window.__SKYNET_AUTH_EXPERIENCE_V13__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/login') return;

  const style = document.createElement('style');
  style.id = 'authExperienceV13Styles';
  style.textContent = `
    .workspace-login-shell{position:relative;isolation:isolate;overflow:hidden!important}
    .workspace-login-brand{position:relative;overflow:hidden!important;isolation:isolate}
    .auth-scene-v13{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    .workspace-login-brand>.workspace-logo,.workspace-login-copy{position:relative;z-index:2}
    .auth-scene-grid-v13{position:absolute;inset:14% 10% 10%;opacity:.28;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,transparent,#000 24%,#000 78%,transparent);transform:perspective(600px) rotateX(58deg) translateY(12%);transform-origin:center bottom;animation:auth-grid-drift-v13 12s ease-in-out infinite alternate}
    .auth-signal-v13{position:absolute;left:12%;right:12%;top:32%;height:148px}
    .auth-signal-v13 i{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);transform-origin:left center;animation:auth-scan-v13 4.8s cubic-bezier(.2,.7,.2,1) infinite}
    .auth-signal-v13 i:nth-child(2){top:34%;animation-delay:-1.6s}.auth-signal-v13 i:nth-child(3){top:68%;animation-delay:-3.2s}
    .auth-orbit-v13{position:absolute;width:230px;height:230px;border:1px solid rgba(255,255,255,.07);border-radius:50%;right:-48px;top:18%;animation:auth-orbit-v13 14s linear infinite}
    .auth-orbit-v13::before,.auth-orbit-v13::after{content:'';position:absolute;border-radius:50%}.auth-orbit-v13::before{width:8px;height:8px;background:#d9d9d5;left:19px;top:37px;box-shadow:0 0 22px rgba(255,255,255,.24)}.auth-orbit-v13::after{inset:36px;border:1px solid rgba(255,255,255,.045)}
    .auth-stack-v13{position:absolute;right:12%;bottom:13%;width:180px;height:120px;perspective:700px}
    .auth-stack-v13 b{position:absolute;inset:0;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.025);backdrop-filter:blur(3px);transform-origin:50% 100%;transition:transform .7s cubic-bezier(.2,.75,.2,1),opacity .5s ease}
    .auth-stack-v13 b:nth-child(1){transform:translate(-22px,18px) rotate(-8deg);opacity:.42}.auth-stack-v13 b:nth-child(2){transform:translate(9px,9px) rotate(4deg);opacity:.62}.auth-stack-v13 b:nth-child(3){transform:none;opacity:.9}
    body[data-auth-mode="register"] .auth-stack-v13 b:nth-child(1){transform:translate(-52px,-14px) rotate(-13deg)}
    body[data-auth-mode="register"] .auth-stack-v13 b:nth-child(2){transform:translate(0,-28px) rotate(0)}
    body[data-auth-mode="register"] .auth-stack-v13 b:nth-child(3){transform:translate(52px,-14px) rotate(13deg)}
    body[data-auth-mode="register"] .auth-orbit-v13{animation-duration:8s;border-radius:34% 66% 58% 42%/46% 40% 60% 54%}
    body[data-auth-mode="register"] .auth-signal-v13 i{animation-duration:3.2s}
    .workspace-login-card{position:relative;z-index:3;transition:transform .45s cubic-bezier(.2,.75,.2,1),opacity .35s ease}
    body.auth-mode-switching-v13 .workspace-login-card{transform:translateY(7px);opacity:.72}
    .workspace-login-card .form-group{transition:transform .24s ease,opacity .24s ease}.workspace-login-card .form-group:focus-within{transform:translateX(3px)}
    .workspace-login-submit{position:relative;overflow:hidden}.workspace-login-submit::after{content:'';position:absolute;inset:-40% auto -40% -45%;width:36%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-18deg);transition:left .5s ease}.workspace-login-submit:hover::after{left:118%}
    @keyframes auth-grid-drift-v13{from{transform:perspective(600px) rotateX(58deg) translateY(12%) translateX(-8px)}to{transform:perspective(600px) rotateX(58deg) translateY(8%) translateX(8px)}}
    @keyframes auth-scan-v13{0%{opacity:0;transform:translateX(-24%) scaleX(.15)}18%{opacity:.9}55%{opacity:.45}100%{opacity:0;transform:translateX(24%) scaleX(1)}}
    @keyframes auth-orbit-v13{to{transform:rotate(360deg)}}
    @media(max-width:820px){
      .workspace-login-shell{display:grid!important;grid-template-columns:1fr!important;width:min(520px,100%)!important}
      .workspace-login-brand{display:flex!important;min-height:178px!important;padding:18px 18px 14px!important;border-bottom:1px solid #232327}
      .workspace-login-brand .workspace-logo{padding:0!important}.workspace-login-copy{margin:auto 0 0!important;max-width:82%}.workspace-login-copy h1{font-size:25px!important;line-height:1.05!important;margin:8px 0 6px!important}.workspace-login-copy p{display:none}
      .auth-scene-grid-v13{inset:0 4% -25%;background-size:24px 24px}.auth-signal-v13{left:5%;right:5%;top:20%;height:110px}.auth-orbit-v13{width:160px;height:160px;right:-52px;top:-28px}.auth-stack-v13{width:110px;height:72px;right:12px;bottom:12px}
      .workspace-login-card{padding:24px 20px 26px!important}
    }
    @media(max-width:430px){.workspace-login-body{padding:10px!important}.workspace-login-brand{min-height:164px!important}.workspace-login-copy h1{font-size:23px!important}.workspace-login-card{padding:21px 16px 24px!important}}
    @media(prefers-reduced-motion:reduce){.auth-scene-v13 *,.workspace-login-card,.workspace-login-card .form-group,.workspace-login-submit::after{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);

  const brand = document.querySelector('.workspace-login-brand');
  if (brand && !brand.querySelector('.auth-scene-v13')) {
    const scene = document.createElement('div');
    scene.className = 'auth-scene-v13';
    scene.setAttribute('aria-hidden','true');
    scene.innerHTML = '<div class="auth-scene-grid-v13"></div><div class="auth-signal-v13"><i></i><i></i><i></i></div><div class="auth-orbit-v13"></div><div class="auth-stack-v13"><b></b><b></b><b></b></div>';
    brand.prepend(scene);
  }

  function apply(mode){
    const next = mode === 'register' ? 'register' : 'login';
    if (document.body.dataset.authMode === next) return;
    document.body.classList.add('auth-mode-switching-v13');
    document.body.dataset.authMode = next;
    setTimeout(()=>document.body.classList.remove('auth-mode-switching-v13'),280);
  }
  apply(/criar/i.test(document.getElementById('loginTitle')?.textContent || '') ? 'register' : 'login');
  document.addEventListener('skynet:auth-mode',event=>apply(event.detail?.mode));
  const title = document.getElementById('loginTitle');
  if (title) new MutationObserver(()=>apply(/criar/i.test(title.textContent || '') ? 'register' : 'login')).observe(title,{childList:true,subtree:true,characterData:true});
})();