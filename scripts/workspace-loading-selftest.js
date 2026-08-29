const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workspace = fs.readFileSync(path.join(root, 'public/workspace.html'), 'utf8');
const bootGuard = fs.readFileSync(path.join(root, 'public/workspace-boot-guard-v1.js'), 'utf8');
const sessionHotfix = fs.readFileSync(path.join(root, 'public/workspace-session-hotfix-v1.js'), 'utf8');
const featureLoader = fs.readFileSync(path.join(root, 'public/workspace-feature-loader-v1.js'), 'utf8');
const robloxCodes = fs.readFileSync(path.join(root, 'public/roblox-codes-v1.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

new Function(bootGuard);
new Function(sessionHotfix);
new Function(robloxCodes);

const guardPos = workspace.indexOf('/workspace-boot-guard-v1.js?v=1');
const commonPos = workspace.indexOf('/common.js?v=workspace-boot-1');
const sessionPos = workspace.indexOf('/workspace-session-hotfix-v1.js?v=1');
const dashboardPos = workspace.indexOf('/dashboard.js?v=youtube-local-2&workspace-boot=1');
const socketPos = workspace.indexOf('/socket.io/socket.io.js');
const realtimePos = workspace.indexOf('/realtime-core-v1.js');

assert(guardPos >= 0, 'Guard do boot não está carregado.');
assert(commonPos > guardPos, 'common.js precisa carregar depois do guard.');
assert(sessionPos > commonPos, 'Hotfix da sessão precisa carregar depois do common.js.');
assert(dashboardPos > sessionPos, 'Dashboard precisa carregar depois do hotfix da sessão.');
assert(socketPos > dashboardPos, 'Socket.IO voltou ao caminho crítico antes do dashboard.');
assert(realtimePos > socketPos, 'Realtime core deve carregar depois do Socket.IO.');

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

console.log('Workspace loading self-test OK');
