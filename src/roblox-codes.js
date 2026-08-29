const fs = require('fs');
const path = require('path');
const axios = require('axios');
const C = require('./config');
const S = require('./store');

const SOURCE_URL = 'https://www.eurogamer.pt/roblox-codigos-de-volleyball-legends';
const CACHE_FILE = path.join(C.DATA_DIR, 'roblox-codes-volleyball-legends.json');
const CACHE_TTL_MS = 15 * 60 * 1000;
const MIN_REFRESH_MS = 60 * 1000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
let memoryCache = null;
let inFlight = null;
let lastAttemptAt = 0;

function registerRobloxCodesRoutes(app) {
  app.get('/api/roblox-codes/volleyball-legends', requireSession, async (req, res, next) => {
    try {
      const force = String(req.query?.refresh || '') === '1';
      const data = await getCodes({ force });
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ ok: true, ...data });
    } catch (error) {
      return next(error);
    }
  });
}

async function getCodes({ force = false } = {}) {
  const now = Date.now();
  if (!memoryCache) memoryCache = readDiskCache();
  const cacheFresh = memoryCache?.fetchedAt && now - Date.parse(memoryCache.fetchedAt) < CACHE_TTL_MS;
  if (!force && cacheFresh) return { ...memoryCache, stale: false, cached: true };
  if (force && now - lastAttemptAt < MIN_REFRESH_MS && memoryCache) return { ...memoryCache, stale: false, cached: true };
  if (inFlight) return inFlight;

  lastAttemptAt = now;
  inFlight = refreshCodes().finally(() => { inFlight = null; });
  return inFlight;
}

async function refreshCodes() {
  try {
    const response = await axios.get(SOURCE_URL, {
      timeout: 12000,
      maxRedirects: 3,
      maxContentLength: MAX_HTML_BYTES,
      responseType: 'text',
      validateStatus: status => status >= 200 && status < 400,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5',
        'User-Agent': 'SkyNetApi-RobloxCodes/1.0'
      }
    });
    const html = String(response.data || '');
    if (!html || Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new Error('Resposta da fonte vazia ou grande demais.');
    const parsed = parseEurogamerPage(html);
    if (!parsed.codes.length) throw new Error('Nenhum código reconhecido na página da fonte.');

    const record = {
      game: 'Volleyball Legends',
      source: { name: 'Eurogamer Portugal', url: SOURCE_URL },
      fetchedAt: new Date().toISOString(),
      sourceUpdatedAt: parsed.sourceUpdatedAt || null,
      codes: parsed.codes,
      activeCount: parsed.codes.filter(code => code.status === 'active').length,
      expiredCount: parsed.codes.filter(code => code.status === 'expired').length,
      parser: parsed.parser
    };
    memoryCache = record;
    writeDiskCache(record);
    return { ...record, stale: false, cached: false };
  } catch (error) {
    if (!memoryCache) memoryCache = readDiskCache();
    if (memoryCache?.codes?.length) {
      return {
        ...memoryCache,
        stale: true,
        cached: true,
        warning: 'A fonte não respondeu agora; exibindo o último resultado válido salvo pelo servidor.'
      };
    }
    throw clientError('Não foi possível consultar os códigos da Eurogamer agora. Tente novamente mais tarde.', 502);
  }
}

function parseEurogamerPage(html) {
  const structured = extractStructuredArticle(html);
  const sourceText = structured.articleBody || htmlToText(html);
  const codes = parseCodesFromText(sourceText);
  return {
    codes,
    sourceUpdatedAt: structured.dateModified || structured.datePublished || null,
    parser: structured.articleBody ? 'json-ld' : 'html-text'
  };
}

function extractStructuredArticle(html) {
  const output = { articleBody: '', dateModified: '', datePublished: '' };
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      const value = JSON.parse(decodeHtmlEntities(match[1]).trim());
      walkJson(value, node => {
        if (!node || typeof node !== 'object') return;
        const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
        if (!/Article|NewsArticle|BlogPosting/i.test(type)) return;
        if (!output.articleBody && typeof node.articleBody === 'string') output.articleBody = node.articleBody;
        if (!output.dateModified && typeof node.dateModified === 'string') output.dateModified = node.dateModified;
        if (!output.datePublished && typeof node.datePublished === 'string') output.datePublished = node.datePublished;
      });
    } catch {}
  }
  return output;
}

function walkJson(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit);
    return;
  }
  for (const item of Object.values(value)) walkJson(item, visit);
}

function htmlToText(html) {
  return decodeHtmlEntities(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h1|h2|h3|h4|h5|h6|tr|div|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, ''));
}

function parseCodesFromText(text) {
  const lines = String(text || '')
    .split(/\n+/)
    .map(line => cleanLine(line))
    .filter(Boolean);
  const found = new Map();
  let section = 'unknown';
  let codeContext = 0;

  for (const line of lines) {
    if (/c[oó]digos?\s+(?:ativos?|v[aá]lidos?|funcionando|novos?)/i.test(line)) {
      section = 'active';
      codeContext = 30;
    } else if (/c[oó]digos?\s+(?:expirados?|caducados?|inativos?)|c[oó]digos?\s+que\s+j[aá]\s+n[aã]o\s+funcionam/i.test(line)) {
      section = 'expired';
      codeContext = 60;
    } else if (/como\s+(?:resgatar|usar)|onde\s+resgatar|como\s+obter/i.test(line)) {
      codeContext = 0;
      if (section === 'active') section = 'unknown';
    }

    const candidates = line.match(/\b[A-Z0-9][A-Z0-9_-]{3,39}\b/g) || [];
    for (const token of candidates) {
      const code = token.replace(/^[-_]+|[-_]+$/g, '');
      if (!looksLikeGameCode(code)) continue;
      if (section === 'unknown' && codeContext <= 0 && !/[0-9_]/.test(code)) continue;
      const reward = cleanReward(line, code);
      const status = section === 'expired' ? 'expired' : 'active';
      const existing = found.get(code);
      if (!existing || existing.status !== 'expired' || status === 'expired') {
        found.set(code, { code, reward, status });
      }
    }
    if (codeContext > 0) codeContext -= 1;
  }

  return [...found.values()]
    .filter(item => item.code.length <= 40)
    .slice(0, 120);
}

function looksLikeGameCode(code) {
  if (!/^[A-Z0-9][A-Z0-9_-]{3,39}$/.test(code)) return false;
  const blocked = new Set([
    'ROBLOX','VOLLEYBALL','LEGENDS','EUROGAMER','PORTUGAL','CODES','CODE','UPDATE','SHOP','DISCORD','TWITTER','YOUTUBE','FACEBOOK','INSTAGRAM','TIKTOK','REDDIT','COOKIE','PRIVACY','MENU','LOGIN','ARTICLE','JSON','HTML','HTTP','HTTPS'
  ]);
  if (blocked.has(code)) return false;
  if (/^\d+$/.test(code)) return false;
  return /[_0-9]/.test(code) || code.length >= 6;
}

function cleanReward(line, code) {
  const index = line.indexOf(code);
  if (index < 0) return '';
  let reward = line.slice(index + code.length)
    .replace(/^[\s:–—-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (reward.length > 180) reward = `${reward.slice(0, 177)}...`;
  return reward;
}

function cleanLine(value) {
  return decodeHtmlEntities(String(value || ''))
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—'
  };
  return String(value || '')
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => Object.prototype.hasOwnProperty.call(named, name.toLowerCase()) ? named[name.toLowerCase()] : all);
}

function safeCodePoint(value) {
  try { return Number.isFinite(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : ''; }
  catch { return ''; }
}

function readDiskCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    return Array.isArray(parsed?.codes) && parsed.codes.length ? parsed : null;
  } catch { return null; }
}

function writeDiskCache(data) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    const temp = `${CACHE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, CACHE_FILE);
  } catch (error) {
    console.error('Falha ao salvar cache de códigos Roblox:', error.message);
  }
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

function clientError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  registerRobloxCodesRoutes,
  parseEurogamerPage,
  parseCodesFromText,
  extractStructuredArticle,
  htmlToText
};
