(() => {
    const cleanPath = location.pathname.replace(/\/+$/, '') || '/';
    if (cleanPath !== '/painel') return;

    const S = window.SkyNet;
    if (!S) return;

    function formatDuration(seconds) {
        const total = Math.max(0, Math.floor(Number(seconds || 0)));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const rest = total % 60;
        return hours
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
            : `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    function installStyles() {
        if (document.getElementById('mediaPanelStyles')) return;
        const style = document.createElement('style');
        style.id = 'mediaPanelStyles';
        style.textContent = `
            .media-layout{align-items:start}
            .media-player{min-height:360px;border:1px solid var(--border);border-radius:18px;background:rgba(7,5,14,.58);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:14px}
            .media-player video{display:block;width:100%;max-height:620px;border-radius:14px;background:#000}
            .media-audio-wrap{width:100%;display:grid;gap:16px;justify-items:center}
            .media-audio-wrap img,.media-cover{width:min(320px,82%);max-height:360px;object-fit:cover;border-radius:18px;border:1px solid var(--border)}
            .media-audio-wrap audio{width:100%}
            .media-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:end}
            .media-toolbar .form-group{flex:1 1 190px;margin:0}
            .media-toolbar .media-link-field{flex:3 1 360px}
            .media-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
            .media-meta{display:grid;gap:6px;margin-top:14px}
            .media-title{font-size:17px;font-weight:700;line-height:1.45}
            .media-source{word-break:break-word}
            @media(max-width:720px){.media-player{min-height:260px}}
        `;
        document.head.appendChild(style);
    }

    function installPanel() {
        const tabs = document.querySelector('.tabs');
        const historyPanel = document.getElementById('history');
        if (!tabs || !historyPanel || document.getElementById('mediaDownloader')) return;

        installStyles();

        const tabButton = document.createElement('button');
        tabButton.className = 'tab';
        tabButton.dataset.tab = 'mediaDownloader';
        tabButton.type = 'button';
        tabButton.textContent = 'Media Downloader';

        const historyButton = tabs.querySelector('[data-tab="history"]');
        tabs.insertBefore(tabButton, historyButton || tabs.lastElementChild);

        const panel = document.createElement('section');
        panel.className = 'tab-panel';
        panel.id = 'mediaDownloader';
        panel.innerHTML = `
            <div class="grid two media-layout">
                <div class="card">
                    <h2 class="card-title">Media Downloader</h2>
                    <p class="editor-note">Cole um link público. O servidor tenta analisar com yt-dlp e só inicia o download quando você clicar em Baixar.</p>
                    <div class="message" id="mediaMessage"></div>
                    <form id="mediaForm">
                        <div class="media-toolbar">
                            <div class="form-group media-link-field">
                                <label for="mediaUrl">Link da mídia</label>
                                <input id="mediaUrl" type="url" placeholder="https://..." required>
                            </div>
                            <div class="form-group">
                                <label for="mediaType">Formato</label>
                                <select id="mediaType">
                                    <option value="video">Vídeo</option>
                                    <option value="audio">Áudio</option>
                                </select>
                            </div>
                            <button class="button primary" id="mediaAnalyzeButton" type="submit">Analisar</button>
                        </div>
                    </form>
                    <p class="hint" style="margin-top:12px">Sem login, cookies, DRM, playlists, lives ou conteúdo marcado como 18+. YouTube é tratado separadamente e não é aceito nesta ferramenta.</p>
                </div>

                <div class="card">
                    <h2 class="card-title">Pré-visualização</h2>
                    <div class="media-player" id="mediaPlayer">
                        <span class="muted">A mídia analisada aparecerá aqui.</span>
                    </div>
                    <div class="media-meta hidden" id="mediaMeta">
                        <div class="media-title" id="mediaTitle"></div>
                        <div class="meta" id="mediaUploader"></div>
                        <div class="meta" id="mediaSite"></div>
                        <div class="meta" id="mediaDuration"></div>
                        <div class="meta media-source" id="mediaSource"></div>
                    </div>
                    <div class="media-actions">
                        <button class="button hidden" id="mediaCopyButton" type="button">Copiar link direto</button>
                        <a class="button primary hidden" id="mediaDownloadButton">Baixar</a>
                    </div>
                </div>
            </div>
        `;
        historyPanel.parentNode.insertBefore(panel, historyPanel);

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
        const form = document.getElementById('mediaForm');
        const input = document.getElementById('mediaUrl');
        const typeSelect = document.getElementById('mediaType');
        const button = document.getElementById('mediaAnalyzeButton');
        const message = document.getElementById('mediaMessage');
        const player = document.getElementById('mediaPlayer');
        const meta = document.getElementById('mediaMeta');
        const title = document.getElementById('mediaTitle');
        const uploader = document.getElementById('mediaUploader');
        const site = document.getElementById('mediaSite');
        const duration = document.getElementById('mediaDuration');
        const source = document.getElementById('mediaSource');
        const copyButton = document.getElementById('mediaCopyButton');
        const downloadButton = document.getElementById('mediaDownloadButton');

        let currentItem = null;
        let currentDirectUrl = '';

        function resetResult() {
            currentItem = null;
            currentDirectUrl = '';
            player.innerHTML = '<span class="muted">A mídia analisada aparecerá aqui.</span>';
            meta.classList.add('hidden');
            copyButton.classList.add('hidden');
            downloadButton.classList.add('hidden');
            downloadButton.removeAttribute('href');
        }

        function renderType() {
            if (!currentItem) return;

            const type = typeSelect.value;
            const isAudio = type === 'audio';
            const available = isAudio ? currentItem.hasAudio : currentItem.hasVideo;
            const previewUrl = isAudio ? currentItem.audioPreviewUrl : currentItem.videoPreviewUrl;
            const directUrl = isAudio ? currentItem.audioDirectUrl : currentItem.videoDirectUrl;
            const downloadUrl = isAudio ? currentItem.audioDownloadUrl : currentItem.videoDownloadUrl;

            if (!available || !downloadUrl) {
                currentDirectUrl = '';
                player.innerHTML = `<span class="muted">${isAudio ? 'Áudio' : 'Vídeo'} não disponível para este link.</span>`;
                copyButton.classList.add('hidden');
                downloadButton.classList.add('hidden');
                S.message(message, `${isAudio ? 'Áudio' : 'Vídeo'} não disponível para este link.`, 'warning');
                return;
            }

            currentDirectUrl = directUrl || '';
            downloadButton.href = downloadUrl;
            downloadButton.classList.remove('hidden');
            copyButton.classList.toggle('hidden', !currentDirectUrl);

            if (previewUrl) {
                if (isAudio) {
                    const cover = currentItem.thumbnail
                        ? `<img src="${S.escapeHtml(currentItem.thumbnail)}" alt="Capa da mídia" referrerpolicy="no-referrer">`
                        : '';
                    player.innerHTML = `<div class="media-audio-wrap">${cover}<audio controls preload="metadata" src="${S.escapeHtml(previewUrl)}"></audio></div>`;
                } else {
                    const poster = currentItem.thumbnail ? ` poster="${S.escapeHtml(currentItem.thumbnail)}"` : '';
                    player.innerHTML = `<video controls playsinline preload="metadata"${poster} src="${S.escapeHtml(previewUrl)}"></video>`;
                }
                S.message(message, 'Mídia analisada e pronta para visualizar.', 'success');
            } else {
                const cover = currentItem.thumbnail
                    ? `<img class="media-cover" src="${S.escapeHtml(currentItem.thumbnail)}" alt="Capa da mídia" referrerpolicy="no-referrer">`
                    : '<span class="muted">Este formato não oferece prévia reproduzível no navegador.</span>';
                player.innerHTML = cover;
                S.message(message, 'Mídia encontrada. A prévia não é compatível com o navegador, mas o download está disponível.', 'success');
            }
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            const url = input.value.trim();
            if (!url) return S.message(message, 'Informe um link.', 'error');

            button.disabled = true;
            button.textContent = 'Analisando...';
            S.message(message, '');
            resetResult();

            try {
                const data = await S.api('/painel/media-info', { method: 'POST', body: { url } });
                currentItem = data.item;
                title.textContent = currentItem.title || 'Mídia';
                uploader.textContent = currentItem.uploader ? `Autor: ${currentItem.uploader}` : '';
                site.textContent = currentItem.site ? `Origem: ${currentItem.site}` : '';
                duration.textContent = currentItem.duration ? `Duração: ${formatDuration(currentItem.duration)}` : '';
                source.textContent = `Link original: ${currentItem.sourceUrl}`;
                meta.classList.remove('hidden');

                if (typeSelect.value === 'video' && !currentItem.hasVideo && currentItem.hasAudio) typeSelect.value = 'audio';
                if (typeSelect.value === 'audio' && !currentItem.hasAudio && currentItem.hasVideo) typeSelect.value = 'video';
                renderType();
            } catch (error) {
                resetResult();
                S.message(message, error.message, 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Analisar';
            }
        });

        typeSelect.addEventListener('change', renderType);

        copyButton.addEventListener('click', async () => {
            if (!currentDirectUrl) return;
            try {
                await S.copy(currentDirectUrl);
                S.message(message, 'Link direto copiado.', 'success');
            } catch {
                prompt('Copie o link direto:', currentDirectUrl);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installPanel, { once: true });
    } else {
        installPanel();
    }
})();
