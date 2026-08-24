(() => {
  if (window.__SKYNET_PROFILE_DESIGN_V1__) return;
  window.__SKYNET_PROFILE_DESIGN_V1__ = true;
  const S = window.SkyNet;
  if (!S) return;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const cache = new Map();
  let savedDesign = null;
  let draftDesign = null;
  let installScheduled = false;

  const DEFAULTS = {
    fontFamily: 'system', avatarShape: 'squircle', bannerFocus: 'center',
    profileLayout: 'balanced', tagStyle: 'pill', nameEffect: 'none',
    motionLevel: 'full', cornerStyle: 'soft'
  };

  installStyles();
  if (path === '/painel/perfil') bootEditor();
  if (path.startsWith('/u/')) bootPublic();
  if (path === '/painel' || path === '/') bootPodiums();

  function installStyles() {
    if (document.getElementById('profileDesignV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'profileDesignV1Styles';
    style.textContent = `
      .profile-design-shell{display:grid;gap:14px}.profile-design-intro{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px;border:1px solid rgba(34,211,238,.15);border-radius:15px;background:linear-gradient(135deg,rgba(34,211,238,.055),rgba(139,92,246,.045))}.profile-design-intro strong{display:block;font-size:13px}.profile-design-intro span{display:block;margin-top:3px;font-size:10px;color:var(--text-muted)}.profile-design-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.profile-design-group{padding:14px;border:1px solid var(--border-soft);border-radius:14px;background:rgba(20,13,35,.48)}.profile-design-group h4{margin:0 0 4px;font-size:12px}.profile-design-group>p{margin:0 0 10px;color:var(--text-faint);font-size:9px;line-height:1.45}.profile-design-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.profile-design-option{position:relative;display:flex;align-items:center;gap:7px;min-height:38px;padding:8px 9px;border:1px solid var(--border-soft);border-radius:10px;background:rgba(255,255,255,.02);cursor:pointer;font-size:10px;color:var(--text-muted)}.profile-design-option input{position:absolute;opacity:0;pointer-events:none}.profile-design-option:has(input:checked){border-color:rgba(103,232,249,.32);background:linear-gradient(135deg,rgba(34,211,238,.08),rgba(139,92,246,.07));color:#fff;box-shadow:inset 0 0 0 1px rgba(103,232,249,.06)}.profile-design-option i{width:16px;height:16px;border-radius:5px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(135deg,rgba(103,232,249,.22),rgba(167,139,250,.18));flex:none}.profile-design-actions{display:flex;gap:8px;flex-wrap:wrap}.profile-design-message{min-height:18px;font-size:10px;color:var(--text-muted)}
      [data-profile-font="mono"] .public-main-v3,[data-profile-font="mono"] .profile-v3-preview-content,[data-profile-font="mono"] .panel-mini-content{font-family:'JetBrains Mono',monospace!important}[data-profile-font="serif"] .public-main-v3,[data-profile-font="serif"] .profile-v3-preview-content,[data-profile-font="serif"] .panel-mini-content{font-family:Georgia,'Times New Roman',serif!important}[data-profile-font="rounded"] .public-main-v3,[data-profile-font="rounded"] .profile-v3-preview-content,[data-profile-font="rounded"] .panel-mini-content{font-family:'Trebuchet MS','Arial Rounded MT Bold',system-ui,sans-serif!important}[data-profile-font="display"] .public-copy-v3 h1,[data-profile-font="display"] .profile-v3-copy h2,[data-profile-font="display"] .panel-mini-name{font-family:Impact,'Arial Black',system-ui,sans-serif!important;letter-spacing:.02em}
      [data-avatar-shape="circle"] .cosmetic-avatar,[data-avatar-shape="circle"] .cosmetic-avatar-inner{border-radius:50%!important}[data-avatar-shape="rounded"] .cosmetic-avatar{border-radius:18px!important}[data-avatar-shape="rounded"] .cosmetic-avatar-inner{border-radius:14px!important}[data-avatar-shape="square"] .cosmetic-avatar{border-radius:8px!important}[data-avatar-shape="square"] .cosmetic-avatar-inner{border-radius:5px!important}
      [data-banner-focus="top"] .public-cover-v3 img,[data-banner-focus="top"] .profile-v3-preview-bg img,[data-banner-focus="top"] .panel-mini-bg img{object-position:center top!important}[data-banner-focus="bottom"] .public-cover-v3 img,[data-banner-focus="bottom"] .profile-v3-preview-bg img,[data-banner-focus="bottom"] .panel-mini-bg img{object-position:center bottom!important}[data-banner-focus="left"] .public-cover-v3 img,[data-banner-focus="left"] .profile-v3-preview-bg img,[data-banner-focus="left"] .panel-mini-bg img{object-position:left center!important}[data-banner-focus="right"] .public-cover-v3 img,[data-banner-focus="right"] .profile-v3-preview-bg img,[data-banner-focus="right"] .panel-mini-bg img{object-position:right center!important}
      [data-profile-layout="compact"].public-profile-v3 .public-cover-v3{height:190px}[data-profile-layout="compact"].public-profile-v3 .public-main-v3{padding-bottom:20px}[data-profile-layout="compact"] .public-stats-v3{margin-top:16px}[data-profile-layout="compact"].profile-v3-preview .profile-v3-metrics{margin-top:10px}[data-profile-layout="showcase"].public-profile-v3 .public-cover-v3{height:320px}[data-profile-layout="showcase"].public-profile-v3 .public-main-v3{margin-top:-74px}[data-profile-layout="showcase"].profile-v3-preview .profile-v3-preview-bg img{opacity:.72!important}
      [data-tag-style="badge"] .profile-tag{border-radius:6px!important;clip-path:polygon(7% 0,100% 0,93% 100%,0 100%);font-weight:900!important;letter-spacing:.07em!important}[data-tag-style="minimal"] .profile-tag{background:transparent!important;border-color:transparent!important;box-shadow:none!important;padding-left:2px!important;padding-right:2px!important;color:var(--tag-b,#c4b5fd)!important}[data-tag-style="outline"] .profile-tag{background:transparent!important;box-shadow:none!important;border:1px solid var(--tag-b,#c4b5fd)!important;color:var(--tag-b,#c4b5fd)!important}
      [data-name-effect="gradient"] .public-copy-v3 h1,[data-name-effect="gradient"] .profile-v3-copy h2,[data-name-effect="gradient"] .panel-mini-name{background:linear-gradient(90deg,var(--profile-accent,#a855f7),#67e8f9);-webkit-background-clip:text;background-clip:text;color:transparent!important}[data-name-effect="glow"] .public-copy-v3 h1,[data-name-effect="glow"] .profile-v3-copy h2,[data-name-effect="glow"] .panel-mini-name{text-shadow:0 0 18px color-mix(in srgb,var(--profile-accent,#a855f7) 52%,transparent)}[data-name-effect="outline"] .public-copy-v3 h1,[data-name-effect="outline"] .profile-v3-copy h2,[data-name-effect="outline"] .panel-mini-name{-webkit-text-stroke:1px color-mix(in srgb,var(--profile-accent,#a855f7) 55%,#fff);color:transparent!important}
      [data-corner-style="medium"].public-profile-v3,[data-corner-style="medium"].profile-v3-preview,[data-corner-style="medium"].panel-mini-podium-card{border-radius:14px!important}[data-corner-style="sharp"].public-profile-v3,[data-corner-style="sharp"].profile-v3-preview,[data-corner-style="sharp"].panel-mini-podium-card{border-radius:5px!important}
      [data-motion-level="subtle"] *,[data-motion-level="subtle"] *::before,[data-motion-level="subtle"] *::after{animation-duration:calc(var(--profile-animation-duration,8s) * 1.7)!important}[data-motion-level="still"] *,[data-motion-level="still"] *::before,[data-motion-level="still"] *::after{animation:none!important;transition-duration:.01ms!important}
      @media(max-width:680px){.profile-design-grid{grid-template-columns:1fr}.profile-design-group{padding:12px}.profile-design-options{grid-template-columns:1fr 1fr}.profile-design-intro{align-items:flex-start}.profile-design-actions{display:grid;grid-template-columns:1fr 1fr}.profile-design-actions .button{width:100%}[data-profile-layout="showcase"].public-profile-v3 .public-cover-v3{height:225px}}
      @media(max-width:390px){.profile-design-options{grid-template-columns:1fr}.profile-design-actions{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){[data-motion-level] *,[data-motion-level] *::before,[data-motion-level] *::after{animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  function normalize(input) {
    return { ...DEFAULTS, ...(input || {}) };
  }

  function applyDesign(root, input) {
    if (!root) return;
    const d = normalize(input);
    root.dataset.profileFont = d.fontFamily;
    root.dataset.avatarShape = d.avatarShape;
    root.dataset.bannerFocus = d.bannerFocus;
    root.dataset.profileLayout = d.profileLayout;
    root.dataset.tagStyle = d.tagStyle;
    root.dataset.nameEffect = d.nameEffect;
    root.dataset.motionLevel = d.motionLevel;
    root.dataset.cornerStyle = d.cornerStyle;
  }

  function option(name, value, label, checked) {
    return `<label class="profile-design-option"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><i></i><span>${label}</span></label>`;
  }

  function group(title, description, name, options, current) {
    return `<section class="profile-design-group"><h4>${title}</h4><p>${description}</p><div class="profile-design-options">${options.map(([value,label]) => option(name,value,label,current === value)).join('')}</div></section>`;
  }

  async function bootEditor() {
    try {
      const data = await S.api('/api/profile-design/me');
      savedDesign = normalize(data.design);
      draftDesign = { ...savedDesign };
      scheduleEditorInstall();
      const observer = new MutationObserver(scheduleEditorInstall);
      observer.observe(document.getElementById('workspaceContent') || document.documentElement,{childList:true,subtree:true});
    } catch {}
  }

  function scheduleEditorInstall() {
    if (installScheduled) return;
    installScheduled = true;
    requestAnimationFrame(() => {
      installScheduled = false;
      installEditor();
    });
  }

  function installEditor() {
    const tabs = document.querySelector('.profile-v3-tabs');
    const shell = document.querySelector('.profile-v3-shell');
    if (!tabs || !shell || !savedDesign) return;

    if (!tabs.querySelector('[data-profile-tab="design"]')) {
      const button = document.createElement('button');
      button.className = 'profile-v3-tab';
      button.type = 'button';
      button.dataset.profileTab = 'design';
      button.textContent = 'Design';
      tabs.insertBefore(button, tabs.querySelector('[data-profile-tab="store"]') || null);
      button.addEventListener('click', () => activate('design'));
    }

    let panel = shell.querySelector('[data-profile-panel="design"]');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'profile-v3-panel';
      panel.dataset.profilePanel = 'design';
      shell.appendChild(panel);
    }
    if (panel.dataset.designReady === '1') return;
    panel.dataset.designReady = '1';
    renderEditor(panel);
    applyDesign(document.querySelector('.profile-v3-preview'), draftDesign);
  }

  function renderEditor(panel) {
    const d = draftDesign || savedDesign;
    panel.innerHTML = `<div class="profile-v3-card profile-design-shell">
      <div class="profile-design-intro"><div><strong>Design avançado do perfil</strong><span>Essas escolhas ficam salvas na conta e aparecem no perfil público. A prévia é instantânea.</span></div><span class="profile-wallet-pill">8 categorias</span></div>
      <form id="profileDesignFormV1">
        <div class="profile-design-grid">
          ${group('Tipografia','Escolha a personalidade do texto do perfil.','fontFamily',[['system','Sistema'],['mono','Mono'],['serif','Serif'],['rounded','Rounded'],['display','Display']],d.fontFamily)}
          ${group('Formato do avatar','Muda a silhueta da foto e da moldura.','avatarShape',[['squircle','Squircle'],['circle','Circular'],['rounded','Arredondado'],['square','Quadrado']],d.avatarShape)}
          ${group('Foco da capa','Define qual parte da imagem de fundo deve receber prioridade.','bannerFocus',[['center','Centro'],['top','Topo'],['bottom','Base'],['left','Esquerda'],['right','Direita']],d.bannerFocus)}
          ${group('Layout','Controla a proporção entre capa, identidade e estatísticas.','profileLayout',[['balanced','Equilibrado'],['compact','Compacto'],['showcase','Showcase']],d.profileLayout)}
          ${group('Estilo das tags','Altere a linguagem visual das tags equipadas.','tagStyle',[['pill','Pílula'],['badge','Badge'],['minimal','Minimal'],['outline','Outline']],d.tagStyle)}
          ${group('Efeito do nome','Destaque o nome sem depender de uma decoração.','nameEffect',[['none','Nenhum'],['gradient','Gradiente'],['glow','Glow'],['outline','Contorno']],d.nameEffect)}
          ${group('Movimento','Controle a intensidade das animações cosméticas.','motionLevel',[['full','Completo'],['subtle','Suave'],['still','Estático']],d.motionLevel)}
          ${group('Cantos do cartão','Muda a geometria geral do cartão do perfil.','cornerStyle',[['soft','Suaves'],['medium','Médios'],['sharp','Retos']],d.cornerStyle)}
        </div>
        <div class="profile-v3-divider"></div>
        <div class="profile-design-message" id="profileDesignMessageV1"></div>
        <div class="profile-design-actions"><button class="button primary" type="submit">Salvar design</button><button class="button" type="button" id="profileDesignResetV1">Desfazer prévia</button></div>
      </form>
    </div>`;

    const form = panel.querySelector('#profileDesignFormV1');
    form.addEventListener('change', () => {
      draftDesign = collect(form);
      applyDesign(document.querySelector('.profile-v3-preview'), draftDesign);
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const message = panel.querySelector('#profileDesignMessageV1');
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const next = collect(form);
        const data = await S.api('/api/profile-design/me',{method:'PATCH',body:next});
        savedDesign = normalize(data.design);
        draftDesign = { ...savedDesign };
        message.textContent = 'Design salvo na sua conta.';
        message.style.color = '#86efac';
        applyDesign(document.querySelector('.profile-v3-preview'), savedDesign);
      } catch (error) {
        message.textContent = error.message || 'Falha ao salvar o design.';
        message.style.color = '#fda4af';
      } finally { button.disabled = false; }
    });
    panel.querySelector('#profileDesignResetV1').addEventListener('click', () => {
      draftDesign = { ...savedDesign };
      renderEditor(panel);
      applyDesign(document.querySelector('.profile-v3-preview'), savedDesign);
    });
  }

  function collect(form) {
    const data = new FormData(form);
    const out = {};
    for (const key of Object.keys(DEFAULTS)) out[key] = String(data.get(key) || DEFAULTS[key]);
    return out;
  }

  function activate(tab) {
    document.querySelectorAll('[data-profile-tab]').forEach(button => button.classList.toggle('active',button.dataset.profileTab === tab));
    document.querySelectorAll('[data-profile-panel]').forEach(panel => panel.classList.toggle('active',panel.dataset.profilePanel === tab));
  }

  async function bootPublic() {
    const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
    if (!username) return;
    const design = await fetchDesign(username);
    if (!design) return;
    const apply = () => {
      const root = document.querySelector('.public-profile-v3');
      if (!root) return false;
      applyDesign(root, design);
      return true;
    };
    if (!apply()) {
      const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
      observer.observe(document.getElementById('publicProfileRoot') || document.documentElement,{childList:true,subtree:true});
      setTimeout(() => observer.disconnect(),12000);
    }
  }

  function bootPodiums() {
    const enhance = root => {
      const cards = [];
      if (root.matches?.('.panel-mini-podium-card,.podium-card')) cards.push(root);
      cards.push(...(root.querySelectorAll?.('.panel-mini-podium-card,.podium-card') || []));
      for (const card of cards) enhancePodiumCard(card);
    };
    enhance(document);
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) enhance(node);
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  async function enhancePodiumCard(card) {
    if (card.dataset.profileDesignLoading === '1') return;
    const href = card.getAttribute('href') || '';
    const match = href.match(/^\/u\/([^/?#]+)/);
    if (!match) return;
    card.dataset.profileDesignLoading = '1';
    const username = decodeURIComponent(match[1]);
    const design = await fetchDesign(username);
    if (design && card.isConnected) applyDesign(card, design);
    card.dataset.profileDesignLoading = '0';
  }

  async function fetchDesign(username) {
    const key = String(username || '').toLowerCase();
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);
    try {
      const data = await S.api(`/api/profile-design/${encodeURIComponent(username)}`);
      const design = normalize(data.design);
      cache.set(key,design);
      return design;
    } catch { return null; }
  }
})();