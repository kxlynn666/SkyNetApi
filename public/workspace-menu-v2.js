(() => {
  if (window.__SKYNET_WORKSPACE_MENU_V2__) return;
  window.__SKYNET_WORKSPACE_MENU_V2__ = true;
  window.__SKYNET_WORKSPACE_MOBILE_NAV_V1__ = true;
  window.__SKYNET_WORKSPACE_SIDEBAR_STABILITY_V1__ = true;

  const mq = matchMedia('(max-width:820px)');
  const clean = value => { try { return new URL(value,location.origin).pathname.replace(/\/+$/,'') || '/'; } catch { return String(value||'').replace(/\/+$/,'') || '/'; } };
  const current = () => clean(location.pathname);
  let sidebar, backdrop, button, nav, closeButton;
  let ready = false;

  const icon = body => `<span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg></span>`;
  const icons = {
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',friends:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7-4.6"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',game:'<path d="M5 5h14v14H5zM9.7 5v14M14.3 5v14M5 9.7h14M5 14.3h14"/>',upscale:'<path d="M4 5h15v15H4zM9 2v5M6.5 4.5h5M15 11h6M18 8v6"/>',music:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M16 6v7.5a2.5 2.5 0 1 1-2-2.45"/>',card:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 8h12M6 12h12M6 16h8"/>',brat:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 9h10M7 15h10"/>'
  };

  function link(href,label,kind) {
    const a=document.createElement('a'); a.className='workspace-nav-link'; a.href=href; a.innerHTML=`${icon(icons[kind])}<span>${label}</span>`; return a;
  }
  function group(label,id) {
    let g=document.getElementById(id); if(g&&nav.contains(g)) return g;
    g=document.createElement('div'); g.className='workspace-nav-group'; g.id=id; g.innerHTML=`<div class="workspace-nav-label">${label}</div>`; nav.appendChild(g); return g;
  }
  function add(g,href,label,kind) { if(!nav.querySelector(`a[href="${href}"]`)) g.appendChild(link(href,label,kind)); }

  function canonicalize() {
    if(!nav) return;
    const social=group('Social','menuV2Social'); add(social,'/painel/perfil','Perfil','profile'); add(social,'/painel/amigos','Amigos','friends'); add(social,'/painel/chat','Chat','chat');
    const creation=[...nav.querySelectorAll('.workspace-nav-group')].find(g=>g.querySelector('.workspace-nav-label')?.textContent.trim()==='Criação');
    if(creation){ if(!nav.querySelector('a[href="/painel/card2"]')) creation.appendChild(link('/painel/card2','Card 2.0','card')); if(!nav.querySelector('a[href="/painel/brat"]')) creation.appendChild(link('/painel/brat','Brat Generator','brat')); }
    const image=group('Imagem','menuV2Image'); add(image,'/painel/upscale','AI Upscaler','upscale');
    const media=group('Mídia','menuV2Media'); add(media,'/painel/musica','Música','music');
    const games=group('Jogos','menuV2Games'); add(games,'/painel/jogos','Jogo da Velha','game');

    const seen=new Set();
    [...nav.querySelectorAll('.workspace-nav-link[href]')].forEach(a=>{const key=clean(a.getAttribute('href')); if(seen.has(key)) a.remove(); else seen.add(key);});
    [...nav.querySelectorAll('.workspace-nav-group')].forEach(g=>{if(!g.querySelector('.workspace-nav-link'))g.remove();});
    nav.querySelectorAll('.workspace-nav-link[href]').forEach(a=>a.classList.toggle('active',clean(a.getAttribute('href'))===current()));
  }

  function ensureClose() {
    closeButton=sidebar.querySelector('#workspaceSidebarClose');
    if(closeButton) return;
    closeButton=document.createElement('button'); closeButton.id='workspaceSidebarClose'; closeButton.className='workspace-sidebar-close'; closeButton.type='button'; closeButton.setAttribute('aria-label','Fechar menu'); closeButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'; sidebar.prepend(closeButton);
  }
  function sync(open) {
    const mobile=mq.matches;
    sidebar.classList.toggle('open',mobile&&open);
    backdrop.classList.toggle('hidden',!(mobile&&open));
    button.setAttribute('aria-expanded',mobile&&open?'true':'false');
    document.documentElement.classList.toggle('workspace-nav-open',mobile&&open); document.body.classList.toggle('workspace-nav-open',mobile&&open);
    sidebar.setAttribute('aria-hidden',mobile&&!open?'true':'false');
  }
  function open(){if(!mq.matches)return;sync(true);requestAnimationFrame(()=>nav.querySelector('.active')?.scrollIntoView({block:'nearest'}));}
  function close(){sync(false);}

  function setup() {
    if(ready) return true;
    const shell=document.getElementById('workspaceShell'); sidebar=document.getElementById('workspaceSidebar'); backdrop=document.getElementById('workspaceSidebarBackdrop'); button=document.getElementById('workspaceMenuButton');
    if(!shell||shell.classList.contains('hidden')||!sidebar||!backdrop||!button) return false;
    nav=sidebar.querySelector('.workspace-nav'); if(!nav)return false;
    ensureClose(); canonicalize();
    button.setAttribute('aria-controls','workspaceSidebar'); button.setAttribute('aria-expanded','false');
    button.addEventListener('click',e=>{if(!mq.matches)return;e.preventDefault();e.stopImmediatePropagation();sidebar.classList.contains('open')?close():open();},true);
    backdrop.addEventListener('click',e=>{if(!mq.matches)return;e.preventDefault();e.stopImmediatePropagation();close();},true);
    closeButton.addEventListener('click',e=>{e.preventDefault();close();},true);
    sidebar.addEventListener('click',e=>{if(mq.matches&&e.target.closest('.workspace-nav-link'))close();},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebar.classList.contains('open'))close();},true);
    mq.addEventListener?.('change',()=>{close();canonicalize();});
    window.addEventListener('pageshow',()=>{canonicalize();close();},{passive:true});
    sync(false); ready=true;
    [120,600,1400].forEach(ms=>setTimeout(()=>{canonicalize();},ms));
    return true;
  }
  if(setup())return;
  const boot=new MutationObserver(()=>{if(setup())boot.disconnect();}); boot.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']}); setTimeout(()=>boot.disconnect(),12000);
})();