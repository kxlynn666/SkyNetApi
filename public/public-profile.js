(() => {
    const S = window.SkyNet;
    const root = document.getElementById('publicProfileRoot');
    if (!S || !root) return;

    if (!document.querySelector('link[data-profile-cosmetics]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/profile-cosmetics.css';
        link.dataset.profileCosmetics = '1';
        document.head.appendChild(link);
    }

    const style = document.createElement('style');
    style.textContent = `
        #publicProfileRoot{padding:0!important;background:transparent!important;border:0!important}.public-profile-v3{--profile-accent:#a855f7;border:1px solid rgba(139,92,246,.2);border-radius:26px;background:linear-gradient(180deg,rgba(24,16,44,.96),rgba(13,8,24,.96));overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.25)}.public-cover-v3{height:260px;position:relative!important;z-index:0!important;background:radial-gradient(circle at 20% 20%,color-mix(in srgb,var(--profile-accent) 30%,transparent),transparent 46%),linear-gradient(135deg,#21143a,#0b0713)}.public-cover-v3 img{width:100%;height:100%;object-fit:cover;opacity:.72}.public-cover-v3::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(13,8,24,.94),transparent 65%)}.public-main-v3{padding:0 30px 30px;margin-top:-58px;position:relative;z-index:3}.public-head-v3{display:flex;gap:20px;align-items:flex-end}.public-head-v3 .cosmetic-avatar{width:132px;height:132px;border-radius:30px;background:#151021}.public-head-v3 .cosmetic-avatar-inner{border-radius:25px;font-size:38px}.public-copy-v3{min-width:0;flex:1;padding-bottom:5px}.public-copy-v3 h1{margin:0;font-size:34px}.public-handle-v3{margin-top:4px;color:#b8abc9;font-size:13px}.public-headline-v3{margin-top:7px;color:#d8ccef;font-size:13px}.public-copy-v3 .profile-tags{margin-top:10px}.public-status-v3{display:inline-flex;margin-top:15px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--profile-accent) 30%,var(--border));border-radius:999px;background:color-mix(in srgb,var(--profile-accent) 8%,transparent);font-size:12px;color:#d8ccef}.public-bio-v3{margin-top:20px;max-width:760px;font-size:14px;line-height:1.75;color:var(--text-muted);white-space:pre-wrap}.public-stats-v3{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin-top:24px}.public-stat-v3{padding:13px;border:1px solid rgba(139,92,246,.12);border-radius:13px;background:rgba(30,22,56,.38)}.public-stat-v3 strong,.public-stat-v3 span{display:block}.public-stat-v3 strong{font-size:17px}.public-stat-v3 span{font-size:9px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em;margin-top:3px}.public-actions-v3{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}.public-join-v3{font-size:11px;color:var(--text-faint);margin-top:16px}
        .public-profile-v3[data-style="glass"]{background:linear-gradient(135deg,rgba(30,22,56,.84),rgba(11,7,19,.84));backdrop-filter:blur(18px);border-color:color-mix(in srgb,var(--profile-accent) 30%,transparent);box-shadow:0 30px 90px rgba(0,0,0,.28),0 0 40px color-mix(in srgb,var(--profile-accent) 8%,transparent)}.public-profile-v3[data-style="contrast"]{background:#07070b;border:2px solid color-mix(in srgb,var(--profile-accent) 55%,transparent);box-shadow:0 28px 90px rgba(0,0,0,.45)}
        @media(max-width:820px){.public-stats-v3{grid-template-columns:repeat(3,1fr)}.public-cover-v3{height:220px}}
        @media(max-width:560px){.page{padding-left:12px;padding-right:12px}.public-profile-v3{border-radius:20px}.public-cover-v3{height:190px}.public-main-v3{padding:0 16px 20px;margin-top:-44px}.public-head-v3{gap:12px;align-items:end}.public-head-v3 .cosmetic-avatar{width:88px;height:88px;border-radius:22px}.public-head-v3 .cosmetic-avatar-inner{border-radius:18px;font-size:28px}.public-copy-v3 h1{font-size:21px}.public-headline-v3{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.public-copy-v3 .profile-tags{gap:4px}.public-copy-v3 .profile-tag{font-size:8px}.public-stats-v3{grid-template-columns:repeat(2,1fr);gap:7px}.public-bio-v3{font-size:13px}.public-actions-v3 .button{flex:1}}
    `;
    document.head.appendChild(style);

    async function load() {
        const parts = location.pathname.split('/').filter(Boolean);
        const username = decodeURIComponent(parts[1] || '');
        if (!username) return fail('Perfil não encontrado.');
        try {
            const data = await S.api(`/api/profile-v3/profile/${encodeURIComponent(username)}`);
            const p = data.profile;
            document.title = `${p.displayName} - SkyNetApi`;
            const accent = /^#[0-9a-f]{6}$/i.test(p.accent || '') ? p.accent : '#a855f7';
            const initial = String(p.displayName || p.username || '?').slice(0,1).toUpperCase();
            const cosmetics = p.cosmetics || {};
            const frame = cosmetics.frame?.id || '';
            const decoration = cosmetics.decoration?.id || '';
            const stats = p.stats || {};
            root.innerHTML = `<article class="public-profile-v3 profile-surface" data-decoration="${S.escapeHtml(decoration)}" data-style="${S.escapeHtml(p.style || 'clean')}" style="--profile-accent:${S.escapeHtml(accent)}"><div class="public-cover-v3">${p.bannerUrl ? `<img src="${S.escapeHtml(p.bannerUrl)}" alt="">` : ''}</div><div class="public-main-v3"><div class="public-head-v3">${avatar(p.avatarUrl,initial,frame)}<div class="public-copy-v3"><h1>${S.escapeHtml(p.displayName || p.username)}</h1><div class="public-handle-v3">@${S.escapeHtml(p.username)}</div>${p.headline ? `<div class="public-headline-v3">${S.escapeHtml(p.headline)}</div>` : ''}${tags(cosmetics.tags || [])}</div></div>${p.status ? `<div class="public-status-v3">${S.escapeHtml(p.status)}</div>` : ''}<div class="public-bio-v3">${S.escapeHtml(p.bio || 'Sem bio pública.')}</div><div class="public-stats-v3">${stat(stats.xp,'XP')}${stat(stats.level,'Level')}${stat(stats.requests,'Requests')}${stat(stats.friends,'Amigos')}${stat(stats.cards,'Cards')}${stat(stats.uploads,'Uploads')}</div>${p.createdAt ? `<div class="public-join-v3">Membro desde ${S.escapeHtml(formatDateOnly(p.createdAt))}</div>` : ''}<div class="public-actions-v3"><a class="button primary" href="/painel/amigos">Área social</a><a class="button" href="/">SkyNetApi</a></div></div></article>`;
        } catch (error) { fail(error.message || 'Perfil não encontrado.'); }
    }

    function avatar(url,initial,frame) { return `<div class="cosmetic-avatar" data-frame="${S.escapeHtml(frame)}"><div class="cosmetic-avatar-inner">${url ? `<img src="${S.escapeHtml(url)}" alt="Avatar">` : S.escapeHtml(initial)}</div></div>`; }
    function tags(items) { return items.length ? `<div class="profile-tags">${items.map(tag => `<span class="profile-tag" style="--tag-a:${S.escapeHtml(tag.colors?.[0] || '#7c3aed')};--tag-b:${S.escapeHtml(tag.colors?.[1] || '#a78bfa')}">${S.escapeHtml(tag.name)}</span>`).join('')}</div>` : ''; }
    function stat(value,label) { const text = value === null || value === undefined ? '—' : Number(value).toLocaleString('pt-BR'); return `<div class="public-stat-v3"><strong>${text}</strong><span>${S.escapeHtml(label)}</span></div>`; }
    function formatDateOnly(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR',{month:'short',year:'numeric'}); }
    function fail(message) { root.innerHTML = `<div class="message show error">${S.escapeHtml(message)}</div>`; }
    load();
})();