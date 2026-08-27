const S = require('./store');

const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_MESSAGES = 60;

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0,index).trim();
    const raw = part.slice(index + 1).trim();
    try { out[key] = decodeURIComponent(raw); } catch { out[key] = raw; }
  }
  return out;
}

function accountKey(req) {
  try {
    const token = parseCookies(req.headers.cookie).skynet_session || '';
    const session = token ? S.getSession(token) : null;
    if (session?.accountId) return `account:${session.accountId}`;
  } catch {}
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

function registerGroupMessageLimiterV2(app) {
  app.use('/api/community/groups', (req,res,next) => {
    if (req.method !== 'POST' || !/^\/[^/]+\/messages\/?$/.test(req.path)) return next();
    const now = Date.now();
    const key = accountKey(req);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count:0, resetAt:now + WINDOW_MS };
    bucket.count += 1;
    buckets.set(key,bucket);
    res.setHeader('RateLimit-Limit',String(MAX_MESSAGES));
    res.setHeader('RateLimit-Remaining',String(Math.max(0,MAX_MESSAGES-bucket.count)));
    if (bucket.count > MAX_MESSAGES) {
      res.setHeader('Retry-After',String(Math.max(1,Math.ceil((bucket.resetAt-now)/1000))));
      return res.status(429).json({ok:false,error:'Você está enviando mensagens rápido demais. Aguarde alguns segundos.'});
    }
    return next();
  });
}

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key,bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
},WINDOW_MS);
cleanup.unref?.();

module.exports = { registerGroupMessageLimiterV2 };
