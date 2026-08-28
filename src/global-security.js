const express = require('express');
const cors = require('cors');
const C = require('./config');

function installGlobalSecurity(app) {
  app.disable('x-powered-by');
  if (C.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || C.CORS_ORIGINS.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','x-api-key','Authorization']
  }));

  // Serve public UI assets before any general-purpose rate limiter. Previously
  // every CSS/JS/font/image request consumed the same request budget as API calls.
  const earlyStatic = express.static(C.PUBLIC_DIR, {
    index:false,
    dotfiles:'deny',
    etag:true,
    maxAge:C.IS_PRODUCTION ? '1h' : 0
  });
  app.use((req,res,next) => {
    if (req.path.startsWith('/uploads/') || req.path.startsWith('/generated/') || req.path.startsWith('/profile-media/')) return next();
    return earlyStatic(req,res,next);
  });

  // Keep legacy query-key support only for the documented direct image link.
  app.use((req, res, next) => {
    if (!req.query || !Object.prototype.hasOwnProperty.call(req.query, 'apikey')) return next();
    const directCardLink = req.method === 'GET' && req.path === '/generate-card';
    if (directCardLink) {
      res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('Cache-Control','no-store');
      return next();
    }
    delete req.query.apikey;
    return next();
  });

  app.use(express.json({ limit:'256kb' }));
  app.use(express.urlencoded({ limit:'256kb', extended:true }));

  app.use((req, res, next) => {
    if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
    const origin = String(req.get('origin') || '').trim();
    if (!origin) return next();
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin === ownOrigin || C.CORS_ORIGINS.has(origin)) return next();
    return res.status(403).json({ ok:false, error:'Origem não permitida.' });
  });

  // Outer safety net only for API/processing traffic. Normal page navigation and
  // static assets do not belong in this bucket. Sensitive routes still keep their
  // own stricter limiters inside their modules.
  app.use(createRateLimiter({
    windowMs:60000,
    max:1200,
    skip:req => !isRateLimitedTraffic(req)
  }));
}

function isRateLimitedTraffic(req) {
  const p = String(req.path || '');
  return p.startsWith('/api/') || p === '/generate-card' || p === '/painel/gerar';
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','same-origin');
  // Realtime media stays first-party only. Browser permission prompts are still
  // required for microphone, camera and display capture.
  res.setHeader('Permissions-Policy','camera=(self), microphone=(self), display-capture=(self), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self'",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; '));
  if (C.IS_PRODUCTION) res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  next();
}

function createRateLimiter({ windowMs, max, skip = null }) {
  const buckets = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, Math.max(windowMs, 60000));
  timer.unref?.();

  return (req, res, next) => {
    if (skip?.(req)) return next();
    const now = Date.now();
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count:0, resetAt:now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0,max-bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt/1000)));
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ ok:false, error:'Muitas requisições. Tente novamente em instantes.' });
    }
    next();
  };
}

module.exports = { installGlobalSecurity };
