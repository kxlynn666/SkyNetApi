const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');

const XP_FILE = path.join(C.DATA_DIR, 'xp-state.json');
const FRIENDS_FILE = path.join(C.DATA_DIR, 'social-friends.json');
const BLOCKS_FILE = path.join(C.DATA_DIR, 'social-blocks.json');
const MESSAGES_FILE = path.join(C.DATA_DIR, 'social-messages.json');

const XP_WEIGHTS = Object.freeze({
    apiRequest: 1,
    card: 12,
    upload: 4,
    message: 2,
    activeMinute: 1
});

function registerXpAdminRoutes(app) {
    ensureXpStorage();
    const json = express.json({ limit: '128kb' });

    app.get('/api/xp/me', requireSession, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, xp: getXpView(req.account.id) });
    });

    app.post('/api/xp/heartbeat', json, requireTrustedOrigin, requireSession, (req, res) => {
        const visible = req.body?.visible !== false;
        const focused = req.body?.focused !== false;
        const state = touchActiveTime(req.account.id, visible && focused);
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, activeMinutes: state.activeMinutes, xp: getXpView(req.account.id) });
    });

    app.get('/api/admin/users/full', requireAdmin, (req, res) => {
        const accounts = S.loadAccounts();
        const keys = S.loadApiKeys();
        const uploads = S.loadUploads();
        const generations = S.loadGenerations();
        const sessions = S.loadSessions();
        const friends = readOptionalJson(FRIENDS_FILE);
        const blocks = readOptionalJson(BLOCKS_FILE);
        const messages = readOptionalJson(MESSAGES_FILE);

        const users = accounts.map(account => ({
            ...adminAccountView(account),
            xp: getXpView(account.id),
            stats: {
                apiKeys: keys.filter(item => item.accountId === account.id).length,
                activeApiKeys: keys.filter(item => item.accountId === account.id && item.active).length,
                apiRequests: keys.filter(item => item.accountId === account.id).reduce((sum, item) => sum + Number(item.requestCount || 0), 0),
                uploads: uploads.filter(item => item.accountId === account.id).length,
                cards: generations.filter(item => item.accountId === account.id).length,
                sessions: sessions.filter(item => item.accountId === account.id && Number(item.expiresAt) > Date.now()).length,
                friends: friends.filter(item => item.status === 'accepted' && (item.senderId === account.id || item.receiverId === account.id)).length,
                blocks: blocks.filter(item => item.blockerId === account.id).length,
                messages: messages.filter(item => item.fromId === account.id || item.toId === account.id).length
            }
        }));
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, users, xpWeights: XP_WEIGHTS });
    });

    app.patch('/api/admin/users/:id/full', json, requireTrustedOrigin, requireAdmin, (req, res) => {
        const accounts = S.loadAccounts();
        const account = accounts.find(item => item.id === req.params.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const nextActive = has(body, 'active') ? Boolean(body.active) : Boolean(account.active);
        const nextAdmin = has(body, 'isAdmin') ? Boolean(body.isAdmin) : Boolean(account.isAdmin);
        if (account.active && account.isAdmin && (!nextActive || !nextAdmin) && isLastActiveAdmin(accounts, account.id)) {
            return res.status(400).json({ ok: false, error: 'É necessário manter ao menos um administrador ativo.' });
        }

        if (has(body, 'username')) {
            const username = S.normalizeUsername(body.username);
            if (!username || username.length < 3 || username.length > 30 || !/^[a-z0-9_-]+$/.test(username)) {
                return res.status(400).json({ ok: false, error: 'Username inválido.' });
            }
            if (accounts.some(item => item.id !== account.id && S.normalizeUsername(item.usernameLower || item.username) === username)) {
                return res.status(409).json({ ok: false, error: 'Esse username já está em uso.' });
            }
            account.username = username;
            account.usernameLower = username;
        }

        account.active = nextActive;
        account.isAdmin = nextAdmin;

        if (has(body, 'createdAt')) account.createdAt = normalizeDate(body.createdAt, account.createdAt, false);
        if (has(body, 'lastLoginAt')) account.lastLoginAt = normalizeDate(body.lastLoginAt, account.lastLoginAt, true);
        if (has(body, 'adminNote')) account.adminNote = cleanText(body.adminNote, 1000);

        if (body.profile && typeof body.profile === 'object') {
            const current = normalizeProfile(account);
            const p = body.profile;
            const avatarUploadId = has(p, 'avatarUploadId') ? cleanText(p.avatarUploadId, 80) : current.avatarUploadId;
            if (avatarUploadId && !S.loadUploads().some(item => item.id === avatarUploadId && item.accountId === account.id)) {
                return res.status(400).json({ ok: false, error: 'avatarUploadId não pertence a esta conta.' });
            }
            const privacyInput = p.privacy && typeof p.privacy === 'object' ? p.privacy : {};
            account.profile = {
                displayName: has(p, 'displayName') ? (cleanText(p.displayName, 50) || account.username) : current.displayName,
                bio: has(p, 'bio') ? cleanText(p.bio, 320) : current.bio,
                status: has(p, 'status') ? cleanText(p.status, 60) : current.status,
                avatarUploadId,
                privacy: {
                    allowFriendRequests: has(privacyInput, 'allowFriendRequests') ? Boolean(privacyInput.allowFriendRequests) : current.privacy.allowFriendRequests,
                    allowCallsFromFriends: has(privacyInput, 'allowCallsFromFriends') ? Boolean(privacyInput.allowCallsFromFriends) : current.privacy.allowCallsFromFriends,
                    showOnPodium: has(privacyInput, 'showOnPodium') ? Boolean(privacyInput.showOnPodium) : current.privacy.showOnPodium,
                    showOnline: has(privacyInput, 'showOnline') ? Boolean(privacyInput.showOnline) : current.privacy.showOnline
                }
            };
        }

        S.saveAccounts(accounts);

        const xpState = getXpState(account.id);
        if (has(body, 'activeMinutes')) {
            const minutes = clampInteger(body.activeMinutes, 0, 10_000_000);
            xpState.activeMinutes = minutes;
        }
        if (has(body, 'xpAdjustment')) {
            xpState.xpAdjustment = clampInteger(body.xpAdjustment, -100_000_000, 100_000_000);
        }

        if (has(body, 'targetLevel') && !has(body, 'targetXp')) {
            const level = clampInteger(body.targetLevel, 1, 10_000);
            const desiredXp = xpForLevel(level);
            xpState.xpAdjustment = desiredXp - getEarnedXpWithoutAdjustment(account.id, xpState);
        }
        if (has(body, 'targetXp')) {
            const desiredXp = clampInteger(body.targetXp, 0, 1_000_000_000);
            xpState.xpAdjustment = desiredXp - getEarnedXpWithoutAdjustment(account.id, xpState);
        }
        xpState.updatedAt = new Date().toISOString();
        saveXpState(xpState);

        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, user: { ...adminAccountView(account), xp: getXpView(account.id) } });
    });

    app.post('/api/admin/users/:id/reset-password', json, requireTrustedOrigin, requireAdmin, (req, res) => {
        const password = String(req.body?.password || '');
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({ ok: false, error: 'A nova senha deve ter entre 8 e 128 caracteres.' });
        }
        const accounts = S.loadAccounts();
        const account = accounts.find(item => item.id === req.params.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        account.passwordHash = S.createSecretHash(password);
        account.passwordResetAt = new Date().toISOString();
        S.saveAccounts(accounts);
        S.deleteSessionsForAccount(account.id);
        return res.json({ ok: true, message: 'Senha redefinida e sessões encerradas.' });
    });

    app.post('/api/admin/users/:id/logout-all', requireTrustedOrigin, requireAdmin, (req, res) => {
        const account = S.loadAccounts().find(item => item.id === req.params.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        S.deleteSessionsForAccount(account.id);
        return res.json({ ok: true });
    });

    app.post('/api/admin/users/:id/revoke-keys', requireTrustedOrigin, requireAdmin, (req, res) => {
        const account = S.loadAccounts().find(item => item.id === req.params.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        const keys = S.loadApiKeys();
        for (const key of keys) if (key.accountId === account.id) key.active = false;
        S.saveApiKeys(keys);
        return res.json({ ok: true });
    });

    app.delete('/api/admin/users/:id/full', requireTrustedOrigin, requireAdmin, (req, res) => {
        const accounts = S.loadAccounts();
        const account = accounts.find(item => item.id === req.params.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        if (account.active && account.isAdmin && isLastActiveAdmin(accounts, account.id)) {
            return res.status(400).json({ ok: false, error: 'Não é possível excluir o último administrador ativo.' });
        }
        deleteFullAccount(account.id);
        return res.json({ ok: true });
    });
}

function ensureXpStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    if (!fs.existsSync(XP_FILE)) writeJsonAtomic(XP_FILE, []);
}

function loadXpStates() {
    ensureXpStorage();
    return readOptionalJson(XP_FILE);
}

function saveXpStates(states) {
    writeJsonAtomic(XP_FILE, states);
}

function getXpState(accountId) {
    const states = loadXpStates();
    const found = states.find(item => item.accountId === accountId);
    return found ? { ...found } : {
        accountId,
        activeMinutes: 0,
        xpAdjustment: 0,
        lastHeartbeatAt: null,
        updatedAt: new Date().toISOString()
    };
}

function saveXpState(state) {
    const states = loadXpStates();
    const index = states.findIndex(item => item.accountId === state.accountId);
    if (index === -1) states.push(state);
    else states[index] = state;
    saveXpStates(states);
}

function touchActiveTime(accountId, isActive) {
    const state = getXpState(accountId);
    const now = Date.now();
    const previous = state.lastHeartbeatAt ? new Date(state.lastHeartbeatAt).getTime() : 0;

    if (isActive && previous > 0) {
        const delta = now - previous;
        if (delta >= 50_000 && delta <= 150_000) {
            state.activeMinutes = Number(state.activeMinutes || 0) + Math.max(1, Math.min(2, Math.floor(delta / 60_000)));
        }
    }
    state.lastHeartbeatAt = new Date(now).toISOString();
    state.updatedAt = state.lastHeartbeatAt;
    saveXpState(state);
    return state;
}

function getUsage(accountId) {
    const keys = S.loadApiKeys().filter(item => item.accountId === accountId);
    const requests = keys.reduce((sum, item) => sum + Number(item.requestCount || 0), 0);
    const cards = S.loadGenerations().filter(item => item.accountId === accountId).length;
    const uploads = S.loadUploads().filter(item => item.accountId === accountId).length;
    const messages = readOptionalJson(MESSAGES_FILE).filter(item => item.fromId === accountId).length;
    return { requests, cards, uploads, messages };
}

function getEarnedXpWithoutAdjustment(accountId, state = getXpState(accountId)) {
    const usage = getUsage(accountId);
    return (
        usage.requests * XP_WEIGHTS.apiRequest +
        usage.cards * XP_WEIGHTS.card +
        usage.uploads * XP_WEIGHTS.upload +
        usage.messages * XP_WEIGHTS.message +
        Number(state.activeMinutes || 0) * XP_WEIGHTS.activeMinute
    );
}

function getXpView(accountId) {
    const state = getXpState(accountId);
    const usage = getUsage(accountId);
    const usageXp = (
        usage.requests * XP_WEIGHTS.apiRequest +
        usage.cards * XP_WEIGHTS.card +
        usage.uploads * XP_WEIGHTS.upload +
        usage.messages * XP_WEIGHTS.message
    );
    const timeXp = Number(state.activeMinutes || 0) * XP_WEIGHTS.activeMinute;
    const totalXp = Math.max(0, usageXp + timeXp + Number(state.xpAdjustment || 0));
    const level = levelForXp(totalXp);
    const levelStartXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);
    const progressXp = totalXp - levelStartXp;
    const progressNeeded = Math.max(1, nextLevelXp - levelStartXp);
    return {
        totalXp,
        level,
        levelStartXp,
        nextLevelXp,
        progressXp,
        progressNeeded,
        progressPercent: Math.max(0, Math.min(100, Math.floor((progressXp / progressNeeded) * 100))),
        activeMinutes: Number(state.activeMinutes || 0),
        xpAdjustment: Number(state.xpAdjustment || 0),
        weights: XP_WEIGHTS,
        breakdown: {
            apiRequests: usage.requests,
            cards: usage.cards,
            uploads: usage.uploads,
            messages: usage.messages,
            usageXp,
            timeXp
        }
    };
}

function levelForXp(xp) {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 100)) + 1);
}

function xpForLevel(level) {
    const safeLevel = Math.max(1, Number(level) || 1);
    return 100 * Math.pow(safeLevel - 1, 2);
}

function normalizeProfile(account) {
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

function adminAccountView(account) {
    return {
        id: account.id,
        username: account.username,
        usernameLower: account.usernameLower || S.normalizeUsername(account.username),
        active: Boolean(account.active),
        isAdmin: Boolean(account.isAdmin),
        createdAt: account.createdAt,
        lastLoginAt: account.lastLoginAt || null,
        passwordResetAt: account.passwordResetAt || null,
        adminNote: cleanText(account.adminNote, 1000),
        profile: normalizeProfile(account)
    };
}

function deleteFullAccount(accountId) {
    const accounts = S.loadAccounts();
    S.saveAccounts(accounts.filter(item => item.id !== accountId));

    const uploads = S.loadUploads();
    for (const item of uploads.filter(item => item.accountId === accountId)) {
        S.removeFileIfExists(path.join(C.UPLOADS_DIR, path.basename(item.filename)));
    }
    S.saveUploads(uploads.filter(item => item.accountId !== accountId));

    const generations = S.loadGenerations();
    for (const item of generations.filter(item => item.accountId === accountId)) {
        S.removeFileIfExists(path.join(C.GENERATED_DIR, path.basename(item.filename)));
    }
    S.saveGenerations(generations.filter(item => item.accountId !== accountId));
    S.saveApiKeys(S.loadApiKeys().filter(item => item.accountId !== accountId));
    S.deleteSessionsForAccount(accountId);

    writeJsonAtomic(FRIENDS_FILE, readOptionalJson(FRIENDS_FILE).filter(item => item.senderId !== accountId && item.receiverId !== accountId));
    writeJsonAtomic(BLOCKS_FILE, readOptionalJson(BLOCKS_FILE).filter(item => item.blockerId !== accountId && item.blockedId !== accountId));
    writeJsonAtomic(MESSAGES_FILE, readOptionalJson(MESSAGES_FILE).filter(item => item.fromId !== accountId && item.toId !== accountId));
    saveXpStates(loadXpStates().filter(item => item.accountId !== accountId));
}

function isLastActiveAdmin(accounts, targetId) {
    const activeAdmins = accounts.filter(item => item.active && item.isAdmin);
    return activeAdmins.length === 1 && activeAdmins[0].id === targetId;
}

function requireSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        if (!session) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        const account = S.loadAccounts().find(item => item.id === session.accountId && item.active);
        if (!account) return res.status(401).json({ ok: false, error: 'Conta inativa ou removida.' });
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

function cleanText(value, maxLength) {
    return String(value || '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function normalizeDate(value, fallback, nullable) {
    if ((value === null || value === '') && nullable) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function clampInteger(value, min, max) {
    const number = Math.trunc(Number(value));
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
}

function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function readOptionalJson(file) {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        return [];
    }
}

function writeJsonAtomic(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}

module.exports = { registerXpAdminRoutes, getXpView, xpForLevel, levelForXp };
