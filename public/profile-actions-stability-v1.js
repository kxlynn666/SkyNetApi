(() => {
  if (window.__SKYNET_PROFILE_ACTIONS_STABILITY_V1__) return;
  window.__SKYNET_PROFILE_ACTIONS_STABILITY_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;
  const S = window.SkyNet;
  if (!S) return;

  let socialCache = null;
  let communityCache = null;
  const busy = new WeakSet();

  const style = document.createElement('style');
  style.id = 'profileActionsStabilityV1Styles';
  style.textContent = `
    .profile-v3-preview[data-profile-style="glass"]{border-color:rgba(167,139,250,.34)!important;background:linear-gradient(145deg,rgba(40,27,68,.94),rgba(17,11,31,.96))!important;box-shadow:0 16px 46px rgba(139,92,246,.12)!important}
    .profile-v3-preview[data-profile-style="contrast"]{border-color:color-mix(in srgb,var(--profile-accent,#a855f7) 62%,transparent)!important;background:#07070b!important;box-shadow:0 14px 42px rgba(0,0,0,.32)!important}
    .profile-v3-preview[data-profile-style="clean"]{box-shadow:0 12px 36px rgba(0,0,0,.16)!important}
  `;
  document.head.appendChild(style);

  function setBusy(element, value) {
    if (!element) return;
    element.classList.toggle('skynet-action-busy', value);
    if ('disabled' in element) element.disabled = value;
  }

  async function withBusy(element, fn) {
    if (!element || busy.has(element)) return;
    busy.add(element);
    setBusy(element, true);
    try { await fn(); }
    finally {
      busy.delete(element);
      if (element.isConnected) setBusy(element, false);
    }
  }

  function msg(id, text, type = 'success') {
    const el = document.getElementById(id);
    if (el) S.message(el, text, type);
  }

  async function social() {
    if (!socialCache) socialCache = await S.api('/api/social/me');
    return socialCache;
  }

  async function community() {
    if (!communityCache) communityCache = await S.api('/api/community/profile/me');
    return communityCache;
  }

  async function patchSocial(changes) {
    const data = await social();
    const profile = data.account?.profile || {};
    const body = {
      displayName: Object.prototype.hasOwnProperty.call(changes,'displayName') ? changes.displayName : profile.displayName,
      status: Object.prototype.hasOwnProperty.call(changes,'status') ? changes.status : profile.status,
      bio: Object.prototype.hasOwnProperty.call(changes,'bio') ? changes.bio : profile.bio,
      avatarUploadId: Object.prototype.hasOwnProperty.call(changes,'avatarUploadId') ? changes.avatarUploadId : profile.avatarUploadId,
      privacy: { ...(profile.privacy || {}), ...(changes.privacy || {}) }
    };
    await S.api('/api/social/account/profile', { method:'PATCH', body });
    socialCache = { ...data, account:{ ...data.account, profile:{ ...profile, ...body } } };
    return body;
  }

  async function patchCommunity(changes) {
    const data = await community();
    const current = data.custom || {};
    const body = {
      headline: current.headline || '',
      style: current.style || 'clean',
      accent: current.accent || '#a855f7',
      bannerUploadId: current.bannerUploadId || '',
      showXp: current.showXp !== false,
      showJoinDate: current.showJoinDate !== false,
      showFriendCount: current.showFriendCount !== false,
      ...changes
    };
    await S.api('/api/community/profile/me', { method:'PATCH', body });
    communityCache = { ...data, custom:{ ...current, ...body } };
    return body;
  }

  function updateAppearancePreview(body) {
    const preview = document.querySelector('.profile-v3-preview');
    if (!preview) return;
    preview.dataset.profileStyle = body.style || 'clean';
    preview.style.setProperty('--profile-accent', body.accent || '#a855f7');
    const headline = preview.querySelector('.profile-v3-headline');
    if (headline) headline.textContent = body.headline || '';
  }

  function updateEquipped(result, form) {
    const cosmetics = result?.cosmetics || {};
    const preview = document.querySelector('.profile-v3-preview');
    if (preview) preview.dataset.decoration = form.get('decorationId') || '';
    const avatar = preview?.querySelector('.cosmetic-avatar');
    if (avatar) avatar.dataset.frame = form.get('frameId') || '';
    const oldTags = preview?.querySelector('.profile-tags');
    const tags = Array.isArray(cosmetics.tags) ? cosmetics.tags : [];
    if (oldTags) oldTags.remove();
    if (tags.length && preview) {
      const holder = document.createElement('div');
      holder.className = 'profile-tags';
      for (const tag of tags) {
        const item = document.createElement('span');
        item.className = 'profile-tag';
        item.textContent = tag.name || '';
        item.style.setProperty('--tag-a', tag.colors?.[0] || '#7c3aed');
        item.style.setProperty('--tag-b', tag.colors?.[1] || '#a78bfa');
        holder.appendChild(item);
      }
      preview.querySelector('.profile-v3-copy')?.appendChild(holder);
    }
    const visual = [...document.querySelectorAll('.profile-v3-summary-card')].find(card => /visual atual/i.test(card.querySelector('h3')?.textContent || ''));
    if (visual) {
      const p = visual.querySelector('p');
      if (p) p.textContent = `${cosmetics.frame?.name || 'Sem moldura'} · ${cosmetics.decoration?.name || 'Sem decoração'}`;
    }
  }

  async function upload(file) {
    if (!file?.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
    const data = new FormData();
    data.append('file', file, file.name || 'perfil');
    const response = await S.api('/api/uploads', { method:'POST', body:data });
    const id = response.upload?.id || response.id;
    if (!id) throw new Error('O upload terminou sem retornar um ID.');
    return id;
  }

  function addOwnedToEquip(item) {
    if (!item) return;
    if (item.type === 'frame' || item.type === 'decoration') {
      const select = document.querySelector(`#profileV3EquipForm select[name="${item.type === 'frame' ? 'frameId' : 'decorationId'}"]`);
      if (select && ![...select.options].some(option => option.value === item.id)) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
      }
    } else if (item.type === 'tag') {
      const inventory = document.querySelector('#profileV3EquipForm .profile-v3-inventory');
      if (inventory && !inventory.querySelector(`input[value="${CSS.escape(item.id)}"]`)) {
        const label = document.createElement('label');
        label.className = 'profile-v3-choice';
        label.innerHTML = `<input type="checkbox" name="tagId" value="${S.escapeHtml(item.id)}"><div class="profile-v3-swatch"></div><strong>${S.escapeHtml(item.name)}</strong><span>${S.escapeHtml(item.rarity || '')}</span>`;
        label.querySelector('.profile-v3-swatch')?.style.setProperty('--sw-a', item.colors?.[0] || '#8b5cf6');
        label.querySelector('.profile-v3-swatch')?.style.setProperty('--sw-b', item.colors?.[1] || '#22d3ee');
        inventory.appendChild(label);
      }
    }
  }

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === 'profileV3AppearanceForm') {
      event.preventDefault(); event.stopImmediatePropagation();
      const submit = form.querySelector('[type="submit"]');
      withBusy(submit, async () => {
        try {
          const data = new FormData(form);
          const current = await community();
          const body = await patchCommunity({
            headline:data.get('headline'), style:data.get('style'), accent:data.get('accent'),
            bannerUploadId:current.custom?.bannerUploadId || '',
            showXp:data.get('showXp') === 'on', showJoinDate:data.get('showJoinDate') === 'on', showFriendCount:data.get('showFriendCount') === 'on'
          });
          updateAppearancePreview(body);
          msg('profileV3AppearanceMessage','Aparência atualizada sem recarregar o painel.');
        } catch (error) { msg('profileV3AppearanceMessage',error.message,'error'); }
      });
      return;
    }

    if (form.id === 'profileV3EquipForm') {
      event.preventDefault(); event.stopImmediatePropagation();
      const submit = form.querySelector('[type="submit"]');
      withBusy(submit, async () => {
        const data = new FormData(form);
        const tags = data.getAll('tagId');
        if (tags.length > 3) return msg('profileV3EquipMessage','Você pode equipar até 3 tags.','error');
        try {
          const result = await S.api('/api/profile-store/equipped', { method:'PATCH', body:{ tagIds:tags, frameId:data.get('frameId'), decorationId:data.get('decorationId') } });
          updateEquipped(result, data);
          msg('profileV3EquipMessage','Itens equipados sem recarregar o painel.');
        } catch (error) { msg('profileV3EquipMessage',error.message,'error'); }
      });
      return;
    }

    if (form.id === 'profileV3IdentityForm') {
      event.preventDefault(); event.stopImmediatePropagation();
      const submit = form.querySelector('[type="submit"]');
      withBusy(submit, async () => {
        try {
          const data = new FormData(form);
          await patchSocial({ displayName:data.get('displayName'), status:data.get('status'), bio:data.get('bio') });
          const h2 = document.querySelector('.profile-v3-preview .profile-v3-copy h2');
          if (h2) h2.textContent = String(data.get('displayName') || '');
          msg('profileV3IdentityMessage','Identidade atualizada sem recarregar o painel.');
        } catch (error) { msg('profileV3IdentityMessage',error.message,'error'); }
      });
      return;
    }

    if (form.id === 'profileV3HandleForm') {
      event.preventDefault(); event.stopImmediatePropagation();
      const submit = form.querySelector('[type="submit"]');
      withBusy(submit, async () => {
        const data = new FormData(form);
        try {
          await S.api('/api/social/account/username', { method:'POST', body:{ username:data.get('username'), password:data.get('password') } });
          if (socialCache?.account) socialCache.account.username = String(data.get('username') || '');
          const handle = document.querySelector('.profile-v3-handle');
          if (handle) handle.textContent = `@${data.get('username')}`;
          const publicLink = document.querySelector('a[href^="/u/"]');
          if (publicLink) publicLink.href = `/u/${encodeURIComponent(String(data.get('username') || ''))}`;
          const password = form.querySelector('input[name="password"]');
          if (password) password.value = '';
          msg('profileV3HandleMessage','@ atualizado.');
        } catch (error) { msg('profileV3HandleMessage',error.message,'error'); }
      });
    }
  }, true);

  document.addEventListener('click', event => {
    const target = event.target.closest?.('button');
    if (!target) return;

    if (target.id === 'profileV3PrivacySave') {
      event.preventDefault(); event.stopImmediatePropagation();
      withBusy(target, async () => {
        try {
          const checks = document.getElementById('profileV3PrivacyChecks');
          const privacy = Object.fromEntries([...checks.querySelectorAll('input[type="checkbox"]')].map(input => [input.name,input.checked]));
          await patchSocial({ privacy });
          msg('profileV3IdentityMessage','Privacidade atualizada.');
        } catch (error) { msg('profileV3IdentityMessage',error.message,'error'); }
      });
      return;
    }

    if (target.matches('[data-buy-profile-item]')) {
      event.preventDefault(); event.stopImmediatePropagation();
      withBusy(target, async () => {
        const id = target.dataset.buyProfileItem;
        try {
          const result = await S.api(`/api/profile-store/buy/${encodeURIComponent(id)}`, { method:'POST' });
          target.textContent = 'Comprado';
          target.removeAttribute('data-buy-profile-item');
          target.classList.remove('primary');
          target.disabled = true;
          addOwnedToEquip(result.purchased);
          document.querySelectorAll('.profile-wallet-pill').forEach(pill => {
            if (result.wallet?.balance != null) pill.lastChild.textContent = ` ${Number(result.wallet.balance).toLocaleString('pt-BR')} moedas`;
          });
          msg('profileV3StoreMessage','Item comprado sem recarregar toda a página.');
        } catch (error) { msg('profileV3StoreMessage',error.message,'error'); }
      });
      return;
    }

    if (target.id === 'profileV3AvatarUpload') {
      event.preventDefault(); event.stopImmediatePropagation();
      withBusy(target, async () => {
        const file = document.getElementById('profileV3AvatarFile')?.files?.[0];
        if (!file) return msg('profileV3IdentityMessage','Selecione uma imagem.','error');
        try {
          const uploadId = await upload(file);
          await patchSocial({ avatarUploadId:uploadId });
          const url = URL.createObjectURL(file);
          document.querySelectorAll('.profile-v3-upload-preview:not(.cover),.profile-v3-preview .cosmetic-avatar-inner').forEach(holder => {
            holder.innerHTML = '';
            const img = document.createElement('img'); img.src = url; img.alt = ''; holder.appendChild(img);
          });
          msg('profileV3IdentityMessage','Foto de perfil atualizada.');
        } catch (error) { msg('profileV3IdentityMessage',error.message,'error'); }
      });
      return;
    }

    if (target.id === 'profileV3AvatarRemove') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!confirm('Remover a foto de perfil atual?')) return;
      withBusy(target, async () => {
        try {
          await patchSocial({ avatarUploadId:'' });
          const data = await social();
          const initial = String(data.account?.profile?.displayName || data.account?.username || '?').slice(0,1).toUpperCase();
          document.querySelectorAll('.profile-v3-upload-preview:not(.cover),.profile-v3-preview .cosmetic-avatar-inner').forEach(holder => { holder.textContent = initial; });
          msg('profileV3IdentityMessage','Foto removida.');
        } catch (error) { msg('profileV3IdentityMessage',error.message,'error'); }
      });
      return;
    }

    if (target.id === 'profileV3BannerUpload') {
      event.preventDefault(); event.stopImmediatePropagation();
      withBusy(target, async () => {
        const file = document.getElementById('profileV3BannerFile')?.files?.[0];
        if (!file) return msg('profileV3AppearanceMessage','Selecione uma imagem.','error');
        try {
          const uploadId = await upload(file);
          await patchCommunity({ bannerUploadId:uploadId });
          const url = URL.createObjectURL(file);
          const cover = document.querySelector('.profile-v3-upload-preview.cover');
          if (cover) cover.innerHTML = `<img src="${S.escapeHtml(url)}" alt="">`;
          const bg = document.querySelector('.profile-v3-preview-bg');
          if (bg) bg.innerHTML = `<img src="${S.escapeHtml(url)}" alt="">`;
          msg('profileV3AppearanceMessage','Fundo atualizado.');
        } catch (error) { msg('profileV3AppearanceMessage',error.message,'error'); }
      });
      return;
    }

    if (target.id === 'profileV3BannerRemove') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!confirm('Remover o fundo atual?')) return;
      withBusy(target, async () => {
        try {
          await patchCommunity({ bannerUploadId:'' });
          const cover = document.querySelector('.profile-v3-upload-preview.cover');
          if (cover) cover.innerHTML = '<span class="hint">Sem capa</span>';
          document.querySelector('.profile-v3-preview-bg img')?.remove();
          msg('profileV3AppearanceMessage','Fundo removido.');
        } catch (error) { msg('profileV3AppearanceMessage',error.message,'error'); }
      });
    }
  }, true);
})();
