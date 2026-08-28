(() => {
  if (window.__SKYNET_YOUTUBE_AUTH_ERROR_HOTFIX_V1__) return;
  window.__SKYNET_YOUTUBE_AUTH_ERROR_HOTFIX_V1__ = true;

  const S = window.SkyNet;
  if (!S || typeof S.api !== 'function') return;

  const originalApi = S.api.bind(S);

  S.api = async function youtubeAwareApi(url, options = {}) {
    try {
      return await originalApi(url, options);
    } catch (error) {
      const path = String(url || '');
      const message = String(error?.message || '');
      const isYouTubeRequest = path.startsWith('/painel/youtube-');
      const wasMisclassified = /Esse vídeo exige autenticação ou verificação de idade\.?/i.test(message);

      if (!isYouTubeRequest || !wasMisclassified) throw error;

      const corrected = new Error(
        'O YouTube recusou a solicitação automática deste servidor. Isso não significa que o vídeo seja 18+; o yt-dlp não conseguiu acessar este vídeo sem autenticação.'
      );
      corrected.status = error?.status;
      corrected.data = error?.data;
      corrected.cause = error;
      throw corrected;
    }
  };
})();
