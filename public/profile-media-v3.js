(() => {
  if (window.__SKYNET_PROFILE_MEDIA_V3__) return;
  window.__SKYNET_PROFILE_MEDIA_V3__ = true;
  window.__SKYNET_PROFILE_MEDIA_V2__ = true;
  window.__SKYNET_PROFILE_MEDIA_V1__ = true;
  if ((location.pathname.replace(/\/+$/,'') || '/') !== '/painel/perfil') return;
  const S = window.SkyNet;
  if (!S) return;

  let media = null;
  let loading = null;
  let scheduled = false;
  const videos = new Set();

  const style = document.createElement('style');
  style.id = 'profileMediaV3Styles';
  style.textContent = `
    .profile-media-v3-tools{display:grid;gap:8px;margin-top:9px}.profile-media-v3-url{width:100%;font-size:11px!important}.profile-media-v3-row{display:flex;gap:7px;flex-wrap:wrap}.profile-media-v3-row .button{flex:0 1 auto}.profile-media-v3-note{font-size:9px;line-height:1.45;color:var(--text-faint,#74747b)}
    .profile-v3-upload-preview video,.profile-v3-preview-bg video,.profile-v3-person .cosmetic-avatar-inner video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none!important}.profile-v3-preview-bg video{opacity:.58}.profile-media-v3-badge{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 7px;border:1px solid #303035;border-radius:999px;font:600 8px 'IBM Plex Mono',monospace;color:#a9a9af;background:#111113}.profile-media-v3-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:#57f287}
    [data-profile-v3="1"] [data-music-icon],[data-profile-v3="1"] .skynet-music-control,[data-profile-v3="1"] .skynet-music-skip{display:none!important}
    [data-profile-v3="1"] video::-webkit-media-controls,[data-profile-v3="1"] video::-webkit-media-controls-panel,[data-profile-v3="1"] video::-webkit-media-controls-play-button,[data-profile-v3="1"] video::-webkit-media-controls-timeline,[data-profile-v3="1"] video::-webkit-media-controls-current-time-display,[data-profile-v3="1"] video::-webkit-media-controls-time-remaining-display{display:none!important;-webkit-appearance:none!important}
  `;
  document.head.appendChild(style);

  const videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const video = entry.target;
      video.dataset.visibleMedia = entry.isIntersecting ? '1' : '0';
      syncVideo(video);
    }
  }, { rootMargin:'160px 0px', threshold:.01 }) : null;

  function syncVideo(video) {
    if (!video?.isConnected) { videos.delete(video); return; }
    const shouldPlay = !document.hidden && video.dataset.visibleMedia !== '0';
    if (shouldPlay) video.play().catch(() => {});
    else video.pause();
  }

  function configureVideo(video) {
    if (!video || video.dataset.profileVideoV3 === '1') return;
    video.dataset.profileVideoV3 = '1';
    video.autoplay = true;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = false;
    video.preload = 'metadata';
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.setAttribute('controlsList','nodownload noplaybackrate noremoteplayback nofullscreen');
    video.setAttribute('aria-hidden','true');
    videos.add(video);
    if (videoObserver) videoObserver.observe(video);
    else { video.dataset.visibleMedia='1'; syncVideo(video); }
  }

  async function getMedia() {
    if (media) return media;
    if (loading) return loading;
    loading = S.api('/api/profile-media/me').then(data => {
      media = { avatar:data.avatar || null, banner:data.banner || null };
      return media;
    }).catch(() => ({ avatar:null,banner:null })).finally(() => { loading=null; });
    return loading;
  }

  function renderMedia(preview,item) {
    if (!preview || !item || preview.dataset.profileMediaId === item.id) return;
    preview.dataset.profileMediaId = item.id;
    if (item.kind === 'video') {
      preview.innerHTML = `<video src="${S.escapeHtml(item.url)}" poster="${S.escapeHtml(item.posterUrl || '')}" muted loop playsinline preload="metadata"></video>`;
      configureVideo(preview.querySelector('video'));
    } else preview.innerHTML = `<img src="${S.escapeHtml(item.url)}" alt="">`;
  }

  function addControls(fileInput,usage,currentMedia) {
    if (!fileInput || fileInput.dataset.profileMediaV3 === '1') return;
    fileInput.dataset.profileMediaV3 = '1';
    fileInput.accept='image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.gif,.mov,.m4v';
    const card=fileInput.closest('.profile-v3-card'); if(!card)return;
    const oldUpload=usage==='avatar'?card.querySelector('#profileV3AvatarUpload'):card.querySelector('#profileV3BannerUpload');
    const oldRemove=usage==='avatar'?card.querySelector('#profileV3AvatarRemove'):card.querySelector('#profileV3BannerRemove');
    if(oldUpload)oldUpload.style.display='none'; if(oldRemove)oldRemove.style.display='none';
    card.querySelector('.profile-media-v2-tools')?.remove();

    const tools=document.createElement('div'); tools.className='profile-media-v3-tools';
    tools.innerHTML=`<input class="profile-media-v3-url" type="url" inputmode="url" placeholder="https://... (imagem, GIF ou vídeo)"><div class="profile-media-v3-row"><button class="button primary small" type="button" data-profile-media-save>Usar arquivo / link</button>${currentMedia?'<button class="button small danger" type="button" data-profile-media-clear>Remover mídia</button>':''}</div><div class="profile-media-v3-note">JPG, PNG, WebP, GIF, MP4, WebM ou MOV. Vídeos ficam sem áudio e limitados aos primeiros 10 segundos.</div>${currentMedia?`<span class="profile-media-v3-badge">${currentMedia.kind==='video'?'mídia animada':'imagem'} ativa</span>`:''}`;
    const actions=oldUpload?.closest('.profile-v3-upload-actions')||oldRemove?.closest('.profile-v3-upload-actions');
    (actions?.parentElement||fileInput.parentElement)?.appendChild(tools);
    const urlInput=tools.querySelector('input');
    tools.querySelector('[data-profile-media-save]')?.addEventListener('click',async event=>{
      const button=event.currentTarget,file=fileInput.files?.[0]||null,url=urlInput.value.trim();
      if(!file&&!url)return alert('Selecione um arquivo ou informe um link.');
      if(file&&url)return alert('Escolha apenas um: arquivo ou link.');
      button.disabled=true; button.textContent='Processando...';
      try{const body=new FormData();body.append('usage',usage);if(file)body.append('file',file);else body.append('url',url);await S.api('/api/profile-media',{method:'POST',body});location.reload();}
      catch(error){alert(error.message||'Falha ao processar a mídia.');button.disabled=false;button.textContent='Usar arquivo / link';}
    });
    tools.querySelector('[data-profile-media-clear]')?.addEventListener('click',async event=>{
      if(!confirm(`Remover ${usage==='avatar'?'a foto de perfil':'o banner'} atual?`))return;
      event.currentTarget.disabled=true;
      try{await S.api(`/api/profile-media/clear/${usage}`,{method:'POST'});location.reload();}catch(error){alert(error.message);event.currentTarget.disabled=false;}
    });
  }

  async function patch() {
    const avatarFile=document.getElementById('profileV3AvatarFile');
    const bannerFile=document.getElementById('profileV3BannerFile');
    if(!avatarFile&&!bannerFile)return;
    const view=await getMedia();
    if(avatarFile){addControls(avatarFile,'avatar',view.avatar);if(view.avatar)renderMedia(avatarFile.closest('.profile-v3-card')?.querySelector('.profile-v3-upload-preview'),view.avatar);}
    if(bannerFile){addControls(bannerFile,'banner',view.banner);if(view.banner)renderMedia(bannerFile.closest('.profile-v3-card')?.querySelector('.profile-v3-upload-preview.cover'),view.banner);}
    if(view.avatar?.kind==='video')renderMedia(document.querySelector('.profile-v3-person .cosmetic-avatar-inner'),view.avatar);
    if(view.banner?.kind==='video')renderMedia(document.querySelector('.profile-v3-preview-bg'),view.banner);
    document.querySelectorAll('.profile-v3-shell video').forEach(configureVideo);
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(async()=>{scheduled=false;await patch();});}
  const root=document.getElementById('workspaceContent')||document.documentElement;
  new MutationObserver(records=>{
    if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.id==='profileV3AvatarFile'||node.id==='profileV3BannerFile'||node.querySelector?.('#profileV3AvatarFile,#profileV3BannerFile')))))schedule();
  }).observe(root,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>videos.forEach(syncVideo),{passive:true});
  schedule();
})();
