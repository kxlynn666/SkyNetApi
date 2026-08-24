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
    item('tag-cyberpunk', 'tag', 'CYBERPUNK', 1300, 'legendary', ['#06b6d4', '#d946ef'], { collection: 'holo', animated: true }),
    item('tag-hanami', 'tag', 'HANAMI', 1450, 'legendary', ['#be185d', '#fce7f3'], { collection: 'sakura', animated: true }),
    item('tag-cosmic', 'tag', 'COSMIC', 1650, 'legendary', ['#4f46e5', '#c084fc'], { collection: 'cosmic', animated: true }),
    item('tag-glitch', 'tag', 'GLITCH', 1850, 'legendary', ['#22d3ee', '#fb7185'], { collection: 'holo', animated: true }),
    item('tag-celestial', 'tag', 'CELESTIAL', 2100, 'legendary', ['#93c5fd', '#f5d0fe'], { collection: 'cosmic', animated: true }),
    item('tag-elite', 'tag', 'ELITE', 1600, 'legendary', ['#ca8a04', '#fde047'], { collection: 'core', animated: true }),
    item('tag-editorial', 'tag', 'EDITORIAL', 2200, 'legendary', ['#d6d3d1', '#57534e'], { collection: 'editorial' }),
    item('tag-analog', 'tag', 'ANALOG', 2350, 'legendary', ['#f5e7c8', '#78716c'], { collection: 'analog' }),
    item('tag-atelier', 'tag', 'ATELIER', 2600, 'legendary', ['#e7e5e4', '#a78bfa'], { collection: 'minimal' }),

    // Tags exclusivas DEV — nunca compráveis
    item('tag-dev', 'tag', 'DEV', 0, 'exclusive', ['#16a34a', '#86efac'], { collection: 'developer', grantOnly: true, animated: true }),
    item('tag-linux', 'tag', 'LINUX', 0, 'exclusive', ['#0ea5e9', '#fde047'], { collection: 'developer', grantOnly: true }),
    item('tag-api', 'tag', 'API', 0, 'exclusive', ['#06b6d4', '#67e8f9'], { collection: 'developer', grantOnly: true }),
    item('tag-core-dev', 'tag', 'CORE DEV', 0, 'exclusive', ['#22c55e', '#a3e635'], { collection: 'developer', grantOnly: true, animated: true }),
    item('tag-debugger', 'tag', 'DEBUGGER', 0, 'exclusive', ['#ef4444', '#22d3ee'], { collection: 'developer', grantOnly: true }),
    item('tag-maintainer', 'tag', 'MAINTAINER', 0, 'exclusive', ['#10b981', '#60a5fa'], { collection: 'developer', grantOnly: true }),
    item('tag-architect', 'tag', 'ARCHITECT', 0, 'exclusive', ['#14b8a6', '#a3e635'], { collection: 'developer', grantOnly: true, animated: true }),

    // Tags exclusivas ADMIN — nunca compráveis
    item('tag-admin', 'tag', 'ADMIN', 0, 'exclusive', ['#f59e0b', '#fde68a'], { collection: 'admin', grantOnly: true, animated: true }),
    item('tag-staff', 'tag', 'STAFF', 0, 'exclusive', ['#2563eb', '#facc15'], { collection: 'admin', grantOnly: true }),
    item('tag-authority', 'tag', 'AUTHORITY', 0, 'exclusive', ['#eab308', '#ffffff'], { collection: 'admin', grantOnly: true, animated: true }),
    item('tag-root-admin', 'tag', 'ROOT ADMIN', 0, 'exclusive', ['#facc15', '#f8fafc'], { collection: 'admin', grantOnly: true, animated: true }),

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
    item('frame-circuit', 'frame', 'Circuit Halo', 2550, 'legendary', ['#22d3ee', '#10b981'], { collection: 'holo', animated: true, overlay: true }),
    item('frame-sakura-branch', 'frame', 'Sakura Branch', 2850, 'legendary', ['#be185d', '#fce7f3'], { collection: 'sakura', animated: true, overlay: true }),
    item('frame-crystal', 'frame', 'Crystal Crown', 3150, 'legendary', ['#bae6fd', '#e9d5ff'], { collection: 'winter', animated: true, overlay: true }),
    item('frame-void', 'frame', 'Void Rift', 3350, 'legendary', ['#020617', '#7c3aed'], { collection: 'cosmic', animated: true, overlay: true }),
    item('frame-celestial', 'frame', 'Celestial Wings', 3600, 'legendary', ['#93c5fd', '#f5d0fe'], { collection: 'cosmic', animated: true, overlay: true }),

    // Molduras V6 — editorial / analógico / material
    item('frame-editorial-crop', 'frame', 'Editorial Crop', 3900, 'legendary', ['#f4f0e8', '#111827'], { collection: 'editorial', overlay: true }),
    item('frame-offset-glass', 'frame', 'Offset Glass', 4200, 'legendary', ['#e9d5ff', '#67e8f9'], { collection: 'minimal', overlay: true }),
    item('frame-chrome-corners', 'frame', 'Chrome Corners', 4500, 'legendary', ['#f8fafc', '#64748b'], { collection: 'editorial', overlay: true }),
    item('frame-film-gate', 'frame', 'Film Gate', 4700, 'legendary', ['#18181b', '#d4d4d8'], { collection: 'analog', overlay: true }),
    item('frame-archive-tape', 'frame', 'Archive Tape', 4900, 'legendary', ['#f5e7c8', '#a88f61'], { collection: 'analog', overlay: true }),
    item('frame-porcelain', 'frame', 'Porcelain Edge', 5200, 'legendary', ['#fffdf8', '#dbeafe'], { collection: 'minimal', overlay: true }),
    item('frame-ink-registration', 'frame', 'Ink Registration', 5400, 'legendary', ['#22d3ee', '#fb7185'], { collection: 'editorial', animated: true, overlay: true }),
    item('frame-ribbon-fold', 'frame', 'Ribbon Fold', 5700, 'legendary', ['#d4d4d8', '#3f3f46'], { collection: 'textile', overlay: true }),

    // Molduras V7 — peças em camadas / objetos, não apenas contornos
    item('frame-aperture-rig', 'frame', 'Aperture Rig', 6200, 'legendary', ['#cbd5e1', '#111827'], { collection: 'studio', overlay: true }),
    item('frame-polaroid-mount', 'frame', 'Polaroid Mount', 6500, 'legendary', ['#f7f3e9', '#665f54'], { collection: 'analog', overlay: true }),
    item('frame-interface-module', 'frame', 'Interface Module', 6900, 'legendary', ['#67e8f9', '#15202b'], { collection: 'studio', animated: true, overlay: true }),
    item('frame-carbon-assembly', 'frame', 'Carbon Assembly', 7200, 'legendary', ['#94a3b8', '#16181c'], { collection: 'studio', overlay: true }),
    item('frame-chrome-shell', 'frame', 'Chrome Shell', 7800, 'legendary', ['#f8fafc', '#475569'], { collection: 'material', animated: true, overlay: true }),
    item('frame-lacquer-bloom', 'frame', 'Lacquer Bloom', 8100, 'legendary', ['#fbcfe8', '#7f1d3b'], { collection: 'sakura', animated: true, overlay: true }),
    item('frame-ceramic-inlay', 'frame', 'Ceramic Inlay', 8400, 'legendary', ['#fffdf4', '#315f7d'], { collection: 'material', overlay: true }),
    item('frame-acrylic-clips', 'frame', 'Acrylic Clips', 8800, 'legendary', ['#ffffff', '#67e8f9'], { collection: 'material', animated: true, overlay: true }),

    // Molduras V8
    item('frame-gallery-mat', 'frame', 'Gallery Mat', 9200, 'legendary', ['#f3efe7', '#38332f'], { collection: 'editorial', overlay: true }),
    item('frame-kintsugi-panel', 'frame', 'Kintsugi Panel', 9600, 'legendary', ['#f6c453', '#1b1713'], { collection: 'material', overlay: true }),
    item('frame-techwear-buckle', 'frame', 'Techwear Buckle', 9900, 'legendary', ['#cbd5e1', '#171a20'], { collection: 'studio', overlay: true }),
    item('frame-botanical-press', 'frame', 'Botanical Press', 10300, 'legendary', ['#b7c18a', '#5c492d'], { collection: 'nature', animated: true, overlay: true }),
    item('frame-prism-shard', 'frame', 'Prism Shard', 10800, 'legendary', ['#ffffff', '#67e8f9'], { collection: 'material', animated: true, overlay: true }),
    item('frame-badge-rail', 'frame', 'Badge Rail', 11200, 'legendary', ['#67e8f9', '#20242b'], { collection: 'studio', animated: true, overlay: true }),
    item('frame-sakura-crest', 'frame', 'Sakura Crest', 11800, 'legendary', ['#f9a8d4', '#7f1d3b'], { collection: 'sakura', animated: true, overlay: true }),

    // Molduras DEV exclusivas
    item('frame-dev-terminal', 'frame', 'Terminal Root', 0, 'exclusive', ['#22c55e', '#86efac'], { collection: 'developer', grantOnly: true, animated: true, overlay: true }),
    item('frame-dev-debug', 'frame', 'Breakpoint', 0, 'exclusive', ['#ef4444', '#22d3ee'], { collection: 'developer', grantOnly: true, animated: true, overlay: true }),
    item('frame-dev-console', 'frame', 'Kernel Console', 0, 'exclusive', ['#10b981', '#38bdf8'], { collection: 'developer', grantOnly: true, animated: true, overlay: true }),

    // Molduras ADMIN exclusivas
    item('frame-admin-crown', 'frame', 'Admin Crown', 0, 'exclusive', ['#f59e0b', '#fff7ed'], { collection: 'admin', grantOnly: true, animated: true, overlay: true }),
    item('frame-admin-authority', 'frame', 'Authority Seal', 0, 'exclusive', ['#2563eb', '#facc15'], { collection: 'admin', grantOnly: true, animated: true, overlay: true }),
    item('frame-admin-orbit', 'frame', 'Sovereign Orbit', 0, 'exclusive', ['#facc15', '#60a5fa'], { collection: 'admin', grantOnly: true, animated: true, overlay: true }),

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
    item('deco-fireflies', 'decoration', 'Fireflies', 2450, 'legendary', ['#fef08a', '#86efac'], { collection: 'nature', animated: true }),
    item('deco-cyber-lines', 'decoration', 'Cyber Lines', 2650, 'legendary', ['#22d3ee', '#d946ef'], { collection: 'holo', animated: true }),
    item('deco-sakura-garden', 'decoration', 'Sakura Garden', 3250, 'legendary', ['#be185d', '#fce7f3'], { collection: 'sakura', animated: true }),
    item('deco-void', 'decoration', 'Void Particles', 3300, 'legendary', ['#020617', '#8b5cf6'], { collection: 'cosmic', animated: true }),
    item('deco-constellation', 'decoration', 'Constellation', 3550, 'legendary', ['#93c5fd', '#c4b5fd'], { collection: 'cosmic', animated: true }),

    // Decorações V6 — menos clichê, mais editoriais / materiais
    item('deco-editorial-grain', 'decoration', 'Editorial Grain', 2800, 'legendary', ['#d6d3d1', '#57534e'], { collection: 'editorial', animated: true }),
    item('deco-moire-veil', 'decoration', 'Moiré Veil', 3000, 'legendary', ['#e7e5e4', '#78716c'], { collection: 'editorial', animated: true }),
    item('deco-paper-fibers', 'decoration', 'Paper Fibers', 3100, 'legendary', ['#f5f5f4', '#a8a29e'], { collection: 'analog' }),
    item('deco-riso-offset', 'decoration', 'Riso Offset', 3450, 'legendary', ['#22d3ee', '#fb7185'], { collection: 'editorial', animated: true }),
    item('deco-window-light', 'decoration', 'Window Light', 3650, 'legendary', ['#fff7d6', '#d6d3d1'], { collection: 'minimal', animated: true }),
    item('deco-velvet-noise', 'decoration', 'Velvet Noise', 3850, 'legendary', ['#701a75', '#27272a'], { collection: 'textile', animated: true }),
    item('deco-contact-sheet', 'decoration', 'Contact Sheet', 4050, 'legendary', ['#e7e5e4', '#292524'], { collection: 'analog' }),
    item('deco-chrome-reflection', 'decoration', 'Chrome Reflection', 4350, 'legendary', ['#f8fafc', '#64748b'], { collection: 'editorial', animated: true }),
    item('deco-quiet-bloom', 'decoration', 'Quiet Bloom', 4700, 'legendary', ['#bef264', '#d8b4fe'], { collection: 'nature', animated: true }),

    // Stocks V7
    item('deco-stock-light-leak', 'decoration', 'Film Light Leak', 5200, 'legendary', ['#fb923c', '#f43f5e'], { collection: 'stock', animated: true }),
    item('deco-stock-torn-paper', 'decoration', 'Torn Paper Stock', 5500, 'legendary', ['#ece8df', '#665f54'], { collection: 'stock' }),
    item('deco-stock-negative-strip', 'decoration', 'Negative Strip', 5800, 'legendary', ['#0e7490', '#581c87'], { collection: 'analog' }),
    item('deco-stock-shadow-cast', 'decoration', 'Window Shadow Cast', 6100, 'legendary', ['#111827', '#fff4d6'], { collection: 'minimal', animated: true }),
    item('deco-stock-glass-refraction', 'decoration', 'Glass Refraction', 6400, 'legendary', ['#67e8f9', '#d8b4fe'], { collection: 'material', animated: true }),
    item('deco-stock-ink-bloom', 'decoration', 'Ink Bloom Stock', 6700, 'legendary', ['#0f172a', '#581c87'], { collection: 'studio', animated: true }),
    item('deco-stock-blueprint', 'decoration', 'Blueprint Sheet', 6900, 'legendary', ['#7dd3fc', '#0f172a'], { collection: 'studio', animated: true }),
    item('deco-stock-silk-fold', 'decoration', 'Silk Fold', 7200, 'legendary', ['#e9d5ff', '#521b6b'], { collection: 'textile', animated: true }),
    item('deco-stock-liquid-chrome', 'decoration', 'Liquid Chrome Stock', 7800, 'legendary', ['#f8fafc', '#64748b'], { collection: 'material', animated: true }),

    // Stocks V8
    item('deco-stock-lens-dust', 'decoration', 'Lens Dust', 8200, 'legendary', ['#f8fafc', '#64748b'], { collection: 'stock', animated: true }),
    item('deco-stock-film-burn', 'decoration', 'Film Burn Edge', 8500, 'legendary', ['#fb923c', '#e11d48'], { collection: 'analog', animated: true }),
    item('deco-stock-folded-poster', 'decoration', 'Folded Poster', 8900, 'legendary', ['#e7e5e4', '#78716c'], { collection: 'editorial' }),
    item('deco-stock-scanner-glow', 'decoration', 'Scanner Glow', 9300, 'legendary', ['#67e8f9', '#f8fafc'], { collection: 'studio', animated: true }),
    item('deco-stock-ink-stamp', 'decoration', 'Archive Ink Stamp', 9600, 'legendary', ['#111827', '#d6d3d1'], { collection: 'editorial' }),
    item('deco-stock-mesh-gradient', 'decoration', 'Mesh Gradient', 9900, 'legendary', ['#38bdf8', '#f472b6'], { collection: 'material', animated: true }),
    item('deco-stock-leaf-shadow', 'decoration', 'Botanical Shadow', 10300, 'legendary', ['#0f172a', '#84cc16'], { collection: 'nature', animated: true }),
    item('deco-stock-sakura-drift', 'decoration', 'Sakura Drift', 10900, 'legendary', ['#fce7f3', '#ec4899'], { collection: 'sakura', animated: true }),
    item('deco-stock-halftone-fold', 'decoration', 'Halftone Fold', 11200, 'legendary', ['#f8fafc', '#64748b'], { collection: 'editorial', animated: true }),
    item('deco-stock-gloss-tape', 'decoration', 'Gloss Tape', 11600, 'legendary', ['#ffffff', '#d8b4fe'], { collection: 'material', animated: true }),

    // Decorações DEV exclusivas
    item('deco-dev-code', 'decoration', 'Source Stream', 0, 'exclusive', ['#22c55e', '#86efac'], { collection: 'developer', grantOnly: true, animated: true }),
    item('deco-dev-matrix', 'decoration', 'Root Matrix', 0, 'exclusive', ['#16a34a', '#4ade80'], { collection: 'developer', grantOnly: true, animated: true }),
    item('deco-dev-stacktrace', 'decoration', 'Stack Trace', 0, 'exclusive', ['#22c55e', '#38bdf8'], { collection: 'developer', grantOnly: true, animated: true }),

    // Decorações ADMIN exclusivas
    item('deco-admin-aegis', 'decoration', 'Admin Aegis', 0, 'exclusive', ['#f59e0b', '#fde68a'], { collection: 'admin', grantOnly: true, animated: true }),
    item('deco-admin-command', 'decoration', 'Command Halo', 0, 'exclusive', ['#2563eb', '#facc15'], { collection: 'admin', grantOnly: true, animated: true }),
    item('deco-admin-verdict', 'decoration', 'Verdict', 0, 'exclusive', ['#facc15', '#f8fafc'], { collection: 'admin', grantOnly: true, animated: true })
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
        if (product.grantOnly) return res.status(403).json({ ok: false, error: 'Este item é exclusivo e só pode ser concedido por um administrador.' });
        const state = getState(req.account.id);
        if (state.ownedItems.some(entry => entry.itemId === product.id)) return res.status(409).json({ ok: false, error: 'Este item já pertence à sua conta.' });
        const wallet = getWalletView(req.account.id, state);
        if (wallet.balance < product.price) return res.status(409).json({ ok: false, error: `Saldo insuficiente. Faltam ${product.price - wallet.balance} moedas.` });
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
            state.ownedItems.push({ itemId: product.id, price: 0, purchasedAt: new Date().toISOString(), granted: true, source: 'admin', grantedBy: req.account.id });
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