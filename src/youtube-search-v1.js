const path = require('path');
const { spawn } = require('child_process');
const S = require('./store');
const C = require('./config');

const YTDLP_PATH = process.env.YTDLP_PATH || path.join(C.ROOT, 'bin', 'yt-dlp');
const SEARCH_LIMIT = 10;
const REQUESTS_PER_MINUTE = Math.max(2, Math.min(30, Number.parseInt(process.env.YOUTUBE_SEARCH_RATE_LIMIT_PER_MINUTE || '12', 10) || 12));
const buckets = new Map();

function registerYouTubeSearchRoutes(app) {
  app.get('/api/youtube/search', requireSession, requestLimiter, async (req, res, next) => {
    try {
      const query = normalizeSearchQuery(req.query?.q);
      const results = await searchYouTube(query);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({ ok: true, query, count: results.length, results });
    } catch (error) {
      return next(error);
    }
  });
}

function normalizeSearchQuery(value) {
  const query = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (query.length < 2) throw clientError('Digite pelo menos 2 caracteres para pesquisar.', 400);
  if (query.length > 160) throw clientError('A pesquisa é longa demais.', 400);
  return query;
}

async function searchYouTube(query) {
  const args = [
    '--no-config', '--no-playlist', '--skip-download', '--dump-single-json', '--no-warnings',
    '--ignore-errors', '--socket-timeout', '15', '--extractor-retries', '2', '--fragment-retries', '2',
    `ytsearch${SEARCH_LIMIT}:${query}`
  ];
  const payload = await runYtDlpJson(args);
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  return entries.slice(0, SEARCH_LIMIT).map(mapSearchResult).filter(Boolean);
}

function mapSearchResult(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const videoId = extractVideoId(entry);
  if (!videoId) return null;
  const canonicalUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const thumbnails = Array.isArray(entry.thumbnails) ? entry.thumbnails : [];
  const thumbnail = safeHttpUrl(entry.thumbnail) || safeHttpUrl(thumbnails[thumbnails.length - 1]?.url) || '';
  const duration = Math.max(0, Number(entry.duration || 0) || 0);
  const viewCount = Math.max(0, Number(entry.view_count || 0) || 0);
  const likeCount = Math.max(0, Number(entry.like_count || 0) || 0);
  const commentCount = Math.max(0, Number(entry.comment_count || 0) || 0);
  const ageLimit = Math.max(0, Number(entry.age_limit || 0) || 0);
  const liveStatus = cleanText(entry.live_status || '', 40);
  const isLive = Boolean(entry.is_live || liveStatus === 'is_live');
  const availability = cleanText(entry.availability || '', 40);
  const restriction = downloadRestriction({ ageLimit, isLive, availability });

  return {
    id: videoId,
    videoId,
    title: cleanText(entry.title || entry.fulltitle || 'Vídeo do YouTube', 240),
    uploader: cleanText(entry.uploader || entry.channel || entry.creator || '', 160),
    channel: cleanText(entry.channel || entry.uploader || '', 160),
    channelId: cleanText(entry.channel_id || entry.uploader_id || '', 80),
    duration,
    durationText: formatDuration(duration),
    viewCount,
    viewsText: formatCompactNumber(viewCount),
    likeCount,
    commentCount,
    uploadDate: normalizeUploadDate(entry.upload_date || entry.release_date),
    thumbnail,
    url: canonicalUrl,
    canonicalUrl,
    liveStatus,
    isLive,
    availability,
    ageLimit,
    downloadable: !restriction,
    availabilityUncertain: availability === 'needs_auth',
    unavailableReason: restriction,
    description: cleanText(entry.description || '', 360)
  };
}

function extractVideoId(entry) {
  const direct = String(entry?.id || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(direct)) return direct;

  const candidates = [entry?.webpage_url, entry?.original_url, entry?.url];
  for (const candidate of candidates) {
    const raw = String(candidate || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    if (!raw) continue;
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
      let id = '';
      if (host === 'youtu.be') {
        id = url.pathname.split('/').filter(Boolean)[0] || '';
      } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
        else {
          const parts = url.pathname.split('/').filter(Boolean);
          if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) id = parts[1] || '';
        }
      }
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    } catch {}
  }
  return '';
}

function downloadRestriction({ ageLimit, isLive, availability }) {
  if (Number(ageLimit || 0) >= 18) return 'Vídeo com restrição de idade não é compatível com o downloader.';
  if (isLive) return 'Lives em andamento não são compatíveis com o downloader.';
  const value = String(availability || '');
  if (value === 'private') return 'Vídeo privado.';
  if (value === 'premium_only') return 'Conteúdo Premium não é compatível com o downloader.';
  if (value === 'subscriber_only') return 'Conteúdo exclusivo para inscritos não é compatível com o downloader.';
  // `needs_auth` em resultados de ytsearch pode ser metadado incompleto/temporário.
  // Não bloqueie cedo: o downloader fará a inspeção completa e continua sendo a
  // autoridade final para conteúdo que realmente exija autenticação.
  return '';
}

function runYtDlpJson(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_PATH, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let settled = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        timedOut = true;
        child.kill('SIGKILL');
      }
    }, 50000);

    child.stdout.on('data', chunk => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > 16 * 1024 * 1024) return child.kill('SIGKILL');
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', chunk => {
      if (stderr.length < 12000) stderr += chunk.toString('utf8');
    });
    child.on('error', error => finish(() => reject(clientError(`Não foi possível iniciar o yt-dlp: ${error.message}`, 502))));
    child.on('close', code => finish(() => {
      if (timedOut) return reject(clientError('A pesquisa no YouTube demorou demais. Tente novamente.', 504));
      if (code !== 0 && !stdout.trim()) return reject(clientError(cleanYtDlpError(stderr), 422));
      try { return resolve(JSON.parse(stdout)); }
      catch { return reject(clientError('O yt-dlp retornou uma resposta de busca inválida.', 502)); }
    }));

    function finish(fn) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    }
  });
}

function cleanYtDlpError(value) {
  const text = cleanText(value, 1000);
  if (/sign in to confirm you.?re not a bot|not a bot/i.test(text)) return 'O YouTube bloqueou temporariamente a pesquisa automática deste servidor.';
  if (/network|timed out|timeout|connection/i.test(text)) return 'A pesquisa no YouTube falhou por conexão. Tente novamente.';
  return 'O yt-dlp não conseguiu pesquisar no YouTube agora.';
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch { return ''; }
}

function normalizeUploadDate(value) {
  const raw = String(value || '').replace(/\D/g, '');
  if (raw.length !== 8) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatCompactNumber(value) {
  const number = Math.max(0, Number(value || 0) || 0);
  try { return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(number); }
  catch { return String(Math.round(number)); }
}

function cleanText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
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

function requestLimiter(req, res, next) {
  const key = req.account?.id || req.ip || 'anonymous';
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + 60000 };
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > REQUESTS_PER_MINUTE) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({ ok: false, error: 'Muitas pesquisas no YouTube. Tente novamente em instantes.' });
  }
  return next();
}

function clientError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  registerYouTubeSearchRoutes,
  normalizeSearchQuery,
  mapSearchResult,
  extractVideoId,
  downloadRestriction,
  formatDuration,
  formatCompactNumber
};
