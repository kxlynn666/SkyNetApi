(() => {
  if (window.__SKYNET_MOTION_V14_BRIDGE__) return;
  window.__SKYNET_MOTION_V14_BRIDGE__ = true;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const guardStyle = document.createElement('style');
  guardStyle.id = 'skynetMotionBlackScreenGuard';
  guardStyle.textContent = '@media (prefers-reduced-motion: reduce){.v15-page-flash{display:none!important;opacity:0!important;visibility:hidden!important}}';
  document.head.appendChild(guardStyle);

  const clearPageFlash = () => {
    document.querySelectorAll('.v15-page-flash').forEach(flash => {
      if (reduceMotion.matches) {
        flash.remove();
        return;
      }
      if (flash.dataset.skynetFlashGuard === '1') return;
      flash.dataset.skynetFlashGuard = '1';
      setTimeout(() => {
        if (flash.isConnected) flash.remove();
      }, 1200);
    });
  };

  const observer = new MutationObserver(clearPageFlash);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  clearPageFlash();

  if (!document.querySelector('script[src="/motion-v15.js"]')) {
    const script = document.createElement('script');
    script.src = '/motion-v15.js';
    script.async = false;
    script.dataset.skynetMotionV15 = '1';
    script.addEventListener('load', clearPageFlash, { once: true });
    document.head.appendChild(script);
  }

  reduceMotion.addEventListener?.('change', clearPageFlash);
  setTimeout(clearPageFlash, 1400);
  setTimeout(() => observer.disconnect(), 5000);
})();
