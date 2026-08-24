(() => {
  if (window.__SKYNET_PANEL_MINI_PODIUM_V1__) return;
  window.__SKYNET_PANEL_MINI_PODIUM_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/painel') !== '/painel') return;
  const S = window.SkyNet;
  if (!S) return;

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
      .panel-mini-podium{margin-top:18px}.panel-mini-podium-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:11px}.panel-mini-podium-head h2{margin:0;font-size:15px}.panel-mini-podium-head p{margin:4px 0 0;font-size:10px;color:var(--text-muted)}.panel-mini-podium-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:760px}.panel-mini-podium-card{--profile-accent:#a855f7;aspect-ratio:3/4;position:relative;isolation:isolate;overflow:hidden;border:1px solid rgba(139,92,246,.18);border-radius:17px;background:#0d0916;color:inherit;text-decoration:none;box-shadow:0 12px 28px rgba(0,0,0,.14);min-width:0}.panel-mini-podium-card.place-1{transform:translateY(-5px);border-color:color-mix(in srgb,var(--profile-accent) 45%,rgba(139,92,246,.25));box-shadow:0 16px 34px rgba(0,0,0,.2),0 0 22px color-mix(in srgb,var(--profile-accent) 10%,transparent)}.panel-mini-bg{position:absolute!important;inset:0;z-index:0!important;background:radial-gradient(circle at 22% 12%,color-mix(in srgb,var(--profile-accent) 28%,transparent),transparent 42%),linear-gradient(150deg,#211337,#08060e)}.panel-mini-bg img{width:100%;height:100%;object-fit:cover;opacity:.56}.panel-mini-shade{position:absolute!important;inset:0;z-index:1!important;background:linear-gradient(to top,rgba(5,3,9,.98),rgba(5,3,9,.58) 52%,rgba(5,3,9,.1))}.panel-mini-rank{position:absolute!important;z-index:5!important;top:9px;left:9px;min-width:29px;height:24px;padding:0 7px;display:grid;place-items:center;border-radius:999px;background:rgba(5,3,10,.58);border:1px solid rgba(255,255,255,.13);font:800 9px 'JetBrains Mono',monospace}.panel-mini-content{position:absolute!important;z-index:4!important;left:0;right:0;bottom:0;padding:11px}.panel-mini-person{display:flex;align-items:end;gap:8px}.panel-mini-person .cosmetic-avatar{width:45px;height:45px;border-radius:14px;padding:3px}.panel-mini-person .cosmetic-avatar-inner{border-radius:11px}.panel-mini-copy{min-width:0;flex:1}.panel-mini-name{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.panel-mini-user{font-size:8px;color:#a99bb9;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.panel-mini-tags{margin-top:5px;gap:4px}.panel-mini-tags .profile-tag{font-size:6.8px!important;min-height:17px!important;padding:2px 5px!important}.panel-mini-metrics{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px}.panel-mini-metric{padding:5px 6px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(5,3,9,.48)}.panel-mini-metric strong,.panel-mini-metric span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.panel-mini-metric strong{font-size:9px}.panel-mini-metric span{font-size:6px;color:#897b9a;text-transform:uppercase;letter-spacing:.05em;margin-top:1px}.panel-mini-podium-empty{padding:16px;border:1px dashed var(--border);border-radius:14px;color:var(--text-muted);font-size:11px}
      @media(hover:hover) and (pointer:fine){.panel-mini-podium-card{transition:transform .16s ease,border-color .16s ease}.panel-mini-podium-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--profile-accent) 42%,rgba(139,92,246,.18))}.panel-mini-podium-card.place-1:hover{transform:translateY(-7px)}}
      @media(max-width:700px){.panel-mini-podium-grid{display:grid;grid-auto-flow:column;grid-auto-columns:165px;grid-template-columns:none;overflow-x:auto;scroll-snap-type:x mandatory;padding:7px 2px 8px;max-width:none}.panel-mini-podium-card{scroll-snap-align:start}.panel-mini-podium-card.place-1{transform:none}.panel-mini-podium{margin-top:14px}}
      @media(max-width:390px){.panel-mini-podium-grid{grid-auto-columns:152px}.panel-mini-content{padding:9px}.panel-mini-person .cosmetic-avatar{width:41px;height:41px}}
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

  function metric(value, label) {
    return `<div class="panel-mini-metric"><strong>${Number(value || 0).toLocaleString('pt-BR')}</strong><span>${S.escapeHtml(label)}</span></div>`;
  }

  function card(user) {
    const accent = /^#[0-9a-f]{6}$/i.test(user.accent || '') ? user.accent : '#a855f7';
    return `<a class="panel-mini-podium-card place-${Number(user.place || 0)} profile-surface" data-decoration="${S.escapeHtml(user.cosmetics?.decoration?.id || '')}" href="/u/${encodeURIComponent(user.username)}" style="--profile-accent:${S.escapeHtml(accent)}"><div class="panel-mini-bg">${user.bannerUrl ? `<img src="${S.escapeHtml(user.bannerUrl)}" alt="">` : ''}</div><div class="panel-mini-shade"></div><div class="panel-mini-rank">#${Number(user.place || 0)}</div><div class="panel-mini-content"><div class="panel-mini-person">${avatar(user)}<div class="panel-mini-copy"><div class="panel-mini-name">${S.escapeHtml(user.displayName || user.username)}</div><div class="panel-mini-user">@${S.escapeHtml(user.username)}</div>${tags(user)}</div></div><div class="panel-mini-metrics">${metric(user.xp,'XP')}${metric(user.level,'Level')}${metric(user.requests,'Requests')}${metric(user.friendCount,'Amigos')}</div></div></a>`;
  }

  async function install() {
    const stats = document.getElementById('overviewStats');
    const content = document.getElementById('workspaceContent');
    if (!stats || !content || document.getElementById('panelMiniPodium')) return false;
    const section = document.createElement('section');
    section.id = 'panelMiniPodium';
    section.className = 'workspace-card panel-mini-podium';
    section.innerHTML = `<div class="panel-mini-podium-head"><div><h2>Pódio da comunidade</h2><p>Top 3 por XP, em uma versão compacta.</p></div><a class="button small" href="/#podiumRoot">Ver ranking</a></div><div id="panelMiniPodiumBody"><div class="panel-mini-podium-empty">Carregando pódio...</div></div>`;
    stats.insertAdjacentElement('afterend', section);
    try {
      const data = await S.api('/api/profile-v3/leaderboard?limit=3');
      const top = data.leaderboard || [];
      const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
      document.getElementById('panelMiniPodiumBody').innerHTML = order.length ? `<div class="panel-mini-podium-grid">${order.map(card).join('')}</div>` : '<div class="panel-mini-podium-empty">Ainda não há participantes suficientes no pódio.</div>';
    } catch {
      document.getElementById('panelMiniPodiumBody').innerHTML = '<div class="panel-mini-podium-empty">Não foi possível carregar o pódio.</div>';
    }
    return true;
  }

  ensureCosmeticsCss();
  style();
  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(() => observer.disconnect(),12000);
  }
})();