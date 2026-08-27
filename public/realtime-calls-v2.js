(() => {
  if (window.__SKYNET_REALTIME_CALLS_V2__) return;
  window.__SKYNET_REALTIME_CALLS_V2__ = true;
  if (!location.pathname.startsWith('/painel')) return;
  const S = window.SkyNet;
  if (!S || !window.SkyNetRealtime) return;

  const socket = window.SkyNetRealtime.getSocket();
  let me = null;
  let rtcConfig = null;
  let direct = null;
  let group = null;
  const groupUsers = new Map();
  let decorateRaf = 0;

  const esc = value => S.escapeHtml(value == null ? '' : String(value));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  installStyles();
  bindSocket();
  observeUi();
  ensureMe().catch(() => {});

  function installStyles() {
    if (document.getElementById('rtcCallsV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'rtcCallsV2Styles';
    style.textContent = `
      .rtc2-call-button{display:inline-flex!important;align-items:center!important;gap:5px!important}.rtc2-call-button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .rtc2-layer{position:fixed;inset:0;z-index:12000;background:rgba(3,3,5,.88);display:grid;place-items:center;padding:16px;overscroll-behavior:contain}.rtc2-shell{width:min(1080px,100%);max-height:calc(100dvh - 28px);overflow:auto;border:1px solid #303035;background:#09090b;box-shadow:0 32px 110px rgba(0,0,0,.58);padding:14px}.rtc2-head{display:flex;align-items:center;gap:12px;padding:4px 3px 13px}.rtc2-head-copy{min-width:0;flex:1}.rtc2-head-copy strong,.rtc2-head-copy span{display:block}.rtc2-head-copy strong{font-size:15px}.rtc2-head-copy span{font-size:10px;color:#818188;margin-top:3px}.rtc2-status{font:600 9px 'IBM Plex Mono',monospace;color:#aaa3df}
      .rtc2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.rtc2-tile{position:relative;min-height:220px;aspect-ratio:16/10;overflow:hidden;border:1px solid #29292e;background:#111113;display:grid;place-items:center}.rtc2-tile video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#09090b}.rtc2-tile video.rtc2-mirror{transform:scaleX(-1)}.rtc2-tile.screen video{object-fit:contain;transform:none}.rtc2-avatar{width:74px;height:74px;display:grid;place-items:center;border:1px solid #38383e;background:#171719;font-weight:800;font-size:25px;z-index:1}.rtc2-tile.has-video .rtc2-avatar{opacity:0}.rtc2-label{position:absolute;left:8px;bottom:8px;z-index:3;padding:5px 7px;background:rgba(6,6,8,.78);border:1px solid rgba(255,255,255,.09);font-size:9px}.rtc2-badge{position:absolute;right:8px;top:8px;z-index:3;padding:4px 6px;background:rgba(6,6,8,.78);border:1px solid rgba(255,255,255,.09);font-size:8px;color:#bbb5e8}
      .rtc2-toolbar{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;padding-top:13px}.rtc2-toolbar .button{min-height:38px!important}.rtc2-incoming{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:14px 0 2px}.rtc2-note{text-align:center;color:#77777e;font-size:9px;padding:8px 0 1px}.rtc2-hidden{display:none!important}
      @media(max-width:760px){.rtc2-layer{padding:0}.rtc2-shell{width:100%;height:100dvh;max-height:none;border:0;padding:10px}.rtc2-grid{grid-template-columns:1fr;grid-auto-rows:minmax(210px,42dvh)}.rtc2-tile{min-height:210px;aspect-ratio:auto}.rtc2-head{position:sticky;top:0;z-index:5;background:#09090b;padding:8px 2px 12px}.rtc2-toolbar{position:sticky;bottom:0;background:#09090b;padding:10px 0 calc(8px + env(safe-area-inset-bottom))}.rtc2-call-button{width:34px!important;min-width:34px!important;height:34px!important;padding:0!important;justify-content:center}.rtc2-call-button span{display:none}}
    `;
    document.head.appendChild(style);
  }

  async function ensureMe() {
    if (me) return me;
    const data = await S.api('/api/social/me');
    me = data.account;
    return me;
  }

  async function getRtcConfig() {
    if (rtcConfig) return rtcConfig;
    const data = await S.api('/api/social/rtc-config');
    rtcConfig = { iceServers:Array.isArray(data.iceServers) ? data.iceServers : [] };
    return rtcConfig;
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
      const start = document.getElementById('startCall');
      if (start && start.dataset.rtc2 !== '1') {
        start.dataset.rtc2 = '1';
        start.classList.add('rtc2-call-button');
        start.setAttribute('aria-label','Chamada de voz');
        start.title = 'Chamada de voz';
        start.innerHTML = `${icon('audio')}<span>Áudio</span>`;
        if (!document.getElementById('startVideoCallV2')) {
          const video = document.createElement('button');
          video.id = 'startVideoCallV2'; video.type='button'; video.className='button rtc2-call-button'; video.dataset.rtc2='1';
          video.setAttribute('aria-label','Chamada de vídeo'); video.title='Chamada de vídeo'; video.innerHTML=`${icon('video')}<span>Vídeo</span>`;
          start.insertAdjacentElement('afterend',video);
        }
      }
      const groupCall = document.getElementById('groupJoinCall');
      if (groupCall && groupCall.dataset.rtc2 !== '1') {
        groupCall.dataset.rtc2='1'; groupCall.classList.add('rtc2-call-button'); groupCall.classList.remove('primary'); groupCall.setAttribute('aria-label','Entrar por áudio'); groupCall.title='Entrar por áudio'; groupCall.innerHTML=`${icon('audio')}<span>Áudio</span>`;
        if (!document.getElementById('groupJoinVideoCallV2')) {
          const video=document.createElement('button'); video.id='groupJoinVideoCallV2'; video.type='button'; video.className='button small primary rtc2-call-button'; video.dataset.rtc2='1'; video.setAttribute('aria-label','Entrar com vídeo'); video.title='Entrar com vídeo'; video.innerHTML=`${icon('video')}<span>Vídeo</span>`; groupCall.insertAdjacentElement('afterend',video);
        }
      }
    };
    const schedule = () => { if (!decorateRaf) decorateRaf=requestAnimationFrame(decorate); };
    new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
    schedule();

    document.addEventListener('click', async event => {
      const button = event.target.closest?.('#startCall,#startVideoCallV2,#groupJoinCall,#groupJoinVideoCallV2');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (button.id === 'startCall') startDirect('audio').catch(showError);
      if (button.id === 'startVideoCallV2') startDirect('video').catch(showError);
      if (button.id === 'groupJoinCall') startGroup('audio').catch(showError);
      if (button.id === 'groupJoinVideoCallV2') startGroup('video').catch(showError);
    }, true);
  }

  function bindSocket() {
    socket.on('call2:ringing', payload => {
      if (!direct || direct.incoming) return;
      direct.callId = payload.callId;
      setStatus('Chamando…');
    });
    socket.on('call2:incoming', payload => {
      if (direct || group) { socket.emit('call2:reject',{callId:payload.callId}); return; }
      direct = makeDirectState(payload.from,payload.mode,payload.callId,true);
      showDirectLayer(true);
    });
    socket.on('call2:claimed', payload => {
      if (direct?.incoming && direct.callId === payload.callId && payload.socketId !== socket.id) cleanupDirect(false);
    });
    socket.on('call2:accepted', async payload => {
      if (!direct || direct.callId !== payload.callId || direct.incoming) return;
      direct.mode = payload.mode || direct.mode;
      showDirectLayer(false);
      setStatus('Conectando…');
      await ensureDirectPeer();
    });
    socket.on('call2:accepted-local', async payload => {
      if (!direct || direct.callId !== payload.callId || !direct.incoming) return;
      showDirectLayer(false);
      setStatus('Conectando…');
      await ensureDirectPeer();
    });
    socket.on('call2:rejected', payload => { if (direct?.callId === payload.callId) endDirectLocal('Chamada recusada.'); });
    socket.on('call2:ended', payload => { if (direct?.callId === payload.callId) endDirectLocal(payload.reason || 'Chamada encerrada.'); });
    socket.on('call2:error', payload => { if (direct) endDirectLocal(payload.error || 'Falha na chamada.'); else showError(payload.error || 'Falha na chamada.'); });
    socket.on('call2:signal', payload => { if (direct?.callId === payload.callId) handleDirectSignal(payload).catch(() => endDirectLocal('Falha ao negociar a conexão.')); });

    socket.on('groupcall2:participants', async payload => {
      if (!group || group.groupId !== payload.groupId) return;
      for (const user of payload.participants || []) { groupUsers.set(user.id,user); await ensureGroupPeer(user.id); }
      renderGroupTiles();
    });
    socket.on('groupcall2:peer-joined', async payload => {
      if (!group || group.groupId !== payload.groupId || !payload.user) return;
      groupUsers.set(payload.user.id,payload.user);
      await ensureGroupPeer(payload.user.id);
      renderGroupTiles();
    });
    socket.on('groupcall2:peer-left', payload => {
      if (!group || group.groupId !== payload.groupId) return;
      closeGroupPeer(payload.userId); groupUsers.delete(payload.userId); renderGroupTiles();
    });
    socket.on('groupcall2:signal', payload => {
      if (!group || group.groupId !== payload.groupId) return;
      handleGroupSignal(payload).catch(() => {});
    });
    socket.on('groupcall2:state', payload => updateGroupBadge(payload.groupId,payload.participantIds || []));
    socket.on('groupcall2:error', payload => { if (group && (!payload.groupId || payload.groupId === group.groupId)) { showError(payload.error || 'Falha na call do grupo.'); cleanupGroup(false); } });

    socket.on('disconnect', () => {
      if (direct) setStatus('Reconectando sinalização…');
      if (group) setGroupStatus('Reconectando sinalização…');
    });
  }

  function makeDirectState(user, mode, callId = null, incoming = false) {
    return { callId, remoteUser:user, remoteId:user.id, mode, incoming, localStream:null, cameraTrack:null, screenTrack:null, pc:null, remoteStream:new MediaStream(), videoSender:null, makingOffer:false, ignoreOffer:false, settingAnswer:false, pendingIce:[], failTimer:0 };
  }

  async function currentChatUser() {
    const id = new URLSearchParams(location.search).get('with');
    if (!id) throw new Error('Selecione uma conversa primeiro.');
    const data = await S.api('/api/social/conversations');
    const entry = (data.conversations || []).find(item => item.user?.id === id);
    if (!entry?.user) throw new Error('Conversa indisponível.');
    return entry.user;
  }

  async function startDirect(mode) {
    if (direct || group) throw new Error('Você já está em uma chamada.');
    if (!socket.connected) throw new Error('O serviço realtime está reconectando.');
    await ensureMe();
    const user = await currentChatUser();
    direct = makeDirectState(user,mode,null,false);
    try {
      await acquireMedia(direct,mode);
      showDirectLayer(false);
      setStatus('Chamando…');
      socket.emit('call2:invite',{to:user.id,mode});
    } catch (error) { cleanupDirect(false); throw error; }
  }

  async function acceptDirect() {
    if (!direct?.incoming) return;
    try {
      await acquireMedia(direct,direct.mode);
      showDirectLayer(false);
      setStatus('Conectando…');
      socket.emit('call2:accept',{callId:direct.callId});
    } catch (error) {
      socket.emit('call2:reject',{callId:direct.callId});
      cleanupDirect(false);
      throw error;
    }
  }

  function rejectDirect() {
    if (!direct) return;
    if (direct.incoming && direct.callId) socket.emit('call2:reject',{callId:direct.callId});
    cleanupDirect(false);
  }

  async function acquireMedia(state, mode) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Seu navegador não oferece câmera/microfone via WebRTC.');
    const audio = { echoCancellation:true, noiseSuppression:true, autoGainControl:true };
    let stream;
    if (mode === 'video') {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio, video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30},facingMode:'user'} }); }
      catch { stream = await navigator.mediaDevices.getUserMedia({ audio, video:false }); }
    } else stream = await navigator.mediaDevices.getUserMedia({audio,video:false});
    state.localStream = stream;
    state.cameraTrack = stream.getVideoTracks()[0] || null;
  }

  async function ensureDirectPeer() {
    if (!direct || direct.pc) return direct?.pc;
    const pc = new RTCPeerConnection(await getRtcConfig());
    direct.pc = pc;
    const audioTrack = direct.localStream?.getAudioTracks()[0];
    if (audioTrack) pc.addTrack(audioTrack,direct.localStream);
    const activeVideo = direct.screenTrack || direct.cameraTrack;
    if (activeVideo) direct.videoSender = pc.addTrack(activeVideo,new MediaStream([activeVideo]));
    bindPeer(pc,direct,direct.remoteId,(payload)=>socket.emit('call2:signal',{callId:direct.callId,...payload}));
    syncDirectMediaElements();
    return pc;
  }

  function bindPeer(pc, state, remoteId, sendSignal) {
    const polite = String((me?.id || '')).localeCompare(String(remoteId)) > 0;
    pc.onicecandidate = event => { if (event.candidate) sendSignal({candidate:event.candidate.toJSON ? event.candidate.toJSON() : event.candidate}); };
    pc.ontrack = event => {
      const track = event.track;
      if (!state.remoteStream.getTracks().some(t => t.id === track.id)) state.remoteStream.addTrack(track);
      track.addEventListener('ended',()=>syncAllMediaElements(),{once:true});
      syncAllMediaElements();
    };
    pc.onnegotiationneeded = async () => {
      try {
        state.makingOffer = true;
        await pc.setLocalDescription();
        sendSignal({description:pc.localDescription});
      } catch {} finally { state.makingOffer=false; }
    };
    pc.onconnectionstatechange = () => {
      const value = pc.connectionState;
      if (value === 'connected') { clearTimeout(state.failTimer); state.failTimer=0; if (state === direct) setStatus('Em chamada'); else setGroupStatus('Em chamada'); }
      if (value === 'disconnected') schedulePeerFailure(state,pc,9000);
      if (value === 'failed') { try { pc.restartIce(); } catch {} schedulePeerFailure(state,pc,6500); }
      if (value === 'closed') clearTimeout(state.failTimer);
    };
    state._polite = polite;
  }

  function schedulePeerFailure(state, pc, delay) {
    clearTimeout(state.failTimer);
    state.failTimer=setTimeout(()=>{
      if (!pc || pc.connectionState === 'connected' || pc.connectionState === 'connecting') return;
      if (state === direct) endDirect(true,'Conexão perdida.');
    },delay);
  }

  async function processSignal(state, pc, payload, sendSignal) {
    if (payload.description) {
      const description=payload.description;
      const ready = !state.makingOffer && (pc.signalingState === 'stable' || state.settingAnswer);
      const collision = description.type === 'offer' && !ready;
      state.ignoreOffer = !state._polite && collision;
      if (state.ignoreOffer) return;
      state.settingAnswer = description.type === 'answer';
      await pc.setRemoteDescription(description);
      state.settingAnswer = false;
      while (state.pendingIce.length) {
        const candidate=state.pendingIce.shift();
        try { await pc.addIceCandidate(candidate); } catch {}
      }
      if (description.type === 'offer') {
        await pc.setLocalDescription();
        sendSignal({description:pc.localDescription});
      }
    } else if (payload.candidate) {
      if (state.ignoreOffer) return;
      if (!pc.remoteDescription) state.pendingIce.push(payload.candidate);
      else await pc.addIceCandidate(payload.candidate).catch(()=>{});
    }
  }

  async function handleDirectSignal(payload) {
    const pc=await ensureDirectPeer();
    if (!pc || !direct) return;
    await processSignal(direct,pc,payload,data=>socket.emit('call2:signal',{callId:direct.callId,...data}));
  }

  function showDirectLayer(incoming) {
    if (!direct) return;
    let layer=document.getElementById('rtc2Layer');
    if (!layer) { layer=document.createElement('div'); layer.id='rtc2Layer'; layer.className='rtc2-layer'; document.body.appendChild(layer); }
    const user=direct.remoteUser || {};
    const initial=String(user.displayName||user.username||'?').slice(0,1).toUpperCase();
    layer.innerHTML=`<section class="rtc2-shell"><header class="rtc2-head"><div class="rtc2-head-copy"><strong>${esc(user.displayName||user.username||'Chamada')}</strong><span>@${esc(user.username||'')} · ${direct.mode==='video'?'vídeo':'áudio'}</span></div><div class="rtc2-status" id="rtc2Status">${incoming?'Chamada recebida':'Preparando…'}</div></header><div class="rtc2-grid"><div class="rtc2-tile" id="rtc2RemoteTile"><video id="rtc2RemoteVideo" autoplay playsinline></video><div class="rtc2-avatar">${esc(initial)}</div><span class="rtc2-label">${esc(user.displayName||user.username||'Contato')}</span></div><div class="rtc2-tile" id="rtc2LocalTile"><video id="rtc2LocalVideo" class="rtc2-mirror" autoplay muted playsinline></video><div class="rtc2-avatar">${esc(String(me?.username||'V').slice(0,1).toUpperCase())}</div><span class="rtc2-label">Você</span><span class="rtc2-badge" id="rtc2LocalMode">${direct.mode==='video'?'câmera':'áudio'}</span></div></div>${incoming?'<div class="rtc2-incoming"><button class="button primary" id="rtc2Accept" type="button">Atender</button><button class="button danger" id="rtc2Reject" type="button">Recusar</button></div>':toolbarMarkup('direct')}<div class="rtc2-note">A câmera e a tela só são compartilhadas enquanto esta chamada estiver ativa.</div></section>`;
    layer.querySelector('#rtc2Accept')?.addEventListener('click',()=>acceptDirect().catch(showError));
    layer.querySelector('#rtc2Reject')?.addEventListener('click',rejectDirect);
    bindToolbar(layer,'direct');
    syncDirectMediaElements();
  }

  function toolbarMarkup(scope) {
    const prefix=scope==='group'?'rtc2Group':'rtc2';
    return `<div class="rtc2-toolbar"><button class="button" id="${prefix}Mic" type="button">Microfone</button><button class="button" id="${prefix}Camera" type="button">Câmera</button><button class="button" id="${prefix}Screen" type="button">${icon('screen')} Espelhar tela</button><button class="button danger" id="${prefix}Hangup" type="button">Encerrar</button></div>`;
  }

  function bindToolbar(root,scope) {
    const prefix=scope==='group'?'rtc2Group':'rtc2';
    root.querySelector(`#${prefix}Mic`)?.addEventListener('click',()=>toggleMic(scope));
    root.querySelector(`#${prefix}Camera`)?.addEventListener('click',()=>toggleCamera(scope).catch(showError));
    root.querySelector(`#${prefix}Screen`)?.addEventListener('click',()=>toggleScreen(scope).catch(showError));
    root.querySelector(`#${prefix}Hangup`)?.addEventListener('click',()=>scope==='group'?leaveGroup(true):endDirect(true));
  }

  function setStatus(text) { const el=document.getElementById('rtc2Status'); if(el)el.textContent=text; }
  function setGroupStatus(text) { const el=document.getElementById('rtc2GroupStatus'); if(el)el.textContent=text; }

  function syncDirectMediaElements() {
    if (!direct) return;
    const local=document.getElementById('rtc2LocalVideo');
    const remote=document.getElementById('rtc2RemoteVideo');
    const localTrack=direct.screenTrack || direct.cameraTrack;
    if (local) local.srcObject=localTrack?new MediaStream([localTrack]):null;
    if (remote) remote.srcObject=direct.remoteStream;
    const localTile=document.getElementById('rtc2LocalTile');
    const remoteTile=document.getElementById('rtc2RemoteTile');
    localTile?.classList.toggle('has-video',Boolean(localTrack&&localTrack.readyState==='live'));
    localTile?.classList.toggle('screen',Boolean(direct.screenTrack));
    remoteTile?.classList.toggle('has-video',direct.remoteStream.getVideoTracks().some(t=>t.readyState==='live'));
    const mode=document.getElementById('rtc2LocalMode'); if(mode)mode.textContent=direct.screenTrack?'tela':direct.cameraTrack?'câmera':'áudio';
    updateToolbarLabels('direct');
  }

  async function activeState(scope) {
    return scope==='group'?group:direct;
  }

  function toggleMic(scope) {
    const state=scope==='group'?group:direct; const track=state?.localStream?.getAudioTracks()[0]; if(!track)return;
    track.enabled=!track.enabled; updateToolbarLabels(scope);
  }

  async function toggleCamera(scope) {
    const state=scope==='group'?group:direct; if(!state)return;
    if (state.cameraTrack) { state.cameraTrack.enabled=!state.cameraTrack.enabled; updateToolbarLabels(scope); syncAllMediaElements(); return; }
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30},facingMode:'user'},audio:false});
    state.cameraTrack=stream.getVideoTracks()[0];
    state.localStream.addTrack(state.cameraTrack);
    state.cameraTrack.addEventListener('ended',()=>{state.cameraTrack=null;syncAllMediaElements();},{once:true});
    if (!state.screenTrack) await applyVideoTrack(scope,state.cameraTrack);
    syncAllMediaElements();
  }

  async function toggleScreen(scope) {
    const state=scope==='group'?group:direct; if(!state)return;
    if (state.screenTrack) { stopScreen(scope); return; }
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('O navegador não oferece compartilhamento de tela.');
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:20,max:30}},audio:false});
    const track=stream.getVideoTracks()[0]; if(!track)return;
    state.screenTrack=track;
    track.addEventListener('ended',()=>{if(state.screenTrack===track){state.screenTrack=null;applyVideoTrack(scope,state.cameraTrack||null).finally(syncAllMediaElements);}},{once:true});
    await applyVideoTrack(scope,track);
    syncAllMediaElements();
  }

  function stopScreen(scope) {
    const state=scope==='group'?group:direct; const track=state?.screenTrack; if(!track)return;
    state.screenTrack=null;
    try{track.stop();}catch{}
    applyVideoTrack(scope,state.cameraTrack||null).finally(syncAllMediaElements);
  }

  async function applyVideoTrack(scope,track) {
    if (scope==='direct') {
      if (!direct?.pc) return;
      if (direct.videoSender) await direct.videoSender.replaceTrack(track);
      else if (track) direct.videoSender=direct.pc.addTrack(track,new MediaStream([track]));
      return;
    }
    if (!group) return;
    await Promise.all([...group.peers.values()].map(async entry=>{
      if(entry.videoSender) await entry.videoSender.replaceTrack(track);
      else if(track) entry.videoSender=entry.pc.addTrack(track,new MediaStream([track]));
    }));
  }

  function updateToolbarLabels(scope) {
    const state=scope==='group'?group:direct; if(!state)return;
    const prefix=scope==='group'?'rtc2Group':'rtc2';
    const mic=document.getElementById(`${prefix}Mic`), cam=document.getElementById(`${prefix}Camera`), screen=document.getElementById(`${prefix}Screen`);
    const audio=state.localStream?.getAudioTracks()[0];
    if(mic)mic.textContent=audio?.enabled===false?'Ativar microfone':'Silenciar microfone';
    if(cam)cam.textContent=state.cameraTrack?(state.cameraTrack.enabled?'Desligar câmera':'Ativar câmera'):'Ativar câmera';
    if(screen)screen.innerHTML=`${icon('screen')} ${state.screenTrack?'Parar espelhamento':'Espelhar tela'}`;
  }

  function syncAllMediaElements(){syncDirectMediaElements();renderGroupTiles();}

  function endDirect(emit=true,reason='Chamada encerrada.') {
    if (emit && direct?.callId) socket.emit('call2:end',{callId:direct.callId,reason});
    endDirectLocal(reason);
  }

  function endDirectLocal(reason='') {
    if (!direct) return;
    if(reason)setStatus(reason);
    const delay=reason?500:0;
    setTimeout(()=>cleanupDirect(false),delay);
  }

  function cleanupDirect() {
    if (!direct) { document.getElementById('rtc2Layer')?.remove(); return; }
    clearTimeout(direct.failTimer);
    try{direct.pc?.close();}catch{}
    direct.screenTrack && (()=>{try{direct.screenTrack.stop();}catch{}})();
    direct.localStream?.getTracks().forEach(track=>{try{track.stop();}catch{}});
    direct=null; document.getElementById('rtc2Layer')?.remove();
  }

  async function startGroup(mode) {
    if (direct || group) throw new Error('Você já está em uma chamada.');
    if (!socket.connected) throw new Error('O serviço realtime está reconectando.');
    await ensureMe();
    const active=document.querySelector('.group-item.active[data-group-id]');
    const groupId=active?.dataset.groupId;
    if(!groupId)throw new Error('Selecione um grupo primeiro.');
    const data=await S.api('/api/community/groups');
    const info=(data.groups||[]).find(item=>item.id===groupId);
    if(!info)throw new Error('Grupo indisponível.');
    group={groupId,info,mode,localStream:null,cameraTrack:null,screenTrack:null,peers:new Map()};
    groupUsers.clear();
    for(const user of info.members||[])groupUsers.set(user.id,user);
    try{await acquireMedia(group,mode);showGroupLayer();socket.emit('groupcall2:join',{groupId,mode});}catch(error){cleanupGroup(false);throw error;}
  }

  function showGroupLayer() {
    if(!group)return;
    let layer=document.getElementById('rtc2GroupLayer'); if(!layer){layer=document.createElement('div');layer.id='rtc2GroupLayer';layer.className='rtc2-layer';document.body.appendChild(layer);}
    layer.innerHTML=`<section class="rtc2-shell"><header class="rtc2-head"><div class="rtc2-head-copy"><strong>${esc(group.info?.name||'Grupo')}</strong><span>Chamada em grupo · até 6 participantes</span></div><div class="rtc2-status" id="rtc2GroupStatus">Conectando…</div></header><div class="rtc2-grid" id="rtc2GroupGrid"></div>${toolbarMarkup('group')}<div class="rtc2-note">Vídeo e espelhamento são P2P; em grupos, cada participante mantém uma conexão com os demais.</div></section>`;
    bindToolbar(layer,'group');renderGroupTiles();
  }

  async function ensureGroupPeer(userId) {
    if(!group||userId===me?.id)return null;
    if(group.peers.has(userId))return group.peers.get(userId);
    const pc=new RTCPeerConnection(await getRtcConfig());
    const entry={pc,userId,remoteStream:new MediaStream(),videoSender:null,makingOffer:false,ignoreOffer:false,settingAnswer:false,pendingIce:[],failTimer:0};
    group.peers.set(userId,entry);
    const audio=group.localStream?.getAudioTracks()[0]; if(audio)pc.addTrack(audio,group.localStream);
    const video=group.screenTrack||group.cameraTrack; if(video)entry.videoSender=pc.addTrack(video,new MediaStream([video]));
    bindPeer(pc,entry,userId,data=>socket.emit('groupcall2:signal',{groupId:group.groupId,to:userId,...data}));
    return entry;
  }

  async function handleGroupSignal(payload) {
    const entry=await ensureGroupPeer(payload.from); if(!entry||!group)return;
    await processSignal(entry,entry.pc,payload,data=>socket.emit('groupcall2:signal',{groupId:group.groupId,to:payload.from,...data}));
  }

  function closeGroupPeer(id) {
    const entry=group?.peers.get(id);if(!entry)return;clearTimeout(entry.failTimer);try{entry.pc.close();}catch{}group.peers.delete(id);
  }

  function renderGroupTiles() {
    const grid=document.getElementById('rtc2GroupGrid');if(!grid||!group)return;
    const peers=[...group.peers.entries()];
    const ownInitial=String(me?.username||'V').slice(0,1).toUpperCase();
    const localTrack=group.screenTrack||group.cameraTrack;
    grid.innerHTML=`<div class="rtc2-tile ${localTrack?'has-video':''} ${group.screenTrack?'screen':''}" data-rtc2-self><video class="${group.screenTrack?'':'rtc2-mirror'}" autoplay muted playsinline></video><div class="rtc2-avatar">${esc(ownInitial)}</div><span class="rtc2-label">Você</span><span class="rtc2-badge">${group.screenTrack?'tela':group.cameraTrack?'câmera':'áudio'}</span></div>`+peers.map(([id,entry])=>{const user=groupUsers.get(id)||{username:'Participante'};const initial=String(user.displayName||user.username||'?').slice(0,1).toUpperCase();const hasVideo=entry.remoteStream.getVideoTracks().some(t=>t.readyState==='live');return `<div class="rtc2-tile ${hasVideo?'has-video':''}" data-rtc2-peer="${esc(id)}"><video autoplay playsinline></video><div class="rtc2-avatar">${esc(initial)}</div><span class="rtc2-label">${esc(user.displayName||user.username)}</span></div>`;}).join('');
    const selfVideo=grid.querySelector('[data-rtc2-self] video');if(selfVideo)selfVideo.srcObject=localTrack?new MediaStream([localTrack]):null;
    for(const [id,entry] of peers){const video=grid.querySelector(`[data-rtc2-peer="${CSS.escape(id)}"] video`);if(video){video.srcObject=entry.remoteStream;video.play().catch(()=>{});}}
    updateToolbarLabels('group');
  }

  function updateGroupBadge(groupId,ids) {
    const active=document.querySelector(`.group-item[data-group-id="${CSS.escape(groupId)}"] span`); if(active){const base=active.textContent.replace(/ · \d+ na call$/,'');active.textContent=`${base}${ids.length?` · ${ids.length} na call`:''}`;}
    if(document.querySelector('.group-item.active')?.dataset.groupId===groupId){const status=document.getElementById('groupCallStatus');if(status)status.textContent=`${ids.length} na call`;}
  }

  function leaveGroup(emit=true) {
    if(!group)return;if(emit)socket.emit('groupcall2:leave',{groupId:group.groupId});cleanupGroup(false);
  }

  function cleanupGroup() {
    if(!group){document.getElementById('rtc2GroupLayer')?.remove();return;}
    for(const id of [...group.peers.keys()])closeGroupPeer(id);
    if(group.screenTrack)try{group.screenTrack.stop();}catch{}
    group.localStream?.getTracks().forEach(track=>{try{track.stop();}catch{}});
    group=null;groupUsers.clear();document.getElementById('rtc2GroupLayer')?.remove();
  }

  function showError(error) {
    const text=typeof error==='string'?error:(error?.message||'Ocorreu um erro na chamada.');
    const toast=document.getElementById('chatToastV15');
    if(toast){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000);}
    else alert(text);
  }

  addEventListener('pagehide',()=>{if(direct)endDirect(true,'Página fechada.');if(group)leaveGroup(true);},{once:true});
})();
