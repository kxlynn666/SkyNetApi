(() => {
  const canvas = document.getElementById('bratCanvas');
  const input = document.getElementById('bratInput');
  const saveButton = document.getElementById('saveButton');
  const preview = document.getElementById('bratPreview');
  if (!canvas || !input || !saveButton || !preview) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const SIZE = 900;
  const TEXT_BOX = { x: 90, y: 200, width: 720, height: 500 };
  const PAD = 12;
  const SCALE_X = 0.72;
  const BLUR = 3.6;
  const MAX_FONT = 390;
  const MIN_FONT = 8;

  function normalizeText(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n').slice(0, 450);
  }

  function setFont(size) {
    ctx.font = `${size}px Arial, Helvetica, sans-serif`;
  }

  function splitLongWord(word, maxUnscaledWidth, size) {
    setFont(size);
    if (ctx.measureText(word).width <= maxUnscaledWidth) return [word];
    const chunks = [];
    let current = '';
    for (const char of [...word]) {
      const candidate = current + char;
      if (current && ctx.measureText(candidate).width > maxUnscaledWidth) {
        chunks.push(current);
        current = char;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  function wrapParagraph(paragraph, size, maxUnscaledWidth) {
    setFont(size);
    const rawWords = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!rawWords.length) return [''];
    const words = rawWords.flatMap(word => splitLongWord(word, maxUnscaledWidth, size));
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(candidate).width <= maxUnscaledWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function layoutFor(text, size) {
    const maxWidth = (TEXT_BOX.width - PAD * 2) / SCALE_X;
    const paragraphs = text.split('\n');
    const lines = [];
    for (let i = 0; i < paragraphs.length; i += 1) {
      lines.push(...wrapParagraph(paragraphs[i], size, maxWidth));
    }
    const lineHeight = size * 0.94;
    const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
    setFont(size);
    const widest = lines.reduce((max, line) => Math.max(max, ctx.measureText(line || ' ').width * SCALE_X), 0);
    return { lines, lineHeight, totalHeight, widest };
  }

  function fitText(text) {
    const usableWidth = TEXT_BOX.width - PAD * 2;
    const usableHeight = TEXT_BOX.height - PAD * 2;
    let low = MIN_FONT;
    let high = MAX_FONT;
    let best = MIN_FONT;
    let bestLayout = layoutFor(text, MIN_FONT);

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const layout = layoutFor(text, mid);
      if (layout.widest <= usableWidth && layout.totalHeight <= usableHeight) {
        best = mid;
        bestLayout = layout;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return { size: best, ...bestLayout };
  }

  function drawJustifiedLine(line, y, size) {
    const words = String(line || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;

    setFont(size);
    const visibleLeft = TEXT_BOX.x + PAD;
    const visibleWidth = TEXT_BOX.width - PAD * 2;
    const left = visibleLeft / SCALE_X;
    const width = visibleWidth / SCALE_X;

    ctx.textAlign = 'left';

    if (words.length === 1) {
      ctx.fillText(words[0], left, y);
      return;
    }

    const wordWidths = words.map(word => ctx.measureText(word).width);
    const wordsWidth = wordWidths.reduce((sum, value) => sum + value, 0);
    const gap = Math.max(0, (width - wordsWidth) / (words.length - 1));

    let x = left;
    words.forEach((word, index) => {
      ctx.fillText(word, x, y);
      x += wordWidths[index] + gap;
    });
  }

  function draw(text) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();

    const value = normalizeText(text);
    if (!value.trim()) return;

    const layout = fitText(value);
    const centerX = SIZE / 2;
    const centerY = SIZE / 2;
    const firstBaseline = centerY - layout.totalHeight / 2 + layout.lineHeight * 0.78;

    ctx.save();
    ctx.translate(centerX, 0);
    ctx.scale(SCALE_X, 1);
    ctx.translate(-centerX / SCALE_X, 0);
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'alphabetic';
    ctx.filter = `blur(${BLUR}px)`;
    setFont(layout.size);

    layout.lines.forEach((line, index) => {
      drawJustifiedLine(line, firstBaseline + index * layout.lineHeight, layout.size);
    });
    ctx.restore();
  }

  function download() {
    draw(input.value);
    const link = document.createElement('a');
    link.download = 'brat-white.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  input.addEventListener('input', () => draw(input.value));
  saveButton.addEventListener('click', download);
  preview.addEventListener('click', download);
  window.addEventListener('resize', () => draw(input.value));

  draw(input.value);
})();
