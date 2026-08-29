(() => {
  if (window.__SKYNET_YOUTUBE_SEARCH_V1__) return;
  window.__SKYNET_YOUTUBE_SEARCH_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/youtube-search') return;
  const S = window.SkyNet;
  if (!S) return;

  installStyles();
  initPage();

  function initPage() {
    const root = document.getElementById('workspaceContent');
    if (!root) return setTimeout(initPage, 80);

    document.getElementById('workspaceKicker')?.replaceChildren(document.createTextNode('YouTube'));
    document.getElementById('workspaceTitle')?.replaceChildren(document.createTextNode('YouTube Search'));
    document.getElementById('workspaceDescription')?.replaceChildren(document.createTextNode('Pesquise com yt-dlp ytsearch10 e escolha um resultado para enviar ao downloader.'));
    document.title = 'YouTube Search - SkyNetApi';

    root.innerHTML = `
      <section class="workspace-card youtube-search-page-v2" id="youtubeSearchV1">
        <div class="workspace-card-header">
          <div>
            <h2>Pesquisar no YouTube</h2>
            <p>Busca pelo próprio <code>yt-dlp</code> com <code>ytsearch10:</code>. Retorna até 10 resultados.</p>
          </div>
          <a class="button" href="/painel/youtube">Abrir Downloader</a>
        </div>
        <form class="youtube-search-form-v1" id="youtubeSearchFormV1">
          <div class="form-group youtube-search-field-v1">
            <label for="youtubeSearchQueryV1">Termo de pesquisa</label>
            <input id="youtubeSearchQueryV1" type="search" minlength="2" maxlength="160" autocomplete="off" placeholder="Ex.: nome da música, artista, vídeo..." required>
          </div>
          <button class="button primary youtube-search-button-v1" id="youtubeSearchButtonV1" type="submit">Pesquisar 10 resultados</button>
        </form>
        <div class="message" id="youtubeSearchMessageV1"></div>
        <div class="youtube-search-results-v1" id="youtubeSearchResultsV1" hidden></div>
      </section>`;

    document.getElementById('youtubeSearchFormV1')?.addEventListener('submit', runSearch);

    const params = new URLSearchParams(location.search);
    const initial = String(params.get('q') || '').trim();
    if (initial.length >= 2) {
      const input = document.getElementById('youtubeSearchQueryV1');
      if (input) input.value = initial.slice(0, 160);
      document.getElementById('youtubeSearchFormV1')?.requestSubmit();
    }
  }

  async function runSearch(event) {
    event.preventDefault();
    const input = document.getElementById('youtubeSearchQueryV1');
    const results = document.getElementById('youtubeSearchResultsV1');
    const message = document.getElementById('youtubeSearchMessageV1');
    const button = document.getElementById('youtubeSearchButtonV1');
    const query = String(input?.value || '').trim();
    if (query.length < 2) return;

    const pageUrl = new URL(location.href);
    pageUrl.searchParams.set('q', query);
    history.replaceState(null, '', `${pageUrl.pathname}${pageUrl.search}`);

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
      const data = await S.api(`/api/youtube/search?q=${encodeURIComponent(query)}`);
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
      const videoId = /^[A-Za-z0-9_-]{11}$/.test(String(item.videoId || item.id || '')) ? String(item.videoId || item.id) : '';
      const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '';
      const transferUrl = videoId ? `/painel/youtube?video=${encodeURIComponent(videoId)}&from=search` : '';
      const unavailable = item.downloadable === false || !videoId;
      const reason = item.unavailableReason || (!videoId ? 'Resultado sem ID válido do YouTube.' : 'Este resultado não é compatível com o downloader.');

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
            ${unavailable ? `<div class="youtube-search-warning-v2">${esc(reason)}</div>` : ''}
            <div class="youtube-search-actions-v1">
              ${unavailable ? '<button class="button primary" type="button" disabled>Indisponível no downloader</button>' : `<a class="button primary" href="${esc(transferUrl)}">Usar no downloader</a>`}
              ${canonicalUrl ? `<a class="button" href="${esc(canonicalUrl)}" target="_blank" rel="noopener">Abrir no YouTube</a>` : ''}
            </div>
          </div>
        </article>`;
    }).join('');
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
      .youtube-search-page-v2{min-height:300px}.youtube-search-form-v1{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}.youtube-search-field-v1{margin:0}.youtube-search-button-v1{min-height:40px}.youtube-search-results-v1{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.youtube-search-results-v1[hidden]{display:none!important}.youtube-search-card-v1{display:grid;grid-template-columns:180px minmax(0,1fr);gap:11px;padding:9px;border:1px solid var(--theme-border-soft);border-radius:13px;background:var(--theme-field);min-width:0}.youtube-search-thumb-v1{position:relative;align-self:start;aspect-ratio:16/9;border-radius:9px;overflow:hidden;background:color-mix(in srgb,var(--theme-primary) 9%,#000)}.youtube-search-thumb-v1 img,.youtube-search-thumb-empty-v1{width:100%;height:100%;object-fit:cover;display:grid;place-items:center}.youtube-search-thumb-v1 span{position:absolute;right:5px;bottom:5px;padding:2px 5px;border-radius:5px;background:rgba(0,0,0,.82);color:#fff;font-size:9px;font-weight:700}.youtube-search-info-v1{min-width:0;display:flex;flex-direction:column}.youtube-search-info-v1>strong{font-size:11px;line-height:1.35;color:var(--theme-text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.youtube-search-channel-v1{font-size:9px;color:var(--theme-muted);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.youtube-search-meta-v1{font-size:8.5px;color:var(--theme-faint);margin-top:3px;line-height:1.4}.youtube-search-info-v1 p{font-size:8.5px;color:var(--theme-muted);line-height:1.4;margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.youtube-search-warning-v2{font-size:8.5px;line-height:1.4;margin-top:7px;padding:6px 8px;border-radius:8px;border:1px solid var(--theme-border-soft);color:var(--theme-muted);background:color-mix(in srgb,var(--theme-field) 80%,transparent)}.youtube-search-actions-v1{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:8px}.youtube-search-actions-v1 .button{font-size:9px;min-height:30px;padding:6px 9px}.youtube-search-loading-v1,.youtube-search-empty-v1{grid-column:1/-1;padding:18px;text-align:center;color:var(--theme-muted);border:1px dashed var(--theme-border-soft);border-radius:12px}
      @media(max-width:920px){.youtube-search-results-v1{grid-template-columns:1fr}.youtube-search-card-v1{grid-template-columns:160px minmax(0,1fr)}}
      @media(max-width:560px){.youtube-search-form-v1{grid-template-columns:1fr}.youtube-search-button-v1{width:100%;justify-content:center}.youtube-search-card-v1{grid-template-columns:1fr}.youtube-search-thumb-v1{width:100%}.youtube-search-actions-v1 .button{flex:1;justify-content:center}}
    `;
    document.head.appendChild(style);
  }
})();
