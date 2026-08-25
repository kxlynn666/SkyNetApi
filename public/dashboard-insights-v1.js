(() => {
  if (window.__SKYNET_DASHBOARD_INSIGHTS_V1__) return;
  window.__SKYNET_DASHBOARD_INSIGHTS_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/painel') !== '/painel') return;
  const S = window.SkyNet;
  if (!S) return;

  function style() {
    if (document.getElementById('dashboardInsightsV1Styles')) return;
    const el = document.createElement('style');
    el.id = 'dashboardInsightsV1Styles';
    el.textContent = `
      .dash-insights{margin-top:18px;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px}.dash-insight-card{grid-column:span 3;padding:16px;border:1px solid var(--border-soft);border-radius:12px;background:#141416;min-width:0}.dash-insight-card.wide{grid-column:span 6}.dash-insight-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.dash-insight-title{font-size:12px;font-weight:650;color:#e9e9e6}.dash-insight-icon{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;border:1px solid #2b2b30;background:#19191c;color:#aaa2df}.dash-insight-icon svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.dash-insight-value{font-size:25px;font-weight:650;line-height:1;letter-spacing:-.035em}.dash-insight-sub{font-size:10px;color:var(--text-faint);margin-top:6px;line-height:1.45}.dash-insight-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #242428;font-size:10px}.dash-insight-row:first-of-type{border-top:0}.dash-insight-row span{color:var(--text-faint)}.dash-progress{height:5px;border-radius:999px;background:#232327;overflow:hidden;margin:11px 0 4px}.dash-progress i{display:block;height:100%;border-radius:inherit;background:#9589ea}.dash-health{display:inline-flex;align-items:center;gap:7px;font-size:10px;font-weight:650;color:#d8d8d5}.dash-health i{width:7px;height:7px;border-radius:50%;background:#75b889}.dash-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px}.dash-action{display:flex;align-items:center;gap:8px;min-height:36px;padding:8px 10px;border:1px solid var(--border-soft);border-radius:8px;background:#171719;color:#aaaab0;text-decoration:none;font-size:10px;transition:.16s ease}.dash-action:hover{border-color:#39393f;background:#1c1c1f;color:#efefec;transform:translateY(-1px)}.dash-profile-check{display:grid;gap:7px;margin-top:9px}.dash-profile-item{display:flex;align-items:center;gap:8px;font-size:9px;color:var(--text-faint)}.dash-profile-item b{width:18px;height:18px;border-radius:5px;display:grid;place-items:center;background:#18221c;color:#92c6a0;font-size:10px}.dash-profile-item.missing b{background:#24191c;color:#d49aa5}.dash-recent{display:grid;gap:6px}.dash-recent-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #232327}.dash-recent-item:last-child{border-bottom:0}.dash-recent-dot{width:6px;height:6px;border-radius:50%;background:#9589ea}.dash-recent-copy{min-width:0}.dash-recent-copy strong,.dash-recent-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dash-recent-copy strong{font-size:10px;font-weight:600}.dash-recent-copy span{font-size:8px;color:var(--text-faint);margin-top:2px}.dash-recent-item time{font-size:8px;color:var(--text-faint);white-space:nowrap}
      @media(max-width:900px){.dash-insight-card{grid-column:span 6}.dash-insight-card.wide{grid-column:1/-1}}
      @media(max-width:560px){.dash-insights{grid-template-columns:1fr;gap:8px}.dash-insight-card,.dash-insight-card.wide{grid-column:1/-1;padding:14px}.dash-insight-value{font-size:22px}.dash-actions{grid-template-columns:1fr 1fr}.dash-recent-item{grid-template-columns:auto minmax(0,1fr)}.dash-recent-item time{display:none}}
    `;
    document.head.appendChild(el);
  }

  const icons = {
    wallet:'<path d="M4 7h14a2 2 0 0 1 2 2v8H6a2 2 0 0 1-2-2V7Zm0 0 3-3h9"/><circle cx="16" cy="12" r="1"/>',
    key:'<circle cx="8" cy="12" r="3"/><path d="M11 12h9M17 12v3M14 12v2"/>',
    pulse:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    spark:'<path d="m12 3 1.3 4.2L18 9l-4.7 1.8L12 15l-1.3-4.2L6 9l4.7-1.8Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  const icon = name => `<span class="dash-insight-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.spark}</svg></span>`;
  const n = value => Number(value || 0).toLocaleString('pt-BR');

  function wait() {
    const ready = () => document.getElementById('overviewStats') && document.getElementById('workspaceContent');
    if (ready()) return load();
    const root = document.getElementById('workspaceContent') || document.documentElement;
    const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); load(); } });
    observer.observe(root,{childList:true,subtree:true});
    setTimeout(() => observer.disconnect(),12000);
  }

  async function load() {
    if (document.getElementById('dashboardInsightsV1')) return;
    style();
    const results = await Promise.allSettled([
      S.api('/api/profile-store/me'),
      S.api('/api/workspace/bootstrap'),
      S.api('/api/social/me'),
      S.api('/api/community/profile/me'),
      S.api('/health')
    ]);
    const value = i => results[i].status === 'fulfilled' ? results[i].value : {};
    render(value(0),value(1),value(2),value(3),value(4));
  }

  function render(store,bootstrap,social,community,health) {
    const anchor = document.getElementById('panelMiniPodium') || document.getElementById('workspaceXpCard') || document.getElementById('overviewStats');
    if (!anchor || document.getElementById('dashboardInsightsV1')) return;
    const keySummary = bootstrap.summary?.keys || {};
    const uploadSummary = bootstrap.summary?.uploads || {};
    const generationSummary = bootstrap.summary?.generations || {};
    const wallet = store.wallet || {};
    const profile = social.account?.profile || {};
    const custom = community.custom || {};
    const checks = [
      ['Foto de perfil',Boolean(social.account?.avatarUrl)],
      ['Bio',Boolean(String(profile.bio || '').trim())],
      ['Fundo',Boolean(community.public?.bannerUrl || custom.bannerUploadId)],
      ['Frase de destaque',Boolean(String(custom.headline || '').trim())],
      ['Moldura',Boolean(store.cosmetics?.frame)],
      ['Decoração',Boolean(store.cosmetics?.decoration)]
    ];
    const complete = checks.filter(([,ok]) => ok).length;
    const percent = Math.round(complete / checks.length * 100);
    const recent = [
      ...(uploadSummary.recent || []).map(x => ({type:'Upload',name:x.originalName || x.name || 'Imagem enviada',date:x.createdAt || x.uploadedAt})),
      ...(generationSummary.recent || []).map(x => ({type:'Card',name:x.title || x.name || 'Card gerado',date:x.createdAt || x.generatedAt}))
    ].sort((a,b) => new Date(b.date || 0)-new Date(a.date || 0)).slice(0,4);

    const root = document.createElement('section');
    root.id = 'dashboardInsightsV1';
    root.className = 'dash-insights';
    root.innerHTML = `
      <article class="dash-insight-card">${head('Carteira','wallet')}<div class="dash-insight-value">${n(wallet.balance)}</div><div class="dash-insight-sub">moedas disponíveis</div><div class="dash-insight-row"><span>Ganhos</span><strong>${n(wallet.earnedCoins)}</strong></div><div class="dash-insight-row"><span>Gastos</span><strong>${n(wallet.spentCoins)}</strong></div><div class="dash-actions"><a class="dash-action" href="/painel/perfil">Abrir loja</a><a class="dash-action" href="/painel/perfil">Inventário</a></div></article>
      <article class="dash-insight-card">${head('API Keys','key')}<div class="dash-insight-value">${n(keySummary.active)}</div><div class="dash-insight-sub">chaves ativas · ${n(keySummary.requests)} requisições</div><div class="dash-insight-row"><span>Total de chaves</span><strong>${n(keySummary.total)}</strong></div><div class="dash-insight-row"><span>Última atividade</span><strong>${formatDateShort(keySummary.lastUsedAt)}</strong></div><div class="dash-actions"><a class="dash-action" href="/painel/chaves">Gerenciar</a><a class="dash-action" href="/painel/api">Documentação</a></div></article>
      <article class="dash-insight-card">${head('Sistema','pulse')}<div class="dash-health"><i></i>${health?.status === 'OK' ? 'Online' : 'Disponível'}</div><div class="dash-insight-sub">Resumo da sessão e serviços</div><div class="dash-insight-row"><span>Uploads</span><strong>${n(uploadSummary.total)}</strong></div><div class="dash-insight-row"><span>Cards</span><strong>${n(generationSummary.total)}</strong></div><div class="dash-actions"><a class="dash-action" href="/painel/uploads">Uploads</a><a class="dash-action" href="/painel/historico">Histórico</a></div></article>
      <article class="dash-insight-card">${head('Perfil','user')}<div class="dash-insight-value">${percent}%</div><div class="dash-insight-sub">personalização concluída</div><div class="dash-progress"><i style="width:${percent}%"></i></div><div class="dash-profile-check">${checks.slice(0,3).map(checkItem).join('')}</div><div class="dash-actions"><a class="dash-action" href="/painel/perfil">Personalizar</a><a class="dash-action" href="/u/${encodeURIComponent(social.account?.username || '')}">Ver público</a></div></article>
      <article class="dash-insight-card wide">${head('Atividade recente','clock')}<div class="dash-recent">${recent.length ? recent.map(recentItem).join('') : '<div class="dash-insight-sub">Sua atividade recente aparecerá aqui.</div>'}</div></article>
      <article class="dash-insight-card wide">${head('Atalhos úteis','spark')}<div class="dash-actions"><a class="dash-action" href="/painel/cards">Criar card</a><a class="dash-action" href="/painel/brat">Brat Generator</a><a class="dash-action" href="/painel/chat">Abrir chat</a><a class="dash-action" href="/painel/figurinhas">Figurinhas</a><a class="dash-action" href="/painel/media">Baixar mídia</a><a class="dash-action" href="/painel/chaves">API Keys</a></div></article>`;
    anchor.insertAdjacentElement('afterend',root);
  }

  function head(title,name){return `<div class="dash-insight-head"><div class="dash-insight-title">${S.escapeHtml(title)}</div>${icon(name)}</div>`}
  function checkItem([label,ok]){return `<div class="dash-profile-item ${ok?'':'missing'}"><b>${ok?'✓':'·'}</b><span>${S.escapeHtml(label)}</span></div>`}
  function formatDateShort(value){if(!value)return'Nunca';const date=new Date(value);return Number.isNaN(date.getTime())?'Nunca':date.toLocaleDateString('pt-BR')}
  function recentItem(item){const date=item.date?new Date(item.date):null;return `<div class="dash-recent-item"><i class="dash-recent-dot"></i><div class="dash-recent-copy"><strong>${S.escapeHtml(item.name)}</strong><span>${S.escapeHtml(item.type)}</span></div><time>${date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('pt-BR'):'—'}</time></div>`}

  wait();
})();