const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');
const { getXpView } = require('./xp-admin');

const PROFILE_FILE = path.join(C.DATA_DIR, 'profile-custom.json');
const GROUPS_FILE = path.join(C.DATA_DIR, 'social-groups.json');
const GROUP_MESSAGES_FILE = path.join(C.DATA_DIR, 'social-group-messages.json');
const FRIENDS_FILE = path.join(C.DATA_DIR, 'social-friends.json');
const BLOCKS_FILE = path.join(C.DATA_DIR, 'social-blocks.json');
const DM_MESSAGES_FILE = path.join(C.DATA_DIR, 'social-messages.json');
const MAX_GROUP_MEMBERS = 12;
const MAX_GROUP_CALL = 6;
const MAX_GROUP_MESSAGES = 30000;
let ioServer = null;
const groupCallMembers = new Map();

function registerCommunityV2Routes(app) {
    ensureStorage();
    const json = express.json({ limit: '96kb' });
    app.use('/api/community', json);
    app.use('/api/admin/community', json);

    app.get('/community-banner/:accountId', (req, res) => {
        const account = S.loadAccounts().find(item => item.id === req.params.accountId && item.active);
        if (!account) return res.status(404).end();
        const custom = getCustomProfile(account.id);
        const upload = custom.bannerUploadId
            ? S.loadUploads().find(item => item.id === custom.bannerUploadId && item.accountId === account.id)
            : null;
        if (!upload) return res.status(404).end();
        const filepath = path.join(C.UPLOADS_DIR, path.basename(upload.filename));
        if (!fs.existsSync(filepath)) return res.status(404).end();
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.sendFile(filepath);
    });

    app.get('/api/community/leaderboard', (req, res) => {
        const limit = clampInt(req.query?.limit, 3, 50, 20);
        const friends = readArray(FRIENDS_FILE);
        const accounts = S.loadAccounts().filter(item => item.active && accountProfile(item).privacy.showOnPodium);
        const leaderboard = accounts.map(account => {
            const xp = getXpView(account.id);
            const profile = accountProfile(account);
            const custom = getCustomProfile(account.id);
            const friendCount = friends.filter(item => item.status === 'accepted' && (item.senderId === account.id || item.receiverId === account.id)).length;
            return {
                id: account.id,
                username: account.username,
                displayName: profile.displayName,
                avatarUrl: avatarUrl(account),
                accent: custom.accent,
                headline: custom.headline,
                level: xp.level,
                xp: xp.totalXp,
                friendCount
            };
        }).sort((a, b) => b.xp - a.xp || b.level - a.level || a.username.localeCompare(b.username))
            .slice(0, limit)
            .map((item, index) => ({ ...item, place: index + 1 }));
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, scoring: 'Ranking por XP total', leaderboard });
    });

    app.get('/api/community/profile/me', requireSession, (req, res) => {
        return res.json({ ok: true, custom: getCustomProfile(req.account.id), public: publicCustomProfile(req.account) });
    });

    app.patch('/api/community/profile/me', requireTrustedOrigin, requireSession, (req, res) => {
        const custom = sanitizeCustomProfile(req.account.id, req.body || {}, getCustomProfile(req.account.id));
        saveCustomProfile(custom);
        return res.json({ ok: true, custom, public: publicCustomProfile(req.account) });
    });

    app.get('/api/community/profile/:username', (req, res) => {
        const username = S.normalizeUsername(req.params.username);
        const account = S.loadAccounts().find(item => item.active && S.normalizeUsername(item.usernameLower || item.username) === username);
        if (!account) return res.status(404).json({ ok: false, error: 'Perfil não encontrado.' });
        return res.json({ ok: true, profile: publicCustomProfile(account) });
    });

    app.get('/api/community/groups', requireSession, (req, res) => {
        const groups = loadGroups().filter(group => group.memberIds.includes(req.account.id)).map(group => publicGroup(group, req.account.id));
        return res.json({ ok: true, groups });
    });

    app.post('/api/community/groups', requireTrustedOrigin, requireSession, (req, res) => {
        const name = cleanText(req.body?.name, 60);
        if (name.length < 2) return res.status(400).json({ ok: false, error: 'O nome do grupo precisa ter ao menos 2 caracteres.' });
        const requested = uniqueIds(req.body?.memberIds).filter(id => id !== req.account.id);
        if (requested.length + 1 > MAX_GROUP_MEMBERS) return res.status(400).json({ ok: false, error: `Grupos aceitam até ${MAX_GROUP_MEMBERS} membros.` });
        for (const id of requested) {
            if (!isFriend(req.account.id, id)) return res.status(400).json({ ok: false, error: 'Você só pode adicionar amigos ao grupo.' });
        }
        const group = {
            id: randomId(),
            name,
            ownerId: req.account.id,
            memberIds: [req.account.id, ...requested],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const groups = loadGroups();
        groups.push(group);
        saveGroups(groups);
        notifyGroupRefresh(group);
        return res.status(201).json({ ok: true, group: publicGroup(group, req.account.id) });
    });

    app.patch('/api/community/groups/:id', requireTrustedOrigin, requireSession, (req, res) => {
        const groups = loadGroups();
        const group = groups.find(item => item.id === req.params.id);
        if (!group) return res.status(404).json({ ok: false, error: 'Grupo não encontrado.' });
        if (group.ownerId !== req.account.id) return res.status(403).json({ ok: false, error: 'Somente o criador pode editar o grupo.' });
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
            const name = cleanText(req.body.name, 60);
            if (name.length < 2) return res.status(400).json({ ok: false, error: 'Nome de grupo inválido.' });
            group.name = name;
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'memberIds')) {
            const requested = uniqueIds(req.body.memberIds).filter(id => id !== req.account.id);
            if (requested.length + 1 > MAX_GROUP_MEMBERS) return res.status(400).json({ ok: false, error: `Grupos aceitam até ${MAX_GROUP_MEMBERS} membros.` });
            for (const id of requested) if (!isFriend(req.account.id, id)) return res.status(400).json({ ok: false, error: 'Todos os membros precisam ser seus amigos.' });
            group.memberIds = [req.account.id, ...requested];
        }
        group.updatedAt = new Date().toISOString();
        saveGroups(groups);
        notifyGroupRefresh(group);
        return res.json({ ok: true, group: publicGroup(group, req.account.id) });
    });

    app.post('/api/community/groups/:id/leave', requireTrustedOrigin, requireSession, (req, res) => {
        const groups = loadGroups();
        const group = groups.find(item => item.id === req.params.id);
        if (!group || !group.memberIds.includes(req.account.id)) return res.status(404).json({ ok: false, error: 'Grupo não encontrado.' });
        if (group.ownerId === req.account.id) return res.status(400).json({ ok: false, error: 'O criador deve excluir o grupo em vez de sair.' });
        group.memberIds = group.memberIds.filter(id => id !== req.account.id);
        group.updatedAt = new Date().toISOString();
        saveGroups(groups);
        removeFromGroupCall(group.id, req.account.id);
        notifyGroupRefresh(group);
        return res.json({ ok: true });
    });

    app.delete('/api/community/groups/:id', requireTrustedOrigin, requireSession, (req, res) => {
        const groups = loadGroups();
        const group = groups.find(item => item.id === req.params.id);
        if (!group) return res.status(404).json({ ok: false, error: 'Grupo não encontrado.' });
        if (group.ownerId !== req.account.id) return res.status(403).json({ ok: false, error: 'Somente o criador pode excluir o grupo.' });
        saveGroups(groups.filter(item => item.id !== group.id));
        saveGroupMessages(loadGroupMessages().filter(item => item.groupId !== group.id));
        const call = groupCallMembers.get(group.id);
        if (call) {
            for (const userId of call) ioServer?.to(userRoom(userId)).emit('group:call:ended', { groupId: group.id, reason: 'Grupo excluído.' });
            groupCallMembers.delete(group.id);
        }
        notifyGroupRefresh(group);
        return res.json({ ok: true });
    });

    app.get('/api/community/groups/:id/messages', requireSession, (req, res) => {
        const group = requireGroupMember(req.params.id, req.account.id);
        if (!group) return res.status(403).json({ ok: false, error: 'Você não participa desse grupo.' });
        const limit = clampInt(req.query?.limit, 1, 150, 80);
        const messages = loadGroupMessages().filter(item => item.groupId === group.id).slice(-limit).map(publicGroupMessage);
        return res.json({ ok: true, messages });
    });

    app.post('/api/community/groups/:id/messages', requireTrustedOrigin, requireSession, (req, res) => {
        const group = requireGroupMember(req.params.id, req.account.id);
        if (!group) return res.status(403).json({ ok: false, error: 'Você não participa desse grupo.' });
        const text = cleanText(req.body?.text, 2000);
        if (!text) return res.status(400).json({ ok: false, error: 'Mensagem vazia.' });
        const messages = loadGroupMessages();
        const message = { id: randomId(), groupId: group.id, fromId: req.account.id, text, createdAt: new Date().toISOString() };
        messages.push(message);
        saveGroupMessages(messages.slice(-MAX_GROUP_MESSAGES));
        ioServer?.to(groupRoom(group.id)).emit('group:message', { groupId: group.id, message: publicGroupMessage(message) });
        return res.status(201).json({ ok: true, message: publicGroupMessage(message) });
    });

    app.delete('/api/community/groups/:groupId/messages/:messageId', requireTrustedOrigin, requireSession, (req, res) => {
        const group = requireGroupMember(req.params.groupId, req.account.id);
        if (!group) return res.status(403).json({ ok: false, error: 'Você não participa desse grupo.' });
        const messages = loadGroupMessages();
        const index = messages.findIndex(item => item.id === req.params.messageId && item.groupId === group.id);
        if (index === -1) return res.status(404).json({ ok: false, error: 'Mensagem não encontrada.' });
        if (messages[index].fromId !== req.account.id && group.ownerId !== req.account.id) return res.status(403).json({ ok: false, error: 'Sem permissão para apagar esta mensagem.' });
        const [removed] = messages.splice(index, 1);
        saveGroupMessages(messages);
        ioServer?.to(groupRoom(group.id)).emit('group:message:deleted', { groupId: group.id, messageId: removed.id });
        return res.json({ ok: true });
    });

    app.get('/api/admin/community/users', requireAdmin, (req, res) => {
        const groups = loadGroups();
        const friends = readArray(FRIENDS_FILE);
        const blocks = readArray(BLOCKS_FILE);
        const users = S.loadAccounts().map(account => ({
            id: account.id,
            custom: getCustomProfile(account.id),
            friendIds: friendIdsFor(account.id, friends),
            blockedIds: blocks.filter(item => item.blockerId === account.id).map(item => item.blockedId),
            groupIds: groups.filter(group => group.memberIds.includes(account.id)).map(group => group.id)
        }));
        return res.json({ ok: true, users, groups: groups.map(group => ({ id: group.id, name: group.name, ownerId: group.ownerId, memberIds: group.memberIds })) });
    });

    app.patch('/api/admin/community/users/:id', requireTrustedOrigin, requireAdmin, (req, res) => {
        const account = S.loadAccounts().find(item => item.id === req.params.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        const body = req.body || {};
        if (body.custom && typeof body.custom === 'object') saveCustomProfile(sanitizeCustomProfile(account.id, body.custom, getCustomProfile(account.id)));
        if (Array.isArray(body.friendIds)) overwriteFriends(account.id, body.friendIds);
        if (Array.isArray(body.blockedIds)) overwriteBlocks(account.id, body.blockedIds);
        if (Array.isArray(body.groupIds)) overwriteGroupMemberships(account.id, body.groupIds);
        return res.json({ ok: true });
    });

    app.post('/api/admin/community/users/:id/purge-messages', requireTrustedOrigin, requireAdmin, (req, res) => {
        const account = S.loadAccounts().find(item => item.id === req.params.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        writeArray(DM_MESSAGES_FILE, readArray(DM_MESSAGES_FILE).filter(item => item.fromId !== account.id && item.toId !== account.id));
        saveGroupMessages(loadGroupMessages().filter(item => item.fromId !== account.id));
        return res.json({ ok: true });
    });
}

function attachCommunitySocket(io) {
    ioServer = io;
    io.on('connection', socket => {
        const account = socket.account;
        if (!account) return;
        for (const group of loadGroups().filter(item => item.memberIds.includes(account.id))) socket.join(groupRoom(group.id));

        socket.on('group:call:join', payload => {
            const groupId = cleanText(payload?.groupId, 80);
            const group = requireGroupMember(groupId, account.id);
            if (!group) return socket.emit('group:call:error', { groupId, error: 'Você não participa desse grupo.' });
            let set = groupCallMembers.get(groupId);
            if (!set) { set = new Set(); groupCallMembers.set(groupId, set); }
            if (!set.has(account.id) && set.size >= MAX_GROUP_CALL) return socket.emit('group:call:error', { groupId, error: `A call do grupo suporta até ${MAX_GROUP_CALL} participantes.` });
            const participants = [...set].filter(id => id !== account.id);
            set.add(account.id);
            socket.join(groupCallRoom(groupId));
            socket.emit('group:call:participants', { groupId, participants });
            socket.to(groupCallRoom(groupId)).emit('group:call:peer-joined', { groupId, user: basicUser(account) });
            io.to(groupRoom(groupId)).emit('group:call:state', { groupId, participantIds: [...set] });
        });

        socket.on('group:call:leave', payload => removeFromGroupCall(cleanText(payload?.groupId, 80), account.id, socket));

        for (const event of ['group:rtc:offer', 'group:rtc:answer', 'group:rtc:ice']) {
            socket.on(event, payload => {
                const groupId = cleanText(payload?.groupId, 80);
                const to = cleanText(payload?.to, 80);
                const set = groupCallMembers.get(groupId);
                if (!set?.has(account.id) || !set.has(to)) return;
                io.to(userRoom(to)).emit(event, { groupId, from: account.id, data: payload?.data || null });
            });
        }

        socket.on('disconnect', () => {
            for (const [groupId, set] of groupCallMembers) if (set.has(account.id)) removeFromGroupCall(groupId, account.id, null);
        });
    });
}

function sanitizeCustomProfile(accountId, input, current) {
    const bannerUploadId = Object.prototype.hasOwnProperty.call(input, 'bannerUploadId') ? cleanText(input.bannerUploadId, 80) : current.bannerUploadId;
    if (bannerUploadId && !S.loadUploads().some(item => item.id === bannerUploadId && item.accountId === accountId)) throw httpError('O banner precisa ser um upload da própria conta.');
    const tags = Array.isArray(input.tags) ? input.tags.map(item => cleanText(item, 24)).filter(Boolean).slice(0, 8) : current.tags;
    const style = ['clean', 'glass', 'contrast'].includes(input.style) ? input.style : current.style;
    return {
        accountId,
        accent: /^#[0-9a-f]{6}$/i.test(String(input.accent || '')) ? String(input.accent) : current.accent,
        bannerUploadId,
        headline: Object.prototype.hasOwnProperty.call(input, 'headline') ? cleanText(input.headline, 90) : current.headline,
        tags,
        style,
        showXp: typeof input.showXp === 'boolean' ? input.showXp : current.showXp,
        showJoinDate: typeof input.showJoinDate === 'boolean' ? input.showJoinDate : current.showJoinDate,
        showFriendCount: typeof input.showFriendCount === 'boolean' ? input.showFriendCount : current.showFriendCount,
        updatedAt: new Date().toISOString()
    };
}

function getCustomProfile(accountId) {
    const found = loadCustomProfiles().find(item => item.accountId === accountId);
    return found || { accountId, accent: '#a855f7', bannerUploadId: '', headline: '', tags: [], style: 'clean', showXp: true, showJoinDate: true, showFriendCount: true, updatedAt: null };
}

function saveCustomProfile(profile) {
    const all = loadCustomProfiles();
    const index = all.findIndex(item => item.accountId === profile.accountId);
    if (index === -1) all.push(profile); else all[index] = profile;
    writeArray(PROFILE_FILE, all);
}

function publicCustomProfile(account) {
    const custom = getCustomProfile(account.id);
    const base = accountProfile(account);
    const friends = readArray(FRIENDS_FILE);
    const xp = getXpView(account.id);
    return {
        id: account.id,
        username: account.username,
        displayName: base.displayName,
        bio: base.bio,
        status: base.status,
        avatarUrl: avatarUrl(account),
        bannerUrl: custom.bannerUploadId ? `/community-banner/${encodeURIComponent(account.id)}` : null,
        accent: custom.accent,
        headline: custom.headline,
        tags: custom.tags,
        style: custom.style,
        xp: custom.showXp ? { totalXp: xp.totalXp, level: xp.level, progressPercent: xp.progressPercent } : null,
        friendCount: custom.showFriendCount ? friendIdsFor(account.id, friends).length : null,
        createdAt: custom.showJoinDate ? account.createdAt : null
    };
}

function accountProfile(account) {
    const p = account?.profile && typeof account.profile === 'object' ? account.profile : {};
    const privacy = p.privacy && typeof p.privacy === 'object' ? p.privacy : {};
    return {
        displayName: cleanText(p.displayName, 50) || account.username,
        bio: cleanText(p.bio, 320),
        status: cleanText(p.status, 60),
        avatarUploadId: cleanText(p.avatarUploadId, 80),
        privacy: {
            allowFriendRequests: privacy.allowFriendRequests !== false,
            allowCallsFromFriends: privacy.allowCallsFromFriends !== false,
            showOnPodium: privacy.showOnPodium !== false,
            showOnline: privacy.showOnline !== false
        }
    };
}

function avatarUrl(account) {
    const id = accountProfile(account).avatarUploadId;
    return id && S.loadUploads().some(item => item.id === id && item.accountId === account.id) ? `/social-avatar/${encodeURIComponent(account.id)}` : null;
}

function publicGroup(group, viewerId) {
    const accounts = S.loadAccounts();
    return {
        id: group.id,
        name: group.name,
        ownerId: group.ownerId,
        isOwner: group.ownerId === viewerId,
        createdAt: group.createdAt,
        members: group.memberIds.map(id => accounts.find(item => item.id === id && item.active)).filter(Boolean).map(basicUser),
        callParticipantIds: [...(groupCallMembers.get(group.id) || [])]
    };
}

function basicUser(account) {
    const p = accountProfile(account);
    return { id: account.id, username: account.username, displayName: p.displayName, avatarUrl: avatarUrl(account) };
}

function publicGroupMessage(item) {
    const account = S.loadAccounts().find(user => user.id === item.fromId);
    return { id: item.id, groupId: item.groupId, fromId: item.fromId, sender: account ? basicUser(account) : { id: item.fromId, username: 'removido', displayName: 'Conta removida', avatarUrl: null }, text: item.text, createdAt: item.createdAt };
}

function notifyGroupRefresh(group) {
    for (const id of group.memberIds) ioServer?.to(userRoom(id)).emit('group:updated', { groupId: group.id });
}

function removeFromGroupCall(groupId, userId, socket = null) {
    if (!groupId || !userId) return;
    const set = groupCallMembers.get(groupId);
    if (!set?.has(userId)) return;
    set.delete(userId);
    if (!set.size) groupCallMembers.delete(groupId);
    socket?.leave(groupCallRoom(groupId));
    ioServer?.to(groupCallRoom(groupId)).emit('group:call:peer-left', { groupId, userId });
    ioServer?.to(groupRoom(groupId)).emit('group:call:state', { groupId, participantIds: [...(set || [])] });
}

function overwriteFriends(userId, ids) {
    const valid = uniqueIds(ids).filter(id => id !== userId && S.loadAccounts().some(account => account.id === id));
    let friends = readArray(FRIENDS_FILE).filter(item => item.senderId !== userId && item.receiverId !== userId);
    const now = new Date().toISOString();
    for (const id of valid) friends.push({ id: randomId(), senderId: userId, receiverId: id, status: 'accepted', createdAt: now, acceptedAt: now });
    writeArray(FRIENDS_FILE, friends);
}

function overwriteBlocks(userId, ids) {
    const valid = uniqueIds(ids).filter(id => id !== userId && S.loadAccounts().some(account => account.id === id));
    let blocks = readArray(BLOCKS_FILE).filter(item => item.blockerId !== userId);
    const now = new Date().toISOString();
    for (const id of valid) blocks.push({ id: randomId(), blockerId: userId, blockedId: id, createdAt: now });
    writeArray(BLOCKS_FILE, blocks);
}

function overwriteGroupMemberships(userId, groupIds) {
    const wanted = new Set(uniqueIds(groupIds));
    const groups = loadGroups();
    for (const group of groups) {
        if (group.ownerId === userId) continue;
        const has = group.memberIds.includes(userId);
        if (wanted.has(group.id) && !has && group.memberIds.length < MAX_GROUP_MEMBERS) group.memberIds.push(userId);
        if (!wanted.has(group.id) && has) group.memberIds = group.memberIds.filter(id => id !== userId);
    }
    saveGroups(groups);
}

function isFriend(a, b) {
    if (readArray(BLOCKS_FILE).some(item => (item.blockerId === a && item.blockedId === b) || (item.blockerId === b && item.blockedId === a))) return false;
    return readArray(FRIENDS_FILE).some(item => item.status === 'accepted' && ((item.senderId === a && item.receiverId === b) || (item.senderId === b && item.receiverId === a)));
}

function friendIdsFor(id, friends) {
    return [...new Set(friends.filter(item => item.status === 'accepted' && (item.senderId === id || item.receiverId === id)).map(item => item.senderId === id ? item.receiverId : item.senderId))];
}

function requireGroupMember(groupId, userId) {
    return loadGroups().find(item => item.id === groupId && item.memberIds.includes(userId)) || null;
}

function requireSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        const account = session ? S.loadAccounts().find(item => item.id === session.accountId && item.active) : null;
        if (!account) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        req.account = account;
        return next();
    } catch (error) { return next(error); }
}

function requireAdmin(req, res, next) {
    return requireSession(req, res, error => {
        if (error) return next(error);
        if (!req.account?.isAdmin) return res.status(403).json({ ok: false, error: 'Acesso administrativo necessário.' });
        return next();
    });
}

function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}

function parseCookies(header) {
    const out = {};
    for (const part of String(header).split(';')) {
        const index = part.indexOf('='); if (index < 0) continue;
        const key = part.slice(0, index).trim(); const value = part.slice(index + 1).trim();
        try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    }
    return out;
}

function ensureStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    for (const file of [PROFILE_FILE, GROUPS_FILE, GROUP_MESSAGES_FILE]) if (!fs.existsSync(file)) writeArray(file, []);
}
const loadCustomProfiles = () => readArray(PROFILE_FILE);
const loadGroups = () => readArray(GROUPS_FILE);
const saveGroups = groups => writeArray(GROUPS_FILE, groups);
const loadGroupMessages = () => readArray(GROUP_MESSAGES_FILE);
const saveGroupMessages = items => writeArray(GROUP_MESSAGES_FILE, items);
function readArray(file) { try { const data = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(data) ? data : []; } catch { return []; } }
function writeArray(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`; fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); }
function randomId() { return crypto.randomBytes(16).toString('hex'); }
function cleanText(value, max) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function uniqueIds(value) { return [...new Set((Array.isArray(value) ? value : []).map(item => cleanText(item, 80)).filter(Boolean))]; }
function clampInt(value, min, max, fallback) { const n = Math.trunc(Number(value)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function groupRoom(id) { return `group:${id}`; }
function groupCallRoom(id) { return `groupcall:${id}`; }
function userRoom(id) { return `user:${id}`; }
function httpError(message, statusCode = 400) { const error = new Error(message); error.statusCode = statusCode; return error; }

module.exports = { registerCommunityV2Routes, attachCommunitySocket };
