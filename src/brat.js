const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const C = require('./config');
const S = require('./store');

// O painel usa 400 x 400. As rotas GET públicas passam por uma etapa final
// separada e retornam 300 x 300, propositalmente menos nítidas.
const SIZE = 400;
const TEXT_BOX = { x: 40, y: 43, width: 320, height: 315 };
const PAD = 4;
const MAX_FONT = 231;
const MIN_FONT = 4;
const SOFT_BLUR = 0.7;
const API_SIZE = 300;
const API_BLUR = 0.9;
const EMOJI_SCALE = 0.98;
const EMOJI_ADVANCE = 1.0;
const EMOJI_TIMEOUT_MS = 4500;
const EMOJI_MAX_BYTES = 2 * 1024 * 1024;
const FLUENT_EMOJI_BASE = 'https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode@main/assets';
const LIMIT_WINDOW_MS = 60_000;
const LIMIT_MAX = 30;
const buckets = new Map();
const emojiCache = new Map();
const graphemeSegmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
let fontReady = false;

function registerBratRoutes(app) {
    registerFont();

    // A prévia/download do painel usa o renderer-base em 400 x 400.
    app.get('/painel/brat/image', handlePanelBratImage);

    // As rotas públicas mantêm o mesmo layout, mas saem menores e mais suaves.
    app.get('/generate-brat', handleBratImage);
    app.get('/api/brat', handleBratImage);
    app.get('/brat', (req, res, next) => {
        const wantsImage = Object.prototype.hasOwnProperty.call(req.query || {}, 'texto')
            || Object.prototype.hasOwnProperty.call(req.query || {}, 'text')
            || Object.prototype.hasOwnProperty.call(req.query || {}, 'apikey')
            || Boolean(req.headers['x-api-key'])
            || Boolean(req.headers.authorization);
        if (!wantsImage) return next();
        return handleBratImage(req, res, next);
    });
}

async function handlePanelBratImage(req, res, next) {
    try {
        const account = getSessionAccount(req);
        if (!account) return res.status(401).json({ ok: false, error: 'Sessão inválida ou expirada.' });

        const texto = cleanText(req.query?.texto ?? req.query?.text, 450);
        if (!texto) return res.status(400).json({ ok: false, error: 'Informe o parâmetro texto.' });

        const png = await renderBratPng(texto);
        return sendPng(res, png, 'brat.png');
    } catch (error) {
        return next(error);
    }
}

async function handleBratImage(req, res, next) {
    try {
        if (!takeRateSlot(req.ip || req.socket?.remoteAddress || 'unknown')) {
            res.setHeader('Retry-After', '60');
            return res.status(429).json({ ok: false, error: 'Limite de geração atingido. Tente novamente em instantes.' });
        }

        const texto = cleanText(req.query?.texto ?? req.query?.text, 450);
        if (!texto) return res.status(400).json({ ok: false, error: 'Informe o parâmetro texto.' });

        const apiKey = readApiKey(req);
        const auth = S.authenticateApiKey(apiKey);
        if (!auth) return res.status(401).json({ ok: false, error: 'API key inválida ou ausente.' });

        const basePng = await renderBratPng(texto);
        const png = await makePublicApiPng(basePng);
        return sendPng(res, png, 'brat.png');
    } catch (error) {
        return next(error);
    }
}

function sendPng(res, png, filename) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(png.length));
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(png);
}

function getSessionAccount(req) {
    const token = parseCookies(req.headers.cookie || '').skynet_session || '';
    const session = token ? S.getSession(token) : null;
    if (!session) return null;
    return S.loadAccounts().find(account => account.id === session.accountId && account.active) || null;
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

function readApiKey(req) {
    const authorization = String(req.headers.authorization || '');
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return String(req.query?.apikey || req.headers['x-api-key'] || bearer || '').trim();
}

function takeRateSlot(key) {
    const now = Date.now();
    for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    const id = String(key || 'unknown');
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + LIMIT_WINDOW_MS };
        buckets.set(id, bucket);
    }
    bucket.count += 1;
    return bucket.count <= LIMIT_MAX;
}

function registerFont() {
    if (fontReady) return;
    fontReady = true;
    const candidates = [
        path.join(C.ROOT, 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSansCondensed.ttf'),
        C.FONT_PATH
    ];
    for (const file of candidates) {
        try {
            if (file && fs.existsSync(file)) {
                GlobalFonts.registerFromPath(file, 'Brat Sans');
                return;
            }
        } catch {}
    }
}

function cleanText(value, maxLength) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .trim()
        .slice(0, maxLength);
}

function setFont(ctx, size) {
    // Fonte condensada natural; nenhum scaleX ou transformação horizontal.
    ctx.font = `${size}px "Brat Sans", Arial, sans-serif`;
}

function graphemes(value) {
    return Array.from(graphemeSegmenter.segment(String(value || '')), item => item.segment);
}

function isEmojiCluster(value) {
    return /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3|\uFE0F)/u.test(String(value || ''));
}

function emojiAdvance(size) {
    return size * EMOJI_ADVANCE;
}

function measureRichText(ctx, text, size) {
    setFont(ctx, size);
    let width = 0;
    let plain = '';

    const flushPlain = () => {
        if (!plain) return;
        width += ctx.measureText(plain).width;
        plain = '';
    };

    for (const part of graphemes(text)) {
        if (isEmojiCluster(part)) {
            flushPlain();
            width += emojiAdvance(size);
        } else {
            plain += part;
        }
    }
    flushPlain();
    return width;
}

function splitLongWord(ctx, word, maxWidth, size) {
    if (measureRichText(ctx, word, size) <= maxWidth) return [word];
    const chunks = [];
    let current = '';
    for (const part of graphemes(word)) {
        const candidate = current + part;
        if (current && measureRichText(ctx, candidate, size) > maxWidth) {
            chunks.push(current);
            current = part;
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function wrapParagraph(ctx, paragraph, size, maxWidth) {
    const rawWords = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!rawWords.length) return [''];
    const words = rawWords.flatMap(word => splitLongWord(ctx, word, maxWidth, size));
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (!line || measureRichText(ctx, candidate, size) <= maxWidth) line = candidate;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function layoutFor(ctx, text, size) {
    const maxWidth = TEXT_BOX.width - PAD * 2;
    const lines = [];
    for (const paragraph of text.split('\n')) lines.push(...wrapParagraph(ctx, paragraph, size, maxWidth));
    const lineHeight = size * 0.94;
    const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
    const widest = lines.reduce((max, line) => Math.max(max, measureRichText(ctx, line || ' ', size)), 0);
    return { lines, lineHeight, totalHeight, widest };
}

function fitText(ctx, text) {
    const usableWidth = TEXT_BOX.width - PAD * 2;
    const usableHeight = TEXT_BOX.height - PAD * 2;
    let low = MIN_FONT;
    let high = MAX_FONT;
    let best = MIN_FONT;
    let bestLayout = layoutFor(ctx, text, MIN_FONT);
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const layout = layoutFor(ctx, text, mid);
        if (layout.widest <= usableWidth && layout.totalHeight <= usableHeight) {
            best = mid;
            bestLayout = layout;
            low = mid + 1;
        } else high = mid - 1;
    }
    return { size: best, ...bestLayout };
}

function emojiCodeCandidates(value) {
    const points = [...String(value || '')].map(char => char.codePointAt(0));
    const withoutVs = points.filter(point => point !== 0xFE0F && point !== 0xFE0E);
    const make = items => items.map(point => point.toString(16).toLowerCase()).join('-');
    return [...new Set([make(points), make(withoutVs)].filter(Boolean))];
}

function findOpenMojiFallback(value) {
    const base = path.join(C.ROOT, 'node_modules', 'openmoji', 'color');
    const folders = [
        { dir: path.join(base, '72x72'), ext: '.png' },
        { dir: path.join(base, 'svg'), ext: '.svg' }
    ];

    const codes = emojiCodeCandidates(value).flatMap(code => [code.toUpperCase(), code]);
    for (const code of codes) {
        for (const folder of folders) {
            const file = path.join(folder.dir, `${code}${folder.ext}`);
            if (fs.existsSync(file)) return file;
        }
    }
    return null;
}

async function fetchFluentEmoji(value) {
    for (const code of emojiCodeCandidates(value)) {
        const url = `${FLUENT_EMOJI_BASE}/${code}_3d.png`;
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: EMOJI_TIMEOUT_MS,
                maxContentLength: EMOJI_MAX_BYTES,
                maxBodyLength: EMOJI_MAX_BYTES,
                validateStatus: status => status === 200
            });
            const buffer = Buffer.from(response.data);
            if (!buffer.length || buffer.length > EMOJI_MAX_BYTES) continue;
            return await loadImage(buffer);
        } catch {}
    }
    return null;
}

async function loadEmojiAsset(value) {
    if (emojiCache.has(value)) return emojiCache.get(value);

    let image = await fetchFluentEmoji(value);

    if (!image) {
        const fallbackFile = findOpenMojiFallback(value);
        if (fallbackFile) {
            try { image = await loadImage(fallbackFile); }
            catch { image = null; }
        }
    }

    emojiCache.set(value, image || null);
    return image || null;
}

async function preloadEmojiAssets(text) {
    const unique = [...new Set(graphemes(text).filter(isEmojiCluster))];
    await Promise.all(unique.map(loadEmojiAsset));
}

function drawRichText(ctx, text, x, y, size) {
    setFont(ctx, size);
    let cursor = x;
    let plain = '';

    const flushPlain = () => {
        if (!plain) return;
        ctx.fillText(plain, cursor, y);
        cursor += ctx.measureText(plain).width;
        plain = '';
    };

    for (const part of graphemes(text)) {
        if (!isEmojiCluster(part)) {
            plain += part;
            continue;
        }

        flushPlain();
        const image = emojiCache.get(part);
        const advance = emojiAdvance(size);

        if (image) {
            const emojiSize = size * EMOJI_SCALE;
            const top = y - size * 0.80;
            const offset = Math.max(0, (advance - emojiSize) / 2);

            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.10)';
            ctx.shadowBlur = Math.max(0.5, size * 0.018);
            ctx.shadowOffsetY = Math.max(0.25, size * 0.012);
            ctx.drawImage(image, cursor + offset, top, emojiSize, emojiSize);
            ctx.restore();
        } else {
            // Fallback para o glifo do sistema caso nenhum asset esteja disponível.
            ctx.fillText(part, cursor, y);
        }
        cursor += advance;
    }

    flushPlain();
    return cursor - x;
}

function drawJustifiedLine(ctx, line, y, size) {
    const words = String(line || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;

    const left = TEXT_BOX.x + PAD;
    const width = TEXT_BOX.width - PAD * 2;
    ctx.textAlign = 'left';

    if (words.length === 1) {
        drawRichText(ctx, words[0], left, y, size);
        return;
    }

    const widths = words.map(word => measureRichText(ctx, word, size));
    const wordsWidth = widths.reduce((sum, value) => sum + value, 0);
    const gap = Math.max(0, (width - wordsWidth) / (words.length - 1));
    let x = left;
    words.forEach((word, index) => {
        drawRichText(ctx, word, x, y, size);
        x += widths[index] + gap;
    });
}

async function renderBratPng(text) {
    registerFont();
    await preloadEmojiAssets(text);

    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const layout = fitText(ctx, text);
    const centerY = TEXT_BOX.y + TEXT_BOX.height / 2;
    const firstBaseline = centerY - layout.totalHeight / 2 + layout.lineHeight * 0.78;

    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'alphabetic';
    setFont(ctx, layout.size);
    layout.lines.forEach((line, index) => {
        drawJustifiedLine(ctx, line, firstBaseline + index * layout.lineHeight, layout.size);
    });

    // Base do painel: 400 x 400, baixa resolução e blur suave.
    const base = canvas.toBuffer('image/png');
    return sharp(base)
        .blur(SOFT_BLUR)
        .linear(1.03, -3)
        .png({ compressionLevel: 9 })
        .toBuffer();
}

async function makePublicApiPng(basePng) {
    // GET público: reduz de verdade para 300 x 300 e suaviza um pouco mais.
    // O resize é uniforme, então não estica nem comprime a fonte ou os emojis.
    return sharp(basePng)
        .resize(API_SIZE, API_SIZE, { fit: 'fill', kernel: sharp.kernel.cubic })
        .blur(API_BLUR)
        .linear(1.02, -2)
        .png({ compressionLevel: 9 })
        .toBuffer();
}

module.exports = { registerBratRoutes, renderBratPng };
