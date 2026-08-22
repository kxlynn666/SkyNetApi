const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const C = require('./config');
const S = require('./store');

const FRIENDS_FILE = path.join(C.DATA_DIR, 'social-friends.json');
const BLOCKS_FILE = path.join(C.DATA_DIR, 'social-blocks.json');
const MESSAGES_FILE = path.join(C.DATA_DIR, 'social-messages.json');
const MAX_MESSAGES = 50000;
const onlineCounts = new Map();
const activeCalls = new Map();
const callTimers = new Map();
const messageBuckets = new Map();
let ioServer = null;

function ensureSocialStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    ensureJson(FRIENDS_FILE, []);
    ensureJson(BLOCKS_FILE, []);
    ensureJson(MESSAGES_FILE, []);
}

function ensureJson(file, fallback) {
    if (!fs.existsSync(file)) writeJson(file, fallback);
}

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) {
        if (error.code === 'ENOENT') return [];
        throw new Error(`Falha ao ler ${path.basename(file)}: ${error.message}`);
    }
}

function writeJson(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}

const loadFriends = () => readJson(FRIENDS_FILE);
const saveFriends = data => writeJson(FRIENDS_FILE, data);
const loadBlocks = () => readJson(BLOCKS_FILE);
const saveBlocks = data => writeJson(BLOCKS_FILE, data);
const loadMessages = () => readJson(MESSAGES_FILE);
const saveMessages = data => writeJson(MESSAGES_FILE, data);

function defaultProfile(account) {
    const profile = account?.profile && typeof account.profile === 'object' ? account.profile : {};
    const privacy = profile.privacy && typeof profile.privacy === 'object' ? profile.privacy : {};
    return {
        displayName: cleanText(profile.displayName, 50) || account.username,
        bio: cleanText(profile.bio, 320),
        status: cleanText(profile.status, 60),
        avatarUploadId: cleanText(profile.avatarUploadId, 80),
        privacy: {
            allowFriendRequests: privacy.allowFriendRequests !== false,
            allowCallsFromFriends: privacy.allowCallsFromFriends !== false,
            showOnPodium: privacy.showOnPodium !== false,
            showOnline: privacy.showOnline !== false
        }
    };
}

function cleanText(value, maxLength) {
    return String(value || '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function profileAvatarUrl(account) {
    const profile = defaultProfile(account);
    if (!profile.avatarUploadId) return null;
    const upload = S.loadUploads().find(item => item.id === profile.avatarUploadId && item.accountId === account.id);
    return upload ? `/social-avatar/${encodeURIComponent(account.id)}` : null;
}

function isOnline(account) {
    const profile = defaultProfile(account);
    return profile.privacy.showOnline && Number(onlineCounts.get(account.id) || 0) > 0;
}

function publicProfile(account, extra = {}) {
    const profile = defaultProfile(account);
    return {
        id: account.id,
        username: account.username,
        displayName: profile.displayName,
        bio: profile.bio,
        status: profile.status,
        avatarUrl: profileAvatarUrl(account),
        createdAt: account.createdAt,
        online: isOnline(account),
        ...extra
    };
}

function getActivityScore(accountId) {
    const requestPoints = S.loadApiKeys()
        .filter(item => item.accountId === accountId)
        .reduce((sum, item) => sum + Number(item.requestCount || 0), 0);
    const cardPoints = S.loadGenerations().filter(item => item.accountId === accountId).length * 5;
    return requestPoints + cardPoints;
}

function acceptedFriendRecord(a, b) {
    return loadFriends().find(item => item.status === 'accepted' && (
        (item.senderId === a && item.receiverId === b) ||
        (item.senderId === b && item.receiverId === a)
    ));
}

function isBlocked(a, b) {
    return loadBlocks().some(item =>
        (item.blockerId === a && item.blockedId === b) ||
        (item.blockerId === b && item.blockedId === a)
    );
}

function canInteract(a, b) {
    return Boolean(a && b && a !== b && !isBlocked(a, b) && acceptedFriendRecord(a, b));
}

function relationshipFor(viewerId, targetId) {
    const blocks = loadBlocks();
    const ownBlock = blocks.find(item => item.blockerId === viewerId && item.blockedId === targetId);
    if (ownBlock) return { type: 'blocked', id: ownBlock.id };
    if (blocks.some(item => item.blockerId === targetId && item.blockedId === viewerId)) return { type: 'unavailable' };

    const item = loadFriends().find(entry =>
        (entry.senderId === viewerId && entry.receiverId === targetId) ||
        (entry.senderId === targetId && entry.receiverId === viewerId)
    );
    if (!item) return { type: 'none' };
    if (item.status === 'accepted') return { type: 'friend', id: item.id };
    if (item.status === 'pending' && item.senderId === viewerId) return { type: 'outgoing', id: item.id };
    if (item.status === 'pending') return { type: 'incoming', id: item.id };
    return { type: 'none' };
}

function parseCookies(header) {
    const out = {};
    for (const part of String(header || '').split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        try { out[key] = decodeURIComponent(value); }
        catch { out[key] = value; }
    }
    return out;
}

function getSessionAccountFromCookie(cookieHeader) {
    const token = parseCookies(cookieHeader).skynet_session || '';
    const session = token ? S.getSession(token) : null;
    if (!session) return null;
    return S.loadAccounts().find(item => item.id === session.accountId && item.active) || null;
}

function requireSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie).skynet_session || '';
        const session = token ? S.getSession(token) : null;
        if (!session) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        const account = S.loadAccounts().find(item => item.id === session.accountId && item.active);
        if (!account) return res.status(401).json({ ok: false, error: 'Conta inativa ou removida.' });
        req.account = account;
        req.sessionToken = token;
        return next();
    } catch (error) { return next(error); }
}

function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}

function setExpiredSessionCookie(res) {
    const parts = ['skynet_session=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict'];
    if (C.IS_PRODUCTION) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
}

function messageLimiter(req, res, next) {
    const key = req.account?.id || req.ip || 'unknown';
    const now = Date.now();
    let bucket = messageBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + 60000 };
    bucket.count += 1;
    messageBuckets.set(key, bucket);
    if (bucket.count > 40) return res.status(429).json({ ok: false, error: 'Muitas mensagens em pouco tempo.' });
    return next();
}

function registerSocialRoutes(app) {
    ensureSocialStorage();
    const json = express.json({ limit: '64kb' });
    app.use('/api/social', json);

    app.get('/social-avatar/:accountId', (req, res) => {
        const account = S.loadAccounts().find(item => item.id === req.params.accountId && item.active);
        if (!account) return res.status(404).end();
        const profile = defaultProfile(account);
        if (!profile.avatarUploadId) return res.status(404).end();
        const upload = S.loadUploads().find(item => item.id === profile.avatarUploadId && item.accountId === account.id);
        if (!upload) return res.status(404).end();
        const filepath = path.join(C.UPLOADS_DIR, path.basename(upload.filename));
        if (!fs.existsSync(filepath)) return res.status(404).end();
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.sendFile(filepath);
    });

    app.get('/api/social/podium', (req, res) => {
        const accounts = S.loadAccounts().filter(item => item.active && defaultProfile(item).privacy.showOnPodium);
        const podium = accounts
            .map(account => publicProfile(account, { points: getActivityScore(account.id) }))
            .sort((a, b) => b.points - a.points || String(a.username).localeCompare(String(b.username)))
            .slice(0, 3)
            .map((item, index) => ({ ...item, place: index + 1 }));
        return res.json({ ok: true, scoring: '1 ponto por requisição de API + 5 pontos por card gerado', podium });
    });

    app.get('/api/social/profile/:username', (req, res) => {
        const username = S.normalizeUsername(req.params.username);
        const account = S.loadAccounts().find(item => item.active && S.normalizeUsername(item.usernameLower || item.username) === username);
        if (!account) return res.status(404).json({ ok: false, error: 'Perfil não encontrado.' });
        const friendCount = loadFriends().filter(item => item.status === 'accepted' && (item.senderId === account.id || item.receiverId === account.id)).length;
        return res.json({ ok: true, profile: publicProfile(account, { friendCount, points: getActivityScore(account.id) }) });
    });

    app.get('/api/social/me', requireSession, (req, res) => {
        const friendCount = loadFriends().filter(item => item.status === 'accepted' && (item.senderId === req.account.id || item.receiverId === req.account.id)).length;
        const messageCount = loadMessages().filter(item => item.fromId === req.account.id || item.toId === req.account.id).length;
        return res.json({
            ok: true,
            account: { ...S.publicAccountView(req.account), profile: defaultProfile(req.account), avatarUrl: profileAvatarUrl(req.account) },
            stats: { friendCount, messageCount, points: getActivityScore(req.account.id) }
        });
    });

    app.patch('/api/social/account/profile', requireTrustedOrigin, requireSession, (req, res) => {
        const accounts = S.loadAccounts();
        const account = accounts.find(item => item.id === req.account.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        const current = defaultProfile(account);
        const avatarUploadId = cleanText(req.body?.avatarUploadId, 80);
        if (avatarUploadId && !S.loadUploads().some(item => item.id === avatarUploadId && item.accountId === account.id)) {
            return res.status(400).json({ ok: false, error: 'O avatar precisa ser um upload da sua própria conta.' });
        }
        const privacyInput = req.body?.privacy && typeof req.body.privacy === 'object' ? req.body.privacy : {};
        account.profile = {
            displayName: cleanText(req.body?.displayName, 50) || account.username,
            bio: cleanText(req.body?.bio, 320),
            status: cleanText(req.body?.status, 60),
            avatarUploadId,
            privacy: {
                allowFriendRequests: typeof privacyInput.allowFriendRequests === 'boolean' ? privacyInput.allowFriendRequests : current.privacy.allowFriendRequests,
                allowCallsFromFriends: typeof privacyInput.allowCallsFromFriends === 'boolean' ? privacyInput.allowCallsFromFriends : current.privacy.allowCallsFromFriends,
                showOnPodium: typeof privacyInput.showOnPodium === 'boolean' ? privacyInput.showOnPodium : current.privacy.showOnPodium,
                showOnline: typeof privacyInput.showOnline === 'boolean' ? privacyInput.showOnline : current.privacy.showOnline
            }
        };
        S.saveAccounts(accounts);
        return res.json({ ok: true, profile: defaultProfile(account), avatarUrl: profileAvatarUrl(account) });
    });

    app.post('/api/social/account/username', requireTrustedOrigin, requireSession, (req, res) => {
        const password = String(req.body?.password || '');
        const username = S.normalizeUsername(req.body?.username);
        if (!S.verifySecret(password, req.account.passwordHash)) return res.status(403).json({ ok: false, error: 'Senha atual incorreta.' });
        if (!username || username.length < 3 || username.length > 30 || !/^[a-z0-9_-]+$/.test(username)) {
            return res.status(400).json({ ok: false, error: 'Usuário inválido. Use 3 a 30 caracteres: letras, números, _ ou -.' });
        }
        const accounts = S.loadAccounts();
        if (accounts.some(item => item.id !== req.account.id && S.normalizeUsername(item.usernameLower || item.username) === username)) {
            return res.status(409).json({ ok: false, error: 'Esse usuário já existe.' });
        }
        const account = accounts.find(item => item.id === req.account.id);
        account.username = username;
        account.usernameLower = username;
        if (!account.profile?.displayName) account.profile = { ...defaultProfile(account), displayName: username };
        S.saveAccounts(accounts);
        return res.json({ ok: true, username });
    });

    app.post('/api/social/account/password', requireTrustedOrigin, requireSession, (req, res) => {
        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');
        if (!S.verifySecret(currentPassword, req.account.passwordHash)) return res.status(403).json({ ok: false, error: 'Senha atual incorreta.' });
        if (newPassword.length < 8 || newPassword.length > 128) return res.status(400).json({ ok: false, error: 'A nova senha deve ter entre 8 e 128 caracteres.' });
        const accounts = S.loadAccounts();
        const account = accounts.find(item => item.id === req.account.id);
        account.passwordHash = S.createSecretHash(newPassword);
        S.saveAccounts(accounts);
        S.deleteSessionsForAccount(account.id);
        setExpiredSessionCookie(res);
        return res.json({ ok: true, reauth: true });
    });

    app.post('/api/social/account/logout-all', requireTrustedOrigin, requireSession, (req, res) => {
        S.deleteSessionsForAccount(req.account.id);
        setExpiredSessionCookie(res);
        return res.json({ ok: true });
    });

    app.delete('/api/social/account', requireTrustedOrigin, requireSession, (req, res) => {
        const password = String(req.body?.password || '');
        if (!S.verifySecret(password, req.account.passwordHash)) return res.status(403).json({ ok: false, error: 'Senha incorreta.' });
        deleteAccountData(req.account.id);
        setExpiredSessionCookie(res);
        return res.json({ ok: true });
    });

    app.get('/api/social/users', requireSession, (req, res) => {
        const query = cleanText(req.query?.q, 60).toLowerCase();
        if (query.length < 2) return res.json({ ok: true, users: [] });
        const accounts = S.loadAccounts()
            .filter(item => item.active && item.id !== req.account.id)
            .filter(item => {
                const profile = defaultProfile(item);
                return String(item.username).toLowerCase().includes(query) || profile.displayName.toLowerCase().includes(query);
            })
            .slice(0, 20)
            .map(item => publicProfile(item, { relationship: relationshipFor(req.account.id, item.id) }));
        return res.json({ ok: true, users: accounts });
    });

    app.get('/api/social/friends', requireSession, (req, res) => {
        const accounts = new Map(S.loadAccounts().filter(item => item.active).map(item => [item.id, item]));
        const records = loadFriends();
        const friends = [];
        const incoming = [];
        const outgoing = [];
        for (const record of records) {
            if (record.status === 'accepted' && (record.senderId === req.account.id || record.receiverId === req.account.id)) {
                const otherId = record.senderId === req.account.id ? record.receiverId : record.senderId;
                const account = accounts.get(otherId);
                if (account && !isBlocked(req.account.id, otherId)) friends.push(publicProfile(account, { friendshipId: record.id }));
            } else if (record.status === 'pending' && record.receiverId === req.account.id) {
                const account = accounts.get(record.senderId);
                if (account && !isBlocked(req.account.id, record.senderId)) incoming.push(publicProfile(account, { requestId: record.id }));
            } else if (record.status === 'pending' && record.senderId === req.account.id) {
                const account = accounts.get(record.receiverId);
                if (account && !isBlocked(req.account.id, record.receiverId)) outgoing.push(publicProfile(account, { requestId: record.id }));
            }
        }
        const blocked = loadBlocks()
            .filter(item => item.blockerId === req.account.id)
            .map(item => accounts.get(item.blockedId))
            .filter(Boolean)
            .map(item => publicProfile(item));
        return res.json({ ok: true, friends, incoming, outgoing, blocked });
    });

    app.post('/api/social/friends/request', requireTrustedOrigin, requireSession, (req, res) => {
        const targetId = cleanText(req.body?.userId, 80);
        if (!targetId || targetId === req.account.id) return res.status(400).json({ ok: false, error: 'Usuário inválido.' });
        const target = S.loadAccounts().find(item => item.id === targetId && item.active);
        if (!target) return res.status(404).json({ ok: false, error: 'Usuário não encontrado.' });
        if (isBlocked(req.account.id, targetId)) return res.status(403).json({ ok: false, error: 'Interação indisponível.' });
        if (!defaultProfile(target).privacy.allowFriendRequests) return res.status(403).json({ ok: false, error: 'Este perfil não aceita solicitações de amizade.' });
        const existing = loadFriends().find(item =>
            (item.senderId === req.account.id && item.receiverId === targetId) ||
            (item.senderId === targetId && item.receiverId === req.account.id)
        );
        if (existing) return res.status(409).json({ ok: false, error: existing.status === 'accepted' ? 'Vocês já são amigos.' : 'Já existe uma solicitação entre essas contas.' });
        const friends = loadFriends();
        const record = { id: S.randomId(12), senderId: req.account.id, receiverId: targetId, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        friends.push(record);
        saveFriends(friends);
        ioServer?.to(userRoom(targetId)).emit('friend:request', { from: publicProfile(req.account), requestId: record.id });
        return res.status(201).json({ ok: true, requestId: record.id });
    });

    app.post('/api/social/friends/:requestId/accept', requireTrustedOrigin, requireSession, (req, res) => {
        const friends = loadFriends();
        const record = friends.find(item => item.id === req.params.requestId && item.status === 'pending' && item.receiverId === req.account.id);
        if (!record) return res.status(404).json({ ok: false, error: 'Solicitação não encontrada.' });
        if (isBlocked(record.senderId, record.receiverId)) return res.status(403).json({ ok: false, error: 'Interação indisponível.' });
        record.status = 'accepted';
        record.updatedAt = new Date().toISOString();
        saveFriends(friends);
        ioServer?.to(userRoom(record.senderId)).emit('friend:accepted', { user: publicProfile(req.account) });
        return res.json({ ok: true });
    });

    app.post('/api/social/friends/:requestId/reject', requireTrustedOrigin, requireSession, (req, res) => {
        const friends = loadFriends();
        const index = friends.findIndex(item => item.id === req.params.requestId && item.status === 'pending' && (item.receiverId === req.account.id || item.senderId === req.account.id));
        if (index === -1) return res.status(404).json({ ok: false, error: 'Solicitação não encontrada.' });
        friends.splice(index, 1);
        saveFriends(friends);
        return res.json({ ok: true });
    });

    app.delete('/api/social/friends/:userId', requireTrustedOrigin, requireSession, (req, res) => {
        const targetId = req.params.userId;
        const friends = loadFriends();
        const filtered = friends.filter(item => !(item.status === 'accepted' && (
            (item.senderId === req.account.id && item.receiverId === targetId) ||
            (item.senderId === targetId && item.receiverId === req.account.id)
        )));
        if (filtered.length === friends.length) return res.status(404).json({ ok: false, error: 'Amizade não encontrada.' });
        saveFriends(filtered);
        endActiveCall(req.account.id, targetId, 'Amizade removida.');
        return res.json({ ok: true });
    });

    app.post('/api/social/block', requireTrustedOrigin, requireSession, (req, res) => {
        const targetId = cleanText(req.body?.userId, 80);
        if (!targetId || targetId === req.account.id) return res.status(400).json({ ok: false, error: 'Usuário inválido.' });
        if (!S.loadAccounts().some(item => item.id === targetId && item.active)) return res.status(404).json({ ok: false, error: 'Usuário não encontrado.' });
        const blocks = loadBlocks();
        if (!blocks.some(item => item.blockerId === req.account.id && item.blockedId === targetId)) {
            blocks.push({ id: S.randomId(12), blockerId: req.account.id, blockedId: targetId, createdAt: new Date().toISOString() });
            saveBlocks(blocks);
        }
        saveFriends(loadFriends().filter(item => !(
            (item.senderId === req.account.id && item.receiverId === targetId) ||
            (item.senderId === targetId && item.receiverId === req.account.id)
        )));
        endActiveCall(req.account.id, targetId, 'Usuário bloqueado.');
        return res.json({ ok: true });
    });

    app.delete('/api/social/block/:userId', requireTrustedOrigin, requireSession, (req, res) => {
        const blocks = loadBlocks();
        const filtered = blocks.filter(item => !(item.blockerId === req.account.id && item.blockedId === req.params.userId));
        if (filtered.length === blocks.length) return res.status(404).json({ ok: false, error: 'Bloqueio não encontrado.' });
        saveBlocks(filtered);
        return res.json({ ok: true });
    });

    app.get('/api/social/conversations', requireSession, (req, res) => {
        const accounts = new Map(S.loadAccounts().filter(item => item.active).map(item => [item.id, item]));
        const messages = loadMessages();
        const friends = loadFriends().filter(item => item.status === 'accepted' && (item.senderId === req.account.id || item.receiverId === req.account.id));
        const conversations = friends.map(record => {
            const otherId = record.senderId === req.account.id ? record.receiverId : record.senderId;
            if (isBlocked(req.account.id, otherId)) return null;
            const account = accounts.get(otherId);
            if (!account) return null;
            const convo = messages.filter(item =>
                (item.fromId === req.account.id && item.toId === otherId) ||
                (item.fromId === otherId && item.toId === req.account.id)
            );
            const last = convo[convo.length - 1] || null;
            const unreadCount = convo.filter(item => item.toId === req.account.id && !item.readAt).length;
            return { user: publicProfile(account), lastMessage: last ? publicMessage(last) : null, unreadCount };
        }).filter(Boolean).sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
        return res.json({ ok: true, conversations });
    });

    app.get('/api/social/messages/:userId', requireSession, (req, res) => {
        const targetId = req.params.userId;
        if (!canInteract(req.account.id, targetId)) return res.status(403).json({ ok: false, error: 'O chat está disponível somente entre amigos.' });
        const limit = Math.max(1, Math.min(100, Number.parseInt(req.query?.limit || '60', 10) || 60));
        const before = cleanText(req.query?.before, 64);
        let items = loadMessages().filter(item =>
            (item.fromId === req.account.id && item.toId === targetId) ||
            (item.fromId === targetId && item.toId === req.account.id)
        );
        if (before) items = items.filter(item => item.id !== before && new Date(item.createdAt) < new Date((items.find(x => x.id === before) || {}).createdAt || Date.now()));
        items = items.slice(-limit);
        return res.json({ ok: true, messages: items.map(publicMessage) });
    });

    app.post('/api/social/messages/:userId', requireTrustedOrigin, requireSession, messageLimiter, (req, res) => {
        const targetId = req.params.userId;
        if (!canInteract(req.account.id, targetId)) return res.status(403).json({ ok: false, error: 'O chat está disponível somente entre amigos.' });
        const text = cleanText(req.body?.text, 2000);
        if (!text) return res.status(400).json({ ok: false, error: 'Digite uma mensagem.' });
        const messages = loadMessages();
        const record = { id: S.randomId(12), fromId: req.account.id, toId: targetId, text, createdAt: new Date().toISOString(), readAt: null };
        messages.push(record);
        if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);
        saveMessages(messages);
        const message = publicMessage(record);
        ioServer?.to(userRoom(targetId)).emit('chat:message', { message });
        ioServer?.to(userRoom(req.account.id)).emit('chat:message', { message });
        return res.status(201).json({ ok: true, message });
    });

    app.post('/api/social/messages/:userId/read', requireTrustedOrigin, requireSession, (req, res) => {
        const targetId = req.params.userId;
        if (!canInteract(req.account.id, targetId)) return res.status(403).json({ ok: false, error: 'Chat indisponível.' });
        const messages = loadMessages();
        let changed = false;
        const now = new Date().toISOString();
        for (const item of messages) {
            if (item.fromId === targetId && item.toId === req.account.id && !item.readAt) {
                item.readAt = now;
                changed = true;
            }
        }
        if (changed) saveMessages(messages);
        return res.json({ ok: true });
    });

    app.delete('/api/social/messages/item/:messageId', requireTrustedOrigin, requireSession, (req, res) => {
        const messages = loadMessages();
        const index = messages.findIndex(item => item.id === req.params.messageId && item.fromId === req.account.id);
        if (index === -1) return res.status(404).json({ ok: false, error: 'Mensagem não encontrada.' });
        const [removed] = messages.splice(index, 1);
        saveMessages(messages);
        ioServer?.to(userRoom(removed.toId)).emit('chat:deleted', { messageId: removed.id });
        ioServer?.to(userRoom(removed.fromId)).emit('chat:deleted', { messageId: removed.id });
        return res.json({ ok: true });
    });

    app.get('/api/social/rtc-config', requireSession, (req, res) => {
        const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
        const turnUrl = String(process.env.TURN_URL || '').trim();
        const turnUsername = String(process.env.TURN_USERNAME || '').trim();
        const turnCredential = String(process.env.TURN_CREDENTIAL || '').trim();
        if (turnUrl) iceServers.push({ urls: turnUrl, username: turnUsername || undefined, credential: turnCredential || undefined });
        return res.json({ ok: true, iceServers });
    });
}

function publicMessage(item) {
    return { id: item.id, fromId: item.fromId, toId: item.toId, text: item.text, createdAt: item.createdAt, readAt: item.readAt || null };
}

function deleteAccountData(accountId) {
    const accounts = S.loadAccounts();
    const accountIndex = accounts.findIndex(item => item.id === accountId);
    if (accountIndex !== -1) accounts.splice(accountIndex, 1);
    S.saveAccounts(accounts);

    const uploads = S.loadUploads();
    uploads.filter(item => item.accountId === accountId).forEach(item => S.removeFileIfExists(path.join(C.UPLOADS_DIR, item.filename)));
    S.saveUploads(uploads.filter(item => item.accountId !== accountId));

    const generations = S.loadGenerations();
    generations.filter(item => item.accountId === accountId).forEach(item => S.removeFileIfExists(path.join(C.GENERATED_DIR, item.filename)));
    S.saveGenerations(generations.filter(item => item.accountId !== accountId));

    S.saveApiKeys(S.loadApiKeys().filter(item => item.accountId !== accountId));
    S.deleteSessionsForAccount(accountId);
    saveFriends(loadFriends().filter(item => item.senderId !== accountId && item.receiverId !== accountId));
    saveBlocks(loadBlocks().filter(item => item.blockerId !== accountId && item.blockedId !== accountId));
    saveMessages(loadMessages().filter(item => item.fromId !== accountId && item.toId !== accountId));
    endActiveCall(accountId, activeCalls.get(accountId), 'Conta removida.');
}

function userRoom(userId) { return `user:${userId}`; }
function callKey(a, b) { return [String(a), String(b)].sort().join(':'); }

function clearCallTimer(a, b) {
    const key = callKey(a, b);
    const timer = callTimers.get(key);
    if (timer) clearTimeout(timer);
    callTimers.delete(key);
}

function endActiveCall(a, b, reason = 'Chamada encerrada.') {
    if (!a || !b) return;
    if (activeCalls.get(a) === b) activeCalls.delete(a);
    if (activeCalls.get(b) === a) activeCalls.delete(b);
    clearCallTimer(a, b);
    ioServer?.to(userRoom(a)).emit('call:ended', { userId: b, reason });
    ioServer?.to(userRoom(b)).emit('call:ended', { userId: a, reason });
}

function notifyPresence(userId, online) {
    const account = S.loadAccounts().find(item => item.id === userId && item.active);
    if (!account) return;
    const visible = defaultProfile(account).privacy.showOnline ? online : false;
    const records = loadFriends().filter(item => item.status === 'accepted' && (item.senderId === userId || item.receiverId === userId));
    for (const record of records) {
        const friendId = record.senderId === userId ? record.receiverId : record.senderId;
        ioServer?.to(userRoom(friendId)).emit('social:presence', { userId, online: visible });
    }
}

function attachSocialSocket(httpServer) {
    ensureSocialStorage();
    ioServer = new Server(httpServer, {
        path: '/socket.io',
        serveClient: true,
        maxHttpBufferSize: 64 * 1024,
        cors: {
            credentials: true,
            origin(origin, callback) {
                if (!origin || C.CORS_ORIGINS.has(origin)) return callback(null, true);
                try {
                    const parsed = new URL(origin);
                    if (['http:', 'https:'].includes(parsed.protocol)) return callback(null, true);
                } catch {}
                return callback(new Error('Origem não permitida'));
            }
        }
    });

    ioServer.use((socket, next) => {
        try {
            const account = getSessionAccountFromCookie(socket.handshake.headers.cookie || '');
            if (!account) return next(new Error('Não autorizado'));
            socket.account = account;
            return next();
        } catch (error) { return next(error); }
    });

    ioServer.on('connection', socket => {
        const account = socket.account;
        const userId = account.id;
        socket.join(userRoom(userId));
        onlineCounts.set(userId, Number(onlineCounts.get(userId) || 0) + 1);
        if (onlineCounts.get(userId) === 1) notifyPresence(userId, true);

        socket.on('call:invite', payload => {
            const targetId = cleanText(payload?.to, 80);
            if (!targetId || !canInteract(userId, targetId)) return socket.emit('call:error', { error: 'Chamadas estão disponíveis somente entre amigos.' });
            const target = S.loadAccounts().find(item => item.id === targetId && item.active);
            if (!target || !defaultProfile(target).privacy.allowCallsFromFriends) return socket.emit('call:error', { error: 'Este usuário não está aceitando chamadas.' });
            if (!onlineCounts.get(targetId)) return socket.emit('call:error', { error: 'Este usuário está offline.' });
            if (activeCalls.has(userId) || activeCalls.has(targetId)) return socket.emit('call:error', { error: 'Uma das contas já está em outra chamada.' });

            activeCalls.set(userId, targetId);
            activeCalls.set(targetId, userId);
            const key = callKey(userId, targetId);
            const timer = setTimeout(() => {
                if (activeCalls.get(userId) === targetId) endActiveCall(userId, targetId, 'Chamada não atendida.');
            }, 45000);
            timer.unref?.();
            callTimers.set(key, timer);
            ioServer.to(userRoom(targetId)).emit('call:incoming', { from: publicProfile(account) });
            socket.emit('call:ringing', { to: targetId });
        });

        socket.on('call:accept', payload => {
            const targetId = cleanText(payload?.to, 80);
            if (activeCalls.get(userId) !== targetId) return;
            clearCallTimer(userId, targetId);
            ioServer.to(userRoom(targetId)).emit('call:accepted', { by: userId });
        });

        socket.on('call:reject', payload => {
            const targetId = cleanText(payload?.to, 80);
            if (activeCalls.get(userId) !== targetId) return;
            ioServer.to(userRoom(targetId)).emit('call:rejected', { by: userId });
            endActiveCall(userId, targetId, 'Chamada recusada.');
        });

        socket.on('call:end', payload => {
            const targetId = cleanText(payload?.to, 80) || activeCalls.get(userId);
            if (targetId && activeCalls.get(userId) === targetId) endActiveCall(userId, targetId);
        });

        for (const eventName of ['rtc:offer', 'rtc:answer', 'rtc:ice']) {
            socket.on(eventName, payload => {
                const targetId = cleanText(payload?.to, 80);
                if (!targetId || activeCalls.get(userId) !== targetId || !canInteract(userId, targetId)) return;
                ioServer.to(userRoom(targetId)).emit(eventName, { from: userId, data: payload?.data || null });
            });
        }

        socket.on('disconnect', () => {
            const count = Math.max(0, Number(onlineCounts.get(userId) || 1) - 1);
            if (count) onlineCounts.set(userId, count);
            else {
                onlineCounts.delete(userId);
                notifyPresence(userId, false);
                const peerId = activeCalls.get(userId);
                if (peerId) endActiveCall(userId, peerId, 'A outra pessoa ficou offline.');
            }
        });
    });

    return ioServer;
}

module.exports = { registerSocialRoutes, attachSocialSocket };
