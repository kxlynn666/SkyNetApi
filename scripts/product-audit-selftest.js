const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { sanitizeDesign, sanitizeIdentity, DEFAULTS, FIELD_DEFS } = require('../src/profile-studio');
const { PAGES, ENDPOINTS } = require('../src/product-meta');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const server = read('server.js');
const common = read('public/common.js');
const publicHtml = read('public/public-profile.html');
const publicProfile = read('public/public-profile.js');
const animatedProfile = read('public/public-profile-animated-media-v1.js');
const studioClient = read('public/profile-studio-v1.js');
const statusClient = read('public/system-status-v1.js');
const postboot = read('public/workspace-postboot-v1.js');
const routeReady = read('public/workspace-route-ready-v1.js');
const featureLoader = read('public/workspace-feature-loader-v1.js');
const menu = read('public/workspace-menu-v2.js');
const workspace = read('public/workspace.html');

for (const source of [common, publicProfile, animatedProfile, studioClient, statusClient, postboot, routeReady, featureLoader, menu]) new Function(source);

const design = sanitizeDesign({
  profileWidth: 99999,
  bannerHeight: -5,
  accentColor: 'red',
  fontFamily: 'remote-font',
  motionLevel: 'hyper',
  sectionOrder: ['bio', 'bio', 'invalid', 'identity']
}, DEFAULTS);
assert.strictEqual(design.profileWidth, 1200, 'Studio não limita a largura máxima.');
assert.strictEqual(design.bannerHeight, 140, 'Studio não limita a altura mínima do banner.');
assert.strictEqual(design.accentColor, DEFAULTS.accentColor, 'Studio aceitou cor fora do formato seguro.');
assert.strictEqual(design.fontFamily, DEFAULTS.fontFamily, 'Studio aceitou família de fonte arbitrária.');
assert.strictEqual(design.motionLevel, DEFAULTS.motionLevel, 'Studio aceitou nível de movimento inválido.');
assert.deepStrictEqual(design.sectionOrder.slice(0, 2), ['bio', 'identity']);
assert.strictEqual(new Set(design.sectionOrder).size, design.sectionOrder.length, 'Ordem de seções manteve duplicatas.');
assert.ok(FIELD_DEFS.flatMap(group => group.fields).length >= 45, 'Profile Studio perdeu granularidade de controles.');

const identity = sanitizeIdentity({
  pronouns: '  ele/dele  ',
  website: 'javascript:alert(1)',
  links: [
    { label: 'Seguro', url: 'https://user:pass@example.com/path' },
    { label: 'Inválido', url: 'data:text/html,test' }
  ]
}, {});
assert.strictEqual(identity.pronouns, 'ele/dele');
assert.strictEqual(identity.website, '', 'Studio aceitou protocolo perigoso em website.');
assert.strictEqual(identity.links.length, 1, 'Studio não filtrou links perigosos.');
assert.strictEqual(identity.links[0].url, 'https://example.com/path', 'Credenciais não foram removidas do link público.');

assert(server.includes('registerProductMetaRoutes(app);'), 'Manifesto do produto não está registrado.');
assert(server.includes('registerProfileStudioRoutes(app);'), 'Profile Studio não está registrado.');
assert(server.indexOf('registerProfileStudioRoutes(app);') < server.indexOf('registerProfileEconomyRoutes(app);'), 'Studio deve decorar profile-v3 antes da rota responder.');
assert(server.includes("'/painel/perfil/studio'") && server.includes("'/painel/status'"), 'Novas páginas não estão publicadas no workspace.');
assert(server.includes('cleanupProfileStudioAccount(accountId)'), 'Exclusão de conta não remove dados do Studio.');

assert(PAGES.some(page => page.path === '/painel/perfil/studio'), 'Manifesto não lista Profile Studio.');
assert(PAGES.some(page => page.path === '/painel/status'), 'Manifesto não lista status.');
assert(ENDPOINTS.some(item => item.method === 'GET' && item.path === '/api/profile-studio/me'), 'Manifesto não documenta GET do Studio.');
assert(ENDPOINTS.some(item => item.method === 'GET' && item.path === '/api/meta/routes'), 'Manifesto não documenta suas próprias rotas.');

assert(common.startsWith('window.SkyNet = window.SkyNet ||'), 'common.js voltou a sobrescrever o runtime SkyNet do boot.');
assert(common.includes('if (!element) return;'), 'Helper de mensagens voltou a falhar com elemento ausente.');
assert(!publicHtml.includes('<script src="/common.js'), 'Perfil público voltou a carregar o pacote global pesado.');
assert(publicHtml.includes('/workspace-core-v1.js?v=profile-public-1'), 'Perfil público não usa o núcleo mínimo.');
assert(publicHtml.includes('/public-profile-animated-media-v1.js?v=1'), 'Perfil público não carrega a camada de mídia animada do Studio.');
assert(!publicHtml.includes('/profile-media-public-v1.js'), 'Perfil público voltou a carregar o adaptador de mídia das classes antigas.');
assert(publicProfile.includes('p.studio') && publicProfile.includes('sectionOrder'), 'Perfil público não aplica o Profile Studio.');
assert(publicProfile.includes('rel="noopener noreferrer"'), 'Links públicos não estão protegidos ao abrir nova aba.');
assert(publicProfile.includes('safeHttpUrl'), 'Perfil público não revalida links HTTP/HTTPS no cliente.');
assert(animatedProfile.includes('data.avatar') && animatedProfile.includes('data.banner'), 'Mídia animada não usa os campos públicos de avatar/banner.');
assert(animatedProfile.includes('video.autoplay = true') && animatedProfile.includes('video.loop = true') && animatedProfile.includes('video.muted = true'), 'Vídeos do perfil perderam autoplay seguro/mudo/loop.');
assert(animatedProfile.includes("video.playsInline = true"), 'Vídeo animado do perfil perdeu playsinline no mobile.');

assert(routeReady.includes('workspace-route-pending'), 'Proteção contra flash entre rotas não está ativa.');
assert(routeReady.includes("title !== 'Visão geral'"), 'Proteção não reconhece o fallback visual incorreto do dashboard.');
assert(routeReady.includes('7000'), 'Proteção de rota pode esconder a interface indefinidamente.');
assert(postboot.includes('const routeLayer = startRouteLayer()'), 'Camada de rota não começa antes do runtime pesado.');
assert(postboot.includes("'/painel/perfil/studio'"), 'Studio não está na lista de runtime leve.');
assert(postboot.includes("'/painel/status'"), 'Status não está na lista de runtime leve.');
assert(postboot.includes('/workspace-feature-loader-v1.js?v=route-ready-2'), 'Feature loader novo não está cache-busted.');
assert(featureLoader.includes("path === '/painel/perfil/studio'") && featureLoader.includes('/profile-studio-v1.js?v=2'), 'Feature loader não carrega Profile Studio atualizado.');
assert(featureLoader.includes("path === '/painel/status'") && featureLoader.includes('/system-status-v1.js?v=2'), 'Feature loader não carrega status atualizado.');
assert(featureLoader.includes('findOrCreateGroup') && featureLoader.includes("'Jogos', 'workspaceGamesNav'"), 'Feature loader não reutiliza o grupo Jogos existente.');
assert(!featureLoader.includes('tttNavGroup'), 'Grupo Jogos duplicado voltou ao feature loader.');
assert(!featureLoader.includes('/youtube-downloader-v1.js'), 'Downloader legado do YouTube voltou ao runtime.');
assert(menu.includes('/painel/perfil/studio') && menu.includes('Profile Studio'), 'Menu não expõe Profile Studio.');
assert(menu.includes('/painel/status') && menu.includes('Status e diagnóstico'), 'Menu não expõe status.');
assert(workspace.includes('/workspace-route-ready-v1.js?v=1'), 'Workspace não carrega proteção contra flash de rota.');
assert(workspace.includes('/workspace-postboot-v1.js?v=route-ready-2'), 'Workspace pode reutilizar pós-boot antigo em cache.');

console.log(`Product audit self-test OK (${FIELD_DEFS.flatMap(group => group.fields).length} controles + transição de rota + mídia animada)`);
