const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workspace = fs.readFileSync(path.join(root, 'public/workspace.html'), 'utf8');
const core = fs.readFileSync(path.join(root, 'public/workspace-core-v1.js'), 'utf8');
const postboot = fs.readFileSync(path.join(root, 'public/workspace-postboot-v1.js'), 'utf8');
const bootGuard = fs.readFileSync(path.join(root, 'public/workspace-boot-guard-v1.js'), 'utf8');
const sessionHotfix = fs.readFileSync(path.join(root, 'public/workspace-session-hotfix-v1.js'), 'utf8');
const featureLoader = fs.readFileSync(path.join(root, 'public/workspace-feature-loader-v1.js'), 'utf8');
const robloxCodes = fs.readFileSync(path.join(root, 'public/roblox-codes-v1.js'), 'utf8');
const youtubeMenu = fs.readFileSync(path.join(root, 'public/youtube-menu-v1.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

new Function(core);
new Function(postboot);
new Function(bootGuard);
new Function(sessionHotfix);
new Function(robloxCodes);
new Function(youtubeMenu);
new Function(featureLoader);

const guardPos = workspace.indexOf('/workspace-boot-guard-v1.js?v=2');
const corePos = workspace.indexOf('/workspace-core-v1.js?v=1');
const sessionPos = workspace.indexOf('/workspace-session-hotfix-v1.js?v=2');
const dashboardPos = workspace.indexOf('/dashboard.js?v=panel-runtime-1');
const postbootPos = workspace.indexOf('/workspace-postboot-v1.js?v=2');

assert(guardPos >= 0, 'Guard do boot não está carregado.');
assert(corePos > guardPos, 'Núcleo mínimo precisa carregar depois do guard.');
assert(sessionPos > corePos, 'Hotfix da sessão precisa carregar depois do núcleo.');
assert(dashboardPos > sessionPos, 'Dashboard precisa carregar depois do hotfix da sessão.');
assert(postbootPos > dashboardPos, 'Pós-boot precisa carregar depois do dashboard.');

for (const blocked of [
  '/common.js',
  '/socket.io/socket.io.js',
  '/realtime-core-v1.js',
  '/youtube-downloader-v4.js',
  '/social-router-v15.js'
]) {
  assert(!workspace.includes(`<script src="${blocked}`), `${blocked} voltou ao caminho crítico do workspace.`);
}

assert(core.includes('window.SkyNet = window.SkyNet ||'), 'Núcleo mínimo não cria a API do frontend.');
assert(core.includes("api('/api/auth/me')"), 'Núcleo mínimo não possui fallback de sessão.');
assert(postboot.includes("'/youtube-menu-v1.js?v=3'"), 'Menu do YouTube não é carregado globalmente no pós-boot.');
assert(postboot.includes("'/common.js?v=panel-runtime-2'"), 'common.js não está disponível no pós-boot das páginas normais.');
assert(postboot.includes("'/socket.io/socket.io.js'"), 'Socket.IO não está disponível no pós-boot das páginas normais.');
assert(postboot.includes('requestIdleCallback'), 'Recursos secundários não são adiados para idle.');
assert(postboot.includes("'/painel/youtube-search'"), 'Pós-boot não reconhece a rota YouTube Search como ferramenta leve.');
assert(postboot.includes("'/painel/roblox-codes'"), 'Pós-boot não reconhece Roblox Codes como ferramenta leve.');
assert(postboot.includes("'/workspace-feature-loader-v1.js?v=panel-tools-2'"), 'Feature loader atualizado não está no pós-boot.');
assert(!featureLoader.includes("loadScript('/youtube-downloader-v1.js'"), 'Downloader legado voltou a ser carregado no YouTube.');
assert(featureLoader.includes('/youtube-search-transfer-v2.js?v=3'), 'Transferência segura do Search não está atualizada.');
assert(youtubeMenu.includes('/painel/youtube') && youtubeMenu.includes('/painel/youtube-search'), 'Menu não garante as duas páginas do YouTube.');
assert(!youtubeMenu.includes('observer.observe(document.documentElement'), 'Menu do YouTube voltou a observar a página inteira e pode degradar performance.');

assert(bootGuard.includes('12000'), 'Guard não possui limite de tempo do boot.');
assert(bootGuard.includes('Tentar novamente') && bootGuard.includes('/painel/login'), 'Guard não oferece recuperação ao usuário.');
assert(sessionHotfix.includes('AbortController'), 'Sessão não possui cancelamento por timeout.');
assert(sessionHotfix.includes('attempt < 2'), 'Sessão não possui retry controlado.');
assert(sessionHotfix.includes('6500'), 'Timeout da sessão não está configurado.');

assert(server.includes("'/painel/roblox-codes',"), 'Servidor não publica a página Roblox Codes.');
assert(server.includes("'/painel/youtube-search',"), 'Servidor não publica a página YouTube Search.');
assert(featureLoader.includes("path === '/painel/roblox-codes'"), 'Loader não reconhece Roblox Codes.');
assert(featureLoader.includes("path === '/painel/youtube-search'"), 'Loader não reconhece YouTube Search.');
assert(robloxCodes.includes('workspaceWaitAttempts >= 125'), 'Roblox Codes voltou a esperar o workspace sem limite.');
assert(robloxCodes.includes('@media(max-width:560px)'), 'Roblox Codes perdeu o layout mobile compacto.');
assert(robloxCodes.includes("currentFilter = 'all'"), 'Roblox Codes não abre exibindo a lista completa.');

console.log('Workspace loading self-test OK (boot mínimo + ferramentas leves)');
