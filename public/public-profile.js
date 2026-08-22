(() => {
    const S = window.SkyNet;
    const root = document.getElementById('publicProfileRoot');
    if (!S || !root) return;

    const style = document.createElement('style');
    style.textContent = `
        .public-profile{display:grid;grid-template-columns:180px minmax(0,1fr);gap:28px;align-items:start}.public-profile-avatar{width:180px;height:180px;border-radius:28px;object-fit:cover;border:1px solid var(--border);background:rgba(168,85,247,.12);display:grid;place-items:center;font-size:46px;font-weight:800}.public-profile h1{margin:0;font-size:38px}.public-handle{color:var(--muted);margin-top:5px}.public-status{display:inline-flex;margin-top:13px;padding:7px 11px;border:1px solid var(--border);border-radius:999px;color:var(--muted)}.public-bio{margin-top:22px;font-size:16px;line-height:1.7;white-space:pre-wrap}.public-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:24px}.public-meta>div{padding:14px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.025)}.public-meta strong,.public-meta span{display:block}.public-meta strong{font-size:20px}.public-meta span{font-size:11px;color:var(--muted);margin-top:3px}@media(max-width:720px){.public-profile{grid-template-columns:1fr;text-align:center}.public-profile-avatar{margin:auto}.public-meta{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);

    async function load() {
        const parts = location.pathname.split('/').filter(Boolean);
        const username = decodeURIComponent(parts[1] || '');
        if (!username) return fail('Perfil não encontrado.');
        try {
            const data = await S.api(`/api/social/profile/${encodeURIComponent(username)}`);
            const profile = data.profile;
            document.title = `${profile.displayName} - SkyNetApi`;
            const initial = String(profile.displayName || profile.username || '?').slice(0, 1).toUpperCase();
            const avatar = profile.avatarUrl ? `<img class="public-profile-avatar" src="${S.escapeHtml(profile.avatarUrl)}" alt="Avatar de ${S.escapeHtml(profile.displayName)}">` : `<div class="public-profile-avatar">${S.escapeHtml(initial)}</div>`;
            root.innerHTML = `<div class="public-profile">${avatar}<div><div class="eyebrow">Perfil SkyNetApi</div><h1>${S.escapeHtml(profile.displayName)}</h1><div class="public-handle">@${S.escapeHtml(profile.username)}${profile.online ? ' · online' : ''}</div>${profile.status ? `<div class="public-status">${S.escapeHtml(profile.status)}</div>` : ''}<div class="public-bio">${S.escapeHtml(profile.bio || 'Sem bio pública.')}</div><div class="public-meta"><div><strong>${Number(profile.friendCount || 0)}</strong><span>amigos</span></div><div><strong>${Number(profile.points || 0)}</strong><span>pontos</span></div><div><strong>${S.escapeHtml(formatDateOnly(profile.createdAt))}</strong><span>membro desde</span></div><div><strong>${profile.online ? 'Online' : 'Offline'}</strong><span>status</span></div></div><div style="margin-top:22px"><a class="button primary" href="/painel/amigos">Abrir área social</a></div></div></div>`;
        } catch (error) { fail(error.message || 'Perfil não encontrado.'); }
    }

    function formatDateOnly(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    }
    function fail(message) { root.innerHTML = `<div class="message show error">${S.escapeHtml(message)}</div>`; }
    load();
})();
