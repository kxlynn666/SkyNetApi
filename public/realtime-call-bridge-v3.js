(() => {
  if (window.__SKYNET_REALTIME_CALL_BRIDGE_V3__) return;
  window.__SKYNET_REALTIME_CALL_BRIDGE_V3__ = true;
  if (typeof window.io !== 'function') return;

  const originalIo = window.io;
  const legacyEvents = new Set([
    'call:incoming','call:ringing','call:accepted','call:rejected','call:ended','call:error',
    'rtc:offer','rtc:answer','rtc:ice',
    'group:call:state','group:call:participants','group:call:peer-joined','group:call:peer-left','group:call:error','group:call:ended',
    'group:rtc:offer','group:rtc:answer','group:rtc:ice'
  ]);

  function wrap(raw) {
    if (!raw || raw.__skynetRealtimeBridgeV3) return raw;
    const listeners = new Map();
    let dmCallId = '';
    let dmPeerId = '';
    let proxy = null;

    const addLocal = (event, handler, once = false) => {
      if (typeof handler !== 'function') return;
      let set = listeners.get(event);
      if (!set) { set = new Set(); listeners.set(event, set); }
      set.add({ handler, once });
    };

    const removeLocal = (event, handler) => {
      const set = listeners.get(event);
      if (!set) return;
      if (!handler) { set.clear(); return; }
      for (const item of [...set]) if (item.handler === handler) set.delete(item);
    };

    const dispatch = (event, payload) => {
      const set = listeners.get(event);
      if (!set?.size) return;
      for (const item of [...set]) {
        try { item.handler(payload); } catch (error) { setTimeout(() => { throw error; }, 0); }
        if (item.once) set.delete(item);
      }
    };

    raw.on('call2:incoming', payload => {
      dmCallId = String(payload?.callId || '');
      dmPeerId = String(payload?.from?.id || '');
      dispatch('call:incoming', { from:payload?.from || null, mode:payload?.mode || 'audio', callId:dmCallId });
    });
    raw.on('call2:ringing', payload => {
      dmCallId = String(payload?.callId || dmCallId || '');
      dmPeerId = String(payload?.to || dmPeerId || '');
      dispatch('call:ringing', { to:dmPeerId, mode:payload?.mode || 'audio', callId:dmCallId });
    });
    raw.on('call2:accepted', payload => {
      dmCallId = String(payload?.callId || dmCallId || '');
      dmPeerId = String(payload?.by || dmPeerId || '');
      dispatch('call:accepted', { by:dmPeerId, mode:payload?.mode || 'audio', callId:dmCallId });
    });
    raw.on('call2:accepted-local', payload => {
      dmCallId = String(payload?.callId || dmCallId || '');
    });
    raw.on('call2:claimed', payload => {
      if (!payload?.callId || String(payload.callId) !== dmCallId) return;
      if (payload.socketId && payload.socketId !== raw.id) {
        dispatch('call:ended', { reason:'Chamada atendida em outra aba ou dispositivo.', callId:dmCallId });
        dmCallId = '';
        dmPeerId = '';
      }
    });
    raw.on('call2:rejected', payload => {
      dispatch('call:rejected', { by:payload?.by || dmPeerId, callId:payload?.callId || dmCallId });
    });
    raw.on('call2:ended', payload => {
      const id = String(payload?.callId || '');
      if (dmCallId && id && id !== dmCallId) return;
      dispatch('call:ended', { reason:payload?.reason || 'Chamada encerrada.', callId:id || dmCallId });
      dmCallId = '';
      dmPeerId = '';
    });
    raw.on('call2:error', payload => dispatch('call:error', payload || {}));
    raw.on('call2:signal', payload => {
      if (payload?.callId) dmCallId = String(payload.callId);
      if (payload?.from) dmPeerId = String(payload.from);
      if (payload?.description?.type === 'offer') dispatch('rtc:offer', { from:payload.from, data:payload.description });
      else if (payload?.description?.type === 'answer') dispatch('rtc:answer', { from:payload.from, data:payload.description });
      else if (payload?.candidate) dispatch('rtc:ice', { from:payload.from, data:payload.candidate });
    });

    raw.on('groupcall2:state', payload => dispatch('group:call:state', payload));
    raw.on('groupcall2:participants', payload => dispatch('group:call:participants', {
      groupId:payload?.groupId,
      participants:Array.isArray(payload?.participants) ? payload.participants.map(user => typeof user === 'string' ? user : user?.id).filter(Boolean) : []
    }));
    raw.on('groupcall2:peer-joined', payload => dispatch('group:call:peer-joined', payload));
    raw.on('groupcall2:peer-left', payload => dispatch('group:call:peer-left', payload));
    raw.on('groupcall2:error', payload => dispatch('group:call:error', payload || {}));
    raw.on('groupcall2:ended', payload => dispatch('group:call:ended', payload || {}));
    raw.on('groupcall2:signal', payload => {
      if (payload?.description?.type === 'offer') dispatch('group:rtc:offer', { groupId:payload.groupId, from:payload.from, data:payload.description });
      else if (payload?.description?.type === 'answer') dispatch('group:rtc:answer', { groupId:payload.groupId, from:payload.from, data:payload.description });
      else if (payload?.candidate) dispatch('group:rtc:ice', { groupId:payload.groupId, from:payload.from, data:payload.candidate });
    });

    const translatedEmit = (event, payload = {}) => {
      switch (event) {
        case 'call:invite': {
          dmPeerId = String(payload?.to || '');
          const localVideo = document.getElementById('localVideoV16');
          const hasVideo = Boolean(localVideo?.srcObject?.getVideoTracks?.().some(track => track.readyState === 'live'));
          raw.emit('call2:invite', { to:dmPeerId, mode:hasVideo ? 'video' : 'audio' });
          return true;
        }
        case 'call:accept':
          if (dmCallId) raw.emit('call2:accept', { callId:dmCallId });
          return true;
        case 'call:reject':
          if (dmCallId) raw.emit('call2:reject', { callId:dmCallId });
          return true;
        case 'call:end':
          if (dmCallId) raw.emit('call2:end', { callId:dmCallId, reason:payload?.reason });
          return true;
        case 'rtc:offer':
        case 'rtc:answer':
          if (dmCallId && payload?.data) raw.emit('call2:signal', { callId:dmCallId, description:payload.data });
          return true;
        case 'rtc:ice':
          if (dmCallId && payload?.data) raw.emit('call2:signal', { callId:dmCallId, candidate:payload.data });
          return true;
        case 'group:call:join':
          raw.emit('groupcall2:join', { groupId:payload?.groupId, mode:document.querySelector('#groupCallV3Grid video[srcObject]') ? 'video' : 'audio' });
          return true;
        case 'group:call:leave':
          raw.emit('groupcall2:leave', { groupId:payload?.groupId });
          return true;
        case 'group:rtc:offer':
        case 'group:rtc:answer':
          if (payload?.groupId && payload?.to && payload?.data) raw.emit('groupcall2:signal', { groupId:payload.groupId, to:payload.to, description:payload.data });
          return true;
        case 'group:rtc:ice':
          if (payload?.groupId && payload?.to && payload?.data) raw.emit('groupcall2:signal', { groupId:payload.groupId, to:payload.to, candidate:payload.data });
          return true;
        default:
          raw.emit(event, payload);
          return true;
      }
    };

    proxy = new Proxy(raw, {
      get(target, prop) {
        if (prop === '__skynetRealtimeBridgeV3') return true;
        if (prop === 'emit') return translatedEmit;
        if (prop === 'on') return (event, handler) => {
          if (legacyEvents.has(event)) addLocal(event, handler, false);
          else target.on(event, handler);
          return proxy;
        };
        if (prop === 'once') return (event, handler) => {
          if (legacyEvents.has(event)) addLocal(event, handler, true);
          else target.once(event, handler);
          return proxy;
        };
        if (prop === 'off' || prop === 'removeListener') return (event, handler) => {
          if (legacyEvents.has(event)) removeLocal(event, handler);
          else target.off(event, handler);
          return proxy;
        };
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, prop, value) { return Reflect.set(target, prop, value, target); }
    });
    return proxy;
  }

  function bridgedIo(...args) {
    return wrap(originalIo(...args));
  }
  Object.assign(bridgedIo, originalIo);
  try { Object.setPrototypeOf(bridgedIo, Object.getPrototypeOf(originalIo)); } catch {}
  window.io = bridgedIo;
})();
