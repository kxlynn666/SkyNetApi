const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');

const STUDIO_FILE = path.join(C.DATA_DIR, 'profile-studio.json');
const SECTION_IDS = ['identity', 'status', 'bio', 'links', 'stats', 'join'];

const DEFAULTS = Object.freeze({
  profileWidth: 980,
  bannerHeight: 248,
  avatarSize: 124,
  avatarOffset: -52,
  contentPadding: 28,
  sectionGap: 20,
  statsColumns: 6,
  surfaceRadius: 22,
  surfaceOpacity: 96,
  surfaceBlur: 12,
  borderWidth: 1,
  shadowStrength: 24,
  bannerOverlay: 46,
  avatarBorderWidth: 4,
  bannerSaturation: 100,
  bannerContrast: 100,
  hoverLift: 3,
  glowStrength: 10,
  gradientAngle: 145,
  nameSize: 32,
  bodySize: 14,
  letterSpacing: 0,
  pageBackground: '#090b10',
  surfaceColor: '#111722',
  surfaceAltColor: '#161d29',
  textColor: '#f4f7fb',
  mutedColor: '#9ca8b8',
  accentColor: '#7c9cff',
  accentSecondary: '#79d8ca',
  borderColor: '#273244',
  avatarBorderColor: '#0b0e14',
  gradientFrom: '#111827',
  gradientTo: '#0b1220',
  bannerTintColor: '#080b12',
  fontFamily: 'system',
  textAlign: 'left',
  avatarShape: 'rounded',
  buttonStyle: 'soft',
  badgeStyle: 'minimal',
  statsStyle: 'cards',
  linkStyle: 'buttons',
  motionLevel: 'system',
  backgroundMode: 'gradient',
  bannerFocus: 'center',
  nameWeight: '750',
  showHandle: true,
  showStatus: true,
  showBio: true,
  showLinks: true,
  showStats: true,
  showJoinDate: true,
  showLocation: true,
  showPronouns: true,
  showHeadline: true,
  showCosmetics: true,
  showActions: true,
  sectionOrder: SECTION_IDS
});

const DEFAULT_IDENTITY = Object.freeze({
  pronouns: '',
  location: '',
  website: '',
  links: []
});

const FIELD_DEFS = Object.freeze([
  group('layout', 'Layout', [
    numberField('profileWidth', 'Largura do perfil', 680, 1200, 10, 'px'),
    numberField('bannerHeight', 'Altura do banner', 140, 420, 4, 'px'),
    numberField('avatarSize', 'Tamanho do avatar', 72, 180, 2, 'px'),
    numberField('avatarOffset', 'Sobreposição do avatar', -96, 0, 2, 'px'),
    numberField('contentPadding', 'Margem interna', 12, 48, 2, 'px'),
    numberField('sectionGap', 'Espaço entre seções', 8, 40, 2, 'px'),
    numberField('statsColumns', 'Colunas de métricas', 2, 6, 1, '')
  ]),
  group('surface', 'Superfície', [
    numberField('surfaceRadius', 'Arredondamento', 0, 36, 1, 'px'),
    numberField('surfaceOpacity', 'Opacidade', 70, 100, 1, '%'),
    numberField('surfaceBlur', 'Blur', 0, 30, 1, 'px'),
    numberField('borderWidth', 'Espessura da borda', 0, 3, 1, 'px'),
    numberField('shadowStrength', 'Sombra', 0, 60, 1, '%'),
    numberField('glowStrength', 'Brilho do destaque', 0, 40, 1, '%'),
    numberField('hoverLift', 'Elevação no hover', 0, 12, 1, 'px')
  ]),
  group('colors', 'Cores', [
    colorField('pageBackground', 'Fundo da página'),
    colorField('surfaceColor', 'Superfície principal'),
    colorField('surfaceAltColor', 'Superfície secundária'),
    colorField('textColor', 'Texto principal'),
    colorField('mutedColor', 'Texto secundário'),
    colorField('accentColor', 'Destaque principal'),
    colorField('accentSecondary', 'Destaque secundário'),
    colorField('borderColor', 'Bordas'),
    colorField('avatarBorderColor', 'Borda do avatar'),
    colorField('bannerTintColor', 'Tint do banner')
  ]),
  group('background', 'Fundo e banner', [
    selectField('backgroundMode', 'Fundo', ['solid', 'gradient']),
    colorField('gradientFrom', 'Gradiente inicial'),
    colorField('gradientTo', 'Gradiente final'),
    numberField('gradientAngle', 'Ângulo do gradiente', 0, 360, 1, '°'),
    numberField('bannerOverlay', 'Escurecimento do banner', 0, 90, 1, '%'),
    numberField('bannerSaturation', 'Saturação do banner', 0, 160, 5, '%'),
    numberField('bannerContrast', 'Contraste do banner', 60, 140, 5, '%'),
    selectField('bannerFocus', 'Foco do banner', ['center', 'top', 'bottom', 'left', 'right'])
  ]),
  group('typography', 'Tipografia', [
    selectField('fontFamily', 'Família', ['system', 'rounded', 'mono', 'serif', 'display']),
    numberField('nameSize', 'Tamanho do nome', 20, 48, 1, 'px'),
    numberField('bodySize', 'Tamanho do texto', 12, 18, 1, 'px'),
    numberField('letterSpacing', 'Espaçamento das letras', -1, 3, 0.1, 'px'),
    selectField('nameWeight', 'Peso do nome', ['500', '600', '700', '750', '800', '900']),
    selectField('textAlign', 'Alinhamento', ['left', 'center'])
  ]),
  group('components', 'Componentes', [
    selectField('avatarShape', 'Formato do avatar', ['circle', 'rounded', 'squircle', 'square']),
    numberField('avatarBorderWidth', 'Borda do avatar', 0, 8, 1, 'px'),
    selectField('buttonStyle', 'Botões', ['solid', 'soft', 'outline', 'minimal']),
    selectField('badgeStyle', 'Tags', ['minimal', 'pill', 'outline', 'solid']),
    selectField('statsStyle', 'Métricas', ['cards', 'minimal', 'divider']),
    selectField('linkStyle', 'Links', ['buttons', 'list', 'chips']),
    selectField('motionLevel', 'Movimento', ['system', 'full', 'reduced', 'none'])
  ]),
  group('visibility', 'Visibilidade', [
    toggleField('showHandle', 'Mostrar @usuário'),
    toggleField('showStatus', 'Mostrar status'),
    toggleField('showBio', 'Mostrar bio'),
    toggleField('showLinks', 'Mostrar links'),
    toggleField('showStats', 'Mostrar métricas'),
    toggleField('showJoinDate', 'Mostrar data de entrada'),
    toggleField('showLocation', 'Mostrar localização'),
    toggleField('showPronouns', 'Mostrar pronomes'),
    toggleField('showHeadline', 'Mostrar headline'),
    toggleField('showCosmetics', 'Mostrar cosméticos'),
    toggleField('showActions', 'Mostrar ações')
  ]),
  group('sections', 'Ordem das seções', [
    { key: 'sectionOrder', label: 'Ordem', type: 'order', options: SECTION_IDS.map(value => ({ value, label: sectionLabel(value) })) }
  ])
]);

function registerProfileStudioRoutes(app) {
  ensureStorage();
  app.use('/api/profile-studio', express.json({ limit: '64kb' }));

  // Decorate established profile responses without breaking older clients.
  app.use((req, res, next) => {
    const isProfile = req.method === 'GET' && req.path.startsWith('/api/profile-v3/profile/');
    const isLeaderboard = req.method === 'GET' && req.path === '/api/profile-v3/leaderboard';
    if (!isProfile && !isLeaderboard) return next();
    const originalJson = res.json.bind(res);
    res.json = payload => {
      if (payload?.ok && isProfile && payload.profile?.id) {
        const studio = getStudio(payload.profile.id);
        payload = { ...payload, profile: { ...payload.profile, ...studio.identity, studio: studio.design } };
      } else if (payload?.ok && isLeaderboard && Array.isArray(payload.leaderboard)) {
        payload = {
          ...payload,
          leaderboard: payload.leaderboard.map(item => item?.id ? { ...item, studio: getStudio(item.id).design } : item)
        };
      }
      return originalJson(payload);
    };
    return next();
  });

  app.get('/api/profile-studio/me', requireSession, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, ...getStudio(req.account.id), schema: schemaView(), defaults: defaultsView() });
  });

  app.patch('/api/profile-studio/me', requireTrustedOrigin, requireSession, (req, res) => {
    const current = getStudio(req.account.id);
    const record = {
      accountId: req.account.id,
      identity: sanitizeIdentity(req.body?.identity, current.identity),
      design: sanitizeDesign(req.body?.design, current.design),
      updatedAt: new Date().toISOString()
    };
    saveStudio(record);
    return res.json({ ok: true, identity: record.identity, design: record.design, updatedAt: record.updatedAt });
  });

  app.post('/api/profile-studio/me/reset', requireTrustedOrigin, requireSession, (req, res) => {
    const current = getStudio(req.account.id);
    const scope = String(req.query?.scope || 'design').toLowerCase();
    const record = {
      accountId: req.account.id,
      identity: scope === 'all' ? { ...DEFAULT_IDENTITY } : current.identity,
      design: { ...DEFAULTS, sectionOrder: [...SECTION_IDS] },
      updatedAt: new Date().toISOString()
    };
    saveStudio(record);
    return res.json({ ok: true, identity: record.identity, design: record.design, updatedAt: record.updatedAt });
  });

  app.get('/api/profile-studio/:username', (req, res) => {
    const username = S.normalizeUsername(req.params.username);
    const account = S.loadAccounts().find(item => item.active && S.normalizeUsername(item.usernameLower || item.username) === username);
    if (!account) return res.status(404).json({ ok: false, error: 'Perfil não encontrado.' });
    res.setHeader('Cache-Control', 'public, max-age=60');
    const studio = getStudio(account.id);
    return res.json({ ok: true, username: account.username, identity: studio.identity, design: studio.design, updatedAt: studio.updatedAt });
  });
}

function getStudio(accountId) {
  const found = loadStudios().find(item => item.accountId === accountId) || {};
  return {
    identity: sanitizeIdentity(found.identity, DEFAULT_IDENTITY),
    design: sanitizeDesign(found.design, DEFAULTS),
    updatedAt: found.updatedAt || null
  };
}

function sanitizeIdentity(input, fallback) {
  const value = input && typeof input === 'object' ? input : {};
  const base = fallback && typeof fallback === 'object' ? fallback : DEFAULT_IDENTITY;
  return {
    pronouns: cleanText(value.pronouns ?? base.pronouns, 32),
    location: cleanText(value.location ?? base.location, 80),
    website: cleanUrl(value.website ?? base.website),
    links: sanitizeLinks(Object.prototype.hasOwnProperty.call(value, 'links') ? value.links : base.links)
  };
}

function sanitizeDesign(input, fallback) {
  const value = input && typeof input === 'object' ? input : {};
  const base = fallback && typeof fallback === 'object' ? fallback : DEFAULTS;
  const out = {};
  for (const groupDef of FIELD_DEFS) {
    for (const field of groupDef.fields) {
      if (field.key === 'sectionOrder') continue;
      const raw = Object.prototype.hasOwnProperty.call(value, field.key) ? value[field.key] : base[field.key];
      out[field.key] = sanitizeField(field, raw, DEFAULTS[field.key]);
    }
  }
  const orderRaw = Object.prototype.hasOwnProperty.call(value, 'sectionOrder') ? value.sectionOrder : base.sectionOrder;
  out.sectionOrder = sanitizeSectionOrder(orderRaw);
  return out;
}

function sanitizeField(field, raw, fallback) {
  if (field.type === 'color') return cleanColor(raw, fallback);
  if (field.type === 'toggle') return typeof raw === 'boolean' ? raw : Boolean(fallback);
  if (field.type === 'number') {
    const number = Number(raw);
    if (!Number.isFinite(number)) return Number(fallback);
    const step = Number(field.step || 1);
    const clamped = Math.max(field.min, Math.min(field.max, number));
    return Number((Math.round(clamped / step) * step).toFixed(step < 1 ? 2 : 0));
  }
  if (field.type === 'select') {
    const value = String(raw || '').trim().toLowerCase();
    return field.options.includes(value) ? value : fallback;
  }
  return fallback;
}

function sanitizeSectionOrder(input) {
  const list = Array.isArray(input) ? input.map(value => String(value || '').trim().toLowerCase()) : [];
  const unique = [...new Set(list.filter(value => SECTION_IDS.includes(value)))];
  for (const section of SECTION_IDS) if (!unique.includes(section)) unique.push(section);
  return unique;
}

function sanitizeLinks(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const entry of input.slice(0, 6)) {
    if (!entry || typeof entry !== 'object') continue;
    const url = cleanUrl(entry.url);
    if (!url) continue;
    const label = cleanText(entry.label, 40) || hostnameLabel(url);
    out.push({ label, url });
  }
  return out;
}

function cleanUrl(value) {
  const raw = String(value || '').trim().slice(0, 320);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    parsed.username = '';
    parsed.password = '';
    return parsed.toString().slice(0, 320);
  } catch { return ''; }
}

function hostnameLabel(value) {
  try { return new URL(value).hostname.replace(/^www\./, '').slice(0, 40); }
  catch { return 'Link'; }
}

function cleanColor(value, fallback) {
  const raw = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : fallback;
}

function cleanText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function schemaView() {
  return FIELD_DEFS.map(groupDef => ({
    id: groupDef.id,
    label: groupDef.label,
    fields: groupDef.fields.map(field => ({ ...field }))
  }));
}

function defaultsView() {
  return { identity: { ...DEFAULT_IDENTITY, links: [] }, design: { ...DEFAULTS, sectionOrder: [...SECTION_IDS] } };
}

function group(id, label, fields) { return Object.freeze({ id, label, fields: Object.freeze(fields) }); }
function numberField(key, label, min, max, step, unit) { return Object.freeze({ key, label, type: 'number', min, max, step, unit }); }
function colorField(key, label) { return Object.freeze({ key, label, type: 'color' }); }
function toggleField(key, label) { return Object.freeze({ key, label, type: 'toggle' }); }
function selectField(key, label, options) { return Object.freeze({ key, label, type: 'select', options: Object.freeze(options) }); }
function sectionLabel(value) {
  return ({ identity: 'Identidade', status: 'Status', bio: 'Bio', links: 'Links', stats: 'Métricas', join: 'Entrada' })[value] || value;
}

function cleanupProfileStudioAccount(accountId) {
  if (!accountId) return;
  writeJsonAtomic(STUDIO_FILE, loadStudios().filter(item => item.accountId !== accountId));
}

function ensureStorage() {
  fs.mkdirSync(C.DATA_DIR, { recursive: true });
  if (!fs.existsSync(STUDIO_FILE)) writeJsonAtomic(STUDIO_FILE, []);
}

function loadStudios() {
  ensureStorage();
  try {
    const value = JSON.parse(fs.readFileSync(STUDIO_FILE, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function saveStudio(record) {
  const all = loadStudios();
  const index = all.findIndex(item => item.accountId === record.accountId);
  if (index < 0) all.push(record); else all[index] = record;
  writeJsonAtomic(STUDIO_FILE, all);
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
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

function requireTrustedOrigin(req, res, next) {
  const origin = String(req.get('origin') || '').trim();
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

module.exports = {
  registerProfileStudioRoutes,
  cleanupProfileStudioAccount,
  getStudio,
  sanitizeDesign,
  sanitizeIdentity,
  DEFAULTS,
  DEFAULT_IDENTITY,
  FIELD_DEFS
};
