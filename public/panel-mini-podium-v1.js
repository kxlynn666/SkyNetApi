(() => {
  if (window.__SKYNET_PANEL_MINI_PODIUM_V1__) return;
  window.__SKYNET_PANEL_MINI_PODIUM_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/painel') !== '/painel') return;
  const S = window.SkyNet;
  if (!S) return;

  let cachedEntries = null;
  let cachedMe = null;
  let loading = null;
  let scheduled = false;

  function ensureCosmeticsCss() {
    if (document.querySelector('link[href="/profile-cosmetics.css"],link[data-profile-cosmetics]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/profile-cosmetics.css';
    link.dataset.profileCosmetics = '1';
    document.head.appendChild(link);
  }

  function style() {
    if (document.getElementById('panelMiniPodiumV1Styles')) return;
    const el = document.createElement('style');
    el.id = 'panelMiniPodiumV1Styles';
    el.textContent = `
      #panelMiniPodium{display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;max-width:100%!important;min-width:0!important}
      .panel-mini-podium{margin-top:16px}.panel-mini-podium-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:11px}.panel-mini-podium-head h2{margin:0;font-size:15px}.panel-mini-podium-head p{margin:4px 0 0;font-size:10px;color:var(--text-muted)}.panel-mini-podium-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.panel-mini-self{padding:6px 9px;border:1px solid rgba(34,211,238,.18);border-radius:999px;background:rgba(34,211,238,.05);font:800 8px 'JetBrains Mono',monospace;color:#a5f3fc}.panel-mini-podium-grid{display:grid;grid-template-columns:repeat(3,minmax(0,182px));gap:9px;max-width:590px;min-width:0}.panel-mini-podium-card{--profile-accent:#a855f7;aspect-ratio:3/4;position:relative;isolation:isolate;overflow:hidden;border:1px solid rgba(139,92,246,.18);border-radius:16px;background:#0d0916;color:inherit;text-decoration:none;box-shadow:0 12px 28px rgba(0,0,0,.14);min-width:0}.panel-mini-podium-card.place-1{transform:translateY(-4px);border-color:color-mix(in srgb,var(--profile-accent) 45%,rgba(139,92,246,.25));box-shadow:0 16px 34px rgba(0,0,0,.2),0 0 22px color-mix(in srgb,var(--profile-accent) 10%,transparent)}.panel-mini-bg{position:absolute!important;inset:0;z-index:0!important;background:radial-gradient(circle at 22% 12%,color-mix(in srgb,var(--profile-accent) 28%,transparent),transparent 42%),linear-gradient(150deg,#211337,#08060e)}.panel-mini-bg img{width:100%;height:100%;object-fit:cover;opacity:.56}.panel-mini-shade{position:absolute!important;inset:0;z-index:1!important;background:linear-gradient(to top,rgba(5,3,9,.98),rgba(5,3,9,.58) 52%,rgba(5,3,9,.1))}.panel-mini-rank{position:absolute!important;z-index:5!important;top:8px;left:8px;min-width:28px;height:23px;padding:0 7px;display:grid;place-items:center;border-radius:999px;background:rgba(5,3,10,.6);border:1px solid rgba(255,255,255,.13);font:800 8px 'JetBrains Mono',monospace}.panel-mini-content{position:absolute!important;z-index:4!important;left:0;right:0;bottom:0;padding:10px}.panel-mini-person{display:flex;align-items:end;gap:7px}.panel-mini-person .cosmetic-avatar{width:42px;height:42px;border-radius:13px;padding:3px}.panel-mini-person .cosmetic-avatar-inner{border-radius:10px}.panel-mini-copy{min-width:0;flex:1}.panel-mini-name{font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.panel-mini-user{font-size:7.5px;color:#a99bb9;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.panel-mini-tags{margin-top:4px;gap:3px}.panel-mini-tags .profile-tag{font-size:6.4px!important;min-height:16px!important;padding:2px 5px!important}.panel-mini-metrics{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:7px}.panel-mini-metric{padding:5px 6px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(5,3,9,.48)}.panel-mini-metric strong,.panel-mini-metric span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.panel-mini-metric strong{font-size:8.7px}.panel-mini-metric span{font-size:5.8px;color:#897b9a;text-transform:uppercase;letter-spacing:.05em;margin-top:1px}.panel-mini-podium-empty{padding:16px;border:1px dashed var(--border);border-radius:14px;color:var(--text-muted);font-size:11px}
      @media(hover:hover) and (pointer:fine){.panel-mini-podium-card{transition:transform .16s ease,border-color .16s ease}.panel-mini-podium-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--profile-accent) 42%,rgba(139,92,246,.18))}.panel-mini-podium-card.place-1:hover{transform:translateY(-6px)}}
      @media(max-width:700px){
        #panelMiniPodium,.panel-mini-podium,#panelMiniPodiumBody{display:block!important;visibility:visible!important;opacity:1!important}
        .panel-mini-podium{margin-top:13px!important;padding:13px!important;overflow:visible!important}
        .panel-mini-podium-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:start!important;gap:8px!important;margin-bottom:9px!important}
        .panel-mini-podium-head p{font-size:9px!important;max-width:34ch}.panel-mini-podium-meta{justify-content:flex-end!important}.panel-mini-podium-meta .button{display:none!important}.panel-mini-self{font-size:7px;white-space:nowrap}
        .panel-mini-podium-grid{display:grid!important;grid-auto-flow:column!important;grid-auto-columns:144px!important;grid-template-columns:none!important;width:calc(100% + 4px)!important;max-width:none!important;min-height:192px!important;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x mandatory;padding:6px 2px 10px!important;overscroll-behavior-inline:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none}
        .panel-mini-podium-grid::-webkit-scrollbar{display:none}.panel-mini-podium-card{display:block!important;visibility:visible!important;opacity:1!important;scroll-snap-align:start;min-width:144px!important;width:144px!important}.panel-mini-podium-card.place-1{transform:none}
      }
      @media(max-width:390px){.panel-mini-podium{padding:11px!important}.panel-mini-podium-grid{grid-auto-columns:136px!important;min-height:181px!important}.panel-mini-podium-card{min-width:136px!important;width:136px!important}.panel-mini-content{padding:8px}.panel-mini-person .cosmetic-avatar{width:39px;height:39px}.panel-mini-podium-head{grid-template-columns:1fr}.panel-mini-podium-meta{justify-content:flex-start!important}}
    `;
    document.head.appendChild(el);
  }

  function avatar(user) {
    const initial = String(user.displayName || user.username || '?').slice(0,1).toUpperCase();
    const frame = user.cosmetics?.frame?.id || '';
    return `<div class="cosmetic-avatar" data-frame="${S.escapeHtml(frame)}"><div class="cosmetic-avatar-inner">${user.avatarUrl ? `<img src="${S.escapeHtml(user.avatarUrl)}" alt="">` : S.escapeHtml(initial)}</div></div>`;
  }

  function tags(user) {
    const list = user.cosmetics?.tags || [];
    if (!list.length) return '';
    return `<div class="profile-tags panel-mini-tags">${list.slice(0,2).map(tag => `<span class="profile-tag" style="--tag-a:${S.escapeHtml(tag.colors?.[0] || '#7c3aed')};--tag-b:${S.escapeHtml(tag.colors?.[1] || '#a78bfa')}">${S.escapeHtml(tag.name)}</span>`).join('')}</div>`;
  }

  function metric(value,label){return `<div class="panel-mini-metric"><strong>${Number(value||0).toLocaleString('pt-BR')}</strong><span>${S.escapeHtml(label)}</span></div>`}

  function card(user) {
    const accent = /^#[0-9a-f]{6}$/i.test(user.accent || '') ? user.accent : '#a855f7';
    return `<a class="panel-mini-podium-card place-${Number(user.place || 0)} profile-surface" data-decoration="${S.escapeHtml(user.cosmetics?.decoration?.id || '')}" href="/u/${encodeURIComponent(user.username)}" style="--profile-accent:${S.escapeHtml(accent)}"><div class="panel-mini-bg">${user.bannerUrl ? `<img src="${S.escapeHtml(user.bannerUrl)}" alt="">` : ''}</div><div class="panel-mini-shade"></div><div class="panel-mini-rank">#${Number(user.place || 0)}</div><div class="panel-mini-content"><div class="panel-mini-person">${avatar(user)}<div class="panel-mini-copy"><div class="panel-mini-name">${S.escapeHtml(user.displayName || user.username)}</div><div class="panel-mini-user">@${S.escapeHtml(user.username)}</div>${tags(user)}</div></div><div class="panel-mini-metrics">${metric(user.xp,'XP')}${metric(user.level,'Level')}${metric(user.requests,'Requests')}${metric(user.friendCount,'Amigos')}</div></div></a>`;
  }

  async function getData() {
    if (cachedEntries) return { entries: cachedEntries, me: cachedMe };
    if (!loading) {
      loading = Promise.all([S.api('/api/profile-v3/leaderboard?limit=50'), S.session()])
        .then(([data, me]) => {
          cachedEntries = data.leaderboard || [];
          cachedMe = me || null;
          return { entries: cachedEntries, me: cachedMe };
        })
        .finally(() => { loading = null; });
    }
    return loading;
  }

  async function render(section) {
    const body = section.querySelector('#panelMiniPodiumBody');
    if (!body) return;
    try {
      const { entries, me } = await getData();
      if (!section.isConnected) return;
      const top = entries.slice(0,3);
      const order = top.length === 3 ? [top[1],top[0],top[2]] : top;
      body.innerHTML = order.length ? `<div class="panel-mini-podium-grid">${order.map(card).join('')}</div>` : '<div class="panel-mini-podium-empty">Ainda não há participantes suficientes no pódio.</div>';
      const mine = entries.find(entry => entry.id === me?.id || String(entry.username).toLowerCase() === String(me?.username || '').toLowerCase());
      const self = section.querySelector('#panelMiniSelf');
      if (self) self.textContent = mine ? `Sua posição: #${mine.place}` : 'Fora do Top 50';
    } catch {
      if (section.isConnected) body.innerHTML = '<div class="panel-mini-podium-empty">Não foi possível carregar o pódio.</div>';
    }
  }

  function ensureInstalled() {
    if ((location.pathname.replace(/\/+$/, '') || '/painel') !== '/painel') return false;
    const stats = document.getElementById('overviewStats');
    if (!stats) return false;
    let section = document.getElementById('panelMiniPodium');
    if (!section) {
      section = document.createElement('section');
      section.id = 'panelMiniPodium';
      section.className = 'workspace-card panel-mini-podium';
      section.innerHTML = `<div class="panel-mini-podium-head"><div><h2>Pódio da comunidade</h2><p>Top 3 por XP em cartões 3:4 compactos.</p></div><div class="panel-mini-podium-meta"><span class="panel-mini-self" id="panelMiniSelf">Sua posição: —</span><a class="button small" href="/#podiumRoot">Ranking completo</a></div></div><div id="panelMiniPodiumBody"><div class="panel-mini-podium-empty">Carregando pódio...</div></div>`;
      stats.insertAdjacentElement('afterend', section);
      render(section);
    }
    return true;
  }

  function scheduleEnsure() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureInstalled();
    });
  }

  ensureCosmeticsCss();
  style();
  ensureInstalled();

  const root = document.getElementById('workspaceContent') || document.documentElement;
  const observer = new MutationObserver(records => {
    if (!records.some(record => record.addedNodes.length || record.removedNodes.length)) return;
    scheduleEnsure();
  });
  observer.observe(root, { childList:true, subtree:true });
  window.addEventListener('pageshow', scheduleEnsure);
  window.addEventListener('resize', scheduleEnsure, { passive:true });
})();