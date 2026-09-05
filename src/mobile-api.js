const S = require('./store');

function registerMobileApiRoutes(app) {
    app.get('/api/mobile/session', requireApiKey, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            ok: true,
            account: S.publicAccountView(req.account),
            apiKey: S.publicKeyView(req.apiKeyRecord)
        });
    });
}

function requireApiKey(req, res, next) {
    try {
        const authorization = String(req.headers.authorization || '');
        const bearer = authorization.toLowerCase().startsWith('bearer ')
            ? authorization.slice(7).trim()
            : '';
        const apiKey = String(req.headers['x-api-key'] || bearer || '').trim();
        const auth = S.authenticateApiKey(apiKey);
        if (!auth) {
            return res.status(401).json({ ok: false, error: 'API key inválida ou ausente.' });
        }
        req.account = auth.account;
        req.apiKeyRecord = auth.record;
        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = { registerMobileApiRoutes };
