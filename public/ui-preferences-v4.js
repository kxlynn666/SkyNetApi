(() => {
    if (window.__SKYNET_UI_PREFERENCES_V4__) return;
    window.__SKYNET_UI_PREFERENCES_V4__ = true;

    const KEY = 'skynet_ui_preferences_v4';
    const MUSIC_KEY = 'skynet_music_ui_v4';

    function read() {
        const defaults = {
            reduceEffects: false,
            musicCompact: window.matchMedia?.('(max-width:520px)').matches || false,
            iconDock: window.matchMedia?.('(max-width:430px)').matches || false
        };
        try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
        catch { return defaults; }
    }

    let state = read();

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
        apply();
    }

    function apply() {
        document.documentElement.classList.toggle('skynet-reduce-effects', Boolean(state.reduceEffects));
        document.documentElement.classList.toggle('skynet-icon-dock', Boolean(state.iconDock));

        try {
            const music = { mini: false, previousVolume: .6, ...JSON.parse(localStorage.getItem(MUSIC_KEY) || '{}') };
            music.mini = Boolean(state.musicCompact);
            localStorage.setItem(MUSIC_KEY, JSON.stringify(music));
        } catch {}
        document.getElementById('skynetMusicBar')?.classList.toggle('music-ui-mini', Boolean(state.musicCompact));
    }

    function injectPreferences() {
        if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;
        const root = document.getElementById('workspaceContent');
        if (!root?.dataset.profileV3 || root.querySelector('#uiPreferencesV4')) return;

        const card = document.createElement('section');
        card.id = 'uiPreferencesV4';
        card.className = 'profile-v3-card ui-preferences-v4';
        card.innerHTML = `
            <div class="ui-preferences-head">
                <div><h3>Preferências da interface</h3><div class="hint">Ajustes salvos somente neste dispositivo.</div></div>
            </div>
            <div class="ui-preferences-grid">
                ${toggle('reduceEffects','Reduzir efeitos','Desativa animações cosméticas e blur pesado. Melhor para celulares básicos.',state.reduceEffects,'spark')}
                ${toggle('musicCompact','Player compacto','Mantém o player pequeno no celular até você abrir os controles.',state.musicCompact,'music')}
                ${toggle('iconDock','Dock por ícones','Prioriza os ícones na navegação inferior e reduz textos.',state.iconDock,'grid')}
            </div>`;
        root.appendChild(card);

        card.querySelectorAll('input[data-ui-pref]').forEach(input => input.addEventListener('change', () => {
            state[input.dataset.uiPref] = input.checked;
            save();
        }));
    }

    function toggle(name,title,description,checked,icon) {
        return `<label class="ui-preference-item"><input type="checkbox" data-ui-pref="${name}" ${checked ? 'checked' : ''}><span class="ui-preference-symbol" data-pref-symbol="${icon}" aria-hidden="true"></span><span class="ui-preference-copy"><strong>${title}</strong><span>${description}</span></span><span class="ui-preference-switch" aria-hidden="true"></span></label>`;
    }

    const style = document.createElement('style');
    style.id = 'uiPreferencesV4Styles';
    style.textContent = `
      .ui-preferences-v4{margin-top:16px}.ui-preferences-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ui-preferences-head h3{margin:0 0 4px}.ui-preferences-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:14px}.ui-preference-item{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr) 34px;gap:9px;align-items:center;padding:11px;border:1px solid var(--border-soft);border-radius:13px;background:rgba(30,22,56,.38);cursor:pointer}.ui-preference-item>input{position:absolute;opacity:0;pointer-events:none}.ui-preference-symbol{width:34px;height:34px;border-radius:10px;background:linear-gradient(145deg,rgba(139,92,246,.15),rgba(34,211,238,.06));border:1px solid rgba(139,92,246,.16)}.ui-preference-copy strong,.ui-preference-copy span{display:block}.ui-preference-copy strong{font-size:11px}.ui-preference-copy span{font-size:9px;line-height:1.4;color:var(--text-faint);margin-top:2px}.ui-preference-switch{width:32px;height:18px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid var(--border);position:relative}.ui-preference-switch::after{content:"";position:absolute;width:12px;height:12px;left:2px;top:2px;border-radius:50%;background:#8f82a8;transition:.16s ease}.ui-preference-item:has(input:checked){border-color:rgba(139,92,246,.30);background:rgba(139,92,246,.07)}.ui-preference-item:has(input:checked) .ui-preference-switch{background:linear-gradient(90deg,#7c3aed,#38bdf8)}.ui-preference-item:has(input:checked) .ui-preference-switch::after{transform:translateX(14px);background:white}
      html.skynet-reduce-effects .profile-surface::before,html.skynet-reduce-effects .profile-surface::after,html.skynet-reduce-effects .cosmetic-avatar::before,html.skynet-reduce-effects .cosmetic-avatar::after,html.skynet-reduce-effects .profile-tag{animation:none!important;transition:none!important}html.skynet-reduce-effects .profile-surface::before,html.skynet-reduce-effects .profile-surface::after{filter:none!important}html.skynet-reduce-effects .workspace-card,html.skynet-reduce-effects .skynet-music-bar{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      @media(max-width:760px){.ui-preferences-grid{grid-template-columns:1fr}}
      @media(max-width:520px){html.skynet-icon-dock .workspace-mobile-dock-item span{display:none!important}html.skynet-icon-dock .workspace-mobile-dock-item svg{width:22px!important;height:22px!important}.ui-preferences-v4{margin-top:12px}.ui-preference-item{grid-template-columns:32px minmax(0,1fr) 34px;padding:10px}}
    `;
    document.head.appendChild(style);

    apply();
    injectPreferences();
    const observer = new MutationObserver(() => injectPreferences());
    observer.observe(document.documentElement, { childList:true, subtree:true });
})();
