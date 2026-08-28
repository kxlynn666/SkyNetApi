(() => {
  if (window.__SKYNET_YOUTUBE_DOWNLOADER_V1__) return;
  window.__SKYNET_YOUTUBE_DOWNLOADER_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/youtube') return;
  const S = window.SkyNet;
  if (!S) return;

  let installed = false;
  let currentItem = null;
  let requestId = 0;
  let observer = null;

  installStyle();
  if (!tryInstall()) {
    const root = document.getElementById('workspaceContent') || document.documentElement;
    observer = new MutationObserver(() => tryInstall());
    observer.observe(root, { childList: true, subtree: true });
  }

  function tryInstall() {
    if (installed) return true;
    const form = document.getElementById('youtubeForm');
    const player = document.getElementById('youtubePlayer');
    if (!form || !player) return false;
    installed = true;
    observer?.disconnect();
    observer = null;
    enhanceLayout(form, player);
    form.addEventListener('submit', analyzeForDownload);
    return true;
  }

  function enhanceLayout(form, player) {
    const leftCard = form.closest('.workspace-card');
    const rightCard = player.closest('.workspace-card');
    if (leftCard && !leftCard.querySelector('.youtube-rights-note-v1')) {
      const note = document.createElement('p');
      note.className = 'hint youtube-rights-note-v1';
      note.textContent = 'Baixe apenas vídeos seus, em domínio público ou que você tenha permissão para salvar. Vídeos privados, Premium, 18+, lives e playlists não são aceitos.';
      form.insertAdjacentElement('afterend', note);
    }

    if (rightCard && !document.getElementById('youtubeDownloadPanelV1')) {
      const panel = document.createElement('section');
      panel.id = 'youtubeDownloadPanelV1';
      panel.className = 'youtube-download-panel-v1';
      panel.hidden = true;
      panel.innerHTML = `
        <div class="youtube-download-meta-v1">
          <div class="youtube-download-thumb-v1" id="youtubeDownloadThumbV1"></div>
          <div class="youtube-download-copy-v1">
            <strong id="youtubeDownloadTitleV1">Vídeo</strong>
            <span id="youtubeDownloadAuthorV1"></span>
            <small id="youtubeDownloadDurationV1"></small>
          </div>
        </div>
        <div class="youtube-download-controls-v1">
          <label><span>Qualidade</span><select id="youtubeQualityV1" aria-label="Qualidade do vídeo"></select></label>
          <a class="button primary" id="youtubeDownloadV1" href="#">Baixar vídeo</a>
        </div>`;
      const actions = rightCard.querySelector('.workspace-tool-actions');
      if (actions) actions.insertAdjacentElement('beforebegin', panel);
      else rightCard.appendChild(panel);
      panel.querySelector('#youtubeQualityV1')?.addEventListener('change', syncDownloadLink);
      panel.querySelector('#youtubeDownloadV1')?.addEventListener('click', event => {
        if (!currentItem?.downloads?.length) event.preventDefault();
      });
    }
  }

  async function analyzeForDownload() {
    const localId = ++requestId;
    const input = document.getElementById('youtubeUrl');
    const panel = document.getElementById('youtubeDownloadPanelV1');
    const message = document.getElementById('youtubeMessage');
    const url = String(input?.value || '').trim();
    if (!url) return;

    currentItem = null;
    if (panel) panel.hidden = true;
    setBusy(true);
    try {
      const data = await S.api('/painel/youtube-info', { method: 'POST', body: { url } });
      if (localId !== requestId) return;
      currentItem = data.item || null;
      renderItem();
      if (message) S.message(message, 'Vídeo pronto para assistir ou baixar.', 'success');
    } catch (error) {
      if (localId !== requestId) return;
      currentItem = null;
      if (panel) panel.hidden = true;
      if (message) S.message(message, error.message || 'Não foi possível preparar o download.', 'error');
    } finally {
      if (localId === requestId) setBusy(false);
    }
  }

  function renderItem() {
    const item = currentItem;
    const panel = document.getElementById('youtubeDownloadPanelV1');
    if (!item || !panel) return;

    const title = document.getElementById('youtubeDownloadTitleV1');
    const author = document.getElementById('youtubeDownloadAuthorV1');
    const duration = document.getElementById('youtubeDownloadDurationV1');
    const thumb = document.getElementById('youtubeDownloadThumbV1');
    const select = document.getElementById('youtubeQualityV1');
    const player = document.getElementById('youtubePlayer');
    const idText = document.getElementById('youtubeId');
    const open = document.getElementById('youtubeOpen');

    if (title) title.textContent = item.title || 'Vídeo do YouTube';
    if (author) author.textContent = item.uploader || 'YouTube';
    if (duration) duration.textContent = item.duration ? formatDuration(item.duration) : '';
    if (thumb) thumb.innerHTML = item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="">` : '<span>YT</span>';
    if (select) select.innerHTML = (item.downloads || []).map(option => `<option value="${esc(option.downloadUrl)}">${esc(option.label)} · ${esc(option.container || 'MP4')}</option>`).join('');

    if (player && item.embedUrl) {
      player.innerHTML = `<iframe src="${esc(item.embedUrl)}" title="Player do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    }
    if (idText) idText.textContent = `${item.uploader || 'YouTube'}${item.duration ? ` · ${formatDuration(item.duration)}` : ''}`;
    if (open && item.canonicalUrl) open.href = item.canonicalUrl;

    syncDownloadLink();
    panel.hidden = false;
  }

  function syncDownloadLink() {
    const select = document.getElementById('youtubeQualityV1');
    const link = document.getElementById('youtubeDownloadV1');
    if (!link) return;
    const href = String(select?.value || '');
    link.href = href || '#';
    link.classList.toggle('disabled', !href);
    link.setAttribute('aria-disabled', href ? 'false' : 'true');
  }

  function setBusy(value) {
    const button = document.querySelector('#youtubeForm button[type="submit"]');
    if (!button) return;
    button.disabled = value;
    button.textContent = value ? 'Analisando...' : 'Carregar';
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

  function installStyle() {
    if (document.getElementById('youtubeDownloaderV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'youtubeDownloaderV1Styles';
    style.textContent = `
      .youtube-rights-note-v1{margin-top:12px;line-height:1.55}
      .youtube-download-panel-v1{margin-top:14px;padding:13px;border:1px solid var(--theme-border-soft,var(--border-soft));border-radius:14px;background:color-mix(in srgb,var(--theme-panel,var(--bg-panel,#17102b)) 88%,transparent);display:grid;gap:12px}
      .youtube-download-panel-v1[hidden]{display:none!important}
      .youtube-download-meta-v1{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;align-items:center}
      .youtube-download-thumb-v1{width:112px;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:var(--theme-field,var(--bg-field,#21183b));display:grid;place-items:center;color:var(--theme-bright,var(--violet-bright,#c4b5fd));font-weight:800}
      .youtube-download-thumb-v1 img{width:100%;height:100%;object-fit:cover;display:block}
      .youtube-download-copy-v1{min-width:0}.youtube-download-copy-v1 strong,.youtube-download-copy-v1 span,.youtube-download-copy-v1 small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .youtube-download-copy-v1 strong{font-size:12px;color:var(--theme-text,var(--text))}.youtube-download-copy-v1 span{font-size:10px;color:var(--theme-muted,var(--text-muted));margin-top:3px}.youtube-download-copy-v1 small{font-size:9px;color:var(--theme-faint,var(--text-faint));margin-top:3px}
      .youtube-download-controls-v1{display:grid;grid-template-columns:minmax(150px,220px) auto;gap:9px;align-items:end}.youtube-download-controls-v1 label{display:grid;gap:5px}.youtube-download-controls-v1 label>span{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--theme-faint,var(--text-faint))}.youtube-download-controls-v1 select{min-height:40px!important}.youtube-download-controls-v1 .button{min-height:40px;justify-content:center}.youtube-download-controls-v1 .button.disabled{pointer-events:none;opacity:.55}
      #youtubePlayer iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:12px;display:block}
      @media(max-width:560px){.youtube-download-meta-v1{grid-template-columns:92px minmax(0,1fr)}.youtube-download-thumb-v1{width:92px}.youtube-download-controls-v1{grid-template-columns:1fr}.youtube-download-controls-v1 .button{width:100%}}
    `;
    document.head.appendChild(style);
  }
})();
