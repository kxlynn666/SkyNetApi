(() => {
  const S = window.SkyNet;
  const root = document.getElementById('publicProfileRoot');
  if (!S || !root) return;

  installStyles();
  load();

  async function load() {
    const parts = location.pathname.split('/').filter(Boolean);
    const username = decodeURIComponent(parts[1] || '');
    if (!username) return fail('Perfil não encontrado.');
    try {
      const data = await S.api(`/api/profile-v3/profile/${encodeURIComponent(username)}`);
      const p = data.profile;
      if (!p) throw new Error('Perfil não encontrado.');
      render(p);
    } catch (error) {
      fail(error.message || 'Perfil não encontrado.');
    }
  }

  function render(p) {
    const d = normalizedStudio(p.studio || {});
    const cosmetics = p.cosmetics || {};
    const frame = d.showCosmetics ? cosmetics.frame?.id || '' : '';
    const decoration = d.showCosmetics ? cosmetics.decoration?.id || '' : '';
    const initial = String(p.displayName || p.username || '?').slice(0, 1).toUpperCase();
    const sections = {
      identity: identitySection(p, d, initial, frame, cosmetics),
      status: d.showStatus && p.status ? `<div class="public-status-studio">${esc(p.status)}</div>` : '',
      bio: d.showBio ? `<div class="public-bio-studio">${esc(p.bio || 'Sem bio pública.')}</div>` : '',
      links: d.showLinks ? linksSection(p, d) : '',
      stats: d.showStats ? statsSection(p.stats || {}) : '',
      join: d.showJoinDate && p.createdAt ? `<div class="public-join-studio">Membro desde ${esc(formatDateOnly(p.createdAt))}</div>` : ''
    };

    document.title = `${p.displayName || p.username} - SkyNetApi`;
    document.documentElement.style.setProperty('background', d.backgroundMode === 'solid' ? d.pageBackground : `linear-gradient(${d.gradientAngle}deg,${d.gradientFrom},${d.gradientTo})`);
    document.body.dataset.publicProfileStudio = '1';

    root.innerHTML = `<article class="public-profile-studio profile-surface" data-decoration="${esc(decoration)}" data-button-style="${esc(d.buttonStyle)}" data-badge-style="${esc(d.badgeStyle)}" data-stats-style="${esc(d.statsStyle)}" data-link-style="${esc(d.linkStyle)}" data-motion="${esc(d.motionLevel)}" style="${studioStyle(d)}">
      <div class="public-banner-studio">${p.bannerUrl ? `<img src="${esc(p.bannerUrl)}" alt="Banner de ${esc(p.displayName || p.username)}">` : ''}</div>
      <div class="public-body-studio">
        ${d.sectionOrder.map(id => sections[id] || '').join('')}
        ${d.showActions ? `<div class="public-actions-studio"><a class="public-action primary" href="/painel/amigos">Área social</a><a class="public-action" href="/">SkyNetApi</a></div>` : ''}
      </div>
    </article>`;
  }

  function identitySection(p, d, initial, frame, cosmetics) {
    const meta = [];
    if (d.showPronouns && p.pronouns) meta.push(`<span>${esc(p.pronouns)}</span>`);
    if (d.showLocation && p.location) meta.push(`<span>⌖ ${esc(p.location)}</span>`);
    return `<div class="public-identity-studio">
      ${avatar(p.avatarUrl, initial, frame)}
      <div class="public-copy-studio">
        <h1>${esc(p.displayName || p.username)}</h1>
        ${d.showHandle ? `<div class="public-handle-studio">@${esc(p.username)}</div>` : ''}
        ${meta.length ? `<div class="public-meta-studio">${meta.join('')}</div>` : ''}
        ${d.showHeadline && p.headline ? `<div class="public-headline-studio">${esc(p.headline)}</div>` : ''}
        ${d.showCosmetics ? tags(cosmetics.tags || []) : ''}
      </div>
    </div>`;
  }

  function linksSection(p, d) {
    const entries = [];
    if (p.website) entries.push({ label: 'Website', url: p.website });
    for (const item of Array.isArray(p.links) ? p.links : []) entries.push(item);
    const safe = entries.map(item => ({ label: String(item?.label || '').trim(), url: safeHttpUrl(item?.url) })).filter(item => item.url).slice(0, 7);
    if (!safe.length) return '';
    return `<div class="public-links-studio">${safe.map(item => `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label || hostLabel(item.url))}</a>`).join('')}</div>`;
  }

  function statsSection(stats) {
    const rows = [
      [stats.xp, 'XP'],
      [stats.level, 'Level'],
      [stats.requests, 'Requests'],
      [stats.friends, 'Amigos'],
      [stats.cards, 'Cards'],
      [stats.uploads, 'Uploads']
    ];
    return `<div class="public-stats-studio">${rows.map(([value, label]) => stat(value, label)).join('')}</div>`;
  }

  function avatar(url, initial, frame) {
    return `<div class="cosmetic-avatar public-avatar-studio" data-frame="${esc(frame)}"><div class="cosmetic-avatar-inner">${url ? `<img src="${esc(url)}" alt="Avatar">` : esc(initial)}</div></div>`;
  }

  function tags(items) {
    if (!items.length) return '';
    return `<div class="profile-tags public-tags-studio">${items.map(tag => `<span class="profile-tag" style="--tag-a:${safeColor(tag.colors?.[0], '#7c9cff')};--tag-b:${safeColor(tag.colors?.[1], '#79d8ca')}">${esc(tag.name)}</span>`).join('')}</div>`;
  }

  function stat(value, label) {
    const text = value === null || value === undefined ? '—' : Number(value).toLocaleString('pt-BR');
    return `<div class="public-stat-studio"><strong>${esc(text)}</strong><span>${esc(label)}</span></div>`;
  }

  function normalizedStudio(input) {
    const defaults = {
      profileWidth: 980, bannerHeight: 248, avatarSize: 124, avatarOffset: -52, contentPadding: 28, sectionGap: 20, statsColumns: 6,
      surfaceRadius: 22, surfaceOpacity: 96, surfaceBlur: 12, borderWidth: 1, shadowStrength: 24, bannerOverlay: 46,
      avatarBorderWidth: 4, bannerSaturation: 100, bannerContrast: 100, hoverLift: 3, glowStrength: 10, gradientAngle: 145,
      nameSize: 32, bodySize: 14, letterSpacing: 0, pageBackground: '#090b10', surfaceColor: '#111722', surfaceAltColor: '#161d29',
      textColor: '#f4f7fb', mutedColor: '#9ca8b8', accentColor: '#7c9cff', accentSecondary: '#79d8ca', borderColor: '#273244',
      avatarBorderColor: '#0b0e14', gradientFrom: '#111827', gradientTo: '#0b1220', bannerTintColor: '#080b12', fontFamily: 'system',
      textAlign: 'left', avatarShape: 'rounded', buttonStyle: 'soft', badgeStyle: 'minimal', statsStyle: 'cards', linkStyle: 'buttons',
      motionLevel: 'system', backgroundMode: 'gradient', bannerFocus: 'center', nameWeight: '750', showHandle: true, showStatus: true,
      showBio: true, showLinks: true, showStats: true, showJoinDate: true, showLocation: true, showPronouns: true, showHeadline: true,
      showCosmetics: true, showActions: true, sectionOrder: ['identity', 'status', 'bio', 'links', 'stats', 'join']
    };
    return { ...defaults, ...(input && typeof input === 'object' ? input : {}), sectionOrder: Array.isArray(input?.sectionOrder) ? input.sectionOrder : defaults.sectionOrder };
  }

  function studioStyle(d) {
    const vars = {
      '--ps-width': `${number(d.profileWidth, 680, 1200, 980)}px`,
      '--ps-banner': `${number(d.bannerHeight, 140, 420, 248)}px`,
      '--ps-avatar': `${number(d.avatarSize, 72, 180, 124)}px`,
      '--ps-avatar-offset': `${number(d.avatarOffset, -96, 0, -52)}px`,
      '--ps-pad': `${number(d.contentPadding, 12, 48, 28)}px`,
      '--ps-gap': `${number(d.sectionGap, 8, 40, 20)}px`,
      '--ps-cols': number(d.statsColumns, 2, 6, 6),
      '--ps-radius': `${number(d.surfaceRadius, 0, 36, 22)}px`,
      '--ps-opacity': number(d.surfaceOpacity, 70, 100, 96) / 100,
      '--ps-blur': `${number(d.surfaceBlur, 0, 30, 12)}px`,
      '--ps-border-w': `${number(d.borderWidth, 0, 3, 1)}px`,
      '--ps-shadow': number(d.shadowStrength, 0, 60, 24) / 100,
      '--ps-overlay': number(d.bannerOverlay, 0, 90, 46) / 100,
      '--ps-avatar-border': `${number(d.avatarBorderWidth, 0, 8, 4)}px`,
      '--ps-sat': `${number(d.bannerSaturation, 0, 160, 100)}%`,
      '--ps-contrast': `${number(d.bannerContrast, 60, 140, 100)}%`,
      '--ps-lift': `${number(d.hoverLift, 0, 12, 3)}px`,
      '--ps-glow': number(d.glowStrength, 0, 40, 10) / 100,
      '--ps-name': `${number(d.nameSize, 20, 48, 32)}px`,
      '--ps-body': `${number(d.bodySize, 12, 18, 14)}px`,
      '--ps-letter': `${number(d.letterSpacing, -1, 3, 0)}px`,
      '--ps-page': safeColor(d.pageBackground, '#090b10'),
      '--ps-surface': safeColor(d.surfaceColor, '#111722'),
      '--ps-surface-alt': safeColor(d.surfaceAltColor, '#161d29'),
      '--ps-text': safeColor(d.textColor, '#f4f7fb'),
      '--ps-muted': safeColor(d.mutedColor, '#9ca8b8'),
      '--ps-accent': safeColor(d.accentColor, '#7c9cff'),
      '--ps-accent2': safeColor(d.accentSecondary, '#79d8ca'),
      '--ps-border': safeColor(d.borderColor, '#273244'),
      '--ps-avatar-border-color': safeColor(d.avatarBorderColor, '#0b0e14'),
      '--ps-grad-from': safeColor(d.gradientFrom, '#111827'),
      '--ps-grad-to': safeColor(d.gradientTo, '#0b1220'),
      '--ps-tint': safeColor(d.bannerTintColor, '#080b12'),
      '--ps-angle': `${number(d.gradientAngle, 0, 360, 145)}deg`,
      '--ps-weight': allowed(d.nameWeight, ['500','600','700','750','800','900'], '750'),
      '--ps-align': allowed(d.textAlign, ['left','center'], 'left'),
      '--ps-banner-focus': allowed(d.bannerFocus, ['center','top','bottom','left','right'], 'center'),
      '--ps-font': fontStack(d.fontFamily),
      '--ps-avatar-radius': avatarRadius(d.avatarShape),
      '--ps-bg': d.backgroundMode === 'solid' ? safeColor(d.pageBackground, '#090b10') : `linear-gradient(${number(d.gradientAngle,0,360,145)}deg,${safeColor(d.gradientFrom,'#111827')},${safeColor(d.gradientTo,'#0b1220')})`
    };
    return Object.entries(vars).map(([key, value]) => `${key}:${value}`).join(';');
  }

  function fontStack(value) {
    return ({ system: 'Inter,system-ui,sans-serif', rounded: 'Nunito,Inter,system-ui,sans-serif', mono: 'ui-monospace,SFMono-Regular,Menlo,monospace', serif: 'Georgia,serif', display: 'Inter,system-ui,sans-serif' })[value] || 'Inter,system-ui,sans-serif';
  }

  function avatarRadius(value) {
    return ({ circle: '50%', rounded: '24%', squircle: '32%', square: '4%' })[value] || '24%';
  }

  function number(value, min, max, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  }

  function allowed(value, list, fallback) {
    const text = String(value || '').toLowerCase();
    return list.includes(text) ? text : fallback;
  }

  function safeColor(value, fallback) {
    const text = String(value || '').toLowerCase();
    return /^#[0-9a-f]{6}$/.test(text) ? text : fallback;
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      url.username = '';
      url.password = '';
      return url.toString();
    } catch { return ''; }
  }

  function hostLabel(value) {
    try { return new URL(value).hostname.replace(/^www\./, ''); }
    catch { return 'Link'; }
  }

  function formatDateOnly(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }

  function esc(value) { return S.escapeHtml(value == null ? '' : String(value)); }
  function fail(message) { root.innerHTML = `<div class="message show error">${esc(message)}</div>`; }

  function installStyles() {
    if (document.getElementById('publicProfileStudioStyles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileStudioStyles';
    style.textContent = `
      html,body{min-height:100%;background:#090b10}body[data-public-profile-studio="1"]{background:var(--ps-page,#090b10)}#publicProfileRoot{padding:0!important;background:transparent!important;border:0!important;max-width:none!important}.page{max-width:1240px!important}.public-profile-studio{width:min(100%,var(--ps-width));margin:28px auto 0;color:var(--ps-text);font-family:var(--ps-font);font-size:var(--ps-body);letter-spacing:var(--ps-letter);border:var(--ps-border-w) solid var(--ps-border);border-radius:var(--ps-radius);overflow:hidden;background:var(--ps-bg);box-shadow:0 28px 84px rgba(0,0,0,var(--ps-shadow)),0 0 46px color-mix(in srgb,var(--ps-accent) calc(var(--ps-glow) * 100%),transparent);transition:transform .2s ease,box-shadow .2s ease}.public-profile-studio:hover{transform:translateY(calc(var(--ps-lift) * -1))}.public-banner-studio{height:var(--ps-banner);position:relative;background:linear-gradient(var(--ps-angle),var(--ps-grad-from),var(--ps-grad-to));overflow:hidden}.public-banner-studio img{width:100%;height:100%;display:block;object-fit:cover;object-position:var(--ps-banner-focus);filter:saturate(var(--ps-sat)) contrast(var(--ps-contrast))}.public-banner-studio:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,color-mix(in srgb,var(--ps-tint) calc(var(--ps-overlay) * 100%),transparent),transparent 72%)}.public-body-studio{display:grid;gap:var(--ps-gap);padding:0 var(--ps-pad) var(--ps-pad);text-align:var(--ps-align);background:color-mix(in srgb,var(--ps-surface) calc(var(--ps-opacity) * 100%),transparent);backdrop-filter:blur(var(--ps-blur));-webkit-backdrop-filter:blur(var(--ps-blur))}.public-identity-studio{display:flex;align-items:flex-end;gap:18px;margin-top:var(--ps-avatar-offset);position:relative;z-index:2}.public-avatar-studio{width:var(--ps-avatar)!important;height:var(--ps-avatar)!important;flex:0 0 auto;border-radius:var(--ps-avatar-radius)!important;background:var(--ps-surface-alt)!important;border:var(--ps-avatar-border) solid var(--ps-avatar-border-color)!important}.public-avatar-studio .cosmetic-avatar-inner{border-radius:calc(var(--ps-avatar-radius) - 3px)!important}.public-copy-studio{min-width:0;flex:1;padding-bottom:5px}.public-copy-studio h1{margin:0;font-size:var(--ps-name);font-weight:var(--ps-weight);line-height:1.03;color:var(--ps-text);overflow-wrap:anywhere}.public-handle-studio,.public-headline-studio,.public-meta-studio{color:var(--ps-muted)}.public-handle-studio{margin-top:4px;font-size:.86em}.public-meta-studio{display:flex;gap:7px;flex-wrap:wrap;margin-top:6px;font-size:.73em}.public-meta-studio span{padding:4px 7px;border:1px solid var(--ps-border);border-radius:999px;background:var(--ps-surface-alt)}.public-headline-studio{margin-top:7px;line-height:1.45}.public-tags-studio{margin-top:9px}.public-status-studio{width:max-content;max-width:100%;padding:6px 10px;border:1px solid color-mix(in srgb,var(--ps-accent) 35%,var(--ps-border));border-radius:999px;background:color-mix(in srgb,var(--ps-accent) 9%,transparent);color:var(--ps-text);font-size:.84em}.public-bio-studio{max-width:820px;line-height:1.7;color:var(--ps-muted);white-space:pre-wrap;overflow-wrap:anywhere}.public-links-studio{display:flex;gap:8px;flex-wrap:wrap}.public-links-studio a{color:var(--ps-text);text-decoration:none;padding:8px 11px;border:1px solid var(--ps-border);border-radius:10px;background:var(--ps-surface-alt);font-size:.78em;transition:transform .15s ease,border-color .15s ease}.public-links-studio a:hover{transform:translateY(-1px);border-color:var(--ps-accent)}.public-profile-studio[data-link-style="list"] .public-links-studio{display:grid}.public-profile-studio[data-link-style="list"] .public-links-studio a{border-radius:4px;background:transparent;border-width:0 0 1px;padding:8px 0}.public-profile-studio[data-link-style="chips"] .public-links-studio a{border-radius:999px}.public-stats-studio{display:grid;grid-template-columns:repeat(var(--ps-cols),minmax(0,1fr));gap:8px}.public-stat-studio{padding:11px;border:1px solid var(--ps-border);border-radius:11px;background:var(--ps-surface-alt);min-width:0}.public-stat-studio strong,.public-stat-studio span{display:block}.public-stat-studio strong{font-size:1.05em;overflow:hidden;text-overflow:ellipsis}.public-stat-studio span{margin-top:3px;color:var(--ps-muted);font-size:.6em;text-transform:uppercase;letter-spacing:.06em}.public-profile-studio[data-stats-style="minimal"] .public-stat-studio{border:0;background:transparent;padding:7px 0}.public-profile-studio[data-stats-style="divider"] .public-stats-studio{gap:0}.public-profile-studio[data-stats-style="divider"] .public-stat-studio{border:0;border-right:1px solid var(--ps-border);border-radius:0;background:transparent}.public-profile-studio[data-stats-style="divider"] .public-stat-studio:last-child{border-right:0}.public-actions-studio{display:flex;gap:8px;flex-wrap:wrap}.public-action{display:inline-flex;justify-content:center;align-items:center;min-height:38px;padding:8px 12px;border-radius:10px;border:1px solid var(--ps-border);background:var(--ps-surface-alt);color:var(--ps-text);font-weight:700;font-size:.78em;text-decoration:none}.public-action.primary{background:var(--ps-accent);border-color:var(--ps-accent);color:#081018}.public-profile-studio[data-button-style="outline"] .public-action{background:transparent}.public-profile-studio[data-button-style="minimal"] .public-action{background:transparent;border-color:transparent;padding-left:3px;padding-right:3px}.public-profile-studio[data-button-style="soft"] .public-action.primary{background:color-mix(in srgb,var(--ps-accent) 18%,var(--ps-surface-alt));color:var(--ps-text)}.public-profile-studio[data-badge-style="minimal"] .profile-tag{background:transparent!important;border-color:var(--ps-border)!important}.public-profile-studio[data-badge-style="outline"] .profile-tag{background:transparent!important}.public-profile-studio[data-badge-style="solid"] .profile-tag{box-shadow:none!important}.public-join-studio{color:var(--ps-muted);font-size:.72em}
      @media(max-width:820px){.public-profile-studio{--ps-cols:3}.public-identity-studio{gap:13px}.public-copy-studio h1{font-size:min(var(--ps-name),28px)}}
      @media(max-width:560px){.page{padding-left:10px!important;padding-right:10px!important}.topbar{margin-left:2px;margin-right:2px}.public-profile-studio{margin-top:18px;--ps-pad:16px;--ps-cols:2;border-radius:min(var(--ps-radius),20px)}.public-banner-studio{height:min(var(--ps-banner),190px)}.public-avatar-studio{width:min(var(--ps-avatar),92px)!important;height:min(var(--ps-avatar),92px)!important}.public-identity-studio{gap:10px;margin-top:max(var(--ps-avatar-offset),-44px)}.public-copy-studio h1{font-size:min(var(--ps-name),22px)}.public-headline-studio{font-size:.84em}.public-meta-studio{gap:4px}.public-stats-studio{grid-template-columns:repeat(2,minmax(0,1fr))}.public-actions-studio .public-action{flex:1}.public-links-studio a{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
      @media(prefers-reduced-motion:reduce){.public-profile-studio,.public-links-studio a{transition:none!important}.public-profile-studio:hover,.public-links-studio a:hover{transform:none!important}}.public-profile-studio[data-motion="none"]{transition:none!important}.public-profile-studio[data-motion="none"]:hover{transform:none!important}.public-profile-studio[data-motion="reduced"]{transition-duration:.08s}
    `;
    document.head.appendChild(style);
  }
})();
