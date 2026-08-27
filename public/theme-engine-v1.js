(() => {
  if (window.__SKYNET_THEME_ENGINE_V1__) return;
  window.__SKYNET_THEME_ENGINE_V1__ = true;
  const S = window.SkyNet;
  if (!S) return;

  const CACHE_KEY = 'skynet_account_theme_v1';
  const PRESETS = {
    violet:{name:'Violeta',accent:'#a855f7',bg:'#0b0713',panel:'#18102c',field:'#21183b',border:'#3b2a58',soft:'#2c2043',bright:'#c4b5fd',glow:'#c084fc',text:'#f6f0ff',muted:'#b3a7ca',faint:'#776990',on:'#ffffff'},
    mono:{name:'Branco',accent:'#ffffff',bg:'#080808',panel:'#111111',field:'#1a1a1a',border:'#3b3b3b',soft:'#292929',bright:'#ffffff',glow:'#d4d4d8',text:'#fafafa',muted:'#b8b8b8',faint:'#777777',on:'#080808'},
    cyan:{name:'Ciano',accent:'#22d3ee',bg:'#041014',panel:'#07191f',field:'#0b242b',border:'#17434d',soft:'#11323a',bright:'#67e8f9',glow:'#a5f3fc',text:'#ecfeff',muted:'#9bcbd1',faint:'#5c8f96',on:'#031014'},
    emerald:{name:'Esmeralda',accent:'#34d399',bg:'#06100d',panel:'#0a1b15',field:'#10271f',border:'#1d4b3c',soft:'#17382e',bright:'#6ee7b7',glow:'#a7f3d0',text:'#ecfdf5',muted:'#a4cbbd',faint:'#628c7c',on:'#04100c'},
    rose:{name:'Rosa',accent:'#fb7185',bg:'#13070b',panel:'#200d14',field:'#2c121c',border:'#562537',soft:'#40202c',bright:'#fda4af',glow:'#fecdd3',text:'#fff1f2',muted:'#d1a7ae',faint:'#946a72',on:'#170609'},
    gold:{name:'Dourado',accent:'#facc15',bg:'#100d04',panel:'#1b1608',field:'#29200b',border:'#55451a',soft:'#3c3114',bright:'#fde047',glow:'#fef08a',text:'#fffbeb',muted:'#cec18b',faint:'#8f8155',on:'#151003'}
  };
  let current = null;
  let injecting = false;

  installStyles();
  applyCached();
  boot().catch(() => {});

  function installStyles() {
    if (document.getElementById('skynetThemeEngineV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'skynetThemeEngineV1Styles';
    style.textContent = `
      html[data-skynet-theme]{color-scheme:dark}
      html[data-skynet-theme] body,html[data-skynet-theme] .workspace-body{background-color:var(--theme-bg)!important;background-image:radial-gradient(650px circle at 12% 8%,color-mix(in srgb,var(--theme-primary) 17%,transparent),transparent 62%),radial-gradient(620px circle at 88% 92%,color-mix(in srgb,var(--theme-glow) 10%,transparent),transparent 66%)!important;color:var(--theme-text)!important}
      html[data-skynet-theme] .workspace-sidebar{background:linear-gradient(180deg,color-mix(in srgb,var(--theme-panel) 96%,#000),color-mix(in srgb,var(--theme-bg) 96%,#000))!important;border-color:var(--theme-border-soft)!important}
      html[data-skynet-theme] .workspace-topbar{background:color-mix(in srgb,var(--theme-bg) 86%,transparent)!important;border-color:var(--theme-border-soft)!important}
      html[data-skynet-theme] .workspace-card,html[data-skynet-theme] .profile-v3-card,html[data-skynet-theme] .profile-v3-summary-card,html[data-skynet-theme] .card,html[data-skynet-theme] .auth-card{background:linear-gradient(180deg,color-mix(in srgb,var(--theme-panel) 96%,#000),color-mix(in srgb,var(--theme-panel) 86%,var(--theme-bg)))!important;border-color:var(--theme-border-soft)!important}
      html[data-skynet-theme] .workspace-stat,html[data-skynet-theme] .workspace-quick,html[data-skynet-theme] .workspace-info,html[data-skynet-theme] .profile-v3-check,html[data-skynet-theme] .profile-v3-choice,html[data-skynet-theme] .profile-v3-product,html[data-skynet-theme] .ui-preference-item,html[data-skynet-theme] .list-item,html[data-skynet-theme] .endpoint{background:color-mix(in srgb,var(--theme-field) 92%,transparent)!important;border-color:var(--theme-border-soft)!important}
      html[data-skynet-theme] input,html[data-skynet-theme] textarea,html[data-skynet-theme] select,html[data-skynet-theme] .button,html[data-skynet-theme] .workspace-menu-button{background:var(--theme-field)!important;border-color:var(--theme-border)!important;color:var(--theme-muted)!important}
      html[data-skynet-theme] input:focus,html[data-skynet-theme] textarea:focus,html[data-skynet-theme] select:focus{border-color:var(--theme-primary)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--theme-primary) 18%,transparent)!important}
      html[data-skynet-theme] a:not(.button):not(.workspace-nav-link):not(.podium-card-v3):not(.panel-mini-podium-card):not(.leaderboard-row){color:var(--theme-bright)}
      html[data-skynet-theme] .button.primary{background:linear-gradient(135deg,var(--theme-primary),var(--theme-bright))!important;border-color:transparent!important;color:var(--theme-on-primary)!important;box-shadow:0 8px 22px color-mix(in srgb,var(--theme-primary) 16%,transparent)}
      html[data-skynet-theme] .button:hover,html[data-skynet-theme] .nav-link:hover{border-color:var(--theme-primary)!important;color:var(--theme-text)!important}
      html[data-skynet-theme] .workspace-logo span,html[data-skynet-theme] .workspace-loading-mark{background:linear-gradient(135deg,var(--theme-primary),var(--theme-bright))!important;color:var(--theme-on-primary)!important;box-shadow:0 10px 28px color-mix(in srgb,var(--theme-primary) 24%,transparent)!important}
      html[data-skynet-theme] .workspace-nav-label{color:var(--theme-faint)!important}
      html[data-skynet-theme] .workspace-nav-link{color:var(--theme-muted)!important}
      html[data-skynet-theme] .workspace-nav-link:hover{color:var(--theme-text)!important;background:color-mix(in srgb,var(--theme-primary) 8%,transparent)!important;border-color:color-mix(in srgb,var(--theme-primary) 14%,transparent)!important}
      html[data-skynet-theme] .workspace-nav-link.active{color:var(--theme-text)!important;background:linear-gradient(90deg,color-mix(in srgb,var(--theme-primary) 20%,transparent),color-mix(in srgb,var(--theme-primary) 5%,transparent))!important;border-color:color-mix(in srgb,var(--theme-primary) 25%,transparent)!important;box-shadow:inset 3px 0 0 var(--theme-primary)!important}
      html[data-skynet-theme] .workspace-sidebar-footer{border-color:var(--theme-border-soft)!important}
      html[data-skynet-theme] .workspace-profile-avatar,html[data-skynet-theme] .social-avatar-img,html[data-skynet-theme] .social-avatar-fallback{background:color-mix(in srgb,var(--theme-primary) 12%,var(--theme-field))!important;border-color:color-mix(in srgb,var(--theme-primary) 28%,var(--theme-border))!important;color:var(--theme-bright)!important}
      html[data-skynet-theme] .workspace-kicker,html[data-skynet-theme] .eyebrow,html[data-skynet-theme] .profile-v3-handle{color:var(--theme-glow)!important}
      html[data-skynet-theme] .workspace-user-chip{background:color-mix(in srgb,var(--theme-panel) 85%,transparent)!important;border-color:var(--theme-border-soft)!important;color:var(--theme-muted)!important}
      html[data-skynet-theme] .workspace-heading p,html[data-skynet-theme] .muted,html[data-skynet-theme] .hint{color:var(--theme-muted)!important}
      html[data-skynet-theme] .profile-v3-preview{background:linear-gradient(145deg,var(--theme-panel),var(--theme-bg))!important;border-color:color-mix(in srgb,var(--theme-primary) 28%,var(--theme-border-soft))!important}
      html[data-skynet-theme] .profile-v3-preview-bg{background:radial-gradient(circle at 20% 20%,color-mix(in srgb,var(--profile-accent,var(--theme-primary)) 28%,transparent),transparent 44%),linear-gradient(135deg,var(--theme-panel),var(--theme-bg))!important}
      html[data-skynet-theme] .profile-v3-summary-card,html[data-skynet-theme] .profile-v3-tabs{background:color-mix(in srgb,var(--theme-panel) 88%,transparent)!important;border-color:color-mix(in srgb,var(--theme-primary) 16%,var(--theme-border-soft))!important}
      html[data-skynet-theme] .profile-v3-tab{color:var(--theme-muted)!important}
      html[data-skynet-theme] .profile-v3-tab.active{background:linear-gradient(135deg,color-mix(in srgb,var(--theme-primary) 22%,transparent),color-mix(in srgb,var(--theme-bright) 7%,transparent))!important;color:var(--theme-text)!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--theme-primary) 24%,transparent)!important}
      html[data-skynet-theme] .profile-v3-choice:has(input:checked),html[data-skynet-theme] .ui-preference-item:has(input:checked){border-color:color-mix(in srgb,var(--theme-primary) 45%,var(--theme-border))!important;background:color-mix(in srgb,var(--theme-primary) 9%,var(--theme-field))!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-primary) 12%,transparent),0 0 22px color-mix(in srgb,var(--theme-primary) 8%,transparent)!important}
      html[data-skynet-theme] .profile-v3-store-filter button.active{color:var(--theme-text)!important;border-color:color-mix(in srgb,var(--theme-primary) 40%,var(--theme-border))!important;background:color-mix(in srgb,var(--theme-primary) 13%,var(--theme-field))!important}
      html[data-skynet-theme] .chat-conversation:hover,html[data-skynet-theme] .chat-conversation.active{background:color-mix(in srgb,var(--theme-primary) 9%,transparent)!important}
      html[data-skynet-theme] .chat-bubble.mine{background:color-mix(in srgb,var(--theme-primary) 16%,var(--theme-field))!important;border-color:color-mix(in srgb,var(--theme-primary) 24%,var(--theme-border))!important}
      html[data-skynet-theme] .chat-unread{background:var(--theme-primary)!important;color:var(--theme-on-primary)!important}
      html[data-skynet-theme] .leaderboard-row:hover{background:color-mix(in srgb,var(--theme-primary) 6%,transparent)!important}
      html[data-skynet-theme] .tabs .tab.active{color:var(--theme-bright)!important;border-bottom-color:var(--theme-primary)!important}
      html[data-skynet-theme] .card-title{color:var(--theme-bright)!important}html[data-skynet-theme] .card-title::before{background:var(--theme-glow)!important;box-shadow:0 0 8px var(--theme-glow)!important}
      html[data-skynet-theme] .hero h1{background:linear-gradient(135deg,var(--theme-primary),var(--theme-bright))!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}
      html[data-skynet-theme] .public-profile{--profile-accent:var(--theme-primary)}
      .theme-v1-card{margin-top:16px}.theme-v1-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.theme-v1-head h3{margin:0 0 4px}.theme-v1-presets{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:14px}.theme-v1-choice{position:relative;display:grid;gap:7px;padding:10px;border:1px solid var(--theme-border-soft,var(--border-soft));border-radius:13px;background:var(--theme-field,var(--bg-field));cursor:pointer;color:var(--theme-muted,var(--text-muted));text-align:left}.theme-v1-choice.active{border-color:var(--theme-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--theme-primary) 20%,transparent);color:var(--theme-text)}.theme-v1-swatch{height:42px;border-radius:9px;background:linear-gradient(135deg,var(--swatch-a),var(--swatch-b));border:1px solid rgba(255,255,255,.12)}.theme-v1-choice strong{font-size:10px}.theme-v1-custom{display:grid;grid-template-columns:minmax(150px,240px) auto;gap:9px;align-items:end;margin-top:12px}.theme-v1-custom input{height:42px}.theme-v1-note{margin-top:10px;font-size:9px;color:var(--theme-faint)}
      @media(max-width:900px){.theme-v1-presets{grid-template-columns:repeat(3,1fr)}}@media(max-width:520px){.theme-v1-presets{grid-template-columns:repeat(2,1fr)}.theme-v1-custom{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function boot() {
    const path = location.pathname.replace(/\/+$/,'') || '/';
    if (path.startsWith('/u/')) {
      const username = decodeURIComponent(path.split('/').filter(Boolean)[1] || '');
      if (!username) return;
      try {
        const data = await S.api(`/api/profile-theme/${encodeURIComponent(username)}`);
        applyTheme(data.theme, false);
      } catch {}
      return;
    }
    if (!path.startsWith('/painel') || ['/painel/login','/painel/cadastro'].includes(path)) return;
    try {
      const data = await S.api('/api/profile-theme/me');
      applyTheme(data.theme, true);
    } catch {}
    if (path === '/painel/perfil') watchProfileEditor();
  }

  function palette(theme) {
    const preset = String(theme?.preset || 'violet').toLowerCase();
    if (PRESETS[preset]) return { preset, ...PRESETS[preset], accent:PRESETS[preset].accent };
    const accent = validHex(theme?.accent) ? theme.accent.toLowerCase() : '#a855f7';
    return customPalette(accent);
  }

  function customPalette(accent) {
    const mix = (a,b,t) => {
      const A=hexRgb(a),B=hexRgb(b); return rgbHex(Math.round(A.r+(B.r-A.r)*t),Math.round(A.g+(B.g-A.g)*t),Math.round(A.b+(B.b-A.b)*t));
    };
    return {preset:'custom',name:'Personalizado',accent,bg:mix('#07080b',accent,.055),panel:mix('#111318',accent,.09),field:mix('#1a1d24',accent,.13),border:mix('#343842',accent,.22),soft:mix('#282c34',accent,.16),bright:mix(accent,'#ffffff',.35),glow:mix(accent,'#ffffff',.58),text:'#f7f7fa',muted:mix('#a9abb2',accent,.10),faint:mix('#747780',accent,.10),on:luminance(accent)>.62?'#07080b':'#ffffff'};
  }

  function applyTheme(theme, cache) {
    const p = theme?.preset === 'custom' ? customPalette(validHex(theme?.accent) ? theme.accent : '#a855f7') : palette(theme);
    current = { preset:p.preset, accent:p.accent };
    const root = document.documentElement;
    root.dataset.skynetTheme = p.preset;
    const vars = {
      '--theme-bg':p.bg,'--theme-panel':p.panel,'--theme-field':p.field,'--theme-border':p.border,'--theme-border-soft':p.soft,'--theme-primary':p.accent,'--theme-bright':p.bright,'--theme-glow':p.glow,'--theme-text':p.text,'--theme-muted':p.muted,'--theme-faint':p.faint,'--theme-on-primary':p.on,
      '--bg-void':p.bg,'--bg-panel':p.panel,'--bg-field':p.field,'--border':p.border,'--border-soft':p.soft,'--violet':p.accent,'--violet-bright':p.bright,'--violet-glow':p.glow,'--text':p.text,'--text-muted':p.muted,'--text-faint':p.faint,'--accent':p.accent,'--accent-2':p.bright
    };
    for (const [key,value] of Object.entries(vars)) root.style.setProperty(key,value);
    root.style.setProperty('--theme-primary-rgb', `${hexRgb(p.accent).r},${hexRgb(p.accent).g},${hexRgb(p.accent).b}`);
    if (cache) try { localStorage.setItem(CACHE_KEY, JSON.stringify(current)); } catch {}
    syncPublicProfileAccent(p.accent);
    refreshThemeUi();
    window.dispatchEvent(new CustomEvent('skynet:theme-changed',{detail:{theme:current,palette:p}}));
  }

  function applyCached() {
    if (!location.pathname.startsWith('/painel') || ['/painel/login','/painel/cadastro'].includes(location.pathname)) return;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached) applyTheme(cached,false);
    } catch {}
  }

  function syncPublicProfileAccent(accent) {
    const apply = () => document.querySelectorAll('.public-profile').forEach(node => node.style.setProperty('--profile-accent',accent));
    apply();
    if (!location.pathname.startsWith('/u/')) return;
    requestAnimationFrame(apply);
    setTimeout(apply,400);
  }

  function watchProfileEditor() {
    const inject = () => {
      if (injecting || document.getElementById('themeV1Card')) return;
      const shell = document.querySelector('.profile-v3-shell');
      if (!shell) return;
      injecting = true;
      const card = document.createElement('section');
      card.id = 'themeV1Card';
      card.className = 'profile-v3-card theme-v1-card';
      card.innerHTML = themeCardMarkup();
      const tabs = shell.querySelector('.profile-v3-tabs');
      if (tabs) tabs.insertAdjacentElement('beforebegin',card); else shell.appendChild(card);
      bindThemeCard(card);
      injecting = false;
    };
    inject();
    let raf=0;
    new MutationObserver(() => { if (!raf) raf=requestAnimationFrame(()=>{raf=0;inject();}); }).observe(document.getElementById('workspaceContent') || document.documentElement,{childList:true,subtree:true});
  }

  function themeCardMarkup() {
    const choices = Object.entries(PRESETS).map(([id,p]) => `<button class="theme-v1-choice ${current?.preset===id?'active':''}" type="button" data-theme-preset="${id}"><span class="theme-v1-swatch" style="--swatch-a:${p.bg};--swatch-b:${p.accent}"></span><strong>${p.name}</strong></button>`).join('');
    return `<div class="theme-v1-head"><div><h3>Tema do site</h3><div class="hint">Troca a paleta inteira do painel e também a aparência pública do seu perfil.</div></div><span class="badge active">Conta</span></div><div class="message" id="themeV1Message"></div><div class="theme-v1-presets">${choices}</div><div class="theme-v1-custom"><div class="form-group" style="margin:0"><label>Cor personalizada</label><input id="themeV1CustomColor" type="color" value="${validHex(current?.accent)?current.accent:'#a855f7'}"></div><button class="button" id="themeV1UseCustom" type="button">Usar cor personalizada</button></div><div class="theme-v1-note">O tema é salvo na sua conta. A cor principal também é sincronizada com o destaque do perfil/pódio.</div>`;
  }

  function bindThemeCard(card) {
    card.querySelectorAll('[data-theme-preset]').forEach(button => button.addEventListener('click', () => saveTheme({preset:button.dataset.themePreset,accent:PRESETS[button.dataset.themePreset]?.accent || '#a855f7'},card)));
    card.querySelector('#themeV1UseCustom')?.addEventListener('click', () => {
      const accent = card.querySelector('#themeV1CustomColor')?.value || '#a855f7';
      saveTheme({preset:'custom',accent},card);
    });
  }

  async function saveTheme(theme, card) {
    const message = card?.querySelector('#themeV1Message');
    try {
      const saved = await S.api('/api/profile-theme/me',{method:'PATCH',body:theme});
      applyTheme(saved.theme,true);
      await syncLegacyProfileAccent(saved.theme.accent).catch(()=>{});
      if (message) S.message(message,'Tema aplicado em todo o site e no perfil.','success');
    } catch (error) {
      if (message) S.message(message,error.message || 'Não foi possível salvar o tema.','error');
    }
  }

  async function syncLegacyProfileAccent(accent) {
    const data = await S.api('/api/community/profile/me');
    const c = data.custom || {};
    const body = { headline:c.headline || '', style:c.style || 'clean', accent, bannerUploadId:c.bannerUploadId || '', showXp:c.showXp !== false, showJoinDate:c.showJoinDate !== false, showFriendCount:c.showFriendCount !== false };
    await S.api('/api/community/profile/me',{method:'PATCH',body});
  }

  function refreshThemeUi() {
    document.querySelectorAll('[data-theme-preset]').forEach(button => button.classList.toggle('active',button.dataset.themePreset===current?.preset));
    const color = document.getElementById('themeV1CustomColor');
    if (color && validHex(current?.accent)) color.value=current.accent;
  }

  function validHex(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '')); }
  function hexRgb(hex) { const v=String(hex).replace('#',''); return {r:parseInt(v.slice(0,2),16)||0,g:parseInt(v.slice(2,4),16)||0,b:parseInt(v.slice(4,6),16)||0}; }
  function rgbHex(r,g,b) { return `#${[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('')}`; }
  function luminance(hex) { const {r,g,b}=hexRgb(hex); const a=[r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*a[0]+.7152*a[1]+.0722*a[2]; }
})();
