const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');

const DESIGN_FILE = path.join(C.DATA_DIR, 'profile-design.json');

const DEFAULTS = Object.freeze({
    fontFamily: 'system',
    avatarShape: 'squircle',
    bannerFocus: 'center',
    profileLayout: 'balanced',
    tagStyle: 'pill',
    nameEffect: 'none',
    motionLevel: 'full',
    cornerStyle: 'soft'
});

const ALLOWED = Object.freeze({
    fontFamily: new Set(['system', 'mono', 'serif', 'rounded', 'display']),
    avatarShape: new Set(['squircle', 'circle', 'rounded', 'square']),
    bannerFocus: new Set(['center', 'top', 'bottom', 'left', 'right']),
    profileLayout: new Set(['balanced', 'compact', 'showcase']),
    tagStyle: new Set(['pill', 'badge', 'minimal', 'outline']),
    nameEffect: new Set(['none', 'gradient', 'glow', 'outline']),
    motionLevel: new Set(['full', 'subtle', 'still']),
    cornerStyle: new Set(['soft', 'medium', 'sharp'])
});

function registerProfileDesignRoutes(app) {
    ensureStorage();
    const json = express.json({ limit: '32kb' });
    app.use('/api/profile-design', json);

    app.get('/api/profile-design/me', requireSession, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, design: getProfileDesign(req.account.id) });
    });

    app.patch('/api/profile-design/me', requireTrustedOrigin, requireSession, (req, res) => {
        const current = getProfileDesign(req.account.id);
        const next = sanitizeDesign(req.account.id, req.body || {}, current);
        saveDesign(next);
        return res.json({ ok: true, design: next });
    });

    app.get('/api/profile-design/:username', (req, res) => {
        const username = S.normalizeUsername(req.params.username);
        const account = S.loadAccounts().find(item => item.active && S.normalizeUsername(item.usernameLower || item.username) === username);
        if (!account) return res.status(404).json({ ok: false, error: 'Perfil não encontrado.' });
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.json({ ok: true, design: getProfileDesign(account.id) });
    });
}

function sanitizeDesign(accountId, input, current) {
    const next = { accountId };
    for (const key of Object.keys(DEFAULTS)) {
        const value = String(input[key] ?? current[key] ?? DEFAULTS[key]).trim().toLowerCase();
        next[key] = ALLOWED[key].has(value) ? value : (current[key] || DEFAULTS[key]);
    }
    next.updatedAt = new Date().toISOString();
    return next;
}

function getProfileDesign(accountId) {
    const found = loadDesigns().find(item => item.accountId === accountId) || {};
    const out = { accountId };
    for (const key of Object.keys(DEFAULTS)) {
        out[key] = ALLOWED[key].has(found[key]) ? found[key] : DEFAULTS[key];
    }
    out.updatedAt = found.updatedAt || null;
    return out;
}

function saveDesign(design) {
    const all = loadDesigns();
    const index = all.findIndex(item => item.accountId === design.accountId);
    if (index === -1) all.push(design); else all[index] = design;
    writeJsonAtomic(DESIGN_FILE, all);
}

function cleanupProfileDesignAccount(accountId) {
    if (!accountId) return;
    writeJsonAtomic(DESIGN_FILE, loadDesigns().filter(item => item.accountId !== accountId));
}

function ensureStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    if (!fs.existsSync(DESIGN_FILE)) writeJsonAtomic(DESIGN_FILE, []);
}

function loadDesigns() {
    ensureStorage();
    try {
        const value = JSON.parse(fs.readFileSync(DESIGN_FILE, 'utf8'));
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeJsonAtomic(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}

function requireSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        const account = session ? S.loadAccounts().find(item => item.id === session.accountId && item.active) : null;
        if (!account) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        req.account = account;
        return next();
    } catch (error) { return next(error); }
}

function requireTrustedOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok: false, error: 'Origem não permitida.' });
}

function parseCookies(header) {
    const out = {};
    for (const part of String(header || '').split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    }
    return out;
}

module.exports = { registerProfileDesignRoutes, getProfileDesign, cleanupProfileDesignAccount, DEFAULTS };