(() => {
  if (window.__SKYNET_WORKSPACE_COMMAND_MENU_V1__) return;
  window.__SKYNET_WORKSPACE_COMMAND_MENU_V1__ = true;
  if (!location.pathname.startsWith('/painel')) return;

  const routes = [
    ['/painel','Visão geral','Painel, resumo, pódio'],
    ['/painel/perfil','Perfil e personalização','Avatar, capa, loja, molduras'],
    ['/painel/chaves','API Keys','Criar e gerenciar chaves'],
    ['/painel/api','Documentação da API','Rotas e integração'],
    ['/painel/cards','Card Studio','Criar cards'],
    ['/painel/card2','Card2','Gerador alternativo'],
    ['/painel/brat','Brat Generator','Imagem de texto'],
    ['/painel/uploads','Uploads','Biblioteca de imagens'],
    ['/painel/historico','Histórico','Cards gerados'],
    ['/painel/chat','Chat','Mensagens privadas'],
    ['/painel/amigos','Amigos','Contatos e solicitações'],
    ['/painel/grupos','Grupos','Comunidades e chamadas'],
    ['/painel/tiktok','TikTok','Downloader'],
    ['/painel/media','Media Downloader','Vídeo e áudio'],
    ['/painel/roblox','Roblox Lookup','Consultar jogadores']
  ];

  function esc(value){const el=document.createElement('div');el.textContent=String(value??'');return el.innerHTML;}

  function install(){
    if(document.getElementById('workspaceCommandMenuV1')) return;
    const menu=document.createElement('div');
    menu.id='workspaceCommandMenuV1';
    menu.className='workspace-command-v1';
    menu.hidden=true;
    menu.innerHTML=`<div class="workspace-command-backdrop-v1" data-command-close></div><section class="workspace-command-box-v1" role="dialog" aria-modal="true" aria-label="Ações rápidas"><div class="workspace-command-search-v1"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="workspaceCommandInputV1" type="search" autocomplete="off" placeholder="Ir para uma página ou ferramenta..."><kbd>Esc</kbd></div><div class="workspace-command-list-v1" id="workspaceCommandListV1"></div></section>`;
    document.body.appendChild(menu);
    style();
    render('');
    menu.querySelector('[data-command-close]').addEventListener('click',close);
    menu.querySelector('input').addEventListener('input',e=>render(e.target.value));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden)close();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}});
    injectButton();
  }

  function injectButton(){
    const target=document.getElementById('workspaceUserChip')?.parentElement || document.querySelector('.workspace-topbar');
    if(!target || document.getElementById('workspaceCommandButtonV1')) return;
    const button=document.createElement('button');
    button.id='workspaceCommandButtonV1';
    button.className='workspace-command-button-v1';
    button.type='button';
    button.title='Ações rápidas';
    button.setAttribute('aria-label','Abrir ações rápidas');
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span>Buscar</span><kbd>Ctrl K</kbd>';
    target.insertBefore(button,document.getElementById('workspaceUserChip') || null);
    button.addEventListener('click',open);
  }

  function open(){const menu=document.getElementById('workspaceCommandMenuV1');if(!menu)return;menu.hidden=false;document.body.classList.add('workspace-command-open-v1');const input=document.getElementById('workspaceCommandInputV1');input.value='';render('');setTimeout(()=>input.focus(),0)}
  function close(){const menu=document.getElementById('workspaceCommandMenuV1');if(!menu)return;menu.hidden=true;document.body.classList.remove('workspace-command-open-v1')}

  function render(query){
    const root=document.getElementById('workspaceCommandListV1');if(!root)return;
    const q=String(query||'').trim().toLowerCase();
    const items=routes.filter(item=>!q||`${item[1]} ${item[2]} ${item[0]}`.toLowerCase().includes(q));
    root.innerHTML=items.length?items.map(([href,title,desc],i)=>`<a href="${href}" class="workspace-command-item-v1" ${i===0?'data-command-first':''}><span class="workspace-command-route-v1">${esc(title)}</span><small>${esc(desc)}</small><b>↗</b></a>`).join(''):'<div class="workspace-command-empty-v1">Nenhuma ferramenta encontrada.</div>';
    root.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
  }

  function style(){
    if(document.getElementById('workspaceCommandStylesV1'))return;
    const s=document.createElement('style');s.id='workspaceCommandStylesV1';s.textContent=`
      .workspace-command-button-v1{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 10px;border:1px solid var(--border-soft);border-radius:11px;background:rgba(255,255,255,.025);color:var(--text-muted);cursor:pointer}.workspace-command-button-v1 svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8}.workspace-command-button-v1 span{font-size:10px;font-weight:700}.workspace-command-button-v1 kbd,.workspace-command-search-v1 kbd{font:700 7px 'JetBrains Mono',monospace;color:var(--text-faint);padding:3px 5px;border:1px solid var(--border-soft);border-radius:6px;background:rgba(255,255,255,.025)}.workspace-command-v1{position:fixed;inset:0;z-index:10000}.workspace-command-v1[hidden]{display:none}.workspace-command-backdrop-v1{position:absolute;inset:0;background:rgba(4,2,9,.64);backdrop-filter:blur(7px)}.workspace-command-box-v1{position:relative;width:min(620px,calc(100vw - 28px));max-height:min(610px,80vh);margin:10vh auto 0;border:1px solid rgba(167,139,250,.24);border-radius:19px;background:rgba(15,10,27,.98);box-shadow:0 30px 90px rgba(0,0,0,.5),0 0 35px rgba(139,92,246,.08);overflow:hidden}.workspace-command-search-v1{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 14px;border-bottom:1px solid var(--border-soft)}.workspace-command-search-v1 svg{width:19px;height:19px;fill:none;stroke:#c4b5fd;stroke-width:1.8}.workspace-command-search-v1 input{min-height:40px!important;border:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;font-size:14px}.workspace-command-list-v1{display:grid;gap:5px;padding:8px;overflow:auto;max-height:calc(min(610px,80vh) - 68px)}.workspace-command-item-v1{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;padding:10px 11px;border:1px solid transparent;border-radius:11px;color:inherit;text-decoration:none}.workspace-command-item-v1:hover{background:rgba(139,92,246,.07);border-color:rgba(167,139,250,.12)}.workspace-command-route-v1{font-size:11px;font-weight:800}.workspace-command-item-v1 small{grid-column:1;font-size:9px;color:var(--text-faint)}.workspace-command-item-v1 b{grid-row:1/3;grid-column:2;align-self:center;color:#8b7da0;font-size:11px}.workspace-command-empty-v1{padding:24px;text-align:center;color:var(--text-faint);font-size:10px}.workspace-command-open-v1{overflow:hidden}
      @media(max-width:700px){.workspace-command-button-v1{width:36px;height:36px;padding:0;justify-content:center}.workspace-command-button-v1 span,.workspace-command-button-v1 kbd{display:none}.workspace-command-box-v1{width:calc(100vw - 18px);margin:7vh auto 0;border-radius:17px}.workspace-command-search-v1{padding:10px}.workspace-command-search-v1 kbd{display:none}.workspace-command-list-v1{padding:6px}}
    `;document.head.appendChild(s);
  }

  const start=()=>{if(document.getElementById('workspaceShell')&&!document.getElementById('workspaceShell').classList.contains('hidden'))install();else{const o=new MutationObserver(()=>{if(document.getElementById('workspaceShell')&&!document.getElementById('workspaceShell').classList.contains('hidden')){o.disconnect();install();}});o.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});setTimeout(()=>o.disconnect(),12000)}};
  start();
})();
