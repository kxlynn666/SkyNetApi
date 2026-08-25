const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const C = require('./config');
const S = require('./store');

const PROVIDER = 'Replicate';
const MODEL_ID = 'nightmareai/real-esrgan';
const CREATE_URL = `https://api.replicate.com/v1/models/${MODEL_ID}/predictions`;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 4_000_000;
const MAX_OUTPUT_PIXELS = 90_000_000;
const MAX_RESULT_BYTES = 50 * 1024 * 1024;
const MAX_ACTIVE_JOBS = 2;
const MAX_WAITING_JOBS = 4;
const PREDICTION_TIMEOUT_MS = 125_000;

let activeJobs = 0;
const queue = [];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 10 }
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

function requireApiKey(req, res, next) {
    try {
        const authorization = String(req.headers.authorization || '');
        const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
        const apiKey = String(req.headers['x-api-key'] || bearer || '').trim();
        const auth = S.authenticateApiKey(apiKey);
        if (!auth) return res.status(401).json({ ok: false, error: 'API key inválida ou inativa.' });
        req.account = auth.account;
        req.apiKeyRecord = auth.record;
        return next();
    } catch (error) { return next(error); }
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

function getProviderToken() {
    return String(process.env.REPLICATE_API_TOKEN || '').trim();
}

function mimeFor(format) {
    if (format === 'jpeg') return 'image/jpeg';
    if (format === 'png') return 'image/png';
    if (format === 'webp') return 'image/webp';
    return '';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 65_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error?.name === 'AbortError') throw clientError('O provedor de upscale demorou além do limite.', 504);
        throw error;
    } finally {
        clearTimeout(timer);
    }
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

async function validateInput(buffer, scale) {
    let metadata;
    try { metadata = await sharp(buffer, { failOn: 'error', animated: false }).metadata(); }
    catch { throw clientError('Arquivo de imagem inválido ou corrompido.'); }

    if (!metadata.width || !metadata.height) throw clientError('Não foi possível identificar as dimensões da imagem.');
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw clientError('Use PNG, JPG/JPEG ou WebP.');

    const inputPixels = metadata.width * metadata.height;
    const outputPixels = inputPixels * scale * scale;
    if (inputPixels > MAX_INPUT_PIXELS) {
        throw clientError(`Imagem grande demais. Limite atual: ${MAX_INPUT_PIXELS.toLocaleString('pt-BR')} pixels de entrada.`, 413);
    }
    if (outputPixels > MAX_OUTPUT_PIXELS) {
        throw clientError(`O resultado ${scale}x ultrapassaria o limite seguro de ${MAX_OUTPUT_PIXELS.toLocaleString('pt-BR')} pixels. Use uma imagem menor ou 4x.`, 413);
    }

    return metadata;
}

function providerError(payload, fallback) {
    const detail = payload?.detail || payload?.error || payload?.message;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (Array.isArray(detail) && detail.length) return detail.map(item => item?.msg || String(item)).join('; ');
    return fallback;
}

function validPredictionUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return url.protocol === 'https:' && url.hostname === 'api.replicate.com' ? url : null;
    } catch { return null; }
}

function validOutputUrl(value) {
    try {
        const url = new URL(String(value || ''));
        const host = url.hostname.toLowerCase();
        if (url.protocol !== 'https:') return null;
        if (host !== 'replicate.delivery' && !host.endsWith('.replicate.delivery')) return null;
        return url;
    } catch { return null; }
}

async function readPrediction(response) {
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
        const status = response.status === 401 || response.status === 403 ? 502 : response.status;
        throw clientError(providerError(payload, `Falha no provedor de upscale (${response.status}).`), status || 502);
    }
    return payload || {};
}

async function waitForPrediction(initial, token) {
    let prediction = initial;
    const deadline = Date.now() + PREDICTION_TIMEOUT_MS;

    while (prediction?.status === 'starting' || prediction?.status === 'processing') {
        if (Date.now() >= deadline) throw clientError('O upscale ultrapassou o tempo máximo de processamento.', 504);
        const pollUrl = validPredictionUrl(prediction?.urls?.get);
        if (!pollUrl) throw clientError('O provedor retornou uma URL de acompanhamento inválida.', 502);
        await sleep(1400);
        const response = await fetchWithTimeout(pollUrl, {
            headers: { Authorization: `Bearer ${token}` }
        }, 20_000);
        prediction = await readPrediction(response);
    }

    if (prediction?.status !== 'succeeded') {
        const reason = typeof prediction?.error === 'string' ? prediction.error : 'O provedor não conseguiu concluir o upscale.';
        throw clientError(reason, prediction?.status === 'canceled' ? 504 : 502);
    }
    return prediction;
}

function extractOutputUrl(output) {
    if (typeof output === 'string') return validOutputUrl(output);
    if (Array.isArray(output)) {
        for (const item of output) {
            const url = extractOutputUrl(item);
            if (url) return url;
        }
    }
    if (output && typeof output === 'object') {
        for (const key of ['url', 'href', 'uri']) {
            const url = validOutputUrl(output[key]);
            if (url) return url;
        }
    }
    return null;
}

async function downloadResult(url) {
    const response = await fetchWithTimeout(url, { redirect: 'follow' }, 35_000);
    if (!response.ok) throw clientError(`Não foi possível baixar o resultado do upscale (${response.status}).`, 502);

    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_RESULT_BYTES) throw clientError('O arquivo resultante ultrapassou o limite seguro do SkyNetApi.', 413);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw clientError('O provedor devolveu um resultado vazio.', 502);
    if (buffer.length > MAX_RESULT_BYTES) throw clientError('O arquivo resultante ultrapassou o limite seguro do SkyNetApi.', 413);
    return buffer;
}

async function runUpscale(buffer, options) {
    const token = getProviderToken();
    if (!token) {
        throw clientError('AI Upscaler ainda não está configurado no servidor. Defina REPLICATE_API_TOKEN no ambiente do Railway.', 503);
    }

    const scale = options.scale === 6 ? 6 : 4;
    const format = ['png', 'jpeg', 'webp'].includes(options.format) ? options.format : 'webp';
    const quality = Math.max(70, Math.min(100, Number(options.quality) || 94));
    const faceEnhance = options.faceEnhance === true;
    const metadata = await validateInput(buffer, scale);
    const sourceMime = mimeFor(metadata.format);
    const imageData = `data:${sourceMime};base64,${buffer.toString('base64')}`;

    const createResponse = await fetchWithTimeout(CREATE_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'wait=60',
            'Cancel-After': '2m'
        },
        body: JSON.stringify({
            input: {
                image: imageData,
                scale,
                face_enhance: faceEnhance
            }
        })
    }, 65_000);

    const created = await readPrediction(createResponse);
    const prediction = await waitForPrediction(created, token);
    const outputUrl = extractOutputUrl(prediction.output);
    if (!outputUrl) throw clientError('O provedor concluiu a tarefa, mas não devolveu uma imagem válida.', 502);

    const providerBuffer = await downloadResult(outputUrl);
    let image;
    let providerMetadata;
    try {
        image = sharp(providerBuffer, { failOn: 'error' });
        providerMetadata = await image.metadata();
    } catch {
        throw clientError('O resultado do provedor não pôde ser lido como imagem.', 502);
    }

    if (format === 'png') image = image.png({ compressionLevel: 8, adaptiveFiltering: true });
    else if (format === 'jpeg') image = image.jpeg({ quality, mozjpeg: true });
    else image = image.webp({ quality, effort: 5, smartSubsample: true });

    const resultBuffer = await image.toBuffer();
    const resultMetadata = await sharp(resultBuffer).metadata();

    return {
        buffer: resultBuffer,
        format,
        width: resultMetadata.width || providerMetadata.width || metadata.width * scale,
        height: resultMetadata.height || providerMetadata.height || metadata.height * scale,
        scale,
        faceEnhance,
        provider: PROVIDER,
        model: MODEL_ID,
        pipeline: `Real-ESRGAN ${scale}x hospedado no Replicate${faceEnhance ? ' + GFPGAN' : ''}`
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
    res.setHeader('X-Upscale-Scale', String(result.scale));
    res.setHeader('X-Upscale-Face-Enhance', result.faceEnhance ? '1' : '0');
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
    const faceEnhance = ['1', 'true', 'yes', 'on'].includes(String(req.body?.faceEnhance ?? req.body?.face_enhance ?? '').toLowerCase());

    enqueue(() => runUpscale(req.file.buffer, { scale, format, quality, faceEnhance }))
        .then(result => sendResult(res, result, req.file.originalname))
        .catch(next);
}

function registerUpscaleRoutes(app) {
    app.get('/api/upscale/info', requireSession, (req, res) => {
        const configured = Boolean(getProviderToken());
        return res.json({
            ok: true,
            engine: 'Real-ESRGAN Cloud',
            provider: PROVIDER,
            model: MODEL_ID,
            configured,
            modelLoaded: configured,
            nativeScale: 'adjustable',
            supportedScales: [4, 6],
            sixXPipeline: 'Real-ESRGAN direct scale=6',
            faceEnhance: true,
            busy: activeJobs >= MAX_ACTIVE_JOBS,
            active: activeJobs,
            queued: queue.length,
            maxInputPixels: MAX_INPUT_PIXELS,
            maxOutputPixels: MAX_OUTPUT_PIXELS,
            maxFileMb: MAX_FILE_BYTES / 1024 / 1024
        });
    });

    app.post('/api/upscale', requireTrustedOrigin, requireSession, upload.single('file'), processUpload);
    app.post('/api/v1/image/upscale', requireApiKey, upload.single('file'), processUpload);
}

module.exports = { registerUpscaleRoutes };
