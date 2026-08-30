(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_CANVAS_V7__) return;
  window.__SKYNET_PUBLIC_PROFILE_CANVAS_V7__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  // Espaço transparente maior + cantos externos mais suaves para dar
  // ao perfil salvo uma aparência de card/ícone, sem alterar o layout interno.
  const PAD = 34;
  const CORNER = 46;
  let processedPngSource = '';
  let processedPngUrl = '';
  let currentGifUrl = '';

  installFixStyles();
  installGifCapture();
  watchUi();

  function installFixStyles() {
    if (document.getElementById('publicProfileCanvasV7Styles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileCanvasV7Styles';
    style.textContent = `
      .public-profile-canvas-v6-preview{
        border-radius:${CORNER}px!important;
        background:transparent!important;
        padding:0!important;
        overflow:hidden!important;
      }
      .public-avatar-studio .cosmetic-avatar-inner,
      .public-avatar-studio .cosmetic-avatar-inner>img,
      .public-avatar-studio .cosmetic-avatar-inner>video{
        border-radius:var(--ps-avatar-radius,24%)!important;
        overflow:hidden!important;
      }
      .public-avatar-studio .cosmetic-avatar-inner>img,
      .public-avatar-studio .cosmetic-avatar-inner>video{
        width:100%!important;
        height:100%!important;
        object-fit:cover!important;
        display:block!important;
      }
    `;
    document.head.appendChild(style);
  }

  function watchUi() {
    const observer = new MutationObserver(() => queueSync());
    observer.observe(root, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['src','href','data-ready','aria-disabled']
    });
    queueSync();
  }

  function queueSync() {
    clearTimeout(queueSync.timer);
    queueSync.timer = setTimeout(syncPng, 80);
  }

  async function syncPng() {
    const ui = root.querySelector('.public-profile-canvas-v6-ui');
    const preview = ui?.querySelector('.public-profile-canvas-v6-preview');
    const save = ui?.querySelector('[data-canvas-save-png]');
    if (!ui || ui.dataset.ready !== '1' || !preview?.src || !save?.href) return;
    if (preview.dataset.canvasV7Format === 'gif') return;
    if (preview.dataset.canvasV7Processed === '1' && preview.src === processedPngUrl) return;
    if (preview.src === processedPngSource) return;

    const originalSrc = preview.src;
    processedPngSource = originalSrc;
    try {
      const blob = await fetch(originalSrc).then(response => {
        if (!response.ok) throw new Error('Falha ao ler PNG gerado.');
        return response.blob();
      });
      const image = await loadImageBlob(blob);
      const padded = document.createElement('canvas');
      padded.width = image.naturalWidth + PAD * 2;
      padded.height = image.naturalHeight + PAD * 2;
      const ctx = padded.getContext('2d', { alpha:true });
      ctx.clearRect(0, 0, padded.width, padded.height);
      ctx.save();
      roundedPath(ctx, PAD, PAD, image.naturalWidth, image.naturalHeight, CORNER);
      ctx.clip();
      ctx.drawImage(image, PAD, PAD);
      ctx.restore();

      const finalBlob = await canvasBlob(padded, 'image/png');
      if (processedPngUrl) URL.revokeObjectURL(processedPngUrl);
      processedPngUrl = URL.createObjectURL(finalBlob);

      preview.dataset.canvasV7Processed = '1';
      preview.dataset.canvasV7Format = 'png';
      preview.src = processedPngUrl;
      preview.style.setProperty('--canvas-profile-width', `${Math.max(1, Math.round((image.naturalWidth + PAD * 2) / deviceScaleGuess(image.naturalWidth)))}px`);

      save.href = processedPngUrl;
      save.download = `${safeName()}-perfil.png`;
      const open = ui.querySelector('[data-canvas-open]');
      if (open) open.href = processedPngUrl;
      setStatus('PNG pronto com borda vazia e acabamento arredondado.');
    } catch (error) {
      console.warn('Ajuste final do PNG não pôde ser aplicado:', error);
    }
  }

  function installGifCapture() {
    const nativeClick = HTMLAnchorElement.prototype.click;
    if (nativeClick.__skynetCanvasV7Wrapped) return;

    function wrappedClick(...args) {
      const filename = String(this.download || '');
      const href = String(this.href || '');
      if (/\.gif$/i.test(filename) && href.startsWith('blob:')) {
        captureGeneratedGif(href, filename).catch(error => {
          console.warn('Não foi possível carregar a prévia do GIF:', error);
        });
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
    if (!/^image\/gif$/i.test(blob.type || 'image/gif')) throw new Error('Arquivo gerado não é GIF.');
    await validateGif(blob);

    if (currentGifUrl) URL.revokeObjectURL(currentGifUrl);
    currentGifUrl = URL.createObjectURL(blob);

    const ui = root.querySelector('.public-profile-canvas-v6-ui');
    const preview = ui?.querySelector('.public-profile-canvas-v6-preview');
    if (!ui || !preview) return;

    preview.dataset.canvasV7Format = 'gif';
    preview.dataset.canvasV7Processed = '1';
    preview.src = currentGifUrl;

    const open = ui.querySelector('[data-canvas-open]');
    if (open) open.href = currentGifUrl;

    let gifSave = ui.querySelector('[data-canvas-v7-save-gif]');
    if (!gifSave) {
      gifSave = document.createElement('a');
      gifSave.dataset.canvasV7SaveGif = '1';
      gifSave.textContent = 'Baixar GIF pronto';
      gifSave.setAttribute('download', '');
      const gifButton = ui.querySelector('[data-canvas-save-gif]');
      gifButton?.insertAdjacentElement('afterend', gifSave);
    }
    gifSave.href = currentGifUrl;
    gifSave.download = filename || `${safeName()}-perfil.gif`;
    setStatus('GIF animado pronto e carregado. Você pode apertar e segurar a imagem para salvar.');
  }

  async function validateGif(blob) {
    const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const header = String.fromCharCode(...bytes.slice(0, 6));
    if (header !== 'GIF87a' && header !== 'GIF89a') throw new Error('Cabeçalho GIF inválido.');
    const image = await loadImageBlob(blob);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('O navegador não conseguiu abrir o GIF gerado.');
  }

  function loadImageBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Imagem gerada inválida.'));
      };
      image.src = url;
    });
  }

  function canvasBlob(canvas, type) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao finalizar PNG.')), type);
    });
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

  function deviceScaleGuess(width) {
    const source = root.querySelector('.public-profile-studio');
    const logical = source?.getBoundingClientRect().width || 0;
    return logical > 0 ? Math.max(1, width / logical) : 1;
  }

  window.addEventListener('pagehide', () => {
    if (processedPngUrl) URL.revokeObjectURL(processedPngUrl);
    if (currentGifUrl) URL.revokeObjectURL(currentGifUrl);
  }, { once:true });
})();
