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
        if (type.includes('application/json')) {
            data = await response.json().catch(() => null);
        } else {
            data = await response.text().catch(() => null);
        }
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
        try {
            const data = await api('/api/auth/me');
            return data.account;
        } catch (error) {
            if (error.status === 401) return null;
            throw error;
        }
    }

    async function logout() {
        try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
        location.href = '/painel/login';
    }

    async function copy(text) {
        await navigator.clipboard.writeText(text);
    }

    function setTabs(root = document) {
        const buttons = [...root.querySelectorAll('[data-tab]')];
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const target = button.dataset.tab;
                buttons.forEach(b => b.classList.toggle('active', b === button));
                root.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === target));
            });
        });
    }

    return { api, escapeHtml, formatDate, formatSize, message, session, logout, copy, setTabs };
})();

(() => {
    const cleanPath = location.pathname.replace(/\/+$/, '') || '/';

    if (cleanPath.startsWith('/u/')) {
        for (const [src, marker] of [['/community-v2.js', 'communityPublic'], ['/profile-style-v2.js', 'profileStyleV2']]) {
            const script = document.createElement('script');
            script.src = src;
            script.dataset[marker] = '1';
            document.head.appendChild(script);
        }
    }

    if (cleanPath !== '/admin') return;
    let loaded = false;
    const load = () => {
        if (loaded) return;
        const app = document.getElementById('app');
        if (!app || app.classList.contains('hidden')) return;
        loaded = true;
        for (const [src, marker] of [['/admin-extended.js', 'adminExtended'], ['/admin-community.js', 'adminCommunity'], ['/admin-music.js', 'adminMusic']]) {
            if (document.querySelector(`script[data-${marker.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}]`)) continue;
            const script = document.createElement('script');
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
    if (document.querySelector('script[data-skynet-music-player]')) return;
    const script = document.createElement('script');
    script.src = '/music-player-v2.js';
    script.dataset.skynetMusicPlayer = '1';
    document.head.appendChild(script);
})();
