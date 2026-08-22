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
