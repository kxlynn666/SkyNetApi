const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const axios = require('axios');
const express = require('express');
const C = require('./config');
const S = require('./store');

const YTDLP_PATH = process.env.YTDLP_PATH || path.join(C.ROOT, 'bin', 'yt-dlp');
const MAX_MEDIA_MB = Math.max(20, Math.min(500, Number.parseInt(process.env.MAX_MEDIA_DOWNLOAD_MB || '250', 10) || 250));
const MAX_MEDIA_BYTES = MAX_MEDIA_MB * 1024 * 1024;
const TOKEN_TTL_MS = 20 * 60 * 1000;
const REQUESTS_PER_MINUTE = Math.max(1, Math.min(60, Number.parseInt(process.env.MEDIA_RATE_LIMIT_PER_MINUTE || '12', 10) || 12));
const tokens = new Map();
const buckets = new Map();

const BLOCKED_HOST_SUFFIXES = [
    'youtube.com', 'youtu.be', 'youtube-nocookie.com', 'googlevideo.com', 'youtubei.googleapis.com'
];
const ADULT_HOST_FRAGMENTS = ['pornhub', 'xvideos', 'xnxx', 'redtube', 'youporn', 'xhamster', 'onlyfans', 'fansly'];

function registerMediaRoutes(app) {
    app.post('/painel/media-info', express.json({ limit: '32kb' }), requireTrustedOrigin, requireSession, requestLimiter, async (req, res, next) => {
        try {
            const item = await analyzeMedia(req.body?.url, req.account.id);
            res.setHeader('Cache-Control', 'no-store');
            return res.json({ ok: true, item });
        } catch (error) {
            return next(error);
        }
    });

    app.get('/painel/media-stream', requireSession, async (req, res, next) => {
        try {
            const token = takeToken(req.query?.token, req.account.id, 'preview', false);
            await proxyPreview(token, req, res);
        } catch (error) {
            return next(error);
        }
    });

    app.get('/painel/media-download', requireSession, requestLimiter, async (req, res, next) => {
        let tempDir = '';
        try {
            const token = takeToken(req.query?.token, req.account.id, 'download', false);
            const result = await downloadMedia(token.sourceUrl, token.type);
            tempDir = result.tempDir;
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.type(mimeForExtension(path.extname(result.filePath).slice(1)));
            return res.download(result.filePath, result.fileName, error => {
                fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
                if (error && !res.headersSent) next(error);
            });
        } catch (error) {
            if (tempDir) fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
            return next(error);
        }
    });
}

async function analyzeMedia(rawUrl, accountId) {
    const sourceUrl = await normalizeAndValidateSourceUrl(rawUrl);
    ensureYtDlp();

    const info = await runYtDlpJson(sourceUrl);
    if (!info || typeof info !== 'object') throw clientError('O yt-dlp não retornou informações para esse link.', 422);
    if (Array.isArray(info.entries) || ['playlist', 'multi_video'].includes(info._type)) {
        throw clientError('Playlists e coleções não são suportadas. Envie o link de uma mídia individual.', 400);
    }
    if (Number(info.age_limit || 0) >= 18) throw clientError('Conteúdo marcado como 18+ não é permitido.', 403);
    if (info.is_live) throw clientError('Lives não são suportadas pelo Media Downloader.', 400);
    if (['private', 'premium_only', 'subscriber_only', 'needs_auth'].includes(String(info.availability || ''))) {
        throw clientError('Essa mídia exige autenticação ou acesso especial.', 403);
    }

    const formats = normalizeFormats(info);
    const videoFormats = formats.filter(format => hasVideo(format) && hasAudio(format));
    const audioFormats = formats.filter(format => hasAudio(format) && !hasVideo(format));
    const videoPreview = chooseVideoPreview(videoFormats);
    const audioPreview = chooseAudioPreview(audioFormats);
    const hasVideoDownload = videoFormats.length > 0 || Boolean(hasVideo(info) && hasAudio(info));
    const hasAudioDownload = audioFormats.length > 0 || Boolean(hasAudio(info));

    if (!hasVideoDownload && !hasAudioDownload) {
        throw clientError('Não encontrei um formato de vídeo ou áudio utilizável nesse link.', 422);
    }

    purgeExpiredTokens();

    const item = {
        title: cleanText(info.title || info.fulltitle || 'Mídia', 300),
        uploader: cleanText(info.uploader || info.channel || info.creator || '', 160),
        site: cleanText(info.extractor_key || info.extractor || info.webpage_url_domain || new URL(sourceUrl).hostname, 100),
        duration: Number(info.duration || 0) || 0,
        thumbnail: safeHttpUrl(info.thumbnail),
        sourceUrl,
        hasVideo: hasVideoDownload,
        hasAudio: hasAudioDownload,
        videoPreviewUrl: '',
        audioPreviewUrl: '',
        videoDirectUrl: videoPreview?.url || '',
        audioDirectUrl: audioPreview?.url || '',
        videoDownloadUrl: '',
        audioDownloadUrl: ''
    };

    if (videoPreview) {
        const previewToken = createToken({ kind: 'preview', accountId, url: videoPreview.url, headers: sanitizeUpstreamHeaders(videoPreview.http_headers || info.http_headers), type: 'video' });
        item.videoPreviewUrl = `/painel/media-stream?token=${encodeURIComponent(previewToken)}`;
    }
    if (audioPreview) {
        const previewToken = createToken({ kind: 'preview', accountId, url: audioPreview.url, headers: sanitizeUpstreamHeaders(audioPreview.http_headers || info.http_headers), type: 'audio' });
        item.audioPreviewUrl = `/painel/media-stream?token=${encodeURIComponent(previewToken)}`;
    }
    if (hasVideoDownload) {
        const downloadToken = createToken({ kind: 'download', accountId, sourceUrl, type: 'video' });
        item.videoDownloadUrl = `/painel/media-download?token=${encodeURIComponent(downloadToken)}`;
    }
    if (hasAudioDownload) {
        const downloadToken = createToken({ kind: 'download', accountId, sourceUrl, type: 'audio' });
        item.audioDownloadUrl = `/painel/media-download?token=${encodeURIComponent(downloadToken)}`;
    }

    return item;
}

function normalizeFormats(info) {
    if (Array.isArray(info.formats) && info.formats.length) return info.formats.filter(item => item && typeof item === 'object');
    return info.url ? [info] : [];
}

function hasVideo(format) {
    return Boolean(format && format.vcodec && format.vcodec !== 'none');
}

function hasAudio(format) {
    return Boolean(format && format.acodec && format.acodec !== 'none');
}

function isHttpFormat(format) {
    if (!format?.url) return false;
    try {
        const parsed = new URL(format.url);
        return ['http:', 'https:'].includes(parsed.protocol) && !String(format.protocol || '').includes('m3u8') && !String(format.protocol || '').includes('dash');
    } catch {
        return false;
    }
}

function chooseVideoPreview(formats) {
    return formats
        .filter(format => isHttpFormat(format) && ['mp4', 'webm'].includes(String(format.ext || '').toLowerCase()))
        .sort((a, b) => videoScore(b) - videoScore(a))[0] || null;
}

function videoScore(format) {
    const extBonus = String(format.ext || '').toLowerCase() === 'mp4' ? 100000 : 0;
    const height = Math.min(2160, Number(format.height || 0));
    const bitrate = Math.min(50000, Number(format.tbr || 0));
    return extBonus + height * 100 + bitrate;
}

function chooseAudioPreview(formats) {
    return formats
        .filter(format => isHttpFormat(format) && ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'webm'].includes(String(format.ext || '').toLowerCase()))
        .sort((a, b) => audioScore(b) - audioScore(a))[0] || null;
}

function audioScore(format) {
    const ext = String(format.ext || '').toLowerCase();
    const bonus = ext === 'mp3' ? 30000 : ext === 'm4a' ? 25000 : 0;
    return bonus + Math.min(10000, Number(format.abr || format.tbr || 0));
}

async function normalizeAndValidateSourceUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 4096) throw clientError('Informe um link público válido.');

    let parsed;
    try { parsed = new URL(raw); }
    catch { throw clientError('Link inválido.'); }

    if (!['http:', 'https:'].includes(parsed.protocol)) throw clientError('Apenas links HTTP/HTTPS são permitidos.');
    if (parsed.username || parsed.password) throw clientError('Links com usuário ou senha não são permitidos.');

    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (!host) throw clientError('Hostname inválido.');
    if (BLOCKED_HOST_SUFFIXES.some(domain => host === domain || host.endsWith(`.${domain}`))) {
        throw clientError('Links do YouTube não são aceitos pelo Media Downloader.', 403);
    }
    if (ADULT_HOST_FRAGMENTS.some(fragment => host.includes(fragment))) {
        throw clientError('Esse domínio não é permitido.', 403);
    }
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
        throw clientError('Endereços de rede interna não são permitidos.', 403);
    }

    await assertPublicHostname(host);
    parsed.hash = '';
    return parsed.toString();
}

function ensureYtDlp() {
    if (!fs.existsSync(YTDLP_PATH)) {
        throw clientError('yt-dlp não está instalado no servidor. Execute o instalador do projeto ou configure YTDLP_PATH.', 503);
    }
}

function runYtDlpJson(url) {
    const args = [
        '--no-config', '--no-playlist', '--skip-download', '--dump-single-json', '--no-warnings',
        '--socket-timeout', '15', '--extractor-retries', '2', '--fragment-retries', '2', '--', url
    ];
    return runYtDlp(args, { timeoutMs: 35000, maxStdoutBytes: 8 * 1024 * 1024 }).then(result => {
        try { return JSON.parse(result.stdout); }
        catch { throw clientError('Não foi possível interpretar a resposta do yt-dlp.', 502); }
    });
}

async function downloadMedia(sourceUrl, type) {
    ensureYtDlp();
    await normalizeAndValidateSourceUrl(sourceUrl);

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'skynet-media-'));
    const selector = type === 'audio'
        ? 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best'
        : 'best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]';
    const output = path.join(tempDir, '%(title).100B-%(id)s.%(ext)s');

    const args = [
        '--no-config', '--no-playlist', '--no-warnings', '--socket-timeout', '20',
        '--retries', '2', '--fragment-retries', '2', '--max-filesize', `${MAX_MEDIA_MB}M`,
        '--restrict-filenames', '--no-part', '-f', selector, '-o', output, '--', sourceUrl
    ];

    try {
        await runYtDlp(args, { timeoutMs: 150000, watchDir: tempDir, maxDirBytes: MAX_MEDIA_BYTES });
        const entries = await fs.promises.readdir(tempDir, { withFileTypes: true });
        const files = entries.filter(entry => entry.isFile()).map(entry => path.join(tempDir, entry.name));
        if (!files.length) throw clientError('O yt-dlp não gerou um arquivo para essa mídia.', 422);

        const withStats = await Promise.all(files.map(async filePath => ({ filePath, stat: await fs.promises.stat(filePath) })));
        withStats.sort((a, b) => b.stat.size - a.stat.size);
        const selected = withStats[0];
        if (selected.stat.size > MAX_MEDIA_BYTES) throw clientError(`O arquivo ultrapassa o limite de ${MAX_MEDIA_MB}MB.`, 413);

        return { tempDir, filePath: selected.filePath, fileName: path.basename(selected.filePath) };
    } catch (error) {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

function runYtDlp(args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(YTDLP_PATH, args, {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        let stdout = '';
        let stderr = '';
        let stdoutBytes = 0;
        let killedForSize = false;
        let settled = false;

        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
        }, options.timeoutMs || 60000);

        const sizeWatcher = options.watchDir ? setInterval(async () => {
            try {
                const entries = await fs.promises.readdir(options.watchDir, { withFileTypes: true });
                let total = 0;
                for (const entry of entries) {
                    if (!entry.isFile()) continue;
                    total += (await fs.promises.stat(path.join(options.watchDir, entry.name))).size;
                }
                if (total > (options.maxDirBytes || MAX_MEDIA_BYTES)) {
                    killedForSize = true;
                    child.kill('SIGKILL');
                }
            } catch {}
        }, 500) : null;

        child.stdout.on('data', chunk => {
            stdoutBytes += chunk.length;
            if (stdoutBytes > (options.maxStdoutBytes || 1024 * 1024)) {
                child.kill('SIGKILL');
                return;
            }
            stdout += chunk.toString('utf8');
        });
        child.stderr.on('data', chunk => {
            if (stderr.length < 20000) stderr += chunk.toString('utf8');
        });

        child.on('error', error => finish(() => reject(clientError(`Falha ao iniciar yt-dlp: ${error.message}`, 502))));
        child.on('close', (code, signal) => finish(() => {
            if (killedForSize) return reject(clientError(`A mídia ultrapassa o limite de ${MAX_MEDIA_MB}MB.`, 413));
            if (signal === 'SIGKILL' && code === null) return reject(clientError('O yt-dlp excedeu o tempo ou limite permitido.', 504));
            if (code !== 0) {
                const message = summarizeYtDlpError(stderr);
                return reject(clientError(message, 422));
            }
            resolve({ stdout, stderr });
        }));

        function finish(callback) {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (sizeWatcher) clearInterval(sizeWatcher);
            callback();
        }
    });
}

function summarizeYtDlpError(stderr) {
    const text = String(stderr || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const last = lines.reverse().find(line => /error|unsupported|unable|failed/i.test(line)) || lines[0] || '';
    if (/drm/i.test(text)) return 'Essa mídia parece usar DRM e não pode ser baixada.';
    if (/login|sign in|cookies|authentication|private/i.test(text)) return 'Esse link exige login, cookies ou acesso privado.';
    if (/unsupported url/i.test(text)) return 'O yt-dlp não oferece suporte a esse link.';
    return cleanText(last.replace(/^ERROR:\s*/i, ''), 300) || 'Não foi possível processar esse link com yt-dlp.';
}

async function proxyPreview(token, req, res) {
    let current = new URL(token.url);
    for (let redirects = 0; redirects <= 3; redirects += 1) {
        await assertPublicHostname(current.hostname);
        const client = current.protocol === 'https:' ? https : http;
        const headers = { ...token.headers };
        if (req.headers.range) headers.Range = req.headers.range;

        let response;
        try {
            response = await axios.get(current.toString(), {
                responseType: 'stream', timeout: 30000, maxRedirects: 0,
                validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400),
                headers,
                httpAgent: current.protocol === 'http:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined,
                httpsAgent: current.protocol === 'https:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined
            });
        } catch {
            throw clientError('Não foi possível abrir a prévia dessa mídia.', 502);
        }

        if (response.status >= 300 && response.status < 400) {
            response.data?.destroy?.();
            if (!response.headers.location) throw clientError('Redirecionamento de mídia inválido.', 502);
            current = new URL(response.headers.location, current);
            continue;
        }

        const contentLength = Number.parseInt(response.headers['content-length'] || '0', 10) || 0;
        if (contentLength > MAX_MEDIA_BYTES && !req.headers.range) {
            response.data?.destroy?.();
            throw clientError(`A prévia ultrapassa o limite de ${MAX_MEDIA_MB}MB.`, 413);
        }

        res.status(response.status);
        for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
            if (response.headers[name]) res.setHeader(name, response.headers[name]);
        }
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        response.data.on('error', () => { if (!res.destroyed) res.destroy(); });
        req.on('close', () => response.data?.destroy?.());
        response.data.pipe(res);
        return;
    }
    throw clientError('A mídia excedeu o limite de redirecionamentos.', 502);
}

function createToken(payload) {
    const id = crypto.randomBytes(24).toString('hex');
    tokens.set(id, { ...payload, expiresAt: Date.now() + TOKEN_TTL_MS });
    return id;
}

function takeToken(id, accountId, kind, consume) {
    const key = String(id || '');
    const token = tokens.get(key);
    if (!token || token.expiresAt <= Date.now() || token.accountId !== accountId || token.kind !== kind) {
        if (token?.expiresAt <= Date.now()) tokens.delete(key);
        throw clientError('Link temporário inválido ou expirado.', 401);
    }
    if (consume) tokens.delete(key);
    return token;
}

function purgeExpiredTokens() {
    const now = Date.now();
    for (const [id, token] of tokens) if (token.expiresAt <= now) tokens.delete(id);
}

function sanitizeUpstreamHeaders(headers) {
    const source = headers && typeof headers === 'object' ? headers : {};
    const allowed = {};
    for (const name of ['User-Agent', 'Referer', 'Origin', 'Accept', 'Accept-Language']) {
        const value = source[name] ?? source[name.toLowerCase()];
        if (typeof value === 'string' && value.length <= 1000) allowed[name] = value;
    }
    return allowed;
}

function safeHttpUrl(value) {
    try {
        const parsed = new URL(String(value || ''));
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch { return ''; }
}

function cleanText(value, maxLength) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function mimeForExtension(ext) {
    const value = String(ext || '').toLowerCase();
    const map = {
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
        mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav'
    };
    return map[value] || 'application/octet-stream';
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

function requestLimiter(req, res, next) {
    const key = String(req.account?.id || req.ip || 'unknown');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + 60000 };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > REQUESTS_PER_MINUTE) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        return res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente em instantes.' });
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
    const stripped = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
    if (!stripped) throw clientError('Destino inválido.', 400);
    if (net.isIP(stripped)) {
        if (isPrivateIp(stripped)) throw clientError('Endereços de rede interna não são permitidos.', 403);
        return;
    }
    const addresses = await dns.promises.lookup(stripped, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw clientError('Endereços de rede interna não são permitidos.', 403);
}

function isPrivateIp(address) {
    const value = String(address || '').toLowerCase();
    if (!value) return true;
    if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
    if (net.isIPv6(value)) {
        return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
    }
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

module.exports = { registerMediaRoutes };
