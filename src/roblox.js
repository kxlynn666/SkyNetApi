const express = require('express');
const cors = require('cors');
const axios = require('axios');
const C = require('./config');
const S = require('./store');

const USERS_API = 'https://users.roblox.com';
const THUMBNAILS_API = 'https://thumbnails.roblox.com';
const AVATAR_API = 'https://avatar.roblox.com';
const REQUESTS_PER_MINUTE = Math.max(1, Math.min(120, Number.parseInt(process.env.ROBLOX_RATE_LIMIT_PER_MINUTE || '30', 10) || 30));
const buckets = new Map();

function registerRobloxRoutes(app) {
    const apiCors = cors({
        origin(origin, callback) {
            if (!origin || C.CORS_ORIGINS.has(origin)) return callback(null, true);
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
    });

    app.options('/roblox-user', apiCors);
    app.get('/roblox-user', apiCors, requireApiKey, lookupLimiter, async (req, res, next) => {
        try {
            const player = await lookupPlayer(req.query?.username ?? req.query?.user ?? req.query?.id);
            res.setHeader('Cache-Control', 'no-store');
            return res.json({ ok: true, player });
        } catch (error) {
            return next(error);
        }
    });

    app.post(
        '/painel/roblox-user',
        express.json({ limit: '16kb' }),
        requireTrustedOrigin,
        requireSession,
        lookupLimiter,
        async (req, res, next) => {
            try {
                const player = await lookupPlayer(req.body?.username ?? req.body?.user ?? req.body?.id);
                res.setHeader('Cache-Control', 'no-store');
                return res.json({ ok: true, player });
            } catch (error) {
                return next(error);
            }
        }
    );
}

async function lookupPlayer(value) {
    const query = normalizeLookup(value);
    const basic = query.type === 'id'
        ? await getUserById(query.value)
        : await getUserByUsername(query.value);

    if (!basic?.id) throw clientError('Jogador não encontrado.', 404);

    const userId = Number(basic.id);
    const details = await robloxGet(`${USERS_API}/v1/users/${userId}`);

    const [thumbnailResult, wearingResult] = await Promise.allSettled([
        robloxGet(`${THUMBNAILS_API}/v1/users/avatar`, {
            userIds: String(userId),
            size: '720x720',
            format: 'Png',
            isCircular: 'false'
        }),
        robloxGet(`${AVATAR_API}/v1/users/${userId}/currently-wearing`)
    ]);

    const thumbnailData = thumbnailResult.status === 'fulfilled' ? thumbnailResult.value?.data?.[0] : null;
    const wearing = wearingResult.status === 'fulfilled' && Array.isArray(wearingResult.value?.assetIds)
        ? wearingResult.value.assetIds.filter(id => Number.isSafeInteger(Number(id))).map(Number).slice(0, 200)
        : [];

    const username = String(details.name || basic.name || '').trim();
    const displayName = String(details.displayName || basic.displayName || username).trim();

    return {
        id: userId,
        username,
        displayName,
        description: String(details.description || '').slice(0, 2000),
        createdAt: details.created || null,
        hasVerifiedBadge: Boolean(details.hasVerifiedBadge ?? basic.hasVerifiedBadge),
        avatarUrl: thumbnailData?.state === 'Completed' ? String(thumbnailData.imageUrl || '') : '',
        avatarState: String(thumbnailData?.state || ''),
        currentlyWearing: wearing,
        profileUrl: `https://www.roblox.com/users/${userId}/profile`
    };
}

function normalizeLookup(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 200) throw clientError('Informe um username, ID ou link de perfil do Roblox.');

    if (/^https?:\/\//i.test(raw)) {
        let parsed;
        try { parsed = new URL(raw); }
        catch { throw clientError('Link de perfil do Roblox inválido.'); }
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== 'roblox.com') throw clientError('Use um perfil do Roblox.');
        const match = parsed.pathname.match(/^\/users\/(\d+)\/profile\/?$/i);
        if (!match) throw clientError('Não foi possível identificar o usuário nesse link.');
        return { type: 'id', value: match[1] };
    }

    if (/^\d{1,20}$/.test(raw)) return { type: 'id', value: raw };
    if (!/^[A-Za-z0-9_]{3,20}$/.test(raw)) {
        throw clientError('Username inválido. Use de 3 a 20 caracteres: letras, números ou _.');
    }
    return { type: 'username', value: raw };
}

async function getUserByUsername(username) {
    try {
        const response = await axios.post(`${USERS_API}/v1/usernames/users`, {
            usernames: [username],
            excludeBannedUsers: false
        }, requestOptions('POST'));
        return Array.isArray(response.data?.data) ? response.data.data[0] : null;
    } catch (error) {
        throw upstreamError(error);
    }
}

async function getUserById(id) {
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId <= 0) throw clientError('ID do Roblox inválido.');

    try {
        const response = await axios.post(`${USERS_API}/v1/users`, {
            userIds: [numericId],
            excludeBannedUsers: false
        }, requestOptions('POST'));
        return Array.isArray(response.data?.data) ? response.data.data[0] : null;
    } catch (error) {
        throw upstreamError(error);
    }
}

async function robloxGet(url, params = undefined) {
    try {
        const response = await axios.get(url, {
            ...requestOptions('GET'),
            params
        });
        return response.data;
    } catch (error) {
        throw upstreamError(error);
    }
}

function requestOptions(method) {
    return {
        timeout: 10000,
        maxContentLength: 1024 * 1024,
        maxBodyLength: 1024 * 1024,
        headers: {
            'Accept': 'application/json',
            ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
            'User-Agent': 'SkyNetApi/RobloxLookup'
        }
    };
}

function upstreamError(error) {
    if (error?.response?.status === 404) return clientError('Jogador não encontrado.', 404);
    if (error?.response?.status === 429) return clientError('O Roblox limitou as consultas temporariamente.', 429);
    if (error?.code === 'ECONNABORTED') return clientError('O Roblox demorou demais para responder.', 504);
    return clientError('Não foi possível consultar o Roblox.', 502);
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

function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}

function lookupLimiter(req, res, next) {
    const key = String(req.account?.id || req.ip || 'unknown');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + 60000 };
        buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > REQUESTS_PER_MINUTE) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        return res.status(429).json({ ok: false, error: 'Muitas consultas ao Roblox. Tente novamente em instantes.' });
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

function clientError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

module.exports = { registerRobloxRoutes };
