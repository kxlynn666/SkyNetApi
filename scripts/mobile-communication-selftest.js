const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const mobile = read('src/mobile-auth.js');
const store = read('src/store.js');
const social = read('src/social.js');
const calls = read('src/realtime-calls-v3.js');
const product = read('src/product-meta.js');

function expect(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expect(mobile, /\/api\/mobile\/auth\/exchange/, 'rota de troca mobile ausente');
expect(mobile, /S\.createSession\(auth\.account\.id/, 'troca mobile não reutiliza a sessão SkyNet');
expect(mobile, /mobileKeyId:\s*auth\.record\.id/, 'sessão móvel não está vinculada à API key');
expect(mobile, /cookieName:\s*'skynet_session'/, 'contrato do cookie social móvel ausente');
expect(store, /session\.mobileKeyId/, 'store não valida vínculo móvel');
expect(store, /safeEqualHex\(session\.mobileKeyHash,\s*key\.keyHash\)/, 'rotação da API key não invalida a sessão móvel');
expect(social, /getSessionAccountFromCookie\(socket\.handshake\.headers\.cookie/, 'Socket.IO social deixou de usar a sessão compartilhada');
expect(social, /app\.get\('\/api\/social\/conversations'/, 'rota de conversas ausente');
expect(social, /app\.post\('\/api\/social\/messages\/:userId'/, 'rota de envio de mensagem ausente');
expect(social, /app\.patch\('\/api\/social\/account\/profile'/, 'rota de edição de perfil ausente');
expect(calls, /socket\.on\('call3:invite'/, 'convite de chamada v3 ausente');
expect(calls, /socket\.on\('call3:signal'/, 'signaling WebRTC v3 ausente');
expect(calls, /payload\?\.mode === 'video' \? 'video' : 'audio'/, 'modo de áudio das chamadas v3 ausente');
expect(product, /mobileCommunication:\s*true/, 'capability mobileCommunication não publicada');

console.log('mobile communication contract OK');
