(() => {
  const input = document.getElementById('bratInput');
  const saveButton = document.getElementById('saveButton');
  const preview = document.getElementById('bratPreview');
  if (!input || !saveButton || !preview) return;

  let timer = null;
  let controller = null;
  let currentBlob = null;
  let currentObjectUrl = '';
  let renderedText = '';
  let requestId = 0;

  function normalizeText(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n').slice(0, 450);
  }

  function revokeCurrentUrl() {
    if (!currentObjectUrl) return;
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = '';
  }

  function showMessage(text) {
    revokeCurrentUrl();
    currentBlob = null;
    renderedText = '';
    preview.innerHTML = '';
    const message = document.createElement('div');
    message.className = 'brat-preview-state';
    message.textContent = text;
    preview.appendChild(message);
  }

  async function readError(response) {
    try {
      const data = await response.json();
      return data?.error || `Erro HTTP ${response.status}`;
    } catch {
      return `Erro HTTP ${response.status}`;
    }
  }

  async function renderNow() {
    const text = normalizeText(input.value);
    if (!text.trim()) {
      showMessage('Digite um texto para gerar a prévia.');
      return null;
    }

    const id = ++requestId;
    controller?.abort();
    controller = new AbortController();
    preview.classList.add('loading');

    try {
      const response = await fetch(`/painel/brat/image?texto=${encodeURIComponent(text)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(await readError(response));

      const blob = await response.blob();
      if (id !== requestId) return null;

      revokeCurrentUrl();
      currentBlob = blob;
      renderedText = text;
      currentObjectUrl = URL.createObjectURL(blob);

      const img = document.createElement('img');
      img.src = currentObjectUrl;
      img.alt = 'Prévia do Brat Generator';
      img.draggable = false;
      preview.innerHTML = '';
      preview.appendChild(img);
      return blob;
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      if (id === requestId) showMessage(error?.message || 'Não foi possível gerar a prévia.');
      return null;
    } finally {
      if (id === requestId) preview.classList.remove('loading');
    }
  }

  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(() => renderNow(), 180);
  }

  async function download() {
    const text = normalizeText(input.value);
    let blob = currentBlob;
    if (!blob || renderedText !== text) blob = await renderNow();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'brat-white.png';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  input.addEventListener('input', scheduleRender);
  saveButton.addEventListener('click', download);
  preview.addEventListener('click', event => {
    if (event.target.closest('.brat-preview-state')) return;
    download();
  });

  window.addEventListener('beforeunload', () => {
    clearTimeout(timer);
    controller?.abort();
    revokeCurrentUrl();
  });

  renderNow();
})();
