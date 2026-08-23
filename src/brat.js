const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const C = require('./config');
const S = require('./store');

// O Brat é gerado nativamente em baixa resolução. A interface pode ampliar a
// prévia visualmente, mas o arquivo retornado continua sendo 450 x 450.
const SIZE = 450;
const TEXT_BOX = { x: 45, y: 48, width: 360, height: 354 };
const PAD = 5;
const MAX_FONT = 260;
const MIN_FONT = 4;
const SOFT_BLUR = 0.7;
const LIMIT_WINDOW_MS = 60_000;
const LIMIT_MAX = 30;
const buckets = new Map();
let fontReady = false;

function registerBratRoutes(app) {
    registerFont();

    // A prévia/download do painel usa exatamente o mesmo renderer da API pública.
    app.get('/painel/brat/image', handlePanelBratImage);

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

        const png = await renderBratPng(texto);
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
    return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function setFont(ctx, size) {
    // Fonte condensada natural; nenhum scaleX ou transformação horizontal.
    ctx.font = `${size}px "Brat Sans", Arial, sans-serif`;
}

function splitLongWord(ctx, word, maxWidth, size) {
    setFont(ctx, size);
    if (ctx.measureText(word).width <= maxWidth) return [word];
    const chunks = [];
    let current = '';
    for (const char of [...word]) {
        const candidate = current + char;
        if (current && ctx.measureText(candidate).width > maxWidth) {
            chunks.push(current);
            current = char;
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function wrapParagraph(ctx, paragraph, size, maxWidth) {
    setFont(ctx, size);
    const rawWords = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!rawWords.length) return [''];
    const words = rawWords.flatMap(word => splitLongWord(ctx, word, maxWidth, size));
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (!line || ctx.measureText(candidate).width <= maxWidth) line = candidate;
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
    setFont(ctx, size);
    const widest = lines.reduce((max, line) => Math.max(max, ctx.measureText(line || ' ').width), 0);
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

function drawJustifiedLine(ctx, line, y, size) {
    const words = String(line || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;

    setFont(ctx, size);
    const left = TEXT_BOX.x + PAD;
    const width = TEXT_BOX.width - PAD * 2;
    ctx.textAlign = 'left';

    if (words.length === 1) {
        ctx.fillText(words[0], left, y);
        return;
    }

    const widths = words.map(word => ctx.measureText(word).width);
    const wordsWidth = widths.reduce((sum, value) => sum + value, 0);
    const gap = Math.max(0, (width - wordsWidth) / (words.length - 1));
    let x = left;
    words.forEach((word, index) => {
        ctx.fillText(word, x, y);
        x += widths[index] + gap;
    });
}

async function renderBratPng(text) {
    registerFont();
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

    // Blur leve aplicado diretamente no arquivo de baixa resolução. Não há
    // upscale posterior: o PNG final permanece 450 x 450 e propositalmente suave.
    const base = canvas.toBuffer('image/png');
    return sharp(base)
        .blur(SOFT_BLUR)
        .linear(1.03, -3)
        .png({ compressionLevel: 9 })
        .toBuffer();
}

module.exports = { registerBratRoutes, renderBratPng };
