const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const C = require('./config');
const S = require('./store');

const TIKWM_API = 'https://www.tikwm.com/api/';
const MAX_MEDIA_BYTES = Math.max(10, Math.min(300, Number.parseInt(process.env.MAX_TIKTOK_MB || '150', 10) || 150)) * 1024 * 1024;
const DOWNLOADS_PER_MINUTE = Math.max(1, Math.min(60, Number.parseInt(process.env.TIKTOK_RATE_LIMIT_PER_MINUTE || '12', 10) || 12));
const buckets = new Map();
let tikwmQueue = Promise.resolve();
let lastTikwmRequestAt = 0;

function registerTikTokRoutes(app) {
    const apiCors = cors({
        origin(origin, callback) {
            if (!origin || C.CORS_ORIGINS.has(origin)) return callback(null, true);
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
    });

    app.options('/download-tiktok', apiCors);
    app.get('/download-tiktok', apiCors, requireApiKey, downloadLimiter, async (req, res, next) => {
        try {
            await downloadToResponse(req.query?.url, req.query?.tipo ?? req.query?.type, res);
        } catch (error) {
            next(error);
        }
    });

    app.post('/painel/tiktok-download', express.json({ limit: '32kb' }), requireTrustedOrigin, requireSession, downloadLimiter, async (req, res, next) => {
        try {
            await downloadToResponse(req.body?.url, req.body?.tipo ?? req.body?.type, res);
        } catch (error) {
            next(error);
        }
    });
}

async function downloadToResponse(rawUrl, rawType, res) {
    const url = normalizeTikTokUrl(rawUrl);
    const type = normalizeType(rawType);
    const info = await fetchTikWmInfo(url);
    const mediaValue = type === 'audio' ? info.music : (info.hdplay || info.play);

    if (!mediaValue || typeof mediaValue !== 'string') {
        throw clientError(type === 'audio' ? 'O TikWM não retornou áudio para esse TikTok.' : 'O TikWM não retornou vídeo para esse TikTok.', 404);
    }

    const mediaUrl = new URL(mediaValue, 'https://www.tikwm.com').toString();
    const extension = type === 'audio' ? 'mp3' : 'mp4';
    const filename = buildFilename(info, extension);
    const tempPath = path.join(os.tmpdir(), `skynet-${crypto.randomBytes(12).toString('hex')}.${extension}`);

    try {
        const media = await openPublicMediaStream(mediaUrl);
        await saveStreamWithLimit(media.stream, tempPath, media.contentLength);

        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Download-Filename', filename);
        res.type(type === 'audio' ? 'audio/mpeg' : 'video/mp4');

        await new Promise((resolve, reject) => {
            res.download(tempPath, filename, error => error ? reject(error) : resolve());
        });
    } finally {
        fs.promises.unlink(tempPath).catch(() => {});
    }
}

function normalizeTikTokUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 2048) throw clientError('Informe um link válido do TikTok.');

    let parsed;
    try { parsed = new URL(raw); }
    catch { throw clientError('Link do TikTok inválido.'); }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw clientError('O link do TikTok deve usar HTTP ou HTTPS.');
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    const allowed = host === 'tiktok.com' || host.endsWith('.tiktok.com');
    if (!allowed) throw clientError('Use um link público do TikTok.');

    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
}

function normalizeType(value) {
    const type = String(value || 'video').trim().toLowerCase();
    if (['video', 'mp4'].includes(type)) return 'video';
    if (['audio', 'mp3', 'music'].includes(type)) return 'audio';
    throw clientError('Tipo inválido. Use video ou audio.');
}

async function fetchTikWmInfo(url) {
    return enqueueTikWm(async () => {
        const form = new URLSearchParams({ url, hd: '1' });
        let response;
        try {
            response = await axios.post(TIKWM_API, form.toString(), {
                timeout: 30000,
                maxContentLength: 2 * 1024 * 1024,
                maxBodyLength: 2 * 1024 * 1024,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://www.tikwm.com/',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/148 Safari/537.36'
                }
            });
        } catch (error) {
            throw clientError(error.code === 'ECONNABORTED' ? 'O TikWM demorou demais para responder.' : 'Não foi possível consultar o TikWM.', 502);
        }

        const body = response.data;
        if (!body || Number(body.code) !== 0 || !body.data) {
            throw clientError(String(body?.msg || 'O TikWM não conseguiu processar esse link.'), 422);
        }
        return body.data;
    });
}

function enqueueTikWm(task) {
    const run = tikwmQueue.then(async () => {
        const remaining = 1100 - (Date.now() - lastTikwmRequestAt);
        if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
        lastTikwmRequestAt = Date.now();
        return task();
    });
    tikwmQueue = run.catch(() => {});
    return run;
}

async function openPublicMediaStream(urlValue) {
    let current;
    try { current = new URL(urlValue); }
    catch { throw clientError('O TikWM retornou uma URL de mídia inválida.', 502); }

    if (!['http:', 'https:'].includes(current.protocol)) throw clientError('O TikWM retornou um protocolo de mídia inválido.', 502);

    for (let redirect = 0; redirect <= 3; redirect += 1) {
        await assertPublicHostname(current.hostname);
        const client = current.protocol === 'https:' ? https : http;
        let response;
        try {
            response = await axios.get(current.toString(), {
                responseType: 'stream',
                timeout: 60000,
                maxRedirects: 0,
                validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400),
                headers: {
                    'Referer': 'https://www.tikwm.com/',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/148 Safari/537.36'
                },
                httpAgent: current.protocol === 'http:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined,
                httpsAgent: current.protocol === 'https:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined
            });
        } catch {
            throw clientError('Não foi possível baixar a mídia retornada pelo TikWM.', 502);
        }

        if (response.status >= 300 && response.status < 400) {
            response.data?.destroy?.();
            if (!response.headers.location) throw clientError('Redirecionamento de mídia inválido.', 502);
            current = new URL(response.headers.location, current);
            if (!['http:', 'https:'].includes(current.protocol)) throw clientError('Redirecionamento de mídia não permitido.', 502);
            continue;
        }

        const contentLength = Number.parseInt(response.headers['content-length'] || '0', 10) || 0;
        if (contentLength > MAX_MEDIA_BYTES) {
            response.data?.destroy?.();
            throw clientError(`A mídia ultrapassa o limite de ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)}MB.`, 413);
        }
        return { stream: response.data, contentLength };
    }

    throw clientError('A mídia excedeu o limite de redirecionamentos.', 502);
}

async function saveStreamWithLimit(stream, target, declaredLength) {
    if (declaredLength > MAX_MEDIA_BYTES) throw clientError('Arquivo muito grande.', 413);

    let total = 0;
    const limiter = new Transform({
        transform(chunk, encoding, callback) {
            total += chunk.length;
            if (total > MAX_MEDIA_BYTES) {
                return callback(clientError(`A mídia ultrapassa o limite de ${Math.round(MAX_MEDIA_BYTES / 1024 / 1024)}MB.`, 413));
            }
            callback(null, chunk);
        }
    });

    const writer = fs.createWriteStream(target, { mode: 0o600 });
    try {
        await pipeline(stream, limiter, writer);
    } catch (error) {
        fs.promises.unlink(target).catch(() => {});
        throw error;
    }
}

function buildFilename(info, extension) {
    const user = String(info?.author?.unique_id || 'tiktok').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'tiktok';
    const id = String(info?.id || crypto.randomBytes(6).toString('hex')).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    return `tiktok-${user}-${id}.${extension}`;
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
        next();
    } catch (error) { next(error); }
}

function requireSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        if (!session) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        const account = S.loadAccounts().find(item => item.id === session.accountId && item.active);
        if (!account) return res.status(401).json({ ok: false, error: 'Conta inativa ou removida.' });
        req.account = account;
        next();
    } catch (error) { next(error); }
}

function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}

function downloadLimiter(req, res, next) {
    const key = String(req.account?.id || req.ip || 'unknown');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + 60000 };
        buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > DOWNLOADS_PER_MINUTE) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        return res.status(429).json({ ok: false, error: 'Muitos downloads. Aguarde um pouco e tente novamente.' });
    }
    next();
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

function safeLookup(hostname, options, callback) {
    const opts = typeof options === 'object' && options !== null ? options : {};
    dns.lookup(hostname, { ...opts, all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(error);
        const list = Array.isArray(addresses) ? addresses : [addresses];
        const allowed = list.filter(item => item?.address && !isPrivateIp(item.address));
        if (!allowed.length) return callback(new Error('Destino de rede não permitido'));
        if (opts.all) return callback(null, allowed);
        return callback(null, allowed[0].address, allowed[0].family);
    });
}

async function assertPublicHostname(hostname) {
    const stripped = String(hostname || '').replace(/^\[|\]$/g, '');
    if (!stripped) throw clientError('Destino de mídia inválido.', 502);
    if (net.isIP(stripped)) {
        if (isPrivateIp(stripped)) throw clientError('Destino de mídia não permitido.', 502);
        return;
    }
    const addresses = await dns.promises.lookup(stripped, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw clientError('Destino de mídia não permitido.', 502);
}

function isPrivateIp(address) {
    const value = String(address || '').toLowerCase();
    if (!value) return true;
    if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
    if (net.isIPv6(value)) return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
    if (!net.isIPv4(value)) return true;
    const [a, b] = value.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return false;
}

function clientError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

module.exports = { registerTikTokRoutes };
