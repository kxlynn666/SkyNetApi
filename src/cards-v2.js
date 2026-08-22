const fs = require('fs');
const path = require('path');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const axios = require('axios');
const sharp = require('sharp');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const C = require('./config');
const S = require('./store');
const Cards = require('./cards');

const WIDTH = 1500;
const HEIGHT = 1000;
let fontReady = false;

function normalizePostCardV2Input(body = {}) {
    return {
        imagem: body.imagem_url ?? body.imagem ?? '',
        gamertag: body.gamertag ?? body.identificador ?? body.nick ?? body.username ?? '',
        nome: body.nome ?? body.titulo ?? body.display_name ?? '',
        status: body.status ?? body.etiqueta ?? '',
        bio: body.bio ?? body.descricao ?? '',
        stat1Label: body.stat1_label ?? body.info1_label ?? 'INFO 1',
        stat1Value: body.stat1_value ?? body.info1_value ?? '',
        stat2Label: body.stat2_label ?? body.info2_label ?? 'INFO 2',
        stat2Value: body.stat2_value ?? body.info2_value ?? '',
        stat3Label: body.stat3_label ?? body.info3_label ?? 'INFO 3',
        stat3Value: body.stat3_value ?? body.info3_value ?? '',
        accent: body.accent ?? '#a855f7'
    };
}

function cleanText(value, maxLength) {
    return String(value || '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function sanitizeInput(input) {
    const gamertag = cleanText(input.gamertag, 38);
    const nome = cleanText(input.nome, 60) || gamertag || 'Perfil';
    return {
        gamertag,
        nome,
        status: cleanText(input.status, 42),
        bio: cleanText(input.bio, 260),
        details: [
            { label: cleanText(input.stat1Label, 18) || 'INFO 1', value: cleanText(input.stat1Value, 28) },
            { label: cleanText(input.stat2Label, 18) || 'INFO 2', value: cleanText(input.stat2Value, 28) },
            { label: cleanText(input.stat3Label, 18) || 'INFO 3', value: cleanText(input.stat3Value, 28) }
        ],
        accent: /^#[0-9a-f]{6}$/i.test(String(input.accent || '')) ? String(input.accent) : '#a855f7'
    };
}

async function createCardV2ForAccount(account, input, fileObj, source = 'panel-v2') {
    const imageBuffer = await resolveImageBuffer(account, input.imagem, fileObj);
    if (!imageBuffer) throw Cards.clientError('Informe a imagem principal do perfil por URL, upload ou arquivo.');

    const params = sanitizeInput(input);
    const buffer = await renderCardV2(imageBuffer, params);
    const id = S.randomId();
    const filename = `card-v2-${id}.png`;
    fs.writeFileSync(path.join(C.GENERATED_DIR, filename), buffer, { mode: 0o600 });

    const generations = S.loadGenerations();
    const record = {
        id,
        accountId: account.id,
        filename,
        source,
        neon: params.accent,
        createdAt: new Date().toISOString(),
        title: `Card 2.0 · ${params.nome}`
    };
    generations.push(record);

    const ownerItems = generations
        .filter(item => item.accountId === account.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    while (ownerItems.length > C.MAX_GENERATIONS_PER_ACCOUNT) {
        const old = ownerItems.shift();
        const index = generations.findIndex(item => item.id === old.id);
        if (index !== -1) generations.splice(index, 1);
        S.removeFileIfExists(path.join(C.GENERATED_DIR, old.filename));
    }

    S.saveGenerations(generations.slice(-5000));
    return {
        id,
        url: `/generated/${filename}`,
        filename,
        createdAt: record.createdAt,
        accent: params.accent,
        width: WIDTH,
        height: HEIGHT,
        buffer
    };
}

async function renderCardV2(imageBuffer, params) {
    ensureFont();
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    drawBackground(ctx, params.accent);
    await drawProfileImage(ctx, imageBuffer, params.accent);
    drawProfileData(ctx, params);
    drawOuterFrame(ctx, params.accent);

    return canvas.toBuffer('image/png');
}

function ensureFont() {
    if (fontReady) return;
    if (!fs.existsSync(C.FONT_PATH)) throw Cards.clientError(`Fonte do Card 2.0 não encontrada em ${C.FONT_PATH}`, 500);
    GlobalFonts.registerFromPath(C.FONT_PATH, 'SkyNet Profile');
    fontReady = true;
}

function drawBackground(ctx, accent) {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, '#090b11');
    gradient.addColorStop(0.55, '#0d1018');
    gradient.addColorStop(1, '#12101a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(1180, 180, 20, 1180, 180, 560);
    glow.addColorStop(0, hexToRgba(accent, 0.13));
    glow.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(650, 0, 850, 700);

    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let y = 120; y < HEIGHT; y += 110) {
        ctx.beginPath();
        ctx.moveTo(720, y);
        ctx.lineTo(WIDTH - 70, y);
        ctx.stroke();
    }
    ctx.restore();
}

async function drawProfileImage(ctx, buffer, accent) {
    const x = 70;
    const y = 190;
    const size = 620;
    const prepared = await sharp(buffer, { limitInputPixels: 40_000_000 })
        .resize(size, size, { fit: 'cover', position: 'attention' })
        .png()
        .toBuffer();
    const image = await loadImage(prepared);

    ctx.save();
    roundedRectPath(ctx, x, y, size, size, 34);
    ctx.fillStyle = '#0c0f16';
    ctx.fill();
    ctx.strokeStyle = hexToRgba(accent, 0.72);
    ctx.lineWidth = 4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 22;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    roundedRectPath(ctx, x, y, size, size, 31);
    ctx.clip();
    ctx.drawImage(image, x, y, size, size);

    const shade = ctx.createLinearGradient(x, y, x, y + size);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(0.72, 'rgba(0,0,0,.03)');
    shade.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, size, size);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = accent;
    roundedRectPath(ctx, x, y + size + 24, 160, 5, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    roundedRectPath(ctx, x + 174, y + size + 24, 90, 5, 3);
    ctx.fill();
    ctx.restore();
}

function drawProfileData(ctx, params) {
    const left = 770;
    const right = 1430;
    const contentWidth = right - left;

    ctx.save();
    ctx.fillStyle = params.accent;
    ctx.font = 'bold 24px "SkyNet Profile"';
    ctx.textAlign = 'left';
    ctx.fillText('PERFIL', left, 145);
    ctx.restore();

    const titleSize = fitFont(ctx, params.nome, contentWidth, 82, 46);
    ctx.save();
    ctx.font = `bold ${titleSize}px "SkyNet Profile"`;
    ctx.fillStyle = '#f7f8fb';
    ctx.fillText(params.nome, left, 250);
    ctx.restore();

    if (params.gamertag && params.gamertag !== params.nome) {
        ctx.save();
        ctx.font = 'bold 30px "SkyNet Profile"';
        ctx.fillStyle = 'rgba(218,221,232,.62)';
        const handle = params.gamertag.startsWith('@') ? params.gamertag : `@${params.gamertag}`;
        ctx.fillText(handle, left, 304);
        ctx.restore();
    }

    if (params.status) drawTag(ctx, left, 345, params.status, params.accent);

    drawSectionLabel(ctx, left, 455, 'SOBRE', params.accent);
    const bioLines = wrapText(ctx, params.bio || 'Sem descrição.', contentWidth, 30, 5);
    ctx.save();
    ctx.font = 'bold 30px "SkyNet Profile"';
    ctx.fillStyle = 'rgba(236,238,246,.84)';
    ctx.textBaseline = 'top';
    bioLines.forEach((line, index) => ctx.fillText(line, left, 490 + index * 44));
    ctx.restore();

    drawSectionLabel(ctx, left, 735, 'INFORMAÇÕES', params.accent);
    const gap = 16;
    const detailWidth = Math.floor((contentWidth - gap * 2) / 3);
    params.details.forEach((detail, index) => {
        drawDetailCard(ctx, left + index * (detailWidth + gap), 770, detailWidth, 145, detail, params.accent);
    });
}

function drawTag(ctx, x, y, text, accent) {
    ctx.font = 'bold 22px "SkyNet Profile"';
    const width = Math.min(420, Math.max(130, Math.ceil(ctx.measureText(text).width + 52)));
    ctx.save();
    roundedRectPath(ctx, x, y, width, 52, 26);
    ctx.fillStyle = hexToRgba(accent, 0.12);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(accent, 0.52);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f1f2f7';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 26, y + 27);
    ctx.restore();
}

function drawSectionLabel(ctx, x, y, text, accent) {
    ctx.save();
    ctx.font = 'bold 20px "SkyNet Profile"';
    ctx.fillStyle = accent;
    ctx.fillText(text, x, y);
    const labelWidth = ctx.measureText(text).width;
    ctx.fillStyle = hexToRgba(accent, 0.34);
    ctx.fillRect(x + labelWidth + 24, y - 8, Math.max(80, 260 - labelWidth), 2);
    ctx.restore();
}

function drawDetailCard(ctx, x, y, width, height, detail, accent) {
    ctx.save();
    roundedRectPath(ctx, x, y, width, height, 20);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 17px "SkyNet Profile"';
    ctx.fillStyle = hexToRgba(accent, 0.82);
    ctx.fillText(detail.label.toUpperCase(), x + 20, y + 38);

    const value = detail.value || '—';
    const size = fitFont(ctx, value, width - 40, 34, 22);
    ctx.font = `bold ${size}px "SkyNet Profile"`;
    ctx.fillStyle = '#f6f7fa';
    ctx.fillText(value, x + 20, y + 94);
    ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize, minSize) {
    for (let size = startSize; size >= minSize; size -= 2) {
        ctx.font = `bold ${size}px "SkyNet Profile"`;
        if (ctx.measureText(text).width <= maxWidth) return size;
    }
    return minSize;
}

function wrapText(ctx, text, maxWidth, size, maxLines) {
    ctx.font = `bold ${size}px "SkyNet Profile"`;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    let consumed = 0;

    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (!line || ctx.measureText(next).width <= maxWidth) {
            line = next;
            consumed += 1;
        } else {
            lines.push(line);
            if (lines.length === maxLines) break;
            line = word;
            consumed += 1;
        }
    }
    if (line && lines.length < maxLines) lines.push(line);

    if (consumed < words.length && lines.length) {
        const index = Math.min(maxLines, lines.length) - 1;
        let last = lines[index];
        while (last.length > 4 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
        lines[index] = `${last.replace(/[\s.,;:!?-]+$/g, '')}…`;
    }
    return lines.slice(0, maxLines);
}

function drawOuterFrame(ctx, accent) {
    ctx.save();
    roundedRectPath(ctx, 28, 28, WIDTH - 56, HEIGHT - 56, 34);
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(accent, 0.24);
    ctx.lineWidth = 1;
    roundedRectPath(ctx, 36, 36, WIDTH - 72, HEIGHT - 72, 30);
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

function hexToRgba(hex, alpha) {
    const value = String(hex || '#a855f7').replace('#', '');
    const r = Number.parseInt(value.slice(0, 2), 16) || 168;
    const g = Number.parseInt(value.slice(2, 4), 16) || 85;
    const b = Number.parseInt(value.slice(4, 6), 16) || 247;
    return `rgba(${r},${g},${b},${alpha})`;
}

async function resolveImageBuffer(account, urlValue, fileObj) {
    if (fileObj?.buffer) return (await Cards.validateAndNormalizeUpload(fileObj.buffer, fileObj.mimetype)).buffer;
    const raw = String(urlValue || '').trim();
    if (!raw) return null;

    const localFilename = extractLocalUploadFilename(raw);
    if (localFilename) {
        const upload = S.loadUploads().find(item => item.filename === localFilename && item.accountId === account.id);
        if (!upload) throw Cards.clientError('Upload não encontrado ou não pertence à sua conta.');
        const filepath = path.join(C.UPLOADS_DIR, upload.filename);
        if (!fs.existsSync(filepath)) throw Cards.clientError('O arquivo do upload não existe mais.');
        return fs.readFileSync(filepath);
    }

    return fetchRemoteImage(raw);
}

async function fetchRemoteImage(urlValue) {
    let current;
    try { current = new URL(urlValue); }
    catch { throw Cards.clientError('URL de imagem inválida.'); }
    if (!['http:', 'https:'].includes(current.protocol)) throw Cards.clientError('Apenas URLs HTTP/HTTPS são permitidas.');

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
            headers: { 'User-Agent': 'SkyNetApi/2.4 CardV2' },
            httpAgent: current.protocol === 'http:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined,
            httpsAgent: current.protocol === 'https:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined
        });

        if (response.status >= 300 && response.status < 400) {
            if (!response.headers.location) throw Cards.clientError('Redirecionamento remoto inválido.');
            current = new URL(response.headers.location, current);
            if (!['http:', 'https:'].includes(current.protocol)) throw Cards.clientError('Redirecionamento para protocolo não permitido.');
            continue;
        }

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (contentType && !contentType.startsWith('image/')) throw Cards.clientError('A URL informada não retornou uma imagem.');
        const buffer = Buffer.from(response.data);
        if (buffer.length > C.MAX_REMOTE_IMAGE_MB * 1024 * 1024) throw Cards.clientError('Imagem remota muito grande.');
        return (await Cards.validateAndNormalizeUpload(buffer, contentType)).buffer;
    }

    throw Cards.clientError('A URL excedeu o limite de redirecionamentos.');
}

function extractLocalUploadFilename(value) {
    try {
        if (value.startsWith('/uploads/')) return path.basename(decodeURIComponent(value.slice('/uploads/'.length)));
        if (/^https?:\/\//i.test(value)) {
            const parsed = new URL(value);
            if (parsed.pathname.startsWith('/uploads/')) return path.basename(decodeURIComponent(parsed.pathname.slice('/uploads/'.length)));
        }
    } catch {}
    return null;
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
    if (!hostname) throw Cards.clientError('Hostname inválido.');
    const stripped = hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(stripped)) {
        if (isPrivateIp(stripped)) throw Cards.clientError('Endereços de rede interna não são permitidos.');
        return;
    }
    const addresses = await dns.promises.lookup(stripped, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) {
        throw Cards.clientError('O endereço informado aponta para uma rede não permitida.');
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
    WIDTH,
    HEIGHT,
    normalizePostCardV2Input,
    createCardV2ForAccount
};
