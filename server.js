const path = require('path');
const http = require('http');
const express = require('express');
const { createApp } = require('./src/app');
const { installGlobalSecurity } = require('./src/global-security');
const C = require('./src/config');
const S = require('./src/store');
const { registerTikTokRoutes } = require('./src/tiktok');
const { registerRobloxRoutes } = require('./src/roblox');
const { registerRobloxCodesRoutes } = require('./src/roblox-codes');
const { registerMediaRoutes } = require('./src/media');
const { registerYouTubeRoutes } = require('./src/youtube');
const { registerYouTubeMediaV4Routes } = require('./src/youtube-media-v4');
const { registerYouTubeSearchRoutes } = require('./src/youtube-search-v1');
const { registerCardV2Routes } = require('./src/cards-v2-routes');
const { registerXpAdminRoutes } = require('./src/xp-admin');
const { registerMusicRoutes } = require('./src/music');
const { registerBratRoutes } = require('./src/brat');
const { registerBotLogRoutes } = require('./src/bot-logs');
const { registerProfileEconomyRoutes, cleanupProfileEconomyAccount } = require('./src/profile-economy');
const { registerProfileNameDecorations, cleanupProfileNameDecorationsAccount } = require('./src/profile-name-decorations');
const { registerProfileDesignRoutes, cleanupProfileDesignAccount } = require('./src/profile-design');
const { registerStickerRoutes, cleanupStickersAccount } = require('./src/stickers');
const { registerWorkspaceBootstrapRoutes } = require('./src/workspace-bootstrap');
const { registerUpscaleRoutes } = require('./src/upscale-ai');
const { migrateExclusiveProfileItems } = require('./src/profile-exclusive-migration');
const { registerSocialRoutes, attachSocialSocket } = require('./src/social');
const { registerCommunityV2Routes, attachCommunitySocket } = require('./src/community-v2');
const { attachRealtimeCallsV3 } = require('./src/realtime-calls-v3');
const { registerGroupMessageLimiterV2 } = require('./src/group-message-limiter-v2');
const { registerProfileThemeRoutes, cleanupProfileThemeAccount } = require('./src/profile-theme');
const { cleanupCommunityAccount } = require('./src/community-cleanup');
const { registerTicTacToeRoutes, attachTicTacToeSocket, cleanupTicTacToeAccount } = require('./src/tictactoe');
const { attachCheckersSocket, cleanupCheckersAccount } = require('./src/checkers');
const { registerProfileMediaRoutes, cleanupProfileMediaAccount } = require('./src/profile-media');
const { registerExtraProfileCosmetics, cleanupExtraProfileCosmeticsAccount } = require('./src/profile-cosmetics-extra');

const app = express();
installGlobalSecurity(app);

try {
    const migration = migrateExclusiveProfileItems();
    if (migration.changedAccounts > 0) {
        console.log(`Cosméticos exclusivos migrados: ${migration.removedItems} item(ns), ${migration.refundedCoins} moeda(s) reembolsadas.`);
    }
} catch (error) {
    console.error('Falha ao migrar cosméticos exclusivos:', error);
}

app.use((req, res, next) => {
    if (req.method !== 'DELETE') return next();
    let accountId = null;
    const adminMatch = req.path.match(/^\/api\/admin\/users\/([^/]+)\/full$/);
    if (adminMatch) accountId = decodeURIComponent(adminMatch[1]);
    if (req.path === '/api/social/account') {
        try {
            const token = parseCookies(req.headers.cookie || '').skynet_session || '';
            const session = token ? S.getSession(token) : null;
            accountId = session?.accountId || null;
        } catch {}
    }
    if (accountId) {
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    cleanupCommunityAccount(accountId);
                    cleanupProfileEconomyAccount(accountId);
                    cleanupProfileNameDecorationsAccount(accountId);
                    cleanupProfileDesignAccount(accountId);
                    cleanupStickersAccount(accountId);
                    cleanupTicTacToeAccount(accountId);
                    cleanupCheckersAccount(accountId);
                    cleanupProfileMediaAccount(accountId);
                    cleanupExtraProfileCosmeticsAccount(accountId);
                    cleanupProfileThemeAccount(accountId);
                } catch (error) { console.error('Falha ao limpar dados da conta:', error); }
            }
        });
    }
    return next();
});

registerTikTokRoutes(app);
registerRobloxRoutes(app);
registerRobloxCodesRoutes(app);
registerMediaRoutes(app);
registerYouTubeMediaV4Routes(app);
registerYouTubeSearchRoutes(app);
registerYouTubeRoutes(app);
registerCardV2Routes(app);
registerXpAdminRoutes(app);
registerMusicRoutes(app);
registerBratRoutes(app);
registerBotLogRoutes(app);
registerTicTacToeRoutes(app);
registerProfileMediaRoutes(app);
registerExtraProfileCosmetics(app);
registerProfileNameDecorations(app);
registerProfileEconomyRoutes(app);
registerProfileDesignRoutes(app);
registerStickerRoutes(app);
registerWorkspaceBootstrapRoutes(app);
registerUpscaleRoutes(app);
registerProfileThemeRoutes(app);
registerGroupMessageLimiterV2(app);
registerCommunityV2Routes(app);

app.delete('/api/social/account', (req, res, next) => {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        const account = session ? S.loadAccounts().find(item => item.id === session.accountId && item.active) : null;
        if (account?.isAdmin) {
            const activeAdmins = S.loadAccounts().filter(item => item.active && item.isAdmin);
            if (activeAdmins.length <= 1) {
                return res.status(400).json({ ok: false, error: 'É necessário manter ao menos um administrador ativo.' });
            }
        }
        return next();
    } catch (error) {
        return next(error);
    }
});

app.use((req, res, next) => {
    const publicProfile = req.method === 'GET' && req.path.startsWith('/api/social/profile/');
    const podium = req.method === 'GET' && req.path === '/api/social/podium';
    const search = req.method === 'GET' && req.path === '/api/social/users';
    if (!publicProfile && !podium && !search) return next();

    const originalJson = res.json.bind(res);
    res.json = payload => {
        if (publicProfile && payload?.profile) {
            payload = { ...payload, profile: { ...payload.profile, online: false } };
        } else if (podium && Array.isArray(payload?.podium)) {
            payload = { ...payload, podium: payload.podium.map(item => ({ ...item, online: false })) };
        } else if (search && Array.isArray(payload?.users)) {
            payload = {
                ...payload,
                users: payload.users.map(item => item.relationship?.type === 'friend' ? item : { ...item, online: false })
            };
        }
        return originalJson(payload);
    };
    return next();
});

registerSocialRoutes(app);

const workspaceRoutes = [
    '/painel',
    '/painel/conta',
    '/painel/perfil',
    '/painel/amigos',
    '/painel/chat',
    '/painel/figurinhas',
    '/painel/grupos',
    '/painel/jogos',
    '/painel/jogos/damas',
    '/painel/jogos/dados',
    '/painel/musica',
    '/painel/visual',
    '/painel/upscale',
    '/painel/chaves',
    '/painel/cards',
    '/painel/card2',
    '/painel/brat',
    '/painel/uploads',
    '/painel/tiktok',
    '/painel/youtube',
    '/painel/youtube-search',
    '/painel/media',
    '/painel/roblox',
    '/painel/roblox-codes',
    '/painel/historico',
    '/painel/api'
];

for (const route of workspaceRoutes) {
    app.get(route, (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'workspace.html')));
}

app.get('/brat', (req, res) => res.redirect(302, '/painel/brat'));
app.get('/brat-generator', (req, res) => res.redirect(302, '/painel/brat'));
app.get('/brat.html', (req, res) => res.redirect(302, '/painel/brat'));

app.get('/painel/login', (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'login.html')));
app.get('/painel/cadastro', (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'register.html')));
app.get('/u/:username', (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'public-profile.html')));

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

const server = http.createServer(app);
const io = attachSocialSocket(server);

io.use((socket, next) => {
    const origin = String(socket.handshake.headers.origin || '').trim();
    if (!origin) return next();
    try {
        const parsed = new URL(origin);
        const requestHost = String(socket.handshake.headers.host || '').trim();
        if (parsed.host === requestHost || C.CORS_ORIGINS.has(origin)) return next();
    } catch {}
    return next(new Error('Origem não permitida'));
});

attachCommunitySocket(io);
attachRealtimeCallsV3(io);
attachTicTacToeSocket(io);
attachCheckersSocket(io);

server.listen(C.PORT, () => {
    console.log(`SkyNetApi rodando em http://localhost:${C.PORT}`);
});

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
