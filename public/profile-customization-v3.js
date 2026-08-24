(() => {
    const S = window.SkyNet;
    if (!S || (location.pathname.replace(/\/+$/, '') || '/') !== '/painel/perfil') return;

    let snapshot = null;
    let rendering = false;

    ensureAssets();
    waitForBaseProfile();

    function ensureAssets() {
        if (!document.querySelector('link[data-profile-cosmetics]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/profile-cosmetics.css';
            link.dataset.profileCosmetics = '1';
            document.head.appendChild(link);
        }
        if (document.getElementById('profileCustomizationV3Styles')) return;
        const style = document.createElement('style');
        style.id = 'profileCustomizationV3Styles';
        style.textContent = `
            .profile-v3-shell{display:grid;gap:18px}.profile-v3-top{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:18px}.profile-v3-preview{aspect-ratio:4/3;min-height:330px;border:1px solid rgba(139,92,246,.22);border-radius:24px;background:linear-gradient(145deg,rgba(23,16,43,.96),rgba(11,7,19,.96));overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.22)}.profile-v3-preview-bg{position:absolute!important;inset:0;z-index:0!important;background:radial-gradient(circle at 20% 20%,color-mix(in srgb,var(--profile-accent,#a855f7) 28%,transparent),transparent 44%),linear-gradient(135deg,#17102b,#0b0713)}.profile-v3-preview-bg img{width:100%;height:100%;object-fit:cover;opacity:.55}.profile-v3-preview-shade{position:absolute!important;inset:0;z-index:1!important;background:linear-gradient(to top,rgba(6,4,12,.95),rgba(6,4,12,.28) 60%,rgba(6,4,12,.12))}.profile-v3-preview-content{height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:26px}.profile-v3-person{display:flex;align-items:flex-end;gap:16px}.profile-v3-person .cosmetic-avatar{width:92px;height:92px;border-radius:24px}.profile-v3-person .cosmetic-avatar-inner{border-radius:20px}.profile-v3-copy{min-width:0;flex:1}.profile-v3-copy h2{font-size:25px;margin:0 0 3px}.profile-v3-handle{font-size:12px;color:#c4b5fd}.profile-v3-headline{font-size:12px;color:var(--text-muted);margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.profile-v3-copy .profile-tags{margin-top:9px}.profile-v3-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:18px}.profile-v3-metric{padding:9px 10px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(8,6,16,.48);backdrop-filter:blur(10px)}.profile-v3-metric strong,.profile-v3-metric span{display:block}.profile-v3-metric strong{font-size:14px}.profile-v3-metric span{font-size:9px;color:#9488ad;margin-top:2px;text-transform:uppercase;letter-spacing:.05em}.profile-v3-summary{display:grid;align-content:start;gap:12px}.profile-v3-summary-card{padding:18px;border:1px solid rgba(139,92,246,.16);border-radius:18px;background:rgba(23,16,43,.72)}.profile-v3-summary-card h3{margin:0 0 7px;font-size:14px}.profile-v3-summary-card p{margin:0;color:var(--text-muted);font-size:12px;line-height:1.55}.profile-v3-wallet{display:flex;align-items:center;justify-content:space-between;gap:12px}.profile-v3-wallet strong{font-size:28px}.profile-v3-tabs{display:flex;gap:7px;padding:6px;border:1px solid rgba(139,92,246,.14);border-radius:16px;background:rgba(23,16,43,.6);overflow:auto}.profile-v3-tab{min-height:42px;padding:8px 14px;border:0;border-radius:11px;background:transparent;color:var(--text-muted);font-weight:700;cursor:pointer;white-space:nowrap}.profile-v3-tab.active{background:linear-gradient(135deg,rgba(139,92,246,.2),rgba(34,211,238,.09));color:#fff;box-shadow:inset 0 0 0 1px rgba(167,139,250,.18)}.profile-v3-panel{display:none}.profile-v3-panel.active{display:block}.profile-v3-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}.profile-v3-col-4{grid-column:span 4}.profile-v3-col-5{grid-column:span 5}.profile-v3-col-6{grid-column:span 6}.profile-v3-col-7{grid-column:span 7}.profile-v3-col-8{grid-column:span 8}.profile-v3-col-12{grid-column:1/-1}.profile-v3-card{padding:20px;border:1px solid rgba(139,92,246,.16);border-radius:18px;background:linear-gradient(180deg,rgba(24,16,44,.92),rgba(17,11,31,.92))}.profile-v3-card h3{margin:0 0 5px;font-size:15px}.profile-v3-card>.hint{margin-bottom:16px}.profile-v3-upload{display:grid;grid-template-columns:80px 1fr;gap:14px;align-items:center}.profile-v3-upload-preview{width:80px;height:80px;border-radius:18px;overflow:hidden;display:grid;place-items:center;border:1px solid var(--border);background:#211739;font-weight:800;font-size:24px}.profile-v3-upload-preview.cover{width:100%;height:110px;border-radius:16px;grid-column:1/-1}.profile-v3-upload-preview img{width:100%;height:100%;object-fit:cover}.profile-v3-upload-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.profile-v3-checks{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.profile-v3-check{display:flex;align-items:flex-start;gap:9px;padding:11px;border:1px solid var(--border-soft);border-radius:12px;background:rgba(30,22,56,.38)}.profile-v3-check input{width:auto;margin-top:2px}.profile-v3-check strong,.profile-v3-check span{display:block}.profile-v3-check span{font-size:10px;color:var(--text-faint);margin-top:2px}.profile-v3-inventory{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.profile-v3-choice{position:relative;display:block;padding:12px;border:1px solid var(--border-soft);border-radius:13px;background:rgba(30,22,56,.4);cursor:pointer}.profile-v3-choice input{position:absolute;opacity:0;pointer-events:none}.profile-v3-choice:has(input:checked){border-color:var(--violet-bright);box-shadow:0 0 0 1px rgba(167,139,250,.15),0 0 20px rgba(139,92,246,.09);background:rgba(139,92,246,.08)}.profile-v3-swatch{height:48px;border-radius:10px;background:linear-gradient(135deg,var(--sw-a,#8b5cf6),var(--sw-b,#22d3ee));margin-bottom:9px}.profile-v3-choice strong{display:block;font-size:12px}.profile-v3-choice span{font-size:10px;color:var(--text-faint)}.profile-v3-store-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}.profile-v3-store-filter{display:flex;gap:6px;overflow:auto}.profile-v3-store-filter button{border:1px solid var(--border-soft);background:rgba(30,22,56,.45);color:var(--text-muted);border-radius:999px;padding:7px 10px;cursor:pointer;white-space:nowrap}.profile-v3-store-filter button.active{color:#fff;border-color:rgba(167,139,250,.34);background:rgba(139,92,246,.13)}.profile-v3-store{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.profile-v3-product{padding:14px;border:1px solid var(--border-soft);border-radius:16px;background:rgba(30,22,56,.35);display:flex;flex-direction:column;min-height:185px}.profile-v3-product-visual{height:72px;border-radius:12px;background:linear-gradient(135deg,var(--p-a,#8b5cf6),var(--p-b,#22d3ee));display:grid;place-items:center;margin-bottom:12px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}.profile-v3-product-visual.tag span{font:800 12px 'JetBrains Mono',monospace;letter-spacing:.08em;padding:5px 10px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(0,0,0,.26)}.profile-v3-product-visual.frame span{width:46px;height:46px;border-radius:14px;border:4px solid rgba(255,255,255,.82);box-shadow:0 0 16px rgba(255,255,255,.34)}.profile-v3-product-visual.decoration span{width:70%;height:46px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:repeating-linear-gradient(45deg,rgba(255,255,255,.15) 0 1px,transparent 1px 9px)}.profile-v3-product-title{display:flex;justify-content:space-between;gap:7px;align-items:center}.profile-v3-product-title strong{font-size:13px}.profile-v3-price{display:flex;align-items:center;gap:5px;font-size:12px;color:#fde68a;margin:7px 0 12px}.profile-v3-price i{width:7px;height:7px;border-radius:50%;background:#facc15;box-shadow:0 0 10px rgba(250,204,21,.7)}.profile-v3-product .button{margin-top:auto;width:100%}.profile-v3-empty{padding:18px;border:1px dashed var(--border);border-radius:13px;color:var(--text-faint);text-align:center}.profile-v3-message{margin-bottom:12px}.profile-v3-divider{height:1px;background:var(--border-soft);margin:17px 0}.profile-v3-inline{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
            @media(max-width:1000px){.profile-v3-top{grid-template-columns:1fr}.profile-v3-preview{min-height:0}.profile-v3-col-4,.profile-v3-col-5,.profile-v3-col-6,.profile-v3-col-7,.profile-v3-col-8{grid-column:1/-1}}
            @media(max-width:620px){.profile-v3-shell{gap:12px}.profile-v3-preview{border-radius:18px}.profile-v3-preview-content{padding:16px}.profile-v3-person{gap:11px}.profile-v3-person .cosmetic-avatar{width:70px;height:70px;border-radius:19px}.profile-v3-person .cosmetic-avatar-inner{border-radius:16px}.profile-v3-copy h2{font-size:19px}.profile-v3-headline{display:none}.profile-v3-metrics{grid-template-columns:repeat(2,1fr);gap:6px;margin-top:12px}.profile-v3-summary{grid-template-columns:1fr 1fr}.profile-v3-summary-card{padding:14px}.profile-v3-summary-card:first-child{grid-column:1/-1}.profile-v3-wallet strong{font-size:22px}.profile-v3-tabs{position:sticky;top:72px;z-index:10}.profile-v3-tab{flex:1;padding:8px 10px;font-size:12px}.profile-v3-card{padding:15px}.profile-v3-checks,.profile-v3-inline{grid-template-columns:1fr}.profile-v3-store{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.profile-v3-product{padding:10px;min-height:170px}.profile-v3-product-visual{height:58px}.profile-v3-upload{grid-template-columns:64px 1fr}.profile-v3-upload-preview{width:64px;height:64px}.profile-v3-inventory{grid-template-columns:repeat(2,minmax(0,1fr))}}
            @media(max-width:390px){.profile-v3-store{grid-template-columns:1fr}.profile-v3-summary{grid-template-columns:1fr}.profile-v3-summary-card:first-child{grid-column:auto}}
        `;
        document.head.appendChild(style);
    }

    function waitForBaseProfile() {
        const ready = () => document.getElementById('profileForm') && document.getElementById('workspaceContent');
        if (ready()) return build();
        const observer = new MutationObserver(() => {
            if (!ready()) return;
            observer.disconnect();
            build();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);
    }

    async function build(activeTab = 'identity') {
        if (rendering) return;
        rendering = true;
        try {
            const [social, community, store, uploadsData, xpData] = await Promise.all([
                S.api('/api/social/me'),
                S.api('/api/community/profile/me'),
                S.api('/api/profile-store/me'),
                S.api('/api/uploads'),
                S.api('/api/xp/me')
            ]);
            snapshot = { social, community, store, uploads: uploadsData.uploads || [], xp: xpData.xp || {} };
            render(activeTab);
        } catch (error) {
            const root = document.getElementById('workspaceContent');
            if (root) root.innerHTML = `<div class="message show error">${S.escapeHtml(error.message || 'Falha ao carregar o editor de perfil.')}</div>`;
        } finally {
            rendering = false;
        }
    }

    function render(activeTab) {
        const root = document.getElementById('workspaceContent');
        if (!root || !snapshot) return;
        root.dataset.profileV3 = '1';
        document.getElementById('workspaceKicker').textContent = 'Perfil';
        document.getElementById('workspaceTitle').textContent = 'Perfil e personalização';
        document.getElementById('workspaceDescription').textContent = 'Identidade, aparência, inventário e loja em um só lugar.';

        const { social, community, store, xp } = snapshot;
        const account = social.account;
        const profile = account.profile || {};
        const custom = community.custom || {};
        const publicCustom = community.public || {};
        const cosmetics = store.cosmetics || {};
        const wallet = store.wallet || {};
        const requests = Number(xp.breakdown?.apiRequests || 0);
        const tags = cosmetics.tags || [];
        const frame = cosmetics.frame;
        const decoration = cosmetics.decoration;

        root.innerHTML = `<div class="profile-v3-shell">
            <section class="profile-v3-top">
                ${previewCard({ account, profile, custom, publicCustom, cosmetics, xp, social })}
                <div class="profile-v3-summary">
                    <div class="profile-v3-summary-card"><div class="profile-v3-wallet"><div><div class="hint">Saldo disponível</div><strong>${Number(wallet.balance || 0).toLocaleString('pt-BR')}</strong></div><span class="profile-wallet-pill"><i class="profile-wallet-dot"></i> moedas</span></div><p style="margin-top:10px">Você ganha 1 moeda a cada ${Number(wallet.xpPerCoin || 10)} XP. Compras ficam vinculadas à sua conta.</p></div>
                    <div class="profile-v3-summary-card"><h3>Inventário</h3><p>${store.inventory?.length || 0} itens · ${tags.length}/${store.rules?.maxEquippedTags || 3} tags equipadas</p></div>
                    <div class="profile-v3-summary-card"><h3>Visual atual</h3><p>${S.escapeHtml(frame?.name || 'Sem moldura')} · ${S.escapeHtml(decoration?.name || 'Sem decoração')}</p></div>
                    <div class="profile-v3-summary-card"><h3>Atividade</h3><p>${requests.toLocaleString('pt-BR')} requisições · Level ${Number(xp.level || 1)}</p></div>
                </div>
            </section>

            <nav class="profile-v3-tabs" aria-label="Seções do perfil">
                ${tabButton('identity','Identidade',activeTab)}${tabButton('appearance','Aparência',activeTab)}${tabButton('store','Loja',activeTab)}
            </nav>

            <section class="profile-v3-panel ${activeTab === 'identity' ? 'active' : ''}" data-profile-panel="identity">${identityPanel()}</section>
            <section class="profile-v3-panel ${activeTab === 'appearance' ? 'active' : ''}" data-profile-panel="appearance">${appearancePanel()}</section>
            <section class="profile-v3-panel ${activeTab === 'store' ? 'active' : ''}" data-profile-panel="store">${storePanel('all')}</section>
        </div>`;

        wireTabs();
        wireIdentity();
        wireAppearance();
        wireStore();
    }

    function previewCard({ account, profile, custom, publicCustom, cosmetics, xp, social }) {
        const avatarUrl = account.avatarUrl || '';
        const bannerUrl = publicCustom.bannerUrl || '';
        const initial = String(profile.displayName || account.username || '?').slice(0,1).toUpperCase();
        const frameId = cosmetics.frame?.id || '';
        const decorationId = cosmetics.decoration?.id || '';
        const accent = /^#[0-9a-f]{6}$/i.test(custom.accent || '') ? custom.accent : '#a855f7';
        const requests = Number(xp.breakdown?.apiRequests || 0);
        return `<article class="profile-v3-preview profile-surface" data-decoration="${S.escapeHtml(decorationId)}" style="--profile-accent:${S.escapeHtml(accent)}">
            <div class="profile-v3-preview-bg">${bannerUrl ? `<img src="${S.escapeHtml(bannerUrl)}" alt="">` : ''}</div><div class="profile-v3-preview-shade"></div>
            <div class="profile-v3-preview-content">
                <div class="profile-v3-person">
                    ${avatarMarkup(avatarUrl, initial, frameId)}
                    <div class="profile-v3-copy"><h2>${S.escapeHtml(profile.displayName || account.username)}</h2><div class="profile-v3-handle">@${S.escapeHtml(account.username)}</div>${custom.headline ? `<div class="profile-v3-headline">${S.escapeHtml(custom.headline)}</div>` : ''}${tagsMarkup(cosmetics.tags || [])}</div>
                </div>
                <div class="profile-v3-metrics">
                    ${metric(Number(xp.totalXp || 0).toLocaleString('pt-BR'),'XP')}${metric(Number(xp.level || 1),'Level')}${metric(requests.toLocaleString('pt-BR'),'Requests')}${metric(Number(social.stats?.friendCount || 0),'Amigos')}
                </div>
            </div>
        </article>`;
    }

    function identityPanel() {
        const { social } = snapshot;
        const account = social.account;
        const profile = account.profile || {};
        const avatarUrl = account.avatarUrl || '';
        const initial = String(profile.displayName || account.username || '?').slice(0,1).toUpperCase();
        return `<div class="profile-v3-grid">
            <div class="profile-v3-card profile-v3-col-5"><h3>Foto de perfil</h3><div class="hint">Envie uma imagem diretamente daqui. Ela também fica disponível em Uploads.</div><div class="profile-v3-upload"><div class="profile-v3-upload-preview">${avatarUrl ? `<img src="${S.escapeHtml(avatarUrl)}" alt="">` : S.escapeHtml(initial)}</div><div><input id="profileV3AvatarFile" type="file" accept="image/*"><div class="profile-v3-upload-actions"><button class="button primary small" id="profileV3AvatarUpload" type="button">Enviar foto</button>${avatarUrl ? '<button class="button small danger" id="profileV3AvatarRemove" type="button">Remover</button>' : ''}</div></div></div></div>
            <div class="profile-v3-card profile-v3-col-7"><h3>Identidade pública</h3><div class="hint">Nome, frase curta e bio exibidos no seu perfil.</div><div class="message profile-v3-message" id="profileV3IdentityMessage"></div><form id="profileV3IdentityForm"><div class="profile-v3-inline"><div class="form-group"><label>Nome de exibição</label><input name="displayName" maxlength="50" value="${S.escapeHtml(profile.displayName || '')}"></div><div class="form-group"><label>Status</label><input name="status" maxlength="60" value="${S.escapeHtml(profile.status || '')}" placeholder="Uma frase curta"></div></div><div class="form-group"><label>Bio</label><textarea name="bio" maxlength="320" placeholder="Conte um pouco sobre você">${S.escapeHtml(profile.bio || '')}</textarea></div><button class="button primary" type="submit">Salvar identidade</button></form></div>
            <div class="profile-v3-card profile-v3-col-5"><h3>Seu @</h3><div class="hint">O @ também define o endereço público do perfil. Para proteger sua conta, a troca exige sua senha atual.</div><div class="message profile-v3-message" id="profileV3HandleMessage"></div><form id="profileV3HandleForm"><div class="form-group"><label>Novo @</label><input name="username" maxlength="30" value="${S.escapeHtml(account.username)}" autocomplete="off"></div><div class="form-group"><label>Senha atual</label><input name="password" type="password" autocomplete="current-password" required></div><button class="button" type="submit">Alterar @</button></form></div>
            <div class="profile-v3-card profile-v3-col-7"><h3>Privacidade social</h3><div class="hint">Escolha quais recursos sociais ficam ativos.</div><div class="profile-v3-checks" id="profileV3PrivacyChecks">${privacyCheck('allowFriendRequests','Pedidos de amizade','Permitir que outras contas enviem solicitações.',profile.privacy?.allowFriendRequests !== false)}${privacyCheck('allowCallsFromFriends','Chamadas de voz','Permitir chamadas dos seus amigos.',profile.privacy?.allowCallsFromFriends !== false)}${privacyCheck('showOnline','Status online','Mostrar online para amigos.',profile.privacy?.showOnline !== false)}${privacyCheck('showOnPodium','Participar do pódio','Permitir que seu cartão apareça no ranking.',profile.privacy?.showOnPodium !== false)}</div><div class="profile-v3-upload-actions"><button class="button" id="profileV3PrivacySave" type="button">Salvar privacidade</button><a class="button" href="/u/${encodeURIComponent(account.username)}" target="_blank" rel="noopener">Ver perfil público</a></div></div>
        </div>`;
    }

    function appearancePanel() {
        const { community, store } = snapshot;
        const c = community.custom || {};
        const bannerUrl = community.public?.bannerUrl || '';
        const owned = store.inventory || [];
        const frames = owned.filter(entry => entry.item?.type === 'frame').map(entry => entry.item);
        const decorations = owned.filter(entry => entry.item?.type === 'decoration').map(entry => entry.item);
        const tags = owned.filter(entry => entry.item?.type === 'tag').map(entry => entry.item);
        const equipped = store.equipped || {};
        return `<div class="profile-v3-grid">
            <div class="profile-v3-card profile-v3-col-5"><h3>Fundo do perfil</h3><div class="hint">A capa aparece no perfil público e no cartão do pódio.</div><div class="profile-v3-upload"><div class="profile-v3-upload-preview cover">${bannerUrl ? `<img src="${S.escapeHtml(bannerUrl)}" alt="">` : '<span class="hint">Sem capa</span>'}</div><div style="grid-column:1/-1"><input id="profileV3BannerFile" type="file" accept="image/*"><div class="profile-v3-upload-actions"><button class="button primary small" id="profileV3BannerUpload" type="button">Enviar fundo</button>${bannerUrl ? '<button class="button small danger" id="profileV3BannerRemove" type="button">Remover</button>' : ''}</div></div></div></div>
            <div class="profile-v3-card profile-v3-col-7"><h3>Estilo do perfil</h3><div class="hint">Controle aparência e informações exibidas.</div><div class="message profile-v3-message" id="profileV3AppearanceMessage"></div><form id="profileV3AppearanceForm"><div class="profile-v3-inline"><div class="form-group"><label>Frase de destaque</label><input name="headline" maxlength="90" value="${S.escapeHtml(c.headline || '')}"></div><div class="form-group"><label>Estilo</label><select name="style"><option value="clean" ${c.style === 'clean' ? 'selected' : ''}>Clean</option><option value="glass" ${c.style === 'glass' ? 'selected' : ''}>Glass</option><option value="contrast" ${c.style === 'contrast' ? 'selected' : ''}>Contraste</option></select></div></div><div class="form-group"><label>Cor de destaque</label><input name="accent" type="color" value="${S.escapeHtml(c.accent || '#a855f7')}"></div><div class="profile-v3-checks">${simpleCheck('showXp','Mostrar XP / level',c.showXp !== false)}${simpleCheck('showJoinDate','Mostrar data de entrada',c.showJoinDate !== false)}${simpleCheck('showFriendCount','Mostrar amigos',c.showFriendCount !== false)}</div><div class="profile-v3-upload-actions"><button class="button primary" type="submit">Salvar aparência</button></div></form></div>
            <div class="profile-v3-card profile-v3-col-12"><h3>Itens equipados</h3><div class="hint">Compre itens na Loja e equipe aqui. Você pode usar até ${Number(store.rules?.maxEquippedTags || 3)} tags ao mesmo tempo.</div><div class="message profile-v3-message" id="profileV3EquipMessage"></div><form id="profileV3EquipForm"><div class="profile-v3-inline"><div class="form-group"><label>Moldura de avatar</label><select name="frameId"><option value="">Sem moldura</option>${frames.map(item => `<option value="${S.escapeHtml(item.id)}" ${equipped.frameId === item.id ? 'selected' : ''}>${S.escapeHtml(item.name)}</option>`).join('')}</select></div><div class="form-group"><label>Decoração</label><select name="decorationId"><option value="">Sem decoração</option>${decorations.map(item => `<option value="${S.escapeHtml(item.id)}" ${equipped.decorationId === item.id ? 'selected' : ''}>${S.escapeHtml(item.name)}</option>`).join('')}</select></div></div><label>Tags equipadas</label>${tags.length ? `<div class="profile-v3-inventory">${tags.map(item => choiceTag(item,(equipped.tagIds || []).includes(item.id))).join('')}</div>` : '<div class="profile-v3-empty">Você ainda não comprou tags.</div>'}<div class="profile-v3-upload-actions"><button class="button primary" type="submit">Equipar itens</button><button class="button" id="profileV3GoStore" type="button">Abrir loja</button></div></form></div>
        </div>`;
    }

    function storePanel(filter) {
        const { store } = snapshot;
        const owned = new Set((store.inventory || []).map(entry => entry.item?.id).filter(Boolean));
        const products = (store.catalog || []).filter(item => filter === 'all' || item.type === filter);
        return `<div class="profile-v3-card"><div class="profile-v3-store-head"><div><h3>Loja do perfil</h3><div class="hint">Tags, molduras e decorações são permanentes depois da compra.</div></div><span class="profile-wallet-pill"><i class="profile-wallet-dot"></i>${Number(store.wallet?.balance || 0).toLocaleString('pt-BR')} moedas</span></div><div class="message profile-v3-message" id="profileV3StoreMessage"></div><div class="profile-v3-store-filter">${storeFilter('all','Todos',filter)}${storeFilter('tag','Tags',filter)}${storeFilter('frame','Molduras',filter)}${storeFilter('decoration','Decorações',filter)}</div><div class="profile-v3-divider"></div><div class="profile-v3-store">${products.map(product => productCard(product,owned.has(product.id))).join('')}</div></div>`;
    }

    function wireTabs() {
        document.querySelectorAll('[data-profile-tab]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.profileTab)));
    }

    function activateTab(tab) {
        document.querySelectorAll('[data-profile-tab]').forEach(button => button.classList.toggle('active', button.dataset.profileTab === tab));
        document.querySelectorAll('[data-profile-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.profilePanel === tab));
    }

    function wireIdentity() {
        const profile = snapshot.social.account.profile || {};
        document.getElementById('profileV3IdentityForm')?.addEventListener('submit', async event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await saveSocialProfile({ displayName: form.get('displayName'), status: form.get('status'), bio: form.get('bio') }, 'profileV3IdentityMessage', 'Identidade atualizada.');
        });
        document.getElementById('profileV3PrivacySave')?.addEventListener('click', async () => {
            const checks = document.getElementById('profileV3PrivacyChecks');
            const values = Object.fromEntries([...checks.querySelectorAll('input[type="checkbox"]')].map(input => [input.name,input.checked]));
            await saveSocialProfile({ privacy: values }, 'profileV3IdentityMessage', 'Privacidade atualizada.');
        });
        document.getElementById('profileV3HandleForm')?.addEventListener('submit', async event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const message = document.getElementById('profileV3HandleMessage');
            try {
                await S.api('/api/social/account/username', { method: 'POST', body: { username: form.get('username'), password: form.get('password') } });
                S.message(message,'@ atualizado. Recarregando perfil...','success');
                setTimeout(() => build('identity'),300);
            } catch (error) { S.message(message,error.message,'error'); }
        });
        document.getElementById('profileV3AvatarUpload')?.addEventListener('click', async () => {
            const file = document.getElementById('profileV3AvatarFile')?.files?.[0];
            if (!file) return alert('Selecione uma imagem.');
            const button = document.getElementById('profileV3AvatarUpload');
            button.disabled = true;
            try {
                const uploadId = await uploadFile(file);
                await saveSocialProfile({ avatarUploadId: uploadId }, 'profileV3IdentityMessage', 'Foto de perfil atualizada.', false);
                await build('identity');
            } catch (error) { alert(error.message); } finally { button.disabled = false; }
        });
        document.getElementById('profileV3AvatarRemove')?.addEventListener('click', async () => {
            if (!confirm('Remover a foto de perfil atual?')) return;
            await saveSocialProfile({ avatarUploadId: '' }, 'profileV3IdentityMessage', 'Foto removida.', false);
            await build('identity');
        });
    }

    async function saveSocialProfile(changes, messageId, success, rebuild = true) {
        const account = snapshot.social.account;
        const profile = account.profile || {};
        const body = {
            displayName: Object.prototype.hasOwnProperty.call(changes,'displayName') ? changes.displayName : profile.displayName,
            status: Object.prototype.hasOwnProperty.call(changes,'status') ? changes.status : profile.status,
            bio: Object.prototype.hasOwnProperty.call(changes,'bio') ? changes.bio : profile.bio,
            avatarUploadId: Object.prototype.hasOwnProperty.call(changes,'avatarUploadId') ? changes.avatarUploadId : profile.avatarUploadId,
            privacy: { ...(profile.privacy || {}), ...(changes.privacy || {}) }
        };
        const message = document.getElementById(messageId);
        try {
            await S.api('/api/social/account/profile', { method: 'PATCH', body });
            if (message) S.message(message,success,'success');
            if (rebuild) setTimeout(() => build('identity'),280);
        } catch (error) {
            if (message) S.message(message,error.message,'error'); else throw error;
        }
    }

    function wireAppearance() {
        document.getElementById('profileV3AppearanceForm')?.addEventListener('submit', async event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const message = document.getElementById('profileV3AppearanceMessage');
            const body = { headline: form.get('headline'), style: form.get('style'), accent: form.get('accent'), bannerUploadId: snapshot.community.custom?.bannerUploadId || '', showXp: form.get('showXp') === 'on', showJoinDate: form.get('showJoinDate') === 'on', showFriendCount: form.get('showFriendCount') === 'on' };
            try { await S.api('/api/community/profile/me',{method:'PATCH',body}); S.message(message,'Aparência atualizada.','success'); setTimeout(() => build('appearance'),280); }
            catch (error) { S.message(message,error.message,'error'); }
        });
        document.getElementById('profileV3BannerUpload')?.addEventListener('click', async () => {
            const file = document.getElementById('profileV3BannerFile')?.files?.[0];
            if (!file) return alert('Selecione uma imagem.');
            const button = document.getElementById('profileV3BannerUpload'); button.disabled = true;
            try { const uploadId = await uploadFile(file); await patchCommunity({ bannerUploadId: uploadId }); await build('appearance'); }
            catch (error) { alert(error.message); } finally { button.disabled = false; }
        });
        document.getElementById('profileV3BannerRemove')?.addEventListener('click', async () => { if (!confirm('Remover o fundo atual?')) return; await patchCommunity({ bannerUploadId: '' }); await build('appearance'); });
        document.getElementById('profileV3EquipForm')?.addEventListener('submit', async event => {
            event.preventDefault(); const form = new FormData(event.currentTarget); const tags = form.getAll('tagId'); const limit = Number(snapshot.store.rules?.maxEquippedTags || 3); const message = document.getElementById('profileV3EquipMessage');
            if (tags.length > limit) return S.message(message,`Você pode equipar até ${limit} tags.`, 'error');
            try { await S.api('/api/profile-store/equipped',{method:'PATCH',body:{tagIds:tags,frameId:form.get('frameId'),decorationId:form.get('decorationId')}}); S.message(message,'Itens equipados.','success'); setTimeout(() => build('appearance'),250); }
            catch (error) { S.message(message,error.message,'error'); }
        });
        document.querySelectorAll('#profileV3EquipForm input[name="tagId"]').forEach(input => input.addEventListener('change', () => {
            const checked = [...document.querySelectorAll('#profileV3EquipForm input[name="tagId"]:checked')];
            const limit = Number(snapshot.store.rules?.maxEquippedTags || 3);
            if (checked.length > limit) { input.checked = false; alert(`Você pode equipar até ${limit} tags.`); }
        }));
        document.getElementById('profileV3GoStore')?.addEventListener('click', () => activateTab('store'));
    }

    async function patchCommunity(changes) {
        const c = snapshot.community.custom || {};
        const body = { headline:c.headline || '',style:c.style || 'clean',accent:c.accent || '#a855f7',bannerUploadId:Object.prototype.hasOwnProperty.call(changes,'bannerUploadId') ? changes.bannerUploadId : c.bannerUploadId || '',showXp:c.showXp !== false,showJoinDate:c.showJoinDate !== false,showFriendCount:c.showFriendCount !== false,...changes };
        return S.api('/api/community/profile/me',{method:'PATCH',body});
    }

    function wireStore() {
        document.querySelectorAll('[data-store-filter]').forEach(button => button.addEventListener('click', () => {
            const panel = document.querySelector('[data-profile-panel="store"]');
            if (!panel) return;
            panel.innerHTML = storePanel(button.dataset.storeFilter);
            wireStore();
        }));
        document.querySelectorAll('[data-buy-profile-item]').forEach(button => button.addEventListener('click', async () => {
            const id = button.dataset.buyProfileItem;
            button.disabled = true;
            const message = document.getElementById('profileV3StoreMessage');
            try { await S.api(`/api/profile-store/buy/${encodeURIComponent(id)}`,{method:'POST'}); if (message) S.message(message,'Item comprado.','success'); await build('store'); }
            catch (error) { if (message) S.message(message,error.message,'error'); else alert(error.message); button.disabled = false; }
        }));
    }

    async function uploadFile(file) {
        if (!file?.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
        const data = new FormData(); data.append('file',file,file.name || 'perfil');
        const response = await S.api('/api/uploads',{method:'POST',body:data});
        const id = response.upload?.id || response.id;
        if (!id) throw new Error('O upload terminou sem retornar um ID.');
        return id;
    }

    function tabButton(id,label,active) { return `<button class="profile-v3-tab ${active === id ? 'active' : ''}" data-profile-tab="${id}" type="button">${label}</button>`; }
    function metric(value,label) { return `<div class="profile-v3-metric"><strong>${value}</strong><span>${label}</span></div>`; }
    function privacyCheck(name,title,desc,checked) { return `<label class="profile-v3-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span><strong>${title}</strong><span>${desc}</span></span></label>`; }
    function simpleCheck(name,title,checked) { return `<label class="profile-v3-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span><strong>${title}</strong></span></label>`; }
    function avatarMarkup(url,initial,frameId) { return `<div class="cosmetic-avatar" data-frame="${S.escapeHtml(frameId || '')}"><div class="cosmetic-avatar-inner">${url ? `<img src="${S.escapeHtml(url)}" alt="">` : S.escapeHtml(initial)}</div></div>`; }
    function tagsMarkup(tags) { return tags?.length ? `<div class="profile-tags">${tags.map(tag => `<span class="profile-tag" style="--tag-a:${S.escapeHtml(tag.colors?.[0] || '#7c3aed')};--tag-b:${S.escapeHtml(tag.colors?.[1] || '#a78bfa')}">${S.escapeHtml(tag.name)}</span>`).join('')}</div>` : '' ; }
    function choiceTag(item,checked) { return `<label class="profile-v3-choice"><input type="checkbox" name="tagId" value="${S.escapeHtml(item.id)}" ${checked ? 'checked' : ''}><div class="profile-v3-swatch" style="--sw-a:${S.escapeHtml(item.colors?.[0] || '#8b5cf6')};--sw-b:${S.escapeHtml(item.colors?.[1] || '#22d3ee')}"></div><strong>${S.escapeHtml(item.name)}</strong><span>${S.escapeHtml(item.rarity)}</span></label>`; }
    function storeFilter(id,label,active) { return `<button class="${active === id ? 'active' : ''}" data-store-filter="${id}" type="button">${label}</button>`; }
    function productCard(item,owned) { const colors=item.colors || ['#8b5cf6','#22d3ee']; return `<article class="profile-v3-product profile-rarity-${S.escapeHtml(item.rarity)}"><div class="profile-v3-product-visual ${S.escapeHtml(item.type)}" style="--p-a:${S.escapeHtml(colors[0])};--p-b:${S.escapeHtml(colors[1] || colors[0])}"><span>${item.type === 'tag' ? S.escapeHtml(item.name) : ''}</span></div><div class="profile-v3-product-title"><strong>${S.escapeHtml(item.name)}</strong><span class="profile-rarity-badge">${S.escapeHtml(item.rarity)}</span></div><div class="profile-v3-price"><i></i>${Number(item.price).toLocaleString('pt-BR')} moedas</div><button class="button ${owned ? '' : 'primary'} small" ${owned ? 'disabled' : `data-buy-profile-item="${S.escapeHtml(item.id)}"`} type="button">${owned ? 'Comprado' : 'Comprar'}</button></article>`; }
})();
