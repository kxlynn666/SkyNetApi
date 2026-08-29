const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseYouTubeUrl, qualityOptionsFromInfo, chooseRequestedHeight, parseRangeHeader } = require('../src/youtube');
const { normalizeKind, parseRangeHeader: parseRangeV4 } = require('../src/youtube-media-v4');
const { normalizeSearchQuery, mapSearchResult, extractVideoId, downloadRestriction, formatDuration, formatCompactNumber } = require('../src/youtube-search-v1');

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
assert.strictEqual(extractVideoId({ id:'dQw4w9WgXcQ' }), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoId({ webpage_url:'https://youtu.be/dQw4w9WgXcQ?t=1' }), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoId({ url:'https://www.youtube.com/shorts/dQw4w9WgXcQ' }), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoId({ url:'https://googlevideo.com/videoplayback' }), '');
assert.ok(downloadRestriction({ ageLimit:18, isLive:false, availability:'public' }));
assert.ok(downloadRestriction({ ageLimit:0, isLive:true, availability:'public' }));
assert.strictEqual(downloadRestriction({ ageLimit:0, isLive:false, availability:'public' }), '');

const mappedSearch = mapSearchResult({
  id:'dQw4w9WgXcQ', title:'Teste', uploader:'Canal Teste', channel:'Canal Teste', duration:215,
  view_count:123456, like_count:789, comment_count:45, upload_date:'20260828',
  thumbnail:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  url:'https://rr1---sn.example.googlevideo.com/videoplayback?expire=1',
  webpage_url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ&pp=search-param',
  availability:'public', description:'Descrição teste'
});
assert.strictEqual(mappedSearch.id, 'dQw4w9WgXcQ');
assert.strictEqual(mappedSearch.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert.strictEqual(mappedSearch.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert.strictEqual(mappedSearch.downloadable, true);
assert.strictEqual(mappedSearch.durationText, '3:35');
assert.strictEqual(mappedSearch.uploadDate, '2026-08-28');

const restrictedSearch = mapSearchResult({ id:'dQw4w9WgXcQ', title:'Restrito', age_limit:18, availability:'public' });
assert.strictEqual(restrictedSearch.downloadable, false);
assert.ok(restrictedSearch.unavailableReason);

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const youtubeV4 = fs.readFileSync(path.join(root, 'src/youtube-media-v4.js'), 'utf8');
const youtubeSearch = fs.readFileSync(path.join(root, 'src/youtube-search-v1.js'), 'utf8');
const clientV4 = fs.readFileSync(path.join(root, 'public/youtube-downloader-v4.js'), 'utf8');
const searchClient = fs.readFileSync(path.join(root, 'public/youtube-search-v1.js'), 'utf8');
const searchTransfer = fs.readFileSync(path.join(root, 'public/youtube-search-transfer-v2.js'), 'utf8');
const featureLoader = fs.readFileSync(path.join(root, 'public/workspace-feature-loader-v1.js'), 'utf8');
const postboot = fs.readFileSync(path.join(root, 'public/workspace-postboot-v1.js'), 'utf8');
const legacyBlocker = fs.readFileSync(path.join(root, 'public/youtube-v4-block-legacy.js'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'public/youtube-menu-v1.js'), 'utf8');
const authHotfix = fs.readFileSync(path.join(root, 'public/youtube-auth-error-hotfix-v1.js'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'public/workspace.html'), 'utf8');

for (const source of [clientV4, searchClient, searchTransfer, featureLoader, postboot, legacyBlocker, menu, authHotfix]) new Function(source);

assert(server.includes("const { registerYouTubeMediaV4Routes } = require('./src/youtube-media-v4')"));
assert(server.includes('registerYouTubeMediaV4Routes(app);'));
assert(server.indexOf('registerYouTubeMediaV4Routes(app);') < server.indexOf('registerYouTubeRoutes(app);'));
assert(server.includes("const { registerYouTubeSearchRoutes } = require('./src/youtube-search-v1')"));
assert(server.includes("'/painel/youtube',") && server.includes("'/painel/youtube-search',"));

assert(youtubeV4.includes("--extract-audio") && youtubeV4.includes("--audio-format', 'mp3'"));
assert(!youtubeV4.includes("'--no-part'"));
assert(youtubeV4.includes('validateMediaFile') && youtubeV4.includes("'-xerror'"));
assert(youtubeV4.includes("crypto.createHash('sha256')") && youtubeV4.includes('verifyPreparedIntegrity'));
assert(youtubeV4.includes('Accept-Ranges') && youtubeV4.includes('Content-Range'));

assert(youtubeSearch.includes('ytsearch${SEARCH_LIMIT}:') && youtubeSearch.includes('const SEARCH_LIMIT = 10'));
assert(youtubeSearch.includes("app.get('/api/youtube/search'"));
assert(!youtubeSearch.includes("app.get('/painel/youtube-search'"));
assert(youtubeSearch.includes("'--ignore-errors'"));
assert(youtubeSearch.includes('extractVideoId') && youtubeSearch.includes('canonicalUrl'));

assert(clientV4.includes('value="audio"') && clientV4.includes('Áudio · MP3'));
assert(clientV4.includes('<audio controls') && clientV4.includes('<video controls'));
assert(clientV4.includes('SHA-256') && clientV4.includes('Integridade verificada'));
assert(!clientV4.includes('<iframe'));
assert(clientV4.includes('permissão para salvar'));

assert(searchClient.includes("!== '/painel/youtube-search'"));
assert(searchClient.includes('/api/youtube/search?q=') && searchClient.includes('Pesquisar 10 resultados'));
assert(searchClient.includes('/painel/youtube?video=') && searchClient.includes('videoId'));
assert(!searchClient.includes('youtubeMediaUrlV4'));
assert(searchTransfer.includes("params.get('video')") && searchTransfer.includes('youtubeMediaUrlV4'));
assert(searchTransfer.includes('https://www.youtube.com/watch?v='));

assert(featureLoader.includes("path === '/painel/youtube-search'") && featureLoader.includes('/youtube-search-v1.js?v=3'));
assert(featureLoader.includes('/youtube-search-transfer-v2.js?v=3'));
assert(!featureLoader.includes("loadScript('/youtube-downloader-v1.js'"), 'Feature loader voltou a carregar o downloader legado.');
assert(postboot.includes("'/youtube-v4-block-legacy.js?v=1'"));
assert(postboot.includes("'/youtube-downloader-v4.js?v=stability-2'"));
assert(postboot.includes("'/youtube-menu-v1.js?v=3'"), 'Menu do YouTube não é garantido em todas as páginas.');
assert(postboot.includes("lightweightToolRoute"), 'Rotas do YouTube não estão protegidas do runtime global pesado.');

assert(legacyBlocker.includes('__SKYNET_YOUTUBE_DOWNLOADER_V1__ = true'));
assert(menu.includes('/painel/youtube') && menu.includes('YouTube Downloader'));
assert(menu.includes('/painel/youtube-search') && menu.includes('YouTube Search'));
assert(!menu.includes('observer.observe(document.documentElement'), 'Menu voltou a usar observer global pesado.');
assert(authHotfix.includes('Isso não significa que o vídeo seja 18+'));
assert(workspace.includes('/workspace-postboot-v1.js?v=2'));
assert(!workspace.includes('<script src="/youtube-downloader-v1.js'), 'Downloader legado voltou ao HTML inicial.');

console.log('YouTube self-test OK (v4 único + search separado + menu global + runtime leve)');
