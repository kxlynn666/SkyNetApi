(() => {
    const S = window.SkyNet;
    if (!S || !location.pathname.startsWith('/u/')) return;

    const parts = location.pathname.split('/').filter(Boolean);
    const username = decodeURIComponent(parts[1] || '');
    if (!username) return;

    async function boot() {
        let data;
        try { data = await S.api(`/api/community/profile/${encodeURIComponent(username)}`); }
        catch { return; }
        const p = data.profile || {};
        const accent = /^#[0-9a-f]{6}$/i.test(p.accent || '') ? p.accent : '#a855f7';

        const apply = () => {
            const root = document.getElementById('publicProfileRoot');
            const profile = root?.querySelector('.public-profile');
            if (!profile) return false;
            profile.dataset.profileStyle = p.style || 'clean';
            profile.style.setProperty('--profile-accent', accent);
            profile.style.transition = 'background .2s,border-color .2s,box-shadow .2s';
            profile.style.padding = '22px';
            profile.style.borderRadius = '22px';

            if (p.style === 'glass') {
                profile.style.background = 'linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.025))';
                profile.style.backdropFilter = 'blur(18px)';
                profile.style.border = `1px solid ${hexAlpha(accent, .30)}`;
                profile.style.boxShadow = `0 24px 70px ${hexAlpha(accent, .10)}`;
            } else if (p.style === 'contrast') {
                profile.style.background = '#07070b';
                profile.style.backdropFilter = '';
                profile.style.border = `2px solid ${hexAlpha(accent, .62)}`;
                profile.style.boxShadow = `0 0 0 1px rgba(255,255,255,.04),0 26px 80px rgba(0,0,0,.45)`;
            } else {
                profile.style.background = 'rgba(255,255,255,.025)';
                profile.style.backdropFilter = '';
                profile.style.border = '1px solid var(--border)';
                profile.style.boxShadow = 'none';
            }

            profile.querySelectorAll('.public-status,.public-tag-v2,.public-xp-v2').forEach(el => {
                el.style.borderColor = hexAlpha(accent, .34);
            });
            const name = profile.querySelector('h1');
            if (name) name.style.textShadow = p.style === 'contrast' ? `0 0 26px ${hexAlpha(accent, .22)}` : 'none';
            return true;
        };

        if (apply()) return;
        const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 10000);
    }

    function hexAlpha(hex, alpha) {
        const v = String(hex).replace('#', '');
        const r = parseInt(v.slice(0,2),16) || 168;
        const g = parseInt(v.slice(2,4),16) || 85;
        const b = parseInt(v.slice(4,6),16) || 247;
        return `rgba(${r},${g},${b},${alpha})`;
    }

    boot();
})();
