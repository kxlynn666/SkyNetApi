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

  // The chat updates ?with= after loading history. A fast click on the call
  // button used to happen before that update, making the realtime layer think no
  // conversation was selected. Keep the URL in sync with the active row first.
  document.addEventListener('click', event => {
    const callButton = event.target.closest?.('#startCall,#startVideoCallV2,#startAudioCall,#startVideoCall');
    if (!callButton) return;
    const active = document.querySelector('.chat-conversation.active[data-user]');
    const userId = active?.dataset.user;
    if (!userId) return;
    const url = new URL(location.href);
    if (url.searchParams.get('with') === userId) return;
    url.searchParams.set('with', userId);
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, true);

  let raf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; adapt(); });
  };

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();
})();
