(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_CANVAS_V6__) return;
  window.__SKYNET_PUBLIC_PROFILE_CANVAS_V6__ = true;
  window.__SKYNET_PUBLIC_PROFILE_IMAGE_V5__ = true;
  window.__SKYNET_PUBLIC_PROFILE_IMAGE_V4__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  let source = null;
  let ui = null;
  let previewUrl = '';
  let pngBlob = null;
  let rendering = false;
  let rerenderQueued = false;
  const imageCache = new Map();

  installStyles();
  boot();

  function installStyles() {
    if (document.getElementById('publicProfileCanvasV6Styles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileCanvasV6Styles';
    style.textContent = `
      .public-profile-canvas-v6-ui{width:min(100%,1200px);margin:18px auto 0;display:grid;gap:12px;justify-items:center}
      .public-profile-canvas-v6-preview{display:none;width:min(100%,var(--canvas-profile-width,980px));height:auto;border:0;border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,.28);-webkit-touch-callout:default;touch-action:manipulation}
      .public-profile-canvas-v6-ui[data-ready="1"] .public-profile-canvas-v6-preview{display:block}
      .public-profile-canvas-v6-actions{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
      .public-profile-canvas-v6-actions button,.public-profile-canvas-v6-actions a{min-height:40px;padding:9px 14px;border:1px solid rgba(124,156,255,.3);border-radius:11px;background:#111722;color:#f4f7fb;font:700 12px system-ui,sans-serif;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
      .public-profile-canvas-v6-actions button:disabled,.public-profile-canvas-v6-actions a[aria-disabled="true"]{opacity:.5;pointer-events:none;cursor:wait}
      .public-profile-canvas-v6-status{min-height:18px;color:#9ca8b8;font:600 11px system-ui,sans-serif;text-align:center}
      .public-profile-canvas-v6-loader{width:22px;height:22px;border:2px solid rgba(124,156,255,.25);border-top-color:#7c9cff;border-radius:999px;animation:profileCanvasSpin .8s linear infinite}
      .public-profile-canvas-v6-ui[data-ready="1"] .public-profile-canvas-v6-loader{display:none}
      .public-profile-canvas-v6-hint{color:#9ca8b8;font:600 11px system-ui,sans-serif;text-align:center;display:none}
      .public-profile-canvas-v6-ui[data-ready="1"] .public-profile-canvas-v6-hint{display:block}
      .public-profile-studio[data-canvas-source="1"]{position:absolute!important;left:-100000px!important;top:0!important;opacity:0!important;pointer-events:none!important}
      @keyframes profileCanvasSpin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    let tries = 0;
    const find = () => {
      source = root.querySelector('.public-profile-studio');
      if (source) {
        ensureUi();
        watchSource();
        setStatus('Preparando imagem do perfil...');
        setTimeout(() => renderPreview(), 450);
        return;
      }
      if (tries++ < 100) setTimeout(find, tries < 25 ? 80 : 180);
    };
    find();
  }

  function ensureUi() {
    ui = root.querySelector('.public-profile-canvas-v6-ui');
    if (ui) return ui;
    root.querySelector('.public-profile-image-v5-wrap')?.remove();
    root.querySelector('.public-profile-image-v4-wrap')?.remove();
    ui = document.createElement('div');
    ui.className = 'public-profile-canvas-v6-ui';
    ui.innerHTML = `
      <div class="public-profile-canvas-v6-loader" aria-hidden="true"></div>
      <div class="public-profile-canvas-v6-status" aria-live="polite">Preparando imagem do perfil...</div>
      <img class="public-profile-canvas-v6-preview" alt="Perfil público renderizado em imagem">
      <div class="public-profile-canvas-v6-actions">
        <a data-canvas-save-png aria-disabled="true" download>Salvar PNG</a>
        <button type="button" data-canvas-save-gif disabled style="display:none">Salvar GIF</button>
        <a data-canvas-open aria-disabled="true" target="_blank" rel="noopener">Abrir imagem</a>
        <button type="button" data-canvas-refresh>Atualizar imagem</button>
      </div>
      <div class="public-profile-canvas-v6-hint">No celular, você também pode apertar e segurar a imagem para salvar.</div>`;
    root.appendChild(ui);
    ui.querySelector('[data-canvas-refresh]').addEventListener('click', renderPreview);
    ui.querySelector('[data-canvas-save-gif]').addEventListener('click', saveGif);
    return ui;
  }

  function watchSource() {
    const observer = new MutationObserver(() => queueRender());
    observer.observe(source, { childList:true, subtree:true, attributes:true, attributeFilter:['src','poster','class','style','data-decoration'] });
  }

  function queueRender() {
    clearTimeout(queueRender.timer);
    queueRender.timer = setTimeout(() => renderPreview(), 320);
  }

  async function renderPreview() {
    if (!source || !source.isConnected) return;
    if (rendering) { rerenderQueued = true; return; }
    rendering = true;
    ensureUi();
    ui.dataset.ready = '0';
    setControlsBusy(true);
    setStatus('Gerando imagem idêntica ao perfil...');
    source.dataset.canvasSource = '';

    try {
      await waitForStableContent();
      const canvas = await renderDomToCanvas(source, { maxWidth:1800, scale:Math.min(2, Math.max(1.25, window.devicePixelRatio || 1.5)) });
      pngBlob = await canvasBlob(canvas, 'image/png');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(pngBlob);

      const preview = ui.querySelector('.public-profile-canvas-v6-preview');
      preview.src = previewUrl;
      preview.style.setProperty('--canvas-profile-width', `${Math.round(canvas.width / canvas.__renderScale)}px`);
      await waitImage(preview);

      const save = ui.querySelector('[data-canvas-save-png]');
      save.href = previewUrl;
      save.download = `${safeName()}-perfil.png`;
      save.setAttribute('aria-disabled', 'false');
      const open = ui.querySelector('[data-canvas-open]');
      open.href = previewUrl;
      open.setAttribute('aria-disabled', 'false');

      const hasVideo = Boolean(source.querySelector('video'));
      const gif = ui.querySelector('[data-canvas-save-gif]');
      gif.style.display = hasVideo ? 'inline-flex' : 'none';
      gif.disabled = !hasVideo;

      source.dataset.canvasSource = '1';
      ui.dataset.ready = '1';
      setStatus(hasVideo ? 'PNG pronto. Este perfil também pode ser salvo como GIF animado.' : 'PNG pronto.');
    } catch (error) {
      console.error('Falha no Canvas do perfil público:', error);
      source.dataset.canvasSource = '';
      setStatus(error?.message || 'Não foi possível gerar a imagem do perfil.');
    } finally {
      rendering = false;
      setControlsBusy(false);
      if (rerenderQueued) {
        rerenderQueued = false;
        queueRender();
      }
    }
  }

  async function saveGif() {
    const button = ui?.querySelector('[data-canvas-save-gif]');
    const videos = source ? [...source.querySelectorAll('video')] : [];
    if (!button || !videos.length || rendering) return;
    button.disabled = true;
    const png = ui.querySelector('[data-canvas-save-png]');
    png.setAttribute('aria-disabled', 'true');
    setStatus('Preparando GIF animado...');
    source.dataset.canvasSource = '';

    const originalTimes = videos.map(video => Number(video.currentTime || 0));
    const frames = [];
    const frameCount = 10;
    const delay = 110;
    try {
      for (let index = 0; index < frameCount; index += 1) {
        setStatus(`Capturando GIF ${index + 1}/${frameCount}...`);
        await Promise.all(videos.map(video => seekVideoFraction(video, index, frameCount)));
        const canvas = await renderDomToCanvas(source, { maxWidth:560, scale:1 });
        frames.push(canvas.getContext('2d', { willReadFrequently:true }).getImageData(0, 0, canvas.width, canvas.height));
      }
      if (!framesDiffer(frames)) throw new Error('A mídia animada não forneceu quadros diferentes.');
      setStatus('Montando GIF animado...');
      const blob = encodeGif(frames, delay);
      downloadBlob(blob, `${safeName()}-perfil.gif`);
      setStatus('GIF animado salvo.');
    } catch (error) {
      console.error('Falha ao gerar GIF do perfil:', error);
      setStatus(error?.message || 'Não foi possível gerar o GIF.');
    } finally {
      await Promise.all(videos.map((video, index) => seekVideo(video, originalTimes[index]).catch(() => {})));
      source.dataset.canvasSource = '1';
      button.disabled = false;
      png.setAttribute('aria-disabled', 'false');
    }
  }

  async function renderDomToCanvas(element, { maxWidth = 1800, scale = 1.5 } = {}) {
    const rootRect = element.getBoundingClientRect();
    const logicalWidth = Math.max(1, Math.ceil(rootRect.width));
    const logicalHeight = Math.max(1, Math.ceil(element.scrollHeight || rootRect.height));
    const fitScale = Math.max(.35, Math.min(scale, maxWidth / logicalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(logicalWidth * fitScale));
    canvas.height = Math.max(1, Math.round(logicalHeight * fitScale));
    canvas.__renderScale = fitScale;
    const ctx = canvas.getContext('2d', { alpha:true });
    ctx.setTransform(fitScale, 0, 0, fitScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    await paintElement(element, ctx, rootRect);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.getImageData(0, 0, 1, 1);
    return canvas;
  }

  async function paintElement(element, ctx, rootRect) {
    if (!(element instanceof Element)) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const local = relativeRect(rect, rootRect);

    ctx.save();
    ctx.globalAlpha *= clamp(Number(style.opacity), 0, 1, 1);
    applyFilterShadow(ctx, style.boxShadow);
    paintBox(ctx, local, style);
    ctx.restore();

    await paintPseudo(element, '::before', ctx, rootRect);

    if (element instanceof HTMLImageElement || element instanceof HTMLVideoElement) {
      await paintMediaElement(element, ctx, local, style);
    } else {
      await paintCssBackgroundImage(element, ctx, local, style);
    }

    paintDirectText(element, ctx, rootRect, style);

    for (const child of element.children) {
      await paintElement(child, ctx, rootRect);
    }

    await paintPseudo(element, '::after', ctx, rootRect);
  }

  function paintBox(ctx, rect, style) {
    const radius = parseRadius(style.borderRadius, rect.width, rect.height);
    const bg = style.backgroundColor;
    const gradient = parseLinearGradient(style.backgroundImage, rect);
    roundedPath(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    if (gradient) {
      ctx.fillStyle = gradient;
      ctx.fill();
    } else if (isVisibleColor(bg)) {
      ctx.fillStyle = bg;
      ctx.fill();
    }

    const borderWidth = Math.max(
      px(style.borderTopWidth), px(style.borderRightWidth), px(style.borderBottomWidth), px(style.borderLeftWidth)
    );
    if (borderWidth > 0 && style.borderTopStyle !== 'none' && isVisibleColor(style.borderTopColor)) {
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = style.borderTopColor;
      roundedPath(ctx, rect.x + borderWidth / 2, rect.y + borderWidth / 2, Math.max(0, rect.width - borderWidth), Math.max(0, rect.height - borderWidth), Math.max(0, radius - borderWidth / 2));
      ctx.stroke();
    }
  }

  async function paintCssBackgroundImage(element, ctx, rect, style) {
    const src = extractCssUrl(style.backgroundImage);
    if (!src) return;
    const image = await loadSafeImage(src);
    if (!image) return;
    ctx.save();
    roundedPath(ctx, rect.x, rect.y, rect.width, rect.height, parseRadius(style.borderRadius, rect.width, rect.height));
    ctx.clip();
    drawObjectFit(ctx, image, rect, style.backgroundSize === 'contain' ? 'contain' : 'cover', style.backgroundPosition);
    ctx.restore();
  }

  async function paintMediaElement(element, ctx, rect, style) {
    let drawable = null;
    if (element instanceof HTMLVideoElement) {
      if (element.readyState >= 2 && element.videoWidth && element.videoHeight && isSafeUrl(element.currentSrc || element.src)) drawable = element;
    } else {
      const src = element.currentSrc || element.src;
      if (element.complete && element.naturalWidth && isSafeUrl(src)) drawable = element;
      else drawable = await loadSafeImage(src);
    }
    if (!drawable) return;

    ctx.save();
    roundedPath(ctx, rect.x, rect.y, rect.width, rect.height, parseRadius(style.borderRadius, rect.width, rect.height));
    ctx.clip();
    drawObjectFit(ctx, drawable, rect, style.objectFit || 'fill', style.objectPosition || '50% 50%');
    ctx.restore();
  }

  async function paintPseudo(element, pseudo, ctx, rootRect) {
    const style = getComputedStyle(element, pseudo);
    const content = String(style.content || 'none');
    const hasPaint = isVisibleColor(style.backgroundColor) || style.backgroundImage !== 'none' || px(style.borderTopWidth) > 0 || (content !== 'none' && content !== 'normal');
    if (!hasPaint || style.display === 'none' || style.visibility === 'hidden') return;
    const base = element.getBoundingClientRect();
    const rect = pseudoRect(base, style, rootRect);
    if (!rect.width || !rect.height) return;

    ctx.save();
    ctx.globalAlpha *= clamp(Number(style.opacity), 0, 1, 1);
    applyFilterShadow(ctx, style.boxShadow);
    paintBox(ctx, rect, style);
    const src = extractCssUrl(style.backgroundImage);
    if (src) {
      const image = await loadSafeImage(src);
      if (image) drawObjectFit(ctx, image, rect, style.backgroundSize === 'contain' ? 'contain' : 'cover', style.backgroundPosition);
    }
    if (content && content !== 'none' && content !== 'normal' && content !== '""' && content !== "''") {
      paintText(ctx, stripCssContent(content), rect.x, rect.y, rect, style);
    }
    ctx.restore();
  }

  function paintDirectText(element, ctx, rootRect, style) {
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue?.trim()) continue;
      const text = node.nodeValue;
      const matches = [...text.matchAll(/\S+/g)];
      for (const match of matches) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const local = relativeRect(rect, rootRect);
        paintText(ctx, applyTextTransform(match[0], style.textTransform), local.x, local.y, local, style);
      }
    }
  }

  function paintText(ctx, text, x, y, rect, style) {
    if (!text || !isVisibleColor(style.color)) return;
    ctx.save();
    ctx.fillStyle = style.color;
    ctx.font = `${style.fontStyle || 'normal'} ${style.fontWeight || '400'} ${style.fontSize || '14px'} ${style.fontFamily || 'sans-serif'}`;
    ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText(text);
    const descent = Number(metrics.actualBoundingBoxDescent || px(style.fontSize) * .18);
    const baseline = y + rect.height - Math.max(1, descent);
    applyTextShadow(ctx, style.textShadow);
    ctx.fillText(text, x, baseline);
    ctx.restore();
  }

  function drawObjectFit(ctx, sourceDrawable, rect, fit, position) {
    const sw = sourceDrawable.videoWidth || sourceDrawable.naturalWidth || sourceDrawable.width;
    const sh = sourceDrawable.videoHeight || sourceDrawable.naturalHeight || sourceDrawable.height;
    if (!sw || !sh) return;
    if (fit !== 'cover' && fit !== 'contain') {
      ctx.drawImage(sourceDrawable, rect.x, rect.y, rect.width, rect.height);
      return;
    }
    const ratio = fit === 'cover' ? Math.max(rect.width / sw, rect.height / sh) : Math.min(rect.width / sw, rect.height / sh);
    const dw = sw * ratio;
    const dh = sh * ratio;
    const [pxPos, pyPos] = objectPosition(position);
    const dx = rect.x + (rect.width - dw) * pxPos;
    const dy = rect.y + (rect.height - dh) * pyPos;
    ctx.drawImage(sourceDrawable, dx, dy, dw, dh);
  }

  async function loadSafeImage(src) {
    if (!src) return null;
    const absolute = absoluteUrl(src);
    if (!absolute) return null;
    if (imageCache.has(absolute)) return imageCache.get(absolute);
    const promise = new Promise(resolve => {
      const image = new Image();
      if (!isSafeUrl(absolute)) image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = absolute;
    });
    imageCache.set(absolute, promise);
    return promise;
  }

  async function waitForStableContent() {
    try { await document.fonts?.ready; } catch {}
    const images = [...source.querySelectorAll('img')];
    await Promise.all(images.map(img => img.complete ? Promise.resolve() : waitEither(img, ['load','error'], 1800)));
    const videos = [...source.querySelectorAll('video')];
    await Promise.all(videos.map(video => video.readyState >= 2 ? Promise.resolve() : waitEither(video, ['loadeddata','canplay','error'], 2500)));
  }

  function parseLinearGradient(value, rect) {
    const text = String(value || '');
    const match = text.match(/linear-gradient\(\s*([\d.]+)deg\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)\s*(?:\d+%?)?\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)[^)]*\)/i);
    if (!match) return null;
    const angle = Number(match[1] || 180) * Math.PI / 180;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const length = Math.abs(rect.width * Math.sin(angle)) + Math.abs(rect.height * Math.cos(angle));
    const dx = Math.sin(angle) * length / 2;
    const dy = -Math.cos(angle) * length / 2;
    const gradient = document.createElement('canvas').getContext('2d').createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    gradient.addColorStop(0, match[2]);
    gradient.addColorStop(1, match[3]);
    return gradient;
  }

  function pseudoRect(base, style, rootRect) {
    const left = cssOffset(style.left, base.width);
    const right = cssOffset(style.right, base.width);
    const top = cssOffset(style.top, base.height);
    const bottom = cssOffset(style.bottom, base.height);
    let width = cssSize(style.width, base.width);
    let height = cssSize(style.height, base.height);
    if (width == null && left != null && right != null) width = base.width - left - right;
    if (height == null && top != null && bottom != null) height = base.height - top - bottom;
    width = width ?? base.width;
    height = height ?? base.height;
    const x = base.left + (left ?? (right != null ? base.width - right - width : 0));
    const y = base.top + (top ?? (bottom != null ? base.height - bottom - height : 0));
    return { x:x-rootRect.left, y:y-rootRect.top, width:Math.max(0,width), height:Math.max(0,height) };
  }

  function roundedPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius || 0, width / 2, height / 2));
    ctx.beginPath();
    if (!r) { ctx.rect(x, y, width, height); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function parseRadius(value, width, height) {
    const first = String(value || '0').split(/[\s/]/)[0];
    if (first.endsWith('%')) return Math.min(width, height) * Number.parseFloat(first) / 100;
    return px(first);
  }

  function applyFilterShadow(ctx, value) {
    const match = String(value || '').match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
    const nums = String(value || '').match(/-?[\d.]+px/g)?.map(px) || [];
    if (!match || nums.length < 3) return;
    ctx.shadowColor = match[0];
    ctx.shadowOffsetX = nums[0] || 0;
    ctx.shadowOffsetY = nums[1] || 0;
    ctx.shadowBlur = Math.max(0, nums[2] || 0);
  }

  function applyTextShadow(ctx, value) {
    if (!value || value === 'none') return;
    applyFilterShadow(ctx, value);
  }

  function objectPosition(value) {
    const text = String(value || '50% 50%').toLowerCase();
    const words = text.split(/\s+/);
    return [positionPart(words[0], true), positionPart(words[1] || '50%', false)];
  }

  function positionPart(value, horizontal) {
    if (value === 'left' || value === 'top') return 0;
    if (value === 'right' || value === 'bottom') return 1;
    if (value === 'center') return .5;
    if (String(value).endsWith('%')) return clamp(Number.parseFloat(value) / 100, 0, 1, .5);
    return .5;
  }

  function relativeRect(rect, rootRect) {
    return { x:rect.left-rootRect.left, y:rect.top-rootRect.top, width:rect.width, height:rect.height };
  }

  function extractCssUrl(value) {
    const match = String(value || '').match(/url\(["']?([^"')]+)["']?\)/i);
    return match ? match[1] : '';
  }

  function absoluteUrl(value) {
    try { return new URL(String(value || ''), location.href).href; }
    catch { return ''; }
  }

  function isSafeUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      return url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === location.origin;
    } catch { return false; }
  }

  function isVisibleColor(value) {
    const text = String(value || '').trim().toLowerCase();
    return Boolean(text && text !== 'transparent' && text !== 'rgba(0, 0, 0, 0)' && text !== 'rgb(0 0 0 / 0)');
  }

  function stripCssContent(value) {
    return String(value || '').replace(/^['"]|['"]$/g, '').replace(/\\A/gi, '\n');
  }

  function applyTextTransform(value, transform) {
    if (transform === 'uppercase') return value.toUpperCase();
    if (transform === 'lowercase') return value.toLowerCase();
    if (transform === 'capitalize') return value.replace(/\b\w/g, c => c.toUpperCase());
    return value;
  }

  function cssOffset(value, base) {
    const text = String(value || 'auto');
    if (text === 'auto') return null;
    if (text.endsWith('%')) return base * Number.parseFloat(text) / 100;
    const n = Number.parseFloat(text);
    return Number.isFinite(n) ? n : null;
  }

  function cssSize(value, base) {
    const text = String(value || 'auto');
    if (text === 'auto' || text === 'none') return null;
    if (text.endsWith('%')) return base * Number.parseFloat(text) / 100;
    const n = Number.parseFloat(text);
    return Number.isFinite(n) ? n : null;
  }

  function px(value) {
    const n = Number.parseFloat(String(value || '0'));
    return Number.isFinite(n) ? n : 0;
  }

  function clamp(value, min, max, fallback) {
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function setStatus(text) {
    const status = ui?.querySelector('.public-profile-canvas-v6-status');
    if (status) status.textContent = text || '';
  }

  function setControlsBusy(busy) {
    if (!ui) return;
    ui.querySelector('[data-canvas-refresh]').disabled = busy;
    if (busy) {
      ui.querySelector('[data-canvas-save-png]').setAttribute('aria-disabled', 'true');
      ui.querySelector('[data-canvas-save-gif]').disabled = true;
    }
  }

  function canvasBlob(canvas, type) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao converter o canvas para imagem.')), type));
  }

  function waitImage(image) {
    if (image.complete && image.naturalWidth) return Promise.resolve();
    return waitEither(image, ['load','error'], 3000);
  }

  function waitEither(target, events, timeout) {
    return new Promise(resolve => {
      let done = false;
      let timer;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        for (const event of events) target.removeEventListener(event, finish);
        resolve();
      };
      for (const event of events) target.addEventListener(event, finish, { once:true });
      timer = setTimeout(finish, timeout);
    });
  }

  async function seekVideoFraction(video, index, total) {
    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= .05) return;
    const target = Math.min(duration * (index / total), Math.max(0, duration - .035));
    return seekVideo(video, target);
  }

  async function seekVideo(video, target) {
    if (!Number.isFinite(target) || Math.abs(Number(video.currentTime || 0) - target) < .015) return;
    const done = waitEither(video, ['seeked','error'], 2200);
    video.currentTime = target;
    await done;
  }

  function framesDiffer(frames) {
    if (frames.length < 2) return false;
    const first = frames[0].data;
    for (let f = 1; f < frames.length; f++) {
      const data = frames[f].data;
      const step = Math.max(4, Math.floor(data.length / 1600 / 4) * 4);
      let diff = 0;
      for (let i = 0; i < data.length; i += step) {
        if (Math.abs(data[i]-first[i]) + Math.abs(data[i+1]-first[i+1]) + Math.abs(data[i+2]-first[i+2]) > 18 && ++diff > 12) return true;
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
      const compressed = lzwGif(quantize(frame.data));
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
    for (let p=0,i=0;p<rgba.length;p+=4,i++) indexed[i] = ((rgba[p]>>5)<<5) | ((rgba[p+1]>>5)<<2) | (rgba[p+2]>>6);
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
      while (bitCount >= 8) { bytes.push(bitBuffer & 255); bitBuffer >>= 8; bitCount -= 8; }
    }
    function reset() { dict = new Map(); codeSize = minCodeSize + 1; nextCode = end + 1; }
    write(clear);
    if (!indexed.length) { write(end); return bytes; }
    let prefix = indexed[0];
    for (let i=1;i<indexed.length;i++) {
      const k = indexed[i];
      const key = prefix + ',' + k;
      if (dict.has(key)) prefix = dict.get(key);
      else {
        write(prefix);
        if (nextCode < 4096) {
          dict.set(key, nextCode++);
          if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
        } else { write(clear); reset(); }
        prefix = k;
      }
    }
    write(prefix); write(end);
    if (bitCount > 0) bytes.push(bitBuffer & 255);
    return bytes;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1800);
  }

  function safeName() {
    const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || 'skynet');
    return String(username || 'skynet').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'skynet';
  }

  window.addEventListener('pagehide', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }, { once:true });
})();
