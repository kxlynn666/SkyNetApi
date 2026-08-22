(() => {
    const cleanPath = location.pathname.replace(/\/+$/, '') || '/';
    if (cleanPath !== '/painel') return;

    const S = window.SkyNet;
    if (!S) return;

    function formatDuration(seconds) {
        const total = Math.max(0, Number(seconds || 0));
        const minutes = Math.floor(total / 60);
        const rest = Math.floor(total % 60);
        return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    function installStyles() {
        if (document.getElementById('tiktokPanelStyles')) return;
        const style = document.createElement('style');
        style.id = 'tiktokPanelStyles';
        style.textContent = `
            .tiktok-layout{align-items:start}
            .tiktok-player{min-height:360px;border:1px solid var(--border);border-radius:18px;background:rgba(7,5,14,.58);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:14px}
            .tiktok-player video{display:block;width:100%;max-height:620px;border-radius:14px;background:#000}
            .tiktok-audio-wrap{width:100%;display:grid;gap:16px;justify-items:center}
            .tiktok-audio-wrap img{width:min(300px,80%);aspect-ratio:1/1;object-fit:cover;border-radius:18px;border:1px solid var(--border)}
            .tiktok-audio-wrap audio{width:100%}
            .tiktok-meta{display:grid;gap:6px;margin-top:14px}
            .tiktok-title{font-weight:700;line-height:1.45}
            .tiktok-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:end}
            .tiktok-toolbar .form-group{flex:1 1 190px;margin:0}
            .tiktok-toolbar .tiktok-link-field{flex:3 1 360px}
            .tiktok-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
            @media(max-width:720px){.tiktok-player{min-height:260px}}
        `;
        document.head.appendChild(style);
    }

    function installPanel() {
        const tabs = document.querySelector('.tabs');
        const historyPanel = document.getElementById('history');
        if (!tabs || !historyPanel || document.getElementById('tiktok')) return;

        installStyles();

        const tabButton = document.createElement('button');
        tabButton.className = 'tab';
        tabButton.dataset.tab = 'tiktok';
        tabButton.type = 'button';
        tabButton.textContent = 'TikTok Downloader';

        const historyButton = tabs.querySelector('[data-tab="history"]');
        tabs.insertBefore(tabButton, historyButton || tabs.lastElementChild);

        const panel = document.createElement('section');
        panel.className = 'tab-panel';
        panel.id = 'tiktok';
        panel.innerHTML = `
            <div class="grid two tiktok-layout">
                <div class="card">
                    <h2 class="card-title">TikTok Downloader</h2>
                    <p class="editor-note">Cole um link público do TikTok. Primeiro a mídia será carregada em um player; o download só começa quando você clicar em Baixar.</p>
                    <div class="message" id="tiktokMessage"></div>
                    <form id="tiktokForm">
                        <div class="tiktok-toolbar">
                            <div class="form-group tiktok-link-field">
                                <label for="tiktokUrl">Link do TikTok</label>
                                <input id="tiktokUrl" type="url" placeholder="https://www.tiktok.com/@usuario/video/..." required>
                            </div>
                            <div class="form-group">
                                <label for="tiktokType">Formato</label>
                                <select id="tiktokType">
                                    <option value="video">Vídeo MP4</option>
                                    <option value="audio">Áudio MP3</option>
                                </select>
                            </div>
                            <button class="button primary" id="tiktokLoadButton" type="submit">Carregar</button>
                        </div>
                    </form>
                    <p class="hint" style="margin-top:12px">Use apenas conteúdo que você tenha direito ou permissão para baixar.</p>
                </div>

                <div class="card">
                    <h2 class="card-title">Pré-visualização</h2>
                    <div class="tiktok-player" id="tiktokPlayer">
                        <span class="muted">O player aparecerá aqui.</span>
                    </div>
                    <div class="tiktok-meta hidden" id="tiktokMeta">
                        <div class="tiktok-title" id="tiktokTitle"></div>
                        <div class="meta" id="tiktokAuthor"></div>
                        <div class="meta" id="tiktokDuration"></div>
                    </div>
                    <div class="tiktok-actions">
                        <button class="button hidden" id="tiktokCopyButton" type="button">Copiar link</button>
                        <a class="button primary hidden" id="tiktokDownloadButton">Baixar</a>
                    </div>
                </div>
            </div>
        `;
        historyPanel.parentNode.insertBefore(panel, historyPanel);

        // Controla todas as abas, inclusive a adicionada dinamicamente.
        tabs.addEventListener('click', event => {
            const button = event.target.closest('[data-tab]');
            if (!button || !tabs.contains(button)) return;
            const target = button.dataset.tab;
            document.querySelectorAll('.tabs [data-tab]').forEach(item => item.classList.toggle('active', item === button));
            document.querySelectorAll('.tab-panel').forEach(item => item.classList.toggle('active', item.id === target));
        }, true);

        bindPanel();
    }

    function bindPanel() {
        const form = document.getElementById('tiktokForm');
        const typeSelect = document.getElementById('tiktokType');
        const message = document.getElementById('tiktokMessage');
        const button = document.getElementById('tiktokLoadButton');
        const player = document.getElementById('tiktokPlayer');
        const meta = document.getElementById('tiktokMeta');
        const title = document.getElementById('tiktokTitle');
        const author = document.getElementById('tiktokAuthor');
        const duration = document.getElementById('tiktokDuration');
        const copyButton = document.getElementById('tiktokCopyButton');
        const downloadButton = document.getElementById('tiktokDownloadButton');

        let currentItem = null;
        let currentDirectUrl = '';

        function clearResult() {
            currentItem = null;
            currentDirectUrl = '';
            player.innerHTML = '<span class="muted">O player aparecerá aqui.</span>';
            meta.classList.add('hidden');
            copyButton.classList.add('hidden');
            downloadButton.classList.add('hidden');
            downloadButton.removeAttribute('href');
        }

        function renderSelectedType() {
            if (!currentItem) return;

            const type = typeSelect.value;
            const isAudio = type === 'audio';
            const directUrl = isAudio ? currentItem.audioUrl : currentItem.videoUrl;
            const streamUrl = isAudio ? currentItem.audioStreamUrl : currentItem.videoStreamUrl;
            const downloadUrl = isAudio ? currentItem.audioDownloadUrl : currentItem.videoDownloadUrl;

            if (!directUrl || !streamUrl || !downloadUrl) {
                currentDirectUrl = '';
                player.innerHTML = `<span class="muted">${isAudio ? 'Áudio' : 'Vídeo'} não disponível para este TikTok.</span>`;
                copyButton.classList.add('hidden');
                downloadButton.classList.add('hidden');
                S.message(message, `${isAudio ? 'Áudio' : 'Vídeo'} não disponível para este TikTok.`, 'warning');
                return;
            }

            currentDirectUrl = directUrl;
            if (isAudio) {
                const cover = currentItem.cover
                    ? `<img src="${S.escapeHtml(currentItem.cover)}" alt="Capa do TikTok" referrerpolicy="no-referrer">`
                    : '';
                player.innerHTML = `
                    <div class="tiktok-audio-wrap">
                        ${cover}
                        <audio controls preload="metadata" src="${S.escapeHtml(streamUrl)}"></audio>
                    </div>`;
            } else {
                const poster = currentItem.cover ? ` poster="${S.escapeHtml(currentItem.cover)}"` : '';
                player.innerHTML = `<video controls playsinline preload="metadata"${poster} src="${S.escapeHtml(streamUrl)}"></video>`;
            }

            downloadButton.href = downloadUrl;
            downloadButton.classList.remove('hidden');
            copyButton.classList.remove('hidden');
            S.message(message, 'Mídia pronta para visualizar.', 'success');
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            const url = document.getElementById('tiktokUrl').value.trim();
            if (!url) return S.message(message, 'Informe um link do TikTok.', 'error');

            button.disabled = true;
            button.textContent = 'Carregando...';
            S.message(message, '');
            clearResult();

            try {
                const data = await S.api('/painel/tiktok-info', {
                    method: 'POST',
                    body: { url }
                });
                currentItem = data.item;
                title.textContent = currentItem.title || 'TikTok';
                const username = currentItem.author?.username ? `@${currentItem.author.username}` : 'Autor não informado';
                const nickname = currentItem.author?.nickname && currentItem.author.nickname !== currentItem.author.username
                    ? ` · ${currentItem.author.nickname}`
                    : '';
                author.textContent = `${username}${nickname}`;
                duration.textContent = currentItem.duration ? `Duração: ${formatDuration(currentItem.duration)}` : '';
                meta.classList.remove('hidden');

                if (typeSelect.value === 'video' && !currentItem.hasVideo && currentItem.hasAudio) typeSelect.value = 'audio';
                if (typeSelect.value === 'audio' && !currentItem.hasAudio && currentItem.hasVideo) typeSelect.value = 'video';
                renderSelectedType();
            } catch (error) {
                clearResult();
                S.message(message, error.message, 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Carregar';
            }
        });

        typeSelect.addEventListener('change', renderSelectedType);

        copyButton.addEventListener('click', async () => {
            if (!currentDirectUrl) return;
            try {
                await S.copy(currentDirectUrl);
                S.message(message, 'Link da mídia copiado.', 'success');
            } catch {
                prompt('Copie o link da mídia:', currentDirectUrl);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installPanel, { once: true });
    } else {
        installPanel();
    }
})();
