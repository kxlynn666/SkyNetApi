(() => {
  if (window.__SKYNET_YOUTUBE_SEARCH_V1__) return;
  window.__SKYNET_YOUTUBE_SEARCH_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/youtube') return;
  const S = window.SkyNet;
  if (!S) return;

  let observer = null;
  let queued = false;

  installStyles();
  ensureSearch();

  const root = document.getElementById('workspaceContent');
  if (root) {
    observer = new MutationObserver(() => {
      if (document.getElementById('youtubeSearchV1') || queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        ensureSearch();
      });
    });
    observer.observe(root, { childList: true, subtree: false });
    setTimeout(() => observer?.disconnect(), 15000);
  }

  function ensureSearch() {
    const root = document.getElementById('workspaceContent');
    if (!root || document.getElementById('youtubeSearchV1')) return !!root;
    const mediaGrid = root.querySelector('.youtube-media-grid-v4');
    if (!mediaGrid) {
      setTimeout(ensureSearch, 120);
      return false;
    }

    const section = document.createElement('section');
    section.id = 'youtubeSearchV1';
    section.className = 'workspace-card youtube-search-v1';
    section.innerHTML = `
      <div class="workspace-card-header">
        <div>
          <h2>Pesquisar no YouTube</h2>
          <p>yt-dlp <code>ytsearch10:</code> · até 10 resultados completos.</p>
        </div>
      </div>
      <form class="youtube-search-form-v1" id="youtubeSearchFormV1">
        <div class="form-group youtube-search-field-v1">
          <label for="youtubeSearchQueryV1">Termo de pesquisa</label>
          <input id="youtubeSearchQueryV1" type="search" minlength="2" maxlength="160" autocomplete="off" placeholder="Ex.: nome da música, artista, vídeo..." required>
        </div>
        <button class="button primary youtube-search-button-v1" id="youtubeSearchButtonV1" type="submit">Pesquisar 10 resultados</button>
      </form>
      <div class="message" id="youtubeSearchMessageV1"></div>
      <div class="youtube-search-results-v1" id="youtubeSearchResultsV1" hidden></div>`;

    root.insertBefore(section, mediaGrid);
    bindSearch();
    return true;
  }

  function bindSearch() {
    const form = document.getElementById('youtubeSearchFormV1');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', runSearch);
  }

  async function runSearch(event) {
    event.preventDefault();
    const input = document.getElementById('youtubeSearchQueryV1');
    const results = document.getElementById('youtubeSearchResultsV1');
    const message = document.getElementById('youtubeSearchMessageV1');
    const button = document.getElementById('youtubeSearchButtonV1');
    const query = String(input?.value || '').trim();
    if (query.length < 2) return;

    if (button) {
      button.disabled = true;
      button.textContent = 'Pesquisando com yt-dlp...';
    }
    if (results) {
      results.hidden = false;
      results.innerHTML = '<div class="youtube-search-loading-v1">Consultando <code>ytsearch10:</code>…</div>';
    }
    S.message(message, '', '');

    try {
      const data = await S.api(`/painel/youtube-search?q=${encodeURIComponent(query)}`);
      const items = Array.isArray(data.results) ? data.results.slice(0, 10) : [];
      renderResults(items);
      S.message(message, `${items.length} resultado${items.length === 1 ? '' : 's'} encontrado${items.length === 1 ? '' : 's'} para “${query}”.`, 'success');
    } catch (error) {
      if (results) results.innerHTML = '';
      S.message(message, error.message || 'Não foi possível pesquisar no YouTube.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Pesquisar 10 resultados';
      }
    }
  }

  function renderResults(items) {
    const root = document.getElementById('youtubeSearchResultsV1');
    if (!root) return;
    root.hidden = false;
    if (!items.length) {
      root.innerHTML = '<div class="youtube-search-empty-v1">Nenhum resultado encontrado.</div>';
      return;
    }

    root.innerHTML = items.map((item, index) => {
      const views = item.viewCount ? `${formatNumber(item.viewCount)} visualizações` : 'Views indisponíveis';
      const likes = item.likeCount ? `${formatNumber(item.likeCount)} likes` : '';
      const comments = item.commentCount ? `${formatNumber(item.commentCount)} comentários` : '';
      const date = formatDate(item.uploadDate);
      const extras = [views, likes, comments, date].filter(Boolean).join(' · ');
      const badge = item.isLive ? 'AO VIVO' : (item.durationText || formatDuration(item.duration));
      return `
        <article class="youtube-search-card-v1" data-index="${index}">
          <div class="youtube-search-thumb-v1">
            ${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="" loading="lazy">` : '<div class="youtube-search-thumb-empty-v1">YT</div>'}
            ${badge ? `<span>${esc(badge)}</span>` : ''}
          </div>
          <div class="youtube-search-info-v1">
            <strong title="${esc(item.title || '')}">${esc(item.title || 'Vídeo do YouTube')}</strong>
            <div class="youtube-search-channel-v1">${esc(item.uploader || item.channel || 'YouTube')}</div>
            <div class="youtube-search-meta-v1">${esc(extras)}</div>
            ${item.description ? `<p>${esc(item.description)}</p>` : ''}
            <div class="youtube-search-actions-v1">
              <button class="button primary" type="button" data-use-url="${esc(item.url || '')}">Usar no downloader</button>
              <a class="button" href="${esc(item.url || '#')}" target="_blank" rel="noopener">Abrir no YouTube</a>
            </div>
          </div>
        </article>`;
    }).join('');

    root.querySelectorAll('[data-use-url]').forEach(button => {
      button.addEventListener('click', () => useResult(button.getAttribute('data-use-url') || ''));
    });
  }

  function useResult(url) {
    const input = document.getElementById('youtubeMediaUrlV4');
    const message = document.getElementById('youtubeMediaMessageV4');
    if (!input || !url) return;
    input.value = url;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    S.message(message, 'Resultado selecionado. Escolha Vídeo MP4 ou Áudio MP3 e prepare o arquivo.', 'success');
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => input.focus(), 350);
  }

  function formatNumber(value) {
    const number = Math.max(0, Number(value || 0) || 0);
    try { return new Intl.NumberFormat('pt-BR').format(number); }
    catch { return String(Math.round(number)); }
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds || 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
      : `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
    try { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00Z`)); }
    catch { return value; }
  }

  function esc(value) {
    return S.escapeHtml(value == null ? '' : String(value));
  }

  function installStyles() {
    if (document.getElementById('youtubeSearchV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'youtubeSearchV1Styles';
    style.textContent = `
      .youtube-search-v1{margin-bottom:14px}.youtube-search-form-v1{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}.youtube-search-field-v1{margin:0}.youtube-search-button-v1{min-height:40px}.youtube-search-results-v1{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.youtube-search-results-v1[hidden]{display:none!important}.youtube-search-card-v1{display:grid;grid-template-columns:180px minmax(0,1fr);gap:11px;padding:9px;border:1px solid var(--theme-border-soft);border-radius:13px;background:var(--theme-field);min-width:0}.youtube-search-thumb-v1{position:relative;align-self:start;aspect-ratio:16/9;border-radius:9px;overflow:hidden;background:color-mix(in srgb,var(--theme-primary) 9%,#000)}.youtube-search-thumb-v1 img,.youtube-search-thumb-empty-v1{width:100%;height:100%;object-fit:cover;display:grid;place-items:center}.youtube-search-thumb-v1 span{position:absolute;right:5px;bottom:5px;padding:2px 5px;border-radius:5px;background:rgba(0,0,0,.82);color:#fff;font-size:9px;font-weight:700}.youtube-search-info-v1{min-width:0;display:flex;flex-direction:column}.youtube-search-info-v1>strong{font-size:11px;line-height:1.35;color:var(--theme-text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.youtube-search-channel-v1{font-size:9px;color:var(--theme-muted);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.youtube-search-meta-v1{font-size:8.5px;color:var(--theme-faint);margin-top:3px;line-height:1.4}.youtube-search-info-v1 p{font-size:8.5px;color:var(--theme-muted);line-height:1.4;margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.youtube-search-actions-v1{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:8px}.youtube-search-actions-v1 .button{font-size:9px;min-height:30px;padding:6px 9px}.youtube-search-loading-v1,.youtube-search-empty-v1{grid-column:1/-1;padding:18px;text-align:center;color:var(--theme-muted);border:1px dashed var(--theme-border-soft);border-radius:12px}
      @media(max-width:920px){.youtube-search-results-v1{grid-template-columns:1fr}.youtube-search-card-v1{grid-template-columns:160px minmax(0,1fr)}}
      @media(max-width:560px){.youtube-search-form-v1{grid-template-columns:1fr}.youtube-search-button-v1{width:100%;justify-content:center}.youtube-search-card-v1{grid-template-columns:1fr}.youtube-search-thumb-v1{width:100%}.youtube-search-actions-v1 .button{flex:1;justify-content:center}}
    `;
    document.head.appendChild(style);
  }
})();
