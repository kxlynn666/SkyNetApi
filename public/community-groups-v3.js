(() => {
  if (window.__SKYNET_COMMUNITY_GROUPS_V3__) return;
  window.__SKYNET_COMMUNITY_GROUPS_V3__ = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/painel/grupos') return;
  const S = window.SkyNet;
  if (!S) return;

  let socket = null;
  let me = null;
  let groups = [];
  let friends = [];
  let currentGroup = null;
  let knownMessages = new Set();
  let rtcConfig = null;

  let callGroupId = null;
  let audioStream = null;
  let cameraStream = null;
  let screenStream = null;
  const peers = new Map();
  const participantUsers = new Map();
  let micEnabled = true;
  let groupCallLockTimer = 0;
  const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const CALL_LOCK_KEY = 'skynet_group_call_v3_lock';

  const esc = value => S.escapeHtml(value == null ? '' : String(value));

  function installStyles() {
    if (document.getElementById('communityGroupsV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'communityGroupsV3Styles';
    style.textContent = `
      .groups-v3-layout{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:620px;border:1px solid #29292e;background:#08080a;overflow:hidden}.groups-v3-sidebar{border-right:1px solid #252529;overflow:auto;background:#09090b}.groups-v3-head{padding:14px;border-bottom:1px solid #252529}.groups-v3-list{padding:5px}.group-v3-item{width:100%;border:1px solid transparent;background:transparent;color:inherit;text-align:left;padding:11px;cursor:pointer;margin:2px 0}.group-v3-item:hover{background:#111113}.group-v3-item.active{background:#151517;border-color:#303035;box-shadow:inset 2px 0 0 #f0f0ed}.group-v3-item strong,.group-v3-item span{display:block}.group-v3-item span{font-size:9px;color:#77777e;margin-top:3px}.group-v3-main{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;background:#09090b}.group-v3-header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #252529}.group-v3-title{flex:1;min-width:0}.group-v3-title strong,.group-v3-title span{display:block}.group-v3-title span{font-size:9px;color:#797980;margin-top:2px}.group-v3-actions{display:flex;gap:6px;flex-wrap:wrap}.group-v3-messages{padding:14px;overflow:auto;display:flex;flex-direction:column;gap:6px;overscroll-behavior:contain}.group-v3-message{max-width:76%;padding:9px 11px;align-self:flex-start;background:#111113;border:1px solid #252529;overflow-wrap:anywhere}.group-v3-message.mine{align-self:flex-end;background:#17151d;border-color:#373344}.group-v3-message strong{font-size:9px}.group-v3-message .meta{font-size:7px;color:#707077;margin-top:5px}.group-v3-compose{display:flex;gap:7px;padding:9px;border-top:1px solid #252529}.group-v3-compose input{flex:1;min-width:0}.group-v3-create{display:grid;gap:10px}.group-v3-friends{max-height:190px;overflow:auto;border:1px solid #303035;padding:7px}.group-v3-friend{display:flex;align-items:center;gap:8px;padding:7px}.group-v3-placeholder{display:grid;place-items:center;color:#707077;text-align:center;padding:30px}
      .group-call-v3-layer{position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,.9);display:grid;place-items:center;padding:12px}.group-call-v3-card{width:min(1080px,100%);max-height:95dvh;overflow:auto;background:#08080a;border:1px solid #303035;padding:14px}.group-call-v3-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}.group-call-v3-head-copy{flex:1}.group-call-v3-head-copy strong,.group-call-v3-head-copy span{display:block}.group-call-v3-head-copy span{font-size:9px;color:#7e7e84;margin-top:2px}.group-call-v3-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:9px}.group-call-v3-tile{position:relative;min-height:210px;aspect-ratio:16/10;background:#050506;border:1px solid #29292e;overflow:hidden}.group-call-v3-tile video{width:100%;height:100%;display:block;object-fit:cover;background:#050506}.group-call-v3-tile.self video{transform:scaleX(-1)}.group-call-v3-tile.self[data-screen="1"] video{transform:none}.group-call-v3-fallback{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,rgba(142,130,232,.13),transparent 60%),#08080a}.group-call-v3-avatar{width:76px;height:76px;display:grid;place-items:center;object-fit:cover;background:#15121d;border:1px solid #34303e;font-size:24px;font-weight:800}.group-call-v3-label{position:absolute;left:7px;bottom:7px;z-index:4;background:rgba(5,5,6,.82);border:1px solid #303035;padding:5px 7px;font-size:8px}.group-call-v3-peer-tools{position:absolute;right:7px;bottom:7px;z-index:4}.group-call-v3-toolbar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-top:11px;padding-top:11px;border-top:1px solid #252529}.group-call-v3-state{text-align:center;margin-top:8px;font-size:8px;color:#77777e}
      @media(max-width:820px){.groups-v3-layout{display:block;min-height:560px}.groups-v3-sidebar,.group-v3-main{min-height:260px}.groups-v3-sidebar{max-height:230px;border-right:0;border-bottom:1px solid #252529}.group-v3-message{max-width:88%}.group-v3-header{align-items:flex-start}.group-v3-actions .button{font-size:9px!important}.group-call-v3-grid{grid-template-columns:1fr}.group-call-v3-tile{min-height:180px}.group-call-v3-card{padding:9px}}
    `;
    document.head.appendChild(style);
  }

  function waitForWorkspace() {
    const ready = () => document.getElementById('workspaceShell') && !document.getElementById('workspaceShell').classList.contains('hidden') && document.getElementById('workspaceContent');
    if (ready()) return boot();
    const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); boot(); } });
    observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    setTimeout(() => observer.disconnect(), 12000);
  }

  async function boot() {
    installStyles();
    document.getElementById('workspaceKicker').textContent = 'Social';
    document.getElementById('workspaceTitle').textContent = 'Grupos';
    document.getElementById('workspaceDescription').textContent = 'Chat em grupo, voz, vídeo e compartilhamento de tela.';
    document.title = 'Grupos - SkyNetApi';
    document.querySelectorAll('.workspace-nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === '/painel/grupos'));
    try {
      me = await S.session();
      friends = (await S.api('/api/social/friends')).friends || [];
      renderPage();
      setupSocket();
      await loadGroups();
    } catch (error) {
      document.getElementById('workspaceContent').innerHTML = `<div class="workspace-card"><div class="message show error">${esc(error.message || 'Não foi possível carregar os grupos.')}</div></div>`;
    }
  }

  function renderPage() {
    document.getElementById('workspaceContent').innerHTML = `<section class="workspace-card" style="margin-bottom:16px"><div class="workspace-card-header"><div><h2>Novo grupo</h2><p>Até 12 membros. A call suporta até 6 pessoas.</p></div></div><div class="message" id="groupV3Message"></div><form class="group-v3-create" id="groupV3Create"><input name="name" maxlength="60" required placeholder="Nome do grupo"><div class="group-v3-friends">${friends.length ? friends.map(friend => `<label class="group-v3-friend"><input type="checkbox" name="member" value="${esc(friend.id)}"><span>${esc(friend.displayName || friend.username)} <span class="hint">@${esc(friend.username)}</span></span></label>`).join('') : '<div class="hint">Adicione amigos para convidá-los.</div>'}</div><button class="button primary" type="submit">Criar grupo</button></form></section><section class="groups-v3-layout"><aside class="groups-v3-sidebar"><div class="groups-v3-head"><strong>Seus grupos</strong><div class="hint" id="groupsV3Socket">conectando</div></div><div class="groups-v3-list" id="groupsV3List"></div></aside><main class="group-v3-main" id="groupV3Main"><div class="group-v3-placeholder">Selecione um grupo.</div></main></section>`;
    document.getElementById('groupV3Create').addEventListener('submit', createGroup);
  }

  async function createGroup(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.getElementById('groupV3Message');
    try {
      const data = await S.api('/api/community/groups', { method:'POST', body:{ name:form.get('name'), memberIds:form.getAll('member') } });
      event.currentTarget.reset();
      await loadGroups();
      await openGroup(data.group.id);
      S.message(message, 'Grupo criado.', 'success');
    } catch (error) { S.message(message, error.message, 'error'); }
  }

  async function loadGroups() {
    const data = await S.api('/api/community/groups');
    groups = data.groups || [];
    const root = document.getElementById('groupsV3List');
    if (!root) return;
    root.innerHTML = groups.length ? groups.map(group => `<button class="group-v3-item ${currentGroup?.id === group.id ? 'active' : ''}" data-group-id="${esc(group.id)}"><strong>${esc(group.name)}</strong><span>${group.members.length} membros · ${group.callParticipantIds?.length || 0} na call</span></button>`).join('') : '<div class="social-empty" style="margin:12px">Nenhum grupo ainda.</div>';
    root.querySelectorAll('[data-group-id]').forEach(button => button.addEventListener('click', () => openGroup(button.dataset.groupId)));
    if (currentGroup) {
      const fresh = groups.find(group => group.id === currentGroup.id);
      if (fresh) currentGroup = fresh;
    }
  }

  async function openGroup(id) {
    const group = groups.find(item => item.id === id);
    if (!group) return;
    currentGroup = group;
    knownMessages = new Set();
    renderGroupsListActive();
    const main = document.getElementById('groupV3Main');
    main.innerHTML = `<header class="group-v3-header"><div class="group-v3-title"><strong>${esc(group.name)}</strong><span>${group.members.length} membros · <span id="groupV3CallCount">${group.callParticipantIds?.length || 0} na call</span></span></div><div class="group-v3-actions"><button class="button primary small" id="groupV3JoinCall" type="button">Entrar na call</button>${group.isOwner ? '<button class="button small" id="groupV3Manage" type="button">Gerenciar</button>' : '<button class="button small" id="groupV3Leave" type="button">Sair</button>'}</div></header><div class="group-v3-messages" id="groupV3Messages"><div class="social-empty">Carregando mensagens...</div></div><form class="group-v3-compose" id="groupV3Compose"><input id="groupV3Input" maxlength="2000" autocomplete="off" placeholder="Mensagem no grupo..."><button class="button primary">Enviar</button></form>`;
    document.getElementById('groupV3JoinCall').addEventListener('click', joinGroupCall);
    document.getElementById('groupV3Compose').addEventListener('submit', sendGroupMessage);
    document.getElementById('groupV3Manage')?.addEventListener('click', manageGroup);
    document.getElementById('groupV3Leave')?.addEventListener('click', leaveGroup);
    await loadMessages();
  }

  function renderGroupsListActive() {
    document.querySelectorAll('.group-v3-item').forEach(button => button.classList.toggle('active', button.dataset.groupId === currentGroup?.id));
  }

  async function loadMessages() {
    if (!currentGroup) return;
    const groupId = currentGroup.id;
    const data = await S.api(`/api/community/groups/${encodeURIComponent(groupId)}/messages?limit=100`);
    if (currentGroup?.id !== groupId) return;
    const root = document.getElementById('groupV3Messages');
    if (!root) return;
    knownMessages = new Set((data.messages || []).map(message => message.id));
    root.innerHTML = data.messages?.length ? data.messages.map(messageMarkup).join('') : '<div class="social-empty">Nenhuma mensagem ainda.</div>';
    root.scrollTop = root.scrollHeight;
  }

  function messageMarkup(message) {
    const mine = message.fromId === me?.id;
    const canDelete = mine || currentGroup?.isOwner;
    return `<div class="group-v3-message ${mine ? 'mine' : ''}" data-group-message="${esc(message.id)}"><strong>${esc(message.sender?.displayName || message.sender?.username || 'Usuário')}</strong><div>${esc(message.text)}</div><div class="meta">${esc(S.formatDate(message.createdAt))}${canDelete ? ` · <button class="link-button" data-delete-group-message="${esc(message.id)}" type="button">apagar</button>` : ''}</div></div>`;
  }

  function appendMessage(message) {
    if (!message?.id || knownMessages.has(message.id) || message.groupId !== currentGroup?.id) return;
    knownMessages.add(message.id);
    const root = document.getElementById('groupV3Messages');
    if (!root) return;
    const nearBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 120;
    root.querySelector('.social-empty')?.remove();
    const holder = document.createElement('div');
    holder.innerHTML = messageMarkup(message);
    root.appendChild(holder.firstElementChild);
    if (nearBottom || message.fromId === me?.id) root.scrollTop = root.scrollHeight;
  }

  async function sendGroupMessage(event) {
    event.preventDefault();
    if (!currentGroup) return;
    const input = document.getElementById('groupV3Input');
    const text = String(input?.value || '').trim();
    if (!text) return;
    input.value = '';
    try {
      const data = await S.api(`/api/community/groups/${encodeURIComponent(currentGroup.id)}/messages`, { method:'POST', body:{ text } });
      if (data.message) appendMessage(data.message);
    } catch (error) {
      input.value = text;
      alert(error.message || 'Não foi possível enviar a mensagem.');
    }
  }

  async function deleteMessage(messageId) {
    if (!currentGroup || !confirm('Apagar mensagem?')) return;
    try { await S.api(`/api/community/groups/${encodeURIComponent(currentGroup.id)}/messages/${encodeURIComponent(messageId)}`, { method:'DELETE' }); }
    catch (error) { alert(error.message); }
  }

  async function manageGroup() {
    if (!currentGroup?.isOwner) return;
    const name = prompt('Nome do grupo:', currentGroup.name);
    if (name === null) return;
    const currentIds = new Set(currentGroup.members.map(member => member.id));
    const available = friends.map(friend => `${currentIds.has(friend.id) ? '[x]' : '[ ]'} ${friend.username} — ${friend.id}`).join('\n');
    const raw = prompt(`IDs dos amigos no grupo, separados por vírgula.\n\n${available}`, [...currentIds].filter(id => id !== me.id).join(','));
    if (raw === null) return;
    try {
      await S.api(`/api/community/groups/${encodeURIComponent(currentGroup.id)}`, { method:'PATCH', body:{ name, memberIds:raw.split(',').map(value => value.trim()).filter(Boolean) } });
      await loadGroups();
      await openGroup(currentGroup.id);
    } catch (error) { alert(error.message); }
  }

  async function leaveGroup() {
    if (!currentGroup || !confirm('Sair deste grupo?')) return;
    const id = currentGroup.id;
    if (callGroupId === id) leaveGroupCall();
    try {
      await S.api(`/api/community/groups/${encodeURIComponent(id)}/leave`, { method:'POST' });
      currentGroup = null;
      document.getElementById('groupV3Main').innerHTML = '<div class="group-v3-placeholder">Selecione um grupo.</div>';
      await loadGroups();
    } catch (error) { alert(error.message); }
  }

  function setupSocket() {
    if (!window.io || socket) return;
    socket = window.io({ path:'/socket.io', transports:['websocket','polling'], reconnection:true, reconnectionDelay:500, reconnectionDelayMax:4000 });
    socket.on('connect', () => {
      const el = document.getElementById('groupsV3Socket'); if (el) el.textContent = 'online';
      if (callGroupId) {
        closeAllPeers();
        socket.emit('group:call:join', { groupId:callGroupId });
        updateCallState('Reconectando à call…');
      }
    });
    socket.on('disconnect', () => {
      const el = document.getElementById('groupsV3Socket'); if (el) el.textContent = 'reconectando';
      if (callGroupId) updateCallState('Conexão perdida. Tentando reconectar…');
    });
    socket.on('group:updated', () => loadGroups().catch(() => {}));
    socket.on('group:message', ({ groupId, message }) => {
      if (groupId === currentGroup?.id && message) appendMessage(message);
      else loadGroups().catch(() => {});
    });
    socket.on('group:message:deleted', ({ groupId, messageId }) => {
      if (groupId === currentGroup?.id && messageId) {
        knownMessages.delete(messageId);
        document.querySelector(`[data-group-message="${CSS.escape(messageId)}"]`)?.remove();
      }
    });
    socket.on('group:call:state', ({ groupId, participantIds }) => {
      const group = groups.find(item => item.id === groupId);
      if (group) group.callParticipantIds = participantIds || [];
      if (currentGroup?.id === groupId) {
        currentGroup.callParticipantIds = participantIds || [];
        const el = document.getElementById('groupV3CallCount'); if (el) el.textContent = `${participantIds?.length || 0} na call`;
      }
      renderGroupsListActive();
    });
    socket.on('group:call:participants', ({ groupId, participants }) => {
      if (groupId !== callGroupId) return;
      const ids = Array.isArray(participants) ? participants : [];
      for (const id of ids) createPeer(id, true).catch(() => closePeer(id));
      updateCallState('Em chamada');
    });
    socket.on('group:call:peer-joined', ({ groupId, user }) => {
      if (groupId !== callGroupId || !user?.id) return;
      participantUsers.set(user.id, user);
      renderCallTiles();
    });
    socket.on('group:call:peer-left', ({ groupId, userId }) => {
      if (groupId !== callGroupId) return;
      closePeer(userId);
      participantUsers.delete(userId);
      renderCallTiles();
    });
    socket.on('group:call:error', ({ groupId, error }) => {
      if (groupId !== callGroupId) return;
      alert(error || 'Erro na chamada do grupo.');
      leaveGroupCall(false);
    });
    socket.on('group:call:ended', ({ groupId, reason }) => {
      if (groupId !== callGroupId) return;
      alert(reason || 'Chamada encerrada.');
      leaveGroupCall(false);
    });
    socket.on('group:rtc:offer', async ({ groupId, from, data }) => {
      if (groupId !== callGroupId || !from || !data) return;
      try {
        const entry = await createPeer(from, false);
        await entry.pc.setRemoteDescription(data);
        await flushIce(entry);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        socket.emit('group:rtc:answer', { groupId, to:from, data:entry.pc.localDescription });
      } catch { closePeer(from); }
    });
    socket.on('group:rtc:answer', async ({ groupId, from, data }) => {
      if (groupId !== callGroupId || !data) return;
      const entry = peers.get(from);
      if (!entry) return;
      try { await entry.pc.setRemoteDescription(data); await flushIce(entry); } catch { closePeer(from); }
    });
    socket.on('group:rtc:ice', async ({ groupId, from, data }) => {
      if (groupId !== callGroupId || !from || !data) return;
      const entry = peers.get(from) || await createPeer(from, false);
      if (!entry.pc.remoteDescription) entry.pendingIce.push(data);
      else try { await entry.pc.addIceCandidate(data); } catch {}
    });
  }

  async function getRtcConfig() {
    if (rtcConfig) return rtcConfig;
    const data = await S.api('/api/social/rtc-config');
    rtcConfig = { iceServers:data.iceServers || [], bundlePolicy:'max-bundle' };
    return rtcConfig;
  }

  async function ensureAudio() {
    if (audioStream?.getAudioTracks()[0]?.readyState === 'live') return audioStream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microfone indisponível neste navegador.');
    audioStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true }, video:false });
    micEnabled = true;
    return audioStream;
  }

  function readCallLock() {
    try { return JSON.parse(localStorage.getItem(CALL_LOCK_KEY) || 'null'); } catch { return null; }
  }

  function acquireCallLock(groupId) {
    const now = Date.now();
    const lock = readCallLock();
    if (lock && lock.tabId !== tabId && lock.expiresAt > now) return false;
    localStorage.setItem(CALL_LOCK_KEY, JSON.stringify({ tabId, groupId, expiresAt:now + 12_000 }));
    clearInterval(groupCallLockTimer);
    groupCallLockTimer = setInterval(() => {
      if (!callGroupId) return;
      localStorage.setItem(CALL_LOCK_KEY, JSON.stringify({ tabId, groupId:callGroupId, expiresAt:Date.now() + 12_000 }));
    }, 5000);
    return true;
  }

  function releaseCallLock() {
    clearInterval(groupCallLockTimer);
    groupCallLockTimer = 0;
    const lock = readCallLock();
    if (lock?.tabId === tabId) localStorage.removeItem(CALL_LOCK_KEY);
  }

  async function joinGroupCall() {
    if (!currentGroup || callGroupId) return;
    if (!socket?.connected) return alert('Serviço de chamada desconectado.');
    if (!acquireCallLock(currentGroup.id)) return alert('Sua conta já está em uma call de grupo em outra aba.');
    try {
      await ensureAudio();
      callGroupId = currentGroup.id;
      participantUsers.clear();
      (currentGroup.members || []).forEach(member => participantUsers.set(member.id, member));
      showCallLayer();
      socket.emit('group:call:join', { groupId:callGroupId });
    } catch (error) {
      releaseCallLock();
      alert(error.message || 'Não foi possível acessar o microfone.');
    }
  }

  function showCallLayer() {
    document.getElementById('groupCallV3Layer')?.remove();
    const layer = document.createElement('div');
    layer.id = 'groupCallV3Layer';
    layer.className = 'group-call-v3-layer';
    layer.innerHTML = `<section class="group-call-v3-card"><header class="group-call-v3-head"><div class="group-call-v3-head-copy"><strong>${esc(currentGroup?.name || 'Grupo')}</strong><span>voz, vídeo e compartilhamento de tela · até 6 participantes</span></div></header><div class="group-call-v3-grid" id="groupCallV3Grid"></div><div class="group-call-v3-toolbar"><button class="button" id="groupV3Mic" type="button">Silenciar</button><button class="button" id="groupV3Camera" type="button">Ligar câmera</button><button class="button" id="groupV3Screen" type="button">Compartilhar tela</button><button class="button danger" id="groupV3Hangup" type="button">Sair da call</button></div><div class="group-call-v3-state" id="groupCallV3State">Entrando…</div></section>`;
    document.body.appendChild(layer);
    document.getElementById('groupV3Mic').addEventListener('click', toggleMic);
    document.getElementById('groupV3Camera').addEventListener('click', toggleCamera);
    document.getElementById('groupV3Screen').addEventListener('click', toggleScreen);
    document.getElementById('groupV3Hangup').addEventListener('click', () => leaveGroupCall());
    renderCallTiles();
  }

  function updateCallState(text) {
    const el = document.getElementById('groupCallV3State');
    if (el) el.textContent = text;
  }

  function localVideoTrack() {
    return screenStream?.getVideoTracks()[0] || cameraStream?.getVideoTracks()[0] || null;
  }

  async function createPeer(userId, initiator) {
    if (!userId || userId === me?.id) return null;
    if (peers.has(userId)) return peers.get(userId);
    const pc = new RTCPeerConnection(await getRtcConfig());
    const remoteStream = new MediaStream();
    const entry = { pc, remoteStream, pendingIce:[], videoSender:null, muted:false, disconnectTimer:0, initiator:Boolean(initiator) };
    peers.set(userId, entry);
    await ensureAudio();
    audioStream.getAudioTracks().forEach(track => pc.addTrack(track, audioStream));
    const transceiver = pc.addTransceiver('video', { direction:'sendrecv' });
    entry.videoSender = transceiver.sender;
    const current = localVideoTrack();
    if (current) await entry.videoSender.replaceTrack(current);

    pc.onicecandidate = event => {
      if (event.candidate && callGroupId) socket?.emit('group:rtc:ice', { groupId:callGroupId, to:userId, data:event.candidate });
    };
    pc.ontrack = event => {
      const track = event.track;
      if (!remoteStream.getTracks().some(item => item.id === track.id)) remoteStream.addTrack(track);
      track.onmute = renderCallTiles;
      track.onunmute = renderCallTiles;
      track.onended = renderCallTiles;
      renderCallTiles();
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        clearTimeout(entry.disconnectTimer);
        entry.disconnectTimer = 0;
        renderCallTiles();
      } else if (state === 'disconnected') {
        clearTimeout(entry.disconnectTimer);
        entry.disconnectTimer = setTimeout(() => { if (pc.connectionState === 'disconnected') { closePeer(userId); renderCallTiles(); } }, 10_000);
      } else if (state === 'failed') {
        if (entry.initiator && callGroupId) restartPeerIce(userId).catch(() => closePeer(userId));
        else setTimeout(() => { if (pc.connectionState === 'failed') closePeer(userId); }, 3500);
      } else if (state === 'closed') closePeer(userId);
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('group:rtc:offer', { groupId:callGroupId, to:userId, data:pc.localDescription });
    }
    renderCallTiles();
    return entry;
  }

  async function restartPeerIce(userId) {
    const entry = peers.get(userId);
    if (!entry || !callGroupId) return;
    const offer = await entry.pc.createOffer({ iceRestart:true });
    await entry.pc.setLocalDescription(offer);
    socket.emit('group:rtc:offer', { groupId:callGroupId, to:userId, data:entry.pc.localDescription });
  }

  async function flushIce(entry) {
    if (!entry?.pc.remoteDescription) return;
    const queue = entry.pendingIce.splice(0);
    for (const candidate of queue) try { await entry.pc.addIceCandidate(candidate); } catch {}
  }

  function closePeer(userId) {
    const entry = peers.get(userId);
    if (!entry) return;
    clearTimeout(entry.disconnectTimer);
    try { entry.pc.onconnectionstatechange = null; entry.pc.close(); } catch {}
    entry.remoteStream.getTracks().forEach(track => track.stop());
    peers.delete(userId);
  }

  function closeAllPeers() {
    [...peers.keys()].forEach(closePeer);
  }

  function callUser(userId) {
    return participantUsers.get(userId) || currentGroup?.members?.find(member => member.id === userId) || { id:userId, username:userId?.slice(0,8) || '?', displayName:'Participante' };
  }

  function avatarMarkup(user) {
    if (user?.avatarUrl) return `<img class="group-call-v3-avatar" src="${esc(user.avatarUrl)}" alt="">`;
    return `<div class="group-call-v3-avatar">${esc(String(user?.displayName || user?.username || '?').slice(0,1).toUpperCase())}</div>`;
  }

  function renderCallTiles() {
    const grid = document.getElementById('groupCallV3Grid');
    if (!grid) return;
    const ids = [me?.id, ...peers.keys()].filter(Boolean);
    grid.innerHTML = ids.map(id => {
      const self = id === me?.id;
      const user = self ? { ...me, displayName:me.username } : callUser(id);
      const entry = peers.get(id);
      const videoVisible = self ? Boolean(localVideoTrack()) : Boolean(entry?.remoteStream.getVideoTracks().some(track => track.readyState === 'live' && !track.muted));
      return `<article class="group-call-v3-tile ${self ? 'self' : ''}" data-call-user="${esc(id)}" ${self && screenStream ? 'data-screen="1"' : ''}><div class="group-call-v3-fallback" style="display:${videoVisible ? 'none' : 'grid'}">${avatarMarkup(user)}</div><video autoplay playsinline ${self ? 'muted' : ''}></video><span class="group-call-v3-label">${esc(self ? 'Você' : (user.displayName || user.username))}</span>${self ? '' : `<div class="group-call-v3-peer-tools"><button class="button small" data-peer-mute="${esc(id)}" type="button">${entry?.muted ? 'Ativar áudio' : 'Silenciar'}</button></div>`}</article>`;
    }).join('');

    const selfTile = me?.id ? grid.querySelector(`[data-call-user="${CSS.escape(me.id)}"]`) : null;
    const selfVideo = selfTile?.querySelector('video');
    if (selfVideo) {
      const track = localVideoTrack();
      selfVideo.srcObject = track ? new MediaStream([track]) : null;
      if (track) selfVideo.play().catch(() => {});
    }
    for (const [id, entry] of peers) {
      const video = grid.querySelector(`[data-call-user="${CSS.escape(id)}"] video`);
      if (video) { video.srcObject = entry.remoteStream; video.muted = entry.muted; video.play().catch(() => {}); }
    }
    grid.querySelectorAll('[data-peer-mute]').forEach(button => button.addEventListener('click', () => togglePeerMute(button.dataset.peerMute)));
  }

  function togglePeerMute(userId) {
    const entry = peers.get(userId);
    if (!entry) return;
    entry.muted = !entry.muted;
    renderCallTiles();
  }

  function toggleMic(event) {
    const track = audioStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    micEnabled = track.enabled;
    event.currentTarget.textContent = track.enabled ? 'Silenciar' : 'Ativar microfone';
  }

  async function enableCamera() {
    if (cameraStream?.getVideoTracks()[0]?.readyState === 'live') return;
    cameraStream = await navigator.mediaDevices.getUserMedia({ video:{ width:{ideal:960,max:1280}, height:{ideal:540,max:720}, frameRate:{ideal:24,max:30}, facingMode:'user' }, audio:false });
    const track = cameraStream.getVideoTracks()[0];
    if (!screenStream) await replaceVideoForAll(track);
    renderCallTiles();
  }

  async function disableCamera() {
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    if (!screenStream) await replaceVideoForAll(null);
    renderCallTiles();
  }

  async function toggleCamera(event) {
    try {
      if (cameraStream) await disableCamera(); else await enableCamera();
      event.currentTarget.textContent = cameraStream ? 'Desligar câmera' : 'Ligar câmera';
    } catch (error) { alert(error.message || 'Não foi possível acessar a câmera.'); }
  }

  async function toggleScreen(event) {
    if (screenStream) return stopScreen();
    if (!navigator.mediaDevices?.getDisplayMedia) return alert('Compartilhamento de tela não é suportado neste dispositivo/navegador.');
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video:{ frameRate:{ideal:15,max:30} }, audio:false });
      const track = screenStream.getVideoTracks()[0];
      track.contentHint = 'detail';
      track.onended = () => stopScreen();
      await replaceVideoForAll(track);
      event.currentTarget.textContent = 'Parar compartilhamento';
      renderCallTiles();
    } catch (error) {
      screenStream = null;
      if (error?.name !== 'NotAllowedError') alert(error.message || 'Não foi possível compartilhar a tela.');
    }
  }

  async function stopScreen() {
    const old = screenStream;
    screenStream = null;
    old?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    await replaceVideoForAll(cameraStream?.getVideoTracks()[0] || null);
    const button = document.getElementById('groupV3Screen'); if (button) button.textContent = 'Compartilhar tela';
    renderCallTiles();
  }

  async function replaceVideoForAll(track) {
    await Promise.all([...peers.values()].map(entry => entry.videoSender?.replaceTrack(track).catch(() => {})));
  }

  function leaveGroupCall(emit = true) {
    const id = callGroupId;
    if (emit && id) socket?.emit('group:call:leave', { groupId:id });
    closeAllPeers();
    audioStream?.getTracks().forEach(track => track.stop());
    cameraStream?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    audioStream = null;
    cameraStream = null;
    screenStream = null;
    callGroupId = null;
    participantUsers.clear();
    releaseCallLock();
    document.getElementById('groupCallV3Layer')?.remove();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-delete-group-message]');
    if (button) deleteMessage(button.dataset.deleteGroupMessage);
  });

  addEventListener('storage', event => {
    if (event.key !== CALL_LOCK_KEY || !callGroupId) return;
    const lock = readCallLock();
    if (lock && lock.tabId !== tabId && lock.expiresAt > Date.now()) {
      alert('A chamada foi aberta em outra aba. Esta sessão será desconectada da call.');
      leaveGroupCall();
    }
  });

  addEventListener('pagehide', () => leaveGroupCall(), { once:true });
  waitForWorkspace();
})();
