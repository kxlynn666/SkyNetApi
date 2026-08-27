const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');
const { CATALOG, getWalletView, getPrivateStoreView } = require('./profile-economy');

const STORE_FILE = path.join(C.DATA_DIR, 'profile-name-decorations.json');

const NAME_CATALOG = Object.freeze([
    nameItem('name-neon-line', 'Neon Line', 520, 'uncommon', ['#22d3ee', '#60a5fa'], 'holo', true),
    nameItem('name-sunset', 'Sunset Ink', 720, 'rare', ['#fb923c', '#f43f5e'], 'editorial', false),
    nameItem('name-mint-glow', 'Mint Glow', 850, 'rare', ['#34d399', '#a7f3d0'], 'nature', true),
    nameItem('name-holographic', 'Holographic', 1250, 'epic', ['#22d3ee', '#f472b6'], 'holo', true),
    nameItem('name-royal-gold', 'Royal Gold', 1450, 'epic', ['#f59e0b', '#fef08a'], 'material', true),
    nameItem('name-frost', 'Frost Glass', 1700, 'epic', ['#bae6fd', '#f8fafc'], 'winter', true),
    nameItem('name-sakura', 'Sakura Type', 2100, 'legendary', ['#ec4899', '#fce7f3'], 'sakura', true),
    nameItem('name-glitch', 'Signal Glitch', 2350, 'legendary', ['#22d3ee', '#fb7185'], 'studio', true),
    nameItem('name-cosmic', 'Cosmic Chrome', 2700, 'legendary', ['#818cf8', '#f0abfc'], 'cosmic', true),
    nameItem('name-ink', 'Editorial Ink', 2900, 'legendary', ['#f4f4f5', '#71717a'], 'editorial', false)
]);

function nameItem(id, name, price, rarity, colors, collection, animated) {
    return Object.freeze({
        id,
        type: 'name-decoration',
        name,
        price: Math.max(0, Number(price) || 0),
        rarity,
        colors,
        collection,
        grantOnly: false,
        animated: animated === true,
        overlay: false
    });
}

function registerProfileNameDecorations(app) {
    ensureStorage();
    const json = express.json({ limit: '48kb' });
    app.use('/api/profile-store', json);
    app.use('/api/admin/profile-store', json);

    app.use((req, res, next) => {
        if (!shouldAugment(req)) return next();
        const originalJson = res.json.bind(res);
        res.json = payload => {
            try {
                if (res.statusCode < 400 && req.__pendingNameDecoration) {
                    const pending = req.__pendingNameDecoration;
                    const state = getState(pending.accountId);
                    state.equippedNameDecorationId = pending.itemId || '';
                    state.updatedAt = new Date().toISOString();
                    saveState(state);
                    req.__pendingNameDecoration = null;
                }
                payload = augmentPayload(req, payload);
            } catch (error) {
                console.error('Falha ao complementar decoracao de nome:', error);
            }
            return originalJson(payload);
        };
        return next();
    });

    app.post('/api/profile-store/buy/:itemId', requireTrustedOrigin, requireSession, (req, res, next) => {
        const nameProduct = nameCatalogItem(req.params.itemId);
        if (!nameProduct) {
            const regular = regularCatalogItem(req.params.itemId);
            if (!regular) return next();
            const state = getState(req.account.id);
            const available = effectiveBalance(req.account.id, state);
            if (available < Number(regular.price || 0)) {
                return res.status(409).json({ ok: false, error: `Saldo insuficiente. Faltam ${Number(regular.price || 0) - available} moedas.` });
            }
            return next();
        }

        const state = getState(req.account.id);
        if (state.ownedItems.some(entry => entry.itemId === nameProduct.id)) {
            return res.status(409).json({ ok: false, error: 'Este item já pertence à sua conta.' });
        }
        const available = effectiveBalance(req.account.id, state);
        if (available < nameProduct.price) {
            return res.status(409).json({ ok: false, error: `Saldo insuficiente. Faltam ${nameProduct.price - available} moedas.` });
        }
        state.ownedItems.push({ itemId: nameProduct.id, price: nameProduct.price, purchasedAt: new Date().toISOString(), source: 'store' });
        state.nameSpentCoins = Math.max(0, Number(state.nameSpentCoins || 0)) + nameProduct.price;
        state.updatedAt = new Date().toISOString();
        saveState(state);
        return res.status(201).json({ ok: true, purchased: nameProduct, ...getPrivateStoreView(req.account.id) });
    });

    app.patch('/api/profile-store/equipped', requireTrustedOrigin, requireSession, (req, res, next) => {
        if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'nameDecorationId')) return next();
        const itemId = cleanId(req.body.nameDecorationId);
        const state = getState(req.account.id);
        if (itemId) {
            const product = nameCatalogItem(itemId);
            const owned = state.ownedItems.some(entry => entry.itemId === itemId);
            if (!product || !owned) return res.status(400).json({ ok: false, error: 'A decoração de nome selecionada não pertence à sua conta.' });
        }
        req.__pendingNameDecoration = { accountId: req.account.id, itemId };
        return next();
    });

    app.post('/api/admin/profile-store/:accountId/grant/:itemId', requireTrustedOrigin, requireAdmin, (req, res, next) => {
        const product = nameCatalogItem(req.params.itemId);
        if (!product) return next();
        const account = S.loadAccounts().find(entry => entry.id === req.params.accountId);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        const state = getState(account.id);
        if (!state.ownedItems.some(entry => entry.itemId === product.id)) {
            state.ownedItems.push({ itemId: product.id, price: 0, purchasedAt: new Date().toISOString(), source: 'admin', granted: true, grantedBy: req.account.id });
            state.updatedAt = new Date().toISOString();
            saveState(state);
        }
        return res.json({ ok: true, ...getPrivateStoreView(account.id) });
    });

    app.delete('/api/admin/profile-store/:accountId/revoke/:itemId', requireTrustedOrigin, requireAdmin, (req, res, next) => {
        const product = nameCatalogItem(req.params.itemId);
        if (!product) return next();
        const account = S.loadAccounts().find(entry => entry.id === req.params.accountId);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        const state = getState(account.id);
        const before = state.ownedItems.length;
        state.ownedItems = state.ownedItems.filter(entry => entry.itemId !== product.id);
        if (state.ownedItems.length === before) return res.status(404).json({ ok: false, error: 'A conta não possui este item.' });
        if (state.equippedNameDecorationId === product.id) state.equippedNameDecorationId = '';
        state.updatedAt = new Date().toISOString();
        saveState(state);
        return res.json({ ok: true, ...getPrivateStoreView(account.id) });
    });
}

function shouldAugment(req) {
    const method = String(req.method || '').toUpperCase();
    const p = req.path || '';
    if (p === '/api/profile-store/catalog' && method === 'GET') return true;
    if (p === '/api/profile-store/me' && method === 'GET') return true;
    if (p === '/api/profile-store/equipped' && method === 'PATCH') return true;
    if (p.startsWith('/api/profile-store/buy/') && method === 'POST') return true;
    if (p === '/api/profile-v3/leaderboard' && method === 'GET') return true;
    if (p.startsWith('/api/profile-v3/profile/') && method === 'GET') return true;
    if (p === '/api/social/podium' && method === 'GET') return true;
    if (p.startsWith('/api/social/profile/') && method === 'GET') return true;
    if (p.startsWith('/api/admin/profile-store/')) return true;
    return false;
}

function augmentPayload(req, payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const p = req.path || '';

    if (p === '/api/profile-store/catalog') {
        return { ...payload, catalog: mergeCatalog(payload.catalog) };
    }

    if (p === '/api/profile-v3/leaderboard' && Array.isArray(payload.leaderboard)) {
        return { ...payload, leaderboard: payload.leaderboard.map(entry => augmentPublicEntry(entry)) };
    }

    if (p.startsWith('/api/profile-v3/profile/') && payload.profile) {
        return { ...payload, profile: augmentPublicEntry(payload.profile) };
    }

    if (p === '/api/social/podium' && Array.isArray(payload.podium)) {
        return { ...payload, podium: payload.podium.map(entry => augmentPublicEntry(entry)) };
    }

    if (p.startsWith('/api/social/profile/') && payload.profile) {
        return { ...payload, profile: augmentPublicEntry(payload.profile) };
    }

    let accountId = null;
    if (p.startsWith('/api/admin/profile-store/')) accountId = cleanId(p.split('/')[4]);
    else accountId = accountFromRequest(req)?.id || null;
    return accountId ? augmentPrivateView(payload, accountId) : { ...payload, catalog: mergeCatalog(payload.catalog) };
}

function augmentPrivateView(payload, accountId) {
    const state = getState(accountId);
    const inventory = Array.isArray(payload.inventory) ? payload.inventory.slice() : [];
    for (const owned of state.ownedItems) {
        const product = nameCatalogItem(owned.itemId);
        if (!product || inventory.some(entry => entry?.itemId === product.id || entry?.item?.id === product.id)) continue;
        inventory.push({ ...owned, item: product });
    }
    const wallet = payload.wallet ? augmentWallet(payload.wallet, state) : payload.wallet;
    return {
        ...payload,
        wallet,
        inventory,
        equipped: payload.equipped ? { ...payload.equipped, nameDecorationId: state.equippedNameDecorationId || '' } : payload.equipped,
        cosmetics: payload.cosmetics ? { ...payload.cosmetics, nameDecoration: equippedProduct(state) } : payload.cosmetics,
        catalog: mergeCatalog(payload.catalog),
        rules: payload.rules ? { ...payload.rules, maxEquippedNameDecorations: 1 } : payload.rules
    };
}

function augmentPublicEntry(entry) {
    if (!entry || typeof entry !== 'object' || !entry.id) return entry;
    const state = getState(entry.id);
    return { ...entry, cosmetics: { ...(entry.cosmetics || {}), nameDecoration: equippedProduct(state) } };
}

function mergeCatalog(catalog) {
    const list = Array.isArray(catalog) ? catalog.slice() : [];
    for (const item of NAME_CATALOG) if (!list.some(entry => entry?.id === item.id)) list.push(item);
    return list;
}

function augmentWallet(wallet, state) {
    const extra = Math.max(0, Number(state.nameSpentCoins || 0));
    return {
        ...wallet,
        balance: Math.max(0, Number(wallet.balance || 0) - extra),
        spentCoins: Math.max(0, Number(wallet.spentCoins || 0)) + extra,
        nameDecorationSpentCoins: extra
    };
}

function effectiveBalance(accountId, state = null) {
    const wallet = getWalletView(accountId);
    return Math.max(0, Number(wallet.balance || 0) - Math.max(0, Number((state || getState(accountId)).nameSpentCoins || 0)));
}

function equippedProduct(state) {
    return state.equippedNameDecorationId ? nameCatalogItem(state.equippedNameDecorationId) : null;
}

function nameCatalogItem(id) {
    const normalized = cleanId(id);
    return NAME_CATALOG.find(entry => entry.id === normalized) || null;
}

function regularCatalogItem(id) {
    const normalized = cleanId(id);
    return CATALOG.find(entry => entry.id === normalized) || null;
}

function getState(accountId) {
    const found = loadStates().find(entry => entry.accountId === accountId) || {};
    const ownedItems = Array.isArray(found.ownedItems)
        ? found.ownedItems.filter(entry => entry && nameCatalogItem(entry.itemId))
        : [];
    const owned = new Set(ownedItems.map(entry => entry.itemId));
    const equippedNameDecorationId = owned.has(cleanId(found.equippedNameDecorationId)) ? cleanId(found.equippedNameDecorationId) : '';
    return {
        accountId,
        ownedItems,
        nameSpentCoins: Math.max(0, Number(found.nameSpentCoins || 0)),
        equippedNameDecorationId,
        updatedAt: found.updatedAt || null
    };
}

function saveState(state) {
    const states = loadStates();
    const index = states.findIndex(entry => entry.accountId === state.accountId);
    if (index < 0) states.push(state); else states[index] = state;
    writeJsonAtomic(STORE_FILE, states);
}

function cleanupProfileNameDecorationsAccount(accountId) {
    if (!accountId) return;
    writeJsonAtomic(STORE_FILE, loadStates().filter(entry => entry.accountId !== accountId));
}

function ensureStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_FILE)) writeJsonAtomic(STORE_FILE, []);
}

function loadStates() {
    ensureStorage();
    try {
        const value = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
        return Array.isArray(value) ? value : [];
    } catch { return []; }
}

function writeJsonAtomic(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}

function accountFromRequest(req) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        return session ? S.loadAccounts().find(entry => entry.id === session.accountId && entry.active) || null : null;
    } catch { return null; }
}

function requireSession(req, res, next) {
    const account = accountFromRequest(req);
    if (!account) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    req.account = account;
    return next();
}

function requireAdmin(req, res, next) {
    return requireSession(req, res, error => {
        if (error) return next(error);
        if (!req.account?.isAdmin) return res.status(403).json({ ok: false, error: 'Acesso administrativo necessário.' });
        return next();
    });
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
        try { out[key] = decodeURIComponent(value); }
        catch { out[key] = value; }
    }
    return out;
}

function cleanId(value) {
    return String(value || '').trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 80);
}

module.exports = {
    registerProfileNameDecorations,
    cleanupProfileNameDecorationsAccount,
    NAME_CATALOG
};
