const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const C = require('./config');
const S = require('./store');
const Cards = require('./cards');

const APP_VERSION = (() => { try { return require('../package.json').version || '2.0.0'; } catch { return '2.0.0'; } })();

function createApp() {
    S.initStorage();
    Cards.registerFont();

    const app = express();
    app.disable('x-powered-by');
    if (C.TRUST_PROXY) app.set('trust proxy', 1);
    app.use(securityHeaders);
    app.use(cors({
        origin(origin, callback) {
            if (!origin || C.CORS_ORIGINS.has(origin)) return callback(null, true);
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
    }));
    app.use(express.json({ limit: '256kb' }));
    app.use(express.urlencoded({ limit: '256kb', extended: true }));
    app.use(createRateLimiter({ windowMs: 60000, max: 240, keyFn: req => req.ip, message: 'Muitas requisições. Tente novamente em instantes.' }));

    const staticFiles = express.static(C.PUBLIC_DIR, { index: false, dotfiles: 'deny', etag: true, maxAge: C.IS_PRODUCTION ? '1h' : 0 });
    app.use((req, res, next) => {
        if (req.path.startsWith('/uploads/') || req.path.startsWith('/generated/')) return next();
        return staticFiles(req, res, next);
    });
    app.use('/generated', express.static(C.GENERATED_DIR, { index: false, dotfiles: 'deny', immutable: C.IS_PRODUCTION, maxAge: C.IS_PRODUCTION ? '7d' : 0 }));

    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: C.MAX_UPLOAD_MB * 1024 * 1024, files: 2, fields: 20 } });
    const cardUploadFields = upload.fields([{ name: 'fundo_file', maxCount: 1 }, { name: 'avatar_file', maxCount: 1 }]);
    const loginLimiter = createRateLimiter({ windowMs: 15 * 60000, max: 10, keyFn: req => req.ip, message: 'Muitas tentativas de login. Tente novamente mais tarde.' });
    const registerLimiter = createRateLimiter({ windowMs: 60 * 60000, max: 5, keyFn: req => req.ip, message: 'Muitos cadastros a partir deste endereço. Tente novamente mais tarde.' });
    const cardLimiter = createRateLimiter({ windowMs: 60000, max: C.CARD_RATE_LIMIT_PER_MINUTE, keyFn: req => req.account?.id || req.ip, message: 'Limite de geração atingido. Aguarde um pouco e tente novamente.' });

    app.post('/api/auth/register', registerLimiter, requireTrustedOrigin, (req, res) => {
        const username = S.normalizeUsername(req.body?.username);
        const password = String(req.body?.password || '');
        if (!username || username.length < 3 || username.length > 30 || !/^[a-z0-9_-]+$/.test(username)) return res.status(400).json({ ok: false, error: 'Usuário inválido. Use 3 a 30 caracteres: letras, números, _ ou -.' });
        if (password.length < 8 || password.length > 128) return res.status(400).json({ ok: false, error: 'A senha deve ter entre 8 e 128 caracteres.' });
        const accounts = S.loadAccounts();
        if (accounts.some(a => a.usernameLower === username)) return res.status(409).json({ ok: false, error: 'Esse usuário já existe.' });
        const account = { id: S.randomId(), username, usernameLower: username, passwordHash: S.createSecretHash(password), active: C.AUTO_ACTIVATE_ACCOUNTS, isAdmin: false, createdAt: new Date().toISOString(), lastLoginAt: null };
        accounts.push(account);
        S.saveAccounts(accounts);
        return res.status(201).json({ ok: true, active: account.active, message: account.active ? 'Conta criada. Você já pode entrar.' : 'Conta criada. Aguarde a ativação por um administrador.' });
    });

    app.post('/api/auth/login', loginLimiter, requireTrustedOrigin, (req, res) => {
        const username = S.normalizeUsername(req.body?.username);
        const password = String(req.body?.password || '');
        const accounts = S.loadAccounts();
        const account = accounts.find(a => a.usernameLower === username);
        if (!account || !S.verifySecret(password, account.passwordHash)) return res.status(401).json({ ok: false, error: 'Credenciais inválidas.' });
        if (!account.active) return res.status(403).json({ ok: false, error: 'Conta aguardando ativação.' });
        account.lastLoginAt = new Date().toISOString();
        S.saveAccounts(accounts);
        const token = S.createSession(account.id);
        setSessionCookie(res, token);
        return res.json({ ok: true, account: S.publicAccountView(account) });
    });

    app.post('/api/auth/logout', requireTrustedOrigin, requireAuth, (req, res) => {
        S.deleteSession(req.sessionToken);
        clearSessionCookie(res);
        return res.json({ ok: true });
    });
    app.get('/api/auth/me', requireAuth, (req, res) => res.json({ ok: true, account: S.publicAccountView(req.account) }));

    app.get('/api/keys', requireAuth, (req, res) => {
        const keys = S.loadApiKeys().filter(k => k.accountId === req.account.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(S.publicKeyView);
        return res.json({ ok: true, keys });
    });
    app.post('/api/keys', requireTrustedOrigin, requireAuth, (req, res) => {
        const name = String(req.body?.name || '').trim();
        if (!name || name.length > 50) return res.status(400).json({ ok: false, error: 'O nome da chave deve ter entre 1 e 50 caracteres.' });
        const keys = S.loadApiKeys();
        if (keys.filter(k => k.accountId === req.account.id).length >= C.MAX_KEYS_PER_ACCOUNT) return res.status(409).json({ ok: false, error: `Limite de ${C.MAX_KEYS_PER_ACCOUNT} chaves por conta atingido.` });
        const apiKey = `skynet_${crypto.randomBytes(32).toString('hex')}`;
        const record = { id: S.randomId(), accountId: req.account.id, name, keyHash: S.hashKey(apiKey), preview: `${apiKey.slice(0, 14)}...${apiKey.slice(-6)}`, active: true, createdAt: new Date().toISOString(), lastUsedAt: null, requestCount: 0 };
        keys.push(record);
        S.saveApiKeys(keys);
        return res.status(201).json({ ok: true, key: S.publicKeyView(record), apiKey, message: 'Copie a chave agora. Ela não será exibida novamente.' });
    });
    app.patch('/api/keys/:id', requireTrustedOrigin, requireAuth, (req, res) => {
        const keys = S.loadApiKeys();
        const key = keys.find(k => k.id === req.params.id && k.accountId === req.account.id);
        if (!key) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'active')) {
            if (typeof req.body.active !== 'boolean') return res.status(400).json({ ok: false, error: 'O campo active deve ser booleano.' });
            key.active = req.body.active;
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
            const name = String(req.body.name || '').trim();
            if (!name || name.length > 50) return res.status(400).json({ ok: false, error: 'Nome de chave inválido.' });
            key.name = name;
        }
        S.saveApiKeys(keys);
        return res.json({ ok: true, key: S.publicKeyView(key) });
    });
    app.delete('/api/keys/:id', requireTrustedOrigin, requireAuth, (req, res) => {
        const keys = S.loadApiKeys();
        const index = keys.findIndex(k => k.id === req.params.id && k.accountId === req.account.id);
        if (index === -1) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
        keys.splice(index, 1);
        S.saveApiKeys(keys);
        return res.json({ ok: true });
    });

    app.post('/api/uploads', requireTrustedOrigin, requireAuth, upload.single('file'), async (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ ok: false, error: 'Nenhuma imagem enviada.' });
            const uploads = S.loadUploads();
            if (uploads.filter(u => u.accountId === req.account.id).length >= C.MAX_UPLOADS_PER_ACCOUNT) throw Cards.clientError(`Limite de ${C.MAX_UPLOADS_PER_ACCOUNT} uploads por conta atingido.`, 409);
            const checked = await Cards.validateAndNormalizeUpload(req.file.buffer, req.file.mimetype);
            const id = S.randomId();
            const filename = `${id}.${checked.extension}`;
            fs.writeFileSync(path.join(C.UPLOADS_DIR, filename), checked.buffer, { mode: 0o600 });
            const record = { id, accountId: req.account.id, originalName: safeOriginalName(req.file.originalname), filename, mime: checked.mime, size: checked.buffer.length, width: checked.width, height: checked.height, createdAt: new Date().toISOString() };
            uploads.push(record);
            S.saveUploads(uploads);
            return res.status(201).json({ ok: true, upload: S.publicUploadView(record), ...S.publicUploadView(record) });
        } catch (error) { return next(error); }
    });
    app.get('/api/uploads', requireAuth, (req, res) => res.json({ ok: true, uploads: S.loadUploads().filter(u => u.accountId === req.account.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(S.publicUploadView) }));
    app.delete('/api/uploads/:id', requireTrustedOrigin, requireAuth, (req, res) => {
        const uploads = S.loadUploads();
        const index = uploads.findIndex(u => u.id === req.params.id && u.accountId === req.account.id);
        if (index === -1) return res.status(404).json({ ok: false, error: 'Arquivo não encontrado.' });
        S.removeFileIfExists(path.join(C.UPLOADS_DIR, uploads[index].filename));
        uploads.splice(index, 1);
        S.saveUploads(uploads);
        return res.json({ ok: true });
    });
    app.get('/uploads/:filename', requireAuth, (req, res) => {
        const safeName = path.basename(req.params.filename);
        const uploadRecord = S.loadUploads().find(u => u.filename === safeName && u.accountId === req.account.id);
        if (!uploadRecord) return res.status(404).end();
        const filepath = path.join(C.UPLOADS_DIR, safeName);
        if (!fs.existsSync(filepath)) return res.status(404).end();
        res.setHeader('Cache-Control', 'private, max-age=3600');
        return res.sendFile(filepath);
    });

    app.get('/api/generations', requireAuth, (req, res) => res.json({ ok: true, generations: S.loadGenerations().filter(g => g.accountId === req.account.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100).map(S.publicGenerationView) }));
    app.delete('/api/generations/:id', requireTrustedOrigin, requireAuth, (req, res) => {
        const generations = S.loadGenerations();
        const index = generations.findIndex(g => g.id === req.params.id && g.accountId === req.account.id);
        if (index === -1) return res.status(404).json({ ok: false, error: 'Card não encontrado.' });
        S.removeFileIfExists(path.join(C.GENERATED_DIR, generations[index].filename));
        generations.splice(index, 1);
        S.saveGenerations(generations);
        return res.json({ ok: true });
    });

    app.get('/api/admin/accounts', requireAdminAuth, (req, res) => {
        const accounts = S.loadAccounts(), keys = S.loadApiKeys(), uploads = S.loadUploads(), generations = S.loadGenerations();
        return res.json({ ok: true, accounts: accounts.map(account => ({ ...S.publicAccountView(account), keyCount: keys.filter(k => k.accountId === account.id).length, activeKeyCount: keys.filter(k => k.accountId === account.id && k.active).length, totalRequests: keys.filter(k => k.accountId === account.id).reduce((sum, k) => sum + Number(k.requestCount || 0), 0), uploadCount: uploads.filter(u => u.accountId === account.id).length, generationCount: generations.filter(g => g.accountId === account.id).length })) });
    });
    app.patch('/api/admin/accounts/:id', requireTrustedOrigin, requireAdminAuth, (req, res) => {
        const accounts = S.loadAccounts();
        const account = accounts.find(a => a.id === req.params.id);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        const active = Object.prototype.hasOwnProperty.call(req.body || {}, 'active') ? req.body.active : account.active;
        const isAdmin = Object.prototype.hasOwnProperty.call(req.body || {}, 'isAdmin') ? req.body.isAdmin : account.isAdmin;
        if (typeof active !== 'boolean' || typeof isAdmin !== 'boolean') return res.status(400).json({ ok: false, error: 'active e isAdmin devem ser booleanos.' });
        if (account.id === req.account.id && (!active || !isAdmin)) return res.status(400).json({ ok: false, error: 'Você não pode desativar ou remover o próprio acesso administrativo.' });
        if ((!active || !isAdmin) && account.isAdmin && account.active && accounts.filter(a => a.isAdmin && a.active).length <= 1) return res.status(400).json({ ok: false, error: 'É necessário manter ao menos um administrador ativo.' });
        account.active = active;
        account.isAdmin = isAdmin;
        S.saveAccounts(accounts);
        if (!active) S.deleteSessionsForAccount(account.id);
        return res.json({ ok: true, account: S.publicAccountView(account) });
    });
    app.delete('/api/admin/accounts/:id', requireTrustedOrigin, requireAdminAuth, (req, res) => {
        if (req.params.id === req.account.id) return res.status(400).json({ ok: false, error: 'Você não pode excluir a própria conta administrativa.' });
        const accounts = S.loadAccounts();
        const index = accounts.findIndex(a => a.id === req.params.id);
        if (index === -1) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        const target = accounts[index];
        if (target.isAdmin && target.active && accounts.filter(a => a.isAdmin && a.active).length <= 1) return res.status(400).json({ ok: false, error: 'É necessário manter ao menos um administrador ativo.' });
        accounts.splice(index, 1);
        S.saveAccounts(accounts);
        S.saveApiKeys(S.loadApiKeys().filter(k => k.accountId !== target.id));
        const uploads = S.loadUploads(); uploads.filter(u => u.accountId === target.id).forEach(u => S.removeFileIfExists(path.join(C.UPLOADS_DIR, u.filename))); S.saveUploads(uploads.filter(u => u.accountId !== target.id));
        const generations = S.loadGenerations(); generations.filter(g => g.accountId === target.id).forEach(g => S.removeFileIfExists(path.join(C.GENERATED_DIR, g.filename))); S.saveGenerations(generations.filter(g => g.accountId !== target.id));
        S.deleteSessionsForAccount(target.id);
        return res.json({ ok: true });
    });
    app.get('/api/admin/keys', requireAdminAuth, (req, res) => {
        const accountMap = new Map(S.loadAccounts().map(a => [a.id, a]));
        const keys = S.loadApiKeys().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(k => { const owner = accountMap.get(k.accountId); return { ...S.publicKeyView(k), ownerUsername: owner?.username || 'conta removida', ownerActive: Boolean(owner?.active) }; });
        return res.json({ ok: true, keys });
    });
    app.patch('/api/admin/keys/:id', requireTrustedOrigin, requireAdminAuth, (req, res) => {
        if (typeof req.body?.active !== 'boolean') return res.status(400).json({ ok: false, error: 'O campo active deve ser booleano.' });
        const keys = S.loadApiKeys(); const key = keys.find(k => k.id === req.params.id);
        if (!key) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
        key.active = req.body.active; S.saveApiKeys(keys); return res.json({ ok: true, key: S.publicKeyView(key) });
    });
    app.delete('/api/admin/keys/:id', requireTrustedOrigin, requireAdminAuth, (req, res) => {
        const keys = S.loadApiKeys(); const index = keys.findIndex(k => k.id === req.params.id);
        if (index === -1) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
        keys.splice(index, 1); S.saveApiKeys(keys); return res.json({ ok: true });
    });
    app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
        const accounts = S.loadAccounts(), keys = S.loadApiKeys(), uploads = S.loadUploads(), generations = S.loadGenerations();
        return res.json({ ok: true, stats: { accounts: accounts.length, activeAccounts: accounts.filter(a => a.active).length, pendingAccounts: accounts.filter(a => !a.active).length, apiKeys: keys.length, activeApiKeys: keys.filter(k => k.active).length, requests: keys.reduce((sum, k) => sum + Number(k.requestCount || 0), 0), uploads: uploads.length, generations: generations.length, uptime: process.uptime() } });
    });

    app.post('/generate-card', requireApiKey, cardLimiter, cardUploadFields, async (req, res, next) => {
        try {
            const result = await Cards.createCardForAccount(req.account, Cards.normalizePostCardInput(req.body), req.files, 'api');
            return res.json({ ok: true, id: result.id, url: result.url, filename: result.filename, createdAt: result.createdAt, neon: result.neon });
        } catch (error) { return next(error); }
    });
    app.post('/painel/gerar', requireTrustedOrigin, requireAuth, cardLimiter, cardUploadFields, async (req, res, next) => {
        try {
            const result = await Cards.createCardForAccount(req.account, Cards.normalizePostCardInput(req.body), req.files, 'panel');
            return res.json({ ok: true, id: result.id, url: result.url, filename: result.filename, createdAt: result.createdAt, neon: result.neon });
        } catch (error) { return next(error); }
    });
    app.get('/generate-card', requireApiKey, cardLimiter, async (req, res, next) => {
        try {
            const result = await Cards.createCardForAccount(req.account, Cards.normalizeQueryCardInput(req.query), null, 'url');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
            return res.type('png').send(result.buffer);
        } catch (error) { return next(error); }
    });

    app.get('/health', (req, res) => res.json({ status: 'OK', name: 'SkyNetApi', version: APP_VERSION, uptime: process.uptime(), timestamp: new Date().toISOString() }));
    app.get('/api/system-info', (req, res) => res.json({ ok: true, name: 'SkyNetApi', version: APP_VERSION, uptime: process.uptime(), timestamp: new Date().toISOString() }));
    app.get('/api/routes-info', (req, res) => res.json({ grupos: [{ nome: 'Cards', routes: [{ method: 'GET', path: '/generate-card?avatar=&fundo=&textocima=&textopr=&textobaixo=&apikey=', auth: 'apikey', desc: 'Gera PNG 1080x1080 diretamente pela URL' }, { method: 'POST', path: '/generate-card', auth: 'apikey', desc: 'Gera card via FormData' }, { method: 'POST', path: '/painel/gerar', auth: true, desc: 'Gera card pelo painel' }] }] }));
    app.get('/', (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'index.html')));
    app.get('/painel', (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'painel.html')));
    app.get('/upload', (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'upload.html')));
    app.get('/admin', (req, res) => res.redirect('/admin/painel'));
    app.get('/admin/painel', (req, res) => res.sendFile(path.join(C.PUBLIC_DIR, 'admin.html')));

    app.use((req, res) => {
        if (req.path.startsWith('/api/') || req.path === '/generate-card' || req.path === '/painel/gerar') return res.status(404).json({ ok: false, error: 'Rota não encontrada.' });
        return res.status(404).send('Página não encontrada');
    });
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        if (err instanceof multer.MulterError) return res.status(400).json({ ok: false, error: err.code === 'LIMIT_FILE_SIZE' ? `A imagem ultrapassa o limite de ${C.MAX_UPLOAD_MB}MB.` : 'Upload inválido.' });
        const status = Number(err.statusCode || err.status || 500);
        if (status >= 500) console.error('Erro interno:', err);
        return res.status(status).json({ ok: false, error: status >= 500 && C.IS_PRODUCTION ? 'Erro interno do servidor.' : (err.message || 'Erro interno do servidor.') });
    });
    return app;
}

function getSessionToken(req) { return parseCookies(req.headers.cookie || '').skynet_session || ''; }
function requireAuth(req, res, next) {
    try {
        const token = getSessionToken(req); const session = token ? S.getSession(token) : null;
        if (!session) { clearSessionCookie(res); return res.status(401).json({ ok: false, error: 'Não autorizado.' }); }
        const account = S.loadAccounts().find(a => a.id === session.accountId);
        if (!account || !account.active) { S.deleteSession(token); clearSessionCookie(res); return res.status(401).json({ ok: false, error: 'Conta inativa ou removida.' }); }
        req.account = account; req.sessionToken = token; req.session = session; return next();
    } catch (error) { return next(error); }
}
function requireAdminAuth(req, res, next) { return requireAuth(req, res, error => { if (error) return next(error); if (!req.account?.isAdmin) return res.status(403).json({ ok: false, error: 'Permissão de administrador necessária.' }); return next(); }); }
function requireApiKey(req, res, next) {
    try {
        const authorization = String(req.headers.authorization || '');
        const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
        const queryKey = typeof req.query?.apikey === 'string' ? req.query.apikey : '';
        const auth = S.authenticateApiKey(req.headers['x-api-key'] || bearer || queryKey);
        if (!auth) return res.status(401).json({ ok: false, error: 'API key inválida ou ausente.' });
        req.account = auth.account; req.apiKeyRecord = auth.record; return next();
    } catch (error) { return next(error); }
}
function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob: https:", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"].join('; '));
    if (C.IS_PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return next();
}
function createRateLimiter({ windowMs, max, keyFn, message }) {
    const buckets = new Map();
    const cleanup = setInterval(() => { const now = Date.now(); for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key); }, Math.max(windowMs, 60000)); cleanup.unref?.();
    return (req, res, next) => {
        const now = Date.now(), key = String(keyFn(req) || 'unknown'); let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) { bucket = { count: 0, resetAt: now + windowMs }; buckets.set(key, bucket); }
        bucket.count += 1; res.setHeader('RateLimit-Limit', String(max)); res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count))); res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
        if (bucket.count > max) { res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000))); return res.status(429).json({ ok: false, error: message }); }
        return next();
    };
}
function parseCookies(header) {
    const out = {};
    for (const part of String(header).split(';')) { const index = part.indexOf('='); if (index < 0) continue; const key = part.slice(0, index).trim(); const value = part.slice(index + 1).trim(); try { out[key] = decodeURIComponent(value); } catch { out[key] = value; } }
    return out;
}
function setSessionCookie(res, token) {
    const parts = [`skynet_session=${encodeURIComponent(token)}`, 'Path=/', `Max-Age=${C.SESSION_DAYS * 86400}`, 'HttpOnly', 'SameSite=Strict']; if (C.IS_PRODUCTION) parts.push('Secure'); res.setHeader('Set-Cookie', parts.join('; '));
}
function clearSessionCookie(res) { const parts = ['skynet_session=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict']; if (C.IS_PRODUCTION) parts.push('Secure'); res.setHeader('Set-Cookie', parts.join('; ')); }
function safeOriginalName(value) { return path.basename(String(value || 'imagem')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) || 'imagem'; }

module.exports = { createApp };
