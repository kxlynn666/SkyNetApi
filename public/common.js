window.SkyNet = window.SkyNet || (() => {
    async function api(url, options = {}) {
        const opts = { credentials: 'same-origin', ...options };
        const headers = new Headers(opts.headers || {});
        if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
            headers.set('Content-Type', 'application/json');
            opts.body = JSON.stringify(opts.body);
        }
        opts.headers = headers;
        const response = await fetch(url, opts);
        const type = response.headers.get('content-type') || '';
        let data = null;
        if (type.includes('application/json')) data = await response.json().catch(() => null);
        else data = await response.text().catch(() => null);
        if (!response.ok) {
            const error = new Error(data?.error || data?.message || `Erro HTTP ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }
        return data;
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function formatDate(value) {
        if (!value) return 'Nunca';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Data inválida';
        return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }

    function formatSize(bytes) {
        const n = Number(bytes || 0);
        if (n < 1024) return `${n} B`;
        if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / 1024 ** 2).toFixed(1)} MB`;
    }

    function message(element, text, type = 'error') {
        if (!element) return;
        element.textContent = text || '';
        element.className = `message ${text ? 'show' : ''} ${type}`;
    }

    async function session() {
        try { return (await api('/api/auth/me')).account; }
        catch (error) { if (error.status === 401) return null; throw error; }
    }

    async function logout() {
        try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
        location.href = '/painel/login';
    }

    async function copy(text) { await navigator.clipboard.writeText(text); }

    function setTabs(root = document) {
        const buttons = [...root.querySelectorAll('[data-tab]')];
        buttons.forEach(button => button.addEventListener('click', () => {
            const target = button.dataset.tab;
            buttons.forEach(b => b.classList.toggle('active', b === button));
            root.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === target));
        }));
    }

    return { api, escapeHtml, formatDate, formatSize, message, session, logout, copy, setTabs };
})();

(() => {
    const currentPath = location.pathname.replace(/\/+$/, '') || '/';
    const styles = [
        ['/ui-v3.css', 'skynetUiV3'],
        ['/profile-cosmetics.css', 'profileCosmetics'],
        ['/profile-social-pack-v9.css', 'profileSocialPackV9'],
        ['/podium-frames-v2.css', 'podiumFramesV2'],
        ['/theme-profile-v1.css', 'themeProfileV1'],
        ['/profile-effects-v5.css', 'skynetProfileEffectsV5'],
        ['/profile-hotfix-v5.css', 'skynetProfileHotfixV5'],
        ['/profile-aesthetic-v6.css', 'skynetProfileAestheticV6'],
        ['/profile-stock-v7.css', 'skynetProfileStockV7'],
        ['/profile-stock-v7-perf.css', 'skynetProfileStockV7Perf'],
        ['/profile-objects-v8.css', 'skynetProfileObjectsV8'],
        ['/mobile-polish-v4.css', 'skynetMobilePolishV4'],
        ['/design-system-v12.css', 'skynetDesignSystemV12'],
        ['/design-system-v14.css', 'skynetDesignSystemV14']
    ];
    for (const [href, marker] of styles) {
        if (document.querySelector(`link[href="${href}"],link[data-${marker.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}]`)) continue;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset[marker] = '1';
        document.head.appendChild(link);
    }

    const pinThemeLast = () => {
        const theme = document.querySelector('link[href="/design-system-v14.css"]');
        if (theme && document.head.lastElementChild !== theme) document.head.appendChild(theme);
    };
    pinThemeLast();
    let repinScheduled = false;
    const headObserver = new MutationObserver(() => {
        if (repinScheduled) return;
        repinScheduled = true;
        queueMicrotask(() => {
            repinScheduled = false;
            pinThemeLast();
        });
    });
    headObserver.observe(document.head, { childList: true });
    window.addEventListener('load', () => {
        pinThemeLast();
        setTimeout(() => headObserver.disconnect(), 10000);
    }, { once: true });

    const scripts = [
        ['/theme-engine-v1.js', 'skynetThemeEngineV1'],
        ['/performance-guard-v1.js', 'skynetPerformanceGuardV1'],
        ['/smooth-scroll-v5.js', 'skynetSmoothScrollV5'],
        ['/profile-actions-stability-v1.js', 'skynetProfileActionsStabilityV1'],
        ['/site-ui-v3.js', 'skynetSiteUiV3'],
        ['/profile-catalog-v4.js', 'skynetProfileCatalogV4'],
        ['/profile-preview-v2.js', 'skynetProfilePreviewV2'],
        ['/profile-media-v3.js', 'skynetProfileMediaV3'],
        ['/profile-design-v1.js', 'skynetProfileDesignV1'],
        ['/profile-editor-organizer-v3.js', 'skynetProfileEditorOrganizerV3'],
        ['/profile-store-performance-v1.js', 'skynetProfileStorePerformanceV1'],
        ['/experience-polish-v10.js', 'skynetExperiencePolishV10'],
        ['/store-layout-hotfix-v11.js', 'skynetStoreLayoutHotfixV11'],
        ['/store-experience-v14.js', 'skynetStoreExperienceV14'],
        ['/stickers-v1.js', 'skynetStickersV1'],
        ['/profile-store-organizer-v5.js', 'skynetProfileStoreOrganizerV5'],
        ['/ui-preferences-v4.js', 'skynetUiPreferencesV4'],
        ['/panel-mini-podium-v1.js', 'skynetPanelMiniPodiumV1'],
        ['/podium-media-animator-v1.js', 'skynetPodiumMediaAnimatorV1'],
        ['/dashboard-insights-v1.js', 'skynetDashboardInsightsV1'],
        ['/workspace-command-menu-v1.js', 'skynetWorkspaceCommandMenuV1'],
        ['/visual-lab-v14.js', 'skynetVisualLabV14'],
        ['/upscale-panel.js', 'skynetUpscalePanelV1'],
        ['/upscale-external-v2.js', 'skynetUpscaleExternalV2'],
        ['/motion-v19.js', 'skynetMotionV19']
    ];
    if (currentPath !== '/painel/perfil') scripts.splice(14, 0, ['/ui-icons-v4.js', 'skynetUiIconsV4']);

    for (const [src, marker] of scripts) {
        if (document.querySelector(`script[src="${src}"],script[data-${marker.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}]`)) continue;
        const script = document.createElement('script');
        script.async = false;
        script.src = src;
        script.dataset[marker] = '1';
        document.head.appendChild(script);
    }
})();

(() => {
    const cleanPath = location.pathname.replace(/\/+$/, '') || '/';

    if (cleanPath.startsWith('/u/')) {
        for (const [src, marker] of [['/community-v2.js', 'communityPublic'], ['/profile-style-v2.js', 'profileStyleV2']]) {
            const script = document.createElement('script');
            script.async = false;
            script.src = src;
            script.dataset[marker] = '1';
            document.head.appendChild(script);
        }
    }

    if (cleanPath !== '/admin' && cleanPath !== '/admin/painel') return;
    let loaded = false;
    const load = () => {
        if (loaded) return;
        const app = document.getElementById('app');
        if (!app || app.classList.contains('hidden')) return;
        loaded = true;
        for (const [src, marker] of [
            ['/admin-extended.js', 'adminExtended'],
            ['/admin-community.js', 'adminCommunity'],
            ['/admin-music.js', 'adminMusic'],
            ['/admin-profile-store.js', 'adminProfileStore'],
            ['/admin-coins-editor-v1.js', 'adminCoinsEditorV1']
        ]) {
            if (document.querySelector(`script[data-${marker.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}]`)) continue;
            const script = document.createElement('script');
            script.async = false;
            script.src = src;
            script.dataset[marker] = '1';
            document.head.appendChild(script);
        }
    };
    load();
    const observer = new MutationObserver(() => {
        load();
        if (loaded) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
})();

(() => {
    const cleanPath = location.pathname.replace(/\/+$/, '') || '/';
    if (cleanPath !== '/painel/musica') return;
    if (!document.querySelector('link[href="/music-icons-v5.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/music-icons-v5.css';
        link.dataset.skynetMusicIconsV5 = '1';
        document.head.appendChild(link);
    }
    const ordered = [
        ['/music-player-v2.js', 'skynetMusicPlayer'],
        ['/music-player-polish-v4.js', 'skynetMusicPolishV4'],
        ['/music-hub-v13.js', 'skynetMusicHubV13']
    ];
    for (const [src, marker] of ordered) {
        if (document.querySelector(`script[src="${src}"]`)) continue;
        const script = document.createElement('script');
        script.async = false;
        script.src = src;
        script.dataset[marker] = '1';
        document.head.appendChild(script);
    }
})();
