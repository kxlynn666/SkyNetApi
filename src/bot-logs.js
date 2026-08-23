const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');

const LOGS_FILE = path.join(C.DATA_DIR, 'bot-logs.json');
const KEYS_FILE = path.join(C.DATA_DIR, 'bot-log-keys.json');
const MAX_LOGS = 5000;
const MAX_BATCH = 50;
const MAX_MESSAGE = 1200;
const MAX_CONTEXT_KEYS = 20;
const INGEST_LIMIT_PER_MINUTE = 120;
const ingestBuckets = new Map();

function registerBotLogRoutes(app) {
    ensureStorage();
    const jsonParser = express.json({ limit: '192kb' });

    app.post('/api/bot-logs/ingest', jsonParser, (req, res, next) => {
        try {
            const keyAuth = authenticateBotLogKey(readBotLogKey(req));
            if (!keyAuth) return res.status(401).json({ ok: false, error: 'Bot log API key inválida ou ausente.' });
            if (!takeIngestSlot(keyAuth.record.id)) {
                res.setHeader('Retry-After', '60');
                return res.status(429).json({ ok: false, error: 'Limite de envio de logs atingido.' });
            }

            const rawEvents = Array.isArray(req.body?.events) ? req.body.events : [req.body?.event || req.body];
            if (!rawEvents.length || rawEvents.length > MAX_BATCH) {
                return res.status(400).json({ ok: false, error: `Envie entre 1 e ${MAX_BATCH} eventos por requisição.` });
            }

            const bot = cleanString(req.body?.bot || req.body?.botName || 'bot', 80) || 'bot';
            const instanceId = cleanString(req.body?.instanceId || '', 100);
            const now = new Date().toISOString();
            const normalized = rawEvents.map(event => normalizeEvent(event, {
                bot,
                instanceId,
                keyId: keyAuth.record.id,
                keyName: keyAuth.record.name,
                receivedAt: now
            }));

            const logs = readJson(LOGS_FILE, []);
            logs.push(...normalized);
            const trimmed = logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs;
            writeJsonAtomic(LOGS_FILE, trimmed);
            return res.status(202).json({ ok: true, accepted: normalized.length });
        } catch (error) { return next(error); }
    });

    app.get('/api/admin/bot-logs', requireAdminSession, (req, res, next) => {
        try {
            const limit = clampInt(req.query?.limit, 1, 500, 200);
            const type = cleanString(req.query?.type || '', 30).toLowerCase();
            const level = cleanString(req.query?.level || '', 20).toLowerCase();
            const q = cleanString(req.query?.q || '', 120).toLowerCase();
            let logs = readJson(LOGS_FILE, []);
            if (type && type !== 'all') logs = logs.filter(item => item.type === type);
            if (level && level !== 'all') logs = logs.filter(item => item.level === level);
            if (q) {
                logs = logs.filter(item => {
                    const haystack = `${item.bot || ''} ${item.instanceId || ''} ${item.type || ''} ${item.level || ''} ${item.message || ''} ${JSON.stringify(item.context || {})}`.toLowerCase();
                    return haystack.includes(q);
                });
            }
            const selected = logs.slice(-limit).reverse();
            const stats = buildStats(readJson(LOGS_FILE, []));
            return res.json({ ok: true, logs: selected, stats });
        } catch (error) { return next(error); }
    });

    app.delete('/api/admin/bot-logs', requireTrustedOrigin, requireAdminSession, (req, res, next) => {
        try {
            writeJsonAtomic(LOGS_FILE, []);
            return res.json({ ok: true });
        } catch (error) { return next(error); }
    });

    app.delete('/api/admin/bot-logs/:id', requireTrustedOrigin, requireAdminSession, (req, res, next) => {
        try {
            const logs = readJson(LOGS_FILE, []);
            const filtered = logs.filter(item => item.id !== req.params.id);
            if (filtered.length === logs.length) return res.status(404).json({ ok: false, error: 'Log não encontrado.' });
            writeJsonAtomic(LOGS_FILE, filtered);
            return res.json({ ok: true });
        } catch (error) { return next(error); }
    });

    app.get('/api/admin/bot-log-keys', requireAdminSession, (req, res, next) => {
        try {
            const accountMap = new Map(S.loadAccounts().map(account => [account.id, account]));
            const keys = readJson(KEYS_FILE, [])
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(key => ({
                    id: key.id,
                    name: key.name,
                    preview: key.preview,
                    active: Boolean(key.active),
                    createdAt: key.createdAt,
                    lastUsedAt: key.lastUsedAt || null,
                    requestCount: Number(key.requestCount || 0),
                    createdByUsername: accountMap.get(key.createdByAccountId)?.username || 'admin removido'
                }));
            return res.json({ ok: true, keys });
        } catch (error) { return next(error); }
    });

    app.post('/api/admin/bot-log-keys', jsonParser, requireTrustedOrigin, requireAdminSession, (req, res, next) => {
        try {
            const name = cleanString(req.body?.name || 'Bot logs', 60);
            if (!name) return res.status(400).json({ ok: false, error: 'Informe um nome para a chave.' });
            const keys = readJson(KEYS_FILE, []);
            const apiKey = `skynet_bot_${crypto.randomBytes(32).toString('hex')}`;
            const record = {
                id: S.randomId(12),
                createdByAccountId: req.account.id,
                name,
                keyHash: S.hashKey(apiKey),
                preview: `${apiKey.slice(0, 18)}...${apiKey.slice(-6)}`,
                active: true,
                createdAt: new Date().toISOString(),
                lastUsedAt: null,
                requestCount: 0
            };
            keys.push(record);
            writeJsonAtomic(KEYS_FILE, keys);
            res.setHeader('Cache-Control', 'no-store');
            return res.status(201).json({ ok: true, apiKey, key: publicBotKey(record) });
        } catch (error) { return next(error); }
    });

    app.patch('/api/admin/bot-log-keys/:id', jsonParser, requireTrustedOrigin, requireAdminSession, (req, res, next) => {
        try {
            if (typeof req.body?.active !== 'boolean') return res.status(400).json({ ok: false, error: 'O campo active deve ser booleano.' });
            const keys = readJson(KEYS_FILE, []);
            const key = keys.find(item => item.id === req.params.id);
            if (!key) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
            key.active = req.body.active;
            writeJsonAtomic(KEYS_FILE, keys);
            return res.json({ ok: true, key: publicBotKey(key) });
        } catch (error) { return next(error); }
    });

    app.delete('/api/admin/bot-log-keys/:id', requireTrustedOrigin, requireAdminSession, (req, res, next) => {
        try {
            const keys = readJson(KEYS_FILE, []);
            const filtered = keys.filter(item => item.id !== req.params.id);
            if (filtered.length === keys.length) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
            writeJsonAtomic(KEYS_FILE, filtered);
            return res.json({ ok: true });
        } catch (error) { return next(error); }
    });
}

function ensureStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    if (!fs.existsSync(LOGS_FILE)) writeJsonAtomic(LOGS_FILE, []);
    if (!fs.existsSync(KEYS_FILE)) writeJsonAtomic(KEYS_FILE, []);
}

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) {
        if (error.code === 'ENOENT') return fallback;
        throw error;
    }
}

function writeJsonAtomic(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}

function readBotLogKey(req) {
    const authorization = String(req.headers.authorization || '');
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return String(req.headers['x-api-key'] || bearer || '').trim();
}

function authenticateBotLogKey(apiKey) {
    const value = String(apiKey || '').trim();
    if (!value.startsWith('skynet_bot_') || value.length > 200) return null;
    const keys = readJson(KEYS_FILE, []);
    const hash = S.hashKey(value);
    const record = keys.find(item => item.active && S.safeEqualHex(hash, item.keyHash));
    if (!record) return null;
    const creator = S.loadAccounts().find(account => account.id === record.createdByAccountId && account.active && account.isAdmin);
    if (!creator) return null;
    record.lastUsedAt = new Date().toISOString();
    record.requestCount = Number(record.requestCount || 0) + 1;
    writeJsonAtomic(KEYS_FILE, keys);
    return { record, creator };
}

function normalizeEvent(raw, meta) {
    const event = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { message: raw };
    const allowedTypes = new Set(['message', 'command', 'status', 'error', 'warning', 'system']);
    const allowedLevels = new Set(['info', 'warn', 'error']);
    const typeRaw = cleanString(event.type || 'system', 30).toLowerCase();
    const levelRaw = cleanString(event.level || (typeRaw === 'error' ? 'error' : 'info'), 20).toLowerCase();
    const type = allowedTypes.has(typeRaw) ? typeRaw : 'system';
    const level = allowedLevels.has(levelRaw) ? levelRaw : 'info';
    const sourceTimestamp = normalizeTimestamp(event.timestamp);
    return {
        id: S.randomId(12),
        bot: meta.bot,
        instanceId: meta.instanceId || null,
        type,
        level,
        message: cleanString(event.message || event.text || type, MAX_MESSAGE),
        context: sanitizeContext(event.context || event.data || {}),
        sourceTimestamp,
        receivedAt: meta.receivedAt,
        keyId: meta.keyId,
        keyName: meta.keyName
    };
}

function sanitizeContext(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    let count = 0;
    for (const [keyRaw, item] of Object.entries(value)) {
        if (count >= MAX_CONTEXT_KEYS) break;
        const key = cleanString(keyRaw, 60);
        if (!key || /(api.?key|password|passwd|token|secret|authorization|cookie|credential)/i.test(key)) continue;
        if (item === null || typeof item === 'boolean' || typeof item === 'number') out[key] = item;
        else if (typeof item === 'string') out[key] = cleanString(item, 1000);
        else {
            try { out[key] = cleanString(JSON.stringify(item), 1000); }
            catch { out[key] = '[não serializável]'; }
        }
        count += 1;
    }
    return out;
}

function buildStats(logs) {
    const byType = {};
    const byLevel = {};
    for (const item of logs) {
        byType[item.type] = Number(byType[item.type] || 0) + 1;
        byLevel[item.level] = Number(byLevel[item.level] || 0) + 1;
    }
    return { total: logs.length, byType, byLevel };
}

function publicBotKey(key) {
    return {
        id: key.id,
        name: key.name,
        preview: key.preview,
        active: Boolean(key.active),
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt || null,
        requestCount: Number(key.requestCount || 0)
    };
}

function requireAdminSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        const account = session ? S.loadAccounts().find(item => item.id === session.accountId && item.active) : null;
        if (!account) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        if (!account.isAdmin) return res.status(403).json({ ok: false, error: 'Permissão de administrador necessária.' });
        req.account = account;
        req.session = session;
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

function takeIngestSlot(key) {
    const now = Date.now();
    for (const [id, bucket] of ingestBuckets) if (bucket.resetAt <= now) ingestBuckets.delete(id);
    let bucket = ingestBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + 60000 };
        ingestBuckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= INGEST_LIMIT_PER_MINUTE;
}

function cleanString(value, max) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

function clampInt(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
}

function normalizeTimestamp(value) {
    const date = new Date(value || Date.now());
    if (!Number.isFinite(date.getTime())) return new Date().toISOString();
    return date.toISOString();
}

module.exports = { registerBotLogRoutes };
