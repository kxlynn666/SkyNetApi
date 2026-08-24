(() => {
    if (window.__SKYNET_MUSIC_POLISH_V4__) return;
    window.__SKYNET_MUSIC_POLISH_V4__ = true;

    const UI_KEY = 'skynet_music_ui_v4';
    const ICONS = {
        prev:'<path d="M18 6 9 12l9 6z"/><path d="M6 6v12"/>',
        next:'<path d="m6 6 9 6-9 6z"/><path d="M18 6v12"/>',
        play:'<path d="m8 5 11 7-11 7z"/>',
        pause:'<path d="M9 5v14M15 5v14"/>',
        sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
        compact:'<path d="M4 9h16M7 15h10"/>',
        expand:'<path d="m8 3-5 5 5 5M16 21l5-5-5-5"/>',
        shuffle:'<path d="M3 7h3c5 0 6 10 12 10h3M18 14l3 3-3 3M3 17h3c2 0 3-.8 4.2-2.4M18 4l3 3-3 3M14 8.5c1-1 2.1-1.5 4-1.5h3"/>',
        repeat:'<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
        volume:'<path d="M11 5 6 9H3v6h3l5 4zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
        mute:'<path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6"/>'
    };

    function readUi() {
        try { return { mini: false, previousVolume: .6, ...JSON.parse(localStorage.getItem(UI_KEY) || '{}') }; }
        catch { return { mini: false, previousVolume: .6 }; }
    }

    function saveUi(state) {
        try { localStorage.setItem(UI_KEY, JSON.stringify(state)); } catch {}
    }

    function icon(name) {
        return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.play}</svg>`;
    }

    function install(bar) {
        if (!bar || bar.dataset.musicPolishV4 === '1') return;
        bar.dataset.musicPolishV4 = '1';
        const ui = readUi();
        bar.classList.toggle('music-ui-mini', Boolean(ui.mini));

        const controls = bar.querySelector('.skynet-music-controls');
        const extras = bar.querySelector('.skynet-music-extra');
        if (!controls || !extras) return;

        const mini = document.createElement('button');
        mini.className = 'button small';
        mini.id = 'musicMini';
        mini.type = 'button';
        mini.dataset.musicIcon = 'compact';
        mini.setAttribute('aria-label', ui.mini ? 'Expandir player' : 'Minimizar player');
        mini.title = ui.mini ? 'Expandir player' : 'Minimizar player';
        mini.innerHTML = icon(ui.mini ? 'expand' : 'compact');
        controls.appendChild(mini);

        const mute = document.createElement('button');
        mute.className = 'button small';
        mute.id = 'musicMute';
        mute.type = 'button';
        mute.dataset.musicIcon = 'volume';
        mute.setAttribute('aria-label', 'Silenciar');
        mute.title = 'Silenciar';
        mute.innerHTML = icon('volume');
        extras.insertBefore(mute, extras.querySelector('.skynet-music-volume'));

        const buttonMap = {
            musicPrev: ['prev', 'Anterior'],
            musicNext: ['next', 'Próxima'],
            musicPlay: ['play', 'Tocar / pausar'],
            musicExpand: ['sliders', 'Abrir controles'],
            musicShuffle: ['shuffle', 'Alternar aleatório'],
            musicRepeat: ['repeat', 'Alternar repetição']
        };
        for (const [id, [name, label]] of Object.entries(buttonMap)) {
            const button = document.getElementById(id);
            if (!button) continue;
            button.dataset.musicIcon = name;
            button.setAttribute('aria-label', label);
            button.title = label;
        }

        mini.addEventListener('click', () => {
            ui.mini = !ui.mini;
            bar.classList.toggle('music-ui-mini', ui.mini);
            mini.innerHTML = icon(ui.mini ? 'expand' : 'compact');
            mini.setAttribute('aria-label', ui.mini ? 'Expandir player' : 'Minimizar player');
            mini.title = ui.mini ? 'Expandir player' : 'Minimizar player';
            saveUi(ui);
            if (ui.mini && bar.classList.contains('expanded')) document.getElementById('musicExpand')?.click();
        });

        mute.addEventListener('click', () => {
            const volume = document.getElementById('musicVolume');
            if (!volume) return;
            const current = Number(volume.value || 0);
            if (current > 0.001) {
                ui.previousVolume = current;
                volume.value = '0';
            } else {
                volume.value = String(Math.max(.05, Math.min(1, Number(ui.previousVolume || .6))));
            }
            volume.dispatchEvent(new Event('input', { bubbles: true }));
            updateMute(mute, Number(volume.value || 0));
            saveUi(ui);
        });

        document.getElementById('musicVolume')?.addEventListener('input', event => {
            const value = Number(event.currentTarget.value || 0);
            if (value > .001) ui.previousVolume = value;
            updateMute(mute, value);
            saveUi(ui);
        });

        updateMute(mute, Number(document.getElementById('musicVolume')?.value || 0));
        installMediaSession();

        const sync = new MutationObserver(() => {
            const play = document.getElementById('musicPlay');
            if (play) play.dataset.musicIcon = /pausar/i.test(play.textContent || '') ? 'pause' : 'play';
        });
        const playButton = document.getElementById('musicPlay');
        if (playButton) sync.observe(playButton, { childList: true, characterData: true, subtree: true });
    }

    function updateMute(button, value) {
        const muted = value <= .001;
        button.dataset.musicIcon = muted ? 'mute' : 'volume';
        button.innerHTML = icon(muted ? 'mute' : 'volume');
        button.setAttribute('aria-label', muted ? 'Restaurar volume' : 'Silenciar');
        button.title = muted ? 'Restaurar volume' : 'Silenciar';
    }

    function installMediaSession() {
        if (!('mediaSession' in navigator)) return;
        const action = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch {} };
        action('play', () => document.getElementById('musicPlay')?.click());
        action('pause', () => document.getElementById('musicPlay')?.click());
        action('previoustrack', () => document.getElementById('musicPrev')?.click());
        action('nexttrack', () => document.getElementById('musicNext')?.click());
    }

    const style = document.createElement('style');
    style.id = 'musicPolishV4Styles';
    style.textContent = `
      .skynet-music-bar{max-width:1180px;margin-inline:auto;border-color:rgba(139,92,246,.24)!important;background:linear-gradient(180deg,rgba(18,11,31,.96),rgba(11,7,19,.96))!important}
      .skynet-music-main{position:relative}.skynet-music-copy strong{color:#f4efff}.skynet-music-copy span{color:#9183ad!important}
      .skynet-music-controls .button,.skynet-music-extra .button{display:inline-flex;align-items:center;gap:6px}
      [data-music-icon]::before{content:"";width:15px;height:15px;display:inline-block;flex:none;background:currentColor;mask-size:contain;mask-position:center;mask-repeat:no-repeat;-webkit-mask-size:contain;-webkit-mask-position:center;-webkit-mask-repeat:no-repeat}
      [data-music-icon="prev"]::before{mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M18 5v14l-9-7 9-7ZM5 5h2v14H5z'/%3E%3C/svg%3E");-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M18 5v14l-9-7 9-7ZM5 5h2v14H5z'/%3E%3C/svg%3E")}
      [data-music-icon="next"]::before{mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M6 5v14l9-7-9-7Zm11 0h2v14h-2z'/%3E%3C/svg%3E");-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M6 5v14l9-7-9-7Zm11 0h2v14h-2z'/%3E%3C/svg%3E")}
      [data-music-icon="play"]::before{mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='m8 5 11 7-11 7V5Z'/%3E%3C/svg%3E");-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='m8 5 11 7-11 7V5Z'/%3E%3C/svg%3E")}
      [data-music-icon="pause"]::before{mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M7 5h4v14H7zm6 0h4v14h-4z'/%3E%3C/svg%3E");-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M7 5h4v14H7zm6 0h4v14h-4z'/%3E%3C/svg%3E")}
      [data-music-icon="sliders"]::before,[data-music-icon="compact"]::before,[data-music-icon="volume"]::before,[data-music-icon="mute"]::before,[data-music-icon="shuffle"]::before,[data-music-icon="repeat"]::before{border-radius:4px;background:currentColor}
      #musicMini svg,#musicMute svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #musicMini::before,#musicMute::before{display:none}
      .skynet-music-progress,.skynet-music-volume{accent-color:#8b5cf6}
      .skynet-music-bar.music-ui-mini{box-shadow:0 12px 38px rgba(0,0,0,.36),0 0 24px rgba(139,92,246,.08)!important}
    `;
    document.head.appendChild(style);

    const tryInstall = () => {
        const bar = document.getElementById('skynetMusicBar');
        if (!bar) return false;
        install(bar);
        return true;
    };
    if (!tryInstall()) {
        const observer = new MutationObserver(() => { if (tryInstall()) observer.disconnect(); });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);
    }
})();
