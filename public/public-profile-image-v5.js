(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_IMAGE_V5__) return;
  window.__SKYNET_PUBLIC_PROFILE_IMAGE_V5__ = true;
  window.__SKYNET_PUBLIC_PROFILE_IMAGE_V4__ = true;
  window.__SKYNET_PUBLIC_PROFILE_EXPORT_V3__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  let currentUrl = '';
  let rebuilding = false;
  let queued = false;

  installStyles();
  boot();

  function installStyles() {
    if (document.getElementById('publicProfileImageV5Styles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileImageV5Styles';
    style.textContent = `
      .public-profile-image-v5-wrap{width:min(100%,1200px);margin:28px auto 0;display:grid;gap:12px;justify-items:center}
      .public-profile-image-v5{display:block;width:min(100%,var(--profile-image-width,980px));height:auto;border:0;border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,.28);touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:default}
      .public-profile-image-v5-actions{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
      .public-profile-image-v5-actions a,.public-profile-image-v5-actions button{min-height:40px;padding:9px 14px;border:1px solid rgba(124,156,255,.3);border-radius:11px;background:#111722;color:#f4f7fb;font:700 12px system-ui,sans-serif;text-decoration:none;cursor:pointer}
      .public-profile-image-v5-hint{color:#9ca8b8;font:600 11px system-ui,sans-serif;text-align:center}
      .public-profile-image-v5-status{color:#9ca8b8;font:600 11px system-ui,sans-serif;text-align:center;min-height:16px}
      .public-profile-studio[data-profile-image-source='1']{position:absolute!important;left:-100000px!important;top:0!important;pointer-events:none!important;opacity:0!important}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    const observer = new MutationObserver(() => scheduleBuild());
    observer.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['src','class','style','data-decoration'] });
    scheduleBuild();
  }

  function scheduleBuild() {
    if (rebuilding) { queued = true; return; }
    clearTimeout(scheduleBuild.timer);
    scheduleBuild.timer = setTimeout(buildFinalImage, 260);
  }

  async function buildFinalImage() {
    const source = root.querySelector('.public-profile-studio');
    if (!source || source.dataset.profileImageSource === '1') return;
    rebuilding = true;
    try {
      await waitForStableMedia(source);
      const videos = [...source.querySelectorAll('video')];
      if (videos.length) {
        await buildAnimatedGif(source, videos);
      } else {
        await buildPng(source);
      }
    } catch (error) {
      console.error('Falha ao gerar imagem final do perfil:', error);
      showStatus(error?.message || 'Não foi possível gerar a imagem do perfil.');
    } finally {
      rebuilding = false;
      if (queued) { queued = false; scheduleBuild(); }
    }
  }

  async function buildPng(source) {
    showStatus('Convertendo perfil para PNG...');
    const frame = await makeSvgFrame(source, []);
    const canvas = await svgFrameToCanvas(frame, 2, 1800);
    const blob = await canvasBlob(canvas, 'image/png');
    renderFinal(source, blob, 'png', frame.width);
  }

  async function buildAnimatedGif(source, sourceVideos) {
    showStatus('Preparando animação para GIF...');
    const safeVideos = await prepareSafeVideos(sourceVideos);
    const usable = safeVideos.filter(Boolean);
    if (!usable.length) {
      await buildPng(source);
      showStatus('A mídia animada não pôde ser lida; foi gerado PNG.');
      return;
    }

    const frameCount = 10;
    const delay = 110;
    const frames = [];
    let logicalWidth = 980;
    try {
      for (let i = 0; i < frameCount; i += 1) {
        showStatus(`Convertendo para GIF ${i + 1}/${frameCount}...`);
        await seekSafeVideos(safeVideos, i, frameCount);
        const videoFrames = await renderSafeVideoFrames(safeVideos);
        const svgFrame = await makeSvgFrame(source, videoFrames);
        logicalWidth = svgFrame.width;
        const canvas = await svgFrameToCanvas(svgFrame, 1, 560);
        const ctx = canvas.getContext('2d', { willReadFrequently:true });
        frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
    } finally {
      cleanupSafeVideos(safeVideos);
    }

    if (!framesDiffer(frames)) {
      await buildPng(source);
      showStatus('A animação não forneceu quadros diferentes; foi gerado PNG.');
      return;
    }

    showStatus('Finalizando GIF animado...');
    const blob = encodeGif(frames, delay);
    renderFinal(source, blob, 'gif', logicalWidth);
  }

  async function makeSvgFrame(source, videoFrames) {
    const rect = source.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width || source.scrollWidth || 980));
    const height = Math.max(1, Math.ceil(source.scrollHeight || rect.height || 600));
    const clone = source.cloneNode(true);
    clone.removeAttribute('data-profile-image-source');
    clone.style.margin = '0';
    clone.style.width = `${width}px`;
    clone.style.maxWidth = 'none';
    clone.style.transform = 'none';
    clone.style.transition = 'none';

    await inlineImages(clone);
    replaceVideos(clone, videoFrames);
    sanitizeMediaAttributes(clone);

    const css = collectCss();
    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0"><style>${escapeStyle(css)}</style>${serialized}</div></foreignObject></svg>`;
    return { svg, width, height };
  }

  async function svgFrameToCanvas(frame, scale = 1, maxWidth = 1800) {
    const fit = Math.max(.3, Math.min(scale, maxWidth / frame.width));
    const width = Math.max(1, Math.round(frame.width * fit));
    const height = Math.max(1, Math.round(frame.height * fit));
    const blob = new Blob([frame.svg], { type:'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = await preload(url);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, width, height);
      ctx.getImageData(0, 0, 1, 1);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function renderFinal(source, blob, format, width) {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
    source.dataset.profileImageSource = '1';

    let wrap = root.querySelector('.public-profile-image-v5-wrap');
    if (!wrap) {
      root.querySelector('.public-profile-image-v4-wrap')?.remove();
      wrap = document.createElement('div');
      wrap.className = 'public-profile-image-v5-wrap';
      wrap.innerHTML = `
        <img class="public-profile-image-v5" alt="Perfil público em formato de imagem">
        <div class="public-profile-image-v5-actions">
          <a data-profile-image-save download>Salvar</a>
          <a data-profile-image-open target="_blank" rel="noopener">Abrir imagem</a>
          <button type="button" data-profile-image-refresh>Atualizar imagem</button>
        </div>
        <div class="public-profile-image-v5-hint">No celular, aperte e segure a imagem para salvar o arquivo.</div>
        <div class="public-profile-image-v5-status" aria-live="polite"></div>`;
      root.appendChild(wrap);
      wrap.querySelector('[data-profile-image-refresh]').addEventListener('click', () => {
        source.dataset.profileImageSource = '';
        wrap.remove();
        scheduleBuild();
      });
    }

    const img = wrap.querySelector('.public-profile-image-v5');
    img.style.setProperty('--profile-image-width', `${width}px`);
    img.src = currentUrl;

    const filename = `${safeName()}-perfil.${format}`;
    const save = wrap.querySelector('[data-profile-image-save]');
    save.href = currentUrl;
    save.download = filename;
    save.textContent = format === 'gif' ? 'Salvar GIF' : 'Salvar PNG';
    wrap.querySelector('[data-profile-image-open]').href = currentUrl;
    showStatus(format === 'gif' ? 'GIF animado pronto.' : 'PNG pronto.');
  }

  function showStatus(text) {
    const el = root.querySelector('.public-profile-image-v5-status');
    if (el) el.textContent = text || '';
  }

  async function waitForStableMedia(source) {
    try { await document.fonts?.ready; } catch {}
    const images = [...source.querySelectorAll('img')];
    await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
      const done = () => resolve();
      img.addEventListener('load', done, { once:true });
      img.addEventListener('error', done, { once:true });
      setTimeout(done, 1500);
    })));
  }

  async function inlineImages(clone) {
    const images = [...clone.querySelectorAll('img')];
    await Promise.all(images.map(async image => {
      const src = image.getAttribute('src') || '';
      if (!src || /^data:/i.test(src)) return;
      try {
        const url = new URL(src, location.href);
        const response = await fetch(url.href, {
          credentials: url.origin === location.origin ? 'same-origin' : 'omit',
          mode:'cors',
          cache:'force-cache'
        });
        if (!response.ok) throw new Error('media fetch failed');
        image.src = await blobToDataUrl(await response.blob());
      } catch {
        image.src = TRANSPARENT;
      }
      image.removeAttribute('srcset');
    }));
  }

  function replaceVideos(clone, videoFrames) {
    [...clone.querySelectorAll('video')].forEach((video, index) => {
      const image = document.createElement('img');
      image.alt = '';
      image.className = video.className;
      image.style.cssText = video.getAttribute('style') || '';
      image.src = videoFrames[index] || TRANSPARENT;
      video.replaceWith(image);
    });
  }

  async function prepareSafeVideos(sourceVideos) {
    return Promise.all(sourceVideos.map(async source => {
      const src = source.currentSrc || source.src || '';
      if (!src) return null;
      try {
        const url = new URL(src, location.href);
        const response = await fetch(url.href, {
          credentials: url.origin === location.origin ? 'same-origin' : 'omit',
          mode:'cors',
          cache:'force-cache'
        });
        if (!response.ok) return null;
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = objectUrl;
        await waitFor(video, 'loadedmetadata', 5000);
        return { video, objectUrl };
      } catch { return null; }
    }));
  }

  async function seekSafeVideos(entries, index, total) {
    await Promise.all(entries.map(async entry => {
      if (!entry) return;
      const duration = Number(entry.video.duration);
      if (!Number.isFinite(duration) || duration <= .05) return;
      const target = Math.min(duration * (index / total), Math.max(0, duration - .035));
      if (Math.abs((entry.video.currentTime || 0) - target) < .015) return;
      const done = waitFor(entry.video, 'seeked', 2500).catch(() => {});
      entry.video.currentTime = target;
      await done;
    }));
  }

  async function renderSafeVideoFrames(entries) {
    return Promise.all(entries.map(async entry => {
      if (!entry) return TRANSPARENT;
      try {
        const video = entry.video;
        const w = Math.max(2, video.videoWidth || 320);
        const h = Math.max(2, video.videoHeight || 180);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        return canvas.toDataURL('image/png');
      } catch { return TRANSPARENT; }
    }));
  }

  function cleanupSafeVideos(entries) {
    for (const entry of entries || []) if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  }

  function sanitizeMediaAttributes(clone) {
    for (const element of [clone, ...clone.querySelectorAll('*')]) {
      if (element.hasAttribute?.('srcset')) element.removeAttribute('srcset');
      if (element.hasAttribute?.('crossorigin')) element.removeAttribute('crossorigin');
      const style = element.getAttribute?.('style') || '';
      if (/url\(/i.test(style)) element.setAttribute('style', style.replace(/url\((?!["']?data:)[^)]+\)/gi, 'none'));
    }
  }

  function collectCss() {
    let css = 'html,body{margin:0!important;padding:0!important;background:transparent!important}.public-profile-studio{margin:0!important;transform:none!important;transition:none!important}.public-profile-studio:hover{transform:none!important}';
    for (const sheet of [...document.styleSheets]) {
      try {
        for (const rule of [...sheet.cssRules]) {
          let text = rule.cssText || '';
          text = text.replace(/url\((?!["']?data:)[^)]+\)/gi, 'none');
          css += `\n${text}`;
        }
      } catch {}
    }
    return css;
  }

  function framesDiffer(frames) {
    if (frames.length < 2) return false;
    const first = frames[0].data;
    for (let f = 1; f < frames.length; f++) {
      const data = frames[f].data;
      const step = Math.max(4, Math.floor(data.length / 1400 / 4) * 4);
      let diff = 0;
      for (let i = 0; i < data.length; i += step) {
        if (Math.abs(data[i]-first[i]) + Math.abs(data[i+1]-first[i+1]) + Math.abs(data[i+2]-first[i+2]) > 18 && ++diff > 10) return true;
      }
    }
    return false;
  }

  function encodeGif(frames, delayMs) {
    const width = frames[0].width;
    const height = frames[0].height;
    const out = [];
    const push = (...v) => out.push(...v.map(n => n & 255));
    const word = n => push(n, n >> 8);
    const text = s => { for (const c of s) push(c.charCodeAt(0)); };
    text('GIF89a'); word(width); word(height); push(0xF7,0,0);
    for (let i=0;i<256;i++) push(Math.round(((i>>5)&7)*255/7),Math.round(((i>>2)&7)*255/7),Math.round((i&3)*255/3));
    push(0x21,0xFF,0x0B); text('NETSCAPE2.0'); push(0x03,0x01,0,0,0);
    const delay = Math.max(2, Math.round(delayMs/10));
    for (const frame of frames) {
      push(0x21,0xF9,0x04,0x04); word(delay); push(0,0);
      push(0x2C); word(0); word(0); word(width); word(height); push(0);
      push(8);
      const indexed = quantize(frame.data);
      const compressed = lzwGif(indexed);
      for (let i=0;i<compressed.length;i+=255) {
        const chunk = compressed.slice(i,i+255);
        push(chunk.length, ...chunk);
      }
      push(0);
    }
    push(0x3B);
    return new Blob([new Uint8Array(out)], { type:'image/gif' });
  }

  function quantize(rgba) {
    const indexed = new Uint8Array(rgba.length / 4);
    for (let p=0,i=0;p<rgba.length;p+=4,i++) {
      const r = rgba[p] >> 5;
      const g = rgba[p+1] >> 5;
      const b = rgba[p+2] >> 6;
      indexed[i] = (r << 5) | (g << 2) | b;
    }
    return indexed;
  }

  function lzwGif(indexed) {
    const minCodeSize = 8;
    const clear = 1 << minCodeSize;
    const end = clear + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = end + 1;
    let dict = new Map();
    const bytes = [];
    let bitBuffer = 0;
    let bitCount = 0;

    function write(code) {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        bytes.push(bitBuffer & 255);
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    }
    function reset() {
      dict = new Map();
      codeSize = minCodeSize + 1;
      nextCode = end + 1;
    }

    write(clear);
    if (!indexed.length) { write(end); return bytes; }
    let prefix = indexed[0];
    for (let i=1;i<indexed.length;i++) {
      const k = indexed[i];
      const key = prefix + ',' + k;
      if (dict.has(key)) {
        prefix = dict.get(key);
      } else {
        write(prefix);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
        } else {
          write(clear);
          reset();
        }
        prefix = k;
      }
    }
    write(prefix);
    write(end);
    if (bitCount > 0) bytes.push(bitBuffer & 255);
    return bytes;
  }

  function canvasBlob(canvas, type) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao converter imagem.')), type));
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || TRANSPARENT));
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler mídia'));
      reader.readAsDataURL(blob);
    });
  }

  function preload(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('O navegador não conseguiu converter a imagem do perfil.'));
      image.src = src;
    });
  }

  function waitFor(target, event, timeout) {
    return new Promise((resolve, reject) => {
      let timer;
      const done = () => { clearTimeout(timer); resolve(); };
      target.addEventListener(event, done, { once:true });
      timer = setTimeout(() => reject(new Error(`Timeout em ${event}`)), timeout);
    });
  }

  function escapeStyle(value) {
    return String(value || '').replace(/<\/style/gi, '<\\/style');
  }

  function safeName() {
    const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || 'skynet');
    return String(username || 'skynet').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'skynet';
  }

  window.addEventListener('pagehide', () => {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = '';
  }, { once:true });
})();
