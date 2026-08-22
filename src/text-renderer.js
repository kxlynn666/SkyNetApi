const fs = require('fs');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const C = require('./config');

let fontReady = false;

function ensureFont() {
    if (fontReady) return;
    if (!fs.existsSync(C.FONT_PATH)) {
        throw new Error(`Fonte do card não encontrada em ${C.FONT_PATH}`);
    }
    const registered = GlobalFonts.registerFromPath(C.FONT_PATH, 'SkyNet Text');
    if (registered === false) {
        throw new Error('Não foi possível registrar a fonte do card.');
    }
    fontReady = true;
}

function wrapText(ctx, text, maxWidth) {
    const lines = [];
    for (const paragraph of String(text || '').replace(/\r/g, '').split('\n')) {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        if (!words.length) continue;
        let line = '';
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (!line || ctx.measureText(candidate).width <= maxWidth) {
                line = candidate;
            } else {
                lines.push(line);
                line = word;
            }
        }
        if (line) lines.push(line);
    }
    return lines;
}

function fitText(ctx, text, maxWidth, startSize, maxLines) {
    for (let size = startSize; size >= 26; size -= 4) {
        ctx.font = `bold ${size}px "SkyNet Text"`;
        const lines = wrapText(ctx, text, maxWidth);
        if (lines.length <= maxLines && lines.every(line => ctx.measureText(line).width <= maxWidth)) {
            return { size, lines };
        }
    }

    const size = 26;
    ctx.font = `bold ${size}px "SkyNet Text"`;
    const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
    if (lines.length === maxLines) {
        let last = lines[maxLines - 1];
        while (last.length > 4 && ctx.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
        lines[maxLines - 1] = `${last.replace(/[.\s]+$/g, '')}...`;
    }
    return { size, lines };
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

function drawTextBlock(ctx, { text, centerY, maxWidth, startSize, maxLines, neon, strong = false }) {
    if (!String(text || '').trim()) return;

    const layout = fitText(ctx, text, maxWidth, startSize, maxLines);
    if (!layout.lines.length) return;

    ctx.font = `bold ${layout.size}px "SkyNet Text"`;

    const measuredWidth = Math.max(...layout.lines.map(line => ctx.measureText(line).width));
    const horizontalPadding = strong ? 38 : 32;
    const verticalPadding = strong ? 22 : 18;
    const lineHeight = Math.round(layout.size * (strong ? 1.22 : 1.18));

    const minWidth = strong ? 220 : 160;
    const blockWidth = Math.min(
        maxWidth + horizontalPadding * 2,
        Math.max(minWidth, Math.ceil(measuredWidth + horizontalPadding * 2))
    );

    const textHeight = layout.size + Math.max(0, layout.lines.length - 1) * lineHeight;
    const blockHeight = Math.ceil(textHeight + verticalPadding * 2);

    const x = (C.CARD_SIZE - blockWidth) / 2;
    const y = centerY - blockHeight / 2;

    ctx.save();
    roundedRectPath(ctx, x, y, blockWidth, blockHeight, strong ? 22 : 17);
    ctx.fillStyle = strong ? 'rgba(5,7,14,0.78)' : 'rgba(5,7,14,0.66)';
    ctx.fill();
    ctx.strokeStyle = neon;
    ctx.globalAlpha = strong ? 0.62 : 0.46;
    ctx.lineWidth = strong ? 3 : 2;
    ctx.stroke();
    ctx.restore();

    const startY = centerY - ((layout.lines.length - 1) * lineHeight) / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `bold ${layout.size}px "SkyNet Text"`;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#03050a';
    ctx.lineWidth = strong ? 11 : 8;
    ctx.shadowColor = neon;
    ctx.shadowBlur = strong ? 26 : 18;

    for (let i = 0; i < layout.lines.length; i += 1) {
        const lineY = startY + i * lineHeight;
        ctx.strokeText(layout.lines[i], 540, lineY, maxWidth);
        ctx.fillText(layout.lines[i], 540, lineY, maxWidth);
    }
    ctx.restore();
}

function buildTextOverlay({ textoCima, textoPrincipal, textoBaixo, neon, hasAvatar }) {
    ensureFont();

    const canvas = createCanvas(C.CARD_SIZE, C.CARD_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, C.CARD_SIZE, C.CARD_SIZE);

    drawTextBlock(ctx, {
        text: textoCima,
        centerY: 132,
        maxWidth: 870,
        startSize: 52,
        maxLines: 2,
        neon
    });

    drawTextBlock(ctx, {
        text: textoPrincipal,
        centerY: hasAvatar ? 720 : 570,
        maxWidth: 900,
        startSize: 78,
        maxLines: 4,
        neon,
        strong: true
    });

    drawTextBlock(ctx, {
        text: textoBaixo,
        centerY: 925,
        maxWidth: 870,
        startSize: 42,
        maxLines: 2,
        neon
    });

    return canvas.toBuffer('image/png');
}

module.exports = { buildTextOverlay };
