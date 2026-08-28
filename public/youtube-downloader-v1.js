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
      if (document.getElementById('youtubeLocalFormV3')) return;
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
      if (description) description.textContent = 'Prepare vídeo MP4 ou áudio MP3 com yt-dlp e use no site exatamente o arquivo validado pelo servidor.';
      document.title = 'YouTube Downloader - SkyNetApi';
    };
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 900);
  }

  function ensurePage() {
    const root = document.getElementById('workspaceContent');
    if (!root) return false;
    if (document.getElementById('youtubeLocalFormV3')) return true;

    root.innerHTML = `
      <section class="workspace-page-grid youtube-local-grid-v3">
        <div class="workspace-card workspace-col-5">
          <div class="workspace-card-header"><div><h2>Preparar mídia</h2><p>Escolha vídeo MP4 ou áudio MP3. O arquivo só é liberado depois da verificação de integridade.</p></div></div>
          <div class="message" id="youtubeLocalMessageV3"></div>
          <form id="youtubeLocalFormV3">
            <div class="form-group">
              <label for="youtubeLocalUrlV3">Link do YouTube</label>
              <input id="youtubeLocalUrlV3" type="url" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off" required>
            </div>
            <div class="form-group">
              <label for="youtubeLocalModeV3">Tipo de arquivo</label>
              <select id="youtubeLocalModeV3">
                <option value="video" selected>Vídeo · MP4</option>
                <option value="audio">Áudio · MP3</option>
              </select>
            </div>
            <div class="form-group" id="youtubeLocalQualityGroupV3">
              <label for="youtubeLocalQualityV3">Qualidade do vídeo</label>
              <select id="youtubeLocalQualityV3">
                <option value="360">360p</option>
                <option value="720" selected>720p</option>
                <option value="1080">1080p</option>
              </select>
            </div>
            <button class="button primary youtube-local-submit-v3" id="youtubeLocalSubmitV3" type="submit">Preparar MP4 com yt-dlp</button>
          </form>
          <div class="youtube-local-process-v3" id="youtubeLocalProcessV3" hidden>
            <span class="youtube-local-spinner-v3" aria-hidden="true"></span>
            <div><strong id="youtubeLocalProcessTitleV3">Preparando arquivo...</strong><small id="youtubeLocalProcessTextV3">O yt-dlp baixa em arquivo parcial, o FFmpeg valida a mídia completa e o servidor confirma SHA-256 antes de liberar.</small></div>
          </div>
          <div class="youtube-integrity-note-v3">
            <strong>Proteção contra arquivo incompleto</strong>
            <span>O site não expõe arquivos <code>.part</code>. Depois do yt-dlp, o arquivo é decodificado pelo FFmpeg, finalizado de forma atômica e recebe checksum SHA-256.</span>
          </div>
          <p class="hint youtube-rights-note-v3">Baixe apenas conteúdo seu, em domínio público ou que você tenha permissão para salvar. Conteúdo privado, Premium, 18+, lives em andamento e playlists não são aceitos.</p>
        </div>

        <div class="workspace-card workspace-col-7">
          <div class="workspace-card-header"><div><h2>Arquivo preparado</h2><p id="youtubeLocalMetaV3">Nenhuma mídia carregada.</p></div></div>
          <div class="workspace-media-player youtube-local-player-v3" id="youtubeLocalPlayerV3">
            <div class="youtube-local-empty-v3"><strong>MP4 ou MP3 local</strong><span>Cole um link, escolha o formato e aguarde a validação terminar.</span></div>
          </div>
          <div class="youtube-local-details-v3" id="youtubeLocalDetailsV3" hidden></div>
          <div class="workspace-tool-actions youtube-local-actions-v3">
            <a class="button primary hidden" id="youtubeLocalDownloadV3" href="#" download>Baixar arquivo</a>
            <a class="button hidden" id="youtubeLocalOpenV3" href="#" target="_blank" rel="noopener">Abrir no YouTube</a>
          </div>
        </div>
      </section>`;

    bindPage();
    return true;
  }

  function bindPage() {
    const form = document.getElementById('youtubeLocalFormV3');
    const mode = document.getElementById('youtubeLocalModeV3');
    const quality = document.getElementById('youtubeLocalQualityV3');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', prepareMedia);
    mode?.addEventListener('change', syncModeUi);
    quality?.addEventListener('change', () => {
      if (!currentItem || mode?.value !== 'video') return;
      const message = document.getElementById('youtubeLocalMessageV3');
      S.message(message, 'Qualidade alterada. Prepare novamente para gerar outro MP4.', 'warning');
    });
    syncModeUi();
  }

  function syncModeUi() {
    const mode = document.getElementById('youtubeLocalModeV3')?.value === 'audio' ? 'audio' : 'video';
    const qualityGroup = document.getElementById('youtubeLocalQualityGroupV3');
    const button = document.getElementById('youtubeLocalSubmitV3');
    if (qualityGroup) qualityGroup.hidden = mode === 'audio';
    if (button && !button.disabled) button.textContent = mode === 'audio' ? 'Preparar MP3 com yt-dlp' : 'Preparar MP4 com yt-dlp';
  }

  async function prepareMedia(event) {
    event.preventDefault();
    const input = document.getElementById('youtubeLocalUrlV3');
    const modeSelect = document.getElementById('youtubeLocalModeV3');
    const quality = document.getElementById('youtubeLocalQualityV3');
    const message = document.getElementById('youtubeLocalMessageV3');
    const url = String(input?.value || '').trim();
    const mode = modeSelect?.value === 'audio' ? 'audio' : 'video';
    if (!url) return;

    currentItem = null;
    setBusy(true, mode);
    resetResult(mode === 'audio' ? 'Baixando o áudio com yt-dlp...' : 'Baixando o vídeo com yt-dlp...');
    try {
      const data = await S.api('/painel/youtube-prepare', {
        method: 'POST',
        body: { url, mode, height: mode === 'video' ? Number(quality?.value || 720) : undefined }
      });
      currentItem = data.item || null;
      if (!currentItem?.streamUrl || !currentItem?.downloadUrl || !currentItem?.sha256) {
        throw new Error('O servidor não retornou um arquivo validado.');
      }
      renderItem(currentItem);
      S.message(message, `${currentItem.formatLabel || 'Arquivo'} pronto e verificado. Player e download usam o mesmo arquivo validado.`, 'success');
    } catch (error) {
      resetResult('Não foi possível preparar a mídia.');
      S.message(message, error.message || 'Não foi possível preparar a mídia.', 'error');
    } finally {
      setBusy(false, mode);
    }
  }

  function renderItem(item) {
    const player = document.getElementById('youtubeLocalPlayerV3');
    const details = document.getElementById('youtubeLocalDetailsV3');
    const meta = document.getElementById('youtubeLocalMetaV3');
    const download = document.getElementById('youtubeLocalDownloadV3');
    const open = document.getElementById('youtubeLocalOpenV3');
    const quality = document.getElementById('youtubeLocalQualityV3');
    const isAudio = item.kind === 'audio';

    if (player) {
      if (isAudio) {
        player.innerHTML = `
          <div class="youtube-local-audio-shell-v3">
            ${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : '<div class="youtube-local-audio-art-v3">♪</div>'}
            <div class="youtube-local-audio-copy-v3"><strong>${esc(item.title || 'Áudio do YouTube')}</strong><span>${esc(item.uploader || 'YouTube')}</span></div>
            <audio controls preload="metadata" src="${esc(item.streamUrl)}"></audio>
          </div>`;
      } else {
        player.innerHTML = `<video controls playsinline preload="metadata" ${item.thumbnail ? `poster="${esc(item.thumbnail)}"` : ''} src="${esc(item.streamUrl)}"></video>`;
      }
    }

    if (meta) meta.textContent = `${item.uploader || 'YouTube'}${item.duration ? ` · ${formatDuration(item.duration)}` : ''} · ${item.formatLabel || (isAudio ? 'MP3' : 'MP4')}`;
    if (details) {
      details.hidden = false;
      const checksum = String(item.sha256 || '');
      details.innerHTML = `
        ${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : '<div class="youtube-local-thumb-fallback-v3">YT</div>'}
        <div>
          <strong>${esc(item.title || 'Mídia do YouTube')}</strong>
          <span>${esc(item.uploader || 'YouTube')}</span>
          <small>${item.size ? esc(S.formatSize(item.size)) : ''}${item.duration ? ` · ${esc(formatDuration(item.duration))}` : ''} · ${esc(item.formatLabel || '')}</small>
          <em class="youtube-integrity-badge-v3">✓ Integridade verificada${checksum ? ` · SHA-256 ${esc(checksum.slice(0, 12))}…` : ''}</em>
        </div>`;
    }
    if (download) {
      download.href = item.downloadUrl;
      download.textContent = isAudio ? 'Baixar MP3' : 'Baixar MP4';
      download.classList.remove('hidden');
      download.setAttribute('download', '');
    }
    if (open) {
      open.href = item.canonicalUrl || '#';
      open.classList.toggle('hidden', !item.canonicalUrl);
    }
    if (!isAudio && quality && Array.isArray(item.qualities) && item.qualities.length) {
      quality.innerHTML = item.qualities.map(option => `<option value="${Number(option.height)}" ${Number(option.height) === Number(item.selectedHeight) ? 'selected' : ''}>${esc(option.label || `${option.height}p`)}</option>`).join('');
    }
  }

  function resetResult(text) {
    const player = document.getElementById('youtubeLocalPlayerV3');
    const details = document.getElementById('youtubeLocalDetailsV3');
    const meta = document.getElementById('youtubeLocalMetaV3');
    const download = document.getElementById('youtubeLocalDownloadV3');
    const open = document.getElementById('youtubeLocalOpenV3');
    if (player) player.innerHTML = `<div class="youtube-local-empty-v3"><strong>MP4 ou MP3 local</strong><span>${esc(text || 'Nenhuma mídia carregada.')}</span></div>`;
    if (details) { details.hidden = true; details.innerHTML = ''; }
    if (meta) meta.textContent = text || 'Nenhuma mídia carregada.';
    download?.classList.add('hidden');
    open?.classList.add('hidden');
  }

  function setBusy(value, mode) {
    const button = document.getElementById('youtubeLocalSubmitV3');
    const process = document.getElementById('youtubeLocalProcessV3');
    const processTitle = document.getElementById('youtubeLocalProcessTitleV3');
    const processText = document.getElementById('youtubeLocalProcessTextV3');
    const form = document.getElementById('youtubeLocalFormV3');
    const isAudio = mode === 'audio';
    if (button) {
      button.disabled = value;
      button.textContent = value ? (isAudio ? 'Preparando MP3...' : 'Preparando MP4...') : (isAudio ? 'Preparar MP3 com yt-dlp' : 'Preparar MP4 com yt-dlp');
    }
    if (process) process.hidden = !value;
    if (processTitle) processTitle.textContent = isAudio ? 'Preparando áudio...' : 'Preparando vídeo...';
    if (processText) processText.textContent = 'O yt-dlp termina o arquivo parcial, o FFmpeg valida toda a mídia e o servidor confirma SHA-256 antes de liberar.';
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
    if (document.getElementById('youtubeDownloaderV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'youtubeDownloaderV3Styles';
    style.textContent = `
      .youtube-local-grid-v3{align-items:start}.youtube-local-submit-v3{width:100%;justify-content:center}.youtube-rights-note-v3{margin-top:13px;line-height:1.55}#youtubeLocalQualityGroupV3[hidden]{display:none!important}
      .youtube-local-process-v3{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;margin-top:12px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--theme-primary) 24%,var(--theme-border));border-radius:12px;background:color-mix(in srgb,var(--theme-primary) 7%,var(--theme-field))}.youtube-local-process-v3[hidden]{display:none!important}.youtube-local-process-v3 strong,.youtube-local-process-v3 small{display:block}.youtube-local-process-v3 strong{font-size:10px;color:var(--theme-text)}.youtube-local-process-v3 small{font-size:9px;line-height:1.45;color:var(--theme-muted);margin-top:2px}
      .youtube-local-spinner-v3{width:18px;height:18px;border:2px solid color-mix(in srgb,var(--theme-primary) 18%,transparent);border-top-color:var(--theme-primary);border-radius:50%;animation:youtubeLocalSpinV3 .75s linear infinite}@keyframes youtubeLocalSpinV3{to{transform:rotate(360deg)}}
      .youtube-integrity-note-v3{margin-top:12px;padding:10px 11px;border:1px solid color-mix(in srgb,var(--theme-bright) 22%,var(--theme-border-soft));border-radius:11px;background:color-mix(in srgb,var(--theme-bright) 5%,var(--theme-field));display:grid;gap:3px}.youtube-integrity-note-v3 strong{font-size:9px;color:var(--theme-text)}.youtube-integrity-note-v3 span{font-size:8.5px;color:var(--theme-muted);line-height:1.5}.youtube-integrity-note-v3 code{font-size:8px}
      .youtube-local-player-v3{min-height:260px;display:grid;place-items:center;background:color-mix(in srgb,var(--theme-bg) 92%,#000);border:1px solid var(--theme-border-soft);border-radius:14px;overflow:hidden}.youtube-local-player-v3 video{width:100%;max-height:64vh;aspect-ratio:16/9;background:#000;display:block}.youtube-local-empty-v3{padding:28px;text-align:center;display:grid;gap:6px}.youtube-local-empty-v3 strong{color:var(--theme-text);font-size:12px}.youtube-local-empty-v3 span{color:var(--theme-muted);font-size:10px;line-height:1.5}
      .youtube-local-audio-shell-v3{width:min(520px,100%);padding:22px;display:grid;grid-template-columns:92px minmax(0,1fr);gap:14px;align-items:center}.youtube-local-audio-shell-v3>img,.youtube-local-audio-art-v3{width:92px;aspect-ratio:1;border-radius:12px;object-fit:cover;background:color-mix(in srgb,var(--theme-primary) 12%,var(--theme-field));display:grid;place-items:center;font-size:26px;color:var(--theme-bright)}.youtube-local-audio-copy-v3{min-width:0}.youtube-local-audio-copy-v3 strong,.youtube-local-audio-copy-v3 span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.youtube-local-audio-copy-v3 strong{font-size:11px;color:var(--theme-text)}.youtube-local-audio-copy-v3 span{font-size:9px;color:var(--theme-muted);margin-top:4px}.youtube-local-audio-shell-v3 audio{grid-column:1/-1;width:100%;height:42px}
      .youtube-local-details-v3{margin-top:12px;padding:10px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-field);display:grid;grid-template-columns:112px minmax(0,1fr);gap:11px;align-items:center}.youtube-local-details-v3[hidden]{display:none!important}.youtube-local-details-v3>img,.youtube-local-thumb-fallback-v3{width:112px;aspect-ratio:16/9;object-fit:cover;border-radius:9px;background:color-mix(in srgb,var(--theme-primary) 10%,var(--theme-field));display:grid;place-items:center;color:var(--theme-bright);font-weight:800}.youtube-local-details-v3 strong,.youtube-local-details-v3 span,.youtube-local-details-v3 small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.youtube-local-details-v3 strong{font-size:11px;color:var(--theme-text)}.youtube-local-details-v3 span{font-size:9px;color:var(--theme-muted);margin-top:3px}.youtube-local-details-v3 small{font-size:9px;color:var(--theme-faint);margin-top:3px}.youtube-integrity-badge-v3{display:block;margin-top:5px;font-size:8px;font-style:normal;color:var(--theme-bright)}.youtube-local-actions-v3{margin-top:12px}
      @media(max-width:560px){.youtube-local-player-v3{min-height:190px}.youtube-local-details-v3{grid-template-columns:88px minmax(0,1fr)}.youtube-local-details-v3>img,.youtube-local-thumb-fallback-v3{width:88px}.youtube-local-actions-v3 .button{width:100%;justify-content:center}.youtube-local-audio-shell-v3{grid-template-columns:72px minmax(0,1fr);padding:16px}.youtube-local-audio-shell-v3>img,.youtube-local-audio-art-v3{width:72px}}
      @media(prefers-reduced-motion:reduce){.youtube-local-spinner-v3{animation:none}}
    `;
    document.head.appendChild(style);
  }
})();