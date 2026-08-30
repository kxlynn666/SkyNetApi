(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_CANVAS_V7__) return;
  window.__SKYNET_PUBLIC_PROFILE_CANVAS_V7__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  const PAD_CSS = 34;
  const CORNER_CSS = 52;
  let finalPngUrl = '';
  let finalPngSource = '';
  let currentGifUrl = '';
  let preparingPng = null;

  installAvatarFix();
  installDownloadGuard();
  installGifCapture();
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
      try {
        setStatus('Finalizando PNG com margem transparente...');
        const url = await ensureFinalPng();
        if (!url) throw new Error('PNG final não disponível.');
        forceDownload(url, `${safeName()}-perfil.png`);
        setStatus('PNG salvo com espaço transparente e cantos arredondados.');
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
    queuePrepare.timer = setTimeout(() => ensureFinalPng().catch(() => {}), 120);
  }

  async function ensureFinalPng() {
    const ui = root.querySelector('.public-profile-canvas-v6-ui');
    const preview = ui?.querySelector('.public-profile-canvas-v6-preview');
    if (!ui || ui.dataset.ready !== '1' || !preview?.src) return '';
    if (preview.dataset.canvasV7Format === 'gif') return finalPngUrl;

    const sourceUrl = preview.src;
    if (finalPngUrl && finalPngSource === sourceUrl) return finalPngUrl;
    if (preparingPng) return preparingPng;

    preparingPng = (async () => {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error('Falha ao ler PNG base.');
      const image = await loadImageBlob(await response.blob());

      const logicalWidth = root.querySelector('.public-profile-studio')?.getBoundingClientRect().width || image.naturalWidth;
      const scale = Math.max(1, image.naturalWidth / Math.max(1, logicalWidth));
      const pad = Math.max(24, Math.round(PAD_CSS * scale));
      const corner = Math.max(40, Math.round(CORNER_CSS * scale));

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth + pad * 2;
      canvas.height = image.naturalHeight + pad * 2;
      const ctx = canvas.getContext('2d', { alpha:true });

      // O canvas começa totalmente transparente. Nada é pintado na margem.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      roundedPath(ctx, pad, pad, image.naturalWidth, image.naturalHeight, corner);
      ctx.clip();
      ctx.drawImage(image, pad, pad, image.naturalWidth, image.naturalHeight);
      ctx.restore();

      const blob = await canvasBlob(canvas, 'image/png');
      if (finalPngUrl) URL.revokeObjectURL(finalPngUrl);
      finalPngUrl = URL.createObjectURL(blob);
      finalPngSource = sourceUrl;

      // O preview visual continua usando o PNG original sem margem.
      const open = ui.querySelector('[data-canvas-open]');
      if (open && preview.dataset.canvasV7Format !== 'gif') open.href = finalPngUrl;
      return finalPngUrl;
    })().finally(() => { preparingPng = null; });

    return preparingPng;
  }

  function installGifCapture() {
    const nativeClick = HTMLAnchorElement.prototype.click;
    if (nativeClick.__skynetCanvasV7Wrapped) return;
    function wrappedClick(...args) {
      const filename = String(this.download || '');
      const href = String(this.href || '');
      if (/\.gif$/i.test(filename) && href.startsWith('blob:')) {
        captureGeneratedGif(href, filename).catch(error => console.warn('Não foi possível carregar a prévia do GIF:', error));
      }
      return nativeClick.apply(this, args);
    }
    wrappedClick.__skynetCanvasV7Wrapped = true;
    HTMLAnchorElement.prototype.click = wrappedClick;
  }

  async function captureGeneratedGif(blobUrl, filename) {
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error('GIF gerado não pôde ser lido.');
    const blob = await response.blob();
    await validateGif(blob);
    if (currentGifUrl) URL.revokeObjectURL(currentGifUrl);
    currentGifUrl = URL.createObjectURL(blob);
    const ui = root.querySelector('.public-profile-canvas-v6-ui');
    const preview = ui?.querySelector('.public-profile-canvas-v6-preview');
    if (!ui || !preview) return;
    preview.dataset.canvasV7Format = 'gif';
    preview.src = currentGifUrl;
    const open = ui.querySelector('[data-canvas-open]');
    if (open) open.href = currentGifUrl;
    let gifSave = ui.querySelector('[data-canvas-v7-save-gif]');
    if (!gifSave) {
      gifSave = document.createElement('a');
      gifSave.dataset.canvasV7SaveGif = '1';
      gifSave.textContent = 'Baixar GIF pronto';
      ui.querySelector('[data-canvas-save-gif]')?.insertAdjacentElement('afterend', gifSave);
    }
    gifSave.href = currentGifUrl;
    gifSave.download = filename || `${safeName()}-perfil.gif`;
    setStatus('GIF animado pronto e carregado.');
  }

  async function validateGif(blob) {
    const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const header = String.fromCharCode(...bytes.slice(0, 6));
    if (header !== 'GIF87a' && header !== 'GIF89a') throw new Error('Cabeçalho GIF inválido.');
    const image = await loadImageBlob(blob);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('GIF inválido.');
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

  function loadImageBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem base inválida.')); };
      image.src = url;
    });
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
