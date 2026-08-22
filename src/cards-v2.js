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

const WIDTH = 1920;
const HEIGHT = 1080;
let fontReady = false;

function normalizePostCardV2Input(body = {}) {
    return {
        imagem: body.imagem_url ?? body.imagem ?? '',
        gamertag: body.gamertag ?? body.nick ?? body.username ?? '',
        nome: body.nome ?? body.display_name ?? '',
        status: body.status ?? '',
        bio: body.bio ?? body.descricao ?? '',
        stat1Label: body.stat1_label ?? 'RANK',
        stat1Value: body.stat1_value ?? '-',
        stat2Label: body.stat2_label ?? 'WINS',
        stat2Value: body.stat2_value ?? '-',
        stat3Label: body.stat3_label ?? 'LEVEL',
        stat3Value: body.stat3_value ?? '-',
        accent: body.accent ?? '#a855f7'
    };
}

function cleanText(value, maxLength) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeInput(input) {
    return {
        gamertag: cleanText(input.gamertag, 38) || 'PLAYER',
        nome: cleanText(input.nome, 60),
        status: cleanText(input.status, 42) || 'ONLINE',
        bio: cleanText(input.bio, 260),
        stats: [
            { label: cleanText(input.stat1Label, 18) || 'RANK', value: cleanText(input.stat1Value, 22) || '-' },
            { label: cleanText(input.stat2Label, 18) || 'WINS', value: cleanText(input.stat2Value, 22) || '-' },
            { label: cleanText(input.stat3Label, 18) || 'LEVEL', value: cleanText(input.stat3Value, 22) || '-' }
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
        title: `Card 2.0 · ${params.gamertag}`
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
    GlobalFonts.registerFromPath(C.FONT_PATH, 'SkyNet Gamer');
    fontReady = true;
}

function drawBackground(ctx, accent) {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, '#05070d');
    gradient.addColorStop(0.45, '#0a0d16');
    gradient.addColorStop(1, '#120b20');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    for (let x = -HEIGHT; x < WIDTH + HEIGHT; x += 84) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + HEIGHT, HEIGHT);
        ctx.stroke();
    }
    ctx.restore();

    const glow = ctx.createRadialGradient(1460, 280, 40, 1460, 280, 760);
    glow.addColorStop(0, hexToRgba(accent, 0.22));
    glow.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(760, 0, 1160, HEIGHT);
}

async function drawProfileImage(ctx, buffer, accent) {
    const x = 70;
    const y = 70;
    const width = 720;
    const height = 940;
    const prepared = await sharp(buffer, { limitInputPixels: 40_000_000 })
        .resize(width, height, { fit: 'cover', position: 'attention' })
        .png()
        .toBuffer();
    const image = await loadImage(prepared);

    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 36;
    roundedRectPath(ctx, x, y, width, height, 36);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    roundedRectPath(ctx, x, y, width, height, 36);
    ctx.clip();
    ctx.drawImage(image, x, y, width, height);

    const shade = ctx.createLinearGradient(x, 0, x + width, 0);
    shade.addColorStop(0, 'rgba(3,5,10,.04)');
    shade.addColorStop(0.68, 'rgba(3,5,10,.12)');
    shade.addColorStop(1, 'rgba(5,7,13,.78)');
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, width, height);

    const bottom = ctx.createLinearGradient(0, y + height * 0.55, 0, y + height);
    bottom.addColorStop(0, 'rgba(0,0,0,0)');
    bottom.addColorStop(1, 'rgba(0,0,0,.58)');
    ctx.fillStyle = bottom;
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 22;
    roundedRectPath(ctx, 780, 180, 8, 720, 4);
    ctx.fill();
    ctx.restore();
}

function drawProfileData(ctx, params) {
    const left = 900;
    const right = 1840;
    const contentWidth = right - left;

    ctx.save();
    ctx.fillStyle = params.accent;
    ctx.font = 'bold 28px "SkyNet Gamer"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('PLAYER PROFILE', left, 145);
    ctx.restore();

    const tagSize = fitFont(ctx, params.gamertag.toUpperCase(), contentWidth, 112, 58);
    ctx.save();
    ctx.font = `bold ${tagSize}px "SkyNet Gamer"`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = params.accent;
    ctx.shadowBlur = 24;
    ctx.fillText(params.gamertag.toUpperCase(), left, 285);
    ctx.restore();

    if (params.nome) {
        ctx.save();
        ctx.font = 'bold 38px "SkyNet Gamer"';
        ctx.fillStyle = 'rgba(232,235,245,.72)';
        ctx.fillText(params.nome, left, 345);
        ctx.restore();
    }

    drawStatusPill(ctx, left, 390, params.status, params.accent);

    drawSectionLabel(ctx, left, 510, 'ABOUT', params.accent);
    const bioLines = wrapText(ctx, params.bio || 'Sem descrição.', contentWidth - 20, 38, 4);
    ctx.save();
    ctx.font = 'bold 38px "SkyNet Gamer"';
    ctx.fillStyle = 'rgba(239,241,250,.88)';
    ctx.textBaseline = 'top';
    bioLines.forEach((line, index) => ctx.fillText(line, left, 550 + index * 54));
    ctx.restore();

    drawSectionLabel(ctx, left, 790, 'STATS', params.accent);
    const gap = 22;
    const statWidth = Math.floor((contentWidth - gap * 2) / 3);
    params.stats.forEach((stat, index) => {
        drawStatCard(ctx, left + index * (statWidth + gap), 825, statWidth, 155, stat, params.accent);
    });
}

function drawStatusPill(ctx, x, y, text, accent) {
    ctx.font = 'bold 26px "SkyNet Gamer"';
    const width = Math.min(460, Math.max(190, Math.ceil(ctx.measureText(text).width + 84)));
    ctx.save();
    roundedRectPath(ctx, x, y, width, 64, 32);
    ctx.fillStyle = hexToRgba(accent, 0.14);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(accent, 0.72);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 31, y + 32, 8, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5f5fb';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), x + 55, y + 33);
    ctx.restore();
}

function drawSectionLabel(ctx, x, y, text, accent) {
    ctx.save();
    ctx.font = 'bold 24px "SkyNet Gamer"';
    ctx.fillStyle = accent;
    ctx.fillText(text, x, y);
    ctx.fillStyle = hexToRgba(accent, 0.45);
    ctx.fillRect(x + 112, y - 10, 230, 2);
    ctx.restore();
}

function drawStatCard(ctx, x, y, width, height, stat, accent) {
    ctx.save();
    roundedRectPath(ctx, x, y, width, height, 22);
    ctx.fillStyle = 'rgba(14,17,28,.78)';
    ctx.fill();
    ctx.strokeStyle = hexToRgba(accent, 0.36);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 22px "SkyNet Gamer"';
    ctx.fillStyle = 'rgba(210,214,230,.62)';
    ctx.fillText(stat.label.toUpperCase(), x + 24, y + 44);

    const size = fitFont(ctx, stat.value, width - 48, 54, 30);
    ctx.font = `bold ${size}px "SkyNet Gamer"`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.fillText(stat.value, x + 24, y + 112);
    ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize, minSize) {
    for (let size = startSize; size >= minSize; size -= 2) {
        ctx.font = `bold ${size}px "SkyNet Gamer"`;
        if (ctx.measureText(text).width <= maxWidth) return size;
    }
    return minSize;
}

function wrapText(ctx, text, maxWidth, size, maxLines) {
    ctx.font = `bold ${size}px "SkyNet Gamer"`;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (!line || ctx.measureText(next).width <= maxWidth) {
            line = next;
        } else {
            lines.push(line);
            line = word;
            if (lines.length === maxLines - 1) break;
        }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (words.length && lines.length === maxLines) {
        let last = lines[maxLines - 1];
        while (last.length > 4 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
        lines[maxLines - 1] = `${last.replace(/[\s.,;:!?-]+$/g, '')}…`;
    }
    return lines;
}

function drawOuterFrame(ctx, accent) {
    ctx.save();
    roundedRectPath(ctx, 28, 28, WIDTH - 56, HEIGHT - 56, 38);
    ctx.strokeStyle = hexToRgba(accent, 0.78);
    ctx.lineWidth = 3;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
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
