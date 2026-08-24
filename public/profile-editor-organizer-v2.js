(() => {
  if (window.__SKYNET_PROFILE_EDITOR_ORGANIZER_V2__) return;
  window.__SKYNET_PROFILE_EDITOR_ORGANIZER_V2__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

  let scheduled = false;

  installStyles();
  schedule();

  const root = document.getElementById('workspaceContent') || document.documentElement;
  const observer = new MutationObserver(schedule);
  observer.observe(root,{childList:true,subtree:true});

  function installStyles() {
    if (document.getElementById('profileEditorOrganizerV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'profileEditorOrganizerV2Styles';
    style.textContent = `
      [data-profile-v3="1"] .profile-v3-tabs{gap:5px;padding:5px;scroll-snap-type:x proximity}
      [data-profile-v3="1"] .profile-v3-tab{min-height:39px;padding:7px 11px;font-size:11px;scroll-snap-align:start}
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="identity"]>.profile-v3-grid,
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="media"]>.profile-v3-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="identity"]>.profile-v3-grid>.profile-v3-card,
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="media"]>.profile-v3-grid>.profile-v3-card{grid-column:auto!important}
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="appearance"]>.profile-v3-grid>.profile-v3-card,
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="cosmetics"]>.profile-v3-grid>.profile-v3-card,
      [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="privacy"]>.profile-v3-grid>.profile-v3-card{grid-column:1/-1!important}
      .profile-organized-empty{padding:18px;border:1px dashed var(--border-soft);border-radius:13px;color:var(--text-faint);font-size:11px}
      @media(max-width:760px){
        [data-profile-v3="1"] .profile-v3-tabs{position:sticky;top:67px;z-index:18;background:rgba(13,8,24,.96);backdrop-filter:blur(16px);margin-left:-2px;margin-right:-2px}
        [data-profile-v3="1"] .profile-v3-tab{flex:none!important;min-width:auto!important;padding:8px 11px!important;font-size:10px!important}
        [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="identity"]>.profile-v3-grid,
        [data-profile-v3="1"] .profile-v3-panel[data-profile-panel="media"]>.profile-v3-grid{grid-template-columns:1fr!important;gap:10px}
        [data-profile-v3="1"] .profile-v3-panel>.profile-v3-grid{gap:10px!important}
      }
      @media(max-width:390px){[data-profile-v3="1"] .profile-v3-tab{padding:8px 10px!important}}
    `;
    document.head.appendChild(style);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; organize(); });
  }

  function organize() {
    const shell = document.querySelector('.profile-v3-shell');
    const tabs = shell?.querySelector('.profile-v3-tabs');
    if (!shell || !tabs) return;

    const identity = shell.querySelector('[data-profile-panel="identity"]');
    const appearance = shell.querySelector('[data-profile-panel="appearance"]');
    if (!identity || !appearance) return;

    const media = ensurePanel(shell,'media');
    const cosmetics = ensurePanel(shell,'cosmetics');
    const privacy = ensurePanel(shell,'privacy');

    moveCard(identity, media, 'Foto de perfil');
    moveCard(identity, privacy, 'Privacidade social');
    moveCard(appearance, media, 'Fundo do perfil');
    moveCard(appearance, cosmetics, 'Itens equipados');

    ensureTab(tabs,'media','Mídia');
    ensureTab(tabs,'cosmetics','Cosméticos');
    ensureTab(tabs,'privacy','Privacidade');

    const appearanceTab = tabs.querySelector('[data-profile-tab="appearance"]');
    if (appearanceTab) appearanceTab.textContent = 'Visual';

    orderTabs(tabs,['identity','media','appearance','cosmetics','design','privacy','store']);
    normalizePanel(identity);
    normalizePanel(appearance);
    normalizePanel(media);
    normalizePanel(cosmetics);
    normalizePanel(privacy);
  }

  function ensurePanel(shell,id) {
    let panel = shell.querySelector(`[data-profile-panel="${id}"]`);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'profile-v3-panel';
    panel.dataset.profilePanel = id;
    panel.innerHTML = '<div class="profile-v3-grid"></div>';
    const store = shell.querySelector('[data-profile-panel="store"]');
    shell.insertBefore(panel, store || null);
    return panel;
  }

  function ensureTab(tabs,id,label) {
    let button = tabs.querySelector(`[data-profile-tab="${id}"]`);
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-v3-tab';
    button.dataset.profileTab = id;
    button.textContent = label;
    button.addEventListener('click', () => activate(id));
    tabs.appendChild(button);
    return button;
  }

  function moveCard(fromPanel,toPanel,title) {
    const sourceGrid = fromPanel.querySelector(':scope > .profile-v3-grid');
    const targetGrid = toPanel.querySelector(':scope > .profile-v3-grid');
    if (!sourceGrid || !targetGrid) return;
    const card = [...sourceGrid.children].find(node => node.querySelector?.('h3')?.textContent.trim() === title);
    if (card && card.parentElement !== targetGrid) targetGrid.appendChild(card);
  }

  function normalizePanel(panel) {
    const grid = panel.querySelector(':scope > .profile-v3-grid');
    if (!grid) return;
    const oldEmpty = grid.querySelector('.profile-organized-empty');
    if (grid.children.length > (oldEmpty ? 1 : 0)) oldEmpty?.remove();
  }

  function orderTabs(tabs,order) {
    for (const id of order) {
      const button = tabs.querySelector(`[data-profile-tab="${id}"]`);
      if (button) tabs.appendChild(button);
    }
  }

  function activate(id) {
    document.querySelectorAll('[data-profile-tab]').forEach(button => button.classList.toggle('active',button.dataset.profileTab === id));
    document.querySelectorAll('[data-profile-panel]').forEach(panel => panel.classList.toggle('active',panel.dataset.profilePanel === id));
  }
})();