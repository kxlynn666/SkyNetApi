const express = require('express');
const S = require('./store');

function readBearer(value) {
    const header = String(value || '').trim();
    return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
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

function readApiKey(req) {
    const bearer = readBearer(req.headers.authorization);
    return String(req.headers['x-api-key'] || bearer || '').trim();
}

function readSessionToken(req) {
    const cookie = parseCookies(req.headers.cookie || '').skynet_session || '';
    const bearer = readBearer(req.headers.authorization);
    return String(req.headers['x-mobile-session'] || bearer || cookie || '').trim();
}

function issueMobileSession(apiKey) {
    const auth = S.authenticateApiKey(apiKey);
    if (!auth) return null;
    const token = S.createSession(auth.account.id, {
        mobileKeyId: auth.record.id,
        mobileKeyHash: auth.record.keyHash
    });
    const session = S.getSession(token);
    return session ? { token, session, account: auth.account, apiKeyRecord: auth.record } : null;
}

function requireMobileSession(req, res, next) {
    try {
        const token = readSessionToken(req);
        const session = token ? S.getSession(token) : null;
        if (!session || session.client !== 'skybooth') {
            return res.status(401).json({ ok: false, error: 'Sessão móvel inválida ou expirada.' });
        }
        const account = S.loadAccounts().find(item => item.id === session.accountId && item.active);
        if (!account) return res.status(401).json({ ok: false, error: 'Conta inativa ou removida.' });
        req.account = account;
        req.mobileSession = session;
        req.mobileSessionToken = token;
        return next();
    } catch (error) {
        return next(error);
    }
}

function registerMobileAuthRoutes(app) {
    const json = express.json({ limit: '32kb' });

    app.post('/api/mobile/auth/exchange', json, (req, res) => {
        const issued = issueMobileSession(readApiKey(req));
        if (!issued) return res.status(401).json({ ok: false, error: 'API key inválida ou inativa.' });
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            ok: true,
            sessionToken: issued.token,
            cookieName: 'skynet_session',
            expiresAt: new Date(issued.session.expiresAt).toISOString(),
            account: S.publicAccountView(issued.account),
            apiKey: S.publicKeyView(issued.apiKeyRecord),
            socket: { path: '/socket.io', transports: ['websocket', 'polling'] }
        });
    });

    app.get('/api/mobile/auth/me', requireMobileSession, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            ok: true,
            account: S.publicAccountView(req.account),
            expiresAt: new Date(req.mobileSession.expiresAt).toISOString()
        });
    });

    app.post('/api/mobile/auth/logout', requireMobileSession, (req, res) => {
        S.deleteSession(req.mobileSessionToken);
        return res.json({ ok: true });
    });
}

module.exports = { registerMobileAuthRoutes, requireMobileSession, issueMobileSession };
