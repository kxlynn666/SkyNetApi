(() => {
    if (document.getElementById('skynetMusicBar')) return;

    const STORAGE = 'skynet_music_state_v2';
    const audio = new Audio();
    audio.preload = 'metadata';

    let library = [];
    let state = readState();
    let expanded = false;
    let ctx = null;
    let master = null;
    let scheduler = null;
    let nextBeatTime = 0;
    let beat = 0;
    let noiseBuffer = null;
    let lastPositionSave = 0;

    function readState() {
        const base = {
            mode: 'lofi', trackId: null, playing: false, volume: .6,
            shuffle: false, repeat: false, position: 0
        };
        try { return { ...base, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') }; }
        catch { return base; }
    }

    function saveState(renderNow = true) {
        localStorage.setItem(STORAGE, JSON.stringify(state));
        if (renderNow) render();
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    function formatTime(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds) || 0));
        const min = Math.floor(total / 60);
        const sec = String(total % 60).padStart(2, '0');
        return `${min}:${sec}`;
    }

    const style = document.createElement('style');
    style.textContent = `
      .skynet-music-bar{position:fixed;left:18px;right:18px;bottom:18px;z-index:1400;border:1px solid rgba(168,85,247,.28);border-radius:18px;background:rgba(10,10,17,.96);backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(0,0,0,.38);overflow:hidden}
      .skynet-music-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,300px) auto;gap:12px;align-items:center;padding:12px 14px}
      .skynet-music-copy{min-width:0}.skynet-music-copy strong,.skynet-music-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.skynet-music-copy span{font-size:11px;color:var(--muted)}
      .skynet-music-source{width:100%;min-width:0}.skynet-music-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.skynet-music-controls button{min-width:38px}
      .skynet-music-panel{display:none;padding:14px;border-top:1px solid var(--border);grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}.skynet-music-bar.expanded .skynet-music-panel{display:grid}
      .skynet-music-progress-wrap{display:grid;grid-template-columns:auto minmax(120px,1fr) auto;gap:9px;align-items:center}.skynet-music-progress-wrap span{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}.skynet-music-progress{width:100%}
      .skynet-music-extra{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.skynet-music-volume{width:130px}.skynet-music-status{font-size:11px;color:var(--muted);min-width:92px;text-align:right}
      body{padding-bottom:98px}@media(max-width:800px){.skynet-music-bar{left:10px;right:10px;bottom:10px}.skynet-music-main{grid-template-columns:1fr auto}.skynet-music-source{grid-column:1/-1;grid-row:2}.skynet-music-panel{grid-template-columns:1fr}.skynet-music-extra{justify-content:flex-start}.music-secondary{display:none}.skynet-music-status{text-align:left}}
    `;
    document.head.appendChild(style);

    const bar = document.createElement('div');
    bar.className = 'skynet-music-bar';
    bar.id = 'skynetMusicBar';
    bar.innerHTML = `
      <div class="skynet-music-main">
        <div class="skynet-music-copy"><strong id="musicNowTitle">SkyNet Lo-fi Radio</strong><span id="musicNowArtist">Gerado localmente no navegador</span></div>
        <select id="musicSource" class="skynet-music-source"><option value="lofi">SkyNet Lo-fi Radio</option></select>
        <div class="skynet-music-controls">
          <button class="button small music-secondary" id="musicPrev" type="button">Anterior</button>
          <button class="button small primary" id="musicPlay" type="button">Tocar</button>
          <button class="button small music-secondary" id="musicNext" type="button">Próxima</button>
          <button class="button small" id="musicExpand" type="button">Controles</button>
        </div>
      </div>
      <div class="skynet-music-panel">
        <div class="skynet-music-progress-wrap">
          <span id="musicPosition">0:00</span>
          <input class="skynet-music-progress" id="musicProgress" type="range" min="0" max="100" step="0.1" value="0">
          <span id="musicDuration">--:--</span>
        </div>
        <div class="skynet-music-extra">
          <button class="button small" id="musicShuffle" type="button">Shuffle: off</button>
          <button class="button small" id="musicRepeat" type="button">Repeat: off</button>
          <span class="text-faint">Volume</span>
          <input class="skynet-music-volume" id="musicVolume" type="range" min="0" max="1" step="0.01" value="0.6">
          <span class="skynet-music-status" id="musicStatus">Pronto</span>
        </div>
      </div>`;
    document.body.appendChild(bar);

    function selectedTrack() {
        return library.find(track => track.id === state.trackId) || null;
    }

    async function loadLibrary() {
        try {
            const response = await fetch('/api/music/library', { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Falha ao carregar biblioteca');
            const data = await response.json();
            library = data.tracks || [];
            if (state.mode === 'track' && !selectedTrack()) {
                state = { ...state, mode: 'lofi', trackId: null, playing: false, position: 0 };
                saveState(false);
            }
            const select = document.getElementById('musicSource');
            select.innerHTML = `<option value="lofi">SkyNet Lo-fi Radio</option>${library.map(track => `<option value="${escapeHtml(track.id)}">${escapeHtml(track.title)} — ${escapeHtml(track.artist)}</option>`).join('')}`;
            select.value = state.mode === 'track' && state.trackId ? state.trackId : 'lofi';
            prepareTrackSource();
            render();
            if (state.playing) tryResumeAfterNavigation();
        } catch {
            document.getElementById('musicStatus').textContent = 'Biblioteca indisponível';
        }
    }

    function prepareTrackSource() {
        if (state.mode !== 'track') return;
        const track = selectedTrack();
        if (!track) return;
        const absolute = new URL(track.url, location.href).href;
        if (audio.src !== absolute) {
            audio.src = track.url;
            audio.volume = state.volume;
            audio.addEventListener('loadedmetadata', restoreTrackPosition, { once: true });
        }
    }

    function restoreTrackPosition() {
        const desired = Number(state.position || 0);
        if (desired > 0 && Number.isFinite(audio.duration)) {
            audio.currentTime = Math.min(desired, Math.max(0, audio.duration - .25));
        }
        renderProgress();
    }

    async function ensureLofi() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 5200;
            filter.Q.value = .25;
            master.gain.value = state.volume;
            master.connect(filter).connect(ctx.destination);
            noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * .45;
            addVinylNoise();
        }
        master.gain.setTargetAtTime(state.volume, ctx.currentTime, .03);
        if (ctx.state === 'suspended') await ctx.resume();
        if (!scheduler) {
            nextBeatTime = ctx.currentTime + .08;
            beat = 0;
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
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(.0001, time);
            gain.gain.exponentialRampToValueAtTime(.035, time + .08);
            gain.gain.exponentialRampToValueAtTime(.0001, time + 2.8);
            osc.connect(gain).connect(master);
            osc.start(time);
            osc.stop(time + 3);
        }
    }

    function kick(time) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(110, time);
        osc.frequency.exponentialRampToValueAtTime(48, time + .12);
        gain.gain.setValueAtTime(.22, time);
        gain.gain.exponentialRampToValueAtTime(.0001, time + .18);
        osc.connect(gain).connect(master);
        osc.start(time);
        osc.stop(time + .2);
    }

    function snare(time) {
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = noiseBuffer;
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        gain.gain.setValueAtTime(.08, time);
        gain.gain.exponentialRampToValueAtTime(.0001, time + .16);
        src.connect(filter).connect(gain).connect(master);
        src.start(time);
        src.stop(time + .18);
    }

    function hat(time, volume) {
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = noiseBuffer;
        filter.type = 'highpass';
        filter.frequency.value = 5200;
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(.0001, time + .05);
        src.connect(filter).connect(gain).connect(master);
        src.start(time);
        src.stop(time + .06);
    }

    function addVinylNoise() {
        const src = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        src.buffer = noiseBuffer;
        src.loop = true;
        filter.type = 'bandpass';
        filter.frequency.value = 2600;
        filter.Q.value = .35;
        gain.gain.value = .008;
        src.connect(filter).connect(gain).connect(master);
        src.start();
    }

    function stopLofi() {
        if (scheduler) {
            clearInterval(scheduler);
            scheduler = null;
        }
        if (ctx?.state === 'running') ctx.suspend();
    }

    async function play(userInitiated = true) {
        const status = document.getElementById('musicStatus');
        if (state.mode === 'lofi') {
            audio.pause();
            try {
                await ensureLofi();
                state.playing = true;
                status.textContent = 'Tocando';
            } catch {
                state.playing = false;
                status.textContent = userInitiated ? 'Não foi possível iniciar' : 'Clique em Tocar para continuar';
            }
            saveState();
            return;
        }

        stopLofi();
        const track = selectedTrack();
        if (!track) return;
        prepareTrackSource();
        audio.volume = state.volume;
        try {
            await audio.play();
            state.playing = true;
            status.textContent = 'Tocando';
        } catch {
            state.playing = false;
            status.textContent = userInitiated ? 'Não foi possível iniciar' : 'Clique em Tocar para continuar';
        }
        saveState();
    }

    function pause() {
        if (state.mode === 'lofi') {
            if (ctx?.state === 'running') ctx.suspend();
        } else {
            audio.pause();
            state.position = audio.currentTime || 0;
        }
        state.playing = false;
        document.getElementById('musicStatus').textContent = 'Pausado';
        saveState();
    }

    async function switchSource(id, shouldPlay = state.playing) {
        const wasPlaying = Boolean(shouldPlay);
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        stopLofi();
        state = id === 'lofi'
            ? { ...state, mode: 'lofi', trackId: null, playing: false, position: 0 }
            : { ...state, mode: 'track', trackId: id, playing: false, position: 0 };
        saveState(false);
        prepareTrackSource();
        render();
        if (wasPlaying) await play();
    }

    async function step(direction) {
        if (!library.length) return switchSource('lofi', true);
        let index = state.mode === 'track' ? library.findIndex(track => track.id === state.trackId) : -1;
        if (state.shuffle) index = Math.floor(Math.random() * library.length);
        else index = (index + direction + library.length) % library.length;
        await switchSource(library[index].id, true);
        document.getElementById('musicSource').value = library[index].id;
    }

    function tryResumeAfterNavigation() {
        setTimeout(() => play(false), 80);
    }

    function renderProgress() {
        const progress = document.getElementById('musicProgress');
        const current = document.getElementById('musicPosition');
        const duration = document.getElementById('musicDuration');
        if (state.mode === 'lofi') {
            progress.disabled = true;
            progress.value = '0';
            current.textContent = 'LIVE';
            duration.textContent = '∞';
            return;
        }
        progress.disabled = false;
        const d = Number.isFinite(audio.duration) ? audio.duration : 0;
        const t = audio.currentTime || Number(state.position || 0);
        progress.max = String(Math.max(1, d));
        progress.value = String(Math.min(t, Math.max(1, d)));
        current.textContent = formatTime(t);
        duration.textContent = d ? formatTime(d) : '--:--';
    }

    function render() {
        const track = selectedTrack();
        document.getElementById('musicNowTitle').textContent = state.mode === 'lofi' ? 'SkyNet Lo-fi Radio' : (track?.title || 'Faixa');
        document.getElementById('musicNowArtist').textContent = state.mode === 'lofi' ? 'Gerado localmente no navegador' : (track?.artist || 'SkyNetApi');
        document.getElementById('musicPlay').textContent = state.playing ? 'Pausar' : 'Tocar';
        document.getElementById('musicShuffle').textContent = `Shuffle: ${state.shuffle ? 'on' : 'off'}`;
        document.getElementById('musicRepeat').textContent = `Repeat: ${state.repeat ? 'on' : 'off'}`;
        document.getElementById('musicVolume').value = String(state.volume);
        document.getElementById('musicExpand').textContent = expanded ? 'Fechar' : 'Controles';
        bar.classList.toggle('expanded', expanded);
        renderProgress();
    }

    document.getElementById('musicPlay').addEventListener('click', () => state.playing ? pause() : play());
    document.getElementById('musicPrev').addEventListener('click', () => step(-1));
    document.getElementById('musicNext').addEventListener('click', () => step(1));
    document.getElementById('musicExpand').addEventListener('click', () => { expanded = !expanded; render(); });
    document.getElementById('musicShuffle').addEventListener('click', () => { state.shuffle = !state.shuffle; saveState(); });
    document.getElementById('musicRepeat').addEventListener('click', () => { state.repeat = !state.repeat; saveState(); });
    document.getElementById('musicSource').addEventListener('change', event => switchSource(event.target.value));
    document.getElementById('musicVolume').addEventListener('input', event => {
        state.volume = Math.max(0, Math.min(1, Number(event.target.value) || 0));
        audio.volume = state.volume;
        if (master && ctx) master.gain.setTargetAtTime(state.volume, ctx.currentTime, .03);
        saveState();
    });
    document.getElementById('musicProgress').addEventListener('input', event => {
        if (state.mode !== 'track' || !Number.isFinite(audio.duration)) return;
        audio.currentTime = Math.max(0, Math.min(audio.duration, Number(event.target.value) || 0));
        state.position = audio.currentTime;
        saveState(false);
        renderProgress();
    });

    audio.addEventListener('loadedmetadata', renderProgress);
    audio.addEventListener('timeupdate', () => {
        renderProgress();
        const now = Date.now();
        if (now - lastPositionSave > 3000) {
            lastPositionSave = now;
            state.position = audio.currentTime || 0;
            saveState(false);
        }
    });
    audio.addEventListener('play', () => {
        state.playing = true;
        document.getElementById('musicStatus').textContent = 'Tocando';
        saveState();
    });
    audio.addEventListener('pause', () => {
        if (state.mode !== 'track') return;
        state.position = audio.currentTime || 0;
        saveState(false);
        render();
    });
    audio.addEventListener('ended', () => {
        state.position = 0;
        if (state.repeat) {
            audio.currentTime = 0;
            play();
        } else {
            step(1);
        }
    });

    window.addEventListener('beforeunload', () => {
        if (state.mode === 'track') state.position = audio.currentTime || state.position || 0;
        localStorage.setItem(STORAGE, JSON.stringify(state));
    });
    window.addEventListener('storage', event => {
        if (event.key !== STORAGE) return;
        state = readState();
        render();
    });

    loadLibrary();
    render();
})();
