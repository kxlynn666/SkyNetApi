(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_CANVAS_V7__) return;
  window.__SKYNET_PUBLIC_PROFILE_CANVAS_V7__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  // Estas medidas existem SOMENTE no arquivo baixado.
  const PAD_CSS = 44;
  const CORNER_CSS = 64;
  let finalPngUrl = '';
  let finalPngSource = '';
  let currentGifUrl = '';
  let preparingPng = null;

  installAvatarFix();
  installDownloadGuard();
  watchUi();

  function installAvatarFix() {
    if (document.getElementById('publicProfileCanvasV7Styles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileCanvasV7Styles';
    style.textContent = `
      .public-avatar-studio .cosmetic-avatar-inner,
      .public-avatar-studio .cosmetic-avatar-inner>img,
      .public-avatar-studio .cosmetic-avatar-inner>video{
        border-radius:var(--ps-avatar-radius,24%)!important;
        overflow:hidden!important;
      }
      .public-avatar-studio .cosmetic-avatar-inner>img,
      .public-avatar-studio .cosmetic-avatar-inner>video{
        width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;
      }
    `;
    document.head.appendChild(style);
  }

  function installDownloadGuard() {
    root.addEventListener('click', async event => {
      const save = event.target.closest?.('[data-canvas-save-png]');
      if (!save) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        setStatus('Finalizando PNG com espaço transparente...');
        const url = await ensureFinalPng(true);
        if (!url) throw new Error('PNG final não disponível.');
        forceDownload(url, `${safeName()}-perfil.png`);
        setStatus('PNG salvo com margem transparente e cantos arredondados.');
      } catch (error) {
        console.error('Falha ao finalizar PNG:', error);
        setStatus(error?.message || 'Não foi possível finalizar o PNG.');
      }
    }, true);
  }

  function watchUi() {
    const observer = new MutationObserver(() => queuePrepare());
    observer.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['src','data-ready'] });
    queuePrepare();
  }

  function queuePrepare() {
    clearTimeout(queuePrepare.timer);
    queuePrepare.timer = setTimeout(() => ensureFinalPng(false).catch(() => {}), 180);
  }

  async function ensureFinalPng(force = false) {
    const ui = root.querySelector('.public-profile-canvas-v6-ui');
    const preview = ui?.querySelector('.public-profile-canvas-v6-preview');
    if (!ui || ui.dataset.ready !== '1' || !preview?.src) return '';
    if (preview.dataset.canvasV7Format === 'gif') return finalPngUrl;

    await ensureImageReady(preview);
    if (!preview.naturalWidth || !preview.naturalHeight) throw new Error('A imagem do perfil ainda não terminou de carregar.');

    const sourceKey = `${preview.src}|${preview.naturalWidth}x${preview.naturalHeight}`;
    if (!force && finalPngUrl && finalPngSource === sourceKey) return finalPngUrl;
    if (preparingPng) return preparingPng;

    preparingPng = (async () => {
      // Nada de fetch(blob:). O próprio <img> já carregado é usado como fonte.
      // Isso evita o "Failed to fetch" em navegadores móveis.
      const visibleWidth = preview.getBoundingClientRect().width || root.querySelector('.public-profile-studio')?.getBoundingClientRect().width || preview.naturalWidth;
      const scale = Math.max(1, preview.naturalWidth / Math.max(1, visibleWidth));
      const pad = Math.max(32, Math.round(PAD_CSS * scale));
      const corner = Math.max(48, Math.round(CORNER_CSS * scale));

      const canvas = document.createElement('canvas');
      canvas.width = preview.naturalWidth + pad * 2;
      canvas.height = preview.naturalHeight + pad * 2;
      const ctx = canvas.getContext('2d', { alpha:true });
      if (!ctx) throw new Error('Canvas indisponível.');

      // Todo o canvas permanece transparente; apenas o card é desenhado no centro.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      roundedPath(ctx, pad, pad, preview.naturalWidth, preview.naturalHeight, corner);
      ctx.clip();
      ctx.drawImage(preview, pad, pad, preview.naturalWidth, preview.naturalHeight);
      ctx.restore();

      // Garante que a margem e os quatro cantos realmente são transparentes.
      const probe = ctx.getImageData(0, 0, 1, 1).data;
      if (probe[3] !== 0) throw new Error('A margem transparente não foi criada corretamente.');

      const blob = await canvasBlob(canvas, 'image/png');
      if (finalPngUrl) URL.revokeObjectURL(finalPngUrl);
      finalPngUrl = URL.createObjectURL(blob);
      finalPngSource = sourceKey;

      const open = ui.querySelector('[data-canvas-open]');
      if (open && preview.dataset.canvasV7Format !== 'gif') open.href = finalPngUrl;
      return finalPngUrl;
    })().finally(() => { preparingPng = null; });

    return preparingPng;
  }

  function ensureImageReady(image) {
    if (image.complete && image.naturalWidth) {
      return typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('Imagem base não carregou.')); };
      const cleanup = () => {
        image.removeEventListener('load', done);
        image.removeEventListener('error', fail);
      };
      image.addEventListener('load', done, { once:true });
      image.addEventListener('error', fail, { once:true });
    });
  }

  function forceDownload(url, filename) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    HTMLAnchorElement.prototype.click.call(anchor);
    anchor.remove();
  }

  function canvasBlob(canvas, type) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao converter PNG.')), type));
  }

  function roundedPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function setStatus(text) {
    const status = root.querySelector('.public-profile-canvas-v6-status');
    if (status) status.textContent = text;
  }

  function safeName() {
    const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || 'skynet');
    return String(username || 'skynet').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'skynet';
  }

  window.addEventListener('pagehide', () => {
    if (finalPngUrl) URL.revokeObjectURL(finalPngUrl);
    if (currentGifUrl) URL.revokeObjectURL(currentGifUrl);
  }, { once:true });
})();
