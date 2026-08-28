const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseYouTubeUrl, qualityOptionsFromInfo } = require('../src/youtube');

const watch = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc');
assert.strictEqual(watch.id, 'dQw4w9WgXcQ');
assert.strictEqual(watch.canonical, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert(watch.embed.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));

const short = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=12');
assert.strictEqual(short.id, 'dQw4w9WgXcQ');
const shorts = parseYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
assert.strictEqual(shorts.id, 'dQw4w9WgXcQ');

assert.throws(() => parseYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ'), /youtube\.com|youtu\.be/i);
assert.throws(() => parseYouTubeUrl('https://www.youtube.com/watch?v=curto'), /identificar/i);

const qualities = qualityOptionsFromInfo({
  formats: [
    { vcodec: 'avc1', height: 360 },
    { vcodec: 'avc1', height: 720 },
    { vcodec: 'avc1', height: 1080 },
    { vcodec: 'none', height: null }
  ]
});
assert.deepStrictEqual(qualities.map(item => item.height), [360, 720, 1080]);
assert.deepStrictEqual(qualityOptionsFromInfo({ formats:[{ vcodec:'avc1', height:480 }] }).map(item => item.height), [360]);
assert.strictEqual(qualityOptionsFromInfo({ formats:[] }).length, 0);

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const security = fs.readFileSync(path.join(root, 'src/global-security.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'public/workspace-feature-loader-v1.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'public/youtube-downloader-v1.js'), 'utf8');

assert(server.includes("registerYouTubeRoutes(app)"), 'Backend do YouTube não foi registrado.');
assert(server.includes("'/painel/youtube',"), 'Rota de workspace do YouTube ausente.');
assert(!server.includes("app.get('/painel/youtube', (req, res) => res.redirect"), 'YouTube ainda está redirecionando para outra página.');
assert(security.includes("frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com"), 'CSP não permite o player oficial.');
assert(loader.includes("/youtube-downloader-v1.js"), 'Frontend do downloader não é carregado.');
assert(client.includes('/painel/youtube-info') && client.includes('/painel/youtube-download'), 'Cliente não usa as rotas do downloader.');
assert(client.includes('permissão para salvar'), 'Aviso de uso responsável ausente.');

console.log('YouTube downloader self-test OK');
