(() => {
    if (document.getElementById('skynetMusicBar')) return;
    const STORAGE = 'skynet_music_state_v2';
    const CHANNEL = 'skynet_music_v2';
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
    let popup = null;
    let library = [];
    let state = readState();

    function readState() {
        try { return { mode: 'lofi', trackId: null, playing: false, volume: .6, shuffle: false, repeat: false, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') }; }
        catch { return { mode: 'lofi', trackId: null, playing: false, volume: .6, shuffle: false, repeat: false }; }
    }
    function saveState() { localStorage.setItem(STORAGE, JSON.stringify(state)); render(); }
    function send(command, extra = {}) { channel?.postMessage({ type: 'command', command, ...extra }); }

    const style = document.createElement('style');
    style.textContent = `
      .skynet-music-bar{position:fixed;left:18px;right:18px;bottom:18px;z-index:1400;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:12px 14px;border:1px solid rgba(168,85,247,.28);border-radius:16px;background:rgba(10,10,17,.94);backdrop-filter:blur(16px);box-shadow:0 18px 50px rgba(0,0,0,.35)}
      .skynet-music-copy{min-width:0}.skynet-music-copy strong,.skynet-music-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.skynet-music-copy span{font-size:11px;color:var(--muted)}
      .skynet-music-controls{display:flex;gap:7px;align-items:center}.skynet-music-controls button{min-width:38px}.skynet-music-source{max-width:260px}
      body{padding-bottom:92px}@media(max-width:760px){.skynet-music-bar{grid-template-columns:1fr auto;left:10px;right:10px;bottom:10px}.skynet-music-source{grid-column:1/-1;max-width:none}.skynet-music-controls .music-secondary{display:none}}
    `;
    document.head.appendChild(style);

    const bar = document.createElement('div');
    bar.className = 'skynet-music-bar'; bar.id = 'skynetMusicBar';
    bar.innerHTML = `<div class="skynet-music-copy"><strong id="musicNowTitle">SkyNet Lo-fi Radio</strong><span id="musicNowArtist">Gerado localmente no navegador</span></div><select id="musicSource" class="skynet-music-source"><option value="lofi">SkyNet Lo-fi Radio</option></select><div class="skynet-music-controls"><button class="button small music-secondary" id="musicPrev" type="button">Anterior</button><button class="button small primary" id="musicPlay" type="button">Tocar</button><button class="button small music-secondary" id="musicNext" type="button">Próxima</button><button class="button small" id="musicOpen" type="button">Player</button></div>`;
    document.body.appendChild(bar);

    async function loadLibrary() {
        try {
            const res = await fetch('/api/music/library', { credentials: 'same-origin' });
            const data = await res.json();
            library = data.tracks || [];
            const select = document.getElementById('musicSource');
            select.innerHTML = `<option value="lofi">SkyNet Lo-fi Radio</option>${library.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)} — ${escapeHtml(t.artist)}</option>`).join('')}`;
            select.value = state.mode === 'track' && state.trackId ? state.trackId : 'lofi';
            render();
        } catch {}
    }
    function escapeHtml(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
    function selectedTrack() { return library.find(t => t.id === state.trackId) || null; }
    function render() {
        const t = selectedTrack();
        document.getElementById('musicNowTitle').textContent = state.mode === 'lofi' ? 'SkyNet Lo-fi Radio' : (t?.title || 'Faixa');
        document.getElementById('musicNowArtist').textContent = state.mode === 'lofi' ? 'Gerado localmente no navegador' : (t?.artist || 'SkyNetApi');
        document.getElementById('musicPlay').textContent = state.playing ? 'Pausar' : 'Tocar';
    }
    function openPlayer(andPlay = false) {
        popup = window.open('/music-popup.html', 'SkyNetMusicPlayer', 'width=460,height=680,resizable=yes,scrollbars=no');
        if (!popup) return alert('O navegador bloqueou o player. Permita pop-ups para este site.');
        popup.focus();
        if (andPlay) setTimeout(() => send('play'), 500);
    }

    document.getElementById('musicPlay').addEventListener('click', () => {
        if (!popup || popup.closed) return openPlayer(true);
        send(state.playing ? 'pause' : 'play');
    });
    document.getElementById('musicOpen').addEventListener('click', () => openPlayer(false));
    document.getElementById('musicPrev').addEventListener('click', () => { if (!popup || popup.closed) openPlayer(false); setTimeout(() => send('prev'), 100); });
    document.getElementById('musicNext').addEventListener('click', () => { if (!popup || popup.closed) openPlayer(false); setTimeout(() => send('next'), 100); });
    document.getElementById('musicSource').addEventListener('change', event => {
        if (event.target.value === 'lofi') state = { ...state, mode: 'lofi', trackId: null };
        else state = { ...state, mode: 'track', trackId: event.target.value };
        saveState();
        if (!popup || popup.closed) openPlayer(false);
        setTimeout(() => send('load', { state }), 150);
    });

    channel?.addEventListener('message', event => {
        if (event.data?.type !== 'state') return;
        state = { ...state, ...event.data.state };
        saveState();
    });
    window.addEventListener('storage', event => { if (event.key === STORAGE) { state = readState(); render(); } });
    loadLibrary(); render();
})();
