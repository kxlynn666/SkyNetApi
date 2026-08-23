(() => {
    const STORAGE_KEY = 'skynet.spotify.player';
    const CHANNEL_NAME = 'skynet-spotify-player';
    const root = document.getElementById('spotifyPopupRoot');
    const status = document.getElementById('spotifyPopupStatus');
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    let currentUrl = '';

    function readState() {
        try {
            const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return state && state.embedUrl ? state : null;
        } catch { return null; }
    }

    function render(state) {
        if (!state?.embedUrl) return;
        if (state.embedUrl === currentUrl && root.querySelector('iframe')) return;
        currentUrl = state.embedUrl;
        root.innerHTML = '';
        const frame = document.createElement('iframe');
        frame.className = 'frame';
        frame.title = 'Spotify';
        frame.src = state.embedUrl;
        frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        frame.loading = 'eager';
        root.appendChild(frame);
        status.textContent = `${labelType(state.type)} carregado`;
        channel?.postMessage({ type: 'loaded', state });
    }

    function labelType(type) {
        return ({ track:'Música', album:'Álbum', playlist:'Playlist', artist:'Artista', show:'Podcast', episode:'Episódio' })[type] || 'Spotify';
    }

    channel?.addEventListener('message', event => {
        if (event.data?.type === 'load' && event.data.state) render(event.data.state);
    });

    window.addEventListener('storage', event => {
        if (event.key === STORAGE_KEY) render(readState());
    });

    document.getElementById('spotifyPopupClose').addEventListener('click', () => window.close());

    const initial = readState();
    if (initial) render(initial);

    const pulse = () => channel?.postMessage({ type: 'alive' });
    pulse();
    setInterval(pulse, 2000);
})();
