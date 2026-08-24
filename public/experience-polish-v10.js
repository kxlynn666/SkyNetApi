(() => {
  if (window.__SKYNET_EXPERIENCE_POLISH_V10__) return;
  window.__SKYNET_EXPERIENCE_POLISH_V10__ = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  let scheduled = false;
  let initialChatModeResolved = false;

  installStyles();
  schedule();

  const root = document.getElementById('workspaceContent') || document.documentElement;
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });

  function installStyles() {
    if (document.getElementById('experiencePolishV10Styles')) return;
    const style = document.createElement('style');
    style.id = 'experiencePolishV10Styles';
    style.textContent = `
      /* Chat V10 */
      .chat-layout{border-radius:22px!important;background:linear-gradient(145deg,rgba(17,11,31,.78),rgba(8,6,16,.72))!important;border-color:rgba(139,92,246,.16)!important;box-shadow:0 22px 70px rgba(0,0,0,.16);min-height:560px!important;height:min(760px,calc(100dvh - 176px))!important}
      .chat-sidebar{background:rgba(12,8,23,.62);scrollbar-width:thin}.chat-side-head{position:sticky;top:0;z-index:6;padding:15px!important;background:rgba(13,8,24,.94);backdrop-filter:blur(16px);border-bottom-color:rgba(139,92,246,.12)!important}.chat-side-title-v10{display:flex;align-items:center;justify-content:space-between;gap:10px}.chat-side-title-v10 strong{font-size:14px}.chat-side-count-v10{font:700 8px 'JetBrains Mono',monospace;color:#c4b5fd;padding:4px 7px;border-radius:999px;background:rgba(139,92,246,.09);border:1px solid rgba(167,139,250,.13)}
      .chat-search-v10{position:relative;margin-top:11px}.chat-search-v10 input{width:100%;min-height:38px;padding:8px 11px 8px 34px!important;border-radius:12px!important;background:rgba(255,255,255,.035)!important}.chat-search-v10 svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:14px;height:14px;fill:none;stroke:#8f82a5;stroke-width:1.8;pointer-events:none}
      #conversationList{padding:7px}.chat-conversation{margin:3px 0;padding:11px!important;border:1px solid transparent!important;border-radius:14px!important;transition:background .14s ease,border-color .14s ease,transform .14s ease}.chat-conversation:hover{background:rgba(255,255,255,.03)!important}.chat-conversation.active{background:linear-gradient(135deg,rgba(139,92,246,.12),rgba(34,211,238,.045))!important;border-color:rgba(167,139,250,.15)!important;box-shadow:inset 3px 0 0 rgba(167,139,250,.5)}.chat-conversation .social-avatar-img,.chat-conversation .social-avatar-fallback{border-radius:13px!important}.chat-conversation-copy strong{font-size:12px}.chat-conversation-copy span{font-size:10px!important;color:#877a99!important}.chat-unread{min-width:19px!important;height:19px!important;font-size:9px!important;box-shadow:0 0 14px rgba(168,85,247,.25)}
      .chat-main{background:linear-gradient(180deg,rgba(15,10,27,.38),rgba(8,6,15,.24))}.chat-header{min-height:70px;padding:12px 15px!important;background:rgba(13,8,24,.86);backdrop-filter:blur(15px);border-bottom-color:rgba(139,92,246,.12)!important}.chat-header-copy strong{font-size:13px}.chat-header-copy span{font-size:10px!important}.chat-header .button{min-height:36px!important}.chat-back-v10{display:none!important;width:36px!important;min-width:36px!important;height:36px!important;padding:0!important;border-radius:11px!important}.chat-back-v10 svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}
      .chat-messages{padding:18px 20px!important;gap:4px!important;scrollbar-width:thin;overscroll-behavior:contain}.chat-bubble{position:relative;max-width:min(72%,620px)!important;padding:9px 12px!important;border-radius:16px 16px 16px 6px!important;background:rgba(255,255,255,.055)!important;border:1px solid rgba(255,255,255,.045);font-size:13px;line-height:1.48;white-space:pre-wrap;box-shadow:0 5px 16px rgba(0,0,0,.05)}.chat-bubble.mine{border-radius:16px 16px 6px 16px!important;background:linear-gradient(135deg,rgba(124,58,237,.22),rgba(76,29,149,.16))!important;border-color:rgba(167,139,250,.14)!important}.chat-bubble.chat-grouped-v10{margin-top:-2px}.chat-bubble .time{font-size:8px!important;opacity:.72;margin-top:4px!important}.chat-bubble .link-button{font-size:8px!important;color:#c4b5fd}
      .chat-compose{position:relative;padding:11px 13px!important;gap:8px!important;align-items:end;background:rgba(13,8,24,.9);backdrop-filter:blur(14px);border-top-color:rgba(139,92,246,.12)!important}.chat-compose textarea{flex:1;resize:none;min-height:42px;max-height:132px;padding:11px 13px!important;border-radius:14px!important;line-height:1.4;overflow-y:auto;background:rgba(255,255,255,.035)!important}.chat-compose .button{height:42px;min-height:42px!important;border-radius:13px!important}.chat-compose-meta-v10{position:absolute;right:78px;bottom:4px;font:600 7px 'JetBrains Mono',monospace;color:#655b73;pointer-events:none}.chat-scroll-bottom-v10{position:absolute;right:18px;bottom:72px;width:36px;height:36px;border:1px solid rgba(167,139,250,.18);border-radius:50%;background:rgba(20,13,35,.94);color:#c4b5fd;display:grid;place-items:center;box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer;opacity:0;transform:translateY(7px);pointer-events:none;transition:.15s ease;z-index:5}.chat-scroll-bottom-v10.show{opacity:1;transform:none;pointer-events:auto}.chat-scroll-bottom-v10 svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}
      .chat-placeholder{font-size:12px}.chat-placeholder::before{content:'';display:block;width:52px;height:52px;margin:0 auto 12px;border-radius:17px;border:1px solid rgba(167,139,250,.14);background:radial-gradient(circle at 35% 30%,rgba(34,211,238,.12),transparent 45%),rgba(139,92,246,.065)}

      /* Profile media V10 */
      [data-profile-panel="media"]>.profile-v3-grid{align-items:stretch}.profile-media-card-v10{position:relative;overflow:hidden!important;background:linear-gradient(155deg,rgba(24,16,44,.96),rgba(14,9,25,.94))!important}.profile-media-card-v10::after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 90% 0,rgba(34,211,238,.045),transparent 34%)}.profile-media-card-v10>h3,.profile-media-card-v10>.hint,.profile-media-card-v10>.profile-v3-upload{position:relative;z-index:1}.profile-media-card-v10 .profile-v3-upload{display:grid!important;grid-template-columns:112px minmax(0,1fr)!important;gap:16px!important;align-items:center!important;padding:13px;border:1px solid rgba(167,139,250,.1);border-radius:16px;background:rgba(255,255,255,.018)}.profile-media-card-v10[data-media-kind="cover"] .profile-v3-upload{grid-template-columns:1fr!important}.profile-media-card-v10 .profile-v3-upload-preview{position:relative!important;width:112px!important;height:112px!important;border-radius:24px!important;cursor:pointer;overflow:hidden;border:1px solid rgba(167,139,250,.2)!important;background:linear-gradient(145deg,#211739,#100b1d)!important;box-shadow:0 12px 34px rgba(0,0,0,.16)}.profile-media-card-v10[data-media-kind="cover"] .profile-v3-upload-preview{width:100%!important;height:auto!important;aspect-ratio:16/7;border-radius:17px!important;grid-column:auto!important}.profile-media-card-v10 .profile-v3-upload-preview::after{content:'Trocar';position:absolute;inset:auto 7px 7px;min-height:27px;display:grid;place-items:center;border-radius:9px;background:rgba(7,5,12,.72);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.09);font:700 8px 'JetBrains Mono',monospace;color:#eee7fa;opacity:0;transition:.15s ease}.profile-media-card-v10[data-media-kind="cover"] .profile-v3-upload-preview::after{content:'Trocar capa'}.profile-media-card-v10 .profile-v3-upload-preview:hover::after{opacity:1}.profile-media-card-v10 input[type="file"]{width:100%;padding:10px!important;border:1px dashed rgba(167,139,250,.2)!important;border-radius:12px;background:rgba(139,92,246,.035)!important;font-size:10px}.profile-media-card-v10 input[type="file"]::file-selector-button{margin-right:9px;border:0;border-radius:9px;padding:7px 9px;background:rgba(139,92,246,.15);color:#ddd2ef;font-weight:700;cursor:pointer}.profile-media-card-v10 .profile-v3-upload-actions{margin-top:8px!important}.profile-media-card-v10 .profile-v3-upload-actions .button{min-height:36px}.profile-media-file-v10{margin-top:8px;display:flex;align-items:center;gap:7px;min-height:22px;font:600 8px 'JetBrains Mono',monospace;color:#8f82a5}.profile-media-file-v10::before{content:'';width:6px;height:6px;border-radius:50%;background:#67e8f9;box-shadow:0 0 10px rgba(103,232,249,.38)}.profile-media-card-v10.dragging-v10{border-color:rgba(103,232,249,.35)!important;box-shadow:inset 0 0 0 1px rgba(103,232,249,.08),0 0 32px rgba(34,211,238,.07)}

      /* Store V10: exactly three vertical items, unlimited horizontal columns. */
      [data-profile-v3="1"] .profile-v3-store{display:grid!important;grid-template-rows:repeat(3,minmax(0,1fr))!important;grid-template-columns:none!important;grid-auto-flow:column!important;grid-auto-columns:minmax(205px,235px)!important;gap:9px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:3px 3px 10px!important;scroll-snap-type:x proximity;overscroll-behavior-inline:contain;scrollbar-width:thin}.profile-v3-store>.profile-v3-product{scroll-snap-align:start;min-height:145px!important;height:auto}.profile-store-rail-v10{display:flex;align-items:center;gap:6px}.profile-store-rail-v10 button{width:34px!important;min-width:34px!important;height:34px!important;padding:0!important;border-radius:10px!important}.profile-store-rail-v10 svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2}.profile-store-count-v10{font:700 8px 'JetBrains Mono',monospace;color:#8f82a5;margin-right:2px}

      @media(max-width:760px){
        .chat-layout{display:block!important;position:relative;height:calc(100dvh - 166px)!important;min-height:520px!important;border-radius:18px!important}.chat-sidebar,.chat-main{position:absolute;inset:0;width:100%;height:100%;border:0!important;max-height:none!important;min-height:0!important;transition:opacity .14s ease,transform .14s ease}.chat-sidebar{z-index:2;background:#0d0818!important;overflow:auto!important}.chat-main{z-index:3;opacity:0;pointer-events:none;transform:translateX(14px);background:#0b0713}.chat-layout.chat-thread-open-v10 .chat-sidebar{opacity:0;pointer-events:none;transform:translateX(-12px)}.chat-layout.chat-thread-open-v10 .chat-main{opacity:1;pointer-events:auto;transform:none}.chat-back-v10{display:grid!important}.chat-header{padding:9px 10px!important;gap:8px!important}.chat-header .social-avatar-img,.chat-header .social-avatar-fallback{width:38px!important;height:38px!important}.chat-header .button:not(.chat-back-v10){width:36px!important;min-width:36px!important;height:36px!important;padding:0!important;font-size:0!important}.chat-header .button:not(.chat-back-v10) .ui-icon{margin:0!important}.chat-messages{padding:13px 11px!important}.chat-bubble{max-width:86%!important;font-size:12px}.chat-compose{padding:9px!important}.chat-compose textarea{min-height:40px;font-size:12px}.chat-compose .button{width:42px!important;min-width:42px!important;padding:0!important;font-size:0!important}.chat-compose .button .ui-icon{margin:0!important}.chat-compose-meta-v10{display:none}.chat-scroll-bottom-v10{right:12px;bottom:63px}.chat-side-head{padding:12px!important}#conversationList{padding:5px 7px}.chat-conversation{padding:10px!important}
        .profile-media-card-v10 .profile-v3-upload{grid-template-columns:88px minmax(0,1fr)!important;padding:10px;gap:11px!important}.profile-media-card-v10 .profile-v3-upload-preview{width:88px!important;height:88px!important;border-radius:20px!important}.profile-media-card-v10[data-media-kind="cover"] .profile-v3-upload{grid-template-columns:1fr!important}.profile-media-card-v10[data-media-kind="cover"] .profile-v3-upload-preview{width:100%!important;height:auto!important}.profile-media-card-v10 .profile-v3-upload-preview::after{opacity:1;font-size:7px;min-height:23px}.profile-media-card-v10 .profile-v3-upload-actions{display:grid!important;grid-template-columns:1fr 1fr!important}.profile-media-card-v10 .profile-v3-upload-actions .button{width:100%!important}
        [data-profile-v3="1"] .profile-v3-store{grid-auto-columns:minmax(228px,82vw)!important;gap:8px!important}.profile-store-rail-v10 button{width:32px!important;min-width:32px!important;height:32px!important}
      }
      @media(max-width:390px){.chat-layout{height:calc(100dvh - 150px)!important}.profile-media-card-v10 .profile-v3-upload{grid-template-columns:1fr!important}.profile-media-card-v10 .profile-v3-upload-preview{width:100%!important;height:auto!important;aspect-ratio:1/1;max-width:210px;margin:auto}.profile-media-card-v10[data-media-kind="cover"] .profile-v3-upload-preview{max-width:none;aspect-ratio:16/7}}
    `;
    document.head.appendChild(style);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (path === '/painel/chat') enhanceChat();
      if (path === '/painel/perfil') {
        enhanceMedia();
        enhanceStore();
      }
    });
  }

  function enhanceChat() {
    const layout = document.querySelector('.chat-layout');
    if (!layout) return;
    enhanceConversationSearch(layout);
    enhanceThread(layout);
    enhanceComposer(layout);
    enhanceBubbles(layout);
    enhanceScrollButton(layout);

    if (!initialChatModeResolved && matchMedia('(max-width:760px)').matches) {
      initialChatModeResolved = true;
      const requested = new URLSearchParams(location.search).get('with');
      layout.classList.toggle('chat-thread-open-v10', Boolean(requested));
    }
  }

  function enhanceConversationSearch(layout) {
    const head = layout.querySelector('.chat-side-head');
    const list = layout.querySelector('#conversationList');
    if (!head || !list) return;
    const conversations = [...list.querySelectorAll('.chat-conversation')];
    let title = head.querySelector('.chat-side-title-v10');
    if (!title) {
      title = document.createElement('div');
      title.className = 'chat-side-title-v10';
      title.innerHTML = '<strong>Conversas</strong><span class="chat-side-count-v10"></span>';
      head.querySelector('strong')?.remove();
      head.prepend(title);
    }
    const count = title.querySelector('.chat-side-count-v10');
    if (count) count.textContent = `${conversations.length}`;
    if (head.querySelector('.chat-search-v10')) return;
    const wrap = document.createElement('label');
    wrap.className = 'chat-search-v10';
    wrap.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" autocomplete="off" placeholder="Buscar conversa" aria-label="Buscar conversas">';
    head.appendChild(wrap);
    const input = wrap.querySelector('input');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLocaleLowerCase('pt-BR');
      for (const button of list.querySelectorAll('.chat-conversation')) {
        button.hidden = Boolean(q) && !button.textContent.toLocaleLowerCase('pt-BR').includes(q);
      }
    });
  }

  function enhanceThread(layout) {
    const header = layout.querySelector('.chat-header');
    if (!header) return;
    if (!header.querySelector('.chat-back-v10')) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'button chat-back-v10';
      back.setAttribute('aria-label','Voltar para conversas');
      back.innerHTML = '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>';
      header.prepend(back);
      back.addEventListener('click', () => {
        layout.classList.remove('chat-thread-open-v10');
        history.replaceState(null,'','/painel/chat');
      });
    }
    if (header.dataset.threadV10Bound !== '1') {
      header.dataset.threadV10Bound = '1';
      layout.classList.add('chat-thread-open-v10');
    }
    if (layout.dataset.conversationV10Bound !== '1') {
      layout.dataset.conversationV10Bound = '1';
      layout.addEventListener('click', event => {
        if (event.target.closest('.chat-conversation')) layout.classList.add('chat-thread-open-v10');
      });
    }
  }

  function enhanceComposer(layout) {
    const form = layout.querySelector('#chatForm');
    if (!form || form.dataset.composerV10 === '1') return;
    const oldInput = form.querySelector('#chatInput');
    if (!oldInput) return;
    const textarea = document.createElement('textarea');
    textarea.id = 'chatInput';
    textarea.maxLength = 2000;
    textarea.rows = 1;
    textarea.autocomplete = 'off';
    textarea.placeholder = oldInput.getAttribute('placeholder') || 'Digite uma mensagem...';
    textarea.value = oldInput.value || '';
    oldInput.replaceWith(textarea);
    form.dataset.composerV10 = '1';

    const meta = document.createElement('span');
    meta.className = 'chat-compose-meta-v10';
    meta.textContent = 'Enter envia · Shift+Enter quebra linha';
    form.appendChild(meta);

    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(132,Math.max(42,textarea.scrollHeight))}px`;
    };
    textarea.addEventListener('input', resize);
    textarea.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (textarea.value.trim()) form.requestSubmit();
      }
    });
    form.addEventListener('submit', () => setTimeout(resize,0));
    resize();
  }

  function enhanceBubbles(layout) {
    const box = layout.querySelector('#chatMessages');
    if (!box) return;
    let previous = null;
    for (const bubble of box.querySelectorAll('.chat-bubble')) {
      const sameSide = previous && previous.classList.contains('mine') === bubble.classList.contains('mine');
      bubble.classList.toggle('chat-grouped-v10', Boolean(sameSide));
      previous = bubble;
    }
  }

  function enhanceScrollButton(layout) {
    const box = layout.querySelector('#chatMessages');
    const main = layout.querySelector('#chatMain');
    if (!box || !main) return;
    let button = main.querySelector('.chat-scroll-bottom-v10');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'chat-scroll-bottom-v10';
      button.setAttribute('aria-label','Ir para mensagens recentes');
      button.innerHTML = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
      main.appendChild(button);
      button.addEventListener('click', () => box.scrollTo({top:box.scrollHeight,behavior:'smooth'}));
    }
    if (box.dataset.scrollV10 !== '1') {
      box.dataset.scrollV10 = '1';
      const update = () => button.classList.toggle('show',box.scrollHeight-box.scrollTop-box.clientHeight>160);
      box.addEventListener('scroll',update,{passive:true});
      update();
    }
  }

  function enhanceMedia() {
    const panel = document.querySelector('[data-profile-panel="media"]');
    if (!panel) return;
    for (const card of panel.querySelectorAll('.profile-v3-card')) {
      const title = card.querySelector('h3')?.textContent.trim();
      const kind = title === 'Foto de perfil' ? 'avatar' : title === 'Fundo do perfil' ? 'cover' : '';
      if (!kind) continue;
      card.classList.add('profile-media-card-v10');
      card.dataset.mediaKind = kind;
      enhanceMediaCard(card,kind);
    }
  }

  function enhanceMediaCard(card,kind) {
    const input = card.querySelector('input[type="file"]');
    const preview = card.querySelector('.profile-v3-upload-preview');
    if (!input || !preview || input.dataset.mediaV10 === '1') return;
    input.dataset.mediaV10 = '1';
    preview.setAttribute('role','button');
    preview.setAttribute('tabindex','0');
    preview.setAttribute('aria-label',kind === 'avatar' ? 'Escolher nova foto de perfil' : 'Escolher nova capa');
    const choose = () => input.click();
    preview.addEventListener('click',choose);
    preview.addEventListener('keydown',event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });

    const info = document.createElement('div');
    info.className = 'profile-media-file-v10';
    info.textContent = kind === 'avatar' ? 'PNG, JPG ou WebP · toque na foto para trocar' : 'PNG, JPG ou WebP · recomendamos formato horizontal';
    input.insertAdjacentElement('afterend',info);

    const updatePreview = file => {
      if (!file || !file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" alt="Prévia local">`;
      info.textContent = `${file.name} · ${formatBytes(file.size)} · prévia local`;
      const img = preview.querySelector('img');
      img?.addEventListener('load',() => URL.revokeObjectURL(url),{once:true});
    };
    input.addEventListener('change',() => updatePreview(input.files?.[0]));

    for (const name of ['dragenter','dragover']) card.addEventListener(name,event => { event.preventDefault(); card.classList.add('dragging-v10'); });
    for (const name of ['dragleave','drop']) card.addEventListener(name,event => { event.preventDefault(); card.classList.remove('dragging-v10'); });
    card.addEventListener('drop',event => {
      const file = [...(event.dataTransfer?.files || [])].find(item => item.type.startsWith('image/'));
      if (!file) return;
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change',{bubbles:true}));
      } catch { updatePreview(file); }
    });
  }

  function enhanceStore() {
    const panel = document.querySelector('[data-profile-panel="store"]');
    const store = panel?.querySelector('.profile-v3-store');
    const head = panel?.querySelector('.profile-v3-store-head');
    if (!store || !head) return;
    if (!head.querySelector('.profile-store-rail-v10')) {
      const controls = document.createElement('div');
      controls.className = 'profile-store-rail-v10';
      controls.innerHTML = `<span class="profile-store-count-v10">${store.children.length} itens</span><button class="button small" type="button" data-store-dir="-1" aria-label="Voltar na loja"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><button class="button small" type="button" data-store-dir="1" aria-label="Avançar na loja"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>`;
      head.appendChild(controls);
      controls.querySelectorAll('[data-store-dir]').forEach(button => button.addEventListener('click',() => {
        const dir = Number(button.dataset.storeDir || 1);
        store.scrollBy({left:dir*Math.max(240,store.clientWidth*.72),behavior:'smooth'});
      }));
    } else {
      const count = head.querySelector('.profile-store-count-v10');
      if (count) count.textContent = `${store.children.length} itens`;
    }
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024*1024) return `${(value/1024).toFixed(1)} KB`;
    return `${(value/1024/1024).toFixed(1)} MB`;
  }
})();