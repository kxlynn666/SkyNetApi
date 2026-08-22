(() => {
    const cleanPath = location.pathname.replace(/\/+$/, '') || '/';
    if (cleanPath !== '/painel') return;

    const S = window.SkyNet;
    if (!S) return;

    function installStyles() {
        if (document.getElementById('youtubePanelStyles')) return;
        const style = document.createElement('style');
        style.id = 'youtubePanelStyles';
        style.textContent = `
            .youtube-layout{align-items:start}
            .youtube-player{aspect-ratio:16/9;border:1px solid var(--border);border-radius:18px;background:rgba(7,5,14,.58);display:flex;align-items:center;justify-content:center;overflow:hidden}
            .youtube-player iframe{width:100%;height:100%;border:0;display:block}
            .youtube-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
            .youtube-note{margin-top:12px;color:var(--muted);font-size:13px;line-height:1.55}
            .youtube-meta{display:grid;gap:6px;margin-top:14px}
            .youtube-video-id{font-family:monospace;color:var(--text-faint);word-break:break-all}
        `;
        document.head.appendChild(style);
    }

    function parseYouTubeUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) throw new Error('Informe um link do YouTube.');

        let url;
        try { url = new URL(raw); }
        catch { throw new Error('Link do YouTube inválido.'); }

        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        let id = '';

        if (host === 'youtu.be') {
            id = url.pathname.split('/').filter(Boolean)[0] || '';
        } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
            if (url.pathname === '/watch') {
                id = url.searchParams.get('v') || '';
            } else {
                const parts = url.pathname.split('/').filter(Boolean);
                if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1] || '';
            }
        } else {
            throw new Error('Use um link do YouTube ou youtu.be.');
        }

        id = id.trim();
        if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
            throw new Error('Não foi possível identificar o vídeo nesse link.');
        }

        return {
            id,
            canonicalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
            embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`
        };
    }

    function installPanel() {
        const tabs = document.querySelector('.tabs');
        const historyPanel = document.getElementById('history');
        if (!tabs || !historyPanel || document.getElementById('youtube')) return;

        installStyles();

        const tabButton = document.createElement('button');
        tabButton.className = 'tab';
        tabButton.dataset.tab = 'youtube';
        tabButton.type = 'button';
        tabButton.textContent = 'YouTube';

        const historyButton = tabs.querySelector('[data-tab="history"]');
        tabs.insertBefore(tabButton, historyButton || tabs.lastElementChild);

        const panel = document.createElement('section');
        panel.className = 'tab-panel';
        panel.id = 'youtube';
        panel.innerHTML = `
            <div class="grid two youtube-layout">
                <div class="card">
                    <h2 class="card-title">YouTube</h2>
                    <p class="editor-note">Cole um link do YouTube para abrir o vídeo no player oficial dentro do painel.</p>
                    <div class="message" id="youtubeMessage"></div>
                    <form id="youtubeForm">
                        <div class="form-group">
                            <label for="youtubeUrl">Link do YouTube</label>
                            <input id="youtubeUrl" type="url" placeholder="https://www.youtube.com/watch?v=..." required>
                        </div>
                        <button class="button primary" id="youtubeLoadButton" type="submit">Carregar</button>
                    </form>
                    <p class="youtube-note">O SkyNetApi não extrai MP4 ou MP3 do YouTube. Para downloads, use os recursos oficiais oferecidos pelo próprio YouTube para o conteúdo quando disponíveis.</p>
                </div>

                <div class="card">
                    <h2 class="card-title">Pré-visualização</h2>
                    <div class="youtube-player" id="youtubePlayer">
                        <span class="muted">O player aparecerá aqui.</span>
                    </div>
                    <div class="youtube-meta hidden" id="youtubeMeta">
                        <div class="meta">ID do vídeo</div>
                        <div class="youtube-video-id" id="youtubeVideoId"></div>
                    </div>
                    <div class="youtube-actions">
                        <button class="button hidden" id="youtubeCopyButton" type="button">Copiar link</button>
                        <a class="button primary hidden" id="youtubeOpenButton" target="_blank" rel="noopener noreferrer">Abrir no YouTube</a>
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
        const form = document.getElementById('youtubeForm');
        const input = document.getElementById('youtubeUrl');
        const message = document.getElementById('youtubeMessage');
        const player = document.getElementById('youtubePlayer');
        const meta = document.getElementById('youtubeMeta');
        const videoId = document.getElementById('youtubeVideoId');
        const copyButton = document.getElementById('youtubeCopyButton');
        const openButton = document.getElementById('youtubeOpenButton');
        const loadButton = document.getElementById('youtubeLoadButton');
        let currentUrl = '';

        form.addEventListener('submit', event => {
            event.preventDefault();
            loadButton.disabled = true;
            S.message(message, '');

            try {
                const item = parseYouTubeUrl(input.value);
                currentUrl = item.canonicalUrl;
                player.innerHTML = `<iframe src="${S.escapeHtml(item.embedUrl)}" title="Player do YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
                videoId.textContent = item.id;
                meta.classList.remove('hidden');
                copyButton.classList.remove('hidden');
                openButton.href = item.canonicalUrl;
                openButton.classList.remove('hidden');
                S.message(message, 'Vídeo carregado no player.', 'success');
            } catch (error) {
                currentUrl = '';
                player.innerHTML = '<span class="muted">O player aparecerá aqui.</span>';
                meta.classList.add('hidden');
                copyButton.classList.add('hidden');
                openButton.classList.add('hidden');
                openButton.removeAttribute('href');
                S.message(message, error.message, 'error');
            } finally {
                loadButton.disabled = false;
            }
        });

        copyButton.addEventListener('click', async () => {
            if (!currentUrl) return;
            try {
                await S.copy(currentUrl);
                S.message(message, 'Link do YouTube copiado.', 'success');
            } catch {
                prompt('Copie o link:', currentUrl);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installPanel, { once: true });
    } else {
        installPanel();
    }
})();
