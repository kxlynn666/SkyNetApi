const C = require('./config');
const S = require('./store');

function parseCookies(header) {
    const out = {};
    for (const part of String(header || '').split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        try { out[key] = decodeURIComponent(value); }
        catch { out[key] = value; }
    }
    return out;
}

function requireSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie).skynet_session || '';
        const session = token ? S.getSession(token) : null;
        if (!session) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        const account = S.loadAccounts().find(item => item.id === session.accountId && item.active);
        if (!account) return res.status(401).json({ ok: false, error: 'Conta inativa ou removida.' });
        req.workspaceAccount = account;
        return next();
    } catch (error) { return next(error); }
}

function registerWorkspaceBootstrapRoutes(app) {
    app.get('/api/workspace/bootstrap', requireSession, (req, res) => {
        const accountId = req.workspaceAccount.id;
        const keys = S.loadApiKeys().filter(item => item.accountId === accountId);
        const uploads = S.loadUploads()
            .filter(item => item.accountId === accountId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const generations = S.loadGenerations()
            .filter(item => item.accountId === accountId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const lastKeyUse = keys
            .map(item => item.lastUsedAt)
            .filter(Boolean)
            .sort((a, b) => new Date(b) - new Date(a))[0] || null;

        res.setHeader('Cache-Control', 'private, no-store');
        return res.json({
            ok: true,
            account: S.publicAccountView(req.workspaceAccount),
            summary: {
                keys: {
                    total: keys.length,
                    active: keys.filter(item => item.active).length,
                    requests: keys.reduce((sum, item) => sum + Number(item.requestCount || 0), 0),
                    lastUsedAt: lastKeyUse
                },
                uploads: {
                    total: uploads.length,
                    recent: uploads.slice(0, 4).map(S.publicUploadView)
                },
                generations: {
                    total: generations.length,
                    recent: generations.slice(0, 4).map(S.publicGenerationView)
                }
            },
            limits: {
                keys: C.MAX_KEYS_PER_ACCOUNT,
                uploads: C.MAX_UPLOADS_PER_ACCOUNT,
                generations: C.MAX_GENERATIONS_PER_ACCOUNT
            }
        });
    });
}

module.exports = { registerWorkspaceBootstrapRoutes };
