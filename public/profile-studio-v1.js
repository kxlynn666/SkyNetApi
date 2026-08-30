(() => {
  if (window.__SKYNET_PROFILE_STUDIO_V1__) return;
  window.__SKYNET_PROFILE_STUDIO_V1__ = true;
  if ((location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil/studio') return;

  const S = window.SkyNet;
  if (!S) return;
  let studio = null;
  let social = null;
  let community = null;
  let draft = null;
  let dirty = false;

  installStyles();
  waitForWorkspace();

  function waitForWorkspace(attempt = 0) {
    const shell = document.getElementById('workspaceShell');
    const root = document.getElementById('workspaceContent');
    if (!shell || !root || shell.classList.contains('hidden')) {
      if (attempt < 120) setTimeout(() => waitForWorkspace(attempt + 1), 80);
      return;
    }
    load();
  }

  async function load() {
    setHeading();
    const root = document.getElementById('workspaceContent');
    root.innerHTML = '<div class="studio-loading-v1">Carregando Profile Studio…</div>';
    try {
      [studio, social, community] = await Promise.all([
        S.api('/api/profile-studio/me'),
        S.api('/api/social/me'),
        S.api('/api/community/profile/me')
      ]);
      draft = makeDraft();
      render();
    } catch (error) {
      root.innerHTML = `<div class="message show error">${S.escapeHtml(error.message || 'Não foi possível abrir o Profile Studio.')}</div>`;
    }
  }

  function makeDraft() {
    const profile = social?.account?.profile || {};
    const custom = community?.custom || {};
    return {
      identity: {
        displayName: profile.displayName || social?.account?.username || '',
        bio: profile.bio || '',
        status: profile.status || '',
        headline: custom.headline || '',
        pronouns: studio.identity?.pronouns || '',
        location: studio.identity?.location || '',
        website: studio.identity?.website || '',
        links: [...(studio.identity?.links || [])],
        privacy: { ...(profile.privacy || {}) },
        avatarUploadId: profile.avatarUploadId || ''
      },
      design: JSON.parse(JSON.stringify(studio.design || {}))
    };
  }

  function setHeading() {
    document.getElementById('workspaceKicker').textContent = 'Perfil';
    document.getElementById('workspaceTitle').textContent = 'Profile Studio';
    document.getElementById('workspaceDescription').textContent = 'Controle fino do perfil com preview ao vivo e defaults seguros.';
    document.title = 'Profile Studio - SkyNetApi';
  }

  function render() {
    const root = document.getElementById('workspaceContent');
    const username = social?.account?.username || '';
    root.innerHTML = `
      <div class="profile-studio-v1">
        <section class="studio-toolbar-v1 workspace-card">
          <div>
            <span class="studio-eyebrow-v1">PERSONALIZAÇÃO AVANÇADA</span>
            <h2>Seu perfil, sem presets obrigatórios.</h2>
            <p>Altere identidade, cores, proporções, tipografia, componentes, visibilidade e ordem das seções. O público recebe apenas valores sanitizados.</p>
          </div>
          <div class="studio-toolbar-actions-v1">
            <a class="button" href="/u/${encodeURIComponent(username)}" target="_blank" rel="noopener">Ver público</a>
            <button class="button" id="studioResetV1" type="button">Restaurar visual</button>
            <button class="button primary" id="studioSaveV1" type="button">Salvar alterações</button>
          </div>
        </section>
        <div class="message studio-message-v1" id="studioMessageV1"></div>
        <div class="studio-grid-v1">
          <aside class="studio-preview-column-v1">
            <div class="studio-preview-sticky-v1">
              <div class="studio-preview-label-v1"><span>Preview ao vivo</span><span id="studioDirtyV1">Salvo</span></div>
              <div id="studioPreviewV1"></div>
              <div class="studio-preview-note-v1">O preview usa os mesmos tokens aplicados ao perfil público. Imagens, molduras e decorações continuam vindo da sua biblioteca atual.</div>
            </div>
          </aside>
          <main class="studio-controls-v1">
            ${identityPanel()}
            ${(studio.schema || []).map(schemaGroup).join('')}
          </main>
        </div>
      </div>`;

    bindIdentity();
    bindDesign();
    bindActions();
    renderPreview();
  }

  function identityPanel() {
    const i = draft.identity;
    const privacy = i.privacy || {};
    return `<section class="studio-panel-v1 workspace-card" data-studio-group="identity">
      <div class="studio-panel-head-v1"><div><span>Identidade</span><h3>Informações públicas</h3><p>Dados de apresentação e privacidade ficam separados do visual.</p></div></div>
      <div class="studio-fields-grid-v1">
        ${textField('displayName', 'Nome de exibição', i.displayName, 50)}
        ${textField('status', 'Status curto', i.status, 60)}
        ${textField('headline', 'Headline', i.headline, 90)}
        ${textField('pronouns', 'Pronomes', i.pronouns, 32)}
        ${textField('location', 'Localização', i.location, 80)}
        ${textField('website', 'Website', i.website, 320, 'url')}
        <label class="studio-field-v1 studio-field-wide-v1"><span>Bio</span><textarea data-identity="bio" maxlength="320" rows="4">${S.escapeHtml(i.bio)}</textarea><small><b data-counter="bio">${i.bio.length}</b>/320</small></label>
      </div>
      <div class="studio-subhead-v1"><strong>Links</strong><span>Até 6 links públicos. Protocolos fora de HTTP/HTTPS são descartados.</span></div>
      <div class="studio-links-v1" id="studioLinksV1">${linksEditor()}</div>
      <div class="studio-subhead-v1"><strong>Privacidade e descoberta</strong><span>Controles existentes da conta, reunidos aqui para evitar configurações espalhadas.</span></div>
      <div class="studio-toggle-grid-v1">
        ${privacyToggle('allowFriendRequests', 'Solicitações de amizade', privacy.allowFriendRequests !== false)}
        ${privacyToggle('allowCallsFromFriends', 'Chamadas de amigos', privacy.allowCallsFromFriends !== false)}
        ${privacyToggle('showOnPodium', 'Aparecer em rankings', privacy.showOnPodium !== false)}
        ${privacyToggle('showOnline', 'Mostrar presença online', privacy.showOnline !== false)}
      </div>
    </section>`;
  }

  function linksEditor() {
    const links = [...draft.identity.links];
    while (links.length < 3) links.push({ label: '', url: '' });
    return links.slice(0, 6).map((link, index) => `<div class="studio-link-row-v1" data-link-row="${index}">
      <input data-link-label="${index}" maxlength="40" placeholder="Rótulo" value="${S.escapeHtml(link.label || '')}">
      <input data-link-url="${index}" maxlength="320" type="url" placeholder="https://…" value="${S.escapeHtml(link.url || '')}">
      <button class="button small" type="button" data-remove-link="${index}" aria-label="Remover link">×</button>
    </div>`).join('') + '<button class="button small" id="studioAddLinkV1" type="button">Adicionar link</button>';
  }

  function schemaGroup(group) {
    return `<section class="studio-panel-v1 workspace-card" data-studio-group="${S.escapeHtml(group.id)}">
      <div class="studio-panel-head-v1"><div><span>${S.escapeHtml(group.id)}</span><h3>${S.escapeHtml(group.label)}</h3></div></div>
      <div class="studio-fields-grid-v1">${group.fields.map(schemaField).join('')}</div>
    </section>`;
  }

  function schemaField(field) {
    const value = draft.design[field.key];
    if (field.type === 'color') {
      return `<label class="studio-field-v1"><span>${S.escapeHtml(field.label)}</span><div class="studio-color-v1"><input type="color" data-design="${field.key}" value="${S.escapeHtml(value)}"><code data-color-value="${field.key}">${S.escapeHtml(value)}</code></div></label>`;
    }
    if (field.type === 'number') {
      return `<label class="studio-field-v1"><span>${S.escapeHtml(field.label)}</span><div class="studio-range-v1"><input type="range" data-design="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}" value="${Number(value)}"><output data-output="${field.key}">${Number(value)}${S.escapeHtml(field.unit || '')}</output></div></label>`;
    }
    if (field.type === 'select') {
      return `<label class="studio-field-v1"><span>${S.escapeHtml(field.label)}</span><select data-design="${field.key}">${field.options.map(option => `<option value="${S.escapeHtml(option)}" ${String(value) === option ? 'selected' : ''}>${S.escapeHtml(pretty(option))}</option>`).join('')}</select></label>`;
    }
    if (field.type === 'toggle') {
      return `<label class="studio-switch-v1"><input type="checkbox" data-design="${field.key}" ${value ? 'checked' : ''}><span><strong>${S.escapeHtml(field.label)}</strong><small>${value ? 'Visível' : 'Oculto'}</small></span></label>`;
    }
    if (field.type === 'order') return orderEditor(field);
    return '';
  }

  function orderEditor(field) {
    const labels = new Map((field.options || []).map(option => [option.value, option.label]));
    return `<div class="studio-order-v1 studio-field-wide-v1" id="studioOrderV1">${draft.design.sectionOrder.map((id, index) => `<div class="studio-order-row-v1" data-section="${S.escapeHtml(id)}"><span><b>${index + 1}</b>${S.escapeHtml(labels.get(id) || id)}</span><div><button type="button" class="button small" data-order-up="${index}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="button small" data-order-down="${index}" ${index === draft.design.sectionOrder.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('')}</div>`;
  }

  function textField(key, label, value, max, type = 'text') {
    return `<label class="studio-field-v1"><span>${S.escapeHtml(label)}</span><input type="${type}" data-identity="${key}" maxlength="${max}" value="${S.escapeHtml(value || '')}"><small><b data-counter="${key}">${String(value || '').length}</b>/${max}</small></label>`;
  }

  function privacyToggle(key, label, checked) {
    return `<label class="studio-switch-v1"><input type="checkbox" data-privacy="${key}" ${checked ? 'checked' : ''}><span><strong>${S.escapeHtml(label)}</strong><small>${checked ? 'Permitido' : 'Desativado'}</small></span></label>`;
  }

  function bindIdentity() {
    document.querySelectorAll('[data-identity]').forEach(input => input.addEventListener('input', () => {
      draft.identity[input.dataset.identity] = input.value;
      const counter = document.querySelector(`[data-counter="${input.dataset.identity}"]`);
      if (counter) counter.textContent = input.value.length;
      changed();
    }));
    document.querySelectorAll('[data-privacy]').forEach(input => input.addEventListener('change', () => {
      draft.identity.privacy[input.dataset.privacy] = input.checked;
      input.parentElement.querySelector('small').textContent = input.checked ? 'Permitido' : 'Desativado';
      changed();
    }));
    bindLinkInputs();
    document.getElementById('studioAddLinkV1')?.addEventListener('click', addLink);
  }

  function bindLinkInputs() {
    document.querySelectorAll('[data-link-label],[data-link-url]').forEach(input => input.addEventListener('input', syncLinks));
    document.querySelectorAll('[data-remove-link]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.removeLink);
      if (Number.isInteger(index)) draft.identity.links.splice(index, 1);
      refreshLinks();
      changed();
    }));
  }

  function syncLinks() {
    const rows = [...document.querySelectorAll('[data-link-row]')];
    draft.identity.links = rows.map(row => {
      const index = row.dataset.linkRow;
      return {
        label: row.querySelector(`[data-link-label="${index}"]`)?.value || '',
        url: row.querySelector(`[data-link-url="${index}"]`)?.value || ''
      };
    });
    changed();
  }

  function addLink() {
    syncLinks();
    if (draft.identity.links.length >= 6) return;
    draft.identity.links.push({ label: '', url: '' });
    refreshLinks();
    changed();
  }

  function refreshLinks() {
    const root = document.getElementById('studioLinksV1');
    if (!root) return;
    root.innerHTML = linksEditor();
    bindLinkInputs();
    document.getElementById('studioAddLinkV1')?.addEventListener('click', addLink);
  }

  function bindDesign() {
    document.querySelectorAll('[data-design]').forEach(input => {
      const event = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(event, () => {
        const key = input.dataset.design;
        draft.design[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
        const output = document.querySelector(`[data-output="${key}"]`);
        if (output) {
          const schemaField = findSchemaField(key);
          output.value = `${input.value}${schemaField?.unit || ''}`;
          output.textContent = `${input.value}${schemaField?.unit || ''}`;
        }
        const color = document.querySelector(`[data-color-value="${key}"]`);
        if (color) color.textContent = input.value;
        if (input.type === 'checkbox') input.parentElement.querySelector('small').textContent = input.checked ? 'Visível' : 'Oculto';
        changed();
      });
    });
    bindOrder();
  }

  function bindOrder() {
    document.querySelectorAll('[data-order-up],[data-order-down]').forEach(button => button.addEventListener('click', () => {
      const isUp = Object.prototype.hasOwnProperty.call(button.dataset, 'orderUp');
      const index = Number(isUp ? button.dataset.orderUp : button.dataset.orderDown);
      const target = isUp ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= draft.design.sectionOrder.length) return;
      [draft.design.sectionOrder[index], draft.design.sectionOrder[target]] = [draft.design.sectionOrder[target], draft.design.sectionOrder[index]];
      const group = document.querySelector('[data-studio-group="sections"] .studio-fields-grid-v1');
      const field = findSchemaField('sectionOrder');
      if (group && field) group.innerHTML = orderEditor(field);
      bindOrder();
      changed();
    }));
  }

  function bindActions() {
    document.getElementById('studioSaveV1')?.addEventListener('click', save);
    document.getElementById('studioResetV1')?.addEventListener('click', resetDesign);
    window.addEventListener('beforeunload', beforeUnload);
  }

  function beforeUnload(event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async function save() {
    syncLinks();
    const button = document.getElementById('studioSaveV1');
    const message = document.getElementById('studioMessageV1');
    if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
    S.message(message, '', '');
    try {
      const profile = social?.account?.profile || {};
      const socialBody = {
        displayName: draft.identity.displayName,
        bio: draft.identity.bio,
        status: draft.identity.status,
        avatarUploadId: profile.avatarUploadId || '',
        privacy: draft.identity.privacy
      };
      const studioBody = {
        identity: {
          pronouns: draft.identity.pronouns,
          location: draft.identity.location,
          website: draft.identity.website,
          links: draft.identity.links
        },
        design: draft.design
      };
      const [socialSaved, communitySaved, studioSaved] = await Promise.all([
        S.api('/api/social/account/profile', { method: 'PATCH', body: socialBody }),
        S.api('/api/community/profile/me', { method: 'PATCH', body: { headline: draft.identity.headline } }),
        S.api('/api/profile-studio/me', { method: 'PATCH', body: studioBody })
      ]);
      social.account.profile = socialSaved.profile;
      community.custom = communitySaved.custom;
      studio.identity = studioSaved.identity;
      studio.design = studioSaved.design;
      draft = makeDraft();
      setDirty(false);
      renderPreview();
      S.message(message, 'Perfil salvo. A página pública já usa essas configurações.', 'success');
    } catch (error) {
      S.message(message, error.message || 'Não foi possível salvar o perfil.', 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Salvar alterações'; }
    }
  }

  async function resetDesign() {
    const message = document.getElementById('studioMessageV1');
    try {
      const data = await S.api('/api/profile-studio/me/reset?scope=design', { method: 'POST' });
      studio.design = data.design;
      draft.design = JSON.parse(JSON.stringify(data.design));
      setDirty(true);
      render();
      S.message(document.getElementById('studioMessageV1'), 'Visual restaurado para o padrão profissional. Salve os demais dados quando terminar.', 'success');
    } catch (error) {
      S.message(message, error.message || 'Não foi possível restaurar o visual.', 'error');
    }
  }

  function changed() {
    setDirty(true);
    renderPreview();
  }

  function setDirty(value) {
    dirty = value;
    const badge = document.getElementById('studioDirtyV1');
    if (badge) { badge.textContent = value ? 'Alterações não salvas' : 'Salvo'; badge.classList.toggle('dirty', value); }
  }

  function renderPreview() {
    const root = document.getElementById('studioPreviewV1');
    if (!root || !draft) return;
    const d = draft.design;
    const i = draft.identity;
    const username = social?.account?.username || 'usuario';
    const custom = community?.custom || {};
    const publicData = community?.public || {};
    const avatarUrl = social?.account?.avatarUrl || publicData.avatarUrl || '';
    const bannerUrl = publicData.bannerUrl || '';
    const initial = String(i.displayName || username || '?').slice(0, 1).toUpperCase();
    const style = studioStyle(d);
    const sections = {
      identity: `<div class="studio-preview-identity-v1"><div class="studio-preview-avatar-v1">${avatarUrl ? `<img src="${S.escapeHtml(avatarUrl)}" alt="">` : S.escapeHtml(initial)}</div><div class="studio-preview-copy-v1"><h1>${S.escapeHtml(i.displayName || username)}</h1>${d.showHandle ? `<div class="studio-preview-handle-v1">@${S.escapeHtml(username)}</div>` : ''}${d.showPronouns && i.pronouns ? `<span>${S.escapeHtml(i.pronouns)}</span>` : ''}${d.showHeadline && i.headline ? `<p>${S.escapeHtml(i.headline)}</p>` : ''}${d.showLocation && i.location ? `<small>⌖ ${S.escapeHtml(i.location)}</small>` : ''}</div></div>`,
      status: d.showStatus && i.status ? `<div class="studio-preview-status-v1">${S.escapeHtml(i.status)}</div>` : '',
      bio: d.showBio ? `<div class="studio-preview-bio-v1">${S.escapeHtml(i.bio || 'Sua bio aparece aqui. O padrão mantém leitura confortável e pouco ruído visual.')}</div>` : '',
      links: d.showLinks ? previewLinks(i) : '',
      stats: d.showStats ? `<div class="studio-preview-stats-v1">${['XP', 'Level', 'Requests', 'Amigos', 'Cards', 'Uploads'].map((label, index) => `<div><strong>${[1280, 12, 384, 18, 42, 9][index]}</strong><span>${label}</span></div>`).join('')}</div>` : '',
      join: d.showJoinDate ? '<div class="studio-preview-join-v1">Membro desde ago. de 2026</div>' : ''
    };
    root.innerHTML = `<article class="studio-preview-card-v1" style="${style}"><div class="studio-preview-banner-v1">${bannerUrl ? `<img src="${S.escapeHtml(bannerUrl)}" alt="">` : ''}</div><div class="studio-preview-body-v1">${d.sectionOrder.map(id => sections[id] || '').join('')}</div></article>`;
  }

  function previewLinks(i) {
    const links = i.links.filter(link => link.url).slice(0, 3);
    if (!links.length && !i.website) return '<div class="studio-preview-links-v1"><a>portfolio.dev</a><a>github.com/user</a></div>';
    const all = [...(i.website ? [{ label: 'Website', url: i.website }] : []), ...links];
    return `<div class="studio-preview-links-v1">${all.slice(0, 4).map(link => `<a>${S.escapeHtml(link.label || link.url)}</a>`).join('')}</div>`;
  }

  function studioStyle(d) {
    const vars = {
      '--ps-width': `${d.profileWidth}px`, '--ps-banner': `${d.bannerHeight}px`, '--ps-avatar': `${d.avatarSize}px`, '--ps-avatar-offset': `${d.avatarOffset}px`,
      '--ps-pad': `${d.contentPadding}px`, '--ps-gap': `${d.sectionGap}px`, '--ps-cols': d.statsColumns, '--ps-radius': `${d.surfaceRadius}px`,
      '--ps-opacity': d.surfaceOpacity / 100, '--ps-blur': `${d.surfaceBlur}px`, '--ps-border-w': `${d.borderWidth}px`, '--ps-shadow': d.shadowStrength / 100,
      '--ps-overlay': d.bannerOverlay / 100, '--ps-avatar-border': `${d.avatarBorderWidth}px`, '--ps-sat': `${d.bannerSaturation}%`, '--ps-contrast': `${d.bannerContrast}%`,
      '--ps-lift': `${d.hoverLift}px`, '--ps-glow': d.glowStrength / 100, '--ps-name': `${d.nameSize}px`, '--ps-body': `${d.bodySize}px`, '--ps-letter': `${d.letterSpacing}px`,
      '--ps-page': d.pageBackground, '--ps-surface': d.surfaceColor, '--ps-surface-alt': d.surfaceAltColor, '--ps-text': d.textColor, '--ps-muted': d.mutedColor,
      '--ps-accent': d.accentColor, '--ps-accent2': d.accentSecondary, '--ps-border': d.borderColor, '--ps-avatar-border-color': d.avatarBorderColor,
      '--ps-grad-from': d.gradientFrom, '--ps-grad-to': d.gradientTo, '--ps-tint': d.bannerTintColor, '--ps-angle': `${d.gradientAngle}deg`, '--ps-weight': d.nameWeight,
      '--ps-align': d.textAlign, '--ps-banner-focus': d.bannerFocus
    };
    return Object.entries(vars).map(([key, value]) => `${key}:${value}`).join(';') + `;--ps-font:${fontStack(d.fontFamily)};--ps-avatar-radius:${avatarRadius(d.avatarShape)};--ps-bg:${d.backgroundMode === 'solid' ? d.pageBackground : `linear-gradient(${d.gradientAngle}deg,${d.gradientFrom},${d.gradientTo})`}`;
  }

  function fontStack(value) {
    return ({ system: 'Inter,system-ui,sans-serif', rounded: 'Nunito,Inter,system-ui,sans-serif', mono: 'ui-monospace,SFMono-Regular,Menlo,monospace', serif: 'Georgia,serif', display: 'Inter,system-ui,sans-serif' })[value] || 'Inter,system-ui,sans-serif';
  }
  function avatarRadius(value) { return ({ circle: '50%', rounded: '24%', squircle: '32%', square: '4%' })[value] || '24%'; }
  function pretty(value) { return String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  function findSchemaField(key) { for (const group of studio.schema || []) for (const field of group.fields || []) if (field.key === key) return field; return null; }

  function installStyles() {
    if (document.getElementById('profileStudioV1Styles')) return;
    const style = document.createElement('style');
    style.id = 'profileStudioV1Styles';
    style.textContent = `
      .profile-studio-v1{display:grid;gap:16px;max-width:1500px;margin:0 auto}.studio-loading-v1{padding:28px;color:var(--theme-muted)}.studio-toolbar-v1{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.studio-toolbar-v1 h2{margin:4px 0 7px;font-size:20px}.studio-toolbar-v1 p{max-width:760px;margin:0;color:var(--theme-muted);line-height:1.55}.studio-eyebrow-v1{font-size:9px;letter-spacing:.14em;color:var(--theme-primary);font-weight:800}.studio-toolbar-actions-v1{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.studio-message-v1{margin:0}.studio-grid-v1{display:grid;grid-template-columns:minmax(330px,.82fr) minmax(520px,1.18fr);gap:16px;align-items:start}.studio-preview-sticky-v1{position:sticky;top:86px}.studio-preview-label-v1{display:flex;justify-content:space-between;gap:12px;padding:0 4px 8px;color:var(--theme-muted);font-size:10px}.studio-preview-label-v1 span:last-child{color:#86efac}.studio-preview-label-v1 span.dirty{color:#fbbf24}.studio-preview-note-v1{padding:10px 4px 0;color:var(--theme-muted);font-size:9px;line-height:1.5}.studio-controls-v1{display:grid;gap:12px}.studio-panel-v1{padding:18px}.studio-panel-head-v1{display:flex;justify-content:space-between;gap:12px;margin-bottom:16px}.studio-panel-head-v1 span{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--theme-primary)}.studio-panel-head-v1 h3{margin:3px 0 0;font-size:16px}.studio-panel-head-v1 p{margin:4px 0 0;font-size:10px;color:var(--theme-muted)}.studio-fields-grid-v1{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.studio-field-v1{display:grid;gap:6px;min-width:0}.studio-field-v1>span{font-size:10px;font-weight:700;color:var(--theme-text)}.studio-field-v1 input,.studio-field-v1 select,.studio-field-v1 textarea{width:100%}.studio-field-v1 small{font-size:8px;color:var(--theme-muted);text-align:right}.studio-field-wide-v1{grid-column:1/-1}.studio-range-v1{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px}.studio-range-v1 output{min-width:52px;text-align:right;font:700 9px ui-monospace,monospace;color:var(--theme-muted)}.studio-color-v1{display:flex;align-items:center;gap:9px;padding:6px 8px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-field)}.studio-color-v1 input{width:36px;height:28px;padding:0;border:0;background:transparent}.studio-color-v1 code{font-size:9px}.studio-toggle-grid-v1{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.studio-switch-v1{display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px solid var(--theme-border-soft);border-radius:11px;background:var(--theme-field);cursor:pointer}.studio-switch-v1 input{width:auto}.studio-switch-v1 strong,.studio-switch-v1 small{display:block}.studio-switch-v1 strong{font-size:10px}.studio-switch-v1 small{font-size:8px;color:var(--theme-muted);margin-top:2px}.studio-subhead-v1{display:flex;justify-content:space-between;gap:12px;margin:18px 0 8px}.studio-subhead-v1 strong{font-size:11px}.studio-subhead-v1 span{font-size:9px;color:var(--theme-muted);text-align:right}.studio-links-v1{display:grid;gap:7px}.studio-link-row-v1{display:grid;grid-template-columns:minmax(100px,.55fr) minmax(180px,1.45fr) auto;gap:7px}.studio-order-v1{display:grid;gap:6px}.studio-order-row-v1{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:1px solid var(--theme-border-soft);border-radius:10px;background:var(--theme-field)}.studio-order-row-v1>span{display:flex;align-items:center;gap:9px;font-size:10px;font-weight:700}.studio-order-row-v1 b{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:color-mix(in srgb,var(--theme-primary) 12%,transparent);color:var(--theme-primary)}.studio-order-row-v1>div{display:flex;gap:5px}
      .studio-preview-card-v1{width:min(100%,var(--ps-width));margin:auto;background:var(--ps-bg);color:var(--ps-text);font-family:var(--ps-font);font-size:var(--ps-body);letter-spacing:var(--ps-letter);border:var(--ps-border-w) solid var(--ps-border);border-radius:var(--ps-radius);overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,var(--ps-shadow)),0 0 45px color-mix(in srgb,var(--ps-accent) calc(var(--ps-glow) * 100%),transparent);transition:transform .2s ease}.studio-preview-card-v1:hover{transform:translateY(calc(var(--ps-lift) * -1))}.studio-preview-banner-v1{height:var(--ps-banner);position:relative;background:linear-gradient(var(--ps-angle),var(--ps-grad-from),var(--ps-grad-to));overflow:hidden}.studio-preview-banner-v1 img{width:100%;height:100%;object-fit:cover;object-position:var(--ps-banner-focus);filter:saturate(var(--ps-sat)) contrast(var(--ps-contrast))}.studio-preview-banner-v1:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,color-mix(in srgb,var(--ps-tint) calc(var(--ps-overlay) * 100%),transparent),transparent 72%)}.studio-preview-body-v1{display:grid;gap:var(--ps-gap);padding:0 var(--ps-pad) var(--ps-pad);text-align:var(--ps-align);background:color-mix(in srgb,var(--ps-surface) calc(var(--ps-opacity) * 100%),transparent);backdrop-filter:blur(var(--ps-blur))}.studio-preview-identity-v1{display:flex;align-items:flex-end;gap:15px;margin-top:var(--ps-avatar-offset)}.studio-preview-avatar-v1{width:var(--ps-avatar);height:var(--ps-avatar);flex:0 0 auto;border-radius:var(--ps-avatar-radius);overflow:hidden;display:grid;place-items:center;background:var(--ps-surface-alt);border:var(--ps-avatar-border) solid var(--ps-avatar-border-color);font-size:calc(var(--ps-avatar) * .3);font-weight:800}.studio-preview-avatar-v1 img{width:100%;height:100%;object-fit:cover}.studio-preview-copy-v1{min-width:0;padding-bottom:4px}.studio-preview-copy-v1 h1{margin:0;font-size:var(--ps-name);font-weight:var(--ps-weight);line-height:1.02}.studio-preview-copy-v1 p,.studio-preview-copy-v1 small,.studio-preview-handle-v1{margin:4px 0 0;color:var(--ps-muted);font-size:.84em}.studio-preview-copy-v1>span{display:inline-block;margin-top:5px;padding:3px 7px;border-radius:999px;background:var(--ps-surface-alt);color:var(--ps-muted);font-size:.72em}.studio-preview-status-v1{width:max-content;max-width:100%;padding:6px 10px;border:1px solid color-mix(in srgb,var(--ps-accent) 35%,var(--ps-border));border-radius:999px;background:color-mix(in srgb,var(--ps-accent) 9%,transparent);font-size:.82em}.studio-preview-bio-v1{color:var(--ps-muted);line-height:1.65;white-space:pre-wrap}.studio-preview-links-v1{display:flex;gap:7px;flex-wrap:wrap}.studio-preview-links-v1 a{padding:7px 10px;border-radius:10px;background:var(--ps-surface-alt);border:1px solid var(--ps-border);color:var(--ps-text);font-size:.76em}.studio-preview-stats-v1{display:grid;grid-template-columns:repeat(var(--ps-cols),minmax(0,1fr));gap:7px}.studio-preview-stats-v1>div{padding:9px;border:1px solid var(--ps-border);border-radius:11px;background:var(--ps-surface-alt)}.studio-preview-stats-v1 strong,.studio-preview-stats-v1 span{display:block}.studio-preview-stats-v1 strong{font-size:1em}.studio-preview-stats-v1 span{margin-top:2px;color:var(--ps-muted);font-size:.58em;text-transform:uppercase;letter-spacing:.06em}.studio-preview-join-v1{font-size:.72em;color:var(--ps-muted)}
      @media(max-width:1100px){.studio-grid-v1{grid-template-columns:1fr}.studio-preview-sticky-v1{position:relative;top:auto}.studio-preview-column-v1{order:-1}.studio-preview-card-v1{max-width:760px}}
      @media(max-width:720px){.studio-toolbar-v1{flex-direction:column}.studio-toolbar-actions-v1{width:100%;justify-content:stretch}.studio-toolbar-actions-v1 .button{flex:1}.studio-fields-grid-v1,.studio-toggle-grid-v1{grid-template-columns:1fr}.studio-field-wide-v1{grid-column:auto}.studio-link-row-v1{grid-template-columns:1fr auto}.studio-link-row-v1 input[data-link-url]{grid-column:1/-1;grid-row:2}.studio-preview-identity-v1{align-items:flex-end}.studio-preview-stats-v1{grid-template-columns:repeat(2,minmax(0,1fr))}.studio-panel-v1{padding:14px}.studio-subhead-v1{display:block}.studio-subhead-v1 span{display:block;text-align:left;margin-top:3px}}
      @media(prefers-reduced-motion:reduce){.studio-preview-card-v1{transition:none!important}.studio-preview-card-v1:hover{transform:none!important}}
    `;
    document.head.appendChild(style);
  }
})();
