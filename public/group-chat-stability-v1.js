(() => {
  if (window.__SKYNET_GROUP_CHAT_STABILITY_V1__) return;
  window.__SKYNET_GROUP_CHAT_STABILITY_V1__ = true;
  if ((location.pathname.replace(/\/+$/,'') || '/') !== '/painel/grupos') return;
  const S = window.SkyNet;
  const realtime = window.SkyNetRealtime;
  if (!S || !realtime) return;

  const socket = realtime.getSocket();
  let me = null;
  const known = new Set();
  let installed = false;
  let tries = 0;

  S.session().then(account => { me=account; scanKnown(); }).catch(()=>{});

  function activeGroupId() {
    return document.querySelector('.group-item.active[data-group-id]')?.dataset.groupId || '';
  }

  function scanKnown() {
    document.querySelectorAll('[data-group-message]').forEach(node=>known.add(node.dataset.groupMessage));
  }

  function nearBottom(box) {
    return box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  }

  function renderMessage(message) {
    if (!message?.id || known.has(message.id)) return;
    const box=document.getElementById('groupMessages');
    if(!box)return;
    const mine=message.fromId===me?.id;
    const shouldScroll=nearBottom(box)||mine;
    box.querySelector('.social-empty')?.remove();
    const node=document.createElement('div');
    node.className=`group-message ${mine?'mine':''}`;
    node.dataset.groupMessage=message.id;
    const sender=message.sender||{};
    node.innerHTML=`<strong>${S.escapeHtml(sender.displayName||sender.username||'Participante')}</strong><div>${S.escapeHtml(message.text||'')}</div><div class="meta">${S.escapeHtml(S.formatDate(message.createdAt))}${mine?` · <button class="link-button" data-delete-group-message="${S.escapeHtml(message.id)}" type="button">apagar</button>`:''}</div>`;
    box.appendChild(node);
    known.add(message.id);
    if(shouldScroll)box.scrollTop=box.scrollHeight;
  }

  function install() {
    if(installed)return;
    tries+=1;
    const listeners=typeof socket.listeners==='function'?socket.listeners('group:message'):[];
    if(!listeners.length&&tries<60){setTimeout(install,100);return;}
    socket.off('group:message');
    socket.on('group:message',({groupId,message})=>{
      if(groupId!==activeGroupId())return;
      renderMessage(message);
    });
    installed=true;
  }

  document.addEventListener('click',event=>{
    if(event.target.closest?.('.group-item[data-group-id]'))setTimeout(()=>{known.clear();scanKnown();},80);
  },true);

  new MutationObserver(records=>{
    let rescan=false;
    for(const record of records)for(const node of record.addedNodes){
      if(node.nodeType===1&&(node.matches?.('[data-group-message]')||node.querySelector?.('[data-group-message]')))rescan=true;
    }
    if(rescan)scanKnown();
  }).observe(document.documentElement,{childList:true,subtree:true});

  install();
})();
