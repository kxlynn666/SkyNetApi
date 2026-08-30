(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_EXPORT_V3__) return;
  window.__SKYNET_PUBLIC_PROFILE_EXPORT_V3__ = true;
  window.__SKYNET_PUBLIC_PROFILE_EXPORT_V2__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const imageCache = new Map();

  installStyles();
  boot();

  function installStyles() {
    if (document.getElementById('publicProfileExportV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileExportV3Styles';
    style.textContent = `
      .public-profile-export-v1{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin:14px auto 0}
      .public-profile-export-v1 button{min-height:38px;padding:8px 13px;border:1px solid rgba(124,156,255,.28);border-radius:11px;background:rgba(17,23,34,.86);color:#f4f7fb;font:700 12px system-ui,sans-serif;cursor:pointer}
      .public-profile-export-v1 button:disabled{opacity:.58;cursor:wait}
      .public-profile-export-v1 .gif{display:none}.public-profile-export-v1[data-animated="1"] .gif{display:inline-flex}
      .public-profile-export-status-v1{width:100%;text-align:center;color:#9ca8b8;font:600 11px system-ui,sans-serif;min-height:16px}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    let tries = 0;
    const run = () => {
      if (ensureControls()) return;
      if (tries++ < 80) setTimeout(run, tries < 20 ? 80 : 180);
    };
    run();
    new MutationObserver(ensureControls).observe(root, { childList:true, subtree:true });
  }

  function ensureControls() {
    const profile = root.querySelector('.public-profile-studio');
    if (!profile) return false;
    let controls = document.getElementById('publicProfileExportV1');
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'publicProfileExportV1';
      controls.className = 'public-profile-export-v1';
      controls.innerHTML = '<button type="button" data-export-profile="png">Salvar PNG</button><button class="gif" type="button" data-export-profile="gif">Salvar GIF</button><div class="public-profile-export-status-v1" aria-live="polite"></div>';
      root.appendChild(controls);
      controls.addEventListener('click', onExportClick);
    }
    controls.dataset.animated = root.querySelector('.public-profile-studio video') ? '1' : '0';
    return true;
  }

  async function onExportClick(event) {
    const button = event.target.closest?.('[data-export-profile]');
    if (!button) return;
    const controls = button.closest('.public-profile-export-v1');
    const status = controls.querySelector('.public-profile-export-status-v1');
    const buttons = [...controls.querySelectorAll('button')];
    buttons.forEach(b => b.disabled = true);
    try {
      if (button.dataset.exportProfile === 'gif') {
        status.textContent = 'Preparando mídia animada...';
        const blob = await exportGif(status);
        downloadBlob(blob, `${safeName()}-perfil.gif`);
        status.textContent = 'GIF animado salvo.';
      } else {
        status.textContent = 'Preparando PNG seguro...';
        const videos = [...root.querySelectorAll('.public-profile-studio video')];
        const safeVideos = await prepareSafeVideos(videos);
        const frames = await currentVideoFrames(safeVideos, videos);
        const canvas = await captureProfileCanvas({ maxWidth:1800, scale:Math.min(2, window.devicePixelRatio || 1.5), videoFrames:frames });
        assertOriginClean(canvas);
        const blob = await canvasBlob(canvas, 'image/png');
        downloadBlob(blob, `${safeName()}-perfil.png`);
        cleanupSafeVideos(safeVideos);
        status.textContent = 'PNG salvo.';
      }
    } catch (error) {
      console.error('Falha ao exportar perfil:', error);
      status.textContent = error?.message || 'Não foi possível salvar o perfil.';
    } finally {
      buttons.forEach(b => b.disabled = false);
    }
  }

  function safeName() {
    const username = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || 'skynet');
    return String(username || 'skynet').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'skynet';
  }

  async function exportGif(status) {
    const sourceVideos = [...root.querySelectorAll('.public-profile-studio video')];
    if (!sourceVideos.length) throw new Error('Este perfil não possui mídia animada ativa.');
    const safeVideos = await prepareSafeVideos(sourceVideos);
    const usable = safeVideos.filter(Boolean);
    if (!usable.length) throw new Error('A mídia animada externa bloqueou CORS e não pode ser exportada com segurança.');

    const frames = [];
    const frameCount = 8;
    const delay = 120;
    try {
      for (let i = 0; i < frameCount; i += 1) {
        status.textContent = `Capturando animação ${i + 1}/${frameCount}...`;
        await seekSafeVideos(safeVideos, i, frameCount);
        const videoFrames = await renderSafeVideoFrames(safeVideos);
        const canvas = await captureProfileCanvas({ maxWidth:480, scale:1, videoFrames });
        assertOriginClean(canvas);
        frames.push(canvas.getContext('2d', { willReadFrequently:true }).getImageData(0, 0, canvas.width, canvas.height));
      }
    } finally {
      cleanupSafeVideos(safeVideos);
    }
    if (!framesDiffer(frames)) throw new Error('Os quadros capturados ficaram idênticos; a animação não pôde ser lida.');
    status.textContent = 'Montando GIF animado...';
    return encodeGif(frames, delay);
  }

  async function prepareSafeVideos(sourceVideos) {
    return Promise.all(sourceVideos.map(async source => {
      const src = source.currentSrc || source.src || '';
      if (!src) return null;
      try {
        const url = new URL(src, location.href);
        const response = await fetch(url.href, {
          credentials: url.origin === location.origin ? 'same-origin' : 'omit',
          mode: 'cors'
        });
        if (!response.ok) return null;
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = objectUrl;
        await waitFor(video, 'loadedmetadata', 4000);
        return { video, objectUrl };
      } catch { return null; }
    }));
  }

  function cleanupSafeVideos(entries) {
    for (const entry of entries || []) if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  }

  async function currentVideoFrames(entries, sourceVideos) {
    await Promise.all(entries.map(async (entry, index) => {
      if (!entry) return;
      const duration = Number(entry.video.duration);
      const wanted = Number(sourceVideos[index]?.currentTime || 0);
      if (Number.isFinite(duration) && duration > 0) await seekVideo(entry.video, Math.min(wanted, Math.max(0, duration - 0.03)));
    }));
    return renderSafeVideoFrames(entries);
  }

  async function seekSafeVideos(entries, index, total) {
    await Promise.all(entries.map(async entry => {
      if (!entry) return;
      const duration = Number(entry.video.duration);
      if (!Number.isFinite(duration) || duration <= 0.05) return;
      const target = Math.min(duration * (index / total), Math.max(0, duration - 0.03));
      await seekVideo(entry.video, target);
    }));
  }

  async function seekVideo(video, target) {
    if (Math.abs((video.currentTime || 0) - target) < 0.015) return;
    const done = waitFor(video, 'seeked', 2500).catch(() => {});
    video.currentTime = target;
    await done;
  }

  async function renderSafeVideoFrames(entries) {
    return Promise.all(entries.map(async entry => {
      if (!entry) return TRANSPARENT;
      const video = entry.video;
      try {
        const w = Math.max(2, video.videoWidth || 320);
        const h = Math.max(2, video.videoHeight || 180);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        return canvas.toDataURL('image/png');
      } catch { return TRANSPARENT; }
    }));
  }

  async function captureProfileCanvas({ maxWidth = 1800, scale = 2, videoFrames = [] } = {}) {
    const source = root.querySelector('.public-profile-studio');
    if (!source) throw new Error('Perfil ainda não terminou de carregar.');
    try { await document.fonts?.ready; } catch {}

    const rect = source.getBoundingClientRect();
    const logicalWidth = Math.max(1, Math.ceil(rect.width));
    const logicalHeight = Math.max(1, Math.ceil(source.scrollHeight || rect.height));
    const fitScale = Math.max(.35, Math.min(scale, maxWidth / logicalWidth));
    const width = Math.max(1, Math.round(logicalWidth * fitScale));
    const height = Math.max(1, Math.round(logicalHeight * fitScale));

    const clone = source.cloneNode(true);
    inlineSafeComputedStyles(source, clone);
    replaceCloneVideos(clone, videoFrames);
    await inlineImagesSafely(clone);
    sanitizeCloneUrls(clone);

    clone.style.margin = '0';
    clone.style.width = `${logicalWidth}px`;
    clone.style.maxWidth = 'none';
    clone.style.transform = 'none';
    clone.style.transition = 'none';
    clone.style.boxSizing = 'border-box';

    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${logicalWidth}" height="${logicalHeight}" viewBox="0 0 ${logicalWidth} ${logicalHeight}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;width:${logicalWidth}px;height:${logicalHeight}px">${serialized}</div></foreignObject></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type:'image/svg+xml;charset=utf-8' }));
    try {
      const image = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, width, height);
      return canvas;
    } finally { URL.revokeObjectURL(url); }
  }

  function inlineSafeComputedStyles(source, clone) {
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((node, index) => {
      const copy = copies[index];
      if (!(copy instanceof Element)) return;
      const computed = getComputedStyle(node);
      let css = '';
      for (const property of computed) {
        let value = computed.getPropertyValue(property);
        if (!value) continue;
        if (/url\(/i.test(value) && !/url\(["']?(data:|blob:)/i.test(value)) value = 'none';
        if (property === 'cursor') value = 'auto';
        css += `${property}:${value};`;
      }
      copy.setAttribute('style', css);
    });
  }

  function replaceCloneVideos(clone, videoFrames) {
    [...clone.querySelectorAll('video')].forEach((video, index) => {
      const img = document.createElement('img');
      img.src = videoFrames[index] || TRANSPARENT;
      img.alt = '';
      img.className = video.className;
      img.style.cssText = video.getAttribute('style') || '';
      video.replaceWith(img);
    });
  }

  async function inlineImagesSafely(clone) {
    await Promise.all([...clone.querySelectorAll('img')].map(async image => {
      const src = image.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return;
      const cached = imageCache.get(src);
      if (cached !== undefined) { image.src = cached || TRANSPARENT; return; }
      try {
        const url = new URL(src, location.href);
        const response = await fetch(url.href, {
          credentials: url.origin === location.origin ? 'same-origin' : 'omit',
          mode:'cors'
        });
        if (!response.ok) throw new Error('image fetch failed');
        const data = await blobToDataUrl(await response.blob());
        imageCache.set(src, data);
        image.src = data;
      } catch {
        imageCache.set(src, '');
        image.src = TRANSPARENT;
      }
    }));
  }

  function sanitizeCloneUrls(clone) {
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      const style = el.getAttribute?.('style');
      if (style && /url\(/i.test(style) && !/url\(["']?(data:|blob:)/i.test(style)) {
        el.style.backgroundImage = 'none';
        el.style.maskImage = 'none';
        el.style.webkitMaskImage = 'none';
      }
      if (el instanceof HTMLImageElement && !/^data:/i.test(el.src || '')) el.src = TRANSPARENT;
    }
  }

  function assertOriginClean(canvas) {
    try { canvas.getContext('2d').getImageData(0, 0, 1, 1); }
    catch { throw new Error('A captura ainda contém mídia externa incompatível. Recarregue a página e tente novamente.'); }
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
    const width = frames[0].width, height = frames[0].height;
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
      push(0x2C); word(0);word(0);word(width);word(height);push(0);
      const indexed = quantize332(frame.data);
      const compressed = lzwEncode(indexed,8);
      push(8);
      for (let off=0;off<compressed.length;off+=255) {
        const block=compressed.subarray(off,off+255); push(block.length); for (const b of block) push(b);
      }
      push(0);
    }
    push(0x3B);
    return new Blob([Uint8Array.from(out)], { type:'image/gif' });
  }

  function quantize332(rgba) {
    const out = new Uint8Array(rgba.length/4);
    for (let p=0,i=0;p<rgba.length;p+=4,i++) out[i]=((rgba[p]>>5)<<5)|((rgba[p+1]>>5)<<2)|(rgba[p+2]>>6);
    return out;
  }

  function lzwEncode(indices,minCodeSize) {
    const clear=1<<minCodeSize,end=clear+1;
    let size=minCodeSize+1,next=end+1,dict=new Map(),bits=0,count=0;
    const bytes=[];
    const write=code=>{ bits|=code<<count; count+=size; while(count>=8){bytes.push(bits&255);bits>>>=8;count-=8;} };
    const reset=()=>{size=minCodeSize+1;next=end+1;dict=new Map();};
    write(clear);
    let prefix=indices[0]??0;
    for(let i=1;i<indices.length;i++){
      const value=indices[i],key=`${prefix},${value}`,found=dict.get(key);
      if(found!==undefined){prefix=found;continue;}
      write(prefix);
      if(next<4096){dict.set(key,next++);if(next===(1<<size)&&size<12)size++;}
      else{write(clear);reset();}
      prefix=value;
    }
    write(prefix);write(end);if(count)bytes.push(bits&255);
    return Uint8Array.from(bytes);
  }

  function waitFor(target,event,timeout) {
    return new Promise((resolve,reject)=>{
      let timer=0;
      const done=()=>{clearTimeout(timer);resolve();};
      target.addEventListener(event,done,{once:true});
      timer=setTimeout(()=>reject(new Error(`Timeout em ${event}`)),timeout);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('Falha ao ler mídia.'));
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(src) {
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error('O navegador não conseguiu renderizar o perfil.'));
      img.src=src;
    });
  }

  function canvasBlob(canvas,type) {
    return new Promise((resolve,reject)=>{
      try { canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Falha ao gerar arquivo.')),type); }
      catch { reject(new Error('A mídia externa impediu a exportação.')); }
    });
  }

  function downloadBlob(blob,filename) {
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1800);
  }
})();
