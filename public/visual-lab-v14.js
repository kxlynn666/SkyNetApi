(() => {
  if(window.__SKYNET_VISUAL_LAB_V14__)return;
  window.__SKYNET_VISUAL_LAB_V14__=true;
  if((location.pathname.replace(/\/+$/,'')||'/')!=='/painel/visual')return;
  const S=window.SkyNet;if(!S)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');

  const style=document.createElement('style');
  style.id='visualLabV14Styles';
  style.textContent=`
    .visual-lab-v14{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:14px;perspective:1300px}
    .visual-lab-stage-v14{position:relative;min-height:570px;border:1px solid #27272c;background:#08080a;overflow:hidden;isolation:isolate;display:grid;place-items:center;padding:28px;transform-style:preserve-3d}
    .visual-lab-grid-v14{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.027) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.027) 1px,transparent 1px);background-size:36px 36px;mask-image:linear-gradient(to bottom,#000,transparent 88%);pointer-events:none}
    .visual-lab-stage-copy-v14{position:absolute;left:18px;top:17px;z-index:6}.visual-lab-stage-copy-v14 strong{display:block;font-size:11px}.visual-lab-stage-copy-v14 span{display:block;font:500 8px 'IBM Plex Mono',monospace;color:#67676e;margin-top:3px}
    .visual-lab-card-v14{width:min(470px,82%);aspect-ratio:4/3;position:relative;transform-style:preserve-3d;transition:transform .12s linear;will-change:transform}.visual-lab-card-v14 .profile-surface{position:absolute;inset:0;overflow:hidden;border:1px solid #303035;background:#0d0d0f;box-shadow:0 44px 100px rgba(0,0,0,.4);transform:translateZ(38px)}
    .visual-lab-card-v14 .profile-surface::before,.visual-lab-card-v14 .profile-surface::after{pointer-events:none!important}.visual-lab-card-v14-content{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;justify-content:flex-end;padding:22px;pointer-events:none;transform:translateZ(64px)}.visual-lab-card-v14-content b{font-size:clamp(24px,5vw,44px);letter-spacing:-.05em}.visual-lab-card-v14-content span{font:500 9px 'IBM Plex Mono',monospace;color:#898990;margin-top:5px}.visual-lab-avatar-v14{width:62px;height:62px;border:1px solid rgba(255,255,255,.18);background:#141416;display:grid;place-items:center;font-weight:700;margin-bottom:14px;transform:translateZ(24px)}
    .visual-lab-axis-v14{position:absolute;width:1px;height:80%;background:linear-gradient(transparent,rgba(141,128,237,.28),transparent);right:13%;top:10%;transform:translateZ(16px);animation:visual-axis-v14 8s ease-in-out infinite alternate}
    .visual-lab-panel-v14{border:1px solid #27272c;background:#0b0b0d;padding:14px;min-width:0}.visual-lab-panel-v14 h2{font-size:17px;margin:0 0 5px}.visual-lab-panel-v14>p{margin:0 0 12px;color:#77777e;font-size:10px;line-height:1.5}.visual-lab-search-v14{margin-bottom:8px!important;min-height:34px!important;font-size:10px!important}.visual-lab-list-v14{display:grid;gap:4px;max-height:470px;overflow:auto;padding-right:2px}.visual-lab-item-v14{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;text-align:left;padding:9px 8px;border:1px solid transparent;background:transparent;color:#aaaab0;cursor:pointer}.visual-lab-item-v14:hover{background:#111113;color:#efefec}.visual-lab-item-v14.active{background:#151517;color:#fff;border-color:#34343a;box-shadow:inset 2px 0 0 #8d80ed}.visual-lab-item-v14 strong{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.visual-lab-item-v14 span{grid-column:1;font:500 7px 'IBM Plex Mono',monospace;color:#66666d}.visual-lab-item-v14 b{grid-row:1/3;grid-column:2;align-self:center;font:600 8px 'IBM Plex Mono',monospace;color:#85858c}.visual-lab-actions-v14{display:flex;gap:6px;margin-top:10px}.visual-lab-actions-v14 .button{font-size:9px!important;min-height:32px!important}
    @keyframes visual-axis-v14{from{translate:0 -18px;opacity:.35}to{translate:0 22px;opacity:.8}}
    @media(max-width:900px){.visual-lab-v14{grid-template-columns:1fr}.visual-lab-stage-v14{min-height:430px}.visual-lab-panel-v14{padding:11px}.visual-lab-list-v14{max-height:330px}}
    @media(max-width:520px){.visual-lab-stage-v14{min-height:350px;padding:18px}.visual-lab-card-v14{width:92%}.visual-lab-card-v14-content{padding:15px}.visual-lab-avatar-v14{width:50px;height:50px}.visual-lab-stage-copy-v14{left:12px;top:12px}}
    @media(prefers-reduced-motion:reduce){.visual-lab-axis-v14{animation:none!important}.visual-lab-card-v14{transform:none!important}}
  `;
  document.head.appendChild(style);

  let items=[],active=null;
  function addNav(){
    const nav=document.querySelector('#workspaceSidebar .workspace-nav');if(!nav||document.getElementById('visualLabNavV14'))return;
    document.querySelectorAll('.workspace-nav-link').forEach(link=>link.classList.remove('active'));
    const group=document.createElement('div');group.className='workspace-nav-group';group.id='visualLabNavV14';
    group.innerHTML='<div class="workspace-nav-label">Visual</div><a class="workspace-nav-link active" href="/painel/visual"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="m8 15 3-4 2 2 3-5 2 7"/></svg></span><span>Visual Lab</span></a>';
    nav.appendChild(group);
  }
  function renderShell(){
    const shell=document.getElementById('workspaceShell'),root=document.getElementById('workspaceContent');
    if(!shell||shell.classList.contains('hidden')||!root)return false;
    document.getElementById('workspaceKicker').textContent='Visual';document.getElementById('workspaceTitle').textContent='Visual Lab';document.getElementById('workspaceDescription').textContent='Explore stocks e decorações em uma superfície interativa antes de levar a escolha para o perfil.';document.title='Visual Lab - SkyNetApi';addNav();
    root.innerHTML=`<section class="visual-lab-v14"><div class="visual-lab-stage-v14" id="visualLabStageV14"><div class="visual-lab-grid-v14"></div><div class="visual-lab-stage-copy-v14"><strong>LIVE SURFACE</strong><span>pointer / depth / stock</span></div><div class="visual-lab-card-v14" id="visualLabCardV14"><div class="profile-surface" id="visualLabSurfaceV14"><div class="visual-lab-card-v14-content"><div class="visual-lab-avatar-v14">S</div><b id="visualLabNameV14">Stock</b><span id="visualLabMetaV14">selecione um efeito</span></div><i class="visual-lab-axis-v14"></i></div></div></div><aside class="visual-lab-panel-v14"><h2>Stocks & decorações</h2><p>Escolha um efeito. A superfície responde ao movimento sem alterar seu perfil.</p><input class="visual-lab-search-v14" id="visualLabSearchV14" type="search" placeholder="Buscar stock ou decoração"><div class="visual-lab-list-v14" id="visualLabListV14"><div class="empty">Carregando catálogo...</div></div><div class="visual-lab-actions-v14"><a class="button primary" href="/painel/perfil">Abrir Loja</a><button class="button" id="visualLabResetV14" type="button">Limpar</button></div></aside></section>`;
    wire();load();return true;
  }
  async function load(){
    try{const data=await S.api('/api/profile-store/catalog');const all=Array.isArray(data.catalog)?data.catalog:[];items=all.filter(item=>item.type==='decoration'&&!item.grantOnly);renderList('');if(items[0])select(items[0]);}
    catch(error){document.getElementById('visualLabListV14').innerHTML=`<div class="empty">${S.escapeHtml(error.message)}</div>`}
  }
  function renderList(query){
    const q=String(query||'').trim().toLowerCase();const shown=items.filter(item=>!q||`${item.name} ${item.collection||''} ${item.rarity||''}`.toLowerCase().includes(q));const root=document.getElementById('visualLabListV14');
    root.innerHTML=shown.length?shown.map(item=>`<button class="visual-lab-item-v14 ${active?.id===item.id?'active':''}" type="button" data-stock="${S.escapeHtml(item.id)}"><strong>${S.escapeHtml(item.name)}</strong><span>${S.escapeHtml(item.collection||'core')} · ${item.animated?'animado':'estático'}</span><b>${item.price?Number(item.price).toLocaleString('pt-BR'):'—'}</b></button>`).join(''):'<div class="empty">Nenhum efeito encontrado.</div>';
    root.querySelectorAll('[data-stock]').forEach(button=>button.addEventListener('click',()=>{const item=items.find(x=>x.id===button.dataset.stock);if(item)select(item)}));
  }
  function select(item){active=item;const surface=document.getElementById('visualLabSurfaceV14');surface.dataset.decoration=item.id;document.getElementById('visualLabNameV14').textContent=item.name;document.getElementById('visualLabMetaV14').textContent=`${item.collection||'core'} · ${item.animated?'movimento ativo':'estático'}`;renderList(document.getElementById('visualLabSearchV14')?.value||'')}
  function wire(){
    const search=document.getElementById('visualLabSearchV14');search.addEventListener('input',()=>renderList(search.value));document.getElementById('visualLabResetV14').addEventListener('click',()=>{active=null;document.getElementById('visualLabSurfaceV14').dataset.decoration='';document.getElementById('visualLabNameV14').textContent='Sem stock';document.getElementById('visualLabMetaV14').textContent='superfície neutra';renderList(search.value)});
    const stage=document.getElementById('visualLabStageV14'),card=document.getElementById('visualLabCardV14');if(!reduce.matches)stage.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;const r=stage.getBoundingClientRect();const x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;card.style.transform=`rotateX(${(-y*5).toFixed(2)}deg) rotateY(${(x*7).toFixed(2)}deg) translate3d(${(x*7).toFixed(1)}px,${(y*5).toFixed(1)}px,0)`},{passive:true});stage.addEventListener('pointerleave',()=>card.style.transform='');
  }
  if(renderShell())return;const observer=new MutationObserver(()=>{if(renderShell())observer.disconnect()});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});setTimeout(()=>observer.disconnect(),12000);
})();
