(() => {
  if (window.__SKYNET_MUSIC_HUB_V13__) return;
  window.__SKYNET_MUSIC_HUB_V13__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/musica') return;

  const S = window.SkyNet;
  const style = document.createElement('style');
  style.id = 'musicHubV13Styles';
  style.textContent = `
    body{padding-bottom:0!important}
    .music-hub-v13{display:grid;gap:14px}
    .music-hub-hero-v13{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:center;padding:22px;border:1px solid #25252a;border-radius:16px;background:#121214;overflow:hidden;position:relative;isolation:isolate}
    .music-hub-copy-v13{position:relative;z-index:2}.music-hub-copy-v13 .workspace-kicker{margin-bottom:7px}.music-hub-copy-v13 h2{font-size:clamp(24px,4vw,42px);line-height:1;margin:0 0 10px;letter-spacing:-.045em}.music-hub-copy-v13 p{max-width:620px;margin:0;color:var(--text-muted);line-height:1.55;font-size:13px}
    .music-hub-visual-v13{height:190px;position:relative;display:grid;place-items:center;overflow:hidden}
    .music-hub-disc-v13{width:142px;height:142px;border-radius:50%;border:1px solid rgba(255,255,255,.1);position:relative;animation:music-hub-spin-v13 18s linear infinite;background:repeating-radial-gradient(circle,#18181b 0 4px,#101012 5px 8px)}
    .music-hub-disc-v13::before{content:'';position:absolute;inset:31%;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:#d8d8d3;box-shadow:0 0 0 10px #151517}.music-hub-disc-v13::after{content:'';position:absolute;width:7px;height:7px;border-radius:50%;background:#111113;left:50%;top:50%;transform:translate(-50%,-50%)}
    .music-hub-wave-v13{position:absolute;inset:auto 0 12px;display:flex;justify-content:center;align-items:end;gap:4px;height:52px;opacity:.7}.music-hub-wave-v13 i{width:3px;border-radius:3px;background:#b8b8b4;animation:music-wave-v13 1.6s ease-in-out infinite alternate}.music-hub-wave-v13 i:nth-child(2n){animation-delay:-.5s}.music-hub-wave-v13 i:nth-child(3n){animation-delay:-1s}.music-hub-wave-v13 i:nth-child(4n){animation-duration:2.1s}
    .music-hub-player-v13{border:1px solid #25252a;border-radius:16px;background:#111113;overflow:hidden;padding:14px}
    .music-hub-player-v13 .skynet-music-bar{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;z-index:1!important;width:100%!important;border:0!important;border-radius:12px!important;background:#151517!important;box-shadow:none!important;overflow:hidden!important}
    .music-hub-player-v13 .skynet-music-main{padding:12px!important}.music-hub-player-v13 .skynet-music-panel{background:#121214!important}
    .music-hub-notes-v13{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.music-hub-note-v13{padding:14px;border:1px solid #25252a;border-radius:12px;background:#121214}.music-hub-note-v13 strong{display:block;font-size:11px;margin-bottom:4px}.music-hub-note-v13 span{font-size:10px;color:var(--text-faint);line-height:1.45}
    @keyframes music-hub-spin-v13{to{transform:rotate(360deg)}}
    @keyframes music-wave-v13{from{height:7px;opacity:.35}to{height:42px;opacity:1}}
    @media(max-width:760px){.music-hub-hero-v13{grid-template-columns:1fr;padding:17px}.music-hub-visual-v13{height:142px}.music-hub-disc-v13{width:104px;height:104px}.music-hub-wave-v13{height:38px}.music-hub-notes-v13{grid-template-columns:1fr}.music-hub-player-v13{padding:8px}.music-hub-player-v13 .skynet-music-main{grid-template-columns:minmax(0,1fr) auto!important}.music-hub-player-v13 .skynet-music-source{grid-column:1/-1!important}}
    @media(prefers-reduced-motion:reduce){.music-hub-disc-v13,.music-hub-wave-v13 i{animation:none!important}}
  `;
  document.head.appendChild(style);

  function addNav(){
    const nav = document.querySelector('#workspaceSidebar .workspace-nav');
    if (!nav || document.getElementById('musicNavV13')) return;
    document.querySelectorAll('.workspace-nav-link').forEach(link=>link.classList.remove('active'));
    const group = document.createElement('div');
    group.className='workspace-nav-group';
    group.id='musicNavV13';
    group.innerHTML='<div class="workspace-nav-label">Mídia</div><a class="workspace-nav-link active" href="/painel/musica"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M16 6v7.5a2.5 2.5 0 1 1-2-2.45"/></svg></span><span>Música</span></a>';
    nav.appendChild(group);
  }

  function render(){
    const shell=document.getElementById('workspaceShell');
    const root=document.getElementById('workspaceContent');
    if(!shell || shell.classList.contains('hidden') || !root) return false;
    document.getElementById('workspaceKicker').textContent='Mídia';
    document.getElementById('workspaceTitle').textContent='Música';
    document.getElementById('workspaceDescription').textContent='Seu player fica isolado aqui, sem ocupar espaço ou interferir nas outras páginas.';
    document.title='Música - SkyNetApi';
    addNav();
    root.innerHTML=`<section class="music-hub-v13"><div class="music-hub-hero-v13"><div class="music-hub-copy-v13"><div class="workspace-kicker">Player dedicado</div><h2>Som sem atrapalhar o resto.</h2><p>Escolha uma faixa da biblioteca ou use o Lo-fi local. O player agora existe somente nesta página e mantém seus controles juntos, sem cobrir Chat, Loja, Perfil ou o mobile.</p></div><div class="music-hub-visual-v13" aria-hidden="true"><div class="music-hub-disc-v13"></div><div class="music-hub-wave-v13">${Array.from({length:22},()=>'<i></i>').join('')}</div></div></div><div class="music-hub-player-v13" id="musicPlayerMountV13"><div class="empty">Preparando player...</div></div><div class="music-hub-notes-v13"><div class="music-hub-note-v13"><strong>Sem sobreposição</strong><span>Nenhuma barra fixa aparece fora desta página.</span></div><div class="music-hub-note-v13"><strong>Estado preservado</strong><span>Fonte, volume e posição continuam salvos localmente.</span></div><div class="music-hub-note-v13"><strong>Mobile primeiro</strong><span>Controles reorganizam sem cobrir o dock ou o conteúdo.</span></div></div></section>`;
    movePlayer();
    return true;
  }

  function movePlayer(){
    const mount=document.getElementById('musicPlayerMountV13');
    const bar=document.getElementById('skynetMusicBar');
    if(!mount) return;
    if(bar){mount.innerHTML='';mount.appendChild(bar);return;}
    const observer=new MutationObserver(()=>{const player=document.getElementById('skynetMusicBar');if(player){observer.disconnect();mount.innerHTML='';mount.appendChild(player)}});
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),12000);
  }

  if(render()) return;
  const observer=new MutationObserver(()=>{if(render())observer.disconnect()});
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setTimeout(()=>observer.disconnect(),12000);
})();