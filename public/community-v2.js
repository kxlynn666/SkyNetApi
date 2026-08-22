(() => {
    const S = window.SkyNet;
    if (!S) return;

    const pathNow = () => location.pathname.replace(/\/+$/, '') || '/painel';
    let socket = null;
    let me = null;
    let groups = [];
    let friends = [];
    let currentGroup = null;
    let localStream = null;
    const peers = new Map();
    let callGroupId = null;

    function installStyles() {
        if (document.getElementById('communityV2Styles')) return;
        const style = document.createElement('style');
        style.id = 'communityV2Styles';
        style.textContent = `
            .profile-custom-card{margin-top:18px}.profile-custom-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.profile-custom-grid .form-group{margin:0}.profile-custom-span{grid-column:1/-1}.profile-custom-checks{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.profile-custom-check{display:flex;gap:8px;align-items:flex-start;padding:11px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.02)}
            .groups-layout{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:650px;border:1px solid var(--border);border-radius:18px;overflow:hidden;background:rgba(5,5,10,.28)}.groups-sidebar{border-right:1px solid var(--border);overflow:auto}.groups-head{padding:15px;border-bottom:1px solid var(--border)}.group-item{width:100%;border:0;border-bottom:1px solid var(--border);background:transparent;color:inherit;text-align:left;padding:14px;cursor:pointer}.group-item:hover,.group-item.active{background:rgba(168,85,247,.08)}.group-item strong,.group-item span{display:block}.group-item span{color:var(--muted);font-size:12px;margin-top:3px}.group-main{display:grid;grid-template-rows:auto 1fr auto;min-width:0}.group-header{display:flex;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border)}.group-title{flex:1}.group-title strong,.group-title span{display:block}.group-title span{font-size:12px;color:var(--muted)}.group-messages{padding:18px;overflow:auto;display:flex;flex-direction:column;gap:9px}.group-message{max-width:76%;padding:10px 12px;border-radius:15px;background:rgba(255,255,255,.06);align-self:flex-start}.group-message.mine{align-self:flex-end;background:rgba(168,85,247,.16);border:1px solid rgba(168,85,247,.22)}.group-message .meta{font-size:10px;color:var(--text-faint);margin-top:5px}.group-compose{display:flex;gap:10px;padding:14px;border-top:1px solid var(--border)}.group-compose input{flex:1}.group-placeholder{height:100%;display:grid;place-items:center;color:var(--muted);padding:32px;text-align:center}
            .group-create{display:grid;gap:10px}.group-friends{max-height:210px;overflow:auto;border:1px solid var(--border);border-radius:12px;padding:8px}.group-friend{display:flex;gap:9px;align-items:center;padding:8px;border-radius:9px}.group-friend:hover{background:rgba(255,255,255,.03)}
            .group-call-layer{position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,.72);backdrop-filter:blur(14px);display:grid;place-items:center;padding:20px}.group-call-card{width:min(900px,100%);max-height:92vh;overflow:auto;background:#0b0b12;border:1px solid var(--border);border-radius:24px;padding:22px}.group-call-head{display:flex;gap:12px;align-items:center;margin-bottom:16px}.group-call-head .grow{flex:1}.group-call-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.group-call-user{padding:15px;border:1px solid var(--border);border-radius:16px;background:rgba(255,255,255,.025);text-align:center}.group-call-avatar{width:66px;height:66px;border-radius:18px;object-fit:cover;margin:0 auto 10px;background:rgba(168,85,247,.14);display:grid;place-items:center;font-weight:900}.group-call-user strong,.group-call-user span{display:block}.group-call-user span{font-size:11px;color:var(--muted);margin-top:3px}.group-call-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}.group-call-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}
            .onecall-extra{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:10px}.onecall-volume{width:130px}
            .public-banner-v2{height:220px;border-radius:22px;overflow:hidden;border:1px solid var(--border);margin-bottom:-54px;background:linear-gradient(120deg,rgba(168,85,247,.18),rgba(255,255,255,.03));position:relative}.public-banner-v2 img{width:100%;height:100%;object-fit:cover}.public-tags-v2{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.public-tag-v2{padding:5px 9px;border-radius:999px;border:1px solid var(--border);font-size:11px}.public-xp-v2{margin-top:16px;padding:13px;border:1px solid var(--border);border-radius:14px}.public-xp-track{height:7px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px}.public-xp-fill{height:100%;border-radius:inherit;background:var(--profile-accent,#a855f7)}
            @media(max-width:850px){.groups-layout{grid-template-columns:1fr}.groups-sidebar{max-height:250px;border-right:0;border-bottom:1px solid var(--border)}.group-main{min-height:550px}.profile-custom-grid,.profile-custom-checks{grid-template-columns:1fr}.profile-custom-span{grid-column:auto}}
        `;
        document.head.appendChild(style);
    }

    function waitForWorkspace(callback) {
        const ready = () => document.getElementById('workspaceShell') && !document.getElementById('workspaceShell').classList.contains('hidden') && document.getElementById('workspaceSidebar')?.querySelector('a');
        if (ready()) return callback();
        const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); callback(); } });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        setTimeout(() => observer.disconnect(), 12000);
    }

    function setupSocket() {
        if (!window.io || socket) return;
        socket = window.io({ path: '/socket.io', transports: ['websocket', 'polling'] });
        socket.on('group:updated', () => { if (pathNow() === '/painel/grupos') loadGroups().catch(() => {}); });
        socket.on('group:message', ({ groupId }) => { if (currentGroup?.id === groupId) loadGroupMessages().catch(() => {}); });
        socket.on('group:message:deleted', ({ groupId, messageId }) => { if (currentGroup?.id === groupId) document.querySelector(`[data-group-message="${CSS.escape(messageId)}"]`)?.remove(); });
        socket.on('group:call:state', ({ groupId, participantIds }) => updateGroupCallBadge(groupId, participantIds));
        socket.on('group:call:participants', ({ groupId, participants }) => {
            if (groupId !== callGroupId) return;
            for (const id of participants) createPeer(id, true).catch(() => {});
            renderCallParticipants();
        });
        socket.on('group:call:peer-joined', ({ groupId }) => { if (groupId === callGroupId) renderCallParticipants(); });
        socket.on('group:call:peer-left', ({ groupId, userId }) => { if (groupId === callGroupId) closePeer(userId); renderCallParticipants(); });
        socket.on('group:call:error', ({ groupId, error }) => { if (groupId === callGroupId) { alert(error || 'Erro na chamada do grupo.'); leaveGroupCall(); } });
        socket.on('group:call:ended', ({ groupId, reason }) => { if (groupId === callGroupId) { alert(reason || 'Chamada encerrada.'); leaveGroupCall(false); } });
        socket.on('group:rtc:offer', async ({ groupId, from, data }) => {
            if (groupId !== callGroupId) return;
            const entry = await createPeer(from, false);
            await entry.pc.setRemoteDescription(data);
            await flushIce(entry);
            const answer = await entry.pc.createAnswer();
            await entry.pc.setLocalDescription(answer);
            socket.emit('group:rtc:answer', { groupId, to: from, data: answer });
        });
        socket.on('group:rtc:answer', async ({ groupId, from, data }) => {
            if (groupId !== callGroupId) return;
            const entry = peers.get(from); if (!entry) return;
            await entry.pc.setRemoteDescription(data); await flushIce(entry);
        });
        socket.on('group:rtc:ice', async ({ groupId, from, data }) => {
            if (groupId !== callGroupId || !data) return;
            const entry = peers.get(from) || await createPeer(from, false);
            if (!entry.pc.remoteDescription) entry.pendingIce.push(data);
            else try { await entry.pc.addIceCandidate(data); } catch {}
        });
    }

    function addGroupNav() {
        const socialGroup = document.getElementById('socialNavGroup');
        if (!socialGroup || socialGroup.querySelector('a[href="/painel/grupos"]')) return;
        const link = document.createElement('a');
        link.className = `workspace-nav-link ${pathNow() === '/painel/grupos' ? 'active' : ''}`;
        link.href = '/painel/grupos';
        link.innerHTML = '<span class="workspace-nav-icon"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0"/></svg></span><span>Grupos</span>';
        socialGroup.appendChild(link);
    }

    async function enhanceProfileEditor() {
        if (document.getElementById('profileCustomCard')) return;
        const root = document.getElementById('workspaceContent');
        if (!root) return;
        try {
            const [data, uploadsData] = await Promise.all([S.api('/api/community/profile/me'), S.api('/api/uploads')]);
            const c = data.custom;
            const uploads = uploadsData.uploads || [];
            const card = document.createElement('section');
            card.className = 'workspace-card profile-custom-card';
            card.id = 'profileCustomCard';
            card.innerHTML = `<div class="workspace-card-header"><div><h2>Personalização visual</h2><p>Defina aparência, banner, destaque e quais informações aparecem publicamente.</p></div></div><div class="message" id="profileCustomMessage"></div><form id="profileCustomForm" class="profile-custom-grid">
                <div class="form-group"><label>Frase de destaque</label><input name="headline" maxlength="90" value="${S.escapeHtml(c.headline || '')}" placeholder="Uma frase curta para o topo do perfil"></div>
                <div class="form-group"><label>Estilo</label><select name="style"><option value="clean" ${c.style === 'clean' ? 'selected' : ''}>Clean</option><option value="glass" ${c.style === 'glass' ? 'selected' : ''}>Glass</option><option value="contrast" ${c.style === 'contrast' ? 'selected' : ''}>Contraste</option></select></div>
                <div class="form-group"><label>Cor de destaque</label><input name="accent" type="color" value="${S.escapeHtml(c.accent || '#a855f7')}"></div>
                <div class="form-group"><label>Banner</label><select name="bannerUploadId"><option value="">Sem banner</option>${uploads.map(item => `<option value="${S.escapeHtml(item.id)}" ${item.id === c.bannerUploadId ? 'selected' : ''}>${S.escapeHtml(item.originalName)}</option>`).join('')}</select></div>
                <div class="form-group profile-custom-span"><label>Tags</label><input name="tags" maxlength="220" value="${S.escapeHtml((c.tags || []).join(', '))}" placeholder="Linux, JavaScript, Design..."><div class="hint">Até 8 tags, separadas por vírgula.</div></div>
                <div class="profile-custom-span profile-custom-checks">
                    ${customCheck('showXp','Mostrar XP e level',c.showXp)}${customCheck('showJoinDate','Mostrar data de entrada',c.showJoinDate)}${customCheck('showFriendCount','Mostrar total de amigos',c.showFriendCount)}
                </div>
                <div class="profile-custom-span"><button class="button primary" type="submit">Salvar personalização</button></div>
            </form>`;
            root.appendChild(card);
            document.getElementById('profileCustomForm').addEventListener('submit', async event => {
                event.preventDefault(); const form = new FormData(event.currentTarget); const message = document.getElementById('profileCustomMessage');
                const body = { headline: form.get('headline'), style: form.get('style'), accent: form.get('accent'), bannerUploadId: form.get('bannerUploadId'), tags: String(form.get('tags') || '').split(',').map(x => x.trim()).filter(Boolean), showXp: form.get('showXp') === 'on', showJoinDate: form.get('showJoinDate') === 'on', showFriendCount: form.get('showFriendCount') === 'on' };
                try { await S.api('/api/community/profile/me', { method: 'PATCH', body }); S.message(message, 'Personalização salva.', 'success'); }
                catch (error) { S.message(message, error.message, 'error'); }
            });
        } catch {}
    }

    function customCheck(name, label, checked) { return `<label class="profile-custom-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span>${S.escapeHtml(label)}</span></label>`; }

    async function renderGroupsPage() {
        document.getElementById('workspaceKicker').textContent = 'Social';
        document.getElementById('workspaceTitle').textContent = 'Grupos';
        document.getElementById('workspaceDescription').textContent = 'Crie grupos com amigos, converse e entre em chamadas de voz em grupo.';
        document.title = 'Grupos - SkyNetApi';
        document.querySelectorAll('.workspace-nav-link').forEach(link => link.classList.toggle('active', link.getAttribute('href') === '/painel/grupos'));
        me = await S.session();
        const social = await S.api('/api/social/friends');
        friends = social.friends || [];
        document.getElementById('workspaceContent').innerHTML = `<section class="workspace-card" style="margin-bottom:18px"><div class="workspace-card-header"><div><h2>Novo grupo</h2><p>Adicione apenas amigos aceitos. Até 12 membros por grupo e 6 simultâneos na call.</p></div></div><div class="message" id="groupPageMessage"></div><form id="groupCreateForm" class="group-create"><input name="name" maxlength="60" placeholder="Nome do grupo" required><div class="group-friends">${friends.length ? friends.map(friend => `<label class="group-friend"><input type="checkbox" name="member" value="${S.escapeHtml(friend.id)}"><span>${S.escapeHtml(friend.displayName || friend.username)} <span class="text-faint">@${S.escapeHtml(friend.username)}</span></span></label>`).join('') : '<div class="hint">Adicione amigos primeiro para criar um grupo com outras pessoas.</div>'}</div><button class="button primary" type="submit">Criar grupo</button></form></section><div class="groups-layout"><aside class="groups-sidebar"><div class="groups-head"><strong>Seus grupos</strong><div class="hint">Chat e voz</div></div><div id="groupsList"></div></aside><section class="group-main" id="groupMain"><div class="group-placeholder">Selecione um grupo.</div></section></div>`;
        document.getElementById('groupCreateForm').addEventListener('submit', createGroup);
        await loadGroups();
    }

    async function createGroup(event) {
        event.preventDefault(); const form = new FormData(event.currentTarget); const message = document.getElementById('groupPageMessage');
        const memberIds = form.getAll('member');
        try { const data = await S.api('/api/community/groups', { method: 'POST', body: { name: form.get('name'), memberIds } }); event.currentTarget.reset(); await loadGroups(); openGroup(data.group.id); S.message(message, 'Grupo criado.', 'success'); }
        catch (error) { S.message(message, error.message, 'error'); }
    }

    async function loadGroups() {
        const data = await S.api('/api/community/groups'); groups = data.groups || [];
        const list = document.getElementById('groupsList'); if (!list) return;
        list.innerHTML = groups.length ? groups.map(group => `<button class="group-item ${currentGroup?.id === group.id ? 'active' : ''}" data-group-id="${group.id}"><strong>${S.escapeHtml(group.name)}</strong><span>${group.members.length} membros${group.callParticipantIds?.length ? ` · ${group.callParticipantIds.length} na call` : ''}</span></button>`).join('') : '<div class="social-empty" style="margin:14px">Nenhum grupo ainda.</div>';
        list.querySelectorAll('[data-group-id]').forEach(button => button.addEventListener('click', () => openGroup(button.dataset.groupId)));
        if (currentGroup) {
            const fresh = groups.find(item => item.id === currentGroup.id);
            if (fresh) currentGroup = fresh;
        }
    }

    async function openGroup(id) {
        currentGroup = groups.find(item => item.id === id); if (!currentGroup) return;
        await loadGroups();
        const main = document.getElementById('groupMain');
        main.innerHTML = `<header class="group-header"><div class="group-title"><strong>${S.escapeHtml(currentGroup.name)}</strong><span>${currentGroup.members.length} membros · <span id="groupCallStatus">${currentGroup.callParticipantIds?.length || 0} na call</span></span></div><button class="button small primary" id="groupJoinCall">Entrar na call</button>${currentGroup.isOwner ? '<button class="button small" id="groupManage">Gerenciar</button>' : '<button class="button small" id="groupLeave">Sair</button>'}</header><div class="group-messages" id="groupMessages"><div class="social-empty">Carregando mensagens...</div></div><form class="group-compose" id="groupCompose"><input id="groupInput" maxlength="2000" autocomplete="off" placeholder="Mensagem no grupo..."><button class="button primary">Enviar</button></form>`;
        document.getElementById('groupJoinCall').addEventListener('click', joinGroupCall);
        document.getElementById('groupCompose').addEventListener('submit', sendGroupMessage);
        document.getElementById('groupManage')?.addEventListener('click', manageGroup);
        document.getElementById('groupLeave')?.addEventListener('click', leaveGroup);
        await loadGroupMessages();
    }

    async function loadGroupMessages() {
        if (!currentGroup) return;
        const data = await S.api(`/api/community/groups/${encodeURIComponent(currentGroup.id)}/messages?limit=100`);
        const box = document.getElementById('groupMessages'); if (!box) return;
        box.innerHTML = data.messages.length ? data.messages.map(msg => {
            const mine = msg.fromId === me?.id;
            return `<div class="group-message ${mine ? 'mine' : ''}" data-group-message="${msg.id}"><strong>${S.escapeHtml(msg.sender.displayName || msg.sender.username)}</strong><div>${S.escapeHtml(msg.text)}</div><div class="meta">${S.escapeHtml(S.formatDate(msg.createdAt))}${mine || currentGroup.isOwner ? ` · <button class="link-button" data-delete-group-message="${msg.id}" type="button">apagar</button>` : ''}</div></div>`;
        }).join('') : '<div class="social-empty">Nenhuma mensagem ainda.</div>';
        box.scrollTop = box.scrollHeight;
        box.querySelectorAll('[data-delete-group-message]').forEach(button => button.addEventListener('click', async () => { if (!confirm('Apagar mensagem?')) return; try { await S.api(`/api/community/groups/${encodeURIComponent(currentGroup.id)}/messages/${encodeURIComponent(button.dataset.deleteGroupMessage)}`, { method: 'DELETE' }); } catch (e) { alert(e.message); } }));
    }

    async function sendGroupMessage(event) {
        event.preventDefault(); if (!currentGroup) return;
        const input = document.getElementById('groupInput'); const text = input.value.trim(); if (!text) return; input.value = '';
        try { await S.api(`/api/community/groups/${encodeURIComponent(currentGroup.id)}/messages`, { method: 'POST', body: { text } }); }
        catch (error) { input.value = text; alert(error.message); }
    }

    async function manageGroup() {
        const group = currentGroup; if (!group?.isOwner) return;
        const name = prompt('Nome do grupo:', group.name); if (name === null) return;
        const currentIds = new Set(group.members.map(x => x.id));
        const choices = friends.map(friend => `${currentIds.has(friend.id) ? '[x]' : '[ ]'} ${friend.username} — ${friend.id}`).join('\n');
        const raw = prompt(`IDs dos amigos que devem permanecer no grupo, separados por vírgula.\n\nAmigos disponíveis:\n${choices}`, [...currentIds].filter(id => id !== me.id).join(','));
        if (raw === null) return;
        const memberIds = raw.split(',').map(x => x.trim()).filter(Boolean);
        try { await S.api(`/api/community/groups/${encodeURIComponent(group.id)}`, { method: 'PATCH', body: { name, memberIds } }); await loadGroups(); await openGroup(group.id); }
        catch (error) { alert(error.message); }
    }

    async function leaveGroup() { if (!currentGroup || !confirm('Sair deste grupo?')) return; await S.api(`/api/community/groups/${encodeURIComponent(currentGroup.id)}/leave`, { method: 'POST' }); currentGroup = null; document.getElementById('groupMain').innerHTML = '<div class="group-placeholder">Selecione um grupo.</div>'; await loadGroups(); }

    async function joinGroupCall() {
        if (!currentGroup) return;
        if (!socket?.connected) return alert('Serviço de chamada desconectado.');
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
            callGroupId = currentGroup.id;
            showGroupCall();
            socket.emit('group:call:join', { groupId: callGroupId });
        } catch (error) { alert(error.message || 'Não foi possível acessar o microfone.'); }
    }

    function showGroupCall() {
        document.getElementById('groupCallLayer')?.remove();
        const layer = document.createElement('div'); layer.className = 'group-call-layer'; layer.id = 'groupCallLayer';
        layer.innerHTML = `<div class="group-call-card"><div class="group-call-head"><div class="grow"><div class="eyebrow">Chamada em grupo</div><h2 style="margin:4px 0">${S.escapeHtml(currentGroup?.name || 'Grupo')}</h2><div class="hint">Áudio P2P · até 6 participantes</div></div></div><div class="group-call-grid" id="groupCallGrid"></div><div class="group-call-toolbar"><button class="button" id="groupMicToggle">Mutar microfone</button><button class="button" id="groupMuteAll">Silenciar todos</button><button class="button danger" id="groupCallLeave">Sair da call</button></div></div>`;
        document.body.appendChild(layer);
        document.getElementById('groupMicToggle').addEventListener('click', toggleGroupMic);
        document.getElementById('groupMuteAll').addEventListener('click', toggleMuteAll);
        document.getElementById('groupCallLeave').addEventListener('click', () => leaveGroupCall());
        renderCallParticipants();
    }

    async function createPeer(userId, initiator) {
        if (peers.has(userId)) return peers.get(userId);
        const rtc = await S.api('/api/social/rtc-config');
        const pc = new RTCPeerConnection({ iceServers: rtc.iceServers || [] });
        const audio = document.createElement('audio'); audio.autoplay = true; audio.dataset.peerAudio = userId;
        const entry = { pc, audio, pendingIce: [], muted: false };
        peers.set(userId, entry);
        localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));
        pc.onicecandidate = event => { if (event.candidate && callGroupId) socket.emit('group:rtc:ice', { groupId: callGroupId, to: userId, data: event.candidate }); };
        pc.ontrack = event => { audio.srcObject = event.streams[0]; audio.play().catch(() => {}); renderCallParticipants(); };
        pc.onconnectionstatechange = () => { if (['failed','closed','disconnected'].includes(pc.connectionState)) { closePeer(userId); renderCallParticipants(); } };
        if (initiator) { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit('group:rtc:offer', { groupId: callGroupId, to: userId, data: offer }); }
        renderCallParticipants();
        return entry;
    }

    async function flushIce(entry) { while (entry.pendingIce.length) { const c = entry.pendingIce.shift(); try { await entry.pc.addIceCandidate(c); } catch {} } }
    function closePeer(id) { const entry = peers.get(id); if (!entry) return; try { entry.pc.close(); } catch {} entry.audio.srcObject = null; peers.delete(id); }

    function renderCallParticipants() {
        const grid = document.getElementById('groupCallGrid'); if (!grid) return;
        const members = currentGroup?.members || [];
        const own = me || {};
        const cards = [{ id: own.id, displayName: own.username, username: own.username, self: true }, ...[...peers.keys()].map(id => members.find(m => m.id === id) || { id, displayName: 'Participante', username: id.slice(0,8) })];
        grid.innerHTML = cards.map(user => {
            const initial = String(user.displayName || user.username || '?').slice(0,1).toUpperCase();
            const avatar = user.avatarUrl ? `<img class="group-call-avatar" src="${S.escapeHtml(user.avatarUrl)}" alt="">` : `<div class="group-call-avatar">${S.escapeHtml(initial)}</div>`;
            const entry = peers.get(user.id);
            return `<div class="group-call-user" data-call-user="${S.escapeHtml(user.id || 'self')}">${avatar}<strong>${S.escapeHtml(user.self ? 'Você' : (user.displayName || user.username))}</strong><span>${user.self ? 'microfone local' : `@${S.escapeHtml(user.username || '')}`}</span>${user.self ? '' : `<div class="group-call-actions"><button class="button small" data-mute-peer="${S.escapeHtml(user.id)}">${entry?.muted ? 'Ativar áudio' : 'Silenciar usuário'}</button></div>`}</div>`;
        }).join('');
        for (const [id, entry] of peers) { const card = grid.querySelector(`[data-call-user="${CSS.escape(id)}"]`); if (card && !card.contains(entry.audio)) card.appendChild(entry.audio); }
        grid.querySelectorAll('[data-mute-peer]').forEach(button => button.addEventListener('click', () => togglePeerMute(button.dataset.mutePeer)));
    }

    function togglePeerMute(id) { const entry = peers.get(id); if (!entry) return; entry.muted = !entry.muted; entry.audio.muted = entry.muted; renderCallParticipants(); }
    function toggleGroupMic(event) { const track = localStream?.getAudioTracks()?.[0]; if (!track) return; track.enabled = !track.enabled; event.currentTarget.textContent = track.enabled ? 'Mutar microfone' : 'Ativar microfone'; }
    function toggleMuteAll(event) { const shouldMute = [...peers.values()].some(entry => !entry.muted); for (const entry of peers.values()) { entry.muted = shouldMute; entry.audio.muted = shouldMute; } event.currentTarget.textContent = shouldMute ? 'Ativar todos' : 'Silenciar todos'; renderCallParticipants(); }
    function leaveGroupCall(emit = true) { if (emit && callGroupId) socket?.emit('group:call:leave', { groupId: callGroupId }); for (const id of [...peers.keys()]) closePeer(id); localStream?.getTracks().forEach(track => track.stop()); localStream = null; callGroupId = null; document.getElementById('groupCallLayer')?.remove(); }
    function updateGroupCallBadge(groupId, ids) { if (currentGroup?.id === groupId) { currentGroup.callParticipantIds = ids || []; const el = document.getElementById('groupCallStatus'); if (el) el.textContent = `${ids?.length || 0} na call`; } }

    function enhanceOneToOneCall() {
        const patch = () => {
            const layer = document.getElementById('callLayer'); if (!layer || layer.querySelector('.onecall-extra')) return;
            const audio = layer.querySelector('#remoteAudio'); if (!audio) return;
            const extra = document.createElement('div'); extra.className = 'onecall-extra';
            extra.innerHTML = '<button class="button small" id="muteRemoteUser" type="button">Silenciar usuário</button><label class="hint">Volume <input class="onecall-volume" id="remoteVolume" type="range" min="0" max="1" value="1" step="0.05"></label>';
            layer.querySelector('.call-card')?.appendChild(extra);
            extra.querySelector('#muteRemoteUser').addEventListener('click', event => { audio.muted = !audio.muted; event.currentTarget.textContent = audio.muted ? 'Ativar áudio do usuário' : 'Silenciar usuário'; });
            extra.querySelector('#remoteVolume').addEventListener('input', event => { audio.volume = Number(event.currentTarget.value); });
        };
        patch(); const observer = new MutationObserver(patch); observer.observe(document.body, { childList: true, subtree: true });
    }

    async function enhancePublicProfile() {
        const parts = location.pathname.split('/').filter(Boolean); const username = decodeURIComponent(parts[1] || ''); if (!username) return;
        try {
            const data = await S.api(`/api/community/profile/${encodeURIComponent(username)}`); const p = data.profile;
            document.documentElement.style.setProperty('--profile-accent', p.accent || '#a855f7');
            const root = document.getElementById('publicProfileRoot'); if (!root) return;
            const decorate = () => {
                const profile = root.querySelector('.public-profile'); if (!profile || root.dataset.v2Decorated) return;
                root.dataset.v2Decorated = '1';
                if (p.bannerUrl) { const banner = document.createElement('div'); banner.className = 'public-banner-v2'; banner.innerHTML = `<img src="${S.escapeHtml(p.bannerUrl)}" alt="">`; root.prepend(banner); profile.style.position = 'relative'; }
                profile.style.setProperty('--profile-accent', p.accent || '#a855f7');
                const main = profile.querySelector('div:last-child') || profile;
                if (p.headline) { const headline = document.createElement('div'); headline.className = 'muted'; headline.style.marginTop = '10px'; headline.textContent = p.headline; main.querySelector('.public-handle')?.insertAdjacentElement('afterend', headline); }
                if (p.tags?.length) { const tags = document.createElement('div'); tags.className = 'public-tags-v2'; tags.innerHTML = p.tags.map(tag => `<span class="public-tag-v2">${S.escapeHtml(tag)}</span>`).join(''); main.appendChild(tags); }
                if (p.xp) { const xp = document.createElement('div'); xp.className = 'public-xp-v2'; xp.innerHTML = `<strong>Level ${Number(p.xp.level)} · ${Number(p.xp.totalXp).toLocaleString('pt-BR')} XP</strong><div class="public-xp-track"><div class="public-xp-fill" style="width:${Number(p.xp.progressPercent || 0)}%"></div></div>`; main.appendChild(xp); }
            };
            decorate(); const observer = new MutationObserver(decorate); observer.observe(root, { childList: true, subtree: true }); setTimeout(() => observer.disconnect(), 10000);
        } catch {}
    }

    async function bootWorkspace() {
        installStyles(); setupSocket(); enhanceOneToOneCall();
        setTimeout(addGroupNav, 60);
        const navObserver = new MutationObserver(addGroupNav); navObserver.observe(document.getElementById('workspaceSidebar'), { childList: true, subtree: true });
        if (pathNow() === '/painel/perfil') setTimeout(enhanceProfileEditor, 250);
        if (pathNow() === '/painel/grupos') await renderGroupsPage();
    }

    installStyles();
    if (pathNow().startsWith('/painel')) waitForWorkspace(bootWorkspace);
    if (pathNow().startsWith('/u/')) enhancePublicProfile();
})();
