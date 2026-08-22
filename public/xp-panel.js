(() => {
    const S = window.SkyNet;
    if (!S) return;

    const cleanPath = () => location.pathname.replace(/\/+$/, '') || '/painel';
    let refreshTimer = null;

    function installStyles() {
        if (document.getElementById('xpPanelStyles')) return;
        const style = document.createElement('style');
        style.id = 'xpPanelStyles';
        style.textContent = `
            .xp-card{margin-top:18px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:18px;align-items:center;padding:20px 22px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,rgba(168,85,247,.11),rgba(255,255,255,.025))}
            .xp-level{width:78px;height:78px;border-radius:22px;display:grid;place-items:center;background:rgba(168,85,247,.16);border:1px solid rgba(168,85,247,.35);font-size:27px;font-weight:900}.xp-level small{display:block;font-size:9px;letter-spacing:.12em;color:var(--muted);text-align:center;margin-top:-8px}
            .xp-copy strong{display:block;font-size:20px}.xp-copy span{display:block;color:var(--muted);font-size:13px;margin-top:4px}.xp-progress{height:10px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:12px}.xp-progress>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#a855f7,#d8b4fe)}
            .xp-total{text-align:right}.xp-total strong{display:block;font-size:25px}.xp-total span{font-size:11px;color:var(--muted)}.xp-breakdown{grid-column:2/4;display:flex;gap:8px;flex-wrap:wrap}.xp-pill{padding:6px 9px;border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:11px;background:rgba(255,255,255,.025)}
            @media(max-width:720px){.xp-card{grid-template-columns:auto 1fr}.xp-total{text-align:left;grid-column:2}.xp-breakdown{grid-column:1/-1}.xp-level{width:64px;height:64px;border-radius:18px;font-size:23px}}
        `;
        document.head.appendChild(style);
    }

    async function heartbeat() {
        if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
        try {
            const data = await S.api('/api/xp/heartbeat', { method: 'POST', body: { visible: true, focused: true } });
            if (cleanPath() === '/painel') renderXp(data.xp);
        } catch {}
    }

    async function loadXp() {
        try {
            const data = await S.api('/api/xp/me');
            renderXp(data.xp);
        } catch {}
    }

    function renderXp(xp) {
        if (cleanPath() !== '/painel' || !xp) return;
        const stats = document.getElementById('overviewStats');
        if (!stats) return;
        let card = document.getElementById('workspaceXpCard');
        if (!card) {
            card = document.createElement('section');
            card.id = 'workspaceXpCard';
            card.className = 'xp-card';
            stats.insertAdjacentElement('afterend', card);
        }
        const b = xp.breakdown || {};
        card.innerHTML = `
            <div class="xp-level"><div>${Number(xp.level || 1)}<small>LEVEL</small></div></div>
            <div class="xp-copy"><strong>Progresso da conta</strong><span>${Number(xp.progressXp || 0)} / ${Number(xp.progressNeeded || 0)} XP para o próximo level</span><div class="xp-progress"><i style="width:${Math.max(0, Math.min(100, Number(xp.progressPercent || 0)))}%"></i></div></div>
            <div class="xp-total"><strong>${Number(xp.totalXp || 0).toLocaleString('pt-BR')} XP</strong><span>${Number(xp.activeMinutes || 0).toLocaleString('pt-BR')} min ativos</span></div>
            <div class="xp-breakdown">
                <span class="xp-pill">${Number(b.apiRequests || 0)} requisições</span>
                <span class="xp-pill">${Number(b.cards || 0)} cards</span>
                <span class="xp-pill">${Number(b.uploads || 0)} uploads</span>
                <span class="xp-pill">${Number(b.messages || 0)} mensagens</span>
                ${Number(xp.xpAdjustment || 0) ? `<span class="xp-pill">ajuste admin: ${Number(xp.xpAdjustment) > 0 ? '+' : ''}${Number(xp.xpAdjustment)} XP</span>` : ''}
            </div>`;
    }

    function waitForWorkspace() {
        const ready = () => document.getElementById('workspaceShell') && !document.getElementById('workspaceShell').classList.contains('hidden');
        const start = () => {
            installStyles();
            heartbeat();
            if (cleanPath() === '/painel') {
                const observer = new MutationObserver(() => {
                    if (!document.getElementById('overviewStats')) return;
                    observer.disconnect();
                    loadXp();
                });
                if (document.getElementById('overviewStats')) loadXp();
                else observer.observe(document.getElementById('workspaceContent'), { childList: true, subtree: true });
            }
            refreshTimer = setInterval(heartbeat, 60000);
        };
        if (ready()) return start();
        const observer = new MutationObserver(() => {
            if (!ready()) return;
            observer.disconnect();
            start();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    window.addEventListener('beforeunload', () => { if (refreshTimer) clearInterval(refreshTimer); });
    waitForWorkspace();
})();
