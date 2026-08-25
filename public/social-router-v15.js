(() => {
  if (window.__SKYNET_SOCIAL_ROUTER_V15__) return;
  window.__SKYNET_SOCIAL_ROUTER_V15__ = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let src = '';
  if (path === '/painel/chat') src = '/chat-v15.js';
  else if (['/painel/perfil','/painel/amigos','/painel/conta'].includes(path)) src = '/social-page.js';
  if (!src || document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement('script');
  script.src = src;
  script.async = false;
  script.dataset.socialRouterV15 = '1';
  document.head.appendChild(script);
})();
