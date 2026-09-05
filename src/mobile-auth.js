const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');

const MOBILE_SESSIONS_FILE = path.join(C.DATA_DIR, 'mobile-sessions.json');
const MOBILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_ACCOUNT = 12;

function ensureStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    if (!fs.existsSync(MOBILE_SESSIONS_FILE)) writeSessions([]);
}

function readSessions() {
    ensureStorage();
    try {
        const value = JSON.parse(fs.readFileSync(MOBILE_SESSIONS_FILE, 'utf8'));
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function writeSessions(items) {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    const temp = `${MOBILE_SESSIONS_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(items, null, 2), { mode: 0o600 });
    fs.renameSync(temp, MOBILE_SESSIONS_FILE);
}

function pruneSessions(items = readSessions()) {
    const now = Date.now();
    const activeAccounts = new Set(S.loadAccounts().filter(item => item.active).map(item => item.id));
    const keys = new Map(S.loadApiKeys().filter(item => item.active).map(item => [item.id, item]));
    const filtered = items.filter(item => {
        if (!item || Number(item.expiresAt) <= now || !activeAccounts.has(item.accountId)) return false;
        const key = keys.get(item.keyId);
        return Boolean(key && key.accountId === item.accountId && key.keyHash === item.keyHash);
    });
    if (filtered.length !== items.length) writeSessions(filtered);
    return filtered;
}

function randomMobileToken() {
    return `skybooth_${crypto.randomBytes(32).toString('base64url')}`;
}

function tokenHash(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function safeHashEqual(a, b) {
    try {
        return Boolean(a && b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')));
    } catch {
        return false;
    }
}

function readBearer(value) {
    const header = String(value || '').trim();
    return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
}

function readApiKey(req) {
    const bearer = readBearer(req.headers.authorization);
    return String(req.headers['x-api-key'] || bearer || '').trim();
}

function readMobileTokenFromRequest(req) {
    const bearer = readBearer(req.headers.authorization);
    return String(req.headers['x-mobile-token'] || bearer || '').trim();
}

function readMobileTokenFromSocket(socket) {
    const authToken = String(socket?.handshake?.auth?.token || '').trim();
    if (authToken) return authToken;
    const headerToken = readBearer(socket?.handshake?.headers?.authorization);
    return String(headerToken || socket?.handshake?.headers?.['x-mobile-token'] || '').trim();
}

function issueMobileSession(apiKey) {
    const auth = S.authenticateApiKey(apiKey);
    if (!auth) return null;

    const now = Date.now();
    const token = randomMobileToken();
    let sessions = pruneSessions();
    const own = sessions
        .filter(item => item.accountId === auth.account.id)
        .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    const keepIds = new Set(own.slice(0, Math.max(0, MAX_SESSIONS_PER_ACCOUNT - 1)).map(item => item.id));
    sessions = sessions.filter(item => item.accountId !== auth.account.id || keepIds.has(item.id));

    const record = {
        id: S.randomId(14),
        accountId: auth.account.id,
        keyId: auth.record.id,
        keyHash: auth.record.keyHash,
        tokenHash: tokenHash(token),
        createdAt: now,
        lastSeenAt: now,
        expiresAt: now + MOBILE_TTL_MS
    };
    sessions.push(record);
    writeSessions(sessions);
    return { token, record, account: auth.account, apiKeyRecord: auth.record };
}

function authenticateMobileToken(token) {
    const value = String(token || '').trim();
    if (!value.startsWith('skybooth_') || value.length > 180) return null;

    const hash = tokenHash(value);
    const sessions = pruneSessions();
    const session = sessions.find(item => safeHashEqual(hash, item.tokenHash));
    if (!session) return null;

    const account = S.loadAccounts().find(item => item.id === session.accountId && item.active);
    const keyRecord = S.loadApiKeys().find(item => item.id === session.keyId && item.accountId === session.accountId && item.active && item.keyHash === session.keyHash);
    if (!account || !keyRecord) {
        writeSessions(sessions.filter(item => item.id !== session.id));
        return null;
    }

    const now = Date.now();
    if (now - Number(session.lastSeenAt || 0) > 5 * 60 * 1000) {
        session.lastSeenAt = now;
        writeSessions(sessions);
    }
    return { account, session, keyRecord };
}

function deleteMobileToken(token) {
    const value = String(token || '').trim();
    if (!value) return;
    const hash = tokenHash(value);
    const sessions = readSessions();
    const filtered = sessions.filter(item => !safeHashEqual(hash, item.tokenHash));
    if (filtered.length !== sessions.length) writeSessions(filtered);
}

function deleteMobileSessionsForAccount(accountId) {
    const sessions = readSessions();
    const filtered = sessions.filter(item => item.accountId !== accountId);
    if (filtered.length !== sessions.length) writeSessions(filtered);
}

function requireMobileToken(req, res, next) {
    try {
        const auth = authenticateMobileToken(readMobileTokenFromRequest(req));
        if (!auth) return res.status(401).json({ ok: false, error: 'Sessão móvel inválida ou expirada.' });
        req.account = auth.account;
        req.mobileSession = auth.session;
        return next();
    } catch (error) {
        return next(error);
    }
}

function registerMobileAuthRoutes(app) {
    ensureStorage();
    const json = express.json({ limit: '32kb' });

    app.post('/api/mobile/auth/exchange', json, (req, res) => {
        const issued = issueMobileSession(readApiKey(req));
        if (!issued) return res.status(401).json({ ok: false, error: 'API key inválida ou inativa.' });
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            ok: true,
            token: issued.token,
            tokenType: 'Bearer',
            expiresAt: new Date(issued.record.expiresAt).toISOString(),
            account: S.publicAccountView(issued.account),
            apiKey: S.publicKeyView(issued.apiKeyRecord)
        });
    });

    app.get('/api/mobile/auth/me', requireMobileToken, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, account: S.publicAccountView(req.account), expiresAt: new Date(req.mobileSession.expiresAt).toISOString() });
    });

    app.post('/api/mobile/auth/logout', requireMobileToken, (req, res) => {
        deleteMobileToken(readMobileTokenFromRequest(req));
        return res.json({ ok: true });
    });
}

module.exports = {
    registerMobileAuthRoutes,
    authenticateMobileToken,
    readMobileTokenFromRequest,
    readMobileTokenFromSocket,
    deleteMobileSessionsForAccount
};
