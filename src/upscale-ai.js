const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const C = require('./config');
const S = require('./store');

const MODEL_ID = 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr';
const CACHE_DIR = path.join(C.DATA_DIR, 'ai-model-cache');
const TMP_DIR = path.join(C.DATA_DIR, 'upscale-tmp');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 1_800_000;
const MAX_OUTPUT_PIXELS = 25_000_000;
const MAX_WAITING_JOBS = 2;

let runtimePromise = null;
let modelLoaded = false;
let running = false;
const queue = [];

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

async function getRuntime() {
    if (runtimePromise) return runtimePromise;
    runtimePromise = (async () => {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.mkdirSync(TMP_DIR, { recursive: true });
        const transformers = await import('@huggingface/transformers');
        transformers.env.cacheDir = CACHE_DIR;
        transformers.env.allowRemoteModels = true;
        transformers.env.allowLocalModels = true;
        const upscaler = await transformers.pipeline('image-to-image', MODEL_ID, { dtype: 'q8' });
        modelLoaded = true;
        return { upscaler, RawImage: transformers.RawImage };
    })().catch(error => {
        runtimePromise = null;
        modelLoaded = false;
        throw error;
    });
    return runtimePromise;
}

function enqueue(task) {
    return new Promise((resolve, reject) => {
        if (running && queue.length >= MAX_WAITING_JOBS) {
            reject(clientError('O AI Upscaler está ocupado. Tente novamente quando uma tarefa terminar.', 429));
            return;
        }
        queue.push({ task, resolve, reject });
        drainQueue();
    });
}

async function drainQueue() {
    if (running) return;
    const job = queue.shift();
    if (!job) return;
    running = true;
    try { job.resolve(await job.task()); }
    catch (error) { job.reject(error); }
    finally {
        running = false;
        setImmediate(drainQueue);
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
        throw clientError(`Imagem grande demais para super-resolution local. Limite atual: ${MAX_INPUT_PIXELS.toLocaleString('pt-BR')} pixels de entrada.`, 413);
    }
    if (outputPixels > MAX_OUTPUT_PIXELS) {
        throw clientError(`O resultado ${scale}x ultrapassaria o limite seguro de ${MAX_OUTPUT_PIXELS.toLocaleString('pt-BR')} pixels. Use uma imagem menor ou 4x.`, 413);
    }
    return metadata;
}

async function runUpscale(buffer, options) {
    const scale = options.scale === 6 ? 6 : 4;
    const format = ['png', 'jpeg', 'webp'].includes(options.format) ? options.format : 'webp';
    const quality = Math.max(70, Math.min(100, Number(options.quality) || 94));
    const metadata = await validateInput(buffer, scale);
    const targetWidth = metadata.width * scale;
    const targetHeight = metadata.height * scale;
    const id = `${Date.now()}-${S.randomId(6)}`;
    const inputPath = path.join(TMP_DIR, `${id}-input.png`);

    fs.mkdirSync(TMP_DIR, { recursive: true });
    let alpha = null;
    try {
        if (metadata.hasAlpha) {
            alpha = await sharp(buffer).ensureAlpha().extractChannel('alpha').raw().toBuffer();
        }
        await sharp(buffer).removeAlpha().toColourspace('srgb').png().toFile(inputPath);

        const { upscaler, RawImage } = await getRuntime();
        const input = await RawImage.read(inputPath);
        const output = await upscaler(input);
        if (!output?.data || !output.width || !output.height) throw new Error('O modelo não retornou uma imagem válida.');

        let image = sharp(Buffer.from(output.data), {
            raw: { width: output.width, height: output.height, channels: output.channels || 3 }
        }).toColourspace('srgb');

        if (output.width !== targetWidth || output.height !== targetHeight) {
            image = image.resize(targetWidth, targetHeight, {
                fit: 'fill',
                kernel: sharp.kernel.lanczos3,
                withoutEnlargement: false
            });
        }

        if (alpha) {
            const alphaResized = await sharp(alpha, {
                raw: { width: metadata.width, height: metadata.height, channels: 1 }
            }).resize(targetWidth, targetHeight, { kernel: sharp.kernel.lanczos3 }).raw().toBuffer();
            image = image.joinChannel(alphaResized, {
                raw: { width: targetWidth, height: targetHeight, channels: 1 }
            });
        }

        if (format === 'png') image = image.png({ compressionLevel: 8, adaptiveFiltering: true });
        else if (format === 'jpeg') image = image.jpeg({ quality, mozjpeg: true });
        else image = image.webp({ quality, effort: 5, smartSubsample: true });

        const result = await image.toBuffer();
        return {
            buffer: result,
            format,
            width: targetWidth,
            height: targetHeight,
            scale,
            nativeScale: 4,
            pipeline: scale === 4 ? 'Swin2SR x4 neural' : 'Swin2SR x4 neural + Lanczos final 1.5x'
        };
    } finally {
        try { fs.unlinkSync(inputPath); } catch {}
    }
}

function sendResult(res, result, originalName) {
    const extension = result.format === 'jpeg' ? 'jpg' : result.format;
    const stem = path.basename(String(originalName || 'imagem'), path.extname(String(originalName || 'imagem'))).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'imagem';
    res.setHeader('Content-Type', result.format === 'jpeg' ? 'image/jpeg' : `image/${result.format}`);
    res.setHeader('Content-Disposition', `attachment; filename="${stem}-ai-${result.scale}x.${extension}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Upscale-Model', MODEL_ID);
    res.setHeader('X-Upscale-Scale', String(result.scale));
    res.setHeader('X-Upscale-Native-Scale', String(result.nativeScale));
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
        engine: 'Swin2SR',
        model: MODEL_ID,
        nativeScale: 4,
        supportedScales: [4, 6],
        sixXPipeline: 'Swin2SR x4 neural + Lanczos final 1.5x',
        modelLoaded,
        busy: running,
        queued: queue.length,
        maxInputPixels: MAX_INPUT_PIXELS,
        maxOutputPixels: MAX_OUTPUT_PIXELS,
        maxFileMb: MAX_FILE_BYTES / 1024 / 1024
    }));

    app.post('/api/upscale', requireTrustedOrigin, requireSession, upload.single('file'), processUpload);
    app.post('/api/v1/image/upscale', requireApiKey, upload.single('file'), processUpload);
}

module.exports = { registerUpscaleRoutes };
