const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');

const THEME_FILE = path.join(C.DATA_DIR, 'profile-themes.json');
const PRESETS = new Set(['violet','mono','cyan','emerald','rose','gold','custom']);

function registerProfileThemeRoutes(app) {
  ensureStorage();
  app.use('/api/profile-theme', express.json({ limit:'32kb' }));

  app.get('/api/profile-theme/me', requireSession, (req,res) => {
    return res.json({ ok:true, theme:getTheme(req.account.id) });
  });

  app.patch('/api/profile-theme/me', requireTrustedOrigin, requireSession, (req,res) => {
    const current = getTheme(req.account.id);
    const theme = sanitizeTheme(req.body || {}, current);
    saveTheme(req.account.id, theme);
    return res.json({ ok:true, theme });
  });

  app.get('/api/profile-theme/:username', (req,res) => {
    const normalized = S.normalizeUsername(req.params.username || '');
    const account = S.loadAccounts().find(item => item.active && S.normalizeUsername(item.usernameLower || item.username) === normalized);
    if (!account) return res.status(404).json({ ok:false, error:'Perfil não encontrado.' });
    return res.json({ ok:true, theme:getTheme(account.id) });
  });
}

function getTheme(accountId) {
  const found = loadThemes().find(item => item.accountId === accountId);
  return sanitizeTheme(found || {}, { preset:'violet', accent:'#a855f7' });
}

function sanitizeTheme(input, fallback) {
  const presetRaw = String(input?.preset || fallback?.preset || 'violet').trim().toLowerCase();
  const preset = PRESETS.has(presetRaw) ? presetRaw : 'violet';
  const accentRaw = String(input?.accent || fallback?.accent || presetAccent(preset)).trim();
  const accent = /^#[0-9a-f]{6}$/i.test(accentRaw) ? accentRaw.toLowerCase() : presetAccent(preset);
  return { preset, accent };
}

function presetAccent(preset) {
  return ({ violet:'#a855f7', mono:'#ffffff', cyan:'#22d3ee', emerald:'#34d399', rose:'#fb7185', gold:'#facc15', custom:'#a855f7' })[preset] || '#a855f7';
}

function cleanupProfileThemeAccount(accountId) {
  writeJsonAtomic(THEME_FILE, loadThemes().filter(item => item.accountId !== accountId));
}

function ensureStorage() {
  fs.mkdirSync(C.DATA_DIR, { recursive:true });
  if (!fs.existsSync(THEME_FILE)) writeJsonAtomic(THEME_FILE, []);
}

function loadThemes() {
  ensureStorage();
  try {
    const value = JSON.parse(fs.readFileSync(THEME_FILE, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function saveTheme(accountId, theme) {
  const all = loadThemes();
  const record = { accountId, ...theme, updatedAt:new Date().toISOString() };
  const index = all.findIndex(item => item.accountId === accountId);
  if (index < 0) all.push(record); else all[index] = record;
  writeJsonAtomic(THEME_FILE, all);
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode:0o600 });
  fs.renameSync(temp, file);
}

function requireSession(req,res,next) {
  try {
    const token = parseCookies(req.headers.cookie || '').skynet_session || '';
    const session = token ? S.getSession(token) : null;
    const account = session ? S.loadAccounts().find(item => item.id === session.accountId && item.active) : null;
    if (!account) return res.status(401).json({ ok:false, error:'Não autorizado.' });
    req.account = account;
    return next();
  } catch (error) { return next(error); }
}

function requireTrustedOrigin(req,res,next) {
  const origin = String(req.get('origin') || '').trim();
  if (!origin) return next();
  const own = `${req.protocol}://${req.get('host')}`;
  if (origin === own || C.CORS_ORIGINS.has(origin)) return next();
  return res.status(403).json({ ok:false, error:'Origem não permitida.' });
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0,index).trim();
    const raw = part.slice(index+1).trim();
    try { out[key] = decodeURIComponent(raw); } catch { out[key] = raw; }
  }
  return out;
}

module.exports = { registerProfileThemeRoutes, cleanupProfileThemeAccount, getTheme };
