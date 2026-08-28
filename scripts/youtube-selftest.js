const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseYouTubeUrl, qualityOptionsFromInfo, chooseRequestedHeight, parseRangeHeader } = require('../src/youtube');
const { normalizeKind, parseRangeHeader: parseRangeV4 } = require('../src/youtube-media-v4');
const { normalizeSearchQuery, mapSearchResult, formatDuration, formatCompactNumber } = require('../src/youtube-search-v1');

const watch = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc');
assert.strictEqual(watch.id, 'dQw4w9WgXcQ');
assert.strictEqual(watch.canonical, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert.strictEqual(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=12').id, 'dQw4w9WgXcQ');
assert.strictEqual(parseYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ').id, 'dQw4w9WgXcQ');
assert.throws(() => parseYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ'), /youtube\.com|youtu\.be/i);
assert.throws(() => parseYouTubeUrl('https://www.youtube.com/watch?v=curto'), /identificar/i);

const qualities = qualityOptionsFromInfo({ formats: [
  { vcodec:'avc1', height:360 }, { vcodec:'avc1', height:720 }, { vcodec:'avc1', height:1080 }, { vcodec:'none', height:null }
] });
assert.deepStrictEqual(qualities.map(item => item.height), [360, 720, 1080]);
assert.strictEqual(chooseRequestedHeight(qualities, 1080), 1080);
assert.strictEqual(chooseRequestedHeight(qualities, 900), 720);
assert.strictEqual(chooseRequestedHeight(qualities, undefined), 720);
assert.deepStrictEqual(qualityOptionsFromInfo({ formats:[{ vcodec:'avc1', height:480 }] }).map(item => item.height), [360]);
assert.strictEqual(qualityOptionsFromInfo({ formats:[] }).length, 0);
assert.strictEqual(normalizeKind('audio'), 'audio');
assert.strictEqual(normalizeKind('video'), 'video');
assert.strictEqual(normalizeKind('qualquer-coisa'), 'video');

assert.deepStrictEqual(parseRangeHeader('bytes=0-99', 1000), { start:0, end:99 });
assert.deepStrictEqual(parseRangeV4('bytes=500-', 1000), { start:500, end:999 });
assert.deepStrictEqual(parseRangeV4('bytes=-100', 1000), { start:900, end:999 });
assert.strictEqual(parseRangeV4('bytes=2000-3000', 1000), null);
assert.strictEqual(parseRangeV4('items=0-2', 1000), null);

assert.strictEqual(normalizeSearchQuery('  hollow   knight  '), 'hollow knight');
assert.throws(() => normalizeSearchQuery('a'), /2 caracteres/i);
assert.strictEqual(formatDuration(65), '1:05');
assert.ok(formatCompactNumber(1250000).length > 0);
const mappedSearch = mapSearchResult({
  id:'dQw4w9WgXcQ',
  title:'Teste',
  uploader:'Canal Teste',
  channel:'Canal Teste',
  duration:215,
  view_count:123456,
  like_count:789,
  comment_count:45,
  upload_date:'20260828',
  thumbnail:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  webpage_url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  description:'Descrição teste'
});
assert.strictEqual(mappedSearch.id, 'dQw4w9WgXcQ');
assert.strictEqual(mappedSearch.durationText, '3:35');
assert.strictEqual(mappedSearch.viewCount, 123456);
assert.strictEqual(mappedSearch.uploadDate, '2026-08-28');
assert.ok(mappedSearch.thumbnail.startsWith('https://'));

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const youtube = fs.readFileSync(path.join(root, 'src/youtube.js'), 'utf8');
const youtubeV4 = fs.readFileSync(path.join(root, 'src/youtube-media-v4.js'), 'utf8');
const youtubeSearch = fs.readFileSync(path.join(root, 'src/youtube-search-v1.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'public/youtube-downloader-v1.js'), 'utf8');
const clientV4 = fs.readFileSync(path.join(root, 'public/youtube-downloader-v4.js'), 'utf8');
const searchClient = fs.readFileSync(path.join(root, 'public/youtube-search-v1.js'), 'utf8');
const featureLoader = fs.readFileSync(path.join(root, 'public/workspace-feature-loader-v1.js'), 'utf8');
const legacyBlocker = fs.readFileSync(path.join(root, 'public/youtube-v4-block-legacy.js'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'public/youtube-menu-v1.js'), 'utf8');
const authHotfix = fs.readFileSync(path.join(root, 'public/youtube-auth-error-hotfix-v1.js'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'public/workspace.html'), 'utf8');

new Function(menu);
new Function(authHotfix);
new Function(clientV4);
new Function(searchClient);
new Function(featureLoader);
new Function(legacyBlocker);
assert(server.includes("const { registerYouTubeMediaV4Routes } = require('./src/youtube-media-v4')"), 'Server não importa o backend YouTube v4.');
assert(server.includes('registerYouTubeMediaV4Routes(app);'), 'Server não registra o backend YouTube v4.');
assert(server.indexOf('registerYouTubeMediaV4Routes(app);') < server.indexOf('registerYouTubeRoutes(app);'), 'Backend v4 precisa ser registrado antes das rotas legadas.');
assert(server.includes("const { registerYouTubeSearchRoutes } = require('./src/youtube-search-v1')"), 'Server não importa o ytsearch10.');
assert(server.includes('registerYouTubeSearchRoutes(app);'), 'Server não registra a rota ytsearch10.');
assert(server.includes("'/painel/youtube',"), 'Rota de workspace do YouTube ausente.');
assert(!server.includes("app.get('/painel/youtube', (req, res) => res.redirect"), 'YouTube ainda está redirecionando para outra página.');
assert(youtube.includes("app.post('/painel/youtube-prepare'") && youtube.includes("app.get('/painel/youtube-file'") && youtube.includes("app.get('/painel/youtube-download'"), 'Rotas legadas do arquivo local não estão registradas.');

assert(youtubeV4.includes("--extract-audio") && youtubeV4.includes("--audio-format', 'mp3'"), 'Backend v4 não prepara áudio MP3 com yt-dlp.');
assert(youtubeV4.includes("extension: 'mp3'") && youtubeV4.includes("mime: 'audio/mpeg'"), 'Backend v4 não publica áudio como MP3.');
assert(!youtubeV4.includes("'--no-part'"), 'Backend v4 desativou arquivos .part do yt-dlp, aumentando risco de arquivo incompleto.');
assert(youtubeV4.includes('findCompletedFile') && youtubeV4.includes("lower.endsWith('.part')"), 'Backend v4 não exclui arquivos parciais da publicação.');
assert(youtubeV4.includes('validateMediaFile') && youtubeV4.includes("'-xerror'") && youtubeV4.includes("'-f', 'null'"), 'Backend v4 não valida a mídia completa com FFmpeg.');
assert(youtubeV4.includes("crypto.createHash('sha256')") && youtubeV4.includes('verifyPreparedIntegrity'), 'Backend v4 não verifica integridade por SHA-256.');
assert(youtubeV4.includes('fs.promises.rename') && youtubeV4.includes('syncFile') && youtubeV4.includes('syncDirectory'), 'Backend v4 não faz publicação final sincronizada/atômica.');
assert(youtubeV4.includes('Accept-Ranges') && youtubeV4.includes('Content-Range'), 'Streaming v4 não oferece suporte a Range.');
assert(youtubeV4.includes("app.post('/painel/youtube-prepare'") && youtubeV4.includes("app.get('/painel/youtube-file'") && youtubeV4.includes("app.get('/painel/youtube-download'"), 'Rotas v4 não estão registradas.');

assert(youtubeSearch.includes('ytsearch${SEARCH_LIMIT}:') && youtubeSearch.includes('const SEARCH_LIMIT = 10'), 'Backend não usa ytsearch10 do yt-dlp.');
assert(youtubeSearch.includes("app.get('/painel/youtube-search'"), 'Endpoint de busca do YouTube não está registrado.');
assert(youtubeSearch.includes('view_count') && youtubeSearch.includes('duration') && youtubeSearch.includes('thumbnail'), 'Busca não retorna views, duração e thumbnail.');
assert(youtubeSearch.includes('uploader') && youtubeSearch.includes('channel') && youtubeSearch.includes('upload_date'), 'Busca não retorna metadados completos de canal/data.');

assert(client.includes('/painel/youtube-prepare'), 'Frontend legado não prepara arquivo antes do player.');
assert(clientV4.includes('value="audio"') && clientV4.includes('Áudio · MP3'), 'Frontend v4 não oferece opção de áudio.');
assert(clientV4.includes("kind === 'audio'") && clientV4.includes('<audio controls'), 'Frontend v4 não reproduz o MP3 preparado.');
assert(clientV4.includes('<video controls') && clientV4.includes('streamUrl'), 'Frontend v4 não reproduz o MP4 preparado.');
assert(clientV4.includes('downloadUrl') && clientV4.includes('Baixar MP3') && clientV4.includes('Baixar MP4'), 'Frontend v4 não oferece downloads de vídeo e áudio.');
assert(clientV4.includes('SHA-256') && clientV4.includes('Integridade verificada'), 'Frontend v4 não mostra a validação de integridade.');
assert(!clientV4.includes('<iframe'), 'Frontend v4 voltou a usar iframe em vez do arquivo preparado.');

assert(searchClient.includes('/painel/youtube-search?q=') && searchClient.includes('Pesquisar 10 resultados'), 'Frontend não chama o endpoint ytsearch10.');
assert(searchClient.includes('viewCount') && searchClient.includes('durationText') && searchClient.includes('thumbnail'), 'Frontend não exibe os metadados principais da busca.');
assert(searchClient.includes('Usar no downloader') && searchClient.includes('youtubeMediaUrlV4'), 'Resultado não pode ser enviado ao downloader existente.');
assert(featureLoader.includes('/youtube-search-v1.js?v=1'), 'Loader do workspace não carrega o frontend ytsearch10.');

assert(legacyBlocker.includes('__SKYNET_YOUTUBE_DOWNLOADER_V1__ = true'), 'Frontend legado não está bloqueado antes da v4.');
assert(menu.includes('/painel/youtube') && menu.includes('YouTube Downloader'), 'YouTube Downloader não está garantido no menu lateral.');
assert(authHotfix.includes('Isso não significa que o vídeo seja 18+'), 'Falso positivo de verificação de idade não está sendo corrigido no frontend.');
assert(authHotfix.includes("path.startsWith('/painel/youtube-')"), 'Correção de erro do YouTube está ampla demais.');
assert(workspace.includes('/youtube-auth-error-hotfix-v1.js?v=1'), 'Correção do falso positivo do YouTube não está carregada.');
assert(workspace.includes('/youtube-v4-block-legacy.js?v=1'), 'Bloqueio do frontend legado não está carregado.');
assert(workspace.includes('/youtube-downloader-v4.js?v=audio-integrity-1'), 'Frontend v4 não está carregado com cache-busting.');
assert(!workspace.includes('/youtube-downloader-v1.js?v=local-player-2'), 'Frontend legado ainda está carregando diretamente e pode disputar o DOM.');
assert(workspace.indexOf('/youtube-v4-block-legacy.js?v=1') < workspace.indexOf('/youtube-downloader-v4.js?v=audio-integrity-1'), 'Bloqueio legado precisa carregar antes do frontend v4.');
assert(workspace.includes('/youtube-menu-v1.js?v=1'), 'Fix do menu do YouTube não está carregado.');
assert(clientV4.includes('permissão para salvar'), 'Aviso de uso responsável ausente.');

console.log('YouTube downloader v4 self-test OK (MP4 + MP3 + integridade + ytsearch10)');
