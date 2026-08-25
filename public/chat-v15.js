(() => {
  if (window.__SKYNET_CHAT_V15__) return;
  window.__SKYNET_CHAT_V15__ = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/painel/chat') return;
  const S = window.SkyNet;
  if (!S) return;

  let socket = null;
  let currentUser = null;
  let currentChatUser = null;
  let conversations = [];
  let messagesKnown = new Set();
  let sendQueue = [];
  let sending = false;
  let refreshTimer = 0;
  let peer = null;
  let localStream = null;
  let callUser = null;
  let rtcConfig = null;

  function esc(v){ return S.escapeHtml(v == null ? '' : String(v)); }
  function avatar(profile,size=42){
    if(profile?.avatarUrl) return `<img class="social-avatar-img" src="${esc(profile.avatarUrl)}" alt="" style="width:${size}px;height:${size}px">`;
    const letter=String(profile?.displayName||profile?.username||'?').slice(0,1).toUpperCase();
    return `<div class="social-avatar-fallback" style="width:${size}px;height:${size}px">${esc(letter)}</div>`;
  }

  function installStyles(){
    if(document.getElementById('chatV15Styles')) return;
    const style=document.createElement('style');
    style.id='chatV15Styles';
    style.textContent=`
      .chat-v15{display:grid;grid-template-columns:300px minmax(0,1fr);height:min(760px,calc(100dvh - 170px));min-height:540px;overflow:hidden;border:1px solid #29292e;background:#08080a;position:relative;box-shadow:0 28px 80px rgba(0,0,0,.24)}
      .chat-v15-sidebar{border-right:1px solid #252529;background:#09090b;min-width:0;overflow:auto}.chat-v15-side-head{position:sticky;top:0;z-index:4;padding:13px;border-bottom:1px solid #252529;background:rgba(8,8,10,.96);backdrop-filter:blur(12px)}.chat-v15-side-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.chat-v15-side-row strong{font-size:13px}.chat-v15-count{font:600 7px 'IBM Plex Mono',monospace;color:#8d8d94}.chat-v15-search{width:100%;min-height:34px!important;margin-top:9px!important;font-size:10px!important}
      .chat-v15-list{padding:5px}.chat-conversation{width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:9px;border:1px solid transparent!important;background:transparent;color:inherit;cursor:pointer;margin:2px 0}.chat-conversation:hover{background:#111113!important}.chat-conversation.active{background:#151517!important;border-color:#303035!important;box-shadow:inset 2px 0 0 #f0f0ed!important}.chat-conversation-copy{min-width:0;flex:1}.chat-conversation-copy strong,.chat-conversation-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-conversation-copy strong{font-size:11px}.chat-conversation-copy span{font-size:9px;color:#74747b;margin-top:2px}.chat-unread{min-width:18px;height:18px;padding:0 5px;background:#e8e8e4;color:#08080a;display:grid;place-items:center;font-size:8px;font-weight:700}
      .chat-v15-main{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;position:relative;background:#09090b}.chat-v15-placeholder{display:grid;place-items:center;text-align:center;color:#696970;padding:30px;font-size:11px}.chat-v15-placeholder::before{content:'';display:block;width:52px;height:52px;margin:0 auto 12px;border:1px solid #303035;background:linear-gradient(145deg,#111113,#09090b);box-shadow:18px -12px 0 -17px rgba(142,130,232,.85),-14px 14px 0 -13px rgba(255,255,255,.05)}
      .chat-header{display:flex;align-items:center;gap:10px;min-height:64px;padding:10px 12px;border-bottom:1px solid #252529;background:rgba(8,8,10,.96);backdrop-filter:blur(12px)}.chat-header-copy{min-width:0;flex:1}.chat-header-copy strong,.chat-header-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chat-header-copy strong{font-size:12px}.chat-header-copy span{font-size:9px;color:#7e7e84;margin-top:2px}.chat-back-v15{display:none;width:34px!important;min-width:34px!important;height:34px!important;padding:0!important;place-items:center}.chat-back-v15 svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}.chat-header .button{min-height:34px!important;padding:5px 8px!important;font-size:8px!important}
      .chat-messages{padding:15px 16px;overflow:auto;display:flex;flex-direction:column;gap:5px;overscroll-behavior:contain;scrollbar-width:thin}.chat-bubble{position:relative;max-width:min(76%,620px);padding:9px 11px;align-self:flex-start;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.46}.chat-bubble.mine{align-self:flex-end}.chat-bubble .time{display:block;margin-top:4px;font-size:7px;color:#696970}.chat-bubble .link-button{font-size:7px;color:#aaa3df}.chat-bubble.pending .time::after{content:' · enviando';color:#77777e}.chat-bubble.failed .time{color:#d6a3aa}.chat-retry-v15{margin-left:5px}
      .chat-compose{display:flex;gap:7px;align-items:end;padding:9px;border-top:1px solid #252529;background:rgba(8,8,10,.97);backdrop-filter:blur(12px)}.chat-compose textarea{flex:1;resize:none;min-height:40px;max-height:130px;padding:10px 11px!important;font-size:11px;line-height:1.4;overflow-y:auto}.chat-compose .button{height:40px;min-height:40px!important;padding:0 12px!important}.chat-send-state-v15{position:absolute;right:10px;bottom:55px;z-index:4;padding:4px 6px;border:1px solid #2d2d32;background:#0b0b0d;color:#77777e;font:500 7px 'IBM Plex Mono',monospace;opacity:0;transform:translateY(4px);pointer-events:none;transition:.15s ease}.chat-send-state-v15.show{opacity:1;transform:none}
      .call-layer{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px}.call-card{width:min(410px,100%);padding:24px;border:1px solid #303035;background:#0b0b0d;text-align:center;box-shadow:0 35px 100px rgba(0,0,0,.5)}.call-card .social-avatar-img,.call-card .social-avatar-fallback{width:90px!important;height:90px!important;margin:0 auto 14px}.call-card h2{margin:0 0 4px}.call-card p{margin:0 0 18px;color:#7f7f85}.call-buttons{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}.call-state{margin-top:12px;font-size:9px;color:#77777e}
      .chat-v15-toast{position:absolute;left:50%;bottom:58px;z-index:6;transform:translate(-50%,8px);opacity:0;pointer-events:none;padding:6px 9px;border:1px solid #3a3033;background:#151012;color:#deb0b8;font-size:8px;transition:.18s ease}.chat-v15-toast.show{opacity:1;transform:translate(-50%,0)}
      @media(max-width:760px){.chat-v15{display:block;height:calc(100dvh - 150px);min-height:500px}.chat-v15-sidebar,.chat-v15-main{position:absolute;inset:0;width:100%;height:100%;border:0;transition:opacity .2s ease,transform .24s cubic-bezier(.2,.75,.2,1)}.chat-v15-sidebar{z-index:2;overflow:auto}.chat-v15-main{z-index:3;opacity:0;pointer-events:none;transform:translate3d(18px,0,-12px)}.chat-v15.thread-open .chat-v15-sidebar{opacity:0;pointer-events:none;transform:translate3d(-18px,0,-12px)}.chat-v15.thread-open .chat-v15-main{opacity:1;pointer-events:auto;transform:none}.chat-back-v15{display:grid!important}.chat-header{padding:8px;gap:7px}.chat-header .social-avatar-img,.chat-header .social-avatar-fallback{width:36px!important;height:36px!important}.chat-header .button:not(.chat-back-v15){width:34px!important;min-width:34px!important;height:34px!important;padding:0!important;font-size:0!important}.chat-messages{padding:12px 9px}.chat-bubble{max-width:88%;font-size:11px}.chat-compose{padding:8px}.chat-compose textarea{font-size:11px}.chat-compose>.button{width:40px!important;min-width:40px!important;padding:0!important;font-size:0!important}.chat-v15-side-head{padding:10px}.chat-v15-list{padding:4px 6px}.chat-conversation{padding:9px}}
    `;
    document.head.appendChild(style);
  }

  function waitForWorkspace(){
    const ready=()=>document.getElementById('workspaceShell')&&!document.getElementById('workspaceShell').classList.contains('hidden')&&document.getElementById('workspaceContent');
    if(ready()) return boot();
    const observer=new MutationObserver(()=>{if(ready()){observer.disconnect();boot();}});
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    setTimeout(()=>observer.disconnect(),12000);
  }

  async function boot(){
    installStyles();
    setPage();
    try{
      const me=await S.api('/api/social/me');
      currentUser=me.account;
      renderShell();
      setupSocket();
      const data=await loadConversations();
      const requested=new URLSearchParams(location.search).get('with');
      const first=data.find(item=>item.user.id===requested)||data[0];
      if(first) await openConversation(first.user);
    }catch(error){
      document.getElementById('workspaceContent').innerHTML=`<div class="workspace-card"><div class="message show error">${esc(error.message||'Não foi possível carregar o chat.')}</div></div>`;
    }
  }

  function setPage(){
    document.getElementById('workspaceKicker').textContent='Social / realtime';
    document.getElementById('workspaceTitle').textContent='Chat';
    document.getElementById('workspaceDescription').textContent='Mensagens privadas em tempo real, figurinhas e chamadas sem reconstruir a conversa a cada evento.';
    document.title='Chat - SkyNetApi';
    document.querySelectorAll('.workspace-nav-link').forEach(link=>link.classList.toggle('active',link.getAttribute('href')==='/painel/chat'));
  }

  function renderShell(){
    const root=document.getElementById('workspaceContent');
    root.innerHTML=`<section class="chat-v15 chat-layout" id="chatV15"><aside class="chat-v15-sidebar chat-sidebar"><div class="chat-v15-side-head chat-side-head"><div class="chat-v15-side-row"><strong>Conversas</strong><span class="chat-v15-count" id="chatCountV15">0</span></div><input class="chat-v15-search" id="chatSearchV15" type="search" placeholder="Buscar conversa..."></div><div class="chat-v15-list" id="conversationList"></div></aside><section class="chat-v15-main chat-main" id="chatMain"><div class="chat-v15-placeholder">Selecione um amigo para começar a conversar.</div></section><div class="chat-v15-toast" id="chatToastV15"></div></section>`;
    document.getElementById('chatSearchV15').addEventListener('input',renderConversationList);
  }

  async function loadConversations(){
    const data=await S.api('/api/social/conversations');
    conversations=Array.isArray(data.conversations)?data.conversations:[];
    renderConversationList();
    return conversations;
  }

  function renderConversationList(){
    const list=document.getElementById('conversationList'); if(!list)return;
    const q=String(document.getElementById('chatSearchV15')?.value||'').trim().toLowerCase();
    const visible=conversations.filter(item=>!q||`${item.user.displayName||''} ${item.user.username||''}`.toLowerCase().includes(q));
    document.getElementById('chatCountV15').textContent=String(conversations.length);
    list.innerHTML=visible.length?visible.map(item=>`<button class="chat-conversation ${currentChatUser?.id===item.user.id?'active':''}" data-user="${esc(item.user.id)}">${avatar(item.user,40)}<span class="chat-conversation-copy"><strong>${esc(item.user.displayName||item.user.username)}</strong><span>${esc(item.lastMessage?.text||'Inicie uma conversa')}</span></span>${item.unreadCount?`<span class="chat-unread">${item.unreadCount}</span>`:''}</button>`).join(''):'<div class="social-empty">Nenhuma conversa encontrada.</div>';
    list.querySelectorAll('[data-user]').forEach(button=>button.addEventListener('click',()=>{const item=conversations.find(entry=>entry.user.id===button.dataset.user);if(item)openConversation(item.user);}));
  }

  async function openConversation(user){
    if(!user)return;
    currentChatUser={...user};
    messagesKnown=new Set();
    const main=document.getElementById('chatMain'); if(!main)return;
    main.innerHTML=`<header class="chat-header"><button class="button chat-back-v15" id="chatBackV15" type="button" aria-label="Voltar"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>${avatar(user,40)}<div class="chat-header-copy"><strong>${esc(user.displayName||user.username)}</strong><span><span class="chat-presence-v15 ${user.online?'online':''}" id="chatPresenceV15">${user.online?'online':'offline'}</span> · @${esc(user.username)}</span></div><button class="button" id="startCall" type="button">Chamar</button><a class="button" href="/u/${encodeURIComponent(user.username)}" target="_blank" rel="noopener">Perfil</a></header><div class="chat-messages" id="chatMessages"><div class="social-empty">Carregando mensagens...</div></div><form class="chat-compose" id="chatForm"><textarea id="chatInput" maxlength="2000" rows="1" autocomplete="off" placeholder="Digite uma mensagem..."></textarea><button class="button primary" type="submit">Enviar</button></form><div class="chat-send-state-v15" id="chatSendStateV15">enviando</div>`;
    document.getElementById('chatBackV15').addEventListener('click',()=>document.getElementById('chatV15')?.classList.remove('thread-open'));
    document.getElementById('startCall').addEventListener('click',()=>startOutgoingCall(user));
    const form=document.getElementById('chatForm');
    form.addEventListener('submit',handleSubmit);
    const input=document.getElementById('chatInput');
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
    input.addEventListener('input',()=>{input.style.height='auto';input.style.height=`${Math.min(130,input.scrollHeight)}px`;});
    await loadMessages(user.id);
    S.api(`/api/social/messages/${encodeURIComponent(user.id)}/read`,{method:'POST'}).catch(()=>{});
    renderConversationList();
    history.replaceState(null,'',`/painel/chat?with=${encodeURIComponent(user.id)}`);
    document.getElementById('chatV15')?.classList.add('thread-open');
  }

  async function loadMessages(userId){
    const data=await S.api(`/api/social/messages/${encodeURIComponent(userId)}?limit=80`);
    if(currentChatUser?.id!==userId)return;
    const box=document.getElementById('chatMessages'); if(!box)return;
    const messages=Array.isArray(data.messages)?data.messages:[];
    messagesKnown=new Set(messages.map(m=>m.id));
    box.innerHTML=messages.length?messages.map(messageBubble).join(''):'<div class="social-empty" id="chatEmptyV15">Nenhuma mensagem ainda.</div>';
    box.scrollTop=box.scrollHeight;
  }

  function messageBubble(message,extra=''){
    const mine=message.fromId===currentUser?.id;
    return `<div class="chat-bubble ${mine?'mine':''} ${extra}" data-message-id="${esc(message.id)}">${esc(message.text)}<span class="time">${esc(S.formatDate(message.createdAt))}${mine?` · <button class="link-button" data-delete-message="${esc(message.id)}" type="button">apagar</button>`:''}</span></div>`;
  }

  function appendMessage(message,{animate=true}={}){
    if(!message?.id||messagesKnown.has(message.id))return;
    const otherId=message.fromId===currentUser?.id?message.toId:message.fromId;
    if(currentChatUser?.id!==otherId)return;
    messagesKnown.add(message.id);
    const box=document.getElementById('chatMessages'); if(!box)return;
    box.querySelector('#chatEmptyV15,.social-empty')?.remove();
    const wrap=document.createElement('div');
    wrap.innerHTML=messageBubble(message);
    const node=wrap.firstElementChild;
    if(animate)node.classList.add('v15-message-enter');
    const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<100;
    box.appendChild(node);
    if(nearBottom||message.fromId===currentUser?.id)box.scrollTop=box.scrollHeight;
  }

  function handleSubmit(event){
    event.preventDefault();
    if(!currentChatUser)return;
    const input=document.getElementById('chatInput');
    const text=String(input?.value||'').trim();
    if(!text)return;
    const target={...currentChatUser};
    input.value='';input.style.height='auto';
    const clientId=`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const box=document.getElementById('chatMessages');
    box?.querySelector('#chatEmptyV15,.social-empty')?.remove();
    if(box){
      const optimistic=document.createElement('div');
      optimistic.className='chat-bubble mine pending v15-message-enter';
      optimistic.dataset.clientId=clientId;
      optimistic.textContent=text;
      const time=document.createElement('span');time.className='time';time.textContent='agora';optimistic.appendChild(time);
      box.appendChild(optimistic);box.scrollTop=box.scrollHeight;
    }
    sendQueue.push({clientId,targetId:target.id,text});
    processSendQueue();
  }

  async function processSendQueue(){
    if(sending)return;
    sending=true;
    const state=document.getElementById('chatSendStateV15');state?.classList.add('show');
    while(sendQueue.length){
      const job=sendQueue[0];
      const optimistic=document.querySelector(`[data-client-id="${CSS.escape(job.clientId)}"]`);
      try{
        const data=await S.api(`/api/social/messages/${encodeURIComponent(job.targetId)}`,{method:'POST',body:{text:job.text}});
        const message=data.message;
        if(message?.id){
          if(messagesKnown.has(message.id)){optimistic?.remove();}
          else if(optimistic&&currentChatUser?.id===job.targetId){
            messagesKnown.add(message.id);
            optimistic.classList.remove('pending');
            optimistic.dataset.messageId=message.id;
            optimistic.removeAttribute('data-client-id');
            optimistic.innerHTML=`${esc(message.text)}<span class="time">${esc(S.formatDate(message.createdAt))} · <button class="link-button" data-delete-message="${esc(message.id)}" type="button">apagar</button></span>`;
          }
        }
        scheduleConversationRefresh();
      }catch(error){
        if(optimistic){
          optimistic.classList.remove('pending');optimistic.classList.add('failed');
          const time=optimistic.querySelector('.time')||optimistic.appendChild(document.createElement('span'));
          time.className='time';time.innerHTML=`falhou · <button class="chat-retry-v15" type="button">reenviar</button>`;
          time.querySelector('button')?.addEventListener('click',()=>{optimistic.remove();sendQueue.push({...job,clientId:`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`});processSendQueue();},{once:true});
        }
        showToast(error.message||'Não foi possível enviar a mensagem.');
      }
      sendQueue.shift();
    }
    sending=false;state?.classList.remove('show');
  }

  function scheduleConversationRefresh(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>loadConversations().catch(()=>{}),180);
  }

  function updatePresence(userId,online){
    const item=conversations.find(entry=>entry.user.id===userId);if(item)item.user.online=online;
    if(currentChatUser?.id===userId){
      currentChatUser.online=online;
      const el=document.getElementById('chatPresenceV15');if(el){el.textContent=online?'online':'offline';el.classList.toggle('online',online);}
    }
  }

  function setupSocket(){
    if(!window.io||socket)return;
    socket=window.io({path:'/socket.io',transports:['websocket','polling']});
    socket.on('chat:message',({message})=>{
      if(!message)return;
      const otherId=message.fromId===currentUser?.id?message.toId:message.fromId;
      if(currentChatUser?.id===otherId){
        appendMessage(message);
        if(message.fromId===otherId)S.api(`/api/social/messages/${encodeURIComponent(otherId)}/read`,{method:'POST'}).catch(()=>{});
      }
      scheduleConversationRefresh();
    });
    socket.on('chat:deleted',({messageId})=>{if(messageId){messagesKnown.delete(messageId);document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)?.remove();scheduleConversationRefresh();}});
    socket.on('social:presence',({userId,online})=>updatePresence(userId,Boolean(online)));
    socket.on('friend:accepted',()=>scheduleConversationRefresh());
    socket.on('call:incoming',({from})=>showIncomingCall(from));
    socket.on('call:ringing',()=>updateCallState('Chamando...'));
    socket.on('call:accepted',async({by})=>{if(!callUser||callUser.id!==by)return;updateCallState('Conectando...');await ensurePeer();const offer=await peer.createOffer();await peer.setLocalDescription(offer);socket.emit('rtc:offer',{to:callUser.id,data:offer});});
    socket.on('call:rejected',()=>finishCall('Chamada recusada.'));
    socket.on('call:ended',({reason})=>finishCall(reason||'Chamada encerrada.'));
    socket.on('call:error',({error})=>finishCall(error||'Não foi possível iniciar a chamada.'));
    socket.on('rtc:offer',async({from,data})=>{if(!callUser||callUser.id!==from)return;await ensurePeer();await peer.setRemoteDescription(data);const answer=await peer.createAnswer();await peer.setLocalDescription(answer);socket.emit('rtc:answer',{to:from,data:answer});});
    socket.on('rtc:answer',async({from,data})=>{if(callUser?.id===from&&peer)await peer.setRemoteDescription(data);});
    socket.on('rtc:ice',async({from,data})=>{if(callUser?.id===from&&peer&&data)try{await peer.addIceCandidate(data);}catch{}});
  }

  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-delete-message]');if(!button||path!=='/painel/chat')return;
    if(!confirm('Apagar esta mensagem?'))return;
    try{await S.api(`/api/social/messages/item/${encodeURIComponent(button.dataset.deleteMessage)}`,{method:'DELETE'});messagesKnown.delete(button.dataset.deleteMessage);button.closest('[data-message-id]')?.remove();scheduleConversationRefresh();}catch(error){showToast(error.message||'Não foi possível apagar.');}
  });

  function showToast(text){const el=document.getElementById('chatToastV15');if(!el)return;el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600);}

  async function startOutgoingCall(user){
    if(!socket?.connected)return showToast('O serviço de chamada não está conectado.');
    try{callUser=user;await getLocalAudio();showCallLayer(user,'Chamando...',false);socket.emit('call:invite',{to:user.id});}catch(error){finishCall(error.message||'Não foi possível acessar o microfone.');}
  }
  function showIncomingCall(user){if(callUser){socket?.emit('call:reject',{to:user.id});return;}callUser=user;showCallLayer(user,'Chamada de voz recebida',true);}
  function showCallLayer(user,state,incoming){
    document.getElementById('callLayer')?.remove();
    const layer=document.createElement('div');layer.className='call-layer';layer.id='callLayer';
    layer.innerHTML=`<div class="call-card">${avatar(user,90)}<h2>${esc(user.displayName||user.username)}</h2><p>@${esc(user.username)}</p><div class="call-buttons">${incoming?'<button class="button primary" id="callAccept">Atender</button><button class="button danger" id="callReject">Recusar</button>':'<button class="button" id="callMute">Silenciar</button><button class="button danger" id="callHangup">Encerrar</button>'}</div><div class="call-state" id="callState">${esc(state)}</div><audio id="remoteAudio" autoplay></audio></div>`;
    document.body.appendChild(layer);
    if(incoming){
      document.getElementById('callAccept').addEventListener('click',async()=>{try{await getLocalAudio();await ensurePeer();replaceCallButtons();socket.emit('call:accept',{to:user.id});updateCallState('Conectando...');}catch(error){socket.emit('call:reject',{to:user.id});finishCall(error.message||'Microfone indisponível.');}});
      document.getElementById('callReject').addEventListener('click',()=>{socket.emit('call:reject',{to:user.id});finishCall();});
    }else bindActiveCallButtons();
  }
  function replaceCallButtons(){const box=document.querySelector('#callLayer .call-buttons');if(!box)return;box.innerHTML='<button class="button" id="callMute">Silenciar</button><button class="button danger" id="callHangup">Encerrar</button>';bindActiveCallButtons();}
  function bindActiveCallButtons(){document.getElementById('callHangup')?.addEventListener('click',()=>{if(callUser)socket?.emit('call:end',{to:callUser.id});finishCall();});document.getElementById('callMute')?.addEventListener('click',event=>{const track=localStream?.getAudioTracks()?.[0];if(!track)return;track.enabled=!track.enabled;event.currentTarget.textContent=track.enabled?'Silenciar':'Ativar microfone';});}
  function updateCallState(text){const el=document.getElementById('callState');if(el)el.textContent=text;}
  async function getLocalAudio(){if(localStream)return localStream;if(!navigator.mediaDevices?.getUserMedia)throw new Error('Seu navegador não oferece captura de microfone.');localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});return localStream;}
  async function getRtcConfig(){if(rtcConfig)return rtcConfig;const data=await S.api('/api/social/rtc-config');rtcConfig={iceServers:data.iceServers||[]};return rtcConfig;}
  async function ensurePeer(){if(peer)return peer;peer=new RTCPeerConnection(await getRtcConfig());localStream?.getTracks().forEach(track=>peer.addTrack(track,localStream));peer.onicecandidate=event=>{if(event.candidate&&callUser)socket.emit('rtc:ice',{to:callUser.id,data:event.candidate});};peer.ontrack=event=>{const audio=document.getElementById('remoteAudio');if(audio){audio.srcObject=event.streams[0];audio.play().catch(()=>{});}};peer.onconnectionstatechange=()=>{if(peer?.connectionState==='connected')updateCallState('Em chamada');if(['failed','closed'].includes(peer?.connectionState))finishCall('Chamada encerrada.');};return peer;}
  function finishCall(message=''){if(peer){try{peer.close();}catch{}peer=null;}if(localStream){localStream.getTracks().forEach(track=>track.stop());localStream=null;}callUser=null;const layer=document.getElementById('callLayer');if(layer&&message){updateCallState(message);setTimeout(()=>layer.remove(),1200);}else layer?.remove();}

  waitForWorkspace();
})();
