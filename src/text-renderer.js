function escapeXml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function wrapByApproxWidth(text, maxWidth, fontSize) {
    const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * 0.56)));
    const lines = [];
    for (const paragraph of String(text || '').replace(/\r/g, '').split('\n')) {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        if (!words.length) continue;
        let line = '';
        for (const word of words) {
            if (word.length > maxChars && !line) {
                for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
                continue;
            }
            const candidate = line ? `${line} ${word}` : word;
            if (candidate.length <= maxChars) line = candidate;
            else {
                if (line) lines.push(line);
                line = word;
            }
        }
        if (line) lines.push(line);
    }
    return lines;
}

function fitText(text, maxWidth, startSize, maxLines) {
    for (let size = startSize; size >= 26; size -= 4) {
        const lines = wrapByApproxWidth(text, maxWidth, size);
        if (lines.length <= maxLines) return { size, lines };
    }
    const size = 26;
    const lines = wrapByApproxWidth(text, maxWidth, size).slice(0, maxLines);
    if (lines.length === maxLines) {
        const last = lines[maxLines - 1];
        if (last.length > 4) lines[maxLines - 1] = `${last.slice(0, -3)}...`;
    }
    return { size, lines };
}

function textBlockSvg({ text, centerY, maxWidth, startSize, maxLines, neon, strong = false }) {
    if (!String(text || '').trim()) return '';
    const { size, lines } = fitText(text, maxWidth, startSize, maxLines);
    if (!lines.length) return '';

    const lineHeight = Math.round(size * (strong ? 1.22 : 1.18));
    const paddingY = strong ? 26 : 20;
    const blockHeight = lines.length * lineHeight + paddingY * 2;
    const blockWidth = Math.min(960, maxWidth + (strong ? 72 : 58));
    const x = (1080 - blockWidth) / 2;
    const y = centerY - blockHeight / 2;
    const firstBaseline = centerY - ((lines.length - 1) * lineHeight) / 2 + Math.round(size * 0.34);

    const tspans = lines.map((line, index) =>
        `<text x="540" y="${firstBaseline + index * lineHeight}" text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="${size}" font-weight="700" ` +
        `fill="#ffffff" stroke="#05070e" stroke-width="${strong ? 10 : 7}" stroke-linejoin="round" paint-order="stroke fill" ` +
        `filter="url(#glow)">${escapeXml(line)}</text>`
    ).join('');

    return `
      <rect x="${x}" y="${y}" width="${blockWidth}" height="${blockHeight}" rx="${strong ? 24 : 18}"
            fill="${strong ? 'rgba(5,7,14,0.76)' : 'rgba(5,7,14,0.64)'}" stroke="${neon}" stroke-opacity="${strong ? 0.58 : 0.42}" stroke-width="${strong ? 3 : 2}"/>
      ${tspans}`;
}

function buildTextOverlay({ textoCima, textoPrincipal, textoBaixo, neon, hasAvatar }) {
    const top = textBlockSvg({ text: textoCima, centerY: 132, maxWidth: 870, startSize: 52, maxLines: 2, neon });
    const principal = textBlockSvg({ text: textoPrincipal, centerY: hasAvatar ? 720 : 570, maxWidth: 900, startSize: 78, maxLines: 4, neon, strong: true });
    const bottom = textBlockSvg({ text: textoBaixo, centerY: 948, maxWidth: 870, startSize: 42, maxLines: 2, neon });

    return Buffer.from(`
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feFlood flood-color="${neon}" flood-opacity="0.85" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="glowColor"/>
      <feMerge>
        <feMergeNode in="glowColor"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  ${top}
  ${principal}
  ${bottom}
</svg>`);
}

module.exports = { buildTextOverlay };
