(() => {
  if (window.__SKYNET_REALTIME_CHAT_V2_ADAPTER__) return;
  window.__SKYNET_REALTIME_CHAT_V2_ADAPTER__ = true;
  if ((location.pathname.replace(/\/+$/,'') || '/') !== '/painel/chat') return;

  function adapt() {
    const audio = document.getElementById('startAudioCall');
    if (audio) {
      audio.id = 'startCall';
      audio.dataset.rtc2Adapted = 'audio';
    }
    const video = document.getElementById('startVideoCall');
    if (video) {
      video.id = 'startVideoCallV2';
      video.dataset.rtc2Adapted = 'video';
      video.classList.add('rtc2-call-button');
      video.setAttribute('aria-label','Chamada de vídeo');
      video.title = 'Chamada de vídeo';
    }
  }

  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; adapt(); });
  };

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();
})();
