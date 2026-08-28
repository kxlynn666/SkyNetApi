const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const express = require('express');
const ffmpegPath = require('ffmpeg-static');
const C = require('./config');
const S = require('./store');

const YTDLP_PATH = process.env.YTDLP_PATH || path.join(C.ROOT, 'bin', 'yt-dlp');
const MAX_YOUTUBE_MB = Math.max(50, Math.min(500, Number.parseInt(process.env.MAX_YOUTUBE_DOWNLOAD_MB || '300', 10) || 300));
const MAX_YOUTUBE_BYTES = MAX_YOUTUBE_MB * 1024 * 1024;
const PREPARED_TTL_MS = 30 * 60 * 1000;
const REQUESTS_PER_MINUTE = Math.max(1, Math.min(20, Number.parseInt(process.env.YOUTUBE_RATE_LIMIT_PER_MINUTE || '6', 10) || 6));
const MAX_PREPARED_PER_ACCOUNT = 3;
const prepared = new Map();
const buckets = new Map();

const cleanupTimer = setInterval(() => {
    purgeExpiredPrepared().catch(() => {});
}, 60 * 1000);
cleanupTimer.unref?.();

function registerYouTubeRoutes(app) {
    const prepare = async (req, res, next) => {
        try {
            const item = await prepareYouTube(req.body?.url, req.body?.height, req.account.id);
            res.setHeader('Cache-Control', 'no-store');
            return res.json({ ok: true, item });
        } catch (error) {
            return next(error);
        }
    };

    app.post('/painel/youtube-prepare', express.json({ limit: '24kb' }), requireTrustedOrigin, requireSession, requestLimiter, prepare);
    // Compatibilidade com o frontend anterior. Agora esta rota também prepara o arquivo local.
    app.post('/painel/youtube-info', express.json({ limit: '24kb' }), requireTrustedOrigin, requireSession, requestLimiter, prepare);

    app.get('/painel/youtube-file', requireSession, async (req, res, next) => {
        try {
            const record = getPrepared(req.query?.token, req.account.id);
            return await servePreparedFile(req, res, record, false);
        } catch (error) {
            return next(error);
        }
    });

    app.get('/painel/youtube-download', requireSession, async (req, res, next) => {
        try {
            const record = getPrepared(req.query?.token, req.account.id);
            return await servePreparedFile(req, res, record, true);
        } catch (error) {
            return next(error);
        }
    });
}

async function prepareYouTube(rawUrl, requestedHeight, accountId) {
    const parsed = parseYouTubeUrl(rawUrl);
    ensureYtDlp();
    await purgeExpiredPrepared();

    const info = await runYtDlpJson(parsed.canonical);
    validateYouTubeInfo(info);

    const qualities = qualityOptionsFromInfo(info);
    if (!qualities.length) throw clientError('Não encontrei um formato de vídeo compatível para download.', 422);
    const height = chooseRequestedHeight(qualities, requestedHeight);

    const downloaded = await downloadYouTubeVideo(parsed.canonical, height);
    const token = crypto.randomBytes(28).toString('base64url');
    const record = {
        token,
        accountId,
        sourceUrl: parsed.canonical,
        title: cleanText(info.title || info.fulltitle || 'Vídeo do YouTube', 300),
        uploader: cleanText(info.uploader || info.channel || info.creator || '', 180),
        duration: Math.max(0, Number(info.duration || 0) || 0),
        thumbnail: safeHttpUrl(info.thumbnail),
        selectedHeight: height,
        tempDir: downloaded.tempDir,
        filePath: downloaded.filePath,
        fileName: downloaded.fileName,
        size: downloaded.size,
        createdAt: Date.now(),
        expiresAt: Date.now() + PREPARED_TTL_MS
    };
    prepared.set(token, record);
    await prunePreparedForAccount(accountId, token);

    const streamUrl = `/painel/youtube-file?token=${encodeURIComponent(token)}`;
    const downloadUrl = `/painel/youtube-download?token=${encodeURIComponent(token)}`;
    return {
        id: cleanText(info.id || parsed.id, 24),
        title: record.title,
        uploader: record.uploader,
        duration: record.duration,
        thumbnail: record.thumbnail,
        canonicalUrl: parsed.canonical,
        selectedHeight: height,
        selectedLabel: `${height}p`,
        size: record.size,
        qualities,
        streamUrl,
        downloadUrl,
        // Mantém compatibilidade com o painel antigo, mas aponta para o arquivo já preparado.
        downloads: [{ height, label: `${height}p`, container: 'MP4', downloadUrl }]
    };
}

function validateYouTubeInfo(info) {
    if (!info || typeof info !== 'object') throw clientError('O YouTube não retornou informações desse vídeo.', 422);
    if (Array.isArray(info.entries) || ['playlist', 'multi_video'].includes(String(info._type || ''))) {
        throw clientError('Playlists não são suportadas. Envie um vídeo individual.', 400);
    }
    if (!looksLikeYouTubeInfo(info)) throw clientError('O link analisado não foi reconhecido como vídeo do YouTube.', 400);
    if (Number(info.age_limit || 0) >= 18) throw clientError('Vídeos marcados como 18+ não são suportados.', 403);
    if (info.is_live || info.live_status === 'is_live') throw clientError('Lives em andamento não são suportadas.', 400);
    if (['private', 'premium_only', 'subscriber_only', 'needs_auth'].includes(String(info.availability || ''))) {
        throw clientError('Esse vídeo exige autenticação ou acesso especial.', 403);
    }
}

function parseYouTubeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 4096) throw clientError('Informe um link válido do YouTube.');

    let url;
    try { url = new URL(raw); }
    catch { throw clientError('Link do YouTube inválido.'); }

    if (!['http:', 'https:'].includes(url.protocol)) throw clientError('Use um link HTTP/HTTPS do YouTube.');
    if (url.username || url.password) throw clientError('Links com usuário ou senha não são permitidos.');

    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    let id = '';
    if (host === 'youtu.be') {
        id = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
        if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
        else {
            const parts = url.pathname.split('/').filter(Boolean);
            if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1] || '';
        }
    } else {
        throw clientError('Use um link youtube.com ou youtu.be.');
    }

    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw clientError('Não foi possível identificar o vídeo do YouTube.');
    return {
        id,
        canonical: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
        embed: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`
    };
}

function looksLikeYouTubeInfo(info) {
    const labels = [info.extractor, info.extractor_key, info.webpage_url_domain, info.webpage_url, info.original_url]
        .filter(Boolean).join(' ').toLowerCase();
    return labels.includes('youtube') || labels.includes('youtu.be');
}

function qualityOptionsFromInfo(info) {
    const formats = Array.isArray(info.formats) ? info.formats : [];
    const heights = formats
        .filter(format => format && format.vcodec && format.vcodec !== 'none')
        .map(format => Number(format.height || 0))
        .filter(height => Number.isFinite(height) && height > 0);
    const maxHeight = heights.length ? Math.max(...heights) : Number(info.height || 0);
    if (!maxHeight) return [];

    const targets = [360, 720, 1080];
    const available = targets.filter(height => maxHeight >= height);
    if (!available.length) available.push(Math.max(144, Math.min(360, Math.round(maxHeight))));
    return available.map(height => ({ height, label: `${height}p`, container: 'MP4' }));
}

function chooseRequestedHeight(qualities, requestedHeight) {
    const heights = (qualities || []).map(item => Number(item.height)).filter(Number.isFinite).sort((a, b) => a - b);
    if (!heights.length) throw clientError('Nenhuma qualidade de vídeo está disponível.', 422);
    const requested = Number(requestedHeight);
    if (!Number.isFinite(requested) || requested <= 0) {
        return heights.includes(720) ? 720 : heights[heights.length - 1];
    }
    const candidates = heights.filter(height => height <= requested);
    return candidates.length ? candidates[candidates.length - 1] : heights[0];
}

function ensureYtDlp() {
    if (!fs.existsSync(YTDLP_PATH)) {
        throw clientError('yt-dlp não está instalado no servidor. Execute o instalador do projeto ou configure YTDLP_PATH.', 503);
    }
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
        throw clientError('FFmpeg não está disponível no servidor.', 503);
    }
}

function runYtDlpJson(url) {
    const args = [
        '--no-config', '--no-playlist', '--skip-download', '--dump-single-json', '--no-warnings',
        '--socket-timeout', '15', '--extractor-retries', '2', '--fragment-retries', '2', '--', url
    ];
    return runYtDlp(args, { timeoutMs: 45000, maxStdoutBytes: 10 * 1024 * 1024 }).then(result => {
        try { return JSON.parse(result.stdout); }
        catch { throw clientError('Não foi possível interpretar a resposta do YouTube.', 502); }
    });
}

async function downloadYouTubeVideo(sourceUrl, height) {
    ensureYtDlp();
    const parsed = parseYouTubeUrl(sourceUrl);
    const targetHeight = Math.max(144, Math.min(1080, Number(height) || 720));
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'skynet-youtube-'));
    const output = path.join(tempDir, '%(title).110B-%(id)s.%(ext)s');
    const selector = [
        `bestvideo[ext=mp4][vcodec^=avc1][height<=${targetHeight}]+bestaudio[ext=m4a]`,
        `bestvideo[ext=mp4][height<=${targetHeight}]+bestaudio[ext=m4a]`,
        `best[ext=mp4][height<=${targetHeight}][vcodec!=none][acodec!=none]`,
        `best[height<=${targetHeight}][vcodec!=none][acodec!=none]`
    ].join('/');
    const args = [
        '--no-config', '--no-playlist', '--no-warnings', '--socket-timeout', '20',
        '--retries', '2', '--fragment-retries', '2', '--max-filesize', `${MAX_YOUTUBE_MB}M`,
        '--restrict-filenames', '--no-part', '--ffmpeg-location', ffmpegPath,
        '-f', selector, '--merge-output-format', 'mp4', '--remux-video', 'mp4', '-o', output, '--', parsed.canonical
    ];

    try {
        await runYtDlp(args, { timeoutMs: 180000, watchDir: tempDir, maxDirBytes: MAX_YOUTUBE_BYTES * 3 });
        const entries = await fs.promises.readdir(tempDir, { withFileTypes: true });
        const files = entries.filter(entry => entry.isFile()).map(entry => path.join(tempDir, entry.name));
        if (!files.length) throw clientError('O yt-dlp não gerou um arquivo para esse vídeo.', 422);

        const withStats = await Promise.all(files.map(async filePath => ({ filePath, stat: await fs.promises.stat(filePath) })));
        const mp4Files = withStats.filter(entry => path.extname(entry.filePath).toLowerCase() === '.mp4');
        mp4Files.sort((a, b) => b.stat.size - a.stat.size);
        const selected = mp4Files[0];
        if (!selected) throw clientError('Não foi possível finalizar esse vídeo em MP4.', 422);
        if (selected.stat.size > MAX_YOUTUBE_BYTES) throw clientError(`O vídeo ultrapassa o limite de ${MAX_YOUTUBE_MB}MB.`, 413);

        return {
            tempDir,
            filePath: selected.filePath,
            fileName: path.basename(selected.filePath),
            size: selected.stat.size
        };
    } catch (error) {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

async function servePreparedFile(req, res, record, download) {
    let stat;
    try { stat = await fs.promises.stat(record.filePath); }
    catch {
        await dropPrepared(record.token);
        throw clientError('O arquivo temporário não está mais disponível. Carregue o vídeo novamente.', 410);
    }
    if (!stat.isFile()) throw clientError('Arquivo de vídeo inválido.', 410);

    record.expiresAt = Date.now() + PREPARED_TTL_MS;
    const size = stat.size;
    const rangeHeader = String(req.headers.range || '').trim();
    const range = rangeHeader ? parseRangeHeader(rangeHeader, size) : null;
    if (rangeHeader && !range) {
        res.status(416);
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.end();
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', contentDisposition(download ? 'attachment' : 'inline', record.fileName));

    if (range) {
        const length = range.end - range.start + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
        res.setHeader('Content-Length', String(length));
        return pipeFile(record.filePath, res, { start: range.start, end: range.end });
    }

    res.setHeader('Content-Length', String(size));
    return pipeFile(record.filePath, res);
}

function parseRangeHeader(value, size) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(String(value || '').trim());
    if (!match || !Number.isFinite(size) || size <= 0) return null;
    let start;
    let end;
    if (!match[1] && !match[2]) return null;
    if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isFinite(suffix) || suffix <= 0) return null;
        start = Math.max(0, size - suffix);
        end = size - 1;
    } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : size - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null;
        end = Math.min(end, size - 1);
    }
    return { start, end };
}

function pipeFile(filePath, res, range = undefined) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, range);
        stream.on('error', reject);
        res.on('close', resolve);
        res.on('finish', resolve);
        stream.pipe(res);
    });
}

function contentDisposition(mode, fileName) {
    const raw = cleanText(fileName || 'youtube-video.mp4', 180).replace(/[\r\n]/g, '');
    const ascii = raw.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'youtube-video.mp4';
    return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

function getPrepared(value, accountId) {
    const token = String(value || '').trim();
    const record = prepared.get(token);
    if (!record || record.accountId !== accountId) throw clientError('Link de vídeo inválido ou expirado.', 410);
    if (record.expiresAt <= Date.now()) {
        dropPrepared(token).catch(() => {});
        throw clientError('O arquivo temporário expirou. Carregue o vídeo novamente.', 410);
    }
    return record;
}

async function purgeExpiredPrepared() {
    const now = Date.now();
    const expired = [...prepared.values()].filter(record => record.expiresAt <= now);
    await Promise.all(expired.map(record => dropPrepared(record.token)));
}

async function prunePreparedForAccount(accountId, keepToken) {
    const records = [...prepared.values()]
        .filter(record => record.accountId === accountId && record.token !== keepToken)
        .sort((a, b) => b.createdAt - a.createdAt);
    const excess = records.slice(Math.max(0, MAX_PREPARED_PER_ACCOUNT - 1));
    await Promise.all(excess.map(record => dropPrepared(record.token)));
}

async function dropPrepared(token) {
    const record = prepared.get(token);
    if (!record) return;
    prepared.delete(token);
    await fs.promises.rm(record.tempDir, { recursive: true, force: true }).catch(() => {});
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
        let timedOut = false;
        let settled = false;

        const timeout = setTimeout(() => {
            timedOut = true;
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
                if (total > (options.maxDirBytes || MAX_YOUTUBE_BYTES)) {
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
            if (stderr.length < 24000) stderr += chunk.toString('utf8');
        });

        child.on('error', error => finish(() => reject(clientError(`Falha ao iniciar yt-dlp: ${error.message}`, 502))));
        child.on('close', code => finish(() => {
            if (killedForSize) return reject(clientError(`O vídeo ultrapassa o limite de ${MAX_YOUTUBE_MB}MB.`, 413));
            if (timedOut) return reject(clientError('O processamento do vídeo excedeu o tempo permitido.', 504));
            if (code !== 0) {
                const message = cleanYtDlpError(stderr);
                return reject(clientError(message || 'O yt-dlp não conseguiu processar esse vídeo.', 422));
            }
            return resolve({ stdout, stderr });
        }));

        function finish(fn) {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (sizeWatcher) clearInterval(sizeWatcher);
            fn();
        }
    });
}

function requestLimiter(req, res, next) {
    const accountId = req.account?.id || 'anonymous';
    const now = Date.now();
    let bucket = buckets.get(accountId);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + 60000 };
        buckets.set(accountId, bucket);
    }
    bucket.count += 1;
    if (bucket.count > REQUESTS_PER_MINUTE) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        return res.status(429).json({ ok: false, error: 'Muitas solicitações de YouTube. Tente novamente em instantes.' });
    }
    return next();
}

function accountFromRequest(req) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        return session ? S.loadAccounts().find(entry => entry.id === session.accountId && entry.active) || null : null;
    } catch { return null; }
}

function requireSession(req, res, next) {
    const account = accountFromRequest(req);
    if (!account) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    req.account = account;
    return next();
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

function safeHttpUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch { return ''; }
}

function cleanText(value, max = 200) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanYtDlpError(value) {
    const text = cleanText(value, 900);
    if (/private video/i.test(text)) return 'Esse vídeo é privado.';
    if (/sign in|confirm your age|age-restricted/i.test(text)) return 'Esse vídeo exige autenticação ou verificação de idade.';
    if (/premium/i.test(text)) return 'Esse vídeo exige acesso Premium.';
    if (/copyright|unavailable|not available/i.test(text)) return 'Esse vídeo não está disponível para download pelo servidor.';
    if (/requested format is not available/i.test(text)) return 'A qualidade escolhida não está disponível para esse vídeo.';
    return text ? 'Não foi possível processar esse vídeo do YouTube.' : '';
}

function clientError(message, status = 400) {
    const error = new Error(message);
    error.statusCode = status;
    return error;
}

module.exports = {
    registerYouTubeRoutes,
    parseYouTubeUrl,
    qualityOptionsFromInfo,
    chooseRequestedHeight,
    parseRangeHeader
};
