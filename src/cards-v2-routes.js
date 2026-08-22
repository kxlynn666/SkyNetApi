const express = require('express');
const multer = require('multer');
const C = require('./config');
const S = require('./store');
const CardV2 = require('./cards-v2');

const buckets = new Map();

function registerCardV2Routes(app) {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: C.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 30 }
    }).single('imagem_file');

    app.post('/painel/gerar-card2', requireTrustedOrigin, requireSession, requestLimiter, upload, async (req, res, next) => {
        try {
            const result = await CardV2.createCardV2ForAccount(
                req.account,
                CardV2.normalizePostCardV2Input(req.body),
                req.file,
                'panel-v2'
            );
            res.setHeader('Cache-Control', 'no-store');
            return res.json({
                ok: true,
                id: result.id,
                url: result.url,
                filename: result.filename,
                createdAt: result.createdAt,
                accent: result.accent,
                width: result.width,
                height: result.height
            });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/generate-card-v2', requireApiKey, requestLimiter, upload, async (req, res, next) => {
        try {
            const result = await CardV2.createCardV2ForAccount(
                req.account,
                CardV2.normalizePostCardV2Input(req.body),
                req.file,
                'api-v2'
            );
            res.setHeader('Cache-Control', 'no-store');
            return res.json({
                ok: true,
                id: result.id,
                url: result.url,
                filename: result.filename,
                createdAt: result.createdAt,
                accent: result.accent,
                width: result.width,
                height: result.height
            });
        } catch (error) {
            return next(error);
        }
    });
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
    } catch (error) {
        return next(error);
    }
}

function requireApiKey(req, res, next) {
    try {
        const authorization = String(req.headers.authorization || '');
        const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
        const queryKey = typeof req.query?.apikey === 'string' ? req.query.apikey : '';
        const auth = S.authenticateApiKey(req.headers['x-api-key'] || bearer || queryKey);
        if (!auth) return res.status(401).json({ ok: false, error: 'API key inválida ou ausente.' });
        req.account = auth.account;
        req.apiKeyRecord = auth.record;
        return next();
    } catch (error) {
        return next(error);
    }
}

function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}

function requestLimiter(req, res, next) {
    const key = String(req.account?.id || req.ip || 'unknown');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + 60000 };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > C.CARD_RATE_LIMIT_PER_MINUTE) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        return res.status(429).json({ ok: false, error: 'Limite de geração atingido. Tente novamente em instantes.' });
    }
    return next();
}

function parseCookies(header) {
    const out = {};
    for (const part of String(header).split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        try { out[key] = decodeURIComponent(value); }
        catch { out[key] = value; }
    }
    return out;
}

module.exports = { registerCardV2Routes };
