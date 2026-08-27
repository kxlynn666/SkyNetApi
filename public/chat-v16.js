(() => {
  if (window.__SKYNET_CHAT_V16__) return;
  window.__SKYNET_CHAT_V16__ = true;
  window.__SKYNET_CHAT_V15__ = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/painel/chat') return;
  const S = window.SkyNet;
  if (!S) return;

  let socket = null;
  let currentUser = null;
  let currentChatUser = null;
  let conversations = [];
  let knownMessages = new Set();
  let sending = false;
  const sendQueue = [];
  let conversationRefreshTimer = 0;
  let readTimer = 0;

  let callUser = null;
  let peer = null;
  let remoteStream = null;
  let audioStream = null;
  let cameraStream = null;
  let screenStream = null;
  let videoSender = null;
  let pendingIce = [];
  let rtcConfig = null;
  let callRole = '';
  let callConnected = false;
  let disconnectTimer = 0;
  let outgoingVideoRequested = false;

  const esc = value => S.escapeHtml(value == null ? '' : String(value));

  function avatar(user, size = 42) {
    if (user?.avatarUrl) return `<img class="social-avatar-img" src="${esc(user.avatarUrl)}" alt="" style="width:${size}px;height:${size}px">`;
    const initial = String(user?.displayName || user?.username || '?').slice(0, 1).toUpperCase();
    return `<div class="social-avatar-fallback" style="width:${size}px;height:${size}px">${esc(initial)}</div>`;
  }

  function installStyles() {
    if (document.getElementById('chatV16Styles')) return;
    const style = document.createElement('style');
    style.id = 'chatV16Styles';
    style.textContent = `
      .chat-v16{display:grid;grid-template-columns:300px minmax(0,1fr);height:min(760px,calc(100dvh - 170px));min-height:540px;overflow:hidden;border:1px solid #29292e;background:#08080a;position:relative}
      .chat-v16-sidebar{border-right:1px solid #252529;background:#09090b;min-width:0;overflow:auto}.chat-v16-side-head{position:sticky;top:0;z-index:4;padding:13px;border-bottom:1px solid #252529;background:#09090b}.chat-v16-side-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.chat-v16-search{width:100%;min-height:34px!important;margin-top:9px!important;font-size:10px!important}.chat-v16-list{padding:5px}.chat-conversation{width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:9px;border:1px solid transparent!important;background:transparent;color:inherit;cursor:pointer;margin:2px 0}.chat-conversation:hover{background:#111113!important}.chat-conversation.active{background:#151517!important;border-color:#303035!important;box-shadow:inset 2px 0 0 #f0f0ed!important}.chat-conversation-copy{min-width:0;flex:1}.chat-conversation-copy strong,.chat-conversation-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-conversation-copy strong{font-size:11px}.chat-conversation-copy span{font-size:9px;color:#74747b;margin-top:2px}.chat-unread{min-width:18px;height:18px;padding:0 5px;background:#e8e8e4;color:#08080a;display:grid;place-items:center;font-size:8px;font-weight:700}
      .chat-v16-main{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;position:relative;background:#09090b}.chat-v16-placeholder{display:grid;place-items:center;text-align:center;color:#696970;padding:30px;font-size:11px}.chat-header{display:flex;align-items:center;gap:8px;min-height:64px;padding:10px 12px;border-bottom:1px solid #252529;background:#09090b}.chat-header-copy{min-width:0;flex:1}.chat-header-copy strong,.chat-header-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-header-copy strong{font-size:12px}.chat-header-copy span{font-size:9px;color:#7e7e84;margin-top:2px}.chat-header-actions{display:flex;gap:6px}.chat-header-actions .button{min-height:34px!important;padding:5px 8px!important;font-size:8px!important}.chat-back-v16{display:none!important}
      .chat-messages{padding:15px 16px;overflow:auto;display:flex;flex-direction:column;gap:5px;overscroll-behavior:contain;scrollbar-width:thin}.chat-bubble{position:relative;max-width:min(76%,620px);padding:9px 11px;align-self:flex-start;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.46}.chat-bubble.mine{align-self:flex-end}.chat-bubble .time{display:block;margin-top:4px;font-size:7px;color:#696970}.chat-bubble.pending{opacity:.72}.chat-bubble.failed{border-color:#6a343c!important}.chat-compose{display:flex;gap:7px;align-items:end;padding:9px;border-top:1px solid #252529;background:#09090b}.chat-compose textarea{flex:1;resize:none;min-height:40px;max-height:130px;padding:10px 11px!important;font-size:11px;line-height:1.4;overflow-y:auto}.chat-compose .button{height:40px;min-height:40px!important;padding:0 12px!important}.chat-v16-toast{position:absolute;left:50%;bottom:58px;z-index:6;transform:translate(-50%,8px);opacity:0;pointer-events:none;padding:7px 10px;border:1px solid #3a3033;background:#151012;color:#deb0b8;font-size:9px;transition:.18s ease}.chat-v16-toast.show{opacity:1;transform:translate(-50%,0)}
      .call-v16-layer{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.88);display:grid;place-items:center;padding:14px}.call-v16-card{width:min(940px,100%);max-height:94dvh;overflow:auto;border:1px solid #303035;background:#08080a;padding:16px;box-shadow:0 35px 100px rgba(0,0,0,.55)}.call-v16-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.call-v16-head-copy{flex:1;min-width:0}.call-v16-head-copy strong,.call-v16-head-copy span{display:block}.call-v16-head-copy span{font-size:10px;color:#85858c;margin-top:2px}.call-v16-media{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.34fr);gap:10px;min-height:360px}.call-v16-remote,.call-v16-local{position:relative;overflow:hidden;border:1px solid #29292e;background:#050506;min-height:220px}.call-v16-remote video,.call-v16-local video{width:100%;height:100%;object-fit:cover;display:block;background:#050506}.call-v16-local{min-height:160px}.call-v16-local video{transform:scaleX(-1)}.call-v16-local[data-screen="1"] video{transform:none}.call-v16-fallback{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,rgba(142,130,232,.12),transparent 55%),#08080a}.call-v16-fallback .social-avatar-img,.call-v16-fallback .social-avatar-fallback{width:104px!important;height:104px!important}.call-v16-label{position:absolute;left:8px;bottom:8px;z-index:3;padding:5px 7px;background:rgba(5,5,6,.8);border:1px solid #303035;font-size:8px}.call-v16-toolbar{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin-top:12px}.call-v16-state{text-align:center;margin-top:9px;font-size:9px;color:#8c8c92}.call-v16-incoming{padding:24px;text-align:center}.call-v16-incoming .social-avatar-img,.call-v16-incoming .social-avatar-fallback{width:96px!important;height:96px!important;margin:0 auto 12px}.call-v16-incoming h2{margin:0 0 3px}.call-v16-incoming p{margin:0 0 16px;color:#85858c}.call-v16-incoming-actions{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}
      @media(max-width:760px){.chat-v16{display:block;height:calc(100dvh - 150px);min-height:500px}.chat-v16-sidebar,.chat-v16-main{position:absolute;inset:0;width:100%;height:100%;border:0;transition:opacity .18s ease,transform .22s ease}.chat-v16-sidebar{z-index:2}.chat-v16-main{z-index:3;opacity:0;pointer-events:none;transform:translateX(12px)}.chat-v16.thread-open .chat-v16-sidebar{opacity:0;pointer-events:none;transform:translateX(-12px)}.chat-v16.thread-open .chat-v16-main{opacity:1;pointer-events:auto;transform:none}.chat-back-v16{display:grid!important;width:34px!important;min-width:34px!important;height:34px!important;padding:0!important}.chat-header{padding:8px}.chat-header-actions .button{width:34px!important;min-width:34px!important;height:34px!important;padding:0!important;font-size:0!important}.chat-header-actions .button::after{font-size:13px}.chat-header-actions #startAudioCall::after{content:'☎'}.chat-header-actions #startVideoCall::after{content:'▣'}.chat-header-actions a::after{content:'↗'}.chat-messages{padding:12px 9px}.chat-bubble{max-width:88%;font-size:11px}.chat-compose{padding:8px}.call-v16-media{grid-template-columns:1fr;min-height:0}.call-v16-remote{height:48dvh}.call-v16-local{height:150px}.call-v16-card{padding:10px}.call-v16-toolbar .button{font-size:10px!important}}
    `;
    document.head.appendChild(style);
  }

  function setPage() {
    document.getElementById('workspaceKicker').textContent = 'Social / realtime';
    document.getElementById('workspaceTitle').textContent = 'Chat';
    document.getElementById('workspaceDescription').textContent = 'Mensagens privadas, chamadas de voz e vídeo e compartilhamento de tela.';
    document.title = 'Chat - SkyNetApi';
    document.querySelectorAll('.workspace-nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === '/painel/chat'));
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
    setPage();
    try {
      currentUser = (await S.api('/api/social/me')).account;
      renderShell();
      setupSocket();
      const list = await loadConversations();
      const requested = new URLSearchParams(location.search).get('with');
      const first = list.find(item => item.user.id === requested) || list[0];
      if (first) await openConversation(first.user);
    } catch (error) {
      document.getElementById('workspaceContent').innerHTML = `<div class="workspace-card"><div class="message show error">${esc(error.message || 'Não foi possível carregar o chat.')}</div></div>`;
    }
  }

  function renderShell() {
    document.getElementById('workspaceContent').innerHTML = `<section class="chat-v16 chat-layout" id="chatV16"><aside class="chat-v16-sidebar"><div class="chat-v16-side-head"><div class="chat-v16-side-row"><strong>Conversas</strong><span class="hint" id="chatConnectionV16">conectando</span></div><input class="chat-v16-search" id="chatSearchV16" type="search" placeholder="Buscar conversa..."></div><div class="chat-v16-list" id="conversationList"></div></aside><section class="chat-v16-main" id="chatMain"><div class="chat-v16-placeholder">Selecione um amigo para conversar.</div></section><div class="chat-v16-toast" id="chatToastV16"></div></section>`;
    document.getElementById('chatSearchV16').addEventListener('input', renderConversationList);
  }

  async function loadConversations() {
    const data = await S.api('/api/social/conversations');
    conversations = Array.isArray(data.conversations) ? data.conversations : [];
    renderConversationList();
    return conversations;
  }

  function renderConversationList() {
    const root = document.getElementById('conversationList');
    if (!root) return;
    const q = String(document.getElementById('chatSearchV16')?.value || '').trim().toLowerCase();
    const visible = conversations.filter(item => !q || `${item.user.displayName || ''} ${item.user.username || ''}`.toLowerCase().includes(q));
    root.innerHTML = visible.length ? visible.map(item => `<button class="chat-conversation ${currentChatUser?.id === item.user.id ? 'active' : ''}" data-user="${esc(item.user.id)}">${avatar(item.user,40)}<span class="chat-conversation-copy"><strong>${esc(item.user.displayName || item.user.username)}</strong><span>${esc(item.lastMessage?.text || 'Inicie uma conversa')}</span></span>${item.unreadCount ? `<span class="chat-unread">${Math.min(99,item.unreadCount)}</span>` : ''}</button>`).join('') : '<div class="social-empty">Nenhuma conversa encontrada.</div>';
    root.querySelectorAll('[data-user]').forEach(button => button.addEventListener('click', () => {
      const item = conversations.find(entry => entry.user.id === button.dataset.user);
      if (item) openConversation(item.user);
    }));
  }

  async function openConversation(user) {
    currentChatUser = { ...user };
    knownMessages = new Set();
    const main = document.getElementById('chatMain');
    if (!main) return;
    main.innerHTML = `<header class="chat-header"><button class="button chat-back-v16" id="chatBackV16" type="button" aria-label="Voltar">←</button>${avatar(user,40)}<div class="chat-header-copy"><strong>${esc(user.displayName || user.username)}</strong><span><span id="chatPresenceV16">${user.online ? 'online' : 'offline'}</span> · @${esc(user.username)}</span></div><div class="chat-header-actions"><button class="button" id="startAudioCall" type="button">Áudio</button><button class="button" id="startVideoCall" type="button">Vídeo</button><a class="button" href="/u/${encodeURIComponent(user.username)}" target="_blank" rel="noopener">Perfil</a></div></header><div class="chat-messages" id="chatMessages"><div class="social-empty">Carregando mensagens...</div></div><form class="chat-compose" id="chatForm"><textarea id="chatInput" maxlength="2000" rows="1" autocomplete="off" placeholder="Digite uma mensagem..."></textarea><button class="button primary" type="submit">Enviar</button></form>`;
    document.getElementById('chatBackV16').addEventListener('click', () => document.getElementById('chatV16')?.classList.remove('thread-open'));
    document.getElementById('startAudioCall').addEventListener('click', () => startOutgoingCall(user, false));
    document.getElementById('startVideoCall').addEventListener('click', () => startOutgoingCall(user, true));
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    form.addEventListener('submit', handleSubmit);
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(130,input.scrollHeight)}px`; });
    await loadMessages(user.id);
    queueRead(user.id);
    history.replaceState(null, '', `/painel/chat?with=${encodeURIComponent(user.id)}`);
    document.getElementById('chatV16')?.classList.add('thread-open');
    renderConversationList();
  }

  async function loadMessages(userId) {
    const data = await S.api(`/api/social/messages/${encodeURIComponent(userId)}?limit=80`);
    if (currentChatUser?.id !== userId) return;
    const box = document.getElementById('chatMessages');
    if (!box) return;
    const messages = Array.isArray(data.messages) ? data.messages : [];
    knownMessages = new Set(messages.map(message => message.id));
    box.innerHTML = messages.length ? messages.map(messageBubble).join('') : '<div class="social-empty">Nenhuma mensagem ainda.</div>';
    box.scrollTop = box.scrollHeight;
  }

  function messageBubble(message, extra = '') {
    const mine = message.fromId === currentUser?.id;
    return `<div class="chat-bubble ${mine ? 'mine' : ''} ${extra}" data-message-id="${esc(message.id)}">${esc(message.text)}<span class="time">${esc(S.formatDate(message.createdAt))}${mine ? ` · <button class="link-button" data-delete-message="${esc(message.id)}" type="button">apagar</button>` : ''}</span></div>`;
  }

  function appendMessage(message) {
    if (!message?.id || knownMessages.has(message.id)) return;
    const otherId = message.fromId === currentUser?.id ? message.toId : message.fromId;
    if (currentChatUser?.id !== otherId) return;
    knownMessages.add(message.id);
    const box = document.getElementById('chatMessages');
    if (!box) return;
    box.querySelector('.social-empty')?.remove();
    const holder = document.createElement('div');
    holder.innerHTML = messageBubble(message);
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    box.appendChild(holder.firstElementChild);
    if (nearBottom || message.fromId === currentUser?.id) box.scrollTop = box.scrollHeight;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!currentChatUser) return;
    const input = document.getElementById('chatInput');
    const text = String(input?.value || '').trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const box = document.getElementById('chatMessages');
    box?.querySelector('.social-empty')?.remove();
    if (box) {
      const node = document.createElement('div');
      node.className = 'chat-bubble mine pending';
      node.dataset.clientId = clientId;
      node.innerHTML = `${esc(text)}<span class="time">enviando…</span>`;
      box.appendChild(node);
      box.scrollTop = box.scrollHeight;
    }
    sendQueue.push({ clientId, targetId: currentChatUser.id, text });
    processSendQueue();
  }

  async function processSendQueue() {
    if (sending) return;
    sending = true;
    while (sendQueue.length) {
      const job = sendQueue[0];
      const optimistic = document.querySelector(`[data-client-id="${CSS.escape(job.clientId)}"]`);
      try {
        const data = await S.api(`/api/social/messages/${encodeURIComponent(job.targetId)}`, { method:'POST', body:{ text:job.text } });
        const message = data.message;
        if (message?.id) {
          knownMessages.add(message.id);
          if (optimistic && currentChatUser?.id === job.targetId) {
            optimistic.outerHTML = messageBubble(message);
          } else optimistic?.remove();
          updateConversationFromMessage(message);
        }
      } catch (error) {
        if (optimistic) {
          optimistic.classList.remove('pending');
          optimistic.classList.add('failed');
          optimistic.querySelector('.time').innerHTML = `falhou · <button class="link-button" data-retry-client="${esc(job.clientId)}" type="button">reenviar</button>`;
        }
        showToast(error.message || 'Não foi possível enviar a mensagem.');
      }
      sendQueue.shift();
    }
    sending = false;
  }

  function updateConversationFromMessage(message) {
    const otherId = message.fromId === currentUser?.id ? message.toId : message.fromId;
    const item = conversations.find(entry => entry.user.id === otherId);
    if (item) {
      item.lastMessage = message;
      if (message.fromId !== currentUser?.id && currentChatUser?.id !== otherId) item.unreadCount = Number(item.unreadCount || 0) + 1;
      if (currentChatUser?.id === otherId) item.unreadCount = 0;
      conversations = [item, ...conversations.filter(entry => entry !== item)];
      renderConversationList();
    } else scheduleConversationRefresh();
  }

  function scheduleConversationRefresh() {
    clearTimeout(conversationRefreshTimer);
    conversationRefreshTimer = setTimeout(() => loadConversations().catch(() => {}), 700);
  }

  function queueRead(userId) {
    clearTimeout(readTimer);
    readTimer = setTimeout(() => {
      if (currentChatUser?.id !== userId) return;
      S.api(`/api/social/messages/${encodeURIComponent(userId)}/read`, { method:'POST' }).then(() => {
        const item = conversations.find(entry => entry.user.id === userId);
        if (item) item.unreadCount = 0;
        renderConversationList();
      }).catch(() => {});
    }, 350);
  }

  function setupSocket() {
    if (!window.io || socket) return;
    socket = window.io({ path:'/socket.io', transports:['websocket','polling'], reconnection:true, reconnectionDelay:500, reconnectionDelayMax:4000 });
    socket.on('connect', () => { const el=document.getElementById('chatConnectionV16'); if(el)el.textContent='online'; });
    socket.on('disconnect', () => {
      const el=document.getElementById('chatConnectionV16'); if(el)el.textContent='reconectando';
      if (callUser) finishCall('Conexão da chamada perdida.');
    });
    socket.on('connect_error', () => { const el=document.getElementById('chatConnectionV16'); if(el)el.textContent='offline'; });
    socket.on('chat:message', ({ message }) => {
      if (!message) return;
      appendMessage(message);
      updateConversationFromMessage(message);
      const otherId = message.fromId === currentUser?.id ? message.toId : message.fromId;
      if (message.fromId === otherId && currentChatUser?.id === otherId) queueRead(otherId);
    });
    socket.on('chat:deleted', ({ messageId }) => {
      if (!messageId) return;
      knownMessages.delete(messageId);
      document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)?.remove();
      scheduleConversationRefresh();
    });
    socket.on('social:presence', ({ userId, online }) => {
      const item = conversations.find(entry => entry.user.id === userId);
      if (item) item.user.online = Boolean(online);
      if (currentChatUser?.id === userId) {
        currentChatUser.online = Boolean(online);
        const el = document.getElementById('chatPresenceV16'); if (el) el.textContent = online ? 'online' : 'offline';
      }
    });
    socket.on('friend:accepted', scheduleConversationRefresh);

    socket.on('call:incoming', ({ from }) => showIncomingCall(from));
    socket.on('call:ringing', () => updateCallState('Chamando…'));
    socket.on('call:accepted', async ({ by }) => {
      if (!callUser || callUser.id !== by) return;
      callRole = 'offerer';
      updateCallState('Conectando…');
      try {
        await ensurePeer();
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('rtc:offer', { to:callUser.id, data:peer.localDescription });
      } catch { finishCall('Falha ao iniciar a conexão WebRTC.'); }
    });
    socket.on('call:rejected', () => finishCall('Chamada recusada.'));
    socket.on('call:ended', ({ reason }) => finishCall(reason || 'Chamada encerrada.'));
    socket.on('call:error', ({ error }) => finishCall(error || 'Não foi possível iniciar a chamada.'));
    socket.on('rtc:offer', async ({ from, data }) => {
      if (!callUser || callUser.id !== from || !data) return;
      callRole = 'answerer';
      try {
        await ensurePeer();
        await peer.setRemoteDescription(data);
        await flushPendingIce();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('rtc:answer', { to:from, data:peer.localDescription });
      } catch { finishCall('Falha ao responder à chamada.'); }
    });
    socket.on('rtc:answer', async ({ from, data }) => {
      if (callUser?.id !== from || !peer || !data) return;
      try { await peer.setRemoteDescription(data); await flushPendingIce(); } catch { finishCall('Falha na negociação da chamada.'); }
    });
    socket.on('rtc:ice', async ({ from, data }) => {
      if (callUser?.id !== from || !data) return;
      if (!peer || !peer.remoteDescription) { pendingIce.push(data); return; }
      try { await peer.addIceCandidate(data); } catch {}
    });
  }

  document.addEventListener('click', async event => {
    const del = event.target.closest('[data-delete-message]');
    if (del) {
      if (!confirm('Apagar esta mensagem?')) return;
      try { await S.api(`/api/social/messages/item/${encodeURIComponent(del.dataset.deleteMessage)}`, { method:'DELETE' }); } catch (error) { showToast(error.message || 'Não foi possível apagar.'); }
      return;
    }
    const retry = event.target.closest('[data-retry-client]');
    if (retry) {
      const failed = retry.closest('[data-client-id]');
      if (!failed || !currentChatUser) return;
      const text = failed.childNodes[0]?.textContent?.trim() || '';
      failed.remove();
      if (text) {
        const input = document.getElementById('chatInput');
        input.value = text;
        document.getElementById('chatForm')?.requestSubmit();
      }
    }
  });

  function showToast(text) {
    const el = document.getElementById('chatToastV16');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
  }

  async function startOutgoingCall(user, withVideo) {
    if (callUser) return showToast('Já existe uma chamada em andamento.');
    if (!socket?.connected) return showToast('Serviço de chamada desconectado.');
    try {
      callUser = user;
      outgoingVideoRequested = Boolean(withVideo);
      await ensureAudio();
      if (withVideo) await enableCamera();
      showActiveCallLayer(user, 'Chamando…');
      socket.emit('call:invite', { to:user.id });
    } catch (error) {
      finishCall(error.message || 'Não foi possível acessar seus dispositivos de mídia.');
    }
  }

  function showIncomingCall(user) {
    if (!user) return;
    if (callUser) { socket?.emit('call:reject', { to:user.id }); return; }
    callUser = user;
    document.getElementById('callLayerV16')?.remove();
    const layer = document.createElement('div');
    layer.id = 'callLayerV16';
    layer.className = 'call-v16-layer';
    layer.innerHTML = `<div class="call-v16-card call-v16-incoming">${avatar(user,96)}<h2>${esc(user.displayName || user.username)}</h2><p>@${esc(user.username)} está chamando</p><div class="call-v16-incoming-actions"><button class="button primary" id="acceptAudioV16" type="button">Atender</button><button class="button primary" id="acceptVideoV16" type="button">Atender com vídeo</button><button class="button danger" id="rejectCallV16" type="button">Recusar</button></div><div class="call-v16-state" id="callStateV16">Chamada recebida</div></div>`;
    document.body.appendChild(layer);
    document.getElementById('acceptAudioV16').addEventListener('click', () => acceptIncoming(false));
    document.getElementById('acceptVideoV16').addEventListener('click', () => acceptIncoming(true));
    document.getElementById('rejectCallV16').addEventListener('click', () => { socket.emit('call:reject', { to:user.id }); finishCall(); });
  }

  async function acceptIncoming(withVideo) {
    try {
      await ensureAudio();
      if (withVideo) await enableCamera();
      showActiveCallLayer(callUser, 'Conectando…');
      await ensurePeer();
      socket.emit('call:accept', { to:callUser.id });
    } catch (error) {
      if (callUser) socket.emit('call:reject', { to:callUser.id });
      finishCall(error.message || 'Não foi possível acessar seus dispositivos.');
    }
  }

  function showActiveCallLayer(user, state) {
    document.getElementById('callLayerV16')?.remove();
    const layer = document.createElement('div');
    layer.id = 'callLayerV16';
    layer.className = 'call-v16-layer';
    layer.innerHTML = `<div class="call-v16-card"><div class="call-v16-head">${avatar(user,44)}<div class="call-v16-head-copy"><strong>${esc(user.displayName || user.username)}</strong><span>@${esc(user.username)}</span></div></div><div class="call-v16-media"><div class="call-v16-remote" id="remoteStageV16"><div class="call-v16-fallback" id="remoteFallbackV16">${avatar(user,104)}</div><video id="remoteVideoV16" autoplay playsinline></video><span class="call-v16-label">${esc(user.displayName || user.username)}</span></div><div class="call-v16-local" id="localStageV16"><div class="call-v16-fallback" id="localFallbackV16"><span>Você</span></div><video id="localVideoV16" autoplay muted playsinline></video><span class="call-v16-label">Você</span></div></div><div class="call-v16-toolbar"><button class="button" id="callMicV16" type="button">Silenciar</button><button class="button" id="callCameraV16" type="button">${cameraStream ? 'Desligar câmera' : 'Ligar câmera'}</button><button class="button" id="callScreenV16" type="button">Compartilhar tela</button><button class="button danger" id="callHangupV16" type="button">Encerrar</button></div><div class="call-v16-state" id="callStateV16">${esc(state)}</div></div>`;
    document.body.appendChild(layer);
    document.getElementById('callMicV16').addEventListener('click', toggleMic);
    document.getElementById('callCameraV16').addEventListener('click', toggleCamera);
    document.getElementById('callScreenV16').addEventListener('click', toggleScreenShare);
    document.getElementById('callHangupV16').addEventListener('click', hangup);
    refreshLocalPreview();
    refreshRemotePreview();
  }

  function updateCallState(text) {
    const el = document.getElementById('callStateV16');
    if (el) el.textContent = text;
  }

  async function ensureAudio() {
    if (audioStream?.getAudioTracks()[0]?.readyState === 'live') return audioStream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Seu navegador não oferece captura de microfone.');
    audioStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true }, video:false });
    return audioStream;
  }

  async function enableCamera() {
    if (cameraStream?.getVideoTracks()[0]?.readyState === 'live') return cameraStream.getVideoTracks()[0];
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Câmera indisponível neste navegador.');
    cameraStream = await navigator.mediaDevices.getUserMedia({ video:{ width:{ideal:960,max:1280}, height:{ideal:540,max:720}, frameRate:{ideal:24,max:30}, facingMode:'user' }, audio:false });
    const track = cameraStream.getVideoTracks()[0];
    if (videoSender && !screenStream) await videoSender.replaceTrack(track);
    refreshLocalPreview();
    return track;
  }

  async function disableCamera() {
    const track = cameraStream?.getVideoTracks()[0];
    cameraStream?.getTracks().forEach(item => item.stop());
    cameraStream = null;
    if (videoSender && !screenStream) await videoSender.replaceTrack(null);
    if (track) track.onended = null;
    refreshLocalPreview();
  }

  async function toggleCamera(event) {
    try {
      if (cameraStream) await disableCamera();
      else await enableCamera();
      event.currentTarget.textContent = cameraStream ? 'Desligar câmera' : 'Ligar câmera';
    } catch (error) { showToast(error.message || 'Não foi possível acessar a câmera.'); }
  }

  async function toggleScreenShare(event) {
    if (screenStream) return stopScreenShare();
    if (!navigator.mediaDevices?.getDisplayMedia) return showToast('Compartilhamento de tela não é suportado neste dispositivo/navegador.');
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video:{ frameRate:{ideal:15,max:30} }, audio:false });
      const track = screenStream.getVideoTracks()[0];
      track.contentHint = 'detail';
      track.onended = () => stopScreenShare();
      if (videoSender) await videoSender.replaceTrack(track);
      event.currentTarget.textContent = 'Parar compartilhamento';
      refreshLocalPreview();
    } catch (error) {
      if (error?.name !== 'NotAllowedError') showToast(error.message || 'Não foi possível compartilhar a tela.');
      screenStream = null;
    }
  }

  async function stopScreenShare() {
    const old = screenStream;
    screenStream = null;
    old?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    const cameraTrack = cameraStream?.getVideoTracks()[0] || null;
    if (videoSender) await videoSender.replaceTrack(cameraTrack);
    const button = document.getElementById('callScreenV16');
    if (button) button.textContent = 'Compartilhar tela';
    refreshLocalPreview();
  }

  function currentVideoTrack() {
    return screenStream?.getVideoTracks()[0] || cameraStream?.getVideoTracks()[0] || null;
  }

  function refreshLocalPreview() {
    const video = document.getElementById('localVideoV16');
    const fallback = document.getElementById('localFallbackV16');
    const stage = document.getElementById('localStageV16');
    if (!video || !fallback || !stage) return;
    const track = currentVideoTrack();
    if (track) {
      video.srcObject = new MediaStream([track]);
      video.play().catch(() => {});
      fallback.style.display = 'none';
    } else {
      video.srcObject = null;
      fallback.style.display = 'grid';
    }
    stage.dataset.screen = screenStream ? '1' : '0';
  }

  function refreshRemotePreview() {
    const video = document.getElementById('remoteVideoV16');
    const fallback = document.getElementById('remoteFallbackV16');
    if (!video || !fallback || !remoteStream) return;
    video.srcObject = remoteStream;
    video.play().catch(() => {});
    const liveVideo = remoteStream.getVideoTracks().some(track => track.readyState === 'live' && !track.muted);
    fallback.style.display = liveVideo ? 'none' : 'grid';
  }

  async function getRtcConfig() {
    if (rtcConfig) return rtcConfig;
    const data = await S.api('/api/social/rtc-config');
    rtcConfig = { iceServers:data.iceServers || [], bundlePolicy:'max-bundle' };
    return rtcConfig;
  }

  async function ensurePeer() {
    if (peer) return peer;
    await ensureAudio();
    peer = new RTCPeerConnection(await getRtcConfig());
    remoteStream = new MediaStream();
    audioStream.getAudioTracks().forEach(track => peer.addTrack(track, audioStream));
    const transceiver = peer.addTransceiver('video', { direction:'sendrecv' });
    videoSender = transceiver.sender;
    const localVideo = currentVideoTrack();
    if (localVideo) await videoSender.replaceTrack(localVideo);

    peer.onicecandidate = event => {
      if (event.candidate && callUser) socket?.emit('rtc:ice', { to:callUser.id, data:event.candidate });
    };
    peer.ontrack = event => {
      const track = event.track;
      if (!remoteStream.getTracks().some(item => item.id === track.id)) remoteStream.addTrack(track);
      track.onmute = refreshRemotePreview;
      track.onunmute = refreshRemotePreview;
      track.onended = refreshRemotePreview;
      refreshRemotePreview();
    };
    peer.onconnectionstatechange = () => {
      const state = peer?.connectionState;
      if (state === 'connected') {
        callConnected = true;
        clearTimeout(disconnectTimer);
        updateCallState('Em chamada');
      } else if (state === 'disconnected') {
        updateCallState('Reconectando…');
        clearTimeout(disconnectTimer);
        disconnectTimer = setTimeout(() => { if (peer?.connectionState === 'disconnected') finishCall('Conexão da chamada perdida.'); }, 9000);
      } else if (state === 'failed') {
        finishCall('Não foi possível manter a conexão. Configure TURN no servidor para redes restritas.');
      } else if (state === 'closed') finishCall();
    };
    return peer;
  }

  async function flushPendingIce() {
    if (!peer?.remoteDescription) return;
    const queue = pendingIce.splice(0);
    for (const candidate of queue) try { await peer.addIceCandidate(candidate); } catch {}
  }

  function toggleMic(event) {
    const track = audioStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    event.currentTarget.textContent = track.enabled ? 'Silenciar' : 'Ativar microfone';
  }

  function hangup() {
    if (callUser) socket?.emit('call:end', { to:callUser.id });
    finishCall();
  }

  function finishCall(message = '') {
    clearTimeout(disconnectTimer);
    disconnectTimer = 0;
    if (peer) { try { peer.close(); } catch {} }
    peer = null;
    videoSender = null;
    remoteStream?.getTracks().forEach(track => track.stop());
    remoteStream = null;
    audioStream?.getTracks().forEach(track => track.stop());
    audioStream = null;
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    screenStream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    screenStream = null;
    pendingIce = [];
    callRole = '';
    callConnected = false;
    outgoingVideoRequested = false;
    callUser = null;
    const layer = document.getElementById('callLayerV16');
    if (layer && message) {
      const state = layer.querySelector('#callStateV16');
      if (state) state.textContent = message;
      setTimeout(() => layer.remove(), 1400);
    } else layer?.remove();
  }

  addEventListener('pagehide', () => {
    if (callUser) socket?.emit('call:end', { to:callUser.id });
    finishCall();
  }, { once:true });

  waitForWorkspace();
})();
