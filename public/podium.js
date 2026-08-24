(() => {
    const S = window.SkyNet;
    const root = document.getElementById('podiumRoot');
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
        .podium-wrap{margin-top:18px}.podium-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.podium-head p{margin:4px 0 0}.podium-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.podium-card-v3{--profile-accent:#a855f7;aspect-ratio:4/3;position:relative;border:1px solid rgba(139,92,246,.22);border-radius:20px;overflow:hidden;background:#120c21;color:inherit;text-decoration:none;box-shadow:0 18px 46px rgba(0,0,0,.18);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.podium-card-v3:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--profile-accent) 42%,rgba(139,92,246,.22));box-shadow:0 24px 58px rgba(0,0,0,.26),0 0 30px color-mix(in srgb,var(--profile-accent) 10%,transparent)}.podium-card-v3.place-1{border-color:color-mix(in srgb,var(--profile-accent) 46%,rgba(167,139,250,.3))}.podium-bg{position:absolute!important;inset:0;z-index:0!important;background:radial-gradient(circle at 20% 15%,color-mix(in srgb,var(--profile-accent) 30%,transparent),transparent 45%),linear-gradient(145deg,#22143a,#0b0713)}.podium-bg img{width:100%;height:100%;object-fit:cover;opacity:.58}.podium-shade{position:absolute!important;inset:0;z-index:1!important;background:linear-gradient(to top,rgba(5,3,10,.97),rgba(5,3,10,.5) 52%,rgba(5,3,10,.12))}.podium-place-v3{position:absolute!important;z-index:5!important;top:12px;left:12px;display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:27px;padding:0 8px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(5,3,10,.58);backdrop-filter:blur(10px);font:800 11px 'JetBrains Mono',monospace}.podium-card-v3.place-1 .podium-place-v3{background:color-mix(in srgb,var(--profile-accent) 23%,rgba(5,3,10,.62));border-color:color-mix(in srgb,var(--profile-accent) 50%,rgba(255,255,255,.12));box-shadow:0 0 20px color-mix(in srgb,var(--profile-accent) 18%,transparent)}.podium-content{position:absolute!important;z-index:4!important;inset:auto 0 0;padding:15px}.podium-identity{display:flex;gap:10px;align-items:end}.podium-identity .cosmetic-avatar{width:58px;height:58px;border-radius:17px}.podium-identity .cosmetic-avatar-inner{border-radius:14px}.podium-copy{min-width:0;flex:1}.podium-name-v3{font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.podium-user-v3{font-size:10px;color:#b8abc9;margin-top:2px}.podium-tags-v3{margin-top:6px}.podium-tags-v3 .profile-tag{font-size:8px;min-height:20px;padding:2px 6px}.podium-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:10px}.podium-metric{min-width:0;padding:6px 7px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(5,3,10,.48);backdrop-filter:blur(8px)}.podium-metric strong,.podium-metric span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.podium-metric strong{font-size:11px}.podium-metric span{font-size:7px;color:#8e819f;text-transform:uppercase;letter-spacing:.05em;margin-top:1px}
        .podium-empty{padding:24px;text-align:center;border:1px dashed var(--border);border-radius:16px;color:var(--text-muted)}.leaderboard-wrap{margin-top:18px;border-top:1px solid var(--border);padding-top:16px}.leaderboard-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.leaderboard-list{display:grid;gap:8px}.leaderboard-row{display:grid;grid-template-columns:46px 50px minmax(0,1fr) 90px 80px 90px;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.018);color:inherit;text-decoration:none}.leaderboard-row:hover{background:rgba(168,85,247,.055)}.leaderboard-rank{font-weight:900;color:var(--text-muted)}.leaderboard-row .cosmetic-avatar{width:44px;height:44px;border-radius:13px;padding:2px}.leaderboard-row .cosmetic-avatar-inner{border-radius:11px}.leaderboard-copy{min-width:0}.leaderboard-copy strong,.leaderboard-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.leaderboard-copy span{font-size:11px;color:var(--text-muted);margin-top:2px}.leaderboard-value{text-align:right;font-weight:800;font-size:12px}.leaderboard-value span{display:block;font-size:8px;color:var(--text-muted);font-weight:500;text-transform:uppercase;margin-top:1px}
        @media(max-width:900px){.podium-grid{display:grid;grid-auto-flow:column;grid-auto-columns:min(84vw,340px);grid-template-columns:none;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;padding:2px 2px 10px}.podium-card-v3{scroll-snap-align:start}.leaderboard-row{grid-template-columns:38px 44px minmax(0,1fr) 74px 64px}.leaderboard-row .leaderboard-requests{display:none}}
        @media(max-width:520px){.podium-head{align-items:flex-start}.podium-head>.button{display:none}.podium-grid{grid-auto-columns:min(88vw,330px);margin-left:-2px}.podium-content{padding:12px}.podium-identity .cosmetic-avatar{width:52px;height:52px}.podium-metrics{grid-template-columns:repeat(2,1fr)}.leaderboard-row{grid-template-columns:32px 40px minmax(0,1fr) 62px;padding:9px 8px;gap:7px}.leaderboard-row .leaderboard-level,.leaderboard-row .leaderboard-requests{display:none}.leaderboard-row .cosmetic-avatar{width:38px;height:38px}}
    `;
    document.head.appendChild(style);

    async function load() {
        try {
            const data = await S.api('/api/profile-v3/leaderboard?limit=20');
            const entries = data.leaderboard || [];
            if (!entries.length) {
                root.innerHTML = '<div class="podium-empty">O pódio aparecerá quando houver membros participantes.</div>';
                return;
            }
            const top = entries.slice(0, 3);
            const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
            const rest = entries.slice(3);
            root.innerHTML = `<div class="podium-grid">${order.map(card).join('')}</div>${rest.length ? `<div class="leaderboard-wrap"><div class="leaderboard-head"><div><strong>Placar geral</strong><div class="hint">Ranking por XP total</div></div><span class="badge active">Top ${entries.length}</span></div><div class="leaderboard-list">${rest.map(row).join('')}</div></div>` : ''}<div class="hint" style="margin-top:10px">${S.escapeHtml(data.scoring || 'Ranking por XP total')}</div>`;
        } catch {
            root.innerHTML = '<div class="podium-empty">Não foi possível carregar o pódio agora.</div>';
        }
    }

    function avatar(user, sizeClass = '') {
        const initial = String(user.displayName || user.username || '?').slice(0, 1).toUpperCase();
        const frame = user.cosmetics?.frame;
        return `<div class="cosmetic-avatar ${sizeClass}" data-frame="${S.escapeHtml(frame?.id || '')}"><div class="cosmetic-avatar-inner">${user.avatarUrl ? `<img src="${S.escapeHtml(user.avatarUrl)}" alt="">` : S.escapeHtml(initial)}</div></div>`;
    }

    function tags(user) {
        const items = user.cosmetics?.tags || [];
        if (!items.length) return '';
        return `<div class="profile-tags podium-tags-v3">${items.slice(0,3).map(tag => `<span class="profile-tag" style="--tag-a:${S.escapeHtml(tag.colors?.[0] || '#7c3aed')};--tag-b:${S.escapeHtml(tag.colors?.[1] || '#a78bfa')}">${S.escapeHtml(tag.name)}</span>`).join('')}</div>`;
    }

    function card(user) {
        const accent = /^#[0-9a-f]{6}$/i.test(user.accent || '') ? user.accent : '#a855f7';
        return `<a class="podium-card-v3 place-${Number(user.place || 0)} profile-surface" data-decoration="${S.escapeHtml(user.cosmetics?.decoration?.id || '')}" href="/u/${encodeURIComponent(user.username)}" style="--profile-accent:${S.escapeHtml(accent)}"><div class="podium-bg">${user.bannerUrl ? `<img src="${S.escapeHtml(user.bannerUrl)}" alt="">` : ''}</div><div class="podium-shade"></div><div class="podium-place-v3">#${Number(user.place || 0)}</div><div class="podium-content"><div class="podium-identity">${avatar(user)}<div class="podium-copy"><div class="podium-name-v3">${S.escapeHtml(user.displayName || user.username)}</div><div class="podium-user-v3">@${S.escapeHtml(user.username)}</div>${tags(user)}</div></div><div class="podium-metrics">${metric(user.xp,'XP')}${metric(user.level,'Level')}${metric(user.requests,'Requests')}${metric(user.friendCount,'Amigos')}</div></div></a>`;
    }

    function row(user) {
        return `<a class="leaderboard-row" href="/u/${encodeURIComponent(user.username)}"><div class="leaderboard-rank">#${Number(user.place || 0)}</div>${avatar(user)}<div class="leaderboard-copy"><strong>${S.escapeHtml(user.displayName || user.username)}</strong><span>@${S.escapeHtml(user.username)}${user.headline ? ` · ${S.escapeHtml(user.headline)}` : ''}</span></div><div class="leaderboard-value">${number(user.xp)}<span>XP</span></div><div class="leaderboard-value leaderboard-level">${number(user.level)}<span>Level</span></div><div class="leaderboard-value leaderboard-requests">${number(user.requests)}<span>Requests</span></div></a>`;
    }

    function metric(value, label) { return `<div class="podium-metric"><strong>${number(value)}</strong><span>${S.escapeHtml(label)}</span></div>`; }
    function number(value) { return Number(value || 0).toLocaleString('pt-BR'); }
    load();
})();