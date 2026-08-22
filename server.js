const path = require('path');
const express = require('express');
const { createApp } = require('./src/app');
const C = require('./src/config');
const { registerTikTokRoutes } = require('./src/tiktok');
const { registerRobloxRoutes } = require('./src/roblox');
const { registerMediaRoutes } = require('./src/media');

const app = express();
if (C.TRUST_PROXY) app.set('trust proxy', 1);

registerTikTokRoutes(app);
registerRobloxRoutes(app);
registerMediaRoutes(app);

const workspaceRoutes = [
    '/painel',
    '/painel/conta',
    '/painel/chaves',
    '/painel/cards',
    '/painel/uploads',
    '/painel/tiktok',
    '/painel/youtube',
    '/painel/media',
    '/painel/roblox',
    '/painel/historico',
    '/painel/api'
];

for (const route of workspaceRoutes) {
    app.get(route, (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'workspace.html')));
}

app.get('/painel/login', (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'login.html')));

app.get('/painel.html', (req, res) => res.redirect(302, '/painel'));
app.get('/upload', (req, res) => res.redirect(302, '/painel/uploads'));
app.get('/upload.html', (req, res) => res.redirect(302, '/painel/uploads'));
app.get('/tiktok', (req, res) => res.redirect(302, '/painel/tiktok'));
app.get('/tiktok.html', (req, res) => res.redirect(302, '/painel/tiktok'));

app.use(createApp());

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number(error.statusCode || error.status || 500);
    if (status >= 500) console.error('Erro em rota externa:', error);
    return res.status(status).json({
        ok: false,
        error: status >= 500 && C.IS_PRODUCTION ? 'Erro interno do servidor.' : (error.message || 'Erro interno do servidor.')
    });
});

app.listen(C.PORT, () => {
    console.log(`SkyNetApi rodando em http://localhost:${C.PORT}`);
});
