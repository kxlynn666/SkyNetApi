const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');
const { getXpView } = require('./xp-admin');

const STORE_FILE = path.join(C.DATA_DIR, 'profile-store.json');
const PROFILE_FILE = path.join(C.DATA_DIR, 'profile-custom.json');
const FRIENDS_FILE = path.join(C.DATA_DIR, 'social-friends.json');
const STARTER_COINS = 120;
const XP_PER_COIN = 10;
const MAX_EQUIPPED_TAGS = 3;

const CATALOG = Object.freeze([
    item('tag-dev', 'tag', 'DEV', 40, 'common', ['#7c3aed', '#a78bfa']),
    item('tag-creator', 'tag', 'CREATOR', 55, 'uncommon', ['#db2777', '#fb7185']),
    item('tag-linux', 'tag', 'LINUX', 60, 'uncommon', ['#0284c7', '#38bdf8']),
    item('tag-api', 'tag', 'API', 70, 'rare', ['#0891b2', '#22d3ee']),
    item('tag-beta', 'tag', 'BETA', 90, 'rare', ['#059669', '#34d399']),
    item('tag-social', 'tag', 'SOCIAL', 45, 'common', ['#7c3aed', '#c084fc']),
    item('tag-og', 'tag', 'OG', 180, 'epic', ['#d97706', '#fbbf24']),
    item('tag-elite', 'tag', 'ELITE', 260, 'legendary', ['#ca8a04', '#fde047']),

    item('frame-violet', 'frame', 'Violet Pulse', 80, 'common', ['#8b5cf6', '#c084fc']),
    item('frame-cyan', 'frame', 'Cyber Cyan', 100, 'uncommon', ['#06b6d4', '#67e8f9']),
    item('frame-rose', 'frame', 'Rose Neon', 120, 'rare', ['#e11d48', '#fb7185']),
    item('frame-gold', 'frame', 'Royal Gold', 220, 'epic', ['#d97706', '#fde047']),
    item('frame-plasma', 'frame', 'Plasma', 320, 'legendary', ['#7c3aed', '#22d3ee', '#ec4899']),
    item('frame-spectrum', 'frame', 'Spectrum', 450, 'legendary', ['#22d3ee', '#8b5cf6', '#ec4899', '#f59e0b']),

    item('deco-grid', 'decoration', 'Digital Grid', 90, 'common', ['#8b5cf6', '#312e81']),
    item('deco-glow', 'decoration', 'Soft Aura', 120, 'uncommon', ['#a855f7', '#06b6d4']),
    item('deco-orbit', 'decoration', 'Orbit Lines', 160, 'rare', ['#22d3ee', '#8b5cf6']),
    item('deco-aurora', 'decoration', 'Aurora', 260, 'epic', ['#06b6d4', '#8b5cf6', '#ec4899']),
    item('deco-prism', 'decoration', 'Prism', 360, 'legendary', ['#22d3ee', '#a855f7', '#f43f5e'])
]);

function item(id, type, name, price, rarity, colors) {
    return Object.freeze({ id, type, name, price, rarity, colors });
}

function registerProfileEconomyRoutes(app) {
    ensureStorage();
    const json = express.json({ limit: '96kb' });
    app.use('/api/profile-store', json);
    app.use('/api/profile-v3', json);
    app.use('/api/admin/profile-store', json);

    app.get('/api/profile-store/catalog', (req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.json({ ok: true, catalog: CATALOG, rules: { starterCoins: STARTER_COINS, xpPerCoin: XP_PER_COIN, maxEquippedTags: MAX_EQUIPPED_TAGS } });
    });

    app.get('/api/profile-store/me', requireSession, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, ...getPrivateStoreView(req.account.id) });
    });

    app.post('/api/profile-store/buy/:itemId', requireTrustedOrigin, requireSession, (req, res) => {
        const product = catalogItem(req.params.itemId);
        if (!product) return res.status(404).json({ ok: false, error: 'Item não encontrado.' });
        const state = getState(req.account.id);
        if (state.ownedItems.some(entry => entry.itemId === product.id)) {
            return res.status(409).json({ ok: false, error: 'Este item já pertence à sua conta.' });
        }
        const wallet = getWalletView(req.account.id, state);
        if (wallet.balance < product.price) {
            return res.status(409).json({ ok: false, error: `Saldo insuficiente. Faltam ${product.price - wallet.balance} moedas.` });
        }
        state.ownedItems.push({ itemId: product.id, price: product.price, purchasedAt: new Date().toISOString() });
        state.spentCoins = Number(state.spentCoins || 0) + product.price;
        state.updatedAt = new Date().toISOString();
        saveState(state);
        return res.status(201).json({ ok: true, purchased: product, ...getPrivateStoreView(req.account.id) });
    });

    app.patch('/api/profile-store/equipped', requireTrustedOrigin, requireSession, (req, res) => {
        const state = getState(req.account.id);
        const owned = new Set(state.ownedItems.map(entry => entry.itemId));
        const nextTags = Array.isArray(req.body?.tagIds)
            ? [...new Set(req.body.tagIds.map(value => cleanId(value)).filter(Boolean))].slice(0, MAX_EQUIPPED_TAGS)
            : state.equipped.tagIds;
        const nextFrame = Object.prototype.hasOwnProperty.call(req.body || {}, 'frameId') ? cleanId(req.body.frameId) : state.equipped.frameId;
        const nextDecoration = Object.prototype.hasOwnProperty.call(req.body || {}, 'decorationId') ? cleanId(req.body.decorationId) : state.equipped.decorationId;

        for (const id of nextTags) {
            const product = catalogItem(id);
            if (!product || product.type !== 'tag' || !owned.has(id)) return res.status(400).json({ ok: false, error: 'Uma das tags selecionadas não pertence à sua conta.' });
        }
        if (nextFrame) {
            const product = catalogItem(nextFrame);
            if (!product || product.type !== 'frame' || !owned.has(nextFrame)) return res.status(400).json({ ok: false, error: 'A moldura selecionada não pertence à sua conta.' });
        }
        if (nextDecoration) {
            const product = catalogItem(nextDecoration);
            if (!product || product.type !== 'decoration' || !owned.has(nextDecoration)) return res.status(400).json({ ok: false, error: 'A decoração selecionada não pertence à sua conta.' });
        }

        state.equipped = { tagIds: nextTags, frameId: nextFrame || '', decorationId: nextDecoration || '' };
        state.updatedAt = new Date().toISOString();
        saveState(state);
        return res.json({ ok: true, ...getPrivateStoreView(req.account.id) });
    });

    app.get('/api/profile-v3/leaderboard', (req, res) => {
        const limit = clampInt(req.query?.limit, 3, 50, 20);
        const friends = readArray(FRIENDS_FILE);
        const accounts = S.loadAccounts().filter(account => account.active && baseProfile(account).privacy.showOnPodium);
        const leaderboard = accounts.map(account => {
            const xp = getXpView(account.id);
            const profile = baseProfile(account);
            const custom = getCustomProfile(account.id);
            const cosmetics = getPublicCosmetics(account.id);
            const friendCount = friends.filter(entry => entry.status === 'accepted' && (entry.senderId === account.id || entry.receiverId === account.id)).length;
            return {
                id: account.id,
                username: account.username,
                displayName: profile.displayName,
                avatarUrl: avatarUrl(account),
                bannerUrl: custom.bannerUploadId ? `/community-banner/${encodeURIComponent(account.id)}` : null,
                accent: custom.accent,
                headline: custom.headline,
                style: custom.style,
                cosmetics,
                xp: xp.totalXp,
                level: xp.level,
                requests: Number(xp.breakdown?.apiRequests || 0),
                friendCount,
                coins: getWalletView(account.id).balance
            };
        }).sort((a, b) => b.xp - a.xp || b.level - a.level || a.username.localeCompare(b.username))
            .slice(0, limit)
            .map((entry, index) => ({ ...entry, place: index + 1 }));
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, scoring: 'Ranking por XP total', leaderboard });
    });

    app.get('/api/profile-v3/profile/:username', (req, res) => {
        const username = S.normalizeUsername(req.params.username);
        const account = S.loadAccounts().find(entry => entry.active && S.normalizeUsername(entry.usernameLower || entry.username) === username);
        if (!account) return res.status(404).json({ ok: false, error: 'Perfil não encontrado.' });
        const xp = getXpView(account.id);
        const profile = baseProfile(account);
        const custom = getCustomProfile(account.id);
        const friends = readArray(FRIENDS_FILE);
        const friendCount = friends.filter(entry => entry.status === 'accepted' && (entry.senderId === account.id || entry.receiverId === account.id)).length;
        return res.json({
            ok: true,
            profile: {
                id: account.id,
                username: account.username,
                displayName: profile.displayName,
                bio: profile.bio,
                status: profile.status,
                avatarUrl: avatarUrl(account),
                bannerUrl: custom.bannerUploadId ? `/community-banner/${encodeURIComponent(account.id)}` : null,
                accent: custom.accent,
                headline: custom.headline,
                style: custom.style,
                cosmetics: getPublicCosmetics(account.id),
                createdAt: custom.showJoinDate ? account.createdAt : null,
                stats: {
                    xp: custom.showXp ? xp.totalXp : null,
                    level: custom.showXp ? xp.level : null,
                    requests: Number(xp.breakdown?.apiRequests || 0),
                    cards: Number(xp.breakdown?.cards || 0),
                    uploads: Number(xp.breakdown?.uploads || 0),
                    messages: Number(xp.breakdown?.messages || 0),
                    friends: custom.showFriendCount ? friendCount : null
                }
            }
        });
    });

    app.patch('/api/admin/profile-store/:accountId/coins', requireTrustedOrigin, requireAdmin, (req, res) => {
        const account = S.loadAccounts().find(entry => entry.id === req.params.accountId);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        const delta = clampInt(req.body?.delta, -1000000, 1000000, 0);
        const state = getState(account.id);
        state.bonusCoins = Number(state.bonusCoins || 0) + delta;
        state.updatedAt = new Date().toISOString();
        saveState(state);
        return res.json({ ok: true, wallet: getWalletView(account.id, state) });
    });

    app.post('/api/admin/profile-store/:accountId/grant/:itemId', requireTrustedOrigin, requireAdmin, (req, res) => {
        const account = S.loadAccounts().find(entry => entry.id === req.params.accountId);
        const product = catalogItem(req.params.itemId);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        if (!product) return res.status(404).json({ ok: false, error: 'Item não encontrado.' });
        const state = getState(account.id);
        if (!state.ownedItems.some(entry => entry.itemId === product.id)) {
            state.ownedItems.push({ itemId: product.id, price: 0, purchasedAt: new Date().toISOString(), granted: true });
            state.updatedAt = new Date().toISOString();
            saveState(state);
        }
        return res.json({ ok: true, ...getPrivateStoreView(account.id) });
    });
}

function getPrivateStoreView(accountId) {
    const state = getState(accountId);
    const owned = state.ownedItems.map(entry => ({ ...entry, item: catalogItem(entry.itemId) })).filter(entry => entry.item);
    return {
        wallet: getWalletView(accountId, state),
        inventory: owned,
        equipped: {
            tagIds: state.equipped.tagIds,
            frameId: state.equipped.frameId || '',
            decorationId: state.equipped.decorationId || ''
        },
        cosmetics: getPublicCosmetics(accountId),
        catalog: CATALOG,
        rules: { starterCoins: STARTER_COINS, xpPerCoin: XP_PER_COIN, maxEquippedTags: MAX_EQUIPPED_TAGS }
    };
}

function getPublicCosmetics(accountId) {
    const state = getState(accountId);
    return {
        tags: state.equipped.tagIds.map(catalogItem).filter(item => item?.type === 'tag'),
        frame: state.equipped.frameId ? catalogItem(state.equipped.frameId) : null,
        decoration: state.equipped.decorationId ? catalogItem(state.equipped.decorationId) : null
    };
}

function getWalletView(accountId, providedState = null) {
    const state = providedState || getState(accountId);
    const xp = getXpView(accountId);
    const earnedCoins = STARTER_COINS + Math.floor(Number(xp.totalXp || 0) / XP_PER_COIN);
    const bonusCoins = Number(state.bonusCoins || 0);
    const spentCoins = Math.max(0, Number(state.spentCoins || 0));
    return {
        balance: Math.max(0, earnedCoins + bonusCoins - spentCoins),
        earnedCoins,
        bonusCoins,
        spentCoins,
        starterCoins: STARTER_COINS,
        xpPerCoin: XP_PER_COIN
    };
}

function cleanupProfileEconomyAccount(accountId) {
    if (!accountId) return;
    saveStates(loadStates().filter(entry => entry.accountId !== accountId));
}

function getState(accountId) {
    const found = loadStates().find(entry => entry.accountId === accountId);
    const ownedItems = Array.isArray(found?.ownedItems) ? found.ownedItems.filter(entry => entry && catalogItem(entry.itemId)) : [];
    const equippedInput = found?.equipped && typeof found.equipped === 'object' ? found.equipped : {};
    const owned = new Set(ownedItems.map(entry => entry.itemId));
    const tagIds = [...new Set((Array.isArray(equippedInput.tagIds) ? equippedInput.tagIds : []).map(cleanId).filter(id => owned.has(id) && catalogItem(id)?.type === 'tag'))].slice(0, MAX_EQUIPPED_TAGS);
    const frameId = owned.has(cleanId(equippedInput.frameId)) && catalogItem(equippedInput.frameId)?.type === 'frame' ? cleanId(equippedInput.frameId) : '';
    const decorationId = owned.has(cleanId(equippedInput.decorationId)) && catalogItem(equippedInput.decorationId)?.type === 'decoration' ? cleanId(equippedInput.decorationId) : '';
    return {
        accountId,
        ownedItems,
        spentCoins: Math.max(0, Number(found?.spentCoins || 0)),
        bonusCoins: Number(found?.bonusCoins || 0),
        equipped: { tagIds, frameId, decorationId },
        updatedAt: found?.updatedAt || null
    };
}

function saveState(state) {
    const states = loadStates();
    const index = states.findIndex(entry => entry.accountId === state.accountId);
    if (index === -1) states.push(state); else states[index] = state;
    saveStates(states);
}

function catalogItem(id) {
    const normalized = cleanId(id);
    return CATALOG.find(entry => entry.id === normalized) || null;
}

function baseProfile(account) {
    const profile = account?.profile && typeof account.profile === 'object' ? account.profile : {};
    const privacy = profile.privacy && typeof profile.privacy === 'object' ? profile.privacy : {};
    return {
        displayName: cleanText(profile.displayName, 50) || account.username,
        bio: cleanText(profile.bio, 320),
        status: cleanText(profile.status, 60),
        avatarUploadId: cleanId(profile.avatarUploadId),
        privacy: {
            allowFriendRequests: privacy.allowFriendRequests !== false,
            allowCallsFromFriends: privacy.allowCallsFromFriends !== false,
            showOnPodium: privacy.showOnPodium !== false,
            showOnline: privacy.showOnline !== false
        }
    };
}

function getCustomProfile(accountId) {
    const found = readArray(PROFILE_FILE).find(entry => entry.accountId === accountId) || {};
    return {
        accountId,
        accent: /^#[0-9a-f]{6}$/i.test(String(found.accent || '')) ? found.accent : '#a855f7',
        bannerUploadId: cleanId(found.bannerUploadId),
        headline: cleanText(found.headline, 90),
        style: ['clean', 'glass', 'contrast'].includes(found.style) ? found.style : 'clean',
        showXp: found.showXp !== false,
        showJoinDate: found.showJoinDate !== false,
        showFriendCount: found.showFriendCount !== false
    };
}

function avatarUrl(account) {
    const id = baseProfile(account).avatarUploadId;
    return id && S.loadUploads().some(entry => entry.id === id && entry.accountId === account.id) ? `/social-avatar/${encodeURIComponent(account.id)}` : null;
}

function requireSession(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        const account = session ? S.loadAccounts().find(entry => entry.id === session.accountId && entry.active) : null;
        if (!account) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        req.account = account;
        return next();
    } catch (error) { return next(error); }
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
        try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    }
    return out;
}

function ensureStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_FILE)) writeJsonAtomic(STORE_FILE, []);
}
function loadStates() { ensureStorage(); return readArray(STORE_FILE); }
function saveStates(states) { writeJsonAtomic(STORE_FILE, states); }
function readArray(file) { try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(value) ? value : []; } catch { return []; } }
function writeJsonAtomic(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`; fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); }
function cleanText(value, max) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function cleanId(value) { return String(value || '').trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 80); }
function clampInt(value, min, max, fallback) { const number = Math.trunc(Number(value)); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }

module.exports = { registerProfileEconomyRoutes, getPublicCosmetics, getWalletView, getPrivateStoreView, cleanupProfileEconomyAccount, CATALOG };
