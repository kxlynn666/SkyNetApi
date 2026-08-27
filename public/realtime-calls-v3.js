(() => {
  if (window.__SKYNET_REALTIME_CALLS_V3__) return;
  window.__SKYNET_REALTIME_CALLS_V3__ = true;
  window.__SKYNET_REALTIME_CALLS_V2__ = true;
  if (!location.pathname.startsWith('/painel')) return;
  const S = window.SkyNet;
  const realtime = window.SkyNetRealtime;
  if (!S || !realtime) return;

  const socket = realtime.getSocket();
  let me = null;
  let rtcInfo = null;
  let direct = null;
  let group = null;
  const groupUsers = new Map();
  let decorateRaf = 0;

  const esc = value => S.escapeHtml(value == null ? '' : String(value));

  installStyles();
  bindSocket();
  observeUi();
  ensureMe().catch(() => {});

  function installStyles() {
    if (document.getElementById('rtcCallsV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'rtcCallsV3Styles';
    style.textContent = `
      .rtc3-call-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important}.rtc3-call-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .rtc3-layer{position:fixed;inset:0;z-index:12500;background:rgba(3,3,5,.91);display:grid;place-items:center;padding:14px;overscroll-behavior:contain}.rtc3-shell{width:min(1100px,100%);max-height:calc(100dvh - 24px);overflow:auto;border:1px solid #303035;background:#09090b;box-shadow:0 32px 110px rgba(0,0,0,.6);padding:14px}.rtc3-head{display:flex;align-items:center;gap:12px;padding:4px 3px 13px}.rtc3-head-copy{min-width:0;flex:1}.rtc3-head-copy strong,.rtc3-head-copy span{display:block}.rtc3-head-copy strong{font-size:15px}.rtc3-head-copy span{font-size:10px;color:#818188;margin-top:3px}.rtc3-status{font:600 9px 'IBM Plex Mono',monospace;color:#aaa3df;text-align:right}
      .rtc3-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.rtc3-tile{position:relative;min-height:225px;aspect-ratio:16/10;overflow:hidden;border:1px solid #29292e;background:#111113;display:grid;place-items:center}.rtc3-tile video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#09090b}.rtc3-tile video.mirror{transform:scaleX(-1)}.rtc3-tile.screen video{object-fit:contain;transform:none}.rtc3-avatar{width:76px;height:76px;display:grid;place-items:center;border:1px solid #38383e;background:#171719;font-weight:800;font-size:25px;z-index:1}.rtc3-tile.has-video .rtc3-avatar{opacity:0}.rtc3-label{position:absolute;left:8px;bottom:8px;z-index:3;padding:5px 7px;background:rgba(6,6,8,.8);border:1px solid rgba(255,255,255,.09);font-size:9px}.rtc3-badge{position:absolute;right:8px;top:8px;z-index:3;padding:4px 6px;background:rgba(6,6,8,.8);border:1px solid rgba(255,255,255,.09);font-size:8px;color:#bbb5e8}.rtc3-toolbar{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;padding-top:13px}.rtc3-toolbar .button{min-height:38px!important}.rtc3-incoming{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:14px 0 2px}.rtc3-note{text-align:center;color:#77777e;font-size:9px;padding:8px 0 1px}.rtc3-warning{color:#d6a3aa}
      @media(max-width:760px){.rtc3-layer{padding:0}.rtc3-shell{width:100%;height:100dvh;max-height:none;border:0;padding:10px}.rtc3-grid{grid-template-columns:1fr;grid-auto-rows:minmax(210px,42dvh)}.rtc3-tile{min-height:210px;aspect-ratio:auto}.rtc3-head{position:sticky;top:0;z-index:5;background:#09090b;padding:8px 2px 12px}.rtc3-toolbar{position:sticky;bottom:0;background:#09090b;padding:10px 0 calc(8px + env(safe-area-inset-bottom))}.rtc3-call-button{width:34px!important;min-width:34px!important;height:34px!important;padding:0!important}.rtc3-call-button span{display:none}}
    `;
    document.head.appendChild(style);
  }

  async function ensureMe() {
    if (me) return me;
    me = (await S.api('/api/social/me')).account;
    return me;
  }

  async function getRtcInfo() {
    if (rtcInfo) return rtcInfo;
    const data = await S.api('/api/social/rtc-config');
    const defaults = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ];
    const supplied = Array.isArray(data.iceServers) ? data.iceServers : [];
    const hasTurn = supplied.some(server => {
      const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
      return urls.some(url => /^turns?:/i.test(String(url || '')));
    });
    rtcInfo = {
      config: { iceServers: [...defaults, ...supplied], bundlePolicy: 'max-bundle', iceCandidatePoolSize: 4 },
      hasTurn
    };
    return rtcInfo;
  }

  function icon(kind) {
    const paths = {
      audio:'<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
      video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3Z"/>',
      screen:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
  }

  function observeUi() {
    const decorate = () => {
      decorateRaf = 0;
      const audio = document.getElementById('startCall');
      if (audio) {
        audio.classList.add('rtc3-call-button');
        audio.dataset.rtc3 = '1';
        audio.setAttribute('aria-label', 'Chamada de voz');
        audio.title = 'Chamada de voz';
        audio.innerHTML = `${icon('audio')}<span>Áudio</span>`;
      }
      let video = document.getElementById('startVideoCallV2');
      if (audio && !video) {
        video = document.createElement('button');
        video.id = 'startVideoCallV2';
        video.type = 'button';
        video.className = 'button rtc3-call-button';
        audio.insertAdjacentElement('afterend', video);
      }
      if (video) {
        video.classList.add('rtc3-call-button');
        video.dataset.rtc3 = '1';
        video.setAttribute('aria-label', 'Chamada de vídeo');
        video.title = 'Chamada de vídeo';
        video.innerHTML = `${icon('video')}<span>Vídeo</span>`;
      }

      const groupAudio = document.getElementById('groupJoinCall');
      if (groupAudio) {
        groupAudio.classList.add('rtc3-call-button');
        groupAudio.dataset.rtc3 = '1';
        groupAudio.setAttribute('aria-label', 'Entrar por áudio');
        groupAudio.title = 'Entrar por áudio';
        groupAudio.innerHTML = `${icon('audio')}<span>Áudio</span>`;
      }
      let groupVideo = document.getElementById('groupJoinVideoCallV2');
      if (groupAudio && !groupVideo) {
        groupVideo = document.createElement('button');
        groupVideo.id = 'groupJoinVideoCallV2';
        groupVideo.type = 'button';
        groupVideo.className = 'button small primary rtc3-call-button';
        groupAudio.insertAdjacentElement('afterend', groupVideo);
      }
      if (groupVideo) {
        groupVideo.classList.add('rtc3-call-button');
        groupVideo.dataset.rtc3 = '1';
        groupVideo.setAttribute('aria-label', 'Entrar com vídeo');
        groupVideo.title = 'Entrar com vídeo';
        groupVideo.innerHTML = `${icon('video')}<span>Vídeo</span>`;
      }
    };
    const schedule = () => { if (!decorateRaf) decorateRaf = requestAnimationFrame(decorate); };
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
    schedule();

    document.addEventListener('click', event => {
      const button = event.target.closest?.('#startCall,#startVideoCallV2,#groupJoinCall,#groupJoinVideoCallV2');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.id === 'startCall') startDirect('audio').catch(showError);
      else if (button.id === 'startVideoCallV2') startDirect('video').catch(showError);
      else if (button.id === 'groupJoinCall') startGroup('audio').catch(showError);
      else if (button.id === 'groupJoinVideoCallV2') startGroup('video').catch(showError);
    }, true);
  }

  function bindSocket() {
    socket.on('call3:ringing', payload => {
      if (!direct || direct.incoming) return;
      direct.callId = payload.callId;
      setDirectStatus('Chamando…');
    });
    socket.on('call3:incoming', async payload => {
      if (direct || group) return;
      await ensureMe().catch(() => {});
      direct = makeDirect(payload.from, payload.mode, payload.callId, true, 'callee');
      showDirectLayer(true);
    });
    socket.on('call3:claimed', payload => {
      if (direct?.incoming && direct.callId === payload.callId && payload.socketId !== socket.id) cleanupDirect();
    });
    socket.on('call3:accepted', async payload => {
      if (!direct || direct.callId !== payload.callId || direct.incoming) return;
      direct.role = 'caller';
      direct.mode = payload.mode || direct.mode;
      showDirectLayer(false);
      setDirectStatus('Conectando…');
      await ensureDirectPeer();
      emitDirectMediaMode();
      await sendDirectOffer(false);
    });
    socket.on('call3:accepted-local', async payload => {
      if (!direct || direct.callId !== payload.callId || !direct.incoming) return;
      direct.role = 'callee';
      showDirectLayer(false);
      setDirectStatus('Conectando…');
      await ensureDirectPeer();
      emitDirectMediaMode();
      armDirectConnectTimeout();
    });
    socket.on('call3:rejected', payload => { if (direct?.callId === payload.callId) endDirectLocal('Chamada recusada.'); });
    socket.on('call3:ended', payload => { if (direct?.callId === payload.callId) endDirectLocal(payload.reason || 'Chamada encerrada.'); });
    socket.on('call3:error', payload => { if (direct) endDirectLocal(payload.error || 'Falha na chamada.'); else showError(payload.error || 'Falha na chamada.'); });
    socket.on('call3:signal', payload => { if (direct?.callId === payload.callId) handleDirectSignal(payload).catch(() => endDirect(true, 'Falha na negociação WebRTC.')); });
    socket.on('call3:media', payload => {
      if (!direct || direct.callId !== payload.callId) return;
      direct.remoteMediaMode = ['camera','screen'].includes(payload.mode) ? payload.mode : 'none';
      syncDirectMedia();
    });

    socket.on('groupcall3:participants', async payload => {
      if (!group || group.groupId !== payload.groupId) return;
      const participants = Array.isArray(payload.participants) ? payload.participants : [];
      if (!participants.length) setGroupStatus('Na call · aguardando participantes');
      for (const user of participants) {
        groupUsers.set(user.id, user);
        await ensureGroupPeer(user.id, true);
      }
      emitGroupMediaMode();
      renderGroupTiles();
    });
    socket.on('groupcall3:peer-joined', async payload => {
      if (!group || group.groupId !== payload.groupId || !payload.user?.id) return;
      groupUsers.set(payload.user.id, payload.user);
      await ensureGroupPeer(payload.user.id, false);
      emitGroupMediaMode();
      renderGroupTiles();
    });
    socket.on('groupcall3:peer-left', payload => {
      if (!group || group.groupId !== payload.groupId) return;
      closeGroupPeer(payload.userId);
      groupUsers.delete(payload.userId);
      renderGroupTiles();
      if (!group.peers.size) setGroupStatus('Na call · aguardando participantes');
    });
    socket.on('groupcall3:signal', payload => {
      if (!group || group.groupId !== payload.groupId) return;
      handleGroupSignal(payload).catch(() => closeGroupPeer(payload.from));
    });
    socket.on('groupcall3:media', payload => {
      if (!group || group.groupId !== payload.groupId) return;
      const entry = group.peers.get(payload.from);
      if (!entry) return;
      entry.remoteMediaMode = ['camera','screen'].includes(payload.mode) ? payload.mode : 'none';
      renderGroupTiles();
    });
    socket.on('groupcall3:state', payload => updateGroupBadge(payload.groupId, payload.participantIds || []));
    socket.on('groupcall3:error', payload => {
      if (!group || (payload.groupId && payload.groupId !== group.groupId)) return;
      const message = payload.error || 'Falha na chamada do grupo.';
      cleanupGroup();
      showError(message);
    });

    socket.on('disconnect', () => {
      if (direct) endDirectLocal('Conexão realtime perdida. Chamada encerrada.');
      if (group) {
        cleanupGroup();
        showError('Conexão realtime perdida. Entre novamente na chamada do grupo.');
      }
    });
  }

  function makeDirect(user, mode, callId = null, incoming = false, role = '') {
    return {
      callId, remoteUser:user, remoteId:user?.id, mode:mode === 'video' ? 'video' : 'audio', incoming, role,
      localStream:null, audioTrack:null, cameraTrack:null, screenTrack:null,
      pc:null, audioSender:null, videoSender:null, remoteStream:new MediaStream(), pendingIce:[],
      remoteMediaMode:'none', connectTimer:0, disconnectTimer:0, restartTried:false, restarting:false
    };
  }

  async function selectedChatUser() {
    let id = new URLSearchParams(location.search).get('with');
    if (!id) id = document.querySelector('.chat-conversation.active[data-user]')?.dataset.user || '';
    if (!id) throw new Error('Selecione uma conversa primeiro.');
    const data = await S.api('/api/social/conversations');
    const item = (data.conversations || []).find(entry => entry.user?.id === id);
    if (!item?.user) throw new Error('Conversa indisponível.');
    return item.user;
  }

  async function acquireBaseMedia(state, wantVideo) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Seu navegador não oferece câmera/microfone via WebRTC.');
    const audio = { echoCancellation:true, noiseSuppression:true, autoGainControl:true };
    let stream;
    if (wantVideo) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio, video:{ width:{ideal:1280,max:1920}, height:{ideal:720,max:1080}, frameRate:{ideal:24,max:30}, facingMode:'user' } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio, video:false });
      }
    } else stream = await navigator.mediaDevices.getUserMedia({ audio, video:false });
    state.localStream = new MediaStream(stream.getTracks());
    state.audioTrack = stream.getAudioTracks()[0] || null;
    state.cameraTrack = stream.getVideoTracks()[0] || null;
  }

  async function startDirect(mode) {
    if (direct || group) throw new Error('Você já está em uma chamada.');
    if (!socket.connected) throw new Error('O serviço realtime está reconectando.');
    await ensureMe();
    const user = await selectedChatUser();
    direct = makeDirect(user, mode, null, false, 'caller');
    try {
      await acquireBaseMedia(direct, mode === 'video');
      showDirectLayer(false);
      setDirectStatus('Chamando…');
      socket.emit('call3:invite', { to:user.id, mode });
    } catch (error) {
      cleanupDirect();
      throw error;
    }
  }

  async function acceptDirect(withVideo = null) {
    if (!direct?.incoming) return;
    try {
      const video = withVideo == null ? direct.mode === 'video' : Boolean(withVideo);
      await acquireBaseMedia(direct, video);
      showDirectLayer(false);
      setDirectStatus('Conectando…');
      await ensureDirectPeer();
      socket.emit('call3:accept', { callId:direct.callId });
    } catch (error) {
      socket.emit('call3:reject', { callId:direct.callId });
      cleanupDirect();
      throw error;
    }
  }

  function rejectDirect() {
    if (!direct) return;
    if (direct.incoming && direct.callId) socket.emit('call3:reject', { callId:direct.callId });
    cleanupDirect();
  }

  async function createPeerBase(state, onSignal, onMediaChange) {
    const info = await getRtcInfo();
    const pc = new RTCPeerConnection(info.config);
    state.pc = pc;

    const audioTransceiver = pc.addTransceiver('audio', { direction:'sendrecv' });
    state.audioSender = audioTransceiver.sender;
    if (state.audioTrack) await state.audioSender.replaceTrack(state.audioTrack);

    const videoTransceiver = pc.addTransceiver('video', { direction:'sendrecv' });
    state.videoSender = videoTransceiver.sender;
    const localVideo = state.screenTrack || state.cameraTrack || null;
    if (localVideo) await state.videoSender.replaceTrack(localVideo);

    pc.onicecandidate = event => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
      onSignal({ candidate });
    };
    pc.ontrack = event => {
      const track = event.track;
      if (!state.remoteStream.getTracks().some(item => item.id === track.id)) state.remoteStream.addTrack(track);
      const update = () => onMediaChange();
      track.addEventListener('mute', update);
      track.addEventListener('unmute', update);
      track.addEventListener('ended', update, { once:true });
      update();
    };
    return pc;
  }

  async function ensureDirectPeer() {
    if (!direct) return null;
    if (direct.pc) return direct.pc;
    return createPeerBase(
      direct,
      data => socket.emit('call3:signal', { callId:direct.callId, ...data }),
      syncDirectMedia
    ).then(pc => {
      bindDirectConnectionState(pc);
      syncDirectMedia();
      return pc;
    });
  }

  function bindDirectConnectionState(pc) {
    const update = () => {
      if (!direct || direct.pc !== pc) return;
      const connection = pc.connectionState;
      const ice = pc.iceConnectionState;
      if (connection === 'connected' || ice === 'connected' || ice === 'completed') {
        clearTimeout(direct.connectTimer);
        clearTimeout(direct.disconnectTimer);
        direct.connectTimer = direct.disconnectTimer = 0;
        setDirectStatus('Em chamada');
        syncDirectMedia();
        return;
      }
      if (connection === 'disconnected' || ice === 'disconnected') {
        setDirectStatus('Reconectando…');
        clearTimeout(direct.disconnectTimer);
        direct.disconnectTimer = setTimeout(() => {
          if (!direct || direct.pc !== pc) return;
          if (direct.role === 'caller') restartDirectIce().catch(() => endDirect(true, connectionErrorText()));
        }, 6000);
      }
      if (connection === 'failed' || ice === 'failed') {
        if (direct.role === 'caller') restartDirectIce().catch(() => endDirect(true, connectionErrorText()));
        else setDirectStatus('Aguardando rota alternativa…');
      }
      if (connection === 'closed') clearDirectTimers();
    };
    pc.addEventListener('connectionstatechange', update);
    pc.addEventListener('iceconnectionstatechange', update);
  }

  async function sendDirectOffer(iceRestart = false) {
    if (!direct?.pc || direct.role !== 'caller') return;
    const offer = await direct.pc.createOffer(iceRestart ? { iceRestart:true } : undefined);
    await direct.pc.setLocalDescription(offer);
    socket.emit('call3:signal', { callId:direct.callId, description:direct.pc.localDescription });
    armDirectConnectTimeout(iceRestart ? 12000 : 18000);
  }

  async function restartDirectIce() {
    if (!direct?.pc || direct.role !== 'caller' || direct.restarting) return;
    if (direct.restartTried) return endDirect(true, connectionErrorText());
    direct.restartTried = true;
    direct.restarting = true;
    setDirectStatus('Tentando uma rota alternativa…');
    try { await sendDirectOffer(true); }
    finally { if (direct) direct.restarting = false; }
  }

  function armDirectConnectTimeout(delay = null) {
    if (!direct?.pc) return;
    clearTimeout(direct.connectTimer);
    const timeout = delay || (direct.role === 'caller' ? 18000 : 32000);
    direct.connectTimer = setTimeout(() => {
      if (!direct?.pc) return;
      const pc = direct.pc;
      if (pc.connectionState === 'connected' || ['connected','completed'].includes(pc.iceConnectionState)) return;
      if (direct.role === 'caller') restartDirectIce().catch(() => endDirect(true, connectionErrorText()));
      else endDirect(true, connectionErrorText());
    }, timeout);
  }

  function connectionErrorText() {
    return rtcInfo?.hasTurn
      ? 'Não foi possível fechar a conexão de mídia. Tente novamente.'
      : 'Não foi possível conectar a mídia nesta rede. O servidor precisa de TURN para redes com NAT/firewall restritivo.';
  }

  async function handleDirectSignal(payload) {
    const pc = await ensureDirectPeer();
    if (!direct || !pc) return;
    if (payload.candidate) {
      if (!pc.remoteDescription) direct.pendingIce.push(payload.candidate);
      else await pc.addIceCandidate(payload.candidate).catch(() => {});
      return;
    }
    const description = payload.description;
    if (!description) return;
    if (description.type === 'offer') {
      if (pc.signalingState !== 'stable') {
        try { await pc.setLocalDescription({ type:'rollback' }); } catch {}
      }
      await pc.setRemoteDescription(description);
      await flushIce(direct);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call3:signal', { callId:direct.callId, description:pc.localDescription });
      armDirectConnectTimeout();
    } else if (description.type === 'answer' && pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(description);
      await flushIce(direct);
    }
  }

  async function flushIce(state) {
    if (!state?.pc?.remoteDescription) return;
    const pending = state.pendingIce.splice(0);
    for (const candidate of pending) await state.pc.addIceCandidate(candidate).catch(() => {});
  }

  function showDirectLayer(incoming) {
    if (!direct) return;
    let layer = document.getElementById('rtc3Layer');
    if (!layer) { layer = document.createElement('div'); layer.id = 'rtc3Layer'; layer.className = 'rtc3-layer'; document.body.appendChild(layer); }
    const user = direct.remoteUser || {};
    const initial = String(user.displayName || user.username || '?').slice(0,1).toUpperCase();
    const own = String(me?.username || 'V').slice(0,1).toUpperCase();
    layer.innerHTML = `<section class="rtc3-shell"><header class="rtc3-head"><div class="rtc3-head-copy"><strong>${esc(user.displayName || user.username || 'Chamada')}</strong><span>@${esc(user.username || '')} · ${direct.mode === 'video' ? 'vídeo' : 'áudio'}</span></div><div class="rtc3-status" id="rtc3Status">${incoming ? 'Chamada recebida' : 'Preparando…'}</div></header><div class="rtc3-grid"><div class="rtc3-tile" id="rtc3RemoteTile"><video id="rtc3RemoteVideo" autoplay playsinline></video><div class="rtc3-avatar">${esc(initial)}</div><span class="rtc3-label">${esc(user.displayName || user.username || 'Contato')}</span><span class="rtc3-badge" id="rtc3RemoteMode">áudio</span></div><div class="rtc3-tile" id="rtc3LocalTile"><video id="rtc3LocalVideo" class="mirror" autoplay muted playsinline></video><div class="rtc3-avatar">${esc(own)}</div><span class="rtc3-label">Você</span><span class="rtc3-badge" id="rtc3LocalMode">áudio</span></div></div>${incoming ? `<div class="rtc3-incoming"><button class="button primary" id="rtc3AcceptAudio" type="button">Atender com áudio</button><button class="button primary" id="rtc3AcceptVideo" type="button">Atender com vídeo</button><button class="button danger" id="rtc3Reject" type="button">Recusar</button></div>` : toolbarMarkup('direct')}<div class="rtc3-note">Câmera e tela são transmitidas apenas enquanto esta chamada estiver ativa.</div></section>`;
    layer.querySelector('#rtc3AcceptAudio')?.addEventListener('click', () => acceptDirect(false).catch(showError));
    layer.querySelector('#rtc3AcceptVideo')?.addEventListener('click', () => acceptDirect(true).catch(showError));
    layer.querySelector('#rtc3Reject')?.addEventListener('click', rejectDirect);
    bindToolbar(layer, 'direct');
    syncDirectMedia();
  }

  function toolbarMarkup(scope) {
    const prefix = scope === 'group' ? 'rtc3Group' : 'rtc3';
    return `<div class="rtc3-toolbar"><button class="button" id="${prefix}Mic" type="button">Microfone</button><button class="button" id="${prefix}Camera" type="button">Câmera</button><button class="button" id="${prefix}Screen" type="button">${icon('screen')} Espelhar tela</button><button class="button danger" id="${prefix}Hangup" type="button">Encerrar</button></div>`;
  }

  function bindToolbar(root, scope) {
    const prefix = scope === 'group' ? 'rtc3Group' : 'rtc3';
    root.querySelector(`#${prefix}Mic`)?.addEventListener('click', () => toggleMic(scope));
    root.querySelector(`#${prefix}Camera`)?.addEventListener('click', () => toggleCamera(scope).catch(showError));
    root.querySelector(`#${prefix}Screen`)?.addEventListener('click', () => toggleScreen(scope).catch(showError));
    root.querySelector(`#${prefix}Hangup`)?.addEventListener('click', () => scope === 'group' ? leaveGroup(true) : endDirect(true));
  }

  function setDirectStatus(text) { const el = document.getElementById('rtc3Status'); if (el) el.textContent = text; }
  function setGroupStatus(text) { const el = document.getElementById('rtc3GroupStatus'); if (el) el.textContent = text; }

  function activeVideo(state) { return state?.screenTrack || state?.cameraTrack || null; }
  function localMediaMode(state) { return state?.screenTrack ? 'screen' : state?.cameraTrack && state.cameraTrack.readyState === 'live' ? 'camera' : 'none'; }

  function syncDirectMedia() {
    if (!direct) return;
    const local = document.getElementById('rtc3LocalVideo');
    const remote = document.getElementById('rtc3RemoteVideo');
    const localTrack = activeVideo(direct);
    if (local) {
      local.srcObject = localTrack ? new MediaStream([localTrack]) : null;
      if (localTrack) local.play().catch(() => {});
      local.classList.toggle('mirror', !direct.screenTrack);
    }
    if (remote) {
      remote.srcObject = direct.remoteStream;
      remote.play().catch(() => {});
    }
    const remoteVideo = direct.remoteStream.getVideoTracks().find(track => track.readyState === 'live' && !track.muted);
    const localTile = document.getElementById('rtc3LocalTile');
    const remoteTile = document.getElementById('rtc3RemoteTile');
    localTile?.classList.toggle('has-video', Boolean(localTrack && localTrack.readyState === 'live'));
    localTile?.classList.toggle('screen', Boolean(direct.screenTrack));
    remoteTile?.classList.toggle('has-video', Boolean(remoteVideo));
    remoteTile?.classList.toggle('screen', direct.remoteMediaMode === 'screen');
    const localMode = document.getElementById('rtc3LocalMode');
    const remoteMode = document.getElementById('rtc3RemoteMode');
    if (localMode) localMode.textContent = direct.screenTrack ? 'tela' : direct.cameraTrack ? 'câmera' : 'áudio';
    if (remoteMode) remoteMode.textContent = direct.remoteMediaMode === 'screen' ? 'tela compartilhada' : direct.remoteMediaMode === 'camera' ? 'câmera' : 'áudio';
    updateToolbar('direct');
  }

  function toggleMic(scope) {
    const state = scope === 'group' ? group : direct;
    if (!state?.audioTrack) return;
    state.audioTrack.enabled = !state.audioTrack.enabled;
    updateToolbar(scope);
  }

  async function toggleCamera(scope) {
    const state = scope === 'group' ? group : direct;
    if (!state) return;
    if (state.cameraTrack) {
      const old = state.cameraTrack;
      state.cameraTrack = null;
      try { state.localStream?.removeTrack(old); } catch {}
      try { old.stop(); } catch {}
      if (!state.screenTrack) await replaceOutboundVideo(state, null);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:{ideal:1280,max:1920}, height:{ideal:720,max:1080}, frameRate:{ideal:24,max:30}, facingMode:'user' }, audio:false });
      const track = stream.getVideoTracks()[0];
      state.cameraTrack = track;
      state.localStream?.addTrack(track);
      track.addEventListener('ended', () => {
        if (state.cameraTrack !== track) return;
        state.cameraTrack = null;
        if (!state.screenTrack) replaceOutboundVideo(state, null).finally(() => syncMedia(scope));
      }, { once:true });
      if (!state.screenTrack) await replaceOutboundVideo(state, track);
    }
    emitMediaMode(scope);
    syncMedia(scope);
  }

  async function toggleScreen(scope) {
    const state = scope === 'group' ? group : direct;
    if (!state) return;
    if (state.screenTrack) return stopScreen(scope);
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Compartilhamento de tela não é suportado neste navegador/dispositivo.');
    const stream = await navigator.mediaDevices.getDisplayMedia({ video:{ frameRate:{ideal:20,max:30} }, audio:false });
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    state.screenTrack = track;
    track.contentHint = 'detail';
    track.addEventListener('ended', () => {
      if (state.screenTrack !== track) return;
      state.screenTrack = null;
      replaceOutboundVideo(state, state.cameraTrack || null).finally(() => {
        emitMediaMode(scope);
        syncMedia(scope);
      });
    }, { once:true });
    await replaceOutboundVideo(state, track);
    emitMediaMode(scope);
    syncMedia(scope);
  }

  async function stopScreen(scope) {
    const state = scope === 'group' ? group : direct;
    const track = state?.screenTrack;
    if (!track) return;
    state.screenTrack = null;
    try { track.stop(); } catch {}
    await replaceOutboundVideo(state, state.cameraTrack || null);
    emitMediaMode(scope);
    syncMedia(scope);
  }

  async function replaceOutboundVideo(state, track) {
    if (state === direct) {
      if (direct?.videoSender) await direct.videoSender.replaceTrack(track);
      return;
    }
    if (state === group) {
      await Promise.all([...group.peers.values()].map(entry => entry.videoSender?.replaceTrack(track).catch(() => {})));
    }
  }

  function emitMediaMode(scope) {
    if (scope === 'direct') emitDirectMediaMode();
    else emitGroupMediaMode();
  }

  function emitDirectMediaMode() {
    if (direct?.callId) socket.emit('call3:media', { callId:direct.callId, mode:localMediaMode(direct) });
  }

  function emitGroupMediaMode() {
    if (group?.groupId) socket.emit('groupcall3:media', { groupId:group.groupId, mode:localMediaMode(group) });
  }

  function updateToolbar(scope) {
    const state = scope === 'group' ? group : direct;
    if (!state) return;
    const prefix = scope === 'group' ? 'rtc3Group' : 'rtc3';
    const mic = document.getElementById(`${prefix}Mic`);
    const cam = document.getElementById(`${prefix}Camera`);
    const screen = document.getElementById(`${prefix}Screen`);
    if (mic) mic.textContent = state.audioTrack?.enabled === false ? 'Ativar microfone' : 'Silenciar microfone';
    if (cam) cam.textContent = state.cameraTrack ? 'Desligar câmera' : 'Ativar câmera';
    if (screen) screen.innerHTML = `${icon('screen')} ${state.screenTrack ? 'Parar espelhamento' : 'Espelhar tela'}`;
  }

  function syncMedia(scope) { if (scope === 'group') renderGroupTiles(); else syncDirectMedia(); }

  function clearDirectTimers() {
    if (!direct) return;
    clearTimeout(direct.connectTimer);
    clearTimeout(direct.disconnectTimer);
    direct.connectTimer = direct.disconnectTimer = 0;
  }

  function endDirect(emit = true, reason = 'Chamada encerrada.') {
    if (emit && direct?.callId) socket.emit('call3:end', { callId:direct.callId, reason });
    endDirectLocal(reason);
  }

  function endDirectLocal(reason = '') {
    if (!direct) return;
    if (reason) setDirectStatus(reason);
    setTimeout(cleanupDirect, reason ? 650 : 0);
  }

  function cleanupDirect() {
    if (!direct) { document.getElementById('rtc3Layer')?.remove(); return; }
    clearDirectTimers();
    try { direct.pc?.close(); } catch {}
    for (const track of [direct.screenTrack, direct.cameraTrack, direct.audioTrack]) if (track) try { track.stop(); } catch {}
    direct.localStream?.getTracks().forEach(track => { try { track.stop(); } catch {} });
    direct.remoteStream?.getTracks().forEach(track => { try { track.stop(); } catch {} });
    direct = null;
    document.getElementById('rtc3Layer')?.remove();
  }

  async function startGroup(mode) {
    if (direct || group) throw new Error('Você já está em uma chamada.');
    if (!socket.connected) throw new Error('O serviço realtime está reconectando.');
    await ensureMe();
    const active = document.querySelector('.group-item.active[data-group-id],.group-v3-item.active[data-group-id]');
    const groupId = active?.dataset.groupId;
    if (!groupId) throw new Error('Selecione um grupo primeiro.');
    const data = await S.api('/api/community/groups');
    const info = (data.groups || []).find(item => item.id === groupId);
    if (!info) throw new Error('Grupo indisponível.');
    group = { groupId, info, mode, localStream:null, audioTrack:null, cameraTrack:null, screenTrack:null, peers:new Map() };
    groupUsers.clear();
    for (const user of info.members || []) groupUsers.set(user.id, user);
    try {
      await acquireBaseMedia(group, mode === 'video');
      showGroupLayer();
      socket.emit('groupcall3:join', { groupId, mode });
    } catch (error) {
      cleanupGroup();
      throw error;
    }
  }

  function showGroupLayer() {
    if (!group) return;
    let layer = document.getElementById('rtc3GroupLayer');
    if (!layer) { layer = document.createElement('div'); layer.id = 'rtc3GroupLayer'; layer.className = 'rtc3-layer'; document.body.appendChild(layer); }
    layer.innerHTML = `<section class="rtc3-shell"><header class="rtc3-head"><div class="rtc3-head-copy"><strong>${esc(group.info?.name || 'Grupo')}</strong><span>Chamada em grupo · até 6 participantes</span></div><div class="rtc3-status" id="rtc3GroupStatus">Entrando…</div></header><div class="rtc3-grid" id="rtc3GroupGrid"></div>${toolbarMarkup('group')}<div class="rtc3-note">Câmera e tela usam um canal de vídeo reservado desde a entrada na call, evitando renegociações ao trocar a fonte.</div></section>`;
    bindToolbar(layer, 'group');
    renderGroupTiles();
  }

  async function ensureGroupPeer(userId, initiator = false) {
    if (!group || !userId || userId === me?.id) return null;
    if (group.peers.has(userId)) return group.peers.get(userId);
    const entry = {
      userId, pc:null, audioSender:null, videoSender:null, remoteStream:new MediaStream(), pendingIce:[],
      initiator:Boolean(initiator), restartTried:false, restarting:false, connectTimer:0, disconnectTimer:0, remoteMediaMode:'none'
    };
    group.peers.set(userId, entry);
    await createPeerBase(
      { ...entry, localStream:group.localStream, audioTrack:group.audioTrack, cameraTrack:group.cameraTrack, screenTrack:group.screenTrack, remoteStream:entry.remoteStream },
      data => socket.emit('groupcall3:signal', { groupId:group.groupId, to:userId, ...data }),
      renderGroupTiles
    ).then(pc => {
      entry.pc = pc;
      const audio = pc.getTransceivers().find(t => t.receiver?.track?.kind === 'audio');
      const video = pc.getTransceivers().find(t => t.receiver?.track?.kind === 'video');
      entry.audioSender = audio?.sender || null;
      entry.videoSender = video?.sender || null;
      bindGroupConnectionState(entry);
    });
    if (initiator) await sendGroupOffer(entry, false);
    renderGroupTiles();
    return entry;
  }

  function bindGroupConnectionState(entry) {
    const pc = entry.pc;
    const update = () => {
      if (!group || group.peers.get(entry.userId) !== entry) return;
      const connected = pc.connectionState === 'connected' || ['connected','completed'].includes(pc.iceConnectionState);
      if (connected) {
        clearTimeout(entry.connectTimer);
        clearTimeout(entry.disconnectTimer);
        entry.connectTimer = entry.disconnectTimer = 0;
        setGroupStatus('Em chamada');
        renderGroupTiles();
        return;
      }
      if (pc.connectionState === 'disconnected' || pc.iceConnectionState === 'disconnected') {
        clearTimeout(entry.disconnectTimer);
        entry.disconnectTimer = setTimeout(() => {
          if (entry.initiator) restartGroupIce(entry).catch(() => closeGroupPeer(entry.userId));
        }, 6500);
      }
      if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') {
        if (entry.initiator) restartGroupIce(entry).catch(() => closeGroupPeer(entry.userId));
      }
    };
    pc.addEventListener('connectionstatechange', update);
    pc.addEventListener('iceconnectionstatechange', update);
  }

  async function sendGroupOffer(entry, iceRestart) {
    if (!group || !entry?.pc) return;
    const offer = await entry.pc.createOffer(iceRestart ? { iceRestart:true } : undefined);
    await entry.pc.setLocalDescription(offer);
    socket.emit('groupcall3:signal', { groupId:group.groupId, to:entry.userId, description:entry.pc.localDescription });
    armGroupTimeout(entry, iceRestart ? 12000 : 19000);
  }

  async function restartGroupIce(entry) {
    if (!group || !entry?.initiator || entry.restarting) return;
    if (entry.restartTried) return closeGroupPeer(entry.userId);
    entry.restartTried = true;
    entry.restarting = true;
    try { await sendGroupOffer(entry, true); }
    finally { entry.restarting = false; }
  }

  function armGroupTimeout(entry, delay) {
    clearTimeout(entry.connectTimer);
    entry.connectTimer = setTimeout(() => {
      if (!group || group.peers.get(entry.userId) !== entry) return;
      const pc = entry.pc;
      if (pc.connectionState === 'connected' || ['connected','completed'].includes(pc.iceConnectionState)) return;
      if (entry.initiator) restartGroupIce(entry).catch(() => closeGroupPeer(entry.userId));
      else closeGroupPeer(entry.userId);
    }, delay || (entry.initiator ? 19000 : 33000));
  }

  async function handleGroupSignal(payload) {
    let entry = group?.peers.get(payload.from);
    if (!entry) entry = await ensureGroupPeer(payload.from, false);
    if (!entry?.pc || !group) return;
    const pc = entry.pc;
    if (payload.candidate) {
      if (!pc.remoteDescription) entry.pendingIce.push(payload.candidate);
      else await pc.addIceCandidate(payload.candidate).catch(() => {});
      return;
    }
    const description = payload.description;
    if (!description) return;
    if (description.type === 'offer') {
      if (pc.signalingState !== 'stable') {
        try { await pc.setLocalDescription({ type:'rollback' }); } catch {}
      }
      await pc.setRemoteDescription(description);
      await flushEntryIce(entry);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('groupcall3:signal', { groupId:group.groupId, to:payload.from, description:pc.localDescription });
      armGroupTimeout(entry, 33000);
    } else if (description.type === 'answer' && pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(description);
      await flushEntryIce(entry);
    }
  }

  async function flushEntryIce(entry) {
    if (!entry?.pc?.remoteDescription) return;
    const pending = entry.pendingIce.splice(0);
    for (const candidate of pending) await entry.pc.addIceCandidate(candidate).catch(() => {});
  }

  function closeGroupPeer(userId) {
    const entry = group?.peers.get(userId);
    if (!entry) return;
    clearTimeout(entry.connectTimer);
    clearTimeout(entry.disconnectTimer);
    try { entry.pc?.close(); } catch {}
    entry.remoteStream?.getTracks().forEach(track => { try { track.stop(); } catch {} });
    group.peers.delete(userId);
    renderGroupTiles();
  }

  function renderGroupTiles() {
    const grid = document.getElementById('rtc3GroupGrid');
    if (!grid || !group) return;
    const peers = [...group.peers.entries()];
    const ownInitial = String(me?.username || 'V').slice(0,1).toUpperCase();
    const localTrack = activeVideo(group);
    grid.innerHTML = `<div class="rtc3-tile ${localTrack ? 'has-video' : ''} ${group.screenTrack ? 'screen' : ''}" data-rtc3-self><video class="${group.screenTrack ? '' : 'mirror'}" autoplay muted playsinline></video><div class="rtc3-avatar">${esc(ownInitial)}</div><span class="rtc3-label">Você</span><span class="rtc3-badge">${group.screenTrack ? 'tela' : group.cameraTrack ? 'câmera' : 'áudio'}</span></div>` + peers.map(([id, entry]) => {
      const user = groupUsers.get(id) || { username:'Participante', displayName:'Participante' };
      const initial = String(user.displayName || user.username || '?').slice(0,1).toUpperCase();
      const video = entry.remoteStream.getVideoTracks().find(track => track.readyState === 'live' && !track.muted);
      return `<div class="rtc3-tile ${video ? 'has-video' : ''} ${entry.remoteMediaMode === 'screen' ? 'screen' : ''}" data-rtc3-peer="${esc(id)}"><video autoplay playsinline></video><div class="rtc3-avatar">${esc(initial)}</div><span class="rtc3-label">${esc(user.displayName || user.username)}</span><span class="rtc3-badge">${entry.remoteMediaMode === 'screen' ? 'tela compartilhada' : entry.remoteMediaMode === 'camera' ? 'câmera' : 'áudio'}</span></div>`;
    }).join('');
    const selfVideo = grid.querySelector('[data-rtc3-self] video');
    if (selfVideo) {
      selfVideo.srcObject = localTrack ? new MediaStream([localTrack]) : null;
      if (localTrack) selfVideo.play().catch(() => {});
    }
    for (const [id, entry] of peers) {
      const video = grid.querySelector(`[data-rtc3-peer="${CSS.escape(id)}"] video`);
      if (video) { video.srcObject = entry.remoteStream; video.play().catch(() => {}); }
    }
    updateToolbar('group');
  }

  function updateGroupBadge(groupId, ids) {
    const rows = document.querySelectorAll(`.group-item[data-group-id="${CSS.escape(groupId)}"] span,.group-v3-item[data-group-id="${CSS.escape(groupId)}"] span`);
    rows.forEach(row => { row.textContent = row.textContent.replace(/ · \d+ na call$/,'') + ` · ${ids.length} na call`; });
    const active = document.querySelector('.group-item.active,.group-v3-item.active');
    if (active?.dataset.groupId === groupId) {
      const status = document.getElementById('groupV3CallCount') || document.getElementById('groupCallStatus');
      if (status) status.textContent = `${ids.length} na call`;
      if (group?.groupId === groupId && ids.length <= 1 && !group.peers.size) setGroupStatus('Na call · aguardando participantes');
    }
  }

  function leaveGroup(emit = true) {
    if (!group) return;
    if (emit) socket.emit('groupcall3:leave', { groupId:group.groupId });
    cleanupGroup();
  }

  function cleanupGroup() {
    if (!group) { document.getElementById('rtc3GroupLayer')?.remove(); return; }
    for (const id of [...group.peers.keys()]) closeGroupPeer(id);
    for (const track of [group.screenTrack, group.cameraTrack, group.audioTrack]) if (track) try { track.stop(); } catch {}
    group.localStream?.getTracks().forEach(track => { try { track.stop(); } catch {} });
    group = null;
    groupUsers.clear();
    document.getElementById('rtc3GroupLayer')?.remove();
  }

  function showError(error) {
    const text = typeof error === 'string' ? error : (error?.message || 'Ocorreu um erro na chamada.');
    const toast = document.getElementById('chatToastV16') || document.getElementById('chatToastV15');
    if (toast) {
      toast.textContent = text;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 4200);
    } else alert(text);
  }

  addEventListener('pagehide', () => {
    if (direct?.callId) socket.emit('call3:end', { callId:direct.callId, reason:'Página fechada.' });
    if (group?.groupId) socket.emit('groupcall3:leave', { groupId:group.groupId });
    cleanupDirect();
    cleanupGroup();
  }, { once:true });
})();
