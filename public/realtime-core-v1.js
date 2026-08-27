(() => {
  if (window.__SKYNET_REALTIME_CORE_V1__) return;
  window.__SKYNET_REALTIME_CORE_V1__ = true;
  if (typeof window.io !== 'function') return;

  const originalIo = window.io;
  let shared = null;

  function isDefaultRequest(args) {
    if (!args.length) return true;
    if (args.length === 1 && args[0] && typeof args[0] === 'object') {
      const path = args[0].path || '/socket.io';
      return path === '/socket.io';
    }
    return false;
  }

  function getSocket(options = {}) {
    if (shared) {
      if (shared.disconnected && shared.active !== false) shared.connect();
      return shared;
    }
    shared = originalIo({ path:'/socket.io', transports:['websocket','polling'], ...options });
    return shared;
  }

  function wrappedIo(...args) {
    if (isDefaultRequest(args)) return getSocket(args[0] || {});
    return originalIo(...args);
  }

  Object.assign(wrappedIo, originalIo);
  window.io = wrappedIo;
  window.SkyNetRealtime = {
    getSocket,
    get socket() { return shared; }
  };
})();
