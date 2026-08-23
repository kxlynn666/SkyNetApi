(() => {
    const STORAGE = 'skynet_music_state_v2';
    const CHANNEL = 'skynet_music_v2';
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
    const audio = new Audio();
    audio.preload = 'metadata';
    let library = [];
    let state = readState();
    let ctx = null;
    let master = null;
    let scheduler = null;
    let nextBeatTime = 0;
    let beat = 0;
    let noiseBuffer = null;

    function readState() {
        try { return { mode: 'lofi', trackId: null, playing: false, volume: .6, shuffle: false, repeat: false, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') }; }
        catch { return { mode: 'lofi', trackId: null, playing: false, volume: .6, shuffle: false, repeat: false }; }
    }
    function saveState() {
        localStorage.setItem(STORAGE, JSON.stringify(state));
        channel?.postMessage({ type: 'state', state });
        render();
    }
    function selectedTrack() { return library.find(track => track.id === state.trackId) || null; }

    async function loadLibrary() {
        try {
            const response = await fetch('/api/music/library', { credentials: 'same-origin' });
            const data = await response.json();
            library = data.tracks || [];
            if (state.mode === 'track' && !selectedTrack()) state = { ...state, mode: 'lofi', trackId: null, playing: false };
            renderLibrary(); render();
        } catch { document.getElementById('musicLibrary').innerHTML = '<div class="empty">Não foi possível carregar a biblioteca.</div>'; }
    }

    function renderLibrary() {
        const root = document.getElementById('musicLibrary');
        const rows = [{ id: 'lofi', title: 'SkyNet Lo-fi Radio', artist: 'Gerado localmente' }, ...library];
        root.innerHTML = rows.map(track => {
            const active = state.mode === 'lofi' ? track.id === 'lofi' : track.id === state.trackId;
            return `<button class="music-track ${active ? 'active' : ''}" data-track="${escapeHtml(track.id)}" type="button"><div><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist || 'SkyNetApi')}</span></div></button>`;
        }).join('');
        root.querySelectorAll('[data-track]').forEach(button => button.addEventListener('click', async () => {
            const id = button.dataset.track;
            await stopCurrent(false);
            state = id === 'lofi' ? { ...state, mode: 'lofi', trackId: null } : { ...state, mode: 'track', trackId: id };
            saveState(); renderLibrary();
            await play();
        }));
    }
    function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }

    async function ensureLofi() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 5200; filter.Q.value = .25;
            master.gain.value = state.volume;
            master.connect(filter).connect(ctx.destination);
            noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .45;
            addVinylNoise();
        }
        master.gain.setTargetAtTime(state.volume, ctx.currentTime, .03);
        if (ctx.state === 'suspended') await ctx.resume();
        if (!scheduler) {
            nextBeatTime = ctx.currentTime + .08; beat = 0;
            scheduler = setInterval(scheduleLoop, 70);
        }
    }

    function scheduleLoop() {
        if (!ctx || ctx.state !== 'running') return;
        const beatSeconds = 60 / 72;
        while (nextBeatTime < ctx.currentTime + .22) {
            scheduleBeat(nextBeatTime, beat);
            nextBeatTime += beatSeconds / 2;
            beat = (beat + 1) % 32;
        }
    }
    function scheduleBeat(time, step) {
        const halfBeat = step % 2 === 0;
        if (step % 8 === 0) playChord(time, Math.floor(step / 8));
        if (step % 4 === 0) kick(time);
        if (step % 8 === 4) snare(time);
        if (halfBeat) hat(time, step % 4 === 0 ? .025 : .014);
    }
    function playChord(time, index) {
        const progression = [
            [220,261.63,329.63,392],
            [174.61,220,261.63,329.63],
            [130.81,164.81,196,246.94],
            [196,246.94,293.66,329.63]
        ];
        for (const freq of progression[index % progression.length]) {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.0001, time); gain.gain.exponentialRampToValueAtTime(.035, time + .08); gain.gain.exponentialRampToValueAtTime(.0001, time + 2.8);
            osc.connect(gain).connect(master); osc.start(time); osc.stop(time + 3);
        }
    }
    function kick(time) {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.frequency.setValueAtTime(110, time); osc.frequency.exponentialRampToValueAtTime(48, time + .12);
        gain.gain.setValueAtTime(.22, time); gain.gain.exponentialRampToValueAtTime(.0001, time + .18);
        osc.connect(gain).connect(master); osc.start(time); osc.stop(time + .2);
    }
    function snare(time) {
        const src = ctx.createBufferSource(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain();
        src.buffer = noiseBuffer; filter.type = 'highpass'; filter.frequency.value = 1000;
        gain.gain.setValueAtTime(.08, time); gain.gain.exponentialRampToValueAtTime(.0001, time + .16);
        src.connect(filter).connect(gain).connect(master); src.start(time); src.stop(time + .18);
    }
    function hat(time, volume) {
        const src = ctx.createBufferSource(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain();
        src.buffer = noiseBuffer; filter.type = 'highpass'; filter.frequency.value = 5200;
        gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.0001, time + .05);
        src.connect(filter).connect(gain).connect(master); src.start(time); src.stop(time + .06);
    }
    function addVinylNoise() {
        const src = ctx.createBufferSource(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain();
        src.buffer = noiseBuffer; src.loop = true; filter.type = 'bandpass'; filter.frequency.value = 2600; filter.Q.value = .35; gain.gain.value = .008;
        src.connect(filter).connect(gain).connect(master); src.start();
    }

    async function play() {
        if (state.mode === 'lofi') {
            audio.pause();
            await ensureLofi();
            state.playing = true; saveState(); return;
        }
        stopLofi();
        const track = selectedTrack(); if (!track) return;
        if (audio.src !== new URL(track.url, location.href).href) audio.src = track.url;
        audio.volume = state.volume;
        try { await audio.play(); state.playing = true; saveState(); }
        catch { state.playing = false; saveState(); }
    }
    function pause() {
        if (state.mode === 'lofi') { if (ctx?.state === 'running') ctx.suspend(); }
        else audio.pause();
        state.playing = false; saveState();
    }
    async function stopCurrent(update = true) {
        audio.pause(); audio.removeAttribute('src'); audio.load(); stopLofi(); state.playing = false; if (update) saveState();
    }
    function stopLofi() { if (scheduler) { clearInterval(scheduler); scheduler = null; } if (ctx?.state === 'running') ctx.suspend(); }

    async function step(direction) {
        if (!library.length) { state = { ...state, mode: 'lofi', trackId: null }; saveState(); renderLibrary(); return play(); }
        let index = state.mode === 'track' ? library.findIndex(t => t.id === state.trackId) : -1;
        if (state.shuffle) index = Math.floor(Math.random() * library.length);
        else index = (index + direction + library.length) % library.length;
        await stopCurrent(false);
        state = { ...state, mode: 'track', trackId: library[index].id };
        saveState(); renderLibrary(); return play();
    }

    audio.addEventListener('ended', () => { if (state.repeat) { audio.currentTime = 0; play(); } else step(1); });
    audio.addEventListener('play', () => { state.playing = true; saveState(); });
    audio.addEventListener('pause', () => { if (state.mode === 'track') { state.playing = false; saveState(); } });

    function render() {
        const t = selectedTrack();
        document.getElementById('musicTitle').textContent = state.mode === 'lofi' ? 'SkyNet Lo-fi Radio' : (t?.title || 'Faixa');
        document.getElementById('musicArtist').textContent = state.mode === 'lofi' ? 'Gerado localmente' : (t?.artist || 'SkyNetApi');
        document.getElementById('playButton').textContent = state.playing ? 'Pausar' : 'Tocar';
        document.getElementById('musicDisc').classList.toggle('playing', state.playing);
        document.getElementById('volumeInput').value = String(state.volume);
        document.getElementById('volumeValue').textContent = `${Math.round(state.volume * 100)}%`;
        document.getElementById('shuffleButton').textContent = `Shuffle: ${state.shuffle ? 'on' : 'off'}`;
        document.getElementById('repeatButton').textContent = `Repeat: ${state.repeat ? 'on' : 'off'}`;
    }

    document.getElementById('playButton').addEventListener('click', () => state.playing ? pause() : play());
    document.getElementById('prevButton').addEventListener('click', () => step(-1));
    document.getElementById('nextButton').addEventListener('click', () => step(1));
    document.getElementById('shuffleButton').addEventListener('click', () => { state.shuffle = !state.shuffle; saveState(); });
    document.getElementById('repeatButton').addEventListener('click', () => { state.repeat = !state.repeat; saveState(); });
    document.getElementById('volumeInput').addEventListener('input', event => {
        state.volume = Math.max(0, Math.min(1, Number(event.target.value) || 0)); audio.volume = state.volume;
        if (master && ctx) master.gain.setTargetAtTime(state.volume, ctx.currentTime, .03);
        saveState();
    });

    channel?.addEventListener('message', async event => {
        const msg = event.data; if (msg?.type !== 'command') return;
        if (msg.command === 'play') await play();
        if (msg.command === 'pause') pause();
        if (msg.command === 'next') await step(1);
        if (msg.command === 'prev') await step(-1);
        if (msg.command === 'load' && msg.state) { await stopCurrent(false); state = { ...state, ...msg.state, playing: false }; saveState(); renderLibrary(); }
    });

    window.addEventListener('beforeunload', () => { state.playing = false; localStorage.setItem(STORAGE, JSON.stringify(state)); channel?.postMessage({ type: 'state', state }); });
    loadLibrary().then(() => { state.playing = false; saveState(); });
})();
