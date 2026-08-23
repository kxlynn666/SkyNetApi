(() => {
    const S = window.SkyNet;
    if (!S) return;

    let logs = [];
    let keys = [];
    let refreshTimer = null;

    function installStyles() {
        if (document.getElementById('adminBotLogsStyles')) return;
        const style = document.createElement('style');
        style.id = 'adminBotLogsStyles';
        style.textContent = `
            .botlog-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}.botlog-stat{padding:13px;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.025)}.botlog-stat strong,.botlog-stat span{display:block}.botlog-stat strong{font-size:20px}.botlog-stat span{font-size:11px;color:var(--muted);margin-top:3px}.botlog-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.botlog-tools input{min-width:220px;flex:1}.botlog-tools select{max-width:150px}.botlog-list{display:grid;gap:9px;margin-top:14px}.botlog-item{border:1px solid var(--border);border-radius:14px;padding:12px;background:rgba(255,255,255,.02)}.botlog-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.botlog-head time{margin-left:auto;font-size:11px;color:var(--muted)}.botlog-message{margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}.botlog-context{margin-top:8px;padding:9px;border-radius:10px;background:rgba(0,0,0,.22);font-size:11px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.botlog-type{font-size:10px;padding:3px 7px;border:1px solid var(--border);border-radius:999px;text-transform:uppercase;letter-spacing:.06em}.botlog-level-error{border-color:rgba(239,68,68,.4);color:#fca5a5}.botlog-level-warn{border-color:rgba(245,158,11,.4);color:#fcd34d}.botlog-level-info{border-color:rgba(168,85,247,.35);color:#d8b4fe}.botlog-key-list{display:grid;gap:8px;margin-top:12px}.botlog-key{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--border);border-radius:12px}.botlog-key .grow{flex:1;min-width:180px}.botlog-secret{margin-top:12px;padding:13px;border:1px solid rgba(168,85,247,.35);border-radius:14px;background:rgba(168,85,247,.08)}.botlog-secret textarea{width:100%;min-height:78px;margin:8px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.botlog-doc{margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.02)}.botlog-doc code{display:block;margin-top:5px;word-break:break-all;font-size:11px}.botlog-split{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:14px}@media(max-width:900px){.botlog-grid{grid-template-columns:repeat(2,1fr)}.botlog-split{grid-template-columns:1fr}}@media(max-width:520px){.botlog-grid{grid-template-columns:1fr}.botlog-tools input,.botlog-tools select{max-width:none;width:100%}}
        `;
        document.head.appendChild(style);
    }

    function boot() {
        installStyles();
        waitForAdmin(async () => {
            try {
                const session = await S.session();
                if (!session?.isAdmin) return;
            } catch { return; }
            addTab();
            loadAll();
        });
    }

    function waitForAdmin(callback) {
        const ready = () => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && document.querySelector('.tabs');
        if (ready()) return callback();
        const observer = new MutationObserver(() => {
            if (!ready()) return;
            observer.disconnect();
            callback();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    function addTab() {
        if (document.querySelector('[data-tab="botLogs"]')) return;
        const tabs = document.querySelector('.tabs');
        const button = document.createElement('button');
        button.className = 'tab';
        button.type = 'button';
        button.dataset.tab = 'botLogs';
        button.textContent = 'Logs do Bot';
        tabs.appendChild(button);

        const panel = document.createElement('section');
        panel.className = 'tab-panel';
        panel.id = 'botLogs';
        panel.innerHTML = `
            <div class="botlog-grid" id="botLogStats"></div>
            <div class="botlog-split">
                <div class="card">
                    <div class="toolbar"><h2 class="card-title" style="margin:0 auto 0 0">Eventos recebidos</h2><button class="button small" id="botLogRefresh" type="button">Atualizar</button><button class="button small danger" id="botLogClear" type="button">Limpar tudo</button></div>
                    <div class="botlog-tools" style="margin-top:12px"><input id="botLogSearch" type="search" placeholder="Buscar mensagem, comando, grupo ou bot"><select id="botLogType"><option value="all">Todos os tipos</option><option value="message">Mensagens</option><option value="command">Comandos</option><option value="status">Status</option><option value="error">Erros</option><option value="warning">Avisos</option><option value="system">Sistema</option></select><select id="botLogLevel"><option value="all">Todos os níveis</option><option value="info">Info</option><option value="warn">Aviso</option><option value="error">Erro</option></select></div>
                    <div class="message" id="botLogMessage"></div><div class="botlog-list" id="botLogList"><div class="empty">Carregando...</div></div>
                </div>
                <div class="card">
                    <div class="toolbar"><h2 class="card-title" style="margin:0 auto 0 0">Chaves do bot</h2><button class="button primary small" id="botKeyCreate" type="button">Gerar chave</button></div>
                    <p class="muted" style="margin:8px 0 0">Estas chaves só enviam logs. Uma key comum da API não é aceita nesta rota.</p>
                    <div id="botKeySecret"></div><div class="botlog-key-list" id="botKeyList"><div class="empty">Carregando...</div></div>
                    <div class="botlog-doc"><strong>Configuração do bot</strong><code>SKYNET_BOT_LOG_URL=https://skynetapi-production-9917.up.railway.app</code><code>SKYNET_BOT_LOG_KEY=skynet_bot_...</code><div class="text-faint" style="margin-top:7px">Não coloque a chave no GitHub. Use variável de ambiente.</div></div>
                </div>
            </div>`;
        tabs.parentElement.appendChild(panel);

        wireTabs();
        document.getElementById('botLogRefresh').addEventListener('click', loadLogs);
        document.getElementById('botLogClear').addEventListener('click', clearLogs);
        document.getElementById('botLogSearch').addEventListener('input', debounce(loadLogs, 250));
        document.getElementById('botLogType').addEventListener('change', loadLogs);
        document.getElementById('botLogLevel').addEventListener('change', loadLogs);
        document.getElementById('botKeyCreate').addEventListener('click', createKey);
        startPolling();
    }

    function wireTabs() {
        document.querySelectorAll('.tabs .tab').forEach(tab => {
            if (tab.dataset.botLogWired === '1') return;
            tab.dataset.botLogWired = '1';
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tabs .tab').forEach(item => item.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(item => item.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab)?.classList.add('active');
                if (tab.dataset.tab === 'botLogs') loadAll();
            });
        });
    }

    async function loadAll() {
        await Promise.all([loadLogs(), loadKeys()]);
    }

    async function loadLogs() {
        const root = document.getElementById('botLogList');
        if (!root) return;
        try {
            const query = new URLSearchParams({ limit: '250' });
            const q = document.getElementById('botLogSearch')?.value.trim();
            const type = document.getElementById('botLogType')?.value || 'all';
            const level = document.getElementById('botLogLevel')?.value || 'all';
            if (q) query.set('q', q);
            if (type !== 'all') query.set('type', type);
            if (level !== 'all') query.set('level', level);
            const data = await S.api(`/api/admin/bot-logs?${query}`);
            logs = data.logs || [];
            renderStats(data.stats || {});
            renderLogs();
        } catch (error) {
            S.message(document.getElementById('botLogMessage'), error.message, 'error');
        }
    }

    function renderStats(stats) {
        const byType = stats.byType || {};
        document.getElementById('botLogStats').innerHTML = [
            ['Total', stats.total || 0],
            ['Mensagens', byType.message || 0],
            ['Comandos', byType.command || 0],
            ['Erros', (stats.byLevel || {}).error || 0]
        ].map(([label, value]) => `<div class="botlog-stat"><strong>${Number(value).toLocaleString('pt-BR')}</strong><span>${S.escapeHtml(label)}</span></div>`).join('');
    }

    function renderLogs() {
        const root = document.getElementById('botLogList');
        if (!logs.length) return root.innerHTML = '<div class="empty">Nenhum log encontrado.</div>';
        root.innerHTML = logs.map(item => {
            const context = item.context && Object.keys(item.context).length ? JSON.stringify(item.context, null, 2) : '';
            return `<article class="botlog-item" data-log-id="${S.escapeHtml(item.id)}"><div class="botlog-head"><span class="botlog-type botlog-level-${S.escapeHtml(item.level)}">${S.escapeHtml(item.type)}</span><strong>${S.escapeHtml(item.bot || 'bot')}</strong>${item.instanceId ? `<span class="text-faint mono">${S.escapeHtml(item.instanceId)}</span>` : ''}<time>${S.escapeHtml(S.formatDate(item.sourceTimestamp || item.receivedAt))}</time><button class="button small danger" data-delete-log="${S.escapeHtml(item.id)}" type="button">Excluir</button></div><div class="botlog-message">${S.escapeHtml(item.message || '')}</div>${context ? `<pre class="botlog-context">${S.escapeHtml(context)}</pre>` : ''}</article>`;
        }).join('');
        root.querySelectorAll('[data-delete-log]').forEach(button => button.addEventListener('click', () => deleteLog(button.dataset.deleteLog)));
    }

    async function clearLogs() {
        if (!confirm('Apagar todos os logs recebidos do bot?')) return;
        try {
            await S.api('/api/admin/bot-logs', { method: 'DELETE' });
            S.message(document.getElementById('botLogMessage'), 'Logs apagados.', 'success');
            await loadLogs();
        } catch (error) { S.message(document.getElementById('botLogMessage'), error.message, 'error'); }
    }

    async function deleteLog(id) {
        try {
            await S.api(`/api/admin/bot-logs/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await loadLogs();
        } catch (error) { S.message(document.getElementById('botLogMessage'), error.message, 'error'); }
    }

    async function loadKeys() {
        const root = document.getElementById('botKeyList');
        if (!root) return;
        try {
            const data = await S.api('/api/admin/bot-log-keys');
            keys = data.keys || [];
            renderKeys();
        } catch (error) { root.innerHTML = `<div class="empty">${S.escapeHtml(error.message)}</div>`; }
    }

    function renderKeys() {
        const root = document.getElementById('botKeyList');
        if (!keys.length) return root.innerHTML = '<div class="empty">Nenhuma chave de bot criada.</div>';
        root.innerHTML = keys.map(key => `<div class="botlog-key" data-key-id="${S.escapeHtml(key.id)}"><div class="grow"><strong>${S.escapeHtml(key.name)}</strong><div class="text-faint mono">${S.escapeHtml(key.preview)}</div><div class="text-faint">${key.requestCount || 0} envios · último uso: ${S.escapeHtml(S.formatDate(key.lastUsedAt))}</div></div><span class="badge ${key.active ? 'active' : 'inactive'}">${key.active ? 'Ativa' : 'Revogada'}</span><button class="button small" data-toggle-key="${S.escapeHtml(key.id)}" data-active="${key.active}" type="button">${key.active ? 'Revogar' : 'Reativar'}</button><button class="button small danger" data-delete-key="${S.escapeHtml(key.id)}" type="button">Excluir</button></div>`).join('');
        root.querySelectorAll('[data-toggle-key]').forEach(button => button.addEventListener('click', () => toggleKey(button.dataset.toggleKey, button.dataset.active !== 'true')));
        root.querySelectorAll('[data-delete-key]').forEach(button => button.addEventListener('click', () => deleteKey(button.dataset.deleteKey)));
    }

    async function createKey() {
        const name = prompt('Nome da chave do bot:', 'WhatsApp Bot logs');
        if (name === null) return;
        try {
            const data = await S.api('/api/admin/bot-log-keys', { method: 'POST', body: { name: name.trim() || 'WhatsApp Bot logs' } });
            const secret = document.getElementById('botKeySecret');
            secret.innerHTML = `<div class="botlog-secret"><strong>Chave criada</strong><div class="text-faint">Copie agora e coloque em SKYNET_BOT_LOG_KEY. O segredo completo não será mostrado novamente.</div><textarea id="botKeySecretValue" readonly>${S.escapeHtml(data.apiKey)}</textarea><button class="button primary small" id="botKeyCopy" type="button">Copiar chave</button></div>`;
            document.getElementById('botKeyCopy').addEventListener('click', async () => {
                const value = document.getElementById('botKeySecretValue').value;
                try { await navigator.clipboard.writeText(value); document.getElementById('botKeyCopy').textContent = 'Copiada'; }
                catch { document.getElementById('botKeySecretValue').select(); }
            });
            await loadKeys();
        } catch (error) { alert(error.message); }
    }

    async function toggleKey(id, active) {
        try { await S.api(`/api/admin/bot-log-keys/${encodeURIComponent(id)}`, { method: 'PATCH', body: { active } }); await loadKeys(); }
        catch (error) { alert(error.message); }
    }

    async function deleteKey(id) {
        if (!confirm('Excluir esta chave de logs permanentemente?')) return;
        try { await S.api(`/api/admin/bot-log-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadKeys(); }
        catch (error) { alert(error.message); }
    }

    function startPolling() {
        clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            if (!document.getElementById('botLogs')?.classList.contains('active')) return;
            loadLogs();
        }, 5000);
    }

    function debounce(fn, wait) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
    }

    window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
    boot();
})();
