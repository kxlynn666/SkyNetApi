(() => {
  if(window.__SKYNET_AUTH_LOGIN_V14__)return;
  window.__SKYNET_AUTH_LOGIN_V14__=true;
  if((location.pathname.replace(/\/+$/,'')||'/')!=='/painel/login')return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const brand=document.querySelector('.workspace-login-brand');
  if(!brand)return;

  document.body.classList.add('auth-v14-login');
  const scene=document.createElement('div');
  scene.className='auth-v14-scene';
  scene.setAttribute('aria-hidden','true');
  scene.innerHTML=`
    <div class="auth-v14-axis auth-v14-axis-a"></div>
    <div class="auth-v14-axis auth-v14-axis-b"></div>
    <div class="auth-v14-frame auth-v14-frame-a"><span>API</span><b>keys / uploads / chat</b></div>
    <div class="auth-v14-frame auth-v14-frame-b"><span>02.0.3</span><b>workspace online</b></div>
    <div class="auth-v14-orbit"><i></i></div>
    <div class="auth-v14-ticker"><span>BUILD</span><span>CONNECT</span><span>CREATE</span><span>SHIP</span><span>BUILD</span></div>`;
  brand.prepend(scene);

  const style=document.createElement('style');
  style.id='authLoginV14Styles';
  style.textContent=`
    .auth-v14-login .workspace-login-shell{grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr)!important;min-height:620px!important;overflow:hidden!important;perspective:1300px}
    .auth-v14-login .workspace-login-brand{position:relative!important;overflow:hidden!important;isolation:isolate!important;padding:30px!important}
    .auth-v14-login .workspace-login-copy{max-width:620px!important;margin:auto 0 14px!important}
    .auth-v14-login .workspace-login-copy h1{font-size:clamp(44px,6vw,76px)!important;max-width:670px!important;line-height:.93!important}
    .auth-v14-login .workspace-login-copy p{max-width:570px!important;font-size:13px!important}
    .auth-v14-login .workspace-login-card{align-self:stretch!important;display:flex!important;flex-direction:column!important;justify-content:center!important;padding:42px 36px!important;border-left:1px solid #242428!important}
    .auth-v14-scene{position:absolute;inset:0;z-index:0;pointer-events:none;transform-style:preserve-3d;overflow:hidden}.auth-v14-login .workspace-logo,.auth-v14-login .workspace-login-copy{position:relative;z-index:2}
    .auth-v14-axis{position:absolute;background:linear-gradient(90deg,transparent,rgba(255,255,255,.11),transparent);height:1px;width:110%;left:-5%;transform-origin:center;animation:auth-v14-axis 9s ease-in-out infinite alternate}.auth-v14-axis-a{top:31%;transform:rotate(-9deg)}.auth-v14-axis-b{top:63%;transform:rotate(13deg);animation-delay:-4s}
    .auth-v14-frame{position:absolute;width:190px;height:108px;border:1px solid rgba(255,255,255,.12);background:rgba(8,8,10,.72);padding:13px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 30px 70px rgba(0,0,0,.22);transform-style:preserve-3d;backdrop-filter:blur(5px)}.auth-v14-frame span{font:600 9px 'IBM Plex Mono',monospace;color:#f2f2ef}.auth-v14-frame b{font:500 8px 'IBM Plex Mono',monospace;color:#73737a}.auth-v14-frame-a{right:12%;top:18%;transform:perspective(700px) rotateY(-12deg) rotateX(5deg);animation:auth-v14-float-a 7s ease-in-out infinite}.auth-v14-frame-b{right:24%;top:42%;transform:perspective(700px) rotateY(11deg) rotateX(-4deg);animation:auth-v14-float-b 8s ease-in-out infinite}
    .auth-v14-orbit{position:absolute;width:310px;height:310px;border:1px solid rgba(255,255,255,.07);border-radius:50%;right:-105px;bottom:-72px;animation:auth-v14-orbit 17s linear infinite}.auth-v14-orbit::after{content:'';position:absolute;inset:58px;border:1px dashed rgba(141,128,237,.15);border-radius:50%}.auth-v14-orbit i{position:absolute;width:8px;height:8px;border-radius:50%;background:#efefeb;left:36px;top:47px;box-shadow:0 0 0 5px rgba(141,128,237,.08)}
    .auth-v14-ticker{position:absolute;left:-5%;right:-5%;bottom:7%;display:flex;gap:30px;white-space:nowrap;overflow:hidden;font:600 10px 'IBM Plex Mono',monospace;color:#45454b;letter-spacing:.18em;transform:rotate(-3deg);animation:auth-v14-ticker 14s linear infinite}.auth-v14-ticker span:nth-child(3){color:#8d80ed}
    .auth-v14-login .workspace-login-card .form-group{transform:translateZ(0);transition:transform .22s ease}.auth-v14-login .workspace-login-card .form-group:focus-within{transform:translateX(4px)}
    .auth-v14-login .workspace-login-submit{position:relative;overflow:hidden}.auth-v14-login .workspace-login-submit::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(141,128,237,.18),transparent);transform:translateX(-120%);transition:transform .55s ease}.auth-v14-login .workspace-login-submit:hover::before{transform:translateX(120%)}
    @keyframes auth-v14-axis{from{opacity:.35;translate:-2% 0}to{opacity:.75;translate:2% 0}}
    @keyframes auth-v14-float-a{0%,100%{translate:0 0}50%{translate:-10px -12px}}
    @keyframes auth-v14-float-b{0%,100%{translate:0 0}50%{translate:12px 9px}}
    @keyframes auth-v14-orbit{to{rotate:360deg}}
    @keyframes auth-v14-ticker{from{translate:0 0}to{translate:-180px 0}}
    @media(max-width:820px){.auth-v14-login .workspace-login-shell{grid-template-columns:1fr!important;min-height:0!important}.auth-v14-login .workspace-login-brand{display:flex!important;min-height:250px!important;padding:18px!important;border-bottom:1px solid #242428!important}.auth-v14-login .workspace-login-copy{margin:auto 0 0!important;max-width:88%!important}.auth-v14-login .workspace-login-copy h1{font-size:34px!important;max-width:360px!important}.auth-v14-login .workspace-login-copy p{display:none!important}.auth-v14-login .workspace-login-card{padding:26px 18px 28px!important;border-left:0!important}.auth-v14-frame{width:126px;height:72px;padding:8px}.auth-v14-frame-a{right:2%;top:18%}.auth-v14-frame-b{right:23%;top:47%}.auth-v14-orbit{width:180px;height:180px;right:-72px;bottom:-72px}.auth-v14-ticker{bottom:4%;font-size:8px}}
    @media(max-width:430px){.auth-v14-login .workspace-login-brand{min-height:224px!important}.auth-v14-login .workspace-login-copy h1{font-size:30px!important}.auth-v14-frame-b{display:none}.auth-v14-frame-a{right:-12px;top:15%}}
    @media(prefers-reduced-motion:reduce){.auth-v14-axis,.auth-v14-frame,.auth-v14-orbit,.auth-v14-ticker{animation:none!important}}
  `;
  document.head.appendChild(style);

  if(!reduce.matches){
    brand.addEventListener('pointermove',event=>{
      if(event.pointerType==='touch')return;
      const r=brand.getBoundingClientRect();
      const x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;
      scene.style.transform=`perspective(1000px) rotateX(${(-y*1.8).toFixed(2)}deg) rotateY(${(x*2.4).toFixed(2)}deg) translate3d(${(x*7).toFixed(1)}px,${(y*7).toFixed(1)}px,0)`;
    },{passive:true});
    brand.addEventListener('pointerleave',()=>scene.style.transform='');
  }
})();
