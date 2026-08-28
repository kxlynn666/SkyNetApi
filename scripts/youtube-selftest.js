const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseYouTubeUrl, qualityOptionsFromInfo, chooseRequestedHeight, parseRangeHeader } = require('../src/youtube');

const watch = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc');
assert.strictEqual(watch.id, 'dQw4w9WgXcQ');
assert.strictEqual(watch.canonical, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
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
assert.strictEqual(chooseRequestedHeight(qualities, 1080), 1080);
assert.strictEqual(chooseRequestedHeight(qualities, 900), 720);
assert.strictEqual(chooseRequestedHeight(qualities, undefined), 720);
assert.deepStrictEqual(qualityOptionsFromInfo({ formats:[{ vcodec:'avc1', height:480 }] }).map(item => item.height), [360]);
assert.strictEqual(qualityOptionsFromInfo({ formats:[] }).length, 0);

assert.deepStrictEqual(parseRangeHeader('bytes=0-99', 1000), { start:0, end:99 });
assert.deepStrictEqual(parseRangeHeader('bytes=500-', 1000), { start:500, end:999 });
assert.deepStrictEqual(parseRangeHeader('bytes=-100', 1000), { start:900, end:999 });
assert.strictEqual(parseRangeHeader('bytes=2000-3000', 1000), null);
assert.strictEqual(parseRangeHeader('items=0-2', 1000), null);

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const youtube = fs.readFileSync(path.join(root, 'src/youtube.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'public/youtube-downloader-v1.js'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'public/youtube-menu-v1.js'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'public/workspace.html'), 'utf8');

new Function(menu);
assert(server.includes("registerYouTubeRoutes(app)"), 'Backend do YouTube não foi registrado.');
assert(server.includes("'/painel/youtube',"), 'Rota de workspace do YouTube ausente.');
assert(!server.includes("app.get('/painel/youtube', (req, res) => res.redirect"), 'YouTube ainda está redirecionando para outra página.');
assert(youtube.includes("app.post('/painel/youtube-prepare'") && youtube.includes("app.get('/painel/youtube-file'") && youtube.includes("app.get('/painel/youtube-download'"), 'Rotas do arquivo local não estão registradas.');
assert(youtube.includes('downloadYouTubeVideo') && youtube.includes('spawn(YTDLP_PATH'), 'O backend não está usando yt-dlp para preparar o vídeo.');
assert(youtube.includes('Accept-Ranges') && youtube.includes('Content-Range'), 'Streaming local não oferece suporte a Range.');
assert(client.includes('/painel/youtube-prepare'), 'Frontend não prepara o arquivo com yt-dlp antes do player.');
assert(client.includes('streamUrl') && client.includes('<video controls'), 'Frontend não toca o arquivo local preparado.');
assert(!client.includes('<iframe'), 'Frontend voltou a usar iframe em vez do MP4 preparado.');
assert(client.includes('downloadUrl'), 'Frontend não usa o mesmo arquivo preparado para download.');
assert(menu.includes('/painel/youtube') && menu.includes('YouTube Downloader'), 'YouTube Downloader não está garantido no menu lateral.');
assert(workspace.includes('/youtube-menu-v1.js?v=1'), 'Fix do menu do YouTube não está carregado com cache-busting.');
assert(workspace.includes('/youtube-downloader-v1.js?v=local-player-2'), 'Player local do YouTube não está carregado com cache-busting.');
assert(workspace.includes('/dashboard.js?v=youtube-local-2'), 'Dashboard não está com cache-busting para a rota do YouTube.');
assert(client.includes('permissão para salvar'), 'Aviso de uso responsável ausente.');

console.log('YouTube local downloader self-test OK');