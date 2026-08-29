(() => {
  if (window.__SKYNET_YOUTUBE_SEARCH_TRANSFER_V2__) return;
  window.__SKYNET_YOUTUBE_SEARCH_TRANSFER_V2__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/youtube') return;

  const params = new URLSearchParams(location.search);
  const videoId = String(params.get('video') || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return;

  const canonical = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  let attempts = 0;

  function apply() {
    attempts += 1;
    const input = document.getElementById('youtubeMediaUrlV4');
    if (!input) {
      if (attempts < 80) setTimeout(apply, attempts < 20 ? 80 : 180);
      return;
    }

    input.value = canonical;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const S = window.SkyNet;
    const message = document.getElementById('youtubeMediaMessageV4');
    if (S?.message && message) {
      S.message(message, 'Resultado do YouTube Search carregado com URL canônica. Escolha MP4 ou MP3 e prepare o arquivo.', 'success');
    }

    if (params.get('from') === 'search') {
      setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }

  apply();
})();
