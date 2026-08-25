(() => {
  if (window.__SKYNET_UPSCALE_EXTERNAL_V2__) return;
  window.__SKYNET_UPSCALE_EXTERNAL_V2__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/upscale') return;

  function installStyle() {
    if (document.getElementById('upscaleExternalV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'upscaleExternalV2Styles';
    style.textContent = `
      .upscale-provider-v2{display:inline-flex;align-items:center;gap:5px}.upscale-provider-v2::before{content:'';width:5px;height:5px;background:#e5e5e1;border-radius:50%;box-shadow:0 0 0 3px rgba(141,128,237,.1)}
      .upscale-provider-v2.busy::before{background:#c4ad77}.upscale-provider-v2.offline::before{background:#d77b7b;box-shadow:none}
      .upscale-public-note-v2{margin-top:10px;padding:9px 10px;border:1px solid #29292e;background:#0d0d0f;color:#77777e;font:500 8px/1.55 'IBM Plex Mono',monospace}
      .upscale-public-note-v2 strong{color:#d6d6d2;font-weight:500}
    `;
    document.head.appendChild(style);
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  async function refreshProviderState() {
    const state = document.getElementById('upscaleEngineStateV1');
    if (!state) return;
    state.classList.add('upscale-provider-v2');
    try {
      const response = await fetch('/api/upscale/info', { credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Falha ao consultar serviço.');
      state.textContent = data.busy ? 'público · fila ativa' : 'público · zero token';
      state.classList.toggle('busy', Boolean(data.busy));
      state.title = `${data.provider || 'Hugging Face Spaces'} · ${Array.isArray(data.publicSpaces) ? data.publicSpaces.length : 0} fallback(s)`;
    } catch {
      state.textContent = 'serviço público indisponível';
      state.classList.add('offline');
    }
  }

  function updateApiExample() {
    const code = document.querySelector('.upscale-code-v1');
    if (!code) return;
    code.textContent = `POST /api/v1/image/upscale\nContent-Type: multipart/form-data\n\nfile: imagem.jpg\nscale: 4 | 6\nformat: webp | png | jpeg\n\nSem token. Sem API key obrigatória.\nLimite público: 6 upscales por hora por IP.`;
  }

  function enhance() {
    const root = document.querySelector('.upscale-v1');
    if (!root || root.dataset.publicSpaceV2 === '1') return false;
    root.dataset.publicSpaceV2 = '1';
    installStyle();

    document.getElementById('upscaleFaceEnhanceV2')?.closest('.upscale-face-v2')?.remove();
    setText('.upscale-hero-copy-v1 .workspace-kicker', 'REAL-ESRGAN / PUBLIC CLOUD');
    const title = document.querySelector('.upscale-hero-copy-v1 h2');
    if (title) title.innerHTML = 'Super-resolution real.<br>Zero token.';
    const copy = document.querySelector('.upscale-hero-copy-v1 p');
    if (copy) copy.innerHTML = 'O SkyNet envia a imagem para <b>Spaces públicos de Real-ESRGAN</b> no Hugging Face. O Railway não executa o modelo e o recurso não exige token de Replicate, Hugging Face nem API key do próprio SkyNet para o endpoint público.';

    const rows = [...document.querySelectorAll('.upscale-engine-row-v1')];
    if (rows[0]) rows[0].innerHTML = '<span>MODELO</span><strong>Real-ESRGAN x4</strong>';
    if (rows[1]) rows[1].innerHTML = '<span>ESCALA</span><strong>4× AI / 6× AI + final</strong>';
    if (rows[2]) rows[2].innerHTML = '<span>PROVEDOR</span><strong id="upscaleEngineStateV1" class="upscale-provider-v2">verificando</strong>';

    document.querySelectorAll('#upscaleScaleV1 [data-scale]').forEach(button => {
      const factor = button.dataset.scale;
      button.innerHTML = factor === '4' ? '4×<small>Real-ESRGAN</small>' : '6×<small>AI 4× + final 1.5×</small>';
    });

    const note = document.querySelector('.upscale-note-v1');
    if (note) note.textContent = 'O processamento pesado acontece em servidores públicos externos. Como são gratuitos, podem entrar em fila, dormir ou aplicar limite temporário; o SkyNet tenta outros Spaces automaticamente quando um falha.';

    const run = document.getElementById('upscaleRunV1');
    if (run && !document.querySelector('.upscale-public-note-v2')) {
      const info = document.createElement('div');
      info.className = 'upscale-public-note-v2';
      info.innerHTML = '<strong>Zero token.</strong> A rota pública funciona sem login técnico, sem API key e sem segredo de provedor. Para evitar abuso, ela é limitada por IP.';
      run.after(info);
    }

    updateApiExample();
    refreshProviderState();
    return true;
  }

  if (enhance()) return;
  const observer = new MutationObserver(() => {
    if (enhance()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
})();
