(() => {
    const S = window.SkyNet;
    const root = document.getElementById('podiumRoot');
    if (!S || !root) return;

    const style = document.createElement('style');
    style.textContent = `
        .podium-wrap{margin-top:18px}.podium-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.podium-head p{margin:4px 0 0}.podium-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:end}.podium-card{position:relative;padding:20px;border:1px solid var(--border);border-radius:18px;background:rgba(255,255,255,.025);text-align:center;overflow:hidden}.podium-card.place-1{min-height:260px;border-color:rgba(168,85,247,.38);background:linear-gradient(180deg,rgba(168,85,247,.10),rgba(255,255,255,.025))}.podium-card.place-2{min-height:230px}.podium-card.place-3{min-height:215px}.podium-place{display:inline-flex;padding:5px 9px;border-radius:999px;border:1px solid var(--border);font-size:12px;font-weight:800;color:var(--muted);margin-bottom:13px}.podium-card.place-1 .podium-place{color:#fff;border-color:rgba(168,85,247,.4);background:rgba(168,85,247,.16)}.podium-avatar{width:82px;height:82px;border-radius:20px;object-fit:cover;margin:0 auto 12px;border:1px solid var(--border);background:rgba(168,85,247,.12);display:grid;place-items:center;font-size:26px;font-weight:800}.podium-name{font-size:18px;font-weight:800}.podium-user{font-size:12px;color:var(--muted);margin-top:3px}.podium-points{font-size:24px;font-weight:800;margin-top:13px}.podium-points span{font-size:11px;color:var(--muted);font-weight:600;margin-left:4px}.podium-level{font-size:12px;color:var(--muted);margin-top:5px}.podium-empty{padding:24px;text-align:center;border:1px dashed var(--border);border-radius:16px;color:var(--muted)}
        .leaderboard-wrap{margin-top:18px;border-top:1px solid var(--border);padding-top:16px}.leaderboard-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.leaderboard-list{display:grid;gap:8px}.leaderboard-row{display:grid;grid-template-columns:52px 46px minmax(0,1fr) 110px 110px;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:13px;background:rgba(255,255,255,.018);color:inherit;text-decoration:none}.leaderboard-row:hover{background:rgba(168,85,247,.055)}.leaderboard-rank{font-weight:900;color:var(--muted)}.leaderboard-avatar{width:42px;height:42px;border-radius:12px;object-fit:cover;background:rgba(168,85,247,.12);display:grid;place-items:center;font-weight:800}.leaderboard-copy{min-width:0}.leaderboard-copy strong,.leaderboard-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.leaderboard-copy span{font-size:11px;color:var(--muted);margin-top:2px}.leaderboard-xp,.leaderboard-lvl{text-align:right;font-weight:800}.leaderboard-xp span,.leaderboard-lvl span{display:block;font-size:10px;color:var(--muted);font-weight:500}
        @media(max-width:760px){.podium-grid{grid-template-columns:1fr}.podium-card,.podium-card.place-1,.podium-card.place-2,.podium-card.place-3{min-height:0}.leaderboard-row{grid-template-columns:42px 42px minmax(0,1fr) 86px}.leaderboard-lvl{display:none}}
    `;
    document.head.appendChild(style);

    async function load() {
        try {
            const data = await S.api('/api/community/leaderboard?limit=20');
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

    function avatar(user, className) {
        const initial = String(user.displayName || user.username || '?').slice(0, 1).toUpperCase();
        return user.avatarUrl ? `<img class="${className}" src="${S.escapeHtml(user.avatarUrl)}" alt="">` : `<div class="${className}">${S.escapeHtml(initial)}</div>`;
    }

    function card(user) {
        return `<a class="podium-card place-${Number(user.place || 0)}" href="/u/${encodeURIComponent(user.username)}" style="color:inherit;text-decoration:none;--profile-accent:${S.escapeHtml(user.accent || '#a855f7')}"><div class="podium-place">#${Number(user.place || 0)}</div>${avatar(user, 'podium-avatar')}<div class="podium-name">${S.escapeHtml(user.displayName || user.username)}</div><div class="podium-user">@${S.escapeHtml(user.username)}</div><div class="podium-points">${Number(user.xp || 0).toLocaleString('pt-BR')}<span>XP</span></div><div class="podium-level">Level ${Number(user.level || 1)}</div></a>`;
    }

    function row(user) {
        return `<a class="leaderboard-row" href="/u/${encodeURIComponent(user.username)}"><div class="leaderboard-rank">#${Number(user.place || 0)}</div>${avatar(user, 'leaderboard-avatar')}<div class="leaderboard-copy"><strong>${S.escapeHtml(user.displayName || user.username)}</strong><span>@${S.escapeHtml(user.username)}${user.headline ? ` · ${S.escapeHtml(user.headline)}` : ''}</span></div><div class="leaderboard-xp">${Number(user.xp || 0).toLocaleString('pt-BR')}<span>XP</span></div><div class="leaderboard-lvl">${Number(user.level || 1)}<span>LEVEL</span></div></a>`;
    }

    load();
})();
