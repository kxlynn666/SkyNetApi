const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');

function loadLocalEnv(file) {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
    }
}

loadLocalEnv(path.join(__dirname, '.env'));

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const sharp = require('sharp');

const app = express();
const APP_VERSION = (() => { try { return require('./package.json').version || '1.0.0'; } catch { return '1.0.0'; } })();
const PORT = toInt(process.env.PORT, 3000, 1, 65535);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const TRUST_PROXY = ['1', 'true', 'yes'].includes(String(process.env.TRUST_PROXY || '').toLowerCase());
const SESSION_DAYS = toInt(process.env.SESSION_DAYS, 7, 1, 30);
const AUTO_ACTIVATE_ACCOUNTS = String(process.env.AUTO_ACTIVATE_ACCOUNTS || 'false').toLowerCase() === 'true';
const MAX_KEYS_PER_ACCOUNT = toInt(process.env.MAX_KEYS_PER_ACCOUNT, 10, 1, 50);
const MAX_UPLOAD_MB = toInt(process.env.MAX_UPLOAD_MB, 15, 1, 25);
const MAX_UPLOADS_PER_ACCOUNT = toInt(process.env.MAX_UPLOADS_PER_ACCOUNT, 100, 1, 1000);
const MAX_GENERATIONS_PER_ACCOUNT = toInt(process.env.MAX_GENERATIONS_PER_ACCOUNT, 200, 10, 2000);
const MAX_REMOTE_IMAGE_MB = toInt(process.env.MAX_REMOTE_IMAGE_MB, 15, 1, 25);
const CARD_RATE_LIMIT_PER_MINUTE = toInt(process.env.CARD_RATE_LIMIT_PER_MINUTE, 30, 1, 300);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const GENERATED_DIR = path.join(PUBLIC_DIR, 'generated');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const KEYS_FILE = path.join(DATA_DIR, 'apikeys.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const UPLOADS_FILE = path.join(DATA_DIR, 'uploads.json');
const GENERATIONS_FILE = path.join(DATA_DIR, 'generations.json');
const FONT_PATH = process.env.FONT_PATH || path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf');
const CORS_ORIGINS = new Set(String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean));

app.disable('x-powered-by');
if (TRUST_PROXY) app.set('trust proxy', 1);

ensureDirectories();
ensureJsonFile(ACCOUNTS_FILE, []);
ensureJsonFile(KEYS_FILE, []);
ensureJsonFile(SESSIONS_FILE, []);
ensureJsonFile(UPLOADS_FILE, []);
ensureJsonFile(GENERATIONS_FILE, []);
ensureAdminAccount();
registerFont();

app.use(securityHeaders);
app.use(cors({
    origin(origin, callback) {
        if (!origin || CORS_ORIGINS.has(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ limit: '256kb', extended: true }));
app.use(createRateLimiter({ windowMs: 60_000, max: 240, keyFn: req => req.ip, message: 'Muitas requisições. Tente novamente em instantes.' }));

const publicStatic = express.static(PUBLIC_DIR, {
    index: false,
    dotfiles: 'deny',
    etag: true,
    maxAge: IS_PRODUCTION ? '1h' : 0
});
app.use((req, res, next) => {
    if (req.path.startsWith('/uploads/') || req.path.startsWith('/generated/')) return next();
    return publicStatic(req, res, next);
});
app.use('/generated', express.static(GENERATED_DIR, {
    index: false,
    dotfiles: 'deny',
    immutable: IS_PRODUCTION,
    maxAge: IS_PRODUCTION ? '7d' : 0
}));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 2, fields: 30 }
});

const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10, keyFn: req => req.ip, message: 'Muitas tentativas de login. Tente novamente mais tarde.' });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 5, keyFn: req => req.ip, message: 'Muitos cadastros a partir deste endereço. Tente novamente mais tarde.' });
const cardLimiter = createRateLimiter({ windowMs: 60_000, max: CARD_RATE_LIMIT_PER_MINUTE, keyFn: req => req.account?.id || req.ip, message: 'Limite de geração atingido. Aguarde um pouco e tente novamente.' });

const ROUTES_CATALOG = {
    grupos: [
        {
            nome: 'Autenticação',
            routes: [
                { method: 'POST', path: '/api/auth/register', auth: false, desc: 'Registrar nova conta' },
                { method: 'POST', path: '/api/auth/login', auth: false, desc: 'Fazer login' },
                { method: 'POST', path: '/api/auth/logout', auth: true, desc: 'Encerrar sessão' },
                { method: 'GET', path: '/api/auth/me', auth: true, desc: 'Dados da conta logada' }
            ]
        },
        {
            nome: 'API Keys',
            routes: [
                { method: 'GET', path: '/api/keys', auth: true, desc: 'Listar minhas API keys' },
                { method: 'POST', path: '/api/keys', auth: true, desc: 'Criar nova API key' },
                { method: 'PATCH', path: '/api/keys/:id', auth: true, desc: 'Renomear ou ativar/desativar uma chave' },
                { method: 'DELETE', path: '/api/keys/:id', auth: true, desc: 'Excluir uma API key' }
            ]
        },
        {
            nome: 'Cards',
            routes: [
                { method: 'POST', path: '/generate-card', auth: 'apikey', desc: 'Gerar card via API key' },
                { method: 'POST', path: '/painel/gerar', auth: true, desc: 'Gerar card pelo painel' },
                { method: 'GET', path: '/api/generations', auth: true, desc: 'Listar histórico de cards da conta' },
                { method: 'DELETE', path: '/api/generations/:id', auth: true, desc: 'Excluir um card da conta' }
            ]
        },
        {
            nome: 'Uploads',
            routes: [
                { method: 'POST', path: '/api/uploads', auth: true, desc: 'Enviar uma imagem' },
                { method: 'GET', path: '/api/uploads', auth: true, desc: 'Listar minhas imagens' },
                { method: 'DELETE', path: '/api/uploads/:id', auth: true, desc: 'Excluir uma imagem' }
            ]
        },
        {
            nome: 'Admin',
            routes: [
                { method: 'GET', path: '/api/admin/accounts', auth: 'admin', desc: 'Listar contas' },
                { method: 'PATCH', path: '/api/admin/accounts/:id', auth: 'admin', desc: 'Alterar status ou permissão de uma conta' },
                { method: 'DELETE', path: '/api/admin/accounts/:id', auth: 'admin', desc: 'Excluir uma conta' },
                { method: 'GET', path: '/api/admin/keys', auth: 'admin', desc: 'Listar todas as API keys' },
                { method: 'PATCH', path: '/api/admin/keys/:id', auth: 'admin', desc: 'Ativar ou revogar uma API key' },
                { method: 'DELETE', path: '/api/admin/keys/:id', auth: 'admin', desc: 'Excluir uma API key' },
                { method: 'GET', path: '/api/admin/stats', auth: 'admin', desc: 'Resumo de uso do serviço' }
            ]
        }
    ]
};

app.post('/api/auth/register', registerLimiter, requireTrustedOrigin, (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');

    if (!username || username.length < 3 || username.length > 30 || !/^[a-z0-9_-]+$/.test(username)) {
        return res.status(400).json({ ok: false, error: 'Usuário inválido. Use 3 a 30 caracteres: letras, números, _ ou -.' });
    }
    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ ok: false, error: 'A senha deve ter entre 8 e 128 caracteres.' });
    }

    const accounts = loadAccounts();
    if (accounts.some(a => a.usernameLower === username)) {
        return res.status(409).json({ ok: false, error: 'Esse usuário já existe.' });
    }

    const account = {
        id: randomId(16),
        username,
        usernameLower: username,
        passwordHash: createSecretHash(password),
        active: AUTO_ACTIVATE_ACCOUNTS,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: null
    };
    accounts.push(account);
    saveAccounts(accounts);

    return res.status(201).json({
        ok: true,
        active: account.active,
        message: account.active
            ? 'Conta criada. Você já pode entrar.'
            : 'Conta criada. Aguarde a ativação por um administrador.'
    });
});

app.post('/api/auth/login', loginLimiter, requireTrustedOrigin, (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const accounts = loadAccounts();
    const account = accounts.find(a => a.usernameLower === username);

    if (!account || !verifySecret(password, account.passwordHash)) {
        return res.status(401).json({ ok: false, error: 'Credenciais inválidas.' });
    }
    if (!account.active) {
        return res.status(403).json({ ok: false, error: 'Conta aguardando ativação.' });
    }

    account.lastLoginAt = new Date().toISOString();
    saveAccounts(accounts);
    const token = createSession(account.id);
    setSessionCookie(res, token);

    return res.json({ ok: true, account: publicAccountView(account) });
});

app.post('/api/auth/logout', requireTrustedOrigin, requireAuth, (req, res) => {
    deleteSession(req.sessionToken);
    clearSessionCookie(res);
    return res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    return res.json({ ok: true, account: publicAccountView(req.account) });
});

app.get('/api/keys', requireAuth, (req, res) => {
    const keys = loadApiKeys()
        .filter(k => k.accountId === req.account.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(publicKeyView);
    return res.json({ ok: true, keys });
});

app.post('/api/keys', requireTrustedOrigin, requireAuth, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 50) {
        return res.status(400).json({ ok: false, error: 'O nome da chave deve ter entre 1 e 50 caracteres.' });
    }

    const keys = loadApiKeys();
    const ownerKeys = keys.filter(k => k.accountId === req.account.id);
    if (ownerKeys.length >= MAX_KEYS_PER_ACCOUNT) {
        return res.status(409).json({ ok: false, error: `Limite de ${MAX_KEYS_PER_ACCOUNT} chaves por conta atingido.` });
    }

    const apiKey = `skynet_${crypto.randomBytes(32).toString('hex')}`;
    const record = {
        id: randomId(16),
        accountId: req.account.id,
        name,
        keyHash: hashKey(apiKey),
        preview: `${apiKey.slice(0, 14)}...${apiKey.slice(-6)}`,
        active: true,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        requestCount: 0
    };
    keys.push(record);
    saveApiKeys(keys);

    return res.status(201).json({
        ok: true,
        key: publicKeyView(record),
        apiKey,
        message: 'Copie a chave agora. Ela não será exibida novamente.'
    });
});

app.patch('/api/keys/:id', requireTrustedOrigin, requireAuth, (req, res) => {
    const keys = loadApiKeys();
    const key = keys.find(k => k.id === req.params.id && k.accountId === req.account.id);
    if (!key) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'active')) {
        if (typeof req.body.active !== 'boolean') {
            return res.status(400).json({ ok: false, error: 'O campo active deve ser booleano.' });
        }
        key.active = req.body.active;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
        const name = String(req.body.name || '').trim();
        if (!name || name.length > 50) {
            return res.status(400).json({ ok: false, error: 'Nome de chave inválido.' });
        }
        key.name = name;
    }

    saveApiKeys(keys);
    return res.json({ ok: true, key: publicKeyView(key) });
});

app.delete('/api/keys/:id', requireTrustedOrigin, requireAuth, (req, res) => {
    const keys = loadApiKeys();
    const index = keys.findIndex(k => k.id === req.params.id && k.accountId === req.account.id);
    if (index === -1) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
    keys.splice(index, 1);
    saveApiKeys(keys);
    return res.json({ ok: true });
});

app.post('/api/uploads', requireTrustedOrigin, requireAuth, upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ ok: false, error: 'Nenhuma imagem enviada.' });
        const currentUploads = loadUploads();
        if (currentUploads.filter(u => u.accountId === req.account.id).length >= MAX_UPLOADS_PER_ACCOUNT) {
            throw clientError(`Limite de ${MAX_UPLOADS_PER_ACCOUNT} uploads por conta atingido.`, 409);
        }
        const checked = await validateAndNormalizeUpload(req.file.buffer, req.file.mimetype);
        const id = randomId(16);
        const filename = `${id}.${checked.extension}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filepath, checked.buffer, { mode: 0o600 });

        const uploads = currentUploads;
        const record = {
            id,
            accountId: req.account.id,
            originalName: safeOriginalName(req.file.originalname),
            filename,
            mime: checked.mime,
            size: checked.buffer.length,
            width: checked.width,
            height: checked.height,
            createdAt: new Date().toISOString()
        };
        uploads.push(record);
        saveUploads(uploads);
        return res.status(201).json({ ok: true, upload: publicUploadView(record), ...publicUploadView(record) });
    } catch (error) {
        return next(error);
    }
});

app.get('/api/uploads', requireAuth, (req, res) => {
    const uploads = loadUploads()
        .filter(u => u.accountId === req.account.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(publicUploadView);
    return res.json({ ok: true, uploads });
});

app.delete('/api/uploads/:id', requireTrustedOrigin, requireAuth, (req, res) => {
    const uploads = loadUploads();
    const index = uploads.findIndex(u => u.id === req.params.id && u.accountId === req.account.id);
    if (index === -1) return res.status(404).json({ ok: false, error: 'Arquivo não encontrado.' });
    removeFileIfExists(path.join(UPLOADS_DIR, uploads[index].filename));
    uploads.splice(index, 1);
    saveUploads(uploads);
    return res.json({ ok: true });
});

app.get('/uploads/:filename', requireAuth, (req, res) => {
    const safeName = path.basename(req.params.filename);
    const uploadRecord = loadUploads().find(u => u.filename === safeName && u.accountId === req.account.id);
    if (!uploadRecord) return res.status(404).end();
    const filepath = path.join(UPLOADS_DIR, safeName);
    if (!fs.existsSync(filepath)) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(filepath);
});

app.get('/api/generations', requireAuth, (req, res) => {
    const items = loadGenerations()
        .filter(g => g.accountId === req.account.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100)
        .map(publicGenerationView);
    return res.json({ ok: true, generations: items });
});

app.delete('/api/generations/:id', requireTrustedOrigin, requireAuth, (req, res) => {
    const generations = loadGenerations();
    const index = generations.findIndex(g => g.id === req.params.id && g.accountId === req.account.id);
    if (index === -1) return res.status(404).json({ ok: false, error: 'Card não encontrado.' });
    removeFileIfExists(path.join(GENERATED_DIR, generations[index].filename));
    generations.splice(index, 1);
    saveGenerations(generations);
    return res.json({ ok: true });
});

app.get('/api/admin/accounts', requireAdminAuth, (req, res) => {
    const accounts = loadAccounts();
    const keys = loadApiKeys();
    const uploads = loadUploads();
    const generations = loadGenerations();
    const result = accounts.map(account => ({
        ...publicAccountView(account),
        keyCount: keys.filter(k => k.accountId === account.id).length,
        activeKeyCount: keys.filter(k => k.accountId === account.id && k.active).length,
        totalRequests: keys.filter(k => k.accountId === account.id).reduce((sum, k) => sum + Number(k.requestCount || 0), 0),
        uploadCount: uploads.filter(u => u.accountId === account.id).length,
        generationCount: generations.filter(g => g.accountId === account.id).length
    }));
    return res.json({ ok: true, accounts: result });
});

app.patch('/api/admin/accounts/:id', requireTrustedOrigin, requireAdminAuth, (req, res) => {
    const accounts = loadAccounts();
    const account = accounts.find(a => a.id === req.params.id);
    if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });

    const requestedActive = Object.prototype.hasOwnProperty.call(req.body || {}, 'active') ? req.body.active : account.active;
    const requestedAdmin = Object.prototype.hasOwnProperty.call(req.body || {}, 'isAdmin') ? req.body.isAdmin : account.isAdmin;
    if (typeof requestedActive !== 'boolean' || typeof requestedAdmin !== 'boolean') {
        return res.status(400).json({ ok: false, error: 'active e isAdmin devem ser booleanos.' });
    }
    if (account.id === req.account.id && (!requestedActive || !requestedAdmin)) {
        return res.status(400).json({ ok: false, error: 'Você não pode desativar ou remover o próprio acesso administrativo.' });
    }
    if ((!requestedActive || !requestedAdmin) && account.isAdmin && account.active) {
        const activeAdmins = accounts.filter(a => a.isAdmin && a.active);
        if (activeAdmins.length <= 1) {
            return res.status(400).json({ ok: false, error: 'É necessário manter ao menos um administrador ativo.' });
        }
    }

    account.active = requestedActive;
    account.isAdmin = requestedAdmin;
    saveAccounts(accounts);
    if (!account.active) deleteSessionsForAccount(account.id);
    return res.json({ ok: true, account: publicAccountView(account) });
});

app.delete('/api/admin/accounts/:id', requireTrustedOrigin, requireAdminAuth, (req, res) => {
    if (req.params.id === req.account.id) {
        return res.status(400).json({ ok: false, error: 'Você não pode excluir a própria conta administrativa.' });
    }

    const accounts = loadAccounts();
    const index = accounts.findIndex(a => a.id === req.params.id);
    if (index === -1) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
    const target = accounts[index];
    if (target.isAdmin && target.active && accounts.filter(a => a.isAdmin && a.active).length <= 1) {
        return res.status(400).json({ ok: false, error: 'É necessário manter ao menos um administrador ativo.' });
    }

    accounts.splice(index, 1);
    saveAccounts(accounts);

    const keys = loadApiKeys().filter(k => k.accountId !== target.id);
    saveApiKeys(keys);
    const uploads = loadUploads();
    uploads.filter(u => u.accountId === target.id).forEach(u => removeFileIfExists(path.join(UPLOADS_DIR, u.filename)));
    saveUploads(uploads.filter(u => u.accountId !== target.id));
    const generations = loadGenerations();
    generations.filter(g => g.accountId === target.id).forEach(g => removeFileIfExists(path.join(GENERATED_DIR, g.filename)));
    saveGenerations(generations.filter(g => g.accountId !== target.id));
    deleteSessionsForAccount(target.id);

    return res.json({ ok: true });
});

app.get('/api/admin/keys', requireAdminAuth, (req, res) => {
    const accounts = loadAccounts();
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const keys = loadApiKeys()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(k => {
            const owner = accountMap.get(k.accountId);
            return {
                ...publicKeyView(k),
                ownerUsername: owner?.username || 'conta removida',
                ownerActive: Boolean(owner?.active)
            };
        });
    return res.json({ ok: true, keys });
});

app.patch('/api/admin/keys/:id', requireTrustedOrigin, requireAdminAuth, (req, res) => {
    if (typeof req.body?.active !== 'boolean') {
        return res.status(400).json({ ok: false, error: 'O campo active deve ser booleano.' });
    }
    const keys = loadApiKeys();
    const key = keys.find(k => k.id === req.params.id);
    if (!key) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
    key.active = req.body.active;
    saveApiKeys(keys);
    return res.json({ ok: true, key: publicKeyView(key) });
});

app.delete('/api/admin/keys/:id', requireTrustedOrigin, requireAdminAuth, (req, res) => {
    const keys = loadApiKeys();
    const index = keys.findIndex(k => k.id === req.params.id);
    if (index === -1) return res.status(404).json({ ok: false, error: 'Chave não encontrada.' });
    keys.splice(index, 1);
    saveApiKeys(keys);
    return res.json({ ok: true });
});

app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
    const accounts = loadAccounts();
    const keys = loadApiKeys();
    const uploads = loadUploads();
    const generations = loadGenerations();
    return res.json({
        ok: true,
        stats: {
            accounts: accounts.length,
            activeAccounts: accounts.filter(a => a.active).length,
            pendingAccounts: accounts.filter(a => !a.active).length,
            apiKeys: keys.length,
            activeApiKeys: keys.filter(k => k.active).length,
            requests: keys.reduce((sum, k) => sum + Number(k.requestCount || 0), 0),
            uploads: uploads.length,
            generations: generations.length,
            uptime: process.uptime()
        }
    });
});

app.post('/generate-card', requireApiKey, cardLimiter, cardUploadFields, async (req, res, next) => {
    try {
        const result = await createCardForAccount(req.account, req.body, req.files, 'api');
        return res.json({ ok: true, ...result });
    } catch (error) {
        return next(error);
    }
});

app.post('/painel/gerar', requireTrustedOrigin, requireAuth, cardLimiter, cardUploadFields, async (req, res, next) => {
    try {
        const result = await createCardForAccount(req.account, req.body, req.files, 'panel');
        return res.json({ ok: true, ...result });
    } catch (error) {
        return next(error);
    }
});

app.get('/generate-card', requireApiKey, (req, res) => {
    return res.json({
        ok: true,
        endpoint: '/generate-card',
        method: 'POST',
        authentication: 'Header x-api-key',
        fields: {
            fundo_url: 'URL HTTP/HTTPS ou caminho de um upload da conta',
            avatar_url: 'URL HTTP/HTTPS ou caminho de um upload da conta',
            fundo_file: 'Arquivo de imagem',
            avatar_file: 'Arquivo de imagem',
            texto_topo: 'Texto do topo',
            texto_extra: 'Texto extra',
            texto_baixo: 'Texto principal',
            fontSizeBottom: '10-120',
            fontSizeTop: '10-120',
            fontSizeExtra: '10-120',
            textColorBottom: 'Cor hexadecimal',
            textColorTop: 'Cor hexadecimal',
            textColorExtra: 'Cor hexadecimal',
            glowColor: 'Cor hexadecimal',
            darkness: '0-100'
        }
    });
});

app.get('/health', (req, res) => {
    return res.json({ status: 'OK', name: 'SkyNetApi', version: APP_VERSION, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/system-info', (req, res) => {
    return res.json({ ok: true, name: 'SkyNetApi', version: APP_VERSION, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/routes-info', (req, res) => res.json(ROUTES_CATALOG));

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/painel', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'painel.html')));
app.get('/upload', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'upload.html')));
app.get('/admin', (req, res) => res.redirect('/admin/painel'));
app.get('/admin/painel', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.path === '/generate-card' || req.path === '/painel/gerar') {
        return res.status(404).json({ ok: false, error: 'Rota não encontrada.' });
    }
    return res.status(404).send('Página não encontrada');
});

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? `A imagem ultrapassa o limite de ${MAX_UPLOAD_MB}MB.`
            : 'Upload inválido.';
        return res.status(400).json({ ok: false, error: message });
    }
    const status = Number(err.statusCode || err.status || 500);
    if (status >= 500) console.error('Erro interno:', err);
    const message = status >= 500 && IS_PRODUCTION ? 'Erro interno do servidor.' : (err.message || 'Erro interno do servidor.');
    return res.status(status).json({ ok: false, error: message });
});

app.listen(PORT, () => {
    console.log(`SkyNetApi rodando em http://localhost:${PORT}`);
});

function cardUploadFields(req, res, next) {
    return upload.fields([
        { name: 'fundo_file', maxCount: 1 },
        { name: 'avatar_file', maxCount: 1 }
    ])(req, res, next);
}

async function createCardForAccount(account, body, files, source) {
    const fundoBuffer = await resolveImageBuffer(account, body?.fundo_url, files?.fundo_file?.[0]);
    const avatarBuffer = await resolveImageBuffer(account, body?.avatar_url, files?.avatar_file?.[0]);
    const params = sanitizeCardParams(body || {});
    const imageBuffer = await generateCardImage({ fundoBuffer, avatarBuffer, ...params });
    const id = randomId(16);
    const filename = `card-${id}.png`;
    fs.writeFileSync(path.join(GENERATED_DIR, filename), imageBuffer, { mode: 0o600 });

    const generations = loadGenerations();
    const record = {
        id,
        accountId: account.id,
        filename,
        createdAt: new Date().toISOString(),
        source,
        title: params.textoBaixo.slice(0, 100) || params.textoTopo.slice(0, 100) || 'Card sem título'
    };
    generations.push(record);
    const ownerItems = generations.filter(g => g.accountId === account.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    while (ownerItems.length > MAX_GENERATIONS_PER_ACCOUNT) {
        const old = ownerItems.shift();
        const index = generations.findIndex(g => g.id === old.id);
        if (index !== -1) generations.splice(index, 1);
        removeFileIfExists(path.join(GENERATED_DIR, old.filename));
    }
    saveGenerations(generations.slice(-5000));

    return { id, url: `/generated/${filename}`, filename, createdAt: record.createdAt };
}

async function resolveImageBuffer(account, urlValue, fileObj) {
    if (fileObj?.buffer) {
        return (await validateAndNormalizeUpload(fileObj.buffer, fileObj.mimetype)).buffer;
    }
    const raw = String(urlValue || '').trim();
    if (!raw) return null;

    const localFilename = extractLocalUploadFilename(raw);
    if (localFilename) {
        const uploadRecord = loadUploads().find(u => u.filename === localFilename && u.accountId === account.id);
        if (!uploadRecord) throw clientError('Upload não encontrado ou não pertence à sua conta.');
        const filepath = path.join(UPLOADS_DIR, uploadRecord.filename);
        if (!fs.existsSync(filepath)) throw clientError('O arquivo do upload não existe mais.');
        return fs.readFileSync(filepath);
    }

    return fetchRemoteImage(raw);
}

async function fetchRemoteImage(urlValue) {
    let current;
    try {
        current = new URL(urlValue);
    } catch {
        throw clientError('URL de imagem inválida.');
    }
    if (!['http:', 'https:'].includes(current.protocol)) throw clientError('Apenas URLs HTTP/HTTPS são permitidas.');

    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        await assertPublicHostname(current.hostname);
        const client = current.protocol === 'https:' ? https : http;
        const response = await axios.get(current.toString(), {
            responseType: 'arraybuffer',
            timeout: 6000,
            maxRedirects: 0,
            validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400),
            maxContentLength: MAX_REMOTE_IMAGE_MB * 1024 * 1024,
            maxBodyLength: MAX_REMOTE_IMAGE_MB * 1024 * 1024,
            headers: { 'User-Agent': 'SkyNetApi/1.1' },
            httpAgent: current.protocol === 'http:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined,
            httpsAgent: current.protocol === 'https:' ? new client.Agent({ keepAlive: false, lookup: safeLookup }) : undefined
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.location;
            if (!location) throw clientError('Redirecionamento remoto inválido.');
            current = new URL(location, current);
            if (!['http:', 'https:'].includes(current.protocol)) throw clientError('Redirecionamento para protocolo não permitido.');
            continue;
        }

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (contentType && !contentType.startsWith('image/')) throw clientError('A URL informada não retornou uma imagem.');
        const buffer = Buffer.from(response.data);
        if (buffer.length > MAX_REMOTE_IMAGE_MB * 1024 * 1024) throw clientError('Imagem remota muito grande.');
        return (await validateAndNormalizeUpload(buffer, contentType || '')).buffer;
    }

    throw clientError('A URL excedeu o limite de redirecionamentos.');
}

async function validateAndNormalizeUpload(buffer, declaredMime = '') {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw clientError('Arquivo de imagem vazio ou inválido.');
    const input = sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000, sequentialRead: true });
    const metadata = await input.metadata();
    const allowedFormats = new Set(['jpeg', 'png', 'webp', 'gif']);
    if (!metadata.format || !allowedFormats.has(metadata.format)) {
        throw clientError('Formato não suportado. Use JPG, PNG, WEBP ou GIF.');
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) {
        throw clientError('As dimensões da imagem são muito grandes.');
    }
    const normalized = await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
        .rotate()
        .png({ compressionLevel: 8 })
        .toBuffer();
    if (normalized.length > MAX_UPLOAD_MB * 1024 * 1024) {
        throw clientError(`A imagem processada ultrapassa o limite de ${MAX_UPLOAD_MB}MB.`);
    }
    return {
        buffer: normalized,
        extension: 'png',
        mime: 'image/png',
        width: metadata.width,
        height: metadata.height,
        declaredMime
    };
}

async function generateCardImage(params) {
    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 1280, 720);

    if (params.fundoBuffer) {
        const backgroundBuffer = await sharp(params.fundoBuffer, { limitInputPixels: 40_000_000 })
            .resize(1280, 720, { fit: 'cover' })
            .png()
            .toBuffer();
        const background = await loadImage(backgroundBuffer);
        ctx.drawImage(background, 0, 0, 1280, 720);
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${params.darkness / 100})`;
    ctx.fillRect(0, 0, 1280, 720);

    if (params.avatarBuffer) {
        const avatarBuffer = await sharp(params.avatarBuffer, { limitInputPixels: 40_000_000 })
            .resize(200, 200, { fit: 'cover' })
            .png()
            .toBuffer();
        const avatar = await loadImage(avatarBuffer);
        ctx.drawImage(avatar, 540, 200, 200, 200);
    }

    const fontFamily = fs.existsSync(FONT_PATH) ? 'SkyNet Sans' : 'Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (params.textoTopo) {
        ctx.font = `bold ${params.fontSizeTop}px ${fontFamily}`;
        ctx.fillStyle = params.textColorTop;
        ctx.shadowColor = params.glowColor;
        ctx.shadowBlur = 10;
        ctx.fillText(params.textoTopo, 640, 80, 1160);
    }

    if (params.textoExtra) {
        ctx.font = `${params.fontSizeExtra}px ${fontFamily}`;
        ctx.fillStyle = params.textColorExtra;
        ctx.shadowColor = params.glowColor;
        ctx.shadowBlur = 8;
        ctx.fillText(params.textoExtra, 640, 130, 1160);
    }

    if (params.textoBaixo) {
        ctx.font = `bold ${params.fontSizeBottom}px ${fontFamily}`;
        ctx.fillStyle = params.textColorBottom;
        ctx.shadowColor = params.glowColor;
        ctx.shadowBlur = 15;
        const lines = params.textoBaixo.split('\n').slice(0, 6);
        const lineHeight = params.fontSizeBottom + 10;
        const startY = 500 - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, index) => ctx.fillText(line, 640, startY + index * lineHeight, 1160));
    }

    return canvas.toBuffer('image/png');
}

function sanitizeCardParams(body) {
    return {
        textoTopo: cleanText(body.texto_topo, 180),
        textoExtra: cleanText(body.texto_extra, 220),
        textoBaixo: cleanText(body.texto_baixo, 600),
        fontSizeBottom: toInt(body.fontSizeBottom, 48, 10, 120),
        fontSizeTop: toInt(body.fontSizeTop, 28, 10, 120),
        fontSizeExtra: toInt(body.fontSizeExtra, 20, 10, 120),
        textColorBottom: safeHexColor(body.textColorBottom, '#ff00ff'),
        textColorTop: safeHexColor(body.textColorTop, '#ffffff'),
        textColorExtra: safeHexColor(body.textColorExtra, '#a78bfa'),
        glowColor: safeHexColor(body.glowColor, '#ff00ff'),
        darkness: toInt(body.darkness, 40, 0, 100)
    };
}

function requireAuth(req, res, next) {
    try {
        const token = getSessionToken(req);
        const session = token ? getSession(token) : null;
        if (!session) {
            clearSessionCookie(res);
            return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        }
        const account = loadAccounts().find(a => a.id === session.accountId);
        if (!account || !account.active) {
            deleteSession(token);
            clearSessionCookie(res);
            return res.status(401).json({ ok: false, error: 'Conta inativa ou removida.' });
        }
        req.account = account;
        req.sessionToken = token;
        req.session = session;
        return next();
    } catch (error) {
        return next(error);
    }
}

function requireAdminAuth(req, res, next) {
    return requireAuth(req, res, error => {
        if (error) return next(error);
        if (!req.account?.isAdmin) return res.status(403).json({ ok: false, error: 'Permissão de administrador necessária.' });
        return next();
    });
}

function requireApiKey(req, res, next) {
    try {
        const authorization = String(req.headers.authorization || '');
        const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
        const apiKey = String(req.headers['x-api-key'] || bearer || '').trim();
        if (!apiKey || !apiKey.startsWith('skynet_') || apiKey.length > 200) {
            return res.status(401).json({ ok: false, error: 'API key inválida ou ausente.' });
        }

        const hash = hashKey(apiKey);
        const keys = loadApiKeys();
        const record = keys.find(k => k.active && safeEqualHex(hash, k.keyHash));
        if (!record) return res.status(401).json({ ok: false, error: 'API key inválida ou revogada.' });

        const account = loadAccounts().find(a => a.id === record.accountId);
        if (!account || !account.active) return res.status(401).json({ ok: false, error: 'Conta inativa.' });

        record.lastUsedAt = new Date().toISOString();
        record.requestCount = Number(record.requestCount || 0) + 1;
        saveApiKeys(keys);
        req.account = account;
        req.apiKeyRecord = record;
        return next();
    } catch (error) {
        return next(error);
    }
}

function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}

function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'"
    ].join('; '));
    if (IS_PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return next();
}

function createRateLimiter({ windowMs, max, keyFn, message }) {
    const buckets = new Map();
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
    }, Math.max(windowMs, 60_000));
    cleanup.unref?.();

    return (req, res, next) => {
        const now = Date.now();
        const key = String(keyFn(req) || 'unknown');
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }
        bucket.count += 1;
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
        if (bucket.count > max) {
            res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
            return res.status(429).json({ ok: false, error: message });
        }
        return next();
    };
}

function createSession(accountId) {
    const now = Date.now();
    const sessions = loadSessions().filter(s => Number(s.expiresAt) > now);
    const token = crypto.randomBytes(48).toString('base64url');
    sessions.push({
        id: randomId(12),
        tokenHash: hashKey(token),
        accountId,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: now + SESSION_DAYS * 24 * 60 * 60 * 1000
    });
    saveSessions(sessions);
    return token;
}

function getSession(token) {
    if (!token || token.length > 256) return null;
    const now = Date.now();
    let sessions = loadSessions();
    const tokenHash = hashKey(token);
    const session = sessions.find(s => safeEqualHex(tokenHash, s.tokenHash));
    if (!session) return null;
    if (Number(session.expiresAt) <= now) {
        sessions = sessions.filter(s => s.id !== session.id);
        saveSessions(sessions);
        return null;
    }
    if (now - Number(session.lastSeenAt || 0) > 60 * 60 * 1000) {
        session.lastSeenAt = now;
        session.expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
        saveSessions(sessions);
    }
    return session;
}

function deleteSession(token) {
    if (!token) return;
    const tokenHash = hashKey(token);
    const sessions = loadSessions();
    const filtered = sessions.filter(s => !safeEqualHex(tokenHash, s.tokenHash));
    if (filtered.length !== sessions.length) saveSessions(filtered);
}

function deleteSessionsForAccount(accountId) {
    const sessions = loadSessions();
    const filtered = sessions.filter(s => s.accountId !== accountId);
    if (filtered.length !== sessions.length) saveSessions(filtered);
}

function getSessionToken(req) {
    return parseCookies(req.headers.cookie || '').skynet_session || '';
}

function setSessionCookie(res, token) {
    const maxAge = SESSION_DAYS * 24 * 60 * 60;
    const parts = [
        `skynet_session=${encodeURIComponent(token)}`,
        'Path=/',
        `Max-Age=${maxAge}`,
        'HttpOnly',
        'SameSite=Strict'
    ];
    if (IS_PRODUCTION) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
    const parts = ['skynet_session=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict'];
    if (IS_PRODUCTION) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
}

function parseCookies(header) {
    const out = {};
    for (const part of String(header).split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    }
    return out;
}

function publicAccountView(account) {
    return {
        id: account.id,
        username: account.username,
        active: Boolean(account.active),
        isAdmin: Boolean(account.isAdmin),
        createdAt: account.createdAt,
        lastLoginAt: account.lastLoginAt || null
    };
}

function publicKeyView(key) {
    return {
        id: key.id,
        name: key.name,
        preview: key.preview || 'skynet_...protegida',
        active: Boolean(key.active),
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt || null,
        requestCount: Number(key.requestCount || 0)
    };
}

function publicUploadView(record) {
    return {
        id: record.id,
        originalName: record.originalName,
        filename: record.filename,
        mime: record.mime,
        size: record.size,
        width: record.width || null,
        height: record.height || null,
        createdAt: record.createdAt,
        url: `/uploads/${encodeURIComponent(record.filename)}`
    };
}

function publicGenerationView(record) {
    return {
        id: record.id,
        title: record.title,
        source: record.source,
        createdAt: record.createdAt,
        filename: record.filename,
        url: `/generated/${encodeURIComponent(record.filename)}`
    };
}

function ensureDirectories() {
    for (const dir of [DATA_DIR, UPLOADS_DIR, GENERATED_DIR]) fs.mkdirSync(dir, { recursive: true });
}

function ensureJsonFile(file, fallback) {
    if (!fs.existsSync(file)) writeJsonAtomic(file, fallback);
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw new Error(`Falha ao ler ${path.basename(file)}: ${error.message}`);
    }
}

function writeJsonAtomic(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}

const loadAccounts = () => readJson(ACCOUNTS_FILE);
const saveAccounts = data => writeJsonAtomic(ACCOUNTS_FILE, data);
const loadApiKeys = () => readJson(KEYS_FILE);
const saveApiKeys = data => writeJsonAtomic(KEYS_FILE, data);
const loadSessions = () => readJson(SESSIONS_FILE);
const saveSessions = data => writeJsonAtomic(SESSIONS_FILE, data);
const loadUploads = () => readJson(UPLOADS_FILE);
const saveUploads = data => writeJsonAtomic(UPLOADS_FILE, data);
const loadGenerations = () => readJson(GENERATIONS_FILE);
const saveGenerations = data => writeJsonAtomic(GENERATIONS_FILE, data);

function ensureAdminAccount() {
    const accounts = loadAccounts();
    const configuredUsername = normalizeUsername(process.env.ADMIN_USERNAME || 'admin') || 'admin';
    const configuredPassword = String(process.env.ADMIN_PASSWORD || '');
    if (configuredPassword && (configuredPassword.length < 12 || configuredPassword.length > 128)) {
        throw new Error('ADMIN_PASSWORD deve ter entre 12 e 128 caracteres.');
    }

    let existingAdmin = accounts.find(a => a.isAdmin);
    if (!existingAdmin) {
        const password = configuredPassword || generateReadableSecret();
        const sameUsername = accounts.find(a => normalizeUsername(a.usernameLower || a.username) === configuredUsername);

        if (sameUsername) {
            sameUsername.usernameLower = configuredUsername;
            sameUsername.active = true;
            sameUsername.isAdmin = true;
            sameUsername.passwordHash = createSecretHash(password);
            sameUsername.lastLoginAt = sameUsername.lastLoginAt || null;
            existingAdmin = sameUsername;
            console.log(`Conta existente promovida a administrador: ${configuredUsername}`);
        } else {
            existingAdmin = {
                id: randomId(16),
                username: configuredUsername,
                usernameLower: configuredUsername,
                passwordHash: createSecretHash(password),
                active: true,
                isAdmin: true,
                createdAt: new Date().toISOString(),
                lastLoginAt: null
            };
            accounts.push(existingAdmin);
            console.log(`Administrador criado: ${configuredUsername}`);
        }

        saveAccounts(accounts);
        if (!configuredPassword) console.log(`Senha inicial do administrador: ${password}`);
        return;
    }

    if (normalizeUsername(existingAdmin.usernameLower || existingAdmin.username) === 'admin' && verifySecret('admin', existingAdmin.passwordHash)) {
        const replacement = configuredPassword || generateReadableSecret();
        existingAdmin.passwordHash = createSecretHash(replacement);
        saveAccounts(accounts);
        console.warn('A senha administrativa padrão insegura foi substituída.');
        if (!configuredPassword) console.log(`Nova senha do administrador: ${replacement}`);
    }
}

function registerFont() {
    try {
        if (fs.existsSync(FONT_PATH)) GlobalFonts.registerFromPath(FONT_PATH, 'SkyNet Sans');
    } catch (error) {
        console.warn(`Não foi possível registrar a fonte customizada: ${error.message}`);
    }
}

function hashKey(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createSecretHash(password) {
    const salt = crypto.randomBytes(32);
    const key = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
    return JSON.stringify({ salt: salt.toString('hex'), key: key.toString('hex') });
}

function verifySecret(password, stored) {
    try {
        const parsed = JSON.parse(stored);
        const salt = Buffer.from(parsed.salt, 'hex');
        const expected = Buffer.from(parsed.key, 'hex');
        const actual = crypto.scryptSync(String(password), salt, expected.length, { N: 16384, r: 8, p: 1 });
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
        return false;
    }
}

function safeEqualHex(a, b) {
    try {
        const left = Buffer.from(String(a), 'hex');
        const right = Buffer.from(String(b), 'hex');
        return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
    } catch {
        return false;
    }
}

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function safeOriginalName(value) {
    return path.basename(String(value || 'imagem')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) || 'imagem';
}

function cleanText(value, maxLength) {
    return String(value || '').replace(/\r/g, '').slice(0, maxLength);
}

function safeHexColor(value, fallback) {
    const raw = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

function toInt(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    const safe = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, safe));
}

function randomId(bytes = 16) {
    return crypto.randomBytes(bytes).toString('hex');
}

function generateReadableSecret() {
    return crypto.randomBytes(24).toString('base64url');
}

function clientError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function removeFileIfExists(file) {
    try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function extractLocalUploadFilename(value) {
    try {
        if (value.startsWith('/uploads/')) return path.basename(decodeURIComponent(value.slice('/uploads/'.length)));
        if (/^https?:\/\//i.test(value)) {
            const parsed = new URL(value);
            if (parsed.pathname.startsWith('/uploads/')) return path.basename(decodeURIComponent(parsed.pathname.slice('/uploads/'.length)));
        }
    } catch {}
    return null;
}

function safeLookup(hostname, options, callback) {
    const opts = typeof options === 'object' ? options : {};
    dns.lookup(hostname, { ...opts, all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(error);
        const list = Array.isArray(addresses) ? addresses : [addresses];
        const allowed = list.filter(item => item?.address && !isPrivateIp(item.address));
        if (!allowed.length) return callback(new Error('Destino de rede não permitido'));
        const selected = allowed[0];
        return callback(null, selected.address, selected.family);
    });
}

async function assertPublicHostname(hostname) {
    if (!hostname) throw clientError('Hostname inválido.');
    const stripped = hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(stripped)) {
        if (isPrivateIp(stripped)) throw clientError('Endereços de rede interna não são permitidos.');
        return;
    }
    const addresses = await dns.promises.lookup(stripped, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) {
        throw clientError('O endereço informado aponta para uma rede não permitida.');
    }
}

function isPrivateIp(address) {
    const value = String(address || '').toLowerCase();
    if (!value) return true;
    if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
    if (net.isIPv6(value)) {
        return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
    }
    if (!net.isIPv4(value)) return true;
    const octets = value.split('.').map(Number);
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return false;
}
