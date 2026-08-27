(() => {
  if (window.__SKYNET_PODIUM_MEDIA_ANIMATOR_V1__) return;
  window.__SKYNET_PODIUM_MEDIA_ANIMATOR_V1__ = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/' && path !== '/painel') return;
  const S = window.SkyNet;
  if (!S) return;

  let entries = null;
  let loading = null;
  let scheduled = false;
  const videos = new Set();

  const style = document.createElement('style');
  style.id = 'podiumMediaAnimatorV1Styles';
  style.textContent = `
    .podium-card-v3 video,.panel-mini-podium-card video,.leaderboard-row video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none!important}
    .podium-bg video,.panel-mini-bg video{position:absolute;inset:0;opacity:.58}
    .podium-card-v3 video::-webkit-media-controls,.panel-mini-podium-card video::-webkit-media-controls,.leaderboard-row video::-webkit-media-controls{display:none!important;-webkit-appearance:none!important}
    .podium-card-v3[data-live-profile="1"],.panel-mini-podium-card[data-live-profile="1"]{isolation:isolate}
    .podium-card-v3[data-live-profile="1"]::after,.panel-mini-podium-card[data-live-profile="1"]::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:3;border:1px solid color-mix(in srgb,var(--profile-accent,#a855f7) 24%,transparent);border-radius:inherit;opacity:.55}
  `;
  document.head.appendChild(style);

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(items => {
    for (const item of items) {
      item.target.dataset.podiumVideoVisible = item.isIntersecting ? '1' : '0';
      sync(item.target);
    }
  }, { rootMargin:'180px 0px', threshold:.01 }) : null;

  function sync(video) {
    if (!video?.isConnected) { videos.delete(video); return; }
    const shouldPlay = !document.hidden && video.dataset.podiumVideoVisible !== '0';
    if (shouldPlay) video.play().catch(() => {}); else video.pause();
  }

  function configure(video) {
    if (!video || video.dataset.podiumVideoV1 === '1') return;
    video.dataset.podiumVideoV1 = '1';
    video.muted = true; video.defaultMuted = true; video.loop = true; video.autoplay = true; video.playsInline = true; video.controls = false; video.preload = 'metadata';
    video.disablePictureInPicture = true; video.disableRemotePlayback = true;
    video.setAttribute('controlsList','nodownload noplaybackrate noremoteplayback nofullscreen');
    video.setAttribute('aria-hidden','true');
    videos.add(video);
    if (io) io.observe(video); else { video.dataset.podiumVideoVisible='1'; sync(video); }
  }

  function usernameFromCard(card) {
    try {
      const url = new URL(card.getAttribute('href') || '', location.origin);
      const match = url.pathname.match(/^\/u\/([^/]+)/);
      return match ? decodeURIComponent(match[1]).toLowerCase() : '';
    } catch { return ''; }
  }

  function videoMarkup(media) {
    return `<video src="${S.escapeHtml(media.url)}" poster="${S.escapeHtml(media.posterUrl || '')}" muted loop playsinline preload="metadata"></video>`;
  }

  function patchCard(card,map) {
    const username = usernameFromCard(card);
    const user = map.get(username);
    if (!user) return;
    let live = false;

    if (user.bannerMedia?.kind === 'video' && user.bannerMedia.url) {
      const bg = card.querySelector('.podium-bg,.panel-mini-bg');
      if (bg && bg.dataset.podiumBannerMedia !== user.bannerMedia.id) {
        bg.dataset.podiumBannerMedia = user.bannerMedia.id;
        bg.innerHTML = videoMarkup(user.bannerMedia);
        configure(bg.querySelector('video'));
      }
      live = true;
    }

    if (user.avatarMedia?.kind === 'video' && user.avatarMedia.url) {
      const avatar = card.querySelector('.cosmetic-avatar-inner');
      if (avatar && avatar.dataset.podiumAvatarMedia !== user.avatarMedia.id) {
        avatar.dataset.podiumAvatarMedia = user.avatarMedia.id;
        avatar.innerHTML = videoMarkup(user.avatarMedia);
        configure(avatar.querySelector('video'));
      }
      live = true;
    }

    if (live) card.dataset.liveProfile = '1';
  }

  async function getEntries() {
    if (entries) return entries;
    if (loading) return loading;
    loading = S.api('/api/profile-v3/leaderboard?limit=50').then(data => entries = data.leaderboard || []).catch(() => []).finally(() => { loading=null; });
    return loading;
  }

  async function patch() {
    const cards = [...document.querySelectorAll('.podium-card-v3,.panel-mini-podium-card,.leaderboard-row')];
    if (!cards.length) return;
    const list = await getEntries();
    const map = new Map(list.map(user => [String(user.username || '').toLowerCase(), user]));
    cards.forEach(card => patchCard(card,map));
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => { scheduled=false; await patch(); });
  }

  const target = document.getElementById('podiumRoot') || document.getElementById('workspaceContent') || document.body;
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType===1 && (node.matches?.('.podium-card-v3,.panel-mini-podium-card,.leaderboard-row,#panelMiniPodium') || node.querySelector?.('.podium-card-v3,.panel-mini-podium-card,.leaderboard-row'))))) schedule();
  }).observe(target,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>videos.forEach(sync),{passive:true});
  schedule();
})();
