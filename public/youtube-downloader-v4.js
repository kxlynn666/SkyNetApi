(() => {
  if (window.__SKYNET_YOUTUBE_DOWNLOADER_V4__) return;
  window.__SKYNET_YOUTUBE_DOWNLOADER_V4__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/youtube') return;
  const S = window.SkyNet;
  if (!S) return;

  let currentItem = null;
  let queued = false;
  let observer = null;

  installStyles();
  updateHeading();
  ensurePage();

  const root = document.getElementById('workspaceContent');
  if (root) {
    observer = new MutationObserver(() => {
      if (document.getElementById('youtubeMediaFormV4') || queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; ensurePage(); });
    });
    observer.observe(root, { childList: true, subtree: false });
    setTimeout(() => observer?.disconnect(), 12000);
  }

  function updateHeading() {
    const apply = () => {
      document.getElementById('workspaceKicker')?.replaceChildren(document.createTextNode('Downloader'));
      document.getElementById('workspaceTitle')?.replaceChildren(document.createTextNode('YouTube Downloader'));
      document.getElementById('workspaceDescription')?.replaceChildren(document.createTextNode('Prepare vídeo MP4 ou áudio MP3 com yt-dlp e reproduza exatamente o arquivo validado pelo servidor.'));
      document.title = 'YouTube Downloader - SkyNetApi';
    };
    apply(); setTimeout(apply, 250); setTimeout(apply, 900);
  }

  function ensurePage() {
    const root = document.getElementById('workspaceContent');
    if (!root || document.getElementById('youtubeMediaFormV4')) return !!root;
    root.innerHTML = `
      <section class="workspace-page-grid youtube-media-grid-v4">
        <div class="workspace-card workspace-col-5">
          <div class="workspace-card-header"><div><h2>Preparar mídia</h2><p>Escolha vídeo ou áudio. O arquivo só é liberado depois da validação de integridade.</p></div></div>
          <div class="message" id="youtubeMediaMessageV4"></div>
          <form id="youtubeMediaFormV4">
            <div class="form-group"><label for="youtubeMediaUrlV4">Link do YouTube</label><input id="youtubeMediaUrlV4" type="url" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off" required></div>
            <div class="youtube-media-options-v4">
              <div class="form-group"><label for="youtubeMediaKindV4">Formato</label><select id="youtubeMediaKindV4"><option value="video">Vídeo · MP4</option><option value="audio">Áudio · MP3</option></select></div>
              <div class="form-group" id="youtubeMediaQualityGroupV4"><label for="youtubeMediaQualityV4">Qualidade do vídeo</label><select id="youtubeMediaQualityV4"><option value="360">360p</option><option value="720" selected>720p</option><option value="1080">1080p</option></select></div>
            </div>
            <button class="button primary youtube-media-submit-v4" id="youtubeMediaSubmitV4" type="submit">Preparar vídeo com yt-dlp</button>
          </form>
          <div class="youtube-media-process-v4" id="youtubeMediaProcessV4" hidden><span class="youtube-media-spinner-v4" aria-hidden="true"></span><div><strong id="youtubeMediaProcessTitleV4">Baixando e validando...</strong><small>yt-dlp grava primeiro em arquivo parcial; depois o FFmpeg verifica a mídia e o servidor calcula SHA-256 antes de liberar.</small></div></div>
          <p class="hint youtube-rights-note-v4">Baixe somente conteúdo seu, em domínio público ou que você tenha permissão para salvar.</p>
        </div>
        <div class="workspace-card workspace-col-7">
          <div class="workspace-card-header"><div><h2>Arquivo preparado</h2><p id="youtubeMediaMetaV4">Nenhuma mídia carregada.</p></div></div>
          <div class="workspace-media-player youtube-media-player-v4" id="youtubeMediaPlayerV4"><div class="youtube-media-empty-v4"><strong>Arquivo local validado</strong><span>O player aparece somente depois da preparação terminar.</span></div></div>
          <div class="youtube-media-details-v4" id="youtubeMediaDetailsV4" hidden></div>
          <div class="youtube-media-integrity-v4" id="youtubeMediaIntegrityV4" hidden></div>
          <div class="workspace-tool-actions youtube-media-actions-v4"><a class="button primary hidden" id="youtubeMediaDownloadV4" href="#" download>Baixar</a><a class="button hidden" id="youtubeMediaOpenV4" href="#" target="_blank" rel="noopener">Abrir no YouTube</a></div>
        </div>
      </section>`;
    bindPage();
    return true;
  }

  function bindPage() {
    const form = document.getElementById('youtubeMediaFormV4');
    const kind = document.getElementById('youtubeMediaKindV4');
    const quality = document.getElementById('youtubeMediaQualityV4');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', prepareMedia);
    kind?.addEventListener('change', syncKindUi);
    quality?.addEventListener('change', warnReprepare);
    syncKindUi();
  }

  function syncKindUi() {
    const kind = document.getElementById('youtubeMediaKindV4')?.value || 'video';
    const group = document.getElementById('youtubeMediaQualityGroupV4');
    const button = document.getElementById('youtubeMediaSubmitV4');
    if (group) group.hidden = kind === 'audio';
    if (button && !button.disabled) button.textContent = kind === 'audio' ? 'Preparar áudio MP3 com yt-dlp' : 'Preparar vídeo com yt-dlp';
    if (currentItem) warnReprepare();
  }

  function warnReprepare() {
    if (!currentItem) return;
    S.message(document.getElementById('youtubeMediaMessageV4'), 'Formato ou qualidade alterados. Prepare novamente para gerar outro arquivo.', 'warning');
  }

  async function prepareMedia(event) {
    event.preventDefault();
    const url = String(document.getElementById('youtubeMediaUrlV4')?.value || '').trim();
    const kind = document.getElementById('youtubeMediaKindV4')?.value === 'audio' ? 'audio' : 'video';
    const height = Number(document.getElementById('youtubeMediaQualityV4')?.value || 720);
    const message = document.getElementById('youtubeMediaMessageV4');
    if (!url) return;

    currentItem = null;
    setBusy(true, kind);
    resetResult(kind === 'audio' ? 'Preparando o áudio MP3...' : 'Preparando o vídeo MP4...');
    try {
      const data = await S.api('/painel/youtube-prepare', { method: 'POST', body: { url, kind, height } });
      currentItem = data.item || null;
      if (!currentItem?.streamUrl || !currentItem?.downloadUrl) throw new Error('O servidor não retornou o arquivo preparado.');
      renderItem(currentItem);
      const label = currentItem.kind === 'audio' ? 'MP3' : 'MP4';
      S.message(message, `${label} pronto e validado. O player e o download usam exatamente o mesmo arquivo.`, 'success');
    } catch (error) {
      resetResult('Não foi possível preparar a mídia.');
      S.message(message, error.message || 'Não foi possível preparar a mídia.', 'error');
    } finally {
      setBusy(false, kind);
    }
  }

  function renderItem(item) {
    const isAudio = item.kind === 'audio';
    const player = document.getElementById('youtubeMediaPlayerV4');
    const details = document.getElementById('youtubeMediaDetailsV4');
    const meta = document.getElementById('youtubeMediaMetaV4');
    const integrity = document.getElementById('youtubeMediaIntegrityV4');
    const download = document.getElementById('youtubeMediaDownloadV4');
    const open = document.getElementById('youtubeMediaOpenV4');
    const quality = document.getElementById('youtubeMediaQualityV4');

    if (player) {
      player.classList.toggle('audio', isAudio);
      player.innerHTML = isAudio
        ? `<div class="youtube-audio-card-v4">${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : '<div class="youtube-media-thumb-fallback-v4">♪</div>'}<audio controls preload="metadata" src="${esc(item.streamUrl)}"></audio></div>`
        : `<video controls playsinline preload="metadata" ${item.thumbnail ? `poster="${esc(item.thumbnail)}"` : ''} src="${esc(item.streamUrl)}"></video>`;
    }
    if (meta) meta.textContent = `${item.uploader || 'YouTube'}${item.duration ? ` · ${formatDuration(item.duration)}` : ''} · ${item.selectedLabel || (isAudio ? 'MP3' : 'MP4')}`;
    if (details) {
      details.hidden = false;
      details.innerHTML = `${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : '<div class="youtube-media-thumb-fallback-v4">YT</div>'}<div><strong>${esc(item.title || 'Mídia do YouTube')}</strong><span>${esc(item.uploader || 'YouTube')}</span><small>${item.size ? esc(S.formatSize(item.size)) : ''}${item.duration ? ` · ${esc(formatDuration(item.duration))}` : ''}</small></div>`;
    }
    if (integrity) {
      const checksum = String(item.checksum || '');
      integrity.hidden = !checksum;
      integrity.innerHTML = checksum ? `<strong>Integridade verificada</strong><span>SHA-256: <code>${esc(checksum.slice(0, 16))}…</code> · arquivo finalizado antes de ser publicado</span>` : '';
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
    const player = document.getElementById('youtubeMediaPlayerV4');
    if (player) { player.classList.remove('audio'); player.innerHTML = `<div class="youtube-media-empty-v4"><strong>Arquivo local validado</strong><span>${esc(text || 'Nenhuma mídia carregada.')}</span></div>`; }
    const details = document.getElementById('youtubeMediaDetailsV4');
    if (details) { details.hidden = true; details.innerHTML = ''; }
    const integrity = document.getElementById('youtubeMediaIntegrityV4');
    if (integrity) { integrity.hidden = true; integrity.innerHTML = ''; }
    const meta = document.getElementById('youtubeMediaMetaV4');
    if (meta) meta.textContent = text || 'Nenhuma mídia carregada.';
    document.getElementById('youtubeMediaDownloadV4')?.classList.add('hidden');
    document.getElementById('youtubeMediaOpenV4')?.classList.add('hidden');
  }

  function setBusy(value, kind) {
    const button = document.getElementById('youtubeMediaSubmitV4');
    const process = document.getElementById('youtubeMediaProcessV4');
    const form = document.getElementById('youtubeMediaFormV4');
    const title = document.getElementById('youtubeMediaProcessTitleV4');
    if (button) {
      button.disabled = value;
      button.textContent = value ? 'Baixando e validando...' : (kind === 'audio' ? 'Preparar áudio MP3 com yt-dlp' : 'Preparar vídeo com yt-dlp');
    }
    if (title) title.textContent = kind === 'audio' ? 'Preparando áudio MP3...' : 'Preparando vídeo MP4...';
    if (process) process.hidden = !value;
    form?.querySelectorAll('input,select').forEach(element => { element.disabled = value; });
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds || 0)));
    const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), rest = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function esc(value) { return S.escapeHtml(value == null ? '' : String(value)); }

  function installStyles() {
    if (document.getElementById('youtubeDownloaderV4Styles')) return;
    const style = document.createElement('style');
    style.id = 'youtubeDownloaderV4Styles';
    style.textContent = `
      .youtube-media-grid-v4{align-items:start}.youtube-media-options-v4{display:grid;grid-template-columns:1fr 1fr;gap:10px}.youtube-media-options-v4 [hidden]{display:none!important}.youtube-media-submit-v4{width:100%;justify-content:center}.youtube-rights-note-v4{margin-top:13px;line-height:1.55}
      .youtube-media-process-v4{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;margin-top:12px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--theme-primary) 24%,var(--theme-border));border-radius:12px;background:color-mix(in srgb,var(--theme-primary) 7%,var(--theme-field))}.youtube-media-process-v4[hidden]{display:none!important}.youtube-media-process-v4 strong,.youtube-media-process-v4 small{display:block}.youtube-media-process-v4 strong{font-size:10px;color:var(--theme-text)}.youtube-media-process-v4 small{font-size:9px;line-height:1.45;color:var(--theme-muted);margin-top:2px}
      .youtube-media-spinner-v4{width:18px;height:18px;border:2px solid color-mix(in srgb,var(--theme-primary) 18%,transparent);border-top-color:var(--theme-primary);border-radius:50%;animation:youtubeMediaSpinV4 .75s linear infinite}@keyframes youtubeMediaSpinV4{to{transform:rotate(360deg)}}
      .youtube-media-player-v4{min-height:260px;display:grid;place-items:center;background:color-mix(in srgb,var(--theme-bg) 92%,#000);border:1px solid var(--theme-border-soft);border-radius:14px;overflow:hidden}.youtube-media-player-v4 video{width:100%;max-height:64vh;aspect-ratio:16/9;background:#000;display:block}.youtube-media-player-v4.audio{padding:18px}.youtube-audio-card-v4{width:min(100%,520px);display:grid;gap:14px}.youtube-audio-card-v4>img,.youtube-media-thumb-fallback-v4{width:100%;max-height:280px;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:var(--theme-field);display:grid;place-items:center;font-size:32px;color:var(--theme-bright)}.youtube-audio-card-v4 audio{width:100%}.youtube-media-empty-v4{padding:28px;text-align:center;display:grid;gap:6px}.youtube-media-empty-v4 strong{color:var(--theme-text);font-size:12px}.youtube-media-empty-v4 span{color:var(--theme-muted);font-size:10px;line-height:1.5}
      .youtube-media-details-v4{margin-top:12px;padding:10px;border:1px solid var(--theme-border-soft);border-radius:12px;background:var(--theme-field);display:grid;grid-template-columns:112px minmax(0,1fr);gap:11px;align-items:center}.youtube-media-details-v4[hidden]{display:none!important}.youtube-media-details-v4>img,.youtube-media-details-v4>.youtube-media-thumb-fallback-v4{width:112px;aspect-ratio:16/9;object-fit:cover;border-radius:9px}.youtube-media-details-v4 strong,.youtube-media-details-v4 span,.youtube-media-details-v4 small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.youtube-media-details-v4 strong{font-size:11px;color:var(--theme-text)}.youtube-media-details-v4 span{font-size:9px;color:var(--theme-muted);margin-top:3px}.youtube-media-details-v4 small{font-size:9px;color:var(--theme-faint);margin-top:3px}
      .youtube-media-integrity-v4{margin-top:10px;padding:9px 10px;border:1px solid color-mix(in srgb,var(--theme-primary) 22%,var(--theme-border-soft));border-radius:10px;background:color-mix(in srgb,var(--theme-primary) 6%,var(--theme-field))}.youtube-media-integrity-v4[hidden]{display:none!important}.youtube-media-integrity-v4 strong,.youtube-media-integrity-v4 span{display:block}.youtube-media-integrity-v4 strong{font-size:9px;color:var(--theme-bright)}.youtube-media-integrity-v4 span{font-size:8px;color:var(--theme-muted);margin-top:3px}.youtube-media-integrity-v4 code{font-size:8px}.youtube-media-actions-v4{margin-top:12px}
      @media(max-width:560px){.youtube-media-options-v4{grid-template-columns:1fr}.youtube-media-player-v4{min-height:190px}.youtube-media-details-v4{grid-template-columns:88px minmax(0,1fr)}.youtube-media-details-v4>img,.youtube-media-details-v4>.youtube-media-thumb-fallback-v4{width:88px}.youtube-media-actions-v4 .button{width:100%;justify-content:center}}
      @media(prefers-reduced-motion:reduce){.youtube-media-spinner-v4{animation:none}}
    `;
    document.head.appendChild(style);
  }
})();
