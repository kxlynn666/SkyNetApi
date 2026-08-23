(() => {
    const S = window.SkyNet;
    if (!S) return;
    let tracks = [];

    function waitForAdmin() {
        const ready = () => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && document.querySelector('.tabs');
        if (ready()) return boot();
        const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); boot(); } });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    async function boot() {
        try { const me = await S.session(); if (!me?.isAdmin) return; } catch { return; }
        if (document.querySelector('[data-tab="adminMusic"]')) return;
        const tabs = document.querySelector('.tabs');
        const button = document.createElement('button');
        button.className = 'tab'; button.type = 'button'; button.dataset.tab = 'adminMusic'; button.textContent = 'Música';
        tabs.appendChild(button);
        const panel = document.createElement('section'); panel.className = 'tab-panel'; panel.id = 'adminMusic';
        panel.innerHTML = `<div class="card"><div class="toolbar"><h2 class="card-title" style="margin:0 auto 0 0">Biblioteca de música</h2><button class="button small" id="musicAdminRefresh" type="button">Atualizar</button></div><p class="muted">Envie somente faixas que você tenha direito de usar. O player também possui uma estação Lo-fi gerada localmente, sem arquivo externo.</p><div class="message" id="musicAdminMessage"></div><form id="musicUploadForm" style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;margin:16px 0"><div class="form-group" style="margin:0"><label>Título</label><input name="title" maxlength="80" placeholder="Nome da faixa"></div><div class="form-group" style="margin:0"><label>Artista</label><input name="artist" maxlength="80" placeholder="Artista / autor"></div><div class="form-group" style="margin:0"><label>Arquivo MP3, OGG ou WAV</label><input name="file" type="file" accept="audio/mpeg,audio/ogg,audio/wav,.mp3,.ogg,.wav" required></div><button class="button primary" type="submit">Enviar faixa</button></form><div id="musicAdminList"><div class="empty">Carregando...</div></div></div>`;
        tabs.parentElement.appendChild(panel);
        document.querySelectorAll('.tabs .tab').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.tabs .tab').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(item => item.classList.remove('active'));
            tab.classList.add('active'); document.getElementById(tab.dataset.tab)?.classList.add('active');
        }));
        document.getElementById('musicUploadForm').addEventListener('submit', uploadTrack);
        document.getElementById('musicAdminRefresh').addEventListener('click', loadTracks);
        await loadTracks();
    }

    async function loadTracks() {
        try { const data = await S.api('/api/admin/music'); tracks = data.tracks || []; render(); }
        catch (error) { S.message(document.getElementById('musicAdminMessage'), error.message, 'error'); }
    }
    function render() {
        const root = document.getElementById('musicAdminList');
        if (!tracks.length) return root.innerHTML = '<div class="empty">Nenhuma faixa enviada. A Lo-fi Radio interna continua disponível.</div>';
        root.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Faixa</th><th>Status</th><th>Tamanho</th><th>Criada</th><th>Ações</th></tr></thead><tbody>${tracks.map(track => `<tr data-id="${S.escapeHtml(track.id)}"><td><strong>${S.escapeHtml(track.title)}</strong><div class="text-faint">${S.escapeHtml(track.artist)}</div></td><td><span class="badge ${track.enabled ? 'active' : 'inactive'}">${track.enabled ? 'Ativa' : 'Oculta'}</span></td><td>${S.escapeHtml(S.formatSize(track.size))}</td><td>${S.escapeHtml(S.formatDate(track.createdAt))}</td><td><div class="actions"><button class="button small" data-action="rename" type="button">Editar</button><button class="button small" data-action="toggle" data-enabled="${track.enabled}" type="button">${track.enabled ? 'Ocultar' : 'Ativar'}</button><button class="button small danger" data-action="delete" type="button">Excluir</button></div></td></tr>`).join('')}</tbody></table></div>`;
        root.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => action(button)));
    }
    async function uploadTrack(event) {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const message = document.getElementById('musicAdminMessage');
        const button = form.querySelector('button[type="submit"]'); button.disabled = true;
        try {
            const response = await fetch('/api/admin/music', { method: 'POST', credentials: 'same-origin', body: data });
            const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `Erro HTTP ${response.status}`);
            S.message(message, 'Faixa adicionada à biblioteca.', 'success'); form.reset(); await loadTracks();
        } catch (error) { S.message(message, error.message, 'error'); }
        finally { button.disabled = false; }
    }
    async function action(button) {
        const id = button.closest('tr').dataset.id; const track = tracks.find(item => item.id === id); if (!track) return;
        try {
            if (button.dataset.action === 'delete') {
                if (!confirm(`Excluir "${track.title}" permanentemente?`)) return;
                await S.api(`/api/admin/music/${encodeURIComponent(id)}`, { method: 'DELETE' });
            } else if (button.dataset.action === 'toggle') {
                await S.api(`/api/admin/music/${encodeURIComponent(id)}`, { method: 'PATCH', body: { enabled: button.dataset.enabled !== 'true' } });
            } else {
                const title = prompt('Título:', track.title); if (title === null) return;
                const artist = prompt('Artista:', track.artist); if (artist === null) return;
                await S.api(`/api/admin/music/${encodeURIComponent(id)}`, { method: 'PATCH', body: { title, artist } });
            }
            await loadTracks();
        } catch (error) { S.message(document.getElementById('musicAdminMessage'), error.message, 'error'); }
    }
    waitForAdmin();
})();
