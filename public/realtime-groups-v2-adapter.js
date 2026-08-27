(() => {
  if (window.__SKYNET_REALTIME_GROUPS_V2_ADAPTER__) return;
  window.__SKYNET_REALTIME_GROUPS_V2_ADAPTER__ = true;
  if ((location.pathname.replace(/\/+$/,'') || '/') !== '/painel/grupos') return;
  const realtime=window.SkyNetRealtime;
  if(!realtime)return;

  function adapt() {
    document.querySelectorAll('.group-v3-item[data-group-id]').forEach(item=>item.classList.add('group-item'));
    let join=document.getElementById('groupJoinCall') || document.getElementById('groupV3JoinCall');
    if(join){
      join.id='groupJoinCall';
      join.dataset.originalGroupV3Join='1';
      join.classList.add('rtc2-call-button');
      join.classList.remove('primary');
      join.setAttribute('aria-label','Entrar na chamada por áudio');
      join.title='Entrar por áudio';
      join.textContent='Áudio';
      if(!document.getElementById('groupJoinVideoCallV2')){
        const video=document.createElement('button');
        video.id='groupJoinVideoCallV2';
        video.type='button';
        video.className='button small primary rtc2-call-button';
        video.dataset.rtc2='1';
        video.setAttribute('aria-label','Entrar na chamada com vídeo');
        video.title='Entrar com vídeo';
        video.textContent='Vídeo';
        join.insertAdjacentElement('afterend',video);
      }
    }
  }

  let raf=0;
  const schedule=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;adapt();});};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();

  const socket=realtime.getSocket();
  socket.on('groupcall2:state',({groupId,participantIds})=>{
    const ids=Array.isArray(participantIds)?participantIds:[];
    document.querySelectorAll(`.group-v3-item[data-group-id="${CSS.escape(groupId)}"] span`).forEach(span=>{
      span.textContent=span.textContent.replace(/ · \d+ na call$/,'')+` · ${ids.length} na call`;
    });
    const active=document.querySelector('.group-v3-item.active')?.dataset.groupId;
    if(active===groupId){const el=document.getElementById('groupV3CallCount');if(el)el.textContent=`${ids.length} na call`;}
  });
})();
