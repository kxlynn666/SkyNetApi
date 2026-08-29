const fs = require('fs');
const path = require('path');
const axios = require('axios');
const C = require('./config');
const S = require('./store');

const SOURCES = [
  { name: 'Eurogamer Portugal', url: 'https://www.eurogamer.pt/roblox-codigos-de-volleyball-legends', priority: 1 },
  { name: 'Twinfinite', url: 'https://twinfinite.net/roblox/haikyuu-legends-codes/', priority: 2 }
];
const CACHE_FILE = path.join(C.DATA_DIR, 'roblox-codes-volleyball-legends.json');
const CACHE_TTL_MS = 15 * 60 * 1000;
const MIN_REFRESH_MS = 60 * 1000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
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
    const settled = await Promise.allSettled(SOURCES.map(fetchSource));
    const successful = settled
      .filter(item => item.status === 'fulfilled' && item.value?.parsed?.codes?.length)
      .map(item => item.value)
      .sort(compareSourceFreshness);

    if (!successful.length) throw new Error('Nenhuma fonte retornou uma lista reconhecível de códigos.');

    const codes = mergeSourceCodes(successful);
    if (!codes.length) throw new Error('Nenhum código reconhecido nas fontes.');

    const freshest = successful[0];
    const record = {
      game: 'Volleyball Legends',
      source: { name: freshest.source.name, url: freshest.source.url },
      sources: successful.map(item => ({
        name: item.source.name,
        url: item.source.url,
        updatedAt: item.parsed.sourceUpdatedAt || null,
        parser: item.parsed.parser
      })),
      fetchedAt: new Date().toISOString(),
      sourceUpdatedAt: freshest.parsed.sourceUpdatedAt || null,
      codes,
      activeCount: codes.filter(code => code.status === 'active').length,
      expiredCount: codes.filter(code => code.status === 'expired').length,
      totalCount: codes.length,
      parser: successful.map(item => `${item.source.name}:${item.parsed.parser}`).join(', ')
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
        warning: 'As fontes não responderam agora; exibindo o último resultado válido salvo pelo servidor.'
      };
    }
    throw clientError('Não foi possível consultar os códigos agora. Tente novamente mais tarde.', 502);
  }
}

async function fetchSource(source) {
  const response = await axios.get(source.url, {
    timeout: 12000,
    maxRedirects: 3,
    maxContentLength: MAX_HTML_BYTES,
    responseType: 'text',
    validateStatus: status => status >= 200 && status < 400,
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
      'User-Agent': 'SkyNetApi-RobloxCodes/2.0'
    }
  });
  const html = String(response.data || '');
  if (!html || Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new Error(`Resposta inválida de ${source.name}.`);
  const parsed = parseCodesPage(html);
  if (!parsed.codes.length) throw new Error(`Nenhum código reconhecido em ${source.name}.`);
  return { source, parsed };
}

function compareSourceFreshness(a, b) {
  const aTime = safeDateMs(a.parsed.sourceUpdatedAt);
  const bTime = safeDateMs(b.parsed.sourceUpdatedAt);
  if (aTime !== bTime) return bTime - aTime;
  return Number(a.source.priority || 99) - Number(b.source.priority || 99);
}

function mergeSourceCodes(results) {
  const found = new Map();
  for (const result of results) {
    for (const item of result.parsed.codes) {
      const key = normalizeCodeKey(item.code);
      if (!key) continue;
      const existing = found.get(key);
      if (!existing) {
        found.set(key, {
          code: item.code,
          reward: item.reward || '',
          status: item.status === 'expired' ? 'expired' : 'active',
          verifiedBy: [result.source.name]
        });
        continue;
      }
      if (!existing.reward && item.reward) existing.reward = item.reward;
      if (!existing.verifiedBy.includes(result.source.name)) existing.verifiedBy.push(result.source.name);
    }
  }
  return [...found.values()];
}

function parseEurogamerPage(html) {
  return parseCodesPage(html);
}

function parseCodesPage(html) {
  const structured = extractStructuredArticle(html);
  const htmlText = htmlToText(html);
  const candidates = [];
  if (structured.articleBody) candidates.push({ text: structured.articleBody, parser: 'json-ld' });
  if (htmlText) candidates.push({ text: htmlText, parser: structured.articleBody ? 'json-ld+html' : 'html-text' });

  let best = { codes: [], parser: 'html-text' };
  for (const candidate of candidates) {
    const codes = parseCodesFromText(candidate.text);
    if (codes.length > best.codes.length) best = { codes, parser: candidate.parser };
  }

  return {
    codes: best.codes,
    sourceUpdatedAt: structured.dateModified || structured.datePublished || null,
    parser: best.parser
  };
}

function extractStructuredArticle(html) {
  const output = { articleBody: '', dateModified: '', datePublished: '' };
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      const raw = String(match[1] || '').trim();
      const value = JSON.parse(raw);
      walkJson(value, node => {
        if (!node || typeof node !== 'object') return;
        const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
        if (!/Article|NewsArticle|BlogPosting/i.test(type)) return;
        if (!output.articleBody && typeof node.articleBody === 'string') output.articleBody = decodeHtmlEntities(node.articleBody);
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
    .replace(/<\/(?:p|li|ul|ol|h1|h2|h3|h4|h5|h6|tr|div|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, ''));
}

function parseCodesFromText(text) {
  const marked = markSectionHeadings(String(text || ''))
    .replace(/[•●▪◦]/g, '\n')
    .replace(/\s+\|\s+/g, '\n');
  const lines = marked
    .split(/\n+/)
    .map(line => cleanLine(line))
    .filter(Boolean);

  const found = new Map();
  let section = 'unknown';

  for (const line of lines) {
    if (line === '@@ACTIVE@@') { section = 'active'; continue; }
    if (line === '@@EXPIRED@@') { section = 'expired'; continue; }
    if (isSectionStop(line)) { section = 'unknown'; continue; }
    if (section === 'unknown') continue;

    const candidates = extractCodeCandidates(line);
    for (const code of candidates) {
      const key = normalizeCodeKey(code);
      if (!key) continue;
      const reward = section === 'active' ? cleanReward(line, code) : '';
      const existing = found.get(key);
      const next = { code, reward, status: section };
      if (!existing || section === 'expired' || existing.status !== 'expired') {
        found.set(key, next);
      }
    }
  }

  return [...found.values()].slice(0, 300);
}

function markSectionHeadings(value) {
  let text = String(value || '');
  const activePatterns = [
    /c[oó]digos?\s+(?:ativos?|v[aá]lidos?|funcionando|novos?)(?:\s+(?:de|do)\s+volleyball\s+legends)?/gi,
    /c[oó]digos?\s+(?:de|do)\s+volleyball\s+legends\s+(?:ativos?|v[aá]lidos?|funcionando|novos?)/gi,
    /(?:all\s+)?(?:new|active|working)\s+volleyball\s+legends\s+codes(?:\s+list)?/gi,
    /volleyball\s+legends\s+(?:active|working)\s+codes/gi,
    /(?:active|working)\s+codes/gi
  ];
  const expiredPatterns = [
    /c[oó]digos?\s+(?:expirados?|caducados?|inativos?)(?:\s+(?:de|do)\s+volleyball\s+legends)?/gi,
    /c[oó]digos?\s+(?:de|do)\s+volleyball\s+legends\s+(?:expirados?|caducados?|inativos?)/gi,
    /c[oó]digos?\s+que\s+j[aá]\s+n[aã]o\s+funcionam/gi,
    /expired\s+volleyball\s+legends\s+codes/gi,
    /volleyball\s+legends\s+expired\s+codes/gi,
    /expired\s+codes/gi
  ];
  for (const pattern of activePatterns) text = text.replace(pattern, '\n@@ACTIVE@@\n');
  for (const pattern of expiredPatterns) text = text.replace(pattern, '\n@@EXPIRED@@\n');
  return text;
}

function isSectionStop(line) {
  return /^(?:como\s+(?:resgatar|usar)|onde\s+resgatar|how\s+to\s+redeem|how\s+to\s+use|where\s+to\s+redeem|what\s+are\s+codes|why\s+is\s+my\s+code)/i.test(line);
}

function extractCodeCandidates(line) {
  const found = [];
  const spaced = line.match(/\b[A-Z0-9]{2,16}\s+[A-Z0-9]{2,16}\b/g) || [];
  for (const item of spaced) if (looksLikeGameCode(item)) found.push(item);

  const tokens = line.match(/\b[A-Za-z0-9][A-Za-z0-9_-]{3,39}\b/g) || [];
  for (const item of tokens) {
    if (!looksLikeGameCode(item)) continue;
    if (found.some(spacedCode => spacedCode.split(/\s+/).includes(item))) continue;
    found.push(item);
  }
  return [...new Set(found)];
}

function looksLikeGameCode(code) {
  const value = String(code || '').trim();
  if (!value || value.length > 40) return false;

  const blocked = new Set([
    'ROBLOX','VOLLEYBALL','LEGENDS','EUROGAMER','TWINFINITE','PORTUGAL','CODES','CODE','UPDATE','SHOP','DISCORD','TWITTER','YOUTUBE','FACEBOOK','INSTAGRAM','TIKTOK','REDDIT','COOKIE','PRIVACY','MENU','LOGIN','ARTICLE','JSON','HTML','HTTP','HTTPS','ACTIVE','WORKING','EXPIRED','NEW','REDEEM','LUCKY','STYLE','ABILITY','SPIN','SPINS','REWARD','REWARDS','FREE','CLAIM','QUEST'
  ]);

  if (value.includes(' ')) {
    if (!/^[A-Z0-9]{2,16}\s+[A-Z0-9]{2,16}$/.test(value)) return false;
    if (['VOLLEYBALL LEGENDS','LUCKY STYLE','LUCKY ABILITY','ACTIVE CODES','WORKING CODES','EXPIRED CODES'].includes(value)) return false;
    return value === 'FREE CLAIM' || value === 'FREE QUEST' || value.split(/\s+/).some(part => /\d/.test(part));
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{3,39}$/.test(value)) return false;
  if (blocked.has(value.toUpperCase())) return false;
  if (/^\d+$/.test(value)) return false;
  if (/[_-]/.test(value) || /\d/.test(value)) return true;
  return value === value.toUpperCase() && value.length >= 5;
}

function cleanReward(line, code) {
  const index = line.indexOf(code);
  if (index < 0) return '';
  let reward = line.slice(index + code.length)
    .replace(/^[\s:–—-]+/, '')
    .replace(/\((?:new|novo|nova)!?\)/gi, '')
    .replace(/\b(?:new|novo|nova)!?$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (reward.length > 180) reward = `${reward.slice(0, 177)}...`;
  return reward;
}

function normalizeCodeKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
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

function safeDateMs(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
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
  parseCodesPage,
  parseCodesFromText,
  extractStructuredArticle,
  htmlToText,
  mergeSourceCodes,
  markSectionHeadings
};
