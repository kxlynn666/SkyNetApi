(() => {
  if (window.__SKYNET_DICE_ROLLER_V1__) return;
  window.__SKYNET_DICE_ROLLER_V1__ = true;

  const S = window.SkyNet;
  if (!S) return;
  const PATH = '/painel/jogos/dados';
  const SIDES = [4, 6, 8, 10, 12, 20, 100];
  const history = [];
  let rolling = false;
  let quantity = 2;
  let sides = 6;
  let modifier = 0;

  const style = document.createElement('style');
  style.id = 'diceRollerV1Styles';
  style.textContent = `
    .dice-wrap{max-width:1120px;margin:0 auto;display:grid;gap:14px}.dice-hero{position:relative;overflow:hidden;border:1px solid #29292e;background:radial-gradient(circle at 86% 15%,rgba(116,101,211,.2),transparent 28%),linear-gradient(135deg,#0a0a0c,#111018);padding:22px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:end}.dice-hero h2{font-size:clamp(34px,5vw,58px);line-height:.94;letter-spacing:-.04em;margin:5px 0 10px}.dice-hero p{margin:0;color:#92929a;font-size:11px;line-height:1.6;max-width:680px}.dice-badge{font:700 8px 'IBM Plex Mono',monospace;color:#c8c0ff;border:1px solid #3a3549;background:#121018;padding:7px 9px}.dice-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:14px}.dice-panel{border:1px solid #29292e;background:#0a0a0c;padding:16px}.dice-stage{min-height:430px;border:1px solid #24242a;background:radial-gradient(circle at 50% 46%,rgba(109,96,186,.12),transparent 34%),linear-gradient(180deg,#0d0d11,#08080a);display:grid;grid-template-rows:1fr auto;gap:14px;padding:18px;position:relative;overflow:hidden}.dice-stage:before{content:"";position:absolute;inset:auto 10% 45px;height:44px;border-radius:50%;background:radial-gradient(ellipse,rgba(0,0,0,.55),transparent 70%);filter:blur(7px);pointer-events:none}.dice-results{position:relative;z-index:2;align-self:center;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:18px;min-height:230px}.die{--delay:0ms;width:92px;height:92px;display:grid;place-items:center;position:relative;transform-origin:center;animation:die-arrive .42s cubic-bezier(.2,.85,.25,1.25) var(--delay) both}.die.rolling{animation:die-roll .68s cubic-bezier(.22,.72,.25,1) var(--delay) both}.die-cube{width:78px;height:78px;border-radius:15px;background:linear-gradient(145deg,#f7f3e8,#d7cfbd);border:1px solid #fff;box-shadow:0 16px 28px rgba(0,0,0,.38),inset 0 -7px 12px rgba(105,93,76,.15),inset 0 5px 10px rgba(255,255,255,.75);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:12px;transform:rotateX(8deg) rotateY(-10deg) rotateZ(2deg)}.die-pip{width:11px;height:11px;border-radius:50%;background:#242229;align-self:center;justify-self:center;box-shadow:inset 0 2px 3px rgba(0,0,0,.45),0 1px 0 rgba(255,255,255,.45)}.die-poly{width:86px;height:86px;display:grid;place-items:center;position:relative;filter:drop-shadow(0 15px 17px rgba(0,0,0,.35))}.die-poly:before{content:"";position:absolute;inset:2px;background:linear-gradient(145deg,#a79aff,#554a9b 70%,#342d66);clip-path:polygon(50% 0,93% 24%,100% 70%,50% 100%,0 70%,7% 24%);border-radius:8px}.die-poly:after{content:"";position:absolute;inset:8px;clip-path:polygon(50% 0,93% 24%,100% 70%,50% 100%,0 70%,7% 24%);background:linear-gradient(135deg,rgba(255,255,255,.17),transparent 55%)}.die-poly strong{position:relative;z-index:2;color:#fff;font:800 24px 'IBM Plex Mono',monospace;text-shadow:0 2px 4px rgba(0,0,0,.35)}.die-poly span{position:absolute;z-index:2;bottom:13px;color:#e1dcff;font:700 7px 'IBM Plex Mono',monospace;text-transform:uppercase}.dice-empty{text-align:center;color:#6d6d75;font-size:10px;line-height:1.6}.dice-summary{position:relative;z-index:2;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end;border-top:1px solid #25252a;padding-top:13px}.dice-summary strong,.dice-summary span{display:block}.dice-summary strong{font-size:clamp(26px,4vw,42px);line-height:1}.dice-summary span{font-size:8px;color:#777780;margin-top:4px;text-transform:uppercase}.dice-expression{text-align:right;font:700 10px 'IBM Plex Mono',monospace;color:#a49eb5;word-break:break-word}.dice-control{margin-bottom:14px}.dice-control:last-child{margin-bottom:0}.dice-control-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.dice-control-head label{font-size:9px;color:#c2c2c7}.dice-control-value{font:700 10px 'IBM Plex Mono',monospace;color:#b8aff4}.dice-stepper{display:grid;grid-template-columns:42px 1fr 42px;gap:6px}.dice-stepper button{min-height:38px}.dice-stepper-output{border:1px solid #2a2a30;background:#0f0f12;display:grid;place-items:center;font:800 17px 'IBM Plex Mono',monospace}.dice-sides{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.dice-side{min-height:40px;border:1px solid #2b2b31;background:#101013;color:#8e8e96;font:700 9px 'IBM Plex Mono',monospace;cursor:pointer}.dice-side:hover{border-color:#4b4659;color:#ddd9ef}.dice-side.active{border-color:#786fc4;background:#171421;color:#d6d0ff;box-shadow:0 0 0 2px rgba(120,111,196,.08)}.dice-roll-button{width:100%;min-height:48px;font-size:11px!important;margin-top:5px}.dice-tip{margin-top:8px;font-size:8px;color:#686871;text-align:center}.dice-history{display:grid;gap:6px;margin-top:10px;max-height:280px;overflow:auto}.dice-history-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border-bottom:1px solid #222227;padding:8px 2px}.dice-history-index{font:700 8px 'IBM Plex Mono',monospace;color:#665e8d}.dice-history-values{font:600 9px 'IBM Plex Mono',monospace;color:#92929b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dice-history-total{font:800 13px 'IBM Plex Mono',monospace;color:#d4cff4}.dice-history-empty{padding:20px 0;color:#66666d;font-size:9px;text-align:center}.dice-section{margin-top:16px;padding-top:15px;border-top:1px solid #242429}.dice-section h3{margin:0 0 5px;font-size:12px}.dice-section p{margin:0;color:#74747c;font-size:8px;line-height:1.55}.dice-fair{display:grid;grid-template-columns:24px 1fr;gap:8px;margin-top:9px;align-items:start}.dice-fair b{font:700 8px 'IBM Plex Mono',monospace;color:#9187d9}.dice-fair span{font-size:8px;color:#777780;line-height:1.5}
    @keyframes die-arrive{0%{opacity:0;transform:translateY(-55px) rotate(-24deg) scale(.68)}70%{opacity:1;transform:translateY(7px) rotate(7deg) scale(1.04)}100%{transform:none}}@keyframes die-roll{0%{transform:translateY(-70px) rotateX(0) rotateY(0) rotateZ(0) scale(.7);opacity:.4}34%{transform:translateY(-15px) rotateX(160deg) rotateY(210deg) rotateZ(120deg) scale(1.08);opacity:1}68%{transform:translateY(8px) rotateX(310deg) rotateY(380deg) rotateZ(245deg) scale(.96)}100%{transform:none}}
    @media(max-width:850px){.dice-layout{grid-template-columns:1fr}.dice-stage{min-height:390px}.dice-hero{grid-template-columns:1fr}.dice-badge{justify-self:start}}@media(max-width:520px){.dice-panel{padding:10px}.dice-stage{padding:12px;min-height:360px}.dice-results{gap:10px;min-height:210px}.die{width:72px;height:72px}.die-cube{width:64px;height:64px;padding:10px;border-radius:12px}.die-pip{width:9px;height:9px}.die-poly{width:69px;height:69px}.die-poly strong{font-size:20px}.die-poly span{bottom:10px}.dice-sides{grid-template-columns:repeat(3,1fr)}}
    @media(prefers-reduced-motion:reduce){.die,.die.rolling{animation:none!important}.die-cube,.die-poly{transition:none!important}}
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
    document.getElementById('workspaceKicker').textContent = 'Jogos / Utilitário';
    document.getElementById('workspaceTitle').textContent = 'Rolagem de Dados';
    document.getElementById('workspaceDescription').textContent = 'Role dados virtuais com animações, diferentes formatos e histórico local.';
    document.title = 'Rolagem de Dados - SkyNetApi';
    const root = document.getElementById('workspaceContent');
    root.innerHTML = `
      <div class="dice-wrap">
        <section class="dice-hero"><div><div class="workspace-kicker">DICE / RANDOMIZER</div><h2>Jogue os dados.<br>Veja o resultado cair.</h2><p>Escolha a quantidade, o tipo do dado e um modificador. A rolagem usa aleatoriedade criptográfica do navegador e mantém apenas um histórico local da página.</p></div><span class="dice-badge">SEM APOSTAS · SÓ RANDOMIZAÇÃO</span></section>
        <div class="dice-layout">
          <section class="dice-panel"><div class="dice-stage"><div class="dice-results" id="diceResults"><div class="dice-empty">Configure os dados e pressione <strong>Rolar dados</strong>.</div></div><div class="dice-summary" id="diceSummary"><div><strong>—</strong><span>Total</span></div><div class="dice-expression">Nenhuma rolagem ainda</div></div></div></section>
          <aside class="dice-panel">
            <div class="dice-control"><div class="dice-control-head"><label>Quantidade</label><span class="dice-control-value" id="diceQuantityValue">2 dados</span></div><div class="dice-stepper"><button class="button" id="diceQtyMinus" type="button">−</button><div class="dice-stepper-output" id="diceQtyOutput">2</div><button class="button" id="diceQtyPlus" type="button">+</button></div></div>
            <div class="dice-control"><div class="dice-control-head"><label>Tipo de dado</label><span class="dice-control-value" id="diceSidesValue">d6</span></div><div class="dice-sides" id="diceSides">${SIDES.map(value => `<button class="dice-side ${value === sides ? 'active' : ''}" type="button" data-sides="${value}">d${value}</button>`).join('')}</div></div>
            <div class="dice-control"><div class="dice-control-head"><label>Modificador do total</label><span class="dice-control-value" id="diceModifierValue">+0</span></div><div class="dice-stepper"><button class="button" id="diceModMinus" type="button">−</button><div class="dice-stepper-output" id="diceModOutput">+0</div><button class="button" id="diceModPlus" type="button">+</button></div></div>
            <button class="button primary dice-roll-button" id="diceRoll" type="button">Rolar dados</button><div class="dice-tip">Atalho: barra de espaço, quando você não estiver digitando.</div>
            <div class="dice-section"><h3>Histórico desta página</h3><p>As últimas 12 rolagens ficam somente nesta sessão da página.</p><div class="dice-history" id="diceHistory"><div class="dice-history-empty">Ainda não há resultados.</div></div></div>
            <div class="dice-section"><h3>Como o resultado é gerado</h3><div class="dice-fair"><b>01</b><span>O navegador usa <code>crypto.getRandomValues</code> em vez de <code>Math.random</code>.</span></div><div class="dice-fair"><b>02</b><span>Valores fora do intervalo uniforme são descartados para evitar viés na distribuição.</span></div><div class="dice-fair"><b>03</b><span>O modificador altera apenas o total; cada dado continua mostrando seu valor original.</span></div></div>
          </aside>
        </div>
      </div>`;
    bindUi();
    updateControls();
  }

  function bindUi() {
    document.getElementById('diceQtyMinus')?.addEventListener('click', () => setQuantity(quantity - 1));
    document.getElementById('diceQtyPlus')?.addEventListener('click', () => setQuantity(quantity + 1));
    document.getElementById('diceModMinus')?.addEventListener('click', () => setModifier(modifier - 1));
    document.getElementById('diceModPlus')?.addEventListener('click', () => setModifier(modifier + 1));
    document.querySelectorAll('[data-sides]').forEach(button => button.addEventListener('click', () => setSides(Number(button.dataset.sides))));
    document.getElementById('diceRoll')?.addEventListener('click', roll);
    window.addEventListener('keydown', onKeydown);
  }

  function onKeydown(event) {
    if (cleanPath() !== PATH || event.code !== 'Space' || event.repeat) return;
    const tag = String(document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable) return;
    event.preventDefault();
    roll();
  }

  function setQuantity(value) {
    quantity = Math.max(1, Math.min(8, Number(value) || 1));
    updateControls();
  }

  function setModifier(value) {
    modifier = Math.max(-20, Math.min(20, Number(value) || 0));
    updateControls();
  }

  function setSides(value) {
    if (!SIDES.includes(value)) return;
    sides = value;
    updateControls();
  }

  function updateControls() {
    document.getElementById('diceQtyOutput').textContent = String(quantity);
    document.getElementById('diceQuantityValue').textContent = `${quantity} ${quantity === 1 ? 'dado' : 'dados'}`;
    document.getElementById('diceSidesValue').textContent = `d${sides}`;
    document.getElementById('diceModOutput').textContent = signed(modifier);
    document.getElementById('diceModifierValue').textContent = signed(modifier);
    document.querySelectorAll('[data-sides]').forEach(button => button.classList.toggle('active', Number(button.dataset.sides) === sides));
    document.getElementById('diceQtyMinus').disabled = quantity <= 1 || rolling;
    document.getElementById('diceQtyPlus').disabled = quantity >= 8 || rolling;
    document.getElementById('diceModMinus').disabled = modifier <= -20 || rolling;
    document.getElementById('diceModPlus').disabled = modifier >= 20 || rolling;
    document.querySelectorAll('[data-sides]').forEach(button => { button.disabled = rolling; });
    const rollButton = document.getElementById('diceRoll');
    if (rollButton) {
      rollButton.disabled = rolling;
      rollButton.textContent = rolling ? 'Rolando…' : 'Rolar dados';
    }
  }

  function secureInt(maxInclusive) {
    const max = Number(maxInclusive);
    if (!Number.isInteger(max) || max < 1 || max > 0xffffffff) throw new Error('Número de lados inválido.');
    const range = 0x100000000;
    const limit = range - (range % max);
    const buffer = new Uint32Array(1);
    let value;
    do {
      crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return (value % max) + 1;
  }

  function roll() {
    if (rolling || cleanPath() !== PATH) return;
    rolling = true;
    updateControls();
    const results = Array.from({ length: quantity }, () => secureInt(sides));
    renderDice(results, true);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      rolling = false;
      const sum = results.reduce((total, value) => total + value, 0);
      const total = sum + modifier;
      history.unshift({ results:[...results], sides, modifier, sum, total, at:Date.now() });
      if (history.length > 12) history.length = 12;
      renderDice(results, false);
      renderSummary(results, sum, total);
      renderHistory();
      updateControls();
    }, reduced ? 80 : 760);
  }

  function renderDice(results, animate) {
    const root = document.getElementById('diceResults');
    if (!root) return;
    root.innerHTML = results.map((value, index) => {
      const delay = Math.min(index * 45, 240);
      if (sides === 6) return `<div class="die ${animate ? 'rolling' : ''}" style="--delay:${delay}ms" aria-label="d6: ${value}"><div class="die-cube">${pipGrid(value)}</div></div>`;
      return `<div class="die ${animate ? 'rolling' : ''}" style="--delay:${delay}ms" aria-label="d${sides}: ${value}"><div class="die-poly"><strong>${value}</strong><span>d${sides}</span></div></div>`;
    }).join('');
  }

  function pipGrid(value) {
    const positions = {
      1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9]
    }[Number(value)] || [];
    const pips = new Set(positions);
    return Array.from({length:9}, (_, index) => pips.has(index + 1) ? '<span class="die-pip"></span>' : '<span></span>').join('');
  }

  function renderSummary(results, sum, total) {
    const root = document.getElementById('diceSummary');
    if (!root) return;
    const values = results.join(' + ');
    const expression = modifier === 0 ? values : `${values} ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}`;
    root.innerHTML = `<div><strong>${total}</strong><span>Total</span></div><div class="dice-expression">${escape(expression)}${modifier ? `<br><span>dados: ${sum} · mod: ${signed(modifier)}</span>` : ''}</div>`;
  }

  function renderHistory() {
    const root = document.getElementById('diceHistory');
    if (!root) return;
    if (!history.length) {
      root.innerHTML = '<div class="dice-history-empty">Ainda não há resultados.</div>';
      return;
    }
    root.innerHTML = history.map((item, index) => {
      const mod = item.modifier ? ` ${item.modifier > 0 ? '+' : '−'} ${Math.abs(item.modifier)}` : '';
      return `<div class="dice-history-row"><span class="dice-history-index">#${String(history.length - index).padStart(2,'0')}</span><span class="dice-history-values">${escape(`${item.results.length}d${item.sides}: ${item.results.join(', ')}${mod}`)}</span><strong class="dice-history-total">${item.total}</strong></div>`;
    }).join('');
  }

  function signed(value) { return Number(value) >= 0 ? `+${Number(value)}` : `−${Math.abs(Number(value))}`; }
  function escape(value) { return S.escapeHtml ? S.escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }

  waitWorkspace();
})();
