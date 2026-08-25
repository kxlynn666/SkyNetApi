(() => {
  if(window.__SKYNET_AUTH_REGISTER_V14__)return;
  window.__SKYNET_AUTH_REGISTER_V14__=true;
  if((location.pathname.replace(/\/+$/,'')||'/')!=='/painel/cadastro')return;
  const S=window.SkyNet;
  if(!S)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const style=document.createElement('style');
  style.id='authRegisterV14Styles';
  style.textContent=`
    .register-v14-body{min-height:100vh;display:grid;place-items:center;padding:18px;background:#050506!important;overflow-x:hidden}
    .register-v14-shell{width:min(1160px,100%);min-height:min(760px,calc(100vh - 36px));display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);border:1px solid #2a2a2f;background:#08080a;box-shadow:0 48px 140px rgba(0,0,0,.52);perspective:1500px;overflow:hidden}
    .register-v14-stage{position:relative;overflow:hidden;isolation:isolate;padding:28px;display:flex;flex-direction:column;border-right:1px solid #252529;background:#060607;transform-style:preserve-3d}
    .register-v14-logo{position:relative;z-index:5;padding:0!important}.register-v14-copy{position:relative;z-index:5;margin:auto 0 0;max-width:680px}.register-v14-copy h1{font-size:clamp(56px,8vw,102px);line-height:.84;margin:10px 0 18px;letter-spacing:-.065em!important}.register-v14-copy p{max-width:590px;color:#8f8f95;font-size:13px;line-height:1.6}
    .register-v14-assembly{position:absolute;inset:0;z-index:1;transform-style:preserve-3d;perspective:1000px;pointer-events:none}.register-v14-plane{position:absolute;width:210px;height:118px;border:1px solid rgba(255,255,255,.13);background:rgba(8,8,10,.8);padding:13px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto 1fr;gap:4px 10px;box-shadow:0 32px 80px rgba(0,0,0,.28);backdrop-filter:blur(5px);transform-style:preserve-3d}.register-v14-plane span{font:600 8px 'IBM Plex Mono',monospace;color:#77777e}.register-v14-plane b{font:600 10px 'IBM Plex Mono',monospace;color:#f0f0ed;text-align:right}.register-v14-plane i{grid-column:1/-1;align-self:end;font:500 8px 'IBM Plex Mono',monospace;color:#68686f;font-style:normal}.register-v14-plane-a{right:13%;top:13%;transform:rotateY(-16deg) rotateX(7deg) translateZ(24px);animation:register-plane-a 7.5s ease-in-out infinite}.register-v14-plane-b{right:28%;top:34%;transform:rotateY(12deg) rotateX(-5deg) translateZ(46px);animation:register-plane-b 8.5s ease-in-out infinite}.register-v14-plane-c{right:9%;top:55%;transform:rotateY(-8deg) rotateX(4deg) translateZ(68px);animation:register-plane-c 9s ease-in-out infinite}.register-v14-plane-b::after{content:'';position:absolute;left:0;top:0;width:2px;height:100%;background:#8d80ed}
    .register-v14-core{position:absolute;width:290px;height:290px;right:-55px;top:23%;border:1px solid rgba(255,255,255,.07);border-radius:50%;animation:register-core 22s linear infinite}.register-v14-core::before,.register-v14-core::after{content:'';position:absolute;border:1px solid rgba(255,255,255,.06);border-radius:50%;inset:46px}.register-v14-core::after{inset:91px;border-color:rgba(141,128,237,.18)}.register-v14-core i{position:absolute;width:7px;height:7px;border-radius:50%;background:#e9e9e5}.register-v14-core i:nth-child(1){left:31px;top:70px}.register-v14-core i:nth-child(2){right:43px;bottom:52px;background:#8d80ed}.register-v14-core i:nth-child(3){left:50%;top:-4px}
    .register-v14-scan{position:absolute;inset:0;background:linear-gradient(110deg,transparent 0 43%,rgba(255,255,255,.035) 48%,rgba(141,128,237,.025) 50%,transparent 56%);transform:translateX(-75%);animation:register-scan 7s ease-in-out infinite}.register-v14-footer{position:relative;z-index:5;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #26262b;margin-top:24px;padding-top:12px;font:500 8px 'IBM Plex Mono',monospace;color:#606067}.register-v14-footer b{color:#b4abfa;font-size:15px}
    .register-v14-form-panel{padding:42px 36px;display:flex;flex-direction:column;justify-content:center;background:#0b0b0d;overflow:auto}.register-v14-form-head{margin-bottom:24px}.register-v14-form-head h2{font-size:34px;margin:5px 0 8px}.register-v14-form-head p{margin:0;color:#86868c;font-size:12px;line-height:1.5;max-width:390px}.register-v14-field{position:relative;padding-left:34px;margin-bottom:15px}.register-v14-field::before{content:attr(data-step);position:absolute;left:0;top:27px;font:600 8px 'IBM Plex Mono',monospace;color:#5f5f66}.register-v14-field:focus-within::before{color:#b4abfa}.register-v14-field span{display:block;margin-top:5px;color:#66666d;font-size:9px}.register-v14-field label em{font-style:normal;color:#67676f;font-size:9px;font-weight:500}.register-v14-label-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.register-v14-text-action,.register-v14-eye{border:0;background:transparent;color:#aaa2ef;font:600 9px 'IBM Plex Mono',monospace;cursor:pointer;padding:4px 0}.register-v14-text-action:hover,.register-v14-eye:hover{color:#ded9ff}.register-v14-input-wrap{position:relative}.register-v14-input-wrap input{padding-right:72px!important}.register-v14-eye{position:absolute;right:10px;top:50%;translate:0 -50%}.register-v14-warning{color:#d9b46f!important}.register-v14-meter{height:2px;background:#27272c;margin:5px 0 10px;overflow:hidden}.register-v14-meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,#efefeb,#8d80ed);transition:width .28s ease}.register-v14-password-notes{display:flex;flex-wrap:wrap;gap:5px 8px;margin:0 0 18px;padding-left:34px}.register-v14-password-notes span{font:500 8px 'IBM Plex Mono',monospace;color:#5f5f66}.register-v14-password-notes span::before{content:'○ ';}.register-v14-password-notes span.ok{color:#a9e0b5}.register-v14-password-notes span.ok::before{content:'● '}.register-v14-options{border:1px solid #28282d;padding:12px 13px 7px;margin:0 0 18px}.register-v14-options legend{padding:0 6px;color:#77777e;font:600 8px 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em}.register-v14-check{display:grid;grid-template-columns:18px 1fr;gap:8px;align-items:start;padding:7px 0;cursor:pointer}.register-v14-check input{margin:2px 0 0;accent-color:#8d80ed}.register-v14-check span{display:grid;gap:2px}.register-v14-check b{font-size:10px;color:#e3e3df}.register-v14-check small{font-size:9px;line-height:1.35;color:#66666d}.register-v14-submit{width:100%;min-height:46px;display:flex!important;align-items:center;justify-content:space-between!important;padding:0 14px!important}.register-v14-submit b{font-size:16px}.register-v14-submit:disabled{opacity:.55;cursor:wait}.register-v14-login-link{text-align:center;color:#77777d;font-size:11px;margin:18px 0 0}.register-v14-login-link a{color:#f0f0ed}
    .register-v14-success .register-v14-plane-a{transform:translate3d(-55px,-30px,70px) rotateY(-22deg)!important}.register-v14-success .register-v14-plane-b{transform:translate3d(0,-65px,100px) rotateX(0)!important}.register-v14-success .register-v14-plane-c{transform:translate3d(45px,-25px,130px) rotateY(18deg)!important}.register-v14-success .register-v14-core{scale:1.08;border-color:rgba(141,128,237,.3)}
    @keyframes register-plane-a{0%,100%{translate:0 0}50%{translate:-9px -12px}}
    @keyframes register-plane-b{0%,100%{translate:0 0}50%{translate:11px 7px}}
    @keyframes register-plane-c{0%,100%{translate:0 0}50%{translate:-6px 13px}}
    @keyframes register-core{to{rotate:360deg}}
    @keyframes register-scan{0%,42%{transform:translateX(-75%);opacity:0}52%{opacity:1}75%,100%{transform:translateX(75%);opacity:0}}
    @media(max-width:820px){.register-v14-body{padding:0!important;display:block!important}.register-v14-shell{min-height:100vh;width:100%;grid-template-columns:1fr;border:0!important}.register-v14-stage{min-height:360px;padding:18px;border-right:0;border-bottom:1px solid #252529}.register-v14-copy h1{font-size:57px;max-width:420px}.register-v14-copy p{display:none}.register-v14-plane{width:145px;height:82px;padding:9px}.register-v14-plane-a{right:2%;top:14%}.register-v14-plane-b{right:26%;top:38%}.register-v14-plane-c{right:4%;top:58%}.register-v14-core{width:190px;height:190px;right:-66px;top:18%}.register-v14-form-panel{padding:27px 18px 34px}.register-v14-form-head h2{font-size:28px}}
    @media(max-width:430px){.register-v14-stage{min-height:318px}.register-v14-copy h1{font-size:47px}.register-v14-plane{width:122px;height:72px}.register-v14-plane-b{display:none}.register-v14-plane-a{right:-8px}.register-v14-plane-c{right:6%;top:54%}.register-v14-core{right:-90px}.register-v14-form-panel{padding-left:15px;padding-right:15px}.register-v14-password-notes{padding-left:0}}
    @media(prefers-reduced-motion:reduce){.register-v14-plane,.register-v14-core,.register-v14-scan{animation:none!important}}
  `;
  document.head.appendChild(style);

  const stage=document.getElementById('registerStageV14');
  const assembly=stage?.querySelector('.register-v14-assembly');
  if(stage&&assembly&&!reduce.matches){
    stage.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;const r=stage.getBoundingClientRect();const x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;assembly.style.transform=`perspective(1000px) rotateX(${(-y*2.2).toFixed(2)}deg) rotateY(${(x*3).toFixed(2)}deg) translate3d(${(x*10).toFixed(1)}px,${(y*9).toFixed(1)}px,0)`},{passive:true});
    stage.addEventListener('pointerleave',()=>assembly.style.transform='');
  }

  const form=document.getElementById('registerForm');
  const user=document.getElementById('registerUsername');
  const userHint=document.getElementById('registerUsernameHint');
  const displayName=document.getElementById('registerDisplayName');
  const pass=document.getElementById('registerPassword');
  const confirmPass=document.getElementById('registerConfirm');
  const confirmHint=document.getElementById('registerConfirmHint');
  const capsWarning=document.getElementById('registerCapsWarning');
  const meter=document.getElementById('registerMeterV14');
  const notes=[...document.querySelectorAll('#registerPasswordNotes [data-rule]')];
  const showOnPodium=document.getElementById('registerShowOnPodium');
  const showOnline=document.getElementById('registerShowOnline');
  const autoLogin=document.getElementById('registerAutoLogin');
  const generateButton=document.getElementById('registerGeneratePassword');
  const toggleButton=document.getElementById('registerTogglePassword');
  const message=document.getElementById('registerMessage');
  const button=document.getElementById('registerSubmit');
  const buttonLabel=button?.querySelector('span');

  const usernamePattern=/^[a-z0-9_-]+$/;
  const normalizedUsername=()=>user.value.trim().toLowerCase();
  const rulesFor=value=>({
    length:value.length>=8,
    mixed:/[A-Z]/.test(value)&&/[a-z]/.test(value),
    number:/\d/.test(value),
    symbol:/[^A-Za-z0-9]/.test(value)
  });

  const refreshUsername=()=>{
    const raw=user.value.trim();
    const normalized=raw.toLowerCase();
    if(!raw){userHint.textContent='3–30 caracteres · letras, números, _ ou -';userHint.style.color='';return}
    if(normalized.length<3||normalized.length>30||!usernamePattern.test(normalized)){
      userHint.textContent='Formato inválido. Use apenas letras, números, _ ou -.';
      userHint.style.color='#d99a9a';
      return;
    }
    userHint.textContent=raw===normalized?'Formato válido.':`Será salvo como @${normalized}.`;
    userHint.style.color='#a9e0b5';
  };

  const refreshPassword=()=>{
    const value=pass.value;
    const rules=rulesFor(value);
    let score=Object.values(rules).filter(Boolean).length;
    if(value.length>=12)score+=1;
    meter.style.width=`${Math.min(100,score*20)}%`;
    for(const item of notes)item.classList.toggle('ok',Boolean(rules[item.dataset.rule]));
    if(confirmPass.value){
      const same=value===confirmPass.value;
      confirmHint.textContent=same?'As senhas coincidem.':'As senhas ainda não coincidem.';
      confirmHint.style.color=same?'#a9e0b5':'#d99a9a';
    }else{
      confirmHint.textContent='Repita exatamente a senha acima.';
      confirmHint.style.color='';
    }
  };

  const randomIndex=max=>{
    if(!globalThis.crypto?.getRandomValues)return Math.floor(Math.random()*max);
    const limit=Math.floor(0x100000000/max)*max;
    const array=new Uint32Array(1);
    do{crypto.getRandomValues(array)}while(array[0]>=limit);
    return array[0]%max;
  };
  const generatePassword=()=>{
    const groups=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%&*_-+='];
    const all=groups.join('');
    const chars=groups.map(group=>group[randomIndex(group.length)]);
    while(chars.length<18)chars.push(all[randomIndex(all.length)]);
    for(let i=chars.length-1;i>0;i--){const j=randomIndex(i+1);[chars[i],chars[j]]=[chars[j],chars[i]]}
    return chars.join('');
  };

  user.addEventListener('input',refreshUsername);
  pass.addEventListener('input',refreshPassword);
  confirmPass.addEventListener('input',refreshPassword);
  for(const input of [pass,confirmPass]){
    input.addEventListener('keyup',event=>{capsWarning.hidden=!event.getModifierState?.('CapsLock')});
    input.addEventListener('blur',()=>{capsWarning.hidden=true});
  }

  generateButton.addEventListener('click',()=>{
    const generated=generatePassword();
    pass.value=generated;
    confirmPass.value=generated;
    refreshPassword();
    S.message(message,'Senha forte gerada. Guarde-a em um gerenciador de senhas.','success');
  });

  toggleButton.addEventListener('click',()=>{
    const showing=pass.type==='text';
    pass.type=showing?'password':'text';
    confirmPass.type=showing?'password':'text';
    toggleButton.textContent=showing?'Mostrar':'Ocultar';
    toggleButton.setAttribute('aria-pressed',String(!showing));
    toggleButton.setAttribute('aria-label',showing?'Mostrar senha':'Ocultar senha');
  });

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    S.message(message,'');
    const username=normalizedUsername();
    const password=pass.value;
    const profileName=displayName.value.trim();

    if(username.length<3||username.length>30||!usernamePattern.test(username))return S.message(message,'Usuário inválido. Use 3 a 30 caracteres: letras, números, _ ou -.','error');
    if(profileName.length>50)return S.message(message,'O nome de exibição deve ter no máximo 50 caracteres.','error');
    if(password.length<8||password.length>128)return S.message(message,'A senha deve ter entre 8 e 128 caracteres.','error');
    if(password!==confirmPass.value)return S.message(message,'As senhas não coincidem.','error');

    button.disabled=true;
    if(buttonLabel)buttonLabel.textContent='Criando...';
    try{
      const data=await S.api('/api/auth/register',{method:'POST',body:{username,password}});
      if(!data.active){
        S.message(message,`${data.message} As preferências de perfil poderão ser ajustadas após a ativação.`,'warning');
        return;
      }

      const wantsProfileSetup=Boolean(profileName)||!showOnPodium.checked||!showOnline.checked;
      if(autoLogin.checked||wantsProfileSetup){
        await S.api('/api/auth/login',{method:'POST',body:{username,password}});
      }

      if(wantsProfileSetup){
        try{
          await S.api('/api/social/account/profile',{method:'PATCH',body:{
            displayName:profileName||username,
            privacy:{showOnPodium:showOnPodium.checked,showOnline:showOnline.checked}
          }});
        }catch(profileError){
          console.warn('Não foi possível aplicar o perfil inicial:',profileError);
        }
      }

      document.body.classList.add('register-v14-success');
      if(autoLogin.checked){
        S.message(message,'Conta criada. Abrindo seu workspace...','success');
        setTimeout(()=>location.replace('/painel'),reduce.matches?0:460);
      }else{
        if(wantsProfileSetup)await S.api('/api/auth/logout',{method:'POST'}).catch(()=>{});
        S.message(message,'Conta criada. Agora você pode entrar quando quiser.','success');
        setTimeout(()=>location.replace('/painel/login'),reduce.matches?0:700);
      }
    }catch(error){S.message(message,error.message,'error')}
    finally{
      button.disabled=false;
      if(buttonLabel)buttonLabel.textContent='Criar workspace';
    }
  });

  refreshUsername();
  refreshPassword();
  S.session().then(account=>{if(account)location.replace('/painel')}).catch(()=>{});
})();
