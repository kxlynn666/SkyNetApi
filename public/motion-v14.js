(() => {
  if (window.__SKYNET_MOTION_V14_BRIDGE__) return;
  window.__SKYNET_MOTION_V14_BRIDGE__ = true;
  if (document.querySelector('script[src="/motion-v15.js"]')) return;
  const script = document.createElement('script');
  script.src = '/motion-v15.js';
  script.async = false;
  script.dataset.skynetMotionV15 = '1';
  document.head.appendChild(script);
})();
