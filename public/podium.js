(() => {
    const S = window.SkyNet;
    const root = document.getElementById('podiumRoot');
    if (!S || !root) return;

    const style = document.createElement('style');
    style.textContent = `
        .podium-wrap{margin-top:18px}.podium-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.podium-head p{margin:4px 0 0}.podium-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:end}.podium-card{position:relative;padding:20px;border:1px solid var(--border);border-radius:18px;background:rgba(255,255,255,.025);text-align:center;overflow:hidden}.podium-card.place-1{min-height:250px;border-color:rgba(168,85,247,.38);background:linear-gradient(180deg,rgba(168,85,247,.10),rgba(255,255,255,.025))}.podium-card.place-2{min-height:220px}.podium-card.place-3{min-height:205px}.podium-place{display:inline-flex;padding:5px 9px;border-radius:999px;border:1px solid var(--border);font-size:12px;font-weight:800;color:var(--muted);margin-bottom:13px}.podium-card.place-1 .podium-place{color:#fff;border-color:rgba(168,85,247,.4);background:rgba(168,85,247,.16)}.podium-avatar{width:82px;height:82px;border-radius:20px;object-fit:cover;margin:0 auto 12px;border:1px solid var(--border);background:rgba(168,85,247,.12);display:grid;place-items:center;font-size:26px;font-weight:800}.podium-name{font-size:18px;font-weight:800}.podium-user{font-size:12px;color:var(--muted);margin-top:3px}.podium-points{font-size:24px;font-weight:800;margin-top:13px}.podium-points span{font-size:11px;color:var(--muted);font-weight:600;margin-left:4px}.podium-empty{padding:24px;text-align:center;border:1px dashed var(--border);border-radius:16px;color:var(--muted)}@media(max-width:760px){.podium-grid{grid-template-columns:1fr}.podium-card,.podium-card.place-1,.podium-card.place-2,.podium-card.place-3{min-height:0}}
    `;
    document.head.appendChild(style);

    async function load() {
        try {
            const data = await S.api('/api/social/podium');
            if (!data.podium?.length) {
                root.innerHTML = '<div class="podium-empty">O pódio aparecerá quando houver membros participantes.</div>';
                return;
            }
            const order = data.podium.length === 3 ? [data.podium[1], data.podium[0], data.podium[2]] : data.podium;
            root.innerHTML = `<div class="podium-grid">${order.map(card).join('')}</div><div class="hint" style="margin-top:10px">${S.escapeHtml(data.scoring || '')}</div>`;
        } catch {
            root.innerHTML = '<div class="podium-empty">Não foi possível carregar o pódio agora.</div>';
        }
    }

    function card(user) {
        const initial = String(user.displayName || user.username || '?').slice(0, 1).toUpperCase();
        const avatar = user.avatarUrl ? `<img class="podium-avatar" src="${S.escapeHtml(user.avatarUrl)}" alt="">` : `<div class="podium-avatar">${S.escapeHtml(initial)}</div>`;
        return `<a class="podium-card place-${Number(user.place || 0)}" href="/u/${encodeURIComponent(user.username)}" style="color:inherit;text-decoration:none"><div class="podium-place">#${Number(user.place || 0)}</div>${avatar}<div class="podium-name">${S.escapeHtml(user.displayName || user.username)}</div><div class="podium-user">@${S.escapeHtml(user.username)}</div><div class="podium-points">${Number(user.points || 0)}<span>pontos</span></div></a>`;
    }

    load();
})();
