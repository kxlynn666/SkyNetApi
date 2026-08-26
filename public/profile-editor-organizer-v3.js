(() => {
  if (window.__SKYNET_PROFILE_EDITOR_ORGANIZER_V3__) return;
  window.__SKYNET_PROFILE_EDITOR_ORGANIZER_V3__ = true;
  window.__SKYNET_PROFILE_EDITOR_ORGANIZER_V2__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  const root = document.getElementById('workspaceContent') || document.documentElement;
  let observer = null;
  let scheduled = false;
  let organizing = false;

  const style = document.createElement('style');
  style.id = 'profileEditorOrganizerV3Styles';
  style.textContent = `
    [data-profile-v3="1"] .profile-v3-tabs{gap:6px;padding:6px;scroll-snap-type:x proximity;overscroll-behavior-x:contain;position:relative;z-index:12}
    [data-profile-v3="1"] .profile-v3-tab{min-height:40px;padding:8px 12px;font-size:11px;scroll-snap-align:start;pointer-events:auto!important;touch-action:manipulation}
    [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="identity"]>.profile-v3-grid,
    [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="media"]>.profile-v3-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="identity"]>.profile-v3-grid>.profile-v3-card,
    [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="media"]>.profile-v3-grid>.profile-v3-card{grid-column:auto!important}
    [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="appearance"]>.profile-v3-grid>.profile-v3-card,
    [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="cosmetics"]>.profile-v3-grid>.profile-v3-card,
    [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="privacy"]>.profile-v3-grid>.profile-v3-card{grid-column:1/-1!important}
    @media(max-width:760px){
      [data-profile-v3="1"] .profile-v3-tabs{position:sticky;top:67px;z-index:18;background:rgba(13,8,24,.96);backdrop-filter:blur(14px);margin-left:-2px;margin-right:-2px}
      [data-profile-v3="1"] .profile-v3-tab{flex:none!important;min-width:auto!important;padding:8px 11px!important;font-size:10px!important}
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="identity"]>.profile-v3-grid,
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="media"]>.profile-v3-grid{grid-template-columns:1fr!important;gap:10px}
      [data-profile-v3="1"] .profile-v3-panel>.profile-v3-grid{gap:10px!important}
    }
  `;
  document.head.appendChild(style);

  function shell() { return document.querySelector('.profile-v3-shell'); }

  function activate(id, { focus = false } = {}) {
    const host = shell();
    if (!host) return;
    const tabs = [...host.querySelectorAll('[data-profile-tab]')];
    const panels = [...host.querySelectorAll('[data-profile-panel]')];
    if (!tabs.some(tab => tab.dataset.profileTab === id) || !panels.some(panel => panel.dataset.profilePanel === id)) return;

    for (const tab of tabs) {
      const active = tab.dataset.profileTab === id;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus({ preventScroll:true });
    }
    for (const panel of panels) {
      const active = panel.dataset.profilePanel === id;
      panel.classList.toggle('active', active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
  }

  function ensurePanel(host, id) {
    let panel = host.querySelector(`[data-profile-panel="${id}"]`);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'profile-v3-panel';
    panel.dataset.profilePanel = id;
    panel.setAttribute('aria-hidden','true');
    panel.innerHTML = '<div class="profile-v3-grid"></div>';
    const store = host.querySelector('[data-profile-panel="store"]');
    host.insertBefore(panel, store || null);
    return panel;
  }

  function ensureTab(tabs, id, label) {
    let button = tabs.querySelector(`[data-profile-tab="${id}"]`);
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-v3-tab';
    button.dataset.profileTab = id;
    button.textContent = label;
    button.setAttribute('role','tab');
    button.setAttribute('aria-selected','false');
    button.tabIndex = -1;
    tabs.appendChild(button);
    return button;
  }

  function moveCard(fromPanel, toPanel, title) {
    const source = fromPanel?.querySelector(':scope > .profile-v3-grid');
    const target = toPanel?.querySelector(':scope > .profile-v3-grid');
    if (!source || !target) return false;
    const card = [...source.children].find(node => node.querySelector?.('h3')?.textContent.trim() === title);
    if (!card || card.parentElement === target) return false;
    target.appendChild(card);
    return true;
  }

  function reorderTabs(tabs, order) {
    const current = [...tabs.querySelectorAll(':scope > [data-profile-tab]')];
    const rank = new Map(order.map((id,index) => [id,index]));
    const desired = [...current].sort((a,b) => (rank.get(a.dataset.profileTab) ?? 999) - (rank.get(b.dataset.profileTab) ?? 999));
    if (current.length === desired.length && current.every((node,index) => node === desired[index])) return false;
    const fragment = document.createDocumentFragment();
    desired.forEach(node => fragment.appendChild(node));
    tabs.appendChild(fragment);
    return true;
  }

  function organize() {
    if (organizing) return;
    const host = shell();
    const tabs = host?.querySelector('.profile-v3-tabs');
    const identity = host?.querySelector('[data-profile-panel="identity"]');
    const appearance = host?.querySelector('[data-profile-panel="appearance"]');
    if (!host || !tabs || !identity || !appearance) return;

    organizing = true;
    observer?.disconnect();
    try {
      const activeBefore = tabs.querySelector('.profile-v3-tab.active')?.dataset.profileTab || 'identity';
      const media = ensurePanel(host,'media');
      const cosmetics = ensurePanel(host,'cosmetics');
      const privacy = ensurePanel(host,'privacy');

      moveCard(identity, media, 'Foto de perfil');
      moveCard(identity, privacy, 'Privacidade social');
      moveCard(appearance, media, 'Fundo do perfil');
      moveCard(appearance, cosmetics, 'Itens equipados');

      ensureTab(tabs,'media','Mídia');
      ensureTab(tabs,'cosmetics','Cosméticos');
      ensureTab(tabs,'privacy','Privacidade');

      const appearanceTab = tabs.querySelector('[data-profile-tab="appearance"]');
      if (appearanceTab && appearanceTab.textContent !== 'Visual') appearanceTab.textContent = 'Visual';
      tabs.setAttribute('role','tablist');

      reorderTabs(tabs,['identity','media','appearance','cosmetics','design','privacy','store']);

      const validActive = host.querySelector(`[data-profile-tab="${CSS.escape(activeBefore)}"]`) && host.querySelector(`[data-profile-panel="${CSS.escape(activeBefore)}"]`)
        ? activeBefore
        : 'identity';
      activate(validActive);
    } finally {
      organizing = false;
      observe();
    }
  }

  function schedule() {
    if (scheduled || organizing) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      organize();
    });
  }

  function observe() {
    if (!observer) observer = new MutationObserver(records => {
      // Only react to structural changes. Attribute/class changes from motion
      // effects or active tabs must never trigger a new organization pass.
      if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedule();
    });
    try { observer.observe(root, { childList:true, subtree:true }); } catch {}
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-profile-tab]');
    if (!button || !document.querySelector('.profile-v3-shell')?.contains(button)) return;
    event.preventDefault();
    activate(button.dataset.profileTab);
  }, true);

  document.addEventListener('keydown', event => {
    const button = event.target.closest?.('[data-profile-tab]');
    if (!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const host = shell();
    const tabs = [...(host?.querySelectorAll('[data-profile-tab]') || [])];
    const index = tabs.indexOf(button);
    if (index < 0 || !tabs.length) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    activate(tabs[next].dataset.profileTab, { focus:true });
  });

  observe();
  schedule();
  [120,400,900,1800].forEach(delay => setTimeout(schedule,delay));
})();
