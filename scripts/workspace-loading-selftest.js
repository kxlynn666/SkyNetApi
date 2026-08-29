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
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

new Function(core);
new Function(postboot);
new Function(bootGuard);
new Function(sessionHotfix);
new Function(robloxCodes);

const guardPos = workspace.indexOf('/workspace-boot-guard-v1.js?v=2');
const corePos = workspace.indexOf('/workspace-core-v1.js?v=1');
const sessionPos = workspace.indexOf('/workspace-session-hotfix-v1.js?v=2');
const dashboardPos = workspace.indexOf('/dashboard.js?v=panel-runtime-1');
const postbootPos = workspace.indexOf('/workspace-postboot-v1.js?v=1');

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
assert(postboot.includes("'/common.js?v=panel-runtime-1'"), 'common.js não foi movido para o pós-boot.');
assert(postboot.includes("'/socket.io/socket.io.js'"), 'Socket.IO não está disponível no pós-boot.');
assert(postboot.includes('requestIdleCallback'), 'Recursos secundários não são adiados para idle.');
assert(postboot.includes("path === '/painel/youtube'"), 'Pós-boot não prioriza a rota do YouTube.');
assert(postboot.includes("'/workspace-feature-loader-v1.js?v=panel-runtime-1'"), 'Feature loader não está no pós-boot.');

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

console.log('Workspace loading self-test OK (boot mínimo + pós-boot)');
