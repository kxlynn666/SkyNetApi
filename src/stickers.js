const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const C = require('./config');
const S = require('./store');

const STICKERS_FILE = path.join(C.DATA_DIR, 'stickers.json');
const STATE_FILE = path.join(C.DATA_DIR, 'sticker-state.json');
const FILES_DIR = path.join(C.DATA_DIR, 'sticker-files');
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_DURATION_MS = 10_000;
const MAX_RECENTS = 30;

const BUILTINS = Object.freeze([
    { id:'builtin-heartbeat', name:'Heartbeat', pack:'Reações', animated:true, durationMs:1600, art:'heart' },
    { id:'builtin-lol', name:'LOL', pack:'Reações', animated:false, durationMs:0, art:'lol' },
    { id:'builtin-wow', name:'WOW', pack:'Reações', animated:false, durationMs:0, art:'wow' },
    { id:'builtin-gg', name:'GG', pack:'Reações', animated:true, durationMs:1800, art:'gg' },
    { id:'builtin-ok', name:'OK', pack:'Minimal', animated:false, durationMs:0, art:'ok' },
    { id:'builtin-brb', name:'BRB', pack:'Minimal', animated:false, durationMs:0, art:'brb' },
    { id:'builtin-focus', name:'Focus', pack:'Minimal', animated:true, durationMs:2200, art:'focus' },
    { id:'builtin-sakura-hi', name:'Sakura Hi', pack:'Sakura', animated:true, durationMs:2600, art:'sakura-hi' },
    { id:'builtin-sakura-bloom', name:'Bloom', pack:'Sakura', animated:true, durationMs:3200, art:'sakura-bloom' },
    { id:'builtin-sakura-thanks', name:'Arigato', pack:'Sakura', animated:false, durationMs:0, art:'sakura-thanks' },
    { id:'builtin-spark', name:'Spark', pack:'Studio', animated:true, durationMs:2000, art:'spark' },
    { id:'builtin-approved', name:'Approved', pack:'Studio', animated:false, durationMs:0, art:'approved' }
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
    fileFilter(req, file, callback) {
        const type = String(file.mimetype || '').toLowerCase();
        if (!['image/png','image/jpeg','image/webp','image/gif'].includes(type)) return callback(new Error('Use PNG, JPG, WebP ou GIF.'));
        return callback(null, true);
    }
});

function ensureStorage() {
    fs.mkdirSync(C.DATA_DIR, { recursive:true });
    fs.mkdirSync(FILES_DIR, { recursive:true });
    if (!fs.existsSync(STICKERS_FILE)) writeJson(STICKERS_FILE, []);
    if (!fs.existsSync(STATE_FILE)) writeJson(STATE_FILE, { favorites:{}, recents:{} });
}

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file,'utf8')); }
    catch { return fallback; }
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive:true });
    const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value,null,2), { mode:0o600 });
    fs.renameSync(temp,file);
}

function cleanText(value, max = 60) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}

function loadCustom() {
    ensureStorage();
    const value = readJson(STICKERS_FILE, []);
    return Array.isArray(value) ? value : [];
}

function saveCustom(value) { writeJson(STICKERS_FILE, value); }
function loadState() {
    ensureStorage();
    const value = readJson(STATE_FILE, { favorites:{}, recents:{} });
    return {
        favorites: value && typeof value.favorites === 'object' ? value.favorites : {},
        recents: value && typeof value.recents === 'object' ? value.recents : {}
    };
}
function saveState(value) { writeJson(STATE_FILE, value); }

function builtinPublic(item) {
    return {
        id:item.id, name:item.name, type:item.animated ? 'animated' : 'static', animated:Boolean(item.animated),
        durationMs:Number(item.durationMs || 0), pack:item.pack, builtin:true, owned:false,
        url:`/stickers/builtin/${encodeURIComponent(item.id)}.svg`
    };
}

function customPublic(item, accountId = null) {
    return {
        id:item.id, name:item.name, type:item.animated ? 'animated' : 'static', animated:Boolean(item.animated),
        durationMs:Number(item.durationMs || 0), pack:'Minhas', builtin:false, owned:accountId ? item.ownerId === accountId : false,
        width:Number(item.width || 0), height:Number(item.height || 0),
        url:`/stickers/file/${encodeURIComponent(item.id)}`
    };
}

function getStickerPublic(stickerId, options = {}) {
    const id = cleanText(stickerId, 100);
    const builtin = BUILTINS.find(item => item.id === id);
    if (builtin) return builtinPublic(builtin);
    const custom = loadCustom().find(item => item.id === id && (options.includeDeleted || !item.deletedAt));
    return custom ? customPublic(custom, options.accountId || null) : null;
}

function markStickerUsed(accountId, stickerId) {
    if (!accountId || !stickerId) return;
    const state = loadState();
    const current = Array.isArray(state.recents[accountId]) ? state.recents[accountId] : [];
    state.recents[accountId] = [{ id:stickerId, usedAt:new Date().toISOString() }, ...current.filter(item => item?.id !== stickerId)].slice(0,MAX_RECENTS);
    saveState(state);
}

function toggleFavorite(accountId, stickerId, favorite) {
    const state = loadState();
    const list = Array.isArray(state.favorites[accountId]) ? state.favorites[accountId] : [];
    state.favorites[accountId] = favorite ? [...new Set([stickerId,...list])].slice(0,120) : list.filter(id => id !== stickerId);
    saveState(state);
    return state.favorites[accountId];
}

function requireSession(req,res,next) {
    try {
        const token = parseCookies(req.headers.cookie || '').skynet_session || '';
        const session = token ? S.getSession(token) : null;
        const account = session ? S.loadAccounts().find(item => item.id === session.accountId && item.active) : null;
        if (!account) return res.status(401).json({ok:false,error:'Não autorizado.'});
        req.account = account;
        return next();
    } catch (error) { return next(error); }
}

function requireTrustedOrigin(req,res,next) {
    const origin = req.get('origin');
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ok:false,error:'Origem não permitida.'});
}

function parseCookies(header) {
    const out = {};
    for (const part of String(header || '').split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        const key = part.slice(0,index).trim();
        const value = part.slice(index+1).trim();
        try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    }
    return out;
}

async function createStickerFromUpload(accountId, file, requestedName) {
    if (!file?.buffer?.length) throw new Error('Selecione uma imagem ou animação.');
    const probe = sharp(file.buffer, { animated:true, limitInputPixels:4096*4096 });
    const metadata = await probe.metadata();
    if (!['png','jpeg','webp','gif'].includes(String(metadata.format || ''))) throw new Error('Formato de imagem não suportado.');
    const pages = Math.max(1,Number(metadata.pages || 1));
    const animated = pages > 1;
    const delays = Array.isArray(metadata.delay) ? metadata.delay.map(value => Math.max(10,Number(value || 100))) : [];
    const durationMs = animated ? (delays.length ? delays.reduce((sum,value) => sum + value,0) : pages * 100) : 0;
    if (animated && durationMs > MAX_DURATION_MS) throw new Error('A figurinha animada deve ter no máximo 10 segundos.');
    if (pages > 300) throw new Error('A animação possui quadros demais.');

    const id = `stk_${S.randomId(12)}`;
    const filename = `${id}.webp`;
    const filepath = path.join(FILES_DIR, filename);
    const pipeline = sharp(file.buffer, { animated:true, limitInputPixels:4096*4096 })
        .resize({ width:512, height:512, fit:'inside', withoutEnlargement:true })
        .webp({ quality:animated ? 80 : 86, effort:4, loop:0 });
    const output = await pipeline.toBuffer({ resolveWithObject:true });
    if (output.data.length > 6 * 1024 * 1024) throw new Error('A figurinha ficou muito pesada após o processamento.');
    fs.writeFileSync(filepath, output.data, { mode:0o600 });

    const name = cleanText(requestedName,48) || cleanText(path.parse(file.originalname || '').name,48) || 'Minha figurinha';
    const record = {
        id, ownerId:accountId, name, filename, mime:'image/webp', animated, durationMs,
        width:Number(output.info?.width || metadata.width || 0), height:Number(output.info?.height || metadata.height || 0),
        createdAt:new Date().toISOString(), deletedAt:null
    };
    const all = loadCustom();
    all.push(record);
    saveCustom(all);
    return record;
}

function registerStickerRoutes(app) {
    ensureStorage();
    const json = express.json({limit:'32kb'});
    app.use('/api/stickers', json);

    app.get('/stickers/builtin/:id.svg', (req,res) => {
        const item = BUILTINS.find(entry => entry.id === req.params.id);
        if (!item) return res.status(404).end();
        res.setHeader('Content-Type','image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control','public, max-age=86400');
        res.setHeader('X-Content-Type-Options','nosniff');
        return res.send(renderBuiltinSvg(item));
    });

    app.get('/stickers/file/:id', requireSession, (req,res) => {
        const item = loadCustom().find(entry => entry.id === req.params.id);
        if (!item) return res.status(404).end();
        const filepath = path.join(FILES_DIR,path.basename(item.filename));
        if (!fs.existsSync(filepath)) return res.status(404).end();
        res.setHeader('Content-Type','image/webp');
        res.setHeader('Cache-Control','private, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options','nosniff');
        return res.sendFile(filepath);
    });

    app.get('/api/stickers/library', requireSession, (req,res) => {
        const state = loadState();
        const favorites = new Set(Array.isArray(state.favorites[req.account.id]) ? state.favorites[req.account.id] : []);
        const custom = loadCustom().filter(item => item.ownerId === req.account.id && !item.deletedAt).map(item => customPublic(item,req.account.id));
        const builtins = BUILTINS.map(builtinPublic);
        const byId = new Map([...builtins,...custom].map(item => [item.id,item]));
        const recentEntries = Array.isArray(state.recents[req.account.id]) ? state.recents[req.account.id] : [];
        const recents = recentEntries.map(entry => byId.get(entry.id) || getStickerPublic(entry.id,{accountId:req.account.id})).filter(Boolean);
        const favoriteItems = [...favorites].map(id => byId.get(id) || getStickerPublic(id,{accountId:req.account.id})).filter(Boolean);
        const packs = [...new Set(builtins.map(item => item.pack))].map(name => ({ name, stickers:builtins.filter(item => item.pack === name) }));
        return res.json({
            ok:true,
            limits:{maxDurationSeconds:10,maxUploadMB:8,maxDimension:512},
            recents, favorites:favoriteItems, custom, packs,
            all:[...builtins,...custom].map(item => ({...item,favorite:favorites.has(item.id)}))
        });
    });

    app.post('/api/stickers/create', requireTrustedOrigin, requireSession, upload.single('file'), async (req,res,next) => {
        try {
            const record = await createStickerFromUpload(req.account.id,req.file,req.body?.name);
            return res.status(201).json({ok:true,sticker:customPublic(record,req.account.id)});
        } catch (error) { return next(error); }
    });

    app.patch('/api/stickers/:id/favorite', requireTrustedOrigin, requireSession, (req,res) => {
        const sticker = getStickerPublic(req.params.id,{accountId:req.account.id});
        if (!sticker) return res.status(404).json({ok:false,error:'Figurinha não encontrada.'});
        const favorite = req.body?.favorite !== false;
        const favorites = toggleFavorite(req.account.id,sticker.id,favorite);
        return res.json({ok:true,favorite,favorites});
    });

    app.post('/api/stickers/:id/used', requireTrustedOrigin, requireSession, (req,res) => {
        const sticker = getStickerPublic(req.params.id,{accountId:req.account.id});
        if (!sticker) return res.status(404).json({ok:false,error:'Figurinha não encontrada.'});
        markStickerUsed(req.account.id,sticker.id);
        return res.json({ok:true});
    });

    app.delete('/api/stickers/:id', requireTrustedOrigin, requireSession, (req,res) => {
        const all = loadCustom();
        const item = all.find(entry => entry.id === req.params.id && entry.ownerId === req.account.id && !entry.deletedAt);
        if (!item) return res.status(404).json({ok:false,error:'Figurinha própria não encontrada.'});
        item.deletedAt = new Date().toISOString();
        saveCustom(all);
        const state = loadState();
        state.favorites[req.account.id] = (state.favorites[req.account.id] || []).filter(id => id !== item.id);
        state.recents[req.account.id] = (state.recents[req.account.id] || []).filter(entry => entry?.id !== item.id);
        saveState(state);
        return res.json({ok:true});
    });
}

function cleanupStickersAccount(accountId) {
    if (!accountId) return;
    const all = loadCustom();
    for (const item of all.filter(entry => entry.ownerId === accountId)) {
        try { fs.unlinkSync(path.join(FILES_DIR,path.basename(item.filename))); } catch {}
    }
    saveCustom(all.filter(entry => entry.ownerId !== accountId));
    const state = loadState();
    delete state.favorites[accountId];
    delete state.recents[accountId];
    saveState(state);
}

function renderBuiltinSvg(item) {
    const animated = item.animated;
    const motion = animated ? '<animateTransform attributeName="transform" type="scale" values="1;1.06;1" dur="1.6s" repeatCount="indefinite" additive="sum"/>' : '';
    const petal = '<path d="M0-18C11-25 21-16 16-5C12 4 3 9 0 12C-3 9-12 4-16-5C-21-16-11-25 0-18Z" fill="#f9a8d4"/>';
    const base = (inner,bg1='#17102b',bg2='#0b0713') => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity=".28"/></filter></defs><rect width="512" height="512" rx="96" fill="url(#g)"/><g transform="translate(256 256)" filter="url(#s)">${motion}${inner}</g></svg>`;
    switch (item.art) {
        case 'heart': return base('<path d="M0 112C-120 40-164-18-132-76C-103-129-32-116 0-68C32-116 103-129 132-76C164-18 120 40 0 112Z" fill="#fb7185"/><path d="M-76 10H-38L-16-35L18 50L43 0H82" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>','#301018','#13080d');
        case 'lol': return base('<circle r="132" fill="#facc15"/><path d="M-78-22Q-48-55-18-22M18-22Q48-55 78-22" fill="none" stroke="#3f2b00" stroke-width="15" stroke-linecap="round"/><path d="M-82 26Q0 112 82 26" fill="#fff" stroke="#3f2b00" stroke-width="13"/><path d="M-108 12Q-138 42-120 70" fill="none" stroke="#67e8f9" stroke-width="12" stroke-linecap="round"/>','#2a2108','#120f05');
        case 'wow': return base('<circle r="132" fill="#fde68a"/><circle cx="-48" cy="-28" r="15" fill="#422006"/><circle cx="48" cy="-28" r="15" fill="#422006"/><ellipse cy="52" rx="42" ry="56" fill="#7c2d12"/>','#2b1d0d','#130c06');
        case 'gg': return base('<rect x="-142" y="-86" width="284" height="172" rx="42" fill="#111827" stroke="#67e8f9" stroke-width="7"/><text x="0" y="24" text-anchor="middle" font-family="system-ui,sans-serif" font-size="92" font-weight="900" fill="#f8fafc">GG</text><circle cx="-112" cy="-55" r="8" fill="#a78bfa"><animate attributeName="opacity" values=".2;1;.2" dur="1.2s" repeatCount="indefinite"/></circle>','#071a23','#090713');
        case 'ok': return base('<circle r="130" fill="#101827" stroke="#86efac" stroke-width="8"/><path d="M-62 2L-12 52L76-48" fill="none" stroke="#86efac" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>','#07140d','#07100b');
        case 'brb': return base('<rect x="-150" y="-92" width="300" height="184" rx="38" fill="#fafaf9"/><text x="0" y="25" text-anchor="middle" font-family="monospace" font-size="86" font-weight="900" fill="#18181b">BRB</text>','#292524','#0c0a09');
        case 'focus': return base('<circle r="126" fill="none" stroke="#67e8f9" stroke-width="5" stroke-dasharray="22 13"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2.2s" repeatCount="indefinite"/></circle><circle r="86" fill="none" stroke="#a78bfa" stroke-width="9"/><circle r="18" fill="#fff"/>','#07151d','#0e081a');
        case 'sakura-hi': return base(`${petal}<g transform="translate(-88 -66) rotate(-25) scale(.8)">${petal}</g><g transform="translate(94 54) rotate(28) scale(.7)">${petal}</g><text x="0" y="28" text-anchor="middle" font-family="system-ui,sans-serif" font-size="74" font-weight="900" fill="#fff">HI!</text>`,'#341426','#120912');
        case 'sakura-bloom': return base(`<path d="M-150 105Q-45 22 118-116" fill="none" stroke="#8b5e3c" stroke-width="13" stroke-linecap="round"/><g transform="translate(-95 66)">${petal}</g><g transform="translate(-20 18) scale(.8)">${petal}</g><g transform="translate(58 -42) scale(.9)">${petal}</g><g transform="translate(118 -112) scale(.72)">${petal}</g><circle cx="0" cy="0" r="5" fill="#fde68a"/>`,'#2d1323','#110810');
        case 'sakura-thanks': return base(`<g transform="translate(-96 -58) scale(.7)">${petal}</g><g transform="translate(104 72) scale(.65)">${petal}</g><text x="0" y="-8" text-anchor="middle" font-family="Georgia,serif" font-size="58" font-style="italic" fill="#fff">thank</text><text x="0" y="58" text-anchor="middle" font-family="Georgia,serif" font-size="58" font-style="italic" fill="#f9a8d4">you</text>`,'#311323','#110810');
        case 'spark': return base('<path d="M0-132L22-30L116-72L42 0L126 40L26 30L0 132L-24 31L-121 74L-43 1L-128-40L-25-29Z" fill="#f8fafc"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2s" repeatCount="indefinite"/></path><circle r="28" fill="#67e8f9"/>','#08202a','#0c0716');
        case 'approved': return base('<rect x="-148" y="-78" width="296" height="156" rx="18" fill="#f5f5f4" transform="rotate(-6)"/><text x="0" y="20" text-anchor="middle" font-family="monospace" font-size="54" font-weight="900" fill="#15803d" transform="rotate(-6)">APPROVED</text><rect x="-118" y="-50" width="236" height="100" rx="12" fill="none" stroke="#15803d" stroke-width="8" transform="rotate(-6)"/>','#1c1917','#0c0a09');
        default: return base('<circle r="110" fill="#a78bfa"/>');
    }
}

module.exports = { registerStickerRoutes, getStickerPublic, markStickerUsed, cleanupStickersAccount, MAX_DURATION_MS };
