(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_EXPORT_V2__) return;
  window.__SKYNET_PUBLIC_PROFILE_EXPORT_V2__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const hasAnimatedMedia = () => !!root.querySelector('video');

  function installStyles() {
    if (document.getElementById('publicProfileExportV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileExportV2Styles';
    style.textContent = `
      .public-profile-export-v1{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin:14px auto 0}
      .public-profile-export-v1 button{min-height:38px;padding:8px 13px;border:1px solid rgba(124,156,255,.28);border-radius:11px;background:rgba(17,23,34,.86);color:#f4f7fb;font:700 12px system-ui,sans-serif;cursor:pointer;box-shadow:0 9px 28px rgba(0,0,0,.16)}
      .public-profile-export-v1 button:hover{border-color:rgba(124,156,255,.55);transform:translateY(-1px)}
      .public-profile-export-v1 button:disabled{opacity:.58;cursor:wait;transform:none}
      .public-profile-export-v1 .gif{display:none}
      .public-profile-export-v1[data-animated="1"] .gif{display:inline-flex}
      .public-profile-export-status-v1{width:100%;text-align:center;color:#9ca8b8;font:600 11px system-ui,sans-serif;min-height:16px}
    `;
    document.head.appendChild(style);
  }

  function ensureControls() {
    const profile = root.querySelector('.public-profile-studio');
    if (!profile) return false;
    let controls = document.getElementById('publicProfileExportV1');
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'publicProfileExportV1';
      controls.className = 'public-profile-export-v1';
      controls.innerHTML = `<button type="button" data-export-profile="png">Salvar PNG</button><button class="gif" type="button" data-export-profile="gif">Salvar GIF</button><div class="public-profile-export-status-v1" aria-live="polite"></div>`;
      root.appendChild(controls);
      controls.addEventListener('click', onExportClick);
    }
    controls.dataset.animated = hasAnimatedMedia() ? '1' : '0';
    return true;
  }

  async function onExportClick(event) {
    const button = event.target.closest?.('[data-export-profile]');
    if (!button) return;
    const format = button.dataset.exportProfile;
    const controls = button.closest('.public-profile-export-v1');
    const status = controls.querySelector('.public-profile-export-status-v1');
    const buttons = [...controls.querySelectorAll('button')];
    buttons.forEach(item => { item.disabled = true; });
    try {
      if (format === 'gif') {
        status.textContent = 'Preparando GIF animado...';
        const blob = await exportGif(status);
        if (!blob || blob.size < 1000) throw new Error('Falha ao montar o GIF animado.');
        downloadBlob(blob, `${safeName()}-perfil.gif`);
        status.textContent = 'GIF animado salvo.';
      } else {
        status.textContent = 'Preparando PNG...';
        const canvas = await captureProfileCanvas({ maxWidth: 1800, scale: Math.min(2, window.devicePixelRatio || 1.5) });
        const blob = await canvasBlob(canvas, 'image/png');
        downloadBlob(blob, `${safeName()}-perfil.png`);
        status.textContent = 'PNG salvo.';
      }
    } catch (error) {
      console.error('Falha ao exportar perfil:', error);
      status.textContent = error?.message || 'Não foi possível salvar o perfil.';
    } finally {
      buttons.forEach(item => { item.disabled = false; });
      setTimeout(() => {
        if (/salvo\.$/.test(status.textContent)) status.textContent = '';
      }, 3200);
    }
  }

  function safeName() {
    const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || 'skynet');
    return String(username || 'skynet').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'skynet';
  }

  async function exportGif(status) {
    const videos = [...root.querySelectorAll('.public-profile-studio video')];
    if (!videos.length) throw new Error('Este perfil não possui mídia animada ativa.');

    const states = videos.map(video => ({
      video,
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      paused: video.paused
    }));

    const frames = [];
    const frameCount = 10;
    const delay = 110;

    try {
      videos.forEach(video => video.pause());
      for (let index = 0; index < frameCount; index += 1) {
        status.textContent = `Capturando animação ${index + 1}/${frameCount}...`;
        await seekVideosForFrame(videos, index, frameCount);
        await nextPaint();
        const canvas = await captureProfileCanvas({ maxWidth: 560, scale: 1 });
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
    } finally {
      for (const state of states) {
        try {
          if (Number.isFinite(state.video.duration) && state.video.duration > 0) {
            state.video.currentTime = Math.min(state.currentTime, Math.max(0, state.video.duration - 0.02));
          }
          if (!state.paused) state.video.play().catch(() => {});
        } catch {}
      }
    }

    if (!framesDiffer(frames)) throw new Error('A mídia não forneceu quadros diferentes para o GIF.');
    status.textContent = 'Montando GIF animado...';
    return encodeGif(frames, delay);
  }

  async function seekVideosForFrame(videos, index, total) {
    await Promise.all(videos.map(async video => {
      if (video.readyState < 2) await waitFor(video, 'loadeddata', 1800).catch(() => {});
      const duration = Number(video.duration);
      if (!Number.isFinite(duration) || duration <= 0.05) {
        if (typeof video.requestVideoFrameCallback === 'function') {
          await new Promise(resolve => video.requestVideoFrameCallback(() => resolve()));
        }
        return;
      }
      const target = Math.min(Math.max(0, duration * (index / total)), Math.max(0, duration - 0.035));
      if (Math.abs(video.currentTime - target) < 0.018) return;
      const promise = waitFor(video, 'seeked', 1800).catch(() => {});
      video.currentTime = target;
      await promise;
    }));
  }

  function waitFor(target, event, timeout) {
    return new Promise((resolve, reject) => {
      let timer = 0;
      const done = () => { clearTimeout(timer); target.removeEventListener(event, done); resolve(); };
      target.addEventListener(event, done, { once: true });
      timer = setTimeout(() => { target.removeEventListener(event, done); reject(new Error(`Timeout em ${event}`)); }, timeout);
    });
  }

  function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function framesDiffer(frames) {
    if (frames.length < 2) return false;
    const first = frames[0].data;
    for (let f = 1; f < frames.length; f += 1) {
      const data = frames[f].data;
      const step = Math.max(4, Math.floor(data.length / 1200 / 4) * 4);
      let diff = 0;
      for (let i = 0; i < data.length; i += step) {
        if (Math.abs(data[i] - first[i]) + Math.abs(data[i + 1] - first[i + 1]) + Math.abs(data[i + 2] - first[i + 2]) > 12) {
          if (++diff > 8) return true;
        }
      }
    }
    return false;
  }

  async function captureProfileCanvas({ maxWidth = 1800, scale = 2 } = {}) {
    const source = root.querySelector('.public-profile-studio');
    if (!source) throw new Error('Perfil ainda não terminou de carregar.');
    try { await document.fonts?.ready; } catch {}

    const rect = source.getBoundingClientRect();
    const logicalWidth = Math.max(1, Math.ceil(rect.width));
    const logicalHeight = Math.max(1, Math.ceil(source.scrollHeight || rect.height));
    const fitScale = Math.max(0.35, Math.min(scale, maxWidth / logicalWidth));
    const width = Math.max(1, Math.round(logicalWidth * fitScale));
    const height = Math.max(1, Math.round(logicalHeight * fitScale));

    const clone = source.cloneNode(true);
    inlineComputedStyles(source, clone);
    copyFormAndCanvasState(source, clone);
    await replaceVideosWithFrames(source, clone);
    await inlineImages(clone);

    clone.style.margin = '0';
    clone.style.width = `${logicalWidth}px`;
    clone.style.maxWidth = 'none';
    clone.style.transform = 'none';
    clone.style.transition = 'none';
    clone.style.boxSizing = 'border-box';

    const css = collectRelevantCss();
    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${logicalWidth}" height="${logicalHeight}" viewBox="0 0 ${logicalWidth} ${logicalHeight}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;width:${logicalWidth}px;height:${logicalHeight}px"><style>${escapeStyle(css)}</style>${serialized}</div></foreignObject></svg>`;
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const image = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, width, height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function inlineComputedStyles(source, clone) {
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((node, index) => {
      const copy = copies[index];
      if (!(copy instanceof Element)) return;
      const computed = getComputedStyle(node);
      let css = '';
      for (const property of computed) {
        const value = computed.getPropertyValue(property);
        if (!value) continue;
        css += `${property}:${value};`;
      }
      copy.setAttribute('style', `${css}${copy.getAttribute('style') || ''}`);
    });
  }

  function collectRelevantCss() {
    let css = '.public-profile-studio:hover{transform:none!important}.public-profile-studio *{animation-play-state:paused!important;transition:none!important}';
    for (const sheet of [...document.styleSheets]) {
      try {
        for (const rule of [...sheet.cssRules]) {
          const text = rule.cssText || '';
          if (/public-|profile-|cosmetic-|data-decoration|@keyframes/i.test(text)) css += `\n${text}`;
        }
      } catch {}
    }
    return css;
  }

  function escapeStyle(css) {
    return String(css || '').replace(/<\/style/gi, '<\\/style');
  }

  function copyFormAndCanvasState(source, clone) {
    const originals = source.querySelectorAll('input,textarea,select,canvas');
    const copies = clone.querySelectorAll('input,textarea,select,canvas');
    originals.forEach((node, index) => {
      const copy = copies[index];
      if (!copy) return;
      if (node instanceof HTMLInputElement) {
        copy.setAttribute('value', node.value);
        if (node.checked) copy.setAttribute('checked', 'checked');
        else copy.removeAttribute('checked');
      } else if (node instanceof HTMLTextAreaElement) {
        copy.textContent = node.value;
      } else if (node instanceof HTMLSelectElement) {
        [...copy.options].forEach((option, i) => { option.selected = node.options[i]?.selected || false; });
      } else if (node instanceof HTMLCanvasElement) {
        const img = document.createElement('img');
        try { img.src = node.toDataURL('image/png'); copy.replaceWith(img); } catch {}
      }
    });
  }

  async function replaceVideosWithFrames(source, clone) {
    const originals = [...source.querySelectorAll('video')];
    const copies = [...clone.querySelectorAll('video')];
    originals.forEach((video, index) => {
      const copy = copies[index];
      if (!copy) return;
      const image = document.createElement('img');
      image.alt = '';
      image.className = copy.className;
      image.style.cssText = copy.getAttribute('style') || '';
      image.style.width = `${Math.max(1, video.clientWidth || video.videoWidth || 320)}px`;
      image.style.height = `${Math.max(1, video.clientHeight || video.videoHeight || 180)}px`;
      image.style.objectFit = getComputedStyle(video).objectFit || 'cover';
      image.style.objectPosition = getComputedStyle(video).objectPosition || '50% 50%';
      try {
        const canvas = document.createElement('canvas');
        const width = Math.max(2, video.videoWidth || video.clientWidth || 320);
        const height = Math.max(2, video.videoHeight || video.clientHeight || 180);
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(video, 0, 0, width, height);
        image.src = canvas.toDataURL('image/png');
      } catch {
        image.src = video.poster || '';
      }
      copy.replaceWith(image);
    });
  }

  async function inlineImages(clone) {
    const images = [...clone.querySelectorAll('img')];
    await Promise.all(images.map(async image => {
      const src = image.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return;
      try {
        const url = new URL(src, location.href);
        const response = await fetch(url.href, { credentials: url.origin === location.origin ? 'same-origin' : 'omit', mode: 'cors' });
        if (!response.ok) return;
        image.src = await blobToDataUrl(await response.blob());
      } catch {}
    }));
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler imagem.'));
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('O navegador não conseguiu renderizar o perfil para imagem.'));
      image.src = src;
    });
  }

  function canvasBlob(canvas, type) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.')), type));
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function encodeGif(frames, delayMs) {
    if (!frames.length) throw new Error('Nenhum quadro capturado.');
    const width = frames[0].width;
    const height = frames[0].height;
    if (frames.some(frame => frame.width !== width || frame.height !== height)) throw new Error('Quadros do GIF com tamanhos diferentes.');

    const out = [];
    const push = (...values) => out.push(...values.map(value => value & 255));
    const word = value => push(value & 255, (value >> 8) & 255);
    const text = value => { for (const char of value) push(char.charCodeAt(0)); };

    text('GIF89a');
    word(width); word(height);
    push(0xF7, 0x00, 0x00);
    for (let index = 0; index < 256; index += 1) {
      push(
        Math.round(((index >> 5) & 7) * 255 / 7),
        Math.round(((index >> 2) & 7) * 255 / 7),
        Math.round((index & 3) * 255 / 3)
      );
    }

    push(0x21, 0xFF, 0x0B); text('NETSCAPE2.0'); push(0x03, 0x01, 0x00, 0x00, 0x00);
    const delay = Math.max(2, Math.round(delayMs / 10));

    for (const frame of frames) {
      push(0x21, 0xF9, 0x04, 0x00); word(delay); push(0x00, 0x00);
      push(0x2C); word(0); word(0); word(width); word(height); push(0x00);
      const indexed = quantize332(frame.data);
      const compressed = lzwLiteralEncode(indexed, 8);
      push(8);
      for (let offset = 0; offset < compressed.length; offset += 255) {
        const block = compressed.subarray(offset, offset + 255);
        push(block.length);
        for (const byte of block) push(byte);
      }
      push(0x00);
    }

    push(0x3B);
    return new Blob([Uint8Array.from(out)], { type: 'image/gif' });
  }

  function quantize332(rgba) {
    const indexed = new Uint8Array(rgba.length / 4);
    for (let p = 0, i = 0; p < rgba.length; p += 4, i += 1) {
      const a = rgba[p + 3] / 255;
      const r = Math.round(rgba[p] * a);
      const g = Math.round(rgba[p + 1] * a);
      const b = Math.round(rgba[p + 2] * a);
      indexed[i] = ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
    }
    return indexed;
  }

  // GIF LZW intentionally resets before the code width can grow beyond 9 bits.
  // This produces larger files than an aggressive dictionary encoder, but it is
  // simple, deterministic and broadly compatible with browsers/gallery apps.
  function lzwLiteralEncode(indices, minCodeSize) {
    const clear = 1 << minCodeSize;
    const end = clear + 1;
    const codeSize = minCodeSize + 1;
    const bytes = [];
    let bitBuffer = 0;
    let bitCount = 0;

    const write = code => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        bytes.push(bitBuffer & 255);
        bitBuffer >>>= 8;
        bitCount -= 8;
      }
    };

    let offset = 0;
    while (offset < indices.length) {
      write(clear);
      const endOffset = Math.min(indices.length, offset + 200);
      for (; offset < endOffset; offset += 1) write(indices[offset]);
    }
    write(end);
    if (bitCount) bytes.push(bitBuffer & 255);
    return Uint8Array.from(bytes);
  }

  installStyles();
  let attempts = 0;
  const observer = new MutationObserver(() => ensureControls());
  observer.observe(root, { childList: true, subtree: true });
  const boot = () => {
    if (ensureControls()) return;
    if (attempts++ < 80) setTimeout(boot, attempts < 20 ? 80 : 180);
  };
  boot();
})();
