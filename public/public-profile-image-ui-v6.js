(() => {
  if (window.__SKYNET_PUBLIC_PROFILE_IMAGE_UI_V6__) return;
  window.__SKYNET_PUBLIC_PROFILE_IMAGE_UI_V6__ = true;

  const root = document.getElementById('publicProfileRoot');
  if (!root) return;

  installStyles();
  ensureShell();

  const observer = new MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src','href','download','style','data-profile-image-source'] });
  sync();

  function installStyles() {
    if (document.getElementById('publicProfileImageUiV6Styles')) return;
    const style = document.createElement('style');
    style.id = 'publicProfileImageUiV6Styles';
    style.textContent = `
      .public-profile-image-v6-shell{width:min(100%,1200px);margin:20px auto 0;display:grid;gap:12px;justify-items:center;padding:16px;border:1px solid rgba(124,156,255,.18);border-radius:16px;background:rgba(17,23,34,.72)}
      .public-profile-image-v6-loading{display:flex;align-items:center;gap:10px;color:#c8d1df;font:700 12px system-ui,sans-serif;text-align:center}
      .public-profile-image-v6-spinner{width:18px;height:18px;border:2px solid rgba(124,156,255,.22);border-top-color:#7c9cff;border-radius:50%;animation:ppimgv6spin .8s linear infinite}
      .public-profile-image-v6-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap}
      .public-profile-image-v6-actions button{min-height:40px;padding:9px 14px;border:1px solid rgba(124,156,255,.3);border-radius:11px;background:#111722;color:#f4f7fb;font:700 12px system-ui,sans-serif;cursor:pointer}
      .public-profile-image-v6-actions button:disabled{opacity:.48;cursor:wait}
      .public-profile-image-v6-note{color:#9ca8b8;font:600 11px system-ui,sans-serif;text-align:center}
      @keyframes ppimgv6spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
  }

  function ensureShell() {
    if (root.querySelector('.public-profile-image-v6-shell')) return;
    const shell = document.createElement('div');
    shell.className = 'public-profile-image-v6-shell';
    shell.innerHTML = `
      <div class="public-profile-image-v6-loading"><span class="public-profile-image-v6-spinner" aria-hidden="true"></span><span data-v6-message>Preparando imagem do perfil...</span></div>
      <div class="public-profile-image-v6-actions">
        <button type="button" data-v6-save disabled>Salvar imagem</button>
        <button type="button" data-v6-open disabled>Abrir imagem</button>
        <button type="button" data-v6-retry>Gerar novamente</button>
      </div>
      <div class="public-profile-image-v6-note">PNG para perfil estático e GIF para perfil animado. No celular, depois de pronta, você também pode apertar e segurar a imagem.</div>`;
    root.appendChild(shell);

    shell.querySelector('[data-v6-save]').addEventListener('click', () => {
      const finalSave = root.querySelector('.public-profile-image-v5-wrap [data-profile-image-save]');
      if (finalSave?.href) finalSave.click();
    });
    shell.querySelector('[data-v6-open]').addEventListener('click', () => {
      const finalOpen = root.querySelector('.public-profile-image-v5-wrap [data-profile-image-open]');
      if (finalOpen?.href) window.open(finalOpen.href, '_blank', 'noopener');
    });
    shell.querySelector('[data-v6-retry]').addEventListener('click', () => {
      const refresh = root.querySelector('.public-profile-image-v5-wrap [data-profile-image-refresh]');
      if (refresh) refresh.click();
      else location.reload();
    });
  }

  function sync() {
    ensureShell();
    const shell = root.querySelector('.public-profile-image-v6-shell');
    if (!shell) return;
    const message = shell.querySelector('[data-v6-message]');
    const spinner = shell.querySelector('.public-profile-image-v6-spinner');
    const saveButton = shell.querySelector('[data-v6-save]');
    const openButton = shell.querySelector('[data-v6-open]');
    const finalWrap = root.querySelector('.public-profile-image-v5-wrap');
    const finalSave = finalWrap?.querySelector('[data-profile-image-save]');
    const finalOpen = finalWrap?.querySelector('[data-profile-image-open]');
    const finalStatus = finalWrap?.querySelector('.public-profile-image-v5-status')?.textContent?.trim();
    const finalImage = finalWrap?.querySelector('.public-profile-image-v5');

    if (finalImage?.src && finalSave?.href) {
      const isGif = /\.gif(?:$|\?)/i.test(finalSave.download || '') || /GIF/i.test(finalSave.textContent || '');
      message.textContent = finalStatus || (isGif ? 'GIF animado pronto.' : 'PNG pronto.');
      spinner.style.display = 'none';
      saveButton.disabled = false;
      openButton.disabled = !finalOpen?.href;
      saveButton.textContent = isGif ? 'Salvar GIF' : 'Salvar PNG';
      return;
    }

    spinner.style.display = '';
    saveButton.disabled = true;
    openButton.disabled = true;
    saveButton.textContent = 'Salvar imagem';
    message.textContent = finalStatus || detectPhase();
  }

  function detectPhase() {
    const source = root.querySelector('.public-profile-studio');
    if (!source) return 'Carregando perfil...';
    if (source.querySelector('video')) return 'Convertendo mídia animada para GIF...';
    return 'Convertendo perfil para PNG...';
  }
})();
