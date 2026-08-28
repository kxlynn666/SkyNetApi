(() => {
  if (window.__SKYNET_YOUTUBE_DOWNLOADER_V1__) return;
  window.__SKYNET_YOUTUBE_DOWNLOADER_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/youtube') return;
  const S = window.SkyNet;
  if (!S) return;

  let currentItem = null;
  let renderQueued = false;
  let observer = null;

  installStyles();
  updateHeading();
  ensurePage();

  const root = document.getElementById('workspaceContent');
  if (root) {
    observer = new MutationObserver(() => {
      if (document.getElementById('youtubeLocalFormV2')) return;
      if (renderQueued) return;
      renderQueued = true;
      queueMicrotask(() => {
        renderQueued = false;
        ensurePage();
      });
    });
    observer.observe(root, { childList: true, subtree: false });
    setTimeout(() => observer?.disconnect(), 12000);
  }

  function updateHeading() {
    const apply = () => {
      const kicker = document.getElementById('workspaceKicker');
      const title = document.getElementById('workspaceTitle');
      const description = document.getElementById('workspaceDescription');
      if (kicker) kicker.textContent = 'Downloader';
      if (title) title.textContent = 'YouTube Downloader';
      if (description) description.textContent = 'Baixe com yt-dlp e reproduza no site o mesmo arquivo MP4 preparado pelo servidor.';
      document.title = 'YouTube Downloader - SkyNetApi';
    };
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 900);
  }

  function ensurePage() {
    const root = document.getElementById('workspaceContent');
    if (!root) return false;
    if (document.getElementById('youtubeLocalFormV2')) return true;

    root.innerHTML = `
      <section class="workspace-page-grid youtube-local-grid-v2">
        <div class="workspace-card workspace-col-5">
          <div class="workspace-card-header"><div><h2>Baixar e carregar</h2><p>O player só aparece depois que o yt-dlp termina o MP4.</p></div></div>
          <div class="message" id="youtubeLocalMessageV2"></div>
          <form id="youtubeLocalFormV2">
            <div class="form-group">
              <label for="youtubeLocalUrlV2">Link do YouTube</label>
              <input id="youtubeLocalUrlV2" type="url" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off" required>
            </div>
            <div class="form-group">
              <label for="youtubeLocalQualityV2">Qualidade</label>
              <select id="youtubeLocalQualityV2">
                <option value="360">360p</option>
                <option value="720" selected>720p</option>
                <option value="1080">1080p</option>
              </select>
            </div>
            <button class="button primary youtube-local-submit-v2" id="youtubeLocalSubmitV2" type="submit">Baixar com yt-dlp e carregar</button>
          </form>
          <div class="youtube-local-process-v2" id="youtubeLocalProcessV2" hidden>
            <span class="youtube-local-spinner-v2" aria-hidden="true"></span>
            <div><strong>Preparando o vídeo...</strong><small>O servidor está usando yt-dlp + FFmpeg. O player abrirá quando o MP4 estiver pronto.</small></div>
          </div>
          <p class="hint youtube-rights-note-v2">Baixe apenas vídeos seus, em domínio público ou que você tenha permissão para salvar. Vídeos privados, Premium, 18+, lives em andamento e playlists não são aceitos.</p>
        </div>

        <div class="workspace-card workspace-col-7">
          <div class="workspace-card-header"><div><h2>Arquivo preparado</h2><p id="youtubeLocalMetaV2">Nenhum vídeo carregado.</p></div></div>
          <div class="workspace-media-player youtube-local-player-v2" id="youtubeLocalPlayerV2">
            <div class="youtube-local-empty-v2"><strong>MP4 local</strong><span>Cole um link e aguarde o yt-dlp terminar o download.</span></div>
          </div>
          <div class="youtube-local-details-v2" id="youtubeLocalDetailsV2" hidden></div>
          <div class="workspace-tool-actions youtube-local-actions-v2">
            <a class="button primary hidden" id="youtubeLocalDownloadV2" href="#" download>Baixar MP4</a>
            <a class="button hidden" id="youtubeLocalOpenV2" href="#" target="_blank" rel="noopener">Abrir no YouTube</a>
          </div>
        </div>
      </section>`;

    bindPage();
    return true;
  }

  function bindPage() {
    const form = document.getElementById('youtubeLocalFormV2');
    const select = document.getElementById('youtubeLocalQualityV2');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', prepareVideo);
    select?.addEventListener('change', () => {
      if (!currentItem) return;
      const message = document.getElementById('youtubeLocalMessageV2');
      S.message(message, 'Qualidade alterada. Clique em “Baixar com yt-dlp e carregar” para preparar outro MP4.', 'warning');
    });
  }

  async function prepareVideo(event) {
    event.preventDefault();
    const input = document.getElementById('youtubeLocalUrlV2');
    const select = document.getElementById('youtubeLocalQualityV2');
    const message = document.getElementById('youtubeLocalMessageV2');
    const url = String(input?.value || '').trim();
    if (!url) return;

    currentItem = null;
    setBusy(true);
    resetResult('Baixando o vídeo com yt-dlp...');
    try {
      const data = await S.api('/painel/youtube-prepare', {
        method: 'POST',
        body: { url, height: Number(select?.value || 720) }
      });
      currentItem = data.item || null;
      if (!currentItem?.streamUrl || !currentItem?.downloadUrl) throw new Error('O servidor não retornou o arquivo preparado.');
      renderItem(currentItem);
      S.message(message, 'MP4 pronto. O player e o botão de download usam o mesmo arquivo baixado pelo yt-dlp.', 'success');
    } catch (error) {
      resetResult('Não foi possível preparar o vídeo.');
      S.message(message, error.message || 'Não foi possível preparar o vídeo.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function renderItem(item) {
    const player = document.getElementById('youtubeLocalPlayerV2');
    const details = document.getElementById('youtubeLocalDetailsV2');
    const meta = document.getElementById('youtubeLocalMetaV2');
    const download = document.getElementById('youtubeLocalDownloadV2');
    const open = document.getElementById('youtubeLocalOpenV2');
    const select = document.getElementById('youtubeLocalQualityV2');

    if (player) {
      player.innerHTML = `<video controls playsinline preload="metadata" ${item.thumbnail ? `poster="${esc(item.thumbnail)}"` : ''} src="${esc(item.streamUrl)}"></video>`;
    }
    if (meta) meta.textContent = `${item.uploader || 'YouTube'}${item.duration ? ` · ${formatDuration(item.duration)}` : ''} · ${item.selectedLabel || `${item.selectedHeight || ''}p`}`;
    if (details) {
      details.hidden = false;
      details.innerHTML = `
        ${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : '<div class="youtube-local-thumb-fallback-v2">YT</div>'}
        <div><strong>${esc(item.title || 'Vídeo do YouTube')}</strong><span>${esc(item.uploader || 'YouTube')}</span><small>${item.size ? esc(S.formatSize(item.size)) : ''}${item.duration ? ` · ${esc(formatDuration(item.duration))}` : ''}</small></div>`;
    }
    if (download) {
      download.href = item.downloadUrl;
      download.classList.remove('hidden');
      download.setAttribute('download', '');
    }
    if (open) {
      open.href = item.canonicalUrl || '#';
      open.classList.toggle('hidden', !item.canonicalUrl);
    }
    if (select && Array.isArray(item.qualities) && item.qualities.length) {
      select.innerHTML = item.qualities.map(option => `<option value="${Number(option.height)}" ${Number(option.height) === Number(item.selectedHeight) ? 'selected' : ''}>${esc(option.label || `${option.height}p`)}</option>`).join('');
    }
  }

  function resetResult(text) {
    const player = document.getElementById('youtubeLocalPlayerV2');
    const details = document.getElementById('youtubeLocalDetailsV2');
    const meta = document.getElementById('youtubeLocalMetaV2');
    const download = document.getElementById('youtubeLocalDownloadV2');
    const open = document.getElementById('youtubeLocalOpenV2');
    if (player) player.innerHTML = `<div class="youtube-local-empty-v2"><strong>MP4 local</strong><span>${esc(text || 'Nenhum vídeo carregado.')}</span></div>`;
    if (details) { details.hidden = true; details.innerHTML = ''; }
    if (meta) meta.textContent = text || 'Nenhum vídeo carregado.';
    download?.classList.add('hidden');
    open?.classList.add('hidden');
  }

  function setBusy(value) {
    const button = document.getElementById('youtubeLocalSubmitV2');
    const process = document.getElementById('youtubeLocalProcessV2');
    const form = document.getElementById('youtubeLocalFormV2');
    if (button) {
      button.disabled = value;
      button.textContent = value ? 'Baixando com yt-dlp...' : 'Baixar com yt-dlp e carregar';
    }
    if (process) process.hidden = !value;
    form?.querySelectorAll('input,select').forEach(element => { element.disabled = value; });
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds || 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function esc(value) {
    return S.escapeHtml(value == null ? '' : String(value));
  }

  function installStyles() {
    if (document.getElementById('youtubeDownloaderV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'youtubeDownloaderV2Styles';
    style.textContent = `
      .youtube-local-grid-v2{align-items:start}.youtube-local-submit-v2{width:100%;justify-content:center}.youtube-rights-note-v2{margin-top:13px;line-height:1.55}
      .youtube-local-process-v2{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;margin-top:12px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--theme-primary) 24%,var(--theme-border));border-radius:12px;background:color-mix(in srgb,var(--theme-primary) 7%,var(--theme-field))}.youtube-local-process-v2[hidden]{display:none!important}.youtube-local-process-v2 strong,.youtube-local-process-v2 small{display:block}.youtube-local-process-v2 strong{font-size:10px;color:var(--theme-text)}.youtube-local-process-v2 small{font-size:9px;line-height:1.45;color:var(--theme-muted);margin-top:2px}
      .youtube-local-spinner-v2{width:18px;height:18px;border:2px solid color-mix(in srgb,var(--theme-primary) 18%,transparent);border-top-color:var(--theme-primary);border-radius:50%;animation:youtubeLocalSpinV2 .75s linear infinite}@keyframes youtubeLocalSpinV2{to{transform:rotate(360deg)}}
      .youtube-local-player-v2{min-height:260px;display:grid;place-items:center;background:color-mix(in srgb,var(--theme-bg) 92%,#000);border:1px solid var(--theme-border-soft);border-radius:14px;overflow:hidden}.youtube-local-player-v2 video{width:100%;max-height:64vh;aspect-ratio:16/9;background:#000;display:block}.youtube-local-empty-v2{padding:28px;text-align:center;display:grid;gap:6px}.youtube-local-empty-v2 strong{color:var(--theme-text);font-size:12px}.youtube-local-empty-v2 span{color:var(--theme-muted);font-size:10px;line-height:1.5}
      .youtube-local-details-v2{margin-top:12px;padding:10px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-field);display:grid;grid-template-columns:112px minmax(0,1fr);gap:11px;align-items:center}.youtube-local-details-v2[hidden]{display:none!important}.youtube-local-details-v2>img,.youtube-local-thumb-fallback-v2{width:112px;aspect-ratio:16/9;object-fit:cover;border-radius:9px;background:color-mix(in srgb,var(--theme-primary) 10%,var(--theme-field));display:grid;place-items:center;color:var(--theme-bright);font-weight:800}.youtube-local-details-v2 strong,.youtube-local-details-v2 span,.youtube-local-details-v2 small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.youtube-local-details-v2 strong{font-size:11px;color:var(--theme-text)}.youtube-local-details-v2 span{font-size:9px;color:var(--theme-muted);margin-top:3px}.youtube-local-details-v2 small{font-size:9px;color:var(--theme-faint);margin-top:3px}.youtube-local-actions-v2{margin-top:12px}
      @media(max-width:560px){.youtube-local-player-v2{min-height:190px}.youtube-local-details-v2{grid-template-columns:88px minmax(0,1fr)}.youtube-local-details-v2>img,.youtube-local-thumb-fallback-v2{width:88px}.youtube-local-actions-v2 .button{width:100%;justify-content:center}}
      @media(prefers-reduced-motion:reduce){.youtube-local-spinner-v2{animation:none}}
    `;
    document.head.appendChild(style);
  }
})();
