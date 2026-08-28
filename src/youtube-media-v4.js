const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const express = require('express');
const ffmpegPath = require('ffmpeg-static');
const C = require('./config');
const S = require('./store');
const { parseYouTubeUrl, qualityOptionsFromInfo, chooseRequestedHeight } = require('./youtube');

const YTDLP_PATH = process.env.YTDLP_PATH || path.join(C.ROOT, 'bin', 'yt-dlp');
const MAX_MB = Math.max(50, Math.min(500, Number.parseInt(process.env.MAX_YOUTUBE_DOWNLOAD_MB || '300', 10) || 300));
const MAX_BYTES = MAX_MB * 1024 * 1024;
const TTL_MS = 30 * 60 * 1000;
const VERIFY_CACHE_MS = 15 * 1000;
const MAX_PREPARED_PER_ACCOUNT = 3;
const REQUESTS_PER_MINUTE = Math.max(1, Math.min(20, Number.parseInt(process.env.YOUTUBE_RATE_LIMIT_PER_MINUTE || '6', 10) || 6));
const prepared = new Map();
const buckets = new Map();

const cleanupTimer = setInterval(() => purgeExpired().catch(() => {}), 60 * 1000);
cleanupTimer.unref?.();

function registerYouTubeMediaV4Routes(app) {
    const prepare = async (req, res, next) => {
        try {
            const item = await prepareMedia(req.body?.url, req.body?.kind, req.body?.height, req.account.id);
            res.setHeader('Cache-Control', 'no-store');
            return res.json({ ok: true, item });
        } catch (error) {
            return next(error);
        }
    };

    app.post('/painel/youtube-prepare', express.json({ limit: '24kb' }), requireTrustedOrigin, requireSession, requestLimiter, prepare);
    app.post('/painel/youtube-info', express.json({ limit: '24kb' }), requireTrustedOrigin, requireSession, requestLimiter, prepare);

    app.get('/painel/youtube-file', requireSession, async (req, res, next) => {
        try {
            const record = getPrepared(req.query?.token, req.account.id);
            await verifyPreparedIntegrity(record, false);
            return await servePrepared(req, res, record, false);
        } catch (error) {
            return next(error);
        }
    });

    app.get('/painel/youtube-download', requireSession, async (req, res, next) => {
        try {
            const record = getPrepared(req.query?.token, req.account.id);
            await verifyPreparedIntegrity(record, true);
            return await servePrepared(req, res, record, true);
        } catch (error) {
            return next(error);
        }
    });
}

async function prepareMedia(rawUrl, rawKind, requestedHeight, accountId) {
    const parsed = parseYouTubeUrl(rawUrl);
    const kind = normalizeKind(rawKind);
    ensureTools();
    await purgeExpired();

    const info = await runYtDlpJson(parsed.canonical);
    validateYouTubeInfo(info);

    const qualities = qualityOptionsFromInfo(info);
    let selectedHeight = null;
    if (kind === 'video') {
        if (!qualities.length) throw clientError('Não encontrei um formato de vídeo compatível.', 422);
        selectedHeight = chooseRequestedHeight(qualities, requestedHeight);
    }

    const downloaded = kind === 'audio'
        ? await downloadAudio(parsed.canonical)
        : await downloadVideo(parsed.canonical, selectedHeight);

    const token = crypto.randomBytes(28).toString('base64url');
    const record = {
        token,
        accountId,
        kind,
        sourceUrl: parsed.canonical,
        title: cleanText(info.title || info.fulltitle || 'Mídia do YouTube', 300),
        uploader: cleanText(info.uploader || info.channel || info.creator || '', 180),
        duration: Math.max(0, Number(info.duration || 0) || 0),
        thumbnail: safeHttpUrl(info.thumbnail),
        selectedHeight,
        tempDir: downloaded.tempDir,
        filePath: downloaded.filePath,
        fileName: downloaded.fileName,
        size: downloaded.size,
        checksum: downloaded.checksum,
        mtimeMs: downloaded.mtimeMs,
        mime: downloaded.mime,
        extension: downloaded.extension,
        createdAt: Date.now(),
        expiresAt: Date.now() + TTL_MS,
        lastVerifiedAt: Date.now()
    };
    prepared.set(token, record);
    await prunePreparedForAccount(accountId, token);

    const streamUrl = `/painel/youtube-file?token=${encodeURIComponent(token)}`;
    const downloadUrl = `/painel/youtube-download?token=${encodeURIComponent(token)}`;
    return {
        id: cleanText(info.id || parsed.id, 24),
        kind,
        mediaType: kind,
        title: record.title,
        uploader: record.uploader,
        duration: record.duration,
        thumbnail: record.thumbnail,
        canonicalUrl: parsed.canonical,
        selectedHeight,
        selectedLabel: kind === 'audio' ? 'MP3 · melhor áudio' : `${selectedHeight}p`,
        size: record.size,
        extension: record.extension,
        mime: record.mime,
        checksum: record.checksum,
        qualities: kind === 'video' ? qualities : [],
        streamUrl,
        downloadUrl,
        downloads: [{
            height: selectedHeight,
            label: kind === 'audio' ? 'MP3' : `${selectedHeight}p`,
            container: record.extension.toUpperCase(),
            downloadUrl
        }]
    };
}

function normalizeKind(value) {
    return String(value || 'video').toLowerCase() === 'audio' ? 'audio' : 'video';
}

function validateYouTubeInfo(info) {
    if (!info || typeof info !== 'object') throw clientError('O YouTube não retornou informações dessa mídia.', 422);
    if (Array.isArray(info.entries) || ['playlist', 'multi_video'].includes(String(info._type || ''))) {
        throw clientError('Playlists não são suportadas. Envie um vídeo individual.', 400);
    }
    if (!looksLikeYouTubeInfo(info)) throw clientError('O link não foi reconhecido como vídeo do YouTube.', 400);
    if (Number(info.age_limit || 0) >= 18) throw clientError('Vídeos marcados como 18+ não são suportados.', 403);
    if (info.is_live || info.live_status === 'is_live') throw clientError('Lives em andamento não são suportadas.', 400);
    if (['private', 'premium_only', 'subscriber_only', 'needs_auth'].includes(String(info.availability || ''))) {
        throw clientError('Esse vídeo exige autenticação ou acesso especial.', 403);
    }
}

function looksLikeYouTubeInfo(info) {
    const labels = [info.extractor, info.extractor_key, info.webpage_url_domain, info.webpage_url, info.original_url]
        .filter(Boolean).join(' ').toLowerCase();
    return labels.includes('youtube') || labels.includes('youtu.be');
}

function ensureTools() {
    if (!fs.existsSync(YTDLP_PATH)) throw clientError('yt-dlp não está instalado no servidor.', 503);
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) throw clientError('FFmpeg não está disponível no servidor.', 503);
}

function runYtDlpJson(url) {
    const args = [
        '--no-config', '--no-playlist', '--skip-download', '--dump-single-json', '--no-warnings',
        '--socket-timeout', '15', '--extractor-retries', '2', '--fragment-retries', '2', '--', url
    ];
    return runProcess(YTDLP_PATH, args, { timeoutMs: 45000, maxStdoutBytes: 10 * 1024 * 1024 }).then(result => {
        try { return JSON.parse(result.stdout); }
        catch { throw clientError('Não foi possível interpretar a resposta do YouTube.', 502); }
    });
}

async function downloadVideo(sourceUrl, height) {
    const parsed = parseYouTubeUrl(sourceUrl);
    const targetHeight = Math.max(144, Math.min(1080, Number(height) || 720));
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'skynet-youtube-v4-'));
    const output = path.join(tempDir, 'source.%(ext)s');
    const selector = [
        `bestvideo[ext=mp4][vcodec^=avc1][height<=${targetHeight}]+bestaudio[ext=m4a]`,
        `bestvideo[ext=mp4][height<=${targetHeight}]+bestaudio[ext=m4a]`,
        `best[ext=mp4][height<=${targetHeight}][vcodec!=none][acodec!=none]`,
        `best[height<=${targetHeight}][vcodec!=none][acodec!=none]`
    ].join('/');
    const args = [
        '--no-config', '--no-playlist', '--no-warnings', '--socket-timeout', '20',
        '--retries', '2', '--fragment-retries', '2', '--max-filesize', `${MAX_MB}M`,
        '--restrict-filenames', '--ffmpeg-location', ffmpegPath,
        '-f', selector, '--merge-output-format', 'mp4', '--remux-video', 'mp4',
        '-o', output, '--', parsed.canonical
    ];
    return finalizeDownload({ tempDir, args, extension: 'mp4', mime: 'video/mp4', kind: 'video' });
}

async function downloadAudio(sourceUrl) {
    const parsed = parseYouTubeUrl(sourceUrl);
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'skynet-youtube-v4-'));
    const output = path.join(tempDir, 'source.%(ext)s');
    const args = [
        '--no-config', '--no-playlist', '--no-warnings', '--socket-timeout', '20',
        '--retries', '2', '--fragment-retries', '2', '--max-filesize', `${MAX_MB}M`,
        '--restrict-filenames', '--ffmpeg-location', ffmpegPath,
        '-f', 'bestaudio/best', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0',
        '-o', output, '--', parsed.canonical
    ];
    return finalizeDownload({ tempDir, args, extension: 'mp3', mime: 'audio/mpeg', kind: 'audio' });
}

async function finalizeDownload({ tempDir, args, extension, mime, kind }) {
    try {
        // Mantém o comportamento padrão do yt-dlp: escreve em .part e só publica o arquivo final ao concluir.
        await runProcess(YTDLP_PATH, args, { timeoutMs: 240000, watchDir: tempDir, maxDirBytes: MAX_BYTES * 3 });
        const selected = await findCompletedFile(tempDir, extension);
        if (!selected) throw clientError(`O yt-dlp não gerou um arquivo ${extension.toUpperCase()} completo.`, 422);
        if (selected.stat.size <= 1024) throw clientError('O arquivo gerado está vazio ou incompleto.', 422);
        if (selected.stat.size > MAX_BYTES) throw clientError(`O arquivo ultrapassa o limite de ${MAX_MB}MB.`, 413);

        await syncFile(selected.filePath);
        await validateMediaFile(selected.filePath, kind);
        const checksum = await hashFile(selected.filePath);

        const readyPath = path.join(tempDir, `ready.${extension}`);
        if (selected.filePath !== readyPath) await fs.promises.rename(selected.filePath, readyPath);
        await syncFile(readyPath);
        await syncDirectory(tempDir);
        const stat = await fs.promises.stat(readyPath);

        return {
            tempDir,
            filePath: readyPath,
            fileName: `youtube-${crypto.randomBytes(5).toString('hex')}.${extension}`,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            checksum,
            mime,
            extension
        };
    } catch (error) {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

async function findCompletedFile(tempDir, extension) {
    const entries = await fs.promises.readdir(tempDir, { withFileTypes: true });
    const candidates = [];
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const lower = entry.name.toLowerCase();
        if (lower.endsWith('.part') || lower.endsWith('.ytdl') || lower.includes('.part-')) continue;
        if (path.extname(lower) !== `.${extension}`) continue;
        const filePath = path.join(tempDir, entry.name);
        candidates.push({ filePath, stat: await fs.promises.stat(filePath) });
    }
    candidates.sort((a, b) => b.stat.size - a.stat.size);
    return candidates[0] || null;
}

async function validateMediaFile(filePath, kind) {
    const mapArgs = kind === 'audio' ? ['-map', '0:a:0'] : ['-map', '0:v:0', '-map', '0:a?'];
    const args = ['-nostdin', '-v', 'error', '-xerror', '-i', filePath, ...mapArgs, '-f', 'null', '-'];
    try {
        await runProcess(ffmpegPath, args, { timeoutMs: 240000, maxStdoutBytes: 1024 * 1024 });
    } catch {
        throw clientError('A validação detectou que o arquivo ficou incompleto ou corrompido. Tente novamente.', 422);
    }
}

async function verifyPreparedIntegrity(record, force) {
    const stat = await fs.promises.stat(record.filePath).catch(() => null);
    if (!stat?.isFile()) {
        await dropPrepared(record.token);
        throw clientError('O arquivo temporário não está mais disponível. Carregue novamente.', 410);
    }
    if (stat.size !== record.size) {
        await dropPrepared(record.token);
        throw clientError('O arquivo temporário mudou de tamanho e foi descartado por segurança.', 410);
    }
    const now = Date.now();
    if (!force && now - Number(record.lastVerifiedAt || 0) < VERIFY_CACHE_MS && stat.mtimeMs === record.mtimeMs) return;
    const checksum = await hashFile(record.filePath);
    if (checksum !== record.checksum) {
        await dropPrepared(record.token);
        throw clientError('A integridade do arquivo falhou. Ele foi descartado em vez de ser enviado corrompido.', 410);
    }
    record.lastVerifiedAt = now;
    record.mtimeMs = stat.mtimeMs;
}

async function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function syncFile(filePath) {
    const handle = await fs.promises.open(filePath, 'r+');
    try { await handle.sync(); }
    finally { await handle.close(); }
}

async function syncDirectory(dirPath) {
    try {
        const handle = await fs.promises.open(dirPath, 'r');
        try { await handle.sync(); }
        finally { await handle.close(); }
    } catch {}
}

async function servePrepared(req, res, record, download) {
    const stat = await fs.promises.stat(record.filePath);
    record.expiresAt = Date.now() + TTL_MS;
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
    res.setHeader('Content-Type', record.mime);
    res.setHeader('X-Content-SHA256', record.checksum);
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
    if (!match || !Number.isFinite(size) || size <= 0 || (!match[1] && !match[2])) return null;
    let start;
    let end;
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

function pipeFile(filePath, res, range) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, range);
        let settled = false;
        const done = fn => value => {
            if (settled) return;
            settled = true;
            fn(value);
        };
        stream.on('error', done(reject));
        res.on('close', done(resolve));
        res.on('finish', done(resolve));
        stream.pipe(res);
    });
}

function runProcess(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONUNBUFFERED: '1' } });
        let stdout = '';
        let stderr = '';
        let stdoutBytes = 0;
        let killedForSize = false;
        let timedOut = false;
        let settled = false;

        const timeout = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, options.timeoutMs || 60000);
        const sizeWatcher = options.watchDir ? setInterval(async () => {
            try {
                const entries = await fs.promises.readdir(options.watchDir, { withFileTypes: true });
                let total = 0;
                for (const entry of entries) if (entry.isFile()) total += (await fs.promises.stat(path.join(options.watchDir, entry.name))).size;
                if (total > (options.maxDirBytes || MAX_BYTES)) { killedForSize = true; child.kill('SIGKILL'); }
            } catch {}
        }, 500) : null;

        child.stdout.on('data', chunk => {
            stdoutBytes += chunk.length;
            if (stdoutBytes > (options.maxStdoutBytes || 1024 * 1024)) return child.kill('SIGKILL');
            stdout += chunk.toString('utf8');
        });
        child.stderr.on('data', chunk => { if (stderr.length < 30000) stderr += chunk.toString('utf8'); });
        child.on('error', error => finish(() => reject(clientError(`Falha ao iniciar processo: ${error.message}`, 502))));
        child.on('close', code => finish(() => {
            if (killedForSize) return reject(clientError(`O arquivo ultrapassa o limite de ${MAX_MB}MB.`, 413));
            if (timedOut) return reject(clientError('O processamento excedeu o tempo permitido.', 504));
            if (code !== 0) return reject(clientError(cleanExternalError(stderr) || 'Não foi possível processar essa mídia.', 422));
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

function cleanExternalError(value) {
    const text = cleanText(value, 1500);
    if (/private video/i.test(text)) return 'Esse vídeo é privado.';
    if (/confirm your age|age-restricted/i.test(text)) return 'Esse vídeo exige verificação de idade.';
    if (/premium/i.test(text)) return 'Esse vídeo exige acesso Premium.';
    if (/sign in to confirm you.?re not a bot|not a bot/i.test(text)) return 'O YouTube bloqueou a solicitação automática deste servidor. O vídeo pode ser público, mas o yt-dlp não recebeu acesso.';
    if (/requested format is not available/i.test(text)) return 'A qualidade escolhida não está disponível.';
    if (/copyright|unavailable|not available/i.test(text)) return 'Esse vídeo não está disponível para processamento pelo servidor.';
    return text ? 'O yt-dlp não conseguiu processar essa mídia do YouTube.' : '';
}

function getPrepared(value, accountId) {
    const token = String(value || '').trim();
    const record = prepared.get(token);
    if (!record || record.accountId !== accountId) throw clientError('Link de mídia inválido ou expirado.', 410);
    if (record.expiresAt <= Date.now()) {
        dropPrepared(token).catch(() => {});
        throw clientError('O arquivo temporário expirou. Prepare novamente.', 410);
    }
    return record;
}

async function purgeExpired() {
    const now = Date.now();
    await Promise.all([...prepared.values()].filter(record => record.expiresAt <= now).map(record => dropPrepared(record.token)));
}

async function prunePreparedForAccount(accountId, keepToken) {
    const records = [...prepared.values()].filter(record => record.accountId === accountId && record.token !== keepToken).sort((a, b) => b.createdAt - a.createdAt);
    const excess = records.slice(Math.max(0, MAX_PREPARED_PER_ACCOUNT - 1));
    await Promise.all(excess.map(record => dropPrepared(record.token)));
}

async function dropPrepared(token) {
    const record = prepared.get(token);
    if (!record) return;
    prepared.delete(token);
    await fs.promises.rm(record.tempDir, { recursive: true, force: true }).catch(() => {});
}

function requestLimiter(req, res, next) {
    const accountId = req.account?.id || 'anonymous';
    const now = Date.now();
    let bucket = buckets.get(accountId);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + 60000 };
    bucket.count += 1;
    buckets.set(accountId, bucket);
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

function contentDisposition(mode, fileName) {
    const raw = cleanText(fileName || 'youtube-media', 180).replace(/[\r\n]/g, '');
    const ascii = raw.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'youtube-media';
    return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
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

function clientError(message, status = 400) {
    const error = new Error(message);
    error.statusCode = status;
    return error;
}

module.exports = {
    registerYouTubeMediaV4Routes,
    normalizeKind,
    parseRangeHeader
};
