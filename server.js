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

app.get('/tiktok', (req, res) => {
    res.redirect(302, '/painel');
});

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
