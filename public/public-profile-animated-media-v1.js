(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_ANIMATED_MEDIA_V1__) return;
  window.__SKYNET_PUBLIC_PROFILE_ANIMATED_MEDIA_V1__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root || !window.SkyNet) return;

  let attempts = 0;

  async function enhance() {
    const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
    if (!username) return;

    try {
      const data = await window.SkyNet.api(`/api/profile-media/public/${encodeURIComponent(username)}`);
      applyMedia('avatar', data.avatar);
      applyMedia('banner', data.banner);
    } catch (error) {
      console.warn('Mídia animada do perfil indisponível:', error?.message || error);
    }
  }

  function applyMedia(kind, media) {
    if (!media || media.kind !== 'video' || !media.url) return;
    const selector = kind === 'avatar'
      ? '.public-avatar-studio .cosmetic-avatar-inner'
      : '.public-banner-studio';
    const host = root.querySelector(selector);
    if (!host) {
      if (attempts < 40) {
        attempts += 1;
        setTimeout(() => applyMedia(kind, media), attempts < 12 ? 80 : 180);
      }
      return;
    }

    if (host.querySelector(`video[data-profile-${kind}-media]`)) return;
    const video = document.createElement('video');
    video.src = media.url;
    if (media.posterUrl) video.poster = media.posterUrl;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-hidden', 'true');
    video.dataset[`profile${kind[0].toUpperCase()}${kind.slice(1)}Media`] = '1';

    if (kind === 'avatar') {
      const existing = host.querySelector('img');
      if (existing) existing.replaceWith(video);
      else host.replaceChildren(video);
    } else {
      const existing = host.querySelector('img');
      if (existing) existing.replaceWith(video);
      else host.prepend(video);
    }

    const tryPlay = () => video.play().catch(() => {});
    video.addEventListener('canplay', tryPlay, { once: true });
    tryPlay();
  }

  const style = document.createElement('style');
  style.textContent = `
    .public-avatar-studio .cosmetic-avatar-inner video{width:100%;height:100%;display:block;object-fit:cover;border-radius:inherit}
    .public-banner-studio>video{width:100%;height:100%;display:block;object-fit:cover;object-position:var(--ps-banner-focus);filter:saturate(var(--ps-sat)) contrast(var(--ps-contrast))}
    @media (prefers-reduced-motion: reduce){
      .public-profile-studio[data-motion="system"] .public-avatar-studio video,
      .public-profile-studio[data-motion="system"] .public-banner-studio>video{animation:none}
    }
  `;
  document.head.appendChild(style);

  enhance();
})();
