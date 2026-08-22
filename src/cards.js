const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const axios = require('axios');
const sharp = require('sharp');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const C = require('./config');
const S = require('./store');
const { buildTextOverlay } = require('./text-renderer');

function registerFont() {
    try {
        if (fs.existsSync(C.FONT_PATH)) GlobalFonts.registerFromPath(C.FONT_PATH, 'SkyNet Sans');
    } catch (error) {
        console.warn(`Não foi possível registrar a fonte customizada: ${error.message}`);
    }
}

function normalizePostCardInput(body = {}) {
    const hasPrincipal = body.texto_principal !== undefined || body.textopr !== undefined;
    return {
        fundo: body.fundo_url ?? body.fundo ?? '',
        avatar: body.avatar_url ?? body.avatar ?? '',
        textoCima: body.texto_cima ?? body.texto_topo ?? body.textocima ?? '',
        textoPrincipal: body.texto_principal ?? body.textopr ?? (hasPrincipal ? '' : (body.texto_baixo ?? body.texto_extra ?? '')),
        textoBaixo: hasPrincipal ? (body.texto_baixo ?? body.textobaixo ?? '') : (body.texto_rodape ?? body.textobaixo ?? '')
    };
}

function normalizeQueryCardInput(query = {}) {
    return {
        fundo: query.fundo ?? query.fundo_url ?? '',
        avatar: query.avatar ?? query.avatar_url ?? '',
        textoCima: query.textocima ?? query.texto_cima ?? query.texto_topo ?? '',
        textoPrincipal: query.textopr ?? query.texto_principal ?? '',
        textoBaixo: query.textobaixo ?? query.texto_baixo ?? ''
    };
}

function cleanText(value, maxLength) {
    return String(value || '').replace(/\r/g, '').trim().slice(0, maxLength);
}

function sanitizeCardParams(input) {
    return {
        textoCima: cleanText(input.textoCima, 160),
        textoPrincipal: cleanText(input.textoPrincipal, 360),
        textoBaixo: cleanText(input.textoBaixo, 180)
    };
}

function chooseNeonColor() {
    return C.NEON_COLORS[crypto.randomInt(0, C.NEON_COLORS.length)];
}

function clientError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function createCardForAccount(account, input, files, source) {
    const fundoBuffer = await resolveImageBuffer(account, input.fundo, files?.fundo_file?.[0]);
    const avatarBuffer = await resolveImageBuffer(account, input.avatar, files?.avatar_file?.[0]);
    if (!fundoBuffer) throw clientError('Informe uma imagem de fundo por URL, upload ou arquivo.');

    const params = sanitizeCardParams(input);
    const neon = chooseNeonColor();
    const buffer = await generateCardImage({ fundoBuffer, avatarBuffer, neon, ...params });
    const id = S.randomId();
    const filename = `card-${id}.png`;
    fs.writeFileSync(path.join(C.GENERATED_DIR, filename), buffer, { mode: 0o600 });

    const generations = S.loadGenerations();
    const record = {
        id,
        accountId: account.id,
        filename,
        source,
        neon,
        createdAt: new Date().toISOString(),
        title: params.textoPrincipal.slice(0, 100) || params.textoCima.slice(0, 100) || 'Card sem título'
    };
    generations.push(record);

    const ownerItems = generations
        .filter(g => g.accountId === account.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    while (ownerItems.length > C.MAX_GENERATIONS_PER_ACCOUNT) {
        const old = ownerItems.shift();
        const index = generations.findIndex(g => g.id === old.id);
        if (index !== -1) generations.splice(index, 1);
        S.removeFileIfExists(path.join(C.GENERATED_DIR, old.filename));
    }

    S.saveGenerations(generations.slice(-5000));
    return { id, url: `/generated/${filename}`, filename, createdAt: record.createdAt, neon, buffer };
}

async function resolveImageBuffer(account, urlValue, fileObj) {
    if (fileObj?.buffer) return (await validateAndNormalizeUpload(fileObj.buffer, fileObj.mimetype)).buffer;

    const raw = String(urlValue || '').trim();
    if (!raw) return null;

    const localFilename = extractLocalUploadFilename(raw);
    if (localFilename) {
        const upload = S.loadUploads().find(u => u.filename === localFilename && u.accountId === account.id);
        if (!upload) throw clientError('Upload não encontrado ou não pertence à sua conta.');
        const filepath = path.join(C.UPLOADS_DIR, upload.filename);
        if (!fs.existsSync(filepath)) throw clientError('O arquivo do upload não existe mais.');
        return fs.readFileSync(filepath);
    }

    return fetchRemoteImage(raw);
}

async function validateAndNormalizeUpload(buffer, declaredMime = '') {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw clientError('Arquivo de imagem vazio ou inválido.');

    const input = sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000, sequentialRead: true });
    const metadata = await input.metadata();
    if (!new Set(['jpeg', 'png', 'webp', 'gif']).has(metadata.format)) {
        throw clientError('Formato não suportado. Use JPG, PNG, WEBP ou GIF.');
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) {
        throw clientError('As dimensões da imagem são muito grandes.');
    }

    const normalized = await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
        .rotate()
        .png({ compressionLevel: 8 })
        .toBuffer();

    if (normalized.length > C.MAX_UPLOAD_MB * 1024 * 1024) {
        throw clientError(`A imagem processada ultrapassa o limite de ${C.MAX_UPLOAD_MB}MB.`);
    }

    return {
        buffer: normalized,
        extension: 'png',
        mime: 'image/png',
        width: metadata.width,
        height: metadata.height,
        declaredMime
    };
}

async function fetchRemoteImage(urlValue) {
    let current;
    try {
        current = new URL(urlValue);
    } catch {
        throw clientError('URL de imagem inválida.');
    }

    if (!['http:', 'https:'].includes(current.protocol)) {
        throw clientError('Apenas URLs HTTP/HTTPS são permitidas.');
    }

    for (let redirects = 0; redirects <= 3; redirects += 1) {
        await assertPublicHostname(current.hostname);
        const client = current.protocol === 'https:' ? https : http;
        const response = await axios.get(current.toString(), {
            responseType: 'arraybuffer',
            timeout: 6000,
            maxRedirects: 0,
            validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400),
            maxContentLength: C.MAX_REMOTE_IMAGE_MB * 1024 * 1024,
            maxBodyLength: C.MAX_REMOTE_IMAGE_MB * 1024 * 1024,
            headers: { 'User-Agent': 'SkyNetApi/2.3' },
            httpAgent: current.protocol === 'http:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined,
            httpsAgent: current.protocol === 'https:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined
        });

        if (response.status >= 300 && response.status < 400) {
            if (!response.headers.location) throw clientError('Redirecionamento remoto inválido.');
            current = new URL(response.headers.location, current);
            if (!['http:', 'https:'].includes(current.protocol)) {
                throw clientError('Redirecionamento para protocolo não permitido.');
            }
            continue;
        }

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (contentType && !contentType.startsWith('image/')) {
            throw clientError('A URL informada não retornou uma imagem.');
        }

        const buffer = Buffer.from(response.data);
        if (buffer.length > C.MAX_REMOTE_IMAGE_MB * 1024 * 1024) {
            throw clientError('Imagem remota muito grande.');
        }

        return (await validateAndNormalizeUpload(buffer, contentType)).buffer;
    }

    throw clientError('A URL excedeu o limite de redirecionamentos.');
}

async function generateCardImage(params) {
    const canvas = createCanvas(C.CARD_SIZE, C.CARD_SIZE);
    const ctx = canvas.getContext('2d');

    const backgroundBuffer = await sharp(params.fundoBuffer, { limitInputPixels: 40_000_000 })
        .resize(C.CARD_SIZE, C.CARD_SIZE, { fit: 'cover', position: 'attention' })
        .png()
        .toBuffer();

    ctx.drawImage(await loadImage(backgroundBuffer), 0, 0, C.CARD_SIZE, C.CARD_SIZE);

    const shade = ctx.createLinearGradient(0, 0, 0, C.CARD_SIZE);
    shade.addColorStop(0, 'rgba(3,5,12,.48)');
    shade.addColorStop(.45, 'rgba(3,5,12,.22)');
    shade.addColorStop(1, 'rgba(3,5,12,.62)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, C.CARD_SIZE, C.CARD_SIZE);

    drawNeonFrame(ctx, params.neon);
    if (params.avatarBuffer) await drawCircularAvatar(ctx, params.avatarBuffer, params.neon);

    const baseBuffer = canvas.toBuffer('image/png');
    const textOverlay = buildTextOverlay({
        textoCima: params.textoCima,
        textoPrincipal: params.textoPrincipal,
        textoBaixo: params.textoBaixo,
        neon: params.neon,
        hasAvatar: Boolean(params.avatarBuffer)
    });

    return sharp(baseBuffer)
        .composite([{ input: textOverlay, top: 0, left: 0 }])
        .png({ compressionLevel: 8 })
        .toBuffer();
}

function drawNeonFrame(ctx, neon) {
    ctx.save();
    roundedRectPath(ctx, 24, 24, C.CARD_SIZE - 48, C.CARD_SIZE - 48, 30);
    ctx.strokeStyle = neon;
    ctx.lineWidth = 6;
    ctx.shadowColor = neon;
    ctx.shadowBlur = 28;
    ctx.stroke();
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

async function drawCircularAvatar(ctx, buffer, neon) {
    const size = 260;
    const y = 265;
    const prepared = await sharp(buffer, { limitInputPixels: 40_000_000 })
        .resize(size, size, { fit: 'cover', position: 'attention' })
        .png()
        .toBuffer();
    const avatar = await loadImage(prepared);

    ctx.save();
    ctx.shadowColor = neon;
    ctx.shadowBlur = 34;
    ctx.strokeStyle = neon;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(540, y + size / 2, size / 2 + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(540, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, (C.CARD_SIZE - size) / 2, y, size, size);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.88)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(540, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function extractLocalUploadFilename(value) {
    try {
        if (value.startsWith('/uploads/')) {
            return path.basename(decodeURIComponent(value.slice('/uploads/'.length)));
        }
        if (/^https?:\/\//i.test(value)) {
            const parsed = new URL(value);
            if (parsed.pathname.startsWith('/uploads/')) {
                return path.basename(decodeURIComponent(parsed.pathname.slice('/uploads/'.length)));
            }
        }
    } catch {}
    return null;
}

function safeLookup(hostname, options, callback) {
    const opts = typeof options === 'object' ? options : {};
    dns.lookup(hostname, { ...opts, all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(error);
        const list = Array.isArray(addresses) ? addresses : [addresses];
        const allowed = list.filter(item => item?.address && !isPrivateIp(item.address));
        if (!allowed.length) return callback(new Error('Destino de rede não permitido'));
        callback(null, allowed[0].address, allowed[0].family);
    });
}

async function assertPublicHostname(hostname) {
    if (!hostname) throw clientError('Hostname inválido.');
    const stripped = hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(stripped)) {
        if (isPrivateIp(stripped)) throw clientError('Endereços de rede interna não são permitidos.');
        return;
    }
    const addresses = await dns.promises.lookup(stripped, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) {
        throw clientError('O endereço informado aponta para uma rede não permitida.');
    }
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

module.exports = {
    registerFont,
    normalizePostCardInput,
    normalizeQueryCardInput,
    createCardForAccount,
    validateAndNormalizeUpload,
    clientError
};
