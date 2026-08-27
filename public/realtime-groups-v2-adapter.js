(() => {
  if (window.__SKYNET_REALTIME_GROUPS_V2_ADAPTER__) return;
  window.__SKYNET_REALTIME_GROUPS_V2_ADAPTER__ = true;
  if ((location.pathname.replace(/\/+$/,'') || '/') !== '/painel/grupos') return;
  const realtime=window.SkyNetRealtime;
  if(!realtime)return;

  function adapt() {
    document.querySelectorAll('.group-v3-item[data-group-id]').forEach(item=>item.classList.add('group-item'));
    const join=document.getElementById('groupV3JoinCall');
    if(join&&!document.getElementById('groupJoinCall')){
      join.dataset.originalGroupV3Join='1';
      join.id='groupJoinCall';
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
