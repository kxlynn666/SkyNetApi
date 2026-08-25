(() => {
  if (window.__SKYNET_UPSCALE_PANEL_V1__) return;
  window.__SKYNET_UPSCALE_PANEL_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/upscale') return;

  const S = window.SkyNet;
  if (!S) return;

  let sourceFile = null;
  let sourceUrl = '';
  let resultUrl = '';
  let scale = 4;
  let format = 'webp';
  let sourceWidth = 0;
  let sourceHeight = 0;

  function installStyles() {
    if (document.getElementById('upscalePanelV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'upscalePanelV1Styles';
    style.textContent = `
      .upscale-v1{display:grid;gap:12px;max-width:1180px;margin:0 auto}
      .upscale-hero-v1{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:26px;padding:24px;border:1px solid #28282d;background:#08080a;position:relative;overflow:hidden;isolation:isolate}
      .upscale-hero-v1::after{content:'';position:absolute;inset:-80% -20% auto 58%;height:240%;border-left:1px solid rgba(141,128,237,.22);transform:rotate(18deg);pointer-events:none}
      .upscale-hero-copy-v1{position:relative;z-index:2}.upscale-hero-copy-v1 h2{font-size:clamp(30px,5vw,56px);line-height:.96;margin:6px 0 12px;letter-spacing:-.055em}.upscale-hero-copy-v1 p{max-width:650px;margin:0;color:#96969c;font-size:12px;line-height:1.65}.upscale-hero-copy-v1 b{color:#f3f3ef;font-weight:600}
      .upscale-engine-v1{border-left:1px solid #29292e;padding-left:18px;display:grid;align-content:end;gap:12px}.upscale-engine-row-v1{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #202024;padding-bottom:8px;font:500 8px 'IBM Plex Mono',monospace;color:#717178}.upscale-engine-row-v1 strong{color:#d4d4d0;font-weight:500;text-align:right}
      .upscale-grid-v1{display:grid;grid-template-columns:minmax(280px,.72fr) minmax(0,1.28fr);gap:12px}
      .upscale-controls-v1,.upscale-preview-v1,.upscale-api-v1{border:1px solid #27272c;background:#0a0a0c;padding:14px}
      .upscale-section-head-v1{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:10px}.upscale-section-head-v1 h3{font-size:13px;margin:0}.upscale-section-head-v1 span{font:500 7px 'IBM Plex Mono',monospace;color:#6f6f76}
      .upscale-drop-v1{min-height:190px;border:1px dashed #3a3a40;background:#0d0d0f;display:grid;place-items:center;text-align:center;padding:20px;cursor:pointer;transition:border-color .18s ease,background .18s ease,transform .18s ease}.upscale-drop-v1:hover,.upscale-drop-v1.drag{border-color:#787184;background:#111113}.upscale-drop-v1.drag{transform:scale(.995)}.upscale-drop-v1 svg{width:30px;height:30px;fill:none;stroke:#c8c8c4;stroke-width:1.3;margin-bottom:10px}.upscale-drop-v1 strong{display:block;font-size:11px}.upscale-drop-v1 span{display:block;margin-top:5px;font-size:8px;color:#74747b}.upscale-file-v1{margin-top:8px;padding:8px;border:1px solid #242429;background:#0d0d0f;font:500 8px 'IBM Plex Mono',monospace;color:#8e8e94;display:none}.upscale-file-v1.show{display:flex;justify-content:space-between;gap:8px}.upscale-file-v1 strong{color:#d6d6d2;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .upscale-control-group-v1{margin-top:12px}.upscale-control-group-v1>label{display:block;margin-bottom:6px;font:500 8px 'IBM Plex Mono',monospace;color:#77777e;text-transform:uppercase;letter-spacing:.06em}.upscale-segment-v1{display:grid;grid-template-columns:repeat(2,1fr);border:1px solid #29292e}.upscale-segment-v1.three{grid-template-columns:repeat(3,1fr)}.upscale-segment-v1 button{min-height:36px;border:0;border-right:1px solid #29292e;background:#0d0d0f;color:#7f7f86;font:600 9px 'IBM Plex Sans',sans-serif;cursor:pointer}.upscale-segment-v1 button:last-child{border-right:0}.upscale-segment-v1 button.active{background:#f0f0ec;color:#08080a}.upscale-segment-v1 button small{display:block;font:500 6px 'IBM Plex Mono',monospace;opacity:.62;margin-top:2px}
      .upscale-run-v1{width:100%;margin-top:12px;min-height:42px!important;display:flex!important;align-items:center;justify-content:center;gap:8px}.upscale-run-v1 svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7}.upscale-run-v1[disabled]{opacity:.5;cursor:not-allowed}.upscale-note-v1{margin-top:9px;color:#6f6f76;font-size:8px;line-height:1.5}
      .upscale-status-v1{margin-top:9px;min-height:34px;padding:9px;border-left:2px solid #8d80ed;background:#0d0d0f;color:#98989e;font:500 8px 'IBM Plex Mono',monospace;display:none}.upscale-status-v1.show{display:block}.upscale-status-v1.error{border-left-color:#ef7474;color:#e1a0a0}.upscale-status-v1.success{border-left-color:#e8e8e4;color:#d6d6d2}
      .upscale-compare-v1{position:relative;min-height:430px;background:#060607;border:1px solid #222227;overflow:hidden;display:grid;place-items:center}.upscale-empty-v1{text-align:center;color:#5f5f66;font:500 9px 'IBM Plex Mono',monospace;padding:40px}.upscale-image-stage-v1{position:absolute;inset:0;display:none;background-image:linear-gradient(45deg,#0e0e10 25%,transparent 25%),linear-gradient(-45deg,#0e0e10 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#0e0e10 75%),linear-gradient(-45deg,transparent 75%,#0e0e10 75%);background-size:22px 22px;background-position:0 0,0 11px,11px -11px,-11px 0}.upscale-image-stage-v1.show{display:block}.upscale-image-stage-v1 img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none}.upscale-after-v1{clip-path:inset(0 50% 0 0)}.upscale-divider-v1{position:absolute;top:0;bottom:0;left:50%;width:1px;background:#f1f1ed;box-shadow:0 0 0 1px rgba(0,0,0,.28);display:none}.upscale-divider-v1::after{content:'↔';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:28px;height:28px;display:grid;place-items:center;background:#f1f1ed;color:#08080a;font:600 10px 'IBM Plex Mono',monospace}.upscale-compare-v1.ready .upscale-divider-v1{display:block}.upscale-slider-v1{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;z-index:5;display:none}.upscale-compare-v1.ready .upscale-slider-v1{display:block}.upscale-label-v1{position:absolute;top:9px;padding:4px 6px;background:rgba(5,5,6,.82);border:1px solid #2b2b30;color:#d0d0cc;font:600 7px 'IBM Plex Mono',monospace;z-index:4}.upscale-label-v1.before{left:9px}.upscale-label-v1.after{right:9px;color:#b4abfa}.upscale-result-meta-v1{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #232328;border-top:0}.upscale-result-meta-v1>div{padding:9px;border-right:1px solid #232328}.upscale-result-meta-v1>div:last-child{border-right:0}.upscale-result-meta-v1 span{display:block;font:500 6px 'IBM Plex Mono',monospace;color:#65656c}.upscale-result-meta-v1 strong{display:block;margin-top:3px;font-size:9px;color:#cfcfcb}.upscale-result-actions-v1{display:flex;gap:6px;margin-top:9px;justify-content:flex-end}.upscale-result-actions-v1 .button{min-height:32px!important;font-size:8px!important}
      .upscale-api-v1{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1.4fr);gap:20px}.upscale-api-v1 h3{margin:0 0 7px;font-size:15px}.upscale-api-v1 p{margin:0;color:#77777e;font-size:9px;line-height:1.55}.upscale-code-v1{margin:0;padding:12px;background:#060607;border:1px solid #232328;overflow:auto;color:#c5c5c1;font:500 8px/1.65 'IBM Plex Mono',monospace;white-space:pre}.upscale-code-v1 b{color:#b4abfa;font-weight:500}
      @media(max-width:900px){.upscale-hero-v1{grid-template-columns:1fr}.upscale-engine-v1{border-left:0;border-top:1px solid #29292e;padding:12px 0 0;grid-template-columns:repeat(3,1fr)}.upscale-grid-v1{grid-template-columns:1fr}.upscale-compare-v1{min-height:390px}.upscale-api-v1{grid-template-columns:1fr}}
      @media(max-width:520px){.upscale-hero-v1{padding:16px;gap:16px}.upscale-engine-v1{grid-template-columns:1fr;gap:7px}.upscale-controls-v1,.upscale-preview-v1,.upscale-api-v1{padding:10px}.upscale-drop-v1{min-height:150px}.upscale-compare-v1{min-height:330px}.upscale-result-meta-v1{grid-template-columns:repeat(2,1fr)}.upscale-result-meta-v1>div:nth-child(2){border-right:0}.upscale-result-meta-v1>div:nth-child(-n+2){border-bottom:1px solid #232328}.upscale-code-v1{font-size:7px}}
    `;
    document.head.appendChild(style);
  }

  function addNav() {
    const nav = document.querySelector('#workspaceSidebar .workspace-nav');
    if (!nav || document.getElementById('upscaleNavV1')) return;
    document.querySelectorAll('.workspace-nav-link').forEach(link => link.classList.remove('active'));
    const group = document.createElement('div');
    group.className = 'workspace-nav-group';
    group.id = 'upscaleNavV1';
    group.innerHTML = `<div class="workspace-nav-label">Imagem</div><a class="workspace-nav-link active" href="/painel/upscale"><span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h15v15H4z"/><path d="M9 2v5M6.5 4.5h5M15 11h6M18 8v6"/></svg></span><span>AI Upscaler</span></a>`;
    nav.appendChild(group);
  }

  function render() {
    const shell = document.getElementById('workspaceShell');
    const root = document.getElementById('workspaceContent');
    if (!shell || shell.classList.contains('hidden') || !root) return false;

    document.getElementById('workspaceKicker').textContent = 'Imagem / IA';
    document.getElementById('workspaceTitle').textContent = 'AI Upscaler';
    document.getElementById('workspaceDescription').textContent = 'Super-resolution neural real para recuperar detalhe e ampliar imagens em 4x ou 6x.';
    document.title = 'AI Upscaler - SkyNetApi';
    addNav();

    root.innerHTML = `
      <section class="upscale-v1">
        <div class="upscale-hero-v1">
          <div class="upscale-hero-copy-v1">
            <div class="workspace-kicker">SUPER RESOLUTION / ONNX</div>
            <h2>Mais pixels.<br>Detalhe reconstruído.</h2>
            <p>Não é apenas resize. O SkyNet executa <b>Swin2SR</b> sobre a imagem para reconstruir detalhe em resolução 4×. O modo 6× usa essa saída neural e finaliza o tamanho com reamostragem Lanczos.</p>
          </div>
          <div class="upscale-engine-v1">
            <div class="upscale-engine-row-v1"><span>MODELO</span><strong>Swin2SR Real-world</strong></div>
            <div class="upscale-engine-row-v1"><span>NATIVO</span><strong>4× neural</strong></div>
            <div class="upscale-engine-row-v1"><span>EXECUÇÃO</span><strong id="upscaleEngineStateV1">verificando</strong></div>
          </div>
        </div>

        <div class="upscale-grid-v1">
          <div class="upscale-controls-v1">
            <div class="upscale-section-head-v1"><h3>Entrada</h3><span>PNG / JPG / WEBP</span></div>
            <input id="upscaleFileV1" type="file" accept="image/png,image/jpeg,image/webp" hidden>
            <div class="upscale-drop-v1" id="upscaleDropV1" tabindex="0" role="button" aria-label="Selecionar imagem">
              <div><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="m7 15 3-4 3 3 2-2 3 3"/><path d="M12 3v5M9.5 5.5h5"/></svg><strong>Solte ou escolha uma imagem</strong><span>Até 10 MB · limites de pixels são calculados antes da IA</span></div>
            </div>
            <div class="upscale-file-v1" id="upscaleFileMetaV1"><strong></strong><span></span></div>

            <div class="upscale-control-group-v1">
              <label>Escala</label>
              <div class="upscale-segment-v1" id="upscaleScaleV1"><button class="active" type="button" data-scale="4">4×<small>neural nativo</small></button><button type="button" data-scale="6">6×<small>neural + final</small></button></div>
            </div>
            <div class="upscale-control-group-v1">
              <label>Formato de saída</label>
              <div class="upscale-segment-v1 three" id="upscaleFormatV1"><button class="active" type="button" data-format="webp">WEBP</button><button type="button" data-format="png">PNG</button><button type="button" data-format="jpeg">JPG</button></div>
            </div>
            <button class="button primary upscale-run-v1" id="upscaleRunV1" type="button" disabled><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/><path d="m16 7 5-4M8 17l-5 4"/></svg><span>Executar super-resolution</span></button>
            <div class="upscale-note-v1">O primeiro processamento pode precisar carregar o modelo para o cache do servidor. A IA pode reconstruir texturas e pequenos detalhes que não existiam literalmente no arquivo original.</div>
            <div class="upscale-status-v1" id="upscaleStatusV1"></div>
          </div>

          <div class="upscale-preview-v1">
            <div class="upscale-section-head-v1"><h3>Comparação</h3><span>arraste depois do processamento</span></div>
            <div class="upscale-compare-v1" id="upscaleCompareV1">
              <div class="upscale-empty-v1" id="upscaleEmptyV1">Selecione uma imagem para preparar a comparação.</div>
              <div class="upscale-image-stage-v1" id="upscaleStageV1"><img id="upscaleBeforeV1" alt="Imagem original"><img class="upscale-after-v1" id="upscaleAfterV1" alt="Imagem ampliada por IA"><span class="upscale-label-v1 before">ORIGINAL</span><span class="upscale-label-v1 after">AI</span><div class="upscale-divider-v1" id="upscaleDividerV1"></div><input class="upscale-slider-v1" id="upscaleSliderV1" type="range" min="0" max="100" value="50" aria-label="Comparar imagem original e ampliada"></div>
            </div>
            <div class="upscale-result-meta-v1"><div><span>ENTRADA</span><strong id="upscaleInputSizeV1">—</strong></div><div><span>SAÍDA</span><strong id="upscaleOutputSizeV1">—</strong></div><div><span>ESCALA</span><strong id="upscaleResultScaleV1">—</strong></div><div><span>PIPELINE</span><strong id="upscalePipelineV1">—</strong></div></div>
            <div class="upscale-result-actions-v1"><a class="button primary" id="upscaleDownloadV1" hidden>Baixar resultado</a></div>
          </div>
        </div>

        <div class="upscale-api-v1">
          <div><div class="workspace-kicker">API PARA BOTS</div><h3>Baileys, Discord ou scripts.</h3><p>Envie multipart com sua API key. A resposta é a própria imagem processada, então pode virar Buffer diretamente no bot.</p></div>
          <pre class="upscale-code-v1">const form = new FormData();
form.append('file', new Blob([imageBuffer]), 'foto.jpg');
form.append('scale', '4');
form.append('format', 'webp');

const response = await fetch('/api/v1/image/upscale', {
  method: 'POST',
  headers: { <b>'x-api-key': SKYNET_API_KEY</b> },
  body: form
});

const upscaled = Buffer.from(await response.arrayBuffer());
await sock.sendMessage(jid, { image: upscaled });</pre>
        </div>
      </section>`;

    wire();
    loadInfo();
    return true;
  }

  function setStatus(text, type = '') {
    const box = document.getElementById('upscaleStatusV1');
    box.textContent = text || '';
    box.className = `upscale-status-v1 ${text ? 'show' : ''} ${type}`;
  }

  async function loadInfo() {
    try {
      const info = await S.api('/api/upscale/info');
      document.getElementById('upscaleEngineStateV1').textContent = info.modelLoaded ? 'modelo carregado' : 'pronto para carregar';
    } catch {
      document.getElementById('upscaleEngineStateV1').textContent = 'indisponível';
    }
  }

  async function selectFile(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setStatus('Formato inválido. Use PNG, JPG ou WebP.', 'error');
    if (file.size > 10 * 1024 * 1024) return setStatus('Arquivo maior que 10 MB.', 'error');
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = ''; }
    sourceFile = file;
    sourceUrl = URL.createObjectURL(file);
    document.getElementById('upscaleBeforeV1').src = sourceUrl;
    document.getElementById('upscaleAfterV1').removeAttribute('src');
    document.getElementById('upscaleStageV1').classList.add('show');
    document.getElementById('upscaleEmptyV1').hidden = true;
    document.getElementById('upscaleCompareV1').classList.remove('ready');
    document.getElementById('upscaleDownloadV1').hidden = true;
    document.getElementById('upscaleRunV1').disabled = false;
    const meta = document.getElementById('upscaleFileMetaV1');
    meta.classList.add('show');
    meta.querySelector('strong').textContent = file.name;
    meta.querySelector('span').textContent = S.formatSize(file.size);
    setStatus('');

    try {
      const bitmap = await createImageBitmap(file);
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      bitmap.close();
      document.getElementById('upscaleInputSizeV1').textContent = `${sourceWidth}×${sourceHeight}`;
      updatePredictedSize();
    } catch {
      sourceWidth = sourceHeight = 0;
      document.getElementById('upscaleInputSizeV1').textContent = '—';
    }
  }

  function updatePredictedSize() {
    document.getElementById('upscaleOutputSizeV1').textContent = sourceWidth ? `${sourceWidth * scale}×${sourceHeight * scale}` : '—';
    document.getElementById('upscaleResultScaleV1').textContent = sourceFile ? `${scale}× previsto` : '—';
    document.getElementById('upscalePipelineV1').textContent = scale === 4 ? 'Swin2SR x4' : 'Swin2SR + final';
  }

  async function run() {
    if (!sourceFile) return;
    const button = document.getElementById('upscaleRunV1');
    button.disabled = true;
    setStatus('Executando super-resolution neural. O processamento ocorre no servidor e a fila aceita poucas tarefas simultâneas.');
    const form = new FormData();
    form.append('file', sourceFile, sourceFile.name);
    form.append('scale', String(scale));
    form.append('format', format);
    form.append('quality', '94');

    try {
      const response = await fetch('/api/upscale', { method: 'POST', credentials: 'same-origin', body: form });
      if (!response.ok) {
        const type = response.headers.get('content-type') || '';
        const data = type.includes('json') ? await response.json().catch(() => null) : null;
        throw new Error(data?.error || `Falha HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(blob);
      const after = document.getElementById('upscaleAfterV1');
      after.src = resultUrl;
      document.getElementById('upscaleCompareV1').classList.add('ready');
      const width = response.headers.get('X-Upscale-Width') || (sourceWidth ? sourceWidth * scale : '—');
      const height = response.headers.get('X-Upscale-Height') || (sourceHeight ? sourceHeight * scale : '—');
      document.getElementById('upscaleOutputSizeV1').textContent = `${width}×${height}`;
      document.getElementById('upscaleResultScaleV1').textContent = `${response.headers.get('X-Upscale-Scale') || scale}×`;
      document.getElementById('upscalePipelineV1').textContent = scale === 4 ? 'Swin2SR x4 neural' : 'Swin2SR x4 + Lanczos';
      const download = document.getElementById('upscaleDownloadV1');
      const extension = format === 'jpeg' ? 'jpg' : format;
      download.href = resultUrl;
      download.download = `${sourceFile.name.replace(/\.[^.]+$/, '')}-ai-${scale}x.${extension}`;
      download.hidden = false;
      setStatus(`Super-resolution concluída. Resultado: ${width}×${height}.`, 'success');
      document.getElementById('upscaleEngineStateV1').textContent = 'modelo carregado';
    } catch (error) {
      setStatus(error.message || 'Não foi possível processar a imagem.', 'error');
    } finally {
      button.disabled = !sourceFile;
    }
  }

  function wire() {
    const input = document.getElementById('upscaleFileV1');
    const drop = document.getElementById('upscaleDropV1');
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
    input.addEventListener('change', () => selectFile(input.files?.[0]));
    ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', event => selectFile(event.dataTransfer?.files?.[0]));

    document.getElementById('upscaleScaleV1').addEventListener('click', event => {
      const button = event.target.closest('[data-scale]');
      if (!button) return;
      scale = Number(button.dataset.scale) === 6 ? 6 : 4;
      button.parentElement.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      updatePredictedSize();
    });
    document.getElementById('upscaleFormatV1').addEventListener('click', event => {
      const button = event.target.closest('[data-format]');
      if (!button) return;
      format = button.dataset.format;
      button.parentElement.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    });
    document.getElementById('upscaleRunV1').addEventListener('click', run);
    document.getElementById('upscaleSliderV1').addEventListener('input', event => {
      const value = Number(event.target.value || 50);
      document.getElementById('upscaleAfterV1').style.clipPath = `inset(0 ${100 - value}% 0 0)`;
      document.getElementById('upscaleDividerV1').style.left = `${value}%`;
    });
  }

  installStyles();
  if (render()) return;
  const observer = new MutationObserver(() => { if (render()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setTimeout(() => observer.disconnect(), 12000);
})();
