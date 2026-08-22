const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./config');

const KEY_VAULT_FILE = path.join(C.DATA_DIR, '.key-vault-secret');

function initStorage() {
    for (const dir of [C.DATA_DIR, C.UPLOADS_DIR, C.GENERATED_DIR]) fs.mkdirSync(dir, { recursive: true });
    ensureKeyVaultSecret();
    ensureJsonFile(C.ACCOUNTS_FILE, []);
    ensureJsonFile(C.KEYS_FILE, []);
    ensureJsonFile(C.SESSIONS_FILE, []);
    ensureJsonFile(C.UPLOADS_FILE, []);
    ensureJsonFile(C.GENERATIONS_FILE, []);
    ensureAdminAccount();
}

function ensureJsonFile(file, fallback) {
    if (!fs.existsSync(file)) writeJsonAtomic(file, fallback);
}
function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) {
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

const loadAccounts = () => readJson(C.ACCOUNTS_FILE);
const saveAccounts = data => writeJsonAtomic(C.ACCOUNTS_FILE, data);
const loadApiKeys = () => readJson(C.KEYS_FILE);
const saveApiKeys = data => writeJsonAtomic(C.KEYS_FILE, data);
const loadSessions = () => readJson(C.SESSIONS_FILE);
const saveSessions = data => writeJsonAtomic(C.SESSIONS_FILE, data);
const loadUploads = () => readJson(C.UPLOADS_FILE);
const saveUploads = data => writeJsonAtomic(C.UPLOADS_FILE, data);
const loadGenerations = () => readJson(C.GENERATIONS_FILE);
const saveGenerations = data => writeJsonAtomic(C.GENERATIONS_FILE, data);

function randomId(bytes = 16) { return crypto.randomBytes(bytes).toString('hex'); }
function hashKey(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
function generateReadableSecret() { return crypto.randomBytes(24).toString('base64url'); }
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
    } catch { return false; }
}
function safeEqualHex(a, b) {
    try {
        const left = Buffer.from(String(a), 'hex');
        const right = Buffer.from(String(b), 'hex');
        return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
    } catch { return false; }
}

function ensureKeyVaultSecret() {
    if (fs.existsSync(KEY_VAULT_FILE)) return;
    fs.mkdirSync(path.dirname(KEY_VAULT_FILE), { recursive: true });
    try {
        fs.writeFileSync(KEY_VAULT_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}
function getKeyVaultKey() {
    ensureKeyVaultSecret();
    const hex = fs.readFileSync(KEY_VAULT_FILE, 'utf8').trim();
    if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Segredo local de API keys inválido.');
    return Buffer.from(hex, 'hex');
}
function encryptApiKey(apiKey) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKeyVaultKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(apiKey), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64url')}`;
}
function decryptApiKey(payload) {
    try {
        const [version, ivHex, tagHex, data] = String(payload || '').split(':');
        if (version !== 'v1' || !ivHex || !tagHex || !data) return null;
        const decipher = crypto.createDecipheriv('aes-256-gcm', getKeyVaultKey(), Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
    } catch { return null; }
}

function ensureAdminAccount() {
    const accounts = loadAccounts();
    const username = normalizeUsername(C.ADMIN_USERNAME) || 'admin';
    const password = C.ADMIN_PASSWORD;
    if (password && (password.length < 12 || password.length > 128)) throw new Error('ADMIN_PASSWORD deve ter entre 12 e 128 caracteres.');
    let admin = accounts.find(a => a.isAdmin);
    if (!admin) {
        const initialPassword = password || generateReadableSecret();
        admin = accounts.find(a => normalizeUsername(a.usernameLower || a.username) === username);
        if (admin) {
            admin.active = true;
            admin.isAdmin = true;
            admin.usernameLower = username;
            admin.passwordHash = createSecretHash(initialPassword);
        } else {
            admin = { id: randomId(), username, usernameLower: username, passwordHash: createSecretHash(initialPassword), active: true, isAdmin: true, createdAt: new Date().toISOString(), lastLoginAt: null };
            accounts.push(admin);
        }
        saveAccounts(accounts);
        console.log(`Administrador criado: ${username}`);
        if (!password) console.log(`Senha inicial do administrador: ${initialPassword}`);
    }
}

function createSession(accountId) {
    const now = Date.now();
    const sessions = loadSessions().filter(s => Number(s.expiresAt) > now);
    const token = crypto.randomBytes(48).toString('base64url');
    sessions.push({ id: randomId(12), tokenHash: hashKey(token), accountId, createdAt: now, lastSeenAt: now, expiresAt: now + C.SESSION_DAYS * 86400000 });
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
        saveSessions(sessions.filter(s => s.id !== session.id));
        return null;
    }
    if (now - Number(session.lastSeenAt || 0) > 3600000) {
        session.lastSeenAt = now;
        session.expiresAt = now + C.SESSION_DAYS * 86400000;
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

function authenticateApiKey(apiKey) {
    const value = String(apiKey || '').trim();
    if (!value || !value.startsWith('skynet_') || value.length > 200) return null;
    const keys = loadApiKeys();
    const hash = hashKey(value);
    const record = keys.find(k => k.active && safeEqualHex(hash, k.keyHash));
    if (!record) return null;
    const account = loadAccounts().find(a => a.id === record.accountId && a.active);
    if (!account) return null;
    record.lastUsedAt = new Date().toISOString();
    record.requestCount = Number(record.requestCount || 0) + 1;
    saveApiKeys(keys);
    return { account, record };
}

function publicAccountView(account) {
    return { id: account.id, username: account.username, active: Boolean(account.active), isAdmin: Boolean(account.isAdmin), createdAt: account.createdAt, lastLoginAt: account.lastLoginAt || null };
}
function publicKeyView(key) {
    return { id: key.id, name: key.name, preview: key.preview || 'skynet_...protegida', active: Boolean(key.active), createdAt: key.createdAt, lastUsedAt: key.lastUsedAt || null, requestCount: Number(key.requestCount || 0), canReveal: Boolean(key.keyCipher) };
}
function publicUploadView(record) {
    return { id: record.id, originalName: record.originalName, filename: record.filename, mime: record.mime, size: record.size, width: record.width || null, height: record.height || null, createdAt: record.createdAt, url: `/uploads/${encodeURIComponent(record.filename)}` };
}
function publicGenerationView(record) {
    return { id: record.id, title: record.title, source: record.source, createdAt: record.createdAt, filename: record.filename, url: `/generated/${encodeURIComponent(record.filename)}`, neon: record.neon || null };
}
function removeFileIfExists(file) {
    try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

module.exports = {
    initStorage, loadAccounts, saveAccounts, loadApiKeys, saveApiKeys, loadSessions, saveSessions,
    loadUploads, saveUploads, loadGenerations, saveGenerations, randomId, hashKey, normalizeUsername,
    createSecretHash, verifySecret, safeEqualHex, createSession, getSession, deleteSession, deleteSessionsForAccount,
    authenticateApiKey, encryptApiKey, decryptApiKey, publicAccountView, publicKeyView, publicUploadView,
    publicGenerationView, removeFileIfExists
};
