const pkg = require('../package.json');
const S = require('./store');

const PAGES = Object.freeze([
  page('/painel', 'Visão geral', 'workspace'),
  page('/painel/perfil', 'Perfil', 'social'),
  page('/painel/perfil/studio', 'Profile Studio', 'social'),
  page('/painel/amigos', 'Amigos', 'social'),
  page('/painel/chat', 'Chat', 'social'),
  page('/painel/grupos', 'Grupos', 'social'),
  page('/painel/chaves', 'API Keys', 'api'),
  page('/painel/api', 'Rotas de API', 'api'),
  page('/painel/status', 'Status e diagnóstico', 'system'),
  page('/painel/cards', 'Card Studio', 'creation'),
  page('/painel/uploads', 'Uploads', 'creation'),
  page('/painel/historico', 'Histórico', 'creation'),
  page('/painel/youtube', 'YouTube Downloader', 'tools'),
  page('/painel/youtube-search', 'YouTube Search', 'tools'),
  page('/painel/tiktok', 'TikTok Downloader', 'tools'),
  page('/painel/media', 'Media Downloader', 'tools'),
  page('/painel/roblox', 'Roblox Lookup', 'tools'),
  page('/painel/roblox-codes', 'Roblox Codes', 'tools'),
  page('/painel/upscale', 'AI Upscaler', 'creation'),
  page('/painel/musica', 'Música', 'media'),
  page('/painel/jogos', 'Jogos', 'games')
]);

const ENDPOINTS = Object.freeze([
  endpoint('GET', '/health', 'Estado público do serviço', false),
  endpoint('GET', '/api/meta', 'Manifesto de recursos e versão', false),
  endpoint('GET', '/api/meta/routes', 'Páginas e endpoints documentados', false),
  endpoint('GET', '/api/mobile/session', 'Validar API key para o aplicativo Android', true),
  endpoint('GET', '/api/auth/me', 'Sessão atual', true),
  endpoint('GET', '/api/profile-v3/profile/:username', 'Perfil público completo', false),
  endpoint('GET', '/api/profile-studio/:username', 'Configuração pública do Profile Studio', false),
  endpoint('GET', '/api/profile-studio/me', 'Editor e schema do Profile Studio', true),
  endpoint('PATCH', '/api/profile-studio/me', 'Salvar identidade extra e design', true),
  endpoint('POST', '/api/profile-studio/me/reset', 'Restaurar design padrão', true),
  endpoint('GET', '/api/profile-store/catalog', 'Catálogo de cosméticos', false),
  endpoint('GET', '/api/profile-store/me', 'Inventário e carteira', true),
  endpoint('GET', '/api/social/me', 'Conta e perfil social', true),
  endpoint('PATCH', '/api/social/account/profile', 'Editar identidade social', true),
  endpoint('GET', '/api/youtube/search?q=', 'Buscar vídeos do YouTube', true),
  endpoint('GET', '/api/roblox-codes/volleyball-legends', 'Códigos Roblox agregados', true),
  endpoint('GET', '/api/keys', 'Listar API keys da conta', true),
  endpoint('POST', '/api/keys', 'Criar API key', true),
  endpoint('POST', '/api/uploads', 'Enviar imagem para biblioteca', true)
]);

function registerProductMetaRoutes(app) {
  app.get('/api/meta', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json({
      ok: true,
      product: 'SkyNetApi',
      version: String(pkg.version || '2.0.0'),
      principles: ['simple-first', 'progressive-disclosure', 'mobile-first', 'api-first', 'safe-customization'],
      capabilities: {
        workspace: true,
        profiles: true,
        profileStudio: true,
        social: true,
        realtime: true,
        apiKeys: true,
        uploads: true,
        mediaTools: true,
        games: true
      },
      counts: { pages: PAGES.length, documentedEndpoints: ENDPOINTS.length },
      links: { home: '/', workspace: '/painel', profileStudio: '/painel/perfil/studio', status: '/painel/status' }
    });
  });

  app.get('/api/meta/routes', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json({ ok: true, pages: PAGES, endpoints: ENDPOINTS });
  });

  app.get('/api/mobile/session', requireApiKey, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      account: S.publicAccountView(req.account),
      apiKey: S.publicKeyView(req.apiKeyRecord)
    });
  });
}

function requireApiKey(req, res, next) {
  try {
    const authorization = String(req.headers.authorization || '');
    const bearer = authorization.toLowerCase().startsWith('bearer ')
      ? authorization.slice(7).trim()
      : '';
    const apiKey = String(req.headers['x-api-key'] || bearer || '').trim();
    const auth = S.authenticateApiKey(apiKey);
    if (!auth) return res.status(401).json({ ok: false, error: 'API key inválida ou ausente.' });
    req.account = auth.account;
    req.apiKeyRecord = auth.record;
    return next();
  } catch (error) {
    return next(error);
  }
}

function page(path, label, group) { return Object.freeze({ path, label, group }); }
function endpoint(method, path, description, auth) { return Object.freeze({ method, path, description, auth }); }

module.exports = { registerProductMetaRoutes, PAGES, ENDPOINTS };
