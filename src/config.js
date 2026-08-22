const fs = require('fs');
const path = require('path');

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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        if (process.env[key] === undefined) process.env[key] = value;
    }
}

const ROOT = path.join(__dirname, '..');
loadLocalEnv(path.join(ROOT, '.env'));

function toInt(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    const safe = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, safe));
}

const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const GENERATED_DIR = path.join(PUBLIC_DIR, 'generated');
const BUNDLED_FONT_PATH = path.join(ROOT, 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans-Bold.ttf');

module.exports = {
    ROOT,
    PUBLIC_DIR,
    DATA_DIR,
    UPLOADS_DIR,
    GENERATED_DIR,
    ACCOUNTS_FILE: path.join(DATA_DIR, 'accounts.json'),
    KEYS_FILE: path.join(DATA_DIR, 'apikeys.json'),
    SESSIONS_FILE: path.join(DATA_DIR, 'sessions.json'),
    UPLOADS_FILE: path.join(DATA_DIR, 'uploads.json'),
    GENERATIONS_FILE: path.join(DATA_DIR, 'generations.json'),
    FONT_PATH: process.env.FONT_PATH || BUNDLED_FONT_PATH,
    PORT: toInt(process.env.PORT, 3000, 1, 65535),
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    TRUST_PROXY: ['1', 'true', 'yes'].includes(String(process.env.TRUST_PROXY || '').toLowerCase()),
    SESSION_DAYS: toInt(process.env.SESSION_DAYS, 7, 1, 30),
    AUTO_ACTIVATE_ACCOUNTS: String(process.env.AUTO_ACTIVATE_ACCOUNTS || 'false').toLowerCase() === 'true',
    MAX_KEYS_PER_ACCOUNT: toInt(process.env.MAX_KEYS_PER_ACCOUNT, 10, 1, 50),
    MAX_UPLOAD_MB: toInt(process.env.MAX_UPLOAD_MB, 15, 1, 25),
    MAX_UPLOADS_PER_ACCOUNT: toInt(process.env.MAX_UPLOADS_PER_ACCOUNT, 100, 1, 1000),
    MAX_GENERATIONS_PER_ACCOUNT: toInt(process.env.MAX_GENERATIONS_PER_ACCOUNT, 200, 10, 2000),
    MAX_REMOTE_IMAGE_MB: toInt(process.env.MAX_REMOTE_IMAGE_MB, 15, 1, 25),
    CARD_RATE_LIMIT_PER_MINUTE: toInt(process.env.CARD_RATE_LIMIT_PER_MINUTE, 30, 1, 300),
    ADMIN_USERNAME: String(process.env.ADMIN_USERNAME || 'admin'),
    ADMIN_PASSWORD: String(process.env.ADMIN_PASSWORD || ''),
    CORS_ORIGINS: new Set(String(process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean)),
    CARD_SIZE: 1080,
    NEON_COLORS: ['#ff1744', '#00a8ff', '#39ff14', '#a855f7'],
    toInt
};
