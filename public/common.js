window.SkyNet = (() => {
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
    const styles = [
        ['/ui-v3.css', 'skynetUiV3'],
        ['/profile-cosmetics.css', 'profileCosmetics'],
        ['/profile-effects-v5.css', 'skynetProfileEffectsV5'],
        ['/profile-hotfix-v5.css', 'skynetProfileHotfixV5'],
        ['/profile-aesthetic-v6.css', 'skynetProfileAestheticV6'],
        ['/profile-stock-v7.css', 'skynetProfileStockV7'],
        ['/profile-stock-v7-perf.css', 'skynetProfileStockV7Perf'],
        ['/profile-objects-v8.css', 'skynetProfileObjectsV8'],
        ['/mobile-polish-v4.css', 'skynetMobilePolishV4'],
        ['/music-icons-v5.css', 'skynetMusicIconsV5']
    ];
    for (const [href, marker] of styles) {
        if (document.querySelector(`link[href="${href}"],link[data-${marker.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}]`)) continue;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset[marker] = '1';
        document.head.appendChild(link);
    }

    const scripts = [
        ['/performance-guard-v1.js', 'skynetPerformanceGuardV1'],
        ['/profile-actions-stability-v1.js', 'skynetProfileActionsStabilityV1'],
        ['/site-ui-v3.js', 'skynetSiteUiV3'],
        ['/profile-catalog-v4.js', 'skynetProfileCatalogV4'],
        ['/profile-preview-v2.js', 'skynetProfilePreviewV2'],
        ['/profile-design-v1.js', 'skynetProfileDesignV1'],
        ['/profile-editor-organizer-v2.js', 'skynetProfileEditorOrganizerV2'],
        ['/experience-polish-v10.js', 'skynetExperiencePolishV10'],
        ['/ui-icons-v4.js', 'skynetUiIconsV4'],
        ['/profile-store-organizer-v5.js', 'skynetProfileStoreOrganizerV5'],
        ['/ui-preferences-v4.js', 'skynetUiPreferencesV4'],
        ['/panel-mini-podium-v1.js', 'skynetPanelMiniPodiumV1'],
        ['/dashboard-insights-v1.js', 'skynetDashboardInsightsV1'],
        ['/workspace-command-menu-v1.js', 'skynetWorkspaceCommandMenuV1']
    ];
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
    if (!document.querySelector('script[data-skynet-music-player]')) {
        const script = document.createElement('script');
        script.async = false;
        script.src = '/music-player-v2.js';
        script.dataset.skynetMusicPlayer = '1';
        document.head.appendChild(script);
    }
    if (!document.querySelector('script[data-skynet-music-polish-v4]')) {
        const polish = document.createElement('script');
        polish.async = false;
        polish.src = '/music-player-polish-v4.js';
        polish.dataset.skynetMusicPolishV4 = '1';
        document.head.appendChild(polish);
    }
})();
