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
    // Tags da loja
    item('tag-creator', 'tag', 'CREATOR', 220, 'uncommon', ['#db2777', '#fb7185'], { collection: 'core' }),
    item('tag-beta', 'tag', 'BETA', 340, 'rare', ['#059669', '#34d399'], { collection: 'core' }),
    item('tag-social', 'tag', 'SOCIAL', 200, 'common', ['#7c3aed', '#c084fc'], { collection: 'core' }),
    item('tag-nightowl', 'tag', 'NIGHT OWL', 420, 'rare', ['#312e81', '#818cf8'], { collection: 'night' }),
    item('tag-artisan', 'tag', 'ARTISAN', 520, 'rare', ['#c026d3', '#f0abfc'], { collection: 'core' }),
    item('tag-veteran', 'tag', 'VETERAN', 700, 'epic', ['#0f766e', '#5eead4'], { collection: 'core' }),
    item('tag-collector', 'tag', 'COLLECTOR', 760, 'epic', ['#b45309', '#fbbf24'], { collection: 'core' }),
    item('tag-og', 'tag', 'OG', 950, 'epic', ['#d97706', '#fbbf24'], { collection: 'core' }),
    item('tag-sakura', 'tag', 'SAKURA', 850, 'legendary', ['#db2777', '#f9a8d4'], { collection: 'sakura', animated: true }),
    item('tag-elite', 'tag', 'ELITE', 1600, 'legendary', ['#ca8a04', '#fde047'], { collection: 'core', animated: true }),

    // Tags exclusivas DEV — nunca compráveis
    item('tag-dev', 'tag', 'DEV', 0, 'exclusive', ['#16a34a', '#86efac'], { collection: 'developer', grantOnly: true, animated: true }),
    item('tag-linux', 'tag', 'LINUX', 0, 'exclusive', ['#0ea5e9', '#fde047'], { collection: 'developer', grantOnly: true }),
    item('tag-api', 'tag', 'API', 0, 'exclusive', ['#06b6d4', '#67e8f9'], { collection: 'developer', grantOnly: true }),
    item('tag-core-dev', 'tag', 'CORE DEV', 0, 'exclusive', ['#22c55e', '#a3e635'], { collection: 'developer', grantOnly: true, animated: true }),
    item('tag-debugger', 'tag', 'DEBUGGER', 0, 'exclusive', ['#ef4444', '#22d3ee'], { collection: 'developer', grantOnly: true }),
    item('tag-maintainer', 'tag', 'MAINTAINER', 0, 'exclusive', ['#10b981', '#60a5fa'], { collection: 'developer', grantOnly: true }),

    // Tags exclusivas ADMIN — nunca compráveis
    item('tag-admin', 'tag', 'ADMIN', 0, 'exclusive', ['#f59e0b', '#fde68a'], { collection: 'admin', grantOnly: true, animated: true }),
    item('tag-staff', 'tag', 'STAFF', 0, 'exclusive', ['#2563eb', '#facc15'], { collection: 'admin', grantOnly: true }),
    item('tag-authority', 'tag', 'AUTHORITY', 0, 'exclusive', ['#eab308', '#ffffff'], { collection: 'admin', grantOnly: true, animated: true }),

    // Molduras da loja
    item('frame-violet', 'frame', 'Violet Pulse', 320, 'common', ['#8b5cf6', '#c084fc'], { collection: 'core' }),
    item('frame-cyan', 'frame', 'Cyber Cyan', 420, 'uncommon', ['#06b6d4', '#67e8f9'], { collection: 'core' }),
    item('frame-rose', 'frame', 'Rose Neon', 520, 'rare', ['#e11d48', '#fb7185'], { collection: 'core' }),
    item('frame-gold', 'frame', 'Royal Gold', 900, 'epic', ['#d97706', '#fde047'], { collection: 'core' }),
    item('frame-frost', 'frame', 'Frozen Halo', 1100, 'epic', ['#38bdf8', '#e0f2fe'], { collection: 'winter', overlay: true }),
    item('frame-ember', 'frame', 'Ember Core', 1250, 'epic', ['#ea580c', '#facc15'], { collection: 'ember', animated: true, overlay: true }),
    item('frame-plasma', 'frame', 'Plasma', 1500, 'legendary', ['#7c3aed', '#22d3ee', '#ec4899'], { collection: 'core', animated: true }),
    item('frame-eclipse', 'frame', 'Eclipse', 1700, 'legendary', ['#111827', '#a855f7'], { collection: 'cosmic', animated: true, overlay: true }),
    item('frame-nebula', 'frame', 'Nebula Drift', 1800, 'legendary', ['#4f46e5', '#ec4899'], { collection: 'cosmic', animated: true, overlay: true }),
    item('frame-hologram', 'frame', 'Hologram', 1900, 'legendary', ['#22d3ee', '#a78bfa'], { collection: 'holo', animated: true, overlay: true }),
    item('frame-sakura', 'frame', 'Sakura Bloom', 2000, 'legendary', ['#ec4899', '#fbcfe8'], { collection: 'sakura', animated: true, overlay: true }),
    item('frame-spectrum', 'frame', 'Spectrum', 2200, 'legendary', ['#22d3ee', '#8b5cf6', '#ec4899', '#f59e0b'], { collection: 'core', animated: true }),

    // Molduras DEV exclusivas
    item('frame-dev-terminal', 'frame', 'Terminal Root', 0, 'exclusive', ['#22c55e', '#86efac'], { collection: 'developer', grantOnly: true, animated: true, overlay: true }),
    item('frame-dev-debug', 'frame', 'Breakpoint', 0, 'exclusive', ['#ef4444', '#22d3ee'], { collection: 'developer', grantOnly: true, animated: true, overlay: true }),

    // Molduras ADMIN exclusivas
    item('frame-admin-crown', 'frame', 'Admin Crown', 0, 'exclusive', ['#f59e0b', '#fff7ed'], { collection: 'admin', grantOnly: true, animated: true, overlay: true }),
    item('frame-admin-authority', 'frame', 'Authority Seal', 0, 'exclusive', ['#2563eb', '#facc15'], { collection: 'admin', grantOnly: true, animated: true, overlay: true }),

    // Decorações da loja
    item('deco-grid', 'decoration', 'Digital Grid', 380, 'common', ['#8b5cf6', '#312e81'], { collection: 'core' }),
    item('deco-glow', 'decoration', 'Soft Aura', 450, 'uncommon', ['#a855f7', '#06b6d4'], { collection: 'core' }),
    item('deco-orbit', 'decoration', 'Orbit Lines', 650, 'rare', ['#22d3ee', '#8b5cf6'], { collection: 'cosmic', animated: true }),
    item('deco-stars', 'decoration', 'Starfield', 900, 'epic', ['#e2e8f0', '#818cf8'], { collection: 'cosmic', animated: true }),
    item('deco-snow', 'decoration', 'Crystal Snow', 900, 'epic', ['#e0f2fe', '#38bdf8'], { collection: 'winter', animated: true }),
    item('deco-rain', 'decoration', 'Neon Rain', 980, 'epic', ['#0ea5e9', '#a855f7'], { collection: 'night', animated: true }),
    item('deco-embers', 'decoration', 'Ember Sparks', 1050, 'epic', ['#f97316', '#fde047'], { collection: 'ember', animated: true }),
    item('deco-aurora', 'decoration', 'Aurora', 1100, 'epic', ['#06b6d4', '#8b5cf6', '#ec4899'], { collection: 'core', animated: true }),
    item('deco-neon-scan', 'decoration', 'Neon Scan', 1200, 'epic', ['#22d3ee', '#8b5cf6'], { collection: 'holo', animated: true }),
    item('deco-prism', 'decoration', 'Prism', 1500, 'legendary', ['#22d3ee', '#a855f7', '#f43f5e'], { collection: 'holo', animated: true }),
    item('deco-celestial', 'decoration', 'Celestial Dust', 1800, 'legendary', ['#818cf8', '#f0abfc'], { collection: 'cosmic', animated: true }),
    item('deco-sakura', 'decoration', 'Sakura Petals', 2300, 'legendary', ['#ec4899', '#fbcfe8'], { collection: 'sakura', animated: true }),

    // Decorações DEV exclusivas
    item('deco-dev-code', 'decoration', 'Source Stream', 0, 'exclusive', ['#22c55e', '#86efac'], { collection: 'developer', grantOnly: true, animated: true }),
    item('deco-dev-matrix', 'decoration', 'Root Matrix', 0, 'exclusive', ['#16a34a', '#4ade80'], { collection: 'developer', grantOnly: true, animated: true }),

    // Decorações ADMIN exclusivas
    item('deco-admin-aegis', 'decoration', 'Admin Aegis', 0, 'exclusive', ['#f59e0b', '#fde68a'], { collection: 'admin', grantOnly: true, animated: true }),
    item('deco-admin-command', 'decoration', 'Command Halo', 0, 'exclusive', ['#2563eb', '#facc15'], { collection: 'admin', grantOnly: true, animated: true })
]);

function item(id, type, name, price, rarity, colors, options = {}) {
    return Object.freeze({
        id,
        type,
        name,
        price: Math.max(0, Number(price) || 0),
        rarity,
        colors,
        collection: cleanId(options.collection || 'core') || 'core',
        grantOnly: options.grantOnly === true,
        animated: options.animated === true,
        overlay: options.overlay === true
    });
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
        if (product.grantOnly) {
            return res.status(403).json({ ok: false, error: 'Este item é exclusivo e só pode ser concedido por um administrador.' });
        }
        const state = getState(req.account.id);
        if (state.ownedItems.some(entry => entry.itemId === product.id)) {
            return res.status(409).json({ ok: false, error: 'Este item já pertence à sua conta.' });
        }
        const wallet = getWalletView(req.account.id, state);
        if (wallet.balance < product.price) {
            return res.status(409).json({ ok: false, error: `Saldo insuficiente. Faltam ${product.price - wallet.balance} moedas.` });
        }
        state.ownedItems.push({ itemId: product.id, price: product.price, purchasedAt: new Date().toISOString(), source: 'store' });
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

    app.get('/api/admin/profile-store/:accountId', requireAdmin, (req, res) => {
        const account = S.loadAccounts().find(entry => entry.id === req.params.accountId);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, account: { id: account.id, username: account.username }, ...getPrivateStoreView(account.id) });
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
            state.ownedItems.push({
                itemId: product.id,
                price: 0,
                purchasedAt: new Date().toISOString(),
                granted: true,
                source: 'admin',
                grantedBy: req.account.id
            });
            state.updatedAt = new Date().toISOString();
            saveState(state);
        }
        return res.json({ ok: true, ...getPrivateStoreView(account.id) });
    });

    app.delete('/api/admin/profile-store/:accountId/revoke/:itemId', requireTrustedOrigin, requireAdmin, (req, res) => {
        const account = S.loadAccounts().find(entry => entry.id === req.params.accountId);
        const product = catalogItem(req.params.itemId);
        if (!account) return res.status(404).json({ ok: false, error: 'Conta não encontrada.' });
        if (!product) return res.status(404).json({ ok: false, error: 'Item não encontrado.' });
        const state = getState(account.id);
        const before = state.ownedItems.length;
        state.ownedItems = state.ownedItems.filter(entry => entry.itemId !== product.id);
        if (state.ownedItems.length === before) return res.status(404).json({ ok: false, error: 'A conta não possui este item.' });

        state.equipped.tagIds = state.equipped.tagIds.filter(id => id !== product.id);
        if (state.equipped.frameId === product.id) state.equipped.frameId = '';
        if (state.equipped.decorationId === product.id) state.equipped.decorationId = '';
        state.updatedAt = new Date().toISOString();
        saveState(state);
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
