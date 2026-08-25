const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const C = require('./config');
const S = require('./store');

const PROVIDER = 'Hugging Face Spaces';
const PUBLIC_SPACES = [
    { id: 'onebitss/Real-ESRGAN', label: 'Real-ESRGAN Public #1' },
    { id: 'Hockman/real-esrgan-upscaler', label: 'Real-ESRGAN Public #2' },
    { id: 'Fabrice-TIERCELIN/RealESRGAN', label: 'Real-ESRGAN Public #3' }
];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 2_000_000;
const MAX_OUTPUT_PIXELS = 60_000_000;
const MAX_RESULT_BYTES = 55 * 1024 * 1024;
const MAX_ACTIVE_JOBS = 1;
const MAX_WAITING_JOBS = 3;
const PROVIDER_TIMEOUT_MS = 150_000;
const PUBLIC_RATE_WINDOW_MS = 60 * 60 * 1000;
const PUBLIC_RATE_LIMIT = 6;

let activeJobs = 0;
const queue = [];
const clientCache = new Map();
const apiCache = new Map();
const publicRateBuckets = new Map();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 8 }
});

function clientError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
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

function requireSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        const account = session ? S.loadAccounts().find(item => item.id === session.accountId && item.active) : null;
        if (!account) return res.status(401).json({ ok: false, error: 'Faça login para usar o AI Upscaler.' });
        req.account = account;
        return next();
    } catch (error) { return next(error); }
}

function optionalApiIdentity(req, res, next) {
    try {
        const authorization = String(req.headers.authorization || '');
        const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
        const apiKey = String(req.headers['x-api-key'] || bearer || '').trim();
        if (!apiKey) return next();
        const auth = S.authenticateApiKey(apiKey);
        if (!auth) return res.status(401).json({ ok: false, error: 'API key inválida ou inativa.' });
        req.account = auth.account;
        req.apiKeyRecord = auth.record;
        return next();
    } catch (error) { return next(error); }
}

function publicRateLimit(req, res, next) {
    const now = Date.now();
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const current = publicRateBuckets.get(key);
    const bucket = !current || now - current.startedAt >= PUBLIC_RATE_WINDOW_MS
        ? { startedAt: now, count: 0 }
        : current;

    if (bucket.count >= PUBLIC_RATE_LIMIT) {
        const retrySeconds = Math.max(1, Math.ceil((bucket.startedAt + PUBLIC_RATE_WINDOW_MS - now) / 1000));
        res.setHeader('Retry-After', String(retrySeconds));
        return res.status(429).json({
            ok: false,
            error: `Limite público de ${PUBLIC_RATE_LIMIT} upscales por hora atingido para este endereço.`,
            retryAfter: retrySeconds
        });
    }
    bucket.count += 1;
    publicRateBuckets.set(key, bucket);
    if (publicRateBuckets.size > 5000) {
        for (const [bucketKey, value] of publicRateBuckets) {
            if (now - value.startedAt >= PUBLIC_RATE_WINDOW_MS) publicRateBuckets.delete(bucketKey);
        }
    }
    res.setHeader('X-RateLimit-Limit', String(PUBLIC_RATE_LIMIT));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, PUBLIC_RATE_LIMIT - bucket.count)));
    return next();
}

function requireTrustedOrigin(req, res, next) {
    const origin = String(req.headers.origin || '').trim();
    if (!origin) return next();
    try {
        const parsed = new URL(origin);
        if (parsed.host === String(req.headers.host || '').trim() || C.CORS_ORIGINS.has(origin)) return next();
    } catch {}
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}

function enqueue(task) {
    return new Promise((resolve, reject) => {
        if (activeJobs >= MAX_ACTIVE_JOBS && queue.length >= MAX_WAITING_JOBS) {
            reject(clientError('O AI Upscaler está com muitas tarefas. Tente novamente quando uma delas terminar.', 429));
            return;
        }
        queue.push({ task, resolve, reject });
        drainQueue();
    });
}

function drainQueue() {
    while (activeJobs < MAX_ACTIVE_JOBS && queue.length) {
        const job = queue.shift();
        activeJobs += 1;
        Promise.resolve()
            .then(job.task)
            .then(job.resolve, job.reject)
            .finally(() => {
                activeJobs -= 1;
                setImmediate(drainQueue);
            });
    }
}

function withTimeout(promise, timeoutMs, message) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(clientError(message, 504)), timeoutMs);
        })
    ]).finally(() => clearTimeout(timer));
}

async function validateInput(buffer, scale) {
    let metadata;
    try { metadata = await sharp(buffer, { failOn: 'error', animated: false }).metadata(); }
    catch { throw clientError('Arquivo de imagem inválido ou corrompido.'); }

    if (!metadata.width || !metadata.height) throw clientError('Não foi possível identificar as dimensões da imagem.');
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw clientError('Use PNG, JPG/JPEG ou WebP.');

    const inputPixels = metadata.width * metadata.height;
    const outputPixels = inputPixels * scale * scale;
    if (inputPixels > MAX_INPUT_PIXELS) {
        throw clientError(`Imagem grande demais para o serviço público. Limite atual: ${MAX_INPUT_PIXELS.toLocaleString('pt-BR')} pixels de entrada.`, 413);
    }
    if (outputPixels > MAX_OUTPUT_PIXELS) {
        throw clientError(`O resultado ${scale}x ultrapassaria o limite seguro de ${MAX_OUTPUT_PIXELS.toLocaleString('pt-BR')} pixels. Use uma imagem menor ou 4x.`, 413);
    }
    return metadata;
}

async function getGradioModule() {
    return import('@gradio/client');
}

async function getClient(spaceId) {
    if (clientCache.has(spaceId)) return clientCache.get(spaceId);
    const { Client } = await getGradioModule();
    const pending = withTimeout(
        Client.connect(spaceId),
        35_000,
        `O Space público ${spaceId} não respondeu a tempo.`
    ).catch(error => {
        clientCache.delete(spaceId);
        throw error;
    });
    clientCache.set(spaceId, pending);
    return pending;
}

async function getApiInfo(spaceId, client) {
    if (apiCache.has(spaceId)) return apiCache.get(spaceId);
    const pending = withTimeout(client.view_api(), 20_000, 'Não foi possível consultar a API pública do upscaler.')
        .catch(() => ({ named_endpoints: {} }));
    apiCache.set(spaceId, pending);
    return pending;
}

function endpointCandidates(apiInfo) {
    const names = Object.keys(apiInfo?.named_endpoints || {});
    const score = name => {
        const value = String(name).toLowerCase();
        if (value.includes('image') || value.includes('upscale') || value.includes('infer')) return 0;
        if (value.includes('predict')) return 1;
        return 2;
    };
    names.sort((a, b) => score(a) - score(b));
    for (const fallback of ['/predict', '/infer_image', '/upscale_image']) {
        if (!names.includes(fallback)) names.push(fallback);
    }
    return names.slice(0, 8);
}

function payloadFromSchema(schema, fileRef, scale) {
    const params = Array.isArray(schema?.parameters) ? schema.parameters : [];
    if (!params.length) return null;
    const payload = {};
    let usedFile = false;
    let usedScale = false;

    for (const param of params) {
        const key = String(param?.parameter_name || param?.name || '').trim();
        if (!key) continue;
        const hint = `${key} ${param?.label || ''} ${param?.component || ''}`.toLowerCase();
        if (!usedFile && /(image|file|input)/.test(hint)) {
            payload[key] = fileRef;
            usedFile = true;
            continue;
        }
        if (!usedScale && /(scale|model|upscale|factor)/.test(hint)) {
            payload[key] = scale;
            usedScale = true;
        }
    }

    if (!usedFile) {
        const first = String(params[0]?.parameter_name || params[0]?.name || '').trim();
        if (first) {
            payload[first] = fileRef;
            usedFile = true;
        }
    }
    if (!usedScale && params[1]) {
        const second = String(params[1]?.parameter_name || params[1]?.name || '').trim();
        if (second) payload[second] = scale;
    }
    return usedFile ? payload : null;
}

function findOutputSource(value) {
    if (!value) return null;
    if (Buffer.isBuffer(value)) return { type: 'buffer', value };
    if (typeof Blob !== 'undefined' && value instanceof Blob) return { type: 'blob', value };
    if (typeof value === 'string') {
        if (/^https:\/\//i.test(value)) return { type: 'url', value };
        return null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findOutputSource(item);
            if (found) return found;
        }
        return null;
    }
    if (typeof value === 'object') {
        for (const key of ['url', 'href', 'uri']) {
            const found = findOutputSource(value[key]);
            if (found) return found;
        }
        for (const nested of Object.values(value)) {
            const found = findOutputSource(nested);
            if (found) return found;
        }
    }
    return null;
}

function validHuggingFaceUrl(value) {
    try {
        const url = new URL(String(value || ''));
        if (url.protocol !== 'https:') return null;
        const host = url.hostname.toLowerCase();
        if (host === 'huggingface.co' || host.endsWith('.huggingface.co') || host === 'hf.co' || host.endsWith('.hf.co') || host === 'hf.space' || host.endsWith('.hf.space')) return url;
        return null;
    } catch { return null; }
}

async function sourceToBuffer(source) {
    if (source.type === 'buffer') return source.value;
    if (source.type === 'blob') return Buffer.from(await source.value.arrayBuffer());
    const url = validHuggingFaceUrl(source.value);
    if (!url) throw clientError('O Space público devolveu uma URL de resultado não permitida.', 502);
    const response = await withTimeout(fetch(url, { redirect: 'follow' }), 45_000, 'O resultado do Space público demorou demais para baixar.');
    if (!response.ok) throw clientError(`Não foi possível baixar o resultado público (${response.status}).`, 502);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_RESULT_BYTES) throw clientError('O resultado ultrapassou o limite seguro do SkyNetApi.', 413);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw clientError('O Space público devolveu um arquivo vazio.', 502);
    if (buffer.length > MAX_RESULT_BYTES) throw clientError('O resultado ultrapassou o limite seguro do SkyNetApi.', 413);
    return buffer;
}

async function callPublicSpace(space, buffer, modelScale) {
    const { handle_file } = await getGradioModule();
    const client = await getClient(space.id);
    const info = await getApiInfo(space.id, client);
    const endpoints = endpointCandidates(info);
    let lastError = null;

    for (const endpoint of endpoints) {
        const schema = info?.named_endpoints?.[endpoint];
        const attempts = [];
        const fileRef = handle_file(buffer);
        const objectPayload = payloadFromSchema(schema, fileRef, modelScale);
        if (objectPayload) attempts.push(objectPayload);
        attempts.push([fileRef, modelScale], [fileRef]);

        for (const payload of attempts) {
            try {
                const result = await withTimeout(
                    client.predict(endpoint, payload),
                    PROVIDER_TIMEOUT_MS,
                    `${space.label} demorou além do limite.`
                );
                const source = findOutputSource(result?.data ?? result);
                if (!source) throw new Error('resultado sem arquivo de imagem');
                const outputBuffer = await sourceToBuffer(source);
                return { buffer: outputBuffer, space: space.id, endpoint };
            } catch (error) {
                lastError = error;
            }
        }
    }
    throw lastError || new Error(`${space.label} não possui endpoint de imagem compatível.`);
}

async function runHostedUpscale(buffer, modelScale) {
    const failures = [];
    for (const space of PUBLIC_SPACES) {
        try {
            return await callPublicSpace(space, buffer, modelScale);
        } catch (error) {
            clientCache.delete(space.id);
            apiCache.delete(space.id);
            failures.push(`${space.id}: ${error?.message || 'falhou'}`);
        }
    }
    const error = clientError('Os servidores públicos de Real-ESRGAN estão temporariamente indisponíveis ou limitados. Tente novamente mais tarde.', 503);
    error.providerFailures = failures;
    throw error;
}

async function runUpscale(buffer, options) {
    const scale = options.scale === 6 ? 6 : 4;
    const format = ['png', 'jpeg', 'webp'].includes(options.format) ? options.format : 'webp';
    const quality = Math.max(70, Math.min(100, Number(options.quality) || 94));
    const metadata = await validateInput(buffer, scale);

    const hosted = await runHostedUpscale(buffer, 4);
    let image;
    let providerMetadata;
    try {
        image = sharp(hosted.buffer, { failOn: 'error' });
        providerMetadata = await image.metadata();
    } catch {
        throw clientError('O resultado do Space público não pôde ser lido como imagem.', 502);
    }

    const targetWidth = metadata.width * scale;
    const targetHeight = metadata.height * scale;
    if (providerMetadata.width !== targetWidth || providerMetadata.height !== targetHeight) {
        image = image.resize(targetWidth, targetHeight, {
            fit: 'fill',
            kernel: sharp.kernel.lanczos3,
            withoutEnlargement: false
        });
    }

    if (format === 'png') image = image.png({ compressionLevel: 8, adaptiveFiltering: true });
    else if (format === 'jpeg') image = image.jpeg({ quality, mozjpeg: true });
    else image = image.webp({ quality, effort: 5, smartSubsample: true });

    const resultBuffer = await image.toBuffer();
    const resultMetadata = await sharp(resultBuffer).metadata();
    return {
        buffer: resultBuffer,
        format,
        width: resultMetadata.width || targetWidth,
        height: resultMetadata.height || targetHeight,
        scale,
        provider: PROVIDER,
        model: 'Real-ESRGAN x4 (public Space)',
        space: hosted.space,
        pipeline: scale === 4 ? 'Real-ESRGAN x4 em Hugging Face Space público' : 'Real-ESRGAN x4 em Hugging Face Space público + Lanczos final 1.5x'
    };
}

function sendResult(res, result, originalName) {
    const extension = result.format === 'jpeg' ? 'jpg' : result.format;
    const stem = path.basename(String(originalName || 'imagem'), path.extname(String(originalName || 'imagem'))).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'imagem';
    res.setHeader('Content-Type', result.format === 'jpeg' ? 'image/jpeg' : `image/${result.format}`);
    res.setHeader('Content-Disposition', `attachment; filename="${stem}-ai-${result.scale}x.${extension}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Upscale-Provider', result.provider);
    res.setHeader('X-Upscale-Model', result.model);
    res.setHeader('X-Upscale-Space', result.space);
    res.setHeader('X-Upscale-Scale', String(result.scale));
    res.setHeader('X-Upscale-Pipeline', result.pipeline);
    res.setHeader('X-Upscale-Width', String(result.width));
    res.setHeader('X-Upscale-Height', String(result.height));
    return res.send(result.buffer);
}

function processUpload(req, res, next) {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Envie uma imagem no campo file.' });
    const scale = Number(req.body?.scale) === 6 ? 6 : 4;
    const format = String(req.body?.format || 'webp').toLowerCase();
    const quality = Number(req.body?.quality || 94);

    enqueue(() => runUpscale(req.file.buffer, { scale, format, quality }))
        .then(result => sendResult(res, result, req.file.originalname))
        .catch(next);
}

function registerUpscaleRoutes(app) {
    app.get('/api/upscale/info', requireSession, (req, res) => res.json({
        ok: true,
        engine: 'Real-ESRGAN Public Cloud',
        provider: PROVIDER,
        model: 'Real-ESRGAN x4',
        configured: true,
        requiresProviderToken: false,
        apiKeyOptional: true,
        supportedScales: [4, 6],
        sixXPipeline: 'Real-ESRGAN x4 público + Lanczos final 1.5x',
        publicSpaces: PUBLIC_SPACES.map(space => space.id),
        busy: activeJobs >= MAX_ACTIVE_JOBS,
        active: activeJobs,
        queued: queue.length,
        maxInputPixels: MAX_INPUT_PIXELS,
        maxOutputPixels: MAX_OUTPUT_PIXELS,
        maxFileMb: MAX_FILE_BYTES / 1024 / 1024,
        publicRateLimitPerHour: PUBLIC_RATE_LIMIT,
        note: 'Hugging Face Spaces públicos podem entrar em fila, sleep ou rate limit. Nenhum token externo é necessário.'
    }));

    app.post('/api/upscale', requireTrustedOrigin, requireSession, upload.single('file'), processUpload);
    app.post('/api/v1/image/upscale', optionalApiIdentity, publicRateLimit, upload.single('file'), processUpload);
}

module.exports = { registerUpscaleRoutes };
