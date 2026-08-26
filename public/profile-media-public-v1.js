(() => {
  if (window.__SKYNET_PROFILE_MEDIA_PUBLIC_V1__) return;
  window.__SKYNET_PROFILE_MEDIA_PUBLIC_V1__ = true;
  const S = window.SkyNet;
  if (!S || !location.pathname.startsWith('/u/')) return;

  const style=document.createElement('style');
  style.textContent='.public-cover-v3 video,.public-head-v3 .cosmetic-avatar-inner video{width:100%;height:100%;display:block;object-fit:cover}.public-cover-v3 video{opacity:.72}.public-head-v3 .cosmetic-avatar-inner video{border-radius:inherit}';
  document.head.appendChild(style);

  async function install(){
    const username=decodeURIComponent(location.pathname.split('/').filter(Boolean)[1]||'');
    if(!username)return;
    let data;try{data=await S.api(`/api/profile-media/public/${encodeURIComponent(username)}`);}catch{return;}
    const wait=()=>new Promise(resolve=>{const ready=()=>document.querySelector('.public-profile-v3');if(ready())return resolve();const obs=new MutationObserver(()=>{if(!ready())return;obs.disconnect();resolve();});obs.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{obs.disconnect();resolve();},10000);});
    await wait();
    if(data.avatar?.kind==='video'){
      const inner=document.querySelector('.public-head-v3 .cosmetic-avatar-inner');
      if(inner)inner.innerHTML=`<video src="${S.escapeHtml(data.avatar.url)}" poster="${S.escapeHtml(data.avatar.posterUrl||'')}" autoplay muted loop playsinline preload="metadata"></video>`;
    }
    if(data.banner?.kind==='video'){
      const cover=document.querySelector('.public-cover-v3');
      if(cover)cover.innerHTML=`<video src="${S.escapeHtml(data.banner.url)}" poster="${S.escapeHtml(data.banner.posterUrl||'')}" autoplay muted loop playsinline preload="metadata"></video>`;
    }
  }
  install();
})();
