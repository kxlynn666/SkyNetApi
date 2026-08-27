(() => {
  if (window.__SKYNET_REALTIME_DISCONNECT_GUARD_V1__) return;
  window.__SKYNET_REALTIME_DISCONNECT_GUARD_V1__ = true;
  const realtime = window.SkyNetRealtime;
  if (!realtime) return;
  const socket = realtime.getSocket();

  function stopMediaIn(root) {
    root?.querySelectorAll?.('video,audio').forEach(media => {
      const stream = media.srcObject;
      if (stream?.getTracks) stream.getTracks().forEach(track => { try { track.stop(); } catch {} });
      try { media.pause(); } catch {}
      media.srcObject = null;
    });
  }

  socket.on('disconnect', () => {
    const directHangup = document.getElementById('rtc2Hangup');
    const groupHangup = document.getElementById('rtc2GroupHangup');
    if (directHangup) directHangup.click();
    else {
      const layer = document.getElementById('rtc2Layer');
      if (layer) { stopMediaIn(layer); layer.remove(); }
    }
    if (groupHangup) groupHangup.click();
    else {
      const layer = document.getElementById('rtc2GroupLayer');
      if (layer) { stopMediaIn(layer); layer.remove(); }
    }
  });
})();
