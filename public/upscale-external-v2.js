(() => {
  if (window.__SKYNET_UPSCALE_EXTERNAL_V2__) return;
  window.__SKYNET_UPSCALE_EXTERNAL_V2__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/upscale') return;

  const nativeFetch = window.fetch.bind(window);
  let fetchPatched = false;

  function patchFetch() {
    if (fetchPatched) return;
    fetchPatched = true;
    window.fetch = function(input, init) {
      try {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (/\/api\/upscale(?:\?|$)/.test(url) && init?.body instanceof FormData) {
          const toggle = document.getElementById('upscaleFaceEnhanceV2');
          init.body.set('faceEnhance', toggle?.checked ? 'true' : 'false');
        }
      } catch {}
      return nativeFetch(input, init);
    };
  }

  function installStyle() {
    if (document.getElementById('upscaleExternalV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'upscaleExternalV2Styles';
    style.textContent = `
      .upscale-face-v2{margin-top:10px;border:1px solid #29292e;background:#0d0d0f;display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:center;padding:9px 10px;cursor:pointer}
      .upscale-face-v2 input{appearance:none;width:30px;height:17px;border:1px solid #3b3b41!important;background:#111113!important;position:relative;margin:0!important;padding:0!important;cursor:pointer;border-radius:999px!important}
      .upscale-face-v2 input::after{content:'';position:absolute;width:11px;height:11px;left:2px;top:2px;background:#77777e;border-radius:50%;transition:transform .18s ease,background .18s ease}
      .upscale-face-v2 input:checked{border-color:#777185!important;background:#17151d!important}.upscale-face-v2 input:checked::after{transform:translateX(13px);background:#eeeef0}
      .upscale-face-v2 strong{display:block;font-size:9px;color:#d9d9d5}.upscale-face-v2 span{display:block;margin-top:2px;font-size:7px;line-height:1.4;color:#727279}
      .upscale-provider-v2{display:inline-flex;align-items:center;gap:5px}.upscale-provider-v2::before{content:'';width:5px;height:5px;background:#e5e5e1;border-radius:50%;box-shadow:0 0 0 3px rgba(141,128,237,.1)}
      .upscale-provider-v2.offline::before{background:#d77b7b;box-shadow:none}
      @media(max-width:520px){.upscale-face-v2{padding:8px}}
      @media(prefers-reduced-motion:reduce){.upscale-face-v2 input::after{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function installFaceEnhance() {
    if (document.getElementById('upscaleFaceEnhanceV2')) return;
    const run = document.getElementById('upscaleRunV1');
    if (!run) return;
    const label = document.createElement('label');
    label.className = 'upscale-face-v2';
    label.innerHTML = `<input id="upscaleFaceEnhanceV2" type="checkbox"><span><strong>Aprimorar rostos</strong><span>Ativa GFPGAN junto do Real-ESRGAN. Melhor para fotos com faces; deixe desligado para arte, texto e interfaces.</span></span>`;
    run.before(label);
  }

  async function refreshProviderState() {
    const state = document.getElementById('upscaleEngineStateV1');
    if (!state) return;
    try {
      const response = await nativeFetch('/api/upscale/info', { credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Falha ao consultar o provedor.');
      state.textContent = data.configured ? 'Replicate · pronto' : 'token não configurado';
      state.classList.toggle('offline', !data.configured);
      state.classList.add('upscale-provider-v2');
      const run = document.getElementById('upscaleRunV1');
      if (run && !data.configured) {
        run.title = 'Configure REPLICATE_API_TOKEN no Railway para habilitar o upscale.';
      }
    } catch {
      state.textContent = 'Replicate · indisponível';
      state.classList.add('upscale-provider-v2', 'offline');
    }
  }

  function updateApiExample() {
    const code = document.querySelector('.upscale-code-v1');
    if (!code) return;
    code.textContent = `POST /api/v1/image/upscale\nx-api-key: SUA_API_KEY\nContent-Type: multipart/form-data\n\nfile: imagem.jpg\nscale: 4 | 6\nformat: webp | png | jpeg\nfaceEnhance: true | false`;
  }

  function enhance() {
    const root = document.querySelector('.upscale-v1');
    if (!root || root.dataset.externalV2 === '1') return false;
    root.dataset.externalV2 = '1';
    installStyle();
    patchFetch();

    setText('.upscale-hero-copy-v1 .workspace-kicker', 'REAL-ESRGAN / HOSTED AI');
    const title = document.querySelector('.upscale-hero-copy-v1 h2');
    if (title) title.innerHTML = 'Super-resolution real.<br>Sem pesar o servidor.';
    const copy = document.querySelector('.upscale-hero-copy-v1 p');
    if (copy) copy.innerHTML = 'A imagem é processada pelo <b>Real-ESRGAN</b> hospedado no Replicate. O Railway apenas valida, encaminha e devolve o resultado — sem carregar modelo ONNX ou usar inferência pesada local.';

    const rows = [...document.querySelectorAll('.upscale-engine-row-v1')];
    if (rows[0]) rows[0].innerHTML = '<span>MODELO</span><strong>Real-ESRGAN</strong>';
    if (rows[1]) rows[1].innerHTML = '<span>ESCALA</span><strong>4× / 6× neural</strong>';
    if (rows[2]) rows[2].innerHTML = '<span>PROVEDOR</span><strong id="upscaleEngineStateV1" class="upscale-provider-v2">verificando</strong>';

    document.querySelectorAll('#upscaleScaleV1 [data-scale]').forEach(button => {
      const factor = button.dataset.scale;
      button.innerHTML = `${factor}×<small>Real-ESRGAN direto</small>`;
    });

    const note = document.querySelector('.upscale-note-v1');
    if (note) note.textContent = 'O processamento de IA acontece fora do Railway. 4× e 6× são enviados diretamente ao Real-ESRGAN. O SkyNetApi não baixa nem mantém pesos de IA locais.';

    installFaceEnhance();
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
