const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const C = require('./config');
const S = require('./store');

const MUSIC_DIR = path.join(C.DATA_DIR, 'music');
const MUSIC_FILE = path.join(C.DATA_DIR, 'music-library.json');
const MAX_MUSIC_MB = 30;

function registerMusicRoutes(app) {
    ensureStorage();
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_MUSIC_MB * 1024 * 1024, files: 1, fields: 8 } });
    const json = express.json({ limit: '64kb' });

    app.get('/api/music/library', (req, res) => {
        const tracks = loadLibrary().filter(track => track.enabled !== false).map(publicTrack);
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, tracks, builtIn: { id: 'lofi-radio', title: 'SkyNet Lo-fi Radio', artist: 'Gerado localmente' } });
    });

    app.get('/api/admin/music', requireAdmin, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, tracks: loadLibrary().map(publicTrack) });
    });

    app.post('/api/admin/music', requireTrustedOrigin, requireAdmin, upload.single('file'), (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ ok: false, error: 'Selecione um arquivo de áudio.' });
            const detected = detectAudio(req.file.buffer);
            if (!detected) return res.status(400).json({ ok: false, error: 'Formato não suportado. Use MP3, OGG ou WAV.' });
            const title = cleanText(req.body?.title, 80) || cleanText(path.parse(req.file.originalname || '').name, 80) || 'Faixa sem título';
            const artist = cleanText(req.body?.artist, 80) || 'Biblioteca SkyNetApi';
            const id = crypto.randomBytes(16).toString('hex');
            const filename = `${id}.${detected.extension}`;
            fs.writeFileSync(path.join(MUSIC_DIR, filename), req.file.buffer, { mode: 0o600 });
            const library = loadLibrary();
            const track = { id, title, artist, filename, mime: detected.mime, size: req.file.buffer.length, enabled: true, createdAt: new Date().toISOString() };
            library.push(track);
            saveLibrary(library);
            return res.status(201).json({ ok: true, track: publicTrack(track) });
        } catch (error) { return next(error); }
    });

    app.patch('/api/admin/music/:id', json, requireTrustedOrigin, requireAdmin, (req, res) => {
        const library = loadLibrary();
        const track = library.find(item => item.id === req.params.id);
        if (!track) return res.status(404).json({ ok: false, error: 'Faixa não encontrada.' });
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) track.title = cleanText(req.body.title, 80) || track.title;
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'artist')) track.artist = cleanText(req.body.artist, 80) || track.artist;
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'enabled')) track.enabled = Boolean(req.body.enabled);
        saveLibrary(library);
        return res.json({ ok: true, track: publicTrack(track) });
    });

    app.delete('/api/admin/music/:id', requireTrustedOrigin, requireAdmin, (req, res) => {
        const library = loadLibrary();
        const index = library.findIndex(item => item.id === req.params.id);
        if (index === -1) return res.status(404).json({ ok: false, error: 'Faixa não encontrada.' });
        const [track] = library.splice(index, 1);
        const file = path.join(MUSIC_DIR, path.basename(track.filename || ''));
        try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
        saveLibrary(library);
        return res.json({ ok: true });
    });

    app.get('/music/audio/:id', (req, res) => {
        const track = loadLibrary().find(item => item.id === req.params.id && item.enabled !== false);
        if (!track) return res.status(404).end();
        const file = path.join(MUSIC_DIR, path.basename(track.filename));
        if (!fs.existsSync(file)) return res.status(404).end();
        const stat = fs.statSync(file);
        const range = req.headers.range;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', track.mime || 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        if (!range) {
            res.setHeader('Content-Length', stat.size);
            return fs.createReadStream(file).pipe(res);
        }
        const match = /^bytes=(\d*)-(\d*)$/.exec(String(range));
        if (!match) return res.status(416).end();
        let start = match[1] ? Number(match[1]) : 0;
        let end = match[2] ? Number(match[2]) : stat.size - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= stat.size) return res.status(416).end();
        end = Math.min(end, stat.size - 1);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        res.setHeader('Content-Length', end - start + 1);
        return fs.createReadStream(file, { start, end }).pipe(res);
    });
}

function ensureStorage() {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    if (!fs.existsSync(MUSIC_FILE)) fs.writeFileSync(MUSIC_FILE, '[]', { mode: 0o600 });
}
function loadLibrary() {
    ensureStorage();
    try { const data = JSON.parse(fs.readFileSync(MUSIC_FILE, 'utf8')); return Array.isArray(data) ? data : []; }
    catch { return []; }
}
function saveLibrary(data) {
    ensureStorage();
    const temp = `${MUSIC_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, MUSIC_FILE);
}
function publicTrack(track) {
    return { id: track.id, title: track.title, artist: track.artist, mime: track.mime, size: Number(track.size || 0), enabled: track.enabled !== false, createdAt: track.createdAt, url: `/music/audio/${encodeURIComponent(track.id)}` };
}
function detectAudio(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
    if (buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return { extension: 'mp3', mime: 'audio/mpeg' };
    if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return { extension: 'ogg', mime: 'audio/ogg' };
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return { extension: 'wav', mime: 'audio/wav' };
    return null;
}
function parseCookies(header) {
    const out = {};
    for (const part of String(header || '').split(';')) {
        const index = part.indexOf('='); if (index < 0) continue;
        const key = part.slice(0, index).trim(); const value = part.slice(index + 1).trim();
        try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    }
    return out;
}
function requireAdmin(req, res, next) {
    try {
        const token = parseCookies(req.headers.cookie).skynet_session || '';
        const session = token ? S.getSession(token) : null;
        const account = session ? S.loadAccounts().find(item => item.id === session.accountId && item.active) : null;
        if (!account) return res.status(401).json({ ok: false, error: 'Não autorizado.' });
        if (!account.isAdmin) return res.status(403).json({ ok: false, error: 'Acesso administrativo necessário.' });
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
function cleanText(value, max) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

module.exports = { registerMusicRoutes };
