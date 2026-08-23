(() => {
    if (location.pathname === '/spotify-popup.html') return;

    const STORAGE_KEY = 'skynet.spotify.player';
    const CHANNEL_NAME = 'skynet-spotify-player';
    const ALLOWED_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'show', 'episode']);
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    let popupOnline = false;
    let popupTimer = null;

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function readState() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return data && data.embedUrl ? data : null;
        } catch { return null; }
    }

    function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        channel?.postMessage({ type: 'load', state });
        window.dispatchEvent(new CustomEvent('skynet:spotify-state', { detail: state }));
    }

    function parseSpotify(value) {
        const raw = String(value || '').trim();
        if (!raw) throw new Error('Cole um link ou URI do Spotify.');

        const uri = raw.match(/^spotify:(track|album|playlist|artist|show|episode):([A-Za-z0-9]+)$/i);
        if (uri) return makeState(uri[1].toLowerCase(), uri[2], raw);

        let url;
        try { url = new URL(raw); }
        catch { throw new Error('Link do Spotify inválido.'); }
        if (url.protocol !== 'https:' || !['open.spotify.com', 'www.open.spotify.com'].includes(url.hostname.toLowerCase())) {
            throw new Error('Use um link oficial de open.spotify.com.');
        }

        const parts = url.pathname.split('/').filter(Boolean);
        let typeIndex = parts.findIndex(part => ALLOWED_TYPES.has(part.toLowerCase()));
        if (typeIndex < 0 || !parts[typeIndex + 1]) throw new Error('Esse tipo de link do Spotify não é compatível com o player.');
        const type = parts[typeIndex].toLowerCase();
        const id = String(parts[typeIndex + 1]).replace(/[^A-Za-z0-9]/g, '');
        if (!id) throw new Error('Não foi possível identificar o conteúdo do Spotify.');
        return makeState(type, id, raw);
    }

    function makeState(type, id, source) {
        if (!ALLOWED_TYPES.has(type)) throw new Error('Tipo de conteúdo não suportado.');
        return {
            type,
            id,
            source,
            embedUrl: `https://open.spotify.com/embed/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
            updatedAt: new Date().toISOString()
        };
    }

    function installStyles() {
        if (document.getElementById('spotifyPersistentStyles')) return;
        const style = document.createElement('style');
        style.id = 'spotifyPersistentStyles';
        style.textContent = `
            .spotify-dock{position:fixed;right:18px;bottom:18px;z-index:1600;width:min(390px,calc(100vw - 28px));background:rgba(10,10,17,.94);border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,.46);backdrop-filter:blur(18px);overflow:hidden;color:#f7f7fb;font-family:inherit}.spotify-dock.collapsed .spotify-body{display:none}.spotify-head{display:flex;align-items:center;gap:10px;padding:11px 12px}.spotify-mark{width:34px;height:34px;border-radius:11px;background:#1ed760;color:#07120a;display:grid;place-items:center;font-weight:950}.spotify-title{min-width:0;flex:1}.spotify-title strong,.spotify-title span{display:block}.spotify-title strong{font-size:13px}.spotify-title span{font-size:11px;color:#9898a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.spotify-head button{border:0;background:rgba(255,255,255,.07);color:#eee;border-radius:9px;height:32px;padding:0 10px;cursor:pointer}.spotify-body{padding:0 12px 12px;border-top:1px solid rgba(255,255,255,.08)}.spotify-form{display:flex;gap:7px;padding-top:11px}.spotify-input{min-width:0;flex:1;height:38px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#11111a;color:#fff;padding:0 10px;outline:none}.spotify-input:focus{border-color:rgba(30,215,96,.55)}.spotify-action{height:38px;border:0;border-radius:10px;background:#1ed760;color:#07120a;padding:0 13px;font-weight:800;cursor:pointer}.spotify-secondary{height:36px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.05);color:#eee;padding:0 11px;cursor:pointer}.spotify-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px}.spotify-status{flex:1;font-size:11px;color:#9b9baa}.spotify-status.online{color:#72e99a}.spotify-message{font-size:11px;margin-top:8px;color:#ff9aa8;display:none}.spotify-message.show{display:block}.spotify-inline{margin-top:10px;border-radius:12px;overflow:hidden;display:none}.spotify-inline.show{display:block}.spotify-inline iframe{display:block;width:100%;height:152px;border:0;background:#171717}.spotify-help{font-size:10px;color:#777785;margin-top:8px;line-height:1.45}@media(max-width:620px){.spotify-dock{right:10px;bottom:10px;width:calc(100vw - 20px)}}
        `;
        document.head.appendChild(style);
    }

    function mount() {
        if (document.getElementById('spotifyPersistentDock')) return;
        installStyles();
        const state = readState();
        const dock = document.createElement('aside');
        dock.className = `spotify-dock${localStorage.getItem('skynet.spotify.collapsed') === '1' ? ' collapsed' : ''}`;
        dock.id = 'spotifyPersistentDock';
        dock.innerHTML = `
            <div class="spotify-head">
                <div class="spotify-mark">S</div>
                <div class="spotify-title"><strong>Spotify</strong><span id="spotifyNow">${state ? escapeHtml(`${state.type} carregado`) : 'Nenhum conteúdo carregado'}</span></div>
                <button type="button" id="spotifyCollapse" aria-label="Recolher player">${dock.classList.contains('collapsed') ? 'Abrir' : '—'}</button>
            </div>
            <div class="spotify-body">
                <form class="spotify-form" id="spotifyForm">
                    <input class="spotify-input" id="spotifyInput" placeholder="Link ou URI do Spotify" autocomplete="off" value="${state ? escapeHtml(state.source) : ''}">
                    <button class="spotify-action" type="submit">Tocar</button>
                </form>
                <div class="spotify-row">
                    <button class="spotify-secondary" id="spotifyOpen" type="button">Abrir player fixo</button>
                    <button class="spotify-secondary" id="spotifyInlineButton" type="button">Player nesta página</button>
                    <span class="spotify-status" id="spotifyStatus">Pronto</span>
                </div>
                <div class="spotify-message" id="spotifyMessage"></div>
                <div class="spotify-inline" id="spotifyInline"></div>
                <div class="spotify-help">Aceita música, álbum, playlist, artista, podcast/show e episódio. O player fixo continua aberto mesmo quando você troca de página no SkyNetApi.</div>
            </div>`;
        document.body.appendChild(dock);

        document.getElementById('spotifyCollapse').addEventListener('click', () => {
            dock.classList.toggle('collapsed');
            const collapsed = dock.classList.contains('collapsed');
            localStorage.setItem('skynet.spotify.collapsed', collapsed ? '1' : '0');
            document.getElementById('spotifyCollapse').textContent = collapsed ? 'Abrir' : '—';
        });
        document.getElementById('spotifyForm').addEventListener('submit', event => {
            event.preventDefault();
            try {
                const next = parseSpotify(document.getElementById('spotifyInput').value);
                saveState(next);
                setMessage('');
                updateNow(next);
                openPersistent(next);
            } catch (error) { setMessage(error.message); }
        });
        document.getElementById('spotifyOpen').addEventListener('click', () => {
            const current = readState();
            if (!current) return setMessage('Carregue um link do Spotify primeiro.');
            openPersistent(current);
        });
        document.getElementById('spotifyInlineButton').addEventListener('click', () => {
            const current = readState();
            if (!current) return setMessage('Carregue um link do Spotify primeiro.');
            showInline(current);
        });

        channel?.addEventListener('message', event => {
            if (event.data?.type === 'alive') {
                popupOnline = true;
                document.getElementById('spotifyStatus')?.classList.add('online');
                if (document.getElementById('spotifyStatus')) document.getElementById('spotifyStatus').textContent = 'Player fixo ativo';
                clearTimeout(popupTimer);
                popupTimer = setTimeout(() => {
                    popupOnline = false;
                    const status = document.getElementById('spotifyStatus');
                    if (status) { status.classList.remove('online'); status.textContent = 'Pronto'; }
                }, 4500);
            }
            if (event.data?.type === 'loaded' && event.data.state) updateNow(event.data.state);
        });
    }

    function updateNow(state) {
        const now = document.getElementById('spotifyNow');
        if (now) now.textContent = `${labelType(state.type)} carregado`;
    }

    function labelType(type) {
        return ({ track:'Música', album:'Álbum', playlist:'Playlist', artist:'Artista', show:'Podcast', episode:'Episódio' })[type] || 'Spotify';
    }

    function setMessage(text) {
        const el = document.getElementById('spotifyMessage');
        if (!el) return;
        el.textContent = text || '';
        el.classList.toggle('show', Boolean(text));
    }

    function openPersistent(state) {
        const popup = window.open('/spotify-popup.html', 'skynet_spotify_player', 'popup=yes,width=430,height=650,resizable=yes,scrollbars=no');
        if (!popup) {
            setMessage('O navegador bloqueou a janela do player. Libere pop-ups para este site ou use “Player nesta página”.');
            return showInline(state);
        }
        channel?.postMessage({ type: 'load', state });
        setTimeout(() => channel?.postMessage({ type: 'load', state }), 350);
        setTimeout(() => channel?.postMessage({ type: 'load', state }), 1000);
        document.getElementById('spotifyStatus').textContent = 'Abrindo player fixo...';
    }

    function showInline(state) {
        const root = document.getElementById('spotifyInline');
        if (!root) return;
        root.classList.add('show');
        root.innerHTML = `<iframe title="Spotify" src="${escapeHtml(state.embedUrl)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager"></iframe>`;
    }

    window.addEventListener('storage', event => {
        if (event.key !== STORAGE_KEY) return;
        const state = readState();
        if (state) updateNow(state);
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
})();
