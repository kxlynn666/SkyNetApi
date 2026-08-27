(() => {
  if (window.__SKYNET_CHECKERS_V1__) return;
  window.__SKYNET_CHECKERS_V1__ = true;

  const S = window.SkyNet;
  const R = window.SkyNetCheckersRules;
  if (!S || !R) return;

  const PATH = '/painel/jogos/damas';
  let socket = null;
  let mode = null;
  let localState = null;
  let onlineGame = null;
  let selected = null;
  let botDifficulty = 'medium';
  let botThinking = false;
  let queued = false;
  let roomCode = null;
  let messageTimer = null;

  const style = document.createElement('style');
  style.id = 'checkersV1Styles';
  style.textContent = `
    .ck-wrap{max-width:1180px;margin:0 auto;display:grid;gap:14px}.ck-hero{position:relative;overflow:hidden;border:1px solid #29292e;background:linear-gradient(135deg,#0b0b0e,#101018 62%,#171120);padding:22px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:end}.ck-hero:after{content:"";position:absolute;width:240px;height:240px;border-radius:50%;right:-90px;top:-120px;background:radial-gradient(circle,rgba(145,121,255,.23),transparent 68%);pointer-events:none}.ck-hero h2{font-size:clamp(34px,5vw,58px);line-height:.93;margin:5px 0 10px;letter-spacing:-.04em}.ck-hero p{margin:0;color:#92929a;font-size:11px;line-height:1.6;max-width:680px}.ck-badge{position:relative;z-index:1;font:700 8px 'IBM Plex Mono',monospace;padding:7px 9px;border:1px solid #37333f;background:#111016;color:#bdb6ff}.ck-layout{display:grid;grid-template-columns:minmax(430px,1.12fr) minmax(300px,.88fr);gap:14px}.ck-panel{border:1px solid #29292e;background:#0a0a0c;padding:16px}.ck-board-shell{display:grid;gap:12px}.ck-board-top{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}.ck-player{border:1px solid #29292e;background:#0f0f12;padding:9px;display:flex;align-items:center;gap:8px;min-width:0}.ck-player.right{justify-content:flex-end;text-align:right}.ck-player.active{border-color:#786fc4;box-shadow:0 0 0 2px rgba(120,111,196,.08)}.ck-dot{width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.14);box-shadow:inset 0 0 0 3px rgba(0,0,0,.2)}.ck-dot.red{background:linear-gradient(145deg,#ff6b7f,#9d203c)}.ck-dot.white{background:linear-gradient(145deg,#fff4dd,#c8bea9)}.ck-player-copy{min-width:0}.ck-player strong,.ck-player span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ck-player strong{font-size:10px}.ck-player span{font-size:7px;color:#74747b;margin-top:2px;text-transform:uppercase}.ck-turn{font:700 8px 'IBM Plex Mono',monospace;color:#7d7788}.ck-board{width:min(100%,650px);aspect-ratio:1;margin:0 auto;display:grid;grid-template-columns:repeat(8,1fr);border:1px solid #35343a;background:#08080a;box-shadow:0 18px 50px rgba(0,0,0,.24)}.ck-cell{position:relative;border:0;padding:0;display:grid;place-items:center;min-width:0;min-height:0}.ck-cell.light{background:#c8bfaf;cursor:default}.ck-cell.dark{background:#37343d;cursor:pointer}.ck-cell.dark:nth-child(odd){background:#34313a}.ck-cell.last{box-shadow:inset 0 0 0 3px rgba(157,143,255,.36)}.ck-cell.target:after{content:"";position:absolute;width:22%;height:22%;border-radius:50%;background:rgba(202,194,255,.7);box-shadow:0 0 0 5px rgba(156,143,255,.13);z-index:1}.ck-cell.capture-target:after{width:52%;height:52%;background:transparent;border:3px solid rgba(255,215,112,.82);box-shadow:0 0 0 4px rgba(255,215,112,.08)}.ck-piece{position:relative;z-index:2;width:72%;height:72%;border-radius:50%;display:grid;place-items:center;border:3px solid rgba(255,255,255,.13);box-shadow:0 7px 14px rgba(0,0,0,.35),inset 0 -5px 10px rgba(0,0,0,.22),inset 0 4px 7px rgba(255,255,255,.13);transition:transform .13s ease,filter .13s ease,box-shadow .13s ease;animation:ck-piece-in .16s ease-out}.ck-piece.red{background:linear-gradient(145deg,#ff6d82,#a41f3d 68%,#721429)}.ck-piece.white{background:linear-gradient(145deg,#fff4dd,#d9ccb4 68%,#a79b87);color:#302a24}.ck-piece.movable:hover{transform:translateY(-3px) scale(1.03);filter:brightness(1.08)}.ck-piece.selected{transform:translateY(-4px) scale(1.08);box-shadow:0 0 0 4px rgba(184,172,255,.3),0 12px 24px rgba(0,0,0,.42),inset 0 4px 7px rgba(255,255,255,.16)}.ck-crown{font-size:clamp(13px,2.5vw,25px);line-height:1;text-shadow:0 1px 4px rgba(0,0,0,.4)}.ck-board-status{text-align:center;min-height:24px;font-size:10px;line-height:1.5;color:#b5b5bb}.ck-board-actions{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}.ck-mode-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:11px}.ck-mode-card{border:1px solid #2c2c31;background:#0f0f12;padding:10px;text-align:left;cursor:pointer;color:inherit;transition:border-color .12s ease,background .12s ease,transform .12s ease}.ck-mode-card:hover{border-color:#4c475a;background:#141318;transform:translateY(-1px)}.ck-mode-card.active{border-color:#786fc4;background:#15131e}.ck-mode-card strong,.ck-mode-card span{display:block}.ck-mode-card strong{font-size:10px}.ck-mode-card span{font-size:8px;color:#73737b;line-height:1.4;margin-top:3px}.ck-section{margin-top:14px;padding-top:14px;border-top:1px solid #242429}.ck-section:first-child{margin-top:0;padding-top:0;border-top:0}.ck-section h3{font-size:12px;margin:0 0 5px}.ck-muted{font-size:9px;color:#777780;line-height:1.5}.ck-difficulties{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}.ck-online-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.ck-room-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-top:7px}.ck-room-status{margin-top:8px;border:1px solid #2c2c33;background:#0e0e12;padding:10px;display:none}.ck-room-status.show{display:block}.ck-room-code{font:800 22px 'IBM Plex Mono',monospace;letter-spacing:.18em;color:#c6bfff;margin-top:4px}.ck-connection{display:inline-flex;align-items:center;gap:5px;font:700 8px 'IBM Plex Mono',monospace;color:#6d6d75}.ck-connection:before{content:"";width:6px;height:6px;border-radius:50%;background:#6d6d75}.ck-connection.online{color:#57f287}.ck-connection.online:before{background:#57f287;box-shadow:0 0 10px rgba(87,242,135,.45)}.ck-connection.searching{color:#fee75c}.ck-connection.searching:before{background:#fee75c;animation:ck-pulse 1s infinite}.ck-rules{display:grid;gap:6px;margin-top:8px}.ck-rule{display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:start;border-bottom:1px solid #202024;padding:6px 0}.ck-rule b{font:700 8px 'IBM Plex Mono',monospace;color:#9187d9}.ck-rule span{font-size:8px;color:#7c7c84;line-height:1.5}.ck-message{display:none;margin-top:9px;padding:9px;border:1px solid #39343f;background:#121018;color:#c8c4d4;font-size:9px;line-height:1.45}.ck-message.show{display:block}.ck-message.error{border-color:#63303a;color:#ffb1bd;background:#170d10}.ck-message.success{border-color:#31563d;color:#a8efbd;background:#0c1510}.ck-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}.ck-count{border:1px solid #25252a;background:#0e0e10;padding:8px;text-align:center}.ck-count strong,.ck-count span{display:block}.ck-count strong{font-size:15px}.ck-count span{font-size:7px;color:#717178;text-transform:uppercase;margin-top:2px}
    @keyframes ck-piece-in{from{transform:scale(.72);opacity:.35}to{opacity:1}}@keyframes ck-pulse{50%{opacity:.35}}
    @media(max-width:920px){.ck-layout{grid-template-columns:1fr}.ck-board{max-width:650px}.ck-hero{grid-template-columns:1fr}.ck-badge{justify-self:start}}
    @media(max-width:520px){.ck-panel{padding:10px}.ck-mode-grid{grid-template-columns:1fr}.ck-online-actions,.ck-room-row{grid-template-columns:1fr}.ck-player{padding:7px}.ck-player strong{font-size:9px}.ck-board-top{grid-template-columns:1fr 48px 1fr}.ck-crown{font-size:17px}.ck-piece{width:76%;height:76%;border-width:2px}}
  `;
  document.head.appendChild(style);

  function cleanPath() { return location.pathname.replace(/\/+$/, '') || '/'; }

  function waitWorkspace() {
    const ready = () => document.getElementById('workspaceShell') && !document.getElementById('workspaceShell').classList.contains('hidden') && document.getElementById('workspaceContent');
    if (ready()) { if (cleanPath() === PATH) renderPage(); return; }
    const observer = new MutationObserver(() => {
      if (!ready()) return;
      if (cleanPath() === PATH) renderPage();
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  function renderPage() {
    document.getElementById('workspaceKicker').textContent = 'Jogos / Estratégia';
    document.getElementById('workspaceTitle').textContent = 'Damas';
    document.getElementById('workspaceDescription').textContent = 'Damas brasileiras com 1v1 local, bot e partidas online em tempo real.';
    document.title = 'Damas - SkyNetApi';
    const root = document.getElementById('workspaceContent');
    root.innerHTML = `
      <div class="ck-wrap">
        <section class="ck-hero">
          <div><div class="workspace-kicker">CHECKERS / LOCAL + BOT + ONLINE</div><h2>Pense à frente.<br>Domine as diagonais.</h2><p>Partidas completas em tabuleiro 8×8, com captura obrigatória, maior sequência de capturas e damas de longo alcance.</p></div>
          <span class="ck-badge">REGRAS BRASILEIRAS</span>
        </section>
        <div class="ck-layout">
          <section class="ck-panel ck-board-shell">
            <div class="ck-board-top"><div class="ck-player" id="ckRedPlayer"></div><div class="ck-turn" id="ckTurn">—</div><div class="ck-player right" id="ckWhitePlayer"></div></div>
            <div class="ck-board" id="ckBoard" aria-label="Tabuleiro de damas"></div>
            <div class="ck-board-status" id="ckStatus">Escolha um modo para começar.</div>
            <div class="ck-board-actions" id="ckBoardActions"></div>
          </section>
          <aside class="ck-panel">
            <div class="ck-section"><h3>Modo de jogo</h3><div class="ck-muted">Troque de modo quando não houver uma partida online em andamento.</div><div class="ck-mode-grid"><button class="ck-mode-card" data-mode="local"><strong>1v1 local</strong><span>Duas pessoas no mesmo dispositivo.</span></button><button class="ck-mode-card" data-mode="bot"><strong>Contra bot</strong><span>Três níveis de dificuldade.</span></button><button class="ck-mode-card" data-mode="online"><strong>Online</strong><span>Partida rápida ou sala por código.</span></button></div></div>
            <div class="ck-section" id="ckBotSection"><h3>Bot</h3><div class="ck-muted">Você joga com as Vermelhas e começa a partida.</div><div class="ck-difficulties"><button class="button" data-difficulty="easy">Fácil</button><button class="button primary" data-difficulty="medium">Médio</button><button class="button" data-difficulty="hard">Difícil</button></div></div>
            <div class="ck-section"><h3>Online <span class="ck-connection" id="ckConnection">offline</span></h3><div class="ck-muted">Encontre alguém automaticamente ou compartilhe um código de sala com outra pessoa.</div><div class="ck-online-actions"><button class="button primary" id="ckQueue">Partida rápida</button><button class="button" id="ckCreateRoom">Criar sala</button></div><div class="ck-room-row"><input id="ckRoomInput" maxlength="6" placeholder="CÓDIGO" autocomplete="off"><button class="button" id="ckJoinRoom">Entrar</button></div><div class="ck-room-status" id="ckRoomStatus"></div></div>
            <div class="ck-message" id="ckMessage"></div>
            <div class="ck-counts" id="ckCounts"></div>
            <div class="ck-section"><h3>Regras desta versão</h3><div class="ck-rules"><div class="ck-rule"><b>01</b><span>Se houver captura, ela é obrigatória. Quando existirem opções diferentes, vale a sequência que captura mais peças.</span></div><div class="ck-rule"><b>02</b><span>Peças comuns andam para frente, mas podem capturar para frente e para trás.</span></div><div class="ck-rule"><b>03</b><span>Damas percorrem várias casas na diagonal e podem pousar em qualquer casa livre válida depois da peça capturada.</span></div><div class="ck-rule"><b>04</b><span>A promoção acontece no fim da jogada. O jogo também reconhece empate após 80 turnos sem captura nem promoção.</span></div></div></div>
          </aside>
        </div>
      </div>`;
    bindUi();
    connectSocket();
    renderAll();
  }

  function bindUi() {
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
      const target = button.dataset.mode;
      if (target === 'local') startLocal();
      else if (target === 'bot') startBot(botDifficulty);
      else if (target === 'online') focusOnline();
    }));
    document.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => startBot(button.dataset.difficulty)));
    document.getElementById('ckQueue')?.addEventListener('click', toggleQueue);
    document.getElementById('ckCreateRoom')?.addEventListener('click', createRoom);
    document.getElementById('ckJoinRoom')?.addEventListener('click', joinRoom);
    document.getElementById('ckRoomInput')?.addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); });
  }

  function canSwitchAwayFromOnline() {
    if (onlineGame?.status === 'playing') {
      notify('Saia da partida online atual antes de trocar de modo.', 'error');
      return false;
    }
    return true;
  }

  function cancelOnlineWaiting() {
    if (queued) socket?.emit('checkers:queue:leave');
    if (roomCode) socket?.emit('checkers:room:cancel');
    queued = false;
    roomCode = null;
  }

  function startLocal() {
    if (!canSwitchAwayFromOnline()) return;
    cancelOnlineWaiting();
    mode = 'local';
    onlineGame = null;
    localState = R.createState();
    selected = null;
    botThinking = false;
    renderAll();
  }

  function startBot(difficulty) {
    if (!canSwitchAwayFromOnline()) return;
    cancelOnlineWaiting();
    botDifficulty = ['easy','medium','hard'].includes(difficulty) ? difficulty : 'medium';
    mode = 'bot';
    onlineGame = null;
    localState = R.createState();
    selected = null;
    botThinking = false;
    renderAll();
  }

  function focusOnline() {
    mode = 'online';
    localState = null;
    selected = null;
    renderAll();
    document.getElementById('ckQueue')?.focus();
  }

  function toggleQueue() {
    if (!socket?.connected) return notify('O modo online ainda não está conectado.', 'error');
    if (onlineGame) return notify('Você já está em uma partida online.', 'error');
    mode = 'online';
    localState = null;
    selected = null;
    if (queued) socket.emit('checkers:queue:leave');
    else {
      if (roomCode) socket.emit('checkers:room:cancel');
      roomCode = null;
      socket.emit('checkers:queue:join');
    }
    renderAll();
  }

  function createRoom() {
    if (!socket?.connected) return notify('O modo online ainda não está conectado.', 'error');
    if (onlineGame) return notify('Você já está em uma partida online.', 'error');
    mode = 'online';
    localState = null;
    selected = null;
    socket.emit('checkers:room:create');
  }

  function joinRoom() {
    if (!socket?.connected) return notify('O modo online ainda não está conectado.', 'error');
    if (onlineGame) return notify('Você já está em uma partida online.', 'error');
    const input = document.getElementById('ckRoomInput');
    const code = String(input?.value || '').trim().toUpperCase();
    if (code.length !== 6) return notify('Digite um código de sala com 6 caracteres.', 'error');
    mode = 'online';
    localState = null;
    selected = null;
    socket.emit('checkers:room:join', { code });
  }

  function connectSocket() {
    if (socket || typeof io !== 'function') return;
    socket = io();
    socket.on('connect', () => renderConnection());
    socket.on('disconnect', () => renderConnection());
    socket.on('checkers:ready', data => {
      queued = Boolean(data?.queued);
      renderAll();
    });
    socket.on('checkers:queue', data => {
      queued = Boolean(data?.queued);
      if (queued) { mode = 'online'; localState = null; roomCode = null; }
      renderAll();
    });
    socket.on('checkers:room', data => {
      roomCode = data?.waiting && data?.code ? String(data.code) : null;
      if (roomCode) { mode = 'online'; localState = null; queued = false; }
      renderAll();
    });
    socket.on('checkers:game', data => {
      mode = 'online';
      localState = null;
      onlineGame = data;
      queued = false;
      roomCode = null;
      selected = Number.isInteger(data?.forcedFrom) ? data.forcedFrom : null;
      renderAll();
    });
    socket.on('checkers:left', data => {
      onlineGame = null;
      selected = null;
      notify(data?.reason || 'Partida online encerrada.');
      renderAll();
    });
    socket.on('checkers:error', data => notify(data?.error || 'Erro no modo online.', 'error'));
    socket.on('checkers:rematch:state', data => {
      if (!onlineGame) return;
      const requested = Array.isArray(data?.requestedBy) ? data.requestedBy.length : 0;
      notify(requested >= 2 ? 'Revanche confirmada.' : 'Pedido de revanche enviado.');
    });
    renderConnection();
  }

  function currentState() {
    if (mode === 'online' && onlineGame) return {
      board: onlineGame.board,
      turn: onlineGame.turn,
      forcedFrom: onlineGame.forcedFrom,
      status: onlineGame.status,
      winner: onlineGame.winner,
      noProgress: onlineGame.noProgress,
      moveNumber: onlineGame.moveNumber,
      lastMove: onlineGame.lastMove
    };
    return localState;
  }

  function legalSteps() {
    if (mode === 'online') return onlineGame?.canMove ? (onlineGame.legalSteps || []) : [];
    if (!localState || localState.status !== 'playing') return [];
    if (mode === 'bot' && (localState.turn !== 'red' || botThinking)) return [];
    return R.getLegalSteps(localState.board, localState.turn, localState.forcedFrom);
  }

  function boardClick(index) {
    const state = currentState();
    if (!state || state.status !== 'playing') return;
    const steps = legalSteps();
    if (!steps.length) return;
    if (Number.isInteger(state.forcedFrom)) selected = state.forcedFrom;

    if (Number.isInteger(selected)) {
      const move = steps.find(item => item.from === selected && item.to === index);
      if (move) return performMove(move.from, move.to);
    }

    if (steps.some(item => item.from === index)) {
      selected = index;
      renderBoard();
      return;
    }
    if (!Number.isInteger(state.forcedFrom)) {
      selected = null;
      renderBoard();
    }
  }

  function performMove(from, to) {
    if (mode === 'online') {
      if (!onlineGame?.canMove) return;
      socket?.emit('checkers:move', { gameId: onlineGame.id, from, to });
      return;
    }
    try {
      localState = R.applyStep(localState, from, to);
      selected = Number.isInteger(localState.forcedFrom) ? localState.forcedFrom : null;
      renderAll();
      if (mode === 'bot' && localState.status === 'playing' && localState.turn === 'white' && localState.forcedFrom === null) runBot();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  function runBot() {
    if (botThinking || !localState || localState.turn !== 'white') return;
    botThinking = true;
    renderAll();
    setTimeout(() => {
      try {
        const sequence = R.chooseBotSequence(localState, botDifficulty, 'white');
        if (sequence) localState = R.applyTurnSequence(localState, sequence);
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        botThinking = false;
        selected = null;
        renderAll();
      }
    }, botDifficulty === 'hard' ? 420 : 320);
  }

  function renderAll() {
    if (cleanPath() !== PATH || !document.getElementById('ckBoard')) return;
    document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
    document.querySelectorAll('[data-difficulty]').forEach(button => {
      button.classList.toggle('primary', button.dataset.difficulty === botDifficulty);
    });
    renderBoard();
    renderStatus();
    renderCounts();
    renderOnlineControls();
    renderConnection();
  }

  function renderBoard() {
    const boardRoot = document.getElementById('ckBoard');
    if (!boardRoot) return;
    const state = currentState() || R.createState();
    const steps = legalSteps();
    const movable = new Set(steps.map(item => item.from));
    const targets = Number.isInteger(selected) ? steps.filter(item => item.from === selected) : [];
    const targetMap = new Map(targets.map(item => [item.to, item]));
    const forced = Number.isInteger(state.forcedFrom) ? state.forcedFrom : null;
    if (forced !== null) selected = forced;
    const lastFrom = Number(state.lastMove?.from);
    const lastTo = Number(state.lastMove?.to);

    boardRoot.innerHTML = state.board.map((piece, index) => {
      const row = Math.floor(index / 8);
      const col = index % 8;
      const dark = (row + col) % 2 === 1;
      const target = targetMap.get(index);
      const classes = ['ck-cell', dark ? 'dark' : 'light'];
      if (index === lastFrom || index === lastTo) classes.push('last');
      if (target) classes.push('target', target.capture !== null ? 'capture-target' : '');
      let pieceHtml = '';
      if (piece) {
        const color = piece > 0 ? 'red' : 'white';
        const pieceClasses = ['ck-piece', color];
        if (movable.has(index)) pieceClasses.push('movable');
        if (selected === index) pieceClasses.push('selected');
        pieceHtml = `<span class="${pieceClasses.join(' ')}">${Math.abs(piece) === 2 ? '<span class="ck-crown">♛</span>' : ''}</span>`;
      }
      return `<button type="button" class="${classes.filter(Boolean).join(' ')}" data-index="${index}" ${dark ? '' : 'tabindex="-1"'} aria-label="Casa ${row + 1}, ${col + 1}">${pieceHtml}</button>`;
    }).join('');
    boardRoot.querySelectorAll('.ck-cell.dark').forEach(cell => cell.addEventListener('click', () => boardClick(Number(cell.dataset.index))));
  }

  function renderStatus() {
    const status = document.getElementById('ckStatus');
    const actions = document.getElementById('ckBoardActions');
    const turn = document.getElementById('ckTurn');
    const redRoot = document.getElementById('ckRedPlayer');
    const whiteRoot = document.getElementById('ckWhitePlayer');
    if (!status || !actions || !turn || !redRoot || !whiteRoot) return;
    const state = currentState();

    let redName = 'Vermelhas';
    let whiteName = 'Claras';
    let redMeta = 'jogador 1';
    let whiteMeta = mode === 'bot' ? `bot ${difficultyLabel(botDifficulty)}` : 'jogador 2';
    if (mode === 'online' && onlineGame) {
      redName = onlineGame.red?.username || 'Vermelhas';
      whiteName = onlineGame.white?.username || 'Claras';
      redMeta = onlineGame.viewerColor === 'red' ? 'você · vermelhas' : 'oponente · vermelhas';
      whiteMeta = onlineGame.viewerColor === 'white' ? 'você · claras' : 'oponente · claras';
    }
    redRoot.className = `ck-player ${state?.status === 'playing' && state.turn === 'red' ? 'active' : ''}`;
    whiteRoot.className = `ck-player right ${state?.status === 'playing' && state.turn === 'white' ? 'active' : ''}`;
    redRoot.innerHTML = `<span class="ck-dot red"></span><span class="ck-player-copy"><strong>${escape(redName)}</strong><span>${escape(redMeta)}</span></span>`;
    whiteRoot.innerHTML = `<span class="ck-player-copy"><strong>${escape(whiteName)}</strong><span>${escape(whiteMeta)}</span></span><span class="ck-dot white"></span>`;

    if (!state) {
      turn.textContent = '—';
      status.textContent = mode === 'online' ? 'Use partida rápida ou entre em uma sala.' : 'Escolha 1v1 local ou um nível de bot para começar.';
      actions.innerHTML = '';
      return;
    }

    turn.textContent = state.status === 'playing' ? (state.turn === 'red' ? 'VERMELHAS' : 'CLARAS') : 'FIM';
    if (state.status === 'finished') {
      status.textContent = resultText(state);
      if (mode === 'online') actions.innerHTML = `<button class="button primary" id="ckRematch">Pedir revanche</button><button class="button" id="ckLeave">Sair</button>`;
      else actions.innerHTML = `<button class="button primary" id="ckRestart">Nova partida</button>`;
    } else if (mode === 'bot' && botThinking) {
      status.textContent = 'O bot está calculando a jogada…';
      actions.innerHTML = `<button class="button" id="ckRestart">Reiniciar</button>`;
    } else if (Number.isInteger(state.forcedFrom)) {
      status.textContent = 'Captura múltipla: continue movendo a mesma peça.';
      actions.innerHTML = mode === 'online' ? `<button class="button" id="ckLeave">Sair da partida</button>` : `<button class="button" id="ckRestart">Reiniciar</button>`;
    } else {
      status.textContent = statusText(state);
      actions.innerHTML = mode === 'online' ? `<button class="button" id="ckLeave">Sair da partida</button>` : `<button class="button" id="ckRestart">Reiniciar</button>`;
    }

    document.getElementById('ckRestart')?.addEventListener('click', () => mode === 'bot' ? startBot(botDifficulty) : startLocal());
    document.getElementById('ckRematch')?.addEventListener('click', () => socket?.emit('checkers:rematch', { gameId: onlineGame?.id }));
    document.getElementById('ckLeave')?.addEventListener('click', () => socket?.emit('checkers:leave'));
  }

  function statusText(state) {
    if (mode === 'online' && onlineGame) {
      if (onlineGame.canMove) return `Sua vez (${R.formatPlayer(onlineGame.viewerColor)}).`;
      return `Vez de ${state.turn === 'red' ? onlineGame.red?.username || 'Vermelhas' : onlineGame.white?.username || 'Claras'}.`;
    }
    if (mode === 'bot') return state.turn === 'red' ? 'Sua vez. Você joga com as Vermelhas.' : 'Vez do bot.';
    return `Vez das ${R.formatPlayer(state.turn)}.`;
  }

  function resultText(state) {
    if (state.winner === 'draw') return 'Empate por falta de progresso.';
    if (mode === 'online' && onlineGame) {
      const winnerName = state.winner === 'red' ? onlineGame.red?.username : onlineGame.white?.username;
      return `${winnerName || R.formatPlayer(state.winner)} venceu.${onlineGame.forfeitReason ? ` ${onlineGame.forfeitReason}` : ''}`;
    }
    if (mode === 'bot') return state.winner === 'red' ? 'Você venceu o bot!' : 'O bot venceu esta partida.';
    return `${R.formatPlayer(state.winner)} venceram a partida.`;
  }

  function renderCounts() {
    const root = document.getElementById('ckCounts');
    if (!root) return;
    const state = currentState() || R.createState();
    const red = R.countPieces(state.board, 'red');
    const white = R.countPieces(state.board, 'white');
    root.innerHTML = `<div class="ck-count"><strong>${red.total}</strong><span>vermelhas</span></div><div class="ck-count"><strong>${red.kings}</strong><span>damas verm.</span></div><div class="ck-count"><strong>${white.total}</strong><span>claras</span></div><div class="ck-count"><strong>${white.kings}</strong><span>damas claras</span></div>`;
  }

  function renderOnlineControls() {
    const queueButton = document.getElementById('ckQueue');
    const roomStatus = document.getElementById('ckRoomStatus');
    const createButton = document.getElementById('ckCreateRoom');
    const joinButton = document.getElementById('ckJoinRoom');
    const input = document.getElementById('ckRoomInput');
    if (!queueButton || !roomStatus || !createButton || !joinButton || !input) return;
    queueButton.textContent = queued ? 'Sair da fila' : 'Partida rápida';
    queueButton.classList.toggle('primary', !queued);
    const busy = Boolean(onlineGame);
    createButton.disabled = busy;
    joinButton.disabled = busy;
    input.disabled = busy;
    if (roomCode) {
      roomStatus.className = 'ck-room-status show';
      roomStatus.innerHTML = `<div class="ck-muted">Sala criada. Compartilhe este código:</div><div class="ck-room-code">${escape(roomCode)}</div><button class="button small" id="ckCancelRoom" style="margin-top:8px">Cancelar sala</button>`;
      document.getElementById('ckCancelRoom')?.addEventListener('click', () => socket?.emit('checkers:room:cancel'));
    } else if (queued) {
      roomStatus.className = 'ck-room-status show';
      roomStatus.innerHTML = `<div class="ck-muted">Procurando outro jogador online…</div>`;
    } else {
      roomStatus.className = 'ck-room-status';
      roomStatus.innerHTML = '';
    }
  }

  function renderConnection() {
    const root = document.getElementById('ckConnection');
    if (!root) return;
    const online = Boolean(socket?.connected);
    root.className = `ck-connection ${queued ? 'searching' : online ? 'online' : ''}`;
    root.textContent = queued ? 'procurando' : online ? 'online' : 'offline';
  }

  function difficultyLabel(value) {
    return value === 'easy' ? 'fácil' : value === 'hard' ? 'difícil' : 'médio';
  }

  function notify(text, type = '') {
    const root = document.getElementById('ckMessage');
    if (!root) return;
    clearTimeout(messageTimer);
    root.textContent = String(text || '');
    root.className = `ck-message show ${type}`.trim();
    messageTimer = setTimeout(() => { if (root) root.className = 'ck-message'; }, 5000);
  }

  function escape(value) {
    return S.escapeHtml ? S.escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  waitWorkspace();
})();
