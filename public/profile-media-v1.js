(() => {
  if (window.__SKYNET_PROFILE_MEDIA_V1__) return;
  window.__SKYNET_PROFILE_MEDIA_V1__ = true;
  if ((location.pathname.replace(/\/+$/,'') || '/') !== '/painel/perfil') return;
  const S = window.SkyNet;
  if (!S) return;

  let media = null;
  let loading = null;
  const style = document.createElement('style');
  style.id = 'profileMediaV1Styles';
  style.textContent = `
    .profile-media-v1-tools{display:grid;gap:8px;margin-top:9px}.profile-media-v1-url{width:100%;font-size:11px!important}.profile-media-v1-row{display:flex;gap:7px;flex-wrap:wrap}.profile-media-v1-row .button{flex:0 1 auto}.profile-media-v1-note{font-size:9px;line-height:1.45;color:var(--text-faint,#74747b)}
    .profile-v3-upload-preview video,.profile-v3-preview-bg video,.profile-v3-person .cosmetic-avatar-inner video{width:100%;height:100%;object-fit:cover;display:block}.profile-v3-preview-bg video{opacity:.58}.profile-media-v1-badge{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 7px;border:1px solid #303035;border-radius:999px;font:600 8px 'IBM Plex Mono',monospace;color:#a9a9af;background:#111113}.profile-media-v1-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:#57f287}
  `;
  document.head.appendChild(style);

  async function getMedia(force=false){
    if (media && !force) return media;
    if (loading && !force) return loading;
    loading = S.api('/api/profile-media/me').then(data => { media = { avatar:data.avatar || null, banner:data.banner || null }; return media; }).catch(() => ({avatar:null,banner:null})).finally(()=>{loading=null});
    return loading;
  }

  function renderMedia(preview, item, fallbackHtml) {
    if (!preview) return;
    if (!item) { if (fallbackHtml !== undefined) preview.innerHTML = fallbackHtml; return; }
    if (item.kind === 'video') preview.innerHTML = `<video src="${S.escapeHtml(item.url)}" poster="${S.escapeHtml(item.posterUrl || '')}" autoplay muted loop playsinline preload="metadata"></video>`;
    else preview.innerHTML = `<img src="${S.escapeHtml(item.url)}" alt="">`;
  }

  function addControls(fileInput, usage, currentMedia) {
    if (!fileInput || fileInput.dataset.profileMediaV1 === '1') return;
    fileInput.dataset.profileMediaV1 = '1';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.gif,.mov,.m4v';
    const card = fileInput.closest('.profile-v3-card');
    if (!card) return;
    const oldUpload = usage === 'avatar' ? card.querySelector('#profileV3AvatarUpload') : card.querySelector('#profileV3BannerUpload');
    const oldRemove = usage === 'avatar' ? card.querySelector('#profileV3AvatarRemove') : card.querySelector('#profileV3BannerRemove');
    if (oldUpload) oldUpload.style.display = 'none';
    if (oldRemove) oldRemove.style.display = 'none';

    const tools = document.createElement('div');
    tools.className = 'profile-media-v1-tools';
    tools.innerHTML = `<input class="profile-media-v1-url" type="url" inputmode="url" placeholder="https://... (imagem, GIF ou vídeo)"><div class="profile-media-v1-row"><button class="button primary small" type="button" data-profile-media-save>Usar arquivo / link</button>${currentMedia ? '<button class="button small danger" type="button" data-profile-media-clear>Remover mídia</button>' : ''}</div><div class="profile-media-v1-note">JPG, PNG, WebP, GIF, MP4, WebM ou MOV. GIFs e vídeos são convertidos para reprodução silenciosa e limitados aos primeiros 10 segundos.</div>${currentMedia ? `<span class="profile-media-v1-badge">${currentMedia.kind === 'video' ? 'mídia animada' : 'imagem'} ativa</span>` : ''}`;
    const actions = oldUpload?.closest('.profile-v3-upload-actions') || oldRemove?.closest('.profile-v3-upload-actions');
    (actions?.parentElement || fileInput.parentElement)?.appendChild(tools);

    const urlInput = tools.querySelector('input');
    tools.querySelector('[data-profile-media-save]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const file = fileInput.files?.[0] || null;
      const url = urlInput.value.trim();
      if (!file && !url) return alert('Selecione um arquivo ou informe um link.');
      if (file && url) return alert('Escolha apenas um: arquivo ou link.');
      button.disabled = true; button.textContent = 'Processando...';
      try {
        const body = new FormData(); body.append('usage', usage); if (file) body.append('file', file); else body.append('url', url);
        await S.api('/api/profile-media', { method:'POST', body });
        location.reload();
      } catch (error) { alert(error.message || 'Falha ao processar a mídia.'); button.disabled=false; button.textContent='Usar arquivo / link'; }
    });
    tools.querySelector('[data-profile-media-clear]')?.addEventListener('click', async event => {
      if (!confirm(`Remover ${usage === 'avatar' ? 'a foto de perfil' : 'o banner'} atual?`)) return;
      event.currentTarget.disabled = true;
      try { await S.api(`/api/profile-media/clear/${usage}`, {method:'POST'}); location.reload(); }
      catch (error) { alert(error.message); event.currentTarget.disabled=false; }
    });
  }

  async function patch() {
    const avatarFile = document.getElementById('profileV3AvatarFile');
    const bannerFile = document.getElementById('profileV3BannerFile');
    if (!avatarFile && !bannerFile) return;
    const view = await getMedia();
    if (avatarFile) {
      addControls(avatarFile,'avatar',view.avatar);
      const preview = avatarFile.closest('.profile-v3-card')?.querySelector('.profile-v3-upload-preview');
      if (view.avatar) renderMedia(preview,view.avatar);
    }
    if (bannerFile) {
      addControls(bannerFile,'banner',view.banner);
      const preview = bannerFile.closest('.profile-v3-card')?.querySelector('.profile-v3-upload-preview.cover');
      if (view.banner) renderMedia(preview,view.banner);
    }
    if (view.avatar?.kind === 'video') {
      const avatar = document.querySelector('.profile-v3-person .cosmetic-avatar-inner');
      if (avatar && !avatar.querySelector('video')) renderMedia(avatar,view.avatar);
    }
    if (view.banner?.kind === 'video') {
      const bg = document.querySelector('.profile-v3-preview-bg');
      if (bg && !bg.querySelector('video')) bg.innerHTML = `<video src="${S.escapeHtml(view.banner.url)}" poster="${S.escapeHtml(view.banner.posterUrl||'')}" autoplay muted loop playsinline preload="metadata"></video>`;
    }
  }

  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(async()=>{scheduled=false;await patch();});};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();
})();
