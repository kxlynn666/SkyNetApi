(() => {
  if (window.__SKYNET_YOUTUBE_INPUT_NORMALIZER_V1__) return;
  window.__SKYNET_YOUTUBE_INPUT_NORMALIZER_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/youtube') return;

  let attempts = 0;

  function extractCandidate(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (/^[A-Za-z0-9_-]{11}$/.test(text)) return `https://www.youtube.com/watch?v=${text}`;
    const match = text.match(/https?:\/\/[^\s<>"']+/i);
    return match ? match[0].replace(/[),.;]+$/, '') : text;
  }

  function normalize(raw) {
    const candidate = extractCandidate(raw);
    if (!candidate) return '';

    let url;
    try { url = new URL(candidate); }
    catch { return candidate; }

    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    const youtubeHost = host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com');
    if (!youtubeHost) return candidate;

    let id = '';
    if (host === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] || '';
    } else {
      id = url.searchParams.get('v') || '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (!id && ['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) id = parts[1] || '';

      // Alguns links de compartilhamento antigos encapsulam /watch?v=... em `u`.
      if (!id && url.pathname === '/attribution_link') {
        const nested = url.searchParams.get('u') || url.searchParams.get('q') || '';
        try {
          const nestedUrl = new URL(nested, 'https://www.youtube.com');
          id = nestedUrl.searchParams.get('v') || '';
        } catch {}
      }
    }

    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube.com/watch?v=${id}`;

    // Se é um host oficial mas um formato ainda não conhecido pelo cliente,
    // preserve a URL. O servidor continua sendo a autoridade final.
    url.hash = '';
    return url.toString();
  }

  function attach() {
    attempts += 1;
    const input = document.getElementById('youtubeMediaUrlV4');
    const form = document.getElementById('youtubeMediaFormV4');
    if (!input || !form) {
      if (attempts < 100) setTimeout(attach, attempts < 20 ? 60 : 150);
      return;
    }
    if (input.dataset.youtubeNormalizerBound === '1') return;
    input.dataset.youtubeNormalizerBound = '1';

    const apply = () => {
      const normalized = normalize(input.value);
      if (normalized && normalized !== input.value.trim()) {
        input.value = normalized;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    input.addEventListener('change', apply);
    input.addEventListener('blur', apply);
    input.addEventListener('paste', () => setTimeout(apply, 0));
    form.addEventListener('submit', apply, true);

    window.SkyNetYouTubeNormalize = normalize;
  }

  attach();
})();
