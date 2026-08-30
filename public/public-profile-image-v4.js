(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_IMAGE_V4__) return;
  window.__SKYNET_PUBLIC_PROFILE_IMAGE_V4__ = true;
  window.__SKYNET_PUBLIC_PROFILE_EXPORT_V3__ = true;
  window.__SKYNET_PUBLIC_PROFILE_EXPORT_V2__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  let currentUrl = '';
  let currentBlob = null;
  let rebuilding = false;
  let queued = false;

  installStyles();
  boot();

  function installStyles() {
    if (document.getElementById('publicProfileImageV4Styles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileImageV4Styles';
    style.textContent = `
      .public-profile-image-v4-wrap{width:min(100%,1200px);margin:28px auto 0;display:grid;gap:12px;justify-items:center}
      .public-profile-image-v4{display:block;width:min(100%,var(--profile-image-width,980px));height:auto;border:0;border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,.28);touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:default}
      .public-profile-image-v4-actions{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
      .public-profile-image-v4-actions a,.public-profile-image-v4-actions button{min-height:40px;padding:9px 14px;border:1px solid rgba(124,156,255,.3);border-radius:11px;background:#111722;color:#f4f7fb;font:700 12px system-ui,sans-serif;text-decoration:none;cursor:pointer}
      .public-profile-image-v4-hint{color:#9ca8b8;font:600 11px system-ui,sans-serif;text-align:center}
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
    scheduleBuild.timer = setTimeout(buildImage, 220);
  }

  async function buildImage() {
    const source = root.querySelector('.public-profile-studio');
    if (!source || source.dataset.profileImageSource === '1') return;
    rebuilding = true;
    try {
      await waitForStableMedia(source);
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
      replaceVideos(clone);
      sanitizeMediaAttributes(clone);

      const css = collectCss();
      const serialized = new XMLSerializer().serializeToString(clone);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0"><style>${escapeStyle(css)}</style>${serialized}</div></foreignObject></svg>`;
      const blob = new Blob([svg], { type:'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      await preload(url);

      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = url;
      currentBlob = blob;
      renderImage(source, url, width);
    } catch (error) {
      console.error('Falha ao gerar imagem do perfil:', error);
    } finally {
      rebuilding = false;
      if (queued) { queued = false; scheduleBuild(); }
    }
  }

  function renderImage(source, url, width) {
    source.dataset.profileImageSource = '1';
    let wrap = root.querySelector('.public-profile-image-v4-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'public-profile-image-v4-wrap';
      wrap.innerHTML = `
        <img class="public-profile-image-v4" alt="Perfil público em formato de imagem">
        <div class="public-profile-image-v4-actions">
          <a data-profile-image-save download>Salvar imagem</a>
          <a data-profile-image-open target="_blank" rel="noopener">Abrir imagem</a>
          <button type="button" data-profile-image-refresh>Atualizar imagem</button>
        </div>
        <div class="public-profile-image-v4-hint">No celular, você também pode apertar e segurar a imagem para salvar.</div>`;
      root.appendChild(wrap);
      wrap.querySelector('[data-profile-image-refresh]').addEventListener('click', () => {
        source.dataset.profileImageSource = '';
        wrap.remove();
        scheduleBuild();
      });
    }
    const img = wrap.querySelector('.public-profile-image-v4');
    img.style.setProperty('--profile-image-width', `${width}px`);
    img.src = url;
    const filename = `${safeName()}-perfil.svg`;
    const save = wrap.querySelector('[data-profile-image-save]');
    save.href = url;
    save.download = filename;
    wrap.querySelector('[data-profile-image-open]').href = url;
  }

  async function waitForStableMedia(source) {
    try { await document.fonts?.ready; } catch {}
    const images = [...source.querySelectorAll('img')];
    await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
      const done = () => resolve();
      img.addEventListener('load', done, { once:true });
      img.addEventListener('error', done, { once:true });
      setTimeout(done, 1200);
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
          mode: 'cors',
          cache: 'force-cache'
        });
        if (!response.ok) throw new Error('media fetch failed');
        image.src = await blobToDataUrl(await response.blob());
      } catch {
        image.src = TRANSPARENT;
      }
      image.removeAttribute('srcset');
    }));
  }

  function replaceVideos(clone) {
    [...clone.querySelectorAll('video')].forEach(video => {
      const image = document.createElement('img');
      image.alt = '';
      image.className = video.className;
      image.style.cssText = video.getAttribute('style') || '';
      const poster = video.getAttribute('poster') || '';
      image.src = /^data:/i.test(poster) ? poster : TRANSPARENT;
      video.replaceWith(image);
    });
  }

  function sanitizeMediaAttributes(clone) {
    for (const element of [clone, ...clone.querySelectorAll('*')]) {
      if (element.hasAttribute?.('srcset')) element.removeAttribute('srcset');
      if (element.hasAttribute?.('crossorigin')) element.removeAttribute('crossorigin');
      const style = element.getAttribute?.('style') || '';
      if (/url\(/i.test(style)) {
        element.setAttribute('style', style.replace(/url\((?!["']?data:)[^)]+\)/gi, 'none'));
      }
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

  function escapeStyle(value) {
    return String(value || '').replace(/<\/style/gi, '<\\/style');
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
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('O navegador não conseguiu abrir a imagem gerada.'));
      image.src = src;
    });
  }

  function safeName() {
    const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || 'skynet');
    return String(username || 'skynet').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'skynet';
  }

  window.addEventListener('pagehide', () => {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = '';
    currentBlob = null;
  }, { once:true });
})();
